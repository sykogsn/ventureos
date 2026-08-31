"use client";

import { useActionState } from "react";
import { Button } from "@repo/ui/button";
import { Field, Form, Stack } from "@/core/layout";
import {
  recordTechnicalFindingFormAction,
  type FieldFormState,
} from "@/modules/frigora/app/field-mutation-actions";

export function RecordTechnicalFindingForm({
  workspaceId,
  ventureId,
  workOrderId,
  visitId,
  primaryAssetId,
}: {
  workspaceId: string;
  ventureId: string;
  workOrderId: string;
  visitId: string;
  primaryAssetId?: string | null;
}) {
  const [state, formAction, pending] = useActionState(
    recordTechnicalFindingFormAction,
    {} as FieldFormState,
  );

  return (
    <Form action={formAction} gap="tight">
      <input type="hidden" name="workspaceId" value={workspaceId} />
      <input type="hidden" name="ventureId" value={ventureId} />
      <input type="hidden" name="workOrderId" value={workOrderId} />
      <input type="hidden" name="visitId" value={visitId} />
      {primaryAssetId ? (
        <input type="hidden" name="assetId" value={primaryAssetId} />
      ) : null}
      <Stack gap="tight">
        <Field>
          Finding kind
          <select
            name="findingKind"
            required
            className="vos-field"
            defaultValue={state.values?.findingKind ?? "symptom"}
          >
            <option value="symptom">Symptom</option>
            <option value="suspected_fault">Suspected fault</option>
            <option value="confirmed_fault">Confirmed fault</option>
          </select>
        </Field>
        <Field>
          Description
          <textarea
            name="description"
            rows={3}
            required
            className="vos-field"
            defaultValue={state.values?.description ?? ""}
            placeholder="What the technician concluded"
          />
        </Field>
        {state.error ? (
          <p className="ids-caption text-danger" role="alert">
            {state.error}
          </p>
        ) : null}
        <Button type="submit" disabled={pending} className="w-full sm:w-auto">
          {pending ? "Recording…" : "Record finding"}
        </Button>
      </Stack>
    </Form>
  );
}
