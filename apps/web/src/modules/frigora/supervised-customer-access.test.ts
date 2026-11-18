import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, it } from "node:test";
import type { Role, UserId, VentureId, WorkspaceId } from "@/contracts";
import { createPermissionService } from "@/platform/permissions/service";
import { createDbMembershipStore } from "@/platform/permissions/membership-store";
import { ensureSchema, getClient } from "@/platform/persistence/db";
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

function codeFrom(message: FrigoraMailMessage | undefined) {
  const lines = message?.text.split("\n") ?? [];
  const index = lines.findIndex((line) => line === "Verification code:");
  return index >= 0 ? lines[index + 1] ?? "" : "";
}

async function seed(options: {
  userId?: UserId;
  role?: Role;
  now?: () => string;
  mail?: FrigoraMailRuntime;
} = {}) {
  const workspaceId = "ws-frigora" as WorkspaceId;
  const ventureId = "ven-frigora" as VentureId;
  const userId = (options.userId ?? "user-owner") as UserId;
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
    role: options.role ?? "owner",
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
    store,
    service: createFrigoraService({
      store,
      permissions: createPermissionService(createDbMembershipStore()),
      now: options.now ?? (() => ISSUED_AT),
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

async function ready() {
  const owner = await seed();
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
  method: "telephone" | "in_person" = "telephone",
) {
  return owner.service.recordSupervisedContactVerification(owner.scope, quotationId, contact.id, {
    method,
    evidenceNote: method === "telephone" ? "Called the accounts desk" : "Met the approver on site",
  });
}

async function designate(owner: Awaited<ReturnType<typeof ready>>, contact: FrigoraCustomerContact) {
  return owner.service.designateQuotationContact(owner.scope, contact.id, { basis: BASIS });
}

function secretFrom(path: string) {
  return decodeURIComponent(path.split("#")[1] ?? "");
}

async function grantRows(contactId: string) {
  const result = await getClient().execute({
    sql: `
      SELECT id, secret_hash, consumed_at, revoked_at, version_number, document_hash
      FROM frigora_quotation_decision_grants
      WHERE contact_id = ?
      ORDER BY issued_at, id
    `,
    args: [contactId],
  });
  return result.rows;
}

async function decisionRows(quotationId: string) {
  const result = await getClient().execute({
    sql: `
      SELECT decision, version_number, document_hash
      FROM frigora_quotation_decisions
      WHERE quotation_id = ?
    `,
    args: [quotationId],
  });
  return result.rows;
}

describe("supervised customer access", () => {
  it("stores telephone and in-person verification apart from mailbox verification", async () => {
    const index = await getClient().execute(
      "SELECT sql FROM sqlite_master WHERE name = 'frigora_contact_supervised_verifications_current_uidx'",
    );
    assert.match(String(index.rows[0]?.sql), /UNIQUE/);
    assert.match(String(index.rows[0]?.sql), /revoked_at IS NULL/);
    assert.match(
      readFileSync(join(process.cwd(), "src/platform/persistence/db.ts"), "utf8"),
      /SCHEMA_GENERATION = 40/,
    );

    const office = await ready();
    const telephone = await supervise(office, office.contact, office.sent.id, "telephone");
    assert.equal(telephone.method, "telephone");
    assert.equal(telephone.verifiedByUserId, office.userId);
    assert.equal(telephone.verifiedAt, ISSUED_AT);
    assert.equal(telephone.revokedAt, null);
    const afterTelephone = await office.service.getCustomerContact(office.scope, office.contact.id);
    assert.equal(afterTelephone?.emailVerifiedAt, null);

    await assert.rejects(
      () => supervise(office, office.contact, office.sent.id, "in_person"),
      (error: unknown) => error instanceof FrigoraError && error.code === "duplicate",
    );

    await office.service.revokeSupervisedContactVerification(office.scope, office.sent.id, office.contact.id);
    const inPerson = await supervise(office, office.contact, office.sent.id, "in_person");
    assert.equal(inPerson.method, "in_person");
    assert.equal(inPerson.verifiedByUserId, office.userId);
    const history = await office.store.listSupervisedVerifications(
      office.workspaceId,
      office.ventureId,
      office.contact.id,
    );
    assert.equal(history.length, 2);
    assert.equal(history.filter((row) => row.revokedAt == null).length, 1);
    assert.ok(history.some((row) => row.method === "telephone" && row.revokedAt != null));
    const stillUnverified = await office.service.getCustomerContact(office.scope, office.contact.id);
    assert.equal(stillUnverified?.emailVerifiedAt, null);

    const audits = await getClient().execute(
      "SELECT action, actor_user_id FROM audit_events WHERE action LIKE 'frigora.customer_contact.supervised_verification%'",
    );
    assert.ok(audits.rows.some((row) => row.action === "frigora.customer_contact.supervised_verification_recorded"));
    assert.ok(audits.rows.some((row) => row.action === "frigora.customer_contact.supervised_verification_revoked"));
    assert.ok(audits.rows.every((row) => row.actor_user_id === office.userId));
  });

  it("rejects a supervised verification for another venture and a reader without venture.update", async () => {
    const office = await ready();
    await assert.rejects(
      () => office.store.recordSupervisedVerification({
        id: "sv-foreign",
        contactId: office.contact.id,
        workspaceId: office.workspaceId,
        ventureId: "ven-other" as VentureId,
        method: "telephone",
        evidenceNote: "Called the accounts desk",
        actorUserId: office.userId,
        verifiedAt: ISSUED_AT,
      }),
      (error: unknown) => error instanceof FrigoraError && error.code === "not_found",
    );
    const reader = await seed({ userId: "user-reader" as UserId, role: "member" });
    await assert.rejects(
      () => reader.service.recordSupervisedContactVerification(reader.scope, office.sent.id, office.contact.id, {
        method: "telephone",
        evidenceNote: "Called the accounts desk",
      }),
      (error: unknown) => error instanceof FrigoraError && error.code === "forbidden",
    );
  });

  it("activates a test link for supervised verification or mailbox verification, and fails closed otherwise", async () => {
    const supervised = await ready();
    await assert.rejects(
      () => supervised.service.activateQuotationCustomerAccess(supervised.scope, supervised.sent.id, {
        expectedCurrentVersion: 1,
      }),
      /exactly one active designated contact/,
    );
    await supervise(supervised, supervised.contact, supervised.sent.id);
    await assert.rejects(
      () => supervised.service.activateQuotationCustomerAccess(supervised.scope, supervised.sent.id, {
        expectedCurrentVersion: 1,
      }),
      /exactly one active designated contact/,
    );
    await designate(supervised, supervised.contact);
    const activated = await supervised.service.activateQuotationCustomerAccess(
      supervised.scope,
      supervised.sent.id,
      { expectedCurrentVersion: 1 },
    );
    assert.match(activated.testOnlyPath, /^\/quotation-decision\//);
    assert.ok(secretFrom(activated.testOnlyPath).length > 20);
    const mailboxStillClear = await supervised.service.getCustomerContact(supervised.scope, supervised.contact.id);
    assert.equal(mailboxStillClear?.emailVerifiedAt, null);

    await supervised.service.revokeSupervisedContactVerification(
      supervised.scope,
      supervised.sent.id,
      supervised.contact.id,
    );
    await assert.rejects(
      () => supervised.service.activateQuotationCustomerAccess(supervised.scope, supervised.sent.id, {
        expectedCurrentVersion: 1,
      }),
      /exactly one active designated contact/,
    );

    const messages: FrigoraMailMessage[] = [];
    await resetPersistenceLifecycle();
    await ensureSchema();
    const mailboxOffice = await seed({
      mail: {
        verifiedDomains: ["quotes.example"],
        publicOrigin: "https://quotes.example",
        env: {},
        provider: {
          async send(message) {
            messages.push(message);
            return { outcome: "accepted_by_provider", providerMessageId: `provider-${messages.length}` };
          },
        },
      },
    });
    const mailboxSeed = await seedSentQuotation(mailboxOffice);
    const mailboxContact = await mailboxOffice.service.createQuotationCustomerContact(
      mailboxOffice.scope,
      mailboxSeed.sent.id,
      { displayName: "Ada Approver", email: "ada@fuelco.test" },
    );
    await mailboxOffice.service.setVentureMailIdentity(mailboxOffice.scope, {
      fromName: "Frigora Quotes",
      fromEmail: "quotes@quotes.example",
    });
    const challenge = await mailboxOffice.service.requestCustomerContactVerification(
      mailboxOffice.scope,
      mailboxContact.id,
    );
    await mailboxOffice.service.confirmCustomerContactEmail(mailboxOffice.scope, {
      challengeId: challenge.challengeId,
      secret: codeFrom(messages.at(-1)),
    });
    await mailboxOffice.service.designateQuotationContact(mailboxOffice.scope, mailboxContact.id, { basis: BASIS });
    const mailboxLink = await mailboxOffice.service.activateQuotationCustomerAccess(
      mailboxOffice.scope,
      mailboxSeed.sent.id,
      { expectedCurrentVersion: 1 },
    );
    assert.match(mailboxLink.testOnlyPath, /^\/quotation-decision\//);
    const verified = await mailboxOffice.service.getCustomerContact(mailboxOffice.scope, mailboxContact.id);
    assert.ok(verified?.emailVerifiedAt);
    assert.equal(
      (await mailboxOffice.store.listSupervisedVerifications(
        mailboxOffice.workspaceId,
        mailboxOffice.ventureId,
        mailboxContact.id,
      )).length,
      0,
    );

    const second = await mailboxOffice.service.createQuotationCustomerContact(
      mailboxOffice.scope,
      mailboxSeed.sent.id,
      { displayName: "Bo Approver", email: "bo@fuelco.test" },
    );
    const secondChallenge = await mailboxOffice.service.requestCustomerContactVerification(
      mailboxOffice.scope,
      second.id,
    );
    await mailboxOffice.service.confirmCustomerContactEmail(mailboxOffice.scope, {
      challengeId: secondChallenge.challengeId,
      secret: codeFrom(messages.at(-1)),
    });
    await mailboxOffice.service.designateQuotationContact(mailboxOffice.scope, second.id, { basis: BASIS });
    await assert.rejects(
      () => mailboxOffice.service.activateQuotationCustomerAccess(mailboxOffice.scope, mailboxSeed.sent.id, {
        expectedCurrentVersion: 1,
      }),
      /exactly one active designated contact/,
    );

    await getClient().execute({
      sql: "UPDATE frigora_customer_contacts SET status = 'revoked' WHERE id = ?",
      args: [mailboxContact.id],
    });
    await mailboxOffice.service.revokeQuotationContactDesignation(mailboxOffice.scope, second.id);
    await assert.rejects(
      () => mailboxOffice.service.activateQuotationCustomerAccess(mailboxOffice.scope, mailboxSeed.sent.id, {
        expectedCurrentVersion: 1,
      }),
      /exactly one active designated contact/,
    );
  });

  it("keeps live email delivery on genuine mailbox verification", async () => {
    let sends = 0;
    const office = await seed({
      mail: {
        verifiedDomains: ["quotes.example"],
        publicOrigin: "https://quotes.example",
        env: {},
        provider: {
          async send() {
            sends += 1;
            throw new Error("live mail is not allowed");
          },
        },
      },
    });
    const seeded = await seedSentQuotation(office);
    const contact = await office.service.createQuotationCustomerContact(office.scope, seeded.sent.id, {
      displayName: "Ada Approver",
      email: "ada@fuelco.test",
    });
    await office.service.setVentureMailIdentity(office.scope, {
      fromName: "Frigora Quotes",
      fromEmail: "quotes@quotes.example",
    });
    await office.service.recordSupervisedContactVerification(office.scope, seeded.sent.id, contact.id, {
      method: "telephone",
      evidenceNote: "Called the accounts desk",
    });
    await office.service.designateQuotationContact(office.scope, contact.id, { basis: BASIS });
    await assert.rejects(
      () => office.service.deliverQuotationDecisionGrant(office.scope, seeded.sent.id, {
        expectedCurrentVersion: 1,
        contactId: contact.id,
      }),
      (error: unknown) => error instanceof FrigoraError
        && error.code === "decision_rejected"
        && /email is not verified/.test(error.message),
    );
    assert.equal(sends, 0);
    const contactAfter = await office.service.getCustomerContact(office.scope, contact.id);
    assert.equal(contactAfter?.emailVerifiedAt, null);
  });

  it("revokes every outstanding unconsumed grant when authority changes and preserves consumed decisions", async () => {
    const office = await ready();
    await supervise(office, office.contact, office.sent.id);
    await designate(office, office.contact);
    const first = await office.service.activateQuotationCustomerAccess(office.scope, office.sent.id, {
      expectedCurrentVersion: 1,
    });
    const second = await office.service.activateQuotationCustomerAccess(office.scope, office.sent.id, {
      expectedCurrentVersion: 1,
    });
    const firstSecret = secretFrom(first.testOnlyPath);
    const secondSecret = secretFrom(second.testOnlyPath);
    await office.service.submitCustomerQuotation({
      grantId: first.grantId,
      secret: firstSecret,
      decision: "approved",
    });
    const approved = await office.service.getQuotation(office.scope, office.sent.id);
    const approvedHash = approved?.versions.find((version) => version.version === 1)?.documentHash;
    assert.ok(approvedHash);

    await office.service.updateQuotationCustomerContact(office.scope, office.sent.id, office.contact.id, {
      displayName: "Ada M. Approver",
      email: "ada@fuelco.test",
    });
    const afterName = await grantRows(office.contact.id);
    assert.equal(afterName.length, 2);
    const consumed = afterName.find((row) => row.id === first.grantId);
    const outstanding = afterName.find((row) => row.id === second.grantId);
    assert.ok(consumed?.consumed_at);
    assert.equal(consumed?.revoked_at, null);
    assert.equal(consumed?.document_hash, approvedHash);
    assert.equal(outstanding?.consumed_at, null);
    assert.ok(outstanding?.revoked_at);
    const decisions = await decisionRows(office.sent.id);
    assert.equal(decisions.length, 1);
    assert.equal(decisions[0]?.decision, "approved");
    assert.equal(decisions[0]?.document_hash, approvedHash);
    const mailboxKept = await office.service.getCustomerContact(office.scope, office.contact.id);
    assert.equal(mailboxKept?.emailVerifiedAt, null);
    const supervisedAfterName = await office.store.listSupervisedVerifications(
      office.workspaceId,
      office.ventureId,
      office.contact.id,
    );
    assert.equal(supervisedAfterName.filter((row) => row.revokedAt == null).length, 0);

    const storedSecrets = await getClient().execute(
      "SELECT secret_hash FROM frigora_quotation_decision_grants",
    );
    const audits = await getClient().execute("SELECT metadata_json FROM audit_events");
    const dumped = `${JSON.stringify(storedSecrets.rows)}\n${JSON.stringify(audits.rows)}`;
    assert.equal(dumped.includes(firstSecret), false);
    assert.equal(dumped.includes(secondSecret), false);
    const listed = await office.service.listQuotationCustomerAccess(office.scope, office.sent.id);
    assert.equal(JSON.stringify(listed).includes(firstSecret), false);
    assert.equal(listed.find((grant) => grant.id === first.grantId)?.decision, "approved");
    assert.equal(listed.find((grant) => grant.id === first.grantId)?.documentHash, approvedHash);
    assert.equal(listed.find((grant) => grant.id === second.grantId)?.state, "revoked");
  });

  it("revokes outstanding grants for email, contact, designation, and supervised-verification changes", async () => {
    async function openGrant(label: string) {
      await resetPersistenceLifecycle();
      await ensureSchema();
      const office = await seed();
      const seeded = await seedSentQuotation(office);
      const contact = await office.service.createCustomerContact(office.scope, {
        customerId: seeded.customer.id,
        siteId: seeded.site.id,
        displayName: "Ada Approver",
        email: `${label}@fuelco.test`,
      });
      await office.service.recordSupervisedContactVerification(office.scope, seeded.sent.id, contact.id, {
        method: "in_person",
        evidenceNote: "Met the approver on site",
      });
      await office.service.designateQuotationContact(office.scope, contact.id, { basis: BASIS });
      const first = await office.service.activateQuotationCustomerAccess(office.scope, seeded.sent.id, {
        expectedCurrentVersion: 1,
      });
      const second = await office.service.activateQuotationCustomerAccess(office.scope, seeded.sent.id, {
        expectedCurrentVersion: 1,
      });
      return { office, seeded, contact, activated: first, second };
    }

    const reasons: string[] = [];
    async function rememberReason() {
      const rows = await getClient().execute(
        "SELECT metadata_json FROM audit_events WHERE action = 'frigora.quotation.customer_access_revoked'",
      );
      reasons.push(rows.rows.map((row) => String(row.metadata_json)).join("\n"));
    }

    const emailCase = await openGrant("email");
    await emailCase.office.service.updateCustomerContact(emailCase.office.scope, emailCase.contact.id, {
      displayName: "Ada Approver",
      email: "new-ada@fuelco.test",
    });
    const emailGrants = await grantRows(emailCase.contact.id);
    assert.equal(emailGrants.length, 2);
    assert.ok(emailGrants.every((row) => row.revoked_at != null && row.consumed_at == null));
    const cleared = await emailCase.office.service.getCustomerContact(emailCase.office.scope, emailCase.contact.id);
    assert.equal(cleared?.emailVerifiedAt, null);
    await rememberReason();

    const contactCase = await openGrant("contact");
    await contactCase.office.service.revokeCustomerContact(contactCase.office.scope, contactCase.contact.id);
    const contactGrants = await grantRows(contactCase.contact.id);
    assert.ok(contactGrants[0]?.revoked_at);
    const revokedContact = await contactCase.office.service.getCustomerContact(
      contactCase.office.scope,
      contactCase.contact.id,
    );
    assert.equal(revokedContact?.status, "revoked");
    await rememberReason();

    const designationCase = await openGrant("designation");
    await designationCase.office.service.revokeQuotationContactDesignation(
      designationCase.office.scope,
      designationCase.contact.id,
    );
    assert.ok((await grantRows(designationCase.contact.id))[0]?.revoked_at);
    await rememberReason();

    const replaceCase = await openGrant("replace");
    await replaceCase.office.service.designateQuotationContact(replaceCase.office.scope, replaceCase.contact.id, {
      basis: "Office replaced the designation basis after a second check.",
    });
    assert.ok((await grantRows(replaceCase.contact.id))[0]?.revoked_at);
    await rememberReason();

    const verificationCase = await openGrant("verification");
    await verificationCase.office.service.revokeSupervisedContactVerification(
      verificationCase.office.scope,
      verificationCase.seeded.sent.id,
      verificationCase.contact.id,
    );
    assert.ok((await grantRows(verificationCase.contact.id))[0]?.revoked_at);
    await rememberReason();
    const reasonText = reasons.join("\n");
    for (const reason of [
      "email_changed",
      "contact_revoked",
      "designation_revoked",
      "designation_changed",
      "supervised_verification_revoked",
    ]) {
      assert.match(reasonText, new RegExp(reason));
    }
  });

  it("rolls the authority change back when grant revocation cannot be written", async () => {
    const office = await ready();
    await supervise(office, office.contact, office.sent.id);
    await designate(office, office.contact);
    await office.service.activateQuotationCustomerAccess(office.scope, office.sent.id, {
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
      const grants = await grantRows(office.contact.id);
      assert.equal(grants[0]?.revoked_at, null);
    } finally {
      await getClient().execute("DROP TRIGGER IF EXISTS test_block_outstanding_grant_revoke");
    }
  });

  it("issues a new grant after the contact is verified and designated again", async () => {
    const office = await ready();
    await supervise(office, office.contact, office.sent.id);
    await designate(office, office.contact);
    const first = await office.service.activateQuotationCustomerAccess(office.scope, office.sent.id, {
      expectedCurrentVersion: 1,
    });
    await office.service.revokeSupervisedContactVerification(office.scope, office.sent.id, office.contact.id);
    assert.ok((await grantRows(office.contact.id))[0]?.revoked_at);
    await supervise(office, office.contact, office.sent.id, "in_person");
    await designate(office, office.contact);
    const second = await office.service.activateQuotationCustomerAccess(office.scope, office.sent.id, {
      expectedCurrentVersion: 1,
    });
    assert.notEqual(second.grantId, first.grantId);
    const grants = await grantRows(office.contact.id);
    assert.equal(grants.length, 2);
    assert.equal(grants.filter((row) => row.revoked_at == null && row.consumed_at == null).length, 1);
    const listed = await office.service.listQuotationCustomerAccess(office.scope, office.sent.id);
    assert.equal(JSON.stringify(listed).includes(secretFrom(second.testOnlyPath)), false);
    const current = (await office.service.getQuotation(office.scope, office.sent.id))?.versions[0];
    assert.equal(listed.find((grant) => grant.id === second.grantId)?.version, current?.version);
    assert.equal(listed.find((grant) => grant.id === second.grantId)?.documentHash, current?.documentHash);
    assert.equal(listed.find((grant) => grant.id === second.grantId)?.state, "active");
  });

  it("shows the office distinction between supervised verification and email delivery", () => {
    const screen = readFileSync(
      join(process.cwd(), "src/modules/frigora/app/screens/quotation-detail-screen.tsx"),
      "utf8",
    );
    const forms = readFileSync(
      join(process.cwd(), "src/modules/frigora/app/forms/quotation-forms.tsx"),
      "utf8",
    );
    assert.match(screen, /Customer/);
    assert.match(screen, /Document hash/);
    assert.match(screen, /access revoked/);
    assert.match(forms, /shown once/);
    assert.match(forms, /not emailed/);
    assert.equal(forms.includes("deliverQuotationDecisionGrant"), false);
  });
});
