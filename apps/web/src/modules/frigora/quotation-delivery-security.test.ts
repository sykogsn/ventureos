import assert from "node:assert/strict";
import { fork, type ChildProcess } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import type { UserId } from "@/contracts";
import { ensureSchema, getClient } from "@/platform/persistence/db";
import { resetPersistenceLifecycle } from "@/platform/persistence/repositories";
import { canonicalMailPayload, mailPayloadFingerprint } from "./mail";
import {
  backfillQuotationDeliveryPayloadEncryption,
  claimQuotationCustomerDelivery,
  clearCustomerDeliveryExecuting,
  commitDeliveryPayloadKeyRestoredAudit,
  findQuotationCustomerDelivery,
  inspectQuotationDeliveryPayloadEncryption,
  noteCustomerDeliveryExecuting,
  recordQuotationCustomerDeliveryResult,
  reverifyQuotationDeliveryPayloadAuthentication,
  sweepQuotationCustomerDeliveryPayloads,
} from "./quotation-customer-delivery";
import {
  deliveryPayloadAuditId,
  encryptDeliveryPayload,
  installQuotationDeliveryPayloadTestKeys,
  parseDeliveryPayloadKeyRing,
  type DeliveryPayloadKeyRing,
} from "./quotation-delivery-payload";
import { closeFrigoraPersistenceAfterFile } from "./test-persistence-lifecycle";
import type { FrigoraCustomerContactId, FrigoraQuotationId } from "./types";

installQuotationDeliveryPayloadTestKeys();
closeFrigoraPersistenceAfterFile();

const NOW = "2026-10-24T12:00:00.000Z";
const ACTOR = "user-owner" as UserId;

beforeEach(async () => {
  installQuotationDeliveryPayloadTestKeys();
  await resetPersistenceLifecycle();
  await ensureSchema();
});

function message(text = "Decision link stays inside the protected payload.") {
  return {
    from: "quotes@quotes.example",
    to: "amina@fuelco.test",
    subject: "Quotation awaiting your decision",
    text,
  };
}

function ring(): DeliveryPayloadKeyRing {
  return parseDeliveryPayloadKeyRing(process.env.FRIGORA_DELIVERY_PAYLOAD_KEYS ?? "");
}

function storedEnvelope(deliveryId: string, fingerprint: string, plaintext = canonicalMailPayload(message())) {
  return encryptDeliveryPayload({ ring: ring(), deliveryId, fingerprint, plaintext });
}

async function insertDelivery(input: {
  id?: string;
  quotationId?: string;
  contactId?: string;
  state?: string;
  payloadText?: string | null;
  fingerprint?: string;
  claimOwner?: string | null;
  deadline?: string | null;
  startedAt?: string | null;
  marker?: string | null;
} = {}) {
  const id = input.id ?? crypto.randomUUID();
  const quotationId = input.quotationId ?? crypto.randomUUID();
  const contactId = input.contactId ?? crypto.randomUUID();
  const fingerprint = input.fingerprint ?? mailPayloadFingerprint(message());
  await getClient().execute({
    sql: `
      INSERT INTO frigora_quotation_customer_deliveries (
        id, workspace_id, venture_id, quotation_id, version_number, customer_id, site_id,
        contact_id, grant_id, document_hash, idempotency_key, payload_fingerprint, payload_text,
        payload_read_failure, state, provider_message_id, created_at, updated_at,
        idempotency_started_at, actor_user_id, claim_owner, provider_request_expires_at
      ) VALUES (?, 'ws', 'ven', ?, 1, 'customer', 'site', ?, 'grant', 'hash', ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, ?)
    `,
    args: [
      id,
      quotationId,
      contactId,
      `quotation-customer-delivery/${id}`,
      fingerprint,
      input.payloadText === undefined ? storedEnvelope(id, fingerprint) : input.payloadText,
      input.marker ?? null,
      input.state ?? "outcome_unknown",
      NOW,
      NOW,
      input.startedAt === undefined ? NOW : input.startedAt,
      ACTOR,
      input.claimOwner ?? null,
      input.deadline ?? null,
    ],
  });
  const record = await findQuotationCustomerDelivery(
    quotationId as FrigoraQuotationId,
    1,
    contactId as FrigoraCustomerContactId,
  );
  if (!record) throw new Error("inserted delivery was not readable");
  return record;
}

