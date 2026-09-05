import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { platformVentureRegistry } from "@/core/venture-definition/catalog";
import type { Role, UserId, VentureId, WorkspaceId } from "@/contracts";
import { createPermissionService } from "@/platform/permissions/service";
import { createDbMembershipStore } from "@/platform/permissions/membership-store";
import { ensureSchema } from "@/platform/persistence/db";
import { getPersistence, resetPersistenceLifecycle } from "@/platform/persistence/repositories";
import { closeFrigoraPersistenceAfterFile } from "./test-persistence-lifecycle";
import {
  cancelWorkOrderAfterDepartingOpenVisit,
  completeWorkOrderFromVisit,
} from "./test-work-execution";
import type { PersistedVenture } from "@/platform/persistence/repositories/ports";
import { FrigoraError } from "./errors";
import { createFrigoraService } from "./service";
import type { FrigoraPartUsage, FrigoraPartUsageUnit, FrigoraScope } from "./types";
import { FRIGORA_PART_USAGE_UNITS } from "./types";

const NOW = "2026-08-28T00:00:00.000Z";
const ARRIVED = "2026-08-28T10:00:00.000Z";
const USED = "2026-08-28T10:30:00.000Z";
const DEPARTED = "2026-08-28T11:00:00.000Z";
const EARLY_USED = "2026-08-28T09:00:00.000Z";
const LATE_USED = "2026-08-28T12:00:00.000Z";

closeFrigoraPersistenceAfterFile();

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
      definitionVersion: options.definitionVersion ?? "0.16.0",
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
    definitionVersion: "0.16.0",
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
    partDescription: string;
    quantity: number;
    quantityUnit: FrigoraPartUsageUnit;
    notes: string | null;
    usedAt: string;
    usedByUserId: UserId;
    recordedByUserId: UserId;
    assetId: string | null;
  }> = {},
) {
  return {
    partDescription: overrides.partDescription ?? "Valve core",
    quantity: overrides.quantity ?? 1,
    quantityUnit: overrides.quantityUnit ?? "each",
    notes: overrides.notes,
    usedAt: overrides.usedAt ?? USED,
    usedByUserId: overrides.usedByUserId ?? ("user-attendee" as UserId),
    recordedByUserId: overrides.recordedByUserId ?? ("user-attendee" as UserId),
    assetId: overrides.assetId,
  };
}

function assertNoForbiddenSemantics(record: FrigoraPartUsage) {
  assert.equal("sku" in record, false);
  assert.equal("catalogueId" in record, false);
  assert.equal("inventoryItemId" in record, false);
  assert.equal("stockTransactionId" in record, false);
  assert.equal("unitCost" in record, false);
  assert.equal("price" in record, false);
  assert.equal("supplierId" in record, false);
  assert.equal("serialNumber" in record, false);
  assert.equal("evidence" in record, false);
  assert.equal("evidenceId" in record, false);
  assert.equal("correctiveActionId" in record, false);
  assert.equal("leakQuantity" in record, false);
  assert.equal("quantityKg" in record, false);
  assert.equal("warehouseId" in record, false);
  assert.equal("stockLocationId" in record, false);
  assert.equal("invoiceLineId" in record, false);
}

