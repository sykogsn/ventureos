"use client";

import { useActionState } from "react";
import { Button } from "@repo/ui/button";
import { Form, Stack } from "@/core/layout";
import {
  acceptWorkOrderAssignmentFormAction,
  declineWorkOrderAssignmentFormAction,
  type OfficeFormState,
} from "@/modules/frigora/app/mutation-actions";

export function AssignmentResponseControls({
  workspaceId,
  ventureId,
  workOrderId,
  canRespond,
  acceptedAt,
  declinedAt,
  declineReason,
}: {
  workspaceId: string;
  ventureId: string;
  workOrderId: string;
  canRespond: boolean;
  acceptedAt: string | null;
  declinedAt: string | null;
  declineReason: string | null;
}) {
  const [acceptState, acceptAction, acceptPending] = useActionState(
    acceptWorkOrderAssignmentFormAction,
    {} as OfficeFormState,
  );
  const [declineState, declineAction, declinePending] = useActionState(
    declineWorkOrderAssignmentFormAction,
    {} as OfficeFormState,
  );

  if (acceptedAt) {
    return <p className="ids-caption text-muted">Accepted {acceptedAt}</p>;
  }
  if (declinedAt) {
    return (
      <p className="ids-caption text-muted">
        Declined {declinedAt}: {declineReason}
      </p>
    );
  }
  if (!canRespond) {
    return (
      <p className="ids-caption text-muted">
        The current assignee can respond once a service window is scheduled.
      </p>
    );
  }

  const hidden = (
    <>
      <input type="hidden" name="workspaceId" value={workspaceId} />
      <input type="hidden" name="ventureId" value={ventureId} />
      <input type="hidden" name="workOrderId" value={workOrderId} />
    </>
  );

  return (
    <Stack gap="compact">
      <Form action={acceptAction} gap="tight">
        {hidden}
        {acceptState.error ? (
          <p className="ids-caption text-danger" role="alert">
            {acceptState.error}
          </p>
        ) : null}
        <Button type="submit" disabled={acceptPending}>
          {acceptPending ? "Accepting…" : "Accept assignment"}
        </Button>
      </Form>
      <Form action={declineAction} gap="tight">
        {hidden}
        <label className="ids-caption text-muted" htmlFor={`decline-${workOrderId}`}>
          Decline reason
        </label>
        <textarea
          id={`decline-${workOrderId}`}
          name="reason"
          rows={3}
          required
          className="vos-field"
          defaultValue={declineState.values?.reason ?? ""}
        />
        {declineState.error ? (
          <p className="ids-caption text-danger" role="alert">
            {declineState.error}
          </p>
        ) : null}
        <Button type="submit" variant="secondary" disabled={declinePending}>
          {declinePending ? "Declining…" : "Decline assignment"}
        </Button>
      </Form>
    </Stack>
  );
}
