import { createClient, type Client, type InStatement } from "@libsql/client";
import { setTimeout as delay } from "node:timers/promises";
import { ensureFileDatabase, getDatabaseUrl } from "@/platform/persistence/db";

/** Overall StoredObject durability contention budget, including native waits and visibility. */
export const SQLITE_CONTENTION_BUDGET_MS = 5_000;
/**
 * Native busy_timeout per dedicated-client attempt.
 * Narrow enough that timeout + retry delay can repeat inside the 5s budget
 * without one blocked handle consuming the whole window.
 */
export const SQLITE_DURABILITY_BUSY_TIMEOUT_MS = 250;
export const SQLITE_DURABILITY_RETRY_DELAY_MS = 25;

export const storedObjectDurability = {
  openClient(timeoutMs: number): Client {
    const url = getDatabaseUrl();
    ensureFileDatabase(url);
    return createClient({ url, timeout: timeoutMs });
  },
  disposeClient(client: Client): void {
    try {
      client.close();
    } catch {
      // Client already closed.
    }
  },
};

export function sqliteErrorCode(error: unknown): string | undefined {
  let cause: unknown = error;
  while (cause && typeof cause === "object") {
    if ("code" in cause && typeof cause.code === "string") {
      return cause.code;
    }
    cause = "cause" in cause ? cause.cause : undefined;
  }
  return undefined;
}

export function isSqliteBusy(error: unknown): boolean {
  return sqliteErrorCode(error) === "SQLITE_BUSY";
}

export function isSqliteLocked(error: unknown): boolean {
  const code = sqliteErrorCode(error);
  return code === "SQLITE_LOCKED" || code?.startsWith("SQLITE_LOCKED_") === true;
}

export function isSqliteConstraint(error: unknown): boolean {
  const code = sqliteErrorCode(error);
  return code === "SQLITE_CONSTRAINT" || code?.startsWith("SQLITE_CONSTRAINT_") === true;
}

function remainingTimeout(deadline: number): number {
  return Math.max(1, Math.min(SQLITE_DURABILITY_BUSY_TIMEOUT_MS, deadline - Date.now()));
}

/** Execute on a short-lived client. SQLITE_BUSY disposes that client and retries on a new one. */
export async function withDurabilityClient<T>(
  operation: (client: Client) => Promise<T>,
  deadline: number,
): Promise<T> {
  let lastBusy: unknown;
  for (;;) {
    if (Date.now() >= deadline) {
      throw lastBusy ?? new Error("Stored object durability contention deadline exhausted");
    }
    const client = storedObjectDurability.openClient(remainingTimeout(deadline));
    try {
      const result = await operation(client);
      storedObjectDurability.disposeClient(client);
      return result;
    } catch (error) {
      storedObjectDurability.disposeClient(client);
      if (isSqliteLocked(error) || !isSqliteBusy(error)) throw error;
      lastBusy = error;
      if (Date.now() >= deadline) throw error;
      const wait = Math.min(SQLITE_DURABILITY_RETRY_DELAY_MS, Math.max(0, deadline - Date.now()));
      if (wait === 0) throw error;
      await delay(wait);
    }
  }
}

export async function executeDurability(statement: InStatement, deadline: number) {
  return withDurabilityClient((client) => client.execute(statement), deadline);
}
