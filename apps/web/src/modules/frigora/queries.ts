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
  FrigoraVisit,
  FrigoraVisitId,
  FrigoraFieldCapture,
  FrigoraFieldCaptureId,
  FrigoraTechnicalFinding,
  FrigoraTechnicalFindingId,
  FrigoraCorrectiveAction,
  FrigoraCorrectiveActionId,
  FrigoraVisitOutcome,
  FrigoraVisitOutcomeId,
  FrigoraRecommendedAction,
  FrigoraRecommendedActionId,
  FrigoraRefrigerantEvent,
  FrigoraRefrigerantEventId,
  FrigoraPartUsage,
  FrigoraPartUsageId,
  FrigoraAssetHistoryEntry,
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

export async function getVisitQuery(
  input: ScopedInput & { id: string },
): Promise<FrigoraQueryResult<FrigoraVisit | null>> {
  return query(input, (scope) =>
    getFrigoraService().getVisit(scope, input.id as FrigoraVisitId),
  );
}

export async function listVisitsByWorkOrderQuery(
  input: ScopedInput & { workOrderId: string },
): Promise<FrigoraQueryResult<FrigoraVisit[]>> {
  return query(input, (scope) =>
    getFrigoraService().listVisitsByWorkOrder(scope, input.workOrderId as FrigoraWorkOrderId),
  );
}

export async function listVisitsByAttendingUserQuery(
  input: ScopedInput & { userId: string },
): Promise<FrigoraQueryResult<FrigoraVisit[]>> {
  return query(input, (scope) =>
    getFrigoraService().listVisitsByAttendingUser(scope, input.userId as UserId),
  );
}

export async function getFieldCaptureQuery(
  input: ScopedInput & { id: string },
): Promise<FrigoraQueryResult<FrigoraFieldCapture | null>> {
  return query(input, (scope) =>
    getFrigoraService().getFieldCapture(scope, input.id as FrigoraFieldCaptureId),
  );
}

export async function listFieldCapturesByVisitQuery(
  input: ScopedInput & { visitId: string },
): Promise<FrigoraQueryResult<FrigoraFieldCapture[]>> {
  return query(input, (scope) =>
    getFrigoraService().listFieldCapturesByVisit(scope, input.visitId as FrigoraVisitId),
  );
}

export async function listFieldCapturesByWorkOrderQuery(
  input: ScopedInput & { workOrderId: string },
): Promise<FrigoraQueryResult<FrigoraFieldCapture[]>> {
  return query(input, (scope) =>
    getFrigoraService().listFieldCapturesByWorkOrder(
      scope,
      input.workOrderId as FrigoraWorkOrderId,
    ),
  );
}

export async function listFieldCapturesByAssetQuery(
  input: ScopedInput & { assetId: string },
): Promise<FrigoraQueryResult<FrigoraFieldCapture[]>> {
  return query(input, (scope) =>
    getFrigoraService().listFieldCapturesByAsset(scope, input.assetId as FrigoraAssetId),
  );
}

export async function getTechnicalFindingQuery(
  input: ScopedInput & { id: string },
): Promise<FrigoraQueryResult<FrigoraTechnicalFinding | null>> {
  return query(input, (scope) =>
    getFrigoraService().getTechnicalFinding(scope, input.id as FrigoraTechnicalFindingId),
  );
}

export async function listTechnicalFindingsByVisitQuery(
  input: ScopedInput & { visitId: string },
): Promise<FrigoraQueryResult<FrigoraTechnicalFinding[]>> {
  return query(input, (scope) =>
    getFrigoraService().listTechnicalFindingsByVisit(scope, input.visitId as FrigoraVisitId),
  );
}

export async function listTechnicalFindingsByWorkOrderQuery(
  input: ScopedInput & { workOrderId: string },
): Promise<FrigoraQueryResult<FrigoraTechnicalFinding[]>> {
  return query(input, (scope) =>
    getFrigoraService().listTechnicalFindingsByWorkOrder(
      scope,
      input.workOrderId as FrigoraWorkOrderId,
    ),
  );
}

