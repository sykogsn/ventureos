"use client";

import { useActionState } from "react";
import { Button } from "@repo/ui/button";
import { Form } from "@/core/layout";
import {
  convertRecommendedActionFormAction,
  type OfficeFormState,
} from "@/modules/frigora/app/mutation-actions";

export function ConvertRecommendedActionForm({
  workspaceId,
  ventureId,
  workOrderId,
  recommendedActionId,
}: {
  workspaceId: string;
  ventureId: string;
  workOrderId: string;
  recommendedActionId: string;
}) {
  const [state, formAction, pending] = useActionState(
    convertRecommendedActionFormAction,
    {} as OfficeFormState,
  );

  return (
    <Form action={formAction} gap="tight">
      <input type="hidden" name="workspaceId" value={workspaceId} />
      <input type="hidden" name="ventureId" value={ventureId} />
      <input type="hidden" name="workOrderId" value={workOrderId} />
      <input type="hidden" name="recommendedActionId" value={recommendedActionId} />
      {state.error ? (
        <p className="ids-caption text-danger" role="alert">
          {state.error}
        </p>
      ) : null}
      <Button type="submit" variant="secondary" disabled={pending}>
        {pending ? "Converting…" : "Convert to Follow-up WorkOrder"}
      </Button>
    </Form>
  );
}
