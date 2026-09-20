import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, it, after } from "node:test";
import type { Role, UserId, VentureId, WorkspaceId } from "@/contracts";
import { createPermissionService } from "@/platform/permissions/service";
import { createDbMembershipStore } from "@/platform/permissions/membership-store";
import { getPlatform } from "@/platform/kernel";
import { ensureSchema, getDb } from "@/platform/persistence/db";
import {
  frigoraFieldCaptures,
  frigoraVisitEvidence,
  storedObjects,
} from "@/platform/persistence/schema";
import { getPersistence, resetPersistenceLifecycle } from "@/platform/persistence/repositories";
import type { PersistedVenture } from "@/platform/persistence/repositories/ports";
import { eq } from "drizzle-orm";
import {
  fingerprintFieldCaptureRequest,
  fingerprintVisitEvidenceRequest,
  sha256HexOfBytes,
} from "@/modules/frigora/client-operation-fingerprint";
import { FrigoraError } from "@/modules/frigora/errors";
import { createFrigoraService } from "@/modules/frigora/service";
import { closeFrigoraPersistenceAfterFile } from "@/modules/frigora/test-persistence-lifecycle";
import type { FrigoraScope } from "@/modules/frigora/types";
import {
  FRIGORA_FIELD_FORMS_OFFLINE_CAPTURE_ENABLED,
  FRIGORA_OFFLINE_DB_VERSION,
  FRIGORA_OFFLINE_CAPTURE_OPERATION_ALLOWLIST,
  applyOfflineLocalSubmitOutcome,
  captureFieldCaptureOffline,
  captureVisitEvidenceOffline,
  createClientOperationId,
  createMemoryOfflineBackend,
  createOfflineLease,
  isFrigoraOfflineCaptureOperationAllowed,
  openFrigoraOfflineStore,
  prepareOfflineExplicitRetry,
  refuseOfflineLeaseSelfExtension,
  resetMemoryOfflineDatabasesForTests,
} from "@/modules/frigora/app/offline";
import { shouldBlockFrigoraFieldMutation } from "@/modules/frigora/app/pwa/connectivity";

const NOW = "2026-09-16T08:00:00.000Z";
const ARRIVED = "2026-09-16T09:00:00.000Z";
const OBSERVED = "2026-09-16T09:20:00.000Z";
const JPEG_BODY = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);

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

async function seed(options: {
  workspaceId?: WorkspaceId;
  ventureId?: VentureId;
  userId?: UserId;
  role?: Role;
} = {}) {
  const workspaceId = (options.workspaceId ?? "ws-frigora") as WorkspaceId;
  const ventureId = (options.ventureId ?? "ven-frigora") as VentureId;
  const userId = (options.userId ?? "user-owner") as UserId;
  const store = getPersistence();
  if (!(await store.organisations.findById(workspaceId))) {
    await store.organisations.insert({
      id: workspaceId,
      name: "Frigora Workspace",
      slug: `ws-${workspaceId}`,
      createdAt: NOW,
    });
  }
  await store.memberships.setRole({
    userId,
    workspaceId,
    role: options.role ?? "owner",
    createdAt: NOW,
  });
  await store.ventures.insert(
    ventureRow({
      id: ventureId,
      workspaceId,
      slug: `venture-${ventureId}`,
    }),
  );
  return {
    workspaceId,
    ventureId,
    userId,
    scope: { userId, workspaceId, ventureId } satisfies FrigoraScope,
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
    workReference: "WO-F33-04",
    workKind: "reactive",
    primaryAssetId: asset.id,
    reportedCondition: "warm case",
  });
  await owner.service.assignWorkOrder(owner.scope, workOrder.id, {
    userId: engineerId,
  });
  const engineerScope: FrigoraScope = {
    userId: engineerId,
    workspaceId: owner.workspaceId,
    ventureId: owner.ventureId,
  };
  const visit = await owner.service.recordVisitArrival(engineerScope, workOrder.id, {
    userId: engineerId,
    arrivedAt: ARRIVED,
  });
  return { workOrder, visit, asset, engineerScope };
}

