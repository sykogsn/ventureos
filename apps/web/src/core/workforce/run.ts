import type { JobId, UserId, VentureId, WorkspaceId } from "@/contracts";
import type { AgentDefinitionId, AgentInstanceId, WorkforceRunId } from "@/contracts/ids";
import { createId, nowIso } from "@/platform/ids";
import type { AuthorityEvaluatorDeps } from "./authority";
import { evaluateAuthority, FOUNDER_ONLY_CAPABILITIES } from "./authority";
import { isHumanActor } from "./actor";
import {
  fingerprintExecution,
  hashExecutionArguments,
} from "./execution";
import type { WorkforceExecutorRegistry } from "./executors";
import { PLATFORM_MODEL_DEFENCE } from "./model";
import type {
  AgentWorkforceActor,
  ApprovalStatus,
  ExecutionArguments,
  ExecutionPort,
  HumanWorkforceActor,
  ModelPort,
  ProposedAction,
  WorkforceActor,
  WorkforceRunCompletionKind,
  WorkforceRunFailure,
  WorkforceRunPhase,
} from "./types";

export type WorkforceRunRecord = {
  id: WorkforceRunId;
  jobId: JobId | null;
  workspaceId: WorkspaceId;
  ventureId: VentureId;
  agentInstanceId: AgentInstanceId;
  definitionId: AgentDefinitionId;
  definitionVersion: string;
  objective: string;
  phase: WorkforceRunPhase;
  completionKind: WorkforceRunCompletionKind | null;
  failureCategory: WorkforceRunFailure | null;
  sourceRequestId: string;
  selectedCapabilityId: string | null;
  selectedActionIndex: number | null;
  selectedAction: ProposedAction | null;
  argumentHash: string | null;
  fingerprintHash: string | null;
  executionId: string | null;
  approvalId: string | null;
  modelCallCount: number;
  requestedByUserId: UserId;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
};

export type WorkforceRunInsert = Omit<
  WorkforceRunRecord,
  | "jobId"
  | "completionKind"
  | "failureCategory"
  | "selectedCapabilityId"
  | "selectedActionIndex"
  | "selectedAction"
  | "argumentHash"
  | "fingerprintHash"
  | "executionId"
  | "approvalId"
  | "completedAt"
  | "createdAt"
  | "updatedAt"
> & {
  jobId?: JobId | null;
};

export type WorkforceRunPatch = Partial<
  Pick<
    WorkforceRunRecord,
    | "jobId"
    | "phase"
    | "completionKind"
    | "failureCategory"
    | "selectedCapabilityId"
    | "selectedActionIndex"
    | "selectedAction"
    | "argumentHash"
    | "fingerprintHash"
    | "executionId"
    | "approvalId"
    | "modelCallCount"
    | "completedAt"
  >
>;

export type WorkforceRunStore = {
  recoverInterrupted(): Promise<number>;
  insert(row: WorkforceRunInsert): Promise<WorkforceRunRecord>;
  get(id: WorkforceRunId): Promise<WorkforceRunRecord | undefined>;
  claimPhase(
    id: WorkforceRunId,
    from: WorkforceRunPhase,
    to: WorkforceRunPhase,
  ): Promise<WorkforceRunRecord | undefined>;
  claimModelCall(id: WorkforceRunId): Promise<boolean>;
  patch(id: WorkforceRunId, patch: WorkforceRunPatch): Promise<void>;
};

export type WorkforceApprovalRecord = {
  id: string;
  runId: WorkforceRunId;
  workspaceId: WorkspaceId;
  ventureId: VentureId;
  agentInstanceId: AgentInstanceId;
  capabilityId: string;
  sourceRequestId: string;
  sourceActionIndex: number;
  argumentHash: string;
  fingerprintHash: string;
  status: ApprovalStatus;
  requestedAt: string;
  expiresAt: string;
  decidedAt: string | null;
  decidedByUserId: UserId | null;
};

export type WorkforceApprovalInsert = Omit<
  WorkforceApprovalRecord,
  "id" | "status" | "requestedAt" | "expiresAt" | "decidedAt" | "decidedByUserId"
>;

