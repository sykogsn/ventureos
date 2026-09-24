import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { createClient, type TransactionMode } from "@libsql/client";
import type { Role, UserId, VentureId, WorkspaceId } from "@/contracts";
import { createPermissionService } from "@/platform/permissions/service";
import { createDbMembershipStore } from "@/platform/permissions/membership-store";
import { ensureSchema, getClient, getDatabaseUrl } from "@/platform/persistence/db";
import { getPersistence, resetPersistenceLifecycle } from "@/platform/persistence/repositories";
import type { PersistedVenture } from "@/platform/persistence/repositories/ports";
import { FrigoraError } from "./errors";
import { createFrigoraService } from "./service";
import { createFrigoraStore } from "./store";
import { createFrigoraWriteClient } from "./owned-write";

import { closeFrigoraPersistenceAfterFile } from "./test-persistence-lifecycle";
import type { FrigoraScope, FrigoraWorkOrder } from "./types";
import { deriveEngineerWorkload } from "./app/engineer-calendar";
import { confirmationHarness } from "./app/dispatch-confirmation.test-support";
const START = "2026-09-23T10:00:00.000Z";
const END = "2026-09-23T11:00:00.000Z";
const ENGINEER = "engineer-f34" as UserId;
const NOW = "2026-08-28T00:00:00.000Z";


closeFrigoraPersistenceAfterFile();

beforeEach(async () => {
  await resetPersistenceLifecycle();
  await ensureSchema();
});

