import assert from "node:assert/strict";
import { fork, type ChildProcess } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import type { UserId, VentureId, WorkspaceId } from "@/contracts";
import { getPlatform, runPlatformMaintenance } from "@/platform/kernel";
import { createPermissionService } from "@/platform/permissions/service";
import { createDbMembershipStore } from "@/platform/permissions/membership-store";
import { ensureSchema, getClient } from "@/platform/persistence/db";
import { getPersistence, resetPersistenceLifecycle } from "@/platform/persistence/repositories";
import { runGuardedSteps } from "@/platform/scheduler/scheduler";
import type { PersistedVenture } from "@/platform/persistence/repositories/ports";
import { exampleQuotationCommercial } from "./quotation-commercial";
import { FrigoraError } from "./errors";
import { allowSyntheticNotRegisteredQuotationSend } from "./tax-configuration-fixture";
import {
  mailPayloadFingerprint,
  RESEND_IDEMPOTENCY_WINDOW_MS,
  type FrigoraMailMessage,
  type FrigoraMailRuntime,
} from "./mail";
import { plaintextFromStoredDeliveryPayload, installQuotationDeliveryPayloadTestKeys } from "./quotation-delivery-payload";
import { QUOTATION_DELIVERY_HELD_REASON, quotationOfficeDeliveryCopy } from "./quotation-delivery";
import {
  CUSTOMER_DELIVERY_CLAIM_LEASE_MS,
  CUSTOMER_DELIVERY_PROVIDER_REQUEST_HOLD_MS,
  claimQuotationCustomerDelivery,
  findQuotationCustomerDelivery,
  recordQuotationCustomerDeliveryResult,
  sweepQuotationCustomerDeliveryPayloads,
} from "./quotation-customer-delivery";
import { createFrigoraService } from "./service";
import { createFrigoraStore } from "./store";
import { closeFrigoraPersistenceAfterFile } from "./test-persistence-lifecycle";

installQuotationDeliveryPayloadTestKeys();
import type { FrigoraCustomerContactId, FrigoraQuotationId, FrigoraScope } from "./types";

const NOW = "2026-10-24T08:00:00.000Z";
const ARRIVED = "2026-10-24T08:05:00.000Z";
const RECOMMENDED_AT = "2026-10-24T08:20:00.000Z";
const ISSUED_AT = "2026-10-24T12:00:00.000Z";
const BASIS = "Office recorded this mailbox as the commercial approver for this site.";

closeFrigoraPersistenceAfterFile();

beforeEach(async () => {
  await resetPersistenceLifecycle();
  await ensureSchema();
  await getPlatform().scheduler.stopAll();
});

function ventureRow(overrides: Partial<PersistedVenture> = {}): PersistedVenture {
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
        title: "",
        ask: "",
        whyNow: "",
        ifDeferred: "",
        timeNeeded: "",
        actionLabel: "",
        actionHref: "/dashboard",
        attention: "hold",
        founderAsk: "",
        active: false,
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
    ...overrides,
  };
}

function recordingMail() {
  const messages: FrigoraMailMessage[] = [];
  const seen = new Map<string, { fingerprint: string; id: string }>();
  const runtime: FrigoraMailRuntime = {
    verifiedDomains: ["quotes.example"],
    publicOrigin: "https://quotes.example",
    env: {},
    provider: {
      async send(message) {
        if (!message.idempotencyKey) {
          messages.push(message);
          return { outcome: "accepted_by_provider", providerMessageId: `verify-${messages.length}` };
        }
        const fingerprint = mailPayloadFingerprint(message);
        const prior = seen.get(message.idempotencyKey);
        if (prior) {
          if (prior.fingerprint !== fingerprint) {
            return { outcome: "unknown", providerMessageId: null };
          }
          return { outcome: "accepted_by_provider", providerMessageId: prior.id };
        }
        const id = `provider-${seen.size + 1}`;
        seen.set(message.idempotencyKey, { fingerprint, id });
        messages.push(message);
        return { outcome: "accepted_by_provider", providerMessageId: id };
      },
    },
  };
  return { messages, seen, runtime };
}

function codeFrom(message: FrigoraMailMessage | undefined) {
  const lines = message?.text.split("\n") ?? [];
  const index = lines.findIndex((line) => line === "Verification code:");
  return index >= 0 ? lines[index + 1] ?? "" : "";
}

async function seed(now: () => string, mail: FrigoraMailRuntime) {
  const workspaceId = "ws-frigora" as WorkspaceId;
  const ventureId = "ven-frigora" as VentureId;
  const userId = "user-owner" as UserId;
  const persistence = getPersistence();
  await persistence.organisations.insert({
    id: workspaceId,
    name: "Frigora Workspace",
    slug: "ws-frigora",
    createdAt: NOW,
  });
  await persistence.memberships.setRole({ userId, workspaceId, role: "owner", createdAt: NOW });
  await persistence.ventures.insert(ventureRow());
  const service = createFrigoraService({
    store: createFrigoraStore(),
    permissions: createPermissionService(createDbMembershipStore()),
    now,
    mail,
  });
  return {
    workspaceId,
    ventureId,
    userId,
    scope: { userId, workspaceId, ventureId } satisfies FrigoraScope,
    service,
  };
}

async function seedSent(owner: Awaited<ReturnType<typeof seed>>) {
  const attendeeId = "user-attendee" as UserId;
  await getPersistence().memberships.setRole({
    userId: attendeeId,
    workspaceId: owner.workspaceId,
    role: "member",
    createdAt: NOW,
  });
  const customer = await owner.service.createCustomer(owner.scope, { code: "FUELCO", displayName: "FuelCo" });
  const site = await owner.service.createSite(owner.scope, {
    customerId: customer.id,
    code: "SANDTON-N",
    name: "Sandton North",
  });
  const asset = await owner.service.createAsset(owner.scope, { siteId: site.id, tag: "EVAP-01", name: "Evaporator" });
  const workOrder = await owner.service.createWorkOrder(owner.scope, {
    siteId: site.id,
    workReference: "WO-1864",
    workKind: "reactive",
    primaryAssetId: asset.id,
    reportedCondition: "display freezer warm",
  });
  const visit = await owner.service.recordVisitArrival(owner.scope, workOrder.id, {
    userId: attendeeId,
    arrivedAt: ARRIVED,
  });
  const recommendation = await owner.service.recordRecommendedAction(owner.scope, visit.id, {
    description: "Replace compressor",
    recommendedAt: RECOMMENDED_AT,
    recommendedByUserId: attendeeId,
    recordedByUserId: attendeeId,
    assetId: asset.id,
  });
  const draft = await owner.service.createQuotation(owner.scope, {
    recommendedActionId: recommendation.id,
    description: "Replace compressor",
    commercial: exampleQuotationCommercial(),
  });
  await allowSyntheticNotRegisteredQuotationSend(owner.service, owner.scope);
  const sent = await owner.service.sendQuotation(owner.scope, draft.id, {
    expectedCurrentVersion: 1,
    recipient: "accounts@fuelco.test",
  });
  return { customer, site, sent };
}

async function readyContact(owner: Awaited<ReturnType<typeof seed>>, messages: FrigoraMailMessage[], customerId: string, siteId: string) {
  const contact = await owner.service.createCustomerContact(owner.scope, {
    customerId,
    siteId,
    displayName: "Amina Naidoo",
    email: "amina@fuelco.test",
  });
  await owner.service.designateQuotationContact(owner.scope, contact.id, { basis: BASIS });
  const before = messages.length;
  const dispatch = await owner.service.requestCustomerContactVerification(owner.scope, contact.id);
  await owner.service.confirmCustomerContactEmail(owner.scope, {
    challengeId: dispatch.challengeId,
    secret: codeFrom(messages[before]),
  });
  return contact.id as FrigoraCustomerContactId;
}

async function officeReady(now: () => string = () => ISSUED_AT) {
  const mail = recordingMail();
  const owner = await seed(now, mail.runtime);
  await owner.service.setVentureMailIdentity(owner.scope, {
    fromName: "Frigora Quotes",
    fromEmail: "quotes@quotes.example",
  });
  const seeded = await seedSent(owner);
  const contactId = await readyContact(owner, mail.messages, seeded.customer.id, seeded.site.id);
  return { ...owner, ...seeded, contactId, mail };
}

