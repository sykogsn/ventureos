"use client";

import { useActionState } from "react";
import { Button } from "@repo/ui/button";
import { Form, Stack } from "@/core/layout";
import {
  closeWorkOrderFormAction,
  reopenWorkOrderFormAction,
  type OfficeFormState,
} from "@/modules/frigora/app/mutation-actions";

export function WorkOrderLifecycleControls({
  workspaceId,
  ventureId,
  workOrderId,
  status,
  canWrite,
}: {
  workspaceId: string;
  ventureId: string;
  workOrderId: string;
  status: "open" | "closed" | "cancelled";
  canWrite: boolean;
}) {
  const [closeState, closeAction, closePending] = useActionState(
    closeWorkOrderFormAction,
    {} as OfficeFormState,
  );
  const [reopenState, reopenAction, reopenPending] = useActionState(
    reopenWorkOrderFormAction,
    {} as OfficeFormState,
  );

  if (!canWrite) {
    return (
      <p className="ids-caption text-muted">
        Work order lifecycle changes require venture update permission.
      </p>
    );
  }

  if (status === "cancelled") {
    return null;
  }

  return (
    <Stack gap="tight">
      <p className="ids-caption text-muted">
        Visit departure does not close the work order. Closing records the work order
        lifecycle state only.
      </p>
      {status === "open" ? (
        <Form action={closeAction} gap="tight">
          <input type="hidden" name="workspaceId" value={workspaceId} />
          <input type="hidden" name="ventureId" value={ventureId} />
          <input type="hidden" name="workOrderId" value={workOrderId} />
          {closeState.error ? (
            <p className="ids-caption text-danger" role="alert">
              {closeState.error}
            </p>
          ) : null}
          <Button type="submit" variant="secondary" disabled={closePending}>
            {closePending ? "Closing…" : "Close work order"}
          </Button>
        </Form>
      ) : (
        <Form action={reopenAction} gap="tight">
          <input type="hidden" name="workspaceId" value={workspaceId} />
          <input type="hidden" name="ventureId" value={ventureId} />
          <input type="hidden" name="workOrderId" value={workOrderId} />
          {reopenState.error ? (
            <p className="ids-caption text-danger" role="alert">
              {reopenState.error}
            </p>
          ) : null}
          <Button type="submit" variant="secondary" disabled={reopenPending}>
            {reopenPending ? "Reopening…" : "Reopen work order"}
          </Button>
        </Form>
      )}
    </Stack>
  );
}
