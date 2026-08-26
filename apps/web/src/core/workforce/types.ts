import type { JobId, UserId, VentureId, WorkspaceId } from "@/contracts";
import type { AgentDefinitionId, AgentInstanceId } from "@/contracts/ids";

export type { AgentDefinitionId, AgentInstanceId };

export type HumanWorkforceActor = {
  kind: "human";
  userId: UserId;
  workspaceId?: WorkspaceId;
  ventureId?: VentureId;
};

export type AgentWorkforceActor = {
  kind: "agent";
  agentInstanceId: AgentInstanceId;
  workspaceId: WorkspaceId;
  ventureId: VentureId;
};

export type SystemWorkforceActor = {
  kind: "system";
  component: string;
  workspaceId?: WorkspaceId;
};

export type WorkforceActor =
  | HumanWorkforceActor
  | AgentWorkforceActor
  | SystemWorkforceActor;

export const AGENT_DEFINITION_LIFECYCLE = [
  "DRAFT",
  "ACTIVE",
  "DISABLED",
  "REVOKED",
] as const;

export type AgentDefinitionLifecycle = (typeof AGENT_DEFINITION_LIFECYCLE)[number];

export type AgentDefinition = {
  id: AgentDefinitionId;
  version: string;
  role: string;
  responsibilities: string[];
  capabilityAllowList: string[];
  capabilityDenyList: string[];
  autonomyCeiling: string;
  approvalBoundary: string;
  memoryPolicy: string;
  escalationPolicy: string;
  evaluationProfile: string;
  lifecycle: AgentDefinitionLifecycle;
};

export type AgentInstanceStatus = "active" | "disabled" | "revoked";

export type AgentInstance = {
  id: AgentInstanceId;
  definitionId: AgentDefinitionId;
  definitionVersion: string;
  workspaceId: WorkspaceId;
  ventureId: VentureId;
  status: AgentInstanceStatus;
};

export type EnforcementContext = {
  workspaceId: WorkspaceId;
  ventureId: VentureId;
  agentInstanceId: AgentInstanceId;
  definitionId: AgentDefinitionId;
  definitionVersion: string;
  capabilityScope: string[];
  contextVersion: string;
  ventureStatus: string;
  instanceStatus: AgentInstanceStatus;
  definitionLifecycle: AgentDefinitionLifecycle;
};

export type ModelContextCitation = {
  sourceType: string;
  sourceId: string;
  excerpt: string;
};

export type ModelContext = {
  objective: string;
  citations: ModelContextCitation[];
};

export const AUTHORITY_DECISIONS = [
  "ALLOW",
  "ALLOW_WITH_APPROVAL",
  "DENY",
] as const;

export type AuthorityDecisionOutcome = (typeof AUTHORITY_DECISIONS)[number];

export type AuthorityDecision = {
  outcome: AuthorityDecisionOutcome;
  reason: string;
};

export type ExecutionRequest = {
  actor: WorkforceActor;
  agentInstanceId: AgentInstanceId;
  workspaceId: WorkspaceId;
  ventureId: VentureId;
  executorId: string;
  contextVersion: string;
  idempotencyKey?: string;
  input?: unknown;
};

export type ExecutionOutcome = {
  executorId: string;
  ok: boolean;
  output?: unknown;
  error?: string;
};

export type CapabilityExecutor = {
  id: string;
  execute(request: ExecutionRequest): Promise<ExecutionOutcome>;
};

export type ExecutionPort = {
  execute(request: ExecutionRequest): Promise<ExecutionOutcome>;
};

export type ModelRequest = {
  purpose: string;
  input: unknown;
};

export type ModelResult = {
  ok: boolean;
  data?: unknown;
  error?: string;
};

export type ModelPort = {
  invoke(request: ModelRequest): Promise<ModelResult>;
};

export const VERIFICATION_RESULTS = ["VERIFIED", "NOT_VERIFIED"] as const;

export type VerificationOutcome = (typeof VERIFICATION_RESULTS)[number];

export type VerificationResult = {
  outcome: VerificationOutcome;
};

export type VerificationPredicate = {
  id: string;
};

export type WorkforceRunPhase =
  | "executing"
  | "awaiting_approval"
  | "verifying"
  | "completed"
  | "failed"
  | "cancelled";

export type WorkforceRunLimits = {
  maxSteps: number;
  maxModelCalls: number;
  maxDurationMs: number;
  retryCeiling: number;
  maxModelTokens: number;
};

export type WorkforceRunUsage = {
  modelCallCount: number;
  inputTokens: number;
  outputTokens: number;
};

export type WorkforceRun = {
  jobId: JobId;
  objective: string;
  agentInstanceId: AgentInstanceId;
  workspaceId: WorkspaceId;
  ventureId: VentureId;
  definitionVersion: string;
  contextVersion: string;
  phase: WorkforceRunPhase;
  limits: WorkforceRunLimits;
  usage: WorkforceRunUsage;
  executorOutcomes: ExecutionOutcome[];
  approvalReference?: string;
  verification?: VerificationResult;
  finalResult?: string;
};
