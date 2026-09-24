import { isPendingSyncAttention } from "./sync-state";
import type {
  FrigoraOfflineMutationEnvelope,
  FrigoraOfflineQueueStatus,
} from "./types";

export function summarizeOfflineQueueStatus(input: {
  online: boolean;
  operations: readonly FrigoraOfflineMutationEnvelope[];
}): FrigoraOfflineQueueStatus {
  const pendingCount = input.operations.filter((op) => op.syncState === "PENDING").length;
  const syncingCount = input.operations.filter((op) => op.syncState === "SYNCING").length;
  const blockedCount = input.operations.filter((op) => op.syncState === "BLOCKED").length;
  const conflictCount = input.operations.filter((op) => op.syncState === "CONFLICT").length;
  const retryableFailureCount = input.operations.filter(
    (op) => op.syncState === "RETRYABLE_FAILURE",
  ).length;
  const syncedCount = input.operations.filter((op) => op.syncState === "SYNCED").length;
  const draftCount = input.operations.filter((op) => op.syncState === "LOCAL_DRAFT").length;
  const waiting =
    pendingCount + draftCount + retryableFailureCount + blockedCount + conflictCount;

  let label: FrigoraOfflineQueueStatus["label"];
  if (!input.online) {
    label = waiting > 0 ? "saved_on_device" : "offline";
  } else if (syncingCount > 0) {
    label = "syncing";
  } else if (blockedCount > 0 || conflictCount > 0) {
    label = "sync_blocked";
  } else if (retryableFailureCount > 0) {
    label = "sync_failed";
  } else if (waiting > 0) {
    label = "waiting_to_sync";
  } else if (syncedCount > 0 && waiting === 0 && syncingCount === 0) {
    label = "all_synced";
  } else {
    label = "online_idle";
  }

  return {
    online: input.online,
    pendingCount: pendingCount + draftCount,
    syncingCount,
    blockedCount,
    conflictCount,
    retryableFailureCount,
    syncedCount,
    label,
  };
}

export function countPendingUnsyncedOperations(
  operations: readonly FrigoraOfflineMutationEnvelope[],
): number {
  return operations.filter((op) => isPendingSyncAttention(op.syncState)).length;
}

export function hasPendingUnsyncedWork(
  operations: readonly FrigoraOfflineMutationEnvelope[],
): boolean {
  return countPendingUnsyncedOperations(operations) > 0;
}
