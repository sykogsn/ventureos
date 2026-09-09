import assert from "node:assert/strict";
import { after, beforeEach, describe, it } from "node:test";
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { UserId, VentureId, WorkspaceId } from "@/contracts";
import { getPlatform } from "@/platform/kernel";
import { createPermissionService } from "@/platform/permissions/service";
import { createDbMembershipStore } from "@/platform/permissions/membership-store";
import { ensureSchema } from "@/platform/persistence/db";
import {
  getPersistence,
  resetPersistenceLifecycle,
} from "@/platform/persistence/repositories";
import type { PersistedVenture } from "@/platform/persistence/repositories/ports";
import { FrigoraError } from "@/modules/frigora/errors";
import { createFrigoraService } from "@/modules/frigora/service";
import { createFrigoraStore, type FrigoraStore } from "@/modules/frigora/store";
import { closeFrigoraPersistenceAfterFile } from "@/modules/frigora/test-persistence-lifecycle";
import { completeWorkOrderFromVisit } from "@/modules/frigora/test-work-execution";
import type { FrigoraScope } from "@/modules/frigora/types";
import { findStoredObjectById } from "@/platform/storage/metadata";

const NOW = "2026-09-08T00:00:00.000Z";
const ARRIVED = "2026-09-08T09:00:00.000Z";
const DEPARTED = "2026-09-08T11:00:00.000Z";
const JPEG_BODY = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);
const WEB_ROOT = join(process.cwd(), "src");

let objectRoot: string | undefined;

closeFrigoraPersistenceAfterFile();

after(async () => {
  getPlatform().scheduler.stopAll();
  delete process.env.STORED_OBJECT_ROOT;
  if (objectRoot) {
    await rm(objectRoot, { recursive: true, force: true });
  }
});

beforeEach(async () => {
  await resetPersistenceLifecycle();
  await ensureSchema();
  if (objectRoot) {
    await rm(objectRoot, { recursive: true, force: true });
  }
  objectRoot = await mkdtemp(join(tmpdir(), "frigora-f23-"));
  process.env.STORED_OBJECT_ROOT = objectRoot;
});

