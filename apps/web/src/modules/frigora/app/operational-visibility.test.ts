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
import {
  ATTENTION_SIGNAL_LABELS,
  computeOperationsCounts,
  deriveAttentionSignals,
  formatVisitStatusLabel,
  hasActiveVisit,
  selectLatestVisit,
  sortOperationalActivityEvents,
  takeRecentActivity,
  type OperationalActivityEvent,
} from "@/modules/frigora/app/operational-derivations";
import { createFrigoraService } from "@/modules/frigora/service";
import type { FrigoraScope, FrigoraVisit } from "@/modules/frigora/types";
import { FRIGORA_REFRIGERANT_EVENT_KINDS } from "@/modules/frigora/types";
import { FrigoraError } from "@/modules/frigora/errors";
import { platformVentureRegistry } from "@/core/venture-definition/catalog";

const NOW = "2026-08-29T00:00:00.000Z";
const ARRIVED = "2026-08-29T10:00:00.000Z";
const DEPARTED = "2026-08-29T12:00:00.000Z";
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
  definitionId?: string;
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
      definitionId: options.definitionId ?? "frigora",
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

async function seedHierarchy(owner: Awaited<ReturnType<typeof seed>>) {
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
  return { customer, site, asset };
}

describe("F1.3 Operational Visibility", () => {
  it("places Operations first among Frigora operational nav links", () => {
    const links = buildVentureSurfaceLinks({
      ventureId: "ven-1",
      slug: "frigora-one",
      definitionId: "frigora",
      companyHomeHref: "/ventures/hq/frigora-one",
    });
    const opsIndex = links.findIndex((link) => link.label === "Operations");
    const myWorkIndex = links.findIndex((link) => link.label === "My Work");
    const workIndex = links.findIndex((link) => link.label === "Work");
    assert.equal(links[opsIndex]?.href.endsWith("/operations"), true);
    assert.equal(opsIndex < myWorkIndex, true);
    assert.equal(myWorkIndex < workIndex, true);
    assert.deepEqual(
      links
        .filter((link) =>
          ["Operations", "My Work", "Work", "Customers"].includes(link.label),
        )
        .map((link) => link.label),
      ["Operations", "My Work", "Work", "Customers"],
    );
  });

  it("computes deterministic operations counts", async () => {
    const owner = await seed();
    const { site, asset } = await seedHierarchy(owner);

    const unassigned = await owner.service.createWorkOrder(owner.scope, {
      siteId: site.id,
      workReference: "WO-UNASSIGNED",
      workKind: "reactive",
    });
    const assigned = await owner.service.createWorkOrder(owner.scope, {
      siteId: site.id,
      workReference: "WO-ASSIGNED",
      workKind: "reactive",
      primaryAssetId: asset.id,
    });
    await owner.service.assignWorkOrder(owner.scope, assigned.id, {
      userId: owner.userId,
    });

    const visitOpen = await owner.service.recordVisitArrival(owner.scope, assigned.id, {
      userId: owner.userId,
      arrivedAt: ARRIVED,
    });
    await owner.service.recordVisitDeparture(owner.scope, visitOpen.id, {
      departedAt: DEPARTED,
    });

    const openWorkOrders = await owner.service.listWorkOrders(owner.scope, "open");
    const visitsByWorkOrderId = new Map<string, FrigoraVisit[]>();
    for (const workOrder of openWorkOrders) {
      visitsByWorkOrderId.set(
        workOrder.id,
        await owner.service.listVisitsByWorkOrder(owner.scope, workOrder.id),
      );
    }

    const counts = computeOperationsCounts(openWorkOrders, visitsByWorkOrderId);
    assert.equal(counts.openWork, 2);
    assert.equal(counts.assignedOpen, 1);
    assert.equal(counts.unassignedOpen, 1);
    assert.equal(counts.activeVisits, 0);
    assert.equal(counts.visitedStillOpen, 1);
    assert.equal(unassigned.id !== assigned.id, true);
  });

  it("derives attention signals including multi-signal work orders", async () => {
    const owner = await seed();
    const { site } = await seedHierarchy(owner);
    const workOrder = await owner.service.createWorkOrder(owner.scope, {
      siteId: site.id,
      workReference: "WO-MULTI",
      workKind: "reactive",
    });
    const visits = await owner.service.listVisitsByWorkOrder(owner.scope, workOrder.id);
    const signals = deriveAttentionSignals(workOrder, visits);
    assert.deepEqual(signals, ["UNASSIGNED_OPEN_WORK", "NO_VISIT_RECORDED"]);

    const visit = await owner.service.recordVisitArrival(owner.scope, workOrder.id, {
      userId: owner.userId,
      arrivedAt: ARRIVED,
    });
    const withVisit = deriveAttentionSignals(workOrder, [visit]);
    assert.equal(withVisit.includes("VISIT_IN_PROGRESS"), true);
    assert.equal(withVisit.includes("UNASSIGNED_OPEN_WORK"), true);

    await owner.service.recordVisitDeparture(owner.scope, visit.id, {
      departedAt: DEPARTED,
    });
    const departed = await owner.service.getVisit(owner.scope, visit.id);
    const withDeparted = deriveAttentionSignals(workOrder, [departed!]);
    assert.equal(withDeparted.includes("VISIT_COMPLETED_WORK_OPEN"), true);
  });

  it("does not derive attention from RecommendedAction or AssetOperationalCondition alone", async () => {
    const owner = await seed();
    const { site, asset } = await seedHierarchy(owner);
    const workOrder = await owner.service.createWorkOrder(owner.scope, {
      siteId: site.id,
      workReference: "WO-FACTS",
      workKind: "reactive",
      primaryAssetId: asset.id,
    });
    await owner.service.assignWorkOrder(owner.scope, workOrder.id, {
      userId: owner.userId,
    });
    const visit = await owner.service.recordVisitArrival(owner.scope, workOrder.id, {
      userId: owner.userId,
      arrivedAt: ARRIVED,
    });
    await owner.service.recordRecommendedAction(owner.scope, visit.id, {
      description: "Replace fan motor next visit",
      recommendedAt: ARRIVED,
      recommendedByUserId: owner.userId,
      recordedByUserId: owner.userId,
      assetId: asset.id,
    });
    await owner.service.recordAssetOperationalCondition(owner.scope, {
      assetId: asset.id,
      conditionKind: "non_operational",
      assertedAt: ARRIVED,
      assertedByUserId: owner.userId,
      recordedByUserId: owner.userId,
      visitId: visit.id,
      workOrderId: workOrder.id,
    });
    const visits = await owner.service.listVisitsByWorkOrder(owner.scope, workOrder.id);
    const signals = deriveAttentionSignals(workOrder, visits);
    const allowed = new Set([
      "UNASSIGNED_OPEN_WORK",
      "NO_VISIT_RECORDED",
      "VISIT_IN_PROGRESS",
      "VISIT_COMPLETED_WORK_OPEN",
    ]);
    assert.equal(signals.every((signal) => allowed.has(signal)), true);
    assert.equal(signals.includes("VISIT_IN_PROGRESS"), true);
  });

  it("limits and sorts recent activity by explicit timestamps", () => {
    const events: OperationalActivityEvent[] = [
      {
        kind: "visit_arrived",
        occurredAt: "2026-08-29T09:00:00.000Z",
        sourceId: "v-1",
        workOrderId: "wo-1",
        workOrderReference: "WO-1",
        visitId: "v-1",
        assetId: null,
        label: "Visit arrived",
        detail: null,
      },
      {
        kind: "work_order_created",
        occurredAt: "2026-08-29T08:00:00.000Z",
        sourceId: "wo-1",
        workOrderId: "wo-1",
        workOrderReference: "WO-1",
        visitId: null,
        assetId: null,
        label: "Work order created",
        detail: null,
      },
    ];
    const sorted = sortOperationalActivityEvents(events);
    assert.equal(sorted[0]?.kind, "visit_arrived");
    const limited = takeRecentActivity(
      Array.from({ length: 25 }, (_, index) => ({
        kind: "field_capture_observed",
        occurredAt: `2026-08-29T${String(index).padStart(2, "0")}:00:00.000Z`,
        sourceId: `fc-${index}`,
        workOrderId: "wo-1",
        workOrderReference: "WO-1",
        visitId: "v-1",
        assetId: null,
        label: "Observation recorded",
        detail: null,
      })),
    );
    assert.equal(limited.length, 20);
    assert.equal(limited[0]!.occurredAt > limited[19]!.occurredAt, true);
  });

  it("records activity event families from certified entity timestamps", async () => {
    const owner = await seed();
    const { site, asset } = await seedHierarchy(owner);
    const workOrder = await owner.service.createWorkOrder(owner.scope, {
      siteId: site.id,
      workReference: "WO-ACTIVITY",
      workKind: "reactive",
      primaryAssetId: asset.id,
    });
    await owner.service.assignWorkOrder(owner.scope, workOrder.id, {
      userId: owner.userId,
    });
    const visit = await owner.service.recordVisitArrival(owner.scope, workOrder.id, {
      userId: owner.userId,
      arrivedAt: ARRIVED,
    });
    await owner.service.recordFieldCapture(owner.scope, visit.id, {
      captureKind: "measurement",
      captureCode: "temperature",
      valueNumeric: -18,
      valueUnit: "celsius",
      observedAt: ARRIVED,
      userId: owner.userId,
      assetId: asset.id,
    });
    await owner.service.recordVisitDeparture(owner.scope, visit.id, {
      departedAt: DEPARTED,
    });

    const captures = await owner.service.listFieldCapturesByWorkOrder(
      owner.scope,
      workOrder.id,
    );
    assert.equal(captures[0]?.observedAt, ARRIVED);
    const visits = await owner.service.listVisitsByWorkOrder(owner.scope, workOrder.id);
    assert.equal(visits[0]?.arrivedAt, ARRIVED);
    assert.equal(visits[0]?.departedAt, DEPARTED);
    assert.equal(typeof workOrder.createdAt, "string");
    assert.equal(workOrder.createdAt.length > 0, true);
  });

  it("filters work list rows by status and assignment", async () => {
    const owner = await seed();
    const { site } = await seedHierarchy(owner);
    const openUnassigned = await owner.service.createWorkOrder(owner.scope, {
      siteId: site.id,
      workReference: "WO-OPEN-U",
      workKind: "reactive",
    });
    const openAssigned = await owner.service.createWorkOrder(owner.scope, {
      siteId: site.id,
      workReference: "WO-OPEN-A",
      workKind: "reactive",
    });
    await owner.service.assignWorkOrder(owner.scope, openAssigned.id, {
      userId: owner.userId,
    });
    const closed = await owner.service.createWorkOrder(owner.scope, {
      siteId: site.id,
      workReference: "WO-CLOSED",
      workKind: "reactive",
    });
    await owner.service.closeWorkOrder(owner.scope, closed.id);

    const all = await owner.service.listWorkOrders(owner.scope);
    const openOnly = all.filter((row) => row.status === "open");
    const assignedOpen = openOnly.filter((row) => row.assignedUserId !== null);
    const unassignedOpen = openOnly.filter((row) => row.assignedUserId === null);

    assert.equal(openOnly.length, 2);
    assert.equal(assignedOpen.length, 1);
    assert.equal(unassignedOpen.length, 1);
    assert.equal(openUnassigned.id, unassignedOpen[0]?.id);
  });

  it("selects latest visit deterministically and detects active visits", async () => {
    const owner = await seed();
    const { site } = await seedHierarchy(owner);
    const workOrder = await owner.service.createWorkOrder(owner.scope, {
      siteId: site.id,
      workReference: "WO-VISITS",
      workKind: "reactive",
    });
    await owner.service.assignWorkOrder(owner.scope, workOrder.id, {
      userId: owner.userId,
    });
    const first = await owner.service.recordVisitArrival(owner.scope, workOrder.id, {
      userId: owner.userId,
      arrivedAt: "2026-08-28T10:00:00.000Z",
    });
    await owner.service.recordVisitDeparture(owner.scope, first.id, {
      departedAt: "2026-08-28T12:00:00.000Z",
    });
    const second = await owner.service.recordVisitArrival(owner.scope, workOrder.id, {
      userId: owner.userId,
      arrivedAt: ARRIVED,
    });
    const visits = await owner.service.listVisitsByWorkOrder(owner.scope, workOrder.id);
    const latest = selectLatestVisit(visits);
    assert.equal(latest?.id, second.id);
    assert.equal(hasActiveVisit(visits), true);
    assert.equal(formatVisitStatusLabel("open"), "In progress");
  });

  it("closes and reopens work orders without visits and preserves visit state", async () => {
    const owner = await seed();
    const { site } = await seedHierarchy(owner);
    const workOrder = await owner.service.createWorkOrder(owner.scope, {
      siteId: site.id,
      workReference: "WO-LIFE",
      workKind: "reactive",
    });
    const closed = await owner.service.closeWorkOrder(owner.scope, workOrder.id);
    assert.equal(closed.status, "closed");
    const reopened = await owner.service.reopenWorkOrder(owner.scope, workOrder.id);
    assert.equal(reopened.status, "open");

    const assigned = await owner.service.assignWorkOrder(owner.scope, workOrder.id, {
      userId: owner.userId,
    });
    const visit = await owner.service.recordVisitArrival(owner.scope, assigned.id, {
      userId: owner.userId,
      arrivedAt: ARRIVED,
    });
    await owner.service.recordVisitDeparture(owner.scope, visit.id, {
      departedAt: DEPARTED,
    });
    const afterDepart = await owner.service.getWorkOrder(owner.scope, assigned.id);
    assert.equal(afterDepart?.status, "open");
  });

  it("rejects member lifecycle mutations and cancelled reopen", async () => {
    const owner = await seed({ userId: "user-owner" as UserId, role: "owner" });
    const memberId = "user-member" as UserId;
    await getPersistence().memberships.setRole({
      userId: memberId,
      workspaceId: owner.workspaceId,
      role: "member",
      createdAt: NOW,
    });
    const { site } = await seedHierarchy(owner);
    const workOrder = await owner.service.createWorkOrder(owner.scope, {
      siteId: site.id,
      workReference: "WO-MEMBER",
      workKind: "reactive",
    });
    const memberScope: FrigoraScope = { ...owner.scope, userId: memberId };
    await assert.rejects(
      () => owner.service.closeWorkOrder(memberScope, workOrder.id),
      (error: unknown) => {
        assert.ok(error instanceof FrigoraError);
        assert.equal(error.code, "forbidden");
        return true;
      },
    );

    const cancelled = await owner.service.createWorkOrder(owner.scope, {
      siteId: site.id,
      workReference: "WO-CANCEL",
      workKind: "reactive",
    });
    await owner.service.cancelWorkOrder(owner.scope, cancelled.id);
    await assert.rejects(
      () => owner.service.reopenWorkOrder(owner.scope, cancelled.id),
      (error: unknown) => {
        assert.ok(error instanceof FrigoraError);
        assert.equal(error.code, "invalid_status");
        return true;
      },
    );
  });

  it("isolates ventures and workspaces", async () => {
    const first = await seed({
      workspaceId: "ws-a" as WorkspaceId,
      ventureId: "ven-a" as VentureId,
      userId: "user-a" as UserId,
    });
    const second = await seed({
      workspaceId: "ws-b" as WorkspaceId,
      ventureId: "ven-b" as VentureId,
      userId: "user-b" as UserId,
    });
    const { site } = await seedHierarchy(first);
    await first.service.createWorkOrder(first.scope, {
      siteId: site.id,
      workReference: "WO-A",
      workKind: "reactive",
    });
    const otherOrders = await second.service.listWorkOrders(second.scope);
    assert.equal(otherOrders.length, 0);
  });

  it("preserves truth-model negative space in labels", () => {
    assert.equal(ATTENTION_SIGNAL_LABELS.VISIT_COMPLETED_WORK_OPEN.includes("still open"), true);
    assert.equal(FRIGORA_REFRIGERANT_EVENT_KINDS.includes("added"), true);
    assert.equal(FRIGORA_REFRIGERANT_EVENT_KINDS.includes("leaked" as never), false);
    const viewsSource = readFileSync(
      join(WEB_ROOT, "modules/frigora/app/views.ts"),
      "utf8",
    );
    assert.equal(viewsSource.includes("platform/audit"), false);
    assert.equal(viewsSource.includes("WorkOrder.updatedAt"), false);
  });

  it("ships F1.3 routes and mutation wrappers without F0 edits", () => {
    assert.equal(platformVentureRegistry.resolve("frigora").version, "0.15.0");

    const dbSource = readFileSync(join(WEB_ROOT, "platform/persistence/db.ts"), "utf8");
    assert.match(dbSource, /SCHEMA_GENERATION = 21/);

    const operationsPage = readFileSync(
      join(WEB_ROOT, "app/(app)/ventures/[ventureId]/operations/page.tsx"),
      "utf8",
    );
    assert.match(operationsPage, /requireFrigoraOpsContext/);
    assert.match(operationsPage, /loadOperationsOverview/);

    const lifecycleControls = readFileSync(
      join(WEB_ROOT, "modules/frigora/app/forms/work-order-lifecycle-controls.tsx"),
      "utf8",
    );
    assert.equal(lifecycleControls.includes("cancelWorkOrder"), false);
    assert.match(lifecycleControls, /Close work order/);
    assert.match(lifecycleControls, /Reopen work order/);

    const mutationActions = readFileSync(
      join(WEB_ROOT, "modules/frigora/app/mutation-actions.ts"),
      "utf8",
    );
    assert.match(mutationActions, /closeWorkOrderAction/);
    assert.match(mutationActions, /reopenWorkOrderAction/);
    assert.equal(mutationActions.includes("cancelWorkOrderAction"), false);

    const viewsSource = readFileSync(join(WEB_ROOT, "modules/frigora/app/views.ts"), "utf8");
    assert.equal(viewsSource.includes("getFrigoraService"), false);
    assert.equal(viewsSource.includes(".insert("), false);

    const company = buildVentureSurfaceLinks({
      ventureId: "ven-company",
      slug: "acme",
      definitionId: "ventureos.company",
      companyHomeHref: "/ventures/hq/acme",
    });
    assert.equal(company.some((link) => link.label === "Operations"), false);
  });
});
