import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { beforeEach, describe, it } from "node:test";
import type { UserId, VentureId, WorkspaceId } from "@/contracts";
import { createPermissionService } from "@/platform/permissions/service";
import { createDbMembershipStore } from "@/platform/permissions/membership-store";
import { ensureSchema, getClient, getDatabaseUrl } from "@/platform/persistence/db";
import { getPersistence, resetPersistenceLifecycle } from "@/platform/persistence/repositories";
import type { PersistedVenture } from "@/platform/persistence/repositories/ports";
import { FrigoraError } from "./errors";
import type { FrigoraMailMessage, FrigoraMailRuntime } from "./mail";
import { exampleQuotationCommercial } from "./quotation-commercial";
import { installQuotationDeliveryPayloadTestKeys } from "./quotation-delivery-payload";
import { createFrigoraService } from "./service";
import { createFrigoraStore } from "./store";
import { allowSyntheticNotRegisteredQuotationSend } from "./tax-configuration-fixture";
import { closeFrigoraPersistenceAfterFile } from "./test-persistence-lifecycle";
import type { FrigoraCustomerContact, FrigoraQuotationId, FrigoraScope } from "./types";

const NOW = "2026-10-24T08:00:00.000Z";
const ARRIVED = "2026-10-24T08:05:00.000Z";
const RECOMMENDED_AT = "2026-10-24T08:20:00.000Z";
const ISSUED_AT = "2026-10-24T12:00:00.000Z";
const BASIS = "Office confirmed this person may decide the quotation for this site.";
const GRANT_TTL_MS = 7 * 24 * 60 * 60 * 1000;

closeFrigoraPersistenceAfterFile();
installQuotationDeliveryPayloadTestKeys();

