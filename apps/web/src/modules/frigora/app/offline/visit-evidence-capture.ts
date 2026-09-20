import { sha256HexOfBytes } from "@/modules/frigora/client-operation-fingerprint";
import {
  createClientOperationId,
  createEvidenceBlobRecord,
  openFrigoraOfflineStore,
  type FrigoraClientOperationId,
  type FrigoraOfflineEvidenceBlob,
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

export const FRIGORA_VISIT_EVIDENCE_OPERATION = "recordVisitEvidence" as const;

export type VisitEvidenceLocalPayload = {
  category: string;
  description?: string | null;
  originalFilename: string;
  mimeType: string;
  assetId?: string | null;
  bytes: ArrayBuffer;
};

export type CaptureVisitEvidenceOfflineInput = {
  partition: FrigoraOfflinePartition;
  workspaceId: string;
  workOrderId: string;
  visitId: string;
  payload: VisitEvidenceLocalPayload;
  clientOperationId?: FrigoraClientOperationId;
  syncState?: "LOCAL_DRAFT" | "PENDING";
};

export type CaptureVisitEvidenceOfflineResult = {
  envelope: FrigoraOfflineMutationEnvelope;
  blob: FrigoraOfflineEvidenceBlob;
  contentSha256: string;
};

/**
 * Local evidence capture: durable blob + outbox envelope linked by clientOperationId.
 * Never contacts the server. Does not extend the lease.
 * Success only after both metadata and bytes are persisted.
 */
export async function captureVisitEvidenceOffline(
  input: CaptureVisitEvidenceOfflineInput,
  store?: FrigoraOfflineStore,
): Promise<CaptureVisitEvidenceOfflineResult> {
  const offlineStore = store ?? (await openFrigoraOfflineStore());
  const lease = await offlineStore.getLease(input.partition);
  if (!lease || !isOfflineLeaseActive(lease)) {
    throw new Error("Active offline lease required for evidence capture.");
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

  const bytes = input.payload.bytes;
  if (!bytes || bytes.byteLength === 0) {
    throw new Error("Evidence bytes are required.");
  }
  if (input.payload.category === "OTHER") {
    const description = (input.payload.description ?? "").trim();
    if (!description) {
      throw new Error("OTHER evidence requires a description.");
    }
  }

  const clientOperationId =
    input.clientOperationId ?? createClientOperationId();
  const contentSha256 = sha256HexOfBytes(bytes);
  const blob = createEvidenceBlobRecord({
    clientOperationId,
    ventureId: input.partition.ventureId,
    actorUserId: input.partition.actorUserId,
    contentType: input.payload.mimeType,
    bytes,
    fileName: input.payload.originalFilename,
  });
  blob.lifecycle = "LINKED_TO_PENDING";

  let envelope: FrigoraOfflineMutationEnvelope;
  try {
    envelope = await offlineStore.enqueueEvidence({
      clientOperationId,
      ventureId: input.partition.ventureId,
      workspaceId: input.workspaceId,
      actorUserId: input.partition.actorUserId,
      workOrderId: input.workOrderId,
      visitId: input.visitId,
      operationType: FRIGORA_VISIT_EVIDENCE_OPERATION,
      payload: {
        category: input.payload.category,
        description: input.payload.description ?? null,
        originalFilename: input.payload.originalFilename,
        mimeType: input.payload.mimeType,
        byteLength: bytes.byteLength,
        contentSha256,
        blobId: blob.blobId,
        assetId: input.payload.assetId ?? null,
        userId: input.partition.actorUserId,
      },
      baseSnapshotId: workspace.snapshot.snapshotId,
      syncState: input.syncState ?? "PENDING",
    }, blob);
  } catch (error) {
    throw new Error(
      error instanceof Error
        ? `Evidence was NOT saved offline: ${error.message}`
        : "Evidence was NOT saved offline due to storage failure.",
    );
  }

  // A competing/tab retry may already own the operation. Never replace its payload or blob.
  const expected = {
    ventureId: input.partition.ventureId, actorUserId: input.partition.actorUserId,
    workspaceId: input.workspaceId, workOrderId: input.workOrderId, visitId: input.visitId,
    operationType: FRIGORA_VISIT_EVIDENCE_OPERATION,
  };
  for (const [key, value] of Object.entries(expected)) {
    if (envelope[key as keyof typeof envelope] !== value) throw new Error("Offline operation identity conflict.");
  }
  const payload = envelope.payload;
  if (payload.contentSha256 !== contentSha256 || payload.category !== input.payload.category ||
      payload.description !== (input.payload.description ?? null) || payload.assetId !== (input.payload.assetId ?? null) ||
      payload.originalFilename !== input.payload.originalFilename || payload.mimeType !== input.payload.mimeType) {
    throw new Error("Offline operation payload conflict.");
  }
  return { envelope, blob: await loadPersistedEvidenceBlobForSubmit(envelope, offlineStore), contentSha256 };
}

export async function listVisitEvidenceMutations(
  partition: FrigoraOfflinePartition,
  options?: { workOrderId?: string; visitId?: string },
  store?: FrigoraOfflineStore,
): Promise<FrigoraOfflineMutationEnvelope[]> {
  const offlineStore = store ?? (await openFrigoraOfflineStore());
  const all = await offlineStore.listMutations(partition);
  return all.filter((op) => {
    if (op.operationType !== FRIGORA_VISIT_EVIDENCE_OPERATION) return false;
    if (options?.workOrderId && op.workOrderId !== options.workOrderId) return false;
    if (options?.visitId && op.visitId !== options.visitId) return false;
    return true;
  });
}

export function createVisitEvidenceClientOperationId(): FrigoraClientOperationId {
  return createClientOperationId();
}

/**
 * Load the exact persisted blob for an evidence operation and verify digest/length.
 */
export async function loadPersistedEvidenceBlobForSubmit(
  envelope: FrigoraOfflineMutationEnvelope,
  store?: FrigoraOfflineStore,
): Promise<FrigoraOfflineEvidenceBlob> {
  const offlineStore = store ?? (await openFrigoraOfflineStore());
  const blobId = typeof envelope.payload.blobId === "string" ? envelope.payload.blobId : "";
  if (!blobId) {
    throw new Error("Pending evidence is missing blob linkage.");
  }
  const blob = await offlineStore.getEvidenceBlob(blobId);
  if (!blob) {
    throw new Error("Pending evidence bytes were not found on this device.");
  }
  if (envelope.operationType !== FRIGORA_VISIT_EVIDENCE_OPERATION ||
      blob.ventureId !== envelope.ventureId || blob.actorUserId !== envelope.actorUserId ||
      blob.clientOperationId !== envelope.clientOperationId ||
      !["LINKED_TO_PENDING", "AWAITING_SERVER_ACCEPTANCE", "SERVER_ACCEPTED"].includes(blob.lifecycle)) {
    throw new Error("Evidence blob is not linked to this pending operation.");
  }
  if (blob.contentType !== envelope.payload.mimeType || blob.fileName !== envelope.payload.originalFilename) {
    throw new Error("Evidence blob metadata does not match the queued operation.");
  }
  const expectedSha =
    typeof envelope.payload.contentSha256 === "string"
      ? envelope.payload.contentSha256.toLowerCase()
      : "";
  const expectedLen =
    typeof envelope.payload.byteLength === "number" ? envelope.payload.byteLength : -1;
  const actualSha = sha256HexOfBytes(blob.bytes);
  if (!/^[a-f0-9]{64}$/.test(expectedSha) || actualSha !== expectedSha) {
    throw new Error(
      "Persisted evidence bytes do not match the queued digest — submission blocked.",
    );
  }
  if (!Number.isSafeInteger(expectedLen) || expectedLen <= 0 ||
      blob.byteLength !== expectedLen || blob.bytes.byteLength !== expectedLen) {
    throw new Error(
      "Persisted evidence size does not match the queued operation — submission blocked.",
    );
  }
  return blob;
}

export async function markEvidenceBlobAwaitingAcceptance(
  blobId: string,
  store?: FrigoraOfflineStore,
): Promise<void> {
  const offlineStore = store ?? (await openFrigoraOfflineStore());
  const blob = await offlineStore.getEvidenceBlob(blobId);
  if (!blob) return;
  blob.lifecycle = "AWAITING_SERVER_ACCEPTANCE";
  await offlineStore.putEvidenceBlob(blob);
}

export async function markEvidenceBlobServerAccepted(
  blobId: string,
  store?: FrigoraOfflineStore,
): Promise<void> {
  const offlineStore = store ?? (await openFrigoraOfflineStore());
  const blob = await offlineStore.getEvidenceBlob(blobId);
  if (!blob) return;
  blob.lifecycle = "SERVER_ACCEPTED";
  await offlineStore.putEvidenceBlob(blob);
}
