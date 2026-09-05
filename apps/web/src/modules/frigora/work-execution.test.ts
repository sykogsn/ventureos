import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, it } from "node:test";
import { platformVentureRegistry } from "@/core/venture-definition/catalog";
import type { Role, UserId, VentureId, WorkspaceId } from "@/contracts";
import { createPermissionService } from "@/platform/permissions/service";
import { createDbMembershipStore } from "@/platform/permissions/membership-store";
import { ensureSchema } from "@/platform/persistence/db";
import { getPersistence, resetPersistenceLifecycle } from "@/platform/persistence/repositories";
import { closeFrigoraPersistenceAfterFile } from "./test-persistence-lifecycle";
import {
  completeWorkOrderFromVisit,
  TEST_CANCELLATION_REASON,
} from "./test-work-execution";
import type { PersistedVenture } from "@/platform/persistence/repositories/ports";
import { FrigoraError } from "./errors";
import { createFrigoraService } from "./service";
import type { FrigoraScope, FrigoraWorkOrder } from "./types";
import { cancelWorkOrderSchema, parseWithFrigora } from "./validation";

const NOW = "2026-08-28T00:00:00.000Z";
const ARRIVED = "2026-08-28T10:00:00.000Z";
const OUTCOME_AT = "2026-08-28T10:30:00.000Z";
const DEPARTED = "2026-08-28T11:00:00.000Z";
const OBSERVED = "2026-08-28T10:20:00.000Z";
const WEB_ROOT = join(process.cwd(), "src");

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

async function addMember(workspaceId: WorkspaceId, userId: UserId) {
  await getPersistence().memberships.setRole({
    userId,
    workspaceId,
    role: "member",
    createdAt: NOW,
  });
}

async function seedHierarchy(
  service: ReturnType<typeof createFrigoraService>,
  scope: FrigoraScope,
  reference = "WO-1864",
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
  });
  const workOrder = await service.createWorkOrder(scope, {
    siteId: site.id,
    workReference: reference,
    workKind: "reactive",
    reportedCondition: "display freezer warm",
    primaryAssetId: asset.id,
  });
  return { customer, site, asset, workOrder };
}

async function seedOpenVisit(
  service: ReturnType<typeof createFrigoraService>,
  scope: FrigoraScope,
  attendeeId: UserId,
  reference = "WO-1864",
) {
  const hierarchy = await seedHierarchy(service, scope, reference);
  const visit = await service.recordVisitArrival(scope, hierarchy.workOrder.id, {
    userId: attendeeId,
    arrivedAt: ARRIVED,
  });
  return { ...hierarchy, visit };
}

function assertCompletionVocabulary(workOrder: FrigoraWorkOrder) {
  assert.equal(workOrder.status, "closed");
  assert.notEqual(workOrder.status, "completed");
  assert.equal("completedAt" in workOrder, false);
  assert.equal("completed" in workOrder, false);
}

