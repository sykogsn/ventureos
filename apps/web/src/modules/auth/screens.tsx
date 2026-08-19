"use client";

import { useActionState, type ReactNode } from "react";
import Link from "next/link";
import { Button } from "@repo/ui/button";
import { loginAction, signupAction, type AuthActionState } from "@/modules/auth/actions";

const inputClass = "vos-field";

function AuthForm({
  title,
  action,
  submitLabel,
  pendingLabel,
  extra,
  footer,
}: {
  title: string;
  action: (state: AuthActionState, formData: FormData) => Promise<AuthActionState>;
  submitLabel: string;
  pendingLabel: string;
  extra?: ReactNode;
  footer: ReactNode;
}) {
  const [state, formAction, pending] = useActionState(action, {});

  return (
    <div className="flex flex-col gap-4">
      <h1 className="ids-lead">{title}</h1>
      <form action={formAction} className="flex flex-col gap-3">
        {extra}
        <label className="ids-label flex flex-col gap-1">
          Email
          <input
            className={inputClass}
            type="email"
            name="email"
            autoComplete="email"
            required
          />
        </label>
        <label className="ids-label flex flex-col gap-1">
          Password
          <input
            className={inputClass}
            type="password"
            name="password"
            autoComplete={title === "Sign in" ? "current-password" : "new-password"}
            minLength={8}
            required
          />
        </label>
        {state.error ? <p className="ids-body text-danger">{state.error}</p> : null}
        <Button type="submit" disabled={pending}>
          {pending ? pendingLabel : submitLabel}
        </Button>
        <p className="ids-body text-muted">{footer}</p>
      </form>
    </div>
  );
}

export function LoginScreen() {
  return (
    <AuthForm
      title="Sign in"
      action={loginAction}
      submitLabel="Sign in"
      pendingLabel="Opening VentureOS…"
      footer={
        <>
          No account?{" "}
          <Link
            className="ids-label ids-transition text-foreground underline underline-offset-4"
            href="/signup"
          >
            Create one
          </Link>
        </>
      }
    />
  );
}

export function SignupScreen() {
  return (
    <AuthForm
      title="Create account"
      action={signupAction}
      submitLabel="Create account"
      pendingLabel="Preparing your workspace…"
      extra={
        <label className="ids-label flex flex-col gap-1">
          Name
          <input className={inputClass} name="name" autoComplete="name" required />
        </label>
      }
      footer={
        <>
          Already have an account?{" "}
          <Link
            className="ids-label ids-transition text-foreground underline underline-offset-4"
            href="/login"
          >
            Sign in
          </Link>
        </>
      }
    />
  );
}
