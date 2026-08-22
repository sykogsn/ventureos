"use client";

import { useActionState } from "react";
import { createWorkspaceAction, type WorkspaceActionState } from "@/modules/workspaces/actions";
import { Button } from "@repo/ui/button";
import { Form } from "@/core/layout";

export function CreateWorkspaceForm() {
  const [state, formAction, pending] = useActionState(
    createWorkspaceAction,
    {} as WorkspaceActionState,
  );

  return (
    <Form action={formAction} gap="tight">
      <input
        name="name"
        required
        minLength={2}
        placeholder="New workspace"
        className="vos-field"
      />
      {state.error ? (
        <p className="ids-caption text-danger">{state.error}</p>
      ) : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Creating…" : "Create workspace"}
      </Button>
    </Form>
  );
}
