"use server";

import type { WorkspaceId } from "@/contracts";
import { getActiveWorkspaceId, getSession } from "@/lib/auth/session";
import {
  persistFoundedCompany,
  recordFounderDecision,
} from "@/modules/intelligence/service";
import type { LaunchDraft } from "@/modules/ventures/launch/types";
import { validateLaunchStep } from "@/modules/ventures/launch/validation";
import { listWorkspaces } from "@/modules/workspaces/service";

export type FoundCompanyResult = {
  error?: string;
  slug?: string;
};

async function activeWorkspace(userId: Parameters<typeof listWorkspaces>[0]) {
  const cookieId = await getActiveWorkspaceId();
  const workspaces = await listWorkspaces(userId);
  return workspaces.find((item) => item.id === cookieId) ?? workspaces[0];
}

export async function foundCompanyAction(
  draft: LaunchDraft,
): Promise<FoundCompanyResult> {
  const session = await getSession();
  if (!session) {
    return { error: "You must be signed in." };
  }

  const message = validateLaunchStep("mission", draft);
  if (message) {
    return { error: message };
  }

  const workspace = await activeWorkspace(session.id);

  if (!workspace) {
    return { error: "Create a workspace first." };
  }

  try {
    const company = await persistFoundedCompany({
      userId: session.id,
      workspaceId: workspace.id as WorkspaceId,
      draft,
    });
    return { slug: company.slug };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Could not found the company.",
    };
  }
}

export type RecordFounderDecisionState = {
  error?: string;
};

export async function recordFounderDecisionAction(input: {
  decisionId: string;
  ventureId: string;
  ruling: string;
  result?: string;
}): Promise<RecordFounderDecisionState> {
  const session = await getSession();
  if (!session) {
    return { error: "You must be signed in." };
  }

  const workspace = await activeWorkspace(session.id);
  if (!workspace) {
    return { error: "Create a workspace first." };
  }

  const ruling = input.ruling.trim();
  if (!ruling) {
    return { error: "A founder ruling is required." };
  }

  try {
    await recordFounderDecision({
      userId: session.id,
      workspaceId: workspace.id as WorkspaceId,
      decisionId: input.decisionId,
      ventureId: input.ventureId,
      ruling,
      result: input.result,
    });
    return {};
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Could not record the decision.",
    };
  }
}
