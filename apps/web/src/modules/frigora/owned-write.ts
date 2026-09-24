import { createClient, type Client, type Transaction } from "@libsql/client";
import { getDatabaseUrl } from "@/platform/persistence/db";

/** Each call owns a disposable client. Never return it to the shared read client. */
export function createFrigoraWriteClient(): Client {
  return createClient({ url: getDatabaseUrl(), timeout: 250 });
}

export type FrigoraWriteClientFactory = () => Client;

export async function withFrigoraWriteTransaction<T>(
  body: (transaction: Transaction) => Promise<T>,
  createWriteClient: FrigoraWriteClientFactory = createFrigoraWriteClient,
): Promise<T> {
  const client = createWriteClient();
  let transaction: Transaction | undefined;
  try {
    transaction = await client.transaction("write");
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
