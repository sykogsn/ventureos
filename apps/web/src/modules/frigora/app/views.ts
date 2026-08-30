import { getPersistence } from "@/platform/persistence/repositories";
import {
  getAssetQuery,
  getCustomerQuery,
  getSiteQuery,
  getWorkOrderQuery,
  listAssetsBySiteQuery,
  listCustomersQuery,
  listSitesByCustomerQuery,
  listVisitsByWorkOrderQuery,
  listWorkOrdersQuery,
} from "@/modules/frigora/queries";
import type {
  FrigoraAsset,
  FrigoraCustomer,
  FrigoraSite,
  FrigoraVisit,
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

export type WorkOrderDetailView = {
  workOrder: FrigoraWorkOrder;
  customer: FrigoraCustomer | null;
  site: FrigoraSite | null;
  asset: FrigoraAsset | null;
  assignee: UserDisplay | null;
  visits: FrigoraVisit[];
  visitAttendees: Record<string, UserDisplay | null>;
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
  for (const visit of visits) {
    visitAttendees[visit.id] = await resolveUserDisplay(visit.attendingUserId);
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
