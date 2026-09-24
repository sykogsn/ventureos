"use client";

import { useActionState } from "react";
import { Button } from "@repo/ui/button";
import { Form, Stack } from "@/core/layout";
import {
  startVisitFormAction,
  type FieldFormState,
} from "@/modules/frigora/app/field-mutation-actions";

export function StartVisitForm({
  workspaceId,
  ventureId,
  workOrderId,
}: {
  workspaceId: string;
  ventureId: string;
  workOrderId: string;
}) {
  const [state, formAction, pending] = useActionState(startVisitFormAction, {} as FieldFormState);

  return (
    <Form action={formAction} gap="tight">
      <input type="hidden" name="workspaceId" value={workspaceId} />
      <input type="hidden" name="ventureId" value={ventureId} />
      <input type="hidden" name="workOrderId" value={workOrderId} />
      <Stack gap="tight">
        {state.error ? (
          <p className="ids-caption text-danger" role="alert">
            {state.error}
          </p>
        ) : null}
        <Button type="submit" disabled={pending} className="w-full sm:w-auto">
          {pending ? "Starting…" : "Start visit"}
        </Button>
      </Stack>
    </Form>
  );
}
