import { getPersistence } from "@/platform/persistence/repositories";
import {
  getAssetQuery,
  getCurrentAssetOperationalConditionQuery,
  getCustomerQuery,
  getSiteQuery,
  getVisitOutcomeByVisitQuery,
  getVisitQuery,
  getWorkOrderQuery,
  listAssetOperationalConditionsByAssetQuery,
  listAssetsBySiteQuery,
  listCorrectiveActionsByVisitQuery,
  listCorrectiveActionsByWorkOrderQuery,
  listCustomersQuery,
  listFieldCapturesByVisitQuery,
  listFieldCapturesByWorkOrderQuery,
  listPartUsagesByVisitQuery,
  listPartUsagesByWorkOrderQuery,
  listRecommendedActionsByVisitQuery,
  listRecommendedActionsByWorkOrderQuery,
  listRefrigerantEventsByVisitQuery,
  listRefrigerantEventsByWorkOrderQuery,
  listSitesByCustomerQuery,
  listTechnicalFindingsByVisitQuery,
  listTechnicalFindingsByWorkOrderQuery,
  listVisitCustomerAcknowledgementsByVisitQuery,
  listVisitCustomerAcknowledgementsByWorkOrderQuery,
  listVisitOutcomesByWorkOrderQuery,
  listVisitsByWorkOrderQuery,
  listWorkOrdersByAssigneeQuery,
  listWorkOrdersQuery,
} from "@/modules/frigora/queries";
import {
  ATTENTION_SIGNAL_LABELS,
  computeOperationsCounts,
  deriveAttentionSignals,
  hasActiveVisit,
  selectLatestVisit,
  takeRecentActivity,
  type OperationalActivityEvent,
  type OperationalAttentionSignal,
  type OperationsOverviewCounts,
} from "@/modules/frigora/app/operational-derivations";
import type {
  FrigoraAsset,
  FrigoraAssetOperationalCondition,
  FrigoraCorrectiveAction,
  FrigoraCustomer,
  FrigoraFieldCapture,
  FrigoraPartUsage,
  FrigoraRecommendedAction,
  FrigoraRefrigerantEvent,
  FrigoraSite,
  FrigoraTechnicalFinding,
  FrigoraVisit,
  FrigoraVisitCustomerAcknowledgement,
  FrigoraVisitOutcome,
  FrigoraWorkOrder,
  FrigoraWorkOrderStatus,
} from "@/modules/frigora/types";
import type { UserId } from "@/contracts";

type Scope = { workspaceId: string; ventureId: string };

export type UserDisplay = {
  id: string;
  name: string;
  email: string;
};

export type WorkListFilters = {
  status: "all" | FrigoraWorkOrderStatus;
  assignment: "all" | "assigned" | "unassigned";
};

export type WorkOrderListRow = {
  workOrder: FrigoraWorkOrder;
  customer: FrigoraCustomer | null;
  site: FrigoraSite | null;
  asset: FrigoraAsset | null;
  assignee: UserDisplay | null;
  visitCount: number;
  hasActiveVisit: boolean;
  latestVisit: FrigoraVisit | null;
};

export type OperationalAttentionItem = {
  workOrder: FrigoraWorkOrder;
  customer: FrigoraCustomer | null;
  site: FrigoraSite | null;
  assignee: UserDisplay | null;
  signals: OperationalAttentionSignal[];
};

export type OperationsOverviewView = {
  counts: OperationsOverviewCounts;
  attention: OperationalAttentionItem[];
  recentActivity: OperationalActivityEvent[];
};

export type VisitFactsView = {
  visit: FrigoraVisit;
  attendee: UserDisplay | null;
  fieldCaptures: FrigoraFieldCapture[];
  technicalFindings: FrigoraTechnicalFinding[];
  correctiveActions: FrigoraCorrectiveAction[];
  partUsages: FrigoraPartUsage[];
  refrigerantEvents: FrigoraRefrigerantEvent[];
  visitOutcome: FrigoraVisitOutcome | null;
  recommendedActions: FrigoraRecommendedAction[];
  operationalConditions: FrigoraAssetOperationalCondition[];
  acknowledgements: FrigoraVisitCustomerAcknowledgement[];
};