describe("F2.1 Work Execution — completion", () => {
  it("rejects completion with no Visit", async () => {
    const owner = await seed();
    const { workOrder } = await seedHierarchy(owner.service, owner.scope);
    await expectCode(
      () => owner.service.closeWorkOrder(owner.scope, workOrder.id),
      "invalid_status",
    );
    const loaded = await owner.service.getWorkOrder(owner.scope, workOrder.id);
    assert.equal(loaded?.status, "open");
  });

  it("rejects completion while any Visit is open", async () => {
    const owner = await seed();
    const attendeeId = "user-attendee" as UserId;
    await addMember(owner.workspaceId, attendeeId);
    const { workOrder, visit } = await seedOpenVisit(
      owner.service,
      owner.scope,
      attendeeId,
    );
    await owner.service.recordVisitOutcome(owner.scope, visit.id, {
      description: "Cooling not restored",
      outcomeAt: OUTCOME_AT,
      recordedByUserId: attendeeId,
    });
    await expectCode(
      () => owner.service.closeWorkOrder(owner.scope, workOrder.id),
      "invalid_status",
    );
  });

  it("rejects completion with cancelled Visits only", async () => {
    const owner = await seed();
    const attendeeId = "user-attendee" as UserId;
    await addMember(owner.workspaceId, attendeeId);
    const { workOrder, visit } = await seedOpenVisit(
      owner.service,
      owner.scope,
      attendeeId,
    );
    await owner.service.cancelVisit(owner.scope, visit.id);
    await expectCode(
      () => owner.service.closeWorkOrder(owner.scope, workOrder.id),
      "invalid_status",
    );
  });

  it("rejects completion with a departed Visit and no outcome", async () => {
    const owner = await seed();
    const attendeeId = "user-attendee" as UserId;
    await addMember(owner.workspaceId, attendeeId);
    const { workOrder, visit } = await seedOpenVisit(
      owner.service,
      owner.scope,
      attendeeId,
    );
    await owner.service.recordVisitDeparture(owner.scope, visit.id, {
      departedAt: DEPARTED,
    });
    await expectCode(
      () => owner.service.closeWorkOrder(owner.scope, workOrder.id),
      "invalid_status",
    );
  });

  it("allows completion when a departed Visit has an outcome and no Visits are open", async () => {
    const owner = await seed();
    const attendeeId = "user-attendee" as UserId;
    await addMember(owner.workspaceId, attendeeId);
    const { workOrder, visit } = await seedOpenVisit(
      owner.service,
      owner.scope,
      attendeeId,
    );
    const closed = await completeWorkOrderFromVisit(
      owner.service,
      owner.scope,
      workOrder.id,
      visit,
      attendeeId,
      { outcomeAt: OUTCOME_AT, departedAt: DEPARTED },
    );
    assertCompletionVocabulary(closed);
  });

  it("does not auto-complete the WorkOrder on Visit departure", async () => {
    const owner = await seed();
    const attendeeId = "user-attendee" as UserId;
    await addMember(owner.workspaceId, attendeeId);
    const { workOrder, visit } = await seedOpenVisit(
      owner.service,
      owner.scope,
      attendeeId,
    );
    await owner.service.recordVisitOutcome(owner.scope, visit.id, {
      description: "Temporary cooling restored",
      outcomeAt: OUTCOME_AT,
      recordedByUserId: attendeeId,
    });
    await owner.service.recordVisitDeparture(owner.scope, visit.id, {
      departedAt: DEPARTED,
    });
    const loaded = await owner.service.getWorkOrder(owner.scope, workOrder.id);
    assert.equal(loaded?.status, "open");
  });

  it("does not require evidence, acknowledgement, corrective action, parts, refrigerant, or operational condition", async () => {
    const owner = await seed();
    const attendeeId = "user-attendee" as UserId;
    await addMember(owner.workspaceId, attendeeId);
    const { workOrder, visit } = await seedOpenVisit(
      owner.service,
      owner.scope,
      attendeeId,
    );
    const closed = await completeWorkOrderFromVisit(
      owner.service,
      owner.scope,
      workOrder.id,
      visit,
      attendeeId,
    );
    assertCompletionVocabulary(closed);
    assert.equal(
      (await owner.service.listVisitEvidenceByWorkOrder(owner.scope, workOrder.id)).length,
      0,
    );
    assert.equal(
      (await owner.service.listVisitCustomerAcknowledgementsByWorkOrder(
        owner.scope,
        workOrder.id,
      )).length,
      0,
    );
    assert.equal(
      (await owner.service.listCorrectiveActionsByWorkOrder(owner.scope, workOrder.id)).length,
      0,
    );
  });

  it("does not block completion when a recommended action exists", async () => {
    const owner = await seed();
    const attendeeId = "user-attendee" as UserId;
    await addMember(owner.workspaceId, attendeeId);
    const { workOrder, visit } = await seedOpenVisit(
      owner.service,
      owner.scope,
      attendeeId,
    );
    await owner.service.recordRecommendedAction(owner.scope, visit.id, {
      description: "Replace compressor",
      recommendedAt: OUTCOME_AT,
      recommendedByUserId: attendeeId,
      recordedByUserId: attendeeId,
    });
    const closed = await completeWorkOrderFromVisit(
      owner.service,
      owner.scope,
      workOrder.id,
      visit,
      attendeeId,
    );
    assertCompletionVocabulary(closed);
    assert.equal(
      (await owner.service.listRecommendedActionsByWorkOrder(owner.scope, workOrder.id)).length,
      1,
    );
  });

  it("requires explicit human completion and preserves delayed fact entry on departed Visits", async () => {
    const owner = await seed();
    const attendeeId = "user-attendee" as UserId;
    await addMember(owner.workspaceId, attendeeId);
    const { workOrder, visit } = await seedOpenVisit(
      owner.service,
      owner.scope,
      attendeeId,
    );
    await owner.service.recordVisitOutcome(owner.scope, visit.id, {
      description: "Temporary cooling restored",
      outcomeAt: OUTCOME_AT,
      recordedByUserId: attendeeId,
    });
    const departed = await owner.service.recordVisitDeparture(owner.scope, visit.id, {
      departedAt: DEPARTED,
    });
    assert.equal(
      (await owner.service.getWorkOrder(owner.scope, workOrder.id))?.status,
      "open",
    );
    const closed = await owner.service.closeWorkOrder(owner.scope, workOrder.id);
    assertCompletionVocabulary(closed);
    const delayed = await owner.service.recordFieldCapture(owner.scope, departed.id, {
      captureKind: "measurement",
      captureCode: "temperature",
      valueNumeric: -18,
      valueUnit: "celsius",
      observedAt: OBSERVED,
      userId: attendeeId,
    });
    assert.equal(delayed.visitId, departed.id);
  });

  it("reopens closed WorkOrders and reapplies completion gates", async () => {
    const owner = await seed();
    const attendeeId = "user-attendee" as UserId;
    await addMember(owner.workspaceId, attendeeId);
    const { workOrder, visit } = await seedOpenVisit(
      owner.service,
      owner.scope,
      attendeeId,
    );
    await completeWorkOrderFromVisit(
      owner.service,
      owner.scope,
      workOrder.id,
      visit,
      attendeeId,
    );
    const reopened = await owner.service.reopenWorkOrder(owner.scope, workOrder.id);
    assert.equal(reopened.status, "open");
    const second = await owner.service.recordVisitArrival(owner.scope, workOrder.id, {
      userId: attendeeId,
      arrivedAt: "2026-08-29T10:00:00.000Z",
    });
    await expectCode(
      () => owner.service.closeWorkOrder(owner.scope, workOrder.id),
      "invalid_status",
    );
    const closedAgain = await completeWorkOrderFromVisit(
      owner.service,
      owner.scope,
      workOrder.id,
      second,
      attendeeId,
      {
        outcomeAt: "2026-08-29T10:30:00.000Z",
        departedAt: "2026-08-29T11:00:00.000Z",
      },
    );
    assertCompletionVocabulary(closedAgain);
  });
});

