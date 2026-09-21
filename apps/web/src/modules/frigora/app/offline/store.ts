import { createId, nowIso } from "@/platform/ids";
import {
  createMemoryOfflineBackend,
  openDefaultOfflineBackend,
  openIndexedDbOfflineBackend,
  type FrigoraOfflineBackend,
  type OfflineRecord,
} from "./backend";
import { assertFieldSafeWorkspaceSnapshot } from "./commercial-guard";
import {
  assertOfflineLeaseActive,
  createOfflineLease,
  refuseOfflineLeaseSelfExtension,
} from "./lease";
import {
  assertPartitionMatch,
  belongsToPartition,
  offlinePartitionKey,
  offlineWorkspaceKey,
} from "./partition";
import { countPendingUnsyncedOperations, hasPendingUnsyncedWork } from "./status";
import {
  assertTransitionOfflineSyncState,
  transitionWithReceiptGuard,
} from "./sync-state";
import type { FieldSafeWorkspaceDraft } from "./preload-build";
import {
  createClientOperationId,
  FRIGORA_LOGOUT_PENDING_POLICY,
  type FrigoraClientOperationId,
  type FrigoraOfflineEvidenceBlob,
  type FrigoraOfflineLease,
  type FrigoraOfflineMutationEnvelope,
  type FrigoraOfflineOperationType,
  type FrigoraOfflinePartition,
  type FrigoraOfflineReceiptRecord,
  type FrigoraOfflineServerReceipt,
  type FrigoraOfflineSyncState,
  type FrigoraOfflineWorkspaceSnapshot,
  type LogoutPendingPolicy,
} from "./types";

function asRecord<T extends object>(value: OfflineRecord): T & { key: string } {
  return value as T & { key: string };
}

export type FrigoraOfflineStore = {
  readonly backendKind: FrigoraOfflineBackend["kind"];
  readonly dbName: string;
  readonly dbVersion: number;
  close(): void;

  putLease(lease: FrigoraOfflineLease): Promise<void>;
  getLease(partition: FrigoraOfflinePartition): Promise<FrigoraOfflineLease | undefined>;
  issueLease(partition: FrigoraOfflinePartition, nowMs?: number): Promise<FrigoraOfflineLease>;
  assertLeaseAllowsCapture(
    partition: FrigoraOfflinePartition,
    nowMs?: number,
  ): Promise<FrigoraOfflineLease>;
  /** Offline actions cannot extend lease — returns unchanged lease. */
  touchWithoutExtendingLease(lease: FrigoraOfflineLease): FrigoraOfflineLease;

  putWorkspaceSnapshot(snapshot: FrigoraOfflineWorkspaceSnapshot): Promise<void>;
  getWorkspaceSnapshot(
    partition: FrigoraOfflinePartition,
    workOrderId: string,
    visitId?: string,
  ): Promise<FrigoraOfflineWorkspaceSnapshot | undefined>;
  listWorkspaceSnapshots(
    partition: FrigoraOfflinePartition,
  ): Promise<FrigoraOfflineWorkspaceSnapshot[]>;

  enqueueMutation(
    input: Omit<
      FrigoraOfflineMutationEnvelope,
      "clientOperationId" | "createdAtLocal" | "syncState" | "attemptCount"
    > & {
      clientOperationId?: FrigoraClientOperationId;
      syncState?: FrigoraOfflineSyncState;
    },
  ): Promise<FrigoraOfflineMutationEnvelope>;
  enqueueEvidence(input: Parameters<FrigoraOfflineStore["enqueueMutation"]>[0], blob: FrigoraOfflineEvidenceBlob): Promise<FrigoraOfflineMutationEnvelope>;
  getMutation(
    clientOperationId: FrigoraClientOperationId,
  ): Promise<FrigoraOfflineMutationEnvelope | undefined>;
  listMutations(
    partition: FrigoraOfflinePartition,
  ): Promise<FrigoraOfflineMutationEnvelope[]>;
  updateMutationState(
    clientOperationId: FrigoraClientOperationId,
    to: FrigoraOfflineSyncState,
    options?: {
      serverAccepted?: boolean;
      lastAttemptAt?: string;
      serverReceipt?: FrigoraOfflineServerReceipt;
    },
  ): Promise<FrigoraOfflineMutationEnvelope>;
  /**
   * Retry keeps the same clientOperationId — never duplicates the local operation.
   */
  markRetry(
    clientOperationId: FrigoraClientOperationId,
  ): Promise<FrigoraOfflineMutationEnvelope>;
  deleteLocalUnsyncedMutation(
    partition: FrigoraOfflinePartition,
    clientOperationId: FrigoraClientOperationId,
  ): Promise<void>;

  putEvidenceBlob(blob: FrigoraOfflineEvidenceBlob): Promise<void>;
  getEvidenceBlob(blobId: string): Promise<FrigoraOfflineEvidenceBlob | undefined>;
  listEvidenceBlobs(
    partition: FrigoraOfflinePartition,
  ): Promise<FrigoraOfflineEvidenceBlob[]>;

  acceptEvidence(envelope: FrigoraOfflineMutationEnvelope, receipt: FrigoraOfflineReceiptRecord): Promise<FrigoraOfflineMutationEnvelope>;
  putReceipt(receipt: FrigoraOfflineReceiptRecord): Promise<void>;
  listReceipts(partition: FrigoraOfflinePartition): Promise<FrigoraOfflineReceiptRecord[]>;

  pendingUnsyncedCount(partition: FrigoraOfflinePartition): Promise<number>;
  hasPendingUnsynced(partition: FrigoraOfflinePartition): Promise<boolean>;
  logoutPendingPolicy(): LogoutPendingPolicy;

  /**
   * F33-02: persist field-safe drafts and issue/renew lease only after
   * the authenticated preload package is ready to commit.
   * Offline reads must not call this.
   */
  commitAuthenticatedPreload(
    partition: FrigoraOfflinePartition,
    drafts: FieldSafeWorkspaceDraft[],
    options?: { nowMs?: number; asOf?: string; generation?: number },
  ): Promise<{
    lease: FrigoraOfflineLease;
    snapshots: FrigoraOfflineWorkspaceSnapshot[];
  }>;
};

