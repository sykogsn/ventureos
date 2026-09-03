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
import type { FrigoraRecommendedAction, FrigoraScope } from "./types";

const NOW = "2026-08-28T00:00:00.000Z";
const ARRIVED = "2026-08-28T10:00:00.000Z";
const RECOMMENDED_AT = "2026-08-28T10:30:00.000Z";
const DEPARTED = "2026-08-28T11:00:00.000Z";
const EARLY_RECOMMENDED = "2026-08-28T09:00:00.000Z";
const LATE_RECOMMENDED = "2026-08-28T12:00:00.000Z";

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

function recordInput(
  overrides: Partial<{
    description: string;
    recommendedAt: string;
    recommendedByUserId: UserId;
    recordedByUserId: UserId;
    assetId: string | null;
  }> = {},
) {
  return {
    description: overrides.description ?? "Replace compressor",
    recommendedAt: overrides.recommendedAt ?? RECOMMENDED_AT,
    recommendedByUserId: overrides.recommendedByUserId ?? ("user-attendee" as UserId),
    recordedByUserId: overrides.recordedByUserId ?? ("user-attendee" as UserId),
    assetId: overrides.assetId,
  };
}

function assertNoForbiddenSemantics(record: FrigoraRecommendedAction) {
  assert.equal("priority" in record, false);
  assert.equal("status" in record, false);
  assert.equal("category" in record, false);
  assert.equal("dueAt" in record, false);
  assert.equal("requiresReturnVisit" in record, false);
  assert.equal("requiresParts" in record, false);
  assert.equal("confidence" in record, false);
  assert.equal("signalId" in record, false);
  assert.equal("patternId" in record, false);
  assert.equal("diagnosisId" in record, false);
  assert.equal("approved" in record, false);
  assert.equal("sourceFindingId" in record, false);
  assert.equal("sourceOutcomeId" in record, false);
  assert.equal("refrigerantType" in record, false);
  assert.equal("quantity" in record, false);
  assert.equal("evidence" in record, false);
  assert.equal("performedByUserId" in record, false);
  assert.equal("outcomeAt" in record, false);
}

