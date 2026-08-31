"use client";

import { useActionState } from "react";
import { Button } from "@repo/ui/button";
import { Field, Form, Stack } from "@/core/layout";
import {
  recordCustomerAcknowledgementFormAction,
  type FieldFormState,
} from "@/modules/frigora/app/field-mutation-actions";

export function RecordCustomerAcknowledgementForm({
  workspaceId,
  ventureId,
  workOrderId,
  visitId,
}: {
  workspaceId: string;
  ventureId: string;
  workOrderId: string;
  visitId: string;
}) {
  const [state, formAction, pending] = useActionState(
    recordCustomerAcknowledgementFormAction,
    {} as FieldFormState,
  );

  return (
    <Form action={formAction} gap="tight">
      <input type="hidden" name="workspaceId" value={workspaceId} />
      <input type="hidden" name="ventureId" value={ventureId} />
      <input type="hidden" name="workOrderId" value={workOrderId} />
      <input type="hidden" name="visitId" value={visitId} />
      <Stack gap="tight">
        <p className="ids-caption text-muted">
          Customer acknowledgement — not a signature or approval workflow.
        </p>
        <Field>
          Acknowledgement text
          <textarea
            name="acknowledgementText"
            rows={3}
            required
            className="vos-field"
            defaultValue={state.values?.acknowledgementText ?? ""}
          />
        </Field>
        <Field>
          Acknowledger name
          <input
            name="acknowledgerName"
            required
            className="vos-field"
            defaultValue={state.values?.acknowledgerName ?? ""}
          />
        </Field>
        {state.error ? (
          <p className="ids-caption text-danger" role="alert">
            {state.error}
          </p>
        ) : null}
        <Button type="submit" disabled={pending} className="w-full sm:w-auto">
          {pending ? "Recording…" : "Record acknowledgement"}
        </Button>
      </Stack>
    </Form>
  );
}