function leaseKey(partition: FrigoraOfflinePartition): string {
  return `lease::${offlinePartitionKey(partition)}`;
}

function mutationKey(clientOperationId: FrigoraClientOperationId): string {
  return `op::${clientOperationId}`;
}

function blobKey(blobId: string): string {
  return `blob::${blobId}`;
}

function receiptKey(receiptId: string): string {
  return `receipt::${receiptId}`;
}

function createStore(backend: FrigoraOfflineBackend): FrigoraOfflineStore {
  return {
    backendKind: backend.kind,
    dbName: backend.dbName,
    dbVersion: backend.dbVersion,
    close() {
      backend.close();
    },

    async putLease(lease) {
      await backend.put("leases", {
        key: leaseKey({
          ventureId: lease.ventureId,
          actorUserId: lease.actorUserId,
        }),
        ...lease,
      });
    },

    async getLease(partition) {
      const record = await backend.get("leases", leaseKey(partition));
      if (!record) return undefined;
      const lease = asRecord<FrigoraOfflineLease>(record);
      assertPartitionMatch(lease, partition);
      return lease;
    },

    async issueLease(partition, nowMs) {
      const lease = createOfflineLease(partition, { nowMs });
      await this.putLease(lease);
      return lease;
    },

    async assertLeaseAllowsCapture(partition, nowMs = Date.now()) {
      const lease = await this.getLease(partition);
      if (!lease) {
        throw new Error("No offline lease for partition");
      }
      assertOfflineLeaseActive(lease, nowMs);
      return lease;
    },

    touchWithoutExtendingLease(lease) {
      return refuseOfflineLeaseSelfExtension(lease);
    },

    async putWorkspaceSnapshot(snapshot) {
      assertFieldSafeWorkspaceSnapshot(snapshot);
      const key = offlineWorkspaceKey(
        { ventureId: snapshot.ventureId, actorUserId: snapshot.actorUserId },
        snapshot.workOrderId,
        snapshot.visitId,
      );
      await backend.put("workspaces", { key, ...snapshot });
    },

    async getWorkspaceSnapshot(partition, workOrderId, visitId) {
      const record = await backend.get(
        "workspaces",
        offlineWorkspaceKey(partition, workOrderId, visitId),
      );
      if (!record) return undefined;
      const snapshot = asRecord<FrigoraOfflineWorkspaceSnapshot>(record);
      assertPartitionMatch(snapshot, partition);
      return snapshot;
    },

    async listWorkspaceSnapshots(partition) {
      const all = await backend.getAll("workspaces");
      return all
        .map((record) => asRecord<FrigoraOfflineWorkspaceSnapshot>(record))
        .filter((snapshot) => belongsToPartition(snapshot, partition));
    },

    async enqueueMutation(input) {
      const clientOperationId = input.clientOperationId ?? createClientOperationId();
      const existing = await backend.get("outbox", mutationKey(clientOperationId));
      if (existing) {
        // Stable id: retry/reload must not create a second local operation.
        return asRecord<FrigoraOfflineMutationEnvelope>(existing);
      }
      const envelope: FrigoraOfflineMutationEnvelope = {
        clientOperationId,
        ventureId: input.ventureId,
        workspaceId: input.workspaceId,
        actorUserId: input.actorUserId,
        workOrderId: input.workOrderId,
        visitId: input.visitId,
        operationType: input.operationType,
        payload: input.payload,
        createdAtLocal: nowIso(),
        baseSnapshotId: input.baseSnapshotId,
        basePrecondition: input.basePrecondition,
        syncState: input.syncState ?? "PENDING",
        attemptCount: 0,
      };
      await backend.put("outbox", { key: mutationKey(clientOperationId), ...envelope });
      return envelope;
    },

    async enqueueEvidence(input, blob) {
      const envelope: FrigoraOfflineMutationEnvelope = {
        ...input, clientOperationId: blob.clientOperationId,
        createdAtLocal: nowIso(), syncState: input.syncState ?? "PENDING", attemptCount: 0,
      };
      const existing = await backend.atomicPut([
        { store: "evidence_blobs", record: { key: blobKey(blob.blobId), ...blob } },
        { store: "outbox", record: { key: mutationKey(blob.clientOperationId), ...envelope } },
      ], { store: "outbox", key: mutationKey(blob.clientOperationId) });
      return existing ? asRecord<FrigoraOfflineMutationEnvelope>(existing) : envelope;
    },

    async getMutation(clientOperationId) {
      const record = await backend.get("outbox", mutationKey(clientOperationId));
      return record ? asRecord<FrigoraOfflineMutationEnvelope>(record) : undefined;
    },

    async listMutations(partition) {
      const all = await backend.getAll("outbox");
      return all
        .map((record) => asRecord<FrigoraOfflineMutationEnvelope>(record))
        .filter((envelope) => belongsToPartition(envelope, partition));
    },

    async updateMutationState(clientOperationId, to, options) {
      const current = await this.getMutation(clientOperationId);
      if (!current) {
        throw new Error(`Unknown offline mutation ${clientOperationId}`);
      }
      if (current.syncState === to) {
        const canRefreshReason =
          to === "CONFLICT" ||
          to === "BLOCKED" ||
          to === "RETRYABLE_FAILURE" ||
          to === "SYNCED";
        if (!canRefreshReason || options?.serverReceipt === undefined) {
          throw new Error(`Illegal offline sync transition: ${current.syncState} → ${to}`);
        }
        const refreshed: FrigoraOfflineMutationEnvelope = {
          ...current,
          serverReceipt: options.serverReceipt,
          lastAttemptAt: options.lastAttemptAt ?? current.lastAttemptAt,
        };
        await backend.put("outbox", {
          key: mutationKey(clientOperationId),
          ...refreshed,
        });
        return refreshed;
      }
      const nextState = transitionWithReceiptGuard(current.syncState, to, {
        serverAccepted: options?.serverAccepted,
      });
      const updated: FrigoraOfflineMutationEnvelope = {
        ...current,
        syncState: nextState,
        attemptCount:
          to === "SYNCING" ? current.attemptCount + 1 : current.attemptCount,
        lastAttemptAt: options?.lastAttemptAt ?? current.lastAttemptAt,
        ...(options?.serverReceipt !== undefined
          ? { serverReceipt: options.serverReceipt }
          : {}),
      };
      await backend.put("outbox", {
        key: mutationKey(clientOperationId),
        ...updated,
      });
      return updated;
    },

    async markRetry(clientOperationId) {
      const current = await this.getMutation(clientOperationId);
      if (!current) {
        throw new Error(`Unknown offline mutation ${clientOperationId}`);
      }
      assertTransitionOfflineSyncState(current.syncState, "PENDING");
      const updated: FrigoraOfflineMutationEnvelope = {
        ...current,
        syncState: "PENDING",
        lastAttemptAt: nowIso(),
      };
      await backend.put("outbox", {
        key: mutationKey(clientOperationId),
        ...updated,
      });
      // Same clientOperationId retained — no second local operation.
      return updated;
    },

    async deleteLocalUnsyncedMutation(partition, clientOperationId) {
      const current = await this.getMutation(clientOperationId);
      if (!current) return;
      assertPartitionMatch(current, partition);
      if (current.syncState === "SYNCED") {
        throw new Error("Synced mutations cannot be deleted locally");
      }
      await backend.delete("outbox", mutationKey(clientOperationId));
    },

    async putEvidenceBlob(blob) {
      await backend.put("evidence_blobs", { key: blobKey(blob.blobId), ...blob });
    },

    async getEvidenceBlob(blobId) {
      const record = await backend.get("evidence_blobs", blobKey(blobId));
      return record ? asRecord<FrigoraOfflineEvidenceBlob>(record) : undefined;
    },

    async listEvidenceBlobs(partition) {
      const all = await backend.getAll("evidence_blobs");
      return all
        .map((record) => asRecord<FrigoraOfflineEvidenceBlob>(record))
        .filter((blob) => belongsToPartition(blob, partition));
    },

    async acceptEvidence(envelope, receipt) {
      const blob = await this.getEvidenceBlob(String(envelope.payload.blobId));
      if (!blob || blob.clientOperationId !== envelope.clientOperationId) throw new Error("Evidence blob missing");
      assertPartitionMatch(blob, envelope);
      const updated: FrigoraOfflineMutationEnvelope = { ...envelope, syncState: "SYNCED", lastAttemptAt: nowIso() };
      await backend.atomicPut([
        { store: "outbox", record: { key: mutationKey(envelope.clientOperationId), ...updated } },
        { store: "receipts", record: { key: receiptKey(receipt.receiptId), ...receipt } },
        { store: "evidence_blobs", record: { key: blobKey(blob.blobId), ...blob, lifecycle: "SERVER_ACCEPTED" } },
      ]);
      return updated;
    },

    async putReceipt(receipt) {
      await backend.put("receipts", { key: receiptKey(receipt.receiptId), ...receipt });
    },

    async listReceipts(partition) {
      const all = await backend.getAll("receipts");
      return all
        .map((record) => asRecord<FrigoraOfflineReceiptRecord>(record))
        .filter((receipt) => belongsToPartition(receipt, partition));
    },

    async pendingUnsyncedCount(partition) {
      const ops = await this.listMutations(partition);
      return countPendingUnsyncedOperations(ops);
    },

    async hasPendingUnsynced(partition) {
      const ops = await this.listMutations(partition);
      return hasPendingUnsyncedWork(ops);
    },

    logoutPendingPolicy() {
      return FRIGORA_LOGOUT_PENDING_POLICY;
    },

    async commitAuthenticatedPreload(partition, drafts, options) {
      const nowMs = options?.nowMs ?? Date.now();
      const asOf = options?.asOf ?? new Date(nowMs).toISOString();
      const generation = options?.generation ?? 1;
      const lease = createOfflineLease(partition, { nowMs });
      const snapshots: FrigoraOfflineWorkspaceSnapshot[] = drafts.map((draft) => {
        const snapshot: FrigoraOfflineWorkspaceSnapshot = {
          snapshotId: createId(),
          ventureId: partition.ventureId,
          actorUserId: partition.actorUserId,
          workOrderId: draft.workOrderId,
          visitId: draft.visitId,
          asOf,
          generation,
          leaseId: lease.leaseId,
          payload: draft.payload,
        };
        assertFieldSafeWorkspaceSnapshot(snapshot);
        return snapshot;
      });

      const writes: Array<{
        store: "leases" | "workspaces";
        record: OfflineRecord;
      }> = [
        { store: "leases", record: { key: leaseKey(partition), ...lease } },
        ...snapshots.map((snapshot) => ({
          store: "workspaces" as const,
          record: {
            key: offlineWorkspaceKey(
              partition,
              snapshot.workOrderId,
              // WO-scoped primary key for My Work / WO detail offline reads.
              undefined,
            ),
            ...snapshot,
          },
        })),
      ];

      // Also index by visit when present for Visit Recorder lookup.
      for (const snapshot of snapshots) {
        if (!snapshot.visitId) continue;
        writes.push({
          store: "workspaces",
          record: {
            key: offlineWorkspaceKey(partition, snapshot.workOrderId, snapshot.visitId),
            ...snapshot,
          },
        });
      }

      await backend.atomicPut(writes);
      return { lease, snapshots };
    },
  };
}

