"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth/session";
import { createScope, getFrigoraService } from "@/modules/frigora/service";
import { classifyExplicitSubmitFailure } from "./offline-submit-classification";
import type { FrigoraTechnicalFindingKind, FrigoraVisitId } from "@/modules/frigora/types";
import { parseWithFrigora, scopeSchema } from "@/modules/frigora/validation";

export type ExplicitTechnicalFindingSubmitState = {
  error?: string;
  code?:
    | "auth_required"
    | "authority"
    | "idempotency_conflict"
    | "rejected"
    | "retryable"
    | "partition";
  acceptedEntityId?: string;
  receiptId?: string;
  duplicate?: boolean;
};

function text(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

/**
 * Explicit online submission of a locally captured technical finding.
 * Must only be invoked by a user action — never by reconnect/boot/timers.
 */
export async function submitPendingTechnicalFindingFormAction(
  _prev: ExplicitTechnicalFindingSubmitState,
  formData: FormData,
): Promise<ExplicitTechnicalFindingSubmitState> {
  const session = await getSession();
  if (!session) {
    return { error: "You must be signed in to submit.", code: "auth_required" };
  }

  const workspaceId = text(formData, "workspaceId");
  const ventureId = text(formData, "ventureId");
  const workOrderId = text(formData, "workOrderId");
  const visitId = text(formData, "visitId");
  const clientOperationId = text(formData, "clientOperationId");
  const findingKind = text(formData, "findingKind") as FrigoraTechnicalFindingKind;
  const description = text(formData, "description");
  const assertedAt = text(formData, "assertedAt");
  const assetIdRaw = text(formData, "assetId").trim();
  const actorUserId = text(formData, "actorUserId");

  if (actorUserId && actorUserId !== session.id) {
    return {
      error: "This pending finding belongs to a different engineer on this device.",
      code: "partition",
    };
  }

  try {
    parseWithFrigora(scopeSchema, { workspaceId, ventureId });
    const result = await getFrigoraService().submitClientTechnicalFinding(
      createScope({
        userId: session.id,
        workspaceId,
        ventureId,
      }),
      visitId as FrigoraVisitId,
      {
        workOrderId,
        clientOperationId,
        findingKind,
        description,
        assertedAt,
        userId: session.id,
        assetId: assetIdRaw.length > 0 ? assetIdRaw : null,
      },
    );

    revalidatePath(`/ventures/${ventureId}/work/assigned`);
    revalidatePath(`/ventures/${ventureId}/work/${workOrderId}`);
    revalidatePath(`/ventures/${ventureId}/work/${workOrderId}/visit/${visitId}`);

    return {
      acceptedEntityId: result.finding.id,
      receiptId: result.receipt.id,
      duplicate: result.duplicate,
    };
  } catch (error) {
    return classifyExplicitSubmitFailure(error);
  }
}
