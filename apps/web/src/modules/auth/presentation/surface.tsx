"use client";

import { useState, type ComponentPropsWithoutRef, type ReactNode } from "react";
import { Eye, EyeOff } from "lucide-react";
import Link from "next/link";
import { cn } from "@/utils/cn";
import { AUTH_MARK, AUTH_PRODUCT_NAME, TRUST_NOTES } from "./copy";

export type NoticeTone = "neutral" | "informative" | "warning";

export function AuthIdentity({
  name = AUTH_PRODUCT_NAME,
  mark = AUTH_MARK,
}: {
  name?: string;
  mark?: string;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <span
        aria-hidden="true"
        className="inline-flex size-7 items-center justify-center rounded-md bg-text-primary text-[0.75rem] font-medium text-text-inverse"
      >
        {mark}
      </span>
      <span className="text-[0.9375rem] font-medium tracking-[-0.012em] text-text-primary">
        {name}
      </span>
    </div>
  );
}

const rail: Record<NoticeTone, string> = {
  neutral: "bg-border-strong",
  informative: "bg-venture-accent",
  warning: "bg-status-high",
};

const glyph: Record<NoticeTone, string> = {
  neutral: "–",
  informative: "●",
  warning: "◆",
};

export function AuthNotice({
  tone = "neutral",
  title,
  description,
  action,
  actionHref,
  assertive = false,
}: {
  tone?: NoticeTone;
  title: string;
  description?: string;
  action?: string;
  actionHref?: string;
  assertive?: boolean;
}) {
  return (
    <div
      role={assertive ? "alert" : "status"}
      aria-live={assertive ? "assertive" : "polite"}
      className="relative overflow-hidden rounded-lg bg-surface-secondary/70 px-4 py-3"
    >
      <span aria-hidden="true" className={cn("absolute inset-y-0 left-0 w-[2px]", rail[tone])} />
      <div className="flex items-start gap-2.5">
        <span
          aria-hidden="true"
          className={cn(
            "mt-[3px] text-[0.5625rem]",
            tone === "warning"
              ? "text-status-high"
              : tone === "informative"
                ? "text-venture-accent"
                : "text-text-muted",
          )}
        >
          {glyph[tone]}
        </span>
        <div className="min-w-0">
          <p className="text-[0.8125rem] font-medium text-text-primary">{title}</p>
          {description ? (
            <p className="mt-1 text-[0.75rem] leading-relaxed text-text-muted">{description}</p>
          ) : null}
          {action && actionHref ? (
            <Link
              href={actionHref}
              className="mt-2 inline-block rounded-sm text-[0.75rem] font-medium text-text-primary underline decoration-border-strong underline-offset-4 transition-colors hover:decoration-text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text-primary"
            >
              {action}
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 18 18" className="size-4 shrink-0" aria-hidden="true" focusable="false">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.17-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.81.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18Z"
      />
      <path
        fill="#FBBC05"
        d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33Z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.9 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58Z"
      />
    </svg>
  );
}

const googleButtonClass = cn(
  "group inline-flex min-h-11 w-full items-center justify-center gap-2.5 rounded-md border border-border-strong bg-surface-elevated px-4 text-[0.8125rem] font-medium text-text-primary",
  "transition-colors duration-150 ease-[var(--ease-executive)]",
  "hover:bg-surface-interactive",
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text-primary",
);

export function GoogleSignInButton({ href }: { href: string }) {
  return (
    <a href={href} aria-label="Continue with Google" className={googleButtonClass}>
      <GoogleMark />
      <span>Continue with Google</span>
    </a>
  );
}

export function AuthDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3" role="separator" aria-label={label}>
      <span className="h-px flex-1 bg-border-subtle" aria-hidden="true" />
      <span className="text-[0.6875rem] leading-normal text-text-muted uppercase tracking-[0.13em]">
        {label}
      </span>
      <span className="h-px flex-1 bg-border-subtle" aria-hidden="true" />
    </div>
  );
}

