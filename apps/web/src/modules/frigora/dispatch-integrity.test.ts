import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  createClient,
  type InStatement,
  type TransactionMode,
} from "@libsql/client";
import type { Role, UserId, VentureId, WorkspaceId } from "@/contracts";
import { platformVentureRegistry } from "@/core/venture-definition/catalog";
import { createPermissionService } from "@/platform/permissions/service";
import { createDbMembershipStore } from "@/platform/permissions/membership-store";
import {
  ensureSchema,
  getClient,
  getDatabaseUrl,
} from "@/platform/persistence/db";
import {
  getPersistence,
  resetPersistenceLifecycle,
} from "@/platform/persistence/repositories";
import type { PersistedVenture } from "@/platform/persistence/repositories/ports";
import { FrigoraError, FRIGORA_DISPATCH_CONFLICT_MESSAGE } from "./errors";
import { createFrigoraService } from "./service";
import { createFrigoraStore } from "./store";
import { closeFrigoraPersistenceAfterFile } from "./test-persistence-lifecycle";
import type { FrigoraScope, FrigoraWorkOrder } from "./types";
import { FRIGORA_OFFLINE_CAPTURE_OPERATION_ALLOWLIST } from "./app/offline/capture-gate";
import { FRIGORA_OFFLINE_DB_VERSION } from "./app/offline/types";

const NOW = "2026-08-28T00:00:00.000Z";
const here = fileURLToPath(new URL(".", import.meta.url));

closeFrigoraPersistenceAfterFile();

beforeEach(async () => {
  await resetPersistenceLifecycle();
  await ensureSchema();
});

