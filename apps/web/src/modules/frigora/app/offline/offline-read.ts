import { isOfflineLeaseActive } from "./lease";
import {
  assertPartitionMatch,
  belongsToPartition,
} from "./partition";
import type { FrigoraOfflineStore } from "./store";
import type {
  FrigoraOfflineLease,
  FrigoraOfflinePartition,
  FrigoraOfflineWorkspaceSnapshot,
} from "./types";

export type OfflineWorkspaceReadStatus =
  | "AVAILABLE"
  | "EXPIRED"
  | "MISSING"
  | "WRONG_PARTITION";

export type OfflineWorkspaceReadResult =
  | {
      status: "AVAILABLE";
      lease: FrigoraOfflineLease;
      snapshot: FrigoraOfflineWorkspaceSnapshot;
    }
  | {
      status: "EXPIRED";
      lease: FrigoraOfflineLease;
      snapshot?: FrigoraOfflineWorkspaceSnapshot;
    }
  | {
      status: "MISSING";
    }
  | {
      status: "WRONG_PARTITION";
    };

/**
 * Offline read helper. Never renews or mutates the lease.
 */
export async function readOfflineWorkspaceSnapshot(
  store: FrigoraOfflineStore,
  partition: FrigoraOfflinePartition,
  workOrderId: string,
  options?: { visitId?: string; nowMs?: number },
): Promise<OfflineWorkspaceReadResult> {
  const nowMs = options?.nowMs ?? Date.now();
  const lease = await store.getLease(partition);
  if (!lease) {
    return { status: "MISSING" };
  }
  if (!belongsToPartition(lease, partition)) {
    return { status: "WRONG_PARTITION" };
  }

  let snapshot = await store.getWorkspaceSnapshot(
    partition,
    workOrderId,
    options?.visitId,
  );
  // Prefer WO-scoped snapshot when visit-keyed miss (F33-02 stores WO key primarily).
  if (!snapshot && options?.visitId) {
    snapshot = await store.getWorkspaceSnapshot(partition, workOrderId);
  }

  if (!isOfflineLeaseActive(lease, nowMs)) {
    return { status: "EXPIRED", lease, snapshot };
  }
  if (!snapshot) {
    return { status: "MISSING" };
  }
  try {
    assertPartitionMatch(snapshot, partition);
  } catch {
    return { status: "WRONG_PARTITION" };
  }

  // Explicitly do not touch/extend lease on read.
  store.touchWithoutExtendingLease(lease);
  return { status: "AVAILABLE", lease, snapshot };
}

export async function listAvailableOfflineWorkspaces(
  store: FrigoraOfflineStore,
  partition: FrigoraOfflinePartition,
  nowMs: number = Date.now(),
): Promise<{
  status: OfflineWorkspaceReadStatus;
  lease?: FrigoraOfflineLease;
  snapshots: FrigoraOfflineWorkspaceSnapshot[];
}> {
  const lease = await store.getLease(partition);
  if (!lease) {
    return { status: "MISSING", snapshots: [] };
  }
  if (!belongsToPartition(lease, partition)) {
    return { status: "WRONG_PARTITION", snapshots: [] };
  }
  const snapshots = await store.listWorkspaceSnapshots(partition);
  if (!isOfflineLeaseActive(lease, nowMs)) {
    return { status: "EXPIRED", lease, snapshots };
  }
  store.touchWithoutExtendingLease(lease);
  return { status: "AVAILABLE", lease, snapshots };
}
