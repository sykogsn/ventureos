import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, it } from "node:test";
import { platformVentureRegistry } from "@/core/venture-definition/catalog";
import type { Role, UserId, VentureId, WorkspaceId } from "@/contracts";
import { createPermissionService } from "@/platform/permissions/service";
import { createDbMembershipStore } from "@/platform/permissions/membership-store";
import { ensureSchema, getClient } from "@/platform/persistence/db";
import { getPersistence, resetPersistenceLifecycle } from "@/platform/persistence/repositories";
import { closeFrigoraPersistenceAfterFile } from "./test-persistence-lifecycle";
import {
  completeWorkOrderFromVisit,
  TEST_CANCELLATION_REASON,
} from "./test-work-execution";
import type { PersistedVenture } from "@/platform/persistence/repositories/ports";
import { FrigoraError } from "./errors";
import { createFrigoraService } from "./service";
import { createFrigoraStore } from "./store";
import type { FrigoraScope, FrigoraWorkOrder, UpdateWorkOrderInput } from "./types";
import { FRIGORA_OFFLINE_CAPTURE_OPERATION_ALLOWLIST } from "./app/offline/capture-gate";
import { FRIGORA_OFFLINE_DB_NAME, FRIGORA_OFFLINE_DB_VERSION } from "./app/offline/types";
import {
  createWorkOrderSchema,
  parseWithFrigora,
  setWorkOrderPrioritySchema,
} from "./validation";

const NOW = "2026-08-28T00:00:00.000Z";

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
  slug?: string;
} = {}) {
  if (options.reset !== false) {
    await resetPersistenceLifecycle();
    await ensureSchema();
  }
  const workspaceId = (options.workspaceId ?? "ws-frigora") as WorkspaceId;
  const ventureId = (options.ventureId ?? "ven-frigora") as VentureId;
  const userId = (options.userId ?? "user-owner") as UserId;
  const store = getPersistence();
  const existingWorkspace = await store.organisations.findById(workspaceId);
  if (!existingWorkspace) {
    await store.organisations.insert({
      id: workspaceId,
      name: "Frigora Workspace",
      slug: options.slug ?? `ws-${workspaceId}`,
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
      definitionVersion: options.definitionVersion ?? "0.9.0",
    }),
  );
  return {
    workspaceId,
    ventureId,
    userId,
    scope: {
      userId,
      workspaceId,
      ventureId,
    } satisfies FrigoraScope,
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

async function seedFuelCoHierarchy(
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
    assetKind: "display_freezer",
    designTargetCelsius: -18,
    refrigerantType: "R404A",
  });
  return { customer, site, asset };
}

function assertNoOutFields(workOrder: FrigoraWorkOrder) {
  assert.equal("diagnosis" in workOrder, false);
  assert.equal("currentTemperature" in workOrder, false);
  assert.equal("reading" in workOrder, false);
  assert.equal("telemetry" in workOrder, false);
  assert.equal("evidenceId" in workOrder, false);
  assert.equal("assignedEngineerId" in workOrder, false);
  assert.equal("slaStatus" in workOrder, false);
  assert.equal("dispatchedAt" in workOrder, false);
  assert.equal("visitId" in workOrder, false);
  assert.equal("invoiceId" in workOrder, false);
  assert.equal("refrigerantEventId" in workOrder, false);
  assert.equal("reportedSummary" in workOrder, false);
  assert.equal("faultCode" in workOrder, false);
  assert.equal("cause" in workOrder, false);
  assert.equal("notes" in workOrder, false);
  assert.equal("completedAt" in workOrder, false);
  assert.equal(workOrder.cancellationReason, null);
  assert.equal(workOrder.sourceRecommendedActionId, null);
}

