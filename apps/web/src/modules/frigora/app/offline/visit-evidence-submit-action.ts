"use server";

import { StoredObjectError } from "@/platform/storage/errors";
import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth/session";
import { isFrigoraError } from "@/modules/frigora/errors";
import { createScope, getFrigoraService } from "@/modules/frigora/service";
import type { FrigoraVisitEvidenceCategory, FrigoraVisitId } from "@/modules/frigora/types";
import { parseWithFrigora, scopeSchema } from "@/modules/frigora/validation";

export type ExplicitVisitEvidenceSubmitState = {
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
 * Explicit online submission of locally captured visit evidence bytes.
 * Must only be invoked by a user action — never by reconnect/boot/timers.
 */
export async function submitPendingVisitEvidenceFormAction(
  _prev: ExplicitVisitEvidenceSubmitState,
  formData: FormData,
): Promise<ExplicitVisitEvidenceSubmitState> {
  const session = await getSession();
  if (!session) {
    return { error: "You must be signed in to submit.", code: "auth_required" };
  }

  const workspaceId = text(formData, "workspaceId");
  const ventureId = text(formData, "ventureId");
  const workOrderId = text(formData, "workOrderId");
  const visitId = text(formData, "visitId");
  const clientOperationId = text(formData, "clientOperationId");
  const category = text(formData, "category") as FrigoraVisitEvidenceCategory;
  const description = text(formData, "description");
  const originalFilename = text(formData, "originalFilename");
  const mimeType = text(formData, "mimeType");
  const assetIdRaw = text(formData, "assetId").trim();
  const actorUserId = text(formData, "actorUserId");

  if (actorUserId && actorUserId !== session.id) {
    return {
      error: "This pending evidence belongs to a different engineer on this device.",
      code: "partition",
    };
  }

  const fileEntry = formData.get("file");
  if (
    typeof fileEntry !== "object" ||
    fileEntry === null ||
    !("arrayBuffer" in fileEntry) ||
    typeof (fileEntry as { arrayBuffer: unknown }).arrayBuffer !== "function"
  ) {
    return { error: "Evidence bytes are required for submission.", code: "rejected" };
  }
  const file = fileEntry as Blob & { name?: string; type: string };

  try {
    parseWithFrigora(scopeSchema, { workspaceId, ventureId });
    const buffer = new Uint8Array(await file.arrayBuffer());
    const result = await getFrigoraService().submitClientVisitEvidence(
      createScope({
        userId: session.id,
        workspaceId,
        ventureId,
      }),
      visitId as FrigoraVisitId,
      {
        workOrderId,
        clientOperationId,
        category,
        description: description.length > 0 ? description : null,
        userId: session.id,
        assetId: assetIdRaw.length > 0 ? assetIdRaw : null,
        body: buffer,
        originalFilename:
          originalFilename.trim().length > 0
            ? originalFilename
            : typeof file.name === "string" && file.name.trim().length > 0
              ? file.name
              : "evidence.bin",
        mimeType:
          mimeType.trim().length > 0
            ? mimeType
            : file.type || "application/octet-stream",
      },
    );

    revalidatePath(`/ventures/${ventureId}/work/assigned`);
    revalidatePath(`/ventures/${ventureId}/work/${workOrderId}`);
    revalidatePath(`/ventures/${ventureId}/work/${workOrderId}/visit/${visitId}`);

    return {
      acceptedEntityId: result.evidence.id,
      receiptId: result.receipt.id,
      duplicate: result.duplicate,
    };
  } catch (error) {
    if (error instanceof StoredObjectError && error.code === "IDEMPOTENCY_CONFLICT") {
      return { error: error.message, code: "idempotency_conflict" };
    }
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
