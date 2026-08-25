"use client";

import { useActionState, useState, type ReactNode } from "react";
import Link from "next/link";
import { Button } from "@repo/ui/button";
import {
  Cluster,
  ExecutiveCluster,
  ExecutiveDocument,
  ExecutiveField,
  ExecutiveFill,
  ExecutiveForm,
  ExecutiveInline,
  ExecutiveRule,
  ExecutiveStack,
  Hairline,
} from "@/core/layout";
import {
  forgotPasswordAction,
  loginAction,
  resetPasswordAction,
  signupAction,
  type AuthActionState,
} from "@/modules/auth/actions";

const inputClass = "vos-field";
const LOGIN_ERROR_ID = "login-error";
const FORM_ERROR_ID = "auth-form-error";

function AuthAlert({
  id,
  children,
}: {
  id?: string;
  children: string;
}) {
  return (
    <div id={id} role="alert">
      <Cluster justify="start">
        <span className="ids-caption" aria-hidden="true">
          ▲
        </span>
        <p className="ids-body">{children}</p>
      </Cluster>
    </div>
  );
}

function AuthNotice({ children }: { children: string }) {
  return <p className="ids-body text-foreground">{children}</p>;
}

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
  const invalid = Boolean(state.error);

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
            aria-invalid={invalid || undefined}
            aria-describedby={invalid ? FORM_ERROR_ID : undefined}
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
            aria-invalid={invalid || undefined}
            aria-describedby={invalid ? FORM_ERROR_ID : undefined}
          />
        </ExecutiveField>
        {afterPassword}
        {state.error ? <AuthAlert id={FORM_ERROR_ID}>{state.error}</AuthAlert> : null}
        {state.notice ? <AuthNotice>{state.notice}</AuthNotice> : null}
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

function GoogleContinue({
  next,
  remember,
  primary = false,
}: {
  next: string;
  remember: boolean;
  primary?: boolean;
}) {
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
        className={primary ? "vos-btn-primary" : "vos-btn-secondary"}
      >
        Continue with Google
      </a>
    </ExecutiveFill>
  );
}

export function LoginScreen({
  next = "",
  error,
  notice,
}: {
  next?: string;
  error?: string;
  notice?: string;
}) {
  const [remember, setRemember] = useState(false);
  const [state, formAction, pending] = useActionState(loginAction, {});
  const invalid = Boolean(state.error);

  return (
    <ExecutiveStack gap="section">
      <ExecutiveStack gap="tight">
        <h1 className="ids-heading">Sign in to VentureOS</h1>
        <p className="ids-body text-muted">Continue to the desk.</p>
      </ExecutiveStack>

      {notice ? <AuthNotice>{notice}</AuthNotice> : null}
      {error ? <AuthAlert>{error}</AuthAlert> : null}

      <ExecutiveInline>
        <input
          type="checkbox"
          checked={remember}
          onChange={(event) => setRemember(event.target.checked)}
        />
        Remember me
      </ExecutiveInline>

      <GoogleContinue next={next} remember={remember} primary />

      <Hairline space="compact">
        <ExecutiveRule>or sign in with email</ExecutiveRule>
      </Hairline>

      <ExecutiveForm action={formAction}>
        <input type="hidden" name="next" value={next} />
        {remember ? <input type="hidden" name="remember" value="1" /> : null}
        <ExecutiveField>
          Email
          <input
            className={inputClass}
            type="email"
            name="email"
            autoComplete="email"
            required
            defaultValue=""
            aria-invalid={invalid || undefined}
            aria-describedby={invalid ? LOGIN_ERROR_ID : undefined}
          />
        </ExecutiveField>
        <ExecutiveField>
          Password
          <input
            className={inputClass}
            type="password"
            name="password"
            autoComplete="current-password"
            minLength={8}
            required
            defaultValue=""
            aria-invalid={invalid || undefined}
            aria-describedby={invalid ? LOGIN_ERROR_ID : undefined}
          />
        </ExecutiveField>
        {state.error ? <AuthAlert id={LOGIN_ERROR_ID}>{state.error}</AuthAlert> : null}
        {state.notice ? <AuthNotice>{state.notice}</AuthNotice> : null}
        <ExecutiveFill>
          <Button type="submit" variant="secondary" disabled={pending}>
            {pending ? "Signing in…" : "Sign in"}
          </Button>
        </ExecutiveFill>
      </ExecutiveForm>

      <ExecutiveCluster>
        <Link
          className="ids-label ids-transition text-foreground underline underline-offset-4"
          href="/forgot-password"
        >
          Forgot password?
        </Link>
        <p className="ids-body text-muted">
          No account?{" "}
          <Link
            className="ids-label ids-transition text-foreground underline underline-offset-4"
            href="/signup"
          >
            Create one
          </Link>
        </p>
      </ExecutiveCluster>

      <p className="ids-caption">For the founder of this desk.</p>
    </ExecutiveStack>
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
          <Hairline space="compact">
            <ExecutiveRule>or</ExecutiveRule>
          </Hairline>
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
  const invalid = Boolean(state.error);

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
          <input
            className={inputClass}
            type="email"
            name="email"
            autoComplete="email"
            required
            aria-invalid={invalid || undefined}
            aria-describedby={invalid ? FORM_ERROR_ID : undefined}
          />
        </ExecutiveField>
        {state.error ? <AuthAlert id={FORM_ERROR_ID}>{state.error}</AuthAlert> : null}
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
  const invalid = Boolean(state.error);

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
            aria-invalid={invalid || undefined}
            aria-describedby={invalid ? FORM_ERROR_ID : undefined}
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
            aria-invalid={invalid || undefined}
            aria-describedby={invalid ? FORM_ERROR_ID : undefined}
          />
        </ExecutiveField>
        {state.error ? <AuthAlert id={FORM_ERROR_ID}>{state.error}</AuthAlert> : null}
        <ExecutiveFill>
          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : "Update password"}
          </Button>
        </ExecutiveFill>
      </ExecutiveForm>
    </ExecutiveStack>
  );
}
