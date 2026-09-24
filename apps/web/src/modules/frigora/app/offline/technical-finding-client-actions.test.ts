import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { beforeEach, describe, it } from "node:test";
import { createMemoryOfflineBackend, resetMemoryOfflineDatabasesForTests } from "./backend";
import { openFrigoraOfflineStore } from "./store";
import { captureTechnicalFindingOffline } from "./technical-finding-capture";
import {
  canExplicitlySubmitTechnicalFinding,
  saveTechnicalFindingOnce,
  submitTechnicalFindingFromClient,
} from "./technical-finding-client-actions";

const partition = { ventureId: "ven-correction", actorUserId: "engineer-correction" };
const accepted = { acceptedEntityId: "finding-1", receiptId: "receipt-1" };
const rejection = { code: "retryable" as const, error: "Service temporarily unavailable" };
const refresh = async () => {};

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => { resolve = done; });
  return { promise, resolve };
}

async function fixture() {
  const backend = createMemoryOfflineBackend({ dbName: "f33-corrections" });
  const store = await openFrigoraOfflineStore({ backend });
  const envelope = await store.enqueueMutation({
    ...partition,
    workspaceId: "ws-1",
    workOrderId: "wo-1",
    visitId: "visit-1",
    operationType: "recordTechnicalFinding",
    payload: { findingKind: "symptom", description: "Compressor noise", assertedAt: new Date().toISOString() },
  });
  return { backend, store, envelope };
}

beforeEach(() => resetMemoryOfflineDatabasesForTests());

