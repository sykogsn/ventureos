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
import type { WorkforceImplementationRegistry } from "./bindings";
import { emptyWorkforceImplementations } from "./bindings";
import { PLATFORM_MODEL_DEFENCE } from "./model";
import type {
  AgentWorkforceActor,
  ApprovalStatus,
  ExecutionArguments,
  ExecutionPort,
  HumanWorkforceActor,
  ModelPort,
  ProposedAction,
  VerificationFailure,
  VerificationObservation,
  VerificationOutcome,
  WorkforceActor,
  WorkforceRunCompletionKind,
  WorkforceRunFailure,
  WorkforceRunPhase,
} from "./types";
import type { WorkforceVerifierRegistry } from "./verifiers";
import {
  canRetryVerification,
  encodeVerificationEvidence,
  evidenceFromObservation,
  fingerprintBoundPredicate,
  isRetryableObservation,
  isTerminalVerificationStatus,
  observationContainsForbiddenData,
  verificationRetryAt,
  VERIFICATION_OBSERVE_TIMEOUT_MS,
  VERIFICATION_PROVENANCE,
  type WorkforceVerificationRecord,
  type WorkforceVerificationStore,
} from "./verification";

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
  verificationOutcome: VerificationOutcome | null;
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
  | "verificationOutcome"
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
    | "verificationOutcome"
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
  listByPhase(phase: WorkforceRunPhase): Promise<WorkforceRunRecord[]>;
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

export type WorkforceRunStep = "reason" | "resume" | "verify";

export type WorkforceRunJobPayload = {
  runId: WorkforceRunId;
  step: WorkforceRunStep;
};

export type WorkforceJobPort = {
  enqueue(
    name: string,
    payload: WorkforceRunJobPayload,
    runAt?: Date,
  ): Promise<{ id: JobId }>;
  hasActive(runId: WorkforceRunId, step: WorkforceRunStep): Promise<boolean>;
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
  verifiers: WorkforceVerifierRegistry;
  implementations?: WorkforceImplementationRegistry;
  execution: ExecutionPort;
  runs: WorkforceRunStore;
  approvals: WorkforceApprovalStore;
  verifications: WorkforceVerificationStore;
  jobs: WorkforceJobPort;
  canApprove?: (userId: UserId, workspaceId: WorkspaceId) => Promise<boolean>;
  audit?: {
    record(entry: {
      action: string;
      actor?: {
        kind: "system";
        component: string;
        workspaceId?: WorkspaceId;
      };
      metadata?: Record<string, string>;
    }): Promise<unknown>;
  };
};