async function seedLeasedWorkspace(
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
      workOrder: { id: workOrderId, workReference: "WO-F33-04" },
      visit: { id: visitId, status: "open" },
    },
  });
  return { partition, store, lease };
}

describe("F33-04 field capture + visit evidence local capture + idempotent explicit acceptance", () => {
  it("A. SCHEMA_GENERATION is 28, product 0.21.0, allowlist exactly 3, global flag false", async () => {
    const dbSource = readFileSync(join(here, "../../../../platform/persistence/db.ts"), "utf8");
    assert.match(dbSource, /SCHEMA_GENERATION = 28/);
    assert.equal(FRIGORA_OFFLINE_DB_VERSION, 1);
    assert.equal(FRIGORA_FIELD_FORMS_OFFLINE_CAPTURE_ENABLED, false);
    assert.deepEqual(
      [...FRIGORA_OFFLINE_CAPTURE_OPERATION_ALLOWLIST],
      ["recordTechnicalFinding", "recordFieldCapture", "recordVisitEvidence"],
    );
    const catalog = readFileSync(
      join(here, "../../../../core/venture-definition/catalog.ts"),
      "utf8",
    );
    assert.match(catalog, /id:\s*"frigora"[\s\S]*?version:\s*"0\.21\.0"/);
  });

  it("B. field capture: first acceptance + identical duplicate share entity and receipt", async () => {
    const owner = await seed();
    const engineerId = "user-engineer-a" as UserId;
    const { workOrder, visit, engineerScope } = await seedAssignedVisit(owner, engineerId);
    const clientOperationId = "op-fc-identical-1";

    const first = await owner.service.submitClientFieldCapture(engineerScope, visit.id, {
      clientOperationId,
      workOrderId: workOrder.id,
      captureKind: "measurement",
      captureCode: "temperature",
      valueNumeric: -18,
      valueUnit: "celsius",
      observedAt: OBSERVED,
      userId: engineerId,
    });
    assert.equal(first.duplicate, false);

    const second = await owner.service.submitClientFieldCapture(engineerScope, visit.id, {
      clientOperationId,
      workOrderId: workOrder.id,
      captureKind: "measurement",
      captureCode: "temperature",
      valueNumeric: -18,
      valueUnit: "celsius",
      observedAt: OBSERVED,
      userId: engineerId,
    });
    assert.equal(second.duplicate, true);
    assert.equal(second.capture.id, first.capture.id);
    assert.equal(second.receipt.id, first.receipt.id);

    const captures = await getDb()
      .select()
      .from(frigoraFieldCaptures)
      .where(eq(frigoraFieldCaptures.visitId, visit.id));
    assert.equal(captures.length, 1);
  });

  it("C. field capture: same clientOperationId with altered payload is idempotency conflict", async () => {
    const owner = await seed();
    const engineerId = "user-engineer-a" as UserId;
    const { workOrder, visit, engineerScope } = await seedAssignedVisit(owner, engineerId);
    const clientOperationId = "op-fc-mismatch-1";

    await owner.service.submitClientFieldCapture(engineerScope, visit.id, {
      clientOperationId,
      workOrderId: workOrder.id,
      captureKind: "measurement",
      captureCode: "temperature",
      valueNumeric: -18,
      valueUnit: "celsius",
      observedAt: OBSERVED,
      userId: engineerId,
    });

    await assert.rejects(
      () =>
        owner.service.submitClientFieldCapture(engineerScope, visit.id, {
          clientOperationId,
          workOrderId: workOrder.id,
          captureKind: "measurement",
          captureCode: "temperature",
          valueNumeric: -10,
          valueUnit: "celsius",
          observedAt: OBSERVED,
          userId: engineerId,
        }),
      (error: unknown) =>
        error instanceof FrigoraError && error.code === "idempotency_conflict",
    );
  });

  it("D. visit evidence: first acceptance + identical duplicate share entity/receipt and one StoredObject", async () => {
    const owner = await seed();
    const engineerId = "user-engineer-a" as UserId;
    const { workOrder, visit, engineerScope } = await seedAssignedVisit(owner, engineerId);
    const clientOperationId = "op-ve-identical-1";
    const request = {
      clientOperationId,
      workOrderId: workOrder.id,
      category: "TECHNICAL" as const,
      description: null,
      userId: engineerId,
      body: JPEG_BODY,
      originalFilename: "case.jpg",
      mimeType: "image/jpeg",
    };

    const first = await owner.service.submitClientVisitEvidence(engineerScope, visit.id, request);
    assert.equal(first.duplicate, false);

    const second = await owner.service.submitClientVisitEvidence(engineerScope, visit.id, request);
    assert.equal(second.duplicate, true);
    assert.equal(second.evidence.id, first.evidence.id);
    assert.equal(second.receipt.id, first.receipt.id);
    assert.equal(second.evidence.storedObjectId, first.evidence.storedObjectId);

    const evidenceRows = await getDb()
      .select()
      .from(frigoraVisitEvidence)
      .where(eq(frigoraVisitEvidence.visitId, visit.id));
    assert.equal(evidenceRows.length, 1);
    const objects = await getDb().select().from(storedObjects);
    assert.equal(objects.length, 1);
  });

  it("E. visit evidence: altered payload on same clientOperationId is idempotency conflict without second StoredObject", async () => {
    const owner = await seed();
    const engineerId = "user-engineer-a" as UserId;
    const { workOrder, visit, engineerScope } = await seedAssignedVisit(owner, engineerId);
    const clientOperationId = "op-ve-mismatch-1";

    await owner.service.submitClientVisitEvidence(engineerScope, visit.id, {
      clientOperationId,
      workOrderId: workOrder.id,
      category: "TECHNICAL",
      description: null,
      userId: engineerId,
      body: JPEG_BODY,
      originalFilename: "case.jpg",
      mimeType: "image/jpeg",
    });

    await assert.rejects(
      () =>
        owner.service.submitClientVisitEvidence(engineerScope, visit.id, {
          clientOperationId,
          workOrderId: workOrder.id,
          category: "TECHNICAL",
          description: null,
          userId: engineerId,
          body: new Uint8Array([0xff, 0xd8, 0xff, 0x00, 0xd9]),
          originalFilename: "case.jpg",
          mimeType: "image/jpeg",
        }),
      (error: unknown) =>
        error instanceof FrigoraError && error.code === "idempotency_conflict",
    );

    const objects = await getDb().select().from(storedObjects);
    assert.equal(objects.length, 1);
  });

  it("F. lease required: local field capture and evidence save with zero server mutation; lease not extended", async () => {
    const owner = await seed();
    const engineerId = "user-engineer-a" as UserId;
    const { workOrder, visit } = await seedAssignedVisit(owner, engineerId);
    const { partition, store, lease } = await seedLeasedWorkspace(
      owner,
      engineerId,
      workOrder.id,
      visit.id,
      "f33-04-capture",
    );
    const expiresBefore = lease.expiresAt;
    refuseOfflineLeaseSelfExtension(lease);

    const capture = await captureFieldCaptureOffline(
      {
        partition,
        workspaceId: owner.workspaceId,
        workOrderId: workOrder.id,
        visitId: visit.id,
        payload: {
          captureKind: "condition",
          captureCode: "visual_condition",
          description: "frost on evaporator",
          observedAt: OBSERVED,
        },
      },
      store,
    );
    assert.equal(capture.syncState, "PENDING");
    assert.equal(capture.operationType, "recordFieldCapture");

    const evidence = await captureVisitEvidenceOffline(
      {
        partition,
        workspaceId: owner.workspaceId,
        workOrderId: workOrder.id,
        visitId: visit.id,
        payload: {
          category: "TECHNICAL",
          originalFilename: "local.jpg",
          mimeType: "image/jpeg",
          bytes: JPEG_BODY.buffer.slice(
            JPEG_BODY.byteOffset,
            JPEG_BODY.byteOffset + JPEG_BODY.byteLength,
          ),
        },
      },
      store,
    );
    assert.equal(evidence.envelope.syncState, "PENDING");
    assert.equal(evidence.envelope.operationType, "recordVisitEvidence");
    assert.equal(evidence.contentSha256, sha256HexOfBytes(JPEG_BODY));
    assert.equal(evidence.blob.lifecycle, "LINKED_TO_PENDING");

    const leaseAfter = await store.getLease(partition);
    assert.equal(leaseAfter?.expiresAt, expiresBefore);

    const captures = await getDb()
      .select()
      .from(frigoraFieldCaptures)
      .where(eq(frigoraFieldCaptures.visitId, visit.id));
    assert.equal(captures.length, 0);
    const evidenceRows = await getDb()
      .select()
      .from(frigoraVisitEvidence)
      .where(eq(frigoraVisitEvidence.visitId, visit.id));
    assert.equal(evidenceRows.length, 0);
    const objects = await getDb().select().from(storedObjects);
    assert.equal(objects.length, 0);
  });

  it("F2. evidence storage-write failure does not claim offline save succeeded", async () => {
    const owner = await seed();
    const engineerId = "user-engineer-quota" as UserId;
    const { workOrder, visit } = await seedAssignedVisit(owner, engineerId);
    const { partition, store: base } = await seedLeasedWorkspace(
      owner,
      engineerId,
      workOrder.id,
      visit.id,
      "f33-04-quota",
    );
    const failingStore = new Proxy(base, {
      get(target, prop, receiver) {
        if (prop === "enqueueEvidence") {
          return async () => {
            throw new Error("QuotaExceededError");
          };
        }
        const value = Reflect.get(target, prop, receiver);
        return typeof value === "function" ? value.bind(target) : value;
      },
    });

    await assert.rejects(
      () =>
        captureVisitEvidenceOffline(
          {
            partition,
            workspaceId: owner.workspaceId,
            workOrderId: workOrder.id,
            visitId: visit.id,
            payload: {
              category: "TECHNICAL",
              originalFilename: "quota.jpg",
              mimeType: "image/jpeg",
              bytes: JPEG_BODY.buffer.slice(
                JPEG_BODY.byteOffset,
                JPEG_BODY.byteOffset + JPEG_BODY.byteLength,
              ),
            },
          },
          failingStore,
        ),
      /NOT saved offline/i,
    );

    const blobs = await base.listEvidenceBlobs(partition);
    assert.equal(blobs.length, 0);
    const ops = await base.listMutations(partition);
    assert.equal(ops.filter((op) => op.operationType === "recordVisitEvidence").length, 0);
  });

  it("G. reconnect alone does not submit — no automatic drain primitive", () => {
    const fieldCaptureSource = readFileSync(join(here, "field-capture-capture.ts"), "utf8");
    const evidenceSource = readFileSync(join(here, "visit-evidence-capture.ts"), "utf8");
    const connectivitySource = readFileSync(
      join(here, "../pwa/connectivity-banner.tsx"),
      "utf8",
    );
    assert.equal(fieldCaptureSource.includes('addEventListener("online"'), false);
    assert.equal(evidenceSource.includes('addEventListener("online"'), false);
    assert.equal(connectivitySource.includes("submitClientFieldCapture"), false);
    assert.equal(connectivitySource.includes("submitClientVisitEvidence"), false);
  });

  it("H. explicit submit fingerprints and accepts field capture + evidence", async () => {
    const owner = await seed();
    const engineerId = "user-engineer-a" as UserId;
    const { workOrder, visit, engineerScope } = await seedAssignedVisit(owner, engineerId);

    const captureOp = createClientOperationId();
    const captureFingerprint = fingerprintFieldCaptureRequest({
      ventureId: owner.ventureId,
      actorUserId: engineerId,
      workOrderId: workOrder.id,
      visitId: visit.id,
      captureKind: "measurement",
      captureCode: "temperature",
      valueNumeric: -20,
      valueUnit: "celsius",
      observedAt: OBSERVED,
      userId: engineerId,
      assetId: null,
    });
    const acceptedCapture = await owner.service.submitClientFieldCapture(
      engineerScope,
      visit.id,
      {
        clientOperationId: captureOp,
        workOrderId: workOrder.id,
        captureKind: "measurement",
        captureCode: "temperature",
        valueNumeric: -20,
        valueUnit: "celsius",
        observedAt: OBSERVED,
        userId: engineerId,
      },
    );
    assert.equal(acceptedCapture.receipt.requestFingerprint, captureFingerprint);
    assert.equal(acceptedCapture.receipt.operationType, "recordFieldCapture");

    const evidenceOp = createClientOperationId();
    const contentSha256 = sha256HexOfBytes(JPEG_BODY);
    const evidenceFingerprint = fingerprintVisitEvidenceRequest({
      ventureId: owner.ventureId,
      actorUserId: engineerId,
      workOrderId: workOrder.id,
      visitId: visit.id,
      category: "BEFORE_WORK",
      description: null,
      originalFilename: "before.jpg",
      mimeType: "image/jpeg",
      byteLength: JPEG_BODY.byteLength,
      contentSha256,
      userId: engineerId,
      assetId: null,
    });
    const acceptedEvidence = await owner.service.submitClientVisitEvidence(
      engineerScope,
      visit.id,
      {
        clientOperationId: evidenceOp,
        workOrderId: workOrder.id,
        category: "BEFORE_WORK",
        description: null,
        userId: engineerId,
        body: JPEG_BODY,
        originalFilename: "before.jpg",
        mimeType: "image/jpeg",
      },
    );
    assert.equal(acceptedEvidence.receipt.requestFingerprint, evidenceFingerprint);
    assert.equal(acceptedEvidence.receipt.operationType, "recordVisitEvidence");
  });

  it("I. authority/partition mismatch blocks both without insert", async () => {
    const owner = await seed();
    const engineerA = "user-engineer-a" as UserId;
    const engineerB = "user-engineer-b" as UserId;
    const { workOrder, visit } = await seedAssignedVisit(owner, engineerA);
    await addMember(owner.workspaceId, engineerB);
    const bScope: FrigoraScope = {
      userId: engineerB,
      workspaceId: owner.workspaceId,
      ventureId: owner.ventureId,
    };

    await assert.rejects(
      () =>
        owner.service.submitClientFieldCapture(bScope, visit.id, {
          clientOperationId: "op-fc-partition",
          workOrderId: workOrder.id,
          captureKind: "condition",
          captureCode: "other",
          description: "should not insert",
          observedAt: OBSERVED,
          userId: engineerA,
        }),
      (error: unknown) => error instanceof FrigoraError && error.code === "forbidden",
    );
    await assert.rejects(
      () =>
        owner.service.submitClientVisitEvidence(bScope, visit.id, {
          clientOperationId: "op-ve-partition",
          workOrderId: workOrder.id,
          category: "TECHNICAL",
          description: null,
          userId: engineerA,
          body: JPEG_BODY,
          originalFilename: "x.jpg",
          mimeType: "image/jpeg",
        }),
      (error: unknown) => error instanceof FrigoraError && error.code === "forbidden",
    );

    assert.equal(
      (
        await getDb()
          .select()
          .from(frigoraFieldCaptures)
          .where(eq(frigoraFieldCaptures.visitId, visit.id))
      ).length,
      0,
    );
    assert.equal(
      (
        await getDb()
          .select()
          .from(frigoraVisitEvidence)
          .where(eq(frigoraVisitEvidence.visitId, visit.id))
      ).length,
      0,
    );
  });

  it("J. authority loss / reassignment rejects first acceptance", async () => {
    const owner = await seed();
    const engineerA = "user-engineer-a" as UserId;
    const engineerB = "user-engineer-b" as UserId;
    const { workOrder, visit, engineerScope } = await seedAssignedVisit(owner, engineerA);
    await addMember(owner.workspaceId, engineerB);
    await owner.service.recordVisitDeparture(engineerScope, visit.id, {
      departedAt: "2026-09-16T10:00:00.000Z",
    });
    await owner.service.assignWorkOrder(owner.scope, workOrder.id, {
      userId: engineerB,
    });

    await assert.rejects(
      () =>
        owner.service.submitClientFieldCapture(engineerScope, visit.id, {
          clientOperationId: "op-fc-reassign",
          workOrderId: workOrder.id,
          captureKind: "condition",
          captureCode: "other",
          description: "after reassignment",
          observedAt: OBSERVED,
          userId: engineerA,
        }),
      (error: unknown) => error instanceof FrigoraError && error.code === "forbidden",
    );
  });

  it("K. Engineer B cannot list Engineer A outbox mutations (A/B isolation)", async () => {
    const backend = createMemoryOfflineBackend({ dbName: "f33-04-partition" });
    const store = await openFrigoraOfflineStore({ backend });
    const partitionA = { ventureId: "ven-1", actorUserId: "eng-a" };
    const partitionB = { ventureId: "ven-1", actorUserId: "eng-b" };
    await store.enqueueMutation({
      ventureId: partitionA.ventureId,
      actorUserId: partitionA.actorUserId,
      workOrderId: "wo-1",
      visitId: "vis-1",
      operationType: "recordFieldCapture",
      payload: { description: "A only" },
    });
    await store.enqueueMutation({
      ventureId: partitionA.ventureId,
      actorUserId: partitionA.actorUserId,
      workOrderId: "wo-1",
      visitId: "vis-1",
      operationType: "recordVisitEvidence",
      payload: { filename: "a.jpg" },
    });
    const aOps = await store.listMutations(partitionA);
    const bOps = await store.listMutations(partitionB);
    assert.equal(aOps.length, 2);
    assert.equal(bOps.length, 0);
  });

  it("L. allowlist exactly three; SW forbids mutation drain language", () => {
    assert.deepEqual(
      [...FRIGORA_OFFLINE_CAPTURE_OPERATION_ALLOWLIST],
      ["recordTechnicalFinding", "recordFieldCapture", "recordVisitEvidence"],
    );
    assert.equal(isFrigoraOfflineCaptureOperationAllowed("recordFieldCapture"), true);
    assert.equal(isFrigoraOfflineCaptureOperationAllowed("recordVisitEvidence"), true);
    assert.equal(isFrigoraOfflineCaptureOperationAllowed("recordPartUsage"), false);
    assert.equal(
      shouldBlockFrigoraFieldMutation(false, "/ventures/v/work/wo/visit/vi", {
        operationType: "recordFieldCapture",
      }),
      false,
    );
    assert.equal(
      shouldBlockFrigoraFieldMutation(false, "/ventures/v/work/wo/visit/vi", {
        operationType: "recordVisitEvidence",
      }),
      false,
    );
    assert.equal(
      shouldBlockFrigoraFieldMutation(false, "/ventures/v/work/wo/visit/vi", {
        operationType: "removeVisitEvidence",
      }),
      true,
    );
    const sw = readFileSync(join(here, "../../../../../public/sw.js"), "utf8");
    assert.doesNotMatch(sw, /outbox|clientOperationId|submitClientFieldCapture|submitClientVisitEvidence/);
  });

  it("M. transient submit failure stays RETRYABLE then explicit retry reuses clientOperationId (field capture)", async () => {
    const owner = await seed();
    const engineerId = "user-engineer-a" as UserId;
    const { workOrder, visit, engineerScope } = await seedAssignedVisit(owner, engineerId);
    const { partition, store } = await seedLeasedWorkspace(
      owner,
      engineerId,
      workOrder.id,
      visit.id,
      "f33-04-retry-fc",
    );
    const clientOperationId = createClientOperationId();
    const envelope = await captureFieldCaptureOffline(
      {
        partition,
        workspaceId: owner.workspaceId,
        workOrderId: workOrder.id,
        visitId: visit.id,
        clientOperationId,
        payload: {
          captureKind: "measurement",
          captureCode: "temperature",
          valueNumeric: -15,
          valueUnit: "celsius",
          observedAt: OBSERVED,
        },
      },
      store,
    );

    const afterFailure = await applyOfflineLocalSubmitOutcome(
      envelope,
      {
        ok: false,
        code: "retryable",
        error: "simulated ECONNRESET / 503 transport failure",
      },
      store,
    );
    assert.equal(afterFailure?.syncState, "RETRYABLE_FAILURE");
    assert.equal(
      (
        await getDb()
          .select()
          .from(frigoraFieldCaptures)
          .where(eq(frigoraFieldCaptures.visitId, visit.id))
      ).length,
      0,
    );

    const retried = await prepareOfflineExplicitRetry(clientOperationId, store);
    assert.equal(retried.syncState, "PENDING");
    assert.equal(retried.clientOperationId, clientOperationId);

    const accepted = await owner.service.submitClientFieldCapture(engineerScope, visit.id, {
      clientOperationId,
      workOrderId: workOrder.id,
      captureKind: "measurement",
      captureCode: "temperature",
      valueNumeric: -15,
      valueUnit: "celsius",
      observedAt: OBSERVED,
      userId: engineerId,
    });
    const synced = await applyOfflineLocalSubmitOutcome(
      retried,
      {
        ok: true,
        receiptId: accepted.receipt.id,
        acceptedEntityId: accepted.capture.id,
      },
      store,
    );
    assert.equal(synced?.syncState, "SYNCED");
    assert.equal(
      (
        await getDb()
          .select()
          .from(frigoraFieldCaptures)
          .where(eq(frigoraFieldCaptures.visitId, visit.id))
      ).length,
      1,
    );
  });

  it("N. evidence blob digest linkage and no duplicate StoredObject on identical replay after local capture", async () => {
    const owner = await seed();
    const engineerId = "user-engineer-a" as UserId;
    const { workOrder, visit, engineerScope } = await seedAssignedVisit(owner, engineerId);
    const { partition, store } = await seedLeasedWorkspace(
      owner,
      engineerId,
      workOrder.id,
      visit.id,
      "f33-04-blob",
    );
    const clientOperationId = createClientOperationId();
    const captured = await captureVisitEvidenceOffline(
      {
        partition,
        workspaceId: owner.workspaceId,
        workOrderId: workOrder.id,
        visitId: visit.id,
        clientOperationId,
        payload: {
          category: "AFTER_WORK",
          originalFilename: "after.jpg",
          mimeType: "image/jpeg",
          bytes: JPEG_BODY.buffer.slice(
            JPEG_BODY.byteOffset,
            JPEG_BODY.byteOffset + JPEG_BODY.byteLength,
          ),
        },
      },
      store,
    );
    assert.equal(
      typeof captured.envelope.payload.contentSha256 === "string"
        ? captured.envelope.payload.contentSha256
        : "",
      sha256HexOfBytes(JPEG_BODY),
    );
    assert.equal(captured.blob.byteLength, JPEG_BODY.byteLength);

    const first = await owner.service.submitClientVisitEvidence(engineerScope, visit.id, {
      clientOperationId,
      workOrderId: workOrder.id,
      category: "AFTER_WORK",
      description: null,
      userId: engineerId,
      body: JPEG_BODY,
      originalFilename: "after.jpg",
      mimeType: "image/jpeg",
    });
    const second = await owner.service.submitClientVisitEvidence(engineerScope, visit.id, {
      clientOperationId,
      workOrderId: workOrder.id,
      category: "AFTER_WORK",
      description: null,
      userId: engineerId,
      body: JPEG_BODY,
      originalFilename: "after.jpg",
      mimeType: "image/jpeg",
    });
    assert.equal(second.duplicate, true);
    assert.equal(second.evidence.storedObjectId, first.evidence.storedObjectId);
    assert.equal((await getDb().select().from(storedObjects)).length, 1);
    assert.equal(
      (
        await getDb()
          .select()
          .from(frigoraVisitEvidence)
          .where(eq(frigoraVisitEvidence.visitId, visit.id))
      ).length,
      1,
    );
  });
});