export type WorkforceApprovalStore = {
  insertPending(
    row: WorkforceApprovalInsert,
    ttlMs?: number,
  ): Promise<WorkforceApprovalRecord>;
  get(id: string): Promise<WorkforceApprovalRecord | undefined>;
  getByRunId(runId: WorkforceRunId): Promise<WorkforceApprovalRecord | undefined>;
  decide(
    id: string,
    status: "APPROVED" | "REJECTED",
    decidedByUserId: UserId,
  ): Promise<WorkforceApprovalRecord | undefined>;
  expireIfDue(id: string): Promise<WorkforceApprovalRecord | undefined>;
};

export const WORKFORCE_RUN_STEP_JOB = "workforce.run.step";
export const WORKFORCE_RUN_MAX_MODEL_CALLS = 1;
export const WORKFORCE_ACTIVE_DURATION_MS = 10 * 60 * 1000;

export type WorkforceRunStep = "reason" | "resume";

export type WorkforceRunJobPayload = {
  runId: WorkforceRunId;
  step: WorkforceRunStep;
};

export type WorkforceJobPort = {
  enqueue(
    name: string,
    payload: WorkforceRunJobPayload,
  ): Promise<{ id: JobId }>;
};

export type WorkforceRunCreateInput = {
  actor: HumanWorkforceActor;
  agentInstanceId: AgentInstanceId;
  workspaceId: WorkspaceId;
  ventureId: VentureId;
  objective: string;
};

export type WorkforceRunCreateResult =
  | { ok: true; runId: WorkforceRunId; jobId: JobId }
  | { ok: false; failure: WorkforceRunFailure };

export type WorkforceDecisionResult =
  | { ok: true; runId: WorkforceRunId }
  | {
      ok: false;
      failure:
        | WorkforceRunFailure
        | "UNAUTHENTICATED"
        | "FORBIDDEN"
        | "AGENT_CANNOT_APPROVE"
        | "NOT_PENDING"
        | "APPROVAL_BINDING_MISMATCH";
    };

export type WorkforceRunOrchestratorDeps = AuthorityEvaluatorDeps & {
  model: ModelPort;
  executors: WorkforceExecutorRegistry;
  execution: ExecutionPort;
  runs: WorkforceRunStore;
  approvals: WorkforceApprovalStore;
  jobs: WorkforceJobPort;
  canApprove?: (userId: UserId, workspaceId: WorkspaceId) => Promise<boolean>;
};

export type WorkforceRunOrchestrator = {
  createRun(input: WorkforceRunCreateInput): Promise<WorkforceRunCreateResult>;
  handleJob(job: { payload: unknown }): Promise<void>;
  approve(
    runId: WorkforceRunId,
    actor: WorkforceActor,
  ): Promise<WorkforceDecisionResult>;
  reject(
    runId: WorkforceRunId,
    actor: WorkforceActor,
  ): Promise<WorkforceDecisionResult>;
};

const TERMINAL = new Set(["completed", "failed", "cancelled"]);

export function createWorkforceRunOrchestrator(
  deps: WorkforceRunOrchestratorDeps,
): WorkforceRunOrchestrator {
  return {
    async createRun(input) {
      if (!isHumanActor(input.actor) || !input.objective.trim()) {
        return { ok: false, failure: "MALFORMED_REQUEST" };
      }

      const instance = await deps.instances.get(input.agentInstanceId);
      if (
        !instance ||
        instance.workspaceId !== input.workspaceId ||
        instance.ventureId !== input.ventureId
      ) {
        return { ok: false, failure: "INSTANCE_INVALID" };
      }

      const runId = createId<WorkforceRunId>();
      await deps.runs.insert({
        id: runId,
        workspaceId: input.workspaceId,
        ventureId: input.ventureId,
        agentInstanceId: instance.id,
        definitionId: instance.definitionId,
        definitionVersion: instance.definitionVersion,
        objective: input.objective.trim(),
        phase: "queued",
        sourceRequestId: runId,
        modelCallCount: 0,
        requestedByUserId: input.actor.userId,
      });

      const job = await deps.jobs.enqueue(WORKFORCE_RUN_STEP_JOB, {
        runId,
        step: "reason",
      });
      await deps.runs.patch(runId, { jobId: job.id });
      return { ok: true, runId, jobId: job.id };
    },

    async handleJob(job) {
      const payload = readPayload(job.payload);
      if (!payload) {
        return;
      }
      await deps.runs.recoverInterrupted();
      const run = await deps.runs.get(payload.runId);
      if (!run || TERMINAL.has(run.phase)) {
        return;
      }
      if (payload.step === "reason") {
        await handleReason(deps, run);
        return;
      }
      if (payload.step === "resume") {
        await handleResume(deps, run);
      }
    },

    async approve(runId, actor) {
      return decideApproval(deps, runId, actor, "APPROVED");
    },

    async reject(runId, actor) {
      return decideApproval(deps, runId, actor, "REJECTED");
    },
  };
}

