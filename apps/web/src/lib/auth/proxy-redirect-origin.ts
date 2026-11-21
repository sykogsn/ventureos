import { FRIGORA_DIRECT_ACCESS_HOSTNAME } from "@/modules/frigora/app/direct-access";

/**
 * Keep redirect URLs independent of Render's internal proxy request URL.
 * Production is hosted on one approved customer-facing origin.
 * This helper is dependency-light so Next's proxy can use it directly.
 */
export function resolveProxyRedirectOrigin(input: {
  nodeEnv: string | undefined;
  authUrl: string | undefined;
  requestUrl: string;
}): string {
  if (input.nodeEnv !== "production") {
    return input.requestUrl;
  }

  const expected = `https://${FRIGORA_DIRECT_ACCESS_HOSTNAME}`;
  const configured = input.authUrl?.trim();
  if (!configured) {
    throw new Error("production_auth_url_missing");
  }

  let origin: URL;
  try {
    origin = new URL(configured);
  } catch {
    throw new Error("production_auth_url_invalid");
  }

  if (
    origin.origin !== expected ||
    origin.username ||
    origin.password ||
    origin.search ||
    origin.hash ||
    (origin.pathname !== "/" && origin.pathname !== "")
  ) {
    throw new Error("production_auth_url_invalid");
  }

  return expected;
}