// Astra takeover: exercise the receipt race that sequential replay cannot expose.
for (const failCompensation of [false, true]) {
  it(`Astra: concurrent identical evidence preserves one StoredObject (compensation failure=${failCompensation})`, async (context) => {
    const owner = await seed();
    const engineerId = "user-engineer-race" as UserId;
    const { workOrder, visit, engineerScope } = await seedAssignedVisit(owner, engineerId);
    const { createFrigoraStore } = await import("@/modules/frigora/store");
    const store = createFrigoraStore();
    const findReceipt = store.findClientOperationReceipt.bind(store);
    let initialReads = 0;
    let release!: () => void;
    const bothRead = new Promise<void>((resolve) => { release = resolve; });
    store.findClientOperationReceipt = async (...args) => {
      const receipt = await findReceipt(...args);
      if (++initialReads <= 2) {
        if (initialReads === 2) release();
        await bothRead;
      }
      return receipt;
    };
    if (failCompensation) {
      context.mock.method(getPlatform().storedObjects, "deleteForDomain", async () => {
        throw new Error("Injected compensation outage before tombstone");
      });
    }
    const service = createFrigoraService({
      store,
      permissions: createPermissionService(createDbMembershipStore()),
    });
    const request = {
      clientOperationId: "astra-concurrent-evidence",
      workOrderId: workOrder.id, category: "TECHNICAL" as const,
      description: null, userId: engineerId, body: JPEG_BODY,
      originalFilename: "race.jpg", mimeType: "image/jpeg",
    };
    const results = await Promise.allSettled([
      service.submitClientVisitEvidence(engineerScope, visit.id, request),
      service.submitClientVisitEvidence(engineerScope, visit.id, request),
    ]);
    const objects = await getDb().select().from(storedObjects);
    const evidence = await getDb().select().from(frigoraVisitEvidence);
    const receipts = await getDb().select().from(
      (await import("@/platform/persistence/schema")).frigoraClientOperationReceipts,
    );
    context.diagnostic(JSON.stringify({
      settled: results.map((result) => result.status === "rejected" ? String(result.reason?.stack ?? result.reason) : result.status),
      objects: objects.length,
      activeObjects: objects.filter((object) => !object.deletedAt).length,
      evidence: evidence.length, receipts: receipts.length,
    }));
    assert.equal(evidence.length, 1);
    assert.equal(receipts.length, 1);
    assert.equal(objects.length, 1, "No second durable StoredObject allocation");
    assert.equal(objects.filter(object => !object.deletedAt).length, 1);
    assert.equal(results.filter(result => result.status === "fulfilled").length, 2);
    const identities = results.flatMap(result => result.status === "fulfilled" ? [result.value.evidence.storedObjectId] : []);
    assert.equal(new Set(identities).size, 1);

  });
}


