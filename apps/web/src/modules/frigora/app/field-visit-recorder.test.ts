import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Role, UserId, VentureId, WorkspaceId } from "@/contracts";
import { createPermissionService } from "@/platform/permissions/service";
import { createDbMembershipStore } from "@/platform/permissions/membership-store";
import { ensureSchema } from "@/platform/persistence/db";
import { getPersistence, resetPersistenceLifecycle } from "@/platform/persistence/repositories";
import type { PersistedVenture } from "@/platform/persistence/repositories/ports";
import { buildVentureSurfaceLinks } from "@/modules/frigora/app/nav";
import { createFrigoraService } from "@/modules/frigora/service";
import type { FrigoraScope } from "@/modules/frigora/types";
import { FRIGORA_REFRIGERANT_EVENT_KINDS } from "@/modules/frigora/types";
import { FrigoraError } from "@/modules/frigora/errors";
import { platformVentureRegistry } from "@/core/venture-definition/catalog";

const NOW = "2026-08-29T00:00:00.000Z";
const ARRIVED = "2026-08-29T10:00:00.000Z";
const WEB_ROOT = join(process.cwd(), "src");

beforeEach(async () => {
  await resetPersistenceLifecycle();
  await ensureSchema();
});

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
    definitionVersion: "0.15.0",
    lifecycle: "operating",
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

async function seed(options: {
  workspaceId?: WorkspaceId;
  ventureId?: VentureId;
  userId?: UserId;
  role?: Role;
} = {}) {
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
      definitionVersion: "0.15.0",
    }),
  );

  await store.users.insert({
    id: userId,
    email: `${userId}@example.test`,
    name: `Name ${userId}`,
    passwordHash: "hash",
    createdAt: NOW,
  });

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

async function seedWorkHierarchy(owner: Awaited<ReturnType<typeof seed>>) {
  const customer = await owner.service.createCustomer(owner.scope, {
    code: "FUELCO",
    displayName: "FuelCo",
  });
  const site = await owner.service.createSite(owner.scope, {
    customerId: customer.id,
    code: "SANDTON-N",
    name: "Sandton North",
  });
  const asset = await owner.service.createAsset(owner.scope, {
    siteId: site.id,
    tag: "CDU-01",
    name: "Condensing unit 1",
    assetKind: "condensing_unit",
  });
  const workOrder = await owner.service.createWorkOrder(owner.scope, {
    siteId: site.id,
    workReference: "WO-F12-1",
    workKind: "reactive",
    reportedCondition: "Walk-in warm",
    primaryAssetId: asset.id,
  });
  const assigned = await owner.service.assignWorkOrder(owner.scope, workOrder.id, {
    userId: owner.userId,
  });
  return { customer, site, asset, workOrder: assigned };
}

