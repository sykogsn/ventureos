"use server";

import type { WorkforceRunId } from "@/contracts/ids";
import { getActiveWorkspaceId, getSession } from "@/lib/auth/session";
import { getWorkforceService } from "@/modules/workforce/service";
import type {
  HumanWorkforceActor,
  ModelContextCitation,
  ModelEvidenceRef,
} from "@/core/workforce/types";
import type { WorkforceRunInspection } from "@/platform/workforce/inspect";
import {
  createWorkforceRunFromSession,
  inspectWorkforceRunFromSession,
} from "@/modules/workforce/session-entry";

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

export async function approveWorkforceRunAction(input: {
  runId: string;
  workspaceId: string;
  ventureId: string;
}): Promise<WorkforceApprovalActionResult> {
  return decide("approve", input);
}

export async function rejectWorkforceRunAction(input: {
  runId: string;
  workspaceId: string;
  ventureId: string;
}): Promise<WorkforceApprovalActionResult> {
  return decide("reject", input);
}

async function decide(
  kind: "approve" | "reject",
  input: { runId: string; workspaceId: string; ventureId: string },
): Promise<WorkforceApprovalActionResult> {
  const session = await getSession();
  if (!session) {
    return { error: "You must be signed in." };
  }

  const actor: HumanWorkforceActor = {
    kind: "human",
    userId: session.id,
    workspaceId: input.workspaceId as HumanWorkforceActor["workspaceId"],
    ventureId: input.ventureId as HumanWorkforceActor["ventureId"],
  };

  const service = getWorkforceService();
  const result =
    kind === "approve"
      ? await service.approve(input.runId as WorkforceRunId, actor)
      : await service.reject(input.runId as WorkforceRunId, actor);

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