export async function listTechnicalFindingsByAssetQuery(
  input: ScopedInput & { assetId: string },
): Promise<FrigoraQueryResult<FrigoraTechnicalFinding[]>> {
  return query(input, (scope) =>
    getFrigoraService().listTechnicalFindingsByAsset(scope, input.assetId as FrigoraAssetId),
  );
}

export async function getCorrectiveActionQuery(
  input: ScopedInput & { id: string },
): Promise<FrigoraQueryResult<FrigoraCorrectiveAction | null>> {
  return query(input, (scope) =>
    getFrigoraService().getCorrectiveAction(scope, input.id as FrigoraCorrectiveActionId),
  );
}

export async function listCorrectiveActionsByVisitQuery(
  input: ScopedInput & { visitId: string },
): Promise<FrigoraQueryResult<FrigoraCorrectiveAction[]>> {
  return query(input, (scope) =>
    getFrigoraService().listCorrectiveActionsByVisit(scope, input.visitId as FrigoraVisitId),
  );
}

export async function listCorrectiveActionsByWorkOrderQuery(
  input: ScopedInput & { workOrderId: string },
): Promise<FrigoraQueryResult<FrigoraCorrectiveAction[]>> {
  return query(input, (scope) =>
    getFrigoraService().listCorrectiveActionsByWorkOrder(
      scope,
      input.workOrderId as FrigoraWorkOrderId,
    ),
  );
}

export async function listCorrectiveActionsByAssetQuery(
  input: ScopedInput & { assetId: string },
): Promise<FrigoraQueryResult<FrigoraCorrectiveAction[]>> {
  return query(input, (scope) =>
    getFrigoraService().listCorrectiveActionsByAsset(scope, input.assetId as FrigoraAssetId),
  );
}

export async function getVisitOutcomeQuery(
  input: ScopedInput & { id: string },
): Promise<FrigoraQueryResult<FrigoraVisitOutcome | null>> {
  return query(input, (scope) =>
    getFrigoraService().getVisitOutcome(scope, input.id as FrigoraVisitOutcomeId),
  );
}

export async function getVisitOutcomeByVisitQuery(
  input: ScopedInput & { visitId: string },
): Promise<FrigoraQueryResult<FrigoraVisitOutcome | null>> {
  return query(input, (scope) =>
    getFrigoraService().getVisitOutcomeByVisit(scope, input.visitId as FrigoraVisitId),
  );
}

export async function listVisitOutcomesByWorkOrderQuery(
  input: ScopedInput & { workOrderId: string },
): Promise<FrigoraQueryResult<FrigoraVisitOutcome[]>> {
  return query(input, (scope) =>
    getFrigoraService().listVisitOutcomesByWorkOrder(
      scope,
      input.workOrderId as FrigoraWorkOrderId,
    ),
  );
}

export async function listVisitOutcomesByAssetQuery(
  input: ScopedInput & { assetId: string },
): Promise<FrigoraQueryResult<FrigoraVisitOutcome[]>> {
  return query(input, (scope) =>
    getFrigoraService().listVisitOutcomesByAsset(scope, input.assetId as FrigoraAssetId),
  );
}

export async function getRecommendedActionQuery(
  input: ScopedInput & { id: string },
): Promise<FrigoraQueryResult<FrigoraRecommendedAction | null>> {
  return query(input, (scope) =>
    getFrigoraService().getRecommendedAction(scope, input.id as FrigoraRecommendedActionId),
  );
}

export async function listRecommendedActionsByVisitQuery(
  input: ScopedInput & { visitId: string },
): Promise<FrigoraQueryResult<FrigoraRecommendedAction[]>> {
  return query(input, (scope) =>
    getFrigoraService().listRecommendedActionsByVisit(scope, input.visitId as FrigoraVisitId),
  );
}