describe("quotation customer delivery operations", () => {
  it("reuses one grant and idempotency key after the acceptance write fails", async () => {
    const office = await officeReady();
    await getClient().execute(`
      CREATE TRIGGER acceptance_write_fail
      BEFORE UPDATE ON frigora_quotation_customer_deliveries
      WHEN NEW.state = 'accepted_by_provider'
      BEGIN
        SELECT RAISE(ABORT, 'forced acceptance write failure');
      END
    `);
    await assert.rejects(
      () => office.service.deliverQuotationDecisionGrant(office.scope, office.sent.id, {
        expectedCurrentVersion: 1,
        contactId: office.contactId,
      }),
      (error: unknown) => {
        assert.ok(error instanceof FrigoraError);
        assert.equal(error.code, "customer_delivery_unavailable");
        assert.match(error.message, /Do not send it again/);
        assert.match(error.message, /not inbox delivery/);
        return true;
      },
    );
    const first = await getClient().execute(
      "SELECT id, grant_id, idempotency_key, state FROM frigora_quotation_customer_deliveries",
    );
    assert.equal(first.rows.length, 1);
    assert.equal(first.rows[0]?.state, "sending");
    await getClient().execute("DROP TRIGGER acceptance_write_fail");
    const decisionMessages = () => office.mail.messages.filter((message) => message.idempotencyKey);
    const before = decisionMessages().length;
    const recovered = await office.service.deliverQuotationDecisionGrant(office.scope, office.sent.id, {
      expectedCurrentVersion: 1,
      contactId: office.contactId,
    });
    assert.equal(decisionMessages().length, before);
    assert.equal(decisionMessages()[0]?.idempotencyKey, first.rows[0]?.idempotency_key);
    assert.equal(recovered.grantId, first.rows[0]?.grant_id);
    assert.equal(recovered.outcome, "accepted_by_provider");
    assert.equal(recovered.providerMessageId, "provider-1");
    const grants = await getClient().execute("SELECT id FROM frigora_quotation_decision_grants");
    assert.equal(grants.rows.length, 1);
    const saved = await getClient().execute(
      "SELECT state, provider_message_id, payload_text FROM frigora_quotation_customer_deliveries",
    );
    assert.equal(saved.rows[0]?.state, "accepted_by_provider");
    assert.equal(saved.rows[0]?.provider_message_id, "provider-1");
    assert.equal(saved.rows[0]?.payload_text, null);
    const copy = quotationOfficeDeliveryCopy(
      {
        id: "outbox",
        quotationId: office.sent.id,
        workspaceId: office.workspaceId,
        ventureId: office.ventureId,
        version: 1,
        documentHash: "hash",
        createdAt: ISSUED_AT,
        actorUserId: office.userId,
        state: "held_pending_customer_access",
        holdReason: QUOTATION_DELIVERY_HELD_REASON,
        providerMessageId: null,
      },
      "awaiting_customer_approval",
      [{
        id: String(first.rows[0]?.id),
        version: 1,
        contactId: office.contactId,
        state: "accepted_by_provider",
        providerMessageId: "provider-1",
      }],
    );
    assert.equal(copy.includes("No email was sent"), false);
    assert.equal(copy.includes("no grant was created"), false);
    assert.match(copy, /accepted by the provider/);
    assert.match(copy, /not inbox delivery/);
    assert.match(copy, /provider-1/);
  });

  it("does not open a second grant when two sends run together", async () => {
    const office = await officeReady();
    const results = await Promise.allSettled([
      office.service.deliverQuotationDecisionGrant(office.scope, office.sent.id, {
        expectedCurrentVersion: 1,
        contactId: office.contactId,
      }),
      office.service.deliverQuotationDecisionGrant(office.scope, office.sent.id, {
        expectedCurrentVersion: 1,
        contactId: office.contactId,
      }),
    ]);
    assert.equal(results.some((result) => result.status === "fulfilled"), true);
    const grants = await getClient().execute("SELECT id FROM frigora_quotation_decision_grants");
    const operations = await getClient().execute("SELECT idempotency_key, state FROM frigora_quotation_customer_deliveries");
    assert.equal(grants.rows.length, 1);
    assert.equal(operations.rows.length, 1);
    assert.equal(operations.rows[0]?.state, "accepted_by_provider");
    assert.equal(office.mail.seen.size, 1);
  });

  it("keeps an unknown outcome on the same operation and reconciles after the idempotency window", async () => {
    let nowMs = Date.parse(ISSUED_AT);
    const messages: FrigoraMailMessage[] = [];
    const runtime: FrigoraMailRuntime = {
      verifiedDomains: ["quotes.example"],
      publicOrigin: "https://quotes.example",
      env: {},
      provider: {
        async send(message) {
          messages.push(message);
          if (message.subject === "Quotation awaiting your decision") {
            return { outcome: "unknown", providerMessageId: null };
          }
          return { outcome: "accepted_by_provider", providerMessageId: `verify-${messages.length}` };
        },
      },
    };
    const office = await seed(() => new Date(nowMs).toISOString(), runtime);
    await office.service.setVentureMailIdentity(office.scope, {
      fromName: "Frigora Quotes",
      fromEmail: "quotes@quotes.example",
    });
    const seeded = await seedSent(office);
    const contactId = await readyContact(office, messages, seeded.customer.id, seeded.site.id);
    await assert.rejects(
      () => office.service.deliverQuotationDecisionGrant(office.scope, seeded.sent.id, {
        expectedCurrentVersion: 1,
        contactId,
      }),
      (error: unknown) => error instanceof FrigoraError && error.code === "delivery_unknown",
    );
    const first = await getClient().execute(
      "SELECT idempotency_key, state FROM frigora_quotation_customer_deliveries",
    );
    nowMs += RESEND_IDEMPOTENCY_WINDOW_MS + 1_000;
    await assert.rejects(
      () => office.service.deliverQuotationDecisionGrant(office.scope, seeded.sent.id, {
        expectedCurrentVersion: 1,
        contactId,
      }),
      (error: unknown) => {
        assert.ok(error instanceof FrigoraError);
        assert.equal(error.code, "delivery_unknown");
        assert.match(error.message, /reconciliation/);
        return true;
      },
    );
    const decisionMessages = messages.filter((message) => message.idempotencyKey);
    assert.equal(decisionMessages.length, 1);
    const second = await getClient().execute(
      "SELECT idempotency_key, state FROM frigora_quotation_customer_deliveries",
    );
    assert.equal(second.rows.length, 1);
    assert.equal(second.rows[0]?.idempotency_key, first.rows[0]?.idempotency_key);
    assert.equal(second.rows[0]?.state, "reconciliation_required");
    const grants = await getClient().execute("SELECT id FROM frigora_quotation_decision_grants");
    assert.equal(grants.rows.length, 1);
  });

  it("refuses a changed payload instead of reusing the idempotency key", async () => {
    const nowMs = Date.parse(ISSUED_AT);
    const messages: FrigoraMailMessage[] = [];
    const runtime: FrigoraMailRuntime = {
      verifiedDomains: ["quotes.example"],
      publicOrigin: "https://quotes.example",
      env: {},
      provider: {
        async send(message) {
          messages.push(message);
          if (message.subject === "Quotation awaiting your decision") {
            return { outcome: "unknown", providerMessageId: null };
          }
          return { outcome: "accepted_by_provider", providerMessageId: `verify-${messages.length}` };
        },
      },
    };
    const office = await seed(() => new Date(nowMs).toISOString(), runtime);
    await office.service.setVentureMailIdentity(office.scope, {
      fromName: "Frigora Quotes",
      fromEmail: "quotes@quotes.example",
    });
    const seeded = await seedSent(office);
    const contactId = await readyContact(office, messages, seeded.customer.id, seeded.site.id);
    await assert.rejects(
      () => office.service.deliverQuotationDecisionGrant(office.scope, seeded.sent.id, {
        expectedCurrentVersion: 1,
        contactId,
      }),
    );
    await getClient().execute({
      sql: `UPDATE frigora_quotation_customer_deliveries SET payload_text = ?`,
      args: [JSON.stringify({ from: "other", to: "other@fuelco.test", subject: "Changed", text: "Changed" })],
    });
    const before = messages.filter((message) => message.idempotencyKey).length;
    await assert.rejects(
      () => office.service.deliverQuotationDecisionGrant(office.scope, seeded.sent.id, {
        expectedCurrentVersion: 1,
        contactId,
      }),
      (error: unknown) => error instanceof FrigoraError && error.code === "delivery_unknown",
    );
    assert.equal(messages.filter((message) => message.idempotencyKey).length, before);
    const row = await getClient().execute(
      "SELECT state, idempotency_key, payload_read_failure, payload_text FROM frigora_quotation_customer_deliveries",
    );
    assert.equal(row.rows[0]?.state, "outcome_unknown");
    assert.equal(row.rows[0]?.payload_read_failure, "fingerprint_mismatch");
    assert.equal(row.rows[0]?.payload_text == null, false);
    assert.match(String(row.rows[0]?.idempotency_key), /quotation-customer-delivery\//);
  });

  it("records provider rejection without a second grant", async () => {
    const messages: FrigoraMailMessage[] = [];
    const runtime: FrigoraMailRuntime = {
      verifiedDomains: ["quotes.example"],
      publicOrigin: "https://quotes.example",
      env: {},
      provider: {
        async send(message) {
          messages.push(message);
          if (message.subject === "Quotation awaiting your decision") {
            return { outcome: "rejected", providerMessageId: null };
          }
          return { outcome: "accepted_by_provider", providerMessageId: `verify-${messages.length}` };
        },
      },
    };
    const office = await seed(() => ISSUED_AT, runtime);
    await office.service.setVentureMailIdentity(office.scope, {
      fromName: "Frigora Quotes",
      fromEmail: "quotes@quotes.example",
    });
    const seeded = await seedSent(office);
    const contactId = await readyContact(office, messages, seeded.customer.id, seeded.site.id);
    await assert.rejects(
      () => office.service.deliverQuotationDecisionGrant(office.scope, seeded.sent.id, {
        expectedCurrentVersion: 1,
        contactId,
      }),
      (error: unknown) => error instanceof FrigoraError && error.code === "delivery_failed",
    );
    await assert.rejects(
      () => office.service.deliverQuotationDecisionGrant(office.scope, seeded.sent.id, {
        expectedCurrentVersion: 1,
        contactId,
      }),
      (error: unknown) => error instanceof FrigoraError && error.code === "delivery_failed",
    );
    const grants = await getClient().execute("SELECT revoked_at FROM frigora_quotation_decision_grants");
    const rows = await getClient().execute("SELECT state FROM frigora_quotation_customer_deliveries");
    assert.equal(grants.rows.length, 1);
    assert.equal(typeof grants.rows[0]?.revoked_at, "string");
    assert.equal(rows.rows[0]?.state, "rejected_by_provider");
    const clearedPayload = await getClient().execute("SELECT payload_text FROM frigora_quotation_customer_deliveries");
    assert.equal(clearedPayload.rows[0]?.payload_text, null);
    assert.equal(messages.filter((message) => message.idempotencyKey).length, 1);
    const copy = quotationOfficeDeliveryCopy(null, "awaiting_customer_approval", [{
      id: "delivery",
      version: 1,
      contactId,
      state: "rejected_by_provider",
      providerMessageId: null,
    }]);
    assert.match(copy, /rejected/);
    assert.match(copy, /not inbox delivery/);
    assert.equal(copy.includes("No email was sent"), false);
  });

  it("does not create a grant or call the provider when payload keys are missing", async () => {
    const saved = process.env.FRIGORA_DELIVERY_PAYLOAD_KEYS;
    delete process.env.FRIGORA_DELIVERY_PAYLOAD_KEYS;
    const messages: FrigoraMailMessage[] = [];
    const runtime: FrigoraMailRuntime = {
      verifiedDomains: ["quotes.example"],
      publicOrigin: "https://quotes.example",
      env: {},
      provider: {
        async send(message) {
          messages.push(message);
          return { outcome: "accepted_by_provider", providerMessageId: "should-not-send" };
        },
      },
    };
    try {
      const office = await seed(() => ISSUED_AT, runtime);
      await office.service.setVentureMailIdentity(office.scope, { fromName: "Frigora Quotes", fromEmail: "quotes@quotes.example" });
      const seeded = await seedSent(office);
      const contactId = await readyContact(office, messages, seeded.customer.id, seeded.site.id);
      await assert.rejects(
        () => office.service.deliverQuotationDecisionGrant(office.scope, seeded.sent.id, {
          expectedCurrentVersion: 1,
          contactId,
        }),
        (error: unknown) => error instanceof FrigoraError && error.code === "customer_delivery_unavailable",
      );
      assert.equal(messages.length, 1);
      assert.equal(messages.some((message) => message.subject === "Quotation awaiting your decision"), false);
      const grants = await getClient().execute("SELECT COUNT(*) AS n FROM frigora_quotation_decision_grants");
      const deliveries = await getClient().execute("SELECT COUNT(*) AS n FROM frigora_quotation_customer_deliveries");
      assert.equal(Number(grants.rows[0]?.n), 0);
      assert.equal(Number(deliveries.rows[0]?.n), 0);
    } finally {
      process.env.FRIGORA_DELIVERY_PAYLOAD_KEYS = saved;
    }
  });
});

const heldOutbox = {
  id: "outbox",
  quotationId: "quotation",
  workspaceId: "ws-frigora",
  ventureId: "ven-frigora",
  version: 1,
  documentHash: "hash",
  createdAt: ISSUED_AT,
  actorUserId: "user-owner",
  state: "held_pending_customer_access" as const,
  holdReason: QUOTATION_DELIVERY_HELD_REASON,
  providerMessageId: null,
};

describe("customer delivery office status", () => {
  it("describes each customer-delivery state without using the issue hold as a substitute", () => {
    const heldOnly = quotationOfficeDeliveryCopy(heldOutbox, "awaiting_customer_approval", []);
    assert.match(heldOnly, /held_pending_customer_access/);
    assert.match(heldOnly, /no email was sent/i);
    const cases = [
      ["prepared", /is prepared/, /decision grant is recorded/, /has not yet been confirmed/],
      ["sending", /is sending/, /has been claimed/],
      ["accepted_by_provider", /accepted by the provider/, /not inbox delivery/],
      ["rejected_by_provider", /rejected/, /not inbox delivery/],
      ["outcome_unknown", /unknown provider outcome/, /will not be sent as a new email/],
      ["reconciliation_required", /requires reconciliation/, /Automatic sending is blocked/],
    ] as const;
    for (const [state, ...patterns] of cases) {
      const copy = quotationOfficeDeliveryCopy(heldOutbox, "awaiting_customer_approval", [{
        id: "delivery",
        version: 1,
        contactId: "contact",
        state,
        providerMessageId: state === "accepted_by_provider" ? "provider-1" : null,
      }]);
      for (const pattern of patterns) assert.match(copy, pattern);
      assert.equal(copy.toLowerCase().includes("no email was sent"), false);
      assert.equal(copy.includes("No decision grant was created"), false);
      assert.equal(copy.includes("no grant was created"), false);
      assert.equal(copy.includes("reached the inbox"), false);
      assert.equal(copy.includes("inbox delivery is confirmed"), false);
    }
  });
});

describe("customer delivery retry safety and retention", () => {
  it("fails closed on a missing, invalid, or expired attempt clock and keeps the first prepared send", async () => {
    let nowMs = Date.parse(ISSUED_AT);
    const messages: FrigoraMailMessage[] = [];
    const calls: string[] = [];
    const runtime: FrigoraMailRuntime = {
      verifiedDomains: ["quotes.example"],
      publicOrigin: "https://quotes.example",
      env: {},
      provider: {
        async send(message) {
          messages.push(message);
          if (message.idempotencyKey) calls.push(message.idempotencyKey);
          if (message.subject === "Quotation awaiting your decision") {
            return { outcome: "unknown", providerMessageId: null };
          }
          return { outcome: "accepted_by_provider", providerMessageId: `verify-${messages.length}` };
        },
      },
    };
    const office = await seed(() => new Date(nowMs).toISOString(), runtime);
    await office.service.setVentureMailIdentity(office.scope, { fromName: "Frigora Quotes", fromEmail: "quotes@quotes.example" });
    const seeded = await seedSent(office);
    const contactId = await readyContact(office, messages, seeded.customer.id, seeded.site.id);
    const send = () => office.service.deliverQuotationDecisionGrant(office.scope, seeded.sent.id, {
      expectedCurrentVersion: 1,
      contactId,
    });
    await assert.rejects(send, (error: unknown) => {
      assert.ok(error instanceof FrigoraError);
      assert.equal(error.code, "delivery_unknown");
      assert.equal(error.message.includes("quotation-decision/"), false);
      return true;
    });
    const decisionCalls = () => calls.filter((call) => call.startsWith("quotation-customer-delivery/"));
    assert.equal(decisionCalls().length, 1);
    const preserved = await getClient().execute(
      "SELECT id, payload_text, payload_fingerprint, idempotency_key FROM frigora_quotation_customer_deliveries",
    );
    const storedPayload = String(preserved.rows[0]?.payload_text);
    const fingerprint = String(preserved.rows[0]?.payload_fingerprint);
    const payload = plaintextFromStoredDeliveryPayload(
      storedPayload,
      String(preserved.rows[0]?.id),
      fingerprint,
    );
    assert.equal(mailPayloadFingerprint(JSON.parse(payload) as FrigoraMailMessage), fingerprint);
    const beforeWindow = new Date(nowMs + RESEND_IDEMPOTENCY_WINDOW_MS - 1).toISOString();
    nowMs = Date.parse(beforeWindow);
    await assert.rejects(send, (error: unknown) => error instanceof FrigoraError && error.code === "delivery_unknown");
    assert.equal(decisionCalls().length, 2);
    assert.equal(decisionCalls()[0], decisionCalls()[1]);
    const restoreUnknown = async (stamp: string | null) => {
      await getClient().execute({
        sql: `
          UPDATE frigora_quotation_customer_deliveries
          SET state = 'outcome_unknown', idempotency_started_at = ?, payload_text = ?,
              claim_owner = NULL, claim_lease_expires_at = NULL, payload_read_failure = NULL
          WHERE idempotency_key = ?
        `,
        args: [stamp, storedPayload, String(preserved.rows[0]?.idempotency_key)],
      });
    };
    const expectNoFurtherCall = async () => {
      const before = decisionCalls().length;
      await assert.rejects(send, (error: unknown) => {
        assert.ok(error instanceof FrigoraError);
        assert.equal(error.code, "delivery_unknown");
        assert.match(error.message, /reconciliation/);
        assert.equal(error.message.includes("quotation-decision/"), false);
        return true;
      });
      assert.equal(decisionCalls().length, before);
      const row = await getClient().execute("SELECT state, payload_text FROM frigora_quotation_customer_deliveries");
      assert.equal(row.rows[0]?.state, "reconciliation_required");
      assert.equal(row.rows[0]?.payload_text, null);
    };
    for (const stamp of [null, "", "not-a-timestamp", "yesterday"]) {
      await restoreUnknown(stamp);
      await expectNoFurtherCall();
    }
    await restoreUnknown(ISSUED_AT);
    await getClient().execute({
      sql: "UPDATE frigora_quotation_customer_deliveries SET payload_text = ?",
      args: [JSON.stringify({ from: "other", to: "other@fuelco.test", subject: "Changed", text: "Changed" })],
    });
    const beforeChanged = decisionCalls().length;
    await assert.rejects(send, (error: unknown) => error instanceof FrigoraError && error.code === "delivery_unknown");
    assert.equal(decisionCalls().length, beforeChanged);
    const mismatched = await getClient().execute(
      "SELECT state, payload_text, payload_read_failure FROM frigora_quotation_customer_deliveries",
    );
    assert.equal(mismatched.rows[0]?.state, "outcome_unknown");
    assert.equal(mismatched.rows[0]?.payload_read_failure, "fingerprint_mismatch");
    assert.equal(mismatched.rows[0]?.payload_text == null, false);
    for (const offset of [RESEND_IDEMPOTENCY_WINDOW_MS, RESEND_IDEMPOTENCY_WINDOW_MS + 1]) {
      nowMs = Date.parse(ISSUED_AT) + offset;
      await restoreUnknown(ISSUED_AT);
      await expectNoFurtherCall();
    }
    await expectNoFurtherCall();
    const grants = await getClient().execute("SELECT COUNT(*) AS n FROM frigora_quotation_decision_grants");
    assert.equal(Number(grants.rows[0]?.n), 1);
  });

  it("clears expired and terminal payloads idempotently without deleting the delivery or grant", async () => {
    const nowMs = Date.parse(ISSUED_AT);
    const messages: FrigoraMailMessage[] = [];
    const runtime: FrigoraMailRuntime = {
      verifiedDomains: ["quotes.example"],
      publicOrigin: "https://quotes.example",
      env: {},
      provider: {
        async send(message) {
          messages.push(message);
          if (message.subject === "Quotation awaiting your decision") return { outcome: "unknown", providerMessageId: null };
          return { outcome: "accepted_by_provider", providerMessageId: "verify-1" };
        },
      },
    };
    const logs: string[] = [];
    const error = console.error;
    console.error = (...args: unknown[]) => { logs.push(args.map(String).join(" ")); };
    try {
      const office = await seed(() => new Date(nowMs).toISOString(), runtime);
      await office.service.setVentureMailIdentity(office.scope, { fromName: "Frigora Quotes", fromEmail: "quotes@quotes.example" });
      const seeded = await seedSent(office);
      const contactId = await readyContact(office, messages, seeded.customer.id, seeded.site.id);
      await assert.rejects(
        () => office.service.deliverQuotationDecisionGrant(office.scope, seeded.sent.id, {
          expectedCurrentVersion: 1,
          contactId,
        }),
        (caught: unknown) => {
          assert.ok(caught instanceof FrigoraError);
          assert.equal(caught.code, "delivery_unknown");
          assert.equal(caught.message.includes("quotation-decision/"), false);
          return true;
        },
      );
      const kept = await sweepQuotationCustomerDeliveryPayloads(new Date(nowMs + 1_000).toISOString());
      assert.equal(kept.reconciled, 0);
      const open = await getClient().execute("SELECT payload_text IS NOT NULL AS has_payload, state, payload_text FROM frigora_quotation_customer_deliveries");
      assert.equal(Number(open.rows[0]?.has_payload), 1);
      assert.equal(open.rows[0]?.state, "outcome_unknown");
      const verifiedBody = String(open.rows[0]?.payload_text);
      const expiredAt = new Date(nowMs + RESEND_IDEMPOTENCY_WINDOW_MS).toISOString();
      const first = await sweepQuotationCustomerDeliveryPayloads(expiredAt);
      const second = await sweepQuotationCustomerDeliveryPayloads(expiredAt);
      assert.equal(first.reconciled, 1);
      assert.equal(second.reconciled, 0);
      const cleared = await getClient().execute(`
        SELECT state, payload_text, idempotency_key FROM frigora_quotation_customer_deliveries
      `);
      assert.equal(cleared.rows[0]?.state, "reconciliation_required");
      assert.equal(cleared.rows[0]?.payload_text, null);
      assert.match(String(cleared.rows[0]?.idempotency_key), /^quotation-customer-delivery\//);
      const grants = await getClient().execute("SELECT COUNT(*) AS n FROM frigora_quotation_decision_grants");
      const attempts = await getClient().execute("SELECT COUNT(*) AS n FROM frigora_quotation_customer_delivery_attempts");
      assert.equal(Number(grants.rows[0]?.n), 1);
      assert.equal(Number(attempts.rows[0]?.n) > 0, true);
      await getClient().execute({
        sql: "UPDATE frigora_quotation_customer_deliveries SET state = 'accepted_by_provider', payload_text = ?, payload_read_failure = NULL",
        args: [verifiedBody],
      });
      const terminal = await sweepQuotationCustomerDeliveryPayloads(expiredAt);
      const again = await sweepQuotationCustomerDeliveryPayloads(expiredAt);
      assert.equal(terminal.cleared, 1);
      assert.equal(again.cleared, 0);
      const accepted = await getClient().execute(
        "SELECT state, payload_text FROM frigora_quotation_customer_deliveries",
      );
      assert.equal(accepted.rows[0]?.state, "accepted_by_provider");
      assert.equal(accepted.rows[0]?.payload_text, null);
      const grantsAfter = await getClient().execute("SELECT COUNT(*) AS n FROM frigora_quotation_decision_grants");
      const deliveriesAfter = await getClient().execute("SELECT COUNT(*) AS n FROM frigora_quotation_customer_deliveries");
      assert.equal(Number(grantsAfter.rows[0]?.n), 1);
      assert.equal(Number(deliveriesAfter.rows[0]?.n), 1);
      assert.equal(logs.some((line) => line.includes("quotation-decision/")), false);
    } finally {
      console.error = error;
    }
  });

  it("does not let a stale claim owner overwrite a newer owner", async () => {
    const messages: FrigoraMailMessage[] = [];
    const runtime: FrigoraMailRuntime = {
      verifiedDomains: ["quotes.example"],
      publicOrigin: "https://quotes.example",
      env: {},
      provider: {
        async send(message) {
          messages.push(message);
          if (message.subject === "Quotation awaiting your decision") return { outcome: "unknown", providerMessageId: null };
          return { outcome: "accepted_by_provider", providerMessageId: "verify-1" };
        },
      },
    };
    const office = await seed(() => ISSUED_AT, runtime);
    await office.service.setVentureMailIdentity(office.scope, { fromName: "Frigora Quotes", fromEmail: "quotes@quotes.example" });
    const seeded = await seedSent(office);
    const contactId = await readyContact(office, messages, seeded.customer.id, seeded.site.id);
    await assert.rejects(
      () => office.service.deliverQuotationDecisionGrant(office.scope, seeded.sent.id, {
        expectedCurrentVersion: 1,
        contactId,
      }),
    );
    const loaded = await findQuotationCustomerDelivery(seeded.sent.id as FrigoraQuotationId, 1, contactId);
    assert.ok(loaded);
    const first = await claimQuotationCustomerDelivery(loaded, ISSUED_AT);
    assert.equal(first.action, "send");
    const blocked = await claimQuotationCustomerDelivery(first.record, ISSUED_AT);
    assert.equal(blocked.action, "in_flight");
    const later = new Date(Date.parse(ISSUED_AT) + CUSTOMER_DELIVERY_CLAIM_LEASE_MS + 1).toISOString();
    const recovered = await claimQuotationCustomerDelivery(first.record, later);
    assert.equal(recovered.action, "send");
    assert.equal(recovered.record.idempotencyKey, first.record.idempotencyKey);
    assert.equal(recovered.record.payloadFingerprint, first.record.payloadFingerprint);
    await assert.rejects(
      () => recordQuotationCustomerDeliveryResult({
        record: first.record,
        outcome: "accepted_by_provider",
        providerMessageId: "stale-owner",
        now: later,
        actorUserId: office.userId,
      }),
      (error: unknown) => error instanceof FrigoraError && error.code === "customer_delivery_unavailable",
    );
    const saved = await recordQuotationCustomerDeliveryResult({
      record: recovered.record,
      outcome: "accepted_by_provider",
      providerMessageId: "provider-1",
      now: later,
      actorUserId: office.userId,
    });
    assert.equal(saved.state, "accepted_by_provider");
    assert.equal(saved.providerMessageId, "provider-1");
    assert.equal(saved.payloadText, null);
    const row = await getClient().execute("SELECT provider_message_id, state FROM frigora_quotation_customer_deliveries");
    assert.equal(row.rows[0]?.provider_message_id, "provider-1");
    assert.notEqual(row.rows[0]?.provider_message_id, "stale-owner");
  });
});

function runClaimWorker(databaseUrl: string, mode: string, journalPath: string, now = ISSUED_AT, delay = "0") {
  const workerPath = fileURLToPath(new URL("./quotation-customer-delivery-claim-worker.ts", import.meta.url));
  const child: ChildProcess = fork(workerPath, [databaseUrl, mode, journalPath, now, delay], {
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
      reject(new Error(`delivery claim worker ${mode} timed out: ${stderr}`));
    }, 120_000);
    child.once("exit", (code) => {
      clearTimeout(timer);
      resolve({ code, messages, stderr });
    });
  });
  return {
    pid: child.pid,
    finished,
    messages,
    stderr: () => stderr,
    stop: () => child.kill(),
  };
}

