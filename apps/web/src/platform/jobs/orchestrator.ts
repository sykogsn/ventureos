import { and, asc, eq, lte } from "drizzle-orm";
import type { JobId } from "@/contracts";
import { createId, nowIso } from "@/platform/ids";
import { ensureSchema, getClient, getDb } from "@/platform/persistence/db";
import { jobs as jobTable } from "@/platform/persistence/schema";

export type JobStatus = "queued" | "running" | "completed" | "failed";

export type Job = {
  id: JobId;
  name: string;
  payload: unknown;
  status: JobStatus;
  runAt: string;
  attempts: number;
  lastError?: string;
};

export type JobHandler = (job: Job) => Promise<void>;

export type JobOrchestrator = {
  register(name: string, handler: JobHandler): void;
  enqueue(name: string, payload?: unknown, runAt?: Date): Promise<Job>;
  processDue(): Promise<number>;
};

export const INTERRUPTED_BY_RESTART = "interrupted-by-restart";
export const INVALID_JOB_PAYLOAD = "Invalid persisted job payload.";

export function createJobOrchestrator(): JobOrchestrator {
  const handlers = new Map<string, JobHandler>();
  let recovery: Promise<void> | undefined;

  return {
    register(name, handler) {
      handlers.set(name, handler);
    },
    async enqueue(name, payload, runAt) {
      await ensureSchema();
      const now = nowIso();
      const job: Job = {
        id: createId<JobId>(),
        name,
        payload: payload ?? null,
        status: "queued",
        runAt: (runAt ?? new Date()).toISOString(),
        attempts: 0,
      };

      await getDb().insert(jobTable).values({
        id: job.id,
        name: job.name,
        payloadJson: JSON.stringify(job.payload),
        status: job.status,
        runAt: job.runAt,
        attempts: job.attempts,
        lastError: null,
        createdAt: now,
        updatedAt: now,
      });

      return job;
    },
    async processDue() {
      await ensureSchema();
      if (!recovery) {
        recovery = recoverInterruptedRunning();
      }
      await recovery;

      const now = nowIso();
      const due = await getDb()
        .select()
        .from(jobTable)
        .where(and(eq(jobTable.status, "queued"), lte(jobTable.runAt, now)))
        .orderBy(asc(jobTable.runAt), asc(jobTable.id));

      let processed = 0;

      for (const row of due) {
        const claimed = await claimQueuedJob(row.id, now);
        if (!claimed) {
          continue;
        }

        processed += 1;
        const parsed = parseJobPayload(claimed.payloadJson);
        if (!parsed.ok) {
          await finalizeJob(claimed.id, "failed", now, INVALID_JOB_PAYLOAD);
          continue;
        }

        const job: Job = {
          id: claimed.id as JobId,
          name: claimed.name,
          payload: parsed.value,
          status: "running",
          runAt: claimed.runAt,
          attempts: Number(claimed.attempts),
        };

        const handler = handlers.get(job.name);

        try {
          if (!handler) {
            throw new Error(`No handler for job: ${job.name}`);
          }
          await handler(job);
          await finalizeJob(claimed.id, "completed", nowIso());
        } catch (error) {
          await finalizeJob(
            claimed.id,
            "failed",
            nowIso(),
            error instanceof Error ? error.message : "Job failed",
          );
        }
      }

      return processed;
    },
  };
}

async function recoverInterruptedRunning() {
  const now = nowIso();
  await getDb()
    .update(jobTable)
    .set({
      status: "failed",
      lastError: INTERRUPTED_BY_RESTART,
      updatedAt: now,
    })
    .where(eq(jobTable.status, "running"));
}

async function claimQueuedJob(id: string, now: string) {
  const result = await getClient().execute({
    sql: `UPDATE jobs SET status = ?, attempts = attempts + 1, updated_at = ? WHERE id = ? AND status = ?`,
    args: ["running", now, id, "queued"],
  });

  if (result.rowsAffected !== 1) {
    return undefined;
  }

  const rows = await getDb()
    .select()
    .from(jobTable)
    .where(eq(jobTable.id, id))
    .limit(1);

  return rows[0];
}

async function finalizeJob(
  id: string,
  status: "completed" | "failed",
  now: string,
  lastError?: string,
) {
  await getDb()
    .update(jobTable)
    .set({
      status,
      lastError: lastError ?? null,
      updatedAt: now,
    })
    .where(eq(jobTable.id, id));
}

function parseJobPayload(
  raw: string,
): { ok: true; value: unknown } | { ok: false } {
  try {
    return { ok: true, value: JSON.parse(raw) };
  } catch {
    return { ok: false };
  }
}
