import { and, eq, inArray } from "drizzle-orm";
import type { WorkforceRunId } from "@/contracts/ids";
import {
  WORKFORCE_RUN_STEP_JOB,
  type WorkforceJobPort,
  type WorkforceRunJobPayload,
  type WorkforceRunStep,
} from "@/core/workforce/run";
import type { JobOrchestrator } from "@/platform/jobs/orchestrator";
import { ensureSchema, getDb } from "@/platform/persistence/db";
import { jobs as jobTable } from "@/platform/persistence/schema";

export function createWorkforceJobPort(
  jobs: JobOrchestrator,
): WorkforceJobPort {
  return {
    enqueue(name, payload, runAt) {
      return jobs.enqueue(name, payload, runAt);
    },
    async hasActive(runId, step) {
      await ensureSchema();
      const rows = await getDb()
        .select()
        .from(jobTable)
        .where(
          and(
            eq(jobTable.name, WORKFORCE_RUN_STEP_JOB),
            inArray(jobTable.status, ["queued", "running"]),
          ),
        );
      return rows.some((row) => matchesStep(row.payloadJson, runId, step));
    },
  };
}

function matchesStep(
  payloadJson: string,
  runId: WorkforceRunId,
  step: WorkforceRunStep,
) {
  try {
    const value: unknown = JSON.parse(payloadJson);
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return false;
    }
    const payload = value as Partial<WorkforceRunJobPayload>;
    return payload.runId === runId && payload.step === step;
  } catch {
    return false;
  }
}
