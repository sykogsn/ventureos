import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, it } from "node:test";
import type { Role, UserId, VentureId, WorkspaceId } from "@/contracts";
import { takeAuthMailOutbox } from "@/modules/auth/mail";
import { createPermissionService } from "@/platform/permissions/service";
import { createDbMembershipStore } from "@/platform/permissions/membership-store";
import { ensureSchema, getClient, getDatabaseUrl, resetDatabaseLifecycle } from "@/platform/persistence/db";
import { getPersistence, resetPersistenceLifecycle } from "@/platform/persistence/repositories";
import type { PersistedVenture } from "@/platform/persistence/repositories/ports";
import { exampleQuotationCommercial, priceQuotationCommercial } from "./quotation-commercial";
import { FrigoraError } from "./errors";
import { allowSyntheticNotRegisteredQuotationSend } from "./tax-configuration-fixture";
import { installQuotationDeliveryPayloadTestKeys, plaintextFromStoredDeliveryPayload } from "./quotation-delivery-payload";
import { FrigoraMailDeliveryError, type FrigoraMailMessage, type FrigoraMailOutcome, type FrigoraMailRuntime } from "./mail";
import { withFrigoraWriteTransaction } from "./owned-write";
import { quotationDocumentHash } from "./quotation-workflow";
import { createFrigoraService } from "./service";
import { createFrigoraStore } from "./store";
import { closeFrigoraPersistenceAfterFile } from "./test-persistence-lifecycle";
import type { FrigoraCustomerContactId, FrigoraScope } from "./types";

const NOW = "2026-10-24T08:00:00.000Z";
const ARRIVED = "2026-10-24T08:05:00.000Z";
const RECOMMENDED_AT = "2026-10-24T08:20:00.000Z";
const ISSUED_AT = "2026-10-24T12:00:00.000Z";
const BASIS = "Office recorded this mailbox as the commercial approver for this site.";

closeFrigoraPersistenceAfterFile();
installQuotationDeliveryPayloadTestKeys();

