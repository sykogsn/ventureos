import { createId } from "@/platform/ids";
import { ensureSchema, getClient } from "@/platform/persistence/db";
import type { UserId } from "@/contracts";
import { FrigoraError } from "./errors";
import { RESEND_IDEMPOTENCY_WINDOW_MS } from "./mail";
import { withFrigoraWriteTransaction } from "./owned-write";
import {
  classifyDeliveryPayload,
  deliveryPayloadAuditId,
  deliveryPayloadKeyRingFromEnv,
  encryptDeliveryPayload,
  requireDeliveryPayloadKeyRing,
  type DeliveryPayloadKeyRing,
  type DeliveryPayloadFailureMarker,
} from "./quotation-delivery-payload";
import {
  isQuotationCustomerDeliveryState,
  type QuotationCustomerDeliveryOfficeView,
  type QuotationCustomerDeliveryState,
} from "./quotation-delivery";
import { assertPersistedOfferDocument } from "./quotation-commands";
import { decisionGrantInsert, rejectUnguardedGrantInsert, type QuotationDecisionGrantCommit } from "./quotation-store";
import type { FrigoraCustomerContactId, FrigoraQuotationId } from "./types";

export type QuotationCustomerDeliveryRecord = {
  id: string;
  workspaceId: string;
  ventureId: string;
  quotationId: string;
  version: number;
  customerId: string;
  siteId: string;
  contactId: string;
  grantId: string;
  documentHash: string;
  idempotencyKey: string;
  payloadFingerprint: string;
  payloadText: string | null;
  payloadReadFailure: DeliveryPayloadFailureMarker | null;
  state: QuotationCustomerDeliveryState;
  providerMessageId: string | null;
  createdAt: string;
  updatedAt: string;
  idempotencyStartedAt: string | null;
  actorUserId: string;
  claimOwner: string | null;
  claimLeaseExpiresAt: string | null;
  providerRequestExpiresAt: string | null;
};

/** How long one process may hold a delivery before another process may recover it. */
export const CUSTOMER_DELIVERY_CLAIM_LEASE_MS = 60_000;

/**
 * Freshness window for one provider call.
 * This is not the 60-second claim lease and not the 24-hour provider idempotency window.
 * The executing process renews it. An expired timestamp is not permission to send again
 * while that process is still inside the provider call. Once the timestamp is stale and
 * this process is not executing the call, a sending row is reconciled instead of retried.
 * A null timestamp is the other case: the call was released after an observed result, or
 * the result was recorded. Recovery may then reuse the same key inside the provider window.
 */
export const CUSTOMER_DELIVERY_PROVIDER_REQUEST_HOLD_MS = 5 * 60_000;

/** How often the executing process renews the provider-call freshness window. */
export const CUSTOMER_DELIVERY_PROVIDER_HEARTBEAT_MS = 15_000;

/** Deliveries whose provider call is inside this process. A clock jump cannot clear it. */
const executingCustomerDeliveries = new Set<string>();

/** Rows visited by one scheduled sweep. The next run continues any remainder. */
export const CUSTOMER_DELIVERY_SWEEP_BATCH = 50;

const DELIVERY_COLUMNS = `
  id, workspace_id, venture_id, quotation_id, version_number, customer_id, site_id,
  contact_id, grant_id, document_hash, idempotency_key, payload_fingerprint, payload_text,
  payload_read_failure, state, provider_message_id, created_at, updated_at, idempotency_started_at, actor_user_id,
  claim_owner, claim_lease_expires_at, provider_request_expires_at
`;

function cell(row: Record<string, unknown>, key: string) {
  const value = row[key];
  return value == null ? "" : String(value);
}

function errorText(error: unknown) {
  return error instanceof Error ? `${error.name} ${error.message}` : String(error);
}

function mapDelivery(row: Record<string, unknown>): QuotationCustomerDeliveryRecord {
  const state = cell(row, "state");
  if (!isQuotationCustomerDeliveryState(state)) {
    throw new FrigoraError("invalid_status", "Customer delivery state is not valid.");
  }
  return {
    id: cell(row, "id"),
    workspaceId: cell(row, "workspace_id"),
    ventureId: cell(row, "venture_id"),
    quotationId: cell(row, "quotation_id"),
    version: Number(row.version_number),
    customerId: cell(row, "customer_id"),
    siteId: cell(row, "site_id"),
    contactId: cell(row, "contact_id"),
    grantId: cell(row, "grant_id"),
    documentHash: cell(row, "document_hash"),
    idempotencyKey: cell(row, "idempotency_key"),
    payloadFingerprint: cell(row, "payload_fingerprint"),
    payloadText: row.payload_text == null ? null : String(row.payload_text),
    payloadReadFailure: readFailure(row.payload_read_failure),
    state,
    providerMessageId: row.provider_message_id == null ? null : String(row.provider_message_id),
    createdAt: cell(row, "created_at"),
    updatedAt: cell(row, "updated_at"),
    idempotencyStartedAt: row.idempotency_started_at == null ? null : String(row.idempotency_started_at),
    actorUserId: cell(row, "actor_user_id"),
    claimOwner: row.claim_owner == null || String(row.claim_owner).length === 0 ? null : String(row.claim_owner),
    claimLeaseExpiresAt: row.claim_lease_expires_at == null || String(row.claim_lease_expires_at).length === 0
      ? null
      : String(row.claim_lease_expires_at),
    providerRequestExpiresAt: row.provider_request_expires_at == null || String(row.provider_request_expires_at).length === 0
      ? null
      : String(row.provider_request_expires_at),
  };
}

function deliveryConflict(error: unknown) {
  const text = errorText(error);
  return /UNIQUE/i.test(text) && /frigora_quotation_customer_deliveries/i.test(text);
}

export function customerDeliveryIdempotencyKey(deliveryId: string) {
  return `quotation-customer-delivery/${deliveryId}`;
}

