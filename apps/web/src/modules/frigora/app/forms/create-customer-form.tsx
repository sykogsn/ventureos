"use client";

import { useActionState } from "react";
import { Button } from "@repo/ui/button";
import { Field, Form, Stack } from "@/core/layout";
import {
  createCustomerFormAction,
  type OfficeFormState,
} from "@/modules/frigora/app/mutation-actions";

export function CreateCustomerForm({
  workspaceId,
  ventureId,
}: {
  workspaceId: string;
  ventureId: string;
}) {
  const [state, formAction, pending] = useActionState(
    createCustomerFormAction,
    {} as OfficeFormState,
  );

  return (
    <Form action={formAction} gap="tight">
      <input type="hidden" name="workspaceId" value={workspaceId} />
      <input type="hidden" name="ventureId" value={ventureId} />
      <Stack gap="tight">
        <Field>
          Code
          <input
            name="code"
            required
            defaultValue={state.values?.code ?? ""}
            className="vos-field"
            autoComplete="off"
          />
        </Field>
        <Field>
          Display name
          <input
            name="displayName"
            required
            defaultValue={state.values?.displayName ?? ""}
            className="vos-field"
          />
        </Field>
        <Field>
          Legal name
          <input
            name="legalName"
            defaultValue={state.values?.legalName ?? ""}
            className="vos-field"
          />
        </Field>
        <Field>
          Notes
          <textarea
            name="notes"
            rows={3}
            defaultValue={state.values?.notes ?? ""}
            className="vos-field"
          />
        </Field>
        {state.error ? (
          <p className="ids-caption text-danger" role="alert">
            {state.error}
          </p>
        ) : null}
        <Button type="submit" disabled={pending}>
          {pending ? "Creating…" : "Create customer"}
        </Button>
      </Stack>
    </Form>
  );
}
