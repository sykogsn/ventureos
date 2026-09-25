import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { platformVentureRegistry } from "@/core/venture-definition/catalog";
import {
  buildOperationsCalendarHref,
  compareOperationalQueue,
  formatScheduledWindow,
  isEngineerCalendarEntry,
  isUnassignedQueueWorkOrder,
  parseEngineerFilterParam,
  projectEngineerCalendar,
  projectUnassignedQueue,
  shiftUtcDate,
} from "@/modules/frigora/app/engineer-calendar";
import { FRIGORA_OFFLINE_CAPTURE_OPERATION_ALLOWLIST } from "@/modules/frigora/app/offline/capture-gate";
import { FRIGORA_OFFLINE_DB_NAME, FRIGORA_OFFLINE_DB_VERSION } from "@/modules/frigora/app/offline/types";
import type { FrigoraWorkOrder } from "@/modules/frigora/types";

const WEB_ROOT = join(process.cwd(), "src");
const DAY = "2026-09-08";
const RANGE = {
  start: `${DAY}T00:00:00.000Z`,
  end: "2026-09-09T00:00:00.000Z",
};
const ENGINEER_A = "engineer-a" as FrigoraWorkOrder["assignedUserId"];
const ENGINEER_B = "engineer-b" as FrigoraWorkOrder["assignedUserId"];

function workOrder(overrides: Partial<FrigoraWorkOrder> = {}): FrigoraWorkOrder {
  return {
    id: "wo-1" as FrigoraWorkOrder["id"],
    workspaceId: "ws-1" as FrigoraWorkOrder["workspaceId"],
    ventureId: "ven-1" as FrigoraWorkOrder["ventureId"],
    customerId: "customer-1" as FrigoraWorkOrder["customerId"],
    siteId: "site-1" as FrigoraWorkOrder["siteId"],
    primaryAssetId: null,
    workReference: "WO-1",
    workKind: "reactive",
    priority: "normal",
    reportedCondition: "Warm cabinet",
    status: "open",
    assignedUserId: null,
    scheduledStartAt: null,
    scheduledEndAt: null,
    assignmentAcceptedAt: null,
    assignmentDeclinedAt: null,
    assignmentDeclineReason: null,
    cancellationReason: null,
    sourceRecommendedActionId: null,
    createdAt: "2026-09-07T12:00:00.000Z",
    updatedAt: "2026-09-07T12:00:00.000Z",
    ...overrides,
  };
}

function scheduled(
  id: string,
  engineer: FrigoraWorkOrder["assignedUserId"],
  start: string,
  end: string,
  extras: Partial<FrigoraWorkOrder> = {},
): FrigoraWorkOrder {
  return workOrder({
    id: id as FrigoraWorkOrder["id"],
    workReference: id.toUpperCase(),
    assignedUserId: engineer,
    scheduledStartAt: start,
    scheduledEndAt: end,
    ...extras,
  });
}

