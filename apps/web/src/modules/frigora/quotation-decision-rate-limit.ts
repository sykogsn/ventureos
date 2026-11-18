import { createHash } from "node:crypto";

const WINDOW_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 8;

const attempts = new Map<string, number[]>();

/** Grant-scoped key. A different secret must not open a new counter for the same grant. */
function attemptKey(grantId: string) {
  return createHash("sha256").update(`quotation-decision-grant\0${grantId}`, "utf8").digest("hex");
}

/**
 * Process-local abuse control for one grant.
 * The secret is intentionally unused: it must not change the key, and it is not stored.
 * A successful review or decision still consumes an attempt.
 */
export function allowQuotationDecisionAttempt(grantId: string, _secret: string, now = Date.now()): boolean {
  const key = attemptKey(grantId);
  const recent = (attempts.get(key) ?? []).filter((at) => now - at < WINDOW_MS);
  if (recent.length >= MAX_ATTEMPTS) {
    attempts.set(key, recent);
    return false;
  }
  recent.push(now);
  attempts.set(key, recent);
  return true;
}

export function resetQuotationDecisionAttempts() {
  attempts.clear();
}
