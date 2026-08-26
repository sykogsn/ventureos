import type { UserId, VentureId, WorkspaceId } from "@/contracts";
import type { AgentInstanceId, WorkforceRunId } from "@/contracts/ids";
import { platformCapabilityRegistry } from "@/core/capability/catalog";
import {
  createWorkforceExecutionGate,
} from "@/core/workforce/execution";
import { createWorkforceExecutorRegistry } from "@/core/workforce/executors";
import { createWorkforceVerifierRegistry } from "@/core/workforce/verifiers";
import {
  createWorkforceRunOrchestrator,
  WORKFORCE_RUN_STEP_JOB,
  type WorkforceRunCreateResult,
  type WorkforceDecisionResult,
  type WorkforceRunOrchestrator,
} from "@/core/workforce/run";
import { createOpenAIModelPort } from "@/platform/ai/openai-adapter";
import type { HumanWorkforceActor, ModelPort } from "@/core/workforce/types";
import { getPlatform } from "@/platform/kernel";
import {
  createWorkforceApprovalSatisfactionPort,
  createWorkforceApprovalStore,
} from "@/platform/workforce/approval-store";
import { createWorkforceDefinitionRepository } from "@/platform/workforce/definition-repository";
import { createWorkforceExecutionStore } from "@/platform/workforce/execution-store";
import { createWorkforceInstanceRepository } from "@/platform/workforce/instance-repository";
import { createWorkforceRunStore } from "@/platform/workforce/run-store";
import { createWorkforceVerificationStore } from "@/platform/workforce/verification-store";
import { createVentureScopePort } from "@/platform/workforce/venture-scope";
import { WORKFORCE_APPROVAL_PERMISSION } from "@/core/workforce/approval";

export const WORKFORCE_RUN_JOB_NAME = WORKFORCE_RUN_STEP_JOB;

export type WorkforceService = {
  createRun(input: {
    actor: HumanWorkforceActor;
    agentInstanceId: AgentInstanceId;
    workspaceId: WorkspaceId;
    ventureId: VentureId;
    objective: string;
  }): Promise<WorkforceRunCreateResult>;
  approve(
    runId: WorkforceRunId,
    actor: HumanWorkforceActor,
  ): Promise<WorkforceDecisionResult>;
  reject(
    runId: WorkforceRunId,
    actor: HumanWorkforceActor,
  ): Promise<WorkforceDecisionResult>;
  orchestrator: WorkforceRunOrchestrator;
};

export type WorkforceServiceOptions = {
  model?: ModelPort;
};

const globalStore = globalThis as typeof globalThis & {
  __vosWorkforce?: WorkforceService;
};

/**
 * Production Workforce service. Empty executor registry and empty verifier
 * registry — no production business executor or verifier. Tests inject a
 * ModelPort and probe executor/verifier via createWorkforceService.
 */
export function createWorkforceService(
  options: WorkforceServiceOptions = {},
): WorkforceService {
  const definitions = createWorkforceDefinitionRepository();
  const instances = createWorkforceInstanceRepository();
  const runs = createWorkforceRunStore();
  const approvals = createWorkforceApprovalStore();
  const verifications = createWorkforceVerificationStore();
  const executors = createWorkforceExecutorRegistry([]);
  const verifiers = createWorkforceVerifierRegistry([]);
  const execution = createWorkforceExecutionGate({
    definitions,
    instances,
    capabilities: platformCapabilityRegistry,
    scope: createVentureScopePort(),
    executors,
    store: createWorkforceExecutionStore(),
    approvals: createWorkforceApprovalSatisfactionPort(approvals),
  });

  const orchestrator = createWorkforceRunOrchestrator({
    definitions,
    instances,
    capabilities: platformCapabilityRegistry,
    scope: createVentureScopePort(),
    model: options.model ?? createOpenAIModelPort(),
    executors,
    verifiers,
    execution,
    runs,
    approvals,
    verifications,
    jobs: {
      async enqueue(name, payload, runAt) {
        return getPlatform().jobs.enqueue(name, payload, runAt);
      },
    },
    audit: getPlatform().audit,
    canApprove: async (userId: UserId, workspaceId: WorkspaceId) =>
      getPlatform().permissions.can({
        userId,
        permission: WORKFORCE_APPROVAL_PERMISSION,
        resource: { type: "workspace", id: workspaceId },
      }),
  });

  return {
    orchestrator,
    createRun: (input) => orchestrator.createRun(input),
    approve: (runId, actor) => orchestrator.approve(runId, actor),
    reject: (runId, actor) => orchestrator.reject(runId, actor),
  };
}

export function getWorkforceService() {
  if (!globalStore.__vosWorkforce) {
    globalStore.__vosWorkforce = createWorkforceService();
  }
  return globalStore.__vosWorkforce;
}
