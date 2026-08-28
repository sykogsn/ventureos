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
import type { FrigoraScope, FrigoraTechnicalFinding } from "./types";

const NOW = "2026-08-28T00:00:00.000Z";
const ARRIVED = "2026-08-28T10:00:00.000Z";
const ASSERTED = "2026-08-28T10:15:00.000Z";
const DEPARTED = "2026-08-28T11:00:00.000Z";
const EARLY_ASSERTED = "2026-08-28T09:00:00.000Z";
const LATE_ASSERTED = "2026-08-28T12:00:00.000Z";

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
      definitionVersion: options.definitionVersion ?? "0.7.0",
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
    definitionVersion: "0.7.0",
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

function assertNoForbiddenSemantics(record: FrigoraTechnicalFinding) {
  assert.equal("assertionStatus" in record, false);
  assert.equal("diagnosis" in record, false);
  assert.equal("rootCause" in record, false);
  assert.equal("repairAction" in record, false);
  assert.equal("evidenceId" in record, false);
  assert.equal("dispatchedAt" in record, false);
  assert.equal("dispatchStatus" in record, false);
  assert.equal("completedAt" in record, false);
  assert.equal("faultCode" in record, false);
  assert.equal("findingCode" in record, false);
}

describe("Frigora Visit technical finding", () => {
  it("records symptom, suspected_fault, and confirmed_fault findings", async () => {
    const owner = await seed();
    const attendeeId = "user-attendee" as UserId;
    await addMember(owner.workspaceId, attendeeId);
    const { visit } = await seedOpenVisit(owner.service, owner.scope, attendeeId);

    const symptom = await owner.service.recordTechnicalFinding(owner.scope, visit.id, {
      findingKind: "symptom",
      description: "compressor not starting",
      assertedAt: ASSERTED,
      userId: attendeeId,
    });
    assert.equal(symptom.findingKind, "symptom");
    assertNoForbiddenSemantics(symptom);

    const suspected = await owner.service.recordTechnicalFinding(owner.scope, visit.id, {
      findingKind: "suspected_fault",
      description: "possible refrigerant loss",
      assertedAt: ASSERTED,
      userId: attendeeId,
    });
    assert.equal(suspected.findingKind, "suspected_fault");

    const confirmed = await owner.service.recordTechnicalFinding(owner.scope, visit.id, {
      findingKind: "confirmed_fault",
      description: "compressor electrical failure",
      assertedAt: ASSERTED,
      userId: attendeeId,
    });
    assert.equal(confirmed.findingKind, "confirmed_fault");
    assert.equal(confirmed.workOrderId, visit.workOrderId);
  });

  it("persists tenant, visit, assertedAt, and recordedByUserId", async () => {
    const owner = await seed();
    const recorderId = "user-recorder" as UserId;
    await addMember(owner.workspaceId, recorderId);
    const { visit } = await seedOpenVisit(owner.service, owner.scope, recorderId);
    const finding = await owner.service.recordTechnicalFinding(owner.scope, visit.id, {
      findingKind: "symptom",
      description: "compressor unusually noisy",
      assertedAt: ASSERTED,
      userId: recorderId,
    });
    assert.equal(finding.workspaceId, owner.workspaceId);
    assert.equal(finding.ventureId, owner.ventureId);
    assert.equal(finding.visitId, visit.id);
    assert.equal(finding.assertedAt, ASSERTED);
    assert.equal(finding.recordedByUserId, recorderId);
  });

  it("rejects malformed findingKind and empty description", async () => {
    const owner = await seed();
    const attendeeId = "user-attendee" as UserId;
    await addMember(owner.workspaceId, attendeeId);
    const { visit } = await seedOpenVisit(owner.service, owner.scope, attendeeId);
    await expectCode(
      () =>
        owner.service.recordTechnicalFinding(owner.scope, visit.id, {
          findingKind: "diagnosis" as "symptom",
          description: "compressor failed",
          assertedAt: ASSERTED,
          userId: attendeeId,
        }),
      "invalid_kind",
    );
    await expectCode(
      () =>
        owner.service.recordTechnicalFinding(owner.scope, visit.id, {
          findingKind: "symptom",
          description: "   ",
          assertedAt: ASSERTED,
          userId: attendeeId,
        }),
      "invalid_input",
    );
  });

  it("enforces assertedAt within visit attendance window", async () => {
    const owner = await seed();
    const attendeeId = "user-attendee" as UserId;
    await addMember(owner.workspaceId, attendeeId);
    const { visit } = await seedOpenVisit(owner.service, owner.scope, attendeeId);
    await expectCode(
      () =>
        owner.service.recordTechnicalFinding(owner.scope, visit.id, {
          findingKind: "symptom",
          description: "compressor not starting",
          assertedAt: EARLY_ASSERTED,
          userId: attendeeId,
        }),
      "invalid_input",
    );
    const departed = await owner.service.recordVisitDeparture(owner.scope, visit.id, {
      departedAt: DEPARTED,
    });
    await expectCode(
      () =>
        owner.service.recordTechnicalFinding(owner.scope, departed.id, {
          findingKind: "symptom",
          description: "compressor not starting",
          assertedAt: LATE_ASSERTED,
          userId: attendeeId,
        }),
      "invalid_input",
    );
    const delayed = await owner.service.recordTechnicalFinding(owner.scope, departed.id, {
      findingKind: "symptom",
      description: "compressor not starting",
      assertedAt: ASSERTED,
      userId: attendeeId,
    });
    assert.equal(delayed.assertedAt, ASSERTED);
  });

  it("rejects finding on cancelled Visit and preserves existing findings", async () => {
    const owner = await seed();
    const attendeeId = "user-attendee" as UserId;
    await addMember(owner.workspaceId, attendeeId);
    const { visit } = await seedOpenVisit(owner.service, owner.scope, attendeeId);
    const finding = await owner.service.recordTechnicalFinding(owner.scope, visit.id, {
      findingKind: "symptom",
      description: "compressor not starting",
      assertedAt: ASSERTED,
      userId: attendeeId,
    });
    await owner.service.cancelVisit(owner.scope, visit.id);
    await expectCode(
      () =>
        owner.service.recordTechnicalFinding(owner.scope, visit.id, {
          findingKind: "symptom",
          description: "late note",
          assertedAt: ASSERTED,
          userId: attendeeId,
        }),
      "invalid_status",
    );
    const persisted = await owner.service.getTechnicalFinding(owner.scope, finding.id);
    assert.equal(persisted?.id, finding.id);
  });

  it("allows delayed finding after WorkOrder close or cancel and preserves existing findings", async () => {
    const owner = await seed();
    const attendeeId = "user-attendee" as UserId;
    await addMember(owner.workspaceId, attendeeId);
    const { workOrder, visit } = await seedOpenVisit(owner.service, owner.scope, attendeeId);
    const beforeClose = await owner.service.recordTechnicalFinding(owner.scope, visit.id, {
      findingKind: "suspected_fault",
      description: "possible refrigerant loss",
      assertedAt: ASSERTED,
      userId: attendeeId,
    });
    await owner.service.closeWorkOrder(owner.scope, workOrder.id);
    const afterClose = await owner.service.recordTechnicalFinding(owner.scope, visit.id, {
      findingKind: "confirmed_fault",
      description: "compressor electrical failure",
      assertedAt: ASSERTED,
      userId: attendeeId,
    });
    assert.equal(afterClose.workOrderId, workOrder.id);
    const loaded = await owner.service.getTechnicalFinding(owner.scope, beforeClose.id);
    assert.equal(loaded?.id, beforeClose.id);
    assert.deepEqual(
      new Set(
        (await owner.service.listTechnicalFindingsByWorkOrder(owner.scope, workOrder.id)).map(
          (r) => r.id,
        ),
      ),
      new Set([beforeClose.id, afterClose.id]),
    );

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
    const beforeCancel = await owner2.service.recordTechnicalFinding(owner2.scope, visit2.id, {
      findingKind: "symptom",
      description: "evaporator heavily iced",
      assertedAt: ASSERTED,
      userId: attendeeId,
    });
    await owner2.service.cancelWorkOrder(owner2.scope, wo2.id);
    const afterCancel = await owner2.service.getTechnicalFinding(owner2.scope, beforeCancel.id);
    assert.equal(afterCancel?.id, beforeCancel.id);
    assert.deepEqual(
      (await owner2.service.listTechnicalFindingsByVisit(owner2.scope, visit2.id)).map((r) => r.id),
      [beforeCancel.id],
    );
  });

  it("rejects invalid membership and scopes get/list queries to tenant", async () => {
    const owner = await seed();
    const attendeeId = "user-attendee" as UserId;
    await addMember(owner.workspaceId, attendeeId);
    const { visit } = await seedOpenVisit(owner.service, owner.scope, attendeeId);
    await expectCode(
      () =>
        owner.service.recordTechnicalFinding(owner.scope, visit.id, {
          findingKind: "symptom",
          description: "compressor not starting",
          assertedAt: ASSERTED,
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
        owner.service.recordTechnicalFinding(owner.scope, visit.id, {
          findingKind: "symptom",
          description: "compressor not starting",
          assertedAt: ASSERTED,
          userId: outsiderId,
        }),
      "not_found",
    );
    const finding = await owner.service.recordTechnicalFinding(owner.scope, visit.id, {
      findingKind: "symptom",
      description: "compressor not starting",
      assertedAt: ASSERTED,
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
      await owner.service.getTechnicalFinding({ ...owner.scope, ventureId: otherVenture }, finding.id),
      null,
    );
  });

  it("scopes list queries to workspace and venture", async () => {
    const owner = await seed();
    const attendeeId = "user-attendee" as UserId;
    await addMember(owner.workspaceId, attendeeId);
    const { workOrder, asset, visit } = await seedOpenVisit(owner.service, owner.scope, attendeeId);
    await owner.service.recordTechnicalFinding(owner.scope, visit.id, {
      findingKind: "symptom",
      description: "compressor not starting",
      assertedAt: ASSERTED,
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
      await owner.service.listTechnicalFindingsByVisit(otherVentureScope, visit.id),
      [],
    );
    assert.deepEqual(
      await owner.service.listTechnicalFindingsByWorkOrder(otherVentureScope, workOrder.id),
      [],
    );
    assert.deepEqual(
      await owner.service.listTechnicalFindingsByAsset(otherVentureScope, asset.id),
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
      await otherWorkspace.service.listTechnicalFindingsByVisit(crossWorkspaceScope, visit.id),
      [],
    );
    assert.deepEqual(
      await otherWorkspace.service.listTechnicalFindingsByWorkOrder(crossWorkspaceScope, workOrder.id),
      [],
    );
    assert.deepEqual(
      await otherWorkspace.service.listTechnicalFindingsByAsset(crossWorkspaceScope, asset.id),
      [],
    );
    assert.equal(
      (await owner.service.listTechnicalFindingsByVisit(owner.scope, visit.id)).length,
      1,
    );
  });

  it("lists findings by visit, work order, and asset with return-visit ownership", async () => {
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
    const findingA = await owner.service.recordTechnicalFinding(owner.scope, visitA.id, {
      findingKind: "symptom",
      description: "compressor not starting",
      assertedAt: "2026-08-26T10:15:00.000Z",
      userId: attendeeId,
      assetId: asset.id,
    });
    const findingB = await owner.service.recordTechnicalFinding(owner.scope, visitB.id, {
      findingKind: "confirmed_fault",
      description: "compressor electrical failure",
      assertedAt: ASSERTED,
      userId: attendeeId,
    });
    assert.deepEqual(
      (await owner.service.listTechnicalFindingsByVisit(owner.scope, visitA.id)).map((r) => r.id),
      [findingA.id],
    );
    assert.deepEqual(
      (await owner.service.listTechnicalFindingsByVisit(owner.scope, visitB.id)).map((r) => r.id),
      [findingB.id],
    );
    const byWorkOrder = await owner.service.listTechnicalFindingsByWorkOrder(
      owner.scope,
      workOrder.id,
    );
    assert.equal(byWorkOrder.length, 2);
    assert.equal(
      (await owner.service.listTechnicalFindingsByAsset(owner.scope, asset.id))[0]?.id,
      findingA.id,
    );
  });

  it("does not mutate assignment, visit, or work order lifecycle", async () => {
    const owner = await seed();
    const assigneeId = "user-assignee" as UserId;
    const recorderId = "user-recorder" as UserId;
    await addMember(owner.workspaceId, assigneeId);
    await addMember(owner.workspaceId, recorderId);
    const { workOrder, visit } = await seedOpenVisit(owner.service, owner.scope, recorderId);
    await owner.service.assignWorkOrder(owner.scope, workOrder.id, { userId: assigneeId });
    await owner.service.recordTechnicalFinding(owner.scope, visit.id, {
      findingKind: "symptom",
      description: "compressor unusually noisy",
      assertedAt: ASSERTED,
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
        owner.service.recordTechnicalFinding(owner.scope, visit.id, {
          findingKind: "symptom",
          description: "compressor not starting",
          assertedAt: ASSERTED,
          userId: attendeeId,
          assetId: foreignAsset.id,
        }),
      "invalid_input",
    );
    const withAsset = await owner.service.recordTechnicalFinding(owner.scope, visit.id, {
      findingKind: "symptom",
      description: "compressor not starting",
      assertedAt: ASSERTED,
      userId: attendeeId,
      assetId: asset.id,
    });
    assert.equal(withAsset.assetId, asset.id);
  });

  it("validates sourceFieldCaptureIds provenance on same Visit", async () => {
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
    const captureOnA = await owner.service.recordFieldCapture(owner.scope, visitA.id, {
      captureKind: "condition",
      captureCode: "visual_condition",
      description: "evaporator visibly iced",
      observedAt: "2026-08-26T10:15:00.000Z",
      userId: attendeeId,
      assetId: asset.id,
    });
    const captureOnB = await owner.service.recordFieldCapture(owner.scope, visitB.id, {
      captureKind: "measurement",
      captureCode: "temperature",
      valueNumeric: -18,
      valueUnit: "celsius",
      observedAt: ASSERTED,
      userId: attendeeId,
    });

    await expectCode(
      () =>
        owner.service.recordTechnicalFinding(owner.scope, visitA.id, {
          findingKind: "suspected_fault",
          description: "possible refrigerant loss",
          assertedAt: "2026-08-26T10:20:00.000Z",
          userId: attendeeId,
          sourceFieldCaptureIds: ["missing-capture"],
        }),
      "not_found",
    );
    await expectCode(
      () =>
        owner.service.recordTechnicalFinding(owner.scope, visitA.id, {
          findingKind: "suspected_fault",
          description: "possible refrigerant loss",
          assertedAt: "2026-08-26T10:20:00.000Z",
          userId: attendeeId,
          sourceFieldCaptureIds: [captureOnB.id],
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
    const foreignCapture = await otherWorkspace.service.recordFieldCapture(
      {
        userId: owner.userId,
        workspaceId: otherWorkspace.workspaceId,
        ventureId: otherWorkspace.ventureId,
      },
      foreignVisit.id,
      {
        captureKind: "condition",
        captureCode: "visual_condition",
        description: "foreign",
        observedAt: ASSERTED,
        userId: attendeeId,
      },
    );
    await expectCode(
      () =>
        owner.service.recordTechnicalFinding(owner.scope, visitA.id, {
          findingKind: "suspected_fault",
          description: "possible refrigerant loss",
          assertedAt: "2026-08-26T10:20:00.000Z",
          userId: attendeeId,
          sourceFieldCaptureIds: [foreignCapture.id],
        }),
      "not_found",
    );

    const withSources = await owner.service.recordTechnicalFinding(owner.scope, visitA.id, {
      findingKind: "suspected_fault",
      description: "possible refrigerant loss",
      assertedAt: "2026-08-26T10:20:00.000Z",
      userId: attendeeId,
      sourceFieldCaptureIds: [captureOnA.id, captureOnA.id],
    });
    assert.deepEqual(withSources.sourceFieldCaptureIds, [captureOnA.id]);
    const captureAfter = await owner.service.getFieldCapture(owner.scope, captureOnA.id);
    assert.equal(captureAfter?.description, "evaporator visibly iced");
  });

  it("keeps FieldCapture and reportedCondition distinct from TechnicalFinding", async () => {
    const owner = await seed();
    const attendeeId = "user-attendee" as UserId;
    await addMember(owner.workspaceId, attendeeId);
    const { workOrder, visit } = await seedOpenVisit(owner.service, owner.scope, attendeeId);
    const capture = await owner.service.recordFieldCapture(owner.scope, visit.id, {
      captureKind: "condition",
      captureCode: "visual_condition",
      description: "evaporator visibly iced",
      observedAt: ASSERTED,
      userId: attendeeId,
    });
    const finding = await owner.service.recordTechnicalFinding(owner.scope, visit.id, {
      findingKind: "symptom",
      description: "evaporator heavily iced",
      assertedAt: ASSERTED,
      userId: attendeeId,
    });
    assert.equal(capture.captureKind, "condition");
    assert.equal(finding.findingKind, "symptom");
    const loadedWo = await owner.service.getWorkOrder(owner.scope, workOrder.id);
    assert.equal(loadedWo?.reportedCondition, "display freezer warm");
    assert.notEqual(loadedWo?.reportedCondition, finding.description);
  });

  it("supports persisted Frigora 0.6.0 instance", async () => {
    const owner = await seed({ definitionVersion: "0.6.0" });
    const attendeeId = "user-attendee" as UserId;
    await addMember(owner.workspaceId, attendeeId);
    const { visit } = await seedOpenVisit(owner.service, owner.scope, attendeeId);
    const finding = await owner.service.recordTechnicalFinding(owner.scope, visit.id, {
      findingKind: "symptom",
      description: "compressor not starting",
      assertedAt: ASSERTED,
      userId: attendeeId,
    });
    assert.equal(finding.findingKind, "symptom");
  });

  it("resolves frigora@0.7.0 from catalog with technical finding admission", () => {
    assert.equal(platformVentureRegistry.resolve("frigora").version, "0.7.0");
    assert.match(
      platformVentureRegistry.resolve("frigora").description,
      /Visit technical findings/,
    );
    assert.match(
      platformVentureRegistry.resolve("frigora").description,
      /full diagnosis workflow/,
    );
    assert.match(
      platformVentureRegistry.resolve("frigora").description,
      /repair/,
    );
  });
});
