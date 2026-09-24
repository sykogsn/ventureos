"use client";

import { useActionState, useState } from "react";
import { Button } from "@repo/ui/button";
import { Field, Form, Stack } from "@/core/layout";
import {
  recordPartUsageFormAction,
  type FieldFormState,
} from "@/modules/frigora/app/field-mutation-actions";
import {
  FRIGORA_PART_USAGE_UNITS,
  type FrigoraPartReference,
  type FrigoraPartUsageUnit,
} from "@/modules/frigora/types";

const UNLISTED = "__unlisted__";

export function RecordPartUsageForm({
  workspaceId,
  ventureId,
  workOrderId,
  visitId,
  primaryAssetId,
  activePartReferences = [],
}: {
  workspaceId: string;
  ventureId: string;
  workOrderId: string;
  visitId: string;
  primaryAssetId?: string | null;
  activePartReferences?: FrigoraPartReference[];
}) {
  const [state, formAction, pending] = useActionState(
    recordPartUsageFormAction,
    {} as FieldFormState,
  );
  const initialSelection = state.values?.partReferenceId?.trim()
    ? state.values.partReferenceId
    : UNLISTED;
  const [selection, setSelection] = useState(initialSelection);
  const selectedRef = activePartReferences.find((row) => row.id === selection);
  const unlisted = selection === UNLISTED || !selection;

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
          Part reference
          <select
            name="partReferenceId"
            className="vos-field"
            value={selection}
            onChange={(event) => setSelection(event.target.value)}
          >
            <option value={UNLISTED}>Other / Unlisted Part</option>
            {activePartReferences.map((row) => (
              <option key={row.id} value={row.id}>
                {row.displayName}
              </option>
            ))}
          </select>
        </Field>
        {unlisted ? (
          <Field>
            Part / material description
            <input
              name="partDescription"
              required
              className="vos-field"
              defaultValue={state.values?.partDescription ?? ""}
            />
          </Field>
        ) : (
          <input type="hidden" name="partDescription" value="" />
        )}
        <Field>
          Quantity
          <input
            name="quantity"
            type="number"
            step="any"
            required
            className="vos-field"
            defaultValue={state.values?.quantity ?? ""}
          />
        </Field>
        <Field>
          Unit
          <select
            name="quantityUnit"
            required={unlisted}
            className="vos-field"
            defaultValue={
              state.values?.quantityUnit ??
              selectedRef?.defaultQuantityUnit ??
              ("each" satisfies FrigoraPartUsageUnit)
            }
          >
            {FRIGORA_PART_USAGE_UNITS.map((unit) => (
              <option key={unit} value={unit}>
                {unit}
              </option>
            ))}
          </select>
        </Field>
        <Field>
          Notes (optional)
          <textarea
            name="notes"
            rows={2}
            className="vos-field"
            defaultValue={state.values?.notes ?? ""}
          />
        </Field>
        {state.error ? (
          <p className="ids-caption text-danger" role="alert">
            {state.error}
          </p>
        ) : null}
        <Button type="submit" disabled={pending} className="w-full sm:w-auto">
          {pending ? "Recording…" : "Record part usage"}
        </Button>
      </Stack>
    </Form>
  );
}