async function auditCount(action: string) {
  const rows = await getClient().execute({
    sql: "SELECT COUNT(*) AS n FROM audit_events WHERE action = ?",
    args: [action],
  });
  return Number(rows.rows[0]?.n ?? 0);
}

function inspectionComplete(report: Awaited<ReturnType<typeof inspectQuotationDeliveryPayloadEncryption>>) {
  const buckets = report.verifiedLegacyPlaintext
    + report.verifiedEncrypted
    + report.missingKey
    + report.unsupportedVersion
    + report.malformedEnvelope
    + report.authenticationFailed
    + report.fingerprintMismatch
    + report.nullOpenPayload
    + report.otherPermanentMarker;
  return report.openExamined === buckets
    && report.openExamined === report.verifiedEncrypted
    && report.verifiedLegacyPlaintext === 0
    && report.missingKey === 0
    && report.unsupportedVersion === 0
    && report.malformedEnvelope === 0
    && report.authenticationFailed === 0
    && report.fingerprintMismatch === 0
    && report.nullOpenPayload === 0
    && report.otherPermanentMarker === 0
    && report.failureMarkerCount === 0;
}

function runAuditWorker(databaseUrl: string, mode: string, quotationId: string, contactId: string) {
  const workerPath = fileURLToPath(new URL("./quotation-delivery-payload-audit-worker.ts", import.meta.url));
  const child: ChildProcess = fork(workerPath, [databaseUrl, mode, quotationId, "1", contactId], {
    execArgv: ["--import", "tsx"],
    silent: true,
  });
  let stderr = "";
  const messages: unknown[] = [];
  child.stderr?.on("data", (chunk) => { stderr += String(chunk); });
  child.on("message", (message) => { messages.push(message); });
  const finished = new Promise<{ code: number | null; messages: unknown[]; stderr: string }>((resolve, reject) => {
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error(`payload audit worker ${mode} timed out: ${stderr}`));
    }, 60_000);
    child.once("exit", (code) => {
      clearTimeout(timer);
      resolve({ code, messages, stderr });
    });
  });
  return { finished };
}

