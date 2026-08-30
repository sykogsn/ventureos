"use client";

import { useActionState } from "react";
import { Button } from "@repo/ui/button";
import { Form, Stack } from "@/core/layout";
import {
  assignToMeFormAction,
  clearAssignmentFormAction,
  type OfficeFormState,
} from "@/modules/frigora/app/mutation-actions";

export function AssignmentControls({
  workspaceId,
  ventureId,
  workOrderId,
  assignedUserId,
  canWrite,
}: {
  workspaceId: string;
  ventureId: string;
  workOrderId: string;
  assignedUserId: string | null;
  canWrite: boolean;
}) {
  const [assignState, assignAction, assignPending] = useActionState(
    assignToMeFormAction,
    {} as OfficeFormState,
  );
  const [clearState, clearAction, clearPending] = useActionState(
    clearAssignmentFormAction,
    {} as OfficeFormState,
  );

  if (!canWrite) {
    return (
      <p className="ids-caption text-muted">
        Assignment changes require venture update permission.
      </p>
    );
  }

  return (
    <Stack gap="tight">
      {!assignedUserId ? (
        <Form action={assignAction} gap="tight">
          <input type="hidden" name="workspaceId" value={workspaceId} />
          <input type="hidden" name="ventureId" value={ventureId} />
          <input type="hidden" name="workOrderId" value={workOrderId} />
          {assignState.error ? (
            <p className="ids-caption text-danger" role="alert">
              {assignState.error}
            </p>
          ) : null}
          <Button type="submit" disabled={assignPending}>
            {assignPending ? "Assigning…" : "Assign to me"}
          </Button>
        </Form>
      ) : (
        <Form action={clearAction} gap="tight">
          <input type="hidden" name="workspaceId" value={workspaceId} />
          <input type="hidden" name="ventureId" value={ventureId} />
          <input type="hidden" name="workOrderId" value={workOrderId} />
          {clearState.error ? (
            <p className="ids-caption text-danger" role="alert">
              {clearState.error}
            </p>
          ) : null}
          <Button type="submit" variant="secondary" disabled={clearPending}>
            {clearPending ? "Clearing…" : "Clear assignment"}
          </Button>
        </Form>
      )}
    </Stack>
  );
}
