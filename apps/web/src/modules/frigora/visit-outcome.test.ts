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
import type { FrigoraScope, FrigoraVisitOutcome } from "./types";

const NOW = "2026-08-28T00:00:00.000Z";
const ARRIVED = "2026-08-28T10:00:00.000Z";
const OUTCOME_AT = "2026-08-28T10:45:00.000Z";
const DEPARTED = "2026-08-28T11:00:00.000Z";
const EARLY_OUTCOME = "2026-08-28T09:00:00.000Z";
const LATE_OUTCOME = "2026-08-28T12:00:00.000Z";

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

function assertNoForbiddenSemantics(record: FrigoraVisitOutcome) {
  assert.equal("outcomeKind" in record, false);
  assert.equal("outcomeCode" in record, false);
  assert.equal("resolutionStatus" in record, false);
  assert.equal("repairStatus" in record, false);
  assert.equal("partsRequired" in record, false);
  assert.equal("returnVisitRequired" in record, false);
  assert.equal("recommendedAction" in record, false);
  assert.equal("coolingRestored" in record, false);
  assert.equal("assetLeftOperational" in record, false);
  assert.equal("customerSignOff" in record, false);
  assert.equal("evidence" in record, false);
  assert.equal("confidence" in record, false);
  assert.equal("diagnosisId" in record, false);
  assert.equal("rootCauseId" in record, false);
  assert.equal("performedByUserId" in record, false);
}

