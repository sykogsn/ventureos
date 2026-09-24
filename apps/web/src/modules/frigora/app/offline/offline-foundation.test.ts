import assert from "node:assert/strict";
import { describe, it, beforeEach } from "node:test";
import {
  assertFieldSafeWorkspaceSnapshot,
  assertTransitionOfflineSyncState,
  canTransitionOfflineSyncState,
  countPendingUnsyncedOperations,
  createClientOperationId,
  createEvidenceBlobRecord,
  createMemoryOfflineBackend,
  createOfflineLease,
  FRIGORA_FIELD_FORMS_OFFLINE_CAPTURE_ENABLED,
  FRIGORA_LOGOUT_PENDING_POLICY,
  FRIGORA_OFFLINE_DB_NAME,
  FRIGORA_OFFLINE_DB_VERSION,
  FRIGORA_OFFLINE_FORBIDDEN_COMMERCIAL_KEYS,
  FRIGORA_OFFLINE_LEASE_MS,
  FRIGORA_OFFLINE_OBJECT_STORES,
  hasPendingUnsyncedWork,
  isOfflineLeaseActive,
  offlinePartitionKey,
  offlineWorkspaceKey,
  openFrigoraOfflineStore,
  refuseOfflineLeaseSelfExtension,
  resetMemoryOfflineDatabasesForTests,
  summarizeOfflineQueueStatus,
  transitionWithReceiptGuard,
  type FrigoraOfflineMutationEnvelope,
  type FrigoraOfflinePartition,
  type FrigoraOfflineWorkspaceSnapshot,
} from "./index";
import { shouldBlockFrigoraFieldMutation } from "@/modules/frigora/app/pwa/connectivity";

const partitionA: FrigoraOfflinePartition = {
  ventureId: "ven-a",
  actorUserId: "user-a",
};
const partitionB: FrigoraOfflinePartition = {
  ventureId: "ven-a",
  actorUserId: "user-b",
};

function sampleSnapshot(
  overrides?: Partial<FrigoraOfflineWorkspaceSnapshot>,
): FrigoraOfflineWorkspaceSnapshot {
  return {
    snapshotId: "snap-1",
    ventureId: partitionA.ventureId,
    actorUserId: partitionA.actorUserId,
    workOrderId: "wo-1",
    visitId: "vis-1",
    asOf: "2026-09-16T00:00:00.000Z",
    generation: 1,
    leaseId: "lease-1",
    payload: {
      workOrder: { id: "wo-1", status: "open", reference: "WO-1" },
      visit: { id: "vis-1", status: "open" },
      partReferences: [{ id: "part-1", code: "FILT-01", name: "Filter" }],
    },
    ...overrides,
  };
}