describe("quotation delivery payload preservation", () => {
  it("keeps an unavailable key from calling the provider, reconciling, or mutating the row", async () => {
    const saved = process.env.FRIGORA_DELIVERY_PAYLOAD_KEYS;
    const deadline = new Date(Date.now() + 60_000).toISOString();
    const record = await insertDelivery({ state: "sending", deadline, startedAt: NOW });
    delete process.env.FRIGORA_DELIVERY_PAYLOAD_KEYS;
    try {
      const claim = await claimQuotationCustomerDelivery(record, NOW);
      assert.equal(claim.action, "payload_blocked");
      const again = await claimQuotationCustomerDelivery(record, NOW);
      assert.equal(again.action, "payload_blocked");
      const row = await getClient().execute(
        "SELECT id, state, payload_text, payload_fingerprint, idempotency_key, provider_request_expires_at, payload_read_failure FROM frigora_quotation_customer_deliveries",
      );
      assert.equal(row.rows[0]?.id, record.id);
      assert.equal(row.rows[0]?.state, "sending");
      assert.equal(row.rows[0]?.payload_text, record.payloadText);
      assert.equal(row.rows[0]?.payload_fingerprint, record.payloadFingerprint);
      assert.equal(row.rows[0]?.idempotency_key, record.idempotencyKey);
      assert.equal(row.rows[0]?.provider_request_expires_at, deadline);
      assert.equal(row.rows[0]?.payload_read_failure, null);
      assert.equal(await auditCount("frigora.quotation.delivery_payload_key_unavailable"), 1);
      assert.equal(await auditCount("frigora.quotation.delivery_payload_key_restored"), 0);
      const grants = await getClient().execute("SELECT COUNT(*) AS n FROM frigora_quotation_decision_grants");
      const attempts = await getClient().execute("SELECT COUNT(*) AS n FROM frigora_quotation_customer_delivery_attempts");
      assert.equal(Number(grants.rows[0]?.n), 0);
      assert.equal(Number(attempts.rows[0]?.n), 0);
      const swept = await sweepQuotationCustomerDeliveryPayloads(new Date(Date.parse(NOW) + 25 * 60 * 60 * 1000).toISOString());
      assert.equal(swept.reconciled, 0);
      assert.equal(swept.cleared, 0);
      const after = await getClient().execute("SELECT payload_text, state FROM frigora_quotation_customer_deliveries");
      assert.equal(after.rows[0]?.payload_text, record.payloadText);
      assert.equal(after.rows[0]?.state, "sending");
      assert.equal(await auditCount("frigora.quotation.delivery_payload_key_unavailable"), 1);
    } finally {
      process.env.FRIGORA_DELIVERY_PAYLOAD_KEYS = saved;
    }
  });

  it("preserves ciphertext for authentication, fingerprint, and malformed failures", async () => {
    const plain = canonicalMailPayload(message());
    const real = mailPayloadFingerprint(message());
    const fake = "ab".repeat(32);
    const auth = await insertDelivery({ state: "outcome_unknown" });
    const bodyField = String(auth.payloadText).split(".")[2];
    if (!bodyField) throw new Error("The test envelope has no ciphertext field.");
    const tamperedBody = Buffer.from(bodyField, "base64url");
    const firstByte = tamperedBody[0];
    if (firstByte === undefined) throw new Error("The test envelope ciphertext is empty.");
    tamperedBody[0] = firstByte ^ 0xff;
    const tampered = `${String(auth.payloadText).split(".").slice(0, 2).join(".")}.${tamperedBody.toString("base64url")}`;
    await getClient().execute({
      sql: "UPDATE frigora_quotation_customer_deliveries SET payload_text = ? WHERE id = ?",
      args: [tampered, auth.id],
    });
    const mismatchId = crypto.randomUUID();
    const mismatch = await insertDelivery({
      id: mismatchId,
      payloadText: storedEnvelope(mismatchId, fake, plain),
      fingerprint: fake,
    });
    const malformed = await insertDelivery({ payloadText: "enc:v2:", state: "prepared" });
    for (const record of [auth, mismatch, malformed]) {
      const claim = await claimQuotationCustomerDelivery(await reload(record), NOW);
      assert.equal(claim.action, "payload_blocked");
    }
    const rows = await getClient().execute(
      "SELECT id, payload_text, payload_read_failure, state FROM frigora_quotation_customer_deliveries ORDER BY created_at, id",
    );
    const byId = new Map(rows.rows.map((row) => [String(row.id), row]));
    assert.equal(byId.get(auth.id)?.payload_text, tampered);
    assert.equal(byId.get(auth.id)?.payload_read_failure, "authentication_failed");
    assert.equal(byId.get(auth.id)?.state, "outcome_unknown");
    assert.equal(byId.get(mismatch.id)?.payload_read_failure, "fingerprint_mismatch");
    assert.equal(String(byId.get(mismatch.id)?.payload_text).startsWith("enc:v1:"), true);
    assert.equal(byId.get(malformed.id)?.payload_text, "enc:v2:");
    assert.equal(byId.get(malformed.id)?.payload_read_failure, "malformed_envelope");
    const grants = await getClient().execute("SELECT COUNT(*) AS n FROM frigora_quotation_decision_grants");
    assert.equal(Number(grants.rows[0]?.n), 0);
    assert.equal(real === fake, false);
  });

  it("does not store an unsupported version as a permanent marker or clear it", async () => {
    const record = await insertDelivery();
    const unsupported = String(record.payloadText).replace("enc:v1:", "enc:v2:");
    await getClient().execute({
      sql: "UPDATE frigora_quotation_customer_deliveries SET payload_text = ? WHERE id = ?",
      args: [unsupported, record.id],
    });
    const claim = await claimQuotationCustomerDelivery(record, NOW);
    assert.equal(claim.action, "payload_blocked");
    const row = await getClient().execute("SELECT payload_text, payload_read_failure, state FROM frigora_quotation_customer_deliveries");
    assert.equal(row.rows[0]?.payload_text, unsupported);
    assert.equal(row.rows[0]?.payload_read_failure, null);
    assert.equal(row.rows[0]?.state, "outcome_unknown");
  });

  it("does not let an audit write failure reconcile or clear the payload", async () => {
    const saved = process.env.FRIGORA_DELIVERY_PAYLOAD_KEYS;
    const record = await insertDelivery({ state: "prepared", startedAt: null });
    delete process.env.FRIGORA_DELIVERY_PAYLOAD_KEYS;
    await getClient().execute(`
      CREATE TRIGGER delivery_payload_audit_fail
      BEFORE INSERT ON audit_events
      WHEN NEW.action = 'frigora.quotation.delivery_payload_key_unavailable'
      BEGIN
        SELECT RAISE(ABORT, 'audit write failed');
      END
    `);
    try {
      await assert.rejects(() => claimQuotationCustomerDelivery(record, NOW));
      const row = await getClient().execute("SELECT state, payload_text, payload_read_failure FROM frigora_quotation_customer_deliveries");
      assert.equal(row.rows[0]?.state, "prepared");
      assert.equal(row.rows[0]?.payload_text, record.payloadText);
      assert.equal(row.rows[0]?.payload_read_failure, null);
      assert.equal(await auditCount("frigora.quotation.delivery_payload_key_unavailable"), 0);
    } finally {
      await getClient().execute("DROP TRIGGER IF EXISTS delivery_payload_audit_fail");
      process.env.FRIGORA_DELIVERY_PAYLOAD_KEYS = saved;
    }
  });

  it("retries an unavailable audit after a crash and does not duplicate it", async () => {
    const saved = process.env.FRIGORA_DELIVERY_PAYLOAD_KEYS;
    const record = await insertDelivery({ state: "prepared", startedAt: null });
    delete process.env.FRIGORA_DELIVERY_PAYLOAD_KEYS;
    try {
      const first = await claimQuotationCustomerDelivery(record, NOW);
      const second = await claimQuotationCustomerDelivery(record, NOW);
      assert.equal(first.action, "payload_blocked");
      assert.equal(second.action, "payload_blocked");
      assert.equal(await auditCount("frigora.quotation.delivery_payload_key_unavailable"), 1);
      const expected = deliveryPayloadAuditId("unavailable", record.id, "test-key");
      const stored = await getClient().execute({
        sql: "SELECT id, metadata_json FROM audit_events WHERE action = ?",
        args: ["frigora.quotation.delivery_payload_key_unavailable"],
      });
      assert.equal(stored.rows[0]?.id, expected);
      const metadata = String(stored.rows[0]?.metadata_json);
      assert.equal(metadata.includes(record.id), true);
      assert.equal(metadata.includes("test-key"), true);
      assert.equal(metadata.includes("enc:"), false);
      assert.equal(metadata.includes("Decision link"), false);
    } finally {
      process.env.FRIGORA_DELIVERY_PAYLOAD_KEYS = saved;
    }
  });

  it("records one restored audit only after the matching unavailable audit", async () => {
    const record = await insertDelivery({ state: "prepared", startedAt: null });
    await commitDeliveryPayloadKeyRestoredAudit(record, "test-key", NOW);
    assert.equal(await auditCount("frigora.quotation.delivery_payload_key_restored"), 0);
    const saved = process.env.FRIGORA_DELIVERY_PAYLOAD_KEYS;
    delete process.env.FRIGORA_DELIVERY_PAYLOAD_KEYS;
    try {
      await claimQuotationCustomerDelivery(record, NOW);
    } finally {
      process.env.FRIGORA_DELIVERY_PAYLOAD_KEYS = saved;
    }
    await Promise.all([
      commitDeliveryPayloadKeyRestoredAudit(record, "test-key", NOW),
      commitDeliveryPayloadKeyRestoredAudit(record, "test-key", NOW),
    ]);
    assert.equal(await auditCount("frigora.quotation.delivery_payload_key_unavailable"), 1);
    assert.equal(await auditCount("frigora.quotation.delivery_payload_key_restored"), 1);
    const restored = deliveryPayloadAuditId("restored", record.id, "test-key");
    const unavailable = deliveryPayloadAuditId("unavailable", record.id, "test-key");
    assert.notEqual(restored, unavailable);
  });

  it("lets two processes record one unavailable audit and one restored audit", async () => {
    const directory = await mkdtemp(join(tmpdir(), "frg-payload-audit-"));
    const databaseUrl = `file:${join(directory, "audit.db").replaceAll("\\", "/")}`;
    const savedDatabase = process.env.DATABASE_URL;
    try {
      await resetPersistenceLifecycle(databaseUrl);
      await ensureSchema();
      const record = await insertDelivery({ state: "prepared", startedAt: null });
      const missing = process.env.FRIGORA_DELIVERY_PAYLOAD_KEYS;
      delete process.env.FRIGORA_DELIVERY_PAYLOAD_KEYS;
      const unavailable = await Promise.all([
        runAuditWorker(databaseUrl, "unavailable", record.quotationId, record.contactId).finished,
        runAuditWorker(databaseUrl, "unavailable", record.quotationId, record.contactId).finished,
      ]);
      process.env.FRIGORA_DELIVERY_PAYLOAD_KEYS = missing;
      assert.equal(unavailable.every((result) => result.code === 0), true, unavailable.map((result) => result.stderr).join("\n"));
      assert.equal(await auditCount("frigora.quotation.delivery_payload_key_unavailable"), 1);
      const row = await getClient().execute("SELECT state, payload_text, payload_read_failure FROM frigora_quotation_customer_deliveries");
      assert.equal(row.rows[0]?.state, "prepared");
      assert.equal(row.rows[0]?.payload_text, record.payloadText);
      assert.equal(row.rows[0]?.payload_read_failure, null);
      const restored = await Promise.all([
        runAuditWorker(databaseUrl, "restored", record.quotationId, record.contactId).finished,
        runAuditWorker(databaseUrl, "restored", record.quotationId, record.contactId).finished,
      ]);
      assert.equal(restored.every((result) => result.code === 0), true, restored.map((result) => result.stderr).join("\n"));
      assert.equal(await auditCount("frigora.quotation.delivery_payload_key_restored"), 1);
    } finally {
      await resetPersistenceLifecycle();
      if (savedDatabase === undefined) delete process.env.DATABASE_URL;
      else process.env.DATABASE_URL = savedDatabase;
      for (let attempt = 0; attempt < 10; attempt += 1) {
        try {
          await rm(directory, { recursive: true, force: true });
          break;
        } catch {
          await new Promise((resolve) => setTimeout(resolve, 200));
        }
      }
    }
  });
});

