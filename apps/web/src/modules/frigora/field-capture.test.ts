import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { platformVentureRegistry } from "@/core/venture-definition/catalog";
import type { Role, UserId, VentureId, WorkspaceId } from "@/contracts";
import { createPermissionService } from "@/platform/permissions/service";
import { createDbMembershipStore } from "@/platform/permissions/membership-store";
import { ensureSchema } from "@/platform/persistence/db";
import { getPersistence, resetPersistenceLifecycle } from "@/platform/persistence/repositories";
import { closeFrigoraPersistenceAfterFile } from "./test-persistence-lifecycle";
import type { PersistedVenture } from "@/platform/persistence/repositories/ports";
import { FrigoraError } from "./errors";
import { createFrigoraService } from "./service";
import type { FrigoraFieldCapture, FrigoraScope } from "./types";

const NOW = "2026-08-28T00:00:00.000Z";
const ARRIVED = "2026-08-28T10:00:00.000Z";
const OBSERVED = "2026-08-28T10:15:00.000Z";
const DEPARTED = "2026-08-28T11:00:00.000Z";
const EARLY_OBSERVED = "2026-08-28T09:00:00.000Z";
const LATE_OBSERVED = "2026-08-28T12:00:00.000Z";

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
      definitionVersion: options.definitionVersion ?? "0.9.0",
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
    definitionVersion: "0.9.0",
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
    tag: "EVAP-01",
    name: "Evaporator",
  });
  const workOrder = await service.createWorkOrder(scope, {
    siteId: site.id,
    workReference: "WO-1864",
    workKind: "reactive",
    primaryAssetId: asset.id,
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

function assertNoForbiddenSemantics(record: FrigoraFieldCapture) {
  assert.equal("diagnosis" in record, false);
  assert.equal("repairAction" in record, false);
  assert.equal("evidenceId" in record, false);
  assert.equal("dispatchedAt" in record, false);
  assert.equal("dispatchStatus" in record, false);
  assert.equal("completedAt" in record, false);
  assert.equal("faultCode" in record, false);
}

describe("Frigora Visit field capture", () => {
  it("records measurement and condition captures", async () => {
    const owner = await seed();
    const attendeeId = "user-attendee" as UserId;
    await addMember(owner.workspaceId, attendeeId);
    const { visit } = await seedOpenVisit(
      owner.service,
      owner.scope,
      attendeeId,
    );
    const measurement = await owner.service.recordFieldCapture(owner.scope, visit.id, {
      captureKind: "measurement",
      captureCode: "temperature",
      valueNumeric: -18,
      valueUnit: "celsius",
      observedAt: OBSERVED,
      userId: attendeeId,
    });
    assert.equal(measurement.captureKind, "measurement");
    assert.equal(measurement.valueNumeric, -18);
    assert.equal(measurement.valueUnit, "celsius");
    assert.equal(measurement.workOrderId, visit.workOrderId);
    assertNoForbiddenSemantics(measurement);

    const condition = await owner.service.recordFieldCapture(owner.scope, visit.id, {
      captureKind: "condition",
      captureCode: "visual_condition",
      description: "evaporator heavily iced",
      observedAt: OBSERVED,
      userId: attendeeId,
    });
    assert.equal(condition.captureKind, "condition");
    assert.equal(condition.description, "evaporator heavily iced");
    assert.equal(condition.valueNumeric, null);
    assert.equal(condition.valueUnit, null);
  });

  it("persists tenant, visit, observedAt, and capturedByUserId", async () => {
    const owner = await seed();
    const recorderId = "user-recorder" as UserId;
    await addMember(owner.workspaceId, recorderId);
    const attendeeId = "user-attendee" as UserId;
    await addMember(owner.workspaceId, attendeeId);
    const { visit } = await seedOpenVisit(
      owner.service,
      owner.scope,
      attendeeId,
    );
    const capture = await owner.service.recordFieldCapture(owner.scope, visit.id, {
      captureKind: "measurement",
      captureCode: "suction_pressure",
      valueNumeric: 2.1,
      valueUnit: "bar",
      observedAt: OBSERVED,
      userId: recorderId,
    });
    assert.equal(capture.workspaceId, owner.workspaceId);
    assert.equal(capture.ventureId, owner.ventureId);
    assert.equal(capture.visitId, visit.id);
    assert.equal(capture.observedAt, OBSERVED);
    assert.equal(capture.capturedByUserId, recorderId);
    const loaded = await owner.service.getFieldCapture(owner.scope, capture.id);
    assert.equal(loaded?.visitId, visit.id);
  });

  it("rejects malformed measurement and condition payloads", async () => {
    const owner = await seed();
    const attendeeId = "user-attendee" as UserId;
    await addMember(owner.workspaceId, attendeeId);
    const { visit } = await seedOpenVisit(
      owner.service,
      owner.scope,
      attendeeId,
    );
    await expectCode(
      () =>
        owner.service.recordFieldCapture(owner.scope, visit.id, {
          captureKind: "measurement",
          captureCode: "temperature",
          observedAt: OBSERVED,
          userId: attendeeId,
        }),
      "invalid_input",
    );
    await expectCode(
      () =>
        owner.service.recordFieldCapture(owner.scope, visit.id, {
          captureKind: "condition",
          captureCode: "visual_condition",
          observedAt: OBSERVED,
          userId: attendeeId,
          description: "   ",
        }),
      "invalid_input",
    );
    await expectCode(
      () =>
        owner.service.recordFieldCapture(owner.scope, visit.id, {
          captureKind: "condition",
          captureCode: "visual_condition",
          observedAt: OBSERVED,
          userId: attendeeId,
          description: "noisy",
          valueNumeric: 1,
        }),
      "invalid_input",
    );
  });

  it("enforces observedAt within visit attendance window", async () => {
    const owner = await seed();
    const attendeeId = "user-attendee" as UserId;
    await addMember(owner.workspaceId, attendeeId);
    const { visit } = await seedOpenVisit(
      owner.service,
      owner.scope,
      attendeeId,
    );
    await expectCode(
      () =>
        owner.service.recordFieldCapture(owner.scope, visit.id, {
          captureKind: "measurement",
          captureCode: "temperature",
          valueNumeric: -18,
          valueUnit: "celsius",
          observedAt: EARLY_OBSERVED,
          userId: attendeeId,
        }),
      "invalid_input",
    );
    const departed = await owner.service.recordVisitDeparture(owner.scope, visit.id, {
      departedAt: DEPARTED,
    });
    await expectCode(
      () =>
        owner.service.recordFieldCapture(owner.scope, departed.id, {
          captureKind: "measurement",
          captureCode: "temperature",
          valueNumeric: -18,
          valueUnit: "celsius",
          observedAt: LATE_OBSERVED,
          userId: attendeeId,
        }),
      "invalid_input",
    );
    const delayed = await owner.service.recordFieldCapture(owner.scope, departed.id, {
      captureKind: "measurement",
      captureCode: "temperature",
      valueNumeric: -18,
      valueUnit: "celsius",
      observedAt: OBSERVED,
      userId: attendeeId,
    });
    assert.equal(delayed.observedAt, OBSERVED);
  });

  it("rejects capture on cancelled Visit and preserves existing captures", async () => {
    const owner = await seed();
    const attendeeId = "user-attendee" as UserId;
    await addMember(owner.workspaceId, attendeeId);
    const { visit } = await seedOpenVisit(
      owner.service,
      owner.scope,
      attendeeId,
    );
    const capture = await owner.service.recordFieldCapture(owner.scope, visit.id, {
      captureKind: "condition",
      captureCode: "visual_condition",
      description: "ice present",
      observedAt: OBSERVED,
      userId: attendeeId,
    });
    await owner.service.cancelVisit(owner.scope, visit.id);
    await expectCode(
      () =>
        owner.service.recordFieldCapture(owner.scope, visit.id, {
          captureKind: "condition",
          captureCode: "visual_condition",
          description: "late note",
          observedAt: OBSERVED,
          userId: attendeeId,
        }),
      "invalid_status",
    );
    const persisted = await owner.service.getFieldCapture(owner.scope, capture.id);
    assert.equal(persisted?.id, capture.id);
  });

  it("allows delayed capture after WorkOrder close or cancel", async () => {
    const owner = await seed();
    const attendeeId = "user-attendee" as UserId;
    await addMember(owner.workspaceId, attendeeId);
    const { workOrder, visit } = await seedOpenVisit(
      owner.service,
      owner.scope,
      attendeeId,
    );
    await owner.service.closeWorkOrder(owner.scope, workOrder.id);
    const afterClose = await owner.service.recordFieldCapture(owner.scope, visit.id, {
      captureKind: "measurement",
      captureCode: "voltage",
      valueNumeric: 230,
      valueUnit: "volt",
      observedAt: OBSERVED,
      userId: attendeeId,
    });
    assert.equal(afterClose.workOrderId, workOrder.id);

    const owner2 = await seed({ ventureId: "ven-two" as VentureId });
    await addMember(owner2.workspaceId, attendeeId);
    const { workOrder: wo2, visit: visit2 } = await seedOpenVisit(
      owner2.service,
      owner2.scope,
      attendeeId,
    );
    await owner2.service.cancelWorkOrder(owner2.scope, wo2.id);
    const afterCancel = await owner2.service.recordFieldCapture(owner2.scope, visit2.id, {
      captureKind: "condition",
      captureCode: "visual_condition",
      description: "oil residue visible",
      observedAt: OBSERVED,
      userId: attendeeId,
    });
    assert.equal(afterCancel.visitId, visit2.id);
  });

  it("rejects invalid membership and cross-venture access", async () => {
    const owner = await seed();
    const attendeeId = "user-attendee" as UserId;
    await addMember(owner.workspaceId, attendeeId);
    const { visit } = await seedOpenVisit(
      owner.service,
      owner.scope,
      attendeeId,
    );
    await expectCode(
      () =>
        owner.service.recordFieldCapture(owner.scope, visit.id, {
          captureKind: "measurement",
          captureCode: "temperature",
          valueNumeric: -18,
          valueUnit: "celsius",
          observedAt: OBSERVED,
          userId: "user-guess",
        }),
      "not_found",
    );
    const otherWorkspace = "ws-other" as WorkspaceId;
    const outsiderId = "user-outsider" as UserId;
    await getPersistence().organisations.insert({
      id: otherWorkspace,
      name: "Other",
      slug: "ws-other",
      createdAt: NOW,
    });
    await getPersistence().memberships.setRole({
      userId: outsiderId,
      workspaceId: otherWorkspace,
      role: "member",
      createdAt: NOW,
    });
    await expectCode(
      () =>
        owner.service.recordFieldCapture(owner.scope, visit.id, {
          captureKind: "measurement",
          captureCode: "temperature",
          valueNumeric: -18,
          valueUnit: "celsius",
          observedAt: OBSERVED,
          userId: outsiderId,
        }),
      "not_found",
    );
    const capture = await owner.service.recordFieldCapture(owner.scope, visit.id, {
      captureKind: "measurement",
      captureCode: "temperature",
      valueNumeric: -18,
      valueUnit: "celsius",
      observedAt: OBSERVED,
      userId: attendeeId,
    });
    const otherVenture = "ven-other" as VentureId;
    await getPersistence().ventures.insert(
      ventureRow({
        id: otherVenture,
        workspaceId: owner.workspaceId,
        slug: "other-frigora",
      }),
    );
    assert.equal(
      await owner.service.getFieldCapture({ ...owner.scope, ventureId: otherVenture }, capture.id),
      null,
    );
  });

  it("lists captures by visit, work order, and asset with return-visit ownership", async () => {
    const owner = await seed();
    const attendeeId = "user-attendee" as UserId;
    await addMember(owner.workspaceId, attendeeId);
    const { workOrder, asset } = await seedHierarchy(owner.service, owner.scope);
    const visitA = await owner.service.recordVisitArrival(owner.scope, workOrder.id, {
      userId: attendeeId,
      arrivedAt: "2026-08-26T10:00:00.000Z",
    });
    const visitB = await owner.service.recordVisitArrival(owner.scope, workOrder.id, {
      userId: attendeeId,
      arrivedAt: "2026-08-28T10:00:00.000Z",
    });
    const captureA = await owner.service.recordFieldCapture(owner.scope, visitA.id, {
      captureKind: "measurement",
      captureCode: "temperature",
      valueNumeric: -18,
      valueUnit: "celsius",
      observedAt: "2026-08-26T10:15:00.000Z",
      userId: attendeeId,
      assetId: asset.id,
    });
    const captureB = await owner.service.recordFieldCapture(owner.scope, visitB.id, {
      captureKind: "condition",
      captureCode: "visual_condition",
      description: "compressor unusually noisy",
      observedAt: OBSERVED,
      userId: attendeeId,
    });
    assert.deepEqual(
      (await owner.service.listFieldCapturesByVisit(owner.scope, visitA.id)).map((r) => r.id),
      [captureA.id],
    );
    assert.deepEqual(
      (await owner.service.listFieldCapturesByVisit(owner.scope, visitB.id)).map((r) => r.id),
      [captureB.id],
    );
    const byWorkOrder = await owner.service.listFieldCapturesByWorkOrder(owner.scope, workOrder.id);
    assert.equal(byWorkOrder.length, 2);
    assert.equal(
      (await owner.service.listFieldCapturesByAsset(owner.scope, asset.id))[0]?.id,
      captureA.id,
    );
  });

  it("does not mutate assignment, visit, or work order lifecycle", async () => {
    const owner = await seed();
    const assigneeId = "user-assignee" as UserId;
    const recorderId = "user-recorder" as UserId;
    await addMember(owner.workspaceId, assigneeId);
    await addMember(owner.workspaceId, recorderId);
    const { workOrder, visit } = await seedOpenVisit(
      owner.service,
      owner.scope,
      recorderId,
    );
    await owner.service.assignWorkOrder(owner.scope, workOrder.id, { userId: assigneeId });
    await owner.service.recordFieldCapture(owner.scope, visit.id, {
      captureKind: "condition",
      captureCode: "visual_condition",
      description: "compressor unusually noisy",
      observedAt: OBSERVED,
      userId: recorderId,
    });
    const loadedWo = await owner.service.getWorkOrder(owner.scope, workOrder.id);
    const loadedVisit = await owner.service.getVisit(owner.scope, visit.id);
    assert.equal(loadedWo?.status, "open");
    assert.equal(loadedWo?.assignedUserId, assigneeId);
    assert.equal(loadedVisit?.status, "open");
    assert.notEqual(recorderId, assigneeId);
  });

  it("validates optional asset reference", async () => {
    const owner = await seed();
    const attendeeId = "user-attendee" as UserId;
    await addMember(owner.workspaceId, attendeeId);
    const { customer, workOrder, asset } = await seedHierarchy(owner.service, owner.scope);
    const otherSite = await owner.service.createSite(owner.scope, {
      customerId: customer.id,
      code: "OTHER",
      name: "Other Site",
    });
    const foreignAsset = await owner.service.createAsset(owner.scope, {
      siteId: otherSite.id,
      tag: "FOREIGN",
    });
    const visit = await owner.service.recordVisitArrival(owner.scope, workOrder.id, {
      userId: attendeeId,
      arrivedAt: ARRIVED,
    });
    await expectCode(
      () =>
        owner.service.recordFieldCapture(owner.scope, visit.id, {
          captureKind: "measurement",
          captureCode: "temperature",
          valueNumeric: -18,
          valueUnit: "celsius",
          observedAt: OBSERVED,
          userId: attendeeId,
          assetId: foreignAsset.id,
        }),
      "invalid_input",
    );
    const decommissioned = await owner.service.decommissionAsset(owner.scope, asset.id);
    assert.equal(decommissioned.status, "decommissioned");
    const withAsset = await owner.service.recordFieldCapture(owner.scope, visit.id, {
      captureKind: "measurement",
      captureCode: "temperature",
      valueNumeric: -18,
      valueUnit: "celsius",
      observedAt: OBSERVED,
      userId: attendeeId,
      assetId: asset.id,
    });
    assert.equal(withAsset.assetId, asset.id);
  });

  it("scopes FieldCapture list queries to workspace and venture", async () => {
    const owner = await seed();
    const attendeeId = "user-attendee" as UserId;
    await addMember(owner.workspaceId, attendeeId);
    const { workOrder, asset, visit } = await seedOpenVisit(
      owner.service,
      owner.scope,
      attendeeId,
    );
    await owner.service.recordFieldCapture(owner.scope, visit.id, {
      captureKind: "measurement",
      captureCode: "temperature",
      valueNumeric: -18,
      valueUnit: "celsius",
      observedAt: OBSERVED,
      userId: attendeeId,
      assetId: asset.id,
    });

    const otherVenture = "ven-other" as VentureId;
    await getPersistence().ventures.insert(
      ventureRow({
        id: otherVenture,
        workspaceId: owner.workspaceId,
        slug: "other-frigora",
      }),
    );
    const otherVentureScope = { ...owner.scope, ventureId: otherVenture };
    assert.deepEqual(
      await owner.service.listFieldCapturesByVisit(otherVentureScope, visit.id),
      [],
    );
    assert.deepEqual(
      await owner.service.listFieldCapturesByWorkOrder(otherVentureScope, workOrder.id),
      [],
    );
    assert.deepEqual(
      await owner.service.listFieldCapturesByAsset(otherVentureScope, asset.id),
      [],
    );

    const otherWorkspace = await seed({
      reset: false,
      workspaceId: "ws-other" as WorkspaceId,
      ventureId: "ven-other-ws" as VentureId,
      userId: owner.userId,
    });
    const crossWorkspaceScope = {
      userId: owner.userId,
      workspaceId: otherWorkspace.workspaceId,
      ventureId: otherWorkspace.ventureId,
    };
    assert.deepEqual(
      await otherWorkspace.service.listFieldCapturesByVisit(crossWorkspaceScope, visit.id),
      [],
    );
    assert.deepEqual(
      await otherWorkspace.service.listFieldCapturesByWorkOrder(crossWorkspaceScope, workOrder.id),
      [],
    );
    assert.deepEqual(
      await otherWorkspace.service.listFieldCapturesByAsset(crossWorkspaceScope, asset.id),
      [],
    );

    assert.deepEqual(
      (await owner.service.listFieldCapturesByVisit(owner.scope, visit.id)).length,
      1,
    );
  });

  it("preserves existing FieldCaptures after WorkOrder close or cancel", async () => {
    const owner = await seed();
    const attendeeId = "user-attendee" as UserId;
    await addMember(owner.workspaceId, attendeeId);
    const { workOrder, asset, visit } = await seedOpenVisit(
      owner.service,
      owner.scope,
      attendeeId,
    );
    const beforeClose = await owner.service.recordFieldCapture(owner.scope, visit.id, {
      captureKind: "measurement",
      captureCode: "temperature",
      valueNumeric: -18,
      valueUnit: "celsius",
      observedAt: OBSERVED,
      userId: attendeeId,
      assetId: asset.id,
    });
    await owner.service.closeWorkOrder(owner.scope, workOrder.id);
    const afterClose = await owner.service.getFieldCapture(owner.scope, beforeClose.id);
    assert.equal(afterClose?.id, beforeClose.id);
    assert.deepEqual(
      (await owner.service.listFieldCapturesByVisit(owner.scope, visit.id)).map((r) => r.id),
      [beforeClose.id],
    );
    assert.deepEqual(
      (await owner.service.listFieldCapturesByWorkOrder(owner.scope, workOrder.id)).map(
        (r) => r.id,
      ),
      [beforeClose.id],
    );
    assert.deepEqual(
      (await owner.service.listFieldCapturesByAsset(owner.scope, asset.id)).map((r) => r.id),
      [beforeClose.id],
    );

    const owner2 = await seed({
      reset: false,
      ventureId: "ven-two" as VentureId,
      userId: owner.userId,
    });
    const { workOrder: wo2, asset: asset2, visit: visit2 } = await seedOpenVisit(
      owner2.service,
      owner2.scope,
      attendeeId,
    );
    const beforeCancel = await owner2.service.recordFieldCapture(owner2.scope, visit2.id, {
      captureKind: "condition",
      captureCode: "visual_condition",
      description: "oil residue visible",
      observedAt: OBSERVED,
      userId: attendeeId,
      assetId: asset2.id,
    });
    await owner2.service.cancelWorkOrder(owner2.scope, wo2.id);
    const afterCancel = await owner2.service.getFieldCapture(owner2.scope, beforeCancel.id);
    assert.equal(afterCancel?.id, beforeCancel.id);
    assert.deepEqual(
      (await owner2.service.listFieldCapturesByVisit(owner2.scope, visit2.id)).map((r) => r.id),
      [beforeCancel.id],
    );
    assert.deepEqual(
      (await owner2.service.listFieldCapturesByWorkOrder(owner2.scope, wo2.id)).map((r) => r.id),
      [beforeCancel.id],
    );
    assert.deepEqual(
      (await owner2.service.listFieldCapturesByAsset(owner2.scope, asset2.id)).map((r) => r.id),
      [beforeCancel.id],
    );
  });

  it("supports persisted Frigora 0.5.0 instance", async () => {
    const owner = await seed({ definitionVersion: "0.5.0" });
    const attendeeId = "user-attendee" as UserId;
    await addMember(owner.workspaceId, attendeeId);
    const { visit } = await seedOpenVisit(
      owner.service,
      owner.scope,
      attendeeId,
    );
    const capture = await owner.service.recordFieldCapture(owner.scope, visit.id, {
      captureKind: "measurement",
      captureCode: "current",
      valueNumeric: 5,
      valueUnit: "ampere",
      observedAt: OBSERVED,
      userId: attendeeId,
    });
    assert.equal(capture.captureKind, "measurement");
  });

  it("resolves frigora@0.10.0 from catalog with field capture admission", () => {
    assert.equal(platformVentureRegistry.resolve("frigora").version, "0.16.0");
    assert.match(
      platformVentureRegistry.resolve("frigora").description,
      /Visit field capture/,
    );
    assert.match(
      platformVentureRegistry.resolve("frigora").description,
      /diagnosis/,
    );
  });
});