async function handleReason(
  deps: WorkforceRunOrchestratorDeps,
  current: WorkforceRunRecord,
) {
  if (current.phase === "awaiting_approval") {
    return;
  }
  if (
    Date.parse(nowIso()) - Date.parse(current.createdAt) >
    WORKFORCE_ACTIVE_DURATION_MS
  ) {
    await failRun(deps, current.id, "INTERRUPTED");
    return;
  }
  if (current.phase === "reasoning" && current.modelCallCount >= 1) {
    return;
  }

  const run =
    current.phase === "queued"
      ? await deps.runs.claimPhase(current.id, "queued", "reasoning")
      : current;
  if (!run) {
    return;
  }

  const claimedCall = await deps.runs.claimModelCall(run.id);
  if (!claimedCall) {
    return;
  }

  const instance = await deps.instances.get(run.agentInstanceId);
  const definition = instance
    ? await deps.definitions.get(instance.definitionId, instance.definitionVersion)
    : undefined;
  if (!instance || !definition) {
    await failRun(deps, run.id, "INSTANCE_INVALID");
    return;
  }

  const candidateCapabilities = definition.capabilityAllowList
    .filter((id) => !definition.capabilityDenyList.includes(id))
    .filter((id) => !(FOUNDER_ONLY_CAPABILITIES as readonly string[]).includes(id))
    .map((id) => {
      const capability = deps.capabilities.get(id);
      return {
        id,
        description: capability?.purpose ?? capability?.name ?? id,
      };
    });

  const actor: AgentWorkforceActor = {
    kind: "agent",
    agentInstanceId: instance.id,
    workspaceId: run.workspaceId,
    ventureId: run.ventureId,
  };

  const result = await deps.model.invoke({
    requestId: run.id,
    workspaceId: run.workspaceId,
    ventureId: run.ventureId,
    agentInstanceId: instance.id,
    purpose: "workforce-reason",
    platformInstructions: PLATFORM_MODEL_DEFENCE,
    roleInstructions: `${definition.role}. ${definition.responsibilities.join(" ")}`,
    task: run.objective,
    context: { objective: run.objective, citations: [] },
    evidence: [],
    candidateCapabilities,
  });

  if (!result.ok) {
    await failRun(deps, run.id, "MODEL_FAILED");
    return;
  }

  const proposed = result.data.proposedActions;
  if (proposed.length === 0) {
    await completeRun(deps, run.id, "no_action");
    return;
  }
  if (proposed.length > 1) {
    await completeRun(deps, run.id, "multiple_proposed_actions");
    return;
  }

  const action = proposed[0];
  if (!action) {
    await completeRun(deps, run.id, "no_action");
    return;
  }

  const parsedArguments = parseActionArguments(deps, action);
  if (!parsedArguments) {
    await failRun(deps, run.id, "INVALID_MODEL_OUTPUT");
    return;
  }

  const argumentHash = hashExecutionArguments(parsedArguments);
  const fingerprintHash = fingerprintExecution({
    workspaceId: run.workspaceId,
    ventureId: run.ventureId,
    agentInstanceId: run.agentInstanceId,
    capabilityId: action.capabilityId,
    argumentHash,
  });

  await deps.runs.patch(run.id, {
    selectedCapabilityId: action.capabilityId,
    selectedActionIndex: 0,
    selectedAction: { ...action, arguments: parsedArguments },
    argumentHash,
    fingerprintHash,
  });

  const authority = await evaluateAuthority(
    {
      actor,
      agentInstanceId: run.agentInstanceId,
      workspaceId: run.workspaceId,
      ventureId: run.ventureId,
      capabilityId: action.capabilityId,
    },
    deps,
  );

  if (!authority.ok) {
    await failRun(deps, run.id, "AUTHORITY_UNAVAILABLE");
    return;
  }
  if (authority.decision.outcome === "DENY") {
    await failRun(deps, run.id, "AUTHORITY_DENIED");
    return;
  }

  if (authority.decision.outcome === "ALLOW_WITH_APPROVAL") {
    const approval = await deps.approvals.insertPending({
      runId: run.id,
      workspaceId: run.workspaceId,
      ventureId: run.ventureId,
      agentInstanceId: run.agentInstanceId,
      capabilityId: action.capabilityId,
      sourceRequestId: run.sourceRequestId,
      sourceActionIndex: 0,
      argumentHash,
      fingerprintHash,
    });
    await deps.runs.patch(run.id, {
      phase: "awaiting_approval",
      approvalId: approval.id,
    });
    return;
  }

  await executeSelected(deps, run.id, actor);
}