describe("Frigora F33-01 offline foundation", () => {
  beforeEach(() => {
    resetMemoryOfflineDatabasesForTests();
  });

  it("declares IndexedDB schema version and logical stores", () => {
    assert.equal(FRIGORA_OFFLINE_DB_NAME, "frigora-offline");
    assert.equal(FRIGORA_OFFLINE_DB_VERSION, 1);
    assert.deepEqual(
      [...FRIGORA_OFFLINE_OBJECT_STORES],
      ["workspaces", "outbox", "evidence_blobs", "receipts", "leases"],
    );
  });

  it("creates a durable memory-backed store and survives reopen", async () => {
    const first = await openFrigoraOfflineStore({
      backend: createMemoryOfflineBackend(),
    });
    assert.equal(first.backendKind, "memory");
    assert.equal(first.dbVersion, 1);
    await first.putWorkspaceSnapshot(sampleSnapshot());
    first.close();

    const second = await openFrigoraOfflineStore({
      backend: createMemoryOfflineBackend(),
    });
    const loaded = await second.getWorkspaceSnapshot(partitionA, "wo-1", "vis-1");
    assert.equal(loaded?.snapshotId, "snap-1");
    assert.equal(loaded?.payload.workOrder?.status, "open");
  });

  it("writes and reads leases, mutations, blobs, and receipts", async () => {
    const store = await openFrigoraOfflineStore({ preferMemory: true });
    const lease = await store.issueLease(partitionA, Date.parse("2026-09-16T12:00:00.000Z"));
    assert.equal(lease.ventureId, "ven-a");
    assert.equal(
      Date.parse(lease.expiresAt) - Date.parse(lease.issuedAt),
      FRIGORA_OFFLINE_LEASE_MS,
    );

    const op = await store.enqueueMutation({
      ventureId: partitionA.ventureId,
      actorUserId: partitionA.actorUserId,
      workOrderId: "wo-1",
      visitId: "vis-1",
      operationType: "recordTechnicalFinding",
      payload: { findingType: "symptom", notes: "noisy compressor" },
    });
    assert.ok(op.clientOperationId);
    assert.equal(op.syncState, "PENDING");

    const sameId = op.clientOperationId;
    const again = await store.enqueueMutation({
      clientOperationId: sameId,
      ventureId: partitionA.ventureId,
      actorUserId: partitionA.actorUserId,
      workOrderId: "wo-1",
      operationType: "recordTechnicalFinding",
      payload: { findingType: "symptom", notes: "should not duplicate" },
    });
    assert.equal(again.clientOperationId, sameId);
    assert.equal(again.payload.notes, "noisy compressor");

    const bytes = new TextEncoder().encode("photo-bytes").buffer;
    const blob = createEvidenceBlobRecord({
      clientOperationId: sameId,
      ventureId: partitionA.ventureId,
      actorUserId: partitionA.actorUserId,
      contentType: "image/jpeg",
      fileName: "evidence.jpg",
      bytes,
    });
    await store.putEvidenceBlob(blob);
    const loadedBlob = await store.getEvidenceBlob(blob.blobId);
    assert.equal(loadedBlob?.byteLength, bytes.byteLength);
    assert.equal(loadedBlob?.fileName, "evidence.jpg");

    await store.putReceipt({
      receiptId: "rcpt-1",
      clientOperationId: sameId,
      ventureId: partitionA.ventureId,
      actorUserId: partitionA.actorUserId,
      recordedAt: "2026-09-16T12:01:00.000Z",
      kind: "accepted",
    });
    assert.equal((await store.listReceipts(partitionA)).length, 1);
  });

  it("applies atomic multi-store writes", async () => {
    const backend = createMemoryOfflineBackend({ dbName: "atomic-test" });
    const store = await openFrigoraOfflineStore({ backend });
    const opId = createClientOperationId();
    await backend.atomicPut([
      {
        store: "outbox",
        record: {
          key: `op::${opId}`,
          clientOperationId: opId,
          ventureId: partitionA.ventureId,
          actorUserId: partitionA.actorUserId,
          workOrderId: "wo-1",
          operationType: "recordFieldCapture",
          payload: { notes: "atomic" },
          createdAtLocal: "2026-09-16T12:00:00.000Z",
          syncState: "PENDING",
          attemptCount: 0,
        },
      },
      {
        store: "receipts",
        record: {
          key: "receipt::r1",
          receiptId: "r1",
          clientOperationId: opId,
          ventureId: partitionA.ventureId,
          actorUserId: partitionA.actorUserId,
          recordedAt: "2026-09-16T12:00:00.000Z",
          kind: "accepted",
        },
      },
    ]);
    assert.ok(await store.getMutation(opId));
    assert.equal((await store.listReceipts(partitionA)).length, 1);
  });

  it("partitions by venture and actor and isolates cross-user data", async () => {
    const store = await openFrigoraOfflineStore({ preferMemory: true });
    await store.putWorkspaceSnapshot(sampleSnapshot());
    await store.putWorkspaceSnapshot(
      sampleSnapshot({
        snapshotId: "snap-b",
        actorUserId: partitionB.actorUserId,
        leaseId: "lease-b",
      }),
    );
    assert.equal(offlinePartitionKey(partitionA), "ven-a::user-a");
    assert.equal(
      offlineWorkspaceKey(partitionA, "wo-1", "vis-1"),
      "ven-a::user-a::wo-1::vis-1",
    );
    assert.equal((await store.listWorkspaceSnapshots(partitionA)).length, 1);
    assert.equal((await store.listWorkspaceSnapshots(partitionB)).length, 1);
    assert.equal(
      (await store.listWorkspaceSnapshots(partitionA))[0]?.actorUserId,
      "user-a",
    );
  });

  it("keeps clientOperationId stable and rejects illegal sync transitions", async () => {
    const id = createClientOperationId();
    assert.match(id, /^[0-9a-f-]{36}$/i);
    assert.equal(canTransitionOfflineSyncState("PENDING", "SYNCING"), true);
    assert.equal(canTransitionOfflineSyncState("SYNCED", "PENDING"), false);
    assert.throws(() => assertTransitionOfflineSyncState("SYNCED", "PENDING"));
    assert.throws(() =>
      transitionWithReceiptGuard("SYNCING", "SYNCED", { serverAccepted: false }),
    );
    assert.equal(
      transitionWithReceiptGuard("SYNCING", "SYNCED", { serverAccepted: true }),
      "SYNCED",
    );

    const store = await openFrigoraOfflineStore({ preferMemory: true });
    const op = await store.enqueueMutation({
      clientOperationId: id,
      ventureId: partitionA.ventureId,
      actorUserId: partitionA.actorUserId,
      workOrderId: "wo-1",
      operationType: "recordPartUsage",
      payload: { partName: "Filter", quantity: 1 },
    });
    await store.updateMutationState(op.clientOperationId, "SYNCING");
    await assert.rejects(() =>
      store.updateMutationState(op.clientOperationId, "SYNCED"),
    );
    const synced = await store.updateMutationState(op.clientOperationId, "SYNCED", {
      serverAccepted: true,
    });
    assert.equal(synced.syncState, "SYNCED");
  });

  it("retries without creating a second local operation", async () => {
    const store = await openFrigoraOfflineStore({ preferMemory: true });
    const op = await store.enqueueMutation({
      ventureId: partitionA.ventureId,
      actorUserId: partitionA.actorUserId,
      workOrderId: "wo-1",
      operationType: "recordCorrectiveAction",
      payload: { notes: "tightened belt" },
    });
    await store.updateMutationState(op.clientOperationId, "SYNCING");
    await store.updateMutationState(op.clientOperationId, "RETRYABLE_FAILURE");
    const retried = await store.markRetry(op.clientOperationId);
    assert.equal(retried.clientOperationId, op.clientOperationId);
    assert.equal(retried.syncState, "PENDING");
    assert.equal((await store.listMutations(partitionA)).length, 1);
  });

  it("models the 12-hour offline lease and forbids self-extension", async () => {
    const issuedAtMs = Date.parse("2026-09-16T10:00:00.000Z");
    const lease = createOfflineLease(partitionA, { nowMs: issuedAtMs });
    assert.equal(isOfflineLeaseActive(lease, issuedAtMs + 1), true);
    assert.equal(
      isOfflineLeaseActive(lease, issuedAtMs + FRIGORA_OFFLINE_LEASE_MS + 1),
      false,
    );
    const refused = refuseOfflineLeaseSelfExtension(lease);
    assert.equal(refused.expiresAt, lease.expiresAt);

    const store = await openFrigoraOfflineStore({ preferMemory: true });
    await store.putLease(lease);
    await store.assertLeaseAllowsCapture(partitionA, issuedAtMs + 1000);
    await assert.rejects(() =>
      store.assertLeaseAllowsCapture(partitionA, issuedAtMs + FRIGORA_OFFLINE_LEASE_MS + 1),
    );
    assert.equal(store.touchWithoutExtendingLease(lease).expiresAt, lease.expiresAt);
  });

  it("detects pending unsynced work for logout policy primitives", async () => {
    const store = await openFrigoraOfflineStore({ preferMemory: true });
    assert.equal(store.logoutPendingPolicy(), FRIGORA_LOGOUT_PENDING_POLICY);
    assert.equal(FRIGORA_LOGOUT_PENDING_POLICY.allowCasualDestructiveDiscard, false);
    assert.equal(await store.hasPendingUnsynced(partitionA), false);

    await store.enqueueMutation({
      ventureId: partitionA.ventureId,
      actorUserId: partitionA.actorUserId,
      workOrderId: "wo-1",
      operationType: "recordVisitOutcome",
      payload: { outcome: "restored" },
    });
    assert.equal(await store.hasPendingUnsynced(partitionA), true);
    assert.equal(await store.pendingUnsyncedCount(partitionA), 1);

    const ops: FrigoraOfflineMutationEnvelope[] = await store.listMutations(partitionA);
    assert.equal(countPendingUnsyncedOperations(ops), 1);
    assert.equal(hasPendingUnsyncedWork(ops), true);
    assert.equal(
      summarizeOfflineQueueStatus({ online: false, operations: ops }).label,
      "saved_on_device",
    );
  });

  it("rejects commercial fields from offline workspace snapshots", () => {
    assert.ok(FRIGORA_OFFLINE_FORBIDDEN_COMMERCIAL_KEYS.includes("unitChargeCents"));
    assert.throws(() =>
      assertFieldSafeWorkspaceSnapshot(
        sampleSnapshot({
          payload: {
            partReferences: [{ id: "p1", unitChargeCents: 12550 }],
          },
        }),
      ),
    );
  });

  it("partitions evidence blobs and retains bytes until explicit lifecycle change", async () => {
    const store = await openFrigoraOfflineStore({ preferMemory: true });
    const opId = createClientOperationId();
    const blob = createEvidenceBlobRecord({
      clientOperationId: opId,
      ventureId: partitionA.ventureId,
      actorUserId: partitionA.actorUserId,
      contentType: "image/jpeg",
      bytes: new Uint8Array([1, 2, 3, 4]).buffer,
    });
    await store.putEvidenceBlob(blob);
    await store.putEvidenceBlob(
      createEvidenceBlobRecord({
        clientOperationId: createClientOperationId(),
        ventureId: partitionB.ventureId,
        actorUserId: partitionB.actorUserId,
        contentType: "image/jpeg",
        bytes: new Uint8Array([9]).buffer,
      }),
    );
    assert.equal((await store.listEvidenceBlobs(partitionA)).length, 1);
    assert.equal((await store.listEvidenceBlobs(partitionB)).length, 1);
    assert.equal((await store.getEvidenceBlob(blob.blobId))?.lifecycle, "LOCAL_ONLY");
  });

  it("keeps F3.2 unsupported offline field mutations blocked", () => {
    assert.equal(FRIGORA_FIELD_FORMS_OFFLINE_CAPTURE_ENABLED, false);
    assert.equal(shouldBlockFrigoraFieldMutation(false, "/frigora"), true);
    assert.equal(
      shouldBlockFrigoraFieldMutation(false, "/ventures/ven-1/work/assigned"),
      true,
    );
    assert.equal(
      shouldBlockFrigoraFieldMutation(true, "/ventures/ven-1/work/assigned"),
      false,
    );
  });
});
