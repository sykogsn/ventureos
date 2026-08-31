"use client";

import { useActionState } from "react";
import { Button } from "@repo/ui/button";
import { Field, Form, Stack } from "@/core/layout";
import {
  recordCorrectiveActionFormAction,
  type FieldFormState,
} from "@/modules/frigora/app/field-mutation-actions";

export function RecordCorrectiveActionForm({
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
    recordCorrectiveActionFormAction,
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
          What was actually done
          <textarea
            name="description"
            rows={3}
            required
            className="vos-field"
            defaultValue={state.values?.description ?? ""}
            placeholder="Actual performed work"
          />
        </Field>
        {state.error ? (
          <p className="ids-caption text-danger" role="alert">
            {state.error}
          </p>
        ) : null}
        <Button type="submit" disabled={pending} className="w-full sm:w-auto">
          {pending ? "Recording…" : "Record corrective action"}
        </Button>
      </Stack>
    </Form>
  );
}
