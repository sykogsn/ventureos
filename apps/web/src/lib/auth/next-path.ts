import { isFrigoraPwaPublicPath } from "@/modules/frigora/app/pwa/paths";

const DEFAULT_AFTER_AUTH = "/dashboard";

function pathOnly(value: string) {
  return value.split(/[?#]/, 1)[0] ?? "";
}

export function safeInternalPath(raw: unknown): string {
  if (typeof raw !== "string") {
    return DEFAULT_AFTER_AUTH;
  }

  const next = raw.trim();
  if (next.length === 0 || next.length > 2048) {
    return DEFAULT_AFTER_AUTH;
  }

  if (!isAcceptableInternalPath(next)) {
    return DEFAULT_AFTER_AUTH;
  }

  try {
    const decoded = decodeURIComponent(next);
    if (decoded !== next && !isAcceptableInternalPath(decoded)) {
      return DEFAULT_AFTER_AUTH;
    }
  } catch {
    return DEFAULT_AFTER_AUTH;
  }

  return next;
}

function isAcceptableInternalPath(next: string) {
  if (!next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return false;
  if (next.includes("\\") || next.includes("://")) return false;
  const path = pathOnly(next);
  if (path.split("/").includes("..")) return false;
  if (path === "/login" || path === "/signup" || path.startsWith("/login/") || path.startsWith("/signup/")) {
    return false;
  }
  return !isFrigoraPwaPublicPath(path);
}