describe("quotation delivery payload backfill and re-verification", () => {
  it("reports completion for an empty open set and blocks a null open payload", async () => {
    const empty = await inspectQuotationDeliveryPayloadEncryption();
    assert.equal(empty.openExamined, 0);
    assert.equal(inspectionComplete(empty), true);
    await insertDelivery({ state: "prepared", payloadText: null, startedAt: null });
    const blocked = await inspectQuotationDeliveryPayloadEncryption();
    assert.equal(blocked.nullOpenPayload, 1);
    assert.equal(blocked.openExamined, 1);
    assert.equal(inspectionComplete(blocked), false);
    const before = await getClient().execute("SELECT COUNT(*) AS n FROM frigora_quotation_customer_deliveries");
    const report = await backfillQuotationDeliveryPayloadEncryption(NOW);
    const after = await getClient().execute("SELECT COUNT(*) AS n, payload_text FROM frigora_quotation_customer_deliveries");
    assert.equal(Number(before.rows[0]?.n), Number(after.rows[0]?.n));
    assert.equal(after.rows[0]?.payload_text, null);
    assert.equal(report.encrypted, 0);
  });

  it("encrypts prepared plaintext once, resumes, and refuses completion while a failure remains", async () => {
    const firstPlain = canonicalMailPayload(message("first"));
    const secondPlain = canonicalMailPayload(message("second"));
    const first = await insertDelivery({
      state: "prepared",
      payloadText: firstPlain,
      fingerprint: mailPayloadFingerprint(message("first")),
      startedAt: null,
    });
    const second = await insertDelivery({
      state: "prepared",
      payloadText: secondPlain,
      fingerprint: mailPayloadFingerprint(message("second")),
      startedAt: null,
    });
    noteCustomerDeliveryExecuting(second.id);
    try {
      const skipped = await backfillQuotationDeliveryPayloadEncryption(NOW);
      assert.equal(skipped.encrypted, 1);
      assert.equal(skipped.skipped, 1);
    } finally {
      clearCustomerDeliveryExecuting(second.id);
    }
    const during = await getClient().execute({
      sql: "SELECT payload_text FROM frigora_quotation_customer_deliveries WHERE id = ?",
      args: [second.id],
    });
    assert.equal(during.rows[0]?.payload_text, secondPlain);
    const resumed = await backfillQuotationDeliveryPayloadEncryption(NOW);
    assert.equal(resumed.encrypted, 1);
    const rows = await getClient().execute("SELECT id, payload_text, payload_fingerprint, idempotency_key FROM frigora_quotation_customer_deliveries");
    for (const row of rows.rows) {
      assert.equal(String(row.payload_text).startsWith("enc:v1:"), true);
      assert.equal(String(row.idempotency_key).startsWith("quotation-customer-delivery/"), true);
    }
    assert.equal(rows.rows.find((row) => row.id === first.id)?.payload_fingerprint, first.payloadFingerprint);
    const open = await inspectQuotationDeliveryPayloadEncryption();
    assert.equal(inspectionComplete(open), true);
    await insertDelivery({ payloadText: "enc:v2:", state: "sending" });
    const failed = await inspectQuotationDeliveryPayloadEncryption();
    assert.equal(failed.malformedEnvelope >= 1 || failed.unsupportedVersion >= 1, true);
    assert.equal(inspectionComplete(failed), false);
  });

  it("keeps one encrypted payload when two backfill passes race", async () => {
    const plain = canonicalMailPayload(message("race"));
    const record = await insertDelivery({
      state: "outcome_unknown",
      payloadText: plain,
      fingerprint: mailPayloadFingerprint(message("race")),
    });
    const reports = await Promise.all([
      backfillQuotationDeliveryPayloadEncryption(NOW),
      backfillQuotationDeliveryPayloadEncryption(NOW),
    ]);
    assert.equal(reports.reduce((sum, report) => sum + report.encrypted, 0), 1);
    const row = await getClient().execute("SELECT id, payload_text, payload_fingerprint, idempotency_key FROM frigora_quotation_customer_deliveries");
    assert.equal(row.rows.length, 1);
    assert.equal(row.rows[0]?.id, record.id);
    assert.equal(String(row.rows[0]?.payload_text).startsWith("enc:v1:"), true);
    assert.equal(row.rows[0]?.payload_fingerprint, record.payloadFingerprint);
    assert.equal(row.rows[0]?.idempotency_key, record.idempotencyKey);
    assert.equal(String(row.rows[0]?.payload_text).includes(plain), false);
  });

  it("reloads an encrypted body after backfill wins and does not write plaintext back", async () => {
    const plain = canonicalMailPayload(message("claim"));
    const fingerprint = mailPayloadFingerprint(message("claim"));
    const record = await insertDelivery({
      state: "prepared",
      payloadText: plain,
      fingerprint,
      startedAt: null,
      claimOwner: "owner-1",
    });
    await backfillQuotationDeliveryPayloadEncryption(NOW);
    const claim = await claimQuotationCustomerDelivery(record, NOW);
    assert.equal(claim.action, "send");
    assert.equal(String(claim.record.payloadText).startsWith("enc:v1:"), true);
    assert.equal(claim.record.id, record.id);
    assert.equal(claim.record.payloadFingerprint, fingerprint);
    const stale = { ...claim.record, payloadText: plain, claimOwner: claim.record.claimOwner };
    const saved = await recordQuotationCustomerDeliveryResult({
      record: stale,
      outcome: "accepted_by_provider",
      providerMessageId: "provider-1",
      now: NOW,
      actorUserId: ACTOR,
    });
    assert.equal(saved.state, "accepted_by_provider");
    assert.equal(saved.payloadText, null);
    const row = await getClient().execute("SELECT payload_text, idempotency_key, provider_request_expires_at FROM frigora_quotation_customer_deliveries");
    assert.equal(row.rows[0]?.payload_text, null);
    assert.equal(row.rows[0]?.idempotency_key, record.idempotencyKey);
  });

  it("retries a busy backfill write and leaves the plaintext when the lock persists", async () => {
    const plain = canonicalMailPayload(message("busy"));
    await insertDelivery({
      state: "prepared",
      payloadText: plain,
      fingerprint: mailPayloadFingerprint(message("busy")),
      startedAt: null,
    });
    await getClient().execute(`
      CREATE TRIGGER payload_backfill_busy
      BEFORE UPDATE ON frigora_quotation_customer_deliveries
      WHEN NEW.payload_text LIKE 'enc:%'
      BEGIN
        SELECT RAISE(ABORT, 'SQLITE_BUSY');
      END
    `);
    try {
      const report = await backfillQuotationDeliveryPayloadEncryption(NOW);
      assert.equal(report.failed, 1);
      assert.equal(report.retried, 4);
      assert.equal(report.encrypted, 0);
      const row = await getClient().execute("SELECT payload_text FROM frigora_quotation_customer_deliveries");
      assert.equal(row.rows[0]?.payload_text, plain);
    } finally {
      await getClient().execute("DROP TRIGGER IF EXISTS payload_backfill_busy");
    }
  });

  it("clears only an authentication failure after the original ciphertext verifies", async () => {
    const record = await insertDelivery({ state: "outcome_unknown", deadline: NOW });
    const saved = process.env.FRIGORA_DELIVERY_PAYLOAD_KEYS;
    process.env.FRIGORA_DELIVERY_PAYLOAD_KEYS = JSON.stringify({
      current: "test-key",
      keys: { "test-key": Buffer.alloc(32, 4).toString("base64") },
    });
    try {
      const claim = await claimQuotationCustomerDelivery(record, NOW);
      assert.equal(claim.action, "payload_blocked");
    } finally {
      process.env.FRIGORA_DELIVERY_PAYLOAD_KEYS = saved;
    }
    const marked = await getClient().execute(
      "SELECT payload_text, payload_read_failure, provider_request_expires_at, idempotency_key FROM frigora_quotation_customer_deliveries",
    );
    assert.equal(marked.rows[0]?.payload_read_failure, "authentication_failed");
    assert.equal(marked.rows[0]?.payload_text, record.payloadText);
    const verified = await reverifyQuotationDeliveryPayloadAuthentication(record.id, NOW);
    assert.equal(verified.cleared, true);
    const cleared = await getClient().execute(
      "SELECT payload_text, payload_read_failure, provider_request_expires_at, idempotency_key, id FROM frigora_quotation_customer_deliveries",
    );
    assert.equal(cleared.rows[0]?.payload_read_failure, null);
    assert.equal(cleared.rows[0]?.payload_text, record.payloadText);
    assert.equal(cleared.rows[0]?.id, record.id);
    assert.equal(cleared.rows[0]?.idempotency_key, record.idempotencyKey);
    assert.equal(cleared.rows[0]?.provider_request_expires_at, NOW);
    assert.equal(await auditCount("frigora.quotation.delivery_payload_reverified"), 1);
    const mismatch = await insertDelivery({
      payloadText: storedEnvelope(crypto.randomUUID(), "cd".repeat(32), canonicalMailPayload(message())),
      fingerprint: "cd".repeat(32),
      marker: "fingerprint_mismatch",
    });
    await assert.rejects(
      () => reverifyQuotationDeliveryPayloadAuthentication(mismatch.id, NOW),
      (error: unknown) => error instanceof Error && "code" in error && error.code === "invalid_status",
    );
    const still = await getClient().execute({
      sql: "SELECT payload_read_failure FROM frigora_quotation_customer_deliveries WHERE id = ?",
      args: [mismatch.id],
    });
    assert.equal(still.rows[0]?.payload_read_failure, "fingerprint_mismatch");
  });
});

async function reload(record: Awaited<ReturnType<typeof insertDelivery>>) {
  const next = await findQuotationCustomerDelivery(
    record.quotationId as FrigoraQuotationId,
    record.version,
    record.contactId as FrigoraCustomerContactId,
  );
  if (!next) throw new Error("delivery disappeared");
  return next;
}