function readFailure(value: unknown): DeliveryPayloadFailureMarker | null {
  if (value == null || String(value).length === 0) return null;
  const text = String(value);
  if (text === "malformed_envelope" || text === "authentication_failed" || text === "fingerprint_mismatch") {
    return text;
  }
  return null;
}

export function storedPayloadMatches(record: QuotationCustomerDeliveryRecord) {
  return classifyDeliveryPayload({
    stored: record.payloadText,
    deliveryId: record.id,
    fingerprint: record.payloadFingerprint,
    ring: readDeliveryPayloadKeyRing(),
  }).kind === "readable";
}

export async function findQuotationCustomerDelivery(
  quotationId: FrigoraQuotationId,
  version: number,
  contactId: FrigoraCustomerContactId,
): Promise<QuotationCustomerDeliveryRecord | null> {
  await ensureSchema();
  const result = await readWithBusyRetry(() => getClient().execute({
    sql: `
      SELECT ${DELIVERY_COLUMNS}
      FROM frigora_quotation_customer_deliveries
      WHERE quotation_id = ? AND version_number = ? AND contact_id = ?
    `,
    args: [quotationId, version, contactId],
  }));
  const row = result.rows[0] as Record<string, unknown> | undefined;
  return row ? mapDelivery(row) : null;
}

export async function listQuotationCustomerDeliveries(
  workspaceId: string,
  ventureId: string,
  quotationId: string,
): Promise<QuotationCustomerDeliveryOfficeView[]> {
  await ensureSchema();
  const result = await getClient().execute({
    sql: `
      SELECT id, version_number, contact_id, state, provider_message_id
      FROM frigora_quotation_customer_deliveries
      WHERE workspace_id = ? AND venture_id = ? AND quotation_id = ?
      ORDER BY version_number, contact_id
    `,
    args: [workspaceId, ventureId, quotationId],
  });
  return result.rows.flatMap((row) => {
    const record = row as Record<string, unknown>;
    const state = cell(record, "state");
    if (!isQuotationCustomerDeliveryState(state)) return [];
    return [{
      id: cell(record, "id"),
      version: Number(record.version_number),
      contactId: cell(record, "contact_id"),
      state,
      providerMessageId: record.provider_message_id == null ? null : String(record.provider_message_id),
    }];
  });
}

export async function beginQuotationCustomerDelivery(input: {
  grant: QuotationDecisionGrantCommit;
  deliveryId: string;
  payloadText: string;
  payloadFingerprint: string;
}): Promise<QuotationCustomerDeliveryRecord> {
  await ensureSchema();
  await assertPersistedOfferDocument(
    { workspaceId: input.grant.workspaceId, ventureId: input.grant.ventureId },
    input.grant.quotationId,
    input.grant.version,
  );
  const idempotencyKey = customerDeliveryIdempotencyKey(input.deliveryId);
  try {
    await withFrigoraWriteTransaction(async (transaction) => {
      const inserted = await transaction.execute(decisionGrantInsert(input.grant));
      if (inserted.rowsAffected !== 1) {
        await rejectUnguardedGrantInsert(transaction, input.grant);
      }
      await transaction.execute({
        sql: `
          INSERT INTO frigora_quotation_customer_deliveries (
            id, workspace_id, venture_id, quotation_id, version_number, customer_id, site_id,
            contact_id, grant_id, document_hash, idempotency_key, payload_fingerprint, payload_text,
            state, provider_message_id, created_at, updated_at, idempotency_started_at, actor_user_id
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'prepared', NULL, ?, ?, NULL, ?)
        `,
        args: [
          input.deliveryId,
          input.grant.workspaceId,
          input.grant.ventureId,
          input.grant.quotationId,
          input.grant.version,
          input.grant.customerId,
          input.grant.siteId,
          input.grant.contactId,
          input.grant.id,
          input.grant.documentHash,
          idempotencyKey,
          input.payloadFingerprint,
          input.payloadText,
          input.grant.issuedAt,
          input.grant.issuedAt,
          input.grant.issuedByUserId,
        ],
      });
      await transaction.execute({
        sql: `
          INSERT INTO audit_events (
            id, action, occurred_at, actor_user_id, actor_kind,
            actor_agent_instance_id, actor_component, workspace_id, venture_id, metadata_json
          ) VALUES (?, 'frigora.quotation.customer_access_prepared', ?, ?, 'human', NULL, NULL, ?, ?, ?)
        `,
        args: [
          createId(),
          input.grant.issuedAt,
          input.grant.issuedByUserId,
          input.grant.workspaceId,
          input.grant.ventureId,
          JSON.stringify({
            grantId: input.grant.id,
            deliveryId: input.deliveryId,
            quotationId: input.grant.quotationId,
            version: String(input.grant.version),
            contactId: input.grant.contactId ?? "",
            expiresAt: input.grant.expiresAt,
          }),
        ],
      });
    });
  } catch (error) {
    if (error instanceof FrigoraError) throw error;
    if (!deliveryConflict(error)) throw error;
  }
  const existing = await findQuotationCustomerDelivery(
    input.grant.quotationId,
    input.grant.version,
    input.grant.contactId as FrigoraCustomerContactId,
  );
  if (!existing) {
    throw new FrigoraError("customer_delivery_unavailable", "Customer delivery was not recorded.");
  }
  return existing;
}

export type CustomerDeliveryClaim =
  | { action: "send"; record: QuotationCustomerDeliveryRecord }
  | { action: "accepted" | "rejected" | "reconcile" | "in_flight" | "payload_blocked"; record: QuotationCustomerDeliveryRecord };

function parsedInstant(value: string | null) {
  if (!value) return Number.NaN;
  return Date.parse(value);
}

