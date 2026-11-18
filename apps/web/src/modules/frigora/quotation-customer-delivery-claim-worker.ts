// Separate-process claim probe. Disposable file database and a fake provider only.
import { mkdirSync, openSync, closeSync, readFileSync, writeFileSync, unlinkSync, existsSync } from "node:fs";
import { dirname } from "node:path";
import type { UserId, VentureId, WorkspaceId } from "@/contracts";
import { getPlatform } from "@/platform/kernel";
import { createPermissionService } from "@/platform/permissions/service";
import { createDbMembershipStore } from "@/platform/permissions/membership-store";
import { ensureSchema, getClient, resetDatabaseLifecycle } from "@/platform/persistence/db";
import { getPersistence, resetPersistenceLifecycle } from "@/platform/persistence/repositories";
import type { PersistedVenture } from "@/platform/persistence/repositories/ports";
import { exampleQuotationCommercial } from "./quotation-commercial";
import { FrigoraError } from "./errors";
import { allowSyntheticNotRegisteredQuotationSend } from "./tax-configuration-fixture";
import { mailPayloadFingerprint, type FrigoraMailRuntime } from "./mail";
import { createFrigoraService } from "./service";
import { createFrigoraStore } from "./store";
import type { FrigoraCustomerContactId, FrigoraQuotationId, FrigoraScope } from "./types";

const NOW = "2026-10-24T08:00:00.000Z";
const ARRIVED = "2026-10-24T08:05:00.000Z";
const RECOMMENDED_AT = "2026-10-24T08:20:00.000Z";
const ISSUED_AT = "2026-10-24T12:00:00.000Z";
const BASIS = "Office recorded this mailbox as the commercial approver for this site.";

async function ensureSchemaWhenReady() {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    try {
      await ensureSchema();
      return;
    } catch (error) {
      const text = error instanceof Error ? error.message : String(error);
      if (!/SQLITE_BUSY|database is locked|database is busy/i.test(text) || attempt === 7) throw error;
      await new Promise((resolve) => setTimeout(resolve, 50 * (attempt + 1)));
    }
  }
}

const databaseUrl = process.argv[2];
const mode = process.argv[3];
const journalPath = process.argv[4];
const nowIso = process.argv[5] || ISSUED_AT;
const delayMs = Number(process.argv[6] ?? "0");

if (!databaseUrl || !mode) {
  throw new Error("delivery claim worker requires a database URL and a mode");
}

type Journal = {
  logical: Array<{ key: string; fingerprint: string; id: string }>;
  http: Array<{ key: string; fingerprint: string }>;
};

function withJournal<T>(body: (journal: Journal) => T): T {
  if (!journalPath) throw new Error("delivery claim worker requires a journal path");
  mkdirSync(dirname(journalPath), { recursive: true });
  const lock = `${journalPath}.lock`;
  for (let attempt = 0; attempt < 400; attempt += 1) {
    try {
      const fd = openSync(lock, "wx");
      try {
        const journal: Journal = existsSync(journalPath)
          ? JSON.parse(readFileSync(journalPath, "utf8")) as Journal
          : { logical: [], http: [] };
        const result = body(journal);
        writeFileSync(journalPath, JSON.stringify(journal));
        return result;
      } finally {
        closeSync(fd);
        try { unlinkSync(lock); } catch { /* another waiter removes it */ }
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 20);
    }
  }
  throw new Error("delivery journal lock timed out");
}

function provider(): FrigoraMailRuntime {
  return {
    verifiedDomains: ["quotes.example"],
    publicOrigin: "https://quotes.example",
    env: {},
    provider: {
      async send(message) {
        if (delayMs > 0 && message.idempotencyKey) {
          process.send?.({ pid: process.pid, status: "provider-started" });
          await new Promise((resolve) => setTimeout(resolve, delayMs));
        }
        const fingerprint = mailPayloadFingerprint(message);
        if (!message.idempotencyKey) {
          return { outcome: "accepted_by_provider" as const, providerMessageId: "verify-local" };
        }
        return withJournal((journal) => {
          journal.http.push({ key: message.idempotencyKey!, fingerprint });
          const prior = journal.logical.find((entry) => entry.key === message.idempotencyKey);
          if (prior) {
            if (prior.fingerprint !== fingerprint) return { outcome: "unknown" as const, providerMessageId: null };
            return { outcome: "accepted_by_provider" as const, providerMessageId: prior.id };
          }
          const id = `provider-${journal.logical.length + 1}`;
          journal.logical.push({ key: message.idempotencyKey!, fingerprint, id });
          return { outcome: "accepted_by_provider" as const, providerMessageId: id };
        });
      },
    },
  };
}