export type WorkOrderDetailView = {
  workOrder: FrigoraWorkOrder;
  customer: FrigoraCustomer | null;
  site: FrigoraSite | null;
  asset: FrigoraAsset | null;
  assignee: UserDisplay | null;
  visits: FrigoraVisit[];
  visitAttendees: Record<string, UserDisplay | null>;
  visitFacts: VisitFactsView[];
  workOrderRecommendations: FrigoraRecommendedAction[];
  currentOperationalCondition: FrigoraAssetOperationalCondition | null;
  attentionSignals: OperationalAttentionSignal[];
  latestVisitId: string | null;
};

export type MyWorkRow = {
  workOrder: FrigoraWorkOrder;
  customer: FrigoraCustomer | null;
  site: FrigoraSite | null;
  asset: FrigoraAsset | null;
};

export type VisitEntryView = {
  workOrder: FrigoraWorkOrder;
  customer: FrigoraCustomer | null;
  site: FrigoraSite | null;
  asset: FrigoraAsset | null;
};

export type VisitRecorderView = {
  workOrder: FrigoraWorkOrder;
  customer: FrigoraCustomer | null;
  site: FrigoraSite | null;
  asset: FrigoraAsset | null;
  assignee: UserDisplay | null;
  visit: FrigoraVisit;
  attending: UserDisplay | null;
  otherOpenVisits: FrigoraVisit[];
  fieldCaptures: FrigoraFieldCapture[];
  technicalFindings: FrigoraTechnicalFinding[];
  correctiveActions: FrigoraCorrectiveAction[];
  partUsages: FrigoraPartUsage[];
  refrigerantEvents: FrigoraRefrigerantEvent[];
  visitOutcome: FrigoraVisitOutcome | null;
  recommendedActions: FrigoraRecommendedAction[];
  acknowledgements: FrigoraVisitCustomerAcknowledgement[];
  currentOperationalCondition: FrigoraAssetOperationalCondition | null;
  visitOperationalConditions: FrigoraAssetOperationalCondition[];
  canRecord: boolean;
};

export type WorkCreateOptions = {
  customers: Array<{
    customer: FrigoraCustomer;
    sites: Array<{
      site: FrigoraSite;
      assets: FrigoraAsset[];
    }>;
  }>;
};

export async function resolveUserDisplay(userId: string | null): Promise<UserDisplay | null> {
  if (!userId) {
    return null;
  }
  const row = await getPersistence().users.findById(userId as UserId);
  if (!row) {
    return { id: userId, name: userId, email: "" };
  }
  return { id: row.id, name: row.name, email: row.email };
}

