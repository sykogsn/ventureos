"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth/session";
import { isFrigoraError } from "@/modules/frigora/errors";
import { createScope, getFrigoraService } from "@/modules/frigora/service";
import type { FrigoraVisitId } from "@/modules/frigora/types";
import { parseWithFrigora, scopeSchema } from "@/modules/frigora/validation";

export type ExplicitFieldCaptureSubmitState = {
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
 * Explicit online submission of a locally captured field capture.
 * Must only be invoked by a user action — never by reconnect/boot/timers.
 */
export async function submitPendingFieldCaptureFormAction(
  _prev: ExplicitFieldCaptureSubmitState,
  formData: FormData,
): Promise<ExplicitFieldCaptureSubmitState> {
  const session = await getSession();
  if (!session) {
    return { error: "You must be signed in to submit.", code: "auth_required" };
  }

  const workspaceId = text(formData, "workspaceId");
  const ventureId = text(formData, "ventureId");
  const workOrderId = text(formData, "workOrderId");
  const visitId = text(formData, "visitId");
  const clientOperationId = text(formData, "clientOperationId");
  const captureKind = text(formData, "captureKind") as "measurement" | "condition";
  const captureCode = text(formData, "captureCode");
  const observedAt = text(formData, "observedAt");
  const description = text(formData, "description");
  const valueNumericRaw = text(formData, "valueNumeric");
  const valueUnit = text(formData, "valueUnit");
  const assetIdRaw = text(formData, "assetId").trim();
  const actorUserId = text(formData, "actorUserId");

  if (actorUserId && actorUserId !== session.id) {
    return {
      error: "This pending capture belongs to a different engineer on this device.",
      code: "partition",
    };
  }

  try {
    parseWithFrigora(scopeSchema, { workspaceId, ventureId });
    const valueNumeric =
      valueNumericRaw.trim().length > 0 ? Number(valueNumericRaw) : null;
    const result = await getFrigoraService().submitClientFieldCapture(
      createScope({
        userId: session.id,
        workspaceId,
        ventureId,
      }),
      visitId as FrigoraVisitId,
      {
        workOrderId,
        clientOperationId,
        captureKind,
        captureCode,
        observedAt,
        userId: session.id,
        description: description.length > 0 ? description : null,
        valueNumeric: Number.isFinite(valueNumeric) ? valueNumeric : null,
        valueUnit: valueUnit.length > 0 ? valueUnit : null,
        assetId: assetIdRaw.length > 0 ? assetIdRaw : null,
      },
    );

    revalidatePath(`/ventures/${ventureId}/work/assigned`);
    revalidatePath(`/ventures/${ventureId}/work/${workOrderId}`);
    revalidatePath(`/ventures/${ventureId}/work/${workOrderId}/visit/${visitId}`);

    return {
      acceptedEntityId: result.capture.id,
      receiptId: result.receipt.id,
      duplicate: result.duplicate,
    };
  } catch (error) {
    if (isFrigoraError(error)) {
      if (error.code === "forbidden") {
        return { error: error.message, code: "authority" };
      }
      if (error.code === "idempotency_conflict") {
        return { error: error.message, code: "idempotency_conflict" };
      }
      if (error.code === "invalid_status" || error.code === "invalid_input" || error.code === "not_found") {
        return { error: error.message, code: "rejected" };
      }
      return { error: error.message, code: "rejected" };
    }
    return {
      error: error instanceof Error ? error.message : "Submission failed.",
      code: "retryable",
    };
  }
}