describe("F33-03 client corrective lifecycle", () => {
  it("F01: one rejection reconciles once; refreshed identities are inert; identical later retry reconciles once", async () => {
    const { store, envelope } = await fixture();
    let calls = 0;
    let refreshes = 0;
    const invoke = async () => { calls++; return rejection; };
    let current = envelope;
    const onChanged = async () => {
      refreshes++;
      current = (await store.listMutations(partition))[0]!;
    };
    assert.equal(await submitTechnicalFindingFromClient(current, invoke, onChanged, store), rejection);
    assert.equal(current.syncState, "RETRYABLE_FAILURE");
    assert.equal(current.attemptCount, 1);
    assert.equal((await store.listReceipts(partition)).length, 1);
    for (let i = 0; i < 5; i++) {
      current = { ...(await store.getMutation(envelope.clientOperationId))! };
      assert.equal(canExplicitlySubmitTechnicalFinding(current.syncState, true), true);
      await onChanged();
    }
    assert.equal(calls, 1);
    assert.equal(current.attemptCount, 1);
    assert.equal((await store.listReceipts(partition)).length, 1);
    await submitTechnicalFindingFromClient(current, invoke, async () => onChanged(), store);
    assert.equal(calls, 2);
    assert.equal(current.attemptCount, 2);
    assert.equal(refreshes, 7);
  });

  it("F01: success awaits local reconciliation and refresh, then settles with one receipt", async () => {
    const { store, envelope } = await fixture();
    const delay = deferred();
    let settled = false;
    const task = submitTechnicalFindingFromClient(envelope, async () => accepted, async () => {
      assert.equal((await store.getMutation(envelope.clientOperationId))?.syncState, "SYNCED");
      await delay.promise;
    }, store).then((result) => { settled = true; return result; });
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(settled, false);
    delay.resolve();
    assert.equal(await task, accepted);
    assert.equal((await store.listReceipts(partition)).length, 1);
    assert.equal((await store.getMutation(envelope.clientOperationId))?.attemptCount, 1);
    assert.equal(canExplicitlySubmitTechnicalFinding("SYNCED", true), false);
  });

  for (const interruption of ["before receipt", "after receipt"] as const) {
    it(`F02: interruption ${interruption} survives reopen and offers explicit same-ID recovery`, async () => {
      const { backend, store, envelope } = await fixture();
      let calls = 0;
      const put = backend.put.bind(backend);
      backend.put = async (name, record) => {
        if ((interruption === "before receipt" && name === "receipts") ||
            (interruption === "after receipt" && name === "outbox" && record.syncState === "SYNCED")) {
          throw new Error("Simulated interruption");
        }
        await put(name, record);
      };
      const result = await submitTechnicalFindingFromClient(envelope, async () => { calls++; return accepted; }, refresh, store);
      assert.match(result.error!, /Retry this saved finding/);
      assert.equal((await store.getMutation(envelope.clientOperationId))?.syncState, "SYNCING");
      store.close();
      const reopened = await openFrigoraOfflineStore({ backend: createMemoryOfflineBackend({ dbName: backend.dbName }) });
      const durable = (await reopened.listMutations(partition))[0]!;
      assert.equal(durable.clientOperationId, envelope.clientOperationId);
      assert.equal(canExplicitlySubmitTechnicalFinding(durable.syncState, false), false);
      assert.equal(canExplicitlySubmitTechnicalFinding(durable.syncState, true), true);
      assert.equal(calls, 1); // Reopen and reconnect are read-only.
      await submitTechnicalFindingFromClient(durable, async () => { calls++; return { ...accepted, duplicate: true }; }, refresh, reopened);
      assert.equal(calls, 2);
      assert.equal((await reopened.getMutation(durable.clientOperationId))?.syncState, "SYNCED");
      assert.equal((await reopened.listMutations(partition)).length, 1);
      assert.equal((await reopened.listReceipts(partition)).filter((receipt) => receipt.kind === "accepted").length, 1);
    });
  }

  it("F03: structured retryable result preserves server error; rejected invocation reports unknown acceptance", async () => {
    const { store, envelope } = await fixture();
    const structured = await submitTechnicalFindingFromClient(envelope, async () => rejection, refresh, store);
    assert.equal(structured.error, rejection.error);
    const lost = await submitTechnicalFindingFromClient(envelope, async () => { throw new TypeError("Failed to fetch"); }, refresh, store);
    assert.equal(lost.code, "retryable");
    assert.match(lost.error!, /acceptance could not be confirmed/);
    const durable = (await store.getMutation(envelope.clientOperationId))!;
    assert.equal(durable.syncState, "RETRYABLE_FAILURE");
    assert.equal(durable.clientOperationId, envelope.clientOperationId);
    assert.equal(durable.attemptCount, 2);
    assert.equal((await store.listMutations(partition)).length, 1);
    assert.equal(canExplicitlySubmitTechnicalFinding(durable.syncState, true), true);
    assert.equal((await store.listReceipts(partition)).some((receipt) => receipt.kind === "accepted"), false);
  });

  it("F03: local write failure and refresh rejection settle without an uncaught action rejection", async () => {
    const { backend, store, envelope } = await fixture();
    backend.put = async () => { throw new Error("Device storage failed"); };
    const result = await submitTechnicalFindingFromClient(envelope, async () => { throw new Error("Response lost"); }, refresh, store);
    assert.match(result.error!, /Retry this saved finding/);
    assert.equal((await store.getMutation(envelope.clientOperationId))?.syncState, "PENDING");
    const refreshFailure = await submitTechnicalFindingFromClient(envelope, async () => rejection, async () => { throw new Error("Read failed"); }, store);
    assert.match(refreshFailure.error!, /Reload/);
  });

  it("F04: delayed durable capture ignores rapid submits and admits a later legitimate capture", async () => {
    const { backend, store } = await fixture();
    await store.commitAuthenticatedPreload(partition, [{
      workOrderId: "wo-2", visitId: "visit-2",
      payload: { workOrder: { id: "wo-2" }, visit: { id: "visit-2", status: "open" } },
    }]);
    const delay = deferred();
    const entered = deferred();
    const put = backend.put.bind(backend);
    backend.put = async (name, record) => {
      if (name === "outbox") { entered.resolve(); await delay.promise; }
      await put(name, record);
    };
    const inFlight = { current: false };
    let captures = 0;
    const save = async () => {
      captures++;
      await captureTechnicalFindingOffline({
        partition, workspaceId: "ws-1", workOrderId: "wo-2", visitId: "visit-2",
        payload: { findingKind: "symptom", description: "Noise", assertedAt: new Date().toISOString() },
      }, store);
    };
    const first = saveTechnicalFindingOnce(inFlight, save);
    await entered.promise;
    await Promise.all([saveTechnicalFindingOnce(inFlight, save), saveTechnicalFindingOnce(inFlight, save)]);
    assert.equal(captures, 1);
    assert.equal(inFlight.current, true);
    delay.resolve();
    await first;
    assert.equal(inFlight.current, false);
    const captured = () => store.listMutations(partition).then((ops) => ops.filter((op) => op.visitId === "visit-2"));
    assert.equal((await captured()).length, 1);
    await saveTechnicalFindingOnce(inFlight, save);
    const operations = await captured();
    assert.equal(operations.length, 2);
    assert.notEqual(operations[0]!.clientOperationId, operations[1]!.clientOperationId);
  });

  it("F04: failed persistence releases the capture guard for a later save", async () => {
    const inFlight = { current: false };
    await assert.rejects(saveTechnicalFindingOnce(inFlight, async () => { throw new Error("Quota"); }), /Quota/);
    assert.equal(inFlight.current, false);
    let saved = false;
    await saveTechnicalFindingOnce(inFlight, async () => { saved = true; });
    assert.equal(saved, true);
  });

  it("component wiring keeps result reconciliation out of effects and awaits guarded capture", () => {
    const source = readFileSync(new URL("../forms/record-technical-finding-form.tsx", import.meta.url), "utf8");
    const row = source.slice(source.indexOf("function PendingTechnicalFindingRow"));
    assert.doesNotMatch(row, /useEffect\(/);
    assert.match(row, /useActionState\([\s\S]*runExplicitOfflineSubmission\(/);
    assert.match(row, /runExplicitOfflineSubmission\(\s*envelope,\s*\(\) => lookupPendingOfflineAcceptanceAction\(buildOfflineAcceptanceLookupInput\(envelope, workspaceId\)\),\s*\(\) => submitPendingTechnicalFindingFormAction\(previous, formData\),\s*onChanged,/);
    assert.match(source, /startOfflineTransition\(async \(\) => \{\s*await saveTechnicalFindingOnce/);
  });
});
