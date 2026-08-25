"use client";

import { useActionState, useEffect, useState, type ReactNode } from "react";
import {
  AUTH_CREATE_ORIENTATION,
  AUTH_CREATE_TITLE,
  AUTH_ORIENTATION,
  AUTH_ORIENTATION_RETURNING,
  AuthDivider,
  AuthFamilySection,
  AuthField,
  AuthFieldGroup,
  AuthGoogleStack,
  AuthHeading,
  AuthMethodStack,
  AuthMutedLine,
  AuthNativeForm,
  AuthNotice,
  AuthPanelHeading,
  AuthSignInSection,
  AuthToolbarRow,
  AuthTrust,
  GoogleSignInButton,
  QuietButton,
  QuietLink,
  RememberMe,
  TextLink,
  type NoticeTone,
} from "@/modules/auth/presentation";
import {
  forgotPasswordAction,
  loginAction,
  resetPasswordAction,
  signupAction,
  type AuthActionState,
} from "@/modules/auth/actions";

function googleHref(next: string, remember: boolean) {
  const params = new URLSearchParams();
  if (next) {
    params.set("next", next);
  }
  if (remember) {
    params.set("remember", "1");
  }
  return `/auth/google${params.toString() ? `?${params.toString()}` : ""}`;
}

function retryHref(next: string) {
  return next ? `/login?next=${encodeURIComponent(next)}` : "/login";
}

function queryNotice(
  code: string | undefined,
  message: string | undefined,
  next: string,
): {
  tone: NoticeTone;
  title: string;
  action?: string;
  actionHref?: string;
  assertive?: boolean;
} | null {
  if (!code || !message) {
    return null;
  }

  if (code === "google_denied") {
    return {
      tone: "neutral",
      title: message,
      action: "Try again",
      actionHref: retryHref(next),
    };
  }

  if (code === "google_link" || code === "google_in_use") {
    return { tone: "informative", title: message };
  }

  if (
    code === "google_failed" ||
    code === "google_config" ||
    code === "google_unverified"
  ) {
    return {
      tone: "warning",
      title: message,
      action: "Try again",
      actionHref: retryHref(next),
      assertive: true,
    };
  }

  return { tone: "warning", title: message, assertive: true };
}

