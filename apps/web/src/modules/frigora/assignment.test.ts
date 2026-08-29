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
import type { FrigoraScope, FrigoraWorkOrder } from "./types";

const NOW = "2026-08-28T00:00:00.000Z";

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

async function seedOpenWorkOrder(
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
  const workOrder = await service.createWorkOrder(scope, {
    siteId: site.id,
    workReference: reference,
    workKind: "reactive",
  });
  return { customer, site, workOrder };
}

function assertNoDispatchSemantics(workOrder: FrigoraWorkOrder) {
  assert.equal("dispatchedAt" in workOrder, false);
  assert.equal("visitId" in workOrder, false);
  assert.equal("completedAt" in workOrder, false);
  assert.equal("assignedEngineerId" in workOrder, false);
  assert.equal("dispatchStatus" in workOrder, false);
  assert.equal("acceptedAt" in workOrder, false);
}

describe("Frigora WorkOrder assignment", () => {
  it("assigns an open WorkOrder to a valid workspace member", async () => {
    const owner = await seed();
    const assigneeId = "user-assignee" as UserId;
    await getPersistence().memberships.setRole({
      userId: assigneeId,
      workspaceId: owner.workspaceId,
      role: "member",
      createdAt: NOW,
    });
    const { workOrder } = await seedOpenWorkOrder(owner.service, owner.scope);
    const assigned = await owner.service.assignWorkOrder(owner.scope, workOrder.id, {
      userId: assigneeId,
    });
    assert.equal(assigned.assignedUserId, assigneeId);
    assert.equal(assigned.status, "open");
    assertNoDispatchSemantics(assigned);
  });

  it("reassigns an open WorkOrder", async () => {
    const owner = await seed();
    const firstId = "user-first" as UserId;
    const secondId = "user-second" as UserId;
    await getPersistence().memberships.setRole({
      userId: firstId,
      workspaceId: owner.workspaceId,
      role: "member",
      createdAt: NOW,
    });
    await getPersistence().memberships.setRole({
      userId: secondId,
      workspaceId: owner.workspaceId,
      role: "member",
      createdAt: NOW,
    });
    const { workOrder } = await seedOpenWorkOrder(owner.service, owner.scope);
    await owner.service.assignWorkOrder(owner.scope, workOrder.id, { userId: firstId });
    const reassigned = await owner.service.assignWorkOrder(owner.scope, workOrder.id, {
      userId: secondId,
    });
    assert.equal(reassigned.assignedUserId, secondId);
  });

  it("clears assignment from an open WorkOrder", async () => {
    const owner = await seed();
    const assigneeId = "user-assignee" as UserId;
    await getPersistence().memberships.setRole({
      userId: assigneeId,
      workspaceId: owner.workspaceId,
      role: "member",
      createdAt: NOW,
    });
    const { workOrder } = await seedOpenWorkOrder(owner.service, owner.scope);
    await owner.service.assignWorkOrder(owner.scope, workOrder.id, { userId: assigneeId });
    const cleared = await owner.service.clearWorkOrderAssignment(owner.scope, workOrder.id);
    assert.equal(cleared.assignedUserId, null);
  });

  it("persists assignment across reads", async () => {
    const owner = await seed();
    const assigneeId = "user-assignee" as UserId;
    await getPersistence().memberships.setRole({
      userId: assigneeId,
      workspaceId: owner.workspaceId,
      role: "member",
      createdAt: NOW,
    });
    const { workOrder } = await seedOpenWorkOrder(owner.service, owner.scope);
    await owner.service.assignWorkOrder(owner.scope, workOrder.id, { userId: assigneeId });
    const loaded = await owner.service.getWorkOrder(owner.scope, workOrder.id);
    assert.equal(loaded?.assignedUserId, assigneeId);
  });

  it("lists WorkOrders by assignee within scope", async () => {
    const owner = await seed();
    const assigneeId = "user-assignee" as UserId;
    await getPersistence().memberships.setRole({
      userId: assigneeId,
      workspaceId: owner.workspaceId,
      role: "member",
      createdAt: NOW,
    });
    const { workOrder } = await seedOpenWorkOrder(owner.service, owner.scope, "WO-1");
    await owner.service.createWorkOrder(owner.scope, {
      siteId: workOrder.siteId,
      workReference: "WO-2",
      workKind: "reactive",
    });
    await owner.service.assignWorkOrder(owner.scope, workOrder.id, { userId: assigneeId });
    const listed = await owner.service.listWorkOrdersByAssignee(owner.scope, assigneeId);
    assert.equal(listed.length, 1);
    assert.equal(listed[0]?.id, workOrder.id);
  });

  it("does not list unassigned WorkOrders for an assignee", async () => {
    const owner = await seed();
    const assigneeId = "user-assignee" as UserId;
    await getPersistence().memberships.setRole({
      userId: assigneeId,
      workspaceId: owner.workspaceId,
      role: "member",
      createdAt: NOW,
    });
    await seedOpenWorkOrder(owner.service, owner.scope);
    assert.deepEqual(await owner.service.listWorkOrdersByAssignee(owner.scope, assigneeId), []);
  });

  it("rejects unknown or non-member assignee", async () => {
    const owner = await seed();
    const { workOrder } = await seedOpenWorkOrder(owner.service, owner.scope);
    await expectCode(
      () =>
        owner.service.assignWorkOrder(owner.scope, workOrder.id, {
          userId: "user-guess",
        }),
      "not_found",
    );
  });

  it("rejects cross-workspace assignee", async () => {
    const owner = await seed();
    const other = await seed({
      reset: false,
      workspaceId: "ws-other" as WorkspaceId,
      ventureId: "ven-other" as VentureId,
      userId: "user-other" as UserId,
      slug: "ws-other",
    });
    await getPersistence().memberships.setRole({
      userId: other.userId,
      workspaceId: other.workspaceId,
      role: "owner",
      createdAt: NOW,
    });
    const { workOrder } = await seedOpenWorkOrder(owner.service, owner.scope);
    await expectCode(
      () =>
        owner.service.assignWorkOrder(owner.scope, workOrder.id, {
          userId: other.userId,
        }),
      "not_found",
    );
  });

  it("rejects cross-venture assignment reads", async () => {
    const owner = await seed();
    const assigneeId = "user-assignee" as UserId;
    await getPersistence().memberships.setRole({
      userId: assigneeId,
      workspaceId: owner.workspaceId,
      role: "member",
      createdAt: NOW,
    });
    const { workOrder } = await seedOpenWorkOrder(owner.service, owner.scope);
    await owner.service.assignWorkOrder(owner.scope, workOrder.id, { userId: assigneeId });
    const otherVenture = "ven-other" as VentureId;
    await getPersistence().ventures.insert(
      ventureRow({
        id: otherVenture,
        workspaceId: owner.workspaceId,
        slug: "other-frigora",
        definitionVersion: "0.9.0",
      }),
    );
    assert.equal(
      await owner.service.getWorkOrder(
        { ...owner.scope, ventureId: otherVenture },
        workOrder.id,
      ),
      null,
    );
  });

  it("rejects assignment mutation on closed WorkOrder", async () => {
    const owner = await seed();
    const assigneeId = "user-assignee" as UserId;
    await getPersistence().memberships.setRole({
      userId: assigneeId,
      workspaceId: owner.workspaceId,
      role: "member",
      createdAt: NOW,
    });
    const { workOrder } = await seedOpenWorkOrder(owner.service, owner.scope);
    await owner.service.closeWorkOrder(owner.scope, workOrder.id);
    await expectCode(
      () =>
        owner.service.assignWorkOrder(owner.scope, workOrder.id, {
          userId: assigneeId,
        }),
      "invalid_status",
    );
    await expectCode(
      () => owner.service.clearWorkOrderAssignment(owner.scope, workOrder.id),
      "invalid_status",
    );
  });

  it("rejects assignment mutation on cancelled WorkOrder", async () => {
    const owner = await seed();
    const assigneeId = "user-assignee" as UserId;
    await getPersistence().memberships.setRole({
      userId: assigneeId,
      workspaceId: owner.workspaceId,
      role: "member",
      createdAt: NOW,
    });
    const { workOrder } = await seedOpenWorkOrder(owner.service, owner.scope);
    await owner.service.cancelWorkOrder(owner.scope, workOrder.id);
    await expectCode(
      () =>
        owner.service.assignWorkOrder(owner.scope, workOrder.id, {
          userId: assigneeId,
        }),
      "invalid_status",
    );
  });

  it("does not change WorkOrder status when assigning", async () => {
    const owner = await seed();
    const assigneeId = "user-assignee" as UserId;
    await getPersistence().memberships.setRole({
      userId: assigneeId,
      workspaceId: owner.workspaceId,
      role: "member",
      createdAt: NOW,
    });
    const { workOrder } = await seedOpenWorkOrder(owner.service, owner.scope);
    const assigned = await owner.service.assignWorkOrder(owner.scope, workOrder.id, {
      userId: assigneeId,
    });
    assert.equal(assigned.status, "open");
    assert.notEqual(assigned.status, "dispatched");
    assert.notEqual(assigned.status, "completed");
  });

  it("preserves assignee after close", async () => {
    const owner = await seed();
    const assigneeId = "user-assignee" as UserId;
    await getPersistence().memberships.setRole({
      userId: assigneeId,
      workspaceId: owner.workspaceId,
      role: "member",
      createdAt: NOW,
    });
    const { workOrder } = await seedOpenWorkOrder(owner.service, owner.scope);
    await owner.service.assignWorkOrder(owner.scope, workOrder.id, { userId: assigneeId });
    const closed = await owner.service.closeWorkOrder(owner.scope, workOrder.id);
    assert.equal(closed.assignedUserId, assigneeId);
    assert.equal(closed.status, "closed");
  });

  it("preserves assignee after cancel", async () => {
    const owner = await seed();
    const assigneeId = "user-assignee" as UserId;
    await getPersistence().memberships.setRole({
      userId: assigneeId,
      workspaceId: owner.workspaceId,
      role: "member",
      createdAt: NOW,
    });
    const { workOrder } = await seedOpenWorkOrder(owner.service, owner.scope);
    await owner.service.assignWorkOrder(owner.scope, workOrder.id, { userId: assigneeId });
    const cancelled = await owner.service.cancelWorkOrder(owner.scope, workOrder.id);
    assert.equal(cancelled.assignedUserId, assigneeId);
    assert.equal(cancelled.status, "cancelled");
  });

  it("supports persisted Frigora 0.3.0 instance", async () => {
    const owner = await seed({ definitionVersion: "0.3.0" });
    const assigneeId = "user-assignee" as UserId;
    await getPersistence().memberships.setRole({
      userId: assigneeId,
      workspaceId: owner.workspaceId,
      role: "member",
      createdAt: NOW,
    });
    const { workOrder } = await seedOpenWorkOrder(owner.service, owner.scope);
    const assigned = await owner.service.assignWorkOrder(owner.scope, workOrder.id, {
      userId: assigneeId,
    });
    assert.equal(assigned.assignedUserId, assigneeId);
  });

  it("resolves frigora@0.10.0 from catalog", () => {
    assert.equal(platformVentureRegistry.resolve("frigora").version, "0.13.0");
    assert.match(
      platformVentureRegistry.resolve("frigora").description,
      /current WorkOrder assignment/,
    );
  });
});
