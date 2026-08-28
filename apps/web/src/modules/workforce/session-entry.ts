import type { UserId, VentureId, WorkspaceId } from "@/contracts";
import type { AgentInstanceId, JobId, WorkforceRunId } from "@/contracts/ids";
import { WORKFORCE_APPROVAL_PERMISSION } from "@/core/workforce/approval";
import type {
  AgentInstance,
  HumanWorkforceActor,
  ModelContextCitation,
  ModelEvidenceRef,
} from "@/core/workforce/types";
import type { SessionUser } from "@/lib/auth/session-token";
import { getPlatform } from "@/platform/kernel";
import { getPersistence } from "@/platform/persistence/repositories";
import {
  inspectWorkforceRun,
  listWorkforceRunSummaries,
  type WorkforceRunInspection,
  type WorkforceRunListItem,
} from "@/platform/workforce/inspect";
import { createWorkforceInstanceRepository } from "@/platform/workforce/instance-repository";
import { getWorkforceService } from "@/modules/workforce/service";

export type WorkforceSessionFailure =
  | "UNAUTHENTICATED"
  | "WORKSPACE_REQUIRED"
  | "UNAUTHORISED"
  | "SCOPE_MISMATCH"
  | "NOT_FOUND"
  | "MALFORMED_REQUEST";

export type WorkforceSessionCreateResult =
  | { ok: true; runId: WorkforceRunId; jobId: JobId }
  | { ok: false; failure: WorkforceSessionFailure };

export type WorkforceSessionInspectResult =
  | { ok: true; inspection: WorkforceRunInspection }
  | { ok: false; failure: WorkforceSessionFailure };

export type WorkforceSessionListRunsResult =
  | { ok: true; runs: WorkforceRunListItem[] }
  | { ok: false; failure: WorkforceSessionFailure };

export type WorkforceAgentInstanceView = {
  id: AgentInstanceId;
  definitionId: AgentInstance["definitionId"];
  definitionVersion: string;
  workspaceId: WorkspaceId;
  ventureId: VentureId;
  status: AgentInstance["status"];
};

export type WorkforceSessionListInstancesResult =
  | { ok: true; instances: WorkforceAgentInstanceView[] }
  | { ok: false; failure: WorkforceSessionFailure };

export type WorkforceSessionGetInstanceResult =
  | { ok: true; instance: WorkforceAgentInstanceView }
  | { ok: false; failure: WorkforceSessionFailure };

export type WorkforceSessionDecisionResult =
  | { ok: true; runId: WorkforceRunId }
  | { ok: false; failure: WorkforceSessionFailure };

export type WorkforceSessionEntryDeps = {
  canOperate?: (userId: UserId, workspaceId: WorkspaceId) => Promise<boolean>;
  loadVenture?: (
    ventureId: string,
  ) => Promise<{ workspaceId: WorkspaceId } | undefined>;
  createRun?: (input: {
    actor: HumanWorkforceActor;
    agentInstanceId: AgentInstanceId;
    workspaceId: WorkspaceId;
    ventureId: VentureId;
    objective: string;
    evidence?: ModelEvidenceRef[];
    citations?: ModelContextCitation[];
  }) => Promise<{ ok: true; runId: WorkforceRunId; jobId: JobId } | { ok: false }>;
  inspect?: (runId: WorkforceRunId) => Promise<WorkforceRunInspection | undefined>;
  listRuns?: (input: {
    workspaceId: WorkspaceId;
    ventureId: VentureId;
  }) => Promise<WorkforceRunListItem[]>;
  listInstances?: (input: {
    workspaceId: WorkspaceId;
    ventureId: VentureId;
  }) => Promise<AgentInstance[]>;
  getInstance?: (id: AgentInstanceId) => Promise<AgentInstance | undefined>;
  decide?: (
    kind: "approve" | "reject",
    runId: WorkforceRunId,
    actor: HumanWorkforceActor,
  ) => Promise<{ ok: true; runId: WorkforceRunId } | { ok: false }>;
};

export type WorkforceSessionScopeInput = {
  session: SessionUser | null;
  activeWorkspaceId: string | null;
  claimedWorkspaceId?: string;
  ventureId: string;
};

/**
 * Resolves the session workspace and venture.update permission before
 * any Workforce createRun or inspect. Workspace identity comes from the
 * session cookie, not from caller-controlled input.
 */