describe("Frigora WorkOrder foundation", () => {
  it("creates a site-level WorkOrder without Asset", async () => {
    const { scope, service } = await seed();
    const customer = await service.createCustomer(scope, {
      code: "SHOP",
      displayName: "Shop",
    });
    const site = await service.createSite(scope, {
      customerId: customer.id,
      code: "MAIN",
      name: "Main",
    });
    const workOrder = await service.createWorkOrder(scope, {
      siteId: site.id,
      workReference: "WO-1001",
      workKind: "reactive",
    });
    assert.equal(workOrder.primaryAssetId, null);
    assert.equal(workOrder.assignedUserId, null);
    assert.equal(workOrder.cancellationReason, null);
    assert.equal(workOrder.sourceRecommendedActionId, null);
    assert.equal(workOrder.status, "open");
    assert.equal(workOrder.customerId, customer.id);
    assert.equal(workOrder.siteId, site.id);
  });

  it("creates a WorkOrder with primary Asset", async () => {
    const { scope, service } = await seed();
    const { customer, site, asset } = await seedFuelCoHierarchy(service, scope);
    const workOrder = await service.createWorkOrder(scope, {
      siteId: site.id,
      workReference: "WO-1002",
      workKind: "inspection",
      primaryAssetId: asset.id,
    });
    assert.equal(workOrder.primaryAssetId, asset.id);
    assert.equal(workOrder.customerId, customer.id);
    assert.equal(workOrder.siteId, site.id);
  });

  it("represents canonical WO-1864 / FuelCo / Sandton North / FZ-118 / display freezer warm", async () => {
    const { scope, service } = await seed();
    const { customer, site, asset } = await seedFuelCoHierarchy(service, scope);
    const workOrder = await service.createWorkOrder(scope, {
      siteId: site.id,
      workReference: "WO-1864",
      workKind: "reactive",
      reportedCondition: "display freezer warm",
      primaryAssetId: asset.id,
    });
    assert.equal(workOrder.workReference, "WO-1864");
    assert.equal(workOrder.reportedCondition, "display freezer warm");
    assert.equal(workOrder.workKind, "reactive");
    assert.equal(customer.displayName, "FuelCo");
    assert.equal(site.name, "Sandton North");
    assert.equal(asset.tag, "FZ-118");
    assertNoOutFields(workOrder);
  });

  it("rejects duplicate work_reference in the same venture", async () => {
    const { scope, service } = await seed();
    const { site } = await seedFuelCoHierarchy(service, scope);
    await service.createWorkOrder(scope, {
      siteId: site.id,
      workReference: "WO-1864",
      workKind: "reactive",
    });
    await expectCode(
      () =>
        service.createWorkOrder(scope, {
          siteId: site.id,
          workReference: "WO-1864",
          workKind: "planned",
        }),
      "duplicate",
    );
  });

  it("allows the same work_reference in different Frigora ventures", async () => {
    const first = await seed();
    const { site } = await seedFuelCoHierarchy(first.service, first.scope);
    await first.service.createWorkOrder(first.scope, {
      siteId: site.id,
      workReference: "WO-1864",
      workKind: "reactive",
    });
    const second = await seed({
      reset: false,
      workspaceId: "ws-other" as WorkspaceId,
      ventureId: "ven-other" as VentureId,
      userId: first.userId,
      slug: "ws-other",
    });
    await getPersistence().memberships.setRole({
      userId: first.userId,
      workspaceId: second.workspaceId,
      role: "owner",
      createdAt: NOW,
    });
    const customer = await second.service.createCustomer(second.scope, {
      code: "OTHER",
      displayName: "Other",
    });
    const otherSite = await second.service.createSite(second.scope, {
      customerId: customer.id,
      code: "SITE",
      name: "Site",
    });
    const copy = await second.service.createWorkOrder(second.scope, {
      siteId: otherSite.id,
      workReference: "WO-1864",
      workKind: "reactive",
    });
    assert.equal(copy.workReference, "WO-1864");
    assert.notEqual(copy.ventureId, first.ventureId);
  });

  it("derives customer_id from Site", async () => {
    const { scope, service } = await seed();
    const { customer, site } = await seedFuelCoHierarchy(service, scope);
    const workOrder = await service.createWorkOrder(scope, {
      siteId: site.id,
      workReference: "WO-2001",
      workKind: "reactive",
    });
    assert.equal(workOrder.customerId, customer.id);
    assert.equal(workOrder.workspaceId, site.workspaceId);
    assert.equal(workOrder.ventureId, site.ventureId);
  });

  it("requires primary Asset to belong to Site", async () => {
    const { scope, service } = await seed();
    const customer = await service.createCustomer(scope, {
      code: "FUELCO",
      displayName: "FuelCo",
    });
    const siteA = await service.createSite(scope, {
      customerId: customer.id,
      code: "A",
      name: "Site A",
    });
    const siteB = await service.createSite(scope, {
      customerId: customer.id,
      code: "B",
      name: "Site B",
    });
    const asset = await service.createAsset(scope, { siteId: siteB.id, tag: "FZ-118" });
    await expectCode(
      () =>
        service.createWorkOrder(scope, {
          siteId: siteA.id,
          workReference: "WO-X",
          workKind: "reactive",
          primaryAssetId: asset.id,
        }),
      "invalid_input",
    );
  });

  it("rejects cross-venture Site on create", async () => {
    const first = await seed();
    const second = await seed({
      reset: false,
      workspaceId: "ws-two" as WorkspaceId,
      ventureId: "ven-two" as VentureId,
      userId: first.userId,
      slug: "ws-two",
    });
    await getPersistence().memberships.setRole({
      userId: first.userId,
      workspaceId: second.workspaceId,
      role: "owner",
      createdAt: NOW,
    });
    const customer = await second.service.createCustomer(second.scope, {
      code: "B",
      displayName: "Beta",
    });
    const siteB = await second.service.createSite(second.scope, {
      customerId: customer.id,
      code: "T",
      name: "Site B",
    });
    await expectCode(
      () =>
        first.service.createWorkOrder(first.scope, {
          siteId: siteB.id,
          workReference: "WO-X",
          workKind: "reactive",
        }),
      "not_found",
    );
  });

  it("fails closed on cross-workspace read", async () => {
    const alpha = await seed();
    const { site } = await seedFuelCoHierarchy(alpha.service, alpha.scope);
    const workOrder = await alpha.service.createWorkOrder(alpha.scope, {
      siteId: site.id,
      workReference: "WO-1864",
      workKind: "reactive",
    });
    const beta = await seed({
      reset: false,
      workspaceId: "ws-beta" as WorkspaceId,
      ventureId: "ven-beta" as VentureId,
      userId: "user-beta" as UserId,
      slug: "ws-beta",
    });
    assert.equal(await beta.service.getWorkOrder(beta.scope, workOrder.id), null);
    await expectCode(
      () =>
        beta.service.listWorkOrders({
          ...alpha.scope,
          userId: beta.userId,
        }),
      "forbidden",
    );
  });

  it("cannot retrieve WorkOrder with wrong venture UUID", async () => {
    const { scope, service } = await seed();
    const { site } = await seedFuelCoHierarchy(service, scope);
    const workOrder = await service.createWorkOrder(scope, {
      siteId: site.id,
      workReference: "WO-1864",
      workKind: "reactive",
    });
    assert.equal(
      await service.getWorkOrder(
        { ...scope, ventureId: "ven-guess" as VentureId },
        workOrder.id,
      ),
      null,
    );
  });

  it("fails closed on guessed work_reference in wrong venture", async () => {
    const { scope, service } = await seed();
    const { site } = await seedFuelCoHierarchy(service, scope);
    await service.createWorkOrder(scope, {
      siteId: site.id,
      workReference: "WO-1864",
      workKind: "reactive",
    });
    const otherVenture = "ven-other" as VentureId;
    await getPersistence().ventures.insert(
      ventureRow({
        id: otherVenture,
        workspaceId: scope.workspaceId,
        slug: "other-frigora",
        definitionId: "frigora",
        definitionVersion: "0.3.0",
      }),
    );
    assert.equal(
      await service.getWorkOrderByReference(
        { ...scope, ventureId: otherVenture },
        "WO-1864",
      ),
      null,
    );
  });

  it("rejects WorkOrder on non-Frigora venture", async () => {
    const { scope, service } = await seed({ definitionId: "ventureos.company" });
    await expectCode(
      () =>
        service.createWorkOrder(scope, {
          siteId: "site-1",
          workReference: "WO-X",
          workKind: "reactive",
        }),
      "not_frigora",
    );
  });

  it("rejects new WorkOrder on archived Customer", async () => {
    const { scope, service } = await seed();
    const customer = await service.createCustomer(scope, {
      code: "FUELCO",
      displayName: "FuelCo",
    });
    const site = await service.createSite(scope, {
      customerId: customer.id,
      code: "MAIN",
      name: "Main",
    });
    await service.archiveCustomer(scope, customer.id);
    await expectCode(
      () =>
        service.createWorkOrder(scope, {
          siteId: site.id,
          workReference: "WO-X",
          workKind: "reactive",
        }),
      "archived_parent",
    );
  });

  it("rejects new WorkOrder on archived Site", async () => {
    const { scope, service } = await seed();
    const customer = await service.createCustomer(scope, {
      code: "FUELCO",
      displayName: "FuelCo",
    });
    const site = await service.createSite(scope, {
      customerId: customer.id,
      code: "MAIN",
      name: "Main",
    });
    await service.archiveSite(scope, site.id);
    await expectCode(
      () =>
        service.createWorkOrder(scope, {
          siteId: site.id,
          workReference: "WO-X",
          workKind: "reactive",
        }),
      "archived_parent",
    );
  });

  it("rejects newly associating decommissioned Asset", async () => {
    const { scope, service } = await seed();
    const { site, asset } = await seedFuelCoHierarchy(service, scope);
    await service.decommissionAsset(scope, asset.id);
    await expectCode(
      () =>
        service.createWorkOrder(scope, {
          siteId: site.id,
          workReference: "WO-X",
          workKind: "reactive",
          primaryAssetId: asset.id,
        }),
      "archived_parent",
    );
  });

  it("keeps WorkOrder readable after Customer archive", async () => {
    const { scope, service } = await seed();
    const { customer, site } = await seedFuelCoHierarchy(service, scope);
    const workOrder = await service.createWorkOrder(scope, {
      siteId: site.id,
      workReference: "WO-1864",
      workKind: "reactive",
    });
    await service.archiveCustomer(scope, customer.id);
    assert.equal((await service.getWorkOrder(scope, workOrder.id))?.workReference, "WO-1864");
  });

  it("keeps WorkOrder readable after Site archive", async () => {
    const { scope, service } = await seed();
    const { site } = await seedFuelCoHierarchy(service, scope);
    const workOrder = await service.createWorkOrder(scope, {
      siteId: site.id,
      workReference: "WO-1864",
      workKind: "reactive",
    });
    await service.archiveSite(scope, site.id);
    assert.equal((await service.getWorkOrder(scope, workOrder.id))?.status, "open");
  });

  it("keeps WorkOrder readable after Asset decommission", async () => {
    const { scope, service } = await seed();
    const { site, asset } = await seedFuelCoHierarchy(service, scope);
    const workOrder = await service.createWorkOrder(scope, {
      siteId: site.id,
      workReference: "WO-1864",
      workKind: "reactive",
      primaryAssetId: asset.id,
    });
    await service.decommissionAsset(scope, asset.id);
    const loaded = await service.getWorkOrder(scope, workOrder.id);
    assert.equal(loaded?.primaryAssetId, asset.id);
    assert.equal(loaded?.status, "open");
  });

  it("assigns primary Asset later while open", async () => {
    const { scope, service } = await seed();
    const { site, asset } = await seedFuelCoHierarchy(service, scope);
    const workOrder = await service.createWorkOrder(scope, {
      siteId: site.id,
      workReference: "WO-1864",
      workKind: "reactive",
    });
    const updated = await service.updateWorkOrder(scope, workOrder.id, {
      primaryAssetId: asset.id,
    });
    assert.equal(updated.primaryAssetId, asset.id);
  });

  it("changes primary Asset on same Site while open", async () => {
    const { scope, service } = await seed();
    const customer = await service.createCustomer(scope, {
      code: "FUELCO",
      displayName: "FuelCo",
    });
    const site = await service.createSite(scope, {
      customerId: customer.id,
      code: "MAIN",
      name: "Main",
    });
    const first = await service.createAsset(scope, { siteId: site.id, tag: "FZ-118" });
    const second = await service.createAsset(scope, { siteId: site.id, tag: "FZ-119" });
    const workOrder = await service.createWorkOrder(scope, {
      siteId: site.id,
      workReference: "WO-1864",
      workKind: "reactive",
      primaryAssetId: first.id,
    });
    const updated = await service.updateWorkOrder(scope, workOrder.id, {
      primaryAssetId: second.id,
    });
    assert.equal(updated.primaryAssetId, second.id);
  });

  it("rejects cross-Site Asset change while open", async () => {
    const { scope, service } = await seed();
    const customer = await service.createCustomer(scope, {
      code: "FUELCO",
      displayName: "FuelCo",
    });
    const siteA = await service.createSite(scope, {
      customerId: customer.id,
      code: "A",
      name: "Site A",
    });
    const siteB = await service.createSite(scope, {
      customerId: customer.id,
      code: "B",
      name: "Site B",
    });
    const assetB = await service.createAsset(scope, { siteId: siteB.id, tag: "FZ-119" });
    const workOrder = await service.createWorkOrder(scope, {
      siteId: siteA.id,
      workReference: "WO-1864",
      workKind: "reactive",
    });
    await expectCode(
      () =>
        service.updateWorkOrder(scope, workOrder.id, {
          primaryAssetId: assetB.id,
        }),
      "invalid_input",
    );
  });

  it("clears primary Asset while open", async () => {
    const { scope, service } = await seed();
    const { site, asset } = await seedFuelCoHierarchy(service, scope);
    const workOrder = await service.createWorkOrder(scope, {
      siteId: site.id,
      workReference: "WO-1864",
      workKind: "reactive",
      primaryAssetId: asset.id,
    });
    const cleared = await service.updateWorkOrder(scope, workOrder.id, {
      primaryAssetId: null,
    });
    assert.equal(cleared.primaryAssetId, null);
  });

  it("transitions open to closed", async () => {
    const { scope, service } = await seed();
    const { site } = await seedFuelCoHierarchy(service, scope);
    const workOrder = await service.createWorkOrder(scope, {
      siteId: site.id,
      workReference: "WO-1864",
      workKind: "reactive",
    });
    const visit = await service.recordVisitArrival(scope, workOrder.id, {
      userId: scope.userId,
      arrivedAt: "2026-08-28T10:00:00.000Z",
    });
    const closed = await completeWorkOrderFromVisit(
      service,
      scope,
      workOrder.id,
      visit,
      scope.userId,
    );
    assert.equal(closed.status, "closed");
    assert.notEqual(closed.status, "completed");
    assert.equal("completedAt" in closed, false);
  });

  it("transitions open to cancelled", async () => {
    const { scope, service } = await seed();
    const { site } = await seedFuelCoHierarchy(service, scope);
    const workOrder = await service.createWorkOrder(scope, {
      siteId: site.id,
      workReference: "WO-1864",
      workKind: "reactive",
    });
    const cancelled = await service.cancelWorkOrder(scope, workOrder.id, {
      reason: TEST_CANCELLATION_REASON,
    });
    assert.equal(cancelled.status, "cancelled");
    assert.equal(cancelled.cancellationReason, TEST_CANCELLATION_REASON);
  });

  it("transitions closed to open", async () => {
    const { scope, service } = await seed();
    const { site } = await seedFuelCoHierarchy(service, scope);
    const workOrder = await service.createWorkOrder(scope, {
      siteId: site.id,
      workReference: "WO-1864",
      workKind: "reactive",
    });
    const visit = await service.recordVisitArrival(scope, workOrder.id, {
      userId: scope.userId,
      arrivedAt: "2026-08-28T10:00:00.000Z",
    });
    await completeWorkOrderFromVisit(service, scope, workOrder.id, visit, scope.userId);
    const reopened = await service.reopenWorkOrder(scope, workOrder.id);
    assert.equal(reopened.status, "open");
  });

  it("rejects reopening cancelled WorkOrder", async () => {
    const { scope, service } = await seed();
    const { site } = await seedFuelCoHierarchy(service, scope);
    const workOrder = await service.createWorkOrder(scope, {
      siteId: site.id,
      workReference: "WO-1864",
      workKind: "reactive",
    });
    await service.cancelWorkOrder(scope, workOrder.id, {
      reason: TEST_CANCELLATION_REASON,
    });
    await expectCode(() => service.reopenWorkOrder(scope, workOrder.id), "invalid_status");
    await expectCode(() => service.closeWorkOrder(scope, workOrder.id), "invalid_status");
  });

  it("rejects invalid lifecycle transitions", async () => {
    const { scope, service } = await seed();
    const { site } = await seedFuelCoHierarchy(service, scope);
    const workOrder = await service.createWorkOrder(scope, {
      siteId: site.id,
      workReference: "WO-1864",
      workKind: "reactive",
    });
    const visit = await service.recordVisitArrival(scope, workOrder.id, {
      userId: scope.userId,
      arrivedAt: "2026-08-28T10:00:00.000Z",
    });
    await completeWorkOrderFromVisit(service, scope, workOrder.id, visit, scope.userId);
    await expectCode(
      () =>
        service.cancelWorkOrder(scope, workOrder.id, {
          reason: TEST_CANCELLATION_REASON,
        }),
      "invalid_status",
    );
  });

  it("rejects updateWorkOrder while closed", async () => {
    const { scope, service } = await seed();
    const { site } = await seedFuelCoHierarchy(service, scope);
    const workOrder = await service.createWorkOrder(scope, {
      siteId: site.id,
      workReference: "WO-1864",
      workKind: "reactive",
    });
    const visit = await service.recordVisitArrival(scope, workOrder.id, {
      userId: scope.userId,
      arrivedAt: "2026-08-28T10:00:00.000Z",
    });
    await completeWorkOrderFromVisit(service, scope, workOrder.id, visit, scope.userId);
    await expectCode(
      () =>
        service.updateWorkOrder(scope, workOrder.id, {
          reportedCondition: "changed",
        }),
      "invalid_status",
    );
  });

  it("rejects updateWorkOrder while cancelled", async () => {
    const { scope, service } = await seed();
    const { site } = await seedFuelCoHierarchy(service, scope);
    const workOrder = await service.createWorkOrder(scope, {
      siteId: site.id,
      workReference: "WO-1864",
      workKind: "reactive",
    });
    await service.cancelWorkOrder(scope, workOrder.id, {
      reason: TEST_CANCELLATION_REASON,
    });
    await expectCode(
      () =>
        service.updateWorkOrder(scope, workOrder.id, {
          workKind: "planned",
        }),
      "invalid_status",
    );
  });

  it("keeps work_reference immutable via update surface", async () => {
    const { scope, service } = await seed();
    const { site } = await seedFuelCoHierarchy(service, scope);
    const workOrder = await service.createWorkOrder(scope, {
      siteId: site.id,
      workReference: "WO-1864",
      workKind: "reactive",
    });
    const updated = await service.updateWorkOrder(scope, workOrder.id, {
      reportedCondition: "still warm",
    });
    assert.equal(updated.workReference, "WO-1864");
    assert.equal("workReference" in ({} as UpdateWorkOrderInput), false);
  });

  it("keeps customer and site immutable", async () => {
    const { scope, service } = await seed();
    const { customer, site } = await seedFuelCoHierarchy(service, scope);
    const workOrder = await service.createWorkOrder(scope, {
      siteId: site.id,
      workReference: "WO-1864",
      workKind: "reactive",
    });
    const updated = await service.updateWorkOrder(scope, workOrder.id, {
      workKind: "planned",
    });
    assert.equal(updated.customerId, customer.id);
    assert.equal(updated.siteId, site.id);
  });

  it("supports persisted Frigora 0.1.0 instance", async () => {
    const { scope, service } = await seed({ definitionVersion: "0.1.0" });
    const customer = await service.createCustomer(scope, {
      code: "FUELCO",
      displayName: "FuelCo",
    });
    const site = await service.createSite(scope, {
      customerId: customer.id,
      code: "MAIN",
      name: "Main",
    });
    const workOrder = await service.createWorkOrder(scope, {
      siteId: site.id,
      workReference: "WO-1864",
      workKind: "reactive",
    });
    assert.equal(workOrder.workReference, "WO-1864");
  });

  it("supports persisted Frigora 0.2.0 instance", async () => {
    const { scope, service } = await seed({ definitionVersion: "0.2.0" });
    const customer = await service.createCustomer(scope, {
      code: "FUELCO",
      displayName: "FuelCo",
    });
    const site = await service.createSite(scope, {
      customerId: customer.id,
      code: "MAIN",
      name: "Main",
    });
    const workOrder = await service.createWorkOrder(scope, {
      siteId: site.id,
      workReference: "WO-1864",
      workKind: "inspection",
    });
    assert.equal(workOrder.workKind, "inspection");
  });

  it("resolves frigora@0.10.0 from catalog", () => {
    assert.equal(platformVentureRegistry.resolve("frigora").version, "0.22.0");
    assert.match(
      platformVentureRegistry.resolve("frigora").description,
      /WorkOrder/,
    );
  });

  it("does not mutate VIC when creating WorkOrder", async () => {
    const { scope, service, ventureId } = await seed();
    const persistence = getPersistence();
    const before = await persistence.ventures.findById(ventureId);
    assert.ok(before);
    const { site } = await seedFuelCoHierarchy(service, scope);
    await service.createWorkOrder(scope, {
      siteId: site.id,
      workReference: "WO-1864",
      workKind: "reactive",
    });
    const after = await persistence.ventures.findById(ventureId);
    assert.deepEqual(after, before);
  });

  it("allows members to read and not mutate WorkOrders", async () => {
    const owner = await seed();
    const memberId = "user-member" as UserId;
    await getPersistence().memberships.setRole({
      userId: memberId,
      workspaceId: owner.workspaceId,
      role: "member",
      createdAt: NOW,
    });
    const { site } = await seedFuelCoHierarchy(owner.service, owner.scope);
    const workOrder = await owner.service.createWorkOrder(owner.scope, {
      siteId: site.id,
      workReference: "WO-1864",
      workKind: "reactive",
    });
    const memberScope: FrigoraScope = { ...owner.scope, userId: memberId };
    const listed = await owner.service.listWorkOrders(memberScope);
    assert.equal(listed[0]?.id, workOrder.id);
    await expectCode(
      () =>
        owner.service.createWorkOrder(memberScope, {
          siteId: site.id,
          workReference: "WO-9999",
          workKind: "reactive",
        }),
      "forbidden",
    );
  });

  it("exposes no hard-delete store surface for WorkOrders", async () => {
    const store = createFrigoraStore();
    assert.ok(!Object.keys(store).some((key) => /delete/i.test(key)));
  });

  it("maps duplicate reference constraint to domain error", async () => {
    const { scope, service } = await seed();
    const { site } = await seedFuelCoHierarchy(service, scope);
    await service.createWorkOrder(scope, {
      siteId: site.id,
      workReference: "WO-1864",
      workKind: "reactive",
    });
    await expectCode(
      () =>
        service.createWorkOrder(scope, {
          siteId: site.id,
          workReference: "WO-1864",
          workKind: "planned",
        }),
      "duplicate",
    );
  });

  it("lists WorkOrders by customer, site, and asset", async () => {
    const { scope, service } = await seed();
    const { customer, site, asset } = await seedFuelCoHierarchy(service, scope);
    const workOrder = await service.createWorkOrder(scope, {
      siteId: site.id,
      workReference: "WO-1864",
      workKind: "reactive",
      primaryAssetId: asset.id,
    });
    assert.equal(
      (await service.listWorkOrdersByCustomer(scope, customer.id))[0]?.id,
      workOrder.id,
    );
    assert.equal((await service.listWorkOrdersBySite(scope, site.id))[0]?.id, workOrder.id);
    assert.equal((await service.listWorkOrdersByAsset(scope, asset.id))[0]?.id, workOrder.id);
    assert.equal((await service.getWorkOrderByReference(scope, "WO-1864"))?.id, workOrder.id);
    assert.equal((await service.listWorkOrders(scope, "open")).length, 1);
    const visit = await service.recordVisitArrival(scope, workOrder.id, {
      userId: scope.userId,
      arrivedAt: "2026-08-28T10:00:00.000Z",
    });
    await completeWorkOrderFromVisit(service, scope, workOrder.id, visit, scope.userId);
    assert.equal((await service.listWorkOrders(scope, "open")).length, 0);
    assert.equal((await service.listWorkOrders(scope, "closed")).length, 1);
  });

  it("accepts planned and inspection work kinds as classification only", async () => {
    const { scope, service } = await seed();
    const { site } = await seedFuelCoHierarchy(service, scope);
    const planned = await service.createWorkOrder(scope, {
      siteId: site.id,
      workReference: "WO-PLAN",
      workKind: "planned",
    });
    const inspection = await service.createWorkOrder(scope, {
      siteId: site.id,
      workReference: "WO-INSP",
      workKind: "inspection",
    });
    assert.equal(planned.workKind, "planned");
    assert.equal(inspection.workKind, "inspection");
    assert.equal("ppmRequirementId" in planned, false);
    assert.equal("plannedVisitId" in planned, false);
  });
});

