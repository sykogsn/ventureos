export type OfflineExplicitSubmitState = {
  error?: string; code?: "auth_required" | "authority" | "idempotency_conflict" | "rejected" | "retryable" | "partition";
  acceptedEntityId?: string; receiptId?: string; duplicate?: boolean;
};
import type { FrigoraOfflineMutationEnvelope } from "./types";
import type { FrigoraOfflineStore } from "./store";
import { applyOfflineLocalSubmitOutcome } from "./offline-local-submit-outcome";

export function canExplicitlySubmitOffline(
  state: FrigoraOfflineMutationEnvelope["syncState"],
  online: boolean,
): boolean {
  return online && ["PENDING", "SYNCING", "RETRYABLE_FAILURE", "BLOCKED", "CONFLICT"].includes(state);
}

/** One invocation owns its result through reconciliation; renders never consume it. */
export async function submitOfflineFromClient(
  envelope: FrigoraOfflineMutationEnvelope,
  invoke: () => Promise<OfflineExplicitSubmitState>,
  onChanged: () => Promise<void>,
  store?: FrigoraOfflineStore,
): Promise<OfflineExplicitSubmitState> {
  let result: OfflineExplicitSubmitState;
  try {
    result = await invoke();
  } catch {
    // A lost response does not establish whether the server accepted the request.
    result = {
      code: "retryable",
      error: "Server acceptance could not be confirmed. Retry this saved operation to check or complete submission.",
    };
  }

  try {
    if (result.acceptedEntityId && result.receiptId) {
      await applyOfflineLocalSubmitOutcome(envelope, {
        ok: true,
        receiptId: result.receiptId,
        acceptedEntityId: result.acceptedEntityId,
      }, store);
    } else if (result.error && result.code) {
      await applyOfflineLocalSubmitOutcome(envelope, {
        ok: false,
        code: result.code,
        error: result.error,
      }, store);
    } else {
      throw new Error("Incomplete submission result");
    }
  } catch {
    // Keep the durable operation (including interrupted SYNCING) explicitly retryable.
    result = {
      ...result,
      error: "Could not update this device's submission status. Retry this saved operation to reconcile it with the server.",
    };
  }

  try {
    await onChanged();
  } catch {
    result = {
      ...result,
      error: "Could not refresh this device's operations. Reload to check the saved submission status.",
    };
  }
  return result;
}

/** The ref is claimed before any await, including before a second submit event. */
export async function saveOfflineOnce(
  inFlight: { current: boolean },
  save: () => Promise<void>,
): Promise<void> {
  if (inFlight.current) return;
  inFlight.current = true;
  try {
    await save();
  } finally {
    inFlight.current = false;
  }
}
