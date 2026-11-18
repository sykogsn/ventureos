import { createHash } from "node:crypto";
import { FrigoraError } from "./errors";

/** Provider acceptance is not inbox delivery or proof the recipient read the message. */
export type FrigoraMailOutcome = "accepted_by_provider" | "rejected" | "unknown";

export type FrigoraMailMessage = {
  from: string;
  to: string;
  subject: string;
  text: string;
  /** Stable Resend Idempotency-Key. Absent on mail that is not retried. */
  idempotencyKey?: string;
};

/**
 * Resend keeps an Idempotency-Key for 24 hours.
 * After that request has completed, the same key and payload return the original response.
 * The same key while the first request is still in progress returns 409.
 * The same key with a different payload returns 409. After 24 hours the key is not retained.
 * No Resend SDK is installed. A fake provider does not establish this contract.
 */
export const RESEND_IDEMPOTENCY_WINDOW_MS = 24 * 60 * 60 * 1000;

export function canonicalMailPayload(message: Pick<FrigoraMailMessage, "from" | "to" | "subject" | "text">) {
  return JSON.stringify({
    from: message.from,
    to: message.to,
    subject: message.subject,
    text: message.text,
  });
}

export function mailPayloadFingerprint(message: Pick<FrigoraMailMessage, "from" | "to" | "subject" | "text">) {
  return createHash("sha256").update(canonicalMailPayload(message), "utf8").digest("hex");
}

export type FrigoraMailSendResult = {
  outcome: FrigoraMailOutcome;
  providerMessageId: string | null;
};

export type FrigoraMailProvider = {
  send(message: FrigoraMailMessage): Promise<FrigoraMailSendResult>;
};

export type FrigoraMailEnv = {
  FRIGORA_RESEND_API_KEY?: string;
  FRIGORA_MAIL_VERIFIED_DOMAINS?: string;
  FRIGORA_PUBLIC_ORIGIN?: string;
};

export type FrigoraMailRuntime = {
  provider?: FrigoraMailProvider;
  verifiedDomains?: readonly string[];
  publicOrigin?: string;
  env?: FrigoraMailEnv;
};

function configuredMailEnv(env: NodeJS.ProcessEnv = process.env): FrigoraMailEnv {
  const record = env as NodeJS.ProcessEnv & FrigoraMailEnv;
  return {
    FRIGORA_RESEND_API_KEY: record.FRIGORA_RESEND_API_KEY,
    FRIGORA_MAIL_VERIFIED_DOMAINS: record.FRIGORA_MAIL_VERIFIED_DOMAINS,
    FRIGORA_PUBLIC_ORIGIN: record.FRIGORA_PUBLIC_ORIGIN,
  };
}

export function assertFrigoraPublicOrigin(value: string) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new FrigoraError("mail_not_configured", "The Frigora public origin is not configured.");
  }
  const local = url.hostname === "localhost" || url.hostname === "127.0.0.1";
  if (url.username || url.password || url.search || url.hash || url.pathname !== "/") {
    throw new FrigoraError("mail_not_configured", "The Frigora public origin is not configured.");
  }
  if (url.protocol !== "https:" && !(local && url.protocol === "http:")) {
    throw new FrigoraError("mail_not_configured", "The Frigora public origin is not configured.");
  }
  return url.origin;
}

export function resolveFrigoraPublicOrigin(runtime: FrigoraMailRuntime) {
  const candidate = runtime.publicOrigin ?? runtime.env?.FRIGORA_PUBLIC_ORIGIN ?? configuredMailEnv().FRIGORA_PUBLIC_ORIGIN;
  if (!candidate?.trim()) {
    throw new FrigoraError("mail_not_configured", "The Frigora public origin is not configured.");
  }
  return assertFrigoraPublicOrigin(candidate.trim());
}

/** The secret stays in the fragment so the browser does not send it on the first page request. */
export function quotationDecisionReviewLink(origin: string, grantId: string, secret: string) {
  const url = new URL(`/quotation-decision/${encodeURIComponent(grantId)}`, assertFrigoraPublicOrigin(origin));
  url.hash = secret;
  if (url.search !== "") {
    throw new FrigoraError("invalid_input", "Decision link is not valid.");
  }
  return url.toString();
}

