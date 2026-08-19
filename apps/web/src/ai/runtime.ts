import type { AgentRun, AiMessage, AiRuntimeStatus } from "./types";

export type AiRuntime = {
  status: AiRuntimeStatus;
  submit(input: AiMessage): Promise<AgentRun>;
};

export const disconnectedRuntime: AiRuntime = {
  status: "disconnected",
  async submit() {
    throw new Error("AI runtime is not connected.");
  },
};

export function getAiRuntime(): AiRuntime {
  return disconnectedRuntime;
}