export async function openFrigoraOfflineStore(options?: {
  backend?: FrigoraOfflineBackend;
  preferMemory?: boolean;
}): Promise<FrigoraOfflineStore> {
  if (options?.backend) {
    return createStore(options.backend);
  }
  if (options?.preferMemory) {
    return createStore(createMemoryOfflineBackend());
  }
  return createStore(await openDefaultOfflineBackend());
}

export async function openFrigoraIndexedDbOfflineStore(): Promise<FrigoraOfflineStore> {
  return createStore(await openIndexedDbOfflineBackend());
}

export function createEvidenceBlobRecord(input: {
  clientOperationId: FrigoraClientOperationId;
  ventureId: string;
  actorUserId: string;
  contentType: string;
  bytes: ArrayBuffer;
  fileName?: string;
}): FrigoraOfflineEvidenceBlob {
  return {
    blobId: createId(),
    clientOperationId: input.clientOperationId,
    ventureId: input.ventureId,
    actorUserId: input.actorUserId,
    contentType: input.contentType,
    fileName: input.fileName,
    byteLength: input.bytes.byteLength,
    createdAtLocal: nowIso(),
    lifecycle: "LOCAL_ONLY",
    bytes: input.bytes,
  };
}

export type { FrigoraOfflineOperationType };
