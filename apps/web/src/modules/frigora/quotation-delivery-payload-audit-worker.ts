// Separate-process audit probe. Disposable file database only. No key material is printed.
import { ensureSchema, resetDatabaseLifecycle } from "@/platform/persistence/db";
import { resetPersistenceLifecycle } from "@/platform/persistence/repositories";
import {
  claimQuotationCustomerDelivery,
  commitDeliveryPayloadKeyRestoredAudit,
  findQuotationCustomerDelivery,
} from "./quotation-customer-delivery";
import type { FrigoraCustomerContactId, FrigoraQuotationId } from "./types";

const databaseUrl = process.argv[2];
const mode = process.argv[3];
const quotationId = process.argv[4];
const version = Number(process.argv[5]);
const contactId = process.argv[6];
const now = "2026-10-24T12:00:00.000Z";

if (!databaseUrl || !mode || !quotationId || !contactId || !Number.isInteger(version)) {
  throw new Error("delivery payload audit worker requires a database, mode, and delivery identity");
}

process.env.DATABASE_URL = databaseUrl;
if (mode === "unavailable") delete process.env.FRIGORA_DELIVERY_PAYLOAD_KEYS;

try {
  await resetPersistenceLifecycle(databaseUrl);
  await ensureSchema();
  const record = await findQuotationCustomerDelivery(
    quotationId as FrigoraQuotationId,
    version,
    contactId as FrigoraCustomerContactId,
  );
  if (!record) throw new Error("delivery payload audit worker could not load the delivery");
  if (mode === "unavailable") {
    const claim = await claimQuotationCustomerDelivery(record, now);
    process.send?.({ action: claim.action, state: claim.record.state, payload: claim.record.payloadText != null });
  } else if (mode === "restored") {
    await commitDeliveryPayloadKeyRestoredAudit(record, "test-key", now);
    process.send?.({ action: "restored" });
  } else {
    throw new Error("delivery payload audit worker mode is not recognised");
  }
  await resetDatabaseLifecycle(databaseUrl);
  process.exit(0);
} catch (error: unknown) {
  process.stderr.write(error instanceof Error ? `${error.stack}\n` : `${String(error)}\n`);
  try { await resetDatabaseLifecycle(databaseUrl); } catch { /* already closed */ }
  process.exit(1);
}