async function removeClaimDirectory(directory: string) {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    try {
      await rm(directory, { recursive: true, force: true });
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }
}

type ClaimSnapshot = {
  http: number;
  logical: number;
  grants: number;
  attempts: string[];
  rows: Array<{
    state: string;
    idempotency_key: string;
    payload_fingerprint: string;
    provider_message_id: string | null;
    has_payload: number;
  }>;
  logicalIds: string[];
  logicalKeys: string[];
  fingerprints: string[];
};

function claimSnapshot(message: unknown) {
  return message as ClaimSnapshot;
}

describe("customer delivery claims across processes", () => {
  it("lets only one of two processes call the provider", async () => {
    const directory = await mkdtemp(join(tmpdir(), "frg-delivery-claim-"));
    const databaseUrl = `file:${join(directory, "delivery.db").replaceAll("\\", "/")}`;
    const journalPath = join(directory, "journal.json");
    try {
      const seeded = await runClaimWorker(databaseUrl, "seed", journalPath).finished;
      assert.equal(seeded.code, 0, seeded.stderr);
      const first = runClaimWorker(databaseUrl, "send", journalPath, ISSUED_AT, "8000");
      const second = runClaimWorker(databaseUrl, "send", journalPath, ISSUED_AT, "8000");
      const raced = await Promise.all([first.finished, second.finished]);
      assert.equal(raced.every((result) => result.code === 0), true, raced.map((result) => result.stderr).join("\n"));
      const reports = raced.flatMap((result) => result.messages) as Array<{ status?: string; code?: string }>;
      assert.equal(reports.filter((report) => report.status === "fulfilled").length >= 1, true);
      for (const report of reports) {
        if (report.status === "rejected") assert.equal(report.code, "delivery_unknown");
      }
      const during = await runClaimWorker(databaseUrl, "snapshot", journalPath).finished;
      assert.equal(during.code, 0, during.stderr);
      const body = claimSnapshot(during.messages.at(-1));
      assert.equal(body.http, 1);
      assert.equal(body.logical, 1);
      assert.equal(body.grants, 1);
      assert.equal(body.rows.length, 1);
      assert.equal(body.rows[0]?.state, "accepted_by_provider");
      assert.equal(body.logicalIds[0], "provider-1");
    } finally {
      await removeClaimDirectory(directory);
    }
  });

  it("recovers the original provider message after the acceptance write fails in another process", async () => {
    const directory = await mkdtemp(join(tmpdir(), "frg-delivery-recover-"));
    const databaseUrl = `file:${join(directory, "delivery.db").replaceAll("\\", "/")}`;
    const journalPath = join(directory, "journal.json");
    try {
      const seeded = await runClaimWorker(databaseUrl, "seed", journalPath).finished;
      assert.equal(seeded.code, 0, seeded.stderr);
      const failed = await runClaimWorker(databaseUrl, "fail-accept", journalPath).finished;
      assert.equal(failed.code, 0, failed.stderr);
      const failedReport = failed.messages.at(-1) as { status?: string; code?: string; pid?: number };
      assert.equal(failedReport.status, "failed");
      assert.equal(failedReport.code, "customer_delivery_unavailable");
      const interrupted = await runClaimWorker(databaseUrl, "snapshot", journalPath).finished;
      assert.equal(interrupted.code, 0, interrupted.stderr);
      const open = claimSnapshot(interrupted.messages.at(-1));
      assert.equal(open.http, 1);
      assert.equal(open.logical, 1);
      assert.equal(open.rows[0]?.state, "sending");
      assert.equal(open.rows[0]?.provider_message_id, null);
      assert.equal(Number(open.rows[0]?.has_payload), 1);
      assert.equal(open.rows[0]?.idempotency_key, open.logicalKeys[0]);
      assert.equal(open.rows[0]?.payload_fingerprint, open.fingerprints[0]);
      const recovered = await runClaimWorker(databaseUrl, "recover", journalPath).finished;
      assert.equal(recovered.code, 0, recovered.stderr);
      const recoveredReport = recovered.messages.at(-1) as { status?: string; providerMessageId?: string; pid?: number };
      assert.equal(recoveredReport.status, "fulfilled");
      assert.equal(recoveredReport.providerMessageId, "provider-1");
      assert.equal(typeof failedReport.pid, "number");
      assert.equal(typeof recoveredReport.pid, "number");
      assert.notEqual(failedReport.pid, recoveredReport.pid);
      const closed = await runClaimWorker(databaseUrl, "snapshot", journalPath).finished;
      assert.equal(closed.code, 0, closed.stderr);
      const done = claimSnapshot(closed.messages.at(-1));
      assert.equal(done.http, 2);
      assert.equal(done.logical, 1);
      assert.equal(done.logicalIds[0], "provider-1");
      assert.equal(done.grants, 1);
      assert.equal(done.rows.length, 1);
      assert.equal(done.rows[0]?.state, "accepted_by_provider");
      assert.equal(done.rows[0]?.provider_message_id, "provider-1");
      assert.equal(done.rows[0]?.idempotency_key, open.rows[0]?.idempotency_key);
      assert.equal(done.rows[0]?.payload_fingerprint, open.rows[0]?.payload_fingerprint);
      assert.equal(Number(done.rows[0]?.has_payload), 0);
      process.stderr.write(
        `recovery-processes failed=${failedReport.pid} recovered=${recoveredReport.pid} key=${done.rows[0]?.idempotency_key} fingerprint=${done.rows[0]?.payload_fingerprint} provider=${done.rows[0]?.provider_message_id} logical=${done.logical} http=${done.http}\n`,
      );
    } finally {
      await removeClaimDirectory(directory);
    }
  });
});