/** A first prepared send has no provider-attempt clock. Anything already attempted must prove the window. */
export function customerDeliveryRetrySafety(
  record: QuotationCustomerDeliveryRecord,
  now: string,
): "first_send" | "retry" | "reconcile" {
  const nowMs = parsedInstant(now);
  const attempted = record.state === "sending"
    || record.state === "outcome_unknown"
    || record.idempotencyStartedAt != null;
  if (!attempted && record.state === "prepared") {
    return Number.isNaN(nowMs) ? "reconcile" : "first_send";
  }
  const started = parsedInstant(record.idempotencyStartedAt);
  if (Number.isNaN(nowMs) || Number.isNaN(started)) return "reconcile";
  if (nowMs - started >= RESEND_IDEMPOTENCY_WINDOW_MS) return "reconcile";
  return "retry";
}

async function reloadDelivery(record: QuotationCustomerDeliveryRecord) {
  const next = await findQuotationCustomerDelivery(
    record.quotationId as FrigoraQuotationId,
    record.version,
    record.contactId as FrigoraCustomerContactId,
  );
  if (!next) throw new FrigoraError("customer_delivery_unavailable", "Customer delivery was not recorded.");
  return next;
}

function readDeliveryPayloadKeyRing(): DeliveryPayloadKeyRing | null {
  return deliveryPayloadKeyRingFromEnv();
}

function isAuditIdConflict(error: unknown) {
  return /UNIQUE constraint failed: audit_events\.id/i.test(errorText(error));
}

function isSqliteBusy(error: unknown) {
  return /SQLITE_BUSY|database is locked|database is busy/i.test(errorText(error));
}

async function readWithBusyRetry<T>(operation: () => Promise<T>): Promise<T> {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      if (!isSqliteBusy(error) || attempt === 7) throw error;
      await new Promise((resolve) => setTimeout(resolve, 40 * (attempt + 1)));
    }
  }
  throw new FrigoraError("customer_delivery_unavailable", "Customer delivery was not recorded.");
}

function classifyRecord(record: QuotationCustomerDeliveryRecord) {
  return classifyDeliveryPayload({
    stored: record.payloadText,
    deliveryId: record.id,
    fingerprint: record.payloadFingerprint,
    ring: readDeliveryPayloadKeyRing(),
  });
}

async function insertDeliveryPayloadAudit(input: {
  event: "unavailable" | "restored" | "reverified";
  action: string;
  record: QuotationCustomerDeliveryRecord;
  keyId: string;
  now: string;
  requireUnavailable?: boolean;
}): Promise<"inserted" | "exists" | "withheld"> {
  const id = deliveryPayloadAuditId(input.event, input.record.id, input.keyId);
  const unavailableId = deliveryPayloadAuditId("unavailable", input.record.id, input.keyId);
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      let outcome: "inserted" | "withheld" = "inserted";
      await withFrigoraWriteTransaction(async (transaction) => {
        if (input.requireUnavailable) {
          const prior = await transaction.execute({
            sql: "SELECT id FROM audit_events WHERE id = ?",
            args: [unavailableId],
          });
          if (!prior.rows[0]) {
            outcome = "withheld";
            return;
          }
        }
        await transaction.execute({
          sql: `
            INSERT INTO audit_events (
              id, action, occurred_at, actor_user_id, actor_kind,
              actor_agent_instance_id, actor_component, workspace_id, venture_id, metadata_json
            ) VALUES (?, ?, ?, ?, 'system', NULL, 'frigora.quotation-delivery', ?, ?, ?)
          `,
          args: [
            id,
            input.action,
            input.now,
            input.record.actorUserId,
            input.record.workspaceId,
            input.record.ventureId,
            JSON.stringify({
              deliveryId: input.record.id,
              quotationId: input.record.quotationId,
              keyId: input.keyId,
            }),
          ],
        });
      });
      return outcome;
    } catch (error) {
      if (isAuditIdConflict(error)) return "exists";
      if (isSqliteBusy(error) && attempt < 4) {
        await new Promise((resolve) => setTimeout(resolve, 25 * (attempt + 1)));
        continue;
      }
      throw error;
    }
  }
  throw new FrigoraError("customer_delivery_unavailable", "Delivery payload audit was not recorded.");
}

async function preserveUnreadDeliveryPayload(
  record: QuotationCustomerDeliveryRecord,
  now: string,
): Promise<CustomerDeliveryClaim | null> {
  if (record.payloadReadFailure) return { action: "payload_blocked", record };
  const classified = classifyRecord(record);
  if (classified.kind === "readable") return null;
  if (classified.kind === "key_unavailable") {
    await insertDeliveryPayloadAudit({
      event: "unavailable",
      action: "frigora.quotation.delivery_payload_key_unavailable",
      record,
      keyId: classified.keyId,
      now,
    });
    return { action: "payload_blocked", record };
  }
  if (classified.kind === "unsupported_version" || classified.kind === "empty") {
    return { action: "payload_blocked", record };
  }
  if (record.payloadText) {
    await withFrigoraWriteTransaction(async (transaction) => {
      await transaction.execute({
        sql: `
          UPDATE frigora_quotation_customer_deliveries
          SET payload_read_failure = ?, updated_at = ?
          WHERE id = ? AND payload_text = ? AND payload_read_failure IS NULL
        `,
        args: [classified.kind, now, record.id, record.payloadText],
      });
    });
  }
  return { action: "payload_blocked", record: await reloadDelivery(record) };
}

export async function commitDeliveryPayloadKeyRestoredAudit(
  record: QuotationCustomerDeliveryRecord,
  keyId: string,
  now: string,
) {
  const result = await insertDeliveryPayloadAudit({
    event: "restored",
    action: "frigora.quotation.delivery_payload_key_restored",
    record,
    keyId,
    now,
    requireUnavailable: true,
  });
  if (result === "withheld") return;
}

