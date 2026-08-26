import type { JobId, UserId, VentureId, WorkspaceId } from "@/contracts";
import type {
  AgentDefinitionId,
  AgentInstanceId,
  WorkforceRunId,
} from "@/contracts/ids";

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

export type ExecutionArgumentValue = string | number | boolean | null;

export type ExecutionArguments = Record<string, ExecutionArgumentValue>;

/**
 * Trusted orchestration command. Constructed by VentureOS, never taken
 * as model JSON. Does not accept AuthorityDecision, EnforcementContext,
 * contextVersion, or an idempotency key as proof of authority.
 */
export type ExecutionRequest = {
  actor: WorkforceActor;
  agentInstanceId: AgentInstanceId;
  workspaceId: WorkspaceId;
  ventureId: VentureId;
  capabilityId: string;
  arguments: ExecutionArguments;
  sourceRequestId: string;
  sourceActionIndex: number;
};

export type WorkforceExecutionCommand = ExecutionRequest;

export type ExecutorInvocation = {
  executionId: string;
  actor: AgentWorkforceActor;
  agentInstanceId: AgentInstanceId;
  workspaceId: WorkspaceId;
  ventureId: VentureId;
  capabilityId: string;
  arguments: ExecutionArguments;
  externalIdempotencyKey: string;
  sourceRequestId: string;
};

export type ExecutionReceipt = {
  implementationId: string;
  implementationVersion: string;
  externalReference?: string;
  occurredAt?: string;
};

export type ExecutionOutcome = {
  executorId: string;
  ok: boolean;
  output?: unknown;
  error?: string;
  receipt?: ExecutionReceipt;
};

export type CapabilityExecutor = {
  id: string;
  parseArguments(
    value: unknown,
  ): { ok: true; value: ExecutionArguments } | { ok: false };
  execute(request: ExecutorInvocation): Promise<ExecutionOutcome>;
};

export const EXECUTION_FAILURES = [
  "MALFORMED_REQUEST",
  "INVALID_ARGUMENTS",
  "AUTHORITY_DENIED",
  "AUTHORITY_UNAVAILABLE",
  "APPROVAL_REQUIRED",
  "NOT_EXECUTABLE",
  "IDEMPOTENCY_MISMATCH",
  "DUPLICATE_IN_PROGRESS",
  "EXECUTION_FAILED",
  "INTERRUPTED",
] as const;

export type ExecutionFailure = (typeof EXECUTION_FAILURES)[number];

export type WorkforceExecutionResult =
  | {
      ok: true;
      executionId: string;
      idempotencyKey: string;
      outcome: ExecutionOutcome;
      contextVersion: string;
      evaluatedAt: string;
      reused?: true;
    }
  | {
      ok: false;
      failure: ExecutionFailure;
      reason?: AuthorityDenyReason;
      executionId?: string;
      idempotencyKey?: string;
      contextVersion?: string;
      evaluatedAt?: string;
      outcome?: ExecutionOutcome;
    };

export type ExecutionPort = {
  execute(request: ExecutionRequest): Promise<WorkforceExecutionResult>;
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

/**
 * Capability/verifier-owned predicate identity. The model, AgentDefinition,
 * ProposedAction, caller, and executor cannot supply or modify this.
 */
export type VerificationPredicate = {
  id: string;
  version: string;
  capabilityId: string;
};

export type BoundPredicate = VerificationPredicate & {
  expected: ExecutionArguments;
  fingerprint: string;
};

export const VERIFICATION_OBSERVATION_STATUSES = [
  "observed",
  "missing",
  "unavailable",
  "timeout",
  "invalid",
] as const;

export type VerificationObservationStatus =
  (typeof VERIFICATION_OBSERVATION_STATUSES)[number];

export type VerificationObservation = {
  status: VerificationObservationStatus;
  observedAt: string;
  values?: ExecutionArguments;
};

export const VERIFICATION_STATUSES = [
  "pending",
  "observing",
  "verified",
  "not_verified",
  "failed",
] as const;

export type VerificationStatus = (typeof VERIFICATION_STATUSES)[number];

export const VERIFICATION_PROVENANCE = ["system_observation"] as const;

export type VerificationProvenance = (typeof VERIFICATION_PROVENANCE)[number];

export const VERIFICATION_FAILURES = [
  "VERIFIER_UNAVAILABLE",
  "INVALID_PREDICATE",
  "OBSERVER_UNAVAILABLE",
  "OBSERVER_TIMEOUT",
  "INVALID_OBSERVATION",
  "EVIDENCE_TOO_LARGE",
  "SCOPE_MISMATCH",
  "EXECUTION_MISMATCH",
  "PERSISTENCE_UNAVAILABLE",
  "INTERRUPTED",
] as const;

export type VerificationFailure = (typeof VERIFICATION_FAILURES)[number];

export type VerificationProcessResult =
  | {
      ok: true;
      result: VerificationResult;
      verificationId: string;
    }
  | {
      ok: false;
      failure: VerificationFailure;
      verificationId?: string;
    };

export type WorkforceRunPhase =
  | "queued"
  | "reasoning"
  | "awaiting_approval"
  | "executing"
  | "completed"
  | "failed"
  | "cancelled"
  | "verifying";

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

export const WORKFORCE_RUN_COMPLETION_KINDS = [
  "executed",
  "no_action",
  "multiple_proposed_actions",
] as const;

export type WorkforceRunCompletionKind =
  (typeof WORKFORCE_RUN_COMPLETION_KINDS)[number];

export const WORKFORCE_RUN_FAILURES = [
  "MALFORMED_REQUEST",
  "INSTANCE_INVALID",
  "MODEL_FAILED",
  "INVALID_MODEL_OUTPUT",
  "AUTHORITY_DENIED",
  "AUTHORITY_UNAVAILABLE",
  "APPROVAL_REJECTED",
  "APPROVAL_EXPIRED",
  "NOT_EXECUTABLE",
  "EXECUTION_FAILED",
  "INTERRUPTED",
  "CANCELLED",
  "PERSISTENCE_UNAVAILABLE",
  "VERIFICATION_UNAVAILABLE",
] as const;

export type WorkforceRunFailure = (typeof WORKFORCE_RUN_FAILURES)[number];

export const APPROVAL_STATUSES = [
  "PENDING",
  "APPROVED",
  "REJECTED",
  "EXPIRED",
  "CANCELLED",
] as const;

export type ApprovalStatus = (typeof APPROVAL_STATUSES)[number];

export type WorkforceRun = {
  id: WorkforceRunId;
  jobId?: JobId;
  objective: string;
  agentInstanceId: AgentInstanceId;
  workspaceId: WorkspaceId;
  ventureId: VentureId;
  definitionId: AgentDefinitionId;
  definitionVersion: string;
  contextVersion: string;
  phase: WorkforceRunPhase;
  limits: WorkforceRunLimits;
  usage: WorkforceRunUsage;
  executorOutcomes: ExecutionOutcome[];
  approvalReference?: string;
  verification?: VerificationResult;
  completionKind?: WorkforceRunCompletionKind;
  failureCategory?: WorkforceRunFailure;
  finalResult?: string;
};