async function seed(
  options: {
    reset?: boolean;
    workspaceId?: WorkspaceId;
    ventureId?: VentureId;
    userId?: UserId;
    role?: Role;
  } = {},
) {
  if (options.reset !== false) {
    await resetPersistenceLifecycle();
    await ensureSchema();
  }
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


const code = (expected: string) => (error: unknown) => error instanceof FrigoraError && error.code === expected;
const unavailable = { userId: ENGINEER, unavailableStartAt: START, unavailableEndAt: END };
const range = { rangeStart: "2026-09-23T00:00:00.000Z", rangeEnd: "2026-09-24T00:00:00.000Z" };

async function setup() {
  const context = await seed();
  await ensureMember(context.workspaceId, ENGINEER);
  const first = await createOpenWorkOrder(context.scope, context.service);
  const second = await createOpenWorkOrder(context.scope, context.service);
  const a = await context.service.assignWorkOrder(context.scope, first.id, { userId: ENGINEER, expectedUpdatedAt: first.updatedAt });
  const b = await context.service.assignWorkOrder(context.scope, second.id, { userId: ENGINEER, expectedUpdatedAt: second.updatedAt });
  return { ...context, a, b };
}

function schedule(service: ReturnType<typeof createFrigoraService>, scope: FrigoraScope, work: FrigoraWorkOrder, confirmed = false) {
  return service.scheduleWorkOrder(scope, work.id, { scheduledStartAt: START, scheduledEndAt: END,
    expectedUpdatedAt: work.updatedAt, confirmDoubleBooking: confirmed });
}

async function durable() {
  const observer = createClient({ url: getDatabaseUrl() });
  try {
    return {
      work: (await observer.execute("SELECT id, assigned_user_id, scheduled_start_at, scheduled_end_at, updated_at FROM frigora_work_orders ORDER BY id")).rows,
      history: (await observer.execute("SELECT * FROM frigora_dispatch_events ORDER BY id")).rows,
      visits: (await observer.execute("SELECT * FROM frigora_visits ORDER BY id")).rows,
      periods: (await observer.execute("SELECT * FROM frigora_engineer_unavailability ORDER BY id")).rows,
    };
  } finally { observer.close(); }
}

/** Pause only after SQLite has granted the owned write lock; no sleeps or process mutex. */
async function holdFirstWriter(run: (service: ReturnType<typeof createFrigoraService>) => Promise<unknown>) {
  let entered!: () => void;
  let release!: () => void;
  const acquired = new Promise<void>((resolve) => { entered = resolve; });
  const released = new Promise<void>((resolve) => { release = resolve; });
  let first = true;
  const store = createFrigoraStore({ createWriteClient: () => {
    const client = createFrigoraWriteClient();
    const original = client.transaction.bind(client);
    client.transaction = async function(mode?: TransactionMode) {
      const tx = await original(mode);
      if (first) { first = false; entered(); await released; }
      return tx;
    };
    return client;
  } });
  const service = createFrigoraService({ store, permissions: createPermissionService(createDbMembershipStore()) });
  const result = run(service);
  await acquired;
  return { result, release };
}

describe("F34-03 availability and dispatch", () => {
  it("creates, reloads, edits and deletes scoped availability with monotonic CAS", async () => {
    const { scope, service } = await setup();
    const created = (await service.createUnavailability(scope, unavailable)).period!;
    assert.equal((await durable()).periods.length, 1);
    await resetPersistenceLifecycle(getDatabaseUrl());
    assert.deepEqual(await service.listUnavailability(scope, range), [created]);
    const updated = (await service.updateUnavailability(scope, created.id, { ...unavailable,
      unavailableEndAt: "2026-09-23T12:00:00.000Z", expectedUpdatedAt: created.updatedAt })).period!;
    assert.ok(updated.updatedAt > created.updatedAt);
    assert.equal(updated.createdAt, created.createdAt);
    await assert.rejects(service.updateUnavailability(scope, created.id, { ...unavailable, expectedUpdatedAt: created.updatedAt }), code("availability_conflict"));
    await assert.rejects(service.deleteUnavailability(scope, created.id, created.updatedAt), code("availability_conflict"));
    await service.deleteUnavailability(scope, updated.id, updated.updatedAt);
    assert.equal((await durable()).periods.length, 0);
  });

  it("rejects invalid intervals in service and database; enforces authority and scope", async () => {
    const { scope, service } = await setup();
    await assert.rejects(service.createUnavailability(scope, { ...unavailable, unavailableEndAt: START }), code("invalid_input"));
    const member = { ...scope, userId: ENGINEER };
    await assert.rejects(service.createUnavailability(member, unavailable), code("forbidden"));
    const period = (await service.createUnavailability(scope, unavailable)).period!;
    await assert.rejects(service.updateUnavailability(member, period.id, { ...unavailable, expectedUpdatedAt: period.updatedAt }), code("forbidden"));
    await assert.rejects(service.deleteUnavailability(member, period.id, period.updatedAt), code("forbidden"));
    await assert.rejects(service.createUnavailability({ ...scope, ventureId: "other" as VentureId }, unavailable), code("not_found"));
    const other = await seed({ reset: false, workspaceId: "other-ws" as WorkspaceId, ventureId: "other-ven" as VentureId });
    // IDs cannot be used through another valid scope, even by an owner.
    await assert.rejects(other.service.deleteUnavailability(other.scope, period.id, period.updatedAt), code("availability_conflict"));
    await assert.rejects(getClient().execute({ sql: `INSERT INTO frigora_engineer_unavailability
      (id, workspace_id, venture_id, user_id, unavailable_start_at, unavailable_end_at, created_by_user_id, created_at, updated_at)
      VALUES ('bad', 'w', 'v', 'u', ?, ?, 'actor', ?, ?)`, args: [END, START, NOW, NOW] }));
  });

  it("warns with work identity, rolls back completely, and confirms with canonical history", async () => {
    const { scope, service, a, b } = await setup();
    await schedule(service, scope, a);
    const before = await durable();
    await assert.rejects(schedule(service, scope, b), (error: unknown) => {
      assert.ok(error instanceof FrigoraError);
      assert.equal(error.code, "double_booking");
      assert.equal(error.conflicts?.[0]?.id, a.id);
      assert.equal(error.conflicts?.[0]?.workReference, a.workReference);
      return true;
    });
    assert.deepEqual(await durable(), before);
    await schedule(service, scope, b, true);
    const after = await durable();
    assert.equal(after.history.length, before.history.length + 1);
    assert.equal(after.history.filter((event) => event.event_type === "SCHEDULED").length, 2);
    assert.equal(after.visits.length, 0);
  });

  it("hard-blocks scheduling and assigning scheduled work into unavailability, even confirmed", async () => {
    const { scope, service, a, b } = await setup();
    await schedule(service, scope, a);
    const cleared = await service.clearWorkOrderAssignment(scope, b.id, { expectedUpdatedAt: b.updatedAt });
    const scheduled = await schedule(service, scope, cleared);
    const result = await service.createUnavailability(scope, unavailable);
    assert.deepEqual(result.affectedWorkOrders.map((work) => work.id), [a.id]);
    const before = await durable();
    await assert.rejects(service.assignWorkOrder(scope, b.id, { userId: ENGINEER, expectedUpdatedAt: scheduled.updatedAt, confirmDoubleBooking: true }), code("engineer_unavailable"));
    const extra = await createOpenWorkOrder(scope, service);
    const assigned = await service.assignWorkOrder(scope, extra.id, { userId: ENGINEER, expectedUpdatedAt: extra.updatedAt });
    const snapshot = await durable();
    await assert.rejects(schedule(service, scope, assigned, true), code("engineer_unavailable"));
    assert.deepEqual(await durable(), snapshot);
    assert.deepEqual(snapshot.work.filter((work) => work.id !== extra.id), before.work);
  });

  it("warning then new unavailability prevents confirmation with zero dispatch mutation", async () => {
    const { scope, service, a, b } = await setup();
    await schedule(service, scope, a);
    await assert.rejects(schedule(service, scope, b), code("double_booking"));
    await service.createUnavailability(scope, unavailable);
    const before = await durable();
    await assert.rejects(schedule(service, scope, b, true), code("engineer_unavailable"));
    assert.deepEqual(await durable(), before);
  });

  it("warning then changed conflicts recomputes current state on explicit confirmation", async () => {
    const { scope, service, a, b } = await setup();
    const booked = await schedule(service, scope, a);
    await assert.rejects(schedule(service, scope, b), code("double_booking"));
    await service.clearWorkOrderSchedule(scope, a.id, { expectedUpdatedAt: booked.updatedAt });
    await schedule(service, scope, b, true);
    assert.equal((await durable()).work.filter((work) => work.scheduled_start_at).length, 1);
  });

  it("confirmed retry cannot bypass stale CAS, active Visit, closed state or invalid interval", async () => {
    const { scope, service, a, b } = await setup();
    await schedule(service, scope, a);
    await assert.rejects(schedule(service, scope, b), code("double_booking"));
    const changed = await service.clearWorkOrderAssignment(scope, b.id, { expectedUpdatedAt: b.updatedAt });
    await assert.rejects(schedule(service, scope, b, true), code("dispatch_conflict"));
    const assigned = await service.assignWorkOrder(scope, b.id, { userId: ENGINEER, expectedUpdatedAt: changed.updatedAt });
    await service.recordVisitArrival(scope, b.id, { userId: ENGINEER, arrivedAt: START });
    const before = await durable();
    await assert.rejects(schedule(service, scope, assigned, true), (error: unknown) => error instanceof FrigoraError && error.message === "Dispatch is locked while a visit is in progress.");
    assert.deepEqual(await durable(), before);
    await assert.rejects(service.scheduleWorkOrder(scope, a.id, { scheduledStartAt: END, scheduledEndAt: START, expectedUpdatedAt: a.updatedAt, confirmDoubleBooking: true }), code("invalid_input"));
    await getClient().execute({ sql: "UPDATE frigora_work_orders SET status = 'closed' WHERE id = ?", args: [a.id] });
    await assert.rejects(schedule(service, scope, a, true), code("invalid_status"));
  });

  it("availability updates report affected work without changing dispatch or Visits", async () => {
    const { scope, service, a } = await setup();
    await schedule(service, scope, a);
    const before = await durable();
    const period = (await service.createUnavailability(scope, { ...unavailable, unavailableStartAt: END, unavailableEndAt: "2026-09-23T12:00:00.000Z" })).period!;
    const result = await service.updateUnavailability(scope, period.id, { ...unavailable, expectedUpdatedAt: period.updatedAt });
    assert.equal(result.affectedWorkOrders[0]?.id, a.id);
    const after = await durable();
    assert.deepEqual(after.work, before.work);
    assert.deepEqual(after.history, before.history);
    assert.deepEqual(after.visits, before.visits);
  });

  it("derives clipped duration, counts and active Visits; clear and reschedule update projection", async () => {
    const { scope, service, a, b } = await setup();
    let booked = await schedule(service, scope, a);
    await service.scheduleWorkOrder(scope, b.id, { scheduledStartAt: "2026-09-22T23:30:00.000Z", scheduledEndAt: "2026-09-23T00:30:00.000Z", expectedUpdatedAt: b.updatedAt });
    const visit = await service.recordVisitArrival(scope, b.id, { userId: ENGINEER, arrivedAt: START });
    const visits = new Map([[b.id, [visit]]]);
    const projection = async () => deriveEngineerWorkload(await service.listWorkOrders(scope, "open"), { start: range.rangeStart, end: range.rangeEnd }, ENGINEER, visits);
    assert.deepEqual(await projection(), { scheduledCount: 2, scheduledMinutes: 90, activeVisitCount: 1 });
    booked = await service.scheduleWorkOrder(scope, a.id, { scheduledStartAt: START, scheduledEndAt: "2026-09-23T12:00:00.000Z", expectedUpdatedAt: booked.updatedAt });
    assert.equal((await projection()).scheduledMinutes, 150);
    await service.clearWorkOrderSchedule(scope, a.id, { expectedUpdatedAt: booked.updatedAt });
    assert.deepEqual(await projection(), { scheduledCount: 1, scheduledMinutes: 30, activeVisitCount: 1 });
  });
});

describe("F34-03 deterministic concurrency", () => {
  for (const mode of ["schedule", "assign", "reassign"]) {
    const assignment = mode !== "schedule";
    it(`${mode}: competing dispatch writers cannot both evade warning`, async () => {
      const { scope, service, a, b } = await setup();
      let target = b;
      if (assignment) {
        if (mode === "reassign") {
          const otherEngineer = "engineer-other" as UserId;
          await ensureMember(scope.workspaceId, otherEngineer);
          target = await service.assignWorkOrder(scope, b.id, { userId: otherEngineer, expectedUpdatedAt: b.updatedAt });
        } else {
          target = await service.clearWorkOrderAssignment(scope, b.id, { expectedUpdatedAt: b.updatedAt });
        }
        target = await schedule(service, scope, target);
      }
      const competing = () => assignment
        ? service.assignWorkOrder(scope, target.id, { userId: ENGINEER, expectedUpdatedAt: target.updatedAt })
        : schedule(service, scope, target);
      const beforeContention = await durable();
      const held = await holdFirstWriter((writer) => schedule(writer, scope, a));
      try {
        await assert.rejects(competing(), /SQLITE_BUSY|database is locked/);
        assert.deepEqual(await durable(), beforeContention);
      } finally { held.release(); }
      await held.result;
      await assert.rejects(competing(), code("double_booking"));
      const state = await durable();
      assert.equal(state.work.filter((work) => work.assigned_user_id === ENGINEER && work.scheduled_start_at === START).length, 1);
      assert.equal(state.visits.length, 0);
    });
  }

  for (const availabilityFirst of [false, true]) {
    it(availabilityFirst ? "availability writer wins before scheduling" : "schedule writer wins; new availability reports affected work", async () => {
      const { scope, service, a } = await setup();
      const beforeContention = await durable();
      const held = await holdFirstWriter((writer) => availabilityFirst ? writer.createUnavailability(scope, unavailable) : schedule(writer, scope, a));
      try {
        await assert.rejects(availabilityFirst ? schedule(service, scope, a) : service.createUnavailability(scope, unavailable), /SQLITE_BUSY|database is locked/);
        assert.deepEqual(await durable(), beforeContention);
      } finally { held.release(); }
      await held.result;
      if (availabilityFirst) {
        const before = await durable();
        await assert.rejects(schedule(service, scope, a, true), code("engineer_unavailable"));
        assert.deepEqual(await durable(), before);
        const period = (await service.listUnavailability(scope, range))[0]!;
        await service.deleteUnavailability(scope, period.id, period.updatedAt);
        await schedule(service, scope, a);
        assert.equal((await durable()).work.find((work) => work.id === a.id)?.scheduled_start_at, START);
      } else {
        const before = await durable();
        const result = await service.createUnavailability(scope, unavailable);
        assert.equal(result.affectedWorkOrders[0]?.id, a.id);
        assert.deepEqual((await durable()).work, before.work);
      }
    });
  }

  it("confirmed dispatch rolls back history when WorkOrder UPDATE fails", async () => {
    const { scope, service, a, b } = await setup();
    await schedule(service, scope, a);
    await getClient().execute(`CREATE TRIGGER reject_f34_update BEFORE UPDATE ON frigora_work_orders BEGIN SELECT RAISE(ABORT, 'forced failure'); END`);
    const before = await durable();
    await assert.rejects(schedule(service, scope, b, true), /forced failure/);
    assert.deepEqual(await durable(), before);
  });
});

describe("F34-03 availability rollback", () => {
  for (const operation of ["create", "update", "delete"]) {
    it(`${operation}: commit failure leaves no partial availability mutation`, async () => {
      const { scope, service } = await setup();
      const period = (await service.createUnavailability(scope, unavailable)).period!;
      const before = await durable();
      const clients: ReturnType<typeof createFrigoraWriteClient>[] = [];
      const failing = createFrigoraService({
        permissions: createPermissionService(createDbMembershipStore()),
        store: createFrigoraStore({ createWriteClient: () => {
          const client = createFrigoraWriteClient();
          clients.push(client);
          const begin = client.transaction.bind(client);
          client.transaction = async (mode?: TransactionMode) => {
            const tx = await begin(mode);
            tx.commit = async () => { throw new Error("forced availability commit failure"); };
            return tx;
          };
          return client;
        } }),
      });
      await assert.rejects(operation === "create" ? failing.createUnavailability(scope, unavailable)
        : operation === "update" ? failing.updateUnavailability(scope, period.id, { ...unavailable, unavailableEndAt: "2026-09-23T12:00:00.000Z", expectedUpdatedAt: period.updatedAt })
          : failing.deleteUnavailability(scope, period.id, period.updatedAt), /forced availability commit failure/);
      assert.deepEqual(await durable(), before);
      assert.equal(clients.length, 1);
      assert.equal(clients[0]?.closed, true);
    });
  }
});

describe("F34-03 confirmation form correction", () => {
  async function prepare(reassign: boolean) {
    const context = await setup();
    const { service, scope, a, b } = context;
    let target = await service.clearWorkOrderAssignment(scope, b.id, { expectedUpdatedAt: b.updatedAt });
    target = await schedule(service, scope, target);
    if (reassign) {
      const other = "engineer-other" as UserId;
      await ensureMember(scope.workspaceId, other);
      target = await service.assignWorkOrder(scope, target.id, { userId: other, expectedUpdatedAt: target.updatedAt });
    }
    const booked = await schedule(service, scope, a);
    let actor: UserId | null = scope.userId;
    const harness = confirmationHarness(service, () => actor);
    const form = new FormData();
    Object.entries({ workspaceId: scope.workspaceId, ventureId: scope.ventureId,
      workOrderId: target.id, userId: ENGINEER, expectedUpdatedAt: target.updatedAt,
    }).forEach(([key, value]) => form.set(key, value));
    return { ...context, target, booked, harness, form, setActor: (next: UserId | null) => { actor = next; } };
  }

  for (const reassign of [false, true]) {
    const mode = reassign ? "reassignment" : "assignment";
    it(`${mode}: actual form warning is mutation-free; explicit component submit forwards confirmation and commits`, async () => {
      const { scope, target, harness, form } = await prepare(reassign);
      const before = await durable();
      const warning = await harness.forms.assignWorkOrderFormAction({}, form);
      assert.equal(warning.code, "double_booking");
      assert.deepEqual(await durable(), before);
      const confirmation = harness.confirmation(warning, scope, target);
      assert.equal(confirmation.fields.get("userId"), ENGINEER);
      assert.deepEqual(await durable(), before);
      assert.equal((await confirmation.confirm()).error, undefined);
      const after = await durable();
      assert.equal(after.work.filter((row) => row.assigned_user_id === ENGINEER && row.scheduled_start_at === START).length, 2);
      assert.equal(after.history.length, before.history.length + 1);
      assert.equal(after.history.filter((event) => !before.history.some((old) => old.id === event.id))[0]?.event_type,
        reassign ? "REASSIGNED" : "ASSIGNED");
    });

    it(`${mode}: actual Cancel handler dismisses warning without submitting or mutating`, async () => {
      const { scope, target, harness, form } = await prepare(reassign);
      const warning = await harness.forms.assignWorkOrderFormAction({}, form);
      assert.equal(warning.code, "double_booking");
      const before = await durable();
      harness.confirmation(warning, scope, target).cancel();
      assert.deepEqual(await durable(), before);
    });

    for (const guard of ["unavailability", "stale", "visit", "authority", "closed"] as const) {
      it(`${mode}: confirmed form retry cannot bypass ${guard}`, async () => {
        const { scope, target, service, harness, form, setActor } = await prepare(reassign);
        const warning = await harness.forms.assignWorkOrderFormAction({}, form);
        assert.equal(warning.code, "double_booking");
        if (guard === "unavailability") await service.createUnavailability(scope, unavailable);
        if (guard === "stale") await service.clearWorkOrderSchedule(scope, target.id, { expectedUpdatedAt: target.updatedAt });
        if (guard === "visit") await service.recordVisitArrival(scope, target.id, { userId: ENGINEER, arrivedAt: START });
        if (guard === "authority") setActor(ENGINEER);
        if (guard === "closed") await getClient().execute({ sql: "UPDATE frigora_work_orders SET status = 'closed' WHERE id = ?", args: [target.id] });
        const before = await durable();
        const result = await harness.confirmation(warning, scope, target).confirm();
        if (guard === "visit") assert.equal(result.error, "Dispatch is locked while a visit is in progress.");
        else assert.equal(result.code, { unavailability: "engineer_unavailable", stale: "dispatch_conflict",
          authority: "forbidden", closed: "invalid_status" }[guard]);
        assert.deepEqual(await durable(), before);
      });
    }

    it(`${mode}: retry recomputes replaced conflicts and does not treat old warning as authority`, async () => {
      const { scope, target, booked, service, harness, form } = await prepare(reassign);
      const warning = await harness.forms.assignWorkOrderFormAction({}, form);
      assert.equal(warning.conflicts?.[0]?.id, booked.id);
      await service.clearWorkOrderSchedule(scope, booked.id, { expectedUpdatedAt: booked.updatedAt });
      const fresh = await createOpenWorkOrder(scope, service);
      const assigned = await service.assignWorkOrder(scope, fresh.id, { userId: ENGINEER, expectedUpdatedAt: fresh.updatedAt });
      await schedule(service, scope, assigned);
      const before = await durable();
      const refreshed = await harness.forms.assignWorkOrderFormAction(warning, form);
      assert.equal(refreshed.code, "double_booking");
      assert.deepEqual(refreshed.conflicts?.map((conflict) => conflict.id), [fresh.id]);
      assert.deepEqual(await durable(), before);
      assert.equal((await harness.confirmation(warning, scope, target).confirm()).error, undefined);
      assert.equal((await durable()).work.filter((row) => row.assigned_user_id === ENGINEER && row.scheduled_start_at === START).length, 2);
    });
  }

  it("scheduling: actual form and confirmation component retain the working confirmation path", async () => {
    const { scope, service, a, b } = await setup();
    await schedule(service, scope, a);
    const harness = confirmationHarness(service, () => scope.userId);
    const form = new FormData();
    Object.entries({ workspaceId: scope.workspaceId, ventureId: scope.ventureId, workOrderId: b.id,
      scheduledStartAt: START, scheduledEndAt: END, expectedUpdatedAt: b.updatedAt,
    }).forEach(([key, value]) => form.set(key, value));
    const before = await durable();
    const warning = await harness.forms.scheduleWorkOrderFormAction({}, form);
    assert.equal(warning.code, "double_booking");
    assert.deepEqual(await durable(), before);
    assert.equal((await harness.confirmation(warning, scope, b, true).confirm()).error, undefined);
    assert.equal((await durable()).work.filter((row) => row.scheduled_start_at === START).length, 2);
  });
});