describe("Frigora Recommended action", () => {
  it("records valid recommendation with tenant fields and derived workOrderId", async () => {
    const owner = await seed();
    const recommenderId = "user-recommender" as UserId;
    const recorderId = "user-recorder" as UserId;
    await addMember(owner.workspaceId, recommenderId);
    await addMember(owner.workspaceId, recorderId);
    const { visit } = await seedOpenVisit(owner.service, owner.scope, recommenderId);
    const recommendation = await owner.service.recordRecommendedAction(owner.scope, visit.id, {
      description: "Return with lifting equipment to replace compressor",
      recommendedAt: RECOMMENDED_AT,
      recommendedByUserId: recommenderId,
      recordedByUserId: recorderId,
    });
    assert.ok(recommendation.id);
    assert.equal(recommendation.workspaceId, owner.workspaceId);
    assert.equal(recommendation.ventureId, owner.ventureId);
    assert.equal(recommendation.visitId, visit.id);
    assert.equal(recommendation.workOrderId, visit.workOrderId);
    assert.equal(
      recommendation.description,
      "Return with lifting equipment to replace compressor",
    );
    assert.equal(recommendation.recommendedAt, RECOMMENDED_AT);
    assert.equal(recommendation.recommendedByUserId, recommenderId);
    assert.equal(recommendation.recordedByUserId, recorderId);
    assert.equal(recommendation.createdAt, recommendation.updatedAt);
    assert.equal(recommendation.assetId, null);
    assertNoForbiddenSemantics(recommendation);
    const loaded = await owner.service.getRecommendedAction(owner.scope, recommendation.id);
    assert.equal(loaded?.id, recommendation.id);
  });

  it("allows multiple recommendations per Visit", async () => {
    const owner = await seed();
    const attendeeId = "user-attendee" as UserId;
    await addMember(owner.workspaceId, attendeeId);
    const { visit } = await seedOpenVisit(owner.service, owner.scope, attendeeId);
    const first = await owner.service.recordRecommendedAction(
      owner.scope,
      visit.id,
      recordInput({
        description: "Replace compressor",
        recommendedAt: "2026-08-28T10:15:00.000Z",
      }),
    );
    const second = await owner.service.recordRecommendedAction(
      owner.scope,
      visit.id,
      recordInput({
        description: "Replace liquid-line drier",
        recommendedAt: "2026-08-28T10:30:00.000Z",
      }),
    );
    const third = await owner.service.recordRecommendedAction(
      owner.scope,
      visit.id,
      recordInput({
        description: "Inspect electrical supply before recommissioning",
        recommendedAt: "2026-08-28T10:45:00.000Z",
      }),
    );
    const listed = await owner.service.listRecommendedActionsByVisit(owner.scope, visit.id);
    assert.equal(listed.length, 3);
    assert.deepEqual(listed.map((r) => r.id), [first.id, second.id, third.id]);
  });

  it("accepts optional asset and null asset", async () => {
    const owner = await seed();
    const attendeeId = "user-attendee" as UserId;
    await addMember(owner.workspaceId, attendeeId);
    const { workOrder, asset } = await seedHierarchy(owner.service, owner.scope);
    const visit = await owner.service.recordVisitArrival(owner.scope, workOrder.id, {
      userId: attendeeId,
      arrivedAt: ARRIVED,
    });
    const withAsset = await owner.service.recordRecommendedAction(owner.scope, visit.id, {
      description: "Replace compressor on evaporator circuit",
      recommendedAt: RECOMMENDED_AT,
      recommendedByUserId: attendeeId,
      recordedByUserId: attendeeId,
      assetId: asset.id,
    });
    assert.equal(withAsset.assetId, asset.id);
    const nullAsset = await owner.service.recordRecommendedAction(owner.scope, visit.id, {
      description: "Inspect site electrical supply",
      recommendedAt: RECOMMENDED_AT,
      recommendedByUserId: attendeeId,
      recordedByUserId: attendeeId,
      assetId: null,
    });
    assert.equal(nullAsset.assetId, null);
  });

  it("rejects wrong-site, cross-venture, and cross-workspace asset references", async () => {
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
        owner.service.recordRecommendedAction(owner.scope, visit.id, {
          description: "Replace compressor",
          recommendedAt: RECOMMENDED_AT,
          recommendedByUserId: attendeeId,
          recordedByUserId: attendeeId,
          assetId: foreignAsset.id,
        }),
      "invalid_input",
    );
    const otherVenture = "ven-other" as VentureId;
    const owner2 = await seed({
      reset: false,
      ventureId: otherVenture,
      userId: owner.userId,
    });
    const customer2 = await owner2.service.createCustomer(owner2.scope, {
      code: "OTHERCO",
      displayName: "OtherCo",
    });
    const site2 = await owner2.service.createSite(owner2.scope, {
      customerId: customer2.id,
      code: "OTHER-SITE",
      name: "Other Site",
    });
    const otherAsset = await owner2.service.createAsset(owner2.scope, {
      siteId: site2.id,
      tag: "OTHER-ASSET",
    });
    await expectCode(
      () =>
        owner.service.recordRecommendedAction(owner.scope, visit.id, {
          description: "Replace compressor",
          recommendedAt: RECOMMENDED_AT,
          recommendedByUserId: attendeeId,
          recordedByUserId: attendeeId,
          assetId: otherAsset.id,
        }),
      "not_found",
    );
    await owner.service.recordRecommendedAction(owner.scope, visit.id, {
      description: "Valid recommendation",
      recommendedAt: RECOMMENDED_AT,
      recommendedByUserId: attendeeId,
      recordedByUserId: attendeeId,
      assetId: asset.id,
    });
  });

  it("requires workspace members for provenance and allows flexible provenance", async () => {
    const owner = await seed();
    const attendeeId = "user-attendee" as UserId;
    const recommenderId = "user-recommender" as UserId;
    const recorderId = "user-recorder" as UserId;
    await addMember(owner.workspaceId, attendeeId);
    await addMember(owner.workspaceId, recommenderId);
    await addMember(owner.workspaceId, recorderId);
    const { visit } = await seedOpenVisit(owner.service, owner.scope, attendeeId);
    await expectCode(
      () =>
        owner.service.recordRecommendedAction(owner.scope, visit.id, {
          description: "Replace compressor",
          recommendedAt: RECOMMENDED_AT,
          recommendedByUserId: "user-outsider",
          recordedByUserId: attendeeId,
        }),
      "not_found",
    );
    await expectCode(
      () =>
        owner.service.recordRecommendedAction(owner.scope, visit.id, {
          description: "Replace compressor",
          recommendedAt: RECOMMENDED_AT,
          recommendedByUserId: attendeeId,
          recordedByUserId: "user-outsider",
        }),
      "not_found",
    );
    const same = await owner.service.recordRecommendedAction(owner.scope, visit.id, {
      description: "Return with lifting equipment",
      recommendedAt: RECOMMENDED_AT,
      recommendedByUserId: attendeeId,
      recordedByUserId: attendeeId,
    });
    assert.equal(same.recommendedByUserId, same.recordedByUserId);
    const different = await owner.service.recordRecommendedAction(owner.scope, visit.id, {
      description: "Replace liquid-line drier",
      recommendedAt: RECOMMENDED_AT,
      recommendedByUserId: recommenderId,
      recordedByUserId: recorderId,
    });
    assert.notEqual(different.recommendedByUserId, different.recordedByUserId);
    assert.notEqual(different.recommendedByUserId, attendeeId);
  });

  it("enforces recommendedAt within visit attendance window", async () => {
    const owner = await seed();
    const attendeeId = "user-attendee" as UserId;
    await addMember(owner.workspaceId, attendeeId);
    const { visit } = await seedOpenVisit(owner.service, owner.scope, attendeeId);
    await expectCode(
      () =>
        owner.service.recordRecommendedAction(
          owner.scope,
          visit.id,
          recordInput({ recommendedAt: EARLY_RECOMMENDED }),
        ),
      "invalid_input",
    );
    const departed = await owner.service.recordVisitDeparture(owner.scope, visit.id, {
      departedAt: DEPARTED,
    });
    await expectCode(
      () =>
        owner.service.recordRecommendedAction(
          owner.scope,
          departed.id,
          recordInput({ recommendedAt: LATE_RECOMMENDED }),
        ),
      "invalid_input",
    );
    const delayed = await owner.service.recordRecommendedAction(
      owner.scope,
      departed.id,
      recordInput({ recommendedAt: RECOMMENDED_AT }),
    );
    assert.equal(delayed.recommendedAt, RECOMMENDED_AT);
  });

  it("rejects cancelled Visit and blank or malformed input", async () => {
    const owner = await seed();
    const attendeeId = "user-attendee" as UserId;
    await addMember(owner.workspaceId, attendeeId);
    const { visit } = await seedOpenVisit(owner.service, owner.scope, attendeeId);
    await expectCode(
      () =>
        owner.service.recordRecommendedAction(owner.scope, visit.id, {
          description: "   ",
          recommendedAt: RECOMMENDED_AT,
          recommendedByUserId: attendeeId,
          recordedByUserId: attendeeId,
        }),
      "invalid_input",
    );
    await expectCode(
      () =>
        owner.service.recordRecommendedAction(owner.scope, visit.id, {
          description: "Replace compressor",
          recommendedAt: "not-a-timestamp",
          recommendedByUserId: attendeeId,
          recordedByUserId: attendeeId,
        }),
      "invalid_input",
    );
    const recommendation = await owner.service.recordRecommendedAction(
      owner.scope,
      visit.id,
      recordInput(),
    );
    await owner.service.cancelVisit(owner.scope, visit.id);
    await expectCode(
      () => owner.service.recordRecommendedAction(owner.scope, visit.id, recordInput()),
      "invalid_status",
    );
    const persisted = await owner.service.getRecommendedAction(owner.scope, recommendation.id);
    assert.equal(persisted?.id, recommendation.id);
  });

  it("preserves recommendations after WorkOrder close or cancel and allows delayed entry", async () => {
    const owner = await seed();
    const attendeeId = "user-attendee" as UserId;
    await addMember(owner.workspaceId, attendeeId);
    const { workOrder, visit } = await seedOpenVisit(owner.service, owner.scope, attendeeId);
    const beforeClose = await owner.service.recordRecommendedAction(
      owner.scope,
      visit.id,
      recordInput({ description: "Replace compressor" }),
    );
    await owner.service.closeWorkOrder(owner.scope, workOrder.id);
    const afterClose = await owner.service.recordRecommendedAction(
      owner.scope,
      visit.id,
      recordInput({ description: "Replace liquid-line drier" }),
    );
    assert.equal(afterClose.workOrderId, workOrder.id);
    const persistedBeforeClose = await owner.service.getRecommendedAction(
      owner.scope,
      beforeClose.id,
    );
    assert.equal(persistedBeforeClose?.id, beforeClose.id);

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
    const beforeCancel = await owner2.service.recordRecommendedAction(
      owner2.scope,
      visit2.id,
      recordInput({ description: "Inspect electrical supply" }),
    );
    await owner2.service.cancelWorkOrder(owner2.scope, wo2.id);
    const afterCancel = await owner2.service.recordRecommendedAction(
      owner2.scope,
      visit2.id,
      recordInput({ description: "Return with lifting equipment" }),
    );
    assert.equal(afterCancel.workOrderId, wo2.id);
    const persistedBeforeCancel = await owner2.service.getRecommendedAction(
      owner2.scope,
      beforeCancel.id,
    );
    assert.equal(persistedBeforeCancel?.id, beforeCancel.id);
  });

  it("does not require VisitOutcome and keeps truth layers independent", async () => {
    const owner = await seed();
    const attendeeId = "user-attendee" as UserId;
    await addMember(owner.workspaceId, attendeeId);
    const { visit } = await seedOpenVisit(owner.service, owner.scope, attendeeId);
    const beforeOutcome = await owner.service.recordRecommendedAction(
      owner.scope,
      visit.id,
      recordInput({ description: "Return to leak-test circuit" }),
    );
    const outcome = await owner.service.recordVisitOutcome(owner.scope, visit.id, {
      description: "Unit remained isolated and cooling was not restored",
      outcomeAt: RECOMMENDED_AT,
      recordedByUserId: attendeeId,
    });
    const afterOutcome = await owner.service.recordRecommendedAction(
      owner.scope,
      visit.id,
      recordInput({ description: "Replace compressor" }),
    );
    assert.notEqual(beforeOutcome.description, outcome.description);
    assert.notEqual(afterOutcome.description, outcome.description);
    const action = await owner.service.recordCorrectiveAction(owner.scope, visit.id, {
      description: "Isolated electrical supply",
      performedAt: RECOMMENDED_AT,
      performedByUserId: attendeeId,
      recordedByUserId: attendeeId,
    });
    const finding = await owner.service.recordTechnicalFinding(owner.scope, visit.id, {
      findingKind: "confirmed_fault",
      description: "Compressor winding open circuit",
      assertedAt: RECOMMENDED_AT,
      userId: attendeeId,
    });
    assert.notEqual(beforeOutcome.description, action.description);
    assert.notEqual(beforeOutcome.description, finding.description);
  });

  it("does not mutate WorkOrder, Visit, or other visit facts", async () => {
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
      observedAt: RECOMMENDED_AT,
      userId: attendeeId,
    });
    const finding = await owner.service.recordTechnicalFinding(owner.scope, visit.id, {
      findingKind: "confirmed_fault",
      description: "compressor electrical failure",
      assertedAt: RECOMMENDED_AT,
      userId: attendeeId,
    });
    const action = await owner.service.recordCorrectiveAction(owner.scope, visit.id, {
      description: "Isolated electrical supply",
      performedAt: RECOMMENDED_AT,
      performedByUserId: attendeeId,
      recordedByUserId: recorderId,
    });
    const outcome = await owner.service.recordVisitOutcome(owner.scope, visit.id, {
      description: "Unit remained isolated",
      outcomeAt: RECOMMENDED_AT,
      recordedByUserId: recorderId,
    });
    await owner.service.recordRecommendedAction(owner.scope, visit.id, {
      description: "Replace compressor",
      recommendedAt: RECOMMENDED_AT,
      recommendedByUserId: attendeeId,
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
    const loadedOutcome = await owner.service.getVisitOutcome(owner.scope, outcome.id);
    assert.equal(loadedCapture?.valueNumeric, -18);
    assert.equal(loadedFinding?.findingKind, "confirmed_fault");
    assert.equal(loadedAction?.description, "Isolated electrical supply");
    assert.equal(loadedOutcome?.description, "Unit remained isolated");
  });

  it("does not create platform recommendations or asset history persistence", async () => {
    const owner = await seed();
    const attendeeId = "user-attendee" as UserId;
    await addMember(owner.workspaceId, attendeeId);
    const { visit } = await seedOpenVisit(owner.service, owner.scope, attendeeId);
    const before = (await getPersistence().recommendations.listForWorkspace(owner.workspaceId))
      .length;
    await owner.service.recordRecommendedAction(owner.scope, visit.id, recordInput());
    const after = (await getPersistence().recommendations.listForWorkspace(owner.workspaceId))
      .length;
    assert.equal(after, before);
    assert.equal("listAssetHistory" in owner.service, true);
    assert.equal("listServiceHistory" in owner.service, false);
  });

  it("scopes reads and rejects non-frigora venture", async () => {
    const owner = await seed();
    const attendeeId = "user-attendee" as UserId;
    await addMember(owner.workspaceId, attendeeId);
    const { workOrder, asset, visit } = await seedOpenVisit(owner.service, owner.scope, attendeeId);
    const recommendation = await owner.service.recordRecommendedAction(
      owner.scope,
      visit.id,
      recordInput({ assetId: asset.id }),
    );
    const otherVenture = "ven-other" as VentureId;
    await getPersistence().ventures.insert(
      ventureRow({
        id: otherVenture,
        workspaceId: owner.workspaceId,
        slug: "other-frigora",
      }),
    );
    const otherScope = { ...owner.scope, ventureId: otherVenture };
    assert.equal(await owner.service.getRecommendedAction(otherScope, recommendation.id), null);
    assert.deepEqual(await owner.service.listRecommendedActionsByVisit(otherScope, visit.id), []);
    assert.deepEqual(
      await owner.service.listRecommendedActionsByWorkOrder(otherScope, workOrder.id),
      [],
    );
    assert.deepEqual(await owner.service.listRecommendedActionsByAsset(otherScope, asset.id), []);
    const { scope, service } = await seed({ definitionId: "ventureos.company" });
    await expectCode(
      () => service.recordRecommendedAction(scope, visit.id, recordInput()),
      "not_frigora",
    );
  });

  it("orders list results by recommendedAt then id", async () => {
    const owner = await seed();
    const attendeeId = "user-attendee" as UserId;
    await addMember(owner.workspaceId, attendeeId);
    const { workOrder, asset, visit } = await seedOpenVisit(owner.service, owner.scope, attendeeId);
    const early = await owner.service.recordRecommendedAction(owner.scope, visit.id, {
      description: "Inspect electrical supply",
      recommendedAt: "2026-08-28T10:15:00.000Z",
      recommendedByUserId: attendeeId,
      recordedByUserId: attendeeId,
    });
    const late = await owner.service.recordRecommendedAction(owner.scope, visit.id, {
      description: "Replace compressor",
      recommendedAt: "2026-08-28T10:45:00.000Z",
      recommendedByUserId: attendeeId,
      recordedByUserId: attendeeId,
      assetId: asset.id,
    });
    assert.deepEqual(
      (await owner.service.listRecommendedActionsByVisit(owner.scope, visit.id)).map((r) => r.id),
      [early.id, late.id],
    );
    assert.deepEqual(
      (await owner.service.listRecommendedActionsByWorkOrder(owner.scope, workOrder.id)).map(
        (r) => r.id,
      ),
      [early.id, late.id],
    );
    assert.deepEqual(
      (await owner.service.listRecommendedActionsByAsset(owner.scope, asset.id)).map((r) => r.id),
      [late.id],
    );
  });

  it("supports persisted Frigora 0.9.0 instance for prior capabilities", async () => {
    const owner = await seed({ definitionVersion: "0.9.0" });
    const attendeeId = "user-attendee" as UserId;
    await addMember(owner.workspaceId, attendeeId);
    const { visit } = await seedOpenVisit(owner.service, owner.scope, attendeeId);
    const outcome = await owner.service.recordVisitOutcome(owner.scope, visit.id, {
      description: "Temporary operation was restored",
      outcomeAt: RECOMMENDED_AT,
      recordedByUserId: attendeeId,
    });
    assert.equal(outcome.description, "Temporary operation was restored");
  });

  it("supports persisted Frigora 0.10.0 instance for prior capabilities", async () => {
    const owner = await seed({ definitionVersion: "0.10.0" });
    const attendeeId = "user-attendee" as UserId;
    await addMember(owner.workspaceId, attendeeId);
    const { visit } = await seedOpenVisit(owner.service, owner.scope, attendeeId);
    const recommendation = await owner.service.recordRecommendedAction(owner.scope, visit.id, {
      description: "Return with lifting equipment",
      recommendedAt: RECOMMENDED_AT,
      recommendedByUserId: attendeeId,
      recordedByUserId: attendeeId,
    });
    assert.equal(recommendation.description, "Return with lifting equipment");
  });

  it("resolves frigora@0.16.0 from catalog with recommended action admission", () => {
    assert.equal(platformVentureRegistry.resolve("frigora").version, "0.16.0");
    assert.match(platformVentureRegistry.resolve("frigora").description, /recommended actions/);
    assert.match(platformVentureRegistry.resolve("frigora").description, /refrigerant events/);
    assert.match(platformVentureRegistry.resolve("frigora").description, /part usages/);
    assert.match(platformVentureRegistry.resolve("frigora").description, /employee agents/);
  });
});
