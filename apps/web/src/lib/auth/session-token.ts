import { jwtVerify } from "jose";
import type { UserId } from "@/contracts";

export type SessionUser = {
  id: UserId;
  email: string;
  name: string;
  sessionId?: string;
};

export type PersistedSessionRecord = {
  id: string;
  userId: string;
  expiresAt: string;
};

export type SessionRecordLookup = (
  sessionId: string,
) => Promise<PersistedSessionRecord | null>;

export function authSecretKey() {
  const secret =
    process.env.AUTH_SECRET ??
    (process.env.NODE_ENV === "production" ? "" : "ventureos-dev-secret-change-me");

  if (!secret) {
    throw new Error("AUTH_SECRET is required");
  }

  return new TextEncoder().encode(secret);
}

export function isPersistedSessionLive(
  session: PersistedSessionRecord | null,
  nowIso: string,
): boolean {
  if (!session) {
    return false;
  }

  return session.expiresAt > nowIso;
}

export async function readSessionToken(token: string): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, authSecretKey());
    if (!payload.sub || typeof payload.email !== "string" || typeof payload.name !== "string") {
      return null;
    }

    return {
      id: payload.sub as UserId,
      email: payload.email,
      name: payload.name,
      sessionId: typeof payload.jti === "string" ? payload.jti : undefined,
    };
  } catch {
    return null;
  }
}

export async function resolveSessionUser(
  token: string,
  lookup: SessionRecordLookup,
  nowIso: string,
): Promise<SessionUser | null> {
  const user = await readSessionToken(token);
  if (!user?.sessionId) {
    return null;
  }

  const session = await lookup(user.sessionId);
  if (!session || session.userId !== user.id) {
    return null;
  }

  if (!isPersistedSessionLive(session, nowIso)) {
    return null;
  }

  return user;
}