export function resolveVerifiedMailDomains(runtime: FrigoraMailRuntime) {
  if (runtime.verifiedDomains) {
    return runtime.verifiedDomains.map((domain) => domain.trim().toLowerCase()).filter((domain) => domain.length > 0);
  }
  return frigoraVerifiedMailDomains(runtime.env);
}

export class FrigoraMailDeliveryError extends Error {
  readonly outcome: "rejected" | "unknown";

  constructor(outcome: "rejected" | "unknown") {
    super(
      outcome === "unknown"
        ? "The mail provider did not confirm acceptance."
        : "The mail provider rejected the message.",
    );
    this.name = "FrigoraMailDeliveryError";
    this.outcome = outcome;
  }
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeContactEmail(value: string) {
  const email = value.trim().toLowerCase();
  if (!EMAIL_PATTERN.test(email) || email.length > 254) {
    throw new FrigoraError("invalid_input", "Contact email is not valid.");
  }
  return email;
}

export function emailDomain(email: string) {
  const domain = email.slice(email.lastIndexOf("@") + 1).toLowerCase();
  if (!domain || domain.includes(" ") || domain.startsWith(".") || domain.endsWith(".")) {
    throw new FrigoraError("invalid_input", "Sender email is not valid.");
  }
  return domain;
}

/** Domains an operator has verified with the mail provider. Empty means sending is not configured. */
export function frigoraVerifiedMailDomains(env: FrigoraMailEnv = configuredMailEnv()) {
  return (env.FRIGORA_MAIL_VERIFIED_DOMAINS ?? "")
    .split(",")
    .map((domain) => domain.trim().toLowerCase())
    .filter((domain) => domain.length > 0);
}

export function frigoraMailApiKey(env: FrigoraMailEnv = configuredMailEnv()) {
  const key = env.FRIGORA_RESEND_API_KEY?.trim();
  return key ? key : null;
}

export function assertVerifiedSender(fromEmail: string, verifiedDomains: readonly string[]) {
  const email = normalizeContactEmail(fromEmail);
  const domain = emailDomain(email);
  if (!verifiedDomains.map((item) => item.toLowerCase()).includes(domain)) {
    throw new FrigoraError(
      "mail_not_configured",
      "The venture sender domain is not a provider-verified Frigora mail domain.",
    );
  }
  return email;
}

export function formatVentureSender(fromName: string, fromEmail: string) {
  const name = fromName.trim().replace(/[\r\n<>"]/g, "");
  if (!name) {
    throw new FrigoraError("invalid_input", "Venture sender name is required.");
  }
  return `${name} <${fromEmail}>`;
}

/** Resend is the existing provider. This path does not use auth mail or its outbox. */
export function createResendFrigoraMailProvider(apiKey: string): FrigoraMailProvider {
  return {
    async send(message) {
      let response: Response;
      try {
        response = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
            ...(message.idempotencyKey ? { "Idempotency-Key": message.idempotencyKey } : {}),
          },
          body: JSON.stringify({
            from: message.from,
            to: [message.to],
            subject: message.subject,
            text: message.text,
          }),
        });
      } catch {
        return { outcome: "unknown", providerMessageId: null };
      }
      if (response.status === 409 || response.status >= 500) {
        return { outcome: "unknown", providerMessageId: null };
      }
      if (!response.ok) {
        return { outcome: "rejected", providerMessageId: null };
      }
      try {
        const body = (await response.json()) as { id?: unknown };
        if (typeof body.id !== "string" || body.id.length === 0) {
          return { outcome: "unknown", providerMessageId: null };
        }
        return { outcome: "accepted_by_provider", providerMessageId: body.id };
      } catch {
        return { outcome: "unknown", providerMessageId: null };
      }
    },
  };
}

export function resolveFrigoraMailProvider(
  injected: FrigoraMailProvider | undefined,
  env: FrigoraMailEnv = configuredMailEnv(),
): FrigoraMailProvider {
  if (injected) {
    return injected;
  }
  const apiKey = frigoraMailApiKey(env);
  if (!apiKey) {
    throw new FrigoraError("mail_not_configured", "Frigora mail is not configured.");
  }
  return createResendFrigoraMailProvider(apiKey);
}
