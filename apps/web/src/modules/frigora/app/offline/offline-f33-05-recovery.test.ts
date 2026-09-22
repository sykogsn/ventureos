import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { after, beforeEach, describe, it } from "node:test";
import type { UserId, VentureId, WorkspaceId } from "@/contracts";
import { platformVentureRegistry } from "@/core/venture-definition/catalog";
import { createPermissionService } from "@/platform/permissions/service";
import { createDbMembershipStore } from "@/platform/permissions/membership-store";
import { ensureSchema, getDb } from "@/platform/persistence/db";
import {
  frigoraClientOperationReceipts,
  frigoraFieldCaptures,
  frigoraTechnicalFindings,
  frigoraVisitEvidence,
  storedObjects,
} from "@/platform/persistence/schema";
import { getPersistence, resetPersistenceLifecycle } from "@/platform/persistence/repositories";
import type { PersistedVenture } from "@/platform/persistence/repositories/ports";
import { getPlatform } from "@/platform/kernel";
import { eq } from "drizzle-orm";
import { FrigoraError } from "@/modules/frigora/errors";
import { createFrigoraService } from "@/modules/frigora/service";
import { closeFrigoraPersistenceAfterFile } from "@/modules/frigora/test-persistence-lifecycle";
import type { FrigoraScope, FrigoraTechnicalFindingKind } from "@/modules/frigora/types";
import {
  FRIGORA_FIELD_FORMS_OFFLINE_CAPTURE_ENABLED,
  FRIGORA_OFFLINE_CAPTURE_OPERATION_ALLOWLIST,
  FRIGORA_OFFLINE_DB_VERSION,
  captureFieldCaptureOffline,
  captureTechnicalFindingOffline,
  captureVisitEvidenceOffline,
  createMemoryOfflineBackend,
  createOfflineLease,
  isFrigoraOfflineCaptureOperationAllowed,
  openFrigoraOfflineStore,
  resetMemoryOfflineDatabasesForTests,
  type FrigoraOfflineMutationEnvelope,
} from "@/modules/frigora/app/offline";
import { classifyExplicitSubmitFailure } from "./offline-submit-classification";
import {
  applyOfflineAcceptanceProbe,
  buildOfflineAcceptanceLookupInput,
  refreshOfflineAcceptance,
  runExplicitOfflineSubmission,
} from "./offline-recovery";

const NOW = "2026-09-16T08:00:00.000Z";
const ARRIVED = "2026-09-16T09:00:00.000Z";
const ASSERTED = "2026-09-16T09:20:00.000Z";
const DEPARTED = "2026-09-16T10:00:00.000Z";
const OUTCOME_AT = "2026-09-16T09:40:00.000Z";
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);
const here = dirname(fileURLToPath(import.meta.url));

closeFrigoraPersistenceAfterFile();

after(() => {
  getPlatform().scheduler.stopAll();
});

beforeEach(async () => {
  await resetPersistenceLifecycle();
  await ensureSchema();
  resetMemoryOfflineDatabasesForTests();
});

