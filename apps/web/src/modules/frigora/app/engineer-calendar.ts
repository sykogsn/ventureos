import {
  FRIGORA_WORK_ORDER_PRIORITY_RANK,
  type FrigoraVisit,
  type FrigoraWorkKind,
  type FrigoraWorkOrder,
} from "@/modules/frigora/types";
import { hasActiveVisit } from "./operational-derivations";

export function deriveEngineerWorkload(workOrders: readonly FrigoraWorkOrder[], range: ScheduleRange,
  engineerId: string, visits: ReadonlyMap<string, FrigoraVisit[]>) {
  const entries = uniqueWorkOrders(workOrders).filter((work) => work.assignedUserId === engineerId && isEngineerCalendarEntry(work, range));
  const scheduledMinutes = entries.reduce((total, work) => {
    const start = Math.max(Date.parse(work.scheduledStartAt!), Date.parse(range.start));
    const end = Math.min(Date.parse(work.scheduledEndAt!), Date.parse(range.end));
    return total + Math.max(0, end - start) / 60_000;
  }, 0);
  return { scheduledCount: entries.length, scheduledMinutes,
    activeVisitCount: entries.filter((work) => hasActiveVisit(visits.get(work.id) ?? [])).length };
}

/**
 * F34-02 projections. Calendar rows and the unassigned queue are views of
 * canonical WorkOrder assignment and schedule fields. They are not persisted.
 */

export type ScheduleRange = {
  start: string;
  end: string;
};

export type EngineerCalendarGroup = {
  engineerId: string;
  entries: FrigoraWorkOrder[];
};

const WORK_KIND_LABELS: Record<FrigoraWorkKind, string> = {
  reactive: "Reactive",
  planned: "Planned",
  inspection: "Inspection",
};

export function formatWorkKindLabel(kind: FrigoraWorkKind): string {
  return WORK_KIND_LABELS[kind];
}

export function parseEngineerFilterParam(value: string | undefined): string | null {
  if (!value) {
    return null;
  }
  const trimmed = value.trim();
  if (!/^[A-Za-z0-9_-]{1,80}$/.test(trimmed)) {
    return null;
  }
  return trimmed;
}

export function shiftUtcDate(date: string, days: number): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isInteger(days)) {
    return date;
  }
  const ms = Date.parse(`${date}T00:00:00.000Z`);
  if (Number.isNaN(ms)) {
    return date;
  }
  const shifted = new Date(ms + days * 86_400_000).toISOString().slice(0, 10);
  return shifted === date && days !== 0 ? date : shifted;
}

export function buildOperationsCalendarHref(
  ventureId: string,
  input: { date: string; engineerId?: string | null },
): string {
  const params = new URLSearchParams();
  if (/^\d{4}-\d{2}-\d{2}$/.test(input.date)) {
    params.set("date", input.date);
  }
  if (input.engineerId) {
    params.set("engineer", input.engineerId);
  }
  const query = params.toString();
  const path = `/ventures/${ventureId}/operations`;
  return query ? `${path}?${query}` : path;
}

export function formatScheduledWindow(start: string, end: string): string {
  const startMatch = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/.exec(start);
  const endMatch = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/.exec(end);
  if (!startMatch || !endMatch) {
    return `${start} → ${end}`;
  }
  if (startMatch[1] === endMatch[1]) {
    return `${startMatch[1]} ${startMatch[2]}–${endMatch[2]} UTC`;
  }
  return `${startMatch[1]} ${startMatch[2]} UTC → ${endMatch[1]} ${endMatch[2]} UTC`;
}

function uniqueWorkOrders(workOrders: readonly FrigoraWorkOrder[]): FrigoraWorkOrder[] {
  const byId = new Map<string, FrigoraWorkOrder>();
  for (const workOrder of workOrders) {
    byId.set(workOrder.id, workOrder);
  }
  return [...byId.values()];
}

function instant(value: string): number | null {
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
}

/** Same overlap as listScheduledWorkOrders: start < rangeEnd and end > rangeStart. */
export function scheduledWindowOverlapsRange(
  workOrder: Pick<FrigoraWorkOrder, "scheduledStartAt" | "scheduledEndAt">,
  range: ScheduleRange,
): boolean {
  if (workOrder.scheduledStartAt === null || workOrder.scheduledEndAt === null) {
    return false;
  }
  const start = instant(workOrder.scheduledStartAt);
  const end = instant(workOrder.scheduledEndAt);
  const rangeStart = instant(range.start);
  const rangeEnd = instant(range.end);
  if (start === null || end === null || rangeStart === null || rangeEnd === null) {
    return false;
  }
  return start < rangeEnd && end > rangeStart;
}

