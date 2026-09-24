"use server";

import { getSession } from "@/lib/auth/session";
import { isFrigoraError } from "@/modules/frigora/errors";
import { createScope, getFrigoraService } from "@/modules/frigora/service";
import type { LookupClientOperationAcceptanceInput } from "@/modules/frigora/types";
import type { OfflineAcceptanceProbe } from "./offline-recovery";

/**
 * Read-only acceptance probe for one saved offline operation.
 * Does not call a submit/mutation method and does not upload evidence bytes.
 */
export async function lookupPendingOfflineAcceptanceAction(
  input: LookupClientOperationAcceptanceInput,
): Promise<OfflineAcceptanceProbe> {
  const session = await getSession();
  if (!session) {
    return { status: "UNAUTHENTICATED" };
  }
  if (input.actorUserId !== session.id) {
    return { status: "MISMATCH" };
  }

  try {
    const result = await getFrigoraService().lookupClientOperationAcceptance(
      createScope({
        userId: session.id,
        workspaceId: input.workspaceId,
        ventureId: input.ventureId,
      }),
      input,
    );
    return result;
  } catch (error) {
    if (
      isFrigoraError(error) &&
      (error.code === "forbidden" ||
        error.code === "not_found" ||
        error.code === "not_frigora" ||
        error.code === "invalid_input")
    ) {
      return { status: "MISMATCH" };
    }
    throw error;
  }
}
