"use client";

import { useActionState } from "react";
import { Button } from "@repo/ui/button";
import { Field, Form, Stack } from "@/core/layout";
import {
  recordRefrigerantEventFormAction,
  type FieldFormState,
} from "@/modules/frigora/app/field-mutation-actions";
import { FRIGORA_REFRIGERANT_EVENT_KINDS } from "@/modules/frigora/types";

const EVENT_LABELS: Record<string, string> = {
  added: "Added",
  recovered: "Recovered",
  removed: "Removed",
};

export function RecordRefrigerantEventForm({
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
    recordRefrigerantEventFormAction,
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
        <p className="ids-caption text-muted">
          Quantity records refrigerant handling only. Added does not mean leaked.
        </p>
        <Field>
          Refrigerant type
          <input
            name="refrigerantType"
            required
            className="vos-field"
            defaultValue={state.values?.refrigerantType ?? ""}
          />
        </Field>
        <Field>
          Event kind
          <select
            name="eventKind"
            required
            className="vos-field"
            defaultValue={state.values?.eventKind ?? "added"}
          >
            {FRIGORA_REFRIGERANT_EVENT_KINDS.map((kind) => (
              <option key={kind} value={kind}>
                {EVENT_LABELS[kind] ?? kind}
              </option>
            ))}
          </select>
        </Field>
        <Field>
          Quantity (kg)
          <input
            name="quantityKg"
            type="number"
            step="any"
            required
            className="vos-field"
            defaultValue={state.values?.quantityKg ?? ""}
          />
        </Field>
        <Field>
          Reason (optional)
          <input
            name="reason"
            className="vos-field"
            defaultValue={state.values?.reason ?? ""}
          />
        </Field>
        <Field>
          Cylinder reference (optional)
          <input
            name="cylinderReference"
            className="vos-field"
            defaultValue={state.values?.cylinderReference ?? ""}
          />
        </Field>
        {state.error ? (
          <p className="ids-caption text-danger" role="alert">
            {state.error}
          </p>
        ) : null}
        <Button type="submit" disabled={pending} className="w-full sm:w-auto">
          {pending ? "Recording…" : "Record refrigerant event"}
        </Button>
      </Stack>
    </Form>
  );
}
