import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { createMemoryOfflineBackend, resetMemoryOfflineDatabasesForTests } from "./backend";
import { openFrigoraOfflineStore } from "./store";
import { captureVisitEvidenceOffline, loadPersistedEvidenceBlobForSubmit } from "./visit-evidence-capture";
import { captureFieldCaptureOffline } from "./field-capture-capture";
import { captureTechnicalFindingOffline } from "./technical-finding-capture";
import { canExplicitlySubmitOffline, saveOfflineOnce, submitOfflineFromClient } from "./offline-client-actions";
import { submitTechnicalFindingFromClient } from "./technical-finding-client-actions";
import { createClientOperationId } from "./types";

const partition = { ventureId: "venture", actorUserId: "engineer" };
const target = { partition, workspaceId: "workspace", workOrderId: "work-order", visitId: "visit" };
const payload = { category: "TECHNICAL", originalFilename: "photo.jpg", mimeType: "image/jpeg", bytes: new Uint8Array([255, 216, 255, 217]).buffer };
const accepted = { acceptedEntityId: "entity", receiptId: "receipt" };

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => { resolve = done; });
  return { promise, resolve };
}

async function fixture() {
  const backend = createMemoryOfflineBackend();
  const store = await openFrigoraOfflineStore({ backend });
  await store.commitAuthenticatedPreload(partition, [{
    workOrderId: target.workOrderId, visitId: target.visitId,
    payload: { workOrder: { id: target.workOrderId }, visit: { id: target.visitId, status: "open" } },
  }]);
  return { store, backend };
}

beforeEach(resetMemoryOfflineDatabasesForTests);

describe("COR-01 blob/outbox durability", () => {
  it("simultaneous same operation reuses one blob; changed canonical content cannot replace either record", async () => {
    const { store } = await fixture();
    const input = { ...target, payload, clientOperationId: createClientOperationId() };
    const results = await Promise.all(Array.from({ length: 8 }, () => captureVisitEvidenceOffline(input, store)));
    assert.equal(new Set(results.map((result) => result.blob.blobId)).size, 1);
    const before = await store.getMutation(input.clientOperationId);
    const originalBlobs = await store.listEvidenceBlobs(partition);
    for (const change of [{ description: "changed" }, { bytes: new Uint8Array([1, 2, 3]).buffer }]) {
      await assert.rejects(captureVisitEvidenceOffline({ ...input, payload: { ...payload, ...change } }, store), /conflict/);
    }
    assert.deepEqual(await store.listEvidenceBlobs(partition), originalBlobs);
    assert.equal(originalBlobs.length, 1);
    assert.equal((await store.listMutations(partition)).length, 1);
    assert.deepEqual(await store.getMutation(input.clientOperationId), before);
  });

  it("a failed second write rolls back blob and outbox together", async () => {
    const { store, backend } = await fixture();
    const atomic = backend.atomicPut.bind(backend);
    backend.atomicPut = async (writes, guard) => atomic(writes.map((write) => write.store === "outbox"
      ? { ...write, record: { ...write.record, uncloneable: () => {} } } : write), guard);
    await assert.rejects(captureVisitEvidenceOffline({ ...target, payload }, store), /NOT saved offline/);
    assert.equal((await store.listEvidenceBlobs(partition)).length, 0);
    assert.equal((await store.listMutations(partition)).length, 0);
    backend.atomicPut = atomic;
    await captureVisitEvidenceOffline({ ...target, payload }, store);
    assert.equal((await store.listEvidenceBlobs(partition)).length, 1);
    assert.equal((await store.listMutations(partition)).length, 1);
  });

  for (const corruption of ["venture", "actor", "operation", "lifecycle", "bytes", "length", "missing-length", "fractional-length", "missing-digest", "digest", "mime", "filename"] as const) {
    it(`blocks ${corruption} corruption before submit`, async () => {
      const { store } = await fixture();
      const { blob, envelope } = await captureVisitEvidenceOffline({ ...target, payload }, store);
      if (corruption === "venture") blob.ventureId = "other";
      if (corruption === "actor") blob.actorUserId = "other";
      if (corruption === "operation") blob.clientOperationId = createClientOperationId();
      if (corruption === "lifecycle") blob.lifecycle = "LOCAL_DELETED";
      if (corruption === "bytes") blob.bytes = new Uint8Array([1, 2, 3, 4]).buffer;
      if (corruption === "length") envelope.payload.byteLength = 9;
      if (corruption === "missing-length") delete envelope.payload.byteLength;
      if (corruption === "fractional-length") envelope.payload.byteLength = 4.5;
      if (corruption === "missing-digest") delete envelope.payload.contentSha256;
      if (corruption === "digest") envelope.payload.contentSha256 = "0".repeat(64);
      if (corruption === "mime") blob.contentType = "application/pdf";
      if (corruption === "filename") blob.fileName = "different.jpg";
      await store.putEvidenceBlob(blob);
      await assert.rejects(loadPersistedEvidenceBlobForSubmit(envelope, store));
    });
  }
});

