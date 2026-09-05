import type { FrigoraService } from "./service";
import type {
  FrigoraScope,
  FrigoraVisit,
  FrigoraWorkOrder,
  FrigoraWorkOrderId,
} from "./types";

export const TEST_CANCELLATION_REASON = "Customer postponed the call-out.";

const DEFAULT_OUTCOME_AT = "2026-08-28T10:30:00.000Z";
const DEFAULT_DEPARTED_AT = "2026-08-28T11:00:00.000Z";

export async function completeWorkOrderFromVisit(
  service: FrigoraService,
  scope: FrigoraScope,
  workOrderId: FrigoraWorkOrderId,
  visit: FrigoraVisit,
  recordedByUserId: string,
  times?: {
    outcomeAt?: string;
    departedAt?: string;
    description?: string;
  },
): Promise<FrigoraWorkOrder> {
  const outcomeAt = times?.outcomeAt ?? DEFAULT_OUTCOME_AT;
  const departedAt = times?.departedAt ?? DEFAULT_DEPARTED_AT;
  const loaded = await service.getVisit(scope, visit.id);
  let current = loaded ?? visit;
  const existingOutcome = await service.getVisitOutcomeByVisit(scope, current.id);
  if (!existingOutcome) {
    await service.recordVisitOutcome(scope, current.id, {
      description: times?.description ?? "Visit concluded; condition recorded.",
      outcomeAt,
      recordedByUserId,
    });
  }
  if (current.status === "open") {
    current = await service.recordVisitDeparture(scope, current.id, { departedAt });
  }
  return service.closeWorkOrder(scope, workOrderId);
}

export async function departVisitIfOpen(
  service: FrigoraService,
  scope: FrigoraScope,
  visit: FrigoraVisit,
  departedAt = DEFAULT_DEPARTED_AT,
): Promise<FrigoraVisit> {
  const loaded = await service.getVisit(scope, visit.id);
  const current = loaded ?? visit;
  if (current.status !== "open") {
    return current;
  }
  return service.recordVisitDeparture(scope, current.id, { departedAt });
}

export async function cancelWorkOrderAfterDepartingOpenVisit(
  service: FrigoraService,
  scope: FrigoraScope,
  workOrderId: FrigoraWorkOrderId,
  visit?: FrigoraVisit,
  reason = TEST_CANCELLATION_REASON,
): Promise<FrigoraWorkOrder> {
  if (visit) {
    await departVisitIfOpen(service, scope, visit);
  }
  return service.cancelWorkOrder(scope, workOrderId, { reason });
}
