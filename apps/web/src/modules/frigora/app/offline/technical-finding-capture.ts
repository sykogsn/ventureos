import { nowIso } from "@/platform/ids";
import {
  createClientOperationId,
  openFrigoraOfflineStore,
  type FrigoraClientOperationId,
  type FrigoraOfflineMutationEnvelope,
  type FrigoraOfflinePartition,
  type FrigoraOfflineStore,
} from "@/modules/frigora/app/offline";
import {
  assertOfflineLeaseActive,
  isOfflineLeaseActive,
  refuseOfflineLeaseSelfExtension,
} from "@/modules/frigora/app/offline/lease";
import { readOfflineWorkspaceSnapshot } from "@/modules/frigora/app/offline/offline-read";

export const FRIGORA_TECHNICAL_FINDING_OPERATION = "recordTechnicalFinding" as const;

export type TechnicalFindingLocalPayload = {
  findingKind: "symptom" | "suspected_fault" | "confirmed_fault";
  description: string;
  assertedAt: string;
  assetId?: string | null;
  sourceFieldCaptureIds?: string[];
};

export type CaptureTechnicalFindingOfflineInput = {
  partition: FrigoraOfflinePartition;
  workspaceId: string;
  workOrderId: string;
  visitId: string;
  payload: TechnicalFindingLocalPayload;
  clientOperationId?: FrigoraClientOperationId;
  syncState?: "LOCAL_DRAFT" | "PENDING";
};

/**
 * Local capture only. Never contacts the server.
 * Does not extend the offline lease.
 */
export async function captureTechnicalFindingOffline(
  input: CaptureTechnicalFindingOfflineInput,
  store?: FrigoraOfflineStore,
): Promise<FrigoraOfflineMutationEnvelope> {
  const offlineStore = store ?? (await openFrigoraOfflineStore());
  const lease = await offlineStore.getLease(input.partition);
  if (!lease || !isOfflineLeaseActive(lease)) {
    throw new Error("Active offline lease required for technical finding capture.");
  }
  assertOfflineLeaseActive(lease);
  refuseOfflineLeaseSelfExtension(lease);

  const workspace = await readOfflineWorkspaceSnapshot(
    offlineStore,
    input.partition,
    input.workOrderId,
    { visitId: input.visitId },
  );
  if (workspace.status !== "AVAILABLE" || !workspace.snapshot) {
    throw new Error("Preloaded WorkOrder/Visit context required for offline capture.");
  }

  const description = input.payload.description.trim();
  if (!description) {
    throw new Error("Description is required.");
  }

  return offlineStore.enqueueMutation({
    clientOperationId: input.clientOperationId,
    ventureId: input.partition.ventureId,
    workspaceId: input.workspaceId,
    actorUserId: input.partition.actorUserId,
    workOrderId: input.workOrderId,
    visitId: input.visitId,
    operationType: FRIGORA_TECHNICAL_FINDING_OPERATION,
    payload: {
      findingKind: input.payload.findingKind,
      description,
      assertedAt: input.payload.assertedAt || nowIso(),
      assetId: input.payload.assetId ?? null,
      sourceFieldCaptureIds: input.payload.sourceFieldCaptureIds ?? null,
      userId: input.partition.actorUserId,
    },
    baseSnapshotId: workspace.snapshot.snapshotId,
    syncState: input.syncState ?? "PENDING",
  });
}

export async function listTechnicalFindingMutations(
  partition: FrigoraOfflinePartition,
  options?: { workOrderId?: string; visitId?: string },
  store?: FrigoraOfflineStore,
): Promise<FrigoraOfflineMutationEnvelope[]> {
  const offlineStore = store ?? (await openFrigoraOfflineStore());
  const all = await offlineStore.listMutations(partition);
  return all.filter((op) => {
    if (op.operationType !== FRIGORA_TECHNICAL_FINDING_OPERATION) return false;
    if (options?.workOrderId && op.workOrderId !== options.workOrderId) return false;
    if (options?.visitId && op.visitId !== options.visitId) return false;
    return true;
  });
}

export function createTechnicalFindingClientOperationId(): FrigoraClientOperationId {
  return createClientOperationId();
}