describe("Frigora WorkOrder validation", () => {
  it("trims and requires work_reference", () => {
    const parsed = parseWithFrigora(createWorkOrderSchema, {
      siteId: "site-1",
      workReference: "  WO-1864  ",
      workKind: "reactive",
    });
    assert.equal(parsed.workReference, "WO-1864");
    assert.throws(
      () =>
        parseWithFrigora(createWorkOrderSchema, {
          siteId: "site-1",
          workReference: " ",
          workKind: "reactive",
        }),
      (error: unknown) => error instanceof FrigoraError && error.code === "invalid_input",
    );
  });

  it("normalizes reported_condition empty to null", () => {
    const parsed = parseWithFrigora(createWorkOrderSchema, {
      siteId: "site-1",
      workReference: "WO-1",
      workKind: "reactive",
      reportedCondition: "   ",
    });
    assert.equal(parsed.reportedCondition, null);
  });

  it("rejects reported_condition longer than 2000 characters", () => {
    assert.throws(
      () =>
        parseWithFrigora(createWorkOrderSchema, {
          siteId: "site-1",
          workReference: "WO-1",
          workKind: "reactive",
          reportedCondition: "x".repeat(2001),
        }),
      (error: unknown) => error instanceof FrigoraError && error.code === "invalid_input",
    );
  });

  it("rejects invalid work_kind", () => {
    assert.throws(
      () =>
        parseWithFrigora(createWorkOrderSchema, {
          siteId: "site-1",
          workReference: "WO-1",
          workKind: "corrective",
        }),
      (error: unknown) => error instanceof FrigoraError && error.code === "invalid_kind",
    );
  });
});

