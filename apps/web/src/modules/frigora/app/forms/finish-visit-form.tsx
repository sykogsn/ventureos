"use client";

import { useActionState } from "react";
import { Button } from "@repo/ui/button";
import { Form, Stack } from "@/core/layout";
import {
  finishVisitFormAction,
  type FieldFormState,
} from "@/modules/frigora/app/field-mutation-actions";

export function FinishVisitForm({
  workspaceId,
  ventureId,
  workOrderId,
  visitId,
}: {
  workspaceId: string;
  ventureId: string;
  workOrderId: string;
  visitId: string;
}) {
  const [state, formAction, pending] = useActionState(finishVisitFormAction, {} as FieldFormState);

  return (
    <Form action={formAction} gap="tight">
      <input type="hidden" name="workspaceId" value={workspaceId} />
      <input type="hidden" name="ventureId" value={ventureId} />
      <input type="hidden" name="workOrderId" value={workOrderId} />
      <input type="hidden" name="visitId" value={visitId} />
      <Stack gap="tight">
        <p className="ids-caption text-muted">
          Finish this visit? The work order stays open.
        </p>
        {state.error ? (
          <p className="ids-caption text-danger" role="alert">
            {state.error}
          </p>
        ) : null}
        <Button type="submit" disabled={pending} className="w-full sm:w-auto">
          {pending ? "Finishing…" : "Finish visit"}
        </Button>
      </Stack>
    </Form>
  );
}
