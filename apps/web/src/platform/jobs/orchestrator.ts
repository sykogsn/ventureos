import type { JobId } from "@/contracts";
import { createId, nowIso } from "@/platform/ids";

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

export function createJobOrchestrator(): JobOrchestrator {
  const jobs: Job[] = [];
  const handlers = new Map<string, JobHandler>();

  return {
    register(name, handler) {
      handlers.set(name, handler);
    },
    async enqueue(name, payload, runAt) {
      const job: Job = {
        id: createId<JobId>(),
        name,
        payload,
        status: "queued",
        runAt: (runAt ?? new Date()).toISOString(),
        attempts: 0,
      };
      jobs.push(job);
      return job;
    },
    async processDue() {
      const now = nowIso();
      let processed = 0;

      for (const job of jobs) {
        if (job.status !== "queued" || job.runAt > now) {
          continue;
        }

        const handler = handlers.get(job.name);
        job.status = "running";
        job.attempts += 1;

        try {
          if (!handler) {
            throw new Error(`No handler for job: ${job.name}`);
          }
          await handler(job);
          job.status = "completed";
        } catch (error) {
          job.status = "failed";
          job.lastError =
            error instanceof Error ? error.message : "Job failed";
        }

        processed += 1;
      }

      return processed;
    },
  };
}