it("COR-01: failure after StoredObject creation reuses the reserved identity on retry", async () => {
  const owner = await seed();
  const engineerId = "engineer-partial" as UserId;
  const { workOrder, visit, engineerScope } = await seedAssignedVisit(owner, engineerId);
  const store = (await import("@/modules/frigora/store")).createFrigoraStore();
  const insert = store.insertVisitEvidenceWithClientOperationReceipt.bind(store);
  store.insertVisitEvidenceWithClientOperationReceipt = async () => { throw Error("Injected receipt outage"); };
  const service = createFrigoraService({ store, permissions: createPermissionService(createDbMembershipStore()) });
  const request = { clientOperationId: "partial-retry", workOrderId: workOrder.id, category: "TECHNICAL" as const,
    userId: engineerId, body: JPEG_BODY, originalFilename: "partial.jpg", mimeType: "image/jpeg" };
  await assert.rejects(service.submitClientVisitEvidence(engineerScope, visit.id, request), /receipt outage/);
  const before = await getDb().select().from(storedObjects);
  assert.equal(before.length, 1);
  assert.equal((await getDb().select().from(frigoraVisitEvidence)).length, 0);
  store.insertVisitEvidenceWithClientOperationReceipt = insert;
  await assert.rejects(service.submitClientVisitEvidence(engineerScope, visit.id, { ...request, description: "changed" }), /changed request/);
  const result = await service.submitClientVisitEvidence(engineerScope, visit.id, request);
  assert.equal(result.evidence.storedObjectId, before[0]!.id);
  assert.equal((await getDb().select().from(storedObjects)).length, 1);
  assert.equal((await getDb().select().from(frigoraVisitEvidence)).length, 1);
  assert.equal((await getDb().select().from((await import("@/platform/persistence/schema")).frigoraClientOperationReceipts)).length, 1);
});
