"use client";

import { useActionState, useState, type ReactNode } from "react";
import Link from "next/link";
import { Button } from "@repo/ui/button";
import {
  ExecutiveCluster,
  ExecutiveDocument,
  ExecutiveField,
  ExecutiveFill,
  ExecutiveForm,
  ExecutiveInline,
  ExecutiveRule,
  ExecutiveStack,
} from "@/core/layout";
import {
  forgotPasswordAction,
  loginAction,
  resetPasswordAction,
  signupAction,
  type AuthActionState,
} from "@/modules/auth/actions";

const inputClass = "vos-field";

function AuthForm({
  kicker,
  title,
  description,
  mode,
  action,
  submitLabel,
  pendingLabel,
  extra,
  afterPassword,
  afterSubmit,
  footer,
}: {
  kicker: string;
  title: string;
  description: string;
  mode: "login" | "signup";
  action: (state: AuthActionState, formData: FormData) => Promise<AuthActionState>;
  submitLabel: string;
  pendingLabel: string;
  extra?: ReactNode;
  afterPassword?: ReactNode;
  afterSubmit?: ReactNode;
  footer: ReactNode;
}) {
  const [state, formAction, pending] = useActionState(action, {});

  return (
    <ExecutiveStack gap="section">
      <ExecutiveDocument kicker={kicker} title={title} description={description} />
      <ExecutiveForm action={formAction}>
        {extra}
        <ExecutiveField>
          Email
          <input
            className={inputClass}
            type="email"
            name="email"
            autoComplete="email"
            required
            defaultValue=""
          />
        </ExecutiveField>
        <ExecutiveField>
          Password
          <input
            className={inputClass}
            type="password"
            name="password"
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            minLength={8}
            required
            defaultValue=""
          />
        </ExecutiveField>
        {afterPassword}
        {state.error ? <p className="ids-body text-danger">{state.error}</p> : null}
        {state.notice ? <p className="ids-body text-foreground">{state.notice}</p> : null}
        <ExecutiveFill>
          <Button type="submit" disabled={pending}>
            {pending ? pendingLabel : submitLabel}
          </Button>
        </ExecutiveFill>
      </ExecutiveForm>
      {afterSubmit ? <ExecutiveStack gap="form">{afterSubmit}</ExecutiveStack> : null}
      <p className="ids-body text-muted">{footer}</p>
    </ExecutiveStack>
  );
}

function GoogleContinue({ next, remember }: { next: string; remember: boolean }) {
  const params = new URLSearchParams();
  if (next) {
    params.set("next", next);
  }
  if (remember) {
    params.set("remember", "1");
  }

  return (
    <ExecutiveFill>
      <a
        href={`/auth/google${params.toString() ? `?${params.toString()}` : ""}`}
        className="vos-btn-secondary"
      >
        Continue with Google
      </a>
    </ExecutiveFill>
  );
}

export function LoginScreen({
  next = "",
  message,
}: {
  next?: string;
  message?: string;
}) {
  const [remember, setRemember] = useState(false);

  return (
    <AuthForm
      kicker="Authentication"
      title="Sign in"
      description="Open your desk to operate companies from this workspace."
      mode="login"
      action={loginAction}
      submitLabel="Open desk"
      pendingLabel="Opening desk…"
      extra={
        <>
          <input type="hidden" name="next" value={next} />
          {message ? <p className="ids-body text-foreground">{message}</p> : null}
        </>
      }
      afterPassword={
        <ExecutiveCluster>
          <ExecutiveInline>
            <input
              type="checkbox"
              name="remember"
              value="1"
              checked={remember}
              onChange={(event) => setRemember(event.target.checked)}
            />
            Remember me
          </ExecutiveInline>
          <Link
            className="ids-label ids-transition text-foreground underline underline-offset-4"
            href="/forgot-password"
          >
            Forgot password?
          </Link>
        </ExecutiveCluster>
      }
      afterSubmit={
        <>
          <ExecutiveRule>or</ExecutiveRule>
          <GoogleContinue next={next} remember={remember} />
        </>
      }
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
      kicker="Authentication"
      title="Create account"
      description="Open a desk. You will found companies from this workspace."
      mode="signup"
      action={signupAction}
      submitLabel="Create account"
      pendingLabel="Preparing your workspace…"
      extra={
        <ExecutiveField>
          Name
          <input className={inputClass} name="name" autoComplete="name" required />
        </ExecutiveField>
      }
      afterSubmit={
        <>
          <ExecutiveRule>or</ExecutiveRule>
          <GoogleContinue next="/dashboard" remember />
        </>
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

export function ForgotPasswordScreen() {
  const [state, formAction, pending] = useActionState(forgotPasswordAction, {});

  return (
    <ExecutiveStack gap="section">
      <ExecutiveDocument
        kicker="Authentication"
        title="Forgot password"
        description="Enter the email on your desk. If an account exists, we will send a reset link."
      />
      <ExecutiveForm action={formAction}>
        <ExecutiveField>
          Email
          <input className={inputClass} type="email" name="email" autoComplete="email" required />
        </ExecutiveField>
        {state.error ? <p className="ids-body text-danger">{state.error}</p> : null}
        <ExecutiveFill>
          <Button type="submit" disabled={pending}>
            {pending ? "Sending…" : "Send reset link"}
          </Button>
        </ExecutiveFill>
        <p className="ids-body text-muted">
          <Link
            className="ids-label ids-transition text-foreground underline underline-offset-4"
            href="/login"
          >
            Return to sign in
          </Link>
        </p>
      </ExecutiveForm>
    </ExecutiveStack>
  );
}

export function ResetPasswordScreen({ token }: { token: string }) {
  const [state, formAction, pending] = useActionState(resetPasswordAction, {});

  return (
    <ExecutiveStack gap="section">
      <ExecutiveDocument
        kicker="Authentication"
        title="Reset password"
        description="Choose a new password for this desk."
      />
      <ExecutiveForm action={formAction}>
        <input type="hidden" name="token" value={token} />
        <ExecutiveField>
          New password
          <input
            className={inputClass}
            type="password"
            name="password"
            autoComplete="new-password"
            minLength={8}
            required
          />
        </ExecutiveField>
        <ExecutiveField>
          Confirm password
          <input
            className={inputClass}
            type="password"
            name="confirm"
            autoComplete="new-password"
            minLength={8}
            required
          />
        </ExecutiveField>
        {state.error ? <p className="ids-body text-danger">{state.error}</p> : null}
        <ExecutiveFill>
          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : "Update password"}
          </Button>
        </ExecutiveFill>
      </ExecutiveForm>
    </ExecutiveStack>
  );
}