async function handleResume(
  deps: WorkforceRunOrchestratorDeps,
  current: WorkforceRunRecord,
) {
  if (current.phase === "executing") {
    await executeSelected(deps, current.id, agentFromRun(current));
    return;
  }
  if (current.phase !== "awaiting_approval") {
    return;
  }

  const approval = await deps.approvals.getByRunId(current.id);
  const latest = approval
    ? ((await deps.approvals.expireIfDue(approval.id)) ?? approval)
    : undefined;
  if (!latest) {
    await failRun(deps, current.id, "APPROVAL_EXPIRED");
    return;
  }
  if (latest.status === "REJECTED") {
    await failRun(deps, current.id, "APPROVAL_REJECTED");
    return;
  }
  if (latest.status === "EXPIRED" || isExpired(latest.expiresAt)) {
    await failRun(deps, current.id, "APPROVAL_EXPIRED");
    return;
  }
  if (latest.status !== "APPROVED") {
    return;
  }

  const claimed = await deps.runs.claimPhase(
    current.id,
    "awaiting_approval",
    "executing",
  );
  if (!claimed) {
    return;
  }
  await executeSelected(deps, claimed.id, agentFromRun(claimed));
}

async function executeSelected(
  deps: WorkforceRunOrchestratorDeps,
  runId: WorkforceRunId,
  actor: AgentWorkforceActor,
) {
  const run = await deps.runs.get(runId);
  if (!run || !run.selectedAction) {
    await failRun(deps, runId, "INVALID_MODEL_OUTPUT");
    return;
  }

  const result = await deps.execution.execute({
    actor,
    agentInstanceId: run.agentInstanceId,
    workspaceId: run.workspaceId,
    ventureId: run.ventureId,
    capabilityId: run.selectedAction.capabilityId,
    arguments: run.selectedAction.arguments,
    sourceRequestId: run.sourceRequestId,
    sourceActionIndex: 0,
  });

  if (result.ok) {
    await deps.runs.patch(runId, {
      phase: "completed",
      completionKind: "executed",
      executionId: result.executionId,
      completedAt: nowIso(),
    });
    return;
  }

  if (result.failure === "AUTHORITY_DENIED") {
    await failRun(deps, runId, "AUTHORITY_DENIED");
    return;
  }
  if (result.failure === "AUTHORITY_UNAVAILABLE") {
    await failRun(deps, runId, "AUTHORITY_UNAVAILABLE");
    return;
  }
  if (result.failure === "APPROVAL_REQUIRED") {
    await failRun(deps, runId, "AUTHORITY_DENIED");
    return;
  }
  if (result.failure === "NOT_EXECUTABLE") {
    await failRun(deps, runId, "NOT_EXECUTABLE");
    return;
  }
  if (result.failure === "DUPLICATE_IN_PROGRESS") {
    return;
  }
  await failRun(deps, runId, "EXECUTION_FAILED");
}

