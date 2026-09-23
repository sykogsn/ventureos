import type { UserId, VentureId, WorkspaceId } from "@/contracts";
import type { SchedulingConflict } from "./errors";

export type EngineerUnavailability = {
  id: string;
  workspaceId: WorkspaceId;
  ventureId: VentureId;
  userId: UserId;
  unavailableStartAt: string;
  unavailableEndAt: string;
  createdByUserId: UserId;
  createdAt: string;
  updatedAt: string;
};

export type UnavailabilityInput = {
  userId: string;
  unavailableStartAt: string;
  unavailableEndAt: string;
};

export type AvailabilityMutationResult = {
  period: EngineerUnavailability | null;
  affectedWorkOrders: SchedulingConflict[];
};