async function markReconciliation(
  record: QuotationCustomerDeliveryRecord,
  now: string,
  detail: string,
  staleRequestOnly = false,
) {
  let current = record;
  const requestFence = staleRequestOnly
    ? "AND provider_request_expires_at IS NOT NULL AND provider_request_expires_at <= ?"
    : "AND (provider_request_expires_at IS NULL OR provider_request_expires_at <= ?)";
  for (let attempt = 0; attempt < 2; attempt += 1) {
    if (current.payloadText == null) return reloadDelivery(current);
    if (classifyRecord(current).kind !== "readable") return reloadDelivery(current);
    let wrote = false;
    await withFrigoraWriteTransaction(async (transaction) => {
      const updated = await transaction.execute({
        sql: `
          UPDATE frigora_quotation_customer_deliveries
          SET state = 'reconciliation_required', payload_text = NULL,
              claim_owner = NULL, claim_lease_expires_at = NULL,
              provider_request_expires_at = NULL, updated_at = ?
          WHERE id = ? AND state IN ('prepared', 'sending', 'outcome_unknown')
            AND (claim_lease_expires_at IS NULL OR claim_lease_expires_at <= ?)
            ${requestFence}
            AND payload_text = ?
        `,
        args: [now, current.id, now, now, current.payloadText],
      });
      if (updated.rowsAffected !== 1) return;
      wrote = true;
      await transaction.execute({
        sql: `
          INSERT INTO frigora_quotation_customer_delivery_attempts (
            id, delivery_id, occurred_at, actor_user_id, outcome, detail
          ) VALUES (?, ?, ?, ?, 'reconciliation_required', ?)
        `,
        args: [createId(), current.id, now, current.actorUserId, detail],
      });
    });
    if (wrote) return reloadDelivery(current);
    const latest = await reloadDelivery(current);
    if (latest.payloadText === current.payloadText && latest.state === current.state) return latest;
    current = latest;
  }
  return reloadDelivery(current);
}

function instantIsAfter(value: string | null, nowMs: number) {
  const parsed = parsedInstant(value);
  return !Number.isNaN(parsed) && parsed > nowMs;
}

/** A live claim lease, a fresh provider deadline, or a call executing in this process. */
export function customerDeliveryExecutionIsProtected(
  record: Pick<QuotationCustomerDeliveryRecord, "claimLeaseExpiresAt" | "providerRequestExpiresAt">,
  now: string,
  deliveryId?: string,
) {
  if (deliveryId && executingCustomerDeliveries.has(deliveryId)) return true;
  const nowMs = parsedInstant(now);
  const leaseHeld = !Number.isNaN(nowMs) && instantIsAfter(record.claimLeaseExpiresAt, nowMs);
  const freshForCaller = !Number.isNaN(nowMs) && instantIsAfter(record.providerRequestExpiresAt, nowMs);
  const freshForProcess = instantIsAfter(record.providerRequestExpiresAt, Date.now());
  return leaseHeld || freshForCaller || freshForProcess;
}

export function customerDeliveryProviderDeadline(now: string) {
  const logical = parsedInstant(now);
  const base = Number.isNaN(logical) ? Date.now() : Math.max(logical, Date.now());
  return new Date(base + CUSTOMER_DELIVERY_PROVIDER_REQUEST_HOLD_MS).toISOString();
}

function providerRequestWasAbandoned(
  record: Pick<QuotationCustomerDeliveryRecord, "id" | "state" | "providerRequestExpiresAt" | "claimLeaseExpiresAt">,
  now: string,
) {
  if (record.state !== "sending" || !record.providerRequestExpiresAt) return false;
  return !customerDeliveryExecutionIsProtected(record, now, record.id);
}

function retryIsClosed(state: string, startedAt: string | null, nowMs: number) {
  if (state !== "sending" && state !== "outcome_unknown") return false;
  const started = parsedInstant(startedAt);
  return Number.isNaN(started) || nowMs - started >= RESEND_IDEMPOTENCY_WINDOW_MS;
}

