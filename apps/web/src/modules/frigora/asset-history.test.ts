import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { beforeEach, describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { platformVentureRegistry } from "@/core/venture-definition/catalog";
import type { Role, UserId, VentureId, WorkspaceId } from "@/contracts";
import { createPermissionService } from "@/platform/permissions/service";
import { createDbMembershipStore } from "@/platform/permissions/membership-store";
import { ensureSchema } from "@/platform/persistence/db";
import { getPersistence, resetPersistenceLifecycle } from "@/platform/persistence/repositories";
import type { PersistedVenture } from "@/platform/persistence/repositories/ports";
import { FrigoraError } from "./errors";
import { listAssetHistoryQuery } from "./queries";
import { createFrigoraService } from "./service";
import type { FrigoraAssetHistoryEntry, FrigoraAssetId, FrigoraScope } from "./types";
import { FRIGORA_ASSET_HISTORY_EVENT_KINDS } from "./types";

const NOW = "2026-08-28T00:00:00.000Z";
const ARRIVED = "2026-08-28T10:00:00.000Z";
const DEPARTED = "2026-08-28T11:00:00.000Z";
const SAME_TIME = "2026-08-28T10:30:00.000Z";

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
      definitionVersion: options.definitionVersion ?? "0.13.0",
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
    definitionVersion: "0.13.0",
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
  options: { reportedCondition?: string | null; primaryAssetId?: string | null } = {},
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
    primaryAssetId:
      options.primaryAssetId === undefined ? asset.id : (options.primaryAssetId as string | null),
    reportedCondition:
      options.reportedCondition === undefined ? "display freezer warm" : options.reportedCondition,
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

function kindIndex(kind: FrigoraAssetHistoryEntry["kind"]): number {
  return FRIGORA_ASSET_HISTORY_EVENT_KINDS.indexOf(kind);
}

describe("Frigora asset history projection (F0.13)", () => {
  it("returns empty history for unknown asset", async () => {
    const owner = await seed();
    const history = await owner.service.listAssetHistory(
      owner.scope,
      "asset-missing" as FrigoraAssetId,
    );
    assert.deepEqual(history, []);
  });

  it("returns empty history for cross-workspace asset id", async () => {
    const owner = await seed();
    const { asset } = await seedHierarchy(owner.service, owner.scope);
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
    const crossScope = { ...owner.scope, workspaceId: otherWorkspace };
    assert.deepEqual(await owner.service.listAssetHistory(crossScope, asset.id), []);
  });

  it("returns empty history for cross-venture asset id", async () => {
    const owner = await seed();
    const { asset } = await seedHierarchy(owner.service, owner.scope);
    const otherVenture = "ven-other" as VentureId;
    await getPersistence().ventures.insert(
      ventureRow({
        id: otherVenture,
        workspaceId: owner.workspaceId,
        slug: "other-frigora",
      }),
    );
    const otherScope = { ...owner.scope, ventureId: otherVenture };
    assert.deepEqual(await owner.service.listAssetHistory(otherScope, asset.id), []);
  });

  it("returns empty history for non-Frigora venture", async () => {
    const owner = await seed();
    const { asset } = await seedHierarchy(owner.service, owner.scope);
    const { scope, service } = await seed({
      reset: false,
      ventureId: "ven-company" as VentureId,
      definitionId: "ventureos.company",
    });
    assert.deepEqual(await service.listAssetHistory(scope, asset.id), []);
  });

  it("rejects unauthorized read without workspace membership", async () => {
    const owner = await seed();
    const { asset } = await seedHierarchy(owner.service, owner.scope);
    await expectCode(
      () =>
        owner.service.listAssetHistory(
          { ...owner.scope, userId: "user-outsider" as UserId },
          asset.id,
        ),
      "forbidden",
    );
  });

  it("allows authorized venture.read member to list asset history", async () => {
    const owner = await seed();
    const memberId = "user-member" as UserId;
    await addMember(owner.workspaceId, memberId);
    const { asset } = await seedHierarchy(owner.service, owner.scope);
    const history = await owner.service.listAssetHistory(
      { ...owner.scope, userId: memberId },
      asset.id,
    );
    assert.ok(Array.isArray(history));
    assert.equal(history.some((entry) => entry.kind === "reported_intake"), true);
  });

  it("projects reported intake from WorkOrder with reported condition", async () => {
    const owner = await seed();
    const { asset, workOrder } = await seedHierarchy(owner.service, owner.scope);
    const history = await owner.service.listAssetHistory(owner.scope, asset.id);
    const intake = history.find((entry) => entry.kind === "reported_intake");
    assert.ok(intake);
    assert.equal(intake.sourceId, workOrder.id);
    assert.equal(intake.workOrderId, workOrder.id);
    assert.equal(intake.visitId, null);
    assert.equal(intake.occurredAt, workOrder.createdAt);
    assert.equal(intake.recordedAt, workOrder.createdAt);
    if (intake.kind === "reported_intake") {
      assert.equal(intake.detail.reportedCondition, "display freezer warm");
      assert.equal(intake.detail.workReference, "WO-1864");
    }
  });

  it("excludes WorkOrder intake when reportedCondition is null", async () => {
    const owner = await seed();
    const { asset } = await seedHierarchy(owner.service, owner.scope, {
      reportedCondition: null,
    });
    const history = await owner.service.listAssetHistory(owner.scope, asset.id);
    assert.equal(history.some((entry) => entry.kind === "reported_intake"), false);
  });

  it("excludes WorkOrder without primaryAssetId from asset history", async () => {
    const owner = await seed();
    const attendeeId = "user-attendee" as UserId;
    await addMember(owner.workspaceId, attendeeId);
    const { asset, site } = await seedHierarchy(owner.service, owner.scope, {
      primaryAssetId: null,
    });
    const workOrderNoAsset = await owner.service.createWorkOrder(owner.scope, {
      siteId: site.id,
      workReference: "WO-NO-ASSET",
      workKind: "reactive",
      primaryAssetId: null,
      reportedCondition: "another symptom",
    });
    await owner.service.recordVisitArrival(owner.scope, workOrderNoAsset.id, {
      userId: attendeeId,
      arrivedAt: ARRIVED,
    });
    const history = await owner.service.listAssetHistory(owner.scope, asset.id);
    assert.equal(history.some((entry) => entry.workOrderId === workOrderNoAsset.id), false);
  });

  it("projects visit arrival with attendance provenance", async () => {
    const owner = await seed();
    const attendeeId = "user-attendee" as UserId;
    await addMember(owner.workspaceId, attendeeId);
    const { asset, visit } = await seedOpenVisit(owner.service, owner.scope, attendeeId);
    const history = await owner.service.listAssetHistory(owner.scope, asset.id);
    const arrival = history.find((entry) => entry.kind === "visit_arrival");
    assert.ok(arrival);
    assert.equal(arrival.sourceId, visit.id);
    assert.equal(arrival.visitId, visit.id);
    assert.equal(arrival.occurredAt, ARRIVED);
    assert.equal(arrival.recordedAt, visit.createdAt);
    assert.equal(arrival.actorUserId, attendeeId);
    if (arrival.kind === "visit_arrival") {
      assert.equal(arrival.detail.attendingUserId, attendeeId);
      assert.equal(arrival.detail.status, "open");
    }
  });

  it("projects visit departure when departedAt exists", async () => {
    const owner = await seed();
    const attendeeId = "user-attendee" as UserId;
    await addMember(owner.workspaceId, attendeeId);
    const { asset, visit } = await seedOpenVisit(owner.service, owner.scope, attendeeId);
    const departed = await owner.service.recordVisitDeparture(owner.scope, visit.id, {
      departedAt: DEPARTED,
    });
    const history = await owner.service.listAssetHistory(owner.scope, asset.id);
    const departure = history.find((entry) => entry.kind === "visit_departure");
    assert.ok(departure);
    assert.equal(departure.sourceId, visit.id);
    assert.equal(departure.occurredAt, DEPARTED);
    assert.equal(departure.recordedAt, departed.updatedAt);
    if (departure.kind === "visit_departure") {
      assert.equal(departure.detail.status, "departed");
    }
  });

  it("omits visit departure for open visit without departedAt", async () => {
    const owner = await seed();
    const attendeeId = "user-attendee" as UserId;
    await addMember(owner.workspaceId, attendeeId);
    const { asset } = await seedOpenVisit(owner.service, owner.scope, attendeeId);
    const history = await owner.service.listAssetHistory(owner.scope, asset.id);
    assert.equal(history.some((entry) => entry.kind === "visit_departure"), false);
  });

  it("includes cancelled visit arrival and omits departure without fabricated departedAt", async () => {
    const owner = await seed();
    const attendeeId = "user-attendee" as UserId;
    await addMember(owner.workspaceId, attendeeId);
    const { asset, visit } = await seedOpenVisit(owner.service, owner.scope, attendeeId);
    await owner.service.cancelVisit(owner.scope, visit.id);
    const history = await owner.service.listAssetHistory(owner.scope, asset.id);
    const arrival = history.find((entry) => entry.kind === "visit_arrival");
    assert.ok(arrival);
    if (arrival?.kind === "visit_arrival") {
      assert.equal(arrival.detail.status, "cancelled");
    }
    assert.equal(history.some((entry) => entry.kind === "visit_departure"), false);
  });

  it("projects observed field capture for asset-scoped records", async () => {
    const owner = await seed();
    const attendeeId = "user-attendee" as UserId;
    await addMember(owner.workspaceId, attendeeId);
    const { asset, visit } = await seedOpenVisit(owner.service, owner.scope, attendeeId);
    const capture = await owner.service.recordFieldCapture(owner.scope, visit.id, {
      captureKind: "measurement",
      captureCode: "temperature",
      valueNumeric: -18,
      valueUnit: "celsius",
      observedAt: SAME_TIME,
      userId: attendeeId,
      assetId: asset.id,
    });
    const history = await owner.service.listAssetHistory(owner.scope, asset.id);
    const observed = history.find((entry) => entry.kind === "observed");
    assert.ok(observed);
    assert.equal(observed.sourceId, capture.id);
    assert.equal(observed.occurredAt, SAME_TIME);
    if (observed?.kind === "observed") {
      assert.equal(observed.detail.captureCode, "temperature");
      assert.equal(observed.detail.valueNumeric, -18);
    }
  });

  it("projects technical finding", async () => {
    const owner = await seed();
    const attendeeId = "user-attendee" as UserId;
    await addMember(owner.workspaceId, attendeeId);
    const { asset, visit } = await seedOpenVisit(owner.service, owner.scope, attendeeId);
    const finding = await owner.service.recordTechnicalFinding(owner.scope, visit.id, {
      findingKind: "confirmed_fault",
      description: "Compressor winding open circuit",
      assertedAt: SAME_TIME,
      userId: attendeeId,
      assetId: asset.id,
    });
    const history = await owner.service.listAssetHistory(owner.scope, asset.id);
    const entry = history.find((e) => e.kind === "finding");
    assert.ok(entry);
    assert.equal(entry.sourceId, finding.id);
    if (entry?.kind === "finding") {
      assert.equal(entry.detail.findingKind, "confirmed_fault");
    }
  });

  it("projects corrective action", async () => {
    const owner = await seed();
    const attendeeId = "user-attendee" as UserId;
    await addMember(owner.workspaceId, attendeeId);
    const { asset, visit } = await seedOpenVisit(owner.service, owner.scope, attendeeId);
    const action = await owner.service.recordCorrectiveAction(owner.scope, visit.id, {
      description: "Replaced valve core",
      performedAt: SAME_TIME,
      performedByUserId: attendeeId,
      recordedByUserId: attendeeId,
      assetId: asset.id,
    });
    const history = await owner.service.listAssetHistory(owner.scope, asset.id);
    const entry = history.find((e) => e.kind === "corrective_action");
    assert.ok(entry);
    assert.equal(entry.sourceId, action.id);
    if (entry?.kind === "corrective_action") {
      assert.equal(entry.detail.description, "Replaced valve core");
    }
  });

  it("projects part usage", async () => {
    const owner = await seed();
    const attendeeId = "user-attendee" as UserId;
    await addMember(owner.workspaceId, attendeeId);
    const { asset, visit } = await seedOpenVisit(owner.service, owner.scope, attendeeId);
    const usage = await owner.service.recordPartUsage(owner.scope, visit.id, {
      partDescription: "Valve core",
      quantity: 1,
      quantityUnit: "each",
      usedAt: SAME_TIME,
      usedByUserId: attendeeId,
      recordedByUserId: attendeeId,
      assetId: asset.id,
    });
    const history = await owner.service.listAssetHistory(owner.scope, asset.id);
    const entry = history.find((e) => e.kind === "part_usage");
    assert.ok(entry);
    assert.equal(entry.sourceId, usage.id);
    if (entry?.kind === "part_usage") {
      assert.equal(entry.detail.partDescription, "Valve core");
    }
  });

  it("projects refrigerant event without leak inference", async () => {
    const owner = await seed();
    const attendeeId = "user-attendee" as UserId;
    await addMember(owner.workspaceId, attendeeId);
    const { asset, visit } = await seedOpenVisit(owner.service, owner.scope, attendeeId);
    const event = await owner.service.recordRefrigerantEvent(owner.scope, visit.id, {
      refrigerantType: "R404A",
      eventKind: "added",
      quantityKg: 2,
      occurredAt: SAME_TIME,
      handledByUserId: attendeeId,
      recordedByUserId: attendeeId,
      assetId: asset.id,
    });
    const history = await owner.service.listAssetHistory(owner.scope, asset.id);
    const entry = history.find((e) => e.kind === "refrigerant");
    assert.ok(entry);
    assert.equal(entry.sourceId, event.id);
    if (entry?.kind === "refrigerant") {
      assert.equal(entry.detail.eventKind, "added");
      assert.equal(entry.detail.quantityKg, 2);
      assert.equal("leak" in entry.detail, false);
      assert.equal("leakedKg" in entry.detail, false);
    }
  });

  it("projects visit outcome", async () => {
    const owner = await seed();
    const attendeeId = "user-attendee" as UserId;
    await addMember(owner.workspaceId, attendeeId);
    const { asset, visit } = await seedOpenVisit(owner.service, owner.scope, attendeeId);
    const outcome = await owner.service.recordVisitOutcome(owner.scope, visit.id, {
      description: "Cooling restored",
      outcomeAt: SAME_TIME,
      recordedByUserId: attendeeId,
      assetId: asset.id,
    });
    const history = await owner.service.listAssetHistory(owner.scope, asset.id);
    const entry = history.find((e) => e.kind === "outcome");
    assert.ok(entry);
    assert.equal(entry.sourceId, outcome.id);
    assert.equal(entry.actorUserId, null);
    if (entry?.kind === "outcome") {
      assert.equal(entry.detail.description, "Cooling restored");
    }
  });

  it("projects recommended action", async () => {
    const owner = await seed();
    const attendeeId = "user-attendee" as UserId;
    await addMember(owner.workspaceId, attendeeId);
    const { asset, visit } = await seedOpenVisit(owner.service, owner.scope, attendeeId);
    const recommendation = await owner.service.recordRecommendedAction(owner.scope, visit.id, {
      description: "Schedule follow-up inspection",
      recommendedAt: SAME_TIME,
      recommendedByUserId: attendeeId,
      recordedByUserId: attendeeId,
      assetId: asset.id,
    });
    const history = await owner.service.listAssetHistory(owner.scope, asset.id);
    const entry = history.find((e) => e.kind === "recommendation");
    assert.ok(entry);
    assert.equal(entry.sourceId, recommendation.id);
    if (entry?.kind === "recommendation") {
      assert.equal(entry.detail.description, "Schedule follow-up inspection");
    }
  });

  it("excludes visit-scoped records with null assetId", async () => {
    const owner = await seed();
    const attendeeId = "user-attendee" as UserId;
    await addMember(owner.workspaceId, attendeeId);
    const { asset, visit } = await seedOpenVisit(owner.service, owner.scope, attendeeId);
    await owner.service.recordFieldCapture(owner.scope, visit.id, {
      captureKind: "measurement",
      captureCode: "temperature",
      valueNumeric: -10,
      valueUnit: "celsius",
      observedAt: SAME_TIME,
      userId: attendeeId,
      assetId: null,
    });
    const history = await owner.service.listAssetHistory(owner.scope, asset.id);
    assert.equal(history.some((entry) => entry.kind === "observed"), false);
  });

  it("sorts chronologically by occurredAt ascending", async () => {
    const owner = await seed();
    const attendeeId = "user-attendee" as UserId;
    await addMember(owner.workspaceId, attendeeId);
    const { asset, visit } = await seedOpenVisit(owner.service, owner.scope, attendeeId);
    await owner.service.recordVisitDeparture(owner.scope, visit.id, { departedAt: DEPARTED });
    await owner.service.recordFieldCapture(owner.scope, visit.id, {
      captureKind: "measurement",
      captureCode: "temperature",
      valueNumeric: -18,
      valueUnit: "celsius",
      observedAt: SAME_TIME,
      userId: attendeeId,
      assetId: asset.id,
    });
    const history = await owner.service.listAssetHistory(owner.scope, asset.id);
    const occurredTimes = history.map((entry) => entry.occurredAt);
    const sorted = [...occurredTimes].sort();
    assert.deepEqual(occurredTimes, sorted);
    for (let index = 1; index < history.length; index += 1) {
      const previous = history[index - 1]!;
      const current = history[index]!;
      assert.ok(previous.occurredAt <= current.occurredAt);
      if (previous.occurredAt === current.occurredAt) {
        assert.ok(kindIndex(previous.kind) <= kindIndex(current.kind));
      }
    }
  });

  it("breaks equal occurredAt ties by kind order then sourceId", async () => {
    const owner = await seed();
    const attendeeId = "user-attendee" as UserId;
    await addMember(owner.workspaceId, attendeeId);
    const { asset, visit } = await seedOpenVisit(owner.service, owner.scope, attendeeId);
    const finding = await owner.service.recordTechnicalFinding(owner.scope, visit.id, {
      findingKind: "symptom",
      description: "Warm cabinet",
      assertedAt: SAME_TIME,
      userId: attendeeId,
      assetId: asset.id,
    });
    const action = await owner.service.recordCorrectiveAction(owner.scope, visit.id, {
      description: "Cleaned condenser",
      performedAt: SAME_TIME,
      performedByUserId: attendeeId,
      recordedByUserId: attendeeId,
      assetId: asset.id,
    });
    const history = await owner.service.listAssetHistory(owner.scope, asset.id);
    const sameTime = history.filter((entry) => entry.occurredAt === SAME_TIME);
    assert.ok(sameTime.length >= 2);
    for (let index = 1; index < sameTime.length; index += 1) {
      const previous = sameTime[index - 1]!;
      const current = sameTime[index]!;
      const kindDiff = kindIndex(previous.kind) - kindIndex(current.kind);
      assert.ok(kindDiff <= 0);
      if (kindDiff === 0) {
        assert.ok(previous.sourceId <= current.sourceId);
      }
    }
    const findingEntry = history.find((entry) => entry.sourceId === finding.id);
    const actionEntry = history.find((entry) => entry.sourceId === action.id);
    assert.ok(findingEntry && actionEntry);
    assert.ok(kindIndex(findingEntry.kind) < kindIndex(actionEntry.kind));
  });

  it("sorts by occurredAt not recordedAt for delayed recording", async () => {
    const owner = await seed();
    const attendeeId = "user-attendee" as UserId;
    await addMember(owner.workspaceId, attendeeId);
    const { asset, visit } = await seedOpenVisit(owner.service, owner.scope, attendeeId);
    const observedDuringVisit = "2026-08-28T10:15:00.000Z";
    await owner.service.recordFieldCapture(owner.scope, visit.id, {
      captureKind: "measurement",
      captureCode: "temperature",
      valueNumeric: -16,
      valueUnit: "celsius",
      observedAt: observedDuringVisit,
      userId: attendeeId,
      assetId: asset.id,
    });
    const history = await owner.service.listAssetHistory(owner.scope, asset.id);
    const observed = history.find((entry) => entry.kind === "observed");
    const arrival = history.find((entry) => entry.kind === "visit_arrival");
    assert.ok(observed && arrival);
    assert.equal(observed.occurredAt, observedDuringVisit);
    assert.notEqual(observed.recordedAt, observed.occurredAt);
    const observedIndex = history.findIndex((entry) => entry.kind === "observed");
    const arrivalIndex = history.findIndex((entry) => entry.kind === "visit_arrival");
    assert.ok(observedIndex > arrivalIndex);
  });

  it("preserves provenance fields independently from detail payloads", async () => {
    const owner = await seed();
    const attendeeId = "user-attendee" as UserId;
    const recorderId = "user-recorder" as UserId;
    await addMember(owner.workspaceId, attendeeId);
    await addMember(owner.workspaceId, recorderId);
    const { asset, visit } = await seedOpenVisit(owner.service, owner.scope, attendeeId);
    const finding = await owner.service.recordTechnicalFinding(owner.scope, visit.id, {
      findingKind: "confirmed_fault",
      description: "Failed start capacitor",
      assertedAt: SAME_TIME,
      userId: recorderId,
      assetId: asset.id,
    });
    const history = await owner.service.listAssetHistory(owner.scope, asset.id);
    const entry = history.find((e) => e.sourceId === finding.id);
    assert.ok(entry);
    assert.equal(entry.actorUserId, recorderId);
    assert.equal(entry.recordedByUserId, recorderId);
    assert.equal(entry.visitId, visit.id);
    assert.equal(entry.assetId, asset.id);
  });

  it("keeps truth layers separate in detail contracts", async () => {
    const owner = await seed();
    const attendeeId = "user-attendee" as UserId;
    await addMember(owner.workspaceId, attendeeId);
    const { asset, visit, workOrder } = await seedOpenVisit(owner.service, owner.scope, attendeeId);
    await owner.service.recordFieldCapture(owner.scope, visit.id, {
      captureKind: "measurement",
      captureCode: "temperature",
      valueNumeric: -5,
      valueUnit: "celsius",
      observedAt: SAME_TIME,
      userId: attendeeId,
      assetId: asset.id,
    });
    await owner.service.recordTechnicalFinding(owner.scope, visit.id, {
      findingKind: "confirmed_fault",
      description: "Low charge suspected",
      assertedAt: SAME_TIME,
      userId: attendeeId,
      assetId: asset.id,
    });
    await owner.service.recordRecommendedAction(owner.scope, visit.id, {
      description: "Recover and recharge system",
      recommendedAt: SAME_TIME,
      recommendedByUserId: attendeeId,
      recordedByUserId: attendeeId,
      assetId: asset.id,
    });
    const history = await owner.service.listAssetHistory(owner.scope, asset.id);
    const intake = history.find((e) => e.kind === "reported_intake");
    const observed = history.find((e) => e.kind === "observed");
    const finding = history.find((e) => e.kind === "finding");
    const recommendation = history.find((e) => e.kind === "recommendation");
    assert.ok(intake && observed && finding && recommendation);
    if (intake.kind === "reported_intake") {
      assert.equal(intake.detail.reportedCondition, workOrder.reportedCondition);
    }
    if (observed.kind === "observed") {
      assert.equal(observed.detail.valueNumeric, -5);
    }
    if (finding.kind === "finding") {
      assert.notEqual(finding.detail.description, recommendation.detail.description);
    }
    if (recommendation.kind === "recommendation") {
      assert.notEqual(recommendation.detail.description, workOrder.reportedCondition);
    }
  });

  it("read projection causes no source mutation", async () => {
    const owner = await seed();
    const attendeeId = "user-attendee" as UserId;
    await addMember(owner.workspaceId, attendeeId);
    const { asset, workOrder, visit } = await seedOpenVisit(owner.service, owner.scope, attendeeId);
    const beforeWo = await owner.service.getWorkOrder(owner.scope, workOrder.id);
    const beforeVisit = await owner.service.getVisit(owner.scope, visit.id);
    await owner.service.listAssetHistory(owner.scope, asset.id);
    const afterWo = await owner.service.getWorkOrder(owner.scope, workOrder.id);
    const afterVisit = await owner.service.getVisit(owner.scope, visit.id);
    assert.deepEqual(afterWo, beforeWo);
    assert.deepEqual(afterVisit, beforeVisit);
  });

  it("does not write platform recommendations, brain, knowledge, or workforce records", async () => {
    const owner = await seed();
    const attendeeId = "user-attendee" as UserId;
    await addMember(owner.workspaceId, attendeeId);
    const { asset } = await seedOpenVisit(owner.service, owner.scope, attendeeId);
    const persistence = getPersistence();
    const recommendationsBefore = (await persistence.recommendations.listForWorkspace(owner.workspaceId))
      .length;
    await owner.service.listAssetHistory(owner.scope, asset.id);
    const recommendationsAfter = (await persistence.recommendations.listForWorkspace(owner.workspaceId))
      .length;
    assert.equal(recommendationsAfter, recommendationsBefore);
    assert.equal("recordAssetHistory" in owner.service, false);
    assert.equal("createAssetHistory" in owner.service, false);
    assert.equal("updateAssetHistory" in owner.service, false);
    assert.equal("deleteAssetHistory" in owner.service, false);
    assert.equal("listServiceHistory" in owner.service, false);
  });

  it("exposes read-only listAssetHistory without history mutations", async () => {
    const owner = await seed();
    assert.equal("listAssetHistory" in owner.service, true);
    assert.equal(typeof owner.service.listAssetHistory, "function");
    assert.equal("recordAssetHistory" in owner.service, false);
  });

  it("exports listAssetHistoryQuery helper aligned with service read model", () => {
    assert.equal(typeof listAssetHistoryQuery, "function");
  });

  it("keeps SCHEMA_GENERATION at 18 with no asset history table", async () => {
    const dbPath = fileURLToPath(new URL("../../platform/persistence/db.ts", import.meta.url));
    const schemaPath = fileURLToPath(new URL("../../platform/persistence/schema.ts", import.meta.url));
    const dbSource = readFileSync(dbPath, "utf8");
    const schemaSource = readFileSync(schemaPath, "utf8");
    assert.match(dbSource, /SCHEMA_GENERATION = 18/);
    assert.equal(schemaSource.includes("frigora_asset_history"), false);
  });

  it("admits frigora@0.13.0 with asset history projection in catalog", () => {
    const frigora = platformVentureRegistry.resolve("frigora");
    assert.equal(frigora.version, "0.13.0");
    assert.match(frigora.description, /Asset history projection/);
    assert.deepEqual([...FRIGORA_ASSET_HISTORY_EVENT_KINDS], [
      "reported_intake",
      "visit_arrival",
      "visit_departure",
      "observed",
      "finding",
      "corrective_action",
      "part_usage",
      "refrigerant",
      "outcome",
      "recommendation",
    ]);
  });

  it("supports persisted Frigora 0.12.0 instance compatibility", async () => {
    const owner = await seed({ definitionVersion: "0.12.0" });
    const attendeeId = "user-attendee" as UserId;
    await addMember(owner.workspaceId, attendeeId);
    const { asset, visit } = await seedOpenVisit(owner.service, owner.scope, attendeeId);
    await owner.service.recordPartUsage(owner.scope, visit.id, {
      partDescription: "Dryer filter",
      quantity: 1,
      quantityUnit: "each",
      usedAt: SAME_TIME,
      usedByUserId: attendeeId,
      recordedByUserId: attendeeId,
      assetId: asset.id,
    });
    const history = await owner.service.listAssetHistory(owner.scope, asset.id);
    assert.ok(history.some((entry) => entry.kind === "part_usage"));
    assert.ok(history.some((entry) => entry.kind === "reported_intake"));
  });
});