function ventureRow(workspaceId: WorkspaceId, ventureId: VentureId): PersistedVenture {
  return {
    id: ventureId,
    workspaceId,
    name: "Frigora F2.3",
    slug: "frigora-f23",
    stage: "Idea",
    href: "/ventures/hq/frigora-f23",
    foundedAt: NOW,
    category: "Operations",
    owner: "Founder",
    hqSummary: "Open.",
    genome: {
      thesis: "Keep the cold chain honest.",
      category: "Operations",
      stage: "Idea",
      goal: "Execute assigned work.",
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
    definitionVersion: "0.18.0",
    lifecycle: "operating",
    createdAt: NOW,
    updatedAt: NOW,
  };
}

async function expectCode(run: () => Promise<unknown>, code: string) {
  await assert.rejects(run, (error: unknown) => {
    assert.ok(error instanceof FrigoraError);
    assert.equal(error.code, code);
    return true;
  });
}

async function seed() {
  const workspaceId = "ws-f23" as WorkspaceId;
  const ventureId = "ven-f23" as VentureId;
  const ownerId = "user-owner" as UserId;
  const engineerAId = "user-engineer-a" as UserId;
  const engineerBId = "user-engineer-b" as UserId;
  const persistence = getPersistence();

  await persistence.organisations.insert({
    id: workspaceId,
    name: "F2.3 Workspace",
    slug: "f23-workspace",
    createdAt: NOW,
  });
  for (const [userId, role] of [
    [ownerId, "owner"],
    [engineerAId, "member"],
    [engineerBId, "member"],
  ] as const) {
    await persistence.users.insert({
      id: userId,
      email: `${userId}@example.test`,
      name: userId,
      passwordHash: "hash",
      createdAt: NOW,
    });
    await persistence.memberships.setRole({
      userId,
      workspaceId,
      role,
      createdAt: NOW,
    });
  }
  await persistence.ventures.insert(ventureRow(workspaceId, ventureId));

  const service = createFrigoraService({
    permissions: createPermissionService(createDbMembershipStore()),
  });
  const ownerScope = { userId: ownerId, workspaceId, ventureId } satisfies FrigoraScope;
  const engineerAScope = {
    userId: engineerAId,
    workspaceId,
    ventureId,
  } satisfies FrigoraScope;
  const engineerBScope = {
    userId: engineerBId,
    workspaceId,
    ventureId,
  } satisfies FrigoraScope;

  const customer = await service.createCustomer(ownerScope, {
    code: "F23-CUSTOMER",
    displayName: "F2.3 Customer",
  });
  const site = await service.createSite(ownerScope, {
    customerId: customer.id,
    code: "F23-SITE",
    name: "F2.3 Site",
    addressLine1: "1 Engineer Way",
    city: "Johannesburg",
  });
  const asset = await service.createAsset(ownerScope, {
    siteId: site.id,
    tag: "F23-ASSET",
    name: "Cold room",
    assetKind: "cold_room",
  });
  const created = await service.createWorkOrder(ownerScope, {
    siteId: site.id,
    workReference: "WO-F23-1",
    workKind: "reactive",
    reportedCondition: "Cold room is warm",
    primaryAssetId: asset.id,
  });
  const workOrder = await service.assignWorkOrder(ownerScope, created.id, {
    userId: engineerAId,
  });

  return {
    service,
    ownerScope,
    engineerAScope,
    engineerBScope,
    ownerId,
    engineerAId,
    engineerBId,
    workOrder,
    asset,
  };
}

describe("F2.3 Engineer Job Workflow", () => {
  it("lets the assigned member execute the certified Visit workflow and evidence path", async () => {
    const seeded = await seed();
    const visit = await seeded.service.recordVisitArrival(
      seeded.engineerAScope,
      seeded.workOrder.id,
      { userId: seeded.engineerAId, arrivedAt: ARRIVED },
    );
    assert.equal(visit.attendingUserId, seeded.engineerAId);

    await seeded.service.recordFieldCapture(seeded.engineerAScope, visit.id, {
      captureKind: "measurement",
      captureCode: "temperature",
      valueNumeric: -8,
      valueUnit: "celsius",
      observedAt: ARRIVED,
      userId: seeded.engineerAId,
      assetId: seeded.asset.id,
    });
    await seeded.service.recordTechnicalFinding(seeded.engineerAScope, visit.id, {
      findingKind: "suspected_fault",
      description: "Condenser airflow restricted",
      assertedAt: ARRIVED,
      userId: seeded.engineerAId,
      assetId: seeded.asset.id,
    });
    await seeded.service.recordCorrectiveAction(seeded.engineerAScope, visit.id, {
      description: "Cleared condenser obstruction",
      performedAt: ARRIVED,
      performedByUserId: seeded.engineerAId,
      recordedByUserId: seeded.engineerAId,
      assetId: seeded.asset.id,
    });
    await seeded.service.recordPartUsage(seeded.engineerAScope, visit.id, {
      partDescription: "Cleaning material",
      quantity: 1,
      quantityUnit: "each",
      usedAt: ARRIVED,
      usedByUserId: seeded.engineerAId,
      recordedByUserId: seeded.engineerAId,
      assetId: seeded.asset.id,
    });
    await seeded.service.recordRefrigerantEvent(seeded.engineerAScope, visit.id, {
      refrigerantType: "R404A",
      eventKind: "recovered",
      quantityKg: 0.25,
      occurredAt: ARRIVED,
      handledByUserId: seeded.engineerAId,
      recordedByUserId: seeded.engineerAId,
      assetId: seeded.asset.id,
    });
    await seeded.service.recordAssetOperationalCondition(seeded.engineerAScope, {
      assetId: seeded.asset.id,
      conditionKind: "operational",
      visitId: visit.id,
      workOrderId: seeded.workOrder.id,
      assertedAt: ARRIVED,
      assertedByUserId: seeded.engineerAId,
      recordedByUserId: seeded.engineerAId,
    });
    await seeded.service.recordRecommendedAction(seeded.engineerAScope, visit.id, {
      description: "Monitor temperature for 24 hours",
      recommendedAt: ARRIVED,
      recommendedByUserId: seeded.engineerAId,
      recordedByUserId: seeded.engineerAId,
      assetId: seeded.asset.id,
    });
    await seeded.service.recordVisitCustomerAcknowledgement(
      seeded.engineerAScope,
      visit.id,
      {
        acknowledgementText: "Site representative received the visit update",
        acknowledgerName: "Site representative",
        acknowledgedAt: ARRIVED,
        recordedByUserId: seeded.engineerAId,
      },
    );
    const evidence = await seeded.service.recordVisitEvidenceWithFile(
      seeded.engineerAScope,
      visit.id,
      {
        body: JPEG_BODY,
        originalFilename: "cold-room.jpg",
        mimeType: "image/jpeg",
        category: "AFTER_WORK",
        description: "Cold room after corrective action",
        userId: seeded.engineerAId,
        assetId: seeded.asset.id,
      },
    );
    assert.equal(evidence.recordedByUserId, seeded.engineerAId);
    assert.equal(
      new Uint8Array(
        await readFile(join(objectRoot!, seeded.engineerAScope.workspaceId, evidence.storedObjectId)),
      ).byteLength,
      JPEG_BODY.byteLength,
    );
    await seeded.service.recordVisitOutcome(seeded.engineerAScope, visit.id, {
      description: "Cold room returned to operating temperature",
      outcomeAt: ARRIVED,
      recordedByUserId: seeded.engineerAId,
      assetId: seeded.asset.id,
    });

    const departed = await seeded.service.recordVisitDeparture(
      seeded.engineerAScope,
      visit.id,
      { departedAt: DEPARTED },
    );
    assert.equal(departed.status, "departed");
    assert.equal(
      (await seeded.service.getWorkOrder(seeded.engineerAScope, seeded.workOrder.id))
        ?.status,
      "open",
    );
  });

  it("denies another member and actor spoofing through the engineer path", async () => {
    const seeded = await seed();

    await expectCode(
      () =>
        seeded.service.recordVisitArrival(
          seeded.engineerBScope,
          seeded.workOrder.id,
          { userId: seeded.engineerBId, arrivedAt: ARRIVED },
        ),
      "forbidden",
    );
    await expectCode(
      () =>
        seeded.service.recordVisitArrival(
          seeded.engineerAScope,
          seeded.workOrder.id,
          { userId: seeded.engineerBId, arrivedAt: ARRIVED },
        ),
      "forbidden",
    );

    const visit = await seeded.service.recordVisitArrival(
      seeded.engineerAScope,
      seeded.workOrder.id,
      { userId: seeded.engineerAId, arrivedAt: ARRIVED },
    );
    await expectCode(
      () =>
        seeded.service.recordFieldCapture(seeded.engineerBScope, visit.id, {
          captureKind: "condition",
          captureCode: "visual_condition",
          description: "Should not persist",
          observedAt: ARRIVED,
          userId: seeded.engineerBId,
        }),
      "forbidden",
    );
    await expectCode(
      () =>
        seeded.service.recordFieldCapture(seeded.engineerAScope, visit.id, {
          captureKind: "condition",
          captureCode: "visual_condition",
          description: "Should not spoof",
          observedAt: ARRIVED,
          userId: seeded.engineerBId,
        }),
      "forbidden",
    );
    await expectCode(
      () =>
        seeded.service.recordVisitEvidenceWithFile(seeded.engineerAScope, visit.id, {
          body: JPEG_BODY,
          originalFilename: "spoof.jpg",
          mimeType: "image/jpeg",
          category: "AFTER_WORK",
          userId: seeded.engineerBId,
          assetId: seeded.asset.id,
        }),
      "forbidden",
    );
    assert.deepEqual(
      await seeded.service.listFieldCapturesByVisit(
        seeded.engineerAScope,
        visit.id,
      ),
      [],
    );
  });

  it("denies unassigned members and resets authority after reassignment", async () => {
    const seeded = await seed();
    await seeded.service.clearWorkOrderAssignment(
      seeded.ownerScope,
      seeded.workOrder.id,
    );
    await expectCode(
      () =>
        seeded.service.recordVisitArrival(
          seeded.engineerAScope,
          seeded.workOrder.id,
          { userId: seeded.engineerAId, arrivedAt: ARRIVED },
        ),
      "forbidden",
    );

    await seeded.service.assignWorkOrder(seeded.ownerScope, seeded.workOrder.id, {
      userId: seeded.engineerAId,
    });
    const visit = await seeded.service.recordVisitArrival(
      seeded.engineerAScope,
      seeded.workOrder.id,
      { userId: seeded.engineerAId, arrivedAt: ARRIVED },
    );
    await seeded.service.recordVisitDeparture(seeded.engineerAScope, visit.id, {
      departedAt: DEPARTED,
    });
    await seeded.service.assignWorkOrder(seeded.ownerScope, seeded.workOrder.id, {
      userId: seeded.engineerBId,
    });
    await expectCode(
      () =>
        seeded.service.recordVisitArrival(
          seeded.engineerAScope,
          seeded.workOrder.id,
          { userId: seeded.engineerAId, arrivedAt: ARRIVED },
        ),
      "forbidden",
    );
    const nextVisit = await seeded.service.recordVisitArrival(
      seeded.engineerBScope,
      seeded.workOrder.id,
      { userId: seeded.engineerBId, arrivedAt: "2026-09-08T12:00:00.000Z" },
    );
    assert.equal(nextVisit.attendingUserId, seeded.engineerBId);
  });

  it("denies assigned-engineer arrival on closed or cancelled WorkOrders", async () => {
    const seeded = await seed();
    const closedOrder = await seeded.service.createWorkOrder(seeded.ownerScope, {
      siteId: (await seeded.service.getWorkOrder(seeded.ownerScope, seeded.workOrder.id))!
        .siteId,
      workReference: "WO-F23-CLOSED",
      workKind: "reactive",
      reportedCondition: "Closed job must stay closed",
    });
    await seeded.service.assignWorkOrder(seeded.ownerScope, closedOrder.id, {
      userId: seeded.engineerAId,
    });
    const visit = await seeded.service.recordVisitArrival(
      seeded.engineerAScope,
      closedOrder.id,
      { userId: seeded.engineerAId, arrivedAt: ARRIVED },
    );
    await completeWorkOrderFromVisit(
      seeded.service,
      seeded.ownerScope,
      closedOrder.id,
      visit,
      seeded.engineerAId,
      { outcomeAt: ARRIVED, departedAt: DEPARTED },
    );
    await expectCode(
      () =>
        seeded.service.recordVisitArrival(
          seeded.engineerAScope,
          closedOrder.id,
          { userId: seeded.engineerAId, arrivedAt: "2026-09-08T13:00:00.000Z" },
        ),
      "invalid_status",
    );

    const cancelledOrder = await seeded.service.createWorkOrder(seeded.ownerScope, {
      siteId: closedOrder.siteId,
      workReference: "WO-F23-CANCELLED",
      workKind: "reactive",
      reportedCondition: "Cancelled job must stay cancelled",
    });
    await seeded.service.assignWorkOrder(seeded.ownerScope, cancelledOrder.id, {
      userId: seeded.engineerAId,
    });
    await seeded.service.cancelWorkOrder(seeded.ownerScope, cancelledOrder.id, {
      reason: "Customer withdrew the call.",
    });
    await expectCode(
      () =>
        seeded.service.recordVisitArrival(
          seeded.engineerAScope,
          cancelledOrder.id,
          { userId: seeded.engineerAId, arrivedAt: "2026-09-08T14:00:00.000Z" },
        ),
      "invalid_status",
    );
  });

  it("keeps dispatch and WorkOrder completion on higher authority", async () => {
    const seeded = await seed();
    await expectCode(
      () =>
        seeded.service.scheduleWorkOrder(seeded.engineerAScope, seeded.workOrder.id, {
          scheduledStartAt: "2026-09-08T08:00:00.000Z",
          scheduledEndAt: "2026-09-08T10:00:00.000Z",
        }),
      "forbidden",
    );
    await expectCode(
      () =>
        seeded.service.assignWorkOrder(seeded.engineerAScope, seeded.workOrder.id, {
          userId: seeded.engineerBId,
        }),
      "forbidden",
    );
    await expectCode(
      () => seeded.service.closeWorkOrder(seeded.engineerAScope, seeded.workOrder.id),
      "forbidden",
    );
    await expectCode(
      () =>
        seeded.service.cancelWorkOrder(seeded.engineerAScope, seeded.workOrder.id, {
          reason: "Should remain office-only.",
        }),
      "forbidden",
    );
  });

  it("scopes ordinary engineer assigned-work listing to the authenticated assignee", async () => {
    const seeded = await seed();
    const own = await seeded.service.listWorkOrdersByAssignee(
      seeded.engineerAScope,
      seeded.engineerAId,
    );
    assert.deepEqual(
      own.map((row) => row.id),
      [seeded.workOrder.id],
    );
    assert.deepEqual(
      await seeded.service.listWorkOrdersByAssignee(
        seeded.engineerBScope,
        seeded.engineerAId,
      ),
      [],
    );
    const ownerView = await seeded.service.listWorkOrdersByAssignee(
      seeded.ownerScope,
      seeded.engineerAId,
    );
    assert.equal(ownerView[0]?.id, seeded.workOrder.id);
  });

  it("compensates assigned-engineer evidence storage without venture.update", async () => {
    const seeded = await seed();
    const visit = await seeded.service.recordVisitArrival(
      seeded.engineerAScope,
      seeded.workOrder.id,
      { userId: seeded.engineerAId, arrivedAt: ARRIVED },
    );
    const before = await seeded.service.listVisitEvidenceByVisit(
      seeded.engineerAScope,
      visit.id,
    );
    const baseStore = createFrigoraStore();
    let insertCalls = 0;
    const failingStore: FrigoraStore = {
      ...baseStore,
      insertVisitEvidence: async (evidence) => {
        insertCalls += 1;
        if (insertCalls === 1) {
          throw new FrigoraError("invalid_input", "simulated insert failure");
        }
        return baseStore.insertVisitEvidence(evidence);
      },
    };
    const compensatingService = createFrigoraService({
      store: failingStore,
      permissions: createPermissionService(createDbMembershipStore()),
    });

    await expectCode(
      () =>
        compensatingService.recordVisitEvidenceWithFile(seeded.engineerAScope, visit.id, {
          body: JPEG_BODY,
          originalFilename: "compensate.jpg",
          mimeType: "image/jpeg",
          category: "AFTER_WORK",
          userId: seeded.engineerAId,
          assetId: seeded.asset.id,
        }),
      "invalid_input",
    );
    assert.deepEqual(
      await seeded.service.listVisitEvidenceByVisit(seeded.engineerAScope, visit.id),
      before,
    );
    const leftover = await readdir(
      join(objectRoot!, seeded.engineerAScope.workspaceId),
    ).catch(() => []);
    assert.deepEqual(leftover, []);
  });

  it("keeps assigned-engineer evidence deletion bound to the assigned WorkOrder", async () => {
    const seeded = await seed();
    const visit = await seeded.service.recordVisitArrival(
      seeded.engineerAScope,
      seeded.workOrder.id,
      { userId: seeded.engineerAId, arrivedAt: ARRIVED },
    );
    const evidence = await seeded.service.recordVisitEvidenceWithFile(
      seeded.engineerAScope,
      visit.id,
      {
        body: JPEG_BODY,
        originalFilename: "bound.jpg",
        mimeType: "image/jpeg",
        category: "AFTER_WORK",
        userId: seeded.engineerAId,
        assetId: seeded.asset.id,
      },
    );
    assert.equal(evidence.recordedByUserId, seeded.engineerAId);
    await expectCode(
      () => seeded.service.removeVisitEvidence(seeded.engineerBScope, evidence.id),
      "forbidden",
    );
    const removed = await seeded.service.removeVisitEvidence(
      seeded.engineerAScope,
      evidence.id,
    );
    assert.ok(removed.removedAt);
    const tombstoned = await findStoredObjectById(evidence.storedObjectId);
    assert.ok(tombstoned?.deletedAt);
  });

  it("protects Frigora Visit Evidence bytes from unrelated members (RPV-002)", async () => {
    const seeded = await seed();
    const visit = await seeded.service.recordVisitArrival(
      seeded.engineerAScope,
      seeded.workOrder.id,
      { userId: seeded.engineerAId, arrivedAt: ARRIVED },
    );
    const evidence = await seeded.service.recordVisitEvidenceWithFile(
      seeded.engineerAScope,
      visit.id,
      {
        body: JPEG_BODY,
        originalFilename: "rpv002.jpg",
        mimeType: "image/jpeg",
        category: "TECHNICAL",
        userId: seeded.engineerAId,
        assetId: seeded.asset.id,
      },
    );
    const storage = getPlatform().storedObjects;

    const asAssignee = await storage.open({
      actorUserId: seeded.engineerAId,
      activeWorkspaceId: seeded.engineerAScope.workspaceId,
      objectId: evidence.storedObjectId,
    });
    assert.ok(asAssignee);
    assert.equal(asAssignee!.body.byteLength, JPEG_BODY.byteLength);

    const asOwner = await storage.open({
      actorUserId: seeded.ownerId,
      activeWorkspaceId: seeded.ownerScope.workspaceId,
      objectId: evidence.storedObjectId,
    });
    assert.ok(asOwner);

    const asUnrelated = await storage.open({
      actorUserId: seeded.engineerBId,
      activeWorkspaceId: seeded.engineerBScope.workspaceId,
      objectId: evidence.storedObjectId,
    });
    assert.equal(asUnrelated, null);

    const crossWorkspace = await storage.open({
      actorUserId: seeded.engineerAId,
      activeWorkspaceId: "ws-other" as WorkspaceId,
      objectId: evidence.storedObjectId,
    });
    assert.equal(crossWorkspace, null);
  });

  it("keeps Visit-attendee evidence read after reassignment without mutation authority (RPV-002)", async () => {
    const seeded = await seed();
    const visit = await seeded.service.recordVisitArrival(
      seeded.engineerAScope,
      seeded.workOrder.id,
      { userId: seeded.engineerAId, arrivedAt: ARRIVED },
    );
    const evidence = await seeded.service.recordVisitEvidenceWithFile(
      seeded.engineerAScope,
      visit.id,
      {
        body: JPEG_BODY,
        originalFilename: "handoff.jpg",
        mimeType: "image/jpeg",
        category: "TECHNICAL",
        userId: seeded.engineerAId,
        assetId: seeded.asset.id,
      },
    );
    await seeded.service.recordVisitDeparture(seeded.engineerAScope, visit.id, {
      departedAt: DEPARTED,
    });

    await seeded.service.assignWorkOrder(seeded.ownerScope, seeded.workOrder.id, {
      userId: seeded.engineerBId,
    });

    const storage = getPlatform().storedObjects;
    const asNewAssignee = await storage.open({
      actorUserId: seeded.engineerBId,
      activeWorkspaceId: seeded.engineerBScope.workspaceId,
      objectId: evidence.storedObjectId,
    });
    assert.ok(asNewAssignee);

    const asFormerAssigneeAttendee = await storage.open({
      actorUserId: seeded.engineerAId,
      activeWorkspaceId: seeded.engineerAScope.workspaceId,
      objectId: evidence.storedObjectId,
    });
    assert.ok(asFormerAssigneeAttendee);

    await expectCode(
      () => seeded.service.removeVisitEvidence(seeded.engineerAScope, evidence.id),
      "invalid_status",
    );
    // Stale assignment mutation on a fresh open Visit after reassignment:
    const visitB = await seeded.service.recordVisitArrival(
      seeded.engineerBScope,
      seeded.workOrder.id,
      { userId: seeded.engineerBId, arrivedAt: "2026-09-08T12:00:00.000Z" },
    );
    const evidenceB = await seeded.service.recordVisitEvidenceWithFile(
      seeded.engineerBScope,
      visitB.id,
      {
        body: JPEG_BODY,
        originalFilename: "b.jpg",
        mimeType: "image/jpeg",
        category: "TECHNICAL",
        userId: seeded.engineerBId,
        assetId: seeded.asset.id,
      },
    );
    await expectCode(
      () => seeded.service.removeVisitEvidence(seeded.engineerAScope, evidenceB.id),
      "forbidden",
    );
  });

  it("denies former assignee evidence byte read when they never attended the Visit (RPV-002)", async () => {
    const seeded = await seed();
    // Attendance can differ from assignment: B attends while A is assignee.
    const visit = await seeded.service.recordVisitArrival(
      seeded.ownerScope,
      seeded.workOrder.id,
      { userId: seeded.engineerBId, arrivedAt: ARRIVED },
    );
    const evidence = await seeded.service.recordVisitEvidenceWithFile(
      seeded.ownerScope,
      visit.id,
      {
        body: JPEG_BODY,
        originalFilename: "owner-recorded.jpg",
        mimeType: "image/jpeg",
        category: "TECHNICAL",
        description: null,
        userId: seeded.ownerId,
        assetId: seeded.asset.id,
      },
    );
    await seeded.service.recordVisitDeparture(seeded.ownerScope, visit.id, {
      departedAt: DEPARTED,
    });

    // Reassign away from A (A never attended).
    await seeded.service.assignWorkOrder(seeded.ownerScope, seeded.workOrder.id, {
      userId: seeded.engineerBId,
    });

    const storage = getPlatform().storedObjects;
    const asFormerAssigneeOnly = await storage.open({
      actorUserId: seeded.engineerAId,
      activeWorkspaceId: seeded.engineerAScope.workspaceId,
      objectId: evidence.storedObjectId,
    });
    assert.equal(asFormerAssigneeOnly, null);

    const asAttendeeAndAssignee = await storage.open({
      actorUserId: seeded.engineerBId,
      activeWorkspaceId: seeded.engineerBScope.workspaceId,
      objectId: evidence.storedObjectId,
    });
    assert.ok(asAttendeeAndAssignee);
  });

  it("preserves higher authority and assignment-attendance separation", async () => {
    const seeded = await seed();
    const visit = await seeded.service.recordVisitArrival(
      seeded.ownerScope,
      seeded.workOrder.id,
      { userId: seeded.engineerBId, arrivedAt: ARRIVED },
    );

    assert.equal(visit.attendingUserId, seeded.engineerBId);
    assert.equal(seeded.workOrder.assignedUserId, seeded.engineerAId);
    assert.equal("assignedEngineerId" in seeded.workOrder, false);
    assert.equal("jobStatus" in seeded.workOrder, false);
    assert.equal("dispatchStatus" in seeded.workOrder, false);
  });

  it("keeps ordinary engineer routes assignment-scoped and enriches My Work", () => {
    const workPage = readFileSync(
      join(WEB_ROOT, "app/(app)/ventures/[ventureId]/work/page.tsx"),
      "utf8",
    );
    const operationsPage = readFileSync(
      join(WEB_ROOT, "app/(app)/ventures/[ventureId]/operations/page.tsx"),
      "utf8",
    );
    const detailPage = readFileSync(
      join(WEB_ROOT, "app/(app)/ventures/[ventureId]/work/[workOrderId]/page.tsx"),
      "utf8",
    );
    const myWork = readFileSync(
      join(WEB_ROOT, "modules/frigora/app/screens/my-work-screen.tsx"),
      "utf8",
    );
    const views = readFileSync(
      join(WEB_ROOT, "modules/frigora/app/views.ts"),
      "utf8",
    );

    assert.match(workPage, /if \(!ctx\.canWrite\)/);
    assert.match(operationsPage, /if \(!ctx\.canWrite\)/);
    assert.match(
      detailPage,
      /!ctx\.canWrite && view\.workOrder\.assignedUserId !== ctx\.sessionUserId/,
    );
    assert.match(myWork, /Service window/);
    assert.match(myWork, /Assignment response/);
    assert.match(myWork, /Continue visit/);
    assert.match(views, /userId: sessionUserId/);
    assert.match(views, /workOrder\.assignedUserId === sessionUserId/);
  });
});