/** Clears bearer payloads that are no longer needed and blocks expired retries. Prepared rows stay. */
export async function sweepQuotationCustomerDeliveryPayloads(now: string) {
  await ensureSchema();
  const nowMs = parsedInstant(now);
  if (Number.isNaN(nowMs)) return { reconciled: 0, cleared: 0 };
  const found = await getClient().execute({
    sql: `
      SELECT id, workspace_id, venture_id, quotation_id, version_number, contact_id,
             state, idempotency_started_at, actor_user_id,
             claim_lease_expires_at, provider_request_expires_at,
             payload_text, payload_fingerprint, payload_read_failure,
             payload_text IS NOT NULL AS has_payload
      FROM frigora_quotation_customer_deliveries
      WHERE (
          state IN ('sending', 'outcome_unknown')
          AND (claim_lease_expires_at IS NULL OR claim_lease_expires_at <= ?)
          AND (provider_request_expires_at IS NULL OR provider_request_expires_at <= ?)
        )
        OR (
          payload_text IS NOT NULL
          AND state IN ('accepted_by_provider', 'rejected_by_provider', 'reconciliation_required')
        )
      LIMIT ${CUSTOMER_DELIVERY_SWEEP_BATCH}
    `,
    args: [now, now],
  });
  let reconciled = 0;
  let cleared = 0;
  for (const row of found.rows) {
    const id = String(row.id);
    const state = String(row.state);
    const startedAt = row.idempotency_started_at == null ? null : String(row.idempotency_started_at);
    const hasPayload = Number(row.has_payload) === 1;
    const claimLeaseExpiresAt = row.claim_lease_expires_at == null ? null : String(row.claim_lease_expires_at);
    const providerRequestExpiresAt = row.provider_request_expires_at == null
      ? null
      : String(row.provider_request_expires_at);
    const openRequest = state === "sending" || state === "outcome_unknown";
    if (openRequest && customerDeliveryExecutionIsProtected({
      claimLeaseExpiresAt,
      providerRequestExpiresAt,
    }, now, id)) {
      continue;
    }
    const candidate = {
      id,
      workspaceId: String(row.workspace_id),
      ventureId: String(row.venture_id),
      quotationId: String(row.quotation_id),
      version: Number(row.version_number),
      customerId: "",
      siteId: "",
      contactId: String(row.contact_id),
      grantId: "",
      documentHash: "",
      idempotencyKey: "",
      payloadFingerprint: String(row.payload_fingerprint ?? ""),
      payloadText: row.payload_text == null ? null : String(row.payload_text),
      payloadReadFailure: readFailure(row.payload_read_failure),
      state: state as QuotationCustomerDeliveryRecord["state"],
      providerMessageId: null,
      createdAt: now,
      updatedAt: now,
      idempotencyStartedAt: startedAt,
      actorUserId: String(row.actor_user_id),
      claimOwner: null,
      claimLeaseExpiresAt,
      providerRequestExpiresAt,
    } satisfies QuotationCustomerDeliveryRecord;
    const preserved = await preserveUnreadDeliveryPayload(candidate, now);
    if (preserved || candidate.payloadText == null) continue;
    const verifiedPayload = candidate.payloadText;
    if (providerRequestWasAbandoned({
      id,
      state: state as QuotationCustomerDeliveryRecord["state"],
      providerRequestExpiresAt,
      claimLeaseExpiresAt,
    }, now)) {
      const updated = await withFrigoraWriteTransaction(async (transaction) => {
        const result = await transaction.execute({
          sql: `
            UPDATE frigora_quotation_customer_deliveries
            SET state = 'reconciliation_required', payload_text = NULL,
                claim_owner = NULL, claim_lease_expires_at = NULL,
                provider_request_expires_at = NULL, updated_at = ?
            WHERE id = ? AND state = 'sending'
              AND provider_request_expires_at IS NOT NULL
              AND (claim_lease_expires_at IS NULL OR claim_lease_expires_at <= ?)
              AND provider_request_expires_at <= ?
              AND payload_text = ?
          `,
          args: [now, id, now, now, verifiedPayload],
        });
        if (result.rowsAffected !== 1) return 0;
        await transaction.execute({
          sql: `
            INSERT INTO frigora_quotation_customer_delivery_attempts (
              id, delivery_id, occurred_at, actor_user_id, outcome, detail
            ) VALUES (?, ?, ?, ?, 'reconciliation_required', ?)
          `,
          args: [
            createId(),
            id,
            now,
            String(row.actor_user_id),
            "The provider request ended without a saved outcome. Automatic sending is blocked and the same key was not sent again.",
          ],
        });
        return 1;
      });
      reconciled += updated;
      continue;
    }
    if (retryIsClosed(state, startedAt, nowMs)) {
      const updated = await withFrigoraWriteTransaction(async (transaction) => {
        const result = await transaction.execute({
          sql: `
            UPDATE frigora_quotation_customer_deliveries
            SET state = 'reconciliation_required', payload_text = NULL,
                claim_owner = NULL, claim_lease_expires_at = NULL,
                provider_request_expires_at = NULL, updated_at = ?
            WHERE id = ? AND state = ?
              AND (claim_lease_expires_at IS NULL OR claim_lease_expires_at <= ?)
              AND (provider_request_expires_at IS NULL OR provider_request_expires_at <= ?)
              AND payload_text = ?
          `,
          args: [now, id, state, now, now, verifiedPayload],
        });
        if (result.rowsAffected !== 1) return 0;
        await transaction.execute({
          sql: `
            INSERT INTO frigora_quotation_customer_delivery_attempts (
              id, delivery_id, occurred_at, actor_user_id, outcome, detail
            ) VALUES (?, ?, ?, ?, 'reconciliation_required', ?)
          `,
          args: [
            createId(),
            id,
            now,
            String(row.actor_user_id),
            "The provider retry window is not provable. Automatic sending is blocked and the sensitive payload was cleared.",
          ],
        });
        return 1;
      });
      reconciled += updated;
      continue;
    }
    if (
      hasPayload
      && (state === "accepted_by_provider" || state === "rejected_by_provider" || state === "reconciliation_required")
    ) {
      const updated = await withFrigoraWriteTransaction(async (transaction) => {
        const result = await transaction.execute({
          sql: `
            UPDATE frigora_quotation_customer_deliveries
            SET payload_text = NULL, updated_at = ?
            WHERE id = ? AND state = ? AND payload_text = ?
          `,
          args: [now, id, state, verifiedPayload],
        });
        return result.rowsAffected === 1 ? 1 : 0;
      });
      cleared += updated;
    }
  }
  return { reconciled, cleared };
}

export async function releaseQuotationCustomerDeliveryClaim(
  record: QuotationCustomerDeliveryRecord,
  now: string,
) {
  if (!record.claimOwner) return;
  await withFrigoraWriteTransaction(async (transaction) => {
    await transaction.execute({
      sql: `
        UPDATE frigora_quotation_customer_deliveries
        SET claim_owner = NULL, claim_lease_expires_at = NULL,
            provider_request_expires_at = NULL, updated_at = ?
        WHERE id = ? AND claim_owner = ? AND state IN ('sending', 'outcome_unknown')
      `,
      args: [now, record.id, record.claimOwner],
    });
  });
}

function claimFromState(record: QuotationCustomerDeliveryRecord): CustomerDeliveryClaim | null {
  if (record.state === "accepted_by_provider") return { action: "accepted", record };
  if (record.state === "rejected_by_provider") return { action: "rejected", record };
  if (record.state === "reconciliation_required") return { action: "reconcile", record };
  return null;
}

