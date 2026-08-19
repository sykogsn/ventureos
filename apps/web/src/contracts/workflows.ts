import type { WorkflowRunId } from "./ids";

export type WorkflowStep = {
  id: string;
  run(input: unknown): Promise<unknown>;
};

export type WorkflowDefinition = {
  id: string;
  name: string;
  steps: WorkflowStep[];
};

export type WorkflowRun = {
  id: WorkflowRunId;
  workflowId: string;
  status: "running" | "completed" | "failed";
  output?: unknown;
  error?: string;
};

export type WorkflowEngine = {
  register(definition: WorkflowDefinition): void;
  start(workflowId: string, input: unknown): Promise<WorkflowRun>;
};
