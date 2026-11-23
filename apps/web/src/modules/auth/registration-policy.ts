import { INITIAL_PUBLIC_ORIGIN } from "@/platform/runtime/production-process-contract";

export const REGISTRATION_POLICY_ENV = "VENTUREOS_REGISTRATION_POLICY";

export const REGISTRATION_INVITATION_MESSAGE =
  "An invitation is required to create an account.";

export type RegistrationMode = "open" | "invitation-only";

export class RegistrationPolicyError extends Error {
  readonly code = "registration-invitation-required" as const;

  constructor() {
    super(REGISTRATION_INVITATION_MESSAGE);
    this.name = "RegistrationPolicyError";
  }
}

/**
 * Open registration is decided only from server configuration.
 * Production is the restricted Frigora deployment: the process contract
 * admits one public origin, INITIAL_PUBLIC_ORIGIN. A missing, invalid, or
 * different AUTH_URL does not select open registration. Host headers,
 * return paths, and workspace ids are not inputs.
 * Other processes keep the established open registration behaviour when
 * the policy is unset or exactly "open". Any other value fails closed.
 */
export function resolveRegistrationMode(env: NodeJS.ProcessEnv = process.env): RegistrationMode {
  if (env.NODE_ENV === "production") {
    return closedProductionMode(env.AUTH_URL, env[REGISTRATION_POLICY_ENV]);
  }

  const configured = env[REGISTRATION_POLICY_ENV]?.trim() ?? "";
  if (configured === "open" || configured === "") return "open";
  return "invitation-only";
}

export function assertOpenRegistrationAllowed(env: NodeJS.ProcessEnv = process.env) {
  if (resolveRegistrationMode(env) !== "open") {
    throw new RegistrationPolicyError();
  }
}

export function googleRegistrationErrorCode(error: unknown) {
  return error instanceof RegistrationPolicyError ? ("google_invitation" as const) : null;
}

function closedProductionMode(authUrl: string | undefined, requested: string | undefined): RegistrationMode {
  const origin = serverAuthOrigin(authUrl);
  const normalised = requested?.trim() ?? "";
  // Production stays invitation-only for the contracted Frigora origin, a
  // missing or different AUTH_URL, and an explicit request for open registration.
  if (origin === INITIAL_PUBLIC_ORIGIN || normalised === "open") return "invitation-only";
  return "invitation-only";
}

function serverAuthOrigin(authUrl: string | undefined) {
  const configured = authUrl?.trim() ?? "";
  if (!configured) return null;
  try {
    const parsed = new URL(configured);
    if (
      parsed.username ||
      parsed.password ||
      parsed.search ||
      parsed.hash ||
      (parsed.pathname !== "/" && parsed.pathname !== "")
    ) {
      return null;
    }
    return `${parsed.protocol}//${parsed.host}`;
  } catch {
    return null;
  }
}
