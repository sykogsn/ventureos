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
  | "VISIT_COMPLETED_WORK_OPEN";

export const ATTENTION_SIGNAL_LABELS: Record<OperationalAttentionSignal, string> = {
  UNASSIGNED_OPEN_WORK: "Unassigned open work",
  NO_VISIT_RECORDED: "No visit recorded yet",
  VISIT_IN_PROGRESS: "Visit in progress",
  VISIT_COMPLETED_WORK_OPEN: "Visit completed; work order still open",
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

  return signals;
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
