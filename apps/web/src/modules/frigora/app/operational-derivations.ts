import type {
  FrigoraVisit,
  FrigoraVisitStatus,
  FrigoraWorkOrder,
  FrigoraWorkOrderStatus,
} from "@/modules/frigora/types";

export type OperationalAttentionSignal =
  | "UNASSIGNED_OPEN_WORK"
  | "NO_VISIT_RECORDED"
  | "VISIT_IN_PROGRESS"
  | "VISIT_COMPLETED_WORK_OPEN"
  | "SCHEDULED_UNASSIGNED"
  | "AWAITING_ASSIGNMENT_RESPONSE"
  | "ASSIGNMENT_DECLINED"
  | "EXPIRED_SERVICE_WINDOW"
  | "STALE_ASSIGNEE";

export const ATTENTION_SIGNAL_LABELS: Record<OperationalAttentionSignal, string> = {
  UNASSIGNED_OPEN_WORK: "Unassigned open work",
  NO_VISIT_RECORDED: "No visit recorded yet",
  VISIT_IN_PROGRESS: "Visit in progress",
  VISIT_COMPLETED_WORK_OPEN: "Visit completed; work order still open",
  SCHEDULED_UNASSIGNED: "Scheduled but unassigned",
  AWAITING_ASSIGNMENT_RESPONSE: "Awaiting engineer response",
  ASSIGNMENT_DECLINED: "Assignment declined",
  EXPIRED_SERVICE_WINDOW: "Service window expired",
  STALE_ASSIGNEE: "Assignee is no longer a workspace member",
};

export type DispatchResponseState =
  | "unscheduled"
  | "unassigned"
  | "awaiting_response"
  | "accepted"
  | "declined";

export type DispatchBoardBucket =
  | "unscheduled"
  | "scheduled_unassigned"
  | "awaiting_response"
  | "accepted"
  | "declined"
  | "active"
  | "completed";

export const DISPATCH_BUCKET_LABELS: Record<DispatchBoardBucket, string> = {
  unscheduled: "Unscheduled",
  scheduled_unassigned: "Scheduled / unassigned",
  awaiting_response: "Awaiting response",
  accepted: "Accepted",
  declined: "Declined",
  active: "Active visits",
  completed: "Completed",
};

export type OperationsOverviewCounts = {
  openWork: number;
  assignedOpen: number;
  unassignedOpen: number;
  activeVisits: number;
  visitedStillOpen: number;
};

export type OperationalActivityKind =
  | "work_order_created"
  | "visit_arrived"
  | "visit_departed"
  | "field_capture_observed"
  | "technical_finding_recorded"
  | "corrective_action_recorded"
  | "part_usage_recorded"
  | "refrigerant_event_recorded"
  | "visit_outcome_recorded"
  | "recommended_action_recorded"
  | "asset_operational_condition_recorded"
  | "customer_acknowledgement_recorded";

export type OperationalActivityEvent = {
  kind: OperationalActivityKind;
  occurredAt: string;
  sourceId: string;
  workOrderId: string;
  workOrderReference: string;
  visitId: string | null;
  assetId: string | null;
  label: string;
  detail: string | null;
};

export function deriveAttentionSignals(
  workOrder: FrigoraWorkOrder,
  visits: FrigoraVisit[],
  eligibleAssigneeIds?: ReadonlySet<string>,
  now = new Date().toISOString(),
): OperationalAttentionSignal[] {
  if (workOrder.status !== "open") {
    return [];
  }

  const signals: OperationalAttentionSignal[] = [];

  if (workOrder.assignedUserId === null) {
    signals.push("UNASSIGNED_OPEN_WORK");
  }
  if (visits.length === 0) {
    signals.push("NO_VISIT_RECORDED");
  }
  if (visits.some((visit) => visit.status === "open")) {
    signals.push("VISIT_IN_PROGRESS");
  }
  if (visits.some((visit) => visit.status === "departed")) {
    signals.push("VISIT_COMPLETED_WORK_OPEN");
  }
  if (workOrder.scheduledStartAt !== null && workOrder.assignedUserId === null) {
    signals.push("SCHEDULED_UNASSIGNED");
  }
  if (
    workOrder.scheduledStartAt !== null &&
    workOrder.assignedUserId !== null &&
    workOrder.assignmentAcceptedAt === null &&
    workOrder.assignmentDeclinedAt === null
  ) {
    signals.push("AWAITING_ASSIGNMENT_RESPONSE");
  }
  if (workOrder.assignmentDeclinedAt !== null) {
    signals.push("ASSIGNMENT_DECLINED");
  }
  if (
    workOrder.scheduledEndAt !== null &&
    Date.parse(workOrder.scheduledEndAt) < Date.parse(now) &&
    !visits.some(
      (visit) =>
        visit.status === "open" ||
        (visit.status === "departed" &&
          visit.departedAt !== null &&
          workOrder.scheduledStartAt !== null &&
          Date.parse(visit.arrivedAt) < Date.parse(workOrder.scheduledEndAt!) &&
          Date.parse(visit.departedAt) >= Date.parse(workOrder.scheduledStartAt)),
    )
  ) {
    signals.push("EXPIRED_SERVICE_WINDOW");
  }
  if (
    eligibleAssigneeIds &&
    workOrder.assignedUserId !== null &&
    !eligibleAssigneeIds.has(workOrder.assignedUserId)
  ) {
    signals.push("STALE_ASSIGNEE");
  }

  return signals;
}