export type WorkforceRunOrchestrator = {
  createRun(input: WorkforceRunCreateInput): Promise<WorkforceRunCreateResult>;
  handleJob(job: { payload: unknown }): Promise<void>;
  recover(): Promise<void>;
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

      await recoverWorkforce(deps);

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

    async recover() {
      await recoverWorkforce(deps);
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
      if (payload.step === "verify" || run.phase === "verifying") {
        await handleVerify(deps, run.id);
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
  if (current.phase === "awaiting_approval" || current.phase === "verifying") {
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

  const executing = await deps.runs.claimPhase(run.id, "reasoning", "executing");
  if (!executing) {
    return;
  }
  await executeSelected(deps, executing.id, actor);
}

async function handleResume(
  deps: WorkforceRunOrchestratorDeps,
  current: WorkforceRunRecord,
) {
  if (current.phase === "verifying") {
    await handleVerify(deps, current.id);
    return;
  }
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
  const current = await deps.runs.get(runId);
  if (!current || !current.selectedAction) {
    await failRun(deps, runId, "INVALID_MODEL_OUTPUT");
    return;
  }
  const selectedAction = current.selectedAction;

  if (current.executionId) {
    await scheduleVerification(deps, current);
    return;
  }

  let run = current;
  if (run.phase === "reasoning") {
    const claimed = await deps.runs.claimPhase(run.id, "reasoning", "executing");
    if (!claimed) {
      return;
    }
    run = claimed;
  }
  if (run.phase !== "executing") {
    return;
  }

  const result = await deps.execution.execute({
    actor,
    agentInstanceId: run.agentInstanceId,
    workspaceId: run.workspaceId,
    ventureId: run.ventureId,
    capabilityId: selectedAction.capabilityId,
    arguments: selectedAction.arguments,
    sourceRequestId: run.sourceRequestId,
    sourceActionIndex: 0,
  });

  if (result.ok) {
    if (result.reused !== true) {
      await recordExecutionAudit(
        deps,
        run,
        result.executionId,
        "workforce.execution.succeeded",
      );
    }
    await deps.runs.patch(runId, { executionId: result.executionId });
    const executed = await deps.runs.get(runId);
    if (!executed) {
      return;
    }
    await scheduleVerification(deps, executed);
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
  await recordExecutionAudit(deps, run, result.executionId, "workforce.execution.failed");
  await failRun(deps, runId, "EXECUTION_FAILED");
}

async function scheduleVerification(
  deps: WorkforceRunOrchestratorDeps,
  run: WorkforceRunRecord,
) {
  if (!run.executionId || !run.selectedAction) {
    await failRun(deps, run.id, "VERIFICATION_UNAVAILABLE");
    return;
  }

  const existing = await deps.verifications.getByRunId(run.id);
  if (existing && isTerminalVerificationStatus(existing.status)) {
    await finalizeFromVerification(deps, run.id, existing);
    return;
  }

  if (!existing) {
    const verifier = deps.verifiers.get(run.selectedAction.capabilityId);
    if (!verifier) {
      await failRun(deps, run.id, "VERIFICATION_UNAVAILABLE");
      return;
    }
    const bound = verifier.bindPredicate(run.selectedAction.arguments);
    if (!bound.ok) {
      await failRun(deps, run.id, "VERIFICATION_UNAVAILABLE");
      return;
    }
    const identity = (deps.implementations ?? emptyWorkforceImplementations()).get(
      run.selectedAction.capabilityId,
    );
    await deps.verifications.insertPending({
      runId: run.id,
      executionId: run.executionId,
      workspaceId: run.workspaceId,
      ventureId: run.ventureId,
      agentInstanceId: run.agentInstanceId,
      capabilityId: run.selectedAction.capabilityId,
      sourceRequestId: run.sourceRequestId,
      sourceActionIndex: run.selectedActionIndex ?? 0,
      predicate: bound.predicate,
      implementationId: identity?.bindingId ?? null,
      implementationVersion: identity?.implementationVersion ?? null,
    });
  }

  if (run.phase === "executing") {
    const verifying = await deps.runs.claimPhase(run.id, "executing", "verifying");
    if (!verifying && (await deps.runs.get(run.id))?.phase !== "verifying") {
      return;
    }
  } else if (run.phase !== "verifying") {
    await deps.runs.patch(run.id, { phase: "verifying" });
  }

  await enqueueVerifyIfIdle(deps, run.id);
}

async function enqueueVerifyIfIdle(
  deps: WorkforceRunOrchestratorDeps,
  runId: WorkforceRunId,
) {
  if (await deps.jobs.hasActive(runId, "verify")) {
    return;
  }
  const job = await deps.jobs.enqueue(WORKFORCE_RUN_STEP_JOB, {
    runId,
    step: "verify",
  });
  await deps.runs.patch(runId, { jobId: job.id, phase: "verifying" });
}

async function handleVerify(
  deps: WorkforceRunOrchestratorDeps,
  runId: WorkforceRunId,
) {
  const run = await deps.runs.get(runId);
  if (!run || TERMINAL.has(run.phase)) {
    return;
  }

  if (run.phase === "executing" && run.executionId) {
    await scheduleVerification(deps, run);
    return;
  }

  let verification = await deps.verifications.getByRunId(runId);
  if (!verification) {
    if (run.executionId) {
      await scheduleVerification(deps, run);
    }
    return;
  }

  if (isTerminalVerificationStatus(verification.status)) {
    await finalizeFromVerification(deps, runId, verification);
    return;
  }

  if (
    verification.workspaceId !== run.workspaceId ||
    verification.ventureId !== run.ventureId ||
    verification.agentInstanceId !== run.agentInstanceId
  ) {
    await failVerification(deps, verification, "SCOPE_MISMATCH");
    return;
  }
  if (
    !run.executionId ||
    verification.executionId !== run.executionId ||
    verification.capabilityId !== run.selectedCapabilityId
  ) {
    await failVerification(deps, verification, "EXECUTION_MISMATCH");
    return;
  }

  if (verification.status === "observing" && verification.observation) {
    await concludeObservation(deps, run, verification, verification.observation);
    return;
  }

  let claimed =
    verification.status === "pending"
      ? await deps.verifications.claimObserving(verification.id)
      : undefined;
  if (!claimed && verification.status === "observing" && !verification.observation) {
    claimed = await deps.verifications.adoptObserving(verification.id);
  }
  if (!claimed) {
    return;
  }
  verification = claimed;

  if (verification.attemptCount === 1 && !verification.observation) {
    await recordVerificationAudit(deps, "workforce.verification.started", run, verification);
  }

  let observation = verification.observation;
  if (!observation) {
    const verifier = deps.verifiers.get(verification.capabilityId);
    if (!verifier) {
      await failVerification(deps, verification, "VERIFIER_UNAVAILABLE");
      return;
    }
    try {
      observation = await withTimeout(
        verifier.observe({
          runId: run.id,
          executionId: verification.executionId,
          workspaceId: verification.workspaceId,
          ventureId: verification.ventureId,
          agentInstanceId: verification.agentInstanceId,
          capabilityId: verification.capabilityId,
          predicateFingerprint: verification.predicateFingerprint,
          sourceRequestId: verification.sourceRequestId,
          sourceActionIndex: verification.sourceActionIndex,
        }),
        VERIFICATION_OBSERVE_TIMEOUT_MS,
      );
    } catch (error) {
      observation = {
        status:
          error instanceof Error && error.message === "VERIFICATION_TIMEOUT"
            ? "timeout"
            : "unavailable",
        observedAt: nowIso(),
      };
    }
    const persisted = await deps.verifications.persistObservation(
      verification.id,
      observation,
    );
    if (!persisted) {
      return;
    }
    verification = persisted;
  }

  await concludeObservation(deps, run, verification, observation);
}

async function concludeObservation(
  deps: WorkforceRunOrchestratorDeps,
  run: WorkforceRunRecord,
  verification: WorkforceVerificationRecord,
  observation: VerificationObservation,
) {
  if (observationContainsForbiddenData(observation)) {
    await failVerification(deps, verification, "INVALID_OBSERVATION");
    return;
  }

  if (observation.status === "invalid") {
    await failVerification(deps, verification, "INVALID_OBSERVATION");
    return;
  }

  if (observation.status === "observed") {
    await applyObserved(deps, run, verification, observation);
    return;
  }

  if (!isRetryableObservation(observation.status)) {
    await failVerification(deps, verification, "INVALID_OBSERVATION");
    return;
  }

  if (canRetryVerification(verification.attemptCount)) {
    const released = await deps.verifications.releasePending(verification.id);
    if (!released) {
      return;
    }
    const job = await deps.jobs.enqueue(
      WORKFORCE_RUN_STEP_JOB,
      { runId: run.id, step: "verify" },
      verificationRetryAt(),
    );
    await deps.runs.patch(run.id, { jobId: job.id, phase: "verifying" });
    return;
  }

  if (observation.status === "missing") {
    await completeVerification(deps, run, verification, observation, "NOT_VERIFIED");
    return;
  }

  await failVerification(
    deps,
    verification,
    observation.status === "timeout" ? "OBSERVER_TIMEOUT" : "OBSERVER_UNAVAILABLE",
  );
}

async function applyObserved(
  deps: WorkforceRunOrchestratorDeps,
  run: WorkforceRunRecord,
  verification: WorkforceVerificationRecord,
  observation: VerificationObservation,
) {
  const verifier = deps.verifiers.get(verification.capabilityId);
  if (!verifier) {
    await failVerification(deps, verification, "VERIFIER_UNAVAILABLE");
    return;
  }
  if (!run.selectedAction) {
    await failVerification(deps, verification, "INVALID_PREDICATE");
    return;
  }
  const live = verifier.bindPredicate(run.selectedAction.arguments);
  const storedFingerprint = fingerprintBoundPredicate({
    capabilityId: verification.capabilityId,
    predicateId: verification.predicateId,
    version: verification.predicateVersion,
    expected: verification.expected,
  });
  if (
    !live.ok ||
    live.predicate.fingerprint !== verification.predicateFingerprint ||
    storedFingerprint !== verification.predicateFingerprint
  ) {
    await failVerification(deps, verification, "INVALID_PREDICATE");
    return;
  }

  const result = verifier.apply(live.predicate, observation);
  await completeVerification(deps, run, verification, observation, result.outcome);
}

async function completeVerification(
  deps: WorkforceRunOrchestratorDeps,
  run: WorkforceRunRecord,
  verification: WorkforceVerificationRecord,
  observation: VerificationObservation,
  outcome: VerificationOutcome,
) {
  const evidence = encodeVerificationEvidence(
    evidenceFromObservation({
      observation,
      predicate: {
        id: verification.predicateId,
        version: verification.predicateVersion,
        capabilityId: verification.capabilityId,
        expected: verification.expected,
        fingerprint: verification.predicateFingerprint,
      },
      executionId: verification.executionId,
      matched: outcome === "VERIFIED",
    }),
  );
  if (!evidence.ok) {
    await failVerification(deps, verification, "EVIDENCE_TOO_LARGE");
    return;
  }
  const completed = await deps.verifications.complete(
    verification.id,
    outcome,
    evidence.json,
    VERIFICATION_PROVENANCE,
  );
  if (!completed) {
    const latest = await deps.verifications.get(verification.id);
    if (latest && isTerminalVerificationStatus(latest.status)) {
      await finalizeFromVerification(deps, run.id, latest);
    }
    return;
  }
  await recordVerificationAudit(
    deps,
    outcome === "VERIFIED"
      ? "workforce.verification.verified"
      : "workforce.verification.not_verified",
    run,
    completed,
  );
  await finalizeFromVerification(deps, run.id, completed);
}

async function failVerification(
  deps: WorkforceRunOrchestratorDeps,
  verification: WorkforceVerificationRecord,
  failure: VerificationFailure,
) {
  const failed =
    (await deps.verifications.fail(verification.id, failure)) ??
    (await deps.verifications.get(verification.id));
  if (failed) {
    const run = await deps.runs.get(failed.runId);
    if (run) {
      await recordVerificationAudit(
        deps,
        "workforce.verification.failed",
        run,
        failed,
      );
    }
  }
  await failRun(deps, verification.runId, "VERIFICATION_UNAVAILABLE");
}

async function finalizeFromVerification(
  deps: WorkforceRunOrchestratorDeps,
  runId: WorkforceRunId,
  verification: WorkforceVerificationRecord,
) {
  if (verification.status === "verified") {
    await completeRun(deps, runId, "executed", "VERIFIED");
    return;
  }
  if (verification.status === "not_verified") {
    await completeRun(deps, runId, "executed", "NOT_VERIFIED");
    return;
  }
  if (verification.status === "failed") {
    await failRun(deps, runId, "VERIFICATION_UNAVAILABLE");
  }
}

async function recoverWorkforce(deps: WorkforceRunOrchestratorDeps) {
  await deps.runs.recoverInterrupted();
  const verifying = await deps.runs.listByPhase("verifying");
  const staleAfterMs = VERIFICATION_OBSERVE_TIMEOUT_MS + 5_000;
  for (const run of verifying) {
    const verification = await deps.verifications.getByRunId(run.id);
    if (!verification) {
      if (run.executionId) {
        await scheduleVerification(deps, run);
      }
      continue;
    }
    if (isTerminalVerificationStatus(verification.status)) {
      await finalizeFromVerification(deps, run.id, verification);
      continue;
    }
    const active = await deps.jobs.hasActive(run.id, "verify");
    if (verification.status === "observing") {
      if (!verification.observation && !active) {
        const age = Date.now() - Date.parse(verification.updatedAt);
        if (Number.isFinite(age) && age > staleAfterMs) {
          await deps.verifications.releaseStaleObserving(verification.id);
        }
      }
      if (!active) {
        await enqueueVerifyIfIdle(deps, run.id);
      }
      continue;
    }
    if (verification.status === "pending" && !active) {
      await enqueueVerifyIfIdle(deps, run.id);
    }
  }
}

async function recordExecutionAudit(
  deps: WorkforceRunOrchestratorDeps,
  run: WorkforceRunRecord,
  executionId: string | undefined,
  action: string,
) {
  if (!deps.audit || !executionId) {
    return;
  }
  const identity = (deps.implementations ?? emptyWorkforceImplementations()).get(
    run.selectedCapabilityId ?? run.selectedAction?.capabilityId ?? "",
  );
  await deps.audit.record({
    action,
    actor: {
      kind: "system",
      component: "workforce.execution",
      workspaceId: run.workspaceId,
    },
    metadata: {
      runId: run.id,
      executionId,
      workspaceId: run.workspaceId,
      ventureId: run.ventureId,
      capabilityId: run.selectedCapabilityId ?? "",
      ...(identity
        ? {
            implementationId: identity.bindingId,
            implementationVersion: identity.implementationVersion,
          }
        : {}),
    },
  });
}

async function recordVerificationAudit(
  deps: WorkforceRunOrchestratorDeps,
  action: string,
  run: WorkforceRunRecord,
  verification: WorkforceVerificationRecord,
) {
  if (!deps.audit) {
    return;
  }
  await deps.audit.record({
    action,
    actor: {
      kind: "system",
      component: "workforce.verification",
      workspaceId: run.workspaceId,
    },
    metadata: {
      runId: run.id,
      executionId: verification.executionId,
      verificationId: verification.id,
      workspaceId: run.workspaceId,
      ventureId: run.ventureId,
    },
  });
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
  verificationOutcome?: VerificationOutcome,
) {
  await deps.runs.patch(runId, {
    phase: "completed",
    completionKind: kind,
    ...(verificationOutcome ? { verificationOutcome } : {}),
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
    (record.step !== "reason" &&
      record.step !== "resume" &&
      record.step !== "verify")
  ) {
    return undefined;
  }
  return {
    runId: record.runId as WorkforceRunId,
    step: record.step,
  };
}

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error("VERIFICATION_TIMEOUT"));
    }, ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}