export function LoginScreen({
  next = "",
  error,
  errorCode,
  notice,
}: {
  next?: string;
  error?: string;
  errorCode?: string;
  notice?: string;
}) {
  const [remember, setRemember] = useState(false);
  const [state, formAction, pending] = useActionState(loginAction, {});
  const query = queryNotice(errorCode, error, next);

  useEffect(() => {
    const onPageShow = (event: PageTransitionEvent) => {
      if (!event.persisted) {
        return;
      }
      const form = document.getElementById("ventureos-login-form");
      if (form instanceof HTMLFormElement) {
        form.reset();
      }
    };

    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, []);

  return (
    <AuthSignInSection labelledBy="sign-in-title">
      <AuthHeading
        id="sign-in-title"
        title="Sign in to VentureOS"
        description={next ? AUTH_ORIENTATION_RETURNING : AUTH_ORIENTATION}
      />

      {notice ? <AuthNotice tone="informative" title={notice} /> : null}
      {query ? (
        <AuthNotice
          tone={query.tone}
          title={query.title}
          action={query.action}
          actionHref={query.actionHref}
          assertive={query.assertive}
        />
      ) : null}
      {state.error ? (
        <AuthNotice tone="warning" title={state.error} assertive />
      ) : null}
      {state.notice ? <AuthNotice tone="informative" title={state.notice} /> : null}

      <AuthGoogleStack>
        <GoogleSignInButton href={googleHref(next, remember)} />
        {next ? (
          <AuthMutedLine>
            You will be returned to your previous destination after signing in.
          </AuthMutedLine>
        ) : null}
      </AuthGoogleStack>

      <AuthMethodStack>
        <AuthDivider label="or" />
        <AuthNativeForm id="ventureos-login-form" action={formAction} autoComplete="on">
          <input type="hidden" name="next" value={next} />
          <AuthFieldGroup>
            <AuthField
              id="email"
              name="email"
              label="Work email"
              type="email"
              autoComplete="username"
              required
            />
            <AuthField
              id="password"
              name="password"
              label="Password"
              type="password"
              autoComplete="current-password"
              minLength={8}
              required
            />
          </AuthFieldGroup>
          <AuthToolbarRow>
            <RememberMe
              checked={remember}
              onChange={setRemember}
              disabled={pending}
            />
            <TextLink href="/forgot-password">Forgot password?</TextLink>
          </AuthToolbarRow>
          <QuietButton type="submit" disabled={pending}>
            {pending ? "Signing in…" : "Sign in"}
          </QuietButton>
        </AuthNativeForm>
        <AuthMutedLine>
          New to VentureOS? <TextLink href="/signup">Create account</TextLink>
        </AuthMutedLine>
      </AuthMethodStack>

      <AuthTrust />
    </AuthSignInSection>
  );
}

function AuthAccountForm({
  title,
  description,
  headingId,
  mode,
  action,
  submitLabel,
  pendingLabel,
  extra,
  afterPassword,
  footer,
  googleHrefValue,
}: {
  title: string;
  description: string;
  headingId: string;
  mode: "login" | "signup";
  action: (state: AuthActionState, formData: FormData) => Promise<AuthActionState>;
  submitLabel: string;
  pendingLabel: string;
  extra?: ReactNode;
  afterPassword?: ReactNode;
  footer: ReactNode;
  googleHrefValue: string;
}) {
  const [state, formAction, pending] = useActionState(action, {});

  return (
    <AuthSignInSection labelledBy={headingId}>
      <AuthHeading id={headingId} title={title} description={description} />
      <AuthGoogleStack>
        <GoogleSignInButton href={googleHrefValue} />
      </AuthGoogleStack>
      <AuthMethodStack>
        <AuthDivider label="or" />
        <AuthNativeForm action={formAction}>
          <AuthFieldGroup>
            {extra}
            <AuthField
              id={`${mode}-email`}
              name="email"
              label="Work email"
              type="email"
              autoComplete="email"
              required
            />
            <AuthField
              id={`${mode}-password`}
              name="password"
              label={mode === "signup" ? "Choose a password" : "Password"}
              type="password"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              minLength={8}
              required
            />
          </AuthFieldGroup>
          {afterPassword}
          {state.error ? (
            <AuthNotice tone="warning" title={state.error} assertive />
          ) : null}
          {state.notice ? <AuthNotice tone="informative" title={state.notice} /> : null}
          <QuietButton type="submit" disabled={pending}>
            {pending ? pendingLabel : submitLabel}
          </QuietButton>
        </AuthNativeForm>
        <AuthMutedLine>{footer}</AuthMutedLine>
      </AuthMethodStack>
      <AuthTrust />
    </AuthSignInSection>
  );
}

export function SignupScreen() {
  return (
    <AuthAccountForm
      title={AUTH_CREATE_TITLE}
      description={AUTH_CREATE_ORIENTATION}
      headingId="sign-in-title"
      mode="signup"
      action={signupAction}
      submitLabel="Create account"
      pendingLabel="Preparing your workspace…"
      googleHrefValue={googleHref("/dashboard", true)}
      extra={
        <AuthField
          id="name"
          name="name"
          label="Name"
          autoComplete="name"
          required
        />
      }
      footer={
        <>
          Already have an account? <TextLink href="/login">Sign in</TextLink>
        </>
      }
    />
  );
}

export function ForgotPasswordScreen() {
  const [state, formAction, pending] = useActionState(forgotPasswordAction, {});

  return (
    <AuthFamilySection labelledBy="reset-title">
      <AuthPanelHeading
        id="reset-title"
        title="Reset your password"
        description="Enter the email on your desk. If an account exists, we will send a reset link."
      />
      <AuthNativeForm action={formAction}>
        <AuthField
          id="reset-email"
          name="email"
          label="Work email"
          type="email"
          autoComplete="email"
          required
        />
        {state.error ? (
          <AuthNotice tone="warning" title={state.error} assertive />
        ) : null}
        <QuietButton type="submit" disabled={pending}>
          {pending ? "Sending…" : "Send reset instructions"}
        </QuietButton>
      </AuthNativeForm>
      <TextLink href="/login">Back to sign in</TextLink>
    </AuthFamilySection>
  );
}

export function ForgotPasswordSentScreen() {
  return (
    <AuthFamilySection labelledBy="reset-title">
      <AuthPanelHeading
        id="reset-title"
        title="Reset your password"
        description="If an account exists for that email, a reset link is on its way. The link expires in one hour."
      />
      <AuthNotice
        tone="informative"
        title="If that address is recognised, instructions are on the way"
        description="Follow the link in the email to set a new password. The link is single use and expires."
      />
      <QuietLink href="/login">Back to sign in</QuietLink>
    </AuthFamilySection>
  );
}

export function ResetPasswordScreen({ token }: { token: string }) {
  const [state, formAction, pending] = useActionState(resetPasswordAction, {});

  return (
    <AuthFamilySection labelledBy="new-password-title">
      <AuthPanelHeading
        id="new-password-title"
        title="Set a new password"
        description="Choose a new password for this desk."
      />
      <AuthNativeForm action={formAction}>
        <input type="hidden" name="token" value={token} />
        <AuthFieldGroup>
          <AuthField
            id="new-password"
            name="password"
            label="New password"
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
          />
          <AuthField
            id="confirm-password"
            name="confirm"
            label="Confirm password"
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
          />
        </AuthFieldGroup>
        {state.error ? (
          <AuthNotice tone="warning" title={state.error} assertive />
        ) : null}
        <QuietButton type="submit" disabled={pending}>
          {pending ? "Saving…" : "Set password and continue"}
        </QuietButton>
      </AuthNativeForm>
      <TextLink href="/login">Back to sign in</TextLink>
    </AuthFamilySection>
  );
}

export function ResetPasswordMissingScreen() {
  return (
    <AuthFamilySection labelledBy="reset-title">
      <AuthPanelHeading
        id="reset-title"
        title="Reset your password"
        description="This reset link is missing or invalid."
      />
      <AuthNotice
        tone="warning"
        title="That reset link has expired"
        description="Reset links are single use and time limited. Request a new one and it will arrive within a few minutes."
      />
      <QuietLink href="/forgot-password">Request a new link</QuietLink>
    </AuthFamilySection>
  );
}
