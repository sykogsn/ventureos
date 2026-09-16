import assert from "node:assert/strict";
import { describe, it, beforeEach } from "node:test";
import {
  assertFieldSafeOfflinePayload,
  buildDraftFromMyWorkRow,
  buildFieldWorkspacePreloadPackage,
  createMemoryOfflineBackend,
  FRIGORA_FIELD_FORMS_OFFLINE_CAPTURE_ENABLED,
  FRIGORA_OFFLINE_DB_VERSION,
  FRIGORA_OFFLINE_FORBIDDEN_COMMERCIAL_KEYS,
  FRIGORA_OFFLINE_LEASE_MS,
  listAvailableOfflineWorkspaces,
  mapToFieldSafeOfflinePayload,
  openFrigoraOfflineStore,
  readOfflineWorkspaceSnapshot,
  resetMemoryOfflineDatabasesForTests,
  stripForbiddenCommercialFields,
  type FrigoraOfflinePartition,
} from "@/modules/frigora/app/offline";
import { shouldBlockFrigoraFieldMutation } from "@/modules/frigora/app/pwa/connectivity";
import type { MyWorkRow } from "@/modules/frigora/app/views";
import { FRIGORA_PRELOAD_STATUS_COPY } from "@/modules/frigora/app/pwa/copy";

const partitionA: FrigoraOfflinePartition = {
  ventureId: "ven-a",
  actorUserId: "user-a",
};
const partitionB: FrigoraOfflinePartition = {
  ventureId: "ven-a",
  actorUserId: "user-b",
};
const partitionVentureB: FrigoraOfflinePartition = {
  ventureId: "ven-b",
  actorUserId: "user-a",
};

function sampleRow(): MyWorkRow {
  return {
    workOrder: {
      id: "wo-1",
      workReference: "WO-1",
      workKind: "repair",
      status: "open",
      customerId: "cus-1",
      siteId: "site-1",
      primaryAssetId: "asset-1",
      assignedUserId: "user-a",
      reportedCondition: "Warm cabinet",
      scheduledStartAt: null,
      scheduledEndAt: null,
    },
    customer: { id: "cus-1", displayName: "Acme Cold" },
    site: { id: "site-1", name: "Depot", addressLine1: "1 Main" },
    asset: { id: "asset-1", tag: "A-1", name: "Cabinet" },
    activeVisit: { id: "vis-1", status: "open", workOrderId: "wo-1" },
    latestVisit: { id: "vis-1", status: "open", workOrderId: "wo-1" },
    responseState: "accepted",
  } as unknown as MyWorkRow;
}

