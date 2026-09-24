"use client";

import { useActionState } from "react";
import { Button } from "@repo/ui/button";
import { Field, Form, Stack } from "@/core/layout";
import {
  createSiteFormAction,
  type OfficeFormState,
} from "@/modules/frigora/app/mutation-actions";

export function CreateSiteForm({
  workspaceId,
  ventureId,
  customerId,
}: {
  workspaceId: string;
  ventureId: string;
  customerId: string;
}) {
  const [state, formAction, pending] = useActionState(
    createSiteFormAction,
    {} as OfficeFormState,
  );

  return (
    <Form action={formAction} gap="tight">
      <input type="hidden" name="workspaceId" value={workspaceId} />
      <input type="hidden" name="ventureId" value={ventureId} />
      <input type="hidden" name="customerId" value={customerId} />
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
          Name
          <input
            name="name"
            required
            defaultValue={state.values?.name ?? ""}
            className="vos-field"
          />
        </Field>
        <Field>
          Address line 1
          <input
            name="addressLine1"
            defaultValue={state.values?.addressLine1 ?? ""}
            className="vos-field"
          />
        </Field>
        <Field>
          City
          <input
            name="city"
            defaultValue={state.values?.city ?? ""}
            className="vos-field"
          />
        </Field>
        <Field>
          Region
          <input
            name="region"
            defaultValue={state.values?.region ?? ""}
            className="vos-field"
          />
        </Field>
        <Field>
          Postal code
          <input
            name="postalCode"
            defaultValue={state.values?.postalCode ?? ""}
            className="vos-field"
          />
        </Field>
        <Field>
          Country
          <input
            name="country"
            defaultValue={state.values?.country ?? ""}
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
          {pending ? "Creating…" : "Create site"}
        </Button>
      </Stack>
    </Form>
  );
}
