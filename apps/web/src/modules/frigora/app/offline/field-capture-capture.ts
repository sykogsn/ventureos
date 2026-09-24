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

export const FRIGORA_FIELD_CAPTURE_OPERATION = "recordFieldCapture" as const;

export type FieldCaptureLocalPayload = {
  captureKind: "measurement" | "condition";
  captureCode: string;
  valueNumeric?: number | null;
  valueUnit?: string | null;
  description?: string | null;
  observedAt: string;
  assetId?: string | null;
};

export type CaptureFieldCaptureOfflineInput = {
  partition: FrigoraOfflinePartition;
  workspaceId: string;
  workOrderId: string;
  visitId: string;
  payload: FieldCaptureLocalPayload;
  clientOperationId?: FrigoraClientOperationId;
  syncState?: "LOCAL_DRAFT" | "PENDING";
};

/**
 * Local capture only. Never contacts the server.
 * Does not extend the offline lease.
 */
export async function captureFieldCaptureOffline(
  input: CaptureFieldCaptureOfflineInput,
  store?: FrigoraOfflineStore,
): Promise<FrigoraOfflineMutationEnvelope> {
  const offlineStore = store ?? (await openFrigoraOfflineStore());
  const lease = await offlineStore.getLease(input.partition);
  if (!lease || !isOfflineLeaseActive(lease)) {
    throw new Error("Active offline lease required for field capture.");
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

  if (input.payload.captureKind === "measurement") {
    if (input.payload.valueNumeric == null || !input.payload.valueUnit) {
      throw new Error("Measurement captures require a numeric value and unit.");
    }
  }
  if (input.payload.captureKind === "condition") {
    const description = (input.payload.description ?? "").trim();
    if (!description) {
      throw new Error("Condition captures require a description.");
    }
  }

  return offlineStore.enqueueMutation({
    clientOperationId: input.clientOperationId,
    ventureId: input.partition.ventureId,
    workspaceId: input.workspaceId,
    actorUserId: input.partition.actorUserId,
    workOrderId: input.workOrderId,
    visitId: input.visitId,
    operationType: FRIGORA_FIELD_CAPTURE_OPERATION,
    payload: {
      captureKind: input.payload.captureKind,
      captureCode: input.payload.captureCode,
      valueNumeric: input.payload.valueNumeric ?? null,
      valueUnit: input.payload.valueUnit ?? null,
      description: input.payload.description ?? null,
      observedAt: input.payload.observedAt || nowIso(),
      assetId: input.payload.assetId ?? null,
      userId: input.partition.actorUserId,
    },
    baseSnapshotId: workspace.snapshot.snapshotId,
    syncState: input.syncState ?? "PENDING",
  });
}

export async function listFieldCaptureMutations(
  partition: FrigoraOfflinePartition,
  options?: { workOrderId?: string; visitId?: string },
  store?: FrigoraOfflineStore,
): Promise<FrigoraOfflineMutationEnvelope[]> {
  const offlineStore = store ?? (await openFrigoraOfflineStore());
  const all = await offlineStore.listMutations(partition);
  return all.filter((op) => {
    if (op.operationType !== FRIGORA_FIELD_CAPTURE_OPERATION) return false;
    if (options?.workOrderId && op.workOrderId !== options.workOrderId) return false;
    if (options?.visitId && op.visitId !== options.visitId) return false;
    return true;
  });
}

export function createFieldCaptureClientOperationId(): FrigoraClientOperationId {
  return createClientOperationId();
}