export async function claimQuotationCustomerDelivery(
  record: QuotationCustomerDeliveryRecord,
  now: string,
): Promise<CustomerDeliveryClaim> {
  await ensureSchema();
  await sweepQuotationCustomerDeliveryPayloads(now);
  const current = await reloadDelivery(record);
  const terminal = claimFromState(current);
  if (terminal) return terminal;
  const preserved = await preserveUnreadDeliveryPayload(current, now);
  if (preserved) return preserved;
  if (customerDeliveryExecutionIsProtected(current, now, current.id)) {
    return { action: "in_flight", record: current };
  }
  if (providerRequestWasAbandoned(current, now)) {
    const reconciled = await markReconciliation(
      current,
      now,
      "The provider request ended without a saved outcome. Automatic sending is blocked and the same key was not sent again.",
      true,
    );
    if (reconciled.state !== "reconciliation_required") {
      return { action: "in_flight", record: reconciled };
    }
    return { action: "reconcile", record: reconciled };
  }
  const safety = customerDeliveryRetrySafety(current, now);
  if (safety === "reconcile") {
    const reconciled = await markReconciliation(
      current,
      now,
      "The provider retry window is not provable. The same key was not sent again.",
    );
    if (reconciled.state !== "reconciliation_required") {
      return { action: "in_flight", record: reconciled };
    }
    return { action: "reconcile", record: reconciled };
  }
  const owner = createId();
  const lease = new Date(parsedInstant(now) + CUSTOMER_DELIVERY_CLAIM_LEASE_MS).toISOString();
  let claimed = 0;
  await withFrigoraWriteTransaction(async (transaction) => {
    const updated = await transaction.execute({
      sql: `
        UPDATE frigora_quotation_customer_deliveries
        SET state = 'sending',
            claim_owner = ?,
            claim_lease_expires_at = ?,
            idempotency_started_at = COALESCE(idempotency_started_at, ?),
            updated_at = ?
        WHERE id = ?
          AND state IN ('prepared', 'sending', 'outcome_unknown')
          AND (
            claim_owner IS NULL
            OR claim_lease_expires_at IS NULL
            OR claim_lease_expires_at <= ?
          )
          AND (
            provider_request_expires_at IS NULL
            OR provider_request_expires_at <= ?
          )
      `,
      args: [owner, lease, now, now, current.id, now, now],
    });
    claimed = updated.rowsAffected;
    if (claimed !== 1) return;
    await transaction.execute({
      sql: `
        INSERT INTO frigora_quotation_customer_delivery_attempts (
          id, delivery_id, occurred_at, actor_user_id, outcome, detail
        ) VALUES (?, ?, ?, ?, 'sending', ?)
      `,
      args: [
        createId(),
        current.id,
        now,
        current.actorUserId,
        "Provider call started with the persisted idempotency key.",
      ],
    });
  });
  const next = await reloadDelivery(current);
  if (claimed === 1) return { action: "send", record: next };
  return claimFromState(next) ?? { action: "in_flight", record: next };
}

export async function recordQuotationCustomerDeliveryResult(input: {
  record: QuotationCustomerDeliveryRecord;
  outcome: "accepted_by_provider" | "rejected_by_provider" | "outcome_unknown";
  providerMessageId: string | null;
  now: string;
  actorUserId: UserId;
}) {
  await ensureSchema();
  const detail = input.outcome === "accepted_by_provider"
    ? "Provider accepted the message. This is not inbox delivery."
    : input.outcome === "rejected_by_provider"
      ? "Provider rejected the message. This is not inbox delivery."
      : "Provider outcome is unknown. The same delivery operation remains. This is not inbox delivery.";
  const persist = async (expectedPayload: string | null) => {
    let saved: "saved" | "already" | "miss" = "miss";
    await withFrigoraWriteTransaction(async (transaction) => {
      const comparePayload = input.outcome !== "outcome_unknown" && expectedPayload != null;
      const updated = await transaction.execute({
        sql: `
          UPDATE frigora_quotation_customer_deliveries
          SET state = ?,
              provider_message_id = COALESCE(?, provider_message_id),
              payload_text = ${input.outcome === "outcome_unknown" ? "payload_text" : "NULL"},
              claim_owner = NULL,
              claim_lease_expires_at = NULL,
              provider_request_expires_at = NULL,
              updated_at = ?
          WHERE id = ? AND claim_owner = ? AND state IN ('sending', 'prepared', 'outcome_unknown')
          ${comparePayload ? "AND payload_text = ?" : ""}
        `,
        args: [
          input.outcome,
          input.providerMessageId,
          input.now,
          input.record.id,
          input.record.claimOwner,
          ...(comparePayload ? [expectedPayload] : []),
        ],
      });
      if (updated.rowsAffected !== 1) {
        const current = await transaction.execute({
          sql: `SELECT state FROM frigora_quotation_customer_deliveries WHERE id = ?`,
          args: [input.record.id],
        });
        saved = String(current.rows[0]?.state ?? "") === input.outcome ? "already" : "miss";
        return;
      }
      saved = "saved";
      if (input.outcome === "rejected_by_provider") {
        await transaction.execute({
          sql: `
            UPDATE frigora_quotation_decision_grants
            SET revoked_at = ?
            WHERE id = ? AND consumed_at IS NULL AND revoked_at IS NULL
          `,
          args: [input.now, input.record.grantId],
        });
      }
      await transaction.execute({
        sql: `
          INSERT INTO frigora_quotation_customer_delivery_attempts (
            id, delivery_id, occurred_at, actor_user_id, outcome, detail
          ) VALUES (?, ?, ?, ?, ?, ?)
        `,
        args: [createId(), input.record.id, input.now, input.actorUserId, input.outcome, detail],
      });
      const action = input.outcome === "accepted_by_provider"
        ? "frigora.quotation.decision_grant_accepted_by_provider"
        : "frigora.quotation.decision_grant_delivery_failed";
      await transaction.execute({
        sql: `
          INSERT INTO audit_events (
            id, action, occurred_at, actor_user_id, actor_kind,
            actor_agent_instance_id, actor_component, workspace_id, venture_id, metadata_json
          ) VALUES (?, ?, ?, ?, 'human', NULL, NULL, ?, ?, ?)
        `,
        args: [
          createId(),
          action,
          input.now,
          input.actorUserId,
          input.record.workspaceId,
          input.record.ventureId,
          JSON.stringify({
            grantId: input.record.grantId,
            deliveryId: input.record.id,
            quotationId: input.record.quotationId,
            contactId: input.record.contactId,
            outcome: input.outcome,
            providerMessageId: input.providerMessageId ?? "",
          }),
        ],
      });
    });
    return saved;
  };
  let status = await persist(input.record.payloadText);
  if (status === "miss" && input.outcome !== "outcome_unknown") {
    const latest = await reloadDelivery(input.record);
    const classified = classifyRecord(latest);
    if (
      classified.kind === "readable"
      && latest.payloadFingerprint === input.record.payloadFingerprint
      && latest.payloadText !== input.record.payloadText
      && latest.claimOwner === input.record.claimOwner
    ) {
      status = await persist(latest.payloadText);
    }
  }
  if (status === "miss") {
    throw new FrigoraError("customer_delivery_unavailable", "Customer delivery result was not saved.");
  }
  const next = await findQuotationCustomerDelivery(
    input.record.quotationId as FrigoraQuotationId,
    input.record.version,
    input.record.contactId as FrigoraCustomerContactId,
  );
  if (!next) throw new FrigoraError("customer_delivery_unavailable", "Customer delivery was not recorded.");
  return next;
}