for (const operation of ["recordTechnicalFinding", "recordFieldCapture", "recordVisitEvidence"] as const) {
  describe(`COR-01 lifecycle ${operation}`, () => {
    async function setup() {
      const { store, backend } = await fixture();
      const capture = async () => operation === "recordVisitEvidence"
        ? (await captureVisitEvidenceOffline({ ...target, payload }, store)).envelope
        : operation === "recordFieldCapture"
          ? captureFieldCaptureOffline({ ...target, payload: { captureKind: "condition", captureCode: "OTHER", description: "Noise", observedAt: new Date().toISOString() } }, store)
          : captureTechnicalFindingOffline({ ...target, payload: { findingKind: "symptom", description: "Noise", assertedAt: new Date().toISOString() } }, store);
      const submit = operation === "recordTechnicalFinding" ? submitTechnicalFindingFromClient : submitOfflineFromClient;
      return { store, backend, capture, submit };
    }

    it("awaited persistence blocks rapid re-entry and releases for the next user action", async () => {
      const { store, backend, capture } = await setup();
      const delay = deferred();
      const entered = deferred();
      const put = backend.put.bind(backend);
      const atomic = backend.atomicPut.bind(backend);
      backend.put = async (name, record) => {
        if (name === "outbox") { entered.resolve(); await delay.promise; }
        return put(name, record);
      };
      backend.atomicPut = async (writes, guard) => {
        if (writes.some((write) => write.store === "outbox")) { entered.resolve(); await delay.promise; }
        return atomic(writes, guard);
      };
      const guard = { current: false };
      const save = async () => { await capture(); };
      const first = saveOfflineOnce(guard, save);
      await entered.promise;
      await Promise.all([saveOfflineOnce(guard, save), saveOfflineOnce(guard, save)]);
      assert.equal(guard.current, true);
      delay.resolve();
      await first;
      assert.equal(guard.current, false);
      assert.equal((await store.listMutations(partition)).length, 1);
      await saveOfflineOnce(guard, save);
      assert.equal((await store.listMutations(partition)).length, 2);
    });

    it("failed persistence releases the guard without creating an operation", async () => {
      const { store, backend, capture } = await setup();
      const put = backend.put.bind(backend);
      const atomic = backend.atomicPut.bind(backend);
      backend.put = async () => { throw new Error("Quota"); };
      backend.atomicPut = async () => { throw new Error("Quota"); };
      const guard = { current: false };
      await assert.rejects(saveOfflineOnce(guard, async () => { await capture(); }), /Quota/);
      assert.equal(guard.current, false);
      assert.equal((await store.listMutations(partition)).length, 0);
      backend.put = put;
      backend.atomicPut = atomic;
      await saveOfflineOnce(guard, async () => { await capture(); });
      assert.equal((await store.listMutations(partition)).length, 1);
    });

    it("one invocation reconciles once; reconnect reads are inert; lost response is explicitly retryable", async () => {
      const { store, capture, submit } = await setup();
      const envelope = await capture();
      let calls = 0;
      const result = await submit(envelope, async () => { calls++; throw new Error("Dropped response"); }, async () => {}, store);
      assert.match(result.error!, /acceptance could not be confirmed/);
      for (let i = 0; i < 5; i++) {
        const row = (await store.getMutation(envelope.clientOperationId))!;
        assert.equal(canExplicitlySubmitOffline(row.syncState, true), true);
      }
      assert.equal(calls, 1);
      assert.equal((await store.getMutation(envelope.clientOperationId))!.attemptCount, 1);
      await submit(envelope, async () => { calls++; return accepted; }, async () => {}, store);
      assert.equal(calls, 2);
      const synced = (await store.getMutation(envelope.clientOperationId))!;
      assert.equal(synced.syncState, "SYNCED");
      assert.equal(synced.attemptCount, 2);
      assert.equal((await store.listMutations(partition)).length, 1);
      assert.equal((await store.listReceipts(partition)).filter((receipt) => receipt.kind === "accepted").length, 1);
    });

    it("interrupted SYNCING reopens without submitting and recovers on explicit same-operation retry", async () => {
      const { store, backend, capture, submit } = await setup();
      const envelope = await capture();
      const put = backend.put.bind(backend);
      const atomic = backend.atomicPut.bind(backend);
      backend.put = async (name, row) => { if (name === "receipts") throw new Error("Interruption"); return put(name, row); };
      backend.atomicPut = async (writes, guard) => {
        if (writes.some((write) => write.store === "receipts")) throw new Error("Interruption");
        return atomic(writes, guard);
      };
      let calls = 0;
      const result = await submit(envelope, async () => { calls++; return accepted; }, async () => {}, store);
      assert.match(result.error!, /Retry/);
      assert.equal((await store.getMutation(envelope.clientOperationId))!.syncState, "SYNCING");
      if (operation === "recordVisitEvidence") assert.notEqual((await store.listEvidenceBlobs(partition))[0]!.lifecycle, "SERVER_ACCEPTED");
      store.close();
      const reopened = await openFrigoraOfflineStore({ backend: createMemoryOfflineBackend() });
      const current = (await reopened.getMutation(envelope.clientOperationId))!;
      assert.equal(canExplicitlySubmitOffline(current.syncState, false), false);
      assert.equal(canExplicitlySubmitOffline(current.syncState, true), true);
      assert.equal(calls, 1);
      await submit(current, async () => { calls++; return { ...accepted, duplicate: true }; }, async () => {}, reopened);
      assert.equal(calls, 2);
      assert.equal((await reopened.getMutation(current.clientOperationId))!.syncState, "SYNCED");
      assert.equal((await reopened.listMutations(partition)).length, 1);
      assert.equal((await reopened.listReceipts(partition)).length, 1);
      if (operation === "recordVisitEvidence") assert.equal((await reopened.listEvidenceBlobs(partition))[0]!.lifecycle, "SERVER_ACCEPTED");
    });
  });
}