export function deriveDispatchResponseState(
  workOrder: FrigoraWorkOrder,
): DispatchResponseState {
  if (workOrder.scheduledStartAt === null || workOrder.scheduledEndAt === null) {
    return "unscheduled";
  }
  if (workOrder.assignedUserId === null) {
    return "unassigned";
  }
  if (workOrder.assignmentDeclinedAt !== null) {
    return "declined";
  }
  if (workOrder.assignmentAcceptedAt !== null) {
    return "accepted";
  }
  return "awaiting_response";
}

export function deriveDispatchBoardBucket(
  workOrder: FrigoraWorkOrder,
  visits: FrigoraVisit[],
): DispatchBoardBucket {
  if (workOrder.status === "closed") {
    return "completed";
  }
  if (visits.some((visit) => visit.status === "open")) {
    return "active";
  }
  const response = deriveDispatchResponseState(workOrder);
  return response === "unassigned" ? "scheduled_unassigned" : response;
}

export function selectLatestVisit(visits: FrigoraVisit[]): FrigoraVisit | null {
  if (visits.length === 0) {
    return null;
  }

  return [...visits].sort((left, right) => {
    if (left.arrivedAt !== right.arrivedAt) {
      return left.arrivedAt < right.arrivedAt ? -1 : 1;
    }
    return left.id < right.id ? -1 : left.id > right.id ? 1 : 0;
  })[visits.length - 1]!;
}

export function hasActiveVisit(visits: FrigoraVisit[]): boolean {
  return visits.some((visit) => visit.status === "open");
}

export function formatVisitStatusLabel(status: FrigoraVisitStatus): string {
  switch (status) {
    case "open":
      return "In progress";
    case "departed":
      return "Departed";
    case "cancelled":
      return "Cancelled";
  }
}

export function formatWorkOrderStatusLabel(status: FrigoraWorkOrderStatus): string {
  switch (status) {
    case "open":
      return "Open";
    case "closed":
      return "Completed";
    case "cancelled":
      return "Cancelled";
  }
}

export function computeOperationsCounts(
  openWorkOrders: FrigoraWorkOrder[],
  visitsByWorkOrderId: Map<string, FrigoraVisit[]>,
): OperationsOverviewCounts {
  let assignedOpen = 0;
  let unassignedOpen = 0;
  let activeVisits = 0;
  let visitedStillOpen = 0;

  for (const workOrder of openWorkOrders) {
    if (workOrder.assignedUserId !== null) {
      assignedOpen += 1;
    } else {
      unassignedOpen += 1;
    }

    const visits = visitsByWorkOrderId.get(workOrder.id) ?? [];
    activeVisits += visits.filter(
      (visit) => visit.status === "open",
    ).length;

    if (visits.some((visit) => visit.status === "departed")) {
      visitedStillOpen += 1;
    }
  }

  return {
    openWork: openWorkOrders.length,
    assignedOpen,
    unassignedOpen,
    activeVisits,
    visitedStillOpen,
  };
}

export function sortOperationalActivityEvents(
  events: OperationalActivityEvent[],
): OperationalActivityEvent[] {
  return [...events].sort((left, right) => {
    if (left.occurredAt !== right.occurredAt) {
      return left.occurredAt < right.occurredAt ? 1 : -1;
    }
    if (left.kind !== right.kind) {
      return left.kind < right.kind ? -1 : 1;
    }
    return left.sourceId < right.sourceId ? -1 : left.sourceId > right.sourceId ? 1 : 0;
  });
}

export function takeRecentActivity(
  events: OperationalActivityEvent[],
  limit = 20,
): OperationalActivityEvent[] {
  return sortOperationalActivityEvents(events).slice(0, limit);
}