describe("Frigora Visit outcome", () => {
  it("records valid VisitOutcome with tenant fields and derived workOrderId", async () => {
    const owner = await seed();
    const recorderId = "user-recorder" as UserId;
    await addMember(owner.workspaceId, recorderId);
    const { visit } = await seedOpenVisit(owner.service, owner.scope, recorderId);
    const outcome = await owner.service.recordVisitOutcome(owner.scope, visit.id, {
      description: "Unit remained isolated and cooling was not restored",
      outcomeAt: OUTCOME_AT,
      recordedByUserId: recorderId,
    });
    assert.ok(outcome.id);
    assert.equal(outcome.workspaceId, owner.workspaceId);
    assert.equal(outcome.ventureId, owner.ventureId);
    assert.equal(outcome.visitId, visit.id);
    assert.equal(outcome.workOrderId, visit.workOrderId);
    assert.equal(outcome.description, "Unit remained isolated and cooling was not restored");
    assert.equal(outcome.outcomeAt, OUTCOME_AT);
    assert.equal(outcome.recordedByUserId, recorderId);
    assert.equal(outcome.createdAt, outcome.updatedAt);
    assertNoForbiddenSemantics(outcome);
    const byVisit = await owner.service.getVisitOutcomeByVisit(owner.scope, visit.id);
    assert.equal(byVisit?.id, outcome.id);
  });

  it("rejects duplicate outcome and empty description", async () => {
    const owner = await seed();
    const attendeeId = "user-attendee" as UserId;
    await addMember(owner.workspaceId, attendeeId);
    const { workOrder, visit } = await seedOpenVisit(owner.service, owner.scope, attendeeId);
    const emptyVisit = await owner.service.recordVisitArrival(owner.scope, workOrder.id, {
      userId: attendeeId,
      arrivedAt: "2026-08-27T10:00:00.000Z",
    });
    await expectCode(
      () =>
        owner.service.recordVisitOutcome(owner.scope, emptyVisit.id, {
          description: "   ",
          outcomeAt: "2026-08-27T10:45:00.000Z",
          recordedByUserId: attendeeId,
        }),
      "invalid_input",
    );
    await owner.service.recordVisitOutcome(owner.scope, visit.id, {
      description: "Fault remained unresolved at end of visit",
      outcomeAt: OUTCOME_AT,
      recordedByUserId: attendeeId,
    });
    await expectCode(
      () =>
        owner.service.recordVisitOutcome(owner.scope, visit.id, {
          description: "Second outcome",
          outcomeAt: OUTCOME_AT,
          recordedByUserId: attendeeId,
        }),
      "duplicate",
    );
  });

  it("allows recorder to equal or differ from attendee and assignee", async () => {
    const owner = await seed();
    const attendeeId = "user-attendee" as UserId;
    const assigneeId = "user-assignee" as UserId;
    const recorderId = "user-recorder" as UserId;
    await addMember(owner.workspaceId, attendeeId);
    await addMember(owner.workspaceId, assigneeId);
    await addMember(owner.workspaceId, recorderId);
    const { workOrder, visit } = await seedOpenVisit(owner.service, owner.scope, attendeeId);
    await owner.service.assignWorkOrder(owner.scope, workOrder.id, { userId: assigneeId });
    const same = await owner.service.recordVisitOutcome(owner.scope, visit.id, {
      description: "Unit was operating at end of attendance episode",
      outcomeAt: OUTCOME_AT,
      recordedByUserId: attendeeId,
    });
    assert.equal(same.recordedByUserId, attendeeId);
    const owner2 = await seed({
      reset: false,
      ventureId: "ven-two" as VentureId,
      userId: owner.userId,
    });
    const { visit: visit2 } = await seedOpenVisit(owner2.service, owner2.scope, attendeeId);
    const different = await owner2.service.recordVisitOutcome(owner2.scope, visit2.id, {
      description: "Temporary operation was restored",
      outcomeAt: OUTCOME_AT,
      recordedByUserId: recorderId,
    });
    assert.equal(different.recordedByUserId, recorderId);
    assert.notEqual(different.recordedByUserId, attendeeId);
  });

  it("rejects non-member and cross-workspace recorders", async () => {
    const owner = await seed();
    const attendeeId = "user-attendee" as UserId;
    await addMember(owner.workspaceId, attendeeId);
    const { visit } = await seedOpenVisit(owner.service, owner.scope, attendeeId);
    await expectCode(
      () =>
        owner.service.recordVisitOutcome(owner.scope, visit.id, {
          description: "Asset remained unavailable when attendance concluded",
          outcomeAt: OUTCOME_AT,
          recordedByUserId: "user-outsider",
        }),
      "not_found",
    );
    const otherWorkspace = "ws-other" as WorkspaceId;
    await getPersistence().organisations.insert({
      id: otherWorkspace,
      name: "Other",
      slug: "ws-other",
      createdAt: NOW,
    });
    await getPersistence().memberships.setRole({
      userId: "user-outsider" as UserId,
      workspaceId: otherWorkspace,
      role: "member",
      createdAt: NOW,
    });
    await expectCode(
      () =>
        owner.service.recordVisitOutcome(owner.scope, visit.id, {
          description: "Asset remained unavailable when attendance concluded",
          outcomeAt: OUTCOME_AT,
          recordedByUserId: "user-outsider",
        }),
      "not_found",
    );
  });

  it("enforces outcomeAt within visit attendance window", async () => {
    const owner = await seed();
    const attendeeId = "user-attendee" as UserId;
    await addMember(owner.workspaceId, attendeeId);
    const { visit } = await seedOpenVisit(owner.service, owner.scope, attendeeId);
    await expectCode(
      () =>
        owner.service.recordVisitOutcome(owner.scope, visit.id, {
          description: "Fault remained unresolved at end of visit",
          outcomeAt: EARLY_OUTCOME,
          recordedByUserId: attendeeId,
        }),
      "invalid_input",
    );
    const departed = await owner.service.recordVisitDeparture(owner.scope, visit.id, {
      departedAt: DEPARTED,
    });
    await expectCode(
      () =>
        owner.service.recordVisitOutcome(owner.scope, departed.id, {
          description: "Late outcome",
          outcomeAt: LATE_OUTCOME,
          recordedByUserId: attendeeId,
        }),
      "invalid_input",
    );
    const delayed = await owner.service.recordVisitOutcome(owner.scope, departed.id, {
      description: "Unit was operating at end of attendance episode",
      outcomeAt: OUTCOME_AT,
      recordedByUserId: attendeeId,
    });
    assert.equal(delayed.outcomeAt, OUTCOME_AT);
  });

  it("rejects outcome on cancelled Visit and preserves existing outcome", async () => {
    const owner = await seed();
    const attendeeId = "user-attendee" as UserId;
    await addMember(owner.workspaceId, attendeeId);
    const { visit } = await seedOpenVisit(owner.service, owner.scope, attendeeId);
    const outcome = await owner.service.recordVisitOutcome(owner.scope, visit.id, {
      description: "Fault remained unresolved at end of visit",
      outcomeAt: OUTCOME_AT,
      recordedByUserId: attendeeId,
    });
    await owner.service.cancelVisit(owner.scope, visit.id);
    await expectCode(
      () =>
        owner.service.recordVisitOutcome(owner.scope, visit.id, {
          description: "Late outcome",
          outcomeAt: OUTCOME_AT,
          recordedByUserId: attendeeId,
        }),
      "invalid_status",
    );
    const persisted = await owner.service.getVisitOutcome(owner.scope, outcome.id);
    assert.equal(persisted?.id, outcome.id);
  });

  it("preserves outcomes after WorkOrder close or cancel and allows delayed entry", async () => {
    const owner = await seed();
    const attendeeId = "user-attendee" as UserId;
    await addMember(owner.workspaceId, attendeeId);
    const { workOrder, visit } = await seedOpenVisit(owner.service, owner.scope, attendeeId);
    const beforeClose = await owner.service.recordVisitOutcome(owner.scope, visit.id, {
      description: "Unit remained isolated and cooling was not restored",
      outcomeAt: OUTCOME_AT,
      recordedByUserId: attendeeId,
    });
    await owner.service.closeWorkOrder(owner.scope, workOrder.id);
    const owner2 = await seed({
      reset: false,
      ventureId: "ven-close-delay" as VentureId,
      userId: owner.userId,
    });
    const { workOrder: wo2, visit: visit2 } = await seedOpenVisit(
      owner2.service,
      owner2.scope,
      attendeeId,
    );
    await owner2.service.closeWorkOrder(owner2.scope, wo2.id);
    const afterClose = await owner2.service.recordVisitOutcome(owner2.scope, visit2.id, {
      description: "Temporary operation was restored",
      outcomeAt: OUTCOME_AT,
      recordedByUserId: attendeeId,
    });
    assert.equal(afterClose.workOrderId, wo2.id);
    const persistedBeforeClose = await owner.service.getVisitOutcome(owner.scope, beforeClose.id);
    assert.equal(persistedBeforeClose?.id, beforeClose.id);

    const owner3 = await seed({
      reset: false,
      ventureId: "ven-cancel-delay" as VentureId,
      userId: owner.userId,
    });
    const { workOrder: wo3, visit: visit3 } = await seedOpenVisit(
      owner3.service,
      owner3.scope,
      attendeeId,
    );
    await owner3.service.cancelWorkOrder(owner3.scope, wo3.id);
    const afterCancel = await owner3.service.recordVisitOutcome(owner3.scope, visit3.id, {
      description: "Fault remained unresolved at end of visit",
      outcomeAt: OUTCOME_AT,
      recordedByUserId: attendeeId,
    });
    assert.equal(afterCancel.workOrderId, wo3.id);
  });

  it("does not mutate WorkOrder, Visit, assignment, captures, findings, or corrective actions", async () => {
    const owner = await seed();
    const assigneeId = "user-assignee" as UserId;
    const attendeeId = "user-attendee" as UserId;
    const recorderId = "user-recorder" as UserId;
    await addMember(owner.workspaceId, assigneeId);
    await addMember(owner.workspaceId, attendeeId);
    await addMember(owner.workspaceId, recorderId);
    const { workOrder, visit } = await seedOpenVisit(owner.service, owner.scope, attendeeId);
    await owner.service.assignWorkOrder(owner.scope, workOrder.id, { userId: assigneeId });
    const capture = await owner.service.recordFieldCapture(owner.scope, visit.id, {
      captureKind: "measurement",
      captureCode: "temperature",
      valueNumeric: -18,
      valueUnit: "celsius",
      observedAt: OUTCOME_AT,
      userId: attendeeId,
    });
    const finding = await owner.service.recordTechnicalFinding(owner.scope, visit.id, {
      findingKind: "confirmed_fault",
      description: "compressor electrical failure",
      assertedAt: OUTCOME_AT,
      userId: attendeeId,
    });
    const action = await owner.service.recordCorrectiveAction(owner.scope, visit.id, {
      description: "Isolated electrical supply",
      performedAt: OUTCOME_AT,
      performedByUserId: attendeeId,
      recordedByUserId: recorderId,
    });
    await owner.service.recordVisitOutcome(owner.scope, visit.id, {
      description: "Unit remained isolated and cooling was not restored",
      outcomeAt: OUTCOME_AT,
      recordedByUserId: recorderId,
    });
    const loadedWo = await owner.service.getWorkOrder(owner.scope, workOrder.id);
    const loadedVisit = await owner.service.getVisit(owner.scope, visit.id);
    assert.equal(loadedWo?.status, "open");
    assert.equal(loadedWo?.assignedUserId, assigneeId);
    assert.equal(loadedVisit?.status, "open");
    assert.equal(loadedVisit?.departedAt, null);
    const loadedCapture = await owner.service.getFieldCapture(owner.scope, capture.id);
    const loadedFinding = await owner.service.getTechnicalFinding(owner.scope, finding.id);
    const loadedAction = await owner.service.getCorrectiveAction(owner.scope, action.id);
    assert.equal(loadedCapture?.valueNumeric, -18);
    assert.equal(loadedFinding?.findingKind, "confirmed_fault");
    assert.equal(loadedAction?.description, "Isolated electrical supply");
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
        owner.service.recordVisitOutcome(owner.scope, visit.id, {
          description: "Unit was operating at end of attendance episode",
          outcomeAt: OUTCOME_AT,
          recordedByUserId: attendeeId,
          assetId: foreignAsset.id,
        }),
      "invalid_input",
    );
    const withAsset = await owner.service.recordVisitOutcome(owner.scope, visit.id, {
      description: "Unit was operating at end of attendance episode",
      outcomeAt: OUTCOME_AT,
      recordedByUserId: attendeeId,
      assetId: asset.id,
    });
    assert.equal(withAsset.assetId, asset.id);
    await owner.service.decommissionAsset(owner.scope, asset.id);
    const owner2 = await seed({
      reset: false,
      ventureId: "ven-decom-asset" as VentureId,
      userId: owner.userId,
    });
    const { workOrder: wo2, asset: asset2, visit: visit2 } = await seedOpenVisit(
      owner2.service,
      owner2.scope,
      attendeeId,
    );
    await owner2.service.decommissionAsset(owner2.scope, asset2.id);
    const withDecommissioned = await owner2.service.recordVisitOutcome(owner2.scope, visit2.id, {
      description: "Fault remained unresolved at end of visit",
      outcomeAt: OUTCOME_AT,
      recordedByUserId: attendeeId,
      assetId: asset2.id,
    });
    assert.equal(withDecommissioned.assetId, asset2.id);
    assert.equal(withDecommissioned.workOrderId, wo2.id);
  });

  it("scopes reads to workspace and venture", async () => {
    const owner = await seed();
    const attendeeId = "user-attendee" as UserId;
    await addMember(owner.workspaceId, attendeeId);
    const { visit } = await seedOpenVisit(owner.service, owner.scope, attendeeId);
    const outcome = await owner.service.recordVisitOutcome(owner.scope, visit.id, {
      description: "Unit was operating at end of attendance episode",
      outcomeAt: OUTCOME_AT,
      recordedByUserId: attendeeId,
    });
    const otherVenture = "ven-other" as VentureId;
    await getPersistence().ventures.insert(
      ventureRow({ id: otherVenture, workspaceId: owner.workspaceId, slug: "other" }),
    );
    const otherScope = {
      userId: owner.userId,
      workspaceId: owner.workspaceId,
      ventureId: otherVenture,
    } satisfies FrigoraScope;
    assert.equal(await owner.service.getVisitOutcome(otherScope, outcome.id), null);
    const otherWorkspace = await seed({
      reset: false,
      workspaceId: "ws-other" as WorkspaceId,
      ventureId: "ven-other-ws" as VentureId,
      userId: owner.userId,
    });
    assert.equal(
      await owner.service.getVisitOutcome(
        {
          userId: owner.userId,
          workspaceId: otherWorkspace.workspaceId,
          ventureId: otherWorkspace.ventureId,
        },
        outcome.id,
      ),
      null,
    );
  });

  it("lists outcomes by work order and asset with distinct return visits", async () => {
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
    const outcomeA = await owner.service.recordVisitOutcome(owner.scope, visitA.id, {
      description: "Fault remained unresolved at end of visit",
      outcomeAt: "2026-08-26T10:45:00.000Z",
      recordedByUserId: attendeeId,
      assetId: asset.id,
    });
    const outcomeB = await owner.service.recordVisitOutcome(owner.scope, visitB.id, {
      description: "Unit was operating at end of attendance episode",
      outcomeAt: OUTCOME_AT,
      recordedByUserId: attendeeId,
      assetId: asset.id,
    });
    const byWo = await owner.service.listVisitOutcomesByWorkOrder(owner.scope, workOrder.id);
    assert.deepEqual(byWo.map((row) => row.id).sort(), [outcomeA.id, outcomeB.id].sort());
    const byAsset = await owner.service.listVisitOutcomesByAsset(owner.scope, asset.id);
    assert.equal(byAsset.length, 2);
  });

  it("keeps outcome separate from corrective action and technical finding", async () => {
    const owner = await seed();
    const attendeeId = "user-attendee" as UserId;
    await addMember(owner.workspaceId, attendeeId);
    const { workOrder, visit } = await seedOpenVisit(owner.service, owner.scope, attendeeId);
    const action = await owner.service.recordCorrectiveAction(owner.scope, visit.id, {
      description: "Isolated electrical supply and disconnected failed compressor",
      performedAt: OUTCOME_AT,
      performedByUserId: attendeeId,
      recordedByUserId: attendeeId,
    });
    const finding = await owner.service.recordTechnicalFinding(owner.scope, visit.id, {
      findingKind: "confirmed_fault",
      description: "Compressor winding open circuit",
      assertedAt: OUTCOME_AT,
      userId: attendeeId,
    });
    const outcome = await owner.service.recordVisitOutcome(owner.scope, visit.id, {
      description: "Unit left isolated; cooling not restored; display remains out of service",
      outcomeAt: OUTCOME_AT,
      recordedByUserId: attendeeId,
    });
    assert.notEqual(outcome.description, action.description);
    assert.notEqual(outcome.description, finding.description);
    const loadedWo = await owner.service.getWorkOrder(owner.scope, workOrder.id);
    assert.equal(loadedWo?.reportedCondition, "display freezer warm");
  });

  it("does not create platform recommendations or asset history persistence", async () => {
    const owner = await seed();
    const attendeeId = "user-attendee" as UserId;
    await addMember(owner.workspaceId, attendeeId);
    const { visit } = await seedOpenVisit(owner.service, owner.scope, attendeeId);
    const before = (await getPersistence().recommendations.listForWorkspace(owner.workspaceId))
      .length;
    await owner.service.recordVisitOutcome(owner.scope, visit.id, {
      description: "Unit remained isolated and cooling was not restored",
      outcomeAt: OUTCOME_AT,
      recordedByUserId: attendeeId,
    });
    const after = (await getPersistence().recommendations.listForWorkspace(owner.workspaceId))
      .length;
    assert.equal(after, before);
    assert.equal("listAssetHistory" in owner.service, false);
    assert.equal("listServiceHistory" in owner.service, false);
  });

  it("supports persisted Frigora 0.8.0 instance", async () => {
    const owner = await seed({ definitionVersion: "0.8.0" });
    const attendeeId = "user-attendee" as UserId;
    await addMember(owner.workspaceId, attendeeId);
    const { visit } = await seedOpenVisit(owner.service, owner.scope, attendeeId);
    const outcome = await owner.service.recordVisitOutcome(owner.scope, visit.id, {
      description: "Temporary operation was restored",
      outcomeAt: OUTCOME_AT,
      recordedByUserId: attendeeId,
    });
    assert.equal(outcome.description, "Temporary operation was restored");
  });

  it("resolves frigora@0.9.0 from catalog with visit outcome admission", () => {
    assert.equal(platformVentureRegistry.resolve("frigora").version, "0.9.0");
    assert.match(platformVentureRegistry.resolve("frigora").description, /Visit outcomes/);
    assert.match(
      platformVentureRegistry.resolve("frigora").description,
      /structured recommended actions/,
    );
    assert.match(platformVentureRegistry.resolve("frigora").description, /full repair workflow/);
  });
});