function ventureRow(): PersistedVenture {
  return {
    id: "ven-frigora" as VentureId,
    workspaceId: "ws-frigora" as WorkspaceId,
    name: "Frigora One",
    slug: "frigora-one",
    stage: "Idea",
    href: "/ventures/hq/frigora-one",
    foundedAt: NOW,
    category: "Operations",
    owner: "Founder",
    hqSummary: "Open.",
    genome: {
      thesis: "Keep the cold chain honest.",
      category: "Operations",
      stage: "Idea",
      goal: "Admit operational identity.",
      posture: "human-led",
      risk: "focused",
      motion: "Serve refrigeration sites.",
      cadence: "Weekly",
    },
    mission: {
      today: {
        title: "", ask: "", whyNow: "", ifDeferred: "", timeNeeded: "",
        actionLabel: "", actionHref: "/dashboard", attention: "hold", founderAsk: "", active: false,
      },
      sprint: { name: "", objective: "", tasks: [] },
    },
    launchDraft: {},
    documents: { documents: [] },
    risk: { headline: "", signals: [] },
    definitionId: "frigora",
    definitionVersion: "0.21.0",
    lifecycle: "operating",
    createdAt: NOW,
    updatedAt: NOW,
  };
}

async function serviceFor(runtime: FrigoraMailRuntime) {
  const workspaceId = "ws-frigora" as WorkspaceId;
  const ventureId = "ven-frigora" as VentureId;
  const userId = "user-owner" as UserId;
  return {
    scope: { userId, workspaceId, ventureId } satisfies FrigoraScope,
    service: createFrigoraService({
      store: createFrigoraStore(),
      permissions: createPermissionService(createDbMembershipStore()),
      now: () => nowIso,
      mail: runtime,
    }),
  };
}

async function seed() {
  await resetPersistenceLifecycle(databaseUrl);
  await ensureSchemaWhenReady();
  const workspaceId = "ws-frigora" as WorkspaceId;
  const userId = "user-owner" as UserId;
  const persistence = getPersistence();
  await persistence.organisations.insert({ id: workspaceId, name: "Frigora Workspace", slug: "ws-frigora", createdAt: NOW });
  await persistence.memberships.setRole({ userId, workspaceId, role: "owner", createdAt: NOW });
  await persistence.ventures.insert(ventureRow());
  let verification = "";
  const runtime: FrigoraMailRuntime = {
    verifiedDomains: ["quotes.example"],
    publicOrigin: "https://quotes.example",
    env: {},
    provider: {
      async send(message) {
        if (message.subject.startsWith("Confirm")) verification = message.text;
        return { outcome: "accepted_by_provider", providerMessageId: "verify-local" };
      },
    },
  };
  const owner = await serviceFor(runtime);
  await getPlatform().scheduler.stopAll();
  await owner.service.setVentureMailIdentity(owner.scope, { fromName: "Frigora Quotes", fromEmail: "quotes@quotes.example" });
  const attendeeId = "user-attendee" as UserId;
  await persistence.memberships.setRole({ userId: attendeeId, workspaceId, role: "member", createdAt: NOW });
  const customer = await owner.service.createCustomer(owner.scope, { code: "FUELCO", displayName: "FuelCo" });
  const site = await owner.service.createSite(owner.scope, { customerId: customer.id, code: "SANDTON-N", name: "Sandton North" });
  const asset = await owner.service.createAsset(owner.scope, { siteId: site.id, tag: "EVAP-01", name: "Evaporator" });
  const workOrder = await owner.service.createWorkOrder(owner.scope, {
    siteId: site.id, workReference: "WO-1864", workKind: "reactive", primaryAssetId: asset.id, reportedCondition: "display freezer warm",
  });
  const visit = await owner.service.recordVisitArrival(owner.scope, workOrder.id, { userId: attendeeId, arrivedAt: ARRIVED });
  const recommendation = await owner.service.recordRecommendedAction(owner.scope, visit.id, {
    description: "Replace compressor", recommendedAt: RECOMMENDED_AT, recommendedByUserId: attendeeId, recordedByUserId: attendeeId, assetId: asset.id,
  });
  const draft = await owner.service.createQuotation(owner.scope, {
    recommendedActionId: recommendation.id, description: "Replace compressor", commercial: exampleQuotationCommercial(),
  });
  await allowSyntheticNotRegisteredQuotationSend(owner.service, owner.scope);
  const sent = await owner.service.sendQuotation(owner.scope, draft.id, { expectedCurrentVersion: 1, recipient: "accounts@fuelco.test" });
  const contact = await owner.service.createCustomerContact(owner.scope, {
    customerId: customer.id, siteId: site.id, displayName: "Amina Naidoo", email: "amina@fuelco.test",
  });
  await owner.service.designateQuotationContact(owner.scope, contact.id, { basis: BASIS });
  const dispatch = await owner.service.requestCustomerContactVerification(owner.scope, contact.id);
  const lines = verification.split("\n");
  const at = lines.findIndex((line) => line === "Verification code:");
  await owner.service.confirmCustomerContactEmail(owner.scope, {
    challengeId: dispatch.challengeId,
    secret: at >= 0 ? lines[at + 1] ?? "" : "",
  });
  process.send?.({ pid: process.pid, quotationId: sent.id, contactId: contact.id });
}