export async function listRecommendedActionsByWorkOrderQuery(
  input: ScopedInput & { workOrderId: string },
): Promise<FrigoraQueryResult<FrigoraRecommendedAction[]>> {
  return query(input, (scope) =>
    getFrigoraService().listRecommendedActionsByWorkOrder(
      scope,
      input.workOrderId as FrigoraWorkOrderId,
    ),
  );
}

export async function listRecommendedActionsByAssetQuery(
  input: ScopedInput & { assetId: string },
): Promise<FrigoraQueryResult<FrigoraRecommendedAction[]>> {
  return query(input, (scope) =>
    getFrigoraService().listRecommendedActionsByAsset(scope, input.assetId as FrigoraAssetId),
  );
}

export async function getRefrigerantEventQuery(
  input: ScopedInput & { id: string },
): Promise<FrigoraQueryResult<FrigoraRefrigerantEvent | null>> {
  return query(input, (scope) =>
    getFrigoraService().getRefrigerantEvent(scope, input.id as FrigoraRefrigerantEventId),
  );
}

export async function listRefrigerantEventsByVisitQuery(
  input: ScopedInput & { visitId: string },
): Promise<FrigoraQueryResult<FrigoraRefrigerantEvent[]>> {
  return query(input, (scope) =>
    getFrigoraService().listRefrigerantEventsByVisit(scope, input.visitId as FrigoraVisitId),
  );
}

export async function listRefrigerantEventsByWorkOrderQuery(
  input: ScopedInput & { workOrderId: string },
): Promise<FrigoraQueryResult<FrigoraRefrigerantEvent[]>> {
  return query(input, (scope) =>
    getFrigoraService().listRefrigerantEventsByWorkOrder(
      scope,
      input.workOrderId as FrigoraWorkOrderId,
    ),
  );
}

export async function listRefrigerantEventsByAssetQuery(
  input: ScopedInput & { assetId: string },
): Promise<FrigoraQueryResult<FrigoraRefrigerantEvent[]>> {
  return query(input, (scope) =>
    getFrigoraService().listRefrigerantEventsByAsset(scope, input.assetId as FrigoraAssetId),
  );
}

export async function getPartUsageQuery(
  input: ScopedInput & { id: string },
): Promise<FrigoraQueryResult<FrigoraPartUsage | null>> {
  return query(input, (scope) =>
    getFrigoraService().getPartUsage(scope, input.id as FrigoraPartUsageId),
  );
}

export async function listPartUsagesByVisitQuery(
  input: ScopedInput & { visitId: string },
): Promise<FrigoraQueryResult<FrigoraPartUsage[]>> {
  return query(input, (scope) =>
    getFrigoraService().listPartUsagesByVisit(scope, input.visitId as FrigoraVisitId),
  );
}

export async function listPartUsagesByWorkOrderQuery(
  input: ScopedInput & { workOrderId: string },
): Promise<FrigoraQueryResult<FrigoraPartUsage[]>> {
  return query(input, (scope) =>
    getFrigoraService().listPartUsagesByWorkOrder(
      scope,
      input.workOrderId as FrigoraWorkOrderId,
    ),
  );
}

export async function listPartUsagesByAssetQuery(
  input: ScopedInput & { assetId: string },
): Promise<FrigoraQueryResult<FrigoraPartUsage[]>> {
  return query(input, (scope) =>
    getFrigoraService().listPartUsagesByAsset(scope, input.assetId as FrigoraAssetId),
  );
}

export async function listAssetHistoryQuery(
  input: ScopedInput & { assetId: string },
): Promise<FrigoraQueryResult<FrigoraAssetHistoryEntry[]>> {
  return query(input, (scope) =>
    getFrigoraService().listAssetHistory(scope, input.assetId as FrigoraAssetId),
  );
}