export function AuthField({
  id,
  name,
  label,
  type = "text",
  autoComplete,
  error,
  disabled,
  required,
  minLength,
  defaultValue,
}: {
  id: string;
  name?: string;
  label: string;
  type?: string;
  autoComplete?: string;
  error?: string;
  disabled?: boolean;
  required?: boolean;
  minLength?: number;
  defaultValue?: string;
}) {
  const errorId = `${id}-error`;
  const secret = type === "password";
  const [revealed, setRevealed] = useState(false);
  const inputType = secret && revealed ? "text" : type;
  const toggleLabel = revealed ? "Hide password" : "Show password";

  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-[0.75rem] font-medium text-text-secondary">
        {label}
      </label>
      <div className={secret ? "relative" : undefined}>
        <input
          id={id}
          name={name ?? id}
          type={inputType}
          disabled={disabled}
          autoComplete={autoComplete}
          spellCheck={secret ? false : undefined}
          autoCapitalize={secret ? "none" : undefined}
          autoCorrect={secret ? "off" : undefined}
          required={required}
          minLength={minLength}
          defaultValue={defaultValue}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className={cn(
            "min-h-11 w-full rounded-md bg-surface-secondary px-3 text-[0.8125rem] text-text-primary",
            "border transition-colors duration-150 outline-none",
            error ? "border-status-high" : "border-border-subtle",
            "placeholder:text-text-muted focus-visible:border-text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text-primary",
            "disabled:opacity-60",
            secret && "pr-10",
          )}
        />
        {secret ? (
          <button
            type="button"
            aria-label={toggleLabel}
            aria-pressed={revealed}
            aria-controls={id}
            disabled={disabled}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => setRevealed((open) => !open)}
            className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-text-muted transition-colors hover:text-text-secondary focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-text-primary disabled:opacity-60"
          >
            {revealed ? (
              <EyeOff className="ids-icon-sm" aria-hidden="true" />
            ) : (
              <Eye className="ids-icon-sm" aria-hidden="true" />
            )}
          </button>
        ) : null}
      </div>
      {error ? (
        <p id={errorId} className="flex items-start gap-1.5 text-[0.6875rem] text-status-high">
          <span aria-hidden="true">◆</span>
          <span>{error}</span>
        </p>
      ) : null}
    </div>
  );
}

const quietButtonClass =
  "inline-flex min-h-11 w-full items-center justify-center rounded-md bg-text-primary px-4 text-[0.8125rem] font-medium text-text-inverse transition-opacity duration-150 hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text-primary disabled:pointer-events-none disabled:opacity-50";

export function QuietButton({
  children,
  type = "button",
  disabled,
}: {
  children: ReactNode;
  type?: "button" | "submit";
  disabled?: boolean;
}) {
  return (
    <button type={type} disabled={disabled} className={quietButtonClass}>
      {children}
    </button>
  );
}

export function QuietLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className={quietButtonClass}>
      {children}
    </Link>
  );
}

const textLinkClass =
  "rounded-sm text-[0.75rem] text-text-secondary underline decoration-border-strong underline-offset-4 transition-colors hover:text-text-primary hover:decoration-text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text-primary";

export function TextLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className={textLinkClass}>
      {children}
    </Link>
  );
}

export function RememberMe({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 text-[0.75rem] text-text-secondary select-none">
      <input
        type="checkbox"
        name="remember"
        value="1"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        className="size-3.5 shrink-0 appearance-none rounded-[3px] border border-border-strong bg-surface-secondary transition-colors checked:border-text-primary checked:bg-text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text-primary"
      />
      <span>Remember me on this device</span>
    </label>
  );
}

export function TrustFootnote({ notes = TRUST_NOTES }: { notes?: string[] }) {
  return (
    <div className="space-y-1">
      {notes.map((note) => (
        <p key={note} className="text-[0.6875rem] leading-relaxed text-text-muted">
          {note}
        </p>
      ))}
    </div>
  );
}

export function AuthSignInSection({
  labelledBy,
  children,
}: {
  labelledBy: string;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={labelledBy} className="space-y-7">
      {children}
    </section>
  );
}

export function AuthHeading({
  id,
  title,
  description,
}: {
  id: string;
  title: string;
  description: string;
}) {
  return (
    <div className="space-y-2">
      <h1
        id={id}
        className="text-[1.375rem] leading-tight font-medium tracking-[-0.024em] text-text-primary"
      >
        {title}
      </h1>
      <p className="text-[0.8125rem] leading-relaxed text-text-secondary">{description}</p>
    </div>
  );
}

export function AuthPanelHeading({
  id,
  title,
  description,
}: {
  id: string;
  title: string;
  description: string;
}) {
  return (
    <div className="space-y-2">
      <h1 id={id} className="text-[1.25rem] font-medium tracking-[-0.02em] text-text-primary">
        {title}
      </h1>
      <p className="text-[0.8125rem] leading-relaxed text-text-secondary">{description}</p>
    </div>
  );
}

export function AuthGoogleStack({ children }: { children: ReactNode }) {
  return <div className="space-y-3">{children}</div>;
}

export function AuthMethodStack({ children }: { children: ReactNode }) {
  return <div className="space-y-5">{children}</div>;
}

export function AuthNativeForm({
  children,
  ...props
}: Omit<ComponentPropsWithoutRef<"form">, "className">) {
  return (
    <form className="space-y-4" {...props}>
      {children}
    </form>
  );
}

export function AuthFieldGroup({ children }: { children: ReactNode }) {
  return <div className="space-y-3">{children}</div>;
}

export function AuthToolbarRow({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap items-center justify-between gap-x-4">{children}</div>;
}

export function AuthMutedLine({ children }: { children: ReactNode }) {
  return <p className="text-[0.75rem] text-text-muted">{children}</p>;
}

export function AuthTrust() {
  return (
    <div className="space-y-3 pt-1">
      <span className="block h-px bg-border-subtle" aria-hidden="true" />
      <TrustFootnote />
    </div>
  );
}

export function AuthFamilySection({
  labelledBy,
  children,
}: {
  labelledBy: string;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={labelledBy} className="space-y-6">
      {children}
    </section>
  );
}