async function ids() {
  const quotation = await getClient().execute("SELECT id FROM frigora_quotations LIMIT 1");
  const contact = await getClient().execute("SELECT id FROM frigora_customer_contacts LIMIT 1");
  return {
    quotationId: String(quotation.rows[0]?.id) as FrigoraQuotationId,
    contactId: String(contact.rows[0]?.id) as FrigoraCustomerContactId,
  };
}

async function deliver() {
  await resetPersistenceLifecycle(databaseUrl);
  await ensureSchemaWhenReady();
  const ready = await serviceFor(provider());
  await getPlatform().scheduler.stopAll();
  const target = await ids();
  return ready.service.deliverQuotationDecisionGrant(ready.scope, target.quotationId, {
    expectedCurrentVersion: 1,
    contactId: target.contactId,
  });
}

async function run() {
  if (mode === "seed") {
    await seed();
    return;
  }
  if (mode === "send" || mode === "recover") {
    try {
      const result = await deliver();
      process.send?.({
        pid: process.pid,
        status: "fulfilled",
        grantId: result.grantId,
        providerMessageId: result.providerMessageId,
        outcome: result.outcome,
      });
    } catch (error) {
      const code = error instanceof FrigoraError ? error.code : "error";
      process.send?.({ pid: process.pid, status: "rejected", code });
      if (!(mode === "send" && code === "delivery_unknown")) throw error;
    }
    return;
  }
  if (mode === "fail-accept") {
    await resetPersistenceLifecycle(databaseUrl);
    await ensureSchemaWhenReady();
    await getClient().execute(`
      CREATE TRIGGER acceptance_write_fail
      BEFORE UPDATE ON frigora_quotation_customer_deliveries
      WHEN NEW.state = 'accepted_by_provider'
      BEGIN
        SELECT RAISE(ABORT, 'forced acceptance write failure');
      END
    `);
    let code = "";
    try {
      await deliver();
    } catch (error) {
      code = error instanceof FrigoraError ? error.code : "error";
    }
    await getClient().execute("DROP TRIGGER IF EXISTS acceptance_write_fail");
    process.send?.({ pid: process.pid, status: "failed", code });
    return;
  }
  if (mode === "expire-fence") {
    await resetPersistenceLifecycle(databaseUrl);
    await ensureSchemaWhenReady();
    await getClient().execute({
      sql: `
        UPDATE frigora_quotation_customer_deliveries
        SET provider_request_expires_at = ?, claim_lease_expires_at = ?
      `,
      args: [nowIso, nowIso],
    });
    process.send?.({ pid: process.pid, status: "expired" });
    return;
  }
  if (mode === "snapshot") {
    await resetPersistenceLifecycle(databaseUrl);
    await ensureSchemaWhenReady();
    const rows = await getClient().execute(`
      SELECT id, grant_id, idempotency_key, payload_fingerprint, state, provider_message_id,
             payload_text IS NOT NULL AS has_payload,
             provider_request_expires_at, claim_lease_expires_at
      FROM frigora_quotation_customer_deliveries
    `);
    const grants = await getClient().execute("SELECT COUNT(*) AS n FROM frigora_quotation_decision_grants");
    const attempts = await getClient().execute("SELECT outcome FROM frigora_quotation_customer_delivery_attempts ORDER BY occurred_at");
    const journal = journalPath && existsSync(journalPath)
      ? JSON.parse(readFileSync(journalPath, "utf8")) as Journal
      : { logical: [], http: [] };
    process.send?.({
      pid: process.pid,
      grants: Number(grants.rows[0]?.n ?? 0),
      rows: rows.rows,
      attempts: attempts.rows.map((row) => String(row.outcome)),
      logical: journal.logical.length,
      http: journal.http.length,
      logicalIds: journal.logical.map((entry) => entry.id),
      logicalKeys: journal.logical.map((entry) => entry.key),
      fingerprints: journal.logical.map((entry) => entry.fingerprint),
    });
    return;
  }
  throw new Error(`unknown delivery claim worker mode ${mode}`);
}

run().then(async () => {
  await resetDatabaseLifecycle(databaseUrl);
  process.exit(0);
}).catch(async (error: unknown) => {
  process.stderr.write(error instanceof Error ? `${error.stack}\n` : `${String(error)}\n`);
  try { await resetDatabaseLifecycle(databaseUrl); } catch { /* already closed */ }
  process.exit(1);
});
