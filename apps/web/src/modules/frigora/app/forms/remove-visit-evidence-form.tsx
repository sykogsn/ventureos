"use client";

import { useActionState } from "react";
import { Button } from "@repo/ui/button";
import { Form } from "@/core/layout";
import {
  removeVisitEvidenceFormAction,
  type FieldFormState,
} from "@/modules/frigora/app/field-mutation-actions";

export function RemoveVisitEvidenceForm({
  workspaceId,
  ventureId,
  workOrderId,
  visitId,
  evidenceId,
  filename,
}: {
  workspaceId: string;
  ventureId: string;
  workOrderId: string;
  visitId: string;
  evidenceId: string;
  filename: string;
}) {
  const [state, formAction, pending] = useActionState(
    removeVisitEvidenceFormAction,
    {} as FieldFormState,
  );

  return (
    <Form action={formAction} gap="tight">
      <input type="hidden" name="workspaceId" value={workspaceId} />
      <input type="hidden" name="ventureId" value={ventureId} />
      <input type="hidden" name="workOrderId" value={workOrderId} />
      <input type="hidden" name="visitId" value={visitId} />
      <input type="hidden" name="evidenceId" value={evidenceId} />
      {state.error ? (
        <p className="ids-caption text-danger" role="alert">
          {state.error}
        </p>
      ) : null}
      <Button
        type="submit"
        variant="secondary"
        disabled={pending}
        className="w-full sm:w-auto"
      >
        {pending ? "Removing…" : `Remove ${filename}`}
      </Button>
    </Form>
  );
}