beforeEach(async () => {
  await resetPersistenceLifecycle();
  await ensureSchema();
  takeAuthMailOutbox();
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

function fakeMail(decisionOutcome: FrigoraMailOutcome = "accepted_by_provider") {
  const messages: FrigoraMailMessage[] = [];
  const runtime: FrigoraMailRuntime = {
    verifiedDomains: ["quotes.example"],
    publicOrigin: "https://quotes.example",
    env: {},
    provider: {
      async send(message) {
        messages.push(message);
        const outcome = message.subject === "Quotation awaiting your decision"
          ? decisionOutcome
          : "accepted_by_provider";
        if (outcome !== "accepted_by_provider") {
          return { outcome, providerMessageId: null };
        }
        return { outcome, providerMessageId: `provider-${messages.length}` };
      },
    },
  };
  return { messages, runtime };
}

function codeFrom(message: FrigoraMailMessage | undefined) {
  const lines = message?.text.split("\n") ?? [];
  const index = lines.findIndex((line) => line === "Verification code:" || line === "Decision code:");
  if (index >= 0) return lines[index + 1] ?? "";
  const link = lines.find((line) => line.includes("/quotation-decision/"));
  if (!link) return "";
  const url = new URL(link);
  return decodeURIComponent(url.hash.slice(1));
}

async function seed(options: {
  reset?: boolean;
  workspaceId?: WorkspaceId;
  ventureId?: VentureId;
  userId?: UserId;
  role?: Role;
  now?: () => string;
  mail?: FrigoraMailRuntime;
} = {}) {
  if (options.reset !== false) {
    await resetPersistenceLifecycle();
    await ensureSchema();
  }
  const workspaceId = (options.workspaceId ?? "ws-frigora") as WorkspaceId;
  const ventureId = (options.ventureId ?? "ven-frigora") as VentureId;
  const userId = (options.userId ?? "user-owner") as UserId;
  const persistence = getPersistence();
  if (!(await persistence.organisations.findById(workspaceId))) {
    await persistence.organisations.insert({
      id: workspaceId,
      name: "Frigora Workspace",
      slug: `ws-${workspaceId}`,
      createdAt: NOW,
    });
  }
  await persistence.memberships.setRole({
    userId,
    workspaceId,
    role: options.role ?? "owner",
    createdAt: NOW,
  });
  if (!(await persistence.ventures.findById(ventureId))) {
    await persistence.ventures.insert(
      ventureRow({ id: ventureId, workspaceId, slug: `venture-${ventureId}` }),
    );
  }
  const store = createFrigoraStore();
  return {
    workspaceId,
    ventureId,
    userId,
    scope: { userId, workspaceId, ventureId } satisfies FrigoraScope,
    service: createFrigoraService({
      store,
      permissions: createPermissionService(createDbMembershipStore()),
      now: options.now,
      mail: options.mail ?? { verifiedDomains: ["quotes.example"], env: {} },
    }),
  };
}

async function seedSentQuotation(owner: Awaited<ReturnType<typeof seed>>) {
  const attendeeId = "user-attendee" as UserId;
  await getPersistence().memberships.setRole({
    userId: attendeeId,
    workspaceId: owner.workspaceId,
    role: "member",
    createdAt: NOW,
  });
  const customer = await owner.service.createCustomer(owner.scope, {
    code: "FUELCO",
    displayName: "FuelCo",
  });
  const site = await owner.service.createSite(owner.scope, {
    customerId: customer.id,
    code: "SANDTON-N",
    name: "Sandton North",
  });
  const asset = await owner.service.createAsset(owner.scope, {
    siteId: site.id,
    tag: "EVAP-01",
    name: "Evaporator",
  });
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

async function expectCode(run: () => Promise<unknown>, code: FrigoraError["code"]) {
  await assert.rejects(run, (error: unknown) => {
    assert.ok(error instanceof FrigoraError, String(error));
    assert.equal(error.code, code, error.message);
    return true;
  });
}

function databaseText() {
  const url = getDatabaseUrl();
  const path = url.startsWith("file:") ? url.slice("file:".length) : url;
  return [path, `${path}-wal`, `${path}-shm`]
    .filter((candidate) => existsSync(candidate))
    .map((candidate) => readFileSync(candidate));
}

async function assertSecretHidden(secret: string, officeValue: unknown) {
  assert.ok(secret.length > 20);
  assert.equal(JSON.stringify(officeValue).includes(secret), false);
  await getClient().execute("PRAGMA wal_checkpoint(TRUNCATE)");
  try {
    await getClient().execute("VACUUM");
  } catch {
    // A busy test connection can refuse VACUUM. The checkpoint still runs.
  }
  assert.equal(databaseText().some((bytes) => bytes.includes(Buffer.from(secret))), false);
}

async function assertAuditHides(secret: string) {
  const audits = await getClient().execute("SELECT action, metadata_json FROM audit_events");
  assert.equal(audits.rows.some((row) => String(row.metadata_json).includes(secret)), false);
  assert.equal(audits.rows.some((row) => String(row.action).includes(secret)), false);
}

async function captureLogs<T>(run: () => Promise<T>) {
  const lines: string[] = [];
  const log = console.log;
  const error = console.error;
  console.log = (...args: unknown[]) => {
    lines.push(args.map(String).join(" "));
  };
  console.error = (...args: unknown[]) => {
    lines.push(args.map(String).join(" "));
  };
  try {
    return { value: await run(), lines };
  } finally {
    console.log = log;
    console.error = error;
  }
}

describe("Frigora customer contacts and venture mail", () => {
  it("creates, designates, changes, and revokes a contact inside its tenant", async () => {
    let current = ISSUED_AT;
    const mail = fakeMail();
    const owner = await seed({ now: () => current, mail: mail.runtime });
    const { customer, site } = await seedSentQuotation(owner);
    const created = await owner.service.createCustomerContact(owner.scope, {
      customerId: customer.id,
      siteId: site.id,
      displayName: "Amina Naidoo",
      email: "Amina@FuelCo.Test",
    });
    assert.equal(created.email, "amina@fuelco.test");
    assert.equal(created.emailVerifiedAt, null);
    assert.equal(created.designation, null);
    assert.equal(created.status, "active");
    const designated = await owner.service.designateQuotationContact(owner.scope, created.id, { basis: BASIS });
    assert.equal(designated.designation?.designatedByUserId, owner.userId);
    assert.equal(designated.designation?.basis, BASIS);
    assert.equal(designated.designation?.revokedAt, null);
    assert.equal(designated.emailVerifiedAt, null);
    const audits = await getClient().execute(
      "SELECT metadata_json FROM audit_events WHERE action = 'frigora.customer_contact.designated'",
    );
    assert.match(String(audits.rows[0]?.metadata_json), /Amina|basis|amina@fuelco.test|Office recorded/);
    assert.match(String(audits.rows[0]?.metadata_json), new RegExp(created.id));
    current = "2026-10-24T13:00:00.000Z";
    const changed = await owner.service.updateCustomerContact(owner.scope, created.id, {
      displayName: "Amina N.",
      email: "accounts@fuelco.test",
    });
    assert.equal(changed.emailVerifiedAt, null);
    assert.equal(changed.designation?.revokedAt, null);
    const revokedDesignation = await owner.service.revokeQuotationContactDesignation(owner.scope, created.id);
    assert.equal(typeof revokedDesignation.designation?.revokedAt, "string");
    assert.equal(revokedDesignation.designation?.revokedByUserId, owner.userId);
    const revoked = await owner.service.revokeCustomerContact(owner.scope, created.id);
    assert.equal(revoked.status, "revoked");
    await expectCode(
      () => owner.service.designateQuotationContact(owner.scope, created.id, { basis: BASIS }),
      "not_found",
    );
    await expectCode(
      () => owner.service.createCustomerContact(owner.scope, {
        customerId: customer.id,
        siteId: site.id,
        displayName: "Duplicate",
        email: "accounts@fuelco.test",
      }),
      "duplicate",
    );
  });

  it("refuses contact changes from a member and from another tenant", async () => {
    const owner = await seed();
    const { customer, site } = await seedSentQuotation(owner);
    const contact = await owner.service.createCustomerContact(owner.scope, {
      customerId: customer.id,
      siteId: site.id,
      displayName: "Amina Naidoo",
      email: "amina@fuelco.test",
    });
    const member = await seed({
      reset: false,
      userId: "user-member" as UserId,
      role: "member",
    });
    await expectCode(
      () => member.service.createCustomerContact(member.scope, {
        customerId: customer.id,
        siteId: site.id,
        displayName: "Other",
        email: "other@fuelco.test",
      }),
      "forbidden",
    );
    const other = await seed({
      reset: false,
      workspaceId: "ws-other" as WorkspaceId,
      ventureId: "ven-other" as VentureId,
      userId: "user-other" as UserId,
    });
    assert.equal(await other.service.getCustomerContact(other.scope, contact.id), null);
    await expectCode(
      () => other.service.designateQuotationContact(other.scope, contact.id, { basis: BASIS }),
      "not_found",
    );
    await expectCode(
      () => owner.service.createCustomerContact(owner.scope, {
        customerId: "customer-missing",
        siteId: site.id,
        displayName: "Nobody",
        email: "nobody@fuelco.test",
      }),
      "not_found",
    );
  });

  it("verifies a mailbox once and rejects invalid, expired, revoked, and replayed challenges", async () => {
    let current = ISSUED_AT;
    const mail = fakeMail();
    const owner = await seed({ now: () => current, mail: mail.runtime });
    const { customer, site } = await seedSentQuotation(owner);
    await owner.service.setVentureMailIdentity(owner.scope, {
      fromName: "Frigora Quotes",
      fromEmail: "quotes@quotes.example",
    });
    const contact = await owner.service.createCustomerContact(owner.scope, {
      customerId: customer.id,
      siteId: site.id,
      displayName: "Amina Naidoo",
      email: "amina@fuelco.test",
    });
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => {
      throw new Error("live mail is not allowed in tests");
    };
    let first: Awaited<ReturnType<typeof owner.service.requestCustomerContactVerification>>;
    try {
      const captured = await captureLogs(() => owner.service.requestCustomerContactVerification(owner.scope, contact.id));
      first = captured.value;
      const secret = codeFrom(mail.messages[0]);
      await assertSecretHidden(secret, first);
      assert.equal(captured.lines.some((line) => line.includes(secret)), false);
      assert.equal(mail.messages[0]?.from, "Frigora Quotes <quotes@quotes.example>");
      assert.equal(mail.messages[0]?.subject.includes(secret), false);
      assert.equal(first.outcome, "accepted_by_provider");
      await expectCode(
        () => owner.service.confirmCustomerContactEmail(owner.scope, {
          challengeId: first.challengeId,
          secret: "not-the-mailbox-secret",
        }),
        "invalid_input",
      );
      current = first.expiresAt;
      await expectCode(
        () => owner.service.confirmCustomerContactEmail(owner.scope, {
          challengeId: first.challengeId,
          secret,
        }),
        "invalid_status",
      );
      current = ISSUED_AT;
      const second = await owner.service.requestCustomerContactVerification(owner.scope, contact.id);
      const replacement = codeFrom(mail.messages[1]);
      await expectCode(
        () => owner.service.confirmCustomerContactEmail(owner.scope, {
          challengeId: first.challengeId,
          secret,
        }),
        "invalid_status",
      );
      const verified = await owner.service.confirmCustomerContactEmail(owner.scope, {
        challengeId: second.challengeId,
        secret: replacement,
      });
      assert.equal(verified.emailVerifiedAt, ISSUED_AT);
      assert.equal(verified.designation, null);
      await expectCode(
        () => owner.service.confirmCustomerContactEmail(owner.scope, {
          challengeId: second.challengeId,
          secret: replacement,
        }),
        "invalid_status",
      );
      const changed = await owner.service.updateCustomerContact(owner.scope, contact.id, {
        displayName: "Amina Naidoo",
        email: "new-amina@fuelco.test",
      });
      assert.equal(changed.email, "new-amina@fuelco.test");
      assert.equal(changed.emailVerifiedAt, null);
      await assertSecretHidden(secret, verified);
      await assertSecretHidden(replacement, second);
      await assertAuditHides(secret);
      await assertAuditHides(replacement);
    } finally {
      globalThis.fetch = originalFetch;
    }
    assert.equal(takeAuthMailOutbox().length, 0);
  });

  it("accepts only one concurrent confirmation of the same challenge", async () => {
    const mail = fakeMail();
    const owner = await seed({ now: () => ISSUED_AT, mail: mail.runtime });
    const { customer, site } = await seedSentQuotation(owner);
    await owner.service.setVentureMailIdentity(owner.scope, {
      fromName: "Frigora Quotes",
      fromEmail: "quotes@quotes.example",
    });
    const contact = await owner.service.createCustomerContact(owner.scope, {
      customerId: customer.id,
      siteId: site.id,
      displayName: "Amina Naidoo",
      email: "amina@fuelco.test",
    });
    const dispatch = await owner.service.requestCustomerContactVerification(owner.scope, contact.id);
    const secret = codeFrom(mail.messages[0]);
    const [left, right] = await Promise.allSettled([
      owner.service.confirmCustomerContactEmail(owner.scope, { challengeId: dispatch.challengeId, secret }),
      owner.service.confirmCustomerContactEmail(owner.scope, { challengeId: dispatch.challengeId, secret }),
    ]);
    assert.equal([left, right].filter((result) => result.status === "fulfilled").length, 1);
    const stored = await owner.service.getCustomerContact(owner.scope, contact.id);
    assert.equal(stored?.emailVerifiedAt, ISSUED_AT);
  });

  it("delivers a decision grant only to a verified designated contact for that quotation", async () => {
    const mail = fakeMail();
    const owner = await seed({ now: () => ISSUED_AT, mail: mail.runtime });
    const { customer, site, sent } = await seedSentQuotation(owner);
    await owner.service.setVentureMailIdentity(owner.scope, {
      fromName: "Frigora Quotes",
      fromEmail: "quotes@quotes.example",
    });
    const contact = await owner.service.createCustomerContact(owner.scope, {
      customerId: customer.id,
      siteId: site.id,
      displayName: "Amina Naidoo",
      email: "amina@fuelco.test",
    });
    await expectCode(
      () => owner.service.deliverQuotationDecisionGrant(owner.scope, sent.id, {
        expectedCurrentVersion: 1,
        contactId: contact.id,
      }),
      "decision_rejected",
    );
    await owner.service.designateQuotationContact(owner.scope, contact.id, { basis: BASIS });
    await expectCode(
      () => owner.service.deliverQuotationDecisionGrant(owner.scope, sent.id, {
        expectedCurrentVersion: 1,
        contactId: contact.id,
      }),
      "decision_rejected",
    );
    assert.equal(mail.messages.length, 0);
    const dispatch = await owner.service.requestCustomerContactVerification(owner.scope, contact.id);
    await owner.service.confirmCustomerContactEmail(owner.scope, {
      challengeId: dispatch.challengeId,
      secret: codeFrom(mail.messages[0]),
    });
    const otherSite = await owner.service.createSite(owner.scope, {
      customerId: customer.id,
      code: "SANDTON-S",
      name: "Sandton South",
    });
    const otherContact = await owner.service.createCustomerContact(owner.scope, {
      customerId: customer.id,
      siteId: otherSite.id,
      displayName: "South Office",
      email: "south@fuelco.test",
    });
    await owner.service.designateQuotationContact(owner.scope, otherContact.id, { basis: BASIS });
    const otherDispatch = await owner.service.requestCustomerContactVerification(owner.scope, otherContact.id);
    await owner.service.confirmCustomerContactEmail(owner.scope, {
      challengeId: otherDispatch.challengeId,
      secret: codeFrom(mail.messages.at(-1)),
    });
    await expectCode(
      () => owner.service.deliverQuotationDecisionGrant(owner.scope, sent.id, {
        expectedCurrentVersion: 1,
        contactId: otherContact.id,
      }),
      "decision_rejected",
    );
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => {
      throw new Error("live mail is not allowed in tests");
    };
    try {
      const captured = await captureLogs(() => owner.service.deliverQuotationDecisionGrant(owner.scope, sent.id, {
        expectedCurrentVersion: 1,
        contactId: contact.id,
      }));
      const result = captured.value;
      const secret = codeFrom(mail.messages.at(-1));
      assert.equal(result.outcome, "accepted_by_provider");
      assert.equal(result.providerMessageId.startsWith("provider-"), true);
      assert.equal(JSON.stringify(result).includes("delivered"), false);
      await assertSecretHidden(secret, result);
      assert.equal(captured.lines.some((line) => line.includes(secret)), false);
      assert.equal(mail.messages.at(-1)?.subject.includes(secret), false);
      assert.equal(mail.messages.at(-1)?.from.includes("VentureOS"), false);
      const grants = await getClient().execute(
        "SELECT contact_id, document_hash, revoked_at, secret_hash FROM frigora_quotation_decision_grants",
      );
      assert.equal(grants.rows.at(-1)?.contact_id, contact.id);
      assert.equal(grants.rows.at(-1)?.revoked_at, null);
      assert.equal(grants.rows.at(-1)?.document_hash, quotationDocumentHash({
        version: 1,
        description: "Replace compressor",
        ...priceQuotationCommercial(exampleQuotationCommercial()),
      }));
      assert.notEqual(grants.rows.at(-1)?.secret_hash, secret);
      await assertAuditHides(secret);
      const approved = await owner.service.submitQuotationDecision(owner.scope, sent.id, {
        grantId: result.grantId,
        secret,
        decision: "approved",
        customerId: customer.id,
        siteId: site.id,
      });
      assert.equal(approved.versions[0]?.status, "approved");
      assert.equal(approved.versions[0]?.documentHash, grants.rows.at(-1)?.document_hash);
      await expectCode(
        () => owner.service.submitQuotationDecision(owner.scope, sent.id, {
          grantId: result.grantId,
          secret,
          decision: "approved",
          customerId: customer.id,
          siteId: site.id,
        }),
        "decision_rejected",
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
    assert.equal(takeAuthMailOutbox().length, 0);
  });

  it("revokes a grant when provider acceptance is rejected or unknown", async () => {
    for (const outcome of ["rejected", "unknown"] as const) {
      await resetPersistenceLifecycle();
      await ensureSchema();
      const mail = fakeMail(outcome);
      const owner = await seed({ reset: false, now: () => ISSUED_AT, mail: mail.runtime });
      const { customer, site, sent } = await seedSentQuotation(owner);
      await owner.service.setVentureMailIdentity(owner.scope, {
        fromName: "Frigora Quotes",
        fromEmail: "quotes@quotes.example",
      });
      const contact = await readyContact(owner, mail.messages, customer.id, site.id);
      await assert.rejects(
        () => owner.service.deliverQuotationDecisionGrant(owner.scope, sent.id, {
          expectedCurrentVersion: 1,
          contactId: contact,
        }),
        (error: unknown) => {
          assert.ok(error instanceof FrigoraError);
          assert.equal(error.code, outcome === "rejected" ? "delivery_failed" : "delivery_unknown");
          if (outcome === "rejected") {
            assert.match(error.message, /is revoked/);
            assert.match(error.message, /failure record was saved/);
          } else {
            assert.match(error.message, /same decision grant/);
            assert.match(error.message, /not sent again/);
          }
          assert.match(error.message, /not inbox delivery/);
          return true;
        },
      );
      const grants = await getClient().execute(
        "SELECT id, revoked_at, consumed_at FROM frigora_quotation_decision_grants",
      );
      assert.equal(grants.rows.length, 1);
      if (outcome === "rejected") {
        assert.equal(typeof grants.rows[0]?.revoked_at, "string");
      } else {
        assert.equal(grants.rows[0]?.revoked_at, null);
      }
      assert.equal(grants.rows[0]?.consumed_at, null);
      const secret = codeFrom(mail.messages.at(-1));
      if (outcome === "rejected") {
        await expectCode(
          () => owner.service.submitQuotationDecision(owner.scope, sent.id, {
            grantId: String(grants.rows[0]?.id),
            secret,
            decision: "declined",
            customerId: customer.id,
            siteId: site.id,
          }),
          "decision_rejected",
        );
      } else {
        const before = mail.messages.length;
        await assert.rejects(
          () => owner.service.deliverQuotationDecisionGrant(owner.scope, sent.id, {
            expectedCurrentVersion: 1,
            contactId: contact,
          }),
          (error: unknown) => error instanceof FrigoraError && error.code === "delivery_unknown",
        );
        const again = await getClient().execute("SELECT id FROM frigora_quotation_decision_grants");
        assert.equal(again.rows.length, 1);
        assert.equal(mail.messages.length, before + 1);
        const keys = mail.messages.filter((message) => message.subject === "Quotation awaiting your decision");
        assert.equal(keys[0]?.idempotencyKey, keys[1]?.idempotencyKey);
      }
      const stored = await owner.service.getQuotation(owner.scope, sent.id);
      assert.equal(stored?.versions[0]?.status, "awaiting_customer_approval");
      assert.equal(stored?.decisions.length, 0);
      assert.equal(JSON.stringify({ outcome }).includes(secret), false);
      if (outcome === "unknown") {
        const payload = await getClient().execute(
          "SELECT id, payload_text, payload_fingerprint FROM frigora_quotation_customer_deliveries",
        );
        const stored = String(payload.rows[0]?.payload_text);
        assert.equal(stored.includes(secret), false);
        assert.match(plaintextFromStoredDeliveryPayload(stored, String(payload.rows[0]?.id), String(payload.rows[0]?.payload_fingerprint)), new RegExp(secret));
      } else {
        await assertSecretHidden(secret, { outcome });
      }
      await assertAuditHides(secret);
    }
  });

  it("does not describe provider acceptance as saved when the acceptance audit fails", async () => {
    const mail = fakeMail();
    const owner = await seed({ now: () => ISSUED_AT, mail: mail.runtime });
    const { customer, site, sent } = await seedSentQuotation(owner);
    await owner.service.setVentureMailIdentity(owner.scope, {
      fromName: "Frigora Quotes",
      fromEmail: "quotes@quotes.example",
    });
    const contact = await readyContact(owner, mail.messages, customer.id, site.id);
    await getClient().execute(`
      CREATE TRIGGER acceptance_audit_fail
      BEFORE INSERT ON audit_events
      WHEN NEW.action = 'frigora.quotation.decision_grant_accepted_by_provider'
      BEGIN
        SELECT RAISE(ABORT, 'forced acceptance audit failure');
      END
    `);
    const before = mail.messages.length;
    await assert.rejects(
      () => owner.service.deliverQuotationDecisionGrant(owner.scope, sent.id, {
        expectedCurrentVersion: 1,
        contactId: contact,
      }),
      (error: unknown) => {
        assert.ok(error instanceof FrigoraError);
        assert.equal(error.code, "customer_delivery_unavailable");
        assert.match(error.message, /accepted the message/);
        assert.match(error.message, /not inbox delivery/);
        assert.match(error.message, /Do not send it again/);
        return true;
      },
    );
    assert.equal(mail.messages.length, before + 1);
    const grants = await getClient().execute("SELECT revoked_at FROM frigora_quotation_decision_grants");
    assert.equal(grants.rows.length, 1);
    assert.equal(grants.rows[0]?.revoked_at, null);
  });

  it("keeps a thrown verification rejection distinct and revokes the unused secret", async () => {
    const owner = await seed({
      now: () => ISSUED_AT,
      mail: {
        verifiedDomains: ["quotes.example"],
        publicOrigin: "https://quotes.example",
        env: {},
        provider: {
          async send() {
            throw new FrigoraMailDeliveryError("rejected");
          },
        },
      },
    });
    const { customer, site } = await seedSentQuotation(owner);
    await owner.service.setVentureMailIdentity(owner.scope, {
      fromName: "Frigora Quotes",
      fromEmail: "quotes@quotes.example",
    });
    const contact = await owner.service.createCustomerContact(owner.scope, {
      customerId: customer.id,
      siteId: site.id,
      displayName: "Amina Naidoo",
      email: "amina@fuelco.test",
    });
    await assert.rejects(
      () => owner.service.requestCustomerContactVerification(owner.scope, contact.id),
      (error: unknown) => {
        assert.ok(error instanceof FrigoraError);
        assert.equal(error.code, "delivery_failed");
        assert.match(error.message, /rejected the message/);
        assert.match(error.message, /is revoked/);
        assert.match(error.message, /not inbox delivery/);
        assert.equal(/not sent again/.test(error.message), false);
        return true;
      },
    );
    const challenges = await getClient().execute(
      "SELECT revoked_at FROM frigora_contact_verification_challenges",
    );
    assert.equal(typeof challenges.rows[0]?.revoked_at, "string");
    const audits = await getClient().execute(
      "SELECT action FROM audit_events WHERE action = 'frigora.customer_contact.verification_dispatch_failed'",
    );
    assert.equal(audits.rows.length, 1);
  });

  it("fails closed without a verified venture sender and does not invent one", async () => {
    const owner = await seed({
      now: () => ISSUED_AT,
      mail: { verifiedDomains: [], env: {} },
    });
    const { customer, site, sent } = await seedSentQuotation(owner);
    const contact = await owner.service.createCustomerContact(owner.scope, {
      customerId: customer.id,
      siteId: site.id,
      displayName: "Amina Naidoo",
      email: "amina@fuelco.test",
    });
    await expectCode(
      () => owner.service.setVentureMailIdentity(owner.scope, {
        fromName: "VentureOS",
        fromEmail: "noreply@localhost",
      }),
      "mail_not_configured",
    );
    await expectCode(
      () => owner.service.deliverQuotationDecisionGrant(owner.scope, sent.id, {
        expectedCurrentVersion: 1,
        contactId: contact.id,
      }),
      "mail_not_configured",
    );
    const configured = await seed({
      reset: false,
      now: () => ISSUED_AT,
      mail: { verifiedDomains: ["quotes.example"], env: {} },
    });
    await expectCode(
      () => configured.service.setVentureMailIdentity(configured.scope, {
        fromName: "Frigora Quotes",
        fromEmail: "quotes@unverified.example",
      }),
      "mail_not_configured",
    );
    const grants = await getClient().execute("SELECT id FROM frigora_quotation_decision_grants");
    assert.equal(grants.rows.length, 0);
    const identities = await getClient().execute("SELECT from_email FROM frigora_venture_mail_identities");
    assert.equal(identities.rows.length, 0);
  });

  it("adds grant revocation columns without dropping an existing grant row", async () => {
    const directory = await mkdtemp(join(tmpdir(), "frigora-contact-mail-"));
    const url = `file:${join(directory, "grants.db").replaceAll("\\", "/")}`;
    try {
      await resetPersistenceLifecycle(url);
      await ensureSchema();
      await getClient().execute(`
        INSERT INTO frigora_quotation_decision_grants (
          id, secret_hash, quotation_id, workspace_id, venture_id, customer_id, site_id,
          version_number, document_hash, expires_at, issued_at, issued_by_user_id,
          consumed_at, decision_id, revoked_at, contact_id
        ) VALUES (
          'grant-keep', 'hash-keep', 'quote-keep', 'ws-frigora', 'ven-frigora', 'customer-keep', 'site-keep',
          1, 'hash-doc', '2026-10-31T12:00:00.000Z', '2026-10-24T12:00:00.000Z', 'user-owner',
          NULL, NULL, NULL, NULL
        )
      `);
      await getClient().execute("DROP TRIGGER IF EXISTS frigora_quotation_decision_grants_consume_only");
      await getClient().execute(`
        CREATE TABLE frigora_quotation_decision_grants_old (
          id TEXT PRIMARY KEY,
          secret_hash TEXT NOT NULL UNIQUE,
          quotation_id TEXT NOT NULL,
          workspace_id TEXT NOT NULL,
          venture_id TEXT NOT NULL,
          customer_id TEXT NOT NULL,
          site_id TEXT NOT NULL,
          version_number INTEGER NOT NULL,
          document_hash TEXT NOT NULL,
          expires_at TEXT NOT NULL,
          issued_at TEXT NOT NULL,
          issued_by_user_id TEXT NOT NULL,
          consumed_at TEXT,
          decision_id TEXT
        )
      `);
      await getClient().execute(`
        INSERT INTO frigora_quotation_decision_grants_old (
          id, secret_hash, quotation_id, workspace_id, venture_id, customer_id, site_id,
          version_number, document_hash, expires_at, issued_at, issued_by_user_id, consumed_at, decision_id
        )
        SELECT id, secret_hash, quotation_id, workspace_id, venture_id, customer_id, site_id,
               version_number, document_hash, expires_at, issued_at, issued_by_user_id, consumed_at, decision_id
        FROM frigora_quotation_decision_grants
      `);
      await getClient().execute("DROP TABLE frigora_quotation_decision_grants");
      await getClient().execute(
        "ALTER TABLE frigora_quotation_decision_grants_old RENAME TO frigora_quotation_decision_grants",
      );
      await resetDatabaseLifecycle(url);
      await ensureSchema();
      const columns = await getClient().execute("PRAGMA table_info(frigora_quotation_decision_grants)");
      assert.equal(columns.rows.some((row) => row.name === "revoked_at"), true);
      assert.equal(columns.rows.some((row) => row.name === "contact_id"), true);
      const kept = await getClient().execute(
        "SELECT secret_hash, revoked_at FROM frigora_quotation_decision_grants WHERE id = 'grant-keep'",
      );
      assert.equal(kept.rows[0]?.secret_hash, "hash-keep");
      assert.equal(kept.rows[0]?.revoked_at, null);
      await assert.rejects(
        () => withFrigoraWriteTransaction(async (transaction) => {
          await transaction.execute(`
            INSERT INTO frigora_customer_contacts (
              id, workspace_id, venture_id, customer_id, site_id, display_name, email,
              email_verified_at, status, created_by_user_id, created_at, updated_at
            ) VALUES (
              'contact-bad', 'ws-frigora', 'ven-frigora', 'customer-keep', 'site-keep', 'Bad', 'bad@fuelco.test',
              NULL, 'nope', 'user-owner', '2026-10-24T12:00:00.000Z', '2026-10-24T12:00:00.000Z'
            )
          `);
        }),
      );
      const contacts = await getClient().execute(
        "SELECT id FROM frigora_customer_contacts WHERE id = 'contact-bad'",
      );
      assert.equal(contacts.rows.length, 0);
    } finally {
      await resetPersistenceLifecycle();
      await rm(directory, { recursive: true, force: true }).catch(() => undefined);
    }
  });
});

async function readyContact(
  owner: Awaited<ReturnType<typeof seed>>,
  messages: FrigoraMailMessage[],
  customerId: string,
  siteId: string,
) {
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