async function loadVisitFacts(
  scope: Scope,
  visit: FrigoraVisit,
): Promise<VisitFactsView> {
  const [
    attendee,
    capturesResult,
    findingsResult,
    correctiveResult,
    partsResult,
    refrigerantResult,
    outcomeResult,
    recommendedResult,
    acknowledgementsResult,
  ] = await Promise.all([
    resolveUserDisplay(visit.attendingUserId),
    listFieldCapturesByVisitQuery({ ...scope, visitId: visit.id }),
    listTechnicalFindingsByVisitQuery({ ...scope, visitId: visit.id }),
    listCorrectiveActionsByVisitQuery({ ...scope, visitId: visit.id }),
    listPartUsagesByVisitQuery({ ...scope, visitId: visit.id }),
    listRefrigerantEventsByVisitQuery({ ...scope, visitId: visit.id }),
    getVisitOutcomeByVisitQuery({ ...scope, visitId: visit.id }),
    listRecommendedActionsByVisitQuery({ ...scope, visitId: visit.id }),
    listVisitCustomerAcknowledgementsByVisitQuery({ ...scope, visitId: visit.id }),
  ]);

  let operationalConditions: FrigoraAssetOperationalCondition[] = [];
  const workResult = await getWorkOrderQuery({ ...scope, id: visit.workOrderId });
  const primaryAssetId = workResult.record?.primaryAssetId;
  if (primaryAssetId) {
    const opResult = await listAssetOperationalConditionsByAssetQuery({
      ...scope,
      assetId: primaryAssetId,
    });
    operationalConditions = (opResult.record ?? []).filter(
      (row) => row.visitId === visit.id,
    );
  }

  return {
    visit,
    attendee,
    fieldCaptures: capturesResult.record ?? [],
    technicalFindings: findingsResult.record ?? [],
    correctiveActions: correctiveResult.record ?? [],
    partUsages: partsResult.record ?? [],
    refrigerantEvents: refrigerantResult.record ?? [],
    visitOutcome: outcomeResult.record ?? null,
    recommendedActions: recommendedResult.record ?? [],
    operationalConditions,
    acknowledgements: acknowledgementsResult.record ?? [],
  };
}

export async function loadMyWork(
  scope: Scope,
  sessionUserId: string,
): Promise<{ error?: string; rows: MyWorkRow[] }> {
  const result = await listWorkOrdersByAssigneeQuery({
    ...scope,
    userId: sessionUserId,
  });
  if (result.error) {
    return { error: result.error, rows: [] };
  }

  const openWorkOrders = (result.record ?? []).filter(
    (workOrder) => workOrder.status === "open",
  );
  const rows: MyWorkRow[] = [];
  for (const workOrder of openWorkOrders) {
    const [customer, site, asset] = await Promise.all([
      getCustomerQuery({ ...scope, id: workOrder.customerId }),
      getSiteQuery({ ...scope, id: workOrder.siteId }),
      workOrder.primaryAssetId
        ? getAssetQuery({ ...scope, id: workOrder.primaryAssetId })
        : Promise.resolve({ record: null as FrigoraAsset | null }),
    ]);
    rows.push({
      workOrder,
      customer: customer.record ?? null,
      site: site.record ?? null,
      asset: asset.record ?? null,
    });
  }
  return { rows };
}

export async function resolveVisitEntry(
  scope: Scope,
  workOrderId: string,
  sessionUserId: string,
  canWrite: boolean,
): Promise<{
  error?: string;
  redirectPath?: string;
  view?: VisitEntryView | null;
}> {
  const workResult = await getWorkOrderQuery({ ...scope, id: workOrderId });
  if (workResult.error) {
    return { error: workResult.error };
  }
  const workOrder = workResult.record;
  if (!workOrder) {
    return { view: null };
  }

  const visitsResult = await listVisitsByWorkOrderQuery({
    ...scope,
    workOrderId: workOrder.id,
  });
  if (visitsResult.error) {
    return { error: visitsResult.error };
  }

  const openVisits = (visitsResult.record ?? []).filter((visit) => visit.status === "open");
  const assignedToMe = workOrder.assignedUserId === sessionUserId;
  const mayExecute = canWrite && workOrder.status === "open" && assignedToMe;

  if (openVisits.length > 0) {
    const latestOpen = openVisits[openVisits.length - 1]!;
    return {
      redirectPath: `/ventures/${scope.ventureId}/work/${workOrderId}/visit/${latestOpen.id}`,
    };
  }

  if (!mayExecute) {
    return {
      redirectPath: `/ventures/${scope.ventureId}/work/${workOrderId}`,
    };
  }

  const [customer, site, asset] = await Promise.all([
    getCustomerQuery({ ...scope, id: workOrder.customerId }),
    getSiteQuery({ ...scope, id: workOrder.siteId }),
    workOrder.primaryAssetId
      ? getAssetQuery({ ...scope, id: workOrder.primaryAssetId })
      : Promise.resolve({ record: null as FrigoraAsset | null }),
  ]);

  return {
    view: {
      workOrder,
      customer: customer.record ?? null,
      site: site.record ?? null,
      asset: asset.record ?? null,
    },
  };
}