/** Marks the provider call as in progress before the network request starts. */
export async function beginQuotationCustomerProviderRequest(input: {
  record: QuotationCustomerDeliveryRecord;
  now: string;
}): Promise<QuotationCustomerDeliveryRecord | null> {
  await ensureSchema();
  const nowMs = parsedInstant(input.now);
  if (Number.isNaN(nowMs) || !input.record.claimOwner) return null;
  const expires = customerDeliveryProviderDeadline(input.now);
  const updated = await getClient().execute({
    sql: `
      UPDATE frigora_quotation_customer_deliveries
      SET provider_request_expires_at = ?, updated_at = ?
      WHERE id = ? AND claim_owner = ? AND state = 'sending'
        AND (provider_request_expires_at IS NULL OR provider_request_expires_at <= ?)
    `,
    args: [expires, input.now, input.record.id, input.record.claimOwner, input.now],
  });
  if (updated.rowsAffected !== 1) return null;
  return reloadDelivery(input.record);
}

/** Moves the provider deadline forward while the owning process is still inside the call. */
export async function renewQuotationCustomerProviderRequest(input: {
  record: QuotationCustomerDeliveryRecord;
  now: string;
}) {
  if (!input.record.claimOwner) return;
  const expires = customerDeliveryProviderDeadline(input.now);
  await getClient().execute({
    sql: `
      UPDATE frigora_quotation_customer_deliveries
      SET provider_request_expires_at = ?, updated_at = ?
      WHERE id = ? AND claim_owner = ? AND state = 'sending'
        AND (
          provider_request_expires_at IS NULL
          OR provider_request_expires_at < ?
        )
    `,
    args: [expires, input.now, input.record.id, input.record.claimOwner, expires],
  });
}

export function noteCustomerDeliveryExecuting(deliveryId: string) {
  executingCustomerDeliveries.add(deliveryId);
}

export function clearCustomerDeliveryExecuting(deliveryId: string) {
  executingCustomerDeliveries.delete(deliveryId);
}

/** Renews the provider deadline until the caller stops the watch. */
export function watchQuotationCustomerProviderRequest(
  record: QuotationCustomerDeliveryRecord,
  now: string,
) {
  let stopped = false;
  const beat = () => {
    if (stopped) return;
    void renewQuotationCustomerProviderRequest({ record, now });
  };
  const timer = setInterval(beat, CUSTOMER_DELIVERY_PROVIDER_HEARTBEAT_MS);
  timer.unref();
  return () => {
    stopped = true;
    clearInterval(timer);
  };
}

/**
 * Maintenance entry used by the platform scheduler.
 * Counts are safe to log. Payloads, links and bearer secrets are not.
 */
export async function runScheduledQuotationCustomerDeliverySweep(now = new Date().toISOString()) {
  const result = await sweepQuotationCustomerDeliveryPayloads(now);
  console.info(
    "[frigora] customer-delivery sweep completed",
    `reconciled=${result.reconciled}`,
    `cleared=${result.cleared}`,
  );
  return result;
}

export type DeliveryPayloadBackfillReport = {
  examined: number;
  encrypted: number;
  skipped: number;
  retried: number;
  failed: number;
};

/** One-shot operator pass. Not called from the 15-second maintenance tick. */
export async function backfillQuotationDeliveryPayloadEncryption(now: string): Promise<DeliveryPayloadBackfillReport> {
  await ensureSchema();
  const ring = requireDeliveryPayloadKeyRing();
  const found = await getClient().execute({
    sql: `
      SELECT ${DELIVERY_COLUMNS}
      FROM frigora_quotation_customer_deliveries
      WHERE state IN ('prepared', 'sending', 'outcome_unknown')
        AND payload_text LIKE '{%'
    `,
  });
  const report: DeliveryPayloadBackfillReport = {
    examined: found.rows.length,
    encrypted: 0,
    skipped: 0,
    retried: 0,
    failed: 0,
  };
  for (const row of found.rows) {
    const record = mapDelivery(row as Record<string, unknown>);
    if (executingCustomerDeliveries.has(record.id) || !record.payloadText) {
      report.skipped += 1;
      continue;
    }
    const classified = classifyDeliveryPayload({
      stored: record.payloadText,
      deliveryId: record.id,
      fingerprint: record.payloadFingerprint,
      ring,
    });
    if (classified.kind !== "readable" || classified.encoding !== "legacy") {
      report.failed += 1;
      await preserveUnreadDeliveryPayload(record, now);
      continue;
    }
    const encrypted = encryptDeliveryPayload({
      ring,
      deliveryId: record.id,
      fingerprint: record.payloadFingerprint,
      plaintext: classified.plaintext,
    });
    let finished = false;
    for (let attempt = 0; attempt < 5 && !finished; attempt += 1) {
      try {
        const updated = await withFrigoraWriteTransaction(async (transaction) => {
          const result = await transaction.execute({
            sql: `
              UPDATE frigora_quotation_customer_deliveries
              SET payload_text = ?, updated_at = ?
              WHERE id = ?
                AND payload_text = ?
                AND payload_fingerprint = ?
                AND idempotency_key = ?
                AND payload_read_failure IS NULL
                AND state IN ('prepared', 'sending', 'outcome_unknown')
            `,
            args: [encrypted, now, record.id, record.payloadText, record.payloadFingerprint, record.idempotencyKey],
          });
          return result.rowsAffected;
        });
        if (updated === 1) report.encrypted += 1;
        else report.skipped += 1;
        finished = true;
      } catch (error) {
        if (!isSqliteBusy(error) || attempt === 4) {
          report.failed += 1;
          finished = true;
          continue;
        }
        report.retried += 1;
      }
    }
  }
  return report;
}

