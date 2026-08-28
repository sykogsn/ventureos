"use server";

import { getActiveWorkspaceId, getSession } from "@/lib/auth/session";
import type {
  ModelContextCitation,
  ModelEvidenceRef,
} from "@/core/workforce/types";
import {
  createWorkforceRunFromSession,
  decideWorkforceRunFromSession,
  getWorkforceInstanceFromSession,
  inspectWorkforceRunFromSession,
  listWorkforceInstancesFromSession,
  listWorkforceRunsFromSession,
  type WorkforceAgentInstanceView,
} from "@/modules/workforce/session-entry";
import type {
  WorkforceRunInspection,
  WorkforceRunListItem,
} from "@/platform/workforce/inspect";

export type WorkforceApprovalActionResult = {
  error?: string;
};

export type WorkforceCreateRunActionResult = {
  error?: string;
  runId?: string;
};

export type WorkforceInspectActionResult = {
  error?: string;
  inspection?: WorkforceRunInspection;
};

export type WorkforceListRunsActionResult = {
  error?: string;
  runs?: WorkforceRunListItem[];
};

export type WorkforceListInstancesActionResult = {
  error?: string;
  instances?: WorkforceAgentInstanceView[];
};

export type WorkforceGetInstanceActionResult = {
  error?: string;
  instance?: WorkforceAgentInstanceView;
};

export async function approveWorkforceRunAction(input: {
  runId: string;
  ventureId: string;
  workspaceId?: string;
}): Promise<WorkforceApprovalActionResult> {
  return decide("approve", input);
}

export async function rejectWorkforceRunAction(input: {
  runId: string;
  ventureId: string;
  workspaceId?: string;
}): Promise<WorkforceApprovalActionResult> {
  return decide("reject", input);
}

async function decide(
  kind: "approve" | "reject",
  input: { runId: string; ventureId: string; workspaceId?: string },
): Promise<WorkforceApprovalActionResult> {
  const session = await getSession();
  if (!session) {
    return { error: "You must be signed in." };
  }

  const result = await decideWorkforceRunFromSession(kind, {
    session,
    activeWorkspaceId: await getActiveWorkspaceId(),
    claimedWorkspaceId: input.workspaceId,
    ventureId: input.ventureId,
    runId: input.runId,
  });

  if (!result.ok) {
    return { error: "Approval was not recorded." };
  }
  return {};
}

export async function createWorkforceRunAction(input: {
  agentInstanceId: string;
  ventureId: string;
  workspaceId?: string;
  objective: string;
  evidence?: ModelEvidenceRef[];
  citations?: ModelContextCitation[];
}): Promise<WorkforceCreateRunActionResult> {
  const session = await getSession();
  if (!session) {
    return { error: "You must be signed in." };
  }

  const result = await createWorkforceRunFromSession({
    session,
    activeWorkspaceId: await getActiveWorkspaceId(),
    claimedWorkspaceId: input.workspaceId,
    ventureId: input.ventureId,
    agentInstanceId: input.agentInstanceId,
    objective: input.objective,
    evidence: input.evidence,
    citations: input.citations,
  });

  if (!result.ok) {
    return { error: "Run was not created." };
  }
  return { runId: result.runId };
}

export async function inspectWorkforceRunAction(input: {
  runId: string;
  ventureId: string;
  workspaceId?: string;
}): Promise<WorkforceInspectActionResult> {
  const session = await getSession();
  if (!session) {
    return { error: "You must be signed in." };
  }

  const result = await inspectWorkforceRunFromSession({
    session,
    activeWorkspaceId: await getActiveWorkspaceId(),
    claimedWorkspaceId: input.workspaceId,
    ventureId: input.ventureId,
    runId: input.runId,
  });

  if (!result.ok) {
    return { error: "Run was not found." };
  }
  return { inspection: result.inspection };
}

export async function listWorkforceRunsAction(input: {
  ventureId: string;
  workspaceId?: string;
}): Promise<WorkforceListRunsActionResult> {
  const session = await getSession();
  if (!session) {
    return { error: "You must be signed in." };
  }

  const result = await listWorkforceRunsFromSession({
    session,
    activeWorkspaceId: await getActiveWorkspaceId(),
    claimedWorkspaceId: input.workspaceId,
    ventureId: input.ventureId,
  });

  if (!result.ok) {
    return { error: "Runs could not be listed." };
  }
  return { runs: result.runs };
}

export async function listWorkforceInstancesAction(input: {
  ventureId: string;
  workspaceId?: string;
}): Promise<WorkforceListInstancesActionResult> {
  const session = await getSession();
  if (!session) {
    return { error: "You must be signed in." };
  }

  const result = await listWorkforceInstancesFromSession({
    session,
    activeWorkspaceId: await getActiveWorkspaceId(),
    claimedWorkspaceId: input.workspaceId,
    ventureId: input.ventureId,
  });

  if (!result.ok) {
    return { error: "Instances could not be listed." };
  }
  return { instances: result.instances };
}

export async function getWorkforceInstanceAction(input: {
  instanceId: string;
  ventureId: string;
  workspaceId?: string;
}): Promise<WorkforceGetInstanceActionResult> {
  const session = await getSession();
  if (!session) {
    return { error: "You must be signed in." };
  }

  const result = await getWorkforceInstanceFromSession({
    session,
    activeWorkspaceId: await getActiveWorkspaceId(),
    claimedWorkspaceId: input.workspaceId,
    ventureId: input.ventureId,
    instanceId: input.instanceId,
  });

  if (!result.ok) {
    return { error: "Instance was not found." };
  }
  return { instance: result.instance };
}