export async function loadVisitRecorder(
  scope: Scope,
  workOrderId: string,
  visitId: string,
  sessionUserId: string,
  canWrite: boolean,
): Promise<{ error?: string; view: VisitRecorderView | null }> {
  const visitResult = await getVisitQuery({ ...scope, id: visitId });
  if (visitResult.error) {
    return { error: visitResult.error, view: null };
  }
  const visit = visitResult.record;
  if (!visit || visit.workOrderId !== workOrderId) {
    return { view: null };
  }

  const workResult = await getWorkOrderQuery({ ...scope, id: workOrderId });
  if (workResult.error) {
    return { error: workResult.error, view: null };
  }
  const workOrder = workResult.record;
  if (!workOrder) {
    return { view: null };
  }

  const visitsResult = await listVisitsByWorkOrderQuery({
    ...scope,
    workOrderId: workOrder.id,
  });
  const allVisits = visitsResult.record ?? [];
  const otherOpenVisits = allVisits.filter(
    (row) => row.status === "open" && row.id !== visit.id,
  );

  const [
    customer,
    site,
    asset,
    assignee,
    attending,
    capturesResult,
    findingsResult,
    correctiveResult,
    partsResult,
    refrigerantResult,
    outcomeResult,
    recommendedResult,
    acknowledgementsResult,
  ] = await Promise.all([
    getCustomerQuery({ ...scope, id: workOrder.customerId }),
    getSiteQuery({ ...scope, id: workOrder.siteId }),
    workOrder.primaryAssetId
      ? getAssetQuery({ ...scope, id: workOrder.primaryAssetId })
      : Promise.resolve({ record: null as FrigoraAsset | null }),
    resolveUserDisplay(workOrder.assignedUserId),
    resolveUserDisplay(visit.attendingUserId),
    listFieldCapturesByVisitQuery({ ...scope, visitId: visit.id }),
    listTechnicalFindingsByVisitQuery({ ...scope, visitId: visit.id }),
    listCorrectiveActionsByVisitQuery({ ...scope, visitId: visit.id }),
    listPartUsagesByVisitQuery({ ...scope, visitId: visit.id }),
    listRefrigerantEventsByVisitQuery({ ...scope, visitId: visit.id }),
    getVisitOutcomeByVisitQuery({ ...scope, visitId: visit.id }),
    listRecommendedActionsByVisitQuery({ ...scope, visitId: visit.id }),
    listVisitCustomerAcknowledgementsByVisitQuery({ ...scope, visitId: visit.id }),
  ]);

  let currentOperationalCondition: FrigoraAssetOperationalCondition | null = null;
  let visitOperationalConditions: FrigoraAssetOperationalCondition[] = [];
  if (workOrder.primaryAssetId) {
    const [currentResult, historyResult] = await Promise.all([
      getCurrentAssetOperationalConditionQuery({
        ...scope,
        assetId: workOrder.primaryAssetId,
      }),
      listAssetOperationalConditionsByAssetQuery({
        ...scope,
        assetId: workOrder.primaryAssetId,
      }),
    ]);
    currentOperationalCondition = currentResult.record ?? null;
    visitOperationalConditions = (historyResult.record ?? []).filter(
      (row) => row.visitId === visit.id,
    );
  }

  const assignedToMe = workOrder.assignedUserId === sessionUserId;
  const canRecord =
    canWrite && visit.status === "open" && assignedToMe;

  return {
    view: {
      workOrder,
      customer: customer.record ?? null,
      site: site.record ?? null,
      asset: asset.record ?? null,
      assignee,
      visit,
      attending,
      otherOpenVisits,
      fieldCaptures: capturesResult.record ?? [],
      technicalFindings: findingsResult.record ?? [],
      correctiveActions: correctiveResult.record ?? [],
      partUsages: partsResult.record ?? [],
      refrigerantEvents: refrigerantResult.record ?? [],
      visitOutcome: outcomeResult.record ?? null,
      recommendedActions: recommendedResult.record ?? [],
      acknowledgements: acknowledgementsResult.record ?? [],
      currentOperationalCondition,
      visitOperationalConditions,
      canRecord,
    },
  };
}

