"use client";

import { useActionState } from "react";
import { Button } from "@repo/ui/button";
import { Field, Form, Stack } from "@/core/layout";
import {
  cancelWorkOrderFormAction,
  closeWorkOrderFormAction,
  reopenWorkOrderFormAction,
  type OfficeFormState,
} from "@/modules/frigora/app/mutation-actions";

export function WorkOrderLifecycleControls({
  workspaceId,
  ventureId,
  workOrderId,
  status,
  cancellationReason,
  canWrite,
}: {
  workspaceId: string;
  ventureId: string;
  workOrderId: string;
  status: "open" | "closed" | "cancelled";
  cancellationReason: string | null;
  canWrite: boolean;
}) {
  const [closeState, closeAction, closePending] = useActionState(
    closeWorkOrderFormAction,
    {} as OfficeFormState,
  );
  const [cancelState, cancelAction, cancelPending] = useActionState(
    cancelWorkOrderFormAction,
    {} as OfficeFormState,
  );
  const [reopenState, reopenAction, reopenPending] = useActionState(
    reopenWorkOrderFormAction,
    {} as OfficeFormState,
  );

  if (!canWrite && status !== "cancelled") {
    return (
      <p className="ids-caption text-muted">
        Work order lifecycle changes require venture update permission.
      </p>
    );
  }

  if (status === "cancelled") {
    return (
      <Stack gap="tight">
        <p className="ids-body">This work order is cancelled and cannot be reopened.</p>
        <p className="ids-body whitespace-pre-wrap">
          Cancellation reason: {cancellationReason ?? "—"}
        </p>
      </Stack>
    );
  }

  if (!canWrite) {
    return (
      <p className="ids-caption text-muted">
        Work order lifecycle changes require venture update permission.
      </p>
    );
  }

  return (
    <Stack gap="compact">
      <p className="ids-caption text-muted">
        Visit departure does not complete the work order. Completion is an explicit
        office action after a departed visit has a visit outcome.
      </p>
      {status === "open" ? (
        <>
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
              {closePending ? "Completing…" : "Complete Work Order"}
            </Button>
          </Form>
          <Form action={cancelAction} gap="tight">
            <input type="hidden" name="workspaceId" value={workspaceId} />
            <input type="hidden" name="ventureId" value={ventureId} />
            <input type="hidden" name="workOrderId" value={workOrderId} />
            <Field>
              Cancellation reason
              <textarea
                name="reason"
                rows={3}
                required
                defaultValue={cancelState.values?.reason ?? ""}
                className="vos-field"
                placeholder="Why this work order is being cancelled"
              />
            </Field>
            {cancelState.error ? (
              <p className="ids-caption text-danger" role="alert">
                {cancelState.error}
              </p>
            ) : null}
            <Button type="submit" variant="secondary" disabled={cancelPending}>
              {cancelPending ? "Cancelling…" : "Cancel Work Order"}
            </Button>
          </Form>
        </>
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
            {reopenPending ? "Reopening…" : "Reopen"}
          </Button>
        </Form>
      )}
    </Stack>
  );
}
