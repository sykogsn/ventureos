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

  if (!next.startsWith("/")) {
    return DEFAULT_AFTER_AUTH;
  }

  if (next.startsWith("//") || next.startsWith("/\\") || next.includes("\\") || next.includes("://")) {
    return DEFAULT_AFTER_AUTH;
  }

  const path = pathOnly(next);
  if (path === "/login" || path === "/signup" || path.startsWith("/login/") || path.startsWith("/signup/")) {
    return DEFAULT_AFTER_AUTH;
  }

  return next;
}