export async function loadWorkOrderList(
  scope: Scope,
  filters: WorkListFilters = { status: "all", assignment: "all" },
): Promise<{
  error?: string;
  rows: WorkOrderListRow[];
}> {
  const result =
    filters.status === "all"
      ? await listWorkOrdersQuery(scope)
      : await listWorkOrdersQuery({ ...scope, status: filters.status });
  if (result.error) {
    return { error: result.error, rows: [] };
  }

  let workOrders = result.record ?? [];
  if (filters.assignment === "assigned") {
    workOrders = workOrders.filter((workOrder) => workOrder.assignedUserId !== null);
  } else if (filters.assignment === "unassigned") {
    workOrders = workOrders.filter((workOrder) => workOrder.assignedUserId === null);
  }

  const rows: WorkOrderListRow[] = [];
  for (const workOrder of workOrders) {
    const visitsResult = await listVisitsByWorkOrderQuery({
      ...scope,
      workOrderId: workOrder.id,
    });
    if (visitsResult.error) {
      return { error: visitsResult.error, rows: [] };
    }
    const visits = visitsResult.record ?? [];

    const [customer, site, asset, assignee] = await Promise.all([
      getCustomerQuery({ ...scope, id: workOrder.customerId }),
      getSiteQuery({ ...scope, id: workOrder.siteId }),
      workOrder.primaryAssetId
        ? getAssetQuery({ ...scope, id: workOrder.primaryAssetId })
        : Promise.resolve({ record: null as FrigoraAsset | null }),
      resolveUserDisplay(workOrder.assignedUserId),
    ]);
    rows.push({
      workOrder,
      customer: customer.record ?? null,
      site: site.record ?? null,
      asset: asset.record ?? null,
      assignee,
      visitCount: visits.length,
      hasActiveVisit: hasActiveVisit(visits),
      latestVisit: selectLatestVisit(visits),
    });
  }
  return { rows };
}

async function loadVisitsForWorkOrders(
  scope: Scope,
  workOrders: FrigoraWorkOrder[],
): Promise<Map<string, FrigoraVisit[]>> {
  const visitsByWorkOrderId = new Map<string, FrigoraVisit[]>();
  await Promise.all(
    workOrders.map(async (workOrder) => {
      const visitsResult = await listVisitsByWorkOrderQuery({
        ...scope,
        workOrderId: workOrder.id,
      });
      visitsByWorkOrderId.set(workOrder.id, visitsResult.record ?? []);
    }),
  );
  return visitsByWorkOrderId;
}

