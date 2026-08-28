import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { platformVentureRegistry } from "@/core/venture-definition/catalog";
import type { Role, UserId, VentureId, WorkspaceId } from "@/contracts";
import { createPermissionService } from "@/platform/permissions/service";
import { createDbMembershipStore } from "@/platform/permissions/membership-store";
import { ensureSchema } from "@/platform/persistence/db";
import { getPersistence, resetPersistenceLifecycle } from "@/platform/persistence/repositories";
import type { PersistedVenture } from "@/platform/persistence/repositories/ports";
import { FrigoraError } from "./errors";
import { createFrigoraService } from "./service";
import type { FrigoraRefrigerantEvent, FrigoraScope } from "./types";

const NOW = "2026-08-28T00:00:00.000Z";
const ARRIVED = "2026-08-28T10:00:00.000Z";
const OCCURRED = "2026-08-28T10:30:00.000Z";
const DEPARTED = "2026-08-28T11:00:00.000Z";
const EARLY_OCCURRED = "2026-08-28T09:00:00.000Z";
const LATE_OCCURRED = "2026-08-28T12:00:00.000Z";

beforeEach(async () => {
  await resetPersistenceLifecycle();
  await ensureSchema();
});

async function seed(options: {
  reset?: boolean;
  workspaceId?: WorkspaceId;
  ventureId?: VentureId;
  userId?: UserId;
  role?: Role;
  definitionId?: string;
  definitionVersion?: string;
} = {}) {
  if (options.reset !== false) {
    await resetPersistenceLifecycle();
    await ensureSchema();
  }
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
      definitionId: options.definitionId ?? "frigora",
      definitionVersion: options.definitionVersion ?? "0.11.0",
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
    definitionVersion: "0.11.0",
    lifecycle: "operating",
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

async function expectCode(run: () => Promise<unknown>, code: FrigoraError["code"]) {
  await assert.rejects(run, (error: unknown) => {
    assert.ok(error instanceof FrigoraError, String(error));
    assert.equal(error.code, code, error.message);
    return true;
  });
}

async function seedHierarchy(
  service: ReturnType<typeof createFrigoraService>,
  scope: FrigoraScope,
) {
  const customer = await service.createCustomer(scope, {
    code: "FUELCO",
    displayName: "FuelCo",
  });
  const site = await service.createSite(scope, {
    customerId: customer.id,
    code: "SANDTON-N",
    name: "Sandton North",
  });
  const asset = await service.createAsset(scope, {
    siteId: site.id,
    tag: "FZ-118",
    name: "Display freezer",
    refrigerantType: "R404A",
    designTargetCelsius: -18,
  });
  const workOrder = await service.createWorkOrder(scope, {
    siteId: site.id,
    workReference: "WO-1864",
    workKind: "reactive",
    primaryAssetId: asset.id,
    reportedCondition: "display freezer warm",
  });
  return { customer, site, asset, workOrder };
}

async function seedOpenVisit(
  service: ReturnType<typeof createFrigoraService>,
  scope: FrigoraScope,
  attendeeId: UserId,
) {
  const { workOrder, asset } = await seedHierarchy(service, scope);
  const visit = await service.recordVisitArrival(scope, workOrder.id, {
    userId: attendeeId,
    arrivedAt: ARRIVED,
  });
  return { workOrder, asset, visit };
}

async function addMember(workspaceId: WorkspaceId, userId: UserId) {
  await getPersistence().memberships.setRole({
    userId,
    workspaceId,
    role: "member",
    createdAt: NOW,
  });
}

function recordInput(
  overrides: Partial<{
    refrigerantType: string;
    eventKind: "added" | "recovered" | "removed";
    quantityKg: number;
    reason: string | null;
    cylinderReference: string | null;
    occurredAt: string;
    handledByUserId: UserId;
    recordedByUserId: UserId;
    assetId: string | null;
  }> = {},
) {
  return {
    refrigerantType: overrides.refrigerantType ?? "R404A",
    eventKind: overrides.eventKind ?? "added",
    quantityKg: overrides.quantityKg ?? 2,
    reason: overrides.reason,
    cylinderReference: overrides.cylinderReference,
    occurredAt: overrides.occurredAt ?? OCCURRED,
    handledByUserId: overrides.handledByUserId ?? ("user-attendee" as UserId),
    recordedByUserId: overrides.recordedByUserId ?? ("user-attendee" as UserId),
    assetId: overrides.assetId,
  };
}

function assertNoForbiddenSemantics(record: FrigoraRefrigerantEvent) {
  assert.equal("quantityUnit" in record, false);
  assert.equal("leakQuantity" in record, false);
  assert.equal("leakRate" in record, false);
  assert.equal("leakMass" in record, false);
  assert.equal("inferredLeak" in record, false);
  assert.equal("inventoryTransactionId" in record, false);
  assert.equal("cylinderId" in record, false);
  assert.equal("stockLocationId" in record, false);
  assert.equal("evidence" in record, false);
  assert.equal("evidenceId" in record, false);
  assert.equal("priority" in record, false);
  assert.equal("status" in record, false);
  assert.equal("description" in record, false);
  assert.equal("recommendedAction" in record, false);
}

describe("Frigora Refrigerant event", () => {
  it("records valid added, recovered, and removed events with tenant fields and derived workOrderId", async () => {
    const owner = await seed();
    const handlerId = "user-handler" as UserId;
    const recorderId = "user-recorder" as UserId;
    await addMember(owner.workspaceId, handlerId);
    await addMember(owner.workspaceId, recorderId);
    const { visit } = await seedOpenVisit(owner.service, owner.scope, handlerId);

    const added = await owner.service.recordRefrigerantEvent(owner.scope, visit.id, {
      refrigerantType: "R404A",
      eventKind: "added",
      quantityKg: 2,
      occurredAt: OCCURRED,
      handledByUserId: handlerId,
      recordedByUserId: recorderId,
      reason: "Charge adjusted after valve-core replacement.",
      cylinderReference: "CYL-8842",
    });
    assert.equal(added.eventKind, "added");
    assert.equal(added.quantityKg, 2);
    assert.equal(added.refrigerantType, "R404A");
    assert.equal(added.visitId, visit.id);
    assert.equal(added.workOrderId, visit.workOrderId);
    assert.equal(added.handledByUserId, handlerId);
    assert.equal(added.recordedByUserId, recorderId);
    assert.equal(added.reason, "Charge adjusted after valve-core replacement.");
    assert.equal(added.cylinderReference, "CYL-8842");
    assertNoForbiddenSemantics(added);

    const recovered = await owner.service.recordRefrigerantEvent(
      owner.scope,
      visit.id,
      recordInput({
        eventKind: "recovered",
        quantityKg: 1.5,
        occurredAt: "2026-08-28T10:35:00.000Z",
        handledByUserId: handlerId,
        recordedByUserId: recorderId,
      }),
    );
    assert.equal(recovered.eventKind, "recovered");

    const removed = await owner.service.recordRefrigerantEvent(
      owner.scope,
      visit.id,
      recordInput({
        eventKind: "removed",
        quantityKg: 0.5,
        occurredAt: "2026-08-28T10:40:00.000Z",
        handledByUserId: handlerId,
        recordedByUserId: recorderId,
      }),
    );
    assert.equal(removed.eventKind, "removed");

    const loaded = await owner.service.getRefrigerantEvent(owner.scope, added.id);
    assert.equal(loaded?.id, added.id);
  });

  it("rejects unsupported event kinds including transferred", async () => {
    const owner = await seed();
    const attendeeId = "user-attendee" as UserId;
    await addMember(owner.workspaceId, attendeeId);
    const { visit } = await seedOpenVisit(owner.service, owner.scope, attendeeId);
    await expectCode(
      () =>
        owner.service.recordRefrigerantEvent(owner.scope, visit.id, {
          ...recordInput(),
          eventKind: "transferred" as "added",
        }),
      "invalid_kind",
    );
    await expectCode(
      () =>
        owner.service.recordRefrigerantEvent(owner.scope, visit.id, {
          ...recordInput(),
          eventKind: "leaked" as "added",
        }),
      "invalid_kind",
    );
  });

  it("validates quantityKg as positive finite kilograms without quantityUnit", async () => {
    const owner = await seed();
    const attendeeId = "user-attendee" as UserId;
    await addMember(owner.workspaceId, attendeeId);
    const { visit } = await seedOpenVisit(owner.service, owner.scope, attendeeId);

    const halfKg = await owner.service.recordRefrigerantEvent(
      owner.scope,
      visit.id,
      recordInput({ quantityKg: 0.5 }),
    );
    assert.equal(halfKg.quantityKg, 0.5);
    assert.equal("quantityUnit" in halfKg, false);

    for (const quantityKg of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      await expectCode(
        () => owner.service.recordRefrigerantEvent(owner.scope, visit.id, recordInput({ quantityKg })),
        "invalid_input",
      );
    }
  });

  it("requires trimmed refrigerantType and accepts optional reason and cylinderReference", async () => {
    const owner = await seed();
    const attendeeId = "user-attendee" as UserId;
    await addMember(owner.workspaceId, attendeeId);
    const { visit } = await seedOpenVisit(owner.service, owner.scope, attendeeId);

    await expectCode(
      () =>
        owner.service.recordRefrigerantEvent(owner.scope, visit.id, {
          ...recordInput(),
          refrigerantType: "   ",
        }),
      "invalid_input",
    );

    const trimmed = await owner.service.recordRefrigerantEvent(owner.scope, visit.id, {
      ...recordInput(),
      refrigerantType: "  R404A  ",
    });
    assert.equal(trimmed.refrigerantType, "R404A");

    const minimal = await owner.service.recordRefrigerantEvent(
      owner.scope,
      visit.id,
      recordInput({ reason: undefined, cylinderReference: undefined, occurredAt: "2026-08-28T10:32:00.000Z" }),
    );
    assert.equal(minimal.reason, null);
    assert.equal(minimal.cylinderReference, null);
  });

  it("allows multiple events per visit and orders by occurredAt then id", async () => {
    const owner = await seed();
    const attendeeId = "user-attendee" as UserId;
    await addMember(owner.workspaceId, attendeeId);
    const { workOrder, asset, visit } = await seedOpenVisit(owner.service, owner.scope, attendeeId);

    const first = await owner.service.recordRefrigerantEvent(
      owner.scope,
      visit.id,
      recordInput({ occurredAt: "2026-08-28T10:15:00.000Z", quantityKg: 1 }),
    );
    const second = await owner.service.recordRefrigerantEvent(
      owner.scope,
      visit.id,
      recordInput({ occurredAt: "2026-08-28T10:45:00.000Z", quantityKg: 2, assetId: asset.id }),
    );
    const listed = await owner.service.listRefrigerantEventsByVisit(owner.scope, visit.id);
    assert.equal(listed.length, 2);
    assert.deepEqual(listed.map((event) => event.id), [first.id, second.id]);
    assert.deepEqual(
      (await owner.service.listRefrigerantEventsByWorkOrder(owner.scope, workOrder.id)).map(
        (event) => event.id,
      ),
      [first.id, second.id],
    );
    assert.deepEqual(
      (await owner.service.listRefrigerantEventsByAsset(owner.scope, asset.id)).map(
        (event) => event.id,
      ),
      [second.id],
    );
  });

  it("accepts optional asset and null asset; rejects wrong-site and cross-venture assets", async () => {
    const owner = await seed();
    const attendeeId = "user-attendee" as UserId;
    await addMember(owner.workspaceId, attendeeId);
    const { customer, workOrder, asset } = await seedHierarchy(owner.service, owner.scope);
    const visit = await owner.service.recordVisitArrival(owner.scope, workOrder.id, {
      userId: attendeeId,
      arrivedAt: ARRIVED,
    });
    const withAsset = await owner.service.recordRefrigerantEvent(owner.scope, visit.id, {
      ...recordInput(),
      assetId: asset.id,
    });
    assert.equal(withAsset.assetId, asset.id);
    const nullAsset = await owner.service.recordRefrigerantEvent(owner.scope, visit.id, {
      ...recordInput(),
      assetId: null,
      occurredAt: "2026-08-28T10:31:00.000Z",
    });
    assert.equal(nullAsset.assetId, null);

    const otherSite = await owner.service.createSite(owner.scope, {
      customerId: customer.id,
      code: "OTHER",
      name: "Other site",
    });
    const foreignAsset = await owner.service.createAsset(owner.scope, {
      siteId: otherSite.id,
      tag: "FOREIGN",
    });
    await expectCode(
      () =>
        owner.service.recordRefrigerantEvent(owner.scope, visit.id, {
          ...recordInput(),
          assetId: foreignAsset.id,
        }),
      "invalid_input",
    );

    const otherVenture = "ven-other-asset" as VentureId;
    const owner2 = await seed({
      reset: false,
      ventureId: otherVenture,
      userId: owner.userId,
    });
    const customer2 = await owner2.service.createCustomer(owner2.scope, {
      code: "OTHER",
      displayName: "Other",
    });
    const site2 = await owner2.service.createSite(owner2.scope, {
      customerId: customer2.id,
      code: "S2",
      name: "Site 2",
    });
    const otherAsset = await owner2.service.createAsset(owner2.scope, {
      siteId: site2.id,
      tag: "OTHER-ASSET",
    });
    await expectCode(
      () =>
        owner.service.recordRefrigerantEvent(owner.scope, visit.id, {
          ...recordInput(),
          assetId: otherAsset.id,
        }),
      "not_found",
    );
  });

  it("requires workspace members for handler and recorder with flexible provenance", async () => {
    const owner = await seed();
    const attendeeId = "user-attendee" as UserId;
    const handlerId = "user-handler" as UserId;
    const recorderId = "user-recorder" as UserId;
    const assigneeId = "user-assignee" as UserId;
    await addMember(owner.workspaceId, attendeeId);
    await addMember(owner.workspaceId, handlerId);
    await addMember(owner.workspaceId, recorderId);
    await addMember(owner.workspaceId, assigneeId);
    const { workOrder, visit } = await seedOpenVisit(owner.service, owner.scope, attendeeId);
    await owner.service.assignWorkOrder(owner.scope, workOrder.id, { userId: assigneeId });

    await expectCode(
      () =>
        owner.service.recordRefrigerantEvent(owner.scope, visit.id, {
          ...recordInput(),
          handledByUserId: "user-outsider",
        }),
      "not_found",
    );
    await expectCode(
      () =>
        owner.service.recordRefrigerantEvent(owner.scope, visit.id, {
          ...recordInput(),
          recordedByUserId: "user-outsider",
        }),
      "not_found",
    );

    const same = await owner.service.recordRefrigerantEvent(owner.scope, visit.id, {
      ...recordInput(),
      handledByUserId: attendeeId,
      recordedByUserId: attendeeId,
    });
    assert.equal(same.handledByUserId, same.recordedByUserId);

    const different = await owner.service.recordRefrigerantEvent(owner.scope, visit.id, {
      ...recordInput(),
      handledByUserId: handlerId,
      recordedByUserId: recorderId,
      occurredAt: "2026-08-28T10:33:00.000Z",
    });
    assert.notEqual(different.handledByUserId, different.recordedByUserId);
    assert.notEqual(different.handledByUserId, attendeeId);
    assert.notEqual(different.handledByUserId, assigneeId);
  });

  it("enforces occurredAt within visit attendance and rejects cancelled visits", async () => {
    const owner = await seed();
    const attendeeId = "user-attendee" as UserId;
    await addMember(owner.workspaceId, attendeeId);
    const { visit } = await seedOpenVisit(owner.service, owner.scope, attendeeId);

    await expectCode(
      () =>
        owner.service.recordRefrigerantEvent(
          owner.scope,
          visit.id,
          recordInput({ occurredAt: EARLY_OCCURRED }),
        ),
      "invalid_input",
    );

    const departed = await owner.service.recordVisitDeparture(owner.scope, visit.id, {
      departedAt: DEPARTED,
    });
    await expectCode(
      () =>
        owner.service.recordRefrigerantEvent(
          owner.scope,
          departed.id,
          recordInput({ occurredAt: LATE_OCCURRED }),
        ),
      "invalid_input",
    );
    const delayed = await owner.service.recordRefrigerantEvent(
      owner.scope,
      departed.id,
      recordInput({ occurredAt: OCCURRED }),
    );
    assert.equal(delayed.occurredAt, OCCURRED);

    const owner2 = await seed({
      reset: false,
      ventureId: "ven-cancel" as VentureId,
      userId: owner.userId,
    });
    const { visit: visit2 } = await seedOpenVisit(owner2.service, owner2.scope, attendeeId);
    const recorded = await owner2.service.recordRefrigerantEvent(
      owner2.scope,
      visit2.id,
      recordInput(),
    );
    await owner2.service.cancelVisit(owner2.scope, visit2.id);
    await expectCode(
      () => owner2.service.recordRefrigerantEvent(owner2.scope, visit2.id, recordInput()),
      "invalid_status",
    );
    const persisted = await owner2.service.getRefrigerantEvent(owner2.scope, recorded.id);
    assert.equal(persisted?.id, recorded.id);
  });

  it("preserves events after work order close or cancel and allows delayed entry", async () => {
    const owner = await seed();
    const attendeeId = "user-attendee" as UserId;
    await addMember(owner.workspaceId, attendeeId);
    const { workOrder, visit } = await seedOpenVisit(owner.service, owner.scope, attendeeId);

    const beforeClose = await owner.service.recordRefrigerantEvent(
      owner.scope,
      visit.id,
      recordInput({ quantityKg: 1 }),
    );
    await owner.service.closeWorkOrder(owner.scope, workOrder.id);
    const afterClose = await owner.service.recordRefrigerantEvent(
      owner.scope,
      visit.id,
      recordInput({ quantityKg: 2, occurredAt: "2026-08-28T10:34:00.000Z" }),
    );
    assert.equal(afterClose.workOrderId, workOrder.id);
    assert.equal(
      (await owner.service.getRefrigerantEvent(owner.scope, beforeClose.id))?.id,
      beforeClose.id,
    );

    const owner2 = await seed({
      reset: false,
      ventureId: "ven-cancel-delay" as VentureId,
      userId: owner.userId,
    });
    const { workOrder: wo2, visit: visit2 } = await seedOpenVisit(
      owner2.service,
      owner2.scope,
      attendeeId,
    );
    const beforeCancel = await owner2.service.recordRefrigerantEvent(
      owner2.scope,
      visit2.id,
      recordInput(),
    );
    await owner2.service.cancelWorkOrder(owner2.scope, wo2.id);
    const afterCancel = await owner2.service.recordRefrigerantEvent(
      owner2.scope,
      visit2.id,
      recordInput({ occurredAt: "2026-08-28T10:36:00.000Z", quantityKg: 3 }),
    );
    assert.equal(afterCancel.workOrderId, wo2.id);
    assert.equal(
      (await owner2.service.getRefrigerantEvent(owner2.scope, beforeCancel.id))?.id,
      beforeCancel.id,
    );
  });

  it("does not mutate asset configuration, visit, work order, or other visit facts", async () => {
    const owner = await seed();
    const assigneeId = "user-assignee" as UserId;
    const attendeeId = "user-attendee" as UserId;
    const recorderId = "user-recorder" as UserId;
    await addMember(owner.workspaceId, assigneeId);
    await addMember(owner.workspaceId, attendeeId);
    await addMember(owner.workspaceId, recorderId);
    const { workOrder, asset, visit } = await seedOpenVisit(owner.service, owner.scope, attendeeId);
    await owner.service.assignWorkOrder(owner.scope, workOrder.id, { userId: assigneeId });

    const capture = await owner.service.recordFieldCapture(owner.scope, visit.id, {
      captureKind: "measurement",
      captureCode: "temperature",
      valueNumeric: -8,
      valueUnit: "celsius",
      observedAt: OCCURRED,
      userId: attendeeId,
    });
    const finding = await owner.service.recordTechnicalFinding(owner.scope, visit.id, {
      findingKind: "confirmed_fault",
      description: "service-valve leak",
      assertedAt: OCCURRED,
      userId: attendeeId,
    });
    const action = await owner.service.recordCorrectiveAction(owner.scope, visit.id, {
      description: "Replaced valve core",
      performedAt: OCCURRED,
      performedByUserId: attendeeId,
      recordedByUserId: recorderId,
    });
    const outcome = await owner.service.recordVisitOutcome(owner.scope, visit.id, {
      description: "Cooling restored",
      outcomeAt: OCCURRED,
      recordedByUserId: recorderId,
    });
    const recommendation = await owner.service.recordRecommendedAction(owner.scope, visit.id, {
      description: "Return for pressure test follow-up",
      recommendedAt: OCCURRED,
      recommendedByUserId: attendeeId,
      recordedByUserId: recorderId,
    });

    await owner.service.recordRefrigerantEvent(owner.scope, visit.id, {
      ...recordInput(),
      assetId: asset.id,
      reason: "Charge adjusted after valve-core replacement.",
    });

    const loadedAsset = await owner.service.getAsset(owner.scope, asset.id);
    assert.equal(loadedAsset?.refrigerantType, "R404A");
    const loadedWo = await owner.service.getWorkOrder(owner.scope, workOrder.id);
    const loadedVisit = await owner.service.getVisit(owner.scope, visit.id);
    assert.equal(loadedWo?.status, "open");
    assert.equal(loadedWo?.assignedUserId, assigneeId);
    assert.equal(loadedVisit?.status, "open");
    assert.equal(loadedVisit?.departedAt, null);
    assert.equal((await owner.service.getFieldCapture(owner.scope, capture.id))?.valueNumeric, -8);
    assert.equal(
      (await owner.service.getTechnicalFinding(owner.scope, finding.id))?.description,
      "service-valve leak",
    );
    assert.equal(
      (await owner.service.getCorrectiveAction(owner.scope, action.id))?.description,
      "Replaced valve core",
    );
    assert.equal(
      (await owner.service.getVisitOutcome(owner.scope, outcome.id))?.description,
      "Cooling restored",
    );
    assert.equal(
      (await owner.service.getRecommendedAction(owner.scope, recommendation.id))?.description,
      "Return for pressure test follow-up",
    );
  });

  it("preserves refrigerant added ≠ refrigerant leaked semantics", async () => {
    const owner = await seed();
    const attendeeId = "user-attendee" as UserId;
    await addMember(owner.workspaceId, attendeeId);
    const { visit } = await seedOpenVisit(owner.service, owner.scope, attendeeId);

    const added = await owner.service.recordRefrigerantEvent(owner.scope, visit.id, {
      refrigerantType: "R404A",
      eventKind: "added",
      quantityKg: 2,
      reason: "Possible leak noted on finding; 2 kg added to restore charge.",
      occurredAt: OCCURRED,
      handledByUserId: attendeeId,
      recordedByUserId: attendeeId,
    });
    assert.equal(added.eventKind, "added");
    assert.equal(added.quantityKg, 2);
    assertNoForbiddenSemantics(added);
    assert.match(added.reason ?? "", /Possible leak/);
  });

  it("does not require corrective action, visit outcome, or recommended action prerequisites", async () => {
    const owner = await seed();
    const attendeeId = "user-attendee" as UserId;
    await addMember(owner.workspaceId, attendeeId);
    const { visit } = await seedOpenVisit(owner.service, owner.scope, attendeeId);

    const beforeOthers = await owner.service.recordRefrigerantEvent(
      owner.scope,
      visit.id,
      recordInput(),
    );
    await owner.service.recordCorrectiveAction(owner.scope, visit.id, {
      description: "Replaced valve core",
      performedAt: OCCURRED,
      performedByUserId: attendeeId,
      recordedByUserId: attendeeId,
    });
    await owner.service.recordVisitOutcome(owner.scope, visit.id, {
      description: "Cooling restored",
      outcomeAt: OCCURRED,
      recordedByUserId: attendeeId,
    });
    await owner.service.recordRecommendedAction(owner.scope, visit.id, {
      description: "Schedule follow-up",
      recommendedAt: OCCURRED,
      recommendedByUserId: attendeeId,
      recordedByUserId: attendeeId,
    });
    const afterOthers = await owner.service.recordRefrigerantEvent(
      owner.scope,
      visit.id,
      recordInput({ occurredAt: "2026-08-28T10:37:00.000Z", eventKind: "recovered", quantityKg: 1 }),
    );
    assert.notEqual(beforeOthers.id, afterOthers.id);
  });

  it("does not create platform recommendations or workforce actions", async () => {
    const owner = await seed();
    const attendeeId = "user-attendee" as UserId;
    await addMember(owner.workspaceId, attendeeId);
    const { visit } = await seedOpenVisit(owner.service, owner.scope, attendeeId);
    const before = (await getPersistence().recommendations.listForWorkspace(owner.workspaceId))
      .length;
    await owner.service.recordRefrigerantEvent(owner.scope, visit.id, recordInput());
    const after = (await getPersistence().recommendations.listForWorkspace(owner.workspaceId))
      .length;
    assert.equal(after, before);
    assert.equal("listAssetHistory" in owner.service, false);
    assert.equal("listServiceHistory" in owner.service, false);
    assert.equal("recordProposedAction" in owner.service, false);
  });

  it("scopes reads and rejects non-frigora venture", async () => {
    const owner = await seed();
    const attendeeId = "user-attendee" as UserId;
    await addMember(owner.workspaceId, attendeeId);
    const { workOrder, asset, visit } = await seedOpenVisit(owner.service, owner.scope, attendeeId);
    const event = await owner.service.recordRefrigerantEvent(
      owner.scope,
      visit.id,
      recordInput({ assetId: asset.id }),
    );

    const otherVenture = "ven-other-read" as VentureId;
    await getPersistence().ventures.insert(
      ventureRow({
        id: otherVenture,
        workspaceId: owner.workspaceId,
        slug: "other-read",
      }),
    );
    const otherScope = { ...owner.scope, ventureId: otherVenture };
    assert.equal(await owner.service.getRefrigerantEvent(otherScope, event.id), null);
    assert.deepEqual(await owner.service.listRefrigerantEventsByVisit(otherScope, visit.id), []);
    assert.deepEqual(
      await owner.service.listRefrigerantEventsByWorkOrder(otherScope, workOrder.id),
      [],
    );
    assert.deepEqual(await owner.service.listRefrigerantEventsByAsset(otherScope, asset.id), []);

    const otherWorkspace = "ws-other" as WorkspaceId;
    await getPersistence().organisations.insert({
      id: otherWorkspace,
      name: "Other",
      slug: "other",
      createdAt: NOW,
    });
    await getPersistence().memberships.setRole({
      userId: owner.userId,
      workspaceId: otherWorkspace,
      role: "owner",
      createdAt: NOW,
    });
    const crossWorkspaceScope = {
      userId: owner.userId,
      workspaceId: otherWorkspace,
      ventureId: owner.ventureId,
    };
    assert.equal(await owner.service.getRefrigerantEvent(crossWorkspaceScope, event.id), null);

    const { scope, service } = await seed({ definitionId: "ventureos.company" });
    await expectCode(
      () => service.recordRefrigerantEvent(scope, visit.id, recordInput()),
      "not_frigora",
    );
  });

  it("supports persisted Frigora 0.10.0 instance for prior capabilities", async () => {
    const owner = await seed({ definitionVersion: "0.10.0" });
    const attendeeId = "user-attendee" as UserId;
    await addMember(owner.workspaceId, attendeeId);
    const { visit } = await seedOpenVisit(owner.service, owner.scope, attendeeId);
    const recommendation = await owner.service.recordRecommendedAction(owner.scope, visit.id, {
      description: "Replace liquid-line drier",
      recommendedAt: OCCURRED,
      recommendedByUserId: attendeeId,
      recordedByUserId: attendeeId,
    });
    assert.equal(recommendation.description, "Replace liquid-line drier");
  });

  it("resolves frigora@0.11.0 from catalog with refrigerant event admission", () => {
    assert.equal(platformVentureRegistry.resolve("frigora").version, "0.11.0");
    assert.match(platformVentureRegistry.resolve("frigora").description, /refrigerant events/);
    assert.match(platformVentureRegistry.resolve("frigora").description, /parts/);
    assert.match(platformVentureRegistry.resolve("frigora").description, /cylinder inventory/);
    assert.match(platformVentureRegistry.resolve("frigora").description, /employee agents/);
  });
});