export async function authoriseWorkforceSession(
  input: WorkforceSessionScopeInput,
  deps: WorkforceSessionEntryDeps = {},
): Promise<
  | {
      ok: true;
      actor: HumanWorkforceActor;
      workspaceId: WorkspaceId;
      ventureId: VentureId;
    }
  | { ok: false; failure: WorkforceSessionFailure }
> {
  if (!input.session) {
    return { ok: false, failure: "UNAUTHENTICATED" };
  }

  const workspaceId = input.activeWorkspaceId?.trim() ?? "";
  if (!workspaceId) {
    return { ok: false, failure: "WORKSPACE_REQUIRED" };
  }
  if (
    input.claimedWorkspaceId !== undefined &&
    input.claimedWorkspaceId.trim() !== workspaceId
  ) {
    return { ok: false, failure: "SCOPE_MISMATCH" };
  }

  const ventureId = input.ventureId.trim();
  if (!ventureId) {
    return { ok: false, failure: "MALFORMED_REQUEST" };
  }

  const canOperate =
    deps.canOperate ??
    ((userId: UserId, scopedWorkspaceId: WorkspaceId) =>
      getPlatform().permissions.can({
        userId,
        permission: WORKFORCE_APPROVAL_PERMISSION,
        resource: { type: "workspace", id: scopedWorkspaceId },
      }));
  const allowed = await canOperate(
    input.session.id,
    workspaceId as WorkspaceId,
  );
  if (!allowed) {
    return { ok: false, failure: "UNAUTHORISED" };
  }

  const loadVenture =
    deps.loadVenture ??
    (async (id: string) => {
      const venture = await getPersistence().ventures.findById(id as VentureId);
      return venture
        ? { workspaceId: venture.workspaceId as WorkspaceId }
        : undefined;
    });
  const venture = await loadVenture(ventureId);
  if (!venture || venture.workspaceId !== workspaceId) {
    return { ok: false, failure: "SCOPE_MISMATCH" };
  }

  return {
    ok: true,
    actor: {
      kind: "human",
      userId: input.session.id,
      workspaceId: workspaceId as WorkspaceId,
      ventureId: ventureId as VentureId,
    },
    workspaceId: workspaceId as WorkspaceId,
    ventureId: ventureId as VentureId,
  };
}

export async function createWorkforceRunFromSession(
  input: WorkforceSessionScopeInput & {
    agentInstanceId: string;
    objective: string;
    evidence?: ModelEvidenceRef[];
    citations?: ModelContextCitation[];
  },
  deps: WorkforceSessionEntryDeps = {},
): Promise<WorkforceSessionCreateResult> {
  const scoped = await authoriseWorkforceSession(input, deps);
  if (!scoped.ok) {
    return scoped;
  }

  const agentInstanceId = input.agentInstanceId.trim();
  const objective = input.objective.trim();
  if (!agentInstanceId || !objective) {
    return { ok: false, failure: "MALFORMED_REQUEST" };
  }

  const createRun = deps.createRun ?? getWorkforceService().createRun;
  const created = await createRun({
    actor: scoped.actor,
    agentInstanceId: agentInstanceId as AgentInstanceId,
    workspaceId: scoped.workspaceId,
    ventureId: scoped.ventureId,
    objective,
    evidence: input.evidence,
    citations: input.citations,
  });
  if (!created.ok) {
    return { ok: false, failure: "MALFORMED_REQUEST" };
  }
  return { ok: true, runId: created.runId, jobId: created.jobId };
}

export async function inspectWorkforceRunFromSession(
  input: WorkforceSessionScopeInput & { runId: string },
  deps: WorkforceSessionEntryDeps = {},
): Promise<WorkforceSessionInspectResult> {
  const scoped = await authoriseWorkforceSession(input, deps);
  if (!scoped.ok) {
    return scoped;
  }

  const runId = input.runId.trim();
  if (!runId) {
    return { ok: false, failure: "MALFORMED_REQUEST" };
  }

  const inspect = deps.inspect ?? inspectWorkforceRun;
  const inspection = await inspect(runId as WorkforceRunId);
  if (!inspection) {
    return { ok: false, failure: "NOT_FOUND" };
  }
  if (
    inspection.run.workspaceId !== scoped.workspaceId ||
    inspection.run.ventureId !== scoped.ventureId
  ) {
    return { ok: false, failure: "SCOPE_MISMATCH" };
  }
  return { ok: true, inspection };
}

