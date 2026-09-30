"use client";

import { useActionState } from "react";
import { Form } from "@/core/layout";
import { acceptInvitationAction } from "@/modules/workspaces/access-actions";

export function AcceptInvitationForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(acceptInvitationAction, {});

  return (
    <Form action={action} gap="tight">
      <input type="hidden" name="token" value={token} />
      {state.error ? (
        <p id="invite-accept-error" role="alert" className="ids-caption text-danger">
          {state.error}
        </p>
      ) : null}
      <button
        type="submit"
        className="vos-btn-primary"
        disabled={pending}
        aria-describedby={state.error ? "invite-accept-error" : undefined}
        aria-invalid={state.error ? true : undefined}
      >
        {pending ? "Joining workspace…" : "Accept invitation"}
      </button>
    </Form>
  );
}