describe("Frigora F33-02 preloaded read-only workspace", () => {
  beforeEach(() => {
    resetMemoryOfflineDatabasesForTests();
  });

  it("maps authorised operational fields and strips commercial contamination", () => {
    const payload = mapToFieldSafeOfflinePayload({
      workOrder: { id: "wo-1", workReference: "WO-1", status: "open" },
      customer: { id: "cus-1", displayName: "Acme" },
      site: { id: "site-1", name: "Depot" },
      asset: { id: "asset-1", tag: "A-1" },
      visit: { id: "vis-1", status: "open" },
      history: [
        {
          id: "pu-1",
          partDescription: "Filter",
          unitChargeCents: 12550,
        },
        {
          id: "re-1",
          refrigerantType: "R134a",
          chargePerKgCents: 9000,
        },
      ],
      partReferences: [
        {
          id: "pr-1",
          displayName: "Filter",
          defaultQuantityUnit: "each",
          status: "active",
          defaultUnitChargeCents: 12550,
        },
      ],
      refrigerantReferences: [
        {
          id: "rr-1",
          canonicalCode: "R134a",
          displayName: "R134a",
          status: "active",
          defaultChargePerKgCents: 9000,
        },
      ],
    });

    assert.equal(payload.workOrder?.workReference, "WO-1");
    assert.equal(payload.customer?.displayName, "Acme");
    assert.equal(payload.partReferences?.[0]?.displayName, "Filter");
    assert.equal(
      (payload.partReferences?.[0] as { defaultUnitChargeCents?: number })
        ?.defaultUnitChargeCents,
      undefined,
    );
    assert.ok(
      !(payload.history?.[0] as { unitChargeCents?: number }).unitChargeCents,
    );
    assert.ok(FRIGORA_OFFLINE_FORBIDDEN_COMMERCIAL_KEYS.includes("unitChargeCents"));
    assert.doesNotThrow(() => assertFieldSafeOfflinePayload(payload));

    assert.throws(() =>
      assertFieldSafeOfflinePayload({
        workOrder: { id: "wo", labourHourlyChargeCents: 60000 },
      }),
    );

    const stripped = stripForbiddenCommercialFields({
      a: 1,
      unitChargeCents: 9,
      nested: { chargePerKgCents: 2, ok: true },
    });
    assert.deepEqual(stripped, { a: 1, nested: { ok: true } });
  });

  it("commits authenticated preload with partition, lease issue, and renew", async () => {
    const store = await openFrigoraOfflineStore({
      backend: createMemoryOfflineBackend(),
    });
    const row = sampleRow();
    const pkg = buildFieldWorkspacePreloadPackage({
      partition: partitionA,
      rows: [row],
      detailsByWorkOrderId: {},
      visitRecordersByWorkOrderId: {},
      asOf: "2026-09-16T12:00:00.000Z",
      generation: 1,
    });

    const first = await store.commitAuthenticatedPreload(partitionA, pkg.drafts, {
      nowMs: Date.parse("2026-09-16T12:00:00.000Z"),
      asOf: pkg.asOf,
      generation: pkg.generation,
    });
    assert.equal(first.lease.ventureId, "ven-a");
    assert.equal(first.lease.actorUserId, "user-a");
    assert.equal(
      Date.parse(first.lease.expiresAt) - Date.parse(first.lease.issuedAt),
      FRIGORA_OFFLINE_LEASE_MS,
    );

    const loaded = await store.getWorkspaceSnapshot(partitionA, "wo-1");
    assert.equal(loaded?.payload.workOrder?.workReference, "WO-1");
    assert.equal(loaded?.leaseId, first.lease.leaseId);

    const renewed = await store.commitAuthenticatedPreload(partitionA, pkg.drafts, {
      nowMs: Date.parse("2026-09-16T18:00:00.000Z"),
      asOf: "2026-09-16T18:00:00.000Z",
      generation: 2,
    });
    assert.notEqual(renewed.lease.leaseId, first.lease.leaseId);
    assert.equal(renewed.lease.expiresAt, "2026-09-17T06:00:00.000Z");

    // Failed/empty commit path is caller-owned: do not call commit without success package.
    assert.equal(FRIGORA_OFFLINE_DB_VERSION, 1);
  });

  it("persists workspace across store reopen", async () => {
    const backend = createMemoryOfflineBackend();
    const first = await openFrigoraOfflineStore({ backend });
    const draft = buildDraftFromMyWorkRow(sampleRow());
    await first.commitAuthenticatedPreload(partitionA, [draft], {
      nowMs: Date.parse("2026-09-16T12:00:00.000Z"),
    });
    first.close();

    const second = await openFrigoraOfflineStore({ backend });
    const snap = await second.getWorkspaceSnapshot(partitionA, "wo-1");
    assert.equal(snap?.payload.site?.name, "Depot");
  });

  it("isolates cross-user and cross-venture snapshots", async () => {
    const store = await openFrigoraOfflineStore({ preferMemory: true });
    const draft = buildDraftFromMyWorkRow(sampleRow());
    await store.commitAuthenticatedPreload(partitionA, [draft], {
      nowMs: Date.parse("2026-09-16T12:00:00.000Z"),
    });

    const otherUser = await store.getWorkspaceSnapshot(partitionB, "wo-1");
    assert.equal(otherUser, undefined);
    const otherVenture = await store.getWorkspaceSnapshot(partitionVentureB, "wo-1");
    assert.equal(otherVenture, undefined);

    const listB = await listAvailableOfflineWorkspaces(store, partitionB);
    assert.equal(listB.status, "MISSING");
    assert.equal(listB.snapshots.length, 0);
  });

  it("allows offline read only with active lease and does not renew on read", async () => {
    const store = await openFrigoraOfflineStore({ preferMemory: true });
    const draft = buildDraftFromMyWorkRow(sampleRow());
    const issuedAt = Date.parse("2026-09-16T12:00:00.000Z");
    const { lease } = await store.commitAuthenticatedPreload(partitionA, [draft], {
      nowMs: issuedAt,
    });

    const available = await readOfflineWorkspaceSnapshot(store, partitionA, "wo-1", {
      visitId: "vis-1",
      nowMs: issuedAt + 60_000,
    });
    assert.equal(available.status, "AVAILABLE");
    if (available.status === "AVAILABLE") {
      assert.equal(available.snapshot.payload.asset?.tag, "A-1");
    }

    const leaseAfterRead = await store.getLease(partitionA);
    assert.equal(leaseAfterRead?.expiresAt, lease.expiresAt);
    assert.equal(leaseAfterRead?.leaseId, lease.leaseId);

    const expired = await readOfflineWorkspaceSnapshot(store, partitionA, "wo-1", {
      nowMs: issuedAt + FRIGORA_OFFLINE_LEASE_MS + 1,
    });
    assert.equal(expired.status, "EXPIRED");

    const emptyStore = await openFrigoraOfflineStore({
      backend: createMemoryOfflineBackend({ dbName: "empty-offline" }),
    });
    const missing = await readOfflineWorkspaceSnapshot(emptyStore, partitionA, "wo-1");
    assert.equal(missing.status, "MISSING");
  });

  it("keeps field form offline capture disabled and mutations blocked", () => {
    assert.equal(FRIGORA_FIELD_FORMS_OFFLINE_CAPTURE_ENABLED, false);
    assert.equal(
      shouldBlockFrigoraFieldMutation(false, "/ventures/ven-1/work/assigned"),
      true,
    );
    assert.equal(
      shouldBlockFrigoraFieldMutation(false, "/ventures/ven-1/work/wo-1/visit/vis-1"),
      true,
    );
    assert.match(FRIGORA_PRELOAD_STATUS_COPY.offlineChangesUnavailable, /not available/i);
  });
});