async function buildRecentActivity(scope: Scope): Promise<OperationalActivityEvent[]> {
  const workOrdersResult = await listWorkOrdersQuery(scope);
  if (workOrdersResult.error) {
    return [];
  }

  const workOrders = workOrdersResult.record ?? [];
  const events: OperationalActivityEvent[] = [];

  await Promise.all(
    workOrders.map(async (workOrder) => {
      events.push({
        kind: "work_order_created",
        occurredAt: workOrder.createdAt,
        sourceId: workOrder.id,
        workOrderId: workOrder.id,
        workOrderReference: workOrder.workReference,
        visitId: null,
        assetId: workOrder.primaryAssetId,
        label: "Work order created",
        detail: null,
      });

      const [
        visitsResult,
        capturesResult,
        findingsResult,
        correctiveResult,
        partsResult,
        refrigerantResult,
        outcomesResult,
        recommendedResult,
        acknowledgementsResult,
      ] = await Promise.all([
        listVisitsByWorkOrderQuery({ ...scope, workOrderId: workOrder.id }),
        listFieldCapturesByWorkOrderQuery({ ...scope, workOrderId: workOrder.id }),
        listTechnicalFindingsByWorkOrderQuery({ ...scope, workOrderId: workOrder.id }),
        listCorrectiveActionsByWorkOrderQuery({ ...scope, workOrderId: workOrder.id }),
        listPartUsagesByWorkOrderQuery({ ...scope, workOrderId: workOrder.id }),
        listRefrigerantEventsByWorkOrderQuery({ ...scope, workOrderId: workOrder.id }),
        listVisitOutcomesByWorkOrderQuery({ ...scope, workOrderId: workOrder.id }),
        listRecommendedActionsByWorkOrderQuery({ ...scope, workOrderId: workOrder.id }),
        listVisitCustomerAcknowledgementsByWorkOrderQuery({
          ...scope,
          workOrderId: workOrder.id,
        }),
      ]);

      for (const visit of visitsResult.record ?? []) {
        events.push({
          kind: "visit_arrived",
          occurredAt: visit.arrivedAt,
          sourceId: visit.id,
          workOrderId: workOrder.id,
          workOrderReference: workOrder.workReference,
          visitId: visit.id,
          assetId: workOrder.primaryAssetId,
          label: "Visit arrived",
          detail: null,
        });
        if (visit.departedAt !== null) {
          events.push({
            kind: "visit_departed",
            occurredAt: visit.departedAt,
            sourceId: visit.id,
            workOrderId: workOrder.id,
            workOrderReference: workOrder.workReference,
            visitId: visit.id,
            assetId: workOrder.primaryAssetId,
            label: "Visit departed",
            detail: null,
          });
        }
      }

      for (const row of capturesResult.record ?? []) {
        events.push({
          kind: "field_capture_observed",
          occurredAt: row.observedAt,
          sourceId: row.id,
          workOrderId: workOrder.id,
          workOrderReference: workOrder.workReference,
          visitId: row.visitId,
          assetId: row.assetId,
          label: "Observation recorded",
          detail: row.description,
        });
      }

      for (const row of findingsResult.record ?? []) {
        events.push({
          kind: "technical_finding_recorded",
          occurredAt: row.assertedAt,
          sourceId: row.id,
          workOrderId: workOrder.id,
          workOrderReference: workOrder.workReference,
          visitId: row.visitId,
          assetId: row.assetId,
          label: "Finding recorded",
          detail: row.description,
        });
      }

      for (const row of correctiveResult.record ?? []) {
        events.push({
          kind: "corrective_action_recorded",
          occurredAt: row.performedAt,
          sourceId: row.id,
          workOrderId: workOrder.id,
          workOrderReference: workOrder.workReference,
          visitId: row.visitId,
          assetId: row.assetId,
          label: "Corrective action recorded",
          detail: row.description,
        });
      }

      for (const row of partsResult.record ?? []) {
        events.push({
          kind: "part_usage_recorded",
          occurredAt: row.usedAt,
          sourceId: row.id,
          workOrderId: workOrder.id,
          workOrderReference: workOrder.workReference,
          visitId: row.visitId,
          assetId: row.assetId,
          label: "Part usage recorded",
          detail: row.partDescription,
        });
      }

      for (const row of refrigerantResult.record ?? []) {
        events.push({
          kind: "refrigerant_event_recorded",
          occurredAt: row.occurredAt,
          sourceId: row.id,
          workOrderId: workOrder.id,
          workOrderReference: workOrder.workReference,
          visitId: row.visitId,
          assetId: row.assetId,
          label: "Refrigerant event recorded",
          detail: `${row.eventKind}: ${row.quantityKg} kg ${row.refrigerantType}`,
        });
      }

      for (const row of outcomesResult.record ?? []) {
        events.push({
          kind: "visit_outcome_recorded",
          occurredAt: row.outcomeAt,
          sourceId: row.id,
          workOrderId: workOrder.id,
          workOrderReference: workOrder.workReference,
          visitId: row.visitId,
          assetId: row.assetId,
          label: "Visit outcome recorded",
          detail: row.description,
        });
      }

      for (const row of recommendedResult.record ?? []) {
        events.push({
          kind: "recommended_action_recorded",
          occurredAt: row.recommendedAt,
          sourceId: row.id,
          workOrderId: workOrder.id,
          workOrderReference: workOrder.workReference,
          visitId: row.visitId,
          assetId: row.assetId,
          label: "Recommendation recorded",
          detail: row.description,
        });
      }

      for (const row of acknowledgementsResult.record ?? []) {
        events.push({
          kind: "customer_acknowledgement_recorded",
          occurredAt: row.acknowledgedAt,
          sourceId: row.id,
          workOrderId: workOrder.id,
          workOrderReference: workOrder.workReference,
          visitId: row.visitId,
          assetId: null,
          label: "Acknowledgement recorded",
          detail: row.acknowledgementText,
        });
      }

      if (workOrder.primaryAssetId) {
        const conditionsResult = await listAssetOperationalConditionsByAssetQuery({
          ...scope,
          assetId: workOrder.primaryAssetId,
        });
        for (const row of conditionsResult.record ?? []) {
          if (row.workOrderId !== workOrder.id) {
            continue;
          }
          events.push({
            kind: "asset_operational_condition_recorded",
            occurredAt: row.assertedAt,
            sourceId: row.id,
            workOrderId: workOrder.id,
            workOrderReference: workOrder.workReference,
            visitId: row.visitId,
            assetId: row.assetId,
            label: "Operational condition recorded",
            detail: row.conditionKind,
          });
        }
      }
    }),
  );

  return takeRecentActivity(events);
}

