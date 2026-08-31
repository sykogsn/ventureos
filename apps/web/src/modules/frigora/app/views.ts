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
  listCustomersQuery,
  listFieldCapturesByVisitQuery,
  listPartUsagesByVisitQuery,
  listRecommendedActionsByVisitQuery,
  listRefrigerantEventsByVisitQuery,
  listSitesByCustomerQuery,
  listTechnicalFindingsByVisitQuery,
  listVisitCustomerAcknowledgementsByVisitQuery,
  listVisitsByWorkOrderQuery,
  listWorkOrdersByAssigneeQuery,
  listWorkOrdersQuery,
} from "@/modules/frigora/queries";
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
} from "@/modules/frigora/types";
import type { UserId } from "@/contracts";

type Scope = { workspaceId: string; ventureId: string };

export type UserDisplay = {
  id: string;
  name: string;
  email: string;
};

export type WorkOrderListRow = {
  workOrder: FrigoraWorkOrder;
  customer: FrigoraCustomer | null;
  site: FrigoraSite | null;
  asset: FrigoraAsset | null;
  assignee: UserDisplay | null;
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

export async function loadWorkOrderList(scope: Scope): Promise<{
  error?: string;
  rows: WorkOrderListRow[];
}> {
  const result = await listWorkOrdersQuery(scope);
  if (result.error) {
    return { error: result.error, rows: [] };
  }
  const workOrders = result.record ?? [];
  const rows: WorkOrderListRow[] = [];
  for (const workOrder of workOrders) {
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
    });
  }
  return { rows };
}

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

  const [customer, site, asset, assignee, visitsResult] = await Promise.all([
    getCustomerQuery({ ...scope, id: workOrder.customerId }),
    getSiteQuery({ ...scope, id: workOrder.siteId }),
    workOrder.primaryAssetId
      ? getAssetQuery({ ...scope, id: workOrder.primaryAssetId })
      : Promise.resolve({ record: null as FrigoraAsset | null }),
    resolveUserDisplay(workOrder.assignedUserId),
    listVisitsByWorkOrderQuery({ ...scope, workOrderId: workOrder.id }),
  ]);

  if (visitsResult.error) {
    return { error: visitsResult.error, view: null };
  }

  const visits = visitsResult.record ?? [];
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
