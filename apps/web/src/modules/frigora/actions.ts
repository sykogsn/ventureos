"use server";

import { getSession } from "@/lib/auth/session";
import { isFrigoraError } from "./errors";
import { createScope, getFrigoraService } from "./service";
import type {
  AssignWorkOrderInput,
  CreateAssetInput,
  CreateCustomerInput,
  CreateSiteInput,
  CreateWorkOrderInput,
  FrigoraAsset,
  FrigoraAssetId,
  FrigoraCustomer,
  FrigoraCustomerId,
  FrigoraSite,
  FrigoraSiteId,
  FrigoraWorkOrder,
  FrigoraWorkOrderId,
  FrigoraVisit,
  FrigoraVisitId,
  RecordVisitArrivalInput,
  RecordVisitDepartureInput,
  UpdateAssetInput,
  UpdateCustomerInput,
  UpdateSiteInput,
  UpdateWorkOrderInput,
} from "./types";
import { parseWithFrigora, scopeSchema } from "./validation";

export type FrigoraMutationResult<T> = {
  error?: string;
  record?: T;
};

type ScopedInput = {
  workspaceId: string;
  ventureId: string;
};

async function mutate<T>(
  input: ScopedInput,
  run: (scope: ReturnType<typeof createScope>) => Promise<T>,
): Promise<FrigoraMutationResult<T>> {
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

export async function createCustomerAction(
  input: ScopedInput & CreateCustomerInput,
): Promise<FrigoraMutationResult<FrigoraCustomer>> {
  return mutate(input, (scope) => getFrigoraService().createCustomer(scope, input));
}

export async function updateCustomerAction(
  input: ScopedInput & { id: string } & UpdateCustomerInput,
): Promise<FrigoraMutationResult<FrigoraCustomer>> {
  return mutate(input, (scope) =>
    getFrigoraService().updateCustomer(scope, input.id as FrigoraCustomerId, input),
  );
}

export async function archiveCustomerAction(
  input: ScopedInput & { id: string },
): Promise<FrigoraMutationResult<FrigoraCustomer>> {
  return mutate(input, (scope) =>
    getFrigoraService().archiveCustomer(scope, input.id as FrigoraCustomerId),
  );
}

export async function createSiteAction(
  input: ScopedInput & CreateSiteInput,
): Promise<FrigoraMutationResult<FrigoraSite>> {
  return mutate(input, (scope) => getFrigoraService().createSite(scope, input));
}

export async function updateSiteAction(
  input: ScopedInput & { id: string } & UpdateSiteInput,
): Promise<FrigoraMutationResult<FrigoraSite>> {
  return mutate(input, (scope) =>
    getFrigoraService().updateSite(scope, input.id as FrigoraSiteId, input),
  );
}

export async function archiveSiteAction(
  input: ScopedInput & { id: string },
): Promise<FrigoraMutationResult<FrigoraSite>> {
  return mutate(input, (scope) =>
    getFrigoraService().archiveSite(scope, input.id as FrigoraSiteId),
  );
}

export async function createAssetAction(
  input: ScopedInput & CreateAssetInput,
): Promise<FrigoraMutationResult<FrigoraAsset>> {
  return mutate(input, (scope) => getFrigoraService().createAsset(scope, input));
}

export async function updateAssetAction(
  input: ScopedInput & { id: string } & UpdateAssetInput,
): Promise<FrigoraMutationResult<FrigoraAsset>> {
  return mutate(input, (scope) =>
    getFrigoraService().updateAsset(scope, input.id as FrigoraAssetId, input),
  );
}

export async function decommissionAssetAction(
  input: ScopedInput & { id: string },
): Promise<FrigoraMutationResult<FrigoraAsset>> {
  return mutate(input, (scope) =>
    getFrigoraService().decommissionAsset(scope, input.id as FrigoraAssetId),
  );
}

export async function createWorkOrderAction(
  input: ScopedInput & CreateWorkOrderInput,
): Promise<FrigoraMutationResult<FrigoraWorkOrder>> {
  return mutate(input, (scope) => getFrigoraService().createWorkOrder(scope, input));
}

export async function updateWorkOrderAction(
  input: ScopedInput & { id: string } & UpdateWorkOrderInput,
): Promise<FrigoraMutationResult<FrigoraWorkOrder>> {
  return mutate(input, (scope) =>
    getFrigoraService().updateWorkOrder(scope, input.id as FrigoraWorkOrderId, input),
  );
}

export async function closeWorkOrderAction(
  input: ScopedInput & { id: string },
): Promise<FrigoraMutationResult<FrigoraWorkOrder>> {
  return mutate(input, (scope) =>
    getFrigoraService().closeWorkOrder(scope, input.id as FrigoraWorkOrderId),
  );
}

export async function cancelWorkOrderAction(
  input: ScopedInput & { id: string },
): Promise<FrigoraMutationResult<FrigoraWorkOrder>> {
  return mutate(input, (scope) =>
    getFrigoraService().cancelWorkOrder(scope, input.id as FrigoraWorkOrderId),
  );
}

export async function reopenWorkOrderAction(
  input: ScopedInput & { id: string },
): Promise<FrigoraMutationResult<FrigoraWorkOrder>> {
  return mutate(input, (scope) =>
    getFrigoraService().reopenWorkOrder(scope, input.id as FrigoraWorkOrderId),
  );
}

export async function assignWorkOrderAction(
  input: ScopedInput & { id: string } & AssignWorkOrderInput,
): Promise<FrigoraMutationResult<FrigoraWorkOrder>> {
  return mutate(input, (scope) =>
    getFrigoraService().assignWorkOrder(scope, input.id as FrigoraWorkOrderId, input),
  );
}

export async function clearWorkOrderAssignmentAction(
  input: ScopedInput & { id: string },
): Promise<FrigoraMutationResult<FrigoraWorkOrder>> {
  return mutate(input, (scope) =>
    getFrigoraService().clearWorkOrderAssignment(scope, input.id as FrigoraWorkOrderId),
  );
}

export async function recordVisitArrivalAction(
  input: ScopedInput & { workOrderId: string } & RecordVisitArrivalInput,
): Promise<FrigoraMutationResult<FrigoraVisit>> {
  return mutate(input, (scope) =>
    getFrigoraService().recordVisitArrival(
      scope,
      input.workOrderId as FrigoraWorkOrderId,
      input,
    ),
  );
}

export async function recordVisitDepartureAction(
  input: ScopedInput & { id: string } & RecordVisitDepartureInput,
): Promise<FrigoraMutationResult<FrigoraVisit>> {
  return mutate(input, (scope) =>
    getFrigoraService().recordVisitDeparture(scope, input.id as FrigoraVisitId, input),
  );
}

export async function cancelVisitAction(
  input: ScopedInput & { id: string },
): Promise<FrigoraMutationResult<FrigoraVisit>> {
  return mutate(input, (scope) =>
    getFrigoraService().cancelVisit(scope, input.id as FrigoraVisitId),
  );
}