export async function listWorkforceRunsFromSession(
  input: WorkforceSessionScopeInput,
  deps: WorkforceSessionEntryDeps = {},
): Promise<WorkforceSessionListRunsResult> {
  const scoped = await authoriseWorkforceSession(input, deps);
  if (!scoped.ok) {
    return scoped;
  }

  const listRuns = deps.listRuns ?? listWorkforceRunSummaries;
  const runs = await listRuns({
    workspaceId: scoped.workspaceId,
    ventureId: scoped.ventureId,
  });
  return { ok: true, runs };
}

export async function listWorkforceInstancesFromSession(
  input: WorkforceSessionScopeInput,
  deps: WorkforceSessionEntryDeps = {},
): Promise<WorkforceSessionListInstancesResult> {
  const scoped = await authoriseWorkforceSession(input, deps);
  if (!scoped.ok) {
    return scoped;
  }

  const listInstances =
    deps.listInstances ??
    ((scope: { workspaceId: WorkspaceId; ventureId: VentureId }) =>
      createWorkforceInstanceRepository().listByScope(scope));
  const instances = await listInstances({
    workspaceId: scoped.workspaceId,
    ventureId: scoped.ventureId,
  });
  return { ok: true, instances: instances.map(toInstanceView) };
}

export async function getWorkforceInstanceFromSession(
  input: WorkforceSessionScopeInput & { instanceId: string },
  deps: WorkforceSessionEntryDeps = {},
): Promise<WorkforceSessionGetInstanceResult> {
  const scoped = await authoriseWorkforceSession(input, deps);
  if (!scoped.ok) {
    return scoped;
  }

  const instanceId = input.instanceId.trim();
  if (!instanceId) {
    return { ok: false, failure: "MALFORMED_REQUEST" };
  }

  const getInstance =
    deps.getInstance ??
    ((id: AgentInstanceId) => createWorkforceInstanceRepository().get(id));
  const instance = await getInstance(instanceId as AgentInstanceId);
  if (!instance) {
    return { ok: false, failure: "NOT_FOUND" };
  }
  if (
    instance.workspaceId !== scoped.workspaceId ||
    instance.ventureId !== scoped.ventureId
  ) {
    return { ok: false, failure: "SCOPE_MISMATCH" };
  }
  return { ok: true, instance: toInstanceView(instance) };
}

export async function decideWorkforceRunFromSession(
  kind: "approve" | "reject",
  input: WorkforceSessionScopeInput & { runId: string },
  deps: WorkforceSessionEntryDeps = {},
): Promise<WorkforceSessionDecisionResult> {
  const scoped = await authoriseWorkforceSession(input, deps);
  if (!scoped.ok) {
    return scoped;
  }

  const runId = input.runId.trim();
  if (!runId) {
    return { ok: false, failure: "MALFORMED_REQUEST" };
  }

  const inspect = deps.inspect ?? inspectWorkforceRun;
  const inspection = await inspect(runId as WorkforceRunId);
  if (!inspection) {
    return { ok: false, failure: "NOT_FOUND" };
  }
  if (
    inspection.run.workspaceId !== scoped.workspaceId ||
    inspection.run.ventureId !== scoped.ventureId
  ) {
    return { ok: false, failure: "SCOPE_MISMATCH" };
  }

  const decide =
    deps.decide ??
    (async (
      decision: "approve" | "reject",
      id: WorkforceRunId,
      actor: HumanWorkforceActor,
    ) => {
      const service = getWorkforceService();
      return decision === "approve"
        ? service.approve(id, actor)
        : service.reject(id, actor);
    });
  const decided = await decide(kind, runId as WorkforceRunId, scoped.actor);
  if (!decided.ok) {
    return { ok: false, failure: "MALFORMED_REQUEST" };
  }
  return { ok: true, runId: decided.runId };
}

function toInstanceView(instance: AgentInstance): WorkforceAgentInstanceView {
  return {
    id: instance.id,
    definitionId: instance.definitionId,
    definitionVersion: instance.definitionVersion,
    workspaceId: instance.workspaceId,
    ventureId: instance.ventureId,
    status: instance.status,
  };
}
