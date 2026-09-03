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
import type { FrigoraScope, FrigoraVisit, FrigoraWorkOrder } from "./types";

const NOW = "2026-08-28T00:00:00.000Z";
const ARRIVED = "2026-08-28T10:00:00.000Z";
const DEPARTED = "2026-08-28T12:00:00.000Z";
const EARLY_DEPART = "2026-08-28T09:00:00.000Z";

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

async function addMember(workspaceId: WorkspaceId, userId: UserId) {
  await getPersistence().memberships.setRole({
    userId,
    workspaceId,
    role: "member",
    createdAt: NOW,
  });
}

function assertNoDispatchOrExecutionFields(record: FrigoraVisit | FrigoraWorkOrder) {
  assert.equal("dispatchedAt" in record, false);
  assert.equal("dispatchStatus" in record, false);
  assert.equal("completedAt" in record, false);
  assert.equal("workStartedAt" in record, false);
  assert.equal("startedAt" in record, false);
  assert.equal("endedAt" in record, false);
  assert.equal("diagnosis" in record, false);
  assert.equal("evidenceId" in record, false);
}

describe("Frigora Visit attendance", () => {
  it("records arrival against open WorkOrder with valid workspace member", async () => {
    const owner = await seed();
    const attendeeId = "user-attendee" as UserId;
    await addMember(owner.workspaceId, attendeeId);
    const { workOrder } = await seedOpenWorkOrder(owner.service, owner.scope);
    const visit = await owner.service.recordVisitArrival(owner.scope, workOrder.id, {
      userId: attendeeId,
      arrivedAt: ARRIVED,
    });
    assert.equal(visit.status, "open");
    assert.equal(visit.arrivedAt, ARRIVED);
    assert.equal(visit.departedAt, null);
    assert.equal(visit.attendingUserId, attendeeId);
    assert.equal(visit.workOrderId, workOrder.id);
    assertNoDispatchOrExecutionFields(visit);
  });

  it("persists arrivedAt across reads", async () => {
    const owner = await seed();
    const attendeeId = "user-attendee" as UserId;
    await addMember(owner.workspaceId, attendeeId);
    const { workOrder } = await seedOpenWorkOrder(owner.service, owner.scope);
    const created = await owner.service.recordVisitArrival(owner.scope, workOrder.id, {
      userId: attendeeId,
      arrivedAt: ARRIVED,
    });
    const loaded = await owner.service.getVisit(owner.scope, created.id);
    assert.equal(loaded?.arrivedAt, ARRIVED);
  });

  it("records departure on open Visit", async () => {
    const owner = await seed();
    const attendeeId = "user-attendee" as UserId;
    await addMember(owner.workspaceId, attendeeId);
    const { workOrder } = await seedOpenWorkOrder(owner.service, owner.scope);
    const visit = await owner.service.recordVisitArrival(owner.scope, workOrder.id, {
      userId: attendeeId,
      arrivedAt: ARRIVED,
    });
    const departed = await owner.service.recordVisitDeparture(owner.scope, visit.id, {
      departedAt: DEPARTED,
    });
    assert.equal(departed.status, "departed");
    assert.equal(departed.departedAt, DEPARTED);
    assertNoDispatchOrExecutionFields(departed);
  });

  it("rejects departedAt earlier than arrivedAt", async () => {
    const owner = await seed();
    const attendeeId = "user-attendee" as UserId;
    await addMember(owner.workspaceId, attendeeId);
    const { workOrder } = await seedOpenWorkOrder(owner.service, owner.scope);
    const visit = await owner.service.recordVisitArrival(owner.scope, workOrder.id, {
      userId: attendeeId,
      arrivedAt: ARRIVED,
    });
    await expectCode(
      () =>
        owner.service.recordVisitDeparture(owner.scope, visit.id, {
          departedAt: EARLY_DEPART,
        }),
      "invalid_input",
    );
  });

  it("cancels open Visit without fabricating departedAt", async () => {
    const owner = await seed();
    const attendeeId = "user-attendee" as UserId;
    await addMember(owner.workspaceId, attendeeId);
    const { workOrder } = await seedOpenWorkOrder(owner.service, owner.scope);
    const visit = await owner.service.recordVisitArrival(owner.scope, workOrder.id, {
      userId: attendeeId,
      arrivedAt: ARRIVED,
    });
    const cancelled = await owner.service.cancelVisit(owner.scope, visit.id);
    assert.equal(cancelled.status, "cancelled");
    assert.equal(cancelled.departedAt, null);
    assert.equal(cancelled.arrivedAt, ARRIVED);
  });

  it("rejects departure of departed Visit", async () => {
    const owner = await seed();
    const attendeeId = "user-attendee" as UserId;
    await addMember(owner.workspaceId, attendeeId);
    const { workOrder } = await seedOpenWorkOrder(owner.service, owner.scope);
    const visit = await owner.service.recordVisitArrival(owner.scope, workOrder.id, {
      userId: attendeeId,
      arrivedAt: ARRIVED,
    });
    await owner.service.recordVisitDeparture(owner.scope, visit.id, {
      departedAt: DEPARTED,
    });
    await expectCode(
      () =>
        owner.service.recordVisitDeparture(owner.scope, visit.id, {
          departedAt: DEPARTED,
        }),
      "invalid_status",
    );
  });

  it("rejects departure of cancelled Visit", async () => {
    const owner = await seed();
    const attendeeId = "user-attendee" as UserId;
    await addMember(owner.workspaceId, attendeeId);
    const { workOrder } = await seedOpenWorkOrder(owner.service, owner.scope);
    const visit = await owner.service.recordVisitArrival(owner.scope, workOrder.id, {
      userId: attendeeId,
      arrivedAt: ARRIVED,
    });
    await owner.service.cancelVisit(owner.scope, visit.id);
    await expectCode(
      () =>
        owner.service.recordVisitDeparture(owner.scope, visit.id, {
          departedAt: DEPARTED,
        }),
      "invalid_status",
    );
  });

  it("rejects cancellation of departed Visit", async () => {
    const owner = await seed();
    const attendeeId = "user-attendee" as UserId;
    await addMember(owner.workspaceId, attendeeId);
    const { workOrder } = await seedOpenWorkOrder(owner.service, owner.scope);
    const visit = await owner.service.recordVisitArrival(owner.scope, workOrder.id, {
      userId: attendeeId,
      arrivedAt: ARRIVED,
    });
    await owner.service.recordVisitDeparture(owner.scope, visit.id, {
      departedAt: DEPARTED,
    });
    await expectCode(() => owner.service.cancelVisit(owner.scope, visit.id), "invalid_status");
  });

  it("rejects cancellation of already cancelled Visit", async () => {
    const owner = await seed();
    const attendeeId = "user-attendee" as UserId;
    await addMember(owner.workspaceId, attendeeId);
    const { workOrder } = await seedOpenWorkOrder(owner.service, owner.scope);
    const visit = await owner.service.recordVisitArrival(owner.scope, workOrder.id, {
      userId: attendeeId,
      arrivedAt: ARRIVED,
    });
    await owner.service.cancelVisit(owner.scope, visit.id);
    await expectCode(() => owner.service.cancelVisit(owner.scope, visit.id), "invalid_status");
  });

  it("getVisit exposes attendance fields", async () => {
    const owner = await seed();
    const attendeeId = "user-attendee" as UserId;
    await addMember(owner.workspaceId, attendeeId);
    const { workOrder } = await seedOpenWorkOrder(owner.service, owner.scope);
    const visit = await owner.service.recordVisitArrival(owner.scope, workOrder.id, {
      userId: attendeeId,
      arrivedAt: ARRIVED,
    });
    const loaded = await owner.service.getVisit(owner.scope, visit.id);
    assert.ok(loaded);
    assert.equal(loaded.workOrderId, workOrder.id);
    assert.equal(loaded.attendingUserId, attendeeId);
    assert.equal(loaded.arrivedAt, ARRIVED);
    assert.equal(loaded.status, "open");
  });

  it("lists Visits by WorkOrder", async () => {
    const owner = await seed();
    const attendeeId = "user-attendee" as UserId;
    await addMember(owner.workspaceId, attendeeId);
    const { workOrder } = await seedOpenWorkOrder(owner.service, owner.scope);
    const visit = await owner.service.recordVisitArrival(owner.scope, workOrder.id, {
      userId: attendeeId,
      arrivedAt: ARRIVED,
    });
    const listed = await owner.service.listVisitsByWorkOrder(owner.scope, workOrder.id);
    assert.equal(listed.length, 1);
    assert.equal(listed[0]?.id, visit.id);
  });

  it("allows multiple Visits against one WorkOrder", async () => {
    const owner = await seed();
    const attendeeId = "user-attendee" as UserId;
    await addMember(owner.workspaceId, attendeeId);
    const { workOrder } = await seedOpenWorkOrder(owner.service, owner.scope);
    await owner.service.recordVisitArrival(owner.scope, workOrder.id, {
      userId: attendeeId,
      arrivedAt: "2026-08-28T08:00:00.000Z",
    });
    await owner.service.recordVisitArrival(owner.scope, workOrder.id, {
      userId: attendeeId,
      arrivedAt: ARRIVED,
    });
    assert.equal((await owner.service.listVisitsByWorkOrder(owner.scope, workOrder.id)).length, 2);
  });

  it("lists Visits by attending user", async () => {
    const owner = await seed();
    const attendeeId = "user-attendee" as UserId;
    await addMember(owner.workspaceId, attendeeId);
    const { workOrder } = await seedOpenWorkOrder(owner.service, owner.scope);
    const visit = await owner.service.recordVisitArrival(owner.scope, workOrder.id, {
      userId: attendeeId,
      arrivedAt: ARRIVED,
    });
    const listed = await owner.service.listVisitsByAttendingUser(owner.scope, attendeeId);
    assert.equal(listed.length, 1);
    assert.equal(listed[0]?.id, visit.id);
  });

  it("rejects unknown or non-member attending user", async () => {
    const owner = await seed();
    const { workOrder } = await seedOpenWorkOrder(owner.service, owner.scope);
    await expectCode(
      () =>
        owner.service.recordVisitArrival(owner.scope, workOrder.id, {
          userId: "user-guess",
          arrivedAt: ARRIVED,
        }),
      "not_found",
    );
  });

  it("rejects cross-workspace attending user", async () => {
    const owner = await seed();
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
    const { workOrder } = await seedOpenWorkOrder(owner.service, owner.scope);
    await expectCode(
      () =>
        owner.service.recordVisitArrival(owner.scope, workOrder.id, {
          userId: outsiderId,
          arrivedAt: ARRIVED,
        }),
      "not_found",
    );
  });

  it("rejects cross-venture Visit access", async () => {
    const owner = await seed();
    const attendeeId = "user-attendee" as UserId;
    await addMember(owner.workspaceId, attendeeId);
    const { workOrder } = await seedOpenWorkOrder(owner.service, owner.scope);
    const visit = await owner.service.recordVisitArrival(owner.scope, workOrder.id, {
      userId: attendeeId,
      arrivedAt: ARRIVED,
    });
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
      await owner.service.getVisit({ ...owner.scope, ventureId: otherVenture }, visit.id),
      null,
    );
  });

  it("rejects arrival against closed WorkOrder", async () => {
    const owner = await seed();
    const attendeeId = "user-attendee" as UserId;
    await addMember(owner.workspaceId, attendeeId);
    const { workOrder } = await seedOpenWorkOrder(owner.service, owner.scope);
    await owner.service.closeWorkOrder(owner.scope, workOrder.id);
    await expectCode(
      () =>
        owner.service.recordVisitArrival(owner.scope, workOrder.id, {
          userId: attendeeId,
          arrivedAt: ARRIVED,
        }),
      "invalid_status",
    );
  });

  it("rejects arrival against cancelled WorkOrder", async () => {
    const owner = await seed();
    const attendeeId = "user-attendee" as UserId;
    await addMember(owner.workspaceId, attendeeId);
    const { workOrder } = await seedOpenWorkOrder(owner.service, owner.scope);
    await owner.service.cancelWorkOrder(owner.scope, workOrder.id);
    await expectCode(
      () =>
        owner.service.recordVisitArrival(owner.scope, workOrder.id, {
          userId: attendeeId,
          arrivedAt: ARRIVED,
        }),
      "invalid_status",
    );
  });

  it("does not change WorkOrder status on arrival", async () => {
    const owner = await seed();
    const attendeeId = "user-attendee" as UserId;
    await addMember(owner.workspaceId, attendeeId);
    const { workOrder } = await seedOpenWorkOrder(owner.service, owner.scope);
    await owner.service.recordVisitArrival(owner.scope, workOrder.id, {
      userId: attendeeId,
      arrivedAt: ARRIVED,
    });
    const loaded = await owner.service.getWorkOrder(owner.scope, workOrder.id);
    assert.equal(loaded?.status, "open");
    assertNoDispatchOrExecutionFields(loaded!);
  });

  it("does not change WorkOrder assignment on arrival", async () => {
    const owner = await seed();
    const assigneeId = "user-assignee" as UserId;
    const attendeeId = "user-attendee" as UserId;
    await addMember(owner.workspaceId, assigneeId);
    await addMember(owner.workspaceId, attendeeId);
    const { workOrder } = await seedOpenWorkOrder(owner.service, owner.scope);
    await owner.service.assignWorkOrder(owner.scope, workOrder.id, { userId: assigneeId });
    await owner.service.recordVisitArrival(owner.scope, workOrder.id, {
      userId: attendeeId,
      arrivedAt: ARRIVED,
    });
    const loaded = await owner.service.getWorkOrder(owner.scope, workOrder.id);
    assert.equal(loaded?.assignedUserId, assigneeId);
  });

  it("allows attendingUserId to differ from assignedUserId", async () => {
    const owner = await seed();
    const assigneeId = "user-assignee" as UserId;
    const attendeeId = "user-attendee" as UserId;
    await addMember(owner.workspaceId, assigneeId);
    await addMember(owner.workspaceId, attendeeId);
    const { workOrder } = await seedOpenWorkOrder(owner.service, owner.scope);
    await owner.service.assignWorkOrder(owner.scope, workOrder.id, { userId: assigneeId });
    const visit = await owner.service.recordVisitArrival(owner.scope, workOrder.id, {
      userId: attendeeId,
      arrivedAt: ARRIVED,
    });
    assert.equal(visit.attendingUserId, attendeeId);
    assert.notEqual(visit.attendingUserId, assigneeId);
  });

  it("allows open Visit to depart after parent WorkOrder closes", async () => {
    const owner = await seed();
    const attendeeId = "user-attendee" as UserId;
    await addMember(owner.workspaceId, attendeeId);
    const { workOrder } = await seedOpenWorkOrder(owner.service, owner.scope);
    const visit = await owner.service.recordVisitArrival(owner.scope, workOrder.id, {
      userId: attendeeId,
      arrivedAt: ARRIVED,
    });
    await owner.service.closeWorkOrder(owner.scope, workOrder.id);
    const departed = await owner.service.recordVisitDeparture(owner.scope, visit.id, {
      departedAt: DEPARTED,
    });
    assert.equal(departed.status, "departed");
    assert.equal(departed.departedAt, DEPARTED);
  });

  it("allows open Visit to depart after parent WorkOrder cancels", async () => {
    const owner = await seed();
    const attendeeId = "user-attendee" as UserId;
    await addMember(owner.workspaceId, attendeeId);
    const { workOrder } = await seedOpenWorkOrder(owner.service, owner.scope);
    const visit = await owner.service.recordVisitArrival(owner.scope, workOrder.id, {
      userId: attendeeId,
      arrivedAt: ARRIVED,
    });
    await owner.service.cancelWorkOrder(owner.scope, workOrder.id);
    const departed = await owner.service.recordVisitDeparture(owner.scope, visit.id, {
      departedAt: DEPARTED,
    });
    assert.equal(departed.status, "departed");
  });

  it("preserves Visit records after WorkOrder close", async () => {
    const owner = await seed();
    const attendeeId = "user-attendee" as UserId;
    await addMember(owner.workspaceId, attendeeId);
    const { workOrder } = await seedOpenWorkOrder(owner.service, owner.scope);
    const visit = await owner.service.recordVisitArrival(owner.scope, workOrder.id, {
      userId: attendeeId,
      arrivedAt: ARRIVED,
    });
    await owner.service.closeWorkOrder(owner.scope, workOrder.id);
    const loaded = await owner.service.getVisit(owner.scope, visit.id);
    assert.equal(loaded?.id, visit.id);
    assert.equal(loaded?.arrivedAt, ARRIVED);
  });

  it("preserves Visit records after WorkOrder cancel", async () => {
    const owner = await seed();
    const attendeeId = "user-attendee" as UserId;
    await addMember(owner.workspaceId, attendeeId);
    const { workOrder } = await seedOpenWorkOrder(owner.service, owner.scope);
    const visit = await owner.service.recordVisitArrival(owner.scope, workOrder.id, {
      userId: attendeeId,
      arrivedAt: ARRIVED,
    });
    await owner.service.cancelWorkOrder(owner.scope, workOrder.id);
    const loaded = await owner.service.getVisit(owner.scope, visit.id);
    assert.equal(loaded?.id, visit.id);
  });

  it("supports persisted Frigora 0.4.0 instance", async () => {
    const owner = await seed({ definitionVersion: "0.4.0" });
    const attendeeId = "user-attendee" as UserId;
    await addMember(owner.workspaceId, attendeeId);
    const { workOrder } = await seedOpenWorkOrder(owner.service, owner.scope);
    const visit = await owner.service.recordVisitArrival(owner.scope, workOrder.id, {
      userId: attendeeId,
      arrivedAt: ARRIVED,
    });
    assert.equal(visit.status, "open");
  });

  it("resolves frigora@0.10.0 from catalog", () => {
    assert.equal(platformVentureRegistry.resolve("frigora").version, "0.16.0");
    assert.match(
      platformVentureRegistry.resolve("frigora").description,
      /Visit attendance identity/,
    );
  });
});
