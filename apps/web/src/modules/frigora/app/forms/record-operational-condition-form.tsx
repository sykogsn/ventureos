"use client";

import { useActionState } from "react";
import { Button } from "@repo/ui/button";
import { Field, Form, Stack } from "@/core/layout";
import {
  recordOperationalConditionFormAction,
  type FieldFormState,
} from "@/modules/frigora/app/field-mutation-actions";
import { FRIGORA_ASSET_OPERATIONAL_CONDITION_KINDS } from "@/modules/frigora/types";

export function RecordOperationalConditionForm({
  workspaceId,
  ventureId,
  workOrderId,
  visitId,
  assetId,
}: {
  workspaceId: string;
  ventureId: string;
  workOrderId: string;
  visitId: string;
  assetId: string;
}) {
  const [state, formAction, pending] = useActionState(
    recordOperationalConditionFormAction,
    {} as FieldFormState,
  );

  return (
    <Form action={formAction} gap="tight">
      <input type="hidden" name="workspaceId" value={workspaceId} />
      <input type="hidden" name="ventureId" value={ventureId} />
      <input type="hidden" name="workOrderId" value={workOrderId} />
      <input type="hidden" name="visitId" value={visitId} />
      <input type="hidden" name="assetId" value={assetId} />
      <Stack gap="tight">
        <Field>
          Operational condition
          <select
            name="conditionKind"
            required
            className="vos-field"
            defaultValue={state.values?.conditionKind ?? "operational"}
          >
            {FRIGORA_ASSET_OPERATIONAL_CONDITION_KINDS.map((kind) => (
              <option key={kind} value={kind}>
                {kind.replace(/_/g, " ")}
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
          {pending ? "Recording…" : "Record operational condition"}
        </Button>
      </Stack>
    </Form>
  );
}
