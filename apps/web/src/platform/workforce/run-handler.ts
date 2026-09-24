import type { JobHandler } from "@/platform/jobs/orchestrator";
import type { WorkforceRunOrchestrator } from "@/core/workforce/run";

export function createWorkforceRunStepHandler(
  orchestrator: WorkforceRunOrchestrator,
): JobHandler {
  return async (job) => {
    await orchestrator.handleJob(job);
  };
}
