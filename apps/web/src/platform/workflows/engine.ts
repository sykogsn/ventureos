import type {
  WorkflowDefinition,
  WorkflowEngine,
  WorkflowRun,
  WorkflowRunId,
} from "@/contracts";
import { createId } from "@/platform/ids";

export function createWorkflowEngine(): WorkflowEngine {
  const definitions = new Map<string, WorkflowDefinition>();

  return {
    register(definition) {
      definitions.set(definition.id, definition);
    },
    async start(workflowId, input) {
      const definition = definitions.get(workflowId);

      if (!definition) {
        const run: WorkflowRun = {
          id: createId<WorkflowRunId>(),
          workflowId,
          status: "failed",
          error: `Unknown workflow: ${workflowId}`,
        };
        return run;
      }

      let current: unknown = input;

      try {
        for (const step of definition.steps) {
          current = await step.run(current);
        }

        const run: WorkflowRun = {
          id: createId<WorkflowRunId>(),
          workflowId,
          status: "completed",
          output: current,
        };
        return run;
      } catch (error) {
        const run: WorkflowRun = {
          id: createId<WorkflowRunId>(),
          workflowId,
          status: "failed",
          error: error instanceof Error ? error.message : "Workflow failed",
        };
        return run;
      }
    },
  };
}