const PRIORITY_START = "2026-09-23T10:00:00.000Z";
const PRIORITY_END = "2026-09-23T11:00:00.000Z";

function priorityCode(expected: string) {
  return (error: unknown) => error instanceof FrigoraError && error.code === expected;
}

async function openWork(owner: Awaited<ReturnType<typeof seed>>, reference: string, workKind: "reactive" | "planned" | "inspection" = "reactive") {
  const customer = await owner.service.createCustomer(owner.scope, {
    code: `C-${reference}`,
    displayName: reference,
  });
  const site = await owner.service.createSite(owner.scope, {
    customerId: customer.id,
    code: `S-${reference}`,
    name: reference,
  });
  return owner.service.createWorkOrder(owner.scope, {
    siteId: site.id,
    workReference: reference,
    workKind,
  });
}

describe("Frigora WorkOrder priority", () => {
  it("defaults new and legacy WorkOrders to normal and persists a valid priority", async () => {
    const owner = await seed();
    const created = await openWork(owner, "WO-NEW");
    assert.equal(created.priority, "normal");
    assert.equal(created.workKind, "reactive");
    const urgent = await owner.service.setWorkOrderPriority(owner.scope, created.id, {
      priority: "urgent",
      expectedUpdatedAt: created.updatedAt,
    });
    assert.equal(urgent.priority, "urgent");
    assert.equal(urgent.workKind, "reactive");
    const loaded = await owner.service.getWorkOrder(owner.scope, created.id);
    assert.equal(loaded?.priority, "urgent");

    await getClient().execute(`
      CREATE TABLE IF NOT EXISTS frigora_work_orders_legacy_probe (id TEXT PRIMARY KEY)
    `);
    await getClient().execute({
      sql: `INSERT INTO frigora_work_orders (
        id, workspace_id, venture_id, customer_id, site_id, work_reference,
        work_kind, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        "wo-legacy-priority",
        owner.workspaceId,
        owner.ventureId,
        created.customerId,
        created.siteId,
        "WO-LEGACY-PRIORITY",
        "planned",
        "open",
        NOW,
        NOW,
      ],
    });
    const legacy = await createFrigoraStore().findWorkOrder(
      owner.workspaceId,
      owner.ventureId,
      "wo-legacy-priority" as FrigoraWorkOrder["id"],
    );
    assert.equal(legacy?.priority, "normal");
    assert.equal(legacy?.workKind, "planned");
  });

  it("rejects an invalid priority", () => {
    assert.throws(
      () =>
        parseWithFrigora(setWorkOrderPrioritySchema, {
          priority: "critical",
          expectedUpdatedAt: NOW,
        }),
      (error: unknown) =>
        error instanceof FrigoraError &&
        error.code === "invalid_kind" &&
        error.message === "Work order priority is not allowed.",
    );
  });

  it("lets owner and admin change priority and refuses a member", async () => {
    const owner = await seed();
    const created = await openWork(owner, "WO-AUTH");
    const adminId = "user-admin" as UserId;
    const memberId = "user-member" as UserId;
    await getPersistence().memberships.setRole({
      userId: adminId,
      workspaceId: owner.workspaceId,
      role: "admin",
      createdAt: NOW,
    });
    await getPersistence().memberships.setRole({
      userId: memberId,
      workspaceId: owner.workspaceId,
      role: "member",
      createdAt: NOW,
    });
    const adminScope = { ...owner.scope, userId: adminId };
    const memberScope = { ...owner.scope, userId: memberId };
    const raised = await owner.service.setWorkOrderPriority(adminScope, created.id, {
      priority: "high",
      expectedUpdatedAt: created.updatedAt,
    });
    assert.equal(raised.priority, "high");
    await assert.rejects(
      () =>
        owner.service.setWorkOrderPriority(memberScope, created.id, {
          priority: "urgent",
          expectedUpdatedAt: raised.updatedAt,
        }),
      priorityCode("forbidden"),
    );
    await assert.rejects(
      () =>
        owner.service.assignWorkOrder(memberScope, created.id, {
          userId: memberId,
          expectedUpdatedAt: raised.updatedAt,
        }),
      priorityCode("forbidden"),
    );
    const unchanged = await owner.service.getWorkOrder(owner.scope, created.id);
    assert.equal(unchanged?.priority, "high");
  });

  it("rejects a stale priority token without overwriting newer state", async () => {
    const owner = await seed();
    const created = await openWork(owner, "WO-STALE");
    const urgent = await owner.service.setWorkOrderPriority(owner.scope, created.id, {
      priority: "urgent",
      expectedUpdatedAt: created.updatedAt,
    });
    await assert.rejects(
      () =>
        owner.service.setWorkOrderPriority(owner.scope, created.id, {
          priority: "high",
          expectedUpdatedAt: created.updatedAt,
        }),
      priorityCode("dispatch_conflict"),
    );
    const loaded = await owner.service.getWorkOrder(owner.scope, created.id);
    assert.equal(loaded?.priority, "urgent");
    assert.equal(loaded?.updatedAt, urgent.updatedAt);
  });

  it("keeps assignment, scheduling, overlap confirmation, and unavailability independent of priority", async () => {
    const owner = await seed();
    const engineer = "user-engineer" as UserId;
    await getPersistence().memberships.setRole({
      userId: engineer,
      workspaceId: owner.workspaceId,
      role: "member",
      createdAt: NOW,
    });
    const first = await openWork(owner, "WO-A", "inspection");
    const second = await openWork(owner, "WO-B", "planned");
    const urgent = await owner.service.setWorkOrderPriority(owner.scope, second.id, {
      priority: "urgent",
      expectedUpdatedAt: second.updatedAt,
    });
    assert.equal(urgent.workKind, "planned");
    const assigned = await owner.service.assignWorkOrder(owner.scope, first.id, {
      userId: engineer,
      expectedUpdatedAt: first.updatedAt,
    });
    const reassignedTarget = await owner.service.getWorkOrder(owner.scope, second.id);
    const reassigned = await owner.service.assignWorkOrder(owner.scope, second.id, {
      userId: engineer,
      expectedUpdatedAt: reassignedTarget!.updatedAt,
    });
    assert.equal(assigned.assignedUserId, engineer);
    assert.equal(reassigned.assignedUserId, engineer);
    assert.equal(reassigned.priority, "urgent");
    const scheduled = await owner.service.scheduleWorkOrder(owner.scope, assigned.id, {
      scheduledStartAt: PRIORITY_START,
      scheduledEndAt: PRIORITY_END,
      expectedUpdatedAt: assigned.updatedAt,
    });
    assert.equal(scheduled.scheduledStartAt, PRIORITY_START);
    assert.equal(scheduled.priority, "normal");
    await assert.rejects(
      () =>
        owner.service.scheduleWorkOrder(owner.scope, reassigned.id, {
          scheduledStartAt: PRIORITY_START,
          scheduledEndAt: PRIORITY_END,
          expectedUpdatedAt: reassigned.updatedAt,
        }),
      priorityCode("double_booking"),
    );
    const beforeConfirm = await owner.service.getWorkOrder(owner.scope, reassigned.id);
    assert.equal(beforeConfirm?.scheduledStartAt, null);
    const confirmed = await owner.service.scheduleWorkOrder(owner.scope, reassigned.id, {
      scheduledStartAt: PRIORITY_START,
      scheduledEndAt: PRIORITY_END,
      expectedUpdatedAt: reassigned.updatedAt,
      confirmDoubleBooking: true,
    });
    assert.equal(confirmed.scheduledStartAt, PRIORITY_START);
    assert.equal(confirmed.priority, "urgent");

    const blocked = await openWork(owner, "WO-BLOCK");
    const blockedAssigned = await owner.service.assignWorkOrder(owner.scope, blocked.id, {
      userId: engineer,
      expectedUpdatedAt: blocked.updatedAt,
    });
    const blockedUrgent = await owner.service.setWorkOrderPriority(owner.scope, blocked.id, {
      priority: "urgent",
      expectedUpdatedAt: blockedAssigned.updatedAt,
    });
    await owner.service.createUnavailability(owner.scope, {
      userId: engineer,
      unavailableStartAt: "2026-09-24T10:00:00.000Z",
      unavailableEndAt: "2026-09-24T11:00:00.000Z",
    });
    await assert.rejects(
      () =>
        owner.service.scheduleWorkOrder(owner.scope, blocked.id, {
          scheduledStartAt: "2026-09-24T10:00:00.000Z",
          scheduledEndAt: "2026-09-24T11:00:00.000Z",
          expectedUpdatedAt: blockedUrgent.updatedAt,
          confirmDoubleBooking: true,
        }),
      priorityCode("engineer_unavailable"),
    );
  });

  it("keeps active-visit and closed-work protection intact", async () => {
    const owner = await seed();
    const engineer = "user-engineer" as UserId;
    await getPersistence().memberships.setRole({
      userId: engineer,
      workspaceId: owner.workspaceId,
      role: "member",
      createdAt: NOW,
    });
    const created = await openWork(owner, "WO-VISIT");
    const urgent = await owner.service.setWorkOrderPriority(owner.scope, created.id, {
      priority: "urgent",
      expectedUpdatedAt: created.updatedAt,
    });
    assert.equal(urgent.priority, "urgent");
    await owner.service.recordVisitArrival(owner.scope, created.id, {
      userId: engineer,
      arrivedAt: PRIORITY_START,
    });
    await assert.rejects(
      () =>
        owner.service.setWorkOrderPriority(owner.scope, created.id, {
          priority: "high",
          expectedUpdatedAt: urgent.updatedAt,
        }),
      priorityCode("invalid_status"),
    );
    const duringVisit = await owner.service.getWorkOrder(owner.scope, created.id);
    assert.equal(duringVisit?.priority, "urgent");
    assert.equal(duringVisit?.status, "open");
    await assert.rejects(
      () =>
        owner.service.assignWorkOrder(owner.scope, created.id, {
          userId: engineer,
          expectedUpdatedAt: urgent.updatedAt,
        }),
      priorityCode("invalid_status"),
    );
    const cancelled = await openWork(owner, "WO-CLOSED");
    const closed = await owner.service.cancelWorkOrder(owner.scope, cancelled.id, {
      reason: "Not required",
    });
    await assert.rejects(
      () =>
        owner.service.setWorkOrderPriority(owner.scope, closed.id, {
          priority: "urgent",
          expectedUpdatedAt: closed.updatedAt,
        }),
      priorityCode("invalid_status"),
    );
  });

  it("rejects priority when a visit opens after the pre-check and before the write", async () => {
    const owner = await seed();
    const engineer = "user-engineer" as UserId;
    await getPersistence().memberships.setRole({
      userId: engineer,
      workspaceId: owner.workspaceId,
      role: "member",
      createdAt: NOW,
    });
    const created = await openWork(owner, "WO-PRIORITY-RACE");
    const store = createFrigoraStore();
    const compare = store.compareAndSetWorkOrderPriority.bind(store);
    let writeBoundaryReached = false;
    store.compareAndSetWorkOrderPriority = async (expected, next) => {
      writeBoundaryReached = true;
      await owner.service.recordVisitArrival(owner.scope, created.id, {
        userId: engineer,
        arrivedAt: PRIORITY_START,
      });
      return compare(expected, next);
    };
    const guarded = createFrigoraService({
      store,
      permissions: createPermissionService(createDbMembershipStore()),
    });
    await assert.rejects(
      guarded.setWorkOrderPriority(owner.scope, created.id, {
        priority: "urgent",
        expectedUpdatedAt: created.updatedAt,
      }),
      (error: unknown) =>
        error instanceof FrigoraError &&
        error.code === "invalid_status" &&
        error.message === "Dispatch is locked while a visit is in progress.",
    );
    assert.equal(writeBoundaryReached, true);
    const stored = await owner.service.getWorkOrder(owner.scope, created.id);
    assert.equal(stored?.priority, "normal");
    assert.equal(stored?.updatedAt, created.updatedAt);
    assert.equal(stored?.status, "open");
  });

  it("keeps schema 31 and the offline allowlist unchanged", () => {
    assert.equal(platformVentureRegistry.resolve("frigora").version, "0.22.0");
    const dbSource = readFileSync(join(process.cwd(), "src/platform/persistence/db.ts"), "utf8");
    assert.match(dbSource, /SCHEMA_GENERATION = 31/);
    assert.equal(FRIGORA_OFFLINE_DB_NAME, "frigora-offline");
    assert.equal(FRIGORA_OFFLINE_DB_VERSION, 1);
    assert.deepEqual(
      [...FRIGORA_OFFLINE_CAPTURE_OPERATION_ALLOWLIST],
      ["recordTechnicalFinding", "recordFieldCapture", "recordVisitEvidence"],
    );
  });
});
