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

export const AUTONOMY_CEILINGS = ["observe", "prepare", "execute"] as const;

export type AutonomyCeiling = (typeof AUTONOMY_CEILINGS)[number];

export type AgentDefinition = {
  id: AgentDefinitionId;
  version: string;
  role: string;
  responsibilities: string[];
  capabilityAllowList: string[];
  capabilityDenyList: string[];
  autonomyCeiling: AutonomyCeiling;
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

export const AUTHORITY_REASON_CODES = [
  "ACTOR_INVALID",
  "INSTANCE_MISSING",
  "INSTANCE_MISMATCH",
  "INSTANCE_INACTIVE",
  "DEFINITION_MISSING",
  "DEFINITION_INACTIVE",
  "DEFINITION_VERSION_MISMATCH",
  "WORKSPACE_MISSING",
  "WORKSPACE_MISMATCH",
  "VENTURE_MISSING",
  "VENTURE_MISMATCH",
  "VENTURE_INACTIVE",
  "CAPABILITY_UNKNOWN",
  "CAPABILITY_DISABLED",
  "CAPABILITY_NOT_ALLOWED",
  "CAPABILITY_DENIED",
  "AUTONOMY_EXCEEDED",
  "APPROVAL_REQUIRED",
] as const;

export type AuthorityReasonCode = (typeof AUTHORITY_REASON_CODES)[number];

export type AuthorityDenyReason = Exclude<AuthorityReasonCode, "APPROVAL_REQUIRED">;

export type AuthorityDecision =
  | { outcome: "ALLOW" }
  | { outcome: "ALLOW_WITH_APPROVAL"; reason: "APPROVAL_REQUIRED" }
  | { outcome: "DENY"; reason: AuthorityDenyReason };

export type AuthorityRequest = {
  actor: WorkforceActor;
  agentInstanceId: AgentInstanceId;
  workspaceId: WorkspaceId;
  ventureId: VentureId;
  capabilityId: string;
};

export type AuthorityEvaluation =
  | {
      ok: true;
      decision: AuthorityDecision;
      context: EnforcementContext;
      evaluatedAt: string;
    }
  | {
      ok: false;
      failure: "UNAVAILABLE";
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

export type ModelEvidenceRef = {
  id: string;
  sourceType: string;
  excerpt: string;
};

export type ModelCapabilityHint = {
  id: string;
  description: string;
};

export type ModelRequest = {
  requestId: string;
  workspaceId: WorkspaceId;
  ventureId: VentureId;
  agentInstanceId: AgentInstanceId;
  purpose: string;
  platformInstructions: string;
  roleInstructions: string;
  task: string;
  context: ModelContext;
  evidence: ModelEvidenceRef[];
  candidateCapabilities: ModelCapabilityHint[];
};

export type ProposedAction = {
  capabilityId: string;
  intent: string;
  arguments: Record<string, string | number | boolean | null>;
  rationale: string;
  evidenceIds: string[];
};

export type ModelFinding = {
  statement: string;
  evidenceIds: string[];
};

export type ModelReasoningResult = {
  summary: string;
  explanation: string;
  findings: ModelFinding[];
  uncertainties: string[];
  proposedActions: ProposedAction[];
};

export const MODEL_FAILURES = [
  "MISSING_CREDENTIALS",
  "TIMEOUT",
  "RATE_LIMITED",
  "INVALID_OUTPUT",
  "CONTENT_REFUSED",
  "UNAVAILABLE",
] as const;

export type ModelFailure = (typeof MODEL_FAILURES)[number];

export type ModelTrace = {
  requestId: string;
  provider: string;
  model: string;
  durationMs: number;
  inputTokens?: number;
  outputTokens?: number;
  providerRequestId?: string;
};

export type ModelResult =
  | { ok: true; data: ModelReasoningResult; trace: ModelTrace }
  | { ok: false; failure: ModelFailure; trace?: ModelTrace };

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
