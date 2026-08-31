"use client";

import { useActionState, useState } from "react";
import { Button } from "@repo/ui/button";
import { Field, Form, Stack } from "@/core/layout";
import {
  recordFieldCaptureFormAction,
  type FieldFormState,
} from "@/modules/frigora/app/field-mutation-actions";
import {
  FRIGORA_FIELD_CAPTURE_CODES,
  FRIGORA_FIELD_CAPTURE_UNITS,
} from "@/modules/frigora/types";

export function RecordFieldCaptureForm({
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
    recordFieldCaptureFormAction,
    {} as FieldFormState,
  );
  const [captureKind, setCaptureKind] = useState(
    state.values?.captureKind ?? "measurement",
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
          Kind
          <select
            name="captureKind"
            className="vos-field"
            value={captureKind}
            onChange={(event) => setCaptureKind(event.target.value)}
          >
            <option value="measurement">Measurement</option>
            <option value="condition">Condition</option>
          </select>
        </Field>
        <Field>
          Code
          <select
            name="captureCode"
            required
            className="vos-field"
            defaultValue={state.values?.captureCode ?? "temperature"}
          >
            {FRIGORA_FIELD_CAPTURE_CODES.map((code) => (
              <option key={code} value={code}>
                {code.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        </Field>
        {captureKind === "measurement" ? (
          <>
            <Field>
              Value
              <input
                name="valueNumeric"
                type="number"
                step="any"
                required
                className="vos-field"
                defaultValue={state.values?.valueNumeric ?? ""}
              />
            </Field>
            <Field>
              Unit
              <select
                name="valueUnit"
                required
                className="vos-field"
                defaultValue={state.values?.valueUnit ?? "celsius"}
              >
                {FRIGORA_FIELD_CAPTURE_UNITS.map((unit) => (
                  <option key={unit} value={unit}>
                    {unit}
                  </option>
                ))}
              </select>
            </Field>
          </>
        ) : (
          <Field>
            Description
            <textarea
              name="description"
              rows={3}
              required
              className="vos-field"
              defaultValue={state.values?.description ?? ""}
              placeholder="What was observed"
            />
          </Field>
        )}
        {state.error ? (
          <p className="ids-caption text-danger" role="alert">
            {state.error}
          </p>
        ) : null}
        <Button type="submit" disabled={pending} className="w-full sm:w-auto">
          {pending ? "Recording…" : "Record observation"}
        </Button>
      </Stack>
    </Form>
  );
}
