import { SignJWT } from "jose";
import { cookies } from "next/headers";
import {
  GOOGLE_LINK_COOKIE,
  OAUTH_COOKIE,
  SESSION_COOKIE,
  WORKSPACE_COOKIE,
} from "@/lib/auth/cookies";
import { sessionCookieOptions } from "@/lib/auth/session-cookie";
import { lookupPersistedSession } from "@/lib/auth/session-store";
import {
  authSecretKey,
  readSessionToken,
  resolveSessionUser,
  type SessionUser,
} from "@/lib/auth/session-token";
import { ensureSchema, getPersistence, nowIso } from "@/platform";

export { SESSION_COOKIE, WORKSPACE_COOKIE };
export type { SessionUser } from "@/lib/auth/session-token";

export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 14;

export async function createSessionToken(user: SessionUser, sessionId: string) {
  return new SignJWT({
    email: user.email,
    name: user.name,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setJti(sessionId)
    .setIssuedAt()
    .setExpirationTime("14d")
    .sign(authSecretKey());
}

export async function getSession(): Promise<SessionUser | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) {
    return null;
  }

  return resolveSessionUser(token, lookupPersistedSession, nowIso());
}

export async function setSessionCookie(
  user: SessionUser,
  sessionId: string,
  options?: { remember?: boolean },
) {
  const jar = await cookies();
  const token = await createSessionToken(user, sessionId);
  jar.set(SESSION_COOKIE, token, sessionCookieOptions(options?.remember ?? false));
}

export async function attachSessionCookies(
  response: import("next/server").NextResponse,
  user: SessionUser,
  sessionId: string,
  remember: boolean,
  workspaceId?: string,
) {
  const token = await createSessionToken(user, sessionId);
  response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions(remember));
  if (workspaceId) {
    response.cookies.set(WORKSPACE_COOKIE, workspaceId, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });
  }
}

export async function clearSessionCookie() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) {
    const user = await readSessionToken(token);
    if (user?.sessionId) {
      await ensureSchema();
      await getPersistence().sessions.deleteById(user.sessionId);
    }
  }
  jar.delete(SESSION_COOKIE);
  jar.delete(WORKSPACE_COOKIE);
  jar.delete(OAUTH_COOKIE);
  jar.delete(GOOGLE_LINK_COOKIE);
}

export async function getActiveWorkspaceId() {
  const jar = await cookies();
  return jar.get(WORKSPACE_COOKIE)?.value ?? null;
}

export async function setActiveWorkspaceCookie(workspaceId: string) {
  const jar = await cookies();
  jar.set(WORKSPACE_COOKIE, workspaceId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
}
