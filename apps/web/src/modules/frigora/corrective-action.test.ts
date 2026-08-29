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
import type { FrigoraCorrectiveAction, FrigoraScope } from "./types";

const NOW = "2026-08-28T00:00:00.000Z";
const ARRIVED = "2026-08-28T10:00:00.000Z";
const PERFORMED = "2026-08-28T10:30:00.000Z";
const DEPARTED = "2026-08-28T11:00:00.000Z";
const EARLY_PERFORMED = "2026-08-28T09:00:00.000Z";
const LATE_PERFORMED = "2026-08-28T12:00:00.000Z";

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

function assertNoForbiddenSemantics(record: FrigoraCorrectiveAction) {
  assert.equal("actionCode" in record, false);
  assert.equal("actionStatus" in record, false);
  assert.equal("repairStatus" in record, false);
  assert.equal("diagnosisId" in record, false);
  assert.equal("rootCauseId" in record, false);
  assert.equal("outcome" in record, false);
  assert.equal("evidenceId" in record, false);
  assert.equal("assertionStatus" in record, false);
  assert.equal("recommendedAction" in record, false);
  assert.equal("findingKind" in record, false);
}

describe("Frigora Visit corrective action", () => {
  it("records valid corrective action with tenant and identity fields", async () => {
    const owner = await seed();
    const performerId = "user-performer" as UserId;
    const recorderId = "user-recorder" as UserId;
    await addMember(owner.workspaceId, performerId);
    await addMember(owner.workspaceId, recorderId);
    const { visit } = await seedOpenVisit(owner.service, owner.scope, performerId);
    const action = await owner.service.recordCorrectiveAction(owner.scope, visit.id, {
      description: "Cleaned condenser coil",
      performedAt: PERFORMED,
      performedByUserId: performerId,
      recordedByUserId: recorderId,
    });
    assert.ok(action.id);
    assert.equal(action.workspaceId, owner.workspaceId);
    assert.equal(action.ventureId, owner.ventureId);
    assert.equal(action.visitId, visit.id);
    assert.equal(action.workOrderId, visit.workOrderId);
    assert.equal(action.description, "Cleaned condenser coil");
    assert.equal(action.performedAt, PERFORMED);
    assert.equal(action.performedByUserId, performerId);
    assert.equal(action.recordedByUserId, recorderId);
    assert.equal(action.createdAt, action.updatedAt);
    assertNoForbiddenSemantics(action);
  });

  it("allows performer and recorder to be the same or differ from attendee and assignee", async () => {
    const owner = await seed();
    const attendeeId = "user-attendee" as UserId;
    const assigneeId = "user-assignee" as UserId;
    const recorderId = "user-recorder" as UserId;
    await addMember(owner.workspaceId, attendeeId);
    await addMember(owner.workspaceId, assigneeId);
    await addMember(owner.workspaceId, recorderId);
    const { workOrder, visit } = await seedOpenVisit(owner.service, owner.scope, attendeeId);
    await owner.service.assignWorkOrder(owner.scope, workOrder.id, { userId: assigneeId });
    const same = await owner.service.recordCorrectiveAction(owner.scope, visit.id, {
      description: "Reset controller",
      performedAt: PERFORMED,
      performedByUserId: recorderId,
      recordedByUserId: recorderId,
    });
    assert.equal(same.performedByUserId, same.recordedByUserId);
    const different = await owner.service.recordCorrectiveAction(owner.scope, visit.id, {
      description: "Replaced contactor",
      performedAt: PERFORMED,
      performedByUserId: assigneeId,
      recordedByUserId: recorderId,
    });
    assert.notEqual(different.performedByUserId, different.recordedByUserId);
    assert.notEqual(different.performedByUserId, attendeeId);
  });

  it("rejects non-member performer or recorder and empty description", async () => {
    const owner = await seed();
    const attendeeId = "user-attendee" as UserId;
    await addMember(owner.workspaceId, attendeeId);
    const { visit } = await seedOpenVisit(owner.service, owner.scope, attendeeId);
    await expectCode(
      () =>
        owner.service.recordCorrectiveAction(owner.scope, visit.id, {
          description: "Cleaned condenser coil",
          performedAt: PERFORMED,
          performedByUserId: "user-guess",
          recordedByUserId: attendeeId,
        }),
      "not_found",
    );
    await expectCode(
      () =>
        owner.service.recordCorrectiveAction(owner.scope, visit.id, {
          description: "Cleaned condenser coil",
          performedAt: PERFORMED,
          performedByUserId: attendeeId,
          recordedByUserId: "user-guess",
        }),
      "not_found",
    );
    await expectCode(
      () =>
        owner.service.recordCorrectiveAction(owner.scope, visit.id, {
          description: "   ",
          performedAt: PERFORMED,
          performedByUserId: attendeeId,
          recordedByUserId: attendeeId,
        }),
      "invalid_input",
    );
  });

  it("enforces performedAt within visit attendance window", async () => {
    const owner = await seed();
    const attendeeId = "user-attendee" as UserId;
    await addMember(owner.workspaceId, attendeeId);
    const { visit } = await seedOpenVisit(owner.service, owner.scope, attendeeId);
    await expectCode(
      () =>
        owner.service.recordCorrectiveAction(owner.scope, visit.id, {
          description: "Cleaned condenser coil",
          performedAt: EARLY_PERFORMED,
          performedByUserId: attendeeId,
          recordedByUserId: attendeeId,
        }),
      "invalid_input",
    );
    const departed = await owner.service.recordVisitDeparture(owner.scope, visit.id, {
      departedAt: DEPARTED,
    });
    await expectCode(
      () =>
        owner.service.recordCorrectiveAction(owner.scope, departed.id, {
          description: "Cleaned condenser coil",
          performedAt: LATE_PERFORMED,
          performedByUserId: attendeeId,
          recordedByUserId: attendeeId,
        }),
      "invalid_input",
    );
    const delayed = await owner.service.recordCorrectiveAction(owner.scope, departed.id, {
      description: "Cleaned condenser coil",
      performedAt: PERFORMED,
      performedByUserId: attendeeId,
      recordedByUserId: attendeeId,
    });
    assert.equal(delayed.performedAt, PERFORMED);
  });

  it("rejects action on cancelled Visit and preserves existing actions", async () => {
    const owner = await seed();
    const attendeeId = "user-attendee" as UserId;
    await addMember(owner.workspaceId, attendeeId);
    const { visit } = await seedOpenVisit(owner.service, owner.scope, attendeeId);
    const action = await owner.service.recordCorrectiveAction(owner.scope, visit.id, {
      description: "Reset controller",
      performedAt: PERFORMED,
      performedByUserId: attendeeId,
      recordedByUserId: attendeeId,
    });
    await owner.service.cancelVisit(owner.scope, visit.id);
    await expectCode(
      () =>
        owner.service.recordCorrectiveAction(owner.scope, visit.id, {
          description: "Late action",
          performedAt: PERFORMED,
          performedByUserId: attendeeId,
          recordedByUserId: attendeeId,
        }),
      "invalid_status",
    );
    const persisted = await owner.service.getCorrectiveAction(owner.scope, action.id);
    assert.equal(persisted?.id, action.id);
  });

  it("preserves actions after WorkOrder close or cancel and allows valid delayed entry", async () => {
    const owner = await seed();
    const attendeeId = "user-attendee" as UserId;
    await addMember(owner.workspaceId, attendeeId);
    const { workOrder, visit } = await seedOpenVisit(owner.service, owner.scope, attendeeId);
    const beforeClose = await owner.service.recordCorrectiveAction(owner.scope, visit.id, {
      description: "Repaired damaged wiring",
      performedAt: PERFORMED,
      performedByUserId: attendeeId,
      recordedByUserId: attendeeId,
    });
    await owner.service.closeWorkOrder(owner.scope, workOrder.id);
    const afterClose = await owner.service.recordCorrectiveAction(owner.scope, visit.id, {
      description: "Adjusted thermostat setting",
      performedAt: PERFORMED,
      performedByUserId: attendeeId,
      recordedByUserId: attendeeId,
    });
    const persistedBeforeClose = await owner.service.getCorrectiveAction(
      owner.scope,
      beforeClose.id,
    );
    assert.equal(persistedBeforeClose?.id, beforeClose.id);
    assert.equal(afterClose.workOrderId, workOrder.id);

    const owner2 = await seed({
      reset: false,
      ventureId: "ven-two" as VentureId,
      userId: owner.userId,
    });
    const { workOrder: wo2, visit: visit2 } = await seedOpenVisit(
      owner2.service,
      owner2.scope,
      attendeeId,
    );
    const beforeCancel = await owner2.service.recordCorrectiveAction(owner2.scope, visit2.id, {
      description: "Isolated electrical supply",
      performedAt: PERFORMED,
      performedByUserId: attendeeId,
      recordedByUserId: attendeeId,
    });
    await owner2.service.cancelWorkOrder(owner2.scope, wo2.id);
    const afterCancel = await owner2.service.recordCorrectiveAction(owner2.scope, visit2.id, {
      description: "Temporarily secured damaged cable",
      performedAt: PERFORMED,
      performedByUserId: attendeeId,
      recordedByUserId: attendeeId,
    });
    assert.equal(afterCancel.workOrderId, wo2.id);
    const persistedBeforeCancel = await owner2.service.getCorrectiveAction(
      owner2.scope,
      beforeCancel.id,
    );
    assert.equal(persistedBeforeCancel?.id, beforeCancel.id);
  });

  it("rejects cross-workspace members and scopes tenant reads", async () => {
    const owner = await seed();
    const attendeeId = "user-attendee" as UserId;
    await addMember(owner.workspaceId, attendeeId);
    const { visit } = await seedOpenVisit(owner.service, owner.scope, attendeeId);
    const outsiderId = "user-outsider" as UserId;
    const otherWorkspace = "ws-other" as WorkspaceId;
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
        owner.service.recordCorrectiveAction(owner.scope, visit.id, {
          description: "Cleaned condenser coil",
          performedAt: PERFORMED,
          performedByUserId: outsiderId,
          recordedByUserId: attendeeId,
        }),
      "not_found",
    );
    const action = await owner.service.recordCorrectiveAction(owner.scope, visit.id, {
      description: "Cleaned condenser coil",
      performedAt: PERFORMED,
      performedByUserId: attendeeId,
      recordedByUserId: attendeeId,
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
      await owner.service.getCorrectiveAction({ ...owner.scope, ventureId: otherVenture }, action.id),
      null,
    );
  });

  it("scopes list queries to workspace and venture", async () => {
    const owner = await seed();
    const attendeeId = "user-attendee" as UserId;
    await addMember(owner.workspaceId, attendeeId);
    const { workOrder, asset, visit } = await seedOpenVisit(owner.service, owner.scope, attendeeId);
    await owner.service.recordCorrectiveAction(owner.scope, visit.id, {
      description: "Cleaned condenser coil",
      performedAt: PERFORMED,
      performedByUserId: attendeeId,
      recordedByUserId: attendeeId,
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
      await owner.service.listCorrectiveActionsByVisit(otherVentureScope, visit.id),
      [],
    );
    assert.deepEqual(
      await owner.service.listCorrectiveActionsByWorkOrder(otherVentureScope, workOrder.id),
      [],
    );
    assert.deepEqual(
      await owner.service.listCorrectiveActionsByAsset(otherVentureScope, asset.id),
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
      await otherWorkspace.service.listCorrectiveActionsByVisit(crossWorkspaceScope, visit.id),
      [],
    );
    assert.equal(
      (await owner.service.listCorrectiveActionsByVisit(owner.scope, visit.id)).length,
      1,
    );
  });

  it("lists actions by visit, work order, and asset with return-visit ownership", async () => {
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
    const actionA = await owner.service.recordCorrectiveAction(owner.scope, visitA.id, {
      description: "Reset controller",
      performedAt: "2026-08-26T10:30:00.000Z",
      performedByUserId: attendeeId,
      recordedByUserId: attendeeId,
      assetId: asset.id,
    });
    const actionB = await owner.service.recordCorrectiveAction(owner.scope, visitB.id, {
      description: "Replaced contactor",
      performedAt: PERFORMED,
      performedByUserId: attendeeId,
      recordedByUserId: attendeeId,
    });
    assert.deepEqual(
      (await owner.service.listCorrectiveActionsByVisit(owner.scope, visitA.id)).map((r) => r.id),
      [actionA.id],
    );
    assert.deepEqual(
      (await owner.service.listCorrectiveActionsByVisit(owner.scope, visitB.id)).map((r) => r.id),
      [actionB.id],
    );
    assert.equal(
      (await owner.service.listCorrectiveActionsByWorkOrder(owner.scope, workOrder.id)).length,
      2,
    );
    assert.equal(
      (await owner.service.listCorrectiveActionsByAsset(owner.scope, asset.id))[0]?.id,
      actionA.id,
    );
  });

  it("does not mutate assignment, visit, work order, captures, or findings", async () => {
    const owner = await seed();
    const assigneeId = "user-assignee" as UserId;
    const performerId = "user-performer" as UserId;
    const recorderId = "user-recorder" as UserId;
    await addMember(owner.workspaceId, assigneeId);
    await addMember(owner.workspaceId, performerId);
    await addMember(owner.workspaceId, recorderId);
    const { workOrder, visit } = await seedOpenVisit(owner.service, owner.scope, performerId);
    await owner.service.assignWorkOrder(owner.scope, workOrder.id, { userId: assigneeId });
    const capture = await owner.service.recordFieldCapture(owner.scope, visit.id, {
      captureKind: "measurement",
      captureCode: "temperature",
      valueNumeric: -18,
      valueUnit: "celsius",
      observedAt: PERFORMED,
      userId: performerId,
    });
    const finding = await owner.service.recordTechnicalFinding(owner.scope, visit.id, {
      findingKind: "confirmed_fault",
      description: "compressor electrical failure",
      assertedAt: PERFORMED,
      userId: performerId,
    });
    await owner.service.recordCorrectiveAction(owner.scope, visit.id, {
      description: "Replaced contactor",
      performedAt: PERFORMED,
      performedByUserId: performerId,
      recordedByUserId: recorderId,
    });
    const loadedWo = await owner.service.getWorkOrder(owner.scope, workOrder.id);
    const loadedVisit = await owner.service.getVisit(owner.scope, visit.id);
    const loadedCapture = await owner.service.getFieldCapture(owner.scope, capture.id);
    const loadedFinding = await owner.service.getTechnicalFinding(owner.scope, finding.id);
    assert.equal(loadedWo?.status, "open");
    assert.equal(loadedWo?.assignedUserId, assigneeId);
    assert.equal(loadedVisit?.status, "open");
    assert.equal(loadedCapture?.valueNumeric, -18);
    assert.equal(loadedFinding?.findingKind, "confirmed_fault");
    assert.equal(
      (await owner.service.listTechnicalFindingsByVisit(owner.scope, visit.id)).length,
      1,
    );
    assert.equal(
      (await owner.service.listFieldCapturesByVisit(owner.scope, visit.id)).length,
      1,
    );
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
        owner.service.recordCorrectiveAction(owner.scope, visit.id, {
          description: "Cleaned condenser coil",
          performedAt: PERFORMED,
          performedByUserId: attendeeId,
          recordedByUserId: attendeeId,
          assetId: foreignAsset.id,
        }),
      "invalid_input",
    );
    const withAsset = await owner.service.recordCorrectiveAction(owner.scope, visit.id, {
      description: "Cleaned condenser coil",
      performedAt: PERFORMED,
      performedByUserId: attendeeId,
      recordedByUserId: attendeeId,
      assetId: asset.id,
    });
    assert.equal(withAsset.assetId, asset.id);
    await owner.service.decommissionAsset(owner.scope, asset.id);
    const afterDecommission = await owner.service.recordCorrectiveAction(owner.scope, visit.id, {
      description: "Adjusted thermostat setting",
      performedAt: PERFORMED,
      performedByUserId: attendeeId,
      recordedByUserId: attendeeId,
      assetId: asset.id,
    });
    assert.equal(afterDecommission.assetId, asset.id);
  });

  it("validates sourceTechnicalFindingIds provenance on same Visit", async () => {
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
    const findingOnA = await owner.service.recordTechnicalFinding(owner.scope, visitA.id, {
      findingKind: "confirmed_fault",
      description: "compressor electrical failure",
      assertedAt: "2026-08-26T10:15:00.000Z",
      userId: attendeeId,
      assetId: asset.id,
    });
    const findingOnB = await owner.service.recordTechnicalFinding(owner.scope, visitB.id, {
      findingKind: "suspected_fault",
      description: "possible refrigerant loss",
      assertedAt: PERFORMED,
      userId: attendeeId,
    });
    const withoutSources = await owner.service.recordCorrectiveAction(owner.scope, visitA.id, {
      description: "Replaced contactor",
      performedAt: "2026-08-26T10:30:00.000Z",
      performedByUserId: attendeeId,
      recordedByUserId: attendeeId,
    });
    assert.equal(withoutSources.sourceTechnicalFindingIds, null);
    await expectCode(
      () =>
        owner.service.recordCorrectiveAction(owner.scope, visitA.id, {
          description: "Replaced contactor",
          performedAt: "2026-08-26T10:35:00.000Z",
          performedByUserId: attendeeId,
          recordedByUserId: attendeeId,
          sourceTechnicalFindingIds: ["missing-finding"],
        }),
      "not_found",
    );
    await expectCode(
      () =>
        owner.service.recordCorrectiveAction(owner.scope, visitA.id, {
          description: "Replaced contactor",
          performedAt: "2026-08-26T10:35:00.000Z",
          performedByUserId: attendeeId,
          recordedByUserId: attendeeId,
          sourceTechnicalFindingIds: [findingOnB.id],
        }),
      "invalid_input",
    );
    const otherVenture = "ven-other" as VentureId;
    await getPersistence().ventures.insert(
      ventureRow({
        id: otherVenture,
        workspaceId: owner.workspaceId,
        slug: "other-frigora",
      }),
    );
    const otherWorkspace = await seed({
      reset: false,
      workspaceId: "ws-other" as WorkspaceId,
      ventureId: "ven-other-ws" as VentureId,
      userId: owner.userId,
    });
    await addMember(otherWorkspace.workspaceId, attendeeId);
    const { visit: foreignVisit } = await seedOpenVisit(
      otherWorkspace.service,
      {
        userId: owner.userId,
        workspaceId: otherWorkspace.workspaceId,
        ventureId: otherWorkspace.ventureId,
      },
      attendeeId,
    );
    const foreignFinding = await otherWorkspace.service.recordTechnicalFinding(
      {
        userId: owner.userId,
        workspaceId: otherWorkspace.workspaceId,
        ventureId: otherWorkspace.ventureId,
      },
      foreignVisit.id,
      {
        findingKind: "symptom",
        description: "compressor not starting",
        assertedAt: PERFORMED,
        userId: attendeeId,
      },
    );
    await expectCode(
      () =>
        owner.service.recordCorrectiveAction(owner.scope, visitA.id, {
          description: "Replaced contactor",
          performedAt: "2026-08-26T10:35:00.000Z",
          performedByUserId: attendeeId,
          recordedByUserId: attendeeId,
          sourceTechnicalFindingIds: [foreignFinding.id],
        }),
      "not_found",
    );
    const withSources = await owner.service.recordCorrectiveAction(owner.scope, visitA.id, {
      description: "Replaced contactor",
      performedAt: "2026-08-26T10:40:00.000Z",
      performedByUserId: attendeeId,
      recordedByUserId: attendeeId,
      sourceTechnicalFindingIds: [findingOnA.id, findingOnA.id],
    });
    assert.deepEqual(withSources.sourceTechnicalFindingIds, [findingOnA.id]);
    const findingAfter = await owner.service.getTechnicalFinding(owner.scope, findingOnA.id);
    assert.equal(findingAfter?.description, "compressor electrical failure");
  });

  it("keeps truth layers distinct", async () => {
    const owner = await seed();
    const attendeeId = "user-attendee" as UserId;
    await addMember(owner.workspaceId, attendeeId);
    const { workOrder, visit } = await seedOpenVisit(owner.service, owner.scope, attendeeId);
    const capture = await owner.service.recordFieldCapture(owner.scope, visit.id, {
      captureKind: "condition",
      captureCode: "visual_condition",
      description: "evaporator visibly iced",
      observedAt: PERFORMED,
      userId: attendeeId,
    });
    const finding = await owner.service.recordTechnicalFinding(owner.scope, visit.id, {
      findingKind: "symptom",
      description: "evaporator heavily iced",
      assertedAt: PERFORMED,
      userId: attendeeId,
    });
    const action = await owner.service.recordCorrectiveAction(owner.scope, visit.id, {
      description: "Cleaned evaporator coil",
      performedAt: PERFORMED,
      performedByUserId: attendeeId,
      recordedByUserId: attendeeId,
    });
    const loadedWo = await owner.service.getWorkOrder(owner.scope, workOrder.id);
    assert.equal(loadedWo?.reportedCondition, "display freezer warm");
    assert.equal(capture.captureKind, "condition");
    assert.equal(finding.findingKind, "symptom");
    assert.equal(action.description, "Cleaned evaporator coil");
    assert.notEqual(loadedWo?.reportedCondition, action.description);
    await owner.service.closeWorkOrder(owner.scope, workOrder.id);
    const woAfter = await owner.service.getWorkOrder(owner.scope, workOrder.id);
    assert.equal(woAfter?.status, "closed");
  });

  it("supports persisted Frigora 0.7.0 instance", async () => {
    const owner = await seed({ definitionVersion: "0.7.0" });
    const attendeeId = "user-attendee" as UserId;
    await addMember(owner.workspaceId, attendeeId);
    const { visit } = await seedOpenVisit(owner.service, owner.scope, attendeeId);
    const action = await owner.service.recordCorrectiveAction(owner.scope, visit.id, {
      description: "Reset controller",
      performedAt: PERFORMED,
      performedByUserId: attendeeId,
      recordedByUserId: attendeeId,
    });
    assert.equal(action.description, "Reset controller");
  });

  it("resolves frigora@0.10.0 from catalog with corrective action admission", () => {
    assert.equal(platformVentureRegistry.resolve("frigora").version, "0.13.0");
    assert.match(
      platformVentureRegistry.resolve("frigora").description,
      /Visit corrective actions/,
    );
    assert.match(
      platformVentureRegistry.resolve("frigora").description,
      /full repair workflow/,
    );
  });
});
