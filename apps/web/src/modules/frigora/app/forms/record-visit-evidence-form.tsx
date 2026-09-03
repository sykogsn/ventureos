"use client";

import { useActionState } from "react";
import { Button } from "@repo/ui/button";
import { Field, Form, Stack } from "@/core/layout";
import { FRIGORA_VISIT_EVIDENCE_CATEGORIES } from "@/modules/frigora/types";
import {
  recordVisitEvidenceFormAction,
  type FieldFormState,
} from "@/modules/frigora/app/field-mutation-actions";

function categoryLabel(category: string) {
  return category.replace(/_/g, " ").toLowerCase();
}

export function RecordVisitEvidenceForm({
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
  primaryAssetId: string | null;
}) {
  const [state, formAction, pending] = useActionState(
    recordVisitEvidenceFormAction,
    {} as FieldFormState,
  );

  return (
    <Form action={formAction} encType="multipart/form-data" gap="tight">
      <input type="hidden" name="workspaceId" value={workspaceId} />
      <input type="hidden" name="ventureId" value={ventureId} />
      <input type="hidden" name="workOrderId" value={workOrderId} />
      <input type="hidden" name="visitId" value={visitId} />
      {primaryAssetId ? <input type="hidden" name="assetId" value={primaryAssetId} /> : null}
      <Stack gap="tight">
        <p className="ids-caption text-muted">
          Evidence recorded here supports provenance and traceability only.
        </p>
        <Field>
          Category
          <select
            name="category"
            required
            className="vos-field"
            defaultValue={state.values?.category ?? "TECHNICAL"}
          >
            {FRIGORA_VISIT_EVIDENCE_CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {categoryLabel(category)}
              </option>
            ))}
          </select>
        </Field>
        <Field>
          Description (required for OTHER)
          <textarea
            name="description"
            rows={2}
            className="vos-field"
            defaultValue={state.values?.description ?? ""}
          />
        </Field>
        <Field>
          Photo or file
          <input
            name="file"
            type="file"
            required
            accept="image/jpeg,image/png,image/webp,application/pdf,.pdf"
            capture="environment"
            className="vos-field"
          />
        </Field>
        {state.error ? (
          <p className="ids-caption text-danger" role="alert">
            {state.error}
          </p>
        ) : null}
        {pending ? (
          <p className="ids-caption text-muted" role="status">Uploading evidence…</p>
        ) : null}
        <Button type="submit" disabled={pending} className="w-full sm:w-auto">
          {pending ? "Uploading…" : "Record evidence"}
        </Button>
      </Stack>
    </Form>
  );
}