beforeEach(async () => {
  await resetPersistenceLifecycle();
  await ensureSchema();
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

function secretHash(secret: string) {
  return createHash("sha256").update(secret, "utf8").digest("hex");
}

function secretFrom(path: string) {
  return decodeURIComponent(path.split("#")[1] ?? "");
}

function codeFrom(message: FrigoraMailMessage | undefined) {
  const lines = message?.text.split("\n") ?? [];
  const index = lines.findIndex((line) => line === "Verification code:");
  return index >= 0 ? lines[index + 1] ?? "" : "";
}

function databaseText() {
  const url = getDatabaseUrl();
  const path = url.startsWith("file:") ? url.slice("file:".length) : url;
  return [path, `${path}-wal`, `${path}-shm`]
    .filter((candidate) => existsSync(candidate))
    .map((candidate) => readFileSync(candidate));
}

async function seed(options: { mail?: FrigoraMailRuntime } = {}) {
  const workspaceId = "ws-frigora" as WorkspaceId;
  const ventureId = "ven-frigora" as VentureId;
  const userId = "user-owner" as UserId;
  const persistence = getPersistence();
  if (!(await persistence.organisations.findById(workspaceId))) {
    await persistence.organisations.insert({
      id: workspaceId,
      name: "Frigora Workspace",
      slug: "ws-frigora",
      createdAt: NOW,
    });
  }
  await persistence.memberships.setRole({
    userId,
    workspaceId,
    role: "owner",
    createdAt: NOW,
  });
  if (!(await persistence.ventures.findById(ventureId))) {
    await persistence.ventures.insert(ventureRow());
  }
  const store = createFrigoraStore();
  const scope = { userId, workspaceId, ventureId } satisfies FrigoraScope;
  return {
    workspaceId,
    ventureId,
    userId,
    scope,
    service: createFrigoraService({
      store,
      permissions: createPermissionService(createDbMembershipStore()),
      now: () => ISSUED_AT,
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

async function ready(options: { mail?: FrigoraMailRuntime } = {}) {
  const owner = await seed(options);
  const seeded = await seedSentQuotation(owner);
  const contact = await owner.service.createQuotationCustomerContact(owner.scope, seeded.sent.id, {
    displayName: "Ada Approver",
    email: "ada@fuelco.test",
  });
  return { ...owner, ...seeded, contact };
}

async function supervise(
  owner: Awaited<ReturnType<typeof ready>>,
  contact: FrigoraCustomerContact,
  quotationId: FrigoraQuotationId,
) {
  return owner.service.recordSupervisedContactVerification(owner.scope, quotationId, contact.id, {
    method: "telephone",
    evidenceNote: "Called the accounts desk",
  });
}

async function designate(owner: Awaited<ReturnType<typeof ready>>, contact: FrigoraCustomerContact, basis = BASIS) {
  return owner.service.designateQuotationContact(owner.scope, contact.id, { basis });
}

async function quotationGrants(quotationId: string) {
  const result = await getClient().execute({
    sql: `
      SELECT id, contact_id, secret_hash, consumed_at, revoked_at, version_number, document_hash, expires_at
      FROM frigora_quotation_decision_grants
      WHERE quotation_id = ?
      ORDER BY issued_at, id
    `,
    args: [quotationId],
  });
  return result.rows;
}

async function decisionRows(quotationId: string) {
  const result = await getClient().execute({
    sql: `
      SELECT decision, version_number, document_hash, grant_id
      FROM frigora_quotation_decisions
      WHERE quotation_id = ?
    `,
    args: [quotationId],
  });
  return result.rows;
}

function usableGrants(rows: Awaited<ReturnType<typeof quotationGrants>>) {
  return rows.filter((row) => row.revoked_at == null && row.consumed_at == null);
}

describe("atomic customer decision-grant eligibility", () => {
  it("revokes a grant created by activation when designation authority changes afterwards", async () => {
    const office = await ready();
    await supervise(office, office.contact, office.sent.id);
    await designate(office, office.contact);
    const activated = await office.service.activateQuotationCustomerAccess(office.scope, office.sent.id, {
      expectedCurrentVersion: 1,
    });
    const secret = secretFrom(activated.testOnlyPath);
    const quotation = await office.service.getQuotation(office.scope, office.sent.id);
    const version = quotation?.versions.find((item) => item.version === 1);
    const created = await quotationGrants(office.sent.id);
    assert.equal(created.length, 1);
    assert.equal(created[0]?.contact_id, office.contact.id);
    assert.equal(created[0]?.revoked_at, null);
    assert.equal(created[0]?.consumed_at, null);
    assert.equal(String(created[0]?.secret_hash), secretHash(secret));
    assert.notEqual(String(created[0]?.secret_hash), secret);
    assert.equal(Number(created[0]?.version_number), 1);
    assert.equal(String(created[0]?.document_hash), version?.documentHash);
    assert.equal(Date.parse(String(created[0]?.expires_at)) - Date.parse(ISSUED_AT), GRANT_TTL_MS);
    assert.equal(databaseText().some((bytes) => bytes.includes(Buffer.from(secret))), false);
    const audits = await getClient().execute(
      "SELECT metadata_json FROM audit_events WHERE action = 'frigora.quotation.customer_access_prepared'",
    );
    assert.equal(audits.rows.some((row) => String(row.metadata_json).includes(secret)), false);

    await office.service.revokeQuotationContactDesignation(office.scope, office.contact.id);
    const revoked = await quotationGrants(office.sent.id);
    assert.equal(revoked.length, 1);
    assert.equal(revoked[0]?.id, activated.grantId);
    assert.equal(revoked[0]?.consumed_at, null);
    assert.equal(typeof revoked[0]?.revoked_at, "string");
    assert.equal(usableGrants(revoked).length, 0);
    assert.equal(String(revoked[0]?.document_hash), version?.documentHash);
    const revocation = await getClient().execute(
      "SELECT metadata_json FROM audit_events WHERE action = 'frigora.quotation.customer_access_revoked'",
    );
    assert.match(String(revocation.rows[0]?.metadata_json), /designation_revoked/);
    assert.match(String(revocation.rows[0]?.metadata_json), new RegExp(activated.grantId));
  });

  it("creates no grant when supervised verification is revoked after the eligibility read", async () => {
    const office = await ready();
    const verification = await supervise(office, office.contact, office.sent.id);
    await designate(office, office.contact);
    let authorityCommitted = false;
    await assert.rejects(
      () => office.service.activateQuotationCustomerAccess(office.scope, office.sent.id, {
        expectedCurrentVersion: 1,
        beforeGuardedWrite: async () => {
          await office.service.revokeSupervisedContactVerification(
            office.scope,
            office.sent.id,
            office.contact.id,
          );
          const visible = await getClient().execute({
            sql: `
              SELECT revoked_at
              FROM frigora_contact_supervised_verifications
              WHERE id = ?
            `,
            args: [verification.id],
          });
          assert.equal(typeof visible.rows[0]?.revoked_at, "string");
          assert.equal((await quotationGrants(office.sent.id)).length, 0);
          authorityCommitted = true;
        },
      }),
      (error: unknown) => error instanceof FrigoraError
        && error.code === "decision_rejected"
        && /exactly one active designated contact/.test(error.message),
    );
    assert.equal(authorityCommitted, true);
    const grants = await quotationGrants(office.sent.id);
    assert.equal(grants.length, 0);
    assert.equal(usableGrants(grants).length, 0);
    const contact = await office.service.getCustomerContact(office.scope, office.contact.id);
    assert.equal(contact?.status, "active");
    assert.equal(contact?.designation?.revokedAt, null);
    assert.equal(contact?.emailVerifiedAt, null);
  });

  it("creates no grant for the stale designation when another eligible contact is designated before insert", async () => {
    const office = await ready();
    await supervise(office, office.contact, office.sent.id);
    await designate(office, office.contact);
    let authorityCommitted = false;
    await assert.rejects(
      () => office.service.activateQuotationCustomerAccess(office.scope, office.sent.id, {
        expectedCurrentVersion: 1,
        beforeGuardedWrite: async () => {
          const replacement = await office.service.createQuotationCustomerContact(office.scope, office.sent.id, {
            displayName: "Ben Approver",
            email: "ben@fuelco.test",
          });
          await supervise(office, replacement, office.sent.id);
          await designate(office, replacement, "Office replaced the designated approver before the link was issued.");
          const visible = await getClient().execute({
            sql: `
              SELECT c.id
              FROM frigora_customer_contacts c
              INNER JOIN frigora_quotation_contact_designations d
                ON d.contact_id = c.id
               AND d.workspace_id = c.workspace_id
               AND d.venture_id = c.venture_id
               AND d.revoked_at IS NULL
              WHERE c.workspace_id = ?
                AND c.venture_id = ?
                AND c.customer_id = ?
                AND c.site_id = ?
                AND c.status = 'active'
                AND (
                  c.email_verified_at IS NOT NULL
                  OR EXISTS (
                    SELECT 1
                    FROM frigora_contact_supervised_verifications s
                    WHERE s.contact_id = c.id
                      AND s.workspace_id = c.workspace_id
                      AND s.venture_id = c.venture_id
                      AND s.revoked_at IS NULL
                  )
                )
            `,
            args: [office.workspaceId, office.ventureId, office.customer.id, office.site.id],
          });
          assert.equal(visible.rows.length, 2);
          assert.equal((await quotationGrants(office.sent.id)).length, 0);
          authorityCommitted = true;
        },
      }),
      (error: unknown) => error instanceof FrigoraError && error.code === "decision_rejected",
    );
    assert.equal(authorityCommitted, true);
    const grants = await quotationGrants(office.sent.id);
    assert.equal(grants.length, 0);
    assert.equal(grants.some((row) => row.contact_id === office.contact.id), false);
    assert.equal(usableGrants(grants).length, 0);
  });

  it("creates no grant when the contact is revoked after the eligibility read", async () => {
    const office = await ready();
    await supervise(office, office.contact, office.sent.id);
    await designate(office, office.contact);
    let authorityCommitted = false;
    await assert.rejects(
      () => office.service.activateQuotationCustomerAccess(office.scope, office.sent.id, {
        expectedCurrentVersion: 1,
        beforeGuardedWrite: async () => {
          await office.service.revokeCustomerContact(office.scope, office.contact.id);
          const visible = await getClient().execute({
            sql: `SELECT status FROM frigora_customer_contacts WHERE id = ?`,
            args: [office.contact.id],
          });
          assert.equal(String(visible.rows[0]?.status), "revoked");
          assert.equal((await quotationGrants(office.sent.id)).length, 0);
          authorityCommitted = true;
        },
      }),
      (error: unknown) => error instanceof FrigoraError && error.code === "decision_rejected",
    );
    assert.equal(authorityCommitted, true);
    const grants = await quotationGrants(office.sent.id);
    assert.equal(grants.length, 0);
    assert.equal(usableGrants(grants).length, 0);
    const contact = await office.service.getCustomerContact(office.scope, office.contact.id);
    assert.equal(contact?.status, "revoked");
  });

  it("does not create a grant or call the provider when mailbox authority changes before insert", async () => {
    const messages: FrigoraMailMessage[] = [];
    let decisionSends = 0;
    const office = await ready({
      mail: {
        verifiedDomains: ["quotes.example"],
        publicOrigin: "https://quotes.example",
        env: {},
        provider: {
          async send(message) {
            messages.push(message);
            if (message.subject === "Quotation awaiting your decision") {
              decisionSends += 1;
              throw new Error("provider must not be called");
            }
            return { outcome: "accepted_by_provider", providerMessageId: `provider-${messages.length}` };
          },
        },
      },
    });
    await office.service.setVentureMailIdentity(office.scope, {
      fromName: "Frigora Quotes",
      fromEmail: "quotes@quotes.example",
    });
    const dispatch = await office.service.requestCustomerContactVerification(office.scope, office.contact.id);
    await office.service.confirmCustomerContactEmail(office.scope, {
      challengeId: dispatch.challengeId,
      secret: codeFrom(messages[0]),
    });
    await designate(office, office.contact);
    const verified = await office.service.getCustomerContact(office.scope, office.contact.id);
    assert.equal(typeof verified?.emailVerifiedAt, "string");
    let authorityCommitted = false;
    await assert.rejects(
      () => office.service.deliverQuotationDecisionGrant(
        office.scope,
        office.sent.id,
        { expectedCurrentVersion: 1, contactId: office.contact.id },
        async () => {
          await office.service.updateQuotationCustomerContact(office.scope, office.sent.id, office.contact.id, {
            displayName: "Ada Approver",
            email: "ada.replaced@fuelco.test",
          });
          const visible = await getClient().execute({
            sql: `SELECT email, email_verified_at FROM frigora_customer_contacts WHERE id = ?`,
            args: [office.contact.id],
          });
          assert.equal(String(visible.rows[0]?.email), "ada.replaced@fuelco.test");
          assert.equal(visible.rows[0]?.email_verified_at, null);
          assert.equal((await quotationGrants(office.sent.id)).length, 0);
          authorityCommitted = true;
        },
      ),
      (error: unknown) => error instanceof FrigoraError
        && error.code === "decision_rejected"
        && /email is not verified/.test(error.message),
    );
    assert.equal(authorityCommitted, true);
    assert.equal(decisionSends, 0);
    const grants = await quotationGrants(office.sent.id);
    assert.equal(grants.length, 0);
    assert.equal(usableGrants(grants).length, 0);
  });

  it("rejects live email for a supervised contact who has no mailbox verification", async () => {
    let sends = 0;
    const office = await ready({
      mail: {
        verifiedDomains: ["quotes.example"],
        publicOrigin: "https://quotes.example",
        env: {},
        provider: {
          async send() {
            sends += 1;
            return { outcome: "accepted_by_provider", providerMessageId: "provider-1" };
          },
        },
      },
    });
    await office.service.setVentureMailIdentity(office.scope, {
      fromName: "Frigora Quotes",
      fromEmail: "quotes@quotes.example",
    });
    await supervise(office, office.contact, office.sent.id);
    await designate(office, office.contact);
    const activated = await office.service.activateQuotationCustomerAccess(office.scope, office.sent.id, {
      expectedCurrentVersion: 1,
    });
    await assert.rejects(
      () => office.service.deliverQuotationDecisionGrant(office.scope, office.sent.id, {
        expectedCurrentVersion: 1,
        contactId: office.contact.id,
      }),
      (error: unknown) => error instanceof FrigoraError
        && error.code === "decision_rejected"
        && /email is not verified/.test(error.message),
    );
    assert.equal(sends, 0);
    const grants = await quotationGrants(office.sent.id);
    assert.equal(grants.length, 1);
    assert.equal(grants[0]?.id, activated.grantId);
    assert.equal(grants[0]?.contact_id, office.contact.id);
    assert.equal(usableGrants(grants).length, 1);
    const contact = await office.service.getCustomerContact(office.scope, office.contact.id);
    assert.equal(contact?.emailVerifiedAt, null);
  });

  it("rolls the contact change and grant revocation back together when revocation cannot be written", async () => {
    const office = await ready();
    await supervise(office, office.contact, office.sent.id);
    await designate(office, office.contact);
    const activated = await office.service.activateQuotationCustomerAccess(office.scope, office.sent.id, {
      expectedCurrentVersion: 1,
    });
    await getClient().execute(`
      CREATE TRIGGER test_block_outstanding_grant_revoke
      BEFORE UPDATE ON frigora_quotation_decision_grants
      WHEN OLD.revoked_at IS NULL AND NEW.revoked_at IS NOT NULL
      BEGIN
        SELECT RAISE(ABORT, 'grant revocation blocked');
      END
    `);
    try {
      await assert.rejects(
        () => office.service.updateQuotationCustomerContact(office.scope, office.sent.id, office.contact.id, {
          displayName: "Changed Name",
          email: "ada@fuelco.test",
        }),
        /grant revocation blocked/,
      );
      const contact = await office.service.getCustomerContact(office.scope, office.contact.id);
      assert.equal(contact?.displayName, "Ada Approver");
      const grants = await quotationGrants(office.sent.id);
      assert.equal(grants.length, 1);
      assert.equal(grants[0]?.id, activated.grantId);
      assert.equal(grants[0]?.revoked_at, null);
      assert.equal(grants[0]?.consumed_at, null);
    } finally {
      await getClient().execute("DROP TRIGGER IF EXISTS test_block_outstanding_grant_revoke");
    }
  });

  it("preserves a consumed decision and its document hash when an outstanding grant is revoked", async () => {
    const office = await ready();
    await supervise(office, office.contact, office.sent.id);
    await designate(office, office.contact);
    const first = await office.service.activateQuotationCustomerAccess(office.scope, office.sent.id, {
      expectedCurrentVersion: 1,
    });
    const second = await office.service.activateQuotationCustomerAccess(office.scope, office.sent.id, {
      expectedCurrentVersion: 1,
    });
    assert.notEqual(first.grantId, second.grantId);
    await office.service.submitCustomerQuotation({
      grantId: first.grantId,
      secret: secretFrom(first.testOnlyPath),
      decision: "approved",
    });
    const approved = await office.service.getQuotation(office.scope, office.sent.id);
    const approvedHash = approved?.versions.find((version) => version.version === 1)?.documentHash;
    assert.ok(approvedHash);
    await office.service.revokeSupervisedContactVerification(office.scope, office.sent.id, office.contact.id);
    const grants = await quotationGrants(office.sent.id);
    assert.equal(grants.length, 2);
    const consumed = grants.find((row) => row.id === first.grantId);
    const outstanding = grants.find((row) => row.id === second.grantId);
    assert.ok(consumed?.consumed_at);
    assert.equal(consumed?.revoked_at, null);
    assert.equal(String(consumed?.document_hash), approvedHash);
    assert.equal(outstanding?.consumed_at, null);
    assert.equal(typeof outstanding?.revoked_at, "string");
    const decisions = await decisionRows(office.sent.id);
    assert.equal(decisions.length, 1);
    assert.equal(String(decisions[0]?.decision), "approved");
    assert.equal(String(decisions[0]?.document_hash), approvedHash);
    assert.equal(String(decisions[0]?.grant_id), first.grantId);
  });

  it("still issues an unscoped grant without a customer contact", async () => {
    const office = await ready();
    let secret = "";
    const grant = await office.service.issueQuotationDecisionGrant(
      office.scope,
      office.sent.id,
      { expectedCurrentVersion: 1 },
      {
        async deliver(proof) {
          secret = proof.secret;
        },
      },
    );
    const grants = await quotationGrants(office.sent.id);
    assert.equal(grants.length, 1);
    assert.equal(grants[0]?.id, grant.id);
    assert.equal(grants[0]?.contact_id, null);
    assert.equal(String(grants[0]?.secret_hash), secretHash(secret));
    assert.equal(databaseText().some((bytes) => bytes.includes(Buffer.from(secret))), false);
    const contact = await office.service.getCustomerContact(office.scope, office.contact.id);
    assert.equal(contact?.emailVerifiedAt, null);
    assert.equal(contact?.designation, null);
  });
});
