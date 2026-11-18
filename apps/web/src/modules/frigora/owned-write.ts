import type { Client, Transaction } from "@libsql/client";
import { getDatabaseUrl } from "@/platform/persistence/db";
import { createGuardedDatabaseClient } from "@/platform/persistence/persistent-dev-database";

/** Each call owns a disposable client. Never return it to the shared read client. */
export function createFrigoraWriteClient(): Client {
  return createGuardedDatabaseClient({ url: getDatabaseUrl(), timeout: 250, concurrency: 1 });
}

export type FrigoraWriteClientFactory = () => Client;

/**
 * Test-only hook. It runs after BEGIN IMMEDIATE and before the transaction body.
 * Production leaves it unset.
 */
let writeLockObserver: (() => Promise<void> | void) | undefined;

export function setFrigoraWriteLockObserverForTests(observer?: () => Promise<void> | void) {
  writeLockObserver = observer;
}

export async function withFrigoraWriteTransaction<T>(
  body: (transaction: Transaction) => Promise<T>,
  createWriteClient: FrigoraWriteClientFactory = createFrigoraWriteClient,
): Promise<T> {
  const client = createWriteClient();
  let transaction: Transaction | undefined;
  try {
    await client.execute("PRAGMA foreign_keys = ON");
    transaction = await client.transaction("write");
    if (writeLockObserver) {
      await writeLockObserver();
    }
    const result = await body(transaction);
    await transaction.commit();
    return result;
  } catch (error) {
    if (transaction && !transaction.closed) await transaction.rollback();
    throw error;
  } finally {
    // Acquisition can throw before a handle exists. Close the failed client too.
    // The supported transaction handle is closed separately from its client.
    try {
      transaction?.close();
    } finally {
      client.close();
    }
  }
}
