import {
  GOOGLE_LINK_COOKIE,
  OAUTH_COOKIE,
  SESSION_COOKIE,
  VENTURE_COOKIE,
  WORKSPACE_COOKIE,
} from "@/lib/auth/cookies";

export const AUTH_COOKIES = [
  SESSION_COOKIE,
  WORKSPACE_COOKIE,
  VENTURE_COOKIE,
  OAUTH_COOKIE,
  GOOGLE_LINK_COOKIE,
] as const;

export function authCookieBaseOptions() {
  return {
    httpOnly: true as const,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
  };
}

export function sessionCookieOptions(remember: boolean) {
  return {
    ...authCookieBaseOptions(),
    ...(remember ? { maxAge: 60 * 60 * 24 * 14 } : {}),
  };
}

export function expiredAuthCookieOptions() {
  return {
    ...authCookieBaseOptions(),
    maxAge: 0,
  };
}

export function expireAuthCookies(jar: {
  set: (
    name: string,
    value: string,
    options: ReturnType<typeof expiredAuthCookieOptions>,
  ) => unknown;
}) {
  for (const name of AUTH_COOKIES) {
    jar.set(name, "", expiredAuthCookieOptions());
  }
}
