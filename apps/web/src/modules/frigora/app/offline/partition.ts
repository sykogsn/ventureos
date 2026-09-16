import type { FrigoraOfflinePartition } from "./types";

export function offlinePartitionKey(partition: FrigoraOfflinePartition): string {
  return `${partition.ventureId}::${partition.actorUserId}`;
}

export function offlineWorkspaceKey(
  partition: FrigoraOfflinePartition,
  workOrderId: string,
  visitId?: string,
): string {
  const base = `${offlinePartitionKey(partition)}::${workOrderId}`;
  return visitId ? `${base}::${visitId}` : base;
}

export function assertPartitionMatch(
  record: { ventureId: string; actorUserId: string },
  partition: FrigoraOfflinePartition,
): void {
  if (
    record.ventureId !== partition.ventureId ||
    record.actorUserId !== partition.actorUserId
  ) {
    throw new Error("Offline store partition mismatch");
  }
}

export function belongsToPartition(
  record: { ventureId: string; actorUserId: string },
  partition: FrigoraOfflinePartition,
): boolean {
  return (
    record.ventureId === partition.ventureId &&
    record.actorUserId === partition.actorUserId
  );
}
