import { createHash, randomBytes } from "node:crypto";

export const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000;

export function createPasswordResetToken() {
  return randomBytes(32).toString("base64url");
}

export function hashPasswordResetToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function passwordResetExpiry(now = Date.now()) {
  return new Date(now + PASSWORD_RESET_TTL_MS).toISOString();
}

export function isPasswordResetLive(expiresAt: string, usedAt: string | null, nowIso: string) {
  return !usedAt && expiresAt > nowIso;
}
