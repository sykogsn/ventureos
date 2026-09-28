import { createClient, type Client, type Transaction } from "@libsql/client";
import { getDatabaseUrl } from "@/platform/persistence/db";

/** Disposable writer. Do not reuse the shared read client for a write lock. */
export function createPlatformWriteClient(): Client {
  return createClient({ url: getDatabaseUrl(), timeout: 250 });
}

let writeBarrier: (() => Promise<void>) | null = null;
let writeAttemptHook: (() => void) | null = null;

/** Test hook. Runs after BEGIN IMMEDIATE and before the transaction body. */
export function setPlatformWriteBarrier(barrier: (() => Promise<void>) | null) {
  writeBarrier = barrier;
}

/** Test hook. Runs when a write transaction is requested, before the lock is acquired. */
export function setPlatformWriteAttemptHook(hook: (() => void) | null) {
  writeAttemptHook = hook;
}

export async function withPlatformWriteTransaction<T>(
  body: (transaction: Transaction) => Promise<T>,
  createWriteClient: () => Client = createPlatformWriteClient,
): Promise<T> {
  const client = createWriteClient();
  let transaction: Transaction | undefined;
  try {
    writeAttemptHook?.();
    transaction = await client.transaction("write");
    if (writeBarrier) await writeBarrier();
    const result = await body(transaction);
    await transaction.commit();
    return result;
  } catch (error) {
    if (transaction && !transaction.closed) {
      await transaction.rollback();
    }
    throw error;
  } finally {
    try {
      transaction?.close();
    } finally {
      client.close();
    }
  }
}
