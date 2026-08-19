import type { AgentId } from "./ids";

export type ModelId = string & { readonly __brand: "ModelId" };
export type ToolId = string & { readonly __brand: "ToolId" };
export type AgentRunId = string & { readonly __brand: "AgentRunId" };

export type AiRuntimeStatus = "disconnected" | "connecting" | "ready" | "error";
export type AiRole = "system" | "user" | "assistant" | "tool";

export type AiMessage = {
  role: AiRole;
  content: string;
};

export type AiTool = {
  id: ToolId;
  name: string;
  description: string;
};

export type AgentDefinition = {
  id: AgentId;
  name: string;
  tools: ToolId[];
};

export type AgentRun = {
  id: AgentRunId;
  agentId: AgentId;
  status: "queued" | "running" | "completed" | "failed";
};

export type AgentRuntime = {
  status: AiRuntimeStatus;
  submit(agentId: AgentId, input: AiMessage): Promise<AgentRun>;
};
