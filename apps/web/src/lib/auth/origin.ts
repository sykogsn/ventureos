import { headers } from "next/headers";

export function canonicalizeLocalOrigin(origin: string) {
  try {
    const url = new URL(origin);
    if (url.hostname === "127.0.0.1" || url.hostname === "[::1]" || url.hostname === "::1") {
      url.hostname = "localhost";
    }
    return url.origin;
  } catch {
    return "http://localhost:3000";
  }
}

export function resolveRequestAuthOrigin(requestUrl: URL) {
  const configured = process.env.AUTH_URL?.replace(/\/$/, "");
  if (configured) {
    return configured;
  }

  return canonicalizeLocalOrigin(requestUrl.origin);
}

export function canonicalAuthUrl(requestUrl: URL) {
  const origin = resolveRequestAuthOrigin(requestUrl);
  if (requestUrl.origin === origin) {
    return null;
  }

  return new URL(`${requestUrl.pathname}${requestUrl.search}`, origin);
}

export async function publicAppOrigin() {
  if (process.env.AUTH_URL) {
    return process.env.AUTH_URL.replace(/\/$/, "");
  }

  const headerList = await headers();
  const host = headerList.get("x-forwarded-host") ?? headerList.get("host");
  const proto =
    headerList.get("x-forwarded-proto") ??
    (process.env.NODE_ENV === "production" ? "https" : "http");

  if (host) {
    return canonicalizeLocalOrigin(`${proto}://${host}`);
  }

  return "http://localhost:3000";
}