export function isEngineerCalendarEntry(
  workOrder: FrigoraWorkOrder,
  range: ScheduleRange,
): boolean {
  return (
    workOrder.status === "open" &&
    workOrder.assignedUserId !== null &&
    scheduledWindowOverlapsRange(workOrder, range)
  );
}

export function isUnassignedQueueWorkOrder(workOrder: FrigoraWorkOrder): boolean {
  return workOrder.status === "open" && workOrder.assignedUserId === null;
}

function compareByPriority(left: FrigoraWorkOrder, right: FrigoraWorkOrder): number {
  return (
    FRIGORA_WORK_ORDER_PRIORITY_RANK[left.priority] -
    FRIGORA_WORK_ORDER_PRIORITY_RANK[right.priority]
  );
}

function compareCalendarEntries(left: FrigoraWorkOrder, right: FrigoraWorkOrder): number {
  const byPriority = compareByPriority(left, right);
  if (byPriority !== 0) {
    return byPriority;
  }
  const leftStart = left.scheduledStartAt ?? "";
  const rightStart = right.scheduledStartAt ?? "";
  if (leftStart !== rightStart) {
    return leftStart < rightStart ? -1 : 1;
  }
  const leftEnd = left.scheduledEndAt ?? "";
  const rightEnd = right.scheduledEndAt ?? "";
  if (leftEnd !== rightEnd) {
    return leftEnd < rightEnd ? -1 : 1;
  }
  if (left.workReference !== right.workReference) {
    return left.workReference < right.workReference ? -1 : 1;
  }
  if (left.id !== right.id) {
    return left.id < right.id ? -1 : 1;
  }
  return 0;
}

export function compareOperationalQueue(left: FrigoraWorkOrder, right: FrigoraWorkOrder): number {
  const byPriority = compareByPriority(left, right);
  if (byPriority !== 0) {
    return byPriority;
  }
  return compareQueueEntries(left, right);
}

function compareQueueEntries(left: FrigoraWorkOrder, right: FrigoraWorkOrder): number {
  const leftScheduled = left.scheduledStartAt !== null;
  const rightScheduled = right.scheduledStartAt !== null;
  if (leftScheduled !== rightScheduled) {
    return leftScheduled ? -1 : 1;
  }
  if (leftScheduled && rightScheduled && left.scheduledStartAt !== right.scheduledStartAt) {
    return left.scheduledStartAt! < right.scheduledStartAt! ? -1 : 1;
  }
  if (left.workReference !== right.workReference) {
    return left.workReference < right.workReference ? -1 : 1;
  }
  if (left.id !== right.id) {
    return left.id < right.id ? -1 : 1;
  }
  return 0;
}

export function projectEngineerCalendar(
  workOrders: readonly FrigoraWorkOrder[],
  range: ScheduleRange,
  engineerId?: string | null,
): EngineerCalendarGroup[] {
  const grouped = new Map<string, FrigoraWorkOrder[]>();
  for (const workOrder of uniqueWorkOrders(workOrders)) {
    if (!isEngineerCalendarEntry(workOrder, range)) {
      continue;
    }
    if (engineerId && workOrder.assignedUserId !== engineerId) {
      continue;
    }
    const assigneeId = workOrder.assignedUserId;
    if (assigneeId === null) {
      continue;
    }
    const entries = grouped.get(assigneeId) ?? [];
    entries.push(workOrder);
    grouped.set(assigneeId, entries);
  }

  return [...grouped.entries()]
    .map(([id, entries]) => ({
      engineerId: id,
      entries: [...entries].sort(compareCalendarEntries),
    }))
    .sort((left, right) => {
      if (left.engineerId === right.engineerId) {
        return 0;
      }
      return left.engineerId < right.engineerId ? -1 : 1;
    });
}

export function projectUnassignedQueue(
  workOrders: readonly FrigoraWorkOrder[],
): FrigoraWorkOrder[] {
  return uniqueWorkOrders(workOrders)
    .filter(isUnassignedQueueWorkOrder)
    .sort(compareOperationalQueue);
}
