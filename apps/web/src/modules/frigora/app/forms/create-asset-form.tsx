"use client";

import { useActionState } from "react";
import { Button } from "@repo/ui/button";
import { Field, Form, Stack } from "@/core/layout";
import {
  createAssetFormAction,
  type OfficeFormState,
} from "@/modules/frigora/app/mutation-actions";
import { FRIGORA_ASSET_KINDS } from "@/modules/frigora/types";

export function CreateAssetForm({
  workspaceId,
  ventureId,
  customerId,
  siteId,
}: {
  workspaceId: string;
  ventureId: string;
  customerId: string;
  siteId: string;
}) {
  const [state, formAction, pending] = useActionState(
    createAssetFormAction,
    {} as OfficeFormState,
  );

  return (
    <Form action={formAction} gap="tight">
      <input type="hidden" name="workspaceId" value={workspaceId} />
      <input type="hidden" name="ventureId" value={ventureId} />
      <input type="hidden" name="customerId" value={customerId} />
      <input type="hidden" name="siteId" value={siteId} />
      <Stack gap="tight">
        <Field>
          Tag
          <input
            name="tag"
            required
            defaultValue={state.values?.tag ?? ""}
            className="vos-field"
            autoComplete="off"
          />
        </Field>
        <Field>
          Name
          <input
            name="name"
            defaultValue={state.values?.name ?? ""}
            className="vos-field"
          />
        </Field>
        <Field>
          Asset kind
          <select
            name="assetKind"
            defaultValue={state.values?.assetKind ?? ""}
            className="vos-field"
          >
            <option value="">Not specified</option>
            {FRIGORA_ASSET_KINDS.map((kind) => (
              <option key={kind} value={kind}>
                {kind.replaceAll("_", " ")}
              </option>
            ))}
          </select>
        </Field>
        <Field>
          Manufacturer
          <input
            name="manufacturer"
            defaultValue={state.values?.manufacturer ?? ""}
            className="vos-field"
          />
        </Field>
        <Field>
          Model
          <input
            name="model"
            defaultValue={state.values?.model ?? ""}
            className="vos-field"
          />
        </Field>
        <Field>
          Serial number
          <input
            name="serialNumber"
            defaultValue={state.values?.serialNumber ?? ""}
            className="vos-field"
          />
        </Field>
        <Field>
          Design target (°C)
          <input
            name="designTargetCelsius"
            inputMode="decimal"
            defaultValue={state.values?.designTargetCelsius ?? ""}
            className="vos-field"
          />
        </Field>
        <Field>
          Refrigerant type
          <input
            name="refrigerantType"
            defaultValue={state.values?.refrigerantType ?? ""}
            className="vos-field"
          />
        </Field>
        <Field>
          Location on site
          <input
            name="locationOnSite"
            defaultValue={state.values?.locationOnSite ?? ""}
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
          {pending ? "Creating…" : "Create asset"}
        </Button>
      </Stack>
    </Form>
  );
}
