"use server";

import type { WorkforceRunId } from "@/contracts/ids";
import { getSession } from "@/lib/auth/session";
import { getWorkforceService } from "@/modules/workforce/service";
import type { HumanWorkforceActor } from "@/core/workforce/types";

export type WorkforceApprovalActionResult = {
  error?: string;
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