async function decideApproval(
  deps: WorkforceRunOrchestratorDeps,
  runId: WorkforceRunId,
  actor: WorkforceActor,
  status: "APPROVED" | "REJECTED",
): Promise<WorkforceDecisionResult> {
  if (actor.kind === "agent") {
    return { ok: false, failure: "AGENT_CANNOT_APPROVE" };
  }
  if (!isHumanActor(actor)) {
    return { ok: false, failure: "UNAUTHENTICATED" };
  }

  const run = await deps.runs.get(runId);
  if (!run || run.phase !== "awaiting_approval" || !run.approvalId) {
    return { ok: false, failure: "NOT_PENDING" };
  }
  if (actor.workspaceId && actor.workspaceId !== run.workspaceId) {
    return { ok: false, failure: "FORBIDDEN" };
  }
  if (deps.canApprove && !(await deps.canApprove(actor.userId, run.workspaceId))) {
    return { ok: false, failure: "FORBIDDEN" };
  }

  const approval = await deps.approvals.get(run.approvalId);
  if (!approval || approval.status !== "PENDING") {
    const latest = approval
      ? ((await deps.approvals.expireIfDue(approval.id)) ?? approval)
      : undefined;
    if (latest?.status === "EXPIRED") {
      await failRun(deps, runId, "APPROVAL_EXPIRED");
      return { ok: false, failure: "APPROVAL_EXPIRED" };
    }
    return { ok: false, failure: "NOT_PENDING" };
  }
  if (isExpired(approval.expiresAt)) {
    await deps.approvals.expireIfDue(approval.id);
    await failRun(deps, runId, "APPROVAL_EXPIRED");
    return { ok: false, failure: "APPROVAL_EXPIRED" };
  }

  if (status === "APPROVED") {
    if (!run.selectedAction) {
      return { ok: false, failure: "APPROVAL_BINDING_MISMATCH" };
    }
    const authority = await evaluateAuthority(
      {
        actor: agentFromRun(run),
        agentInstanceId: run.agentInstanceId,
        workspaceId: run.workspaceId,
        ventureId: run.ventureId,
        capabilityId: run.selectedAction.capabilityId,
      },
      deps,
    );
    if (!authority.ok) {
      return { ok: false, failure: "AUTHORITY_UNAVAILABLE" };
    }
    if (authority.decision.outcome === "DENY") {
      return { ok: false, failure: "AUTHORITY_DENIED" };
    }
  }

  const decided = await deps.approvals.decide(approval.id, status, actor.userId);
  if (!decided) {
    return { ok: false, failure: "NOT_PENDING" };
  }

  if (status === "REJECTED") {
    await failRun(deps, runId, "APPROVAL_REJECTED");
    return { ok: true, runId };
  }

  const job = await deps.jobs.enqueue(WORKFORCE_RUN_STEP_JOB, {
    runId,
    step: "resume",
  });
  await deps.runs.patch(runId, { jobId: job.id });
  return { ok: true, runId };
}

async function completeRun(
  deps: WorkforceRunOrchestratorDeps,
  runId: WorkforceRunId,
  kind: "no_action" | "multiple_proposed_actions" | "executed",
) {
  await deps.runs.patch(runId, {
    phase: "completed",
    completionKind: kind,
    completedAt: nowIso(),
  });
}

async function failRun(
  deps: WorkforceRunOrchestratorDeps,
  runId: WorkforceRunId,
  failure: WorkforceRunFailure,
) {
  await deps.runs.patch(runId, {
    phase: "failed",
    failureCategory: failure,
    completedAt: nowIso(),
  });
}

function parseActionArguments(
  deps: WorkforceRunOrchestratorDeps,
  action: ProposedAction,
): ExecutionArguments | undefined {
  const executor = deps.executors.get(action.capabilityId);
  if (executor) {
    const parsed = executor.parseArguments(action.arguments);
    return parsed.ok ? parsed.value : undefined;
  }
  if (!isArgumentMap(action.arguments)) {
    return undefined;
  }
  return action.arguments;
}

function isArgumentMap(value: unknown): value is ExecutionArguments {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  return Object.values(value).every(
    (entry) =>
      entry === null ||
      typeof entry === "string" ||
      typeof entry === "number" ||
      typeof entry === "boolean",
  );
}

function agentFromRun(run: WorkforceRunRecord): AgentWorkforceActor {
  return {
    kind: "agent",
    agentInstanceId: run.agentInstanceId,
    workspaceId: run.workspaceId,
    ventureId: run.ventureId,
  };
}

function isExpired(expiresAt: string) {
  return Date.parse(expiresAt) <= Date.now();
}

function readPayload(value: unknown): WorkforceRunJobPayload | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }
  const record = value as Record<string, unknown>;
  if (
    typeof record.runId !== "string" ||
    (record.step !== "reason" && record.step !== "resume")
  ) {
    return undefined;
  }
  return {
    runId: record.runId as WorkforceRunId,
    step: record.step,
  };
}