describe("F1.2 Field Visit Recorder", () => {
  it("adds My Work to Frigora venture nav", () => {
    const links = buildVentureSurfaceLinks({
      ventureId: "ven-1",
      slug: "frigora-one",
      definitionId: "frigora",
      companyHomeHref: "/ventures/hq/frigora-one",
    });
    assert.equal(links.some((link) => link.label === "My Work"), true);
    assert.match(
      links.find((link) => link.label === "My Work")?.href ?? "",
      /\/work\/assigned$/,
    );
  });

  it("lists only open assigned work on My Work", async () => {
    const owner = await seed();
    const { workOrder } = await seedWorkHierarchy(owner);
    const closed = await owner.service.createWorkOrder(owner.scope, {
      siteId: workOrder.siteId,
      workReference: "WO-CLOSED",
      workKind: "reactive",
    });
    await owner.service.assignWorkOrder(owner.scope, closed.id, {
      userId: owner.userId,
    });
    await owner.service.closeWorkOrder(owner.scope, closed.id);

    const assigned = await owner.service.listWorkOrdersByAssignee(
      owner.scope,
      owner.userId,
    );
    const openOnly = assigned.filter((row) => row.status === "open");
    assert.equal(openOnly.length, 1);
    assert.equal(openOnly[0]?.id, workOrder.id);
  });

  it("records visit arrival with attending user and persists facts", async () => {
    const owner = await seed();
    const { workOrder, asset } = await seedWorkHierarchy(owner);

    const visit = await owner.service.recordVisitArrival(owner.scope, workOrder.id, {
      userId: owner.userId,
      arrivedAt: ARRIVED,
    });
    assert.equal(visit.attendingUserId, owner.userId);
    assert.equal(visit.status, "open");

    await owner.service.recordFieldCapture(owner.scope, visit.id, {
      captureKind: "measurement",
      captureCode: "temperature",
      valueNumeric: -18,
      valueUnit: "celsius",
      observedAt: ARRIVED,
      userId: owner.userId,
      assetId: asset.id,
    });

    await owner.service.recordTechnicalFinding(owner.scope, visit.id, {
      findingKind: "symptom",
      description: "High suction temperature",
      assertedAt: ARRIVED,
      userId: owner.userId,
      assetId: asset.id,
    });

    await owner.service.recordCorrectiveAction(owner.scope, visit.id, {
      description: "Cleaned condenser",
      performedAt: ARRIVED,
      performedByUserId: owner.userId,
      recordedByUserId: owner.userId,
      assetId: asset.id,
    });

    await owner.service.recordPartUsage(owner.scope, visit.id, {
      partDescription: "Filter drier",
      quantity: 1,
      quantityUnit: "each",
      usedAt: ARRIVED,
      usedByUserId: owner.userId,
      recordedByUserId: owner.userId,
      assetId: asset.id,
    });

    await owner.service.recordRefrigerantEvent(owner.scope, visit.id, {
      refrigerantType: "R404A",
      eventKind: "added",
      quantityKg: 0.5,
      occurredAt: ARRIVED,
      handledByUserId: owner.userId,
      recordedByUserId: owner.userId,
      assetId: asset.id,
    });

    const outcome = await owner.service.recordVisitOutcome(owner.scope, visit.id, {
      description: "Walk-in holding temperature",
      outcomeAt: ARRIVED,
      recordedByUserId: owner.userId,
      assetId: asset.id,
    });

    await owner.service.recordAssetOperationalCondition(owner.scope, {
      assetId: asset.id,
      conditionKind: "operational",
      visitId: visit.id,
      workOrderId: workOrder.id,
      assertedAt: ARRIVED,
      assertedByUserId: owner.userId,
      recordedByUserId: owner.userId,
    });

    await owner.service.recordRecommendedAction(owner.scope, visit.id, {
      description: "Schedule filter change",
      recommendedAt: ARRIVED,
      recommendedByUserId: owner.userId,
      recordedByUserId: owner.userId,
      assetId: asset.id,
    });

    await owner.service.recordVisitCustomerAcknowledgement(owner.scope, visit.id, {
      acknowledgementText: "Site manager noted work completed",
      acknowledgerName: "Jane Site",
      acknowledgedAt: ARRIVED,
      recordedByUserId: owner.userId,
    });

    await assert.rejects(
      () =>
        owner.service.recordVisitOutcome(owner.scope, visit.id, {
          description: "Duplicate",
          outcomeAt: ARRIVED,
          recordedByUserId: owner.userId,
        }),
      (error: unknown) => {
        assert.ok(error instanceof FrigoraError);
        assert.equal(error.code, "duplicate");
        return true;
      },
    );

    const departed = await owner.service.recordVisitDeparture(owner.scope, visit.id, {
      departedAt: "2026-08-29T12:00:00.000Z",
    });
    assert.equal(departed.status, "departed");

    const stillOpen = await owner.service.getWorkOrder(owner.scope, workOrder.id);
    assert.equal(stillOpen?.status, "open");

    await ensureSchema();

    const captures = await owner.service.listFieldCapturesByVisit(owner.scope, visit.id);
    const findings = await owner.service.listTechnicalFindingsByVisit(owner.scope, visit.id);
    const loadedOutcome = await owner.service.getVisitOutcomeByVisit(owner.scope, visit.id);

    assert.equal(captures.length, 1);
    assert.equal(findings.length, 1);
    assert.equal(loadedOutcome?.id, outcome.id);
  });

  it("rejects member writes and allows reads", async () => {
    const owner = await seed();
    const { workOrder } = await seedWorkHierarchy(owner);

    const memberId = "user-member" as UserId;
    await getPersistence().memberships.setRole({
      userId: memberId,
      workspaceId: owner.workspaceId,
      role: "member",
      createdAt: NOW,
    });
    await getPersistence().users.insert({
      id: memberId,
      email: "member@example.test",
      name: "Member",
      passwordHash: "hash",
      createdAt: NOW,
    });

    const memberScope: FrigoraScope = {
      userId: memberId,
      workspaceId: owner.workspaceId,
      ventureId: owner.ventureId,
    };

    const listed = await owner.service.listWorkOrdersByAssignee(memberScope, memberId);
    assert.equal(Array.isArray(listed), true);

    await assert.rejects(
      () =>
        owner.service.recordVisitArrival(memberScope, workOrder.id, {
          userId: memberId,
          arrivedAt: ARRIVED,
        }),
      (error: unknown) => {
        assert.ok(error instanceof FrigoraError);
        assert.equal(error.code, "forbidden");
        return true;
      },
    );
  });

  it("handles multiple visits and continues latest open visit", async () => {
    const owner = await seed();
    const { workOrder } = await seedWorkHierarchy(owner);

    const visitA = await owner.service.recordVisitArrival(owner.scope, workOrder.id, {
      userId: owner.userId,
      arrivedAt: "2026-08-28T10:00:00.000Z",
    });
    await owner.service.recordVisitDeparture(owner.scope, visitA.id, {
      departedAt: "2026-08-28T12:00:00.000Z",
    });

    const visitB = await owner.service.recordVisitArrival(owner.scope, workOrder.id, {
      userId: owner.userId,
      arrivedAt: "2026-08-29T08:00:00.000Z",
    });
    const visitC = await owner.service.recordVisitArrival(owner.scope, workOrder.id, {
      userId: owner.userId,
      arrivedAt: "2026-08-29T09:00:00.000Z",
    });

    const visits = await owner.service.listVisitsByWorkOrder(owner.scope, workOrder.id);
    const openVisits = visits.filter((visit) => visit.status === "open");
    const latestOpen = openVisits[openVisits.length - 1];
    assert.equal(latestOpen?.id, visitC.id);
    assert.deepEqual(
      openVisits.map((visit) => visit.id),
      [visitB.id, visitC.id],
    );
  });

  it("isolates cross-venture visit access", async () => {
    const owner = await seed();
    const { workOrder } = await seedWorkHierarchy(owner);
    const visit = await owner.service.recordVisitArrival(owner.scope, workOrder.id, {
      userId: owner.userId,
      arrivedAt: ARRIVED,
    });

    const other = await seed({
      workspaceId: "ws-other" as WorkspaceId,
      ventureId: "ven-other" as VentureId,
      userId: "user-other" as UserId,
    });

    const missing = await other.service.getVisit(other.scope, visit.id);
    assert.equal(missing, null);
  });

  it("loads office read-back with visit facts", async () => {
    const owner = await seed();
    const { workOrder, asset } = await seedWorkHierarchy(owner);
    const visit = await owner.service.recordVisitArrival(owner.scope, workOrder.id, {
      userId: owner.userId,
      arrivedAt: ARRIVED,
    });
    await owner.service.recordFieldCapture(owner.scope, visit.id, {
      captureKind: "condition",
      captureCode: "visual_condition",
      description: "Ice on coil",
      observedAt: ARRIVED,
      userId: owner.userId,
      assetId: asset.id,
    });

    const captures = await owner.service.listFieldCapturesByVisit(owner.scope, visit.id);
    assert.equal(captures.length, 1);
    assert.equal(captures[0]?.description, "Ice on coil");
  });

  it("preserves asset status distinct from operational condition", async () => {
    const owner = await seed();
    const { workOrder, asset } = await seedWorkHierarchy(owner);
    const visit = await owner.service.recordVisitArrival(owner.scope, workOrder.id, {
      userId: owner.userId,
      arrivedAt: ARRIVED,
    });
    await owner.service.recordAssetOperationalCondition(owner.scope, {
      assetId: asset.id,
      conditionKind: "partially_operational",
      visitId: visit.id,
      workOrderId: workOrder.id,
      assertedAt: ARRIVED,
      assertedByUserId: owner.userId,
      recordedByUserId: owner.userId,
    });

    const loadedAsset = await owner.service.getAsset(owner.scope, asset.id);
    const current = await owner.service.getCurrentAssetOperationalCondition(
      owner.scope,
      asset.id,
    );
    assert.equal(loadedAsset?.status, "active");
    assert.equal(current?.conditionKind, "partially_operational");
  });

  it("keeps refrigerant event kinds without leaked", () => {
    assert.equal(FRIGORA_REFRIGERANT_EVENT_KINDS.includes("leaked" as never), false);
    const fieldActions = readFileSync(
      join(WEB_ROOT, "modules/frigora/app/field-mutation-actions.ts"),
      "utf8",
    );
    assert.equal(fieldActions.includes("leaked"), false);
    assert.match(fieldActions, /session\.id/);

    const refrigerantForm = readFileSync(
      join(WEB_ROOT, "modules/frigora/app/forms/record-refrigerant-event-form.tsx"),
      "utf8",
    );
    assert.match(refrigerantForm, /Added does not mean leaked/);
  });

  it("ships F1.2 routes and field mutation module without F0 edits", () => {
    assert.equal(platformVentureRegistry.resolve("frigora").version, "0.15.0");

    const dbSource = readFileSync(join(WEB_ROOT, "platform/persistence/db.ts"), "utf8");
    assert.match(dbSource, /SCHEMA_GENERATION = 21/);

    const assignedPage = readFileSync(
      join(WEB_ROOT, "app/(app)/ventures/[ventureId]/work/assigned/page.tsx"),
      "utf8",
    );
    const viewsSource = readFileSync(
      join(WEB_ROOT, "modules/frigora/app/views.ts"),
      "utf8",
    );
    const visitPage = readFileSync(
      join(
        WEB_ROOT,
        "app/(app)/ventures/[ventureId]/work/[workOrderId]/visit/[visitId]/page.tsx",
      ),
      "utf8",
    );
    assert.match(assignedPage, /requireFrigoraOpsContext/);
    assert.match(assignedPage, /loadMyWork/);
    assert.match(viewsSource, /status === "open"/);
    assert.match(visitPage, /loadVisitRecorder/);
    assert.equal(assignedPage.includes("offline"), false);
    assert.equal(visitPage.includes("signature"), false);

    const recorderScreen = readFileSync(
      join(WEB_ROOT, "modules/frigora/app/screens/visit-recorder-screen.tsx"),
      "utf8",
    );
    assert.match(recorderScreen, /Asset identity status is not operational condition/);
    assert.equal(recorderScreen.includes("closeWorkOrder"), false);
  });
});