async function seed(
  options: {
    workspaceId?: WorkspaceId;
    ventureId?: VentureId;
    userId?: UserId;
    role?: Role;
  } = {},
) {
  await resetPersistenceLifecycle();
  await ensureSchema();
  const workspaceId = (options.workspaceId ?? "ws-frigora") as WorkspaceId;
  const ventureId = (options.ventureId ?? "ven-frigora") as VentureId;
  const userId = (options.userId ?? "user-owner") as UserId;
  const store = getPersistence();
  await store.organisations.insert({
    id: workspaceId,
    name: "Frigora Workspace",
    slug: `ws-${workspaceId}`,
    createdAt: NOW,
  });
  await store.memberships.setRole({
    userId,
    workspaceId,
    role: options.role ?? "owner",
    createdAt: NOW,
  });
  await store.ventures.insert({
    id: ventureId,
    workspaceId,
    name: "Frigora One",
    slug: `venture-${ventureId}`,
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
    definitionVersion: "0.22.0",
    lifecycle: "operating",
    createdAt: NOW,
    updatedAt: NOW,
  } satisfies PersistedVenture);
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

async function ensureMember(workspaceId: WorkspaceId, userId: UserId) {
  await getPersistence().memberships.setRole({
    userId,
    workspaceId,
    role: "member",
    createdAt: NOW,
  });
}

async function createOpenWorkOrder(
  scope: FrigoraScope,
  service: ReturnType<typeof createFrigoraService>,
) {
  const customer = await service.createCustomer(scope, {
    code: `C-${Math.random().toString(36).slice(2, 8)}`,
    displayName: "Customer",
  });
  const site = await service.createSite(scope, {
    customerId: customer.id,
    code: `S-${Math.random().toString(36).slice(2, 8)}`,
    name: "Site",
    addressLine1: "1 Cold Road",
    city: "Cape Town",
    country: "ZA",
  });
  return service.createWorkOrder(scope, {
    siteId: site.id,
    workReference: `WO-${Math.random().toString(36).slice(2, 10)}`,
    workKind: "reactive",
    reportedCondition: "Warm cabinet",
  });
}

describe("F34-01 dispatch integrity", () => {
  for (const failure of ["IGNORE", "ABORT, 'forced dispatch update failure'"]) {
    it(`owned transaction rolls back inserted event when UPDATE raises ${failure}`, async () => {
      const { scope, service, workspaceId } = await seed();
      const engineer = "user-engineer" as UserId;
      await ensureMember(workspaceId, engineer);
      const wo = await createOpenWorkOrder(scope, service);
      await getClient().execute(
        `CREATE TRIGGER reject_dispatch_update BEFORE UPDATE ON frigora_work_orders BEGIN SELECT RAISE(${failure}); END`,
      );
      await assert.rejects(
        service.assignWorkOrder(scope, wo.id, {
          userId: engineer,
          expectedUpdatedAt: wo.updatedAt,
        }),
      );
      const observer = createClient({ url: getDatabaseUrl() });
      try {
        const row = (
          await observer.execute({
            sql: "SELECT assigned_user_id, updated_at FROM frigora_work_orders WHERE id = ?",
            args: [wo.id],
          })
        ).rows[0];
        assert.ok(row);
        assert.equal(row.assigned_user_id, null);
        assert.equal(row.updated_at, wo.updatedAt);
        assert.equal(
          (await observer.execute("SELECT id FROM frigora_dispatch_events"))
            .rows.length,
          0,
        );
      } finally {
        observer.close();
      }
    });
  }

  it("overlapping dispatchers read the same state but only one transition commits", async () => {
    const { scope, service, workspaceId } = await seed();
    const a = "user-a" as UserId;
    const b = "user-b" as UserId;
    await ensureMember(workspaceId, a);
    await ensureMember(workspaceId, b);
    const wo = await createOpenWorkOrder(scope, service);
    const store = createFrigoraStore();
    const apply = store.applyGuardedDispatchMutation.bind(store);
    let ready!: () => void;
    const read = new Promise<void>((resolve) => {
      ready = resolve;
    });
    let resume!: () => void;
    const released = new Promise<void>((resolve) => {
      resume = resolve;
    });
    store.applyGuardedDispatchMutation = async (input) => {
      ready();
      await released;
      return apply(input);
    };
    const delayed = createFrigoraService({
      store,
      permissions: createPermissionService(createDbMembershipStore()),
    });
    const loser = delayed.assignWorkOrder(scope, wo.id, {
      userId: b,
      expectedUpdatedAt: wo.updatedAt,
    });
    const rejected = assert.rejects(
      loser,
      (error: unknown) =>
        error instanceof FrigoraError && error.code === "dispatch_conflict",
    );
    await read;
    try {
      await service.assignWorkOrder(scope, wo.id, {
        userId: a,
        expectedUpdatedAt: wo.updatedAt,
      });
    } finally {
      resume();
    }
    await rejected;
    assert.equal((await service.getWorkOrder(scope, wo.id))?.assignedUserId, a);
    assert.equal(
      (
        await createFrigoraStore().listDispatchEventsByWorkOrder(
          scope.workspaceId,
          scope.ventureId,
          wo.id,
        )
      ).length,
      1,
    );
  });

  for (const operation of [
    "assign",
    "clearAssignment",
    "schedule",
    "clearSchedule",
  ] as const) {
    for (const intervening of ["none", "visit", "state"] as const) {
      it(`true no-op ${operation} validates ${intervening} under owned transaction without UPDATE`, async () => {
        const { scope, service, workspaceId } = await seed();
        const engineer = "user-engineer" as UserId;
        await ensureMember(workspaceId, engineer);
        let wo = await createOpenWorkOrder(scope, service);
        if (operation === "assign")
          wo = await service.assignWorkOrder(scope, wo.id, {
            userId: engineer,
            expectedUpdatedAt: wo.updatedAt,
          });
        if (operation === "schedule")
          wo = await service.scheduleWorkOrder(scope, wo.id, {
            scheduledStartAt: "2026-09-01T08:00:00.000Z",
            scheduledEndAt: "2026-09-01T10:00:00.000Z",
            expectedUpdatedAt: wo.updatedAt,
          });
        const store = createFrigoraStore();
        const beforeEvents = await store.listDispatchEventsByWorkOrder(
          scope.workspaceId,
          scope.ventureId,
          wo.id,
        );
        const apply = store.applyGuardedDispatchMutation.bind(store);
        store.applyGuardedDispatchMutation = async (input) => {
          assert.equal(input.next, null);
          if (intervening === "visit")
            await service.recordVisitArrival(scope, wo.id, {
              userId: scope.userId,
              arrivedAt: NOW,
            });
          if (intervening === "state")
            await getClient().execute({
              sql: "UPDATE frigora_work_orders SET scheduled_start_at = ? WHERE id = ?",
              args: ["2026-09-02T08:00:00.000Z", wo.id],
            });
          await getClient().execute(
            "CREATE TRIGGER no_noop_update BEFORE UPDATE ON frigora_work_orders BEGIN SELECT RAISE(ABORT, 'no-op must not UPDATE'); END",
          );
          return apply(input);
        };
        const guarded = createFrigoraService({
          store,
          permissions: createPermissionService(createDbMembershipStore()),
        });
        const input = { expectedUpdatedAt: wo.updatedAt };
        const pending =
          operation === "assign"
            ? guarded.assignWorkOrder(scope, wo.id, {
                ...input,
                userId: engineer,
              })
            : operation === "clearAssignment"
              ? guarded.clearWorkOrderAssignment(scope, wo.id, input)
              : operation === "schedule"
                ? guarded.scheduleWorkOrder(scope, wo.id, {
                    ...input,
                    scheduledStartAt: wo.scheduledStartAt!,
                    scheduledEndAt: wo.scheduledEndAt!,
                  })
                : guarded.clearWorkOrderSchedule(scope, wo.id, input);
        if (intervening === "none") assert.deepEqual(await pending, wo);
        else
          await assert.rejects(
            pending,
            (error: unknown) =>
              error instanceof FrigoraError &&
              (intervening === "visit"
                ? error.code === "invalid_status" &&
                  error.message ===
                    "Dispatch is locked while a visit is in progress."
                : error.code === "dispatch_conflict"),
          );
        assert.equal(
          (await service.getWorkOrder(scope, wo.id))?.updatedAt,
          wo.updatedAt,
        );
        assert.deepEqual(
          await store.listDispatchEventsByWorkOrder(
            scope.workspaceId,
            scope.ventureId,
            wo.id,
          ),
          beforeEvents,
        );
      });
    }
  }

  it("arrival between service read and dispatch transaction blocks the transition", async () => {
    const { scope, service } = await seed();
    const wo = await createOpenWorkOrder(scope, service);
    const store = createFrigoraStore();
    const apply = store.applyGuardedDispatchMutation.bind(store);
    store.applyGuardedDispatchMutation = async (input) => {
      await service.recordVisitArrival(scope, wo.id, {
        userId: scope.userId,
        arrivedAt: NOW,
      });
      return apply(input);
    };
    const guarded = createFrigoraService({
      store,
      permissions: createPermissionService(createDbMembershipStore()),
    });
    await assert.rejects(
      guarded.scheduleWorkOrder(scope, wo.id, {
        expectedUpdatedAt: wo.updatedAt,
        scheduledStartAt: "2026-09-01T08:00:00.000Z",
        scheduledEndAt: "2026-09-01T10:00:00.000Z",
      }),
      (error: unknown) =>
        error instanceof FrigoraError &&
        error.message === "Dispatch is locked while a visit is in progress.",
    );
    assert.deepEqual(await service.getWorkOrder(scope, wo.id), wo);
    assert.equal(
      (
        await store.listDispatchEventsByWorkOrder(
          scope.workspaceId,
          scope.ventureId,
          wo.id,
        )
      ).length,
      0,
    );
  });

  it("dispatch commits before arrival and every later dispatch is locked", async () => {
    const { scope, service } = await seed();
    const wo = await createOpenWorkOrder(scope, service);
    const scheduled = await service.scheduleWorkOrder(scope, wo.id, {
      expectedUpdatedAt: wo.updatedAt,
      scheduledStartAt: "2026-09-01T08:00:00.000Z",
      scheduledEndAt: "2026-09-01T10:00:00.000Z",
    });
    await service.recordVisitArrival(scope, wo.id, {
      userId: scope.userId,
      arrivedAt: NOW,
    });
    await assert.rejects(
      service.clearWorkOrderSchedule(scope, wo.id, {
        expectedUpdatedAt: scheduled.updatedAt,
      }),
      (error: unknown) =>
        error instanceof FrigoraError &&
        error.message === "Dispatch is locked while a visit is in progress.",
    );
    assert.deepEqual(await service.getWorkOrder(scope, wo.id), scheduled);
    assert.equal(
      (
        await createFrigoraStore().listDispatchEventsByWorkOrder(
          scope.workspaceId,
          scope.ventureId,
          wo.id,
        )
      ).length,
      1,
    );
  });

  it("R2. another shared-client batch cannot break dispatch atomicity", async (t) => {
    const { scope, service, workspaceId } = await seed();
    const engineer = "user-engineer" as UserId;
    await ensureMember(workspaceId, engineer);
    const wo = await createOpenWorkOrder(scope, service);
    const client = getClient();
    const execute = client.execute.bind(client);
    let interleaved = false;
    let batchError = "";
    // Pause at a real statement boundary, after the event INSERT has executed.
    // The competing batch uses the same public API as offline receipt writes.
    const intercept =
      (executeStatement: typeof execute) => async (statement: InStatement) => {
        const result = await executeStatement(statement);
        const sql = typeof statement === "string" ? statement : statement.sql;
        if (!interleaved && /INSERT INTO frigora_dispatch_events/.test(sql)) {
          interleaved = true;
          try {
            await client.batch(["SELECT 1"], "write");
          } catch (error) {
            batchError = String(error);
          }
        }
        return result;
      };
    const interception = t.mock.method(client, "execute", intercept(execute));
    const begin = client.transaction.bind(client);
    const transactionInterception = t.mock.method(
      client,
      "transaction",
      async (mode?: TransactionMode) => {
        const transaction = await begin(mode);
        t.mock.method(
          transaction,
          "execute",
          intercept(transaction.execute.bind(transaction)),
        );
        return transaction;
      },
    );
    let dispatchError = "";
    try {
      await service.assignWorkOrder(scope, wo.id, {
        userId: engineer,
        expectedUpdatedAt: wo.updatedAt,
      });
    } catch (error) {
      dispatchError = String(error);
    } finally {
      interception.mock.restore();
      transactionInterception.mock.restore();
    }
    const observer = createClient({ url: getDatabaseUrl() });
    try {
      const row = (
        await observer.execute({
          sql: "SELECT assigned_user_id FROM frigora_work_orders WHERE id = ?",
          args: [wo.id],
        })
      ).rows[0];
      const events = (
        await observer.execute({
          sql: "SELECT id FROM frigora_dispatch_events WHERE work_order_id = ?",
          args: [wo.id],
        })
      ).rows;
      t.diagnostic(
        JSON.stringify({
          interleaved,
          batchError,
          dispatchError,
          assignee: row?.assigned_user_id,
          events: events.length,
        }),
      );
      assert.equal(interleaved, true);
      assert.deepEqual(
        { assignee: row?.assigned_user_id, events: events.length },
        dispatchError
          ? { assignee: null, events: 0 }
          : { assignee: engineer, events: 1 },
        "A failed dispatch must leave no mutation; a successful dispatch must commit its event.",
      );
    } finally {
      observer.close();
    }
  });

  it("A. current assign succeeds with expectedUpdatedAt", async () => {
    const { scope, service, workspaceId } = await seed();
    const engineer = "user-engineer" as UserId;
    await ensureMember(workspaceId, engineer);
    const wo = await createOpenWorkOrder(scope, service);
    const assigned = await service.assignWorkOrder(scope, wo.id, {
      userId: engineer,
      expectedUpdatedAt: wo.updatedAt,
    });
    assert.equal(assigned.assignedUserId, engineer);
    const events = await createFrigoraStore().listDispatchEventsByWorkOrder(
      scope.workspaceId,
      scope.ventureId,
      wo.id,
    );
    assert.equal(events.length, 1);
    assert.equal(events[0]?.eventType, "ASSIGNED");
  });

  it("B. stale assign conflicts with zero event", async () => {
    const { scope, service, workspaceId } = await seed();
    const engineer = "user-engineer" as UserId;
    await ensureMember(workspaceId, engineer);
    const wo = await createOpenWorkOrder(scope, service);
    await assert.rejects(
      () =>
        service.assignWorkOrder(scope, wo.id, {
          userId: engineer,
          expectedUpdatedAt: "1999-01-01T00:00:00.000Z",
        }),
      (error: unknown) =>
        error instanceof FrigoraError &&
        error.code === "dispatch_conflict" &&
        error.message === FRIGORA_DISPATCH_CONFLICT_MESSAGE,
    );
    const fresh = await service.getWorkOrder(scope, wo.id);
    assert.equal(fresh?.assignedUserId, null);
    assert.equal(fresh?.updatedAt, wo.updatedAt);
    const events = await createFrigoraStore().listDispatchEventsByWorkOrder(
      scope.workspaceId,
      scope.ventureId,
      wo.id,
    );
    assert.equal(events.length, 0);
  });

  it("C/D. schedule success and stale schedule conflict", async () => {
    const { scope, service } = await seed();
    const wo = await createOpenWorkOrder(scope, service);
    const scheduled = await service.scheduleWorkOrder(scope, wo.id, {
      scheduledStartAt: "2026-09-01T08:00:00.000Z",
      scheduledEndAt: "2026-09-01T10:00:00.000Z",
      expectedUpdatedAt: wo.updatedAt,
    });
    assert.equal(scheduled.scheduledStartAt, "2026-09-01T08:00:00.000Z");
    await assert.rejects(
      () =>
        service.scheduleWorkOrder(scope, scheduled.id, {
          scheduledStartAt: "2026-09-02T08:00:00.000Z",
          scheduledEndAt: "2026-09-02T10:00:00.000Z",
          expectedUpdatedAt: wo.updatedAt,
        }),
      (error: unknown) =>
        error instanceof FrigoraError && error.code === "dispatch_conflict",
    );
    const events = await createFrigoraStore().listDispatchEventsByWorkOrder(
      scope.workspaceId,
      scope.ventureId,
      wo.id,
    );
    assert.equal(events.length, 1);
    assert.equal(events[0]?.eventType, "SCHEDULED");
  });

  it("E. two-dispatcher race: second loses", async () => {
    const { scope, service, workspaceId } = await seed();
    const a = "user-a" as UserId;
    const b = "user-b" as UserId;
    await ensureMember(workspaceId, a);
    await ensureMember(workspaceId, b);
    const wo = await createOpenWorkOrder(scope, service);
    const first = await service.assignWorkOrder(scope, wo.id, {
      userId: a,
      expectedUpdatedAt: wo.updatedAt,
    });
    await assert.rejects(
      () =>
        service.assignWorkOrder(scope, wo.id, {
          userId: b,
          expectedUpdatedAt: wo.updatedAt,
        }),
      (error: unknown) =>
        error instanceof FrigoraError && error.code === "dispatch_conflict",
    );
    const fresh = await service.getWorkOrder(scope, wo.id);
    assert.equal(fresh?.assignedUserId, a);
    assert.equal(fresh?.updatedAt, first.updatedAt);
  });

  it("F. same-millisecond stale-state race without timestamp turnover", async () => {
    const { scope, service, workspaceId } = await seed();
    const a = "user-a" as UserId;
    const b = "user-b" as UserId;
    await ensureMember(workspaceId, a);
    await ensureMember(workspaceId, b);
    const wo = await createOpenWorkOrder(scope, service);
    const token = wo.updatedAt;
    const store = createFrigoraStore();
    const apply = store.applyGuardedDispatchMutation.bind(store);
    store.applyGuardedDispatchMutation = async (input) => {
      // Intervene AFTER the service read and BEFORE the owned transaction.
      await getClient().execute({
        sql: `UPDATE frigora_work_orders SET assigned_user_id = ?, updated_at = ? WHERE id = ?`,
        args: [a, token, wo.id],
      });
      return apply(input);
    };
    const racingService = createFrigoraService({
      store,
      permissions: createPermissionService(createDbMembershipStore()),
    });
    await assert.rejects(
      () =>
        racingService.assignWorkOrder(scope, wo.id, {
          userId: b,
          expectedUpdatedAt: token,
        }),
      (error: unknown) =>
        error instanceof FrigoraError && error.code === "dispatch_conflict",
    );
    const fresh = await service.getWorkOrder(scope, wo.id);
    assert.equal(fresh?.assignedUserId, a);
    assert.equal(fresh?.updatedAt, token);
    const events = await createFrigoraStore().listDispatchEventsByWorkOrder(
      scope.workspaceId,
      scope.ventureId,
      wo.id,
    );
    assert.equal(events.length, 0);
  });

  it("G-M. event classifications and previous/next values", async () => {
    const { scope, service, workspaceId } = await seed();
    const a = "user-a" as UserId;
    const b = "user-b" as UserId;
    await ensureMember(workspaceId, a);
    await ensureMember(workspaceId, b);
    let wo = await createOpenWorkOrder(scope, service);
    wo = await service.assignWorkOrder(scope, wo.id, {
      userId: a,
      expectedUpdatedAt: wo.updatedAt,
    });
    wo = await service.assignWorkOrder(scope, wo.id, {
      userId: b,
      expectedUpdatedAt: wo.updatedAt,
    });
    wo = await service.clearWorkOrderAssignment(scope, wo.id, {
      expectedUpdatedAt: wo.updatedAt,
    });
    wo = await service.scheduleWorkOrder(scope, wo.id, {
      scheduledStartAt: "2026-09-01T08:00:00.000Z",
      scheduledEndAt: "2026-09-01T10:00:00.000Z",
      expectedUpdatedAt: wo.updatedAt,
    });
    wo = await service.scheduleWorkOrder(scope, wo.id, {
      scheduledStartAt: "2026-09-01T11:00:00.000Z",
      scheduledEndAt: "2026-09-01T13:00:00.000Z",
      expectedUpdatedAt: wo.updatedAt,
    });
    wo = await service.clearWorkOrderSchedule(scope, wo.id, {
      expectedUpdatedAt: wo.updatedAt,
    });
    const events = await createFrigoraStore().listDispatchEventsByWorkOrder(
      scope.workspaceId,
      scope.ventureId,
      wo.id,
    );
    assert.deepEqual(
      events.map((event) => event.eventType),
      [
        "ASSIGNED",
        "REASSIGNED",
        "UNASSIGNED",
        "SCHEDULED",
        "RESCHEDULED",
        "SCHEDULE_CLEARED",
      ],
    );
    assert.equal(events[0]?.previousAssignedUserId, null);
    assert.equal(events[0]?.nextAssignedUserId, a);
    assert.equal(events[1]?.previousAssignedUserId, a);
    assert.equal(events[1]?.nextAssignedUserId, b);
    assert.equal(events[2]?.previousAssignedUserId, b);
    assert.equal(events[2]?.nextAssignedUserId, null);
    assert.equal(events[3]?.previousScheduledStartAt, null);
    assert.equal(events[3]?.nextScheduledStartAt, "2026-09-01T08:00:00.000Z");
    assert.equal(
      events[4]?.previousScheduledStartAt,
      "2026-09-01T08:00:00.000Z",
    );
    assert.equal(events[4]?.nextScheduledStartAt, "2026-09-01T11:00:00.000Z");
    assert.equal(events[5]?.previousScheduledEndAt, "2026-09-01T13:00:00.000Z");
    assert.equal(events[5]?.nextScheduledEndAt, null);
  });

  it("1-6. no-op and metadata-only stamp clears emit zero events", async () => {
    const { scope, service, workspaceId } = await seed();
    const engineer = "user-engineer" as UserId;
    await ensureMember(workspaceId, engineer);
    let wo = await createOpenWorkOrder(scope, service);
    wo = await service.assignWorkOrder(scope, wo.id, {
      userId: engineer,
      expectedUpdatedAt: wo.updatedAt,
    });
    wo = await service.scheduleWorkOrder(scope, wo.id, {
      scheduledStartAt: "2026-09-01T08:00:00.000Z",
      scheduledEndAt: "2026-09-01T10:00:00.000Z",
      expectedUpdatedAt: wo.updatedAt,
    });
    wo = await service.acceptWorkOrderAssignment(
      { ...scope, userId: engineer },
      wo.id,
    );

    const sameAssignee = await service.assignWorkOrder(scope, wo.id, {
      userId: engineer,
      expectedUpdatedAt: wo.updatedAt,
    });
    assert.equal(sameAssignee.assignmentAcceptedAt, null);
    assert.notEqual(sameAssignee.updatedAt, wo.updatedAt);

    const identicalAgain = await service.assignWorkOrder(
      scope,
      sameAssignee.id,
      {
        userId: engineer,
        expectedUpdatedAt: sameAssignee.updatedAt,
      },
    );
    assert.equal(identicalAgain.updatedAt, sameAssignee.updatedAt);

    let scheduled = await service.scheduleWorkOrder(scope, identicalAgain.id, {
      scheduledStartAt: "2026-09-01T08:00:00.000Z",
      scheduledEndAt: "2026-09-01T10:00:00.000Z",
      expectedUpdatedAt: identicalAgain.updatedAt,
    });
    scheduled = await service.acceptWorkOrderAssignment(
      { ...scope, userId: engineer },
      scheduled.id,
    );
    const sameWindow = await service.scheduleWorkOrder(scope, scheduled.id, {
      scheduledStartAt: "2026-09-01T08:00:00.000Z",
      scheduledEndAt: "2026-09-01T10:00:00.000Z",
      expectedUpdatedAt: scheduled.updatedAt,
    });
    assert.equal(sameWindow.assignmentAcceptedAt, null);

    let cleared = await service.clearWorkOrderAssignment(scope, sameWindow.id, {
      expectedUpdatedAt: sameWindow.updatedAt,
    });
    cleared = await service.assignWorkOrder(scope, cleared.id, {
      userId: engineer,
      expectedUpdatedAt: cleared.updatedAt,
    });
    cleared = await service.acceptWorkOrderAssignment(
      { ...scope, userId: engineer },
      cleared.id,
    );
    await getClient().execute({
      sql: `UPDATE frigora_work_orders SET assigned_user_id = NULL WHERE id = ?`,
      args: [cleared.id],
    });
    const afterRaw = await service.getWorkOrder(scope, cleared.id);
    assert.ok(afterRaw);
    const stampOnly = await service.clearWorkOrderAssignment(
      scope,
      afterRaw!.id,
      {
        expectedUpdatedAt: afterRaw!.updatedAt,
      },
    );
    assert.equal(stampOnly.assignedUserId, null);
    assert.equal(stampOnly.assignmentAcceptedAt, null);

    const events = await createFrigoraStore().listDispatchEventsByWorkOrder(
      scope.workspaceId,
      scope.ventureId,
      wo.id,
    );
    assert.deepEqual(
      events.map((event) => event.eventType),
      ["ASSIGNED", "SCHEDULED", "UNASSIGNED", "ASSIGNED"],
    );
  });

  it("P. invalid event_type rejected by DB CHECK", async () => {
    await ensureSchema();
    await assert.rejects(
      () =>
        getClient().execute({
          sql: `INSERT INTO frigora_dispatch_events (
            id, workspace_id, venture_id, work_order_id, event_type, actor_user_id, occurred_at,
            previous_assigned_user_id, next_assigned_user_id,
            previous_scheduled_start_at, previous_scheduled_end_at,
            next_scheduled_start_at, next_scheduled_end_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, NULL, NULL, NULL, NULL, NULL, NULL)`,
          args: [
            "evt-invalid",
            "ws",
            "ven",
            "wo",
            "INVALID_EVENT",
            "user",
            "2026-09-01T00:00:00.000Z",
          ],
        }),
      (error: unknown) => /CHECK|constraint/i.test(String(error)),
    );
  });

  it("Q/R. open Visit blocks assignment and scheduling", async () => {
    const { scope, service, workspaceId, userId } = await seed();
    const engineer = "user-engineer" as UserId;
    await ensureMember(workspaceId, engineer);
    let wo = await createOpenWorkOrder(scope, service);
    wo = await service.assignWorkOrder(scope, wo.id, {
      userId: engineer,
      expectedUpdatedAt: wo.updatedAt,
    });
    await service.recordVisitArrival({ ...scope, userId: engineer }, wo.id, {
      userId: engineer,
      arrivedAt: "2026-09-01T09:00:00.000Z",
    });
    await assert.rejects(
      () =>
        service.assignWorkOrder(scope, wo.id, {
          userId,
          expectedUpdatedAt: wo.updatedAt,
        }),
      (error: unknown) =>
        error instanceof FrigoraError &&
        error.code === "invalid_status" &&
        error.message === "Dispatch is locked while a visit is in progress.",
    );
    await assert.rejects(
      () =>
        service.scheduleWorkOrder(scope, wo.id, {
          scheduledStartAt: "2026-09-01T10:00:00.000Z",
          scheduledEndAt: "2026-09-01T12:00:00.000Z",
          expectedUpdatedAt: wo.updatedAt,
        }),
      (error: unknown) =>
        error instanceof FrigoraError && error.code === "invalid_status",
    );
    const events = await createFrigoraStore().listDispatchEventsByWorkOrder(
      scope.workspaceId,
      scope.ventureId,
      wo.id,
    );
    assert.equal(events.length, 1);
  });

  it("S. arrival/dispatch race: arrival first blocks dispatch", async () => {
    const { scope, service, workspaceId } = await seed();
    const engineer = "user-engineer" as UserId;
    await ensureMember(workspaceId, engineer);
    const wo = await createOpenWorkOrder(scope, service);
    await service.recordVisitArrival(scope, wo.id, {
      userId: scope.userId,
      arrivedAt: "2026-09-01T09:00:00.000Z",
    });
    await assert.rejects(
      () =>
        service.assignWorkOrder(scope, wo.id, {
          userId: engineer,
          expectedUpdatedAt: wo.updatedAt,
        }),
      (error: unknown) =>
        error instanceof FrigoraError && error.code === "invalid_status",
    );
  });

  it("V-Z. product/schema/offline/SW boundary", async () => {
    assert.equal(platformVentureRegistry.resolve("frigora").version, "0.22.0");
    const dbSource = readFileSync(
      join(here, "../../platform/persistence/db.ts"),
      "utf8",
    );
    assert.match(dbSource, /SCHEMA_GENERATION = 29/);
    assert.equal(FRIGORA_OFFLINE_DB_VERSION, 1);
    assert.deepEqual(
      [...FRIGORA_OFFLINE_CAPTURE_OPERATION_ALLOWLIST],
      ["recordTechnicalFinding", "recordFieldCapture", "recordVisitEvidence"],
    );
    const sw = readFileSync(join(here, "../../../public/sw.js"), "utf8");
    assert.doesNotMatch(
      sw,
      /dispatch|scheduleWorkOrder|assignWorkOrder|frigora_dispatch_events/,
    );
  });

  it("O. event insert without successful update cannot leave orphan", async () => {
    const store = createFrigoraStore();
    const { scope, service, workspaceId } = await seed();
    const engineer = "user-engineer" as UserId;
    await ensureMember(workspaceId, engineer);
    const wo = await createOpenWorkOrder(scope, service);
    const next: FrigoraWorkOrder = {
      ...wo,
      assignedUserId: engineer,
      updatedAt: "2026-09-01T12:00:00.000Z",
    };
    await assert.rejects(
      () =>
        store.applyGuardedDispatchMutation({
          expected: { ...wo, updatedAt: "stale-token" },
          next,
          event: {
            id: "evt-orphan-test" as never,
            workspaceId: wo.workspaceId,
            ventureId: wo.ventureId,
            workOrderId: wo.id,
            eventType: "ASSIGNED",
            actorUserId: scope.userId,
            occurredAt: "2026-09-01T12:00:00.000Z",
            previousAssignedUserId: null,
            nextAssignedUserId: engineer,
            previousScheduledStartAt: null,
            previousScheduledEndAt: null,
            nextScheduledStartAt: null,
            nextScheduledEndAt: null,
          },
        }),
      (error: unknown) =>
        error instanceof FrigoraError && error.code === "dispatch_conflict",
    );
    const events = await store.listDispatchEventsByWorkOrder(
      scope.workspaceId,
      scope.ventureId,
      wo.id,
    );
    assert.equal(events.length, 0);
    const fresh = await service.getWorkOrder(scope, wo.id);
    assert.equal(fresh?.assignedUserId, null);
  });
});
