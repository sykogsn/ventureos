import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import type { Role, UserId, VentureId, WorkspaceId } from "@/contracts";
import { createPermissionService } from "@/platform/permissions/service";
import { createDbMembershipStore } from "@/platform/permissions/membership-store";
import { ensureSchema, getClient } from "@/platform/persistence/db";
import { getPersistence, resetPersistenceLifecycle } from "@/platform/persistence/repositories";
import type { PersistedVenture } from "@/platform/persistence/repositories/ports";
import { FrigoraError } from "./errors";
import { createFrigoraService } from "./service";
import { createFrigoraStore } from "./store";
import { closeFrigoraPersistenceAfterFile } from "./test-persistence-lifecycle";
import type { FrigoraScope, FrigoraWorkOrder } from "./types";

const NOW = "2026-09-07T12:00:00.000Z";

closeFrigoraPersistenceAfterFile();

beforeEach(async () => {
  await resetPersistenceLifecycle();
  await ensureSchema();
});

function ventureRow(
  workspaceId: WorkspaceId,
  ventureId: VentureId,
  definitionVersion = "0.17.0",
): PersistedVenture {
  return {
    id: ventureId,
    workspaceId,
    name: "Frigora",
    slug: `frigora-${ventureId}`,
    stage: "Operating",
    href: "/ventures/hq/frigora",
    foundedAt: NOW,
    category: "Operations",
    owner: "Founder",
    hqSummary: "Open.",
    genome: {
      thesis: "Keep the cold chain honest.",
      category: "Operations",
      stage: "Operating",
      goal: "Dispatch field work.",
      posture: "human-led",
      risk: "focused",
      motion: "Serve refrigeration sites.",
      cadence: "Daily",
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
    definitionVersion,
    lifecycle: "operating",
    createdAt: NOW,
    updatedAt: NOW,
  };
}

async function seed(options: {
  workspaceId?: WorkspaceId;
  ventureId?: VentureId;
  ownerId?: UserId;
  assigneeId?: UserId;
  definitionVersion?: string;
} = {}) {
  const workspaceId = options.workspaceId ?? ("ws-frigora" as WorkspaceId);
  const ventureId = options.ventureId ?? ("ven-frigora" as VentureId);
  const ownerId = options.ownerId ?? ("user-owner" as UserId);
  const assigneeId = options.assigneeId ?? ("user-assignee" as UserId);
  const persistence = getPersistence();
  await persistence.organisations.insert({
    id: workspaceId,
    name: "Frigora Workspace",
    slug: `workspace-${workspaceId}`,
    createdAt: NOW,
  });
  for (const [userId, role] of [
    [ownerId, "owner"],
    [assigneeId, "member"],
  ] as const satisfies readonly (readonly [UserId, Role])[]) {
    await persistence.memberships.insert({ workspaceId, userId, role, createdAt: NOW });
  }
  await persistence.ventures.insert(
    ventureRow(workspaceId, ventureId, options.definitionVersion),
  );
  const service = createFrigoraService({
    permissions: createPermissionService(createDbMembershipStore()),
  });
  const ownerScope = { workspaceId, ventureId, userId: ownerId } satisfies FrigoraScope;
  const assigneeScope = { ...ownerScope, userId: assigneeId } satisfies FrigoraScope;
  const customer = await service.createCustomer(ownerScope, {
    code: "FUELCO",
    displayName: "FuelCo",
  });
  const site = await service.createSite(ownerScope, {
    customerId: customer.id,
    code: "SANDTON-N",
    name: "Sandton North",
  });
  const workOrder = await service.createWorkOrder(ownerScope, {
    siteId: site.id,
    workReference: `WO-${ventureId}`,
    workKind: "reactive",
  });
  return { service, ownerScope, assigneeScope, assigneeId, workOrder };
}

async function expectCode(run: () => Promise<unknown>, code: FrigoraError["code"]) {
  await assert.rejects(run, (error: unknown) => {
    assert.ok(error instanceof FrigoraError, String(error));
    assert.equal(error.code, code, error.message);
    return true;
  });
}

function activeWindow() {
  const now = Date.now();
  return {
    scheduledStartAt: new Date(now - 60_000).toISOString(),
    scheduledEndAt: new Date(now + 60_000).toISOString(),
  };
}

async function scheduledAndAssigned(
  seeded: Awaited<ReturnType<typeof seed>>,
): Promise<FrigoraWorkOrder> {
  const scheduled = await seeded.service.scheduleWorkOrder(
    seeded.ownerScope,
    seeded.workOrder.id,
    { ...activeWindow(), expectedUpdatedAt: seeded.workOrder.updatedAt },
  );
  return seeded.service.assignWorkOrder(seeded.ownerScope, scheduled.id, { expectedUpdatedAt: scheduled.updatedAt,
    userId: seeded.assigneeId,
  });
}

describe("Frigora F2.2 dispatch domain", () => {
  it("schedules, reschedules, and clears an open WorkOrder", async () => {
    const seeded = await seed();
    const first = await seeded.service.scheduleWorkOrder(seeded.ownerScope, seeded.workOrder.id, { expectedUpdatedAt: seeded.workOrder.updatedAt,
      scheduledStartAt: "2026-09-08T08:00:00.000Z",
      scheduledEndAt: "2026-09-08T10:00:00.000Z",
    });
    assert.equal(first.scheduledStartAt, "2026-09-08T08:00:00.000Z");
    const rescheduled = await seeded.service.scheduleWorkOrder(
      seeded.ownerScope,
      seeded.workOrder.id,
      { expectedUpdatedAt: first.updatedAt,
        scheduledStartAt: "2026-09-09T09:00:00.000Z",
        scheduledEndAt: "2026-09-09T11:00:00.000Z",
      },
    );
    assert.equal(rescheduled.scheduledEndAt, "2026-09-09T11:00:00.000Z");
    assert.equal(rescheduled.assignmentAcceptedAt, null);
    assert.equal(rescheduled.assignmentDeclinedAt, null);
    assert.equal(rescheduled.assignmentDeclineReason, null);
    const cleared = await seeded.service.clearWorkOrderSchedule(
      seeded.ownerScope,
      seeded.workOrder.id, { expectedUpdatedAt: rescheduled.updatedAt },
    );
    assert.equal(cleared.scheduledStartAt, null);
    assert.equal(cleared.scheduledEndAt, null);
    const canonical = await seeded.service.scheduleWorkOrder(
      seeded.ownerScope,
      seeded.workOrder.id,
      { expectedUpdatedAt: cleared.updatedAt,
        scheduledStartAt: "2026-09-08T10:00:00+02:00",
        scheduledEndAt: "2026-09-08T12:00:00+02:00",
      },
    );
    assert.equal(canonical.scheduledStartAt, "2026-09-08T08:00:00.000Z");
    assert.equal(canonical.scheduledEndAt, "2026-09-08T10:00:00.000Z");
  });

  it("requires two ISO instants with end strictly after start", async () => {
    const seeded = await seed();
    for (const input of [
      { scheduledStartAt: "", scheduledEndAt: "2026-09-08T10:00:00.000Z" },
      {
        scheduledStartAt: "2026-09-08T10:00:00.000Z",
        scheduledEndAt: "2026-09-08T10:00:00.000Z",
      },
      { scheduledStartAt: "not-iso", scheduledEndAt: "also-not-iso" },
      { scheduledStartAt: "2026-09-08", scheduledEndAt: "2026-09-09" },
    ]) {
      await expectCode(
        () => seeded.service.scheduleWorkOrder(seeded.ownerScope, seeded.workOrder.id, { ...input, expectedUpdatedAt: seeded.workOrder.updatedAt }),
        "invalid_input",
      );
    }
  });

  it("allows dispatch mutations only while the WorkOrder is open", async () => {
    const seeded = await seed();
    await seeded.service.scheduleWorkOrder(
      seeded.ownerScope,
      seeded.workOrder.id,
      { ...activeWindow(), expectedUpdatedAt: seeded.workOrder.updatedAt },
    );
    await seeded.service.cancelWorkOrder(seeded.ownerScope, seeded.workOrder.id, {
      reason: "Customer cancelled.",
    });
    await expectCode(
      async () =>
        seeded.service.scheduleWorkOrder(
          seeded.ownerScope,
          seeded.workOrder.id,
          { ...activeWindow(), expectedUpdatedAt: (await seeded.service.getWorkOrder(seeded.ownerScope, seeded.workOrder.id))!.updatedAt },
        ),
      "invalid_status",
    );
    await expectCode(
      async () =>
        seeded.service.clearWorkOrderSchedule(
          seeded.ownerScope,
          seeded.workOrder.id, { expectedUpdatedAt: (await seeded.service.getWorkOrder(seeded.ownerScope, seeded.workOrder.id))!.updatedAt },
        ),
      "invalid_status",
    );
  });

  it("rejects schedule and assignment changes while a Visit is active", async () => {
    const seeded = await seed();
    await seeded.service.recordVisitArrival(seeded.ownerScope, seeded.workOrder.id, {
      userId: seeded.assigneeId,
      arrivedAt: new Date().toISOString(),
    });
    await expectCode(
      () =>
        seeded.service.scheduleWorkOrder(
          seeded.ownerScope,
          seeded.workOrder.id,
          { ...activeWindow(), expectedUpdatedAt: seeded.workOrder.updatedAt },
        ),
      "invalid_status",
    );
    await expectCode(
      () =>
        seeded.service.clearWorkOrderSchedule(
          seeded.ownerScope,
          seeded.workOrder.id, { expectedUpdatedAt: seeded.workOrder.updatedAt },
        ),
      "invalid_status",
    );
    await expectCode(
      () =>
        seeded.service.assignWorkOrder(seeded.ownerScope, seeded.workOrder.id, { expectedUpdatedAt: seeded.workOrder.updatedAt,
          userId: seeded.assigneeId,
        }),
      "invalid_status",
    );
    await expectCode(
      () => seeded.service.clearWorkOrderAssignment(seeded.ownerScope, seeded.workOrder.id, { expectedUpdatedAt: seeded.workOrder.updatedAt }),
      "invalid_status",
    );
  });

  it("accepts the current assignment as the assignee with venture.read only", async () => {
    const seeded = await seed();
    await scheduledAndAssigned(seeded);
    const before = Date.now();
    const accepted = await seeded.service.acceptWorkOrderAssignment(
      seeded.assigneeScope,
      seeded.workOrder.id,
    );
    const after = Date.now();
    assert.ok(accepted.assignmentAcceptedAt);
    assert.ok(Date.parse(accepted.assignmentAcceptedAt) >= before);
    assert.ok(Date.parse(accepted.assignmentAcceptedAt) <= after);
    assert.equal(accepted.assignmentDeclinedAt, null);
    assert.equal(accepted.assignmentDeclineReason, null);
    assert.equal(
      (await seeded.service.listVisitsByWorkOrder(seeded.ownerScope, seeded.workOrder.id)).length,
      0,
    );
    assert.equal(accepted.status, "open");
  });

  it("declines with a trimmed reason and preserves the assignee", async () => {
    const seeded = await seed();
    await scheduledAndAssigned(seeded);
    const declined = await seeded.service.declineWorkOrderAssignment(
      seeded.assigneeScope,
      seeded.workOrder.id,
      { reason: "  unavailable  " },
    );
    assert.ok(declined.assignmentDeclinedAt);
    assert.equal(declined.assignmentDeclineReason, "unavailable");
    assert.equal(declined.assignmentAcceptedAt, null);
    assert.equal(declined.assignedUserId, seeded.assigneeId);
    assert.equal(
      (await seeded.service.listVisitsByWorkOrder(seeded.ownerScope, seeded.workOrder.id)).length,
      0,
    );
  });

  it("rejects responses without a service window, by another user, or twice", async () => {
    const seeded = await seed();
    await seeded.service.assignWorkOrder(seeded.ownerScope, seeded.workOrder.id, { expectedUpdatedAt: seeded.workOrder.updatedAt,
      userId: seeded.assigneeId,
    });
    assert.equal(
      (await seeded.service.getWorkOrder(seeded.ownerScope, seeded.workOrder.id))
        ?.scheduledStartAt,
      null,
    );
    await expectCode(
      () =>
        seeded.service.acceptWorkOrderAssignment(
          seeded.assigneeScope,
          seeded.workOrder.id,
        ),
      "invalid_status",
    );

    await seeded.service.scheduleWorkOrder(seeded.ownerScope, seeded.workOrder.id, { expectedUpdatedAt: (await seeded.service.getWorkOrder(seeded.ownerScope, seeded.workOrder.id))!.updatedAt,
      scheduledStartAt: "2099-01-01T00:00:00.000Z",
      scheduledEndAt: "2099-01-01T01:00:00.000Z",
    });
    await expectCode(
      () =>
        seeded.service.acceptWorkOrderAssignment(seeded.ownerScope, seeded.workOrder.id),
      "forbidden",
    );
    await seeded.service.acceptWorkOrderAssignment(seeded.assigneeScope, seeded.workOrder.id);
    await expectCode(
      () =>
        seeded.service.declineWorkOrderAssignment(
          seeded.assigneeScope,
          seeded.workOrder.id,
          { reason: "No" },
        ),
      "invalid_status",
    );
  });

  it("rejects an empty decline reason", async () => {
    const seeded = await seed();
    await scheduledAndAssigned(seeded);
    await expectCode(
      () =>
        seeded.service.declineWorkOrderAssignment(
          seeded.assigneeScope,
          seeded.workOrder.id,
          { reason: "   " },
        ),
      "invalid_input",
    );
  });

  it("preserves schedule and resets response on reassign and unassign", async () => {
    const seeded = await seed();
    const assigned = await scheduledAndAssigned(seeded);
    const accepted = await seeded.service.acceptWorkOrderAssignment(
      seeded.assigneeScope,
      assigned.id,
    );
    const rescheduled = await seeded.service.scheduleWorkOrder(
      seeded.ownerScope,
      accepted.id,
      { expectedUpdatedAt: accepted.updatedAt,
        scheduledStartAt: "2099-01-01T00:00:00.000Z",
        scheduledEndAt: "2099-01-01T01:00:00.000Z",
      },
    );
    assert.equal(rescheduled.assignmentAcceptedAt, null);
    const acceptedAgain = await seeded.service.acceptWorkOrderAssignment(
      seeded.assigneeScope,
      rescheduled.id,
    );
    const reassigned = await seeded.service.assignWorkOrder(
      seeded.ownerScope,
      acceptedAgain.id,
      { expectedUpdatedAt: acceptedAgain.updatedAt, userId: seeded.assigneeId },
    );
    assert.equal(reassigned.scheduledStartAt, acceptedAgain.scheduledStartAt);
    assert.equal(reassigned.assignmentAcceptedAt, null);
    const cleared = await seeded.service.clearWorkOrderAssignment(
      seeded.ownerScope,
      reassigned.id, { expectedUpdatedAt: reassigned.updatedAt },
    );
    assert.equal(cleared.scheduledEndAt, acceptedAgain.scheduledEndAt);
    assert.equal(cleared.assignmentAcceptedAt, null);
  });

  it("allows dispatch changes after a prior departed Visit", async () => {
    const seeded = await seed();
    await scheduledAndAssigned(seeded);
    const visit = await seeded.service.recordVisitArrival(
      seeded.ownerScope,
      seeded.workOrder.id,
      {
        userId: seeded.assigneeId,
        arrivedAt: "2026-09-07T09:00:00.000Z",
      },
    );
    await seeded.service.recordVisitDeparture(seeded.ownerScope, visit.id, {
      departedAt: "2026-09-07T10:00:00.000Z",
    });
    const rescheduled = await seeded.service.scheduleWorkOrder(
      seeded.ownerScope,
      seeded.workOrder.id,
      { expectedUpdatedAt: (await seeded.service.getWorkOrder(seeded.ownerScope, seeded.workOrder.id))!.updatedAt,
        scheduledStartAt: "2026-09-08T08:00:00.000Z",
        scheduledEndAt: "2026-09-08T10:00:00.000Z",
      },
    );
    assert.equal(rescheduled.scheduledStartAt, "2026-09-08T08:00:00.000Z");
    assert.equal(
      (await seeded.service.clearWorkOrderAssignment(seeded.ownerScope, seeded.workOrder.id, { expectedUpdatedAt: rescheduled.updatedAt }))
        .assignedUserId,
      null,
    );
  });

  it("lists overlapping scheduled WorkOrders in tenant-scoped [start, end) order", async () => {
    const alpha = await seed();
    await alpha.service.scheduleWorkOrder(alpha.ownerScope, alpha.workOrder.id, { expectedUpdatedAt: alpha.workOrder.updatedAt,
      scheduledStartAt: "2026-09-08T09:00:00.000Z",
      scheduledEndAt: "2026-09-08T11:00:00.000Z",
    });
    const beta = await seed({
      workspaceId: "ws-other" as WorkspaceId,
      ventureId: "ven-other" as VentureId,
      ownerId: "owner-other" as UserId,
      assigneeId: "assignee-other" as UserId,
    });
    await beta.service.scheduleWorkOrder(beta.ownerScope, beta.workOrder.id, { expectedUpdatedAt: beta.workOrder.updatedAt,
      scheduledStartAt: "2026-09-08T10:00:00.000Z",
      scheduledEndAt: "2026-09-08T11:00:00.000Z",
    });
    const listed = await alpha.service.listScheduledWorkOrders(alpha.ownerScope, {
      rangeStart: "2026-09-08T10:00:00.000Z",
      rangeEnd: "2026-09-09T00:00:00.000Z",
    });
    assert.deepEqual(listed.map((item) => item.id), [alpha.workOrder.id]);
    assert.deepEqual(
      await alpha.service.listScheduledWorkOrders(alpha.ownerScope, {
        rangeStart: "2026-09-08T11:00:00.000Z",
        rangeEnd: "2026-09-09T00:00:00.000Z",
      }),
      [],
    );
  });

  it("maps Frigora 0.17 WorkOrders to null dispatch fields", async () => {
    await resetPersistenceLifecycle();
    await getClient().execute(`
      CREATE TABLE frigora_work_orders (
        id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL,
        venture_id TEXT NOT NULL,
        customer_id TEXT NOT NULL,
        site_id TEXT NOT NULL,
        primary_asset_id TEXT,
        work_reference TEXT NOT NULL,
        work_kind TEXT NOT NULL,
        reported_condition TEXT,
        status TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        assigned_user_id TEXT,
        cancellation_reason TEXT,
        source_recommended_action_id TEXT
      )
    `);
    await getClient().execute({
      sql: `INSERT INTO frigora_work_orders (
        id, workspace_id, venture_id, customer_id, site_id, work_reference,
        work_kind, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        "wo-legacy",
        "ws-legacy",
        "ven-legacy",
        "customer-legacy",
        "site-legacy",
        "WO-LEGACY",
        "reactive",
        "open",
        NOW,
        NOW,
      ],
    });
    await ensureSchema();
    const loaded = await createFrigoraStore().findWorkOrder(
      "ws-legacy" as WorkspaceId,
      "ven-legacy" as VentureId,
      "wo-legacy" as FrigoraWorkOrder["id"],
    );
    assert.ok(loaded);
    assert.equal(loaded.scheduledStartAt, null);
    assert.equal(loaded.scheduledEndAt, null);
    assert.equal(loaded.assignmentAcceptedAt, null);
    assert.equal(loaded.assignmentDeclinedAt, null);
    assert.equal(loaded.assignmentDeclineReason, null);
  });

  it("does not introduce inferred dispatch or lifecycle fields", async () => {
    const seeded = await seed();
    for (const field of ["dispatchStatus", "assignedEngineerId", "priority", "visitId"]) {
      assert.equal(field in seeded.workOrder, false);
    }
  });
});