describe("Frigora Part usage", () => {
  it("records valid part usage with tenant fields and derived workOrderId", async () => {
    const owner = await seed();
    const usedById = "user-used-by" as UserId;
    const recorderId = "user-recorder" as UserId;
    await addMember(owner.workspaceId, usedById);
    await addMember(owner.workspaceId, recorderId);
    const { visit } = await seedOpenVisit(owner.service, owner.scope, usedById);

    const usage = await owner.service.recordPartUsage(owner.scope, visit.id, {
      partDescription: "Schrader valve core",
      quantity: 2,
      quantityUnit: "each",
      usedAt: USED,
      usedByUserId: usedById,
      recordedByUserId: recorderId,
      notes: "Replaced during valve service.",
    });
    assert.equal(usage.partDescription, "Schrader valve core");
    assert.equal(usage.quantity, 2);
    assert.equal(usage.quantityUnit, "each");
    assert.equal(usage.visitId, visit.id);
    assert.equal(usage.workOrderId, visit.workOrderId);
    assert.equal(usage.usedByUserId, usedById);
    assert.equal(usage.recordedByUserId, recorderId);
    assert.equal(usage.notes, "Replaced during valve service.");
    assert.equal(usage.createdAt, usage.updatedAt);
    assertNoForbiddenSemantics(usage);

    const loaded = await owner.service.getPartUsage(owner.scope, usage.id);
    assert.equal(loaded?.id, usage.id);
  });

  it("allows multiple part usages per visit and orders by usedAt then id", async () => {
    const owner = await seed();
    const attendeeId = "user-attendee" as UserId;
    await addMember(owner.workspaceId, attendeeId);
    const { workOrder, asset, visit } = await seedOpenVisit(owner.service, owner.scope, attendeeId);

    const first = await owner.service.recordPartUsage(
      owner.scope,
      visit.id,
      recordInput({ usedAt: "2026-08-28T10:15:00.000Z", quantity: 1 }),
    );
    const second = await owner.service.recordPartUsage(
      owner.scope,
      visit.id,
      recordInput({
        usedAt: "2026-08-28T10:45:00.000Z",
        quantity: 2,
        quantityUnit: "metre",
        partDescription: "Copper tube",
        assetId: asset.id,
      }),
    );
    const listed = await owner.service.listPartUsagesByVisit(owner.scope, visit.id);
    assert.equal(listed.length, 2);
    assert.deepEqual(
      listed.map((row) => row.id),
      [first.id, second.id],
    );
    assert.deepEqual(
      (await owner.service.listPartUsagesByWorkOrder(owner.scope, workOrder.id)).map(
        (row) => row.id,
      ),
      [first.id, second.id],
    );
    assert.deepEqual(
      (await owner.service.listPartUsagesByAsset(owner.scope, asset.id)).map((row) => row.id),
      [second.id],
    );
  });

  it("accepts all five quantity units and rejects unsupported units", async () => {
    const owner = await seed();
    const attendeeId = "user-attendee" as UserId;
    await addMember(owner.workspaceId, attendeeId);
    const { visit } = await seedOpenVisit(owner.service, owner.scope, attendeeId);

    let minute = 15;
    for (const quantityUnit of FRIGORA_PART_USAGE_UNITS) {
      const row = await owner.service.recordPartUsage(
        owner.scope,
        visit.id,
        recordInput({
          quantityUnit,
          usedAt: `2026-08-28T10:${String(minute).padStart(2, "0")}:00.000Z`,
          partDescription: `Unit ${quantityUnit}`,
        }),
      );
      assert.equal(row.quantityUnit, quantityUnit);
      minute += 1;
    }

    await expectCode(
      () =>
        owner.service.recordPartUsage(owner.scope, visit.id, {
          ...recordInput(),
          quantityUnit: "box" as "each",
        }),
      "invalid_kind",
    );
  });

  it("requires trimmed partDescription and accepts optional notes", async () => {
    const owner = await seed();
    const attendeeId = "user-attendee" as UserId;
    await addMember(owner.workspaceId, attendeeId);
    const { visit } = await seedOpenVisit(owner.service, owner.scope, attendeeId);

    await expectCode(
      () =>
        owner.service.recordPartUsage(owner.scope, visit.id, {
          ...recordInput(),
          partDescription: "   ",
        }),
      "invalid_input",
    );
    await expectCode(
      () =>
        owner.service.recordPartUsage(owner.scope, visit.id, {
          ...recordInput(),
          partDescription: "",
        }),
      "invalid_input",
    );

    const trimmed = await owner.service.recordPartUsage(owner.scope, visit.id, {
      ...recordInput(),
      partDescription: "  Filter drier  ",
    });
    assert.equal(trimmed.partDescription, "Filter drier");

    const withNotes = await owner.service.recordPartUsage(owner.scope, visit.id, {
      ...recordInput({
        notes: "  Used during leak repair  ",
        usedAt: "2026-08-28T10:32:00.000Z",
      }),
    });
    assert.equal(withNotes.notes, "Used during leak repair");

    const minimal = await owner.service.recordPartUsage(
      owner.scope,
      visit.id,
      recordInput({ notes: undefined, usedAt: "2026-08-28T10:33:00.000Z" }),
    );
    assert.equal(minimal.notes, null);
  });

  it("validates quantity as positive finite including fractional values", async () => {
    const owner = await seed();
    const attendeeId = "user-attendee" as UserId;
    await addMember(owner.workspaceId, attendeeId);
    const { visit } = await seedOpenVisit(owner.service, owner.scope, attendeeId);

    const half = await owner.service.recordPartUsage(
      owner.scope,
      visit.id,
      recordInput({ quantity: 0.5, quantityUnit: "litre" }),
    );
    assert.equal(half.quantity, 0.5);

    for (const quantity of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      await expectCode(
        () => owner.service.recordPartUsage(owner.scope, visit.id, recordInput({ quantity })),
        "invalid_input",
      );
    }
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
    const withAsset = await owner.service.recordPartUsage(owner.scope, visit.id, {
      ...recordInput(),
      assetId: asset.id,
    });
    assert.equal(withAsset.assetId, asset.id);
    const nullAsset = await owner.service.recordPartUsage(owner.scope, visit.id, {
      ...recordInput(),
      assetId: null,
      usedAt: "2026-08-28T10:31:00.000Z",
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
        owner.service.recordPartUsage(owner.scope, visit.id, {
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
        owner.service.recordPartUsage(owner.scope, visit.id, {
          ...recordInput(),
          assetId: otherAsset.id,
        }),
      "not_found",
    );
  });

  it("requires workspace members for usedBy and recordedBy with flexible provenance", async () => {
    const owner = await seed();
    const attendeeId = "user-attendee" as UserId;
    const usedById = "user-used-by" as UserId;
    const recorderId = "user-recorder" as UserId;
    const assigneeId = "user-assignee" as UserId;
    await addMember(owner.workspaceId, attendeeId);
    await addMember(owner.workspaceId, usedById);
    await addMember(owner.workspaceId, recorderId);
    await addMember(owner.workspaceId, assigneeId);
    const { workOrder, visit } = await seedOpenVisit(owner.service, owner.scope, attendeeId);
    await owner.service.assignWorkOrder(owner.scope, workOrder.id, { userId: assigneeId });

    await expectCode(
      () =>
        owner.service.recordPartUsage(owner.scope, visit.id, {
          ...recordInput(),
          usedByUserId: "user-outsider",
        }),
      "not_found",
    );
    await expectCode(
      () =>
        owner.service.recordPartUsage(owner.scope, visit.id, {
          ...recordInput(),
          recordedByUserId: "user-outsider",
        }),
      "not_found",
    );

    const same = await owner.service.recordPartUsage(owner.scope, visit.id, {
      ...recordInput(),
      usedByUserId: attendeeId,
      recordedByUserId: attendeeId,
    });
    assert.equal(same.usedByUserId, same.recordedByUserId);

    const different = await owner.service.recordPartUsage(owner.scope, visit.id, {
      ...recordInput(),
      usedByUserId: usedById,
      recordedByUserId: recorderId,
      usedAt: "2026-08-28T10:33:00.000Z",
    });
    assert.notEqual(different.usedByUserId, different.recordedByUserId);
    assert.notEqual(different.usedByUserId, attendeeId);
    assert.notEqual(different.usedByUserId, assigneeId);
  });

  it("enforces usedAt within visit attendance and rejects cancelled visits", async () => {
    const owner = await seed();
    const attendeeId = "user-attendee" as UserId;
    await addMember(owner.workspaceId, attendeeId);
    const { visit } = await seedOpenVisit(owner.service, owner.scope, attendeeId);

    await expectCode(
      () =>
        owner.service.recordPartUsage(
          owner.scope,
          visit.id,
          recordInput({ usedAt: EARLY_USED }),
        ),
      "invalid_input",
    );

    const openOk = await owner.service.recordPartUsage(
      owner.scope,
      visit.id,
      recordInput({ usedAt: USED }),
    );
    assert.equal(openOk.usedAt, USED);

    const departed = await owner.service.recordVisitDeparture(owner.scope, visit.id, {
      departedAt: DEPARTED,
    });
    await expectCode(
      () =>
        owner.service.recordPartUsage(
          owner.scope,
          departed.id,
          recordInput({ usedAt: LATE_USED }),
        ),
      "invalid_input",
    );
    const delayed = await owner.service.recordPartUsage(
      owner.scope,
      departed.id,
      recordInput({ usedAt: "2026-08-28T10:40:00.000Z", partDescription: "Delayed core" }),
    );
    assert.equal(delayed.usedAt, "2026-08-28T10:40:00.000Z");

    const owner2 = await seed({
      reset: false,
      ventureId: "ven-cancel" as VentureId,
      userId: owner.userId,
    });
    const { visit: visit2 } = await seedOpenVisit(owner2.service, owner2.scope, attendeeId);
    const recorded = await owner2.service.recordPartUsage(owner2.scope, visit2.id, recordInput());
    await owner2.service.cancelVisit(owner2.scope, visit2.id);
    await expectCode(
      () => owner2.service.recordPartUsage(owner2.scope, visit2.id, recordInput()),
      "invalid_status",
    );
    const persisted = await owner2.service.getPartUsage(owner2.scope, recorded.id);
    assert.equal(persisted?.id, recorded.id);
  });

  it("preserves usages after work order close or cancel and allows delayed entry", async () => {
    const owner = await seed();
    const attendeeId = "user-attendee" as UserId;
    await addMember(owner.workspaceId, attendeeId);
    const { workOrder, visit } = await seedOpenVisit(owner.service, owner.scope, attendeeId);

    const beforeClose = await owner.service.recordPartUsage(
      owner.scope,
      visit.id,
      recordInput({ quantity: 1 }),
    );
    await completeWorkOrderFromVisit(
      owner.service,
      owner.scope,
      workOrder.id,
      visit,
      attendeeId,
    );
    const afterClose = await owner.service.recordPartUsage(
      owner.scope,
      visit.id,
      recordInput({ quantity: 2, usedAt: "2026-08-28T10:34:00.000Z" }),
    );
    assert.equal(afterClose.workOrderId, workOrder.id);
    assert.equal(
      (await owner.service.getPartUsage(owner.scope, beforeClose.id))?.id,
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
    const beforeCancel = await owner2.service.recordPartUsage(
      owner2.scope,
      visit2.id,
      recordInput(),
    );
    await cancelWorkOrderAfterDepartingOpenVisit(
      owner2.service,
      owner2.scope,
      wo2.id,
      visit2,
    );
    const afterCancel = await owner2.service.recordPartUsage(
      owner2.scope,
      visit2.id,
      recordInput({ usedAt: "2026-08-28T10:36:00.000Z", quantity: 3 }),
    );
    assert.equal(afterCancel.workOrderId, wo2.id);
    assert.equal(
      (await owner2.service.getPartUsage(owner2.scope, beforeCancel.id))?.id,
      beforeCancel.id,
    );
  });

  it("does not mutate asset, visit, work order, or sibling visit facts", async () => {
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
      observedAt: USED,
      userId: attendeeId,
    });
    const finding = await owner.service.recordTechnicalFinding(owner.scope, visit.id, {
      findingKind: "confirmed_fault",
      description: "service-valve leak",
      assertedAt: USED,
      userId: attendeeId,
    });
    const action = await owner.service.recordCorrectiveAction(owner.scope, visit.id, {
      description: "Replaced valve core",
      performedAt: USED,
      performedByUserId: attendeeId,
      recordedByUserId: recorderId,
    });
    const outcome = await owner.service.recordVisitOutcome(owner.scope, visit.id, {
      description: "Cooling restored",
      outcomeAt: USED,
      recordedByUserId: recorderId,
    });
    const recommendation = await owner.service.recordRecommendedAction(owner.scope, visit.id, {
      description: "Return for pressure test follow-up",
      recommendedAt: USED,
      recommendedByUserId: attendeeId,
      recordedByUserId: recorderId,
    });
    const refrigerant = await owner.service.recordRefrigerantEvent(owner.scope, visit.id, {
      refrigerantType: "R404A",
      eventKind: "added",
      quantityKg: 2,
      occurredAt: USED,
      handledByUserId: attendeeId,
      recordedByUserId: recorderId,
    });

    await owner.service.recordPartUsage(owner.scope, visit.id, {
      ...recordInput(),
      assetId: asset.id,
      notes: "Valve core used during corrective work.",
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
    assert.equal(
      (await owner.service.getRefrigerantEvent(owner.scope, refrigerant.id))?.quantityKg,
      2,
    );
  });

  it("does not require corrective action, refrigerant event, outcome, or recommended action", async () => {
    const owner = await seed();
    const attendeeId = "user-attendee" as UserId;
    await addMember(owner.workspaceId, attendeeId);
    const { visit } = await seedOpenVisit(owner.service, owner.scope, attendeeId);

    const beforeOthers = await owner.service.recordPartUsage(owner.scope, visit.id, recordInput());
    await owner.service.recordCorrectiveAction(owner.scope, visit.id, {
      description: "Replaced valve core",
      performedAt: USED,
      performedByUserId: attendeeId,
      recordedByUserId: attendeeId,
    });
    await owner.service.recordRefrigerantEvent(owner.scope, visit.id, {
      refrigerantType: "R404A",
      eventKind: "added",
      quantityKg: 1,
      occurredAt: USED,
      handledByUserId: attendeeId,
      recordedByUserId: attendeeId,
    });
    await owner.service.recordVisitOutcome(owner.scope, visit.id, {
      description: "Cooling restored",
      outcomeAt: USED,
      recordedByUserId: attendeeId,
    });
    await owner.service.recordRecommendedAction(owner.scope, visit.id, {
      description: "Schedule follow-up",
      recommendedAt: USED,
      recommendedByUserId: attendeeId,
      recordedByUserId: attendeeId,
    });
    const afterOthers = await owner.service.recordPartUsage(
      owner.scope,
      visit.id,
      recordInput({ usedAt: "2026-08-28T10:37:00.000Z", quantity: 2 }),
    );
    assert.notEqual(beforeOthers.id, afterOthers.id);
  });

  it("exposes append-only surface without update/delete and avoids platform side effects", async () => {
    const owner = await seed();
    const attendeeId = "user-attendee" as UserId;
    await addMember(owner.workspaceId, attendeeId);
    const { visit } = await seedOpenVisit(owner.service, owner.scope, attendeeId);
    const before = (await getPersistence().recommendations.listForWorkspace(owner.workspaceId))
      .length;
    await owner.service.recordPartUsage(owner.scope, visit.id, recordInput());
    const after = (await getPersistence().recommendations.listForWorkspace(owner.workspaceId))
      .length;
    assert.equal(after, before);
    assert.equal("updatePartUsage" in owner.service, false);
    assert.equal("deletePartUsage" in owner.service, false);
    assert.equal("editPartUsage" in owner.service, false);
    assert.equal("reversePartUsage" in owner.service, false);
    assert.equal("recordProposedAction" in owner.service, false);
  });

  it("scopes reads and rejects non-frigora venture", async () => {
    const owner = await seed();
    const attendeeId = "user-attendee" as UserId;
    await addMember(owner.workspaceId, attendeeId);
    const { workOrder, asset, visit } = await seedOpenVisit(owner.service, owner.scope, attendeeId);
    const usage = await owner.service.recordPartUsage(
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
    assert.equal(await owner.service.getPartUsage(otherScope, usage.id), null);
    assert.deepEqual(await owner.service.listPartUsagesByVisit(otherScope, visit.id), []);
    assert.deepEqual(
      await owner.service.listPartUsagesByWorkOrder(otherScope, workOrder.id),
      [],
    );
    assert.deepEqual(await owner.service.listPartUsagesByAsset(otherScope, asset.id), []);

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
    assert.equal(await owner.service.getPartUsage(crossWorkspaceScope, usage.id), null);

    const { scope, service } = await seed({ definitionId: "ventureos.company" });
    await expectCode(
      () => service.recordPartUsage(scope, visit.id, recordInput()),
      "not_frigora",
    );
  });

  it("supports persisted Frigora 0.11.0 instance for prior capabilities", async () => {
    const owner = await seed({ definitionVersion: "0.11.0" });
    const attendeeId = "user-attendee" as UserId;
    await addMember(owner.workspaceId, attendeeId);
    const { visit } = await seedOpenVisit(owner.service, owner.scope, attendeeId);
    const event = await owner.service.recordRefrigerantEvent(owner.scope, visit.id, {
      refrigerantType: "R404A",
      eventKind: "added",
      quantityKg: 1,
      occurredAt: USED,
      handledByUserId: attendeeId,
      recordedByUserId: attendeeId,
    });
    assert.equal(event.eventKind, "added");
  });

  it("resolves frigora@0.16.0 from catalog with part usage admission and retained exclusions", () => {
    const frigora = platformVentureRegistry.resolve("frigora");
    assert.equal(frigora.version, "0.16.0");
    assert.match(frigora.description, /part usages/);
    assert.match(frigora.description, /refrigerant events/);
    assert.match(frigora.description, /parts catalogue/);
    assert.match(frigora.description, /inventory/);
    assert.match(frigora.description, /cylinder inventory/);
    assert.match(frigora.description, /evidence/);
    assert.match(frigora.description, /employee agents/);
  });
});
