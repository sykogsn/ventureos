"use server";

import { getSession } from "@/lib/auth/session";
import { isFrigoraError } from "./errors";
import { createScope, getFrigoraService } from "./service";
import type {
  FrigoraAsset,
  FrigoraAssetId,
  FrigoraCustomer,
  FrigoraCustomerId,
  FrigoraSite,
  FrigoraSiteId,
  FrigoraWorkOrder,
  FrigoraWorkOrderId,
  FrigoraWorkOrderStatus,
} from "./types";
import type { UserId } from "@/contracts";
import { parseWithFrigora, scopeSchema } from "./validation";

export type FrigoraQueryResult<T> = {
  error?: string;
  record?: T;
};

type ScopedInput = {
  workspaceId: string;
  ventureId: string;
};

async function query<T>(
  input: ScopedInput,
  run: (scope: ReturnType<typeof createScope>) => Promise<T>,
): Promise<FrigoraQueryResult<T>> {
  const session = await getSession();
  if (!session) {
    return { error: "You must be signed in." };
  }

  try {
    parseWithFrigora(scopeSchema, {
      workspaceId: input.workspaceId,
      ventureId: input.ventureId,
    });
    const record = await run(
      createScope({
        userId: session.id,
        workspaceId: input.workspaceId,
        ventureId: input.ventureId,
      }),
    );
    return { record };
  } catch (error) {
    if (isFrigoraError(error)) {
      return { error: error.message };
    }
    throw error;
  }
}

export async function getCustomerQuery(
  input: ScopedInput & { id: string },
): Promise<FrigoraQueryResult<FrigoraCustomer | null>> {
  return query(input, (scope) =>
    getFrigoraService().getCustomer(scope, input.id as FrigoraCustomerId),
  );
}

export async function listCustomersQuery(
  input: ScopedInput,
): Promise<FrigoraQueryResult<FrigoraCustomer[]>> {
  return query(input, (scope) => getFrigoraService().listCustomers(scope));
}

export async function getSiteQuery(
  input: ScopedInput & { id: string },
): Promise<FrigoraQueryResult<FrigoraSite | null>> {
  return query(input, (scope) =>
    getFrigoraService().getSite(scope, input.id as FrigoraSiteId),
  );
}

export async function listSitesByCustomerQuery(
  input: ScopedInput & { customerId: string },
): Promise<FrigoraQueryResult<FrigoraSite[]>> {
  return query(input, (scope) =>
    getFrigoraService().listSitesByCustomer(scope, input.customerId as FrigoraCustomerId),
  );
}

export async function getAssetQuery(
  input: ScopedInput & { id: string },
): Promise<FrigoraQueryResult<FrigoraAsset | null>> {
  return query(input, (scope) =>
    getFrigoraService().getAsset(scope, input.id as FrigoraAssetId),
  );
}

export async function listAssetsBySiteQuery(
  input: ScopedInput & { siteId: string },
): Promise<FrigoraQueryResult<FrigoraAsset[]>> {
  return query(input, (scope) =>
    getFrigoraService().listAssetsBySite(scope, input.siteId as FrigoraSiteId),
  );
}

export async function getWorkOrderQuery(
  input: ScopedInput & { id: string },
): Promise<FrigoraQueryResult<FrigoraWorkOrder | null>> {
  return query(input, (scope) =>
    getFrigoraService().getWorkOrder(scope, input.id as FrigoraWorkOrderId),
  );
}

export async function getWorkOrderByReferenceQuery(
  input: ScopedInput & { workReference: string },
): Promise<FrigoraQueryResult<FrigoraWorkOrder | null>> {
  return query(input, (scope) =>
    getFrigoraService().getWorkOrderByReference(scope, input.workReference),
  );
}

export async function listWorkOrdersQuery(
  input: ScopedInput & { status?: FrigoraWorkOrderStatus },
): Promise<FrigoraQueryResult<FrigoraWorkOrder[]>> {
  return query(input, (scope) => getFrigoraService().listWorkOrders(scope, input.status));
}

export async function listWorkOrdersByCustomerQuery(
  input: ScopedInput & { customerId: string },
): Promise<FrigoraQueryResult<FrigoraWorkOrder[]>> {
  return query(input, (scope) =>
    getFrigoraService().listWorkOrdersByCustomer(
      scope,
      input.customerId as FrigoraCustomerId,
    ),
  );
}

export async function listWorkOrdersBySiteQuery(
  input: ScopedInput & { siteId: string },
): Promise<FrigoraQueryResult<FrigoraWorkOrder[]>> {
  return query(input, (scope) =>
    getFrigoraService().listWorkOrdersBySite(scope, input.siteId as FrigoraSiteId),
  );
}

export async function listWorkOrdersByAssetQuery(
  input: ScopedInput & { assetId: string },
): Promise<FrigoraQueryResult<FrigoraWorkOrder[]>> {
  return query(input, (scope) =>
    getFrigoraService().listWorkOrdersByAsset(scope, input.assetId as FrigoraAssetId),
  );
}

export async function listWorkOrdersByAssigneeQuery(
  input: ScopedInput & { userId: string },
): Promise<FrigoraQueryResult<FrigoraWorkOrder[]>> {
  return query(input, (scope) =>
    getFrigoraService().listWorkOrdersByAssignee(scope, input.userId as UserId),
  );
}
