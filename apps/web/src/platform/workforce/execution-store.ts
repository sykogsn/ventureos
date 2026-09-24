import { eq } from "drizzle-orm";
import { nowIso } from "@/platform/ids";
import { ensureSchema, getDb } from "@/platform/persistence/db";
import { workforceExecutions as executionTable } from "@/platform/persistence/schema";
import type {
  ExecutionClaimInput,
  ExecutionClaimResult,
  ExecutionRecord,
  WorkforceExecutionStore,
} from "@/core/workforce/execution";
import type { ExecutionOutcome } from "@/core/workforce/types";

export const EXECUTION_INTERRUPTED = "INTERRUPTED";

export function createWorkforceExecutionStore(): WorkforceExecutionStore {
  let recovery: Promise<void> | undefined;

  async function ready() {
    await ensureSchema();
    if (!recovery) {
      recovery = recoverInterruptedRunning();
    }
    await recovery;
  }

  return {
    async recoverInterrupted() {
      await ready();
      return 0;
    },
    async claim(input) {
      await ready();
      try {
        await getDb().insert(executionTable).values({
          id: input.id,
          idempotencyKey: input.idempotencyKey,
          workspaceId: input.workspaceId,
          ventureId: input.ventureId,
          agentInstanceId: input.agentInstanceId,
          capabilityId: input.capabilityId,
          sourceRequestId: input.sourceRequestId,
          sourceActionIndex: input.sourceActionIndex,
          argumentHash: input.argumentHash,
          fingerprintHash: input.fingerprintHash,
          status: "running",
          authorityContextVersion: input.authorityContextVersion,
          authorityEvaluatedAt: input.authorityEvaluatedAt,
          outcomeJson: null,
          errorCategory: null,
          implementationId: input.implementationId ?? null,
          implementationVersion: input.implementationVersion ?? null,
          externalReference: null,
          startedAt: input.startedAt,
          completedAt: null,
        });
        const record = await loadById(input.id);
        if (!record) {
          throw new Error("Claimed execution row missing after insert.");
        }
        return { kind: "claimed", record };
      } catch (error) {
        if (!isUniqueConstraint(error)) {
          throw error;
        }
        const existing = await loadByKey(input.idempotencyKey);
        if (!existing) {
          throw error;
        }
        return classifyExisting(existing, input);
      }
    },
    async complete(id, outcome) {
      await ready();
      await getDb()
        .update(executionTable)
        .set({
          status: "succeeded",
          outcomeJson: serializeOutcome(outcome),
          errorCategory: null,
          completedAt: nowIso(),
          ...(outcome.receipt?.implementationId
            ? { implementationId: outcome.receipt.implementationId }
            : {}),
          ...(outcome.receipt?.implementationVersion
            ? { implementationVersion: outcome.receipt.implementationVersion }
            : {}),
          ...(outcome.receipt?.externalReference
            ? { externalReference: outcome.receipt.externalReference }
            : {}),
        })
        .where(eq(executionTable.id, id));
    },
    async fail(id, category, outcome) {
      await ready();
      await getDb()
        .update(executionTable)
        .set({
          status: "failed",
          errorCategory: category,
          outcomeJson: outcome ? serializeOutcome(outcome) : null,
          completedAt: nowIso(),
        })
        .where(eq(executionTable.id, id));
    },
  };
}

function classifyExisting(
  existing: ExecutionRecord,
  input: ExecutionClaimInput,
): ExecutionClaimResult {
  if (existing.fingerprintHash !== input.fingerprintHash) {
    return { kind: "mismatch", record: existing };
  }
  if (existing.status === "succeeded") {
    return { kind: "reused", record: existing };
  }
  if (existing.status === "failed") {
    return { kind: "prior_failure", record: existing };
  }
  return { kind: "in_progress", record: existing };
}

async function recoverInterruptedRunning() {
  const now = nowIso();
  await getDb()
    .update(executionTable)
    .set({
      status: "failed",
      errorCategory: EXECUTION_INTERRUPTED,
      completedAt: now,
    })
    .where(eq(executionTable.status, "running"));
}

async function loadById(id: string) {
  const rows = await getDb()
    .select()
    .from(executionTable)
    .where(eq(executionTable.id, id))
    .limit(1);
  return rows[0] ? toRecord(rows[0]) : undefined;
}

async function loadByKey(idempotencyKey: string) {
  const rows = await getDb()
    .select()
    .from(executionTable)
    .where(eq(executionTable.idempotencyKey, idempotencyKey))
    .limit(1);
  return rows[0] ? toRecord(rows[0]) : undefined;
}

function toRecord(row: typeof executionTable.$inferSelect): ExecutionRecord {
  return {
    id: row.id,
    idempotencyKey: row.idempotencyKey,
    workspaceId: row.workspaceId,
    ventureId: row.ventureId,
    agentInstanceId: row.agentInstanceId,
    capabilityId: row.capabilityId,
    sourceRequestId: row.sourceRequestId,
    sourceActionIndex: Number(row.sourceActionIndex),
    argumentHash: row.argumentHash,
    fingerprintHash: row.fingerprintHash,
    status: row.status as ExecutionRecord["status"],
    authorityContextVersion: row.authorityContextVersion,
    authorityEvaluatedAt: row.authorityEvaluatedAt,
    outcomeJson: row.outcomeJson,
    errorCategory: row.errorCategory,
    implementationId: row.implementationId,
    implementationVersion: row.implementationVersion,
    externalReference: row.externalReference,
    startedAt: row.startedAt,
    completedAt: row.completedAt,
  };
}

function serializeOutcome(outcome: ExecutionOutcome) {
  return JSON.stringify({
    executorId: outcome.executorId,
    ok: outcome.ok,
    ...(outcome.output !== undefined ? { output: outcome.output } : {}),
    ...(outcome.error !== undefined
      ? { error: String(outcome.error).slice(0, 256) }
      : {}),
    ...(outcome.receipt
      ? {
          receipt: {
            implementationId: outcome.receipt.implementationId,
            implementationVersion: outcome.receipt.implementationVersion,
            ...(outcome.receipt.externalReference
              ? { externalReference: outcome.receipt.externalReference }
              : {}),
            ...(outcome.receipt.occurredAt
              ? { occurredAt: outcome.receipt.occurredAt }
              : {}),
          },
        }
      : {}),
  });
}

function isUniqueConstraint(error: unknown) {
  let current: unknown = error;
  for (let depth = 0; depth < 6 && current; depth += 1) {
    const message = current instanceof Error ? current.message : String(current);
    if (/UNIQUE/i.test(message) || /SQLITE_CONSTRAINT/i.test(message)) {
      return true;
    }
    if (typeof current === "object" && current && "cause" in current) {
      current = (current as { cause: unknown }).cause;
      continue;
    }
    break;
  }
  return false;
}