describe("F34-02 engineer calendar projection", () => {
  it("places a scheduled open work order on the overlapping day under its engineer", () => {
    const job = scheduled(
      "wo-day",
      ENGINEER_A,
      "2026-09-08T08:00:00.000Z",
      "2026-09-08T10:30:00.000Z",
      { workKind: "inspection", customerId: "customer-9" as FrigoraWorkOrder["customerId"] },
    );
    const groups = projectEngineerCalendar([job], RANGE);
    assert.equal(groups.length, 1);
    assert.equal(groups[0]?.engineerId, ENGINEER_A);
    assert.equal(groups[0]?.entries[0]?.id, job.id);
    assert.equal(groups[0]?.entries[0]?.scheduledStartAt, "2026-09-08T08:00:00.000Z");
    assert.equal(groups[0]?.entries[0]?.scheduledEndAt, "2026-09-08T10:30:00.000Z");
    assert.equal(groups[0]?.entries[0]?.workKind, "inspection");
    assert.equal(groups[0]?.entries[0]?.customerId, "customer-9");
    assert.equal(groups[0]?.entries[0]?.siteId, job.siteId);
    assert.equal(groups[0]?.entries[0]?.status, "open");
    assert.equal(projectEngineerCalendar([job], {
      start: "2026-09-09T00:00:00.000Z",
      end: "2026-09-10T00:00:00.000Z",
    }).length, 0);
  });

  it("moves calendar placement when the work order is reassigned", () => {
    const original = scheduled(
      "wo-move",
      ENGINEER_A,
      "2026-09-08T09:00:00.000Z",
      "2026-09-08T11:00:00.000Z",
    );
    const reassigned = { ...original, assignedUserId: ENGINEER_B, updatedAt: "2026-09-08T07:00:00.000Z" };
    assert.equal(projectEngineerCalendar([original], RANGE)[0]?.engineerId, ENGINEER_A);
    const next = projectEngineerCalendar([reassigned], RANGE);
    assert.equal(next.length, 1);
    assert.equal(next[0]?.engineerId, ENGINEER_B);
    assert.equal(next[0]?.entries[0]?.status, "open");
  });

  it("drops engineer placement and queues the work order when assignment is cleared", () => {
    const assigned = scheduled(
      "wo-clear-assign",
      ENGINEER_A,
      "2026-09-08T09:00:00.000Z",
      "2026-09-08T11:00:00.000Z",
    );
    const unassigned = { ...assigned, assignedUserId: null };
    assert.equal(projectEngineerCalendar([unassigned], RANGE).length, 0);
    const queue = projectUnassignedQueue([unassigned]);
    assert.deepEqual(queue.map((row) => row.id), [unassigned.id]);
    assert.equal(queue[0]?.scheduledStartAt, assigned.scheduledStartAt);
    assert.equal(queue[0]?.status, "open");
  });

  it("lists open unassigned work and removes it once an engineer is assigned", () => {
    const openJob = workOrder({ id: "wo-queue" as FrigoraWorkOrder["id"], workReference: "WO-QUEUE" });
    assert.equal(isUnassignedQueueWorkOrder(openJob), true);
    assert.deepEqual(projectUnassignedQueue([openJob]).map((row) => row.id), ["wo-queue"]);
    const assigned = {
      ...openJob,
      assignedUserId: ENGINEER_A,
      scheduledStartAt: "2026-09-08T13:00:00.000Z",
      scheduledEndAt: "2026-09-08T14:00:00.000Z",
    };
    assert.equal(projectUnassignedQueue([assigned]).length, 0);
    assert.equal(projectEngineerCalendar([assigned], RANGE)[0]?.engineerId, ENGINEER_A);
  });

  it("updates calendar placement when the service window moves or is cleared", () => {
    const morning = scheduled(
      "wo-window",
      ENGINEER_A,
      "2026-09-08T08:00:00.000Z",
      "2026-09-08T09:00:00.000Z",
    );
    const afternoon = {
      ...morning,
      scheduledStartAt: "2026-09-09T15:00:00.000Z",
      scheduledEndAt: "2026-09-09T16:00:00.000Z",
    };
    const cleared = { ...morning, scheduledStartAt: null, scheduledEndAt: null };
    assert.equal(projectEngineerCalendar([morning], RANGE).length, 1);
    assert.equal(projectEngineerCalendar([afternoon], RANGE).length, 0);
    assert.equal(projectEngineerCalendar([afternoon], {
      start: "2026-09-09T00:00:00.000Z",
      end: "2026-09-10T00:00:00.000Z",
    })[0]?.entries[0]?.scheduledStartAt, afternoon.scheduledStartAt);
    assert.equal(isEngineerCalendarEntry(cleared, RANGE), false);
    assert.equal(projectEngineerCalendar([cleared], RANGE).length, 0);
    assert.equal(projectUnassignedQueue([cleared]).length, 0);
  });

  it("keeps the same projection for the same persisted work order", () => {
    const job = scheduled(
      "wo-stable",
      ENGINEER_A,
      "2026-09-08T08:00:00.000Z",
      "2026-09-08T09:00:00.000Z",
    );
    assert.deepEqual(projectEngineerCalendar([job], RANGE), projectEngineerCalendar([job], RANGE));
    assert.deepEqual(projectUnassignedQueue([job]), projectUnassignedQueue([job]));
  });

  it("excludes closed and cancelled work from the calendar and the unassigned queue", () => {
    const closedUnassigned = workOrder({
      id: "wo-closed" as FrigoraWorkOrder["id"],
      status: "closed",
    });
    const closedScheduled = scheduled(
      "wo-closed-sched",
      ENGINEER_A,
      "2026-09-08T08:00:00.000Z",
      "2026-09-08T09:00:00.000Z",
      { status: "closed" },
    );
    const cancelled = workOrder({
      id: "wo-cancelled" as FrigoraWorkOrder["id"],
      status: "cancelled",
      scheduledStartAt: "2026-09-08T08:00:00.000Z",
      scheduledEndAt: "2026-09-08T09:00:00.000Z",
    });
    const rows = [closedUnassigned, closedScheduled, cancelled];
    assert.equal(projectEngineerCalendar(rows, RANGE).length, 0);
    assert.equal(projectUnassignedQueue(rows).length, 0);
  });

  it("keeps scheduled unassigned work in the queue and off the engineer calendar", () => {
    const job = workOrder({
      id: "wo-sched-open" as FrigoraWorkOrder["id"],
      scheduledStartAt: "2026-09-08T08:00:00.000Z",
      scheduledEndAt: "2026-09-08T09:00:00.000Z",
    });
    assert.equal(projectEngineerCalendar([job], RANGE).length, 0);
    assert.equal(projectUnassignedQueue([job])[0]?.id, job.id);
  });

  it("filters the calendar to one engineer and orders that engineer's windows by start", () => {
    const later = scheduled("wo-later", ENGINEER_A, "2026-09-08T14:00:00.000Z", "2026-09-08T15:00:00.000Z");
    const earlier = scheduled("wo-earlier", ENGINEER_A, "2026-09-08T07:00:00.000Z", "2026-09-08T08:00:00.000Z");
    const other = scheduled("wo-other", ENGINEER_B, "2026-09-08T06:00:00.000Z", "2026-09-08T07:00:00.000Z");
    const filtered = projectEngineerCalendar([later, other, earlier], RANGE, ENGINEER_A);
    assert.deepEqual(filtered.map((group) => group.engineerId), [ENGINEER_A]);
    assert.deepEqual(
      filtered[0]?.entries.map((entry) => entry.id),
      ["wo-earlier", "wo-later"],
    );
    assert.equal(projectEngineerCalendar([later, other, earlier], RANGE, "engineer-missing").length, 0);
  });

  it("uses the same overlap bounds as scheduled work-order listing", () => {
    const endsAtMidnight = scheduled(
      "wo-edge",
      ENGINEER_A,
      "2026-09-07T22:00:00.000Z",
      "2026-09-08T00:00:00.000Z",
    );
    const crossesMidnight = scheduled(
      "wo-cross",
      ENGINEER_A,
      "2026-09-07T22:00:00.000Z",
      "2026-09-08T01:00:00.000Z",
    );
    const startsNextMidnight = scheduled(
      "wo-next",
      ENGINEER_A,
      "2026-09-09T00:00:00.000Z",
      "2026-09-09T02:00:00.000Z",
    );
    assert.equal(isEngineerCalendarEntry(endsAtMidnight, RANGE), false);
    assert.equal(isEngineerCalendarEntry(crossesMidnight, RANGE), true);
    assert.equal(isEngineerCalendarEntry(startsNextMidnight, RANGE), false);
  });

  it("does not create a visit or change work-order identity while projecting", () => {
    const job = scheduled(
      "wo-identity",
      ENGINEER_A,
      "2026-09-08T08:00:00.000Z",
      "2026-09-08T09:00:00.000Z",
    );
    const [group] = projectEngineerCalendar([job], RANGE);
    assert.equal(group?.entries[0], job);
    const source = readFileSync(join(WEB_ROOT, "modules/frigora/app/engineer-calendar.ts"), "utf8");
    assert.doesNotMatch(source, /recordVisit|createVisit|insert\(|SCHEMA_GENERATION|indexedDB/);
  });
});

describe("F34-02 calendar navigation helpers", () => {
  it("shifts UTC dates and preserves an engineer filter in operations links", () => {
    assert.equal(shiftUtcDate("2026-09-30", 1), "2026-10-01");
    assert.equal(shiftUtcDate("2026-09-08", -1), "2026-09-07");
    assert.equal(shiftUtcDate("not-a-date", 1), "not-a-date");
    assert.equal(
      buildOperationsCalendarHref("ven-1", { date: DAY, engineerId: "engineer-a" }),
      "/ventures/ven-1/operations?date=2026-09-08&engineer=engineer-a",
    );
    assert.equal(parseEngineerFilterParam("engineer-a"), "engineer-a");
    assert.equal(parseEngineerFilterParam("bad id"), null);
    assert.equal(parseEngineerFilterParam(""), null);
    assert.equal(
      formatScheduledWindow("2026-09-08T08:00:00.000Z", "2026-09-08T10:30:00.000Z"),
      "2026-09-08 08:00–10:30 UTC",
    );
  });
});

describe("F34-02 Service Desk integration", () => {
  it("renders the calendar and queue on Operations through existing dispatch controls", () => {
    const route = readFileSync(
      join(WEB_ROOT, "app/(app)/ventures/[ventureId]/operations/page.tsx"),
      "utf8",
    );
    const operations = readFileSync(
      join(WEB_ROOT, "modules/frigora/app/screens/operations-screen.tsx"),
      "utf8",
    );
    const panel = readFileSync(
      join(WEB_ROOT, "modules/frigora/app/screens/engineer-calendar-panel.tsx"),
      "utf8",
    );
    const views = readFileSync(join(WEB_ROOT, "modules/frigora/app/views.ts"), "utf8");
    const mutations = readFileSync(
      join(WEB_ROOT, "modules/frigora/app/mutation-actions.ts"),
      "utf8",
    );
    const dispatchControls = readFileSync(
      join(WEB_ROOT, "modules/frigora/app/forms/dispatch-controls.tsx"),
      "utf8",
    );

    const redirectAt = route.indexOf("if (!ctx.canWrite)");
    const screenAt = route.indexOf("<OperationsScreen");
    assert.ok(redirectAt >= 0 && screenAt > redirectAt);
    assert.match(route, /redirect\(`\/ventures\/\$\{ctx\.ventureId\}\/work\/assigned`\)/);
    assert.match(operations, /Service Desk/);
    assert.match(operations, /All work/);
    assert.match(operations, /EngineerCalendarPanel/);
    assert.match(operations, /Day board/);
    assert.match(panel, /Engineer calendar/);
    assert.match(panel, /Unassigned queue/);
    assert.match(panel, /No scheduled work for this date/);
    assert.match(panel, /No scheduled work for this engineer on this date/);
    assert.match(panel, /No unassigned open work/);
    assert.match(panel, /DispatchControls/);
    assert.match(panel, /hasActiveVisit/);
    assert.match(panel, /formatWorkKindLabel/);
    assert.doesNotMatch(panel, /data-frigora-offline/);
    assert.doesNotMatch(panel, /use server/);
    assert.match(views, /projectEngineerCalendar/);
    assert.match(views, /projectUnassignedQueue/);
    assert.match(mutations, /function revalidateDispatch/);
    assert.match(mutations, /revalidatePath\(operationsPath\(ventureId\)\)/);
    assert.match(dispatchControls, /name="expectedUpdatedAt"/);
    assert.match(dispatchControls, /assignWorkOrderFormAction/);
    assert.match(dispatchControls, /scheduleWorkOrderFormAction/);
    assert.match(dispatchControls, /clearAssignmentFormAction/);
    assert.match(dispatchControls, /clearWorkOrderScheduleFormAction/);
  });

  it("keeps product, schema, and offline dispatch boundaries unchanged", () => {
    assert.equal(platformVentureRegistry.resolve("frigora").version, "0.22.0");
    const dbSource = readFileSync(join(WEB_ROOT, "platform/persistence/db.ts"), "utf8");
    assert.match(dbSource, /SCHEMA_GENERATION = 31/);
    assert.equal(FRIGORA_OFFLINE_DB_NAME, "frigora-offline");
    assert.equal(FRIGORA_OFFLINE_DB_VERSION, 1);
    assert.deepEqual(
      [...FRIGORA_OFFLINE_CAPTURE_OPERATION_ALLOWLIST],
      ["recordTechnicalFinding", "recordFieldCapture", "recordVisitEvidence"],
    );
  });

  it("orders urgent before high before normal, then scheduled start, then reference", () => {
    const normal = workOrder({
      id: "wo-normal" as FrigoraWorkOrder["id"],
      workReference: "WO-A",
      priority: "normal",
      scheduledStartAt: "2026-09-08T08:00:00.000Z",
      scheduledEndAt: "2026-09-08T09:00:00.000Z",
      assignedUserId: ENGINEER_A,
    });
    const highLater = workOrder({
      id: "wo-high" as FrigoraWorkOrder["id"],
      workReference: "WO-B",
      priority: "high",
      scheduledStartAt: "2026-09-08T12:00:00.000Z",
      scheduledEndAt: "2026-09-08T13:00:00.000Z",
      assignedUserId: ENGINEER_A,
    });
    const urgent = workOrder({
      id: "wo-urgent" as FrigoraWorkOrder["id"],
      workReference: "WO-C",
      priority: "urgent",
      workKind: "inspection",
      scheduledStartAt: "2026-09-08T15:00:00.000Z",
      scheduledEndAt: "2026-09-08T16:00:00.000Z",
      assignedUserId: ENGINEER_A,
    });
    const samePriorityEarlierRef = workOrder({
      id: "wo-high-early" as FrigoraWorkOrder["id"],
      workReference: "WO-A2",
      priority: "high",
      scheduledStartAt: "2026-09-08T07:00:00.000Z",
      scheduledEndAt: "2026-09-08T08:00:00.000Z",
      assignedUserId: ENGINEER_A,
    });
    const ordered = [normal, highLater, urgent, samePriorityEarlierRef].sort(compareOperationalQueue);
    assert.deepEqual(
      ordered.map((row) => row.workReference),
      ["WO-C", "WO-A2", "WO-B", "WO-A"],
    );
    assert.equal(urgent.workKind, "inspection");
    assert.equal(normal.workKind, "reactive");
    const calendar = projectEngineerCalendar([normal, urgent, highLater], RANGE, ENGINEER_A);
    assert.deepEqual(
      calendar[0]?.entries.map((row) => row.priority),
      ["urgent", "high", "normal"],
    );
  });
});