export async function loadOperationsOverview(scope: Scope): Promise<{
  error?: string;
  view: OperationsOverviewView;
}> {
  const openResult = await listWorkOrdersQuery({ ...scope, status: "open" });
  if (openResult.error) {
    return {
      error: openResult.error,
      view: {
        counts: {
          openWork: 0,
          assignedOpen: 0,
          unassignedOpen: 0,
          activeVisits: 0,
          visitedStillOpen: 0,
        },
        attention: [],
        recentActivity: [],
      },
    };
  }

  const openWorkOrders = openResult.record ?? [];
  const visitsByWorkOrderId = await loadVisitsForWorkOrders(scope, openWorkOrders);
  const counts = computeOperationsCounts(openWorkOrders, visitsByWorkOrderId);

  const attentionCandidates = openWorkOrders
    .map((workOrder) => {
      const visits = visitsByWorkOrderId.get(workOrder.id) ?? [];
      const signals = deriveAttentionSignals(workOrder, visits);
      if (signals.length === 0) {
        return null;
      }
      return { workOrder, visits, signals };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null)
    .sort((left, right) => {
      if (left.workOrder.workReference !== right.workOrder.workReference) {
        return left.workOrder.workReference < right.workOrder.workReference ? -1 : 1;
      }
      return left.workOrder.id < right.workOrder.id ? -1 : 1;
    });

  const attention: OperationalAttentionItem[] = [];
  for (const candidate of attentionCandidates) {
    const [customer, site, assignee] = await Promise.all([
      getCustomerQuery({ ...scope, id: candidate.workOrder.customerId }),
      getSiteQuery({ ...scope, id: candidate.workOrder.siteId }),
      resolveUserDisplay(candidate.workOrder.assignedUserId),
    ]);
    attention.push({
      workOrder: candidate.workOrder,
      customer: customer.record ?? null,
      site: site.record ?? null,
      assignee,
      signals: candidate.signals,
    });
  }

  const recentActivity = await buildRecentActivity(scope);

  return {
    view: {
      counts,
      attention,
      recentActivity,
    },
  };
}

export { ATTENTION_SIGNAL_LABELS };

export async function loadWorkOrderDetail(
  scope: Scope,
  workOrderId: string,
): Promise<{ error?: string; view: WorkOrderDetailView | null }> {
  const workResult = await getWorkOrderQuery({ ...scope, id: workOrderId });
  if (workResult.error) {
    return { error: workResult.error, view: null };
  }
  const workOrder = workResult.record;
  if (!workOrder) {
    return { view: null };
  }

  const [customer, site, asset, assignee, visitsResult, recommendationsResult] =
    await Promise.all([
      getCustomerQuery({ ...scope, id: workOrder.customerId }),
      getSiteQuery({ ...scope, id: workOrder.siteId }),
      workOrder.primaryAssetId
        ? getAssetQuery({ ...scope, id: workOrder.primaryAssetId })
        : Promise.resolve({ record: null as FrigoraAsset | null }),
      resolveUserDisplay(workOrder.assignedUserId),
      listVisitsByWorkOrderQuery({ ...scope, workOrderId: workOrder.id }),
      listRecommendedActionsByWorkOrderQuery({ ...scope, workOrderId: workOrder.id }),
    ]);

  if (visitsResult.error) {
    return { error: visitsResult.error, view: null };
  }

  const visits = visitsResult.record ?? [];
  const latestVisit = selectLatestVisit(visits);
  const attentionSignals = deriveAttentionSignals(workOrder, visits);

  let currentOperationalCondition: FrigoraAssetOperationalCondition | null = null;
  if (workOrder.primaryAssetId) {
    const conditionResult = await getCurrentAssetOperationalConditionQuery({
      ...scope,
      assetId: workOrder.primaryAssetId,
    });
    currentOperationalCondition = conditionResult.record ?? null;
  }

  const visitAttendees: Record<string, UserDisplay | null> = {};
  const visitFacts: VisitFactsView[] = [];
  for (const visit of visits) {
    visitAttendees[visit.id] = await resolveUserDisplay(visit.attendingUserId);
    visitFacts.push(await loadVisitFacts(scope, visit));
  }

  return {
    view: {
      workOrder,
      customer: customer.record ?? null,
      site: site.record ?? null,
      asset: asset.record ?? null,
      assignee,
      visits,
      visitAttendees,
      visitFacts,
      workOrderRecommendations: recommendationsResult.record ?? [],
      currentOperationalCondition,
      attentionSignals,
      latestVisitId: latestVisit?.id ?? null,
    },
  };
}

export async function loadWorkCreateOptions(scope: Scope): Promise<{
  error?: string;
  options: WorkCreateOptions;
}> {
  const customersResult = await listCustomersQuery(scope);
  if (customersResult.error) {
    return { error: customersResult.error, options: { customers: [] } };
  }

  const customers: WorkCreateOptions["customers"] = [];
  for (const customer of customersResult.record ?? []) {
    if (customer.status !== "active") {
      continue;
    }
    const sitesResult = await listSitesByCustomerQuery({
      ...scope,
      customerId: customer.id,
    });
    if (sitesResult.error) {
      return { error: sitesResult.error, options: { customers: [] } };
    }
    const sites: WorkCreateOptions["customers"][number]["sites"] = [];
    for (const site of sitesResult.record ?? []) {
      if (site.status !== "active") {
        continue;
      }
      const assetsResult = await listAssetsBySiteQuery({
        ...scope,
        siteId: site.id,
      });
      if (assetsResult.error) {
        return { error: assetsResult.error, options: { customers: [] } };
      }
      sites.push({
        site,
        assets: (assetsResult.record ?? []).filter((asset) => asset.status === "active"),
      });
    }
    customers.push({ customer, sites });
  }

  return { options: { customers } };
}