describe("customer delivery request hold and scheduled retention", () => {
  function heldRuntime() {
    let nowMs = Date.parse(ISSUED_AT);
    let hold = false;
    let release: (value?: void | PromiseLike<void>) => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let decisionCalls = 0;
    const messages: FrigoraMailMessage[] = [];
    const runtime: FrigoraMailRuntime = {
      verifiedDomains: ["quotes.example"],
      publicOrigin: "https://quotes.example",
      env: {},
      provider: {
        async send(message) {
          messages.push(message);
          if (!message.idempotencyKey) {
            return { outcome: "accepted_by_provider", providerMessageId: "verify-1" };
          }
          decisionCalls += 1;
          if (!hold) return { outcome: "unknown", providerMessageId: null };
          await gate;
          return { outcome: "accepted_by_provider", providerMessageId: "provider-1" };
        },
      },
    };
    return {
      runtime,
      now: () => new Date(nowMs).toISOString(),
      setNow(value: number) {
        nowMs = value;
      },
      arm() {
        hold = true;
      },
      release,
      calls: () => decisionCalls,
      messages,
    };
  }

  async function unknownDelivery(clock: ReturnType<typeof heldRuntime>) {
    const office = await seed(clock.now, clock.runtime);
    await office.service.setVentureMailIdentity(office.scope, {
      fromName: "Frigora Quotes",
      fromEmail: "quotes@quotes.example",
    });
    const seeded = await seedSent(office);
    const contactId = await readyContact(office, clock.messages, seeded.customer.id, seeded.site.id);
    await assert.rejects(
      () => office.service.deliverQuotationDecisionGrant(office.scope, seeded.sent.id, {
        expectedCurrentVersion: 1,
        contactId,
      }),
      (error: unknown) => error instanceof FrigoraError && error.code === "delivery_unknown",
    );
    return { office, seeded, contactId };
  }

  async function waitForArmedRequest() {
    for (let attempt = 0; attempt < 50; attempt += 1) {
      const row = await getClient().execute(`
        SELECT id, state, claim_owner, claim_lease_expires_at, provider_request_expires_at,
               payload_text IS NOT NULL AS has_payload, provider_message_id
        FROM frigora_quotation_customer_deliveries
      `);
      if (row.rows[0]?.provider_request_expires_at) return row.rows[0];
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    throw new Error("provider request was not armed");
  }

  it("keeps an in-flight provider call when the sweep reaches the idempotency boundary", async () => {
    const clock = heldRuntime();
    const { office, seeded, contactId } = await unknownDelivery(clock);
    const claimNow = Date.parse(ISSUED_AT) + RESEND_IDEMPOTENCY_WINDOW_MS - 5_000;
    clock.setNow(claimNow);
    clock.arm();
    const pending = office.service.deliverQuotationDecisionGrant(office.scope, seeded.sent.id, {
      expectedCurrentVersion: 1,
      contactId,
    });
    const armed = await waitForArmedRequest();
    assert.equal(armed.state, "sending");
    assert.equal(Number(armed.has_payload), 1);
    assert.equal(armed.provider_message_id, null);
    const boundary = new Date(Date.parse(ISSUED_AT) + RESEND_IDEMPOTENCY_WINDOW_MS).toISOString();
    assert.equal(String(armed.provider_request_expires_at) > boundary, true);
    assert.equal(String(armed.claim_lease_expires_at) > boundary, true);
    const callsWhileHeld = clock.calls();
    const sweep = await sweepQuotationCustomerDeliveryPayloads(boundary);
    assert.equal(sweep.reconciled, 0);
    const during = await getClient().execute(`
      SELECT state, claim_owner, payload_text IS NOT NULL AS has_payload, provider_message_id
      FROM frigora_quotation_customer_deliveries
    `);
    assert.equal(during.rows[0]?.state, "sending");
    assert.equal(during.rows[0]?.claim_owner, armed.claim_owner);
    assert.equal(Number(during.rows[0]?.has_payload), 1);
    assert.equal(during.rows[0]?.provider_message_id, null);
    clock.setNow(claimNow + CUSTOMER_DELIVERY_CLAIM_LEASE_MS + 1);
    await assert.rejects(
      () => office.service.deliverQuotationDecisionGrant(office.scope, seeded.sent.id, {
        expectedCurrentVersion: 1,
        contactId,
      }),
      (error: unknown) => error instanceof FrigoraError && error.code === "delivery_unknown",
    );
    assert.equal(clock.calls(), callsWhileHeld);
    const loaded = await findQuotationCustomerDelivery(seeded.sent.id as FrigoraQuotationId, 1, contactId);
    assert.ok(loaded);
    await assert.rejects(
      () => recordQuotationCustomerDeliveryResult({
        record: { ...loaded, claimOwner: "stale-owner" },
        outcome: "accepted_by_provider",
        providerMessageId: "stale-provider",
        now: boundary,
        actorUserId: office.userId,
      }),
      (error: unknown) => error instanceof FrigoraError && error.code === "customer_delivery_unavailable",
    );
    clock.release();
    const accepted = await pending;
    assert.equal(accepted.providerMessageId, "provider-1");
    assert.equal(clock.calls(), callsWhileHeld);
    const closed = await getClient().execute(`
      SELECT state, provider_message_id, payload_text, idempotency_key FROM frigora_quotation_customer_deliveries
    `);
    assert.equal(closed.rows.length, 1);
    assert.equal(closed.rows[0]?.state, "accepted_by_provider");
    assert.equal(closed.rows[0]?.provider_message_id, "provider-1");
    assert.equal(closed.rows[0]?.payload_text, null);
    const grants = await getClient().execute("SELECT COUNT(*) AS n FROM frigora_quotation_decision_grants");
    assert.equal(Number(grants.rows[0]?.n), 1);
    const staleAfter = await recordQuotationCustomerDeliveryResult({
      record: { ...loaded, claimOwner: "stale-owner" },
      outcome: "accepted_by_provider",
      providerMessageId: "later-stale",
      now: boundary,
      actorUserId: office.userId,
    });
    assert.equal(staleAfter.providerMessageId, "provider-1");
    const unchanged = await getClient().execute("SELECT provider_message_id FROM frigora_quotation_customer_deliveries");
    assert.equal(unchanged.rows[0]?.provider_message_id, "provider-1");
  });

  it("does not let a second send start after the lease expires while the provider request is still held", async () => {
    const clock = heldRuntime();
    const { office, seeded, contactId } = await unknownDelivery(clock);
    const claimNow = Date.parse(ISSUED_AT) + 1_000;
    clock.setNow(claimNow);
    clock.arm();
    const pending = office.service.deliverQuotationDecisionGrant(office.scope, seeded.sent.id, {
      expectedCurrentVersion: 1,
      contactId,
    });
    const armed = await waitForArmedRequest();
    const laterMs = claimNow + CUSTOMER_DELIVERY_CLAIM_LEASE_MS + 1;
    const later = new Date(laterMs).toISOString();
    await getClient().execute({
      sql: `
        UPDATE frigora_quotation_customer_deliveries
        SET idempotency_started_at = ?, claim_lease_expires_at = ?
        WHERE id = ?
      `,
      args: [
        new Date(laterMs - RESEND_IDEMPOTENCY_WINDOW_MS - 1_000).toISOString(),
        new Date(laterMs - 1_000).toISOString(),
        String(armed.id),
      ],
    });
    const callsWhileHeld = clock.calls();
    clock.setNow(laterMs);
    const sweep = await sweepQuotationCustomerDeliveryPayloads(later);
    assert.equal(sweep.reconciled, 0);
    await assert.rejects(
      () => office.service.deliverQuotationDecisionGrant(office.scope, seeded.sent.id, {
        expectedCurrentVersion: 1,
        contactId,
      }),
      (error: unknown) => error instanceof FrigoraError && error.code === "delivery_unknown",
    );
    assert.equal(clock.calls(), callsWhileHeld);
    const loaded = await findQuotationCustomerDelivery(seeded.sent.id as FrigoraQuotationId, 1, contactId);
    assert.ok(loaded);
    assert.ok(loaded.providerRequestExpiresAt);
    assert.equal(loaded.providerRequestExpiresAt >= String(armed.provider_request_expires_at), true);
    const blocked = await claimQuotationCustomerDelivery(loaded, later);
    assert.equal(blocked.action, "in_flight");
    clock.release();
    const accepted = await pending;
    assert.equal(accepted.providerMessageId, "provider-1");
    const row = await getClient().execute("SELECT state, provider_message_id FROM frigora_quotation_customer_deliveries");
    assert.equal(row.rows[0]?.state, "accepted_by_provider");
    assert.equal(row.rows[0]?.provider_message_id, "provider-1");
  });

  it("does not send again when the hold expires while the original provider call is still executing", async () => {
    const clock = heldRuntime();
    const { office, seeded, contactId } = await unknownDelivery(clock);
    clock.arm();
    const pending = office.service.deliverQuotationDecisionGrant(office.scope, seeded.sent.id, {
      expectedCurrentVersion: 1,
      contactId,
    });
    const armed = await waitForArmedRequest();
    await getClient().execute({
      sql: `
        UPDATE frigora_quotation_customer_deliveries
        SET provider_request_expires_at = ?, claim_lease_expires_at = ?
        WHERE id = ?
      `,
      args: [ISSUED_AT, ISSUED_AT, String(armed.id)],
    });
    const pastHoldMs = Date.parse(ISSUED_AT) + CUSTOMER_DELIVERY_PROVIDER_REQUEST_HOLD_MS + 1;
    const pastHold = new Date(pastHoldMs).toISOString();
    clock.setNow(pastHoldMs);
    const callsWhileHeld = clock.calls();
    const sweep = await sweepQuotationCustomerDeliveryPayloads(pastHold);
    assert.equal(sweep.reconciled, 0);
    assert.equal(sweep.cleared, 0);
    const during = await getClient().execute(`
      SELECT state, claim_owner, provider_message_id, provider_request_expires_at,
             idempotency_key, payload_fingerprint, payload_text IS NOT NULL AS has_payload
      FROM frigora_quotation_customer_deliveries
    `);
    assert.equal(during.rows[0]?.state, "sending");
    assert.equal(during.rows[0]?.claim_owner, armed.claim_owner);
    assert.equal(during.rows[0]?.provider_message_id, null);
    assert.equal(Number(during.rows[0]?.has_payload), 1);
    assert.equal(String(during.rows[0]?.provider_request_expires_at) <= pastHold, true);
    await assert.rejects(
      () => office.service.deliverQuotationDecisionGrant(office.scope, seeded.sent.id, {
        expectedCurrentVersion: 1,
        contactId,
      }),
      (error: unknown) => error instanceof FrigoraError && error.code === "delivery_unknown",
    );
    assert.equal(clock.calls(), callsWhileHeld);
    const loaded = await findQuotationCustomerDelivery(seeded.sent.id as FrigoraQuotationId, 1, contactId);
    assert.ok(loaded);
    assert.equal(loaded.state, "sending");
    await assert.rejects(
      () => recordQuotationCustomerDeliveryResult({
        record: { ...loaded, claimOwner: "stale-owner" },
        outcome: "accepted_by_provider",
        providerMessageId: "provider-stale",
        now: pastHold,
        actorUserId: office.userId,
      }),
      (error: unknown) => error instanceof FrigoraError && error.code === "customer_delivery_unavailable",
    );
    clock.release();
    const accepted = await pending;
    assert.equal(accepted.providerMessageId, "provider-1");
    assert.equal(clock.calls(), callsWhileHeld);
    const closed = await getClient().execute(`
      SELECT state, provider_message_id, payload_text, idempotency_key, payload_fingerprint
      FROM frigora_quotation_customer_deliveries
    `);
    assert.equal(closed.rows.length, 1);
    assert.equal(closed.rows[0]?.state, "accepted_by_provider");
    assert.equal(closed.rows[0]?.provider_message_id, "provider-1");
    assert.equal(closed.rows[0]?.payload_text, null);
    assert.equal(closed.rows[0]?.idempotency_key, during.rows[0]?.idempotency_key);
    assert.equal(closed.rows[0]?.payload_fingerprint, during.rows[0]?.payload_fingerprint);
    const grants = await getClient().execute("SELECT COUNT(*) AS n FROM frigora_quotation_decision_grants");
    const attempts = await getClient().execute("SELECT outcome FROM frigora_quotation_customer_delivery_attempts");
    assert.equal(Number(grants.rows[0]?.n), 1);
    assert.equal(attempts.rows.filter((row) => String(row.outcome) === "sending").length, 2);
    assert.equal(attempts.rows.some((row) => String(row.outcome) === "accepted_by_provider"), true);
  });

  it("does not start a second provider call while another process is still executing", async () => {
    const directory = await mkdtemp(join(tmpdir(), "frg-delivery-overlap-"));
    const databaseUrl = `file:${join(directory, "delivery.db").replaceAll("\\", "/")}`;
    const journalPath = join(directory, "journal.json");
    let held: ReturnType<typeof runClaimWorker> | undefined;
    try {
      const seeded = await runClaimWorker(databaseUrl, "seed", journalPath).finished;
      assert.equal(seeded.code, 0, seeded.stderr);
      held = runClaimWorker(databaseUrl, "send", journalPath, ISSUED_AT, "20000");
      let armed = false;
      for (let attempt = 0; attempt < 150; attempt += 1) {
        if (held.messages.some((message) => (message as { status?: string }).status === "provider-started")) {
          armed = true;
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      assert.equal(armed, true, held.stderr());
      const later = new Date(Date.parse(ISSUED_AT) + CUSTOMER_DELIVERY_PROVIDER_REQUEST_HOLD_MS + 1).toISOString();
      const blocked = await runClaimWorker(databaseUrl, "send", journalPath, later, "0").finished;
      assert.equal(blocked.code, 0, blocked.stderr);
      const blockedReport = blocked.messages.at(-1) as { status?: string; code?: string; pid?: number };
      assert.equal(blockedReport.status, "rejected");
      assert.equal(blockedReport.code, "delivery_unknown");
      const during = await runClaimWorker(databaseUrl, "snapshot", journalPath).finished;
      const open = claimSnapshot(during.messages.at(-1));
      assert.equal(open.http, 0);
      assert.equal(open.logical, 0);
      assert.equal(open.rows[0]?.state, "sending");
      assert.equal(open.rows[0]?.provider_message_id, null);
      assert.equal(open.grants, 1);
      const finished = await held.finished;
      assert.equal(finished.code, 0, finished.stderr);
      const closed = await runClaimWorker(databaseUrl, "snapshot", journalPath).finished;
      const done = claimSnapshot(closed.messages.at(-1));
      assert.equal(done.http, 1);
      assert.equal(done.logical, 1);
      assert.equal(done.logicalIds[0], "provider-1");
      assert.equal(done.rows.length, 1);
      assert.equal(done.rows[0]?.state, "accepted_by_provider");
      assert.equal(done.rows[0]?.provider_message_id, "provider-1");
      assert.equal(done.rows[0]?.idempotency_key, open.rows[0]?.idempotency_key);
      assert.equal(done.rows[0]?.payload_fingerprint, open.rows[0]?.payload_fingerprint);
      assert.notEqual(held.pid, blockedReport.pid);
    } finally {
      held?.stop();
      await removeClaimDirectory(directory);
    }
  });

  it("reconciles a lost provider response after the executing process dies", async () => {
    const directory = await mkdtemp(join(tmpdir(), "frg-delivery-lost-"));
    const databaseUrl = `file:${join(directory, "delivery.db").replaceAll("\\", "/")}`;
    const journalPath = join(directory, "journal.json");
    let held: ReturnType<typeof runClaimWorker> | undefined;
    try {
      const seeded = await runClaimWorker(databaseUrl, "seed", journalPath).finished;
      assert.equal(seeded.code, 0, seeded.stderr);
      held = runClaimWorker(databaseUrl, "send", journalPath, ISSUED_AT, "60000");
      let armed = false;
      for (let attempt = 0; attempt < 150; attempt += 1) {
        if (held.messages.some((message) => (message as { status?: string }).status === "provider-started")) {
          armed = true;
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      assert.equal(armed, true, held.stderr());
      held.stop();
      await held.finished;
      const later = new Date(Date.parse(ISSUED_AT) + CUSTOMER_DELIVERY_PROVIDER_REQUEST_HOLD_MS + 1).toISOString();
      const blocked = await runClaimWorker(databaseUrl, "send", journalPath, later, "0").finished;
      assert.equal(blocked.code, 0, blocked.stderr);
      const blockedReport = blocked.messages.at(-1) as { status?: string; code?: string; pid?: number };
      assert.equal(blockedReport.status, "rejected");
      assert.equal(blockedReport.code, "delivery_unknown");
      const during = await runClaimWorker(databaseUrl, "snapshot", journalPath).finished;
      const open = claimSnapshot(during.messages.at(-1));
      assert.equal(open.http, 0);
      assert.equal(open.logical, 0);
      assert.equal(open.rows[0]?.state, "sending");
      assert.equal(open.rows[0]?.provider_message_id, null);
      assert.equal(Number(open.rows[0]?.has_payload), 1);
      const expired = await runClaimWorker(databaseUrl, "expire-fence", journalPath, ISSUED_AT, "0").finished;
      assert.equal(expired.code, 0, expired.stderr);
      const recovered = await runClaimWorker(databaseUrl, "send", journalPath, later, "0").finished;
      assert.equal(recovered.code, 0, recovered.stderr);
      const recoveredReport = recovered.messages.at(-1) as { status?: string; code?: string; pid?: number };
      assert.equal(recoveredReport.status, "rejected");
      assert.equal(recoveredReport.code, "delivery_unknown");
      const closed = await runClaimWorker(databaseUrl, "snapshot", journalPath).finished;
      const done = claimSnapshot(closed.messages.at(-1));
      assert.equal(done.http, 0);
      assert.equal(done.logical, 0);
      assert.equal(done.logicalIds.length, 0);
      assert.equal(done.grants, 1);
      assert.equal(done.rows.length, 1);
      assert.equal(done.rows[0]?.state, "reconciliation_required");
      assert.equal(done.rows[0]?.provider_message_id, null);
      assert.equal(done.rows[0]?.idempotency_key, open.rows[0]?.idempotency_key);
      assert.equal(done.rows[0]?.payload_fingerprint, open.rows[0]?.payload_fingerprint);
      assert.equal(Number(done.rows[0]?.has_payload), 0);
      assert.equal(done.attempts.filter((outcome) => outcome === "sending").length, 1);
      assert.equal(done.attempts.includes("reconciliation_required"), true);
      assert.notEqual(held.pid, recoveredReport.pid);
    } finally {
      held?.stop();
      await removeClaimDirectory(directory);
    }
  });

  it("reconciles an abandoned provider request before, at, and after the idempotency window", async () => {
    const clock = heldRuntime();
    const { office, seeded, contactId } = await unknownDelivery(clock);
    const saved = await getClient().execute(
      "SELECT payload_text, idempotency_key, payload_fingerprint FROM frigora_quotation_customer_deliveries",
    );
    const payload = String(saved.rows[0]?.payload_text);
    const key = String(saved.rows[0]?.idempotency_key);
    const fingerprint = String(saved.rows[0]?.payload_fingerprint);
    const calls = clock.calls();
    const restore = async () => {
      await getClient().execute({
        sql: `
          UPDATE frigora_quotation_customer_deliveries
          SET state = 'sending', payload_text = ?, idempotency_started_at = ?,
              provider_request_expires_at = ?, claim_owner = NULL, claim_lease_expires_at = NULL,
              provider_message_id = NULL
          WHERE idempotency_key = ?
        `,
        args: [payload, ISSUED_AT, ISSUED_AT, key],
      });
    };
    for (const offset of [
      CUSTOMER_DELIVERY_PROVIDER_REQUEST_HOLD_MS + 1,
      RESEND_IDEMPOTENCY_WINDOW_MS,
      RESEND_IDEMPOTENCY_WINDOW_MS + 1,
    ]) {
      await restore();
      clock.setNow(Date.parse(ISSUED_AT) + offset);
      await assert.rejects(
        () => office.service.deliverQuotationDecisionGrant(office.scope, seeded.sent.id, {
          expectedCurrentVersion: 1,
          contactId,
        }),
        (error: unknown) => {
          assert.ok(error instanceof FrigoraError);
          assert.equal(error.code, "delivery_unknown");
          assert.match(error.message, /reconciliation/);
          return true;
        },
      );
      assert.equal(clock.calls(), calls);
      const row = await getClient().execute(`
        SELECT state, idempotency_key, payload_fingerprint, payload_text, provider_message_id
        FROM frigora_quotation_customer_deliveries
      `);
      assert.equal(row.rows.length, 1);
      assert.equal(row.rows[0]?.state, "reconciliation_required");
      assert.equal(row.rows[0]?.idempotency_key, key);
      assert.equal(row.rows[0]?.payload_fingerprint, fingerprint);
      assert.equal(row.rows[0]?.payload_text, null);
      assert.equal(row.rows[0]?.provider_message_id, null);
    }
    const grants = await getClient().execute("SELECT COUNT(*) AS n FROM frigora_quotation_decision_grants");
    assert.equal(Number(grants.rows[0]?.n), 1);
  });

  it("clears an expired dormant payload from platform maintenance without another claim", async () => {
    const clock = heldRuntime();
    const { office, seeded, contactId } = await unknownDelivery(clock);
    const started = new Date(Date.now() - RESEND_IDEMPOTENCY_WINDOW_MS - 60_000).toISOString();
    await getClient().execute({
      sql: `
        UPDATE frigora_quotation_customer_deliveries
        SET idempotency_started_at = ?, claim_owner = NULL,
            claim_lease_expires_at = NULL, provider_request_expires_at = NULL
      `,
      args: [started],
    });
    const beforeAttempts = await getClient().execute("SELECT COUNT(*) AS n FROM frigora_quotation_customer_delivery_attempts");
    const info: string[] = [];
    const errors: string[] = [];
    const originalInfo = console.info;
    const originalError = console.error;
    console.info = (...args: unknown[]) => {
      info.push(args.map(String).join(" "));
    };
    console.error = (...args: unknown[]) => {
      if (args[0] === "[scheduler] task failed") errors.push(args.map(String).join(" "));
      else originalError(...args);
    };
    try {
      await runGuardedSteps([{
        name: "frigora.customer-delivery.sweep",
        run: async () => {
          throw new Error("sweep down");
        },
      }]);
      assert.equal(errors.some((line) => line.includes("frigora.customer-delivery.sweep") && line.includes("sweep down")), true);
      const retained = await getClient().execute("SELECT payload_text IS NOT NULL AS has_payload, state FROM frigora_quotation_customer_deliveries");
      assert.equal(Number(retained.rows[0]?.has_payload), 1);
      assert.equal(retained.rows[0]?.state, "outcome_unknown");
      await runPlatformMaintenance({
        processDue: async () => undefined,
        recover: async () => undefined,
      });
      const cleared = await getClient().execute(`
        SELECT state, payload_text FROM frigora_quotation_customer_deliveries
      `);
      assert.equal(cleared.rows.length, 1);
      assert.equal(cleared.rows[0]?.state, "reconciliation_required");
      assert.equal(cleared.rows[0]?.payload_text, null);
      await runPlatformMaintenance({
        processDue: async () => undefined,
        recover: async () => undefined,
      });
      const repeated = await getClient().execute("SELECT state, payload_text FROM frigora_quotation_customer_deliveries");
      assert.equal(repeated.rows[0]?.state, "reconciliation_required");
      assert.equal(repeated.rows[0]?.payload_text, null);
      const future = new Date(Date.now() + 60_000).toISOString();
      await getClient().execute({
        sql: `
          UPDATE frigora_quotation_customer_deliveries
          SET state = 'sending', payload_text = ?, idempotency_started_at = ?,
              provider_request_expires_at = ?, claim_owner = 'active-owner', claim_lease_expires_at = NULL
        `,
        args: ["active-marker", started, future],
      });
      await runPlatformMaintenance({
        processDue: async () => undefined,
        recover: async () => undefined,
      });
      const active = await getClient().execute("SELECT state, payload_text FROM frigora_quotation_customer_deliveries");
      assert.equal(active.rows[0]?.state, "sending");
      assert.equal(active.rows[0]?.payload_text, "active-marker");
      const grants = await getClient().execute("SELECT COUNT(*) AS n FROM frigora_quotation_decision_grants");
      const attempts = await getClient().execute("SELECT COUNT(*) AS n FROM frigora_quotation_customer_delivery_attempts");
      assert.equal(Number(grants.rows[0]?.n), 1);
      assert.equal(Number(attempts.rows[0]?.n) >= Number(beforeAttempts.rows[0]?.n), true);
      assert.equal(info.some((line) => line.includes("[frigora] customer-delivery sweep completed") && line.includes("reconciled=")), true);
      assert.equal(info.some((line) => line.includes("quotation-decision/") || line.includes("active-marker")), false);
      const loaded = await findQuotationCustomerDelivery(seeded.sent.id as FrigoraQuotationId, 1, contactId);
      assert.equal(loaded?.state, "sending");
      assert.equal(office.userId.length > 0, true);
    } finally {
      console.info = originalInfo;
      console.error = originalError;
    }
  });
});