describe("F2.1 Work Execution — cancellation", () => {
  it("requires a non-empty trimmed cancellation reason", async () => {
    const owner = await seed();
    const { workOrder } = await seedHierarchy(owner.service, owner.scope);
    await expectCode(
      () => owner.service.cancelWorkOrder(owner.scope, workOrder.id, { reason: "" }),
      "invalid_input",
    );
    await expectCode(
      () => owner.service.cancelWorkOrder(owner.scope, workOrder.id, { reason: "   " }),
      "invalid_input",
    );
    assert.throws(
      () => parseWithFrigora(cancelWorkOrderSchema, { reason: "   " }),
      (error: unknown) => error instanceof FrigoraError && error.code === "invalid_input",
    );
  });

  it("cancels without a Visit and persists the trimmed reason", async () => {
    const owner = await seed();
    const { workOrder } = await seedHierarchy(owner.service, owner.scope);
    const cancelled = await owner.service.cancelWorkOrder(owner.scope, workOrder.id, {
      reason: `  ${TEST_CANCELLATION_REASON}  `,
    });
    assert.equal(cancelled.status, "cancelled");
    assert.equal(cancelled.cancellationReason, TEST_CANCELLATION_REASON);
  });

  it("rejects cancellation while a Visit is open and allows it once no Visit is open", async () => {
    const owner = await seed();
    const attendeeId = "user-attendee" as UserId;
    await addMember(owner.workspaceId, attendeeId);
    const { workOrder, visit } = await seedOpenVisit(
      owner.service,
      owner.scope,
      attendeeId,
    );
    await expectCode(
      () =>
        owner.service.cancelWorkOrder(owner.scope, workOrder.id, {
          reason: TEST_CANCELLATION_REASON,
        }),
      "invalid_status",
    );
    await owner.service.recordVisitDeparture(owner.scope, visit.id, {
      departedAt: DEPARTED,
    });
    const cancelled = await owner.service.cancelWorkOrder(owner.scope, workOrder.id, {
      reason: TEST_CANCELLATION_REASON,
    });
    assert.equal(cancelled.status, "cancelled");
  });

  it("does not reopen cancelled WorkOrders and preserves historical Visits and facts", async () => {
    const owner = await seed();
    const attendeeId = "user-attendee" as UserId;
    await addMember(owner.workspaceId, attendeeId);
    const { workOrder, visit } = await seedOpenVisit(
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
    await owner.service.recordVisitDeparture(owner.scope, visit.id, {
      departedAt: DEPARTED,
    });
    await owner.service.cancelWorkOrder(owner.scope, workOrder.id, {
      reason: TEST_CANCELLATION_REASON,
    });
    await expectCode(
      () => owner.service.reopenWorkOrder(owner.scope, workOrder.id),
      "invalid_status",
    );
    assert.equal((await owner.service.getVisit(owner.scope, visit.id))?.id, visit.id);
    assert.equal(
      (await owner.service.getFieldCapture(owner.scope, capture.id))?.id,
      capture.id,
    );
  });
});

describe("F2.1 Work Execution — follow-up work", () => {
  it("keeps recommended actions advisory until explicit conversion", async () => {
    const owner = await seed();
    const attendeeId = "user-attendee" as UserId;
    await addMember(owner.workspaceId, attendeeId);
    const { visit } = await seedOpenVisit(
      owner.service,
      owner.scope,
      attendeeId,
    );
    const recommendation = await owner.service.recordRecommendedAction(owner.scope, visit.id, {
      description: "Replace compressor",
      recommendedAt: OUTCOME_AT,
      recommendedByUserId: attendeeId,
      recordedByUserId: attendeeId,
    });
    assert.equal(
      (await owner.service.listWorkOrders(owner.scope)).length,
      1,
    );
    assert.equal(
      await owner.service.getFollowUpWorkOrderByRecommendedAction(
        owner.scope,
        recommendation.id,
      ),
      null,
    );
  });

  it("converts a recommendation into an unassigned reactive follow-up WorkOrder", async () => {
    const owner = await seed();
    const attendeeId = "user-attendee" as UserId;
    await addMember(owner.workspaceId, attendeeId);
    const { customer, site, asset, visit } = await seedOpenVisit(
      owner.service,
      owner.scope,
      attendeeId,
    );
    const otherAsset = await owner.service.createAsset(owner.scope, {
      siteId: site.id,
      tag: "CU-01",
      name: "Condensing unit",
    });
    const recommendation = await owner.service.recordRecommendedAction(owner.scope, visit.id, {
      description: "Replace compressor on condensing unit",
      recommendedAt: OUTCOME_AT,
      recommendedByUserId: attendeeId,
      recordedByUserId: attendeeId,
      assetId: otherAsset.id,
    });
    const followUp = await owner.service.convertRecommendedActionToFollowUpWorkOrder(
      owner.scope,
      recommendation.id,
    );
    assert.equal(followUp.sourceRecommendedActionId, recommendation.id);
    assert.equal(followUp.workKind, "reactive");
    assert.equal(followUp.customerId, customer.id);
    assert.equal(followUp.siteId, site.id);
    assert.equal(followUp.primaryAssetId, otherAsset.id);
    assert.notEqual(followUp.primaryAssetId, asset.id);
    assert.equal(followUp.reportedCondition, recommendation.description);
    assert.equal(followUp.assignedUserId, null);
    assert.equal(followUp.status, "open");
    assert.equal(followUp.cancellationReason, null);
    assert.equal("dispatchedAt" in followUp, false);
    assert.equal("ppmRequirementId" in followUp, false);
    assert.equal("scheduledFor" in followUp, false);
    const unchanged = await owner.service.getRecommendedAction(
      owner.scope,
      recommendation.id,
    );
    assert.equal(unchanged?.description, recommendation.description);
    assert.equal(unchanged?.id, recommendation.id);
    await expectCode(
      () =>
        owner.service.convertRecommendedActionToFollowUpWorkOrder(
          owner.scope,
          recommendation.id,
        ),
      "duplicate",
    );
  });

  it("falls back to the source WorkOrder primary asset when the recommendation has none", async () => {
    const owner = await seed();
    const attendeeId = "user-attendee" as UserId;
    await addMember(owner.workspaceId, attendeeId);
    const { asset, visit } = await seedOpenVisit(
      owner.service,
      owner.scope,
      attendeeId,
      "WO-FALLBACK",
    );
    const recommendation = await owner.service.recordRecommendedAction(owner.scope, visit.id, {
      description: "Return to leak-test circuit",
      recommendedAt: OUTCOME_AT,
      recommendedByUserId: attendeeId,
      recordedByUserId: attendeeId,
    });
    const followUp = await owner.service.convertRecommendedActionToFollowUpWorkOrder(
      owner.scope,
      recommendation.id,
    );
    assert.equal(followUp.primaryAssetId, asset.id);
  });

  it("allows multiple ordinary WorkOrders with null recommendation provenance", async () => {
    const owner = await seed();
    const { site } = await seedHierarchy(owner.service, owner.scope, "WO-A");
    const second = await owner.service.createWorkOrder(owner.scope, {
      siteId: site.id,
      workReference: "WO-B",
      workKind: "reactive",
    });
    assert.equal(second.sourceRecommendedActionId, null);
    const listed = await owner.service.listWorkOrders(owner.scope);
    assert.equal(listed.every((row) => row.sourceRecommendedActionId === null), true);
    assert.equal(listed.length, 2);
  });
});

describe("F2.1 Work Execution — permissions and office surface", () => {
  it("requires venture.update for completion, cancellation, and conversion", async () => {
    const owner = await seed();
    const memberId = "user-member" as UserId;
    const attendeeId = "user-attendee" as UserId;
    await addMember(owner.workspaceId, memberId);
    await addMember(owner.workspaceId, attendeeId);
    const { workOrder, visit } = await seedOpenVisit(
      owner.service,
      owner.scope,
      attendeeId,
    );
    const recommendation = await owner.service.recordRecommendedAction(owner.scope, visit.id, {
      description: "Replace compressor",
      recommendedAt: OUTCOME_AT,
      recommendedByUserId: attendeeId,
      recordedByUserId: attendeeId,
    });
    const memberScope: FrigoraScope = { ...owner.scope, userId: memberId };
    await expectCode(
      () => owner.service.closeWorkOrder(memberScope, workOrder.id),
      "forbidden",
    );
    await expectCode(
      () =>
        owner.service.cancelWorkOrder(memberScope, workOrder.id, {
          reason: TEST_CANCELLATION_REASON,
        }),
      "forbidden",
    );
    await expectCode(
      () =>
        owner.service.convertRecommendedActionToFollowUpWorkOrder(
          memberScope,
          recommendation.id,
        ),
      "forbidden",
    );
  });

  it("ships office Complete/Cancel/Convert controls without Visit Recorder lifecycle actions", () => {
    assert.equal(platformVentureRegistry.resolve("frigora").version, "0.16.0");
    const dbSource = readFileSync(join(WEB_ROOT, "platform/persistence/db.ts"), "utf8");
    assert.match(dbSource, /SCHEMA_GENERATION = 23/);
    assert.match(dbSource, /cancellation_reason/);
    assert.match(dbSource, /source_recommended_action_id/);

    const lifecycleControls = readFileSync(
      join(WEB_ROOT, "modules/frigora/app/forms/work-order-lifecycle-controls.tsx"),
      "utf8",
    );
    assert.match(lifecycleControls, /Complete Work Order/);
    assert.match(lifecycleControls, /Cancel Work Order/);
    assert.match(lifecycleControls, /cancelWorkOrderFormAction/);
    assert.match(lifecycleControls, /Reopen/);

    const mutationActions = readFileSync(
      join(WEB_ROOT, "modules/frigora/app/mutation-actions.ts"),
      "utf8",
    );
    assert.match(mutationActions, /cancelWorkOrderAction/);
    assert.match(mutationActions, /convertRecommendedActionToFollowUpWorkOrderAction/);

    const workScreens = readFileSync(
      join(WEB_ROOT, "modules/frigora/app/screens/work-screens.tsx"),
      "utf8",
    );
    assert.match(workScreens, /Recommended Actions/);
    assert.match(workScreens, /ConvertRecommendedActionForm/);
    assert.match(workScreens, /Follow-up WorkOrder/);

    const convertForm = readFileSync(
      join(WEB_ROOT, "modules/frigora/app/forms/convert-recommended-action-form.tsx"),
      "utf8",
    );
    assert.match(convertForm, /Convert to Follow-up WorkOrder/);

    const recorderScreen = readFileSync(
      join(WEB_ROOT, "modules/frigora/app/screens/visit-recorder-screen.tsx"),
      "utf8",
    );
    assert.equal(recorderScreen.includes("closeWorkOrder"), false);
    assert.equal(recorderScreen.includes("cancelWorkOrder"), false);
    assert.equal(recorderScreen.includes("Complete Work Order"), false);
    assert.equal(recorderScreen.includes("Cancel Work Order"), false);
  });
});
