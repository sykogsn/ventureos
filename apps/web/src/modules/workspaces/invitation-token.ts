import { createHash, randomBytes } from "node:crypto";

export const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export function createInvitationToken() {
  return randomBytes(32).toString("base64url");
}

export function hashInvitationToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function invitationExpiry(now = Date.now()) {
  return new Date(now + INVITATION_TTL_MS).toISOString();
}

export function invitationTokenFromNext(next: string) {
  const path = next.split(/[?#]/, 1)[0] ?? "";
  if (path !== "/invite") return null;
  const query = next.split("?")[1]?.split("#")[0];
  if (!query) return null;
  const token = new URLSearchParams(query).get("token");
  return token && token.trim().length > 0 ? token : null;
}
