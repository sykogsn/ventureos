import {
  openFrigoraOfflineStore,
  type FrigoraOfflineMutationEnvelope,
  type FrigoraOfflineStore,
} from "@/modules/frigora/app/offline";

export type OfflineLocalSubmitOutcome =
  | { ok: true; receiptId: string; acceptedEntityId: string }
  | {
      ok: false;
      code: "auth_required" | "authority" | "idempotency_conflict" | "rejected" | "retryable" | "partition";
      error: string;
    };

/**
 * Applies an explicit submit attempt result to the local outbox envelope.
 * Never invents a new clientOperationId.
 */
export async function applyOfflineLocalSubmitOutcome(
  envelope: FrigoraOfflineMutationEnvelope,
  outcome: OfflineLocalSubmitOutcome,
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

  if (outcome.ok && working.operationType === "recordVisitEvidence") {
    return offlineStore.acceptEvidence(working, {
      receiptId: outcome.receiptId, clientOperationId: working.clientOperationId,
      ventureId: working.ventureId, actorUserId: working.actorUserId,
      recordedAt: new Date().toISOString(), kind: "accepted", detail: outcome.acceptedEntityId,
    });
  }

  if (outcome.ok) {
    await offlineStore.putReceipt({
      receiptId: outcome.receiptId,
      clientOperationId: envelope.clientOperationId,
      ventureId: envelope.ventureId,
      actorUserId: envelope.actorUserId,
      recordedAt: new Date().toISOString(),
      kind: "accepted",
      detail: outcome.acceptedEntityId,
    });
    return offlineStore.updateMutationState(envelope.clientOperationId, "SYNCED", {
      serverAccepted: true,
      lastAttemptAt: new Date().toISOString(),
    });
  }

  const next =
    outcome.code === "retryable"
      ? "RETRYABLE_FAILURE"
      : outcome.code === "auth_required"
        ? "BLOCKED"
        : "CONFLICT";

  await offlineStore.putReceipt({
    receiptId: `reject-${envelope.clientOperationId}-${Date.now()}`,
    clientOperationId: envelope.clientOperationId,
    ventureId: envelope.ventureId,
    actorUserId: envelope.actorUserId,
    recordedAt: new Date().toISOString(),
    kind:
      next === "RETRYABLE_FAILURE" ? "retryable" : next === "CONFLICT" ? "conflict" : "rejected",
    detail: outcome.error,
  });
  return offlineStore.updateMutationState(envelope.clientOperationId, next, {
    lastAttemptAt: new Date().toISOString(),
  });
}

export async function prepareOfflineExplicitRetry(
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