function ventureRow(overrides: Partial<PersistedVenture> = {}): PersistedVenture {
  return {
    id: "ven-frigora" as VentureId,
    workspaceId: "ws-frigora" as WorkspaceId,
    name: "Frigora One",
    slug: "frigora-one",
    stage: "Idea",
    href: "/ventures/hq/frigora-one",
    foundedAt: NOW,
    category: "Operations",
    owner: "Founder",
    hqSummary: "Open.",
    genome: {
      thesis: "Keep the cold chain honest.",
      category: "Operations",
      stage: "Idea",
      goal: "Admit operational identity.",
      posture: "human-led",
      risk: "focused",
      motion: "Serve refrigeration sites.",
      cadence: "Weekly",
    },
    mission: {
      today: {
        title: "",
        ask: "",
        whyNow: "",
        ifDeferred: "",
        timeNeeded: "",
        actionLabel: "",
        actionHref: "/dashboard",
        attention: "hold",
        founderAsk: "",
        active: false,
      },
      sprint: { name: "", objective: "", tasks: [] },
    },
    launchDraft: {},
    documents: { documents: [] },
    risk: { headline: "", signals: [] },
    definitionId: "frigora",
    definitionVersion: "0.21.0",
    lifecycle: "operating",
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

async function seed() {
  const workspaceId = "ws-frigora" as WorkspaceId;
  const ventureId = "ven-frigora" as VentureId;
  const userId = "user-owner" as UserId;
  const store = getPersistence();
  await store.organisations.insert({
    id: workspaceId,
    name: "Frigora Workspace",
    slug: "ws-frigora",
    createdAt: NOW,
  });
  await store.memberships.setRole({ userId, workspaceId, role: "owner", createdAt: NOW });
  await store.ventures.insert(ventureRow());
  const scope: FrigoraScope = { userId, workspaceId, ventureId };
  return {
    workspaceId,
    ventureId,
    userId,
    scope,
    service: createFrigoraService({
      permissions: createPermissionService(createDbMembershipStore()),
    }),
  };
}

async function addMember(workspaceId: WorkspaceId, userId: UserId) {
  await getPersistence().memberships.setRole({
    userId,
    workspaceId,
    role: "member",
    createdAt: NOW,
  });
}

async function seedAssignedVisit(owner: Awaited<ReturnType<typeof seed>>, engineerId: UserId) {
  await addMember(owner.workspaceId, engineerId);
  const customer = await owner.service.createCustomer(owner.scope, {
    code: "FUELCO",
    displayName: "FuelCo",
  });
  const site = await owner.service.createSite(owner.scope, {
    customerId: customer.id,
    code: "SANDTON-N",
    name: "Sandton North",
  });
  const asset = await owner.service.createAsset(owner.scope, {
    siteId: site.id,
    tag: "EVAP-01",
    name: "Evaporator",
  });
  const workOrder = await owner.service.createWorkOrder(owner.scope, {
    siteId: site.id,
    workReference: "WO-F33-05",
    workKind: "reactive",
    primaryAssetId: asset.id,
    reportedCondition: "warm case",
  });
  await owner.service.assignWorkOrder(owner.scope, workOrder.id, { expectedUpdatedAt: workOrder.updatedAt, userId: engineerId });
  const engineerScope: FrigoraScope = {
    userId: engineerId,
    workspaceId: owner.workspaceId,
    ventureId: owner.ventureId,
  };
  const visit = await owner.service.recordVisitArrival(engineerScope, workOrder.id, {
    userId: engineerId,
    arrivedAt: ARRIVED,
  });
  return { workOrder, visit, engineerScope };
}

async function leaseWorkspace(
  owner: Awaited<ReturnType<typeof seed>>,
  engineerId: UserId,
  workOrderId: string,
  visitId: string,
  dbName: string,
) {
  const partition = { ventureId: owner.ventureId, actorUserId: engineerId };
  const backend = createMemoryOfflineBackend({ dbName });
  const store = await openFrigoraOfflineStore({ backend });
  const lease = createOfflineLease(partition, { nowMs: Date.now() });
  await store.putLease(lease);
  await store.putWorkspaceSnapshot({
    snapshotId: `snap-${dbName}`,
    ventureId: partition.ventureId,
    actorUserId: partition.actorUserId,
    workOrderId,
    visitId,
    asOf: NOW,
    generation: 1,
    leaseId: lease.leaseId,
    payload: {
      workOrder: { id: workOrderId },
      visit: { id: visitId, status: "open" },
    },
  });
  return { partition, store };
}

async function businessCounts(visitId: string) {
  const findings = await getDb()
    .select()
    .from(frigoraTechnicalFindings)
    .where(eq(frigoraTechnicalFindings.visitId, visitId));
  const captures = await getDb()
    .select()
    .from(frigoraFieldCaptures)
    .where(eq(frigoraFieldCaptures.visitId, visitId));
  const evidence = await getDb()
    .select()
    .from(frigoraVisitEvidence)
    .where(eq(frigoraVisitEvidence.visitId, visitId));
  const receipts = await getDb().select().from(frigoraClientOperationReceipts);
  const objects = await getDb().select().from(storedObjects);
  return {
    findings: findings.length,
    captures: captures.length,
    evidence: evidence.length,
    receipts: receipts.length,
    objects: objects.length,
  };
}

function lookupFor(owner: Awaited<ReturnType<typeof seed>>, scope: FrigoraScope, workspaceId: string) {
  return (envelope: FrigoraOfflineMutationEnvelope) =>
    owner.service.lookupClientOperationAcceptance(
      scope,
      buildOfflineAcceptanceLookupInput(envelope, workspaceId),
    );
}

function explicitLookup(
  owner: Awaited<ReturnType<typeof seed>>,
  scope: FrigoraScope,
  workspaceId: string,
  envelope: FrigoraOfflineMutationEnvelope,
) {
  return () => lookupFor(owner, scope, workspaceId)(envelope);
}

async function submitFinding(
  owner: Awaited<ReturnType<typeof seed>>,
  scope: FrigoraScope,
  visitId: string,
  envelope: FrigoraOfflineMutationEnvelope,
) {
  try {
    const accepted = await owner.service.submitClientTechnicalFinding(scope, visitId as never, {
      clientOperationId: envelope.clientOperationId,
      workOrderId: envelope.workOrderId,
      findingKind: envelope.payload.findingKind as FrigoraTechnicalFindingKind,
      description: String(envelope.payload.description),
      assertedAt: String(envelope.payload.assertedAt),
      userId: envelope.actorUserId,
      assetId: typeof envelope.payload.assetId === "string" ? envelope.payload.assetId : null,
    });
    return { acceptedEntityId: accepted.finding.id, receiptId: accepted.receipt.id };
  } catch (error) {
    return classifyExplicitSubmitFailure(error);
  }
}

describe("F33-05 read-only acceptance recovery", () => {
  it("Q/R/S/T. allowlist, product, schema, and IndexedDB stay at the F33-04 baseline", () => {
    assert.equal(platformVentureRegistry.resolve("frigora").version, "0.22.0");
    assert.equal(FRIGORA_OFFLINE_DB_VERSION, 1);
    assert.equal(FRIGORA_FIELD_FORMS_OFFLINE_CAPTURE_ENABLED, false);
    assert.deepEqual([...FRIGORA_OFFLINE_CAPTURE_OPERATION_ALLOWLIST], [
      "recordTechnicalFinding",
      "recordFieldCapture",
      "recordVisitEvidence",
    ]);
    assert.equal(isFrigoraOfflineCaptureOperationAllowed("recordPartUsage"), false);
    const dbSource = readFileSync(join(here, "../../../../platform/persistence/db.ts"), "utf8");
    assert.match(dbSource, /SCHEMA_GENERATION = 29/);
    const action = readFileSync(join(here, "offline-acceptance-action.ts"), "utf8");
    assert.doesNotMatch(action, /submitClientTechnicalFinding|submitClientFieldCapture|submitClientVisitEvidence/);
    const recovery = readFileSync(join(here, "offline-recovery.ts"), "utf8");
    const refresh = recovery.slice(
      recovery.indexOf("export async function refreshOfflineAcceptance"),
      recovery.indexOf("export async function runReadOnlyAcceptanceCheck"),
    );
    assert.doesNotMatch(refresh, /submitClient|submitPending/);
    const sw = readFileSync(join(here, "../../../../../public/sw.js"), "utf8");
    assert.doesNotMatch(sw, /outbox|clientOperationId|submitClient|lookupPendingOfflineAcceptanceAction/);
    const copy = readFileSync(join(here, "../pwa/copy.ts"), "utf8");
    assert.match(copy, /Saved on this device/);
    assert.match(copy, /Not yet submitted/);
    assert.match(copy, /Submit to server/);
    assert.match(copy, /Acceptance not confirmed on this device\./);
    assert.match(copy, /Check acceptance/);
    assert.match(copy, /Retry submission/);
    assert.match(copy, /Accepted by server/);
    assert.match(copy, /Not accepted — you can retry\./);
    assert.match(copy, /Sign in again before this saved work can be submitted or reconciled\./);
    assert.match(copy, /Not accepted/);
    for (const form of [
      "record-technical-finding-form.tsx",
      "record-field-capture-form.tsx",
      "record-visit-evidence-form.tsx",
    ]) {
      const source = readFileSync(join(here, "../forms", form), "utf8");
      assert.doesNotMatch(source, /Discard saved copy|LOCAL_DELETED/);
      assert.match(source, /recoveryControl/);
      assert.match(source, /copy\.checkAcceptance/);
      assert.match(source, /copy\.signIn/);
      assert.match(source, /refreshOfflineAcceptance/);
    }
  });

  it("A/B. pending and syncing findings reconcile from an existing receipt with zero new inserts", async () => {
    const owner = await seed();
    const engineerId = "user-engineer-a" as UserId;
    const { workOrder, visit, engineerScope } = await seedAssignedVisit(owner, engineerId);
    const { partition, store } = await leaseWorkspace(owner, engineerId, workOrder.id, visit.id, "f33-05-ab");
    const pending = await captureTechnicalFindingOffline({
      partition,
      workspaceId: owner.workspaceId,
      workOrderId: workOrder.id,
      visitId: visit.id,
      payload: { findingKind: "symptom", description: "compressor click", assertedAt: ASSERTED },
    }, store);
    await submitFinding(owner, engineerScope, visit.id, pending);
    const before = await businessCounts(visit.id);
    assert.equal(before.findings, 1);
    assert.equal(before.receipts, 1);

    const accepted = await applyOfflineAcceptanceProbe(
      pending,
      await lookupFor(owner, engineerScope, owner.workspaceId)(pending),
      store,
    );
    assert.equal(accepted.disposition, "accepted");
    assert.equal(accepted.envelope?.syncState, "SYNCED");
    assert.equal(accepted.envelope?.clientOperationId, pending.clientOperationId);
    assert.deepEqual(await businessCounts(visit.id), before);

    const syncing = await captureTechnicalFindingOffline({
      partition,
      workspaceId: owner.workspaceId,
      workOrderId: workOrder.id,
      visitId: visit.id,
      payload: { findingKind: "symptom", description: "second click", assertedAt: ASSERTED },
    }, store);
    await store.updateMutationState(syncing.clientOperationId, "SYNCING");
    await submitFinding(owner, engineerScope, visit.id, syncing);
    const mid = await businessCounts(visit.id);
    const syncingRow = (await store.getMutation(syncing.clientOperationId))!;
    assert.equal(syncingRow.syncState, "SYNCING");
    const reconciled = await applyOfflineAcceptanceProbe(
      syncingRow,
      await lookupFor(owner, engineerScope, owner.workspaceId)(syncingRow),
      store,
    );
    assert.equal(reconciled.envelope?.syncState, "SYNCED");
    assert.deepEqual(await businessCounts(visit.id), mid);
  });

  it("C/E. evidence receipt reconciles the same StoredObject and explicit retry does not upload again", async () => {
    const owner = await seed();
    const engineerId = "user-engineer-a" as UserId;
    const { workOrder, visit, engineerScope } = await seedAssignedVisit(owner, engineerId);
    const { partition, store } = await leaseWorkspace(owner, engineerId, workOrder.id, visit.id, "f33-05-evidence");
    const captured = await captureVisitEvidenceOffline({
      partition,
      workspaceId: owner.workspaceId,
      workOrderId: workOrder.id,
      visitId: visit.id,
      payload: {
        category: "TECHNICAL",
        originalFilename: "photo.jpg",
        mimeType: "image/jpeg",
        bytes: JPEG.buffer,
      },
    }, store);
    const envelope = captured.envelope;
    const sha = String(envelope.payload.contentSha256);
    const uploaded = await owner.service.submitClientVisitEvidence(engineerScope, visit.id, {
      clientOperationId: envelope.clientOperationId,
      workOrderId: workOrder.id,
      category: "TECHNICAL",
      description: null,
      userId: engineerId,
      assetId: null,
      body: JPEG,
      originalFilename: "photo.jpg",
      mimeType: "image/jpeg",
    });
    const before = await businessCounts(visit.id);
    assert.equal(before.evidence, 1);
    assert.equal(before.objects, 1);
    let submits = 0;
    const result = await runExplicitOfflineSubmission(
      envelope,
      explicitLookup(owner, engineerScope, owner.workspaceId, envelope),
      async () => {
        submits += 1;
        return { acceptedEntityId: "should-not-run", receiptId: "should-not-run" };
      },
      async () => {},
      store,
    );
    assert.equal(submits, 0);
    assert.equal(result.acceptedEntityId, uploaded.evidence.id);
    const synced = (await store.getMutation(envelope.clientOperationId))!;
    assert.equal(synced.syncState, "SYNCED");
    assert.equal(synced.clientOperationId, envelope.clientOperationId);
    const blob = (await store.listEvidenceBlobs(partition))[0]!;
    assert.equal(blob.lifecycle, "SERVER_ACCEPTED");
    assert.equal(String(synced.payload.contentSha256), sha);
    const after = await businessCounts(visit.id);
    assert.deepEqual(after, before);
    assert.equal(after.objects, 1);
  });

  it("D/P. reconnect with no receipt leaves local state unchanged and does not submit", async () => {
    const owner = await seed();
    const engineerId = "user-engineer-a" as UserId;
    const { workOrder, visit } = await seedAssignedVisit(owner, engineerId);
    const { partition, store } = await leaseWorkspace(owner, engineerId, workOrder.id, visit.id, "f33-05-reconnect");
    const envelope = await captureTechnicalFindingOffline({
      partition,
      workspaceId: owner.workspaceId,
      workOrderId: workOrder.id,
      visitId: visit.id,
      payload: { findingKind: "symptom", description: "still local", assertedAt: ASSERTED },
    }, store);
    let lookups = 0;
    const refreshed = await refreshOfflineAcceptance(
      [envelope],
      async () => {
        lookups += 1;
        return { status: "NOT_FOUND" };
      },
      store,
    );
    assert.equal(lookups, 1);
    assert.equal(refreshed.operations[0]?.syncState, "PENDING");
    assert.equal(refreshed.operations[0]?.clientOperationId, envelope.clientOperationId);
    assert.equal((await businessCounts(visit.id)).findings, 0);
    assert.equal((await businessCounts(visit.id)).receipts, 0);
  });

  it("F. explicit retry with no receipt accepts once and keeps clientOperationId", async () => {
    const owner = await seed();
    const engineerId = "user-engineer-a" as UserId;
    const { workOrder, visit, engineerScope } = await seedAssignedVisit(owner, engineerId);
    const { store } = await leaseWorkspace(owner, engineerId, workOrder.id, visit.id, "f33-05-retry-miss");
    const partition = { ventureId: owner.ventureId, actorUserId: engineerId };
    const envelope = await captureTechnicalFindingOffline({
      partition,
      workspaceId: owner.workspaceId,
      workOrderId: workOrder.id,
      visitId: visit.id,
      payload: { findingKind: "symptom", description: "first send", assertedAt: ASSERTED },
    }, store);
    let submits = 0;
    await runExplicitOfflineSubmission(
      envelope,
      explicitLookup(owner, engineerScope, owner.workspaceId, envelope),
      async () => {
        submits += 1;
        return submitFinding(owner, engineerScope, visit.id, envelope);
      },
      async () => {},
      store,
    );
    assert.equal(submits, 1);
    const synced = (await store.getMutation(envelope.clientOperationId))!;
    assert.equal(synced.syncState, "SYNCED");
    assert.equal(synced.clientOperationId, envelope.clientOperationId);
    assert.equal((await businessCounts(visit.id)).findings, 1);
    assert.equal((await businessCounts(visit.id)).receipts, 1);
  });

  it("G/H. auth failure blocks without anonymous submit, then the same engineer can retry", async () => {
    const owner = await seed();
    const engineerId = "user-engineer-a" as UserId;
    const { workOrder, visit, engineerScope } = await seedAssignedVisit(owner, engineerId);
    const { store } = await leaseWorkspace(owner, engineerId, workOrder.id, visit.id, "f33-05-auth");
    const partition = { ventureId: owner.ventureId, actorUserId: engineerId };
    const envelope = await captureTechnicalFindingOffline({
      partition,
      workspaceId: owner.workspaceId,
      workOrderId: workOrder.id,
      visitId: visit.id,
      payload: { findingKind: "symptom", description: "kept locally", assertedAt: ASSERTED },
    }, store);
    let submits = 0;
    const blocked = await runExplicitOfflineSubmission(
      envelope,
      async () => ({ status: "UNAUTHENTICATED" }),
      async () => {
        submits += 1;
        return { acceptedEntityId: "no", receiptId: "no" };
      },
      async () => {},
      store,
    );
    assert.equal(submits, 0);
    assert.equal(blocked.code, "auth_required");
    const stored = (await store.getMutation(envelope.clientOperationId))!;
    assert.equal(stored.syncState, "BLOCKED");
    assert.equal(stored.payload.description, "kept locally");
    assert.equal(stored.clientOperationId, envelope.clientOperationId);
    assert.match(stored.serverReceipt?.serverMessage ?? "", /Sign in again/);

    await runExplicitOfflineSubmission(
      stored,
      explicitLookup(owner, engineerScope, owner.workspaceId, envelope),
      async () => {
        submits += 1;
        return submitFinding(owner, engineerScope, visit.id, stored);
      },
      async () => {},
      store,
    );
    assert.equal(submits, 1);
    assert.equal((await store.getMutation(envelope.clientOperationId))?.syncState, "SYNCED");
    assert.equal((await businessCounts(visit.id)).findings, 1);
  });

  it("I/O. another engineer cannot see or attach the operation, and a fingerprint mismatch does not sync", async () => {
    const owner = await seed();
    const engineerA = "user-engineer-a" as UserId;
    const engineerB = "user-engineer-b" as UserId;
    const { workOrder, visit, engineerScope } = await seedAssignedVisit(owner, engineerA);
    await addMember(owner.workspaceId, engineerB);
    const bScope: FrigoraScope = {
      userId: engineerB,
      workspaceId: owner.workspaceId,
      ventureId: owner.ventureId,
    };
    const { partition, store } = await leaseWorkspace(owner, engineerA, workOrder.id, visit.id, "f33-05-partition");
    const envelope = await captureTechnicalFindingOffline({
      partition,
      workspaceId: owner.workspaceId,
      workOrderId: workOrder.id,
      visitId: visit.id,
      payload: { findingKind: "symptom", description: "engineer a only", assertedAt: ASSERTED },
    }, store);
    await submitFinding(owner, engineerScope, visit.id, envelope);
    const bList = await store.listMutations({ ventureId: owner.ventureId, actorUserId: engineerB });
    assert.equal(bList.length, 0);
    const foreign = await owner.service.lookupClientOperationAcceptance(
      bScope,
      buildOfflineAcceptanceLookupInput(envelope, owner.workspaceId),
    );
    assert.equal(foreign.status, "MISMATCH");
    assert.equal("acceptedEntityId" in foreign, false);
    assert.equal("receiptId" in foreign, false);

    const altered = buildOfflineAcceptanceLookupInput(envelope, owner.workspaceId);
    if (altered.operationType !== "recordTechnicalFinding") throw new Error("expected finding");
    const mismatch = await owner.service.lookupClientOperationAcceptance(engineerScope, {
      ...altered,
      description: "changed after acceptance",
    });
    assert.equal(mismatch.status, "MISMATCH");
    assert.equal("acceptedEntityId" in mismatch, false);
    const local = await applyOfflineAcceptanceProbe(envelope, mismatch, store);
    assert.notEqual(local.envelope?.syncState, "SYNCED");
    assert.equal(local.envelope?.syncState, "CONFLICT");
    assert.equal(local.envelope?.payload.description, "engineer a only");
    assert.equal((await businessCounts(visit.id)).findings, 1);
  });

  it("J. reassignment preserves the local finding as CONFLICT and still reads a historical receipt", async () => {
    const owner = await seed();
    const engineerA = "user-engineer-a" as UserId;
    const engineerB = "user-engineer-b" as UserId;
    const { workOrder, visit, engineerScope } = await seedAssignedVisit(owner, engineerA);
    await addMember(owner.workspaceId, engineerB);
    const { partition, store } = await leaseWorkspace(owner, engineerA, workOrder.id, visit.id, "f33-05-reassign");
    const acceptedLocal = await captureTechnicalFindingOffline({
      partition,
      workspaceId: owner.workspaceId,
      workOrderId: workOrder.id,
      visitId: visit.id,
      payload: { findingKind: "symptom", description: "accepted before move", assertedAt: ASSERTED },
    }, store);
    await submitFinding(owner, engineerScope, visit.id, acceptedLocal);
    const waiting = await captureTechnicalFindingOffline({
      partition,
      workspaceId: owner.workspaceId,
      workOrderId: workOrder.id,
      visitId: visit.id,
      payload: { findingKind: "symptom", description: "not yet sent", assertedAt: ASSERTED },
    }, store);

    await owner.service.recordVisitDeparture(engineerScope, visit.id, { departedAt: DEPARTED });
    await owner.service.assignWorkOrder(owner.scope, workOrder.id, { expectedUpdatedAt: (await owner.service.getWorkOrder(owner.scope, workOrder.id))!.updatedAt, userId: engineerB });

    const historical = await lookupFor(owner, engineerScope, owner.workspaceId)(acceptedLocal);
    assert.equal(historical.status, "ACCEPTED");
    if (historical.status === "ACCEPTED") {
      assert.equal(historical.clientOperationId, acceptedLocal.clientOperationId);
    }
    assert.equal((await businessCounts(visit.id)).findings, 1);

    let submits = 0;
    const rejected = await runExplicitOfflineSubmission(
      waiting,
      explicitLookup(owner, engineerScope, owner.workspaceId, waiting),
      async () => {
        submits += 1;
        return submitFinding(owner, engineerScope, visit.id, waiting);
      },
      async () => {},
      store,
    );
    assert.equal(submits, 1);
    assert.equal(rejected.code, "authority");
    const stored = (await store.getMutation(waiting.clientOperationId))!;
    assert.equal(stored.syncState, "CONFLICT");
    assert.equal(stored.payload.description, "not yet sent");
    assert.match(stored.serverReceipt?.serverMessage ?? "", /current WorkOrder assignment/);
    assert.equal((await businessCounts(visit.id)).findings, 1);
    assert.equal((await businessCounts(visit.id)).receipts, 1);
  });

  it("K. cancelled visit stays CONFLICT with the server reason and no receipt", async () => {
    const owner = await seed();
    const engineerId = "user-engineer-a" as UserId;
    const { workOrder, visit, engineerScope } = await seedAssignedVisit(owner, engineerId);
    const { partition, store } = await leaseWorkspace(owner, engineerId, workOrder.id, visit.id, "f33-05-conflict");

    const cancelled = await captureTechnicalFindingOffline({
      partition,
      workspaceId: owner.workspaceId,
      workOrderId: workOrder.id,
      visitId: visit.id,
      payload: { findingKind: "symptom", description: "after cancel", assertedAt: ASSERTED },
    }, store);
    await owner.service.cancelVisit(owner.scope, visit.id);
    const cancelResult = await runExplicitOfflineSubmission(
      cancelled,
      explicitLookup(owner, engineerScope, owner.workspaceId, cancelled),
      () => submitFinding(owner, engineerScope, visit.id, cancelled),
      async () => {},
      store,
    );
    assert.equal(cancelResult.code, "rejected");
    assert.match(cancelResult.error ?? "", /cancelled visit/);
    assert.equal((await store.getMutation(cancelled.clientOperationId))?.syncState, "CONFLICT");
    assert.equal((await businessCounts(visit.id)).receipts, 0);
  });

  it("L/M/N. departed evidence, closed work order, and out-of-window finding/capture stay CONFLICT", async () => {
    const owner2 = await seed();
    const engineer2 = "user-engineer-b" as UserId;
    const second = await seedAssignedVisit(owner2, engineer2);
    const leased = await leaseWorkspace(owner2, engineer2, second.workOrder.id, second.visit.id, "f33-05-evidence-conflict");
    const early = await captureTechnicalFindingOffline({
      partition: leased.partition,
      workspaceId: owner2.workspaceId,
      workOrderId: second.workOrder.id,
      visitId: second.visit.id,
      payload: { findingKind: "symptom", description: "too early", assertedAt: "2026-09-16T08:30:00.000Z" },
    }, leased.store);
    const earlyCapture = await captureFieldCaptureOffline({
      partition: leased.partition,
      workspaceId: owner2.workspaceId,
      workOrderId: second.workOrder.id,
      visitId: second.visit.id,
      payload: {
        captureKind: "condition",
        captureCode: "other",
        description: "too early",
        observedAt: "2026-09-16T08:30:00.000Z",
      },
    }, leased.store);
    const earlyFinding = await runExplicitOfflineSubmission(
      early,
      explicitLookup(owner2, second.engineerScope, owner2.workspaceId, early),
      () => submitFinding(owner2, second.engineerScope, second.visit.id, early),
      async () => {},
      leased.store,
    );
    assert.equal(earlyFinding.code, "rejected");
    assert.match(earlyFinding.error ?? "", /must not precede visit arrival/);
    const earlyCaptureResult = await runExplicitOfflineSubmission(
      earlyCapture,
      explicitLookup(owner2, second.engineerScope, owner2.workspaceId, earlyCapture),
      async () => {
        try {
          const accepted = await owner2.service.submitClientFieldCapture(second.engineerScope, second.visit.id, {
            clientOperationId: earlyCapture.clientOperationId,
            workOrderId: earlyCapture.workOrderId,
            captureKind: "condition",
            captureCode: "other",
            description: "too early",
            observedAt: "2026-09-16T08:30:00.000Z",
            userId: engineer2,
            assetId: null,
          });
          return { acceptedEntityId: accepted.capture.id, receiptId: accepted.receipt.id };
        } catch (error) {
          return classifyExplicitSubmitFailure(error);
        }
      },
      async () => {},
      leased.store,
    );
    assert.equal(earlyCaptureResult.code, "rejected");
    assert.equal((await leased.store.getMutation(early.clientOperationId))?.syncState, "CONFLICT");
    assert.equal((await leased.store.getMutation(earlyCapture.clientOperationId))?.syncState, "CONFLICT");

    const departedEvidence = await captureVisitEvidenceOffline({
      partition: leased.partition,
      workspaceId: owner2.workspaceId,
      workOrderId: second.workOrder.id,
      visitId: second.visit.id,
      payload: {
        category: "TECHNICAL",
        originalFilename: "late.jpg",
        mimeType: "image/jpeg",
        bytes: JPEG.buffer,
      },
    }, leased.store);
    await owner2.service.recordVisitDeparture(second.engineerScope, second.visit.id, { departedAt: DEPARTED });
    const departedResult = await runExplicitOfflineSubmission(
      departedEvidence.envelope,
      explicitLookup(owner2, second.engineerScope, owner2.workspaceId, departedEvidence.envelope),
      async () => {
        try {
          const accepted = await owner2.service.submitClientVisitEvidence(second.engineerScope, second.visit.id, {
            clientOperationId: departedEvidence.envelope.clientOperationId,
            workOrderId: second.workOrder.id,
            category: "TECHNICAL",
            description: null,
            userId: engineer2,
            assetId: null,
            body: JPEG,
            originalFilename: "late.jpg",
            mimeType: "image/jpeg",
          });
          return { acceptedEntityId: accepted.evidence.id, receiptId: accepted.receipt.id };
        } catch (error) {
          return classifyExplicitSubmitFailure(error);
        }
      },
      async () => {},
      leased.store,
    );
    assert.equal(departedResult.code, "rejected");
    assert.match(departedResult.error ?? "", /while the visit is open/);
    assert.equal((await leased.store.getMutation(departedEvidence.envelope.clientOperationId))?.syncState, "CONFLICT");
    assert.equal((await businessCounts(second.visit.id)).evidence, 0);

    await owner2.service.recordVisitOutcome(owner2.scope, second.visit.id, {
      description: "Cooling restored",
      outcomeAt: OUTCOME_AT,
      recordedByUserId: engineer2,
    });
    await owner2.service.closeWorkOrder(owner2.scope, second.workOrder.id);
    const closedEvidence = await captureVisitEvidenceOffline({
      partition: leased.partition,
      workspaceId: owner2.workspaceId,
      workOrderId: second.workOrder.id,
      visitId: second.visit.id,
      payload: {
        category: "TECHNICAL",
        originalFilename: "closed.jpg",
        mimeType: "image/jpeg",
        bytes: JPEG.buffer,
      },
    }, leased.store);
    const closedResult = await runExplicitOfflineSubmission(
      closedEvidence.envelope,
      explicitLookup(owner2, second.engineerScope, owner2.workspaceId, closedEvidence.envelope),
      async () => {
        try {
          const accepted = await owner2.service.submitClientVisitEvidence(second.engineerScope, second.visit.id, {
            clientOperationId: closedEvidence.envelope.clientOperationId,
            workOrderId: second.workOrder.id,
            category: "TECHNICAL",
            description: null,
            userId: engineer2,
            assetId: null,
            body: JPEG,
            originalFilename: "closed.jpg",
            mimeType: "image/jpeg",
          });
          return { acceptedEntityId: accepted.evidence.id, receiptId: accepted.receipt.id };
        } catch (error) {
          return classifyExplicitSubmitFailure(error);
        }
      },
      async () => {},
      leased.store,
    );
    assert.equal((await owner2.service.getWorkOrder(owner2.scope, second.workOrder.id))?.status, "closed");
    assert.equal(closedResult.code, "rejected");
    assert.equal((await leased.store.getMutation(closedEvidence.envelope.clientOperationId))?.syncState, "CONFLICT");
    assert.equal((await businessCounts(second.visit.id)).evidence, 0);
    assert.equal((await businessCounts(second.visit.id)).receipts, 0);
  });

  it("historical receipt lookup does not require current assignment and performs no insert", async () => {
    const owner = await seed();
    const engineerId = "user-engineer-a" as UserId;
    const { workOrder, visit, engineerScope } = await seedAssignedVisit(owner, engineerId);
    const submitted = await owner.service.submitClientTechnicalFinding(engineerScope, visit.id, {
      clientOperationId: "historical-op",
      workOrderId: workOrder.id,
      findingKind: "symptom",
      description: "before reassignment",
      assertedAt: ASSERTED,
      userId: engineerId,
    });
    await owner.service.recordVisitDeparture(engineerScope, visit.id, { departedAt: DEPARTED });
    await owner.service.assignWorkOrder(owner.scope, workOrder.id, { expectedUpdatedAt: (await owner.service.getWorkOrder(owner.scope, workOrder.id))!.updatedAt, userId: owner.userId });
    const before = await businessCounts(visit.id);
    const lookup = await owner.service.lookupClientOperationAcceptance(engineerScope, {
      operationType: "recordTechnicalFinding",
      ventureId: owner.ventureId,
      workspaceId: owner.workspaceId,
      actorUserId: engineerId,
      clientOperationId: "historical-op",
      workOrderId: workOrder.id,
      visitId: visit.id,
      findingKind: "symptom",
      description: "before reassignment",
      assertedAt: ASSERTED,
      assetId: null,
    });
    assert.equal(lookup.status, "ACCEPTED");
    if (lookup.status === "ACCEPTED") {
      assert.equal(lookup.acceptedEntityId, submitted.finding.id);
      assert.equal(lookup.receiptId, submitted.receipt.id);
    }
    assert.deepEqual(await businessCounts(visit.id), before);
    await assert.rejects(
      () => owner.service.submitClientTechnicalFinding(engineerScope, visit.id, {
        clientOperationId: "new-after-reassignment",
        workOrderId: workOrder.id,
        findingKind: "symptom",
        description: "should not insert",
        assertedAt: ASSERTED,
        userId: engineerId,
      }),
      (error: unknown) => error instanceof FrigoraError && error.code === "forbidden",
    );
    assert.equal((await businessCounts(visit.id)).findings, before.findings);
  });
});
