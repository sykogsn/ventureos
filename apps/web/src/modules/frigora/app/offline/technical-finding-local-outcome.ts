import {
  openFrigoraOfflineStore,
  type FrigoraOfflineMutationEnvelope,
  type FrigoraOfflineStore,
} from "@/modules/frigora/app/offline";

export type TechnicalFindingLocalSubmitOutcome =
  | { ok: true; receiptId: string; acceptedEntityId: string }
  | {
      ok: false;
      code: "auth_required" | "authority" | "idempotency_conflict" | "rejected" | "retryable" | "partition";
      error: string;
    };

/**
 * Applies an explicit submit attempt result to the local outbox envelope.
 * Used by the visit-recorder UX and focused F33-03 lifecycle evidence.
 * Never invents a new clientOperationId.
 */
export async function applyTechnicalFindingLocalSubmitOutcome(
  envelope: FrigoraOfflineMutationEnvelope,
  outcome: TechnicalFindingLocalSubmitOutcome,
  store?: FrigoraOfflineStore,
): Promise<FrigoraOfflineMutationEnvelope | undefined> {
  const offlineStore = store ?? (await openFrigoraOfflineStore());
  const current = await offlineStore.getMutation(envelope.clientOperationId);
  if (!current || current.syncState === "SYNCED") {
    return current;
  }

  let working = current;
  if (
    working.syncState === "RETRYABLE_FAILURE" ||
    working.syncState === "BLOCKED" ||
    working.syncState === "CONFLICT"
  ) {
    working = await offlineStore.markRetry(envelope.clientOperationId);
  }
  if (working.syncState === "PENDING") {
    working = await offlineStore.updateMutationState(envelope.clientOperationId, "SYNCING");
  }

  if (outcome.ok) {
    const recordedAt = new Date().toISOString();
    await offlineStore.putReceipt({
      receiptId: outcome.receiptId,
      clientOperationId: envelope.clientOperationId,
      ventureId: envelope.ventureId,
      actorUserId: envelope.actorUserId,
      recordedAt,
      kind: "accepted",
      detail: outcome.acceptedEntityId,
    });
    return offlineStore.updateMutationState(envelope.clientOperationId, "SYNCED", {
      serverAccepted: true,
      lastAttemptAt: recordedAt,
      serverReceipt: { accepted: true, recordedAt },
    });
  }

  const next =
    outcome.code === "retryable"
      ? "RETRYABLE_FAILURE"
      : outcome.code === "auth_required"
        ? "BLOCKED"
        : "CONFLICT";

  const recordedAt = new Date().toISOString();
  await offlineStore.putReceipt({
    receiptId: `reject-${envelope.clientOperationId}-${Date.now()}`,
    clientOperationId: envelope.clientOperationId,
    ventureId: envelope.ventureId,
    actorUserId: envelope.actorUserId,
    recordedAt,
    kind:
      next === "RETRYABLE_FAILURE" ? "retryable" : next === "CONFLICT" ? "conflict" : "rejected",
    detail: outcome.error,
  });
  return offlineStore.updateMutationState(envelope.clientOperationId, next, {
    lastAttemptAt: recordedAt,
    serverReceipt: {
      accepted: false,
      recordedAt,
      serverErrorCode: outcome.code,
      serverMessage: outcome.error,
    },
  });
}

/**
 * Explicit retry preparation: RETRYABLE_FAILURE|BLOCKED|CONFLICT → PENDING.
 * Reuses the same clientOperationId.
 */
export async function prepareTechnicalFindingExplicitRetry(
  clientOperationId: FrigoraOfflineMutationEnvelope["clientOperationId"],
  store?: FrigoraOfflineStore,
): Promise<FrigoraOfflineMutationEnvelope> {
  const offlineStore = store ?? (await openFrigoraOfflineStore());
  const current = await offlineStore.getMutation(clientOperationId);
  if (!current) {
    throw new Error(`Unknown offline mutation ${clientOperationId}`);
  }
  if (current.syncState === "PENDING") {
    return current;
  }
  return offlineStore.markRetry(clientOperationId);
}