export async function inspectQuotationDeliveryPayloadEncryption() {
  await ensureSchema();
  const ring = deliveryPayloadKeyRingFromEnv();
  const open = await getClient().execute({
    sql: `
      SELECT ${DELIVERY_COLUMNS}
      FROM frigora_quotation_customer_deliveries
      WHERE state IN ('prepared', 'sending', 'outcome_unknown')
    `,
  });
  const terminal = await getClient().execute(`
    SELECT COUNT(*) AS n
    FROM frigora_quotation_customer_deliveries
    WHERE state IN ('accepted_by_provider', 'rejected_by_provider', 'reconciliation_required')
  `);
  const counts = {
    verifiedLegacyPlaintext: 0,
    verifiedEncrypted: 0,
    missingKey: 0,
    unsupportedVersion: 0,
    malformedEnvelope: 0,
    authenticationFailed: 0,
    fingerprintMismatch: 0,
    nullOpenPayload: 0,
    otherPermanentMarker: 0,
  };
  let failureMarkerCount = 0;
  for (const row of open.rows) {
    const record = mapDelivery(row as Record<string, unknown>);
    if (record.payloadReadFailure) failureMarkerCount += 1;
    if (record.payloadText == null) {
      counts.nullOpenPayload += 1;
      continue;
    }
    if (record.payloadReadFailure === "malformed_envelope") {
      counts.malformedEnvelope += 1;
      continue;
    }
    if (record.payloadReadFailure === "authentication_failed") {
      counts.authenticationFailed += 1;
      continue;
    }
    if (record.payloadReadFailure === "fingerprint_mismatch") {
      counts.fingerprintMismatch += 1;
      continue;
    }
    if (record.payloadReadFailure) {
      counts.otherPermanentMarker += 1;
      continue;
    }
    const classified = classifyDeliveryPayload({
      stored: record.payloadText,
      deliveryId: record.id,
      fingerprint: record.payloadFingerprint,
      ring,
    });
    if (classified.kind === "readable") {
      counts[classified.encoding === "legacy" ? "verifiedLegacyPlaintext" : "verifiedEncrypted"] += 1;
    } else if (classified.kind === "key_unavailable") counts.missingKey += 1;
    else if (classified.kind === "unsupported_version") counts.unsupportedVersion += 1;
    else if (classified.kind === "malformed_envelope") counts.malformedEnvelope += 1;
    else if (classified.kind === "authentication_failed") counts.authenticationFailed += 1;
    else if (classified.kind === "fingerprint_mismatch") counts.fingerprintMismatch += 1;
    else counts.otherPermanentMarker += 1;
  }
  return {
    ...counts,
    openExamined: open.rows.length,
    terminalExcluded: Number(terminal.rows[0]?.n ?? 0),
    failureMarkerCount,
  };
}

/** Operator-only. Does not send and does not clear malformed or fingerprint markers. */
export async function reverifyQuotationDeliveryPayloadAuthentication(deliveryId: string, now: string) {
  await ensureSchema();
  const found = await getClient().execute({
    sql: `SELECT ${DELIVERY_COLUMNS} FROM frigora_quotation_customer_deliveries WHERE id = ?`,
    args: [deliveryId],
  });
  const row = found.rows[0] as Record<string, unknown> | undefined;
  if (!row) throw new FrigoraError("not_found", "Customer delivery was not found.");
  const record = mapDelivery(row);
  if (record.payloadReadFailure !== "authentication_failed") {
    throw new FrigoraError("invalid_status", "Only an authentication failure can be re-verified.");
  }
  const classified = classifyDeliveryPayload({
    stored: record.payloadText,
    deliveryId: record.id,
    fingerprint: record.payloadFingerprint,
    ring: requireDeliveryPayloadKeyRing(),
  });
  if (classified.kind !== "readable" || !classified.keyId || record.payloadText == null) return { cleared: false };
  const keyId = classified.keyId;
  const payloadText = record.payloadText;
  try {
    await withFrigoraWriteTransaction(async (transaction) => {
      const updated = await transaction.execute({
        sql: `
          UPDATE frigora_quotation_customer_deliveries
          SET payload_read_failure = NULL, updated_at = ?
          WHERE id = ? AND payload_text = ? AND payload_read_failure = 'authentication_failed'
        `,
        args: [now, record.id, payloadText],
      });
      if (updated.rowsAffected !== 1) return;
      await transaction.execute({
        sql: `
          INSERT INTO audit_events (
            id, action, occurred_at, actor_user_id, actor_kind,
            actor_agent_instance_id, actor_component, workspace_id, venture_id, metadata_json
          ) VALUES (?, ?, ?, ?, 'system', NULL, 'frigora.quotation-delivery', ?, ?, ?)
        `,
        args: [
          deliveryPayloadAuditId("reverified", record.id, keyId),
          "frigora.quotation.delivery_payload_reverified",
          now,
          record.actorUserId,
          record.workspaceId,
          record.ventureId,
          JSON.stringify({ deliveryId: record.id, quotationId: record.quotationId, keyId }),
        ],
      });
    });
  } catch (error) {
    if (!isAuditIdConflict(error)) throw error;
    await withFrigoraWriteTransaction(async (transaction) => {
      await transaction.execute({
        sql: `
          UPDATE frigora_quotation_customer_deliveries
          SET payload_read_failure = NULL, updated_at = ?
          WHERE id = ? AND payload_text = ? AND payload_read_failure = 'authentication_failed'
        `,
        args: [now, record.id, payloadText],
      });
    });
  }
  return { cleared: true };
}
