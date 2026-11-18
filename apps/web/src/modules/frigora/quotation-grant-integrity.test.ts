import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import type { UserId, VentureId, WorkspaceId } from "@/contracts";
import { createDbMembershipStore } from "@/platform/permissions/membership-store";
import { createPermissionService } from "@/platform/permissions/service";
import { ensureSchema, getClient } from "@/platform/persistence/db";
import { getPersistence, resetPersistenceLifecycle } from "@/platform/persistence/repositories";
import type { PersistedVenture } from "@/platform/persistence/repositories/ports";
import { FrigoraError } from "./errors";
import type { FrigoraMailMessage, FrigoraMailRuntime } from "./mail";
import { exampleQuotationCommercial } from "./quotation-commercial";
import { createPersistedQuotation, issuePersistedQuotation } from "./quotation-commands";
import { readDecisionFragment } from "./quotation-decision-fragment";
import { installQuotationDeliveryPayloadTestKeys } from "./quotation-delivery-payload";
import type { QuotationLineDraft } from "./quotation-lines";
import { createFrigoraService } from "./service";
import { createFrigoraStore } from "./store";
import { allowSyntheticNotRegisteredQuotationSend } from "./tax-configuration-fixture";
import { closeFrigoraPersistenceAfterFile } from "./test-persistence-lifecycle";
import type { FrigoraCustomerContactId, FrigoraQuotationId, FrigoraScope } from "./types";

const NOW = "2026-10-24T08:00:00.000Z";
const ARRIVED = "2026-10-24T08:05:00.000Z";
const RECOMMENDED_AT = "2026-10-24T08:20:00.000Z";
const ISSUED_AT = "2026-10-24T12:00:00.000Z";
const BASIS = "Office recorded this mailbox as the commercial approver for this site.";

installQuotationDeliveryPayloadTestKeys();
closeFrigoraPersistenceAfterFile();

beforeEach(async () => {
  await resetPersistenceLifecycle();
  await ensureSchema();
});

function ventureRow(): PersistedVenture {
  return {
    id: "ven-grant" as VentureId,
    workspaceId: "ws-grant" as WorkspaceId,
    name: "Frigora Grant",
    slug: "frigora-grant",
    stage: "Idea",
    href: "/ventures/hq/frigora-grant",
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
    definitionVersion: "0.22.0",
    lifecycle: "operating",
    createdAt: NOW,
    updatedAt: NOW,
  };
}

function recordingMail() {
  const messages: FrigoraMailMessage[] = [];
  const runtime: FrigoraMailRuntime = {
    verifiedDomains: ["quotes.example"],
    publicOrigin: "https://quotes.example",
    env: {},
    provider: {
      async send(message) {
        messages.push(message);
        return { outcome: "accepted_by_provider", providerMessageId: `provider-${messages.length}` };
      },
    },
  };
  return { messages, runtime };
}

function lineDraft(lineNumber: number, role: "mandatory" | "optional", description: string): QuotationLineDraft {
  return {
    lineNumber,
    lineRole: role,
    source: "custom",
    description,
    unit: "each",
    quantityMilli: lineNumber === 1 ? 1_000 : 2_000,
    unitPriceMinor: 15_000,
    taxTreatment: "not_registered",
  };
}

async function office() {
  const mail = recordingMail();
  const workspaceId = "ws-grant" as WorkspaceId;
  const ventureId = "ven-grant" as VentureId;
  const userId = "user-owner" as UserId;
  const persistence = getPersistence();
  await persistence.organisations.insert({
    id: workspaceId,
    name: "Frigora Workspace",
    slug: "ws-grant",
    createdAt: NOW,
  });
  await persistence.memberships.setRole({ userId, workspaceId, role: "owner", createdAt: NOW });
  await persistence.memberships.setRole({
    userId: "user-attendee" as UserId,
    workspaceId,
    role: "member",
    createdAt: NOW,
  });
  await persistence.ventures.insert(ventureRow());
  const store = createFrigoraStore();
  const permissions = createPermissionService(createDbMembershipStore());
  const scope = { userId, workspaceId, ventureId } satisfies FrigoraScope;
  const service = createFrigoraService({ store, permissions, now: () => ISSUED_AT, mail: mail.runtime });
  await allowSyntheticNotRegisteredQuotationSend(service, scope);
  const customer = await service.createCustomer(scope, { code: "FUELCO", displayName: "FuelCo" });
  const site = await service.createSite(scope, {
    customerId: customer.id,
    code: "SANDTON-N",
    name: "Sandton North",
  });
  const asset = await service.createAsset(scope, { siteId: site.id, tag: "EVAP-01", name: "Evaporator" });
  await service.setVentureMailIdentity(scope, {
    fromName: "Frigora Quotes",
    fromEmail: "quotes@quotes.example",
  });
  let work = 0;
  async function recommendation() {
    work += 1;
    const workOrder = await service.createWorkOrder(scope, {
      siteId: site.id,
      workReference: `WO-GRANT-${work}`,
      workKind: "reactive",
      primaryAssetId: asset.id,
      reportedCondition: "display freezer warm",
    });
    const visit = await service.recordVisitArrival(scope, workOrder.id, {
      userId: "user-attendee" as UserId,
      arrivedAt: ARRIVED,
    });
    return service.recordRecommendedAction(scope, visit.id, {
      description: "Replace compressor",
      recommendedAt: RECOMMENDED_AT,
      recommendedByUserId: "user-attendee" as UserId,
      recordedByUserId: "user-attendee" as UserId,
      assetId: asset.id,
    });
  }
  const beforeVerification = mail.messages.length;
  const contact = await service.createCustomerContact(scope, {
    customerId: customer.id,
    siteId: site.id,
    displayName: "Amina Naidoo",
    email: "amina@fuelco.test",
  });
  await service.designateQuotationContact(scope, contact.id, { basis: BASIS });
  const verification = await service.requestCustomerContactVerification(scope, contact.id);
  const verificationText = mail.messages[beforeVerification]?.text.split("\n") ?? [];
  const verificationCode = verificationText[verificationText.indexOf("Verification code:") + 1] ?? "";
  await service.confirmCustomerContactEmail(scope, {
    challengeId: verification.challengeId,
    secret: verificationCode,
  });
  return {
    mail,
    store,
    permissions,
    scope,
    service,
    contactId: contact.id as FrigoraCustomerContactId,
    recommendation,
  };
}

async function quotation(
  owner: Awaited<ReturnType<typeof office>>,
  description: string,
  drafts?: QuotationLineDraft[],
) {
  const recommendation = await owner.recommendation();
  return createPersistedQuotation(
    owner.store,
    owner.scope,
    {
      recommendedActionId: recommendation.id,
      description,
      commercial: exampleQuotationCommercial(),
    },
    drafts ? { permissions: owner.permissions, drafts } : undefined,
  );
}

const offerLines = [
  lineDraft(1, "mandatory", "Mandatory gasket"),
  lineDraft(2, "optional", "Optional filter"),
];

async function issueQuotation(owner: Awaited<ReturnType<typeof office>>, quotationId: FrigoraQuotationId) {
  return issuePersistedQuotation(owner.store, owner.scope, quotationId, {
    expectedCurrentVersion: 1,
    recipient: "client@example.test",
  });
}

async function markAwaiting(quotationId: string) {
  await getClient().execute({
    sql: "UPDATE frigora_quotation_versions SET status = 'awaiting_customer_approval' WHERE quotation_id = ? AND version_number = 1",
    args: [quotationId],
  });
}

async function grantCount(quotationId: string) {
  const rows = await getClient().execute({
    sql: "SELECT id, document_hash FROM frigora_quotation_decision_grants WHERE quotation_id = ?",
    args: [quotationId],
  });
  return rows.rows;
}

async function deliveryCount(quotationId: string) {
  const rows = await getClient().execute({
    sql: "SELECT id FROM frigora_quotation_customer_deliveries WHERE quotation_id = ?",
    args: [quotationId],
  });
  return rows.rows.length;
}

async function expectHashRejection(run: () => Promise<unknown>) {
  await assert.rejects(run, (error: unknown) => {
    assert.ok(error instanceof FrigoraError, String(error));
    assert.equal(error.code, "invalid_input");
    assert.match(error.message, /does not match its document hash/);
    return true;
  });
}

function customerLink(message: FrigoraMailMessage | undefined) {
  const line = message?.text.split("\n").find((item) => item.includes("/quotation-decision/"));
  assert.ok(line);
  const url = new URL(line);
  return {
    grantId: decodeURIComponent(url.pathname.split("/").at(-1) ?? ""),
    secret: readDecisionFragment(url.hash),
  };
}

describe("FRG-COMMERCIAL-01A-R1 grant document integrity", () => {
  it("issues a line-bearing grant through the test-link path with the stored hash", async () => {
    const owner = await office();
    const quote = await quotation(owner, "Line offer", offerLines);
    await issueQuotation(owner, quote.id);
    let delivered = 0;
    const grant = await owner.service.issueQuotationDecisionGrant(
      owner.scope,
      quote.id,
      { expectedCurrentVersion: 1 },
      { async deliver() { delivered += 1; } },
    );
    const rows = await grantCount(quote.id);
    assert.equal(delivered, 1);
    assert.equal(rows.length, 1);
    assert.equal(grant.documentHash, quote.versions[0]?.documentHash);
    assert.equal(String(rows[0]?.document_hash), quote.versions[0]?.documentHash);
  });

  it("issues a line-bearing grant through mailbox delivery with the stored hash", async () => {
    const owner = await office();
    const quote = await quotation(owner, "Line mailbox", offerLines);
    await issueQuotation(owner, quote.id);
    const before = owner.mail.messages.length;
    await owner.service.deliverQuotationDecisionGrant(owner.scope, quote.id, {
      expectedCurrentVersion: 1,
      contactId: owner.contactId,
    });
    const rows = await grantCount(quote.id);
    assert.equal(owner.mail.messages.length, before + 1);
    assert.equal(rows.length, 1);
    assert.equal(await deliveryCount(quote.id), 1);
    assert.equal(String(rows[0]?.document_hash), quote.versions[0]?.documentHash);
  });

  it("rejects a stale line-bearing quotation before the test-link grant or its callback", async () => {
    const owner = await office();
    const quote = await quotation(owner, "Stale line offer", offerLines);
    await getClient().execute({
      sql: "UPDATE frigora_quotation_line_snapshots SET description = 'Changed gasket' WHERE quotation_id = ? AND line_number = 1",
      args: [quote.id],
    });
    await markAwaiting(quote.id);
    let delivered = 0;
    await expectHashRejection(() => owner.service.issueQuotationDecisionGrant(
      owner.scope,
      quote.id,
      { expectedCurrentVersion: 1 },
      { async deliver() { delivered += 1; } },
    ));
    assert.equal(delivered, 0);
    assert.equal((await grantCount(quote.id)).length, 0);
  });

  it("rejects a stale line-bearing quotation before mailbox persistence or email", async () => {
    const owner = await office();
    const quote = await quotation(owner, "Stale line mailbox", offerLines);
    await getClient().execute({
      sql: "UPDATE frigora_quotation_line_snapshots SET description = 'Changed gasket' WHERE quotation_id = ? AND line_number = 1",
      args: [quote.id],
    });
    await markAwaiting(quote.id);
    const before = owner.mail.messages.length;
    await expectHashRejection(() => owner.service.deliverQuotationDecisionGrant(owner.scope, quote.id, {
      expectedCurrentVersion: 1,
      contactId: owner.contactId,
    }));
    assert.equal(owner.mail.messages.length, before);
    assert.equal((await grantCount(quote.id)).length, 0);
    assert.equal(await deliveryCount(quote.id), 0);
  });

  it("issues a lineless grant through both grant paths with the stored hash", async () => {
    const owner = await office();
    const testLink = await quotation(owner, "Lineless test link");
    const mailbox = await quotation(owner, "Lineless mailbox");
    await issueQuotation(owner, testLink.id);
    await issueQuotation(owner, mailbox.id);
    const grant = await owner.service.issueQuotationDecisionGrant(
      owner.scope,
      testLink.id,
      { expectedCurrentVersion: 1 },
      { async deliver() {} },
    );
    const before = owner.mail.messages.length;
    await owner.service.deliverQuotationDecisionGrant(owner.scope, mailbox.id, {
      expectedCurrentVersion: 1,
      contactId: owner.contactId,
    });
    assert.equal(grant.documentHash, testLink.versions[0]?.documentHash);
    assert.equal(String((await grantCount(testLink.id))[0]?.document_hash), testLink.versions[0]?.documentHash);
    assert.equal(String((await grantCount(mailbox.id))[0]?.document_hash), mailbox.versions[0]?.documentHash);
    assert.equal(owner.mail.messages.length, before + 1);
  });

  it("rejects a stale lineless quotation through both grant paths with no grant or email", async () => {
    const owner = await office();
    const testLink = await quotation(owner, "Stale lineless test link");
    const mailbox = await quotation(owner, "Stale lineless mailbox");
    for (const quote of [testLink, mailbox]) {
      await getClient().execute({
        sql: "UPDATE frigora_quotation_versions SET description = 'Changed header' WHERE quotation_id = ? AND version_number = 1",
        args: [quote.id],
      });
      await markAwaiting(quote.id);
    }
    let delivered = 0;
    await expectHashRejection(() => owner.service.issueQuotationDecisionGrant(
      owner.scope,
      testLink.id,
      { expectedCurrentVersion: 1 },
      { async deliver() { delivered += 1; } },
    ));
    const before = owner.mail.messages.length;
    await expectHashRejection(() => owner.service.deliverQuotationDecisionGrant(owner.scope, mailbox.id, {
      expectedCurrentVersion: 1,
      contactId: owner.contactId,
    }));
    assert.equal(delivered, 0);
    assert.equal(owner.mail.messages.length, before);
    assert.equal((await grantCount(testLink.id)).length, 0);
    assert.equal((await grantCount(mailbox.id)).length, 0);
    assert.equal(await deliveryCount(mailbox.id), 0);
  });

  it("keeps expiry, revocation, and consumption in force after the integrity check", async () => {
    const owner = await office();
    const expiredQuote = await quotation(owner, "Expired lineless");
    const revokedQuote = await quotation(owner, "Revoked lineless");
    const consumedQuote = await quotation(owner, "Consumed lineless");
    await issueQuotation(owner, expiredQuote.id);
    await issueQuotation(owner, revokedQuote.id);
    await issueQuotation(owner, consumedQuote.id);
    const beforeExpired = owner.mail.messages.length;
    await owner.service.deliverQuotationDecisionGrant(owner.scope, expiredQuote.id, {
      expectedCurrentVersion: 1,
      contactId: owner.contactId,
    });
    const expiredLink = customerLink(owner.mail.messages[beforeExpired]);
    const later = createFrigoraService({
      store: owner.store,
      permissions: owner.permissions,
      now: () => "2026-11-24T12:00:00.000Z",
      mail: owner.mail.runtime,
    });
    assert.deepEqual(
      await later.submitCustomerQuotation({
        grantId: expiredLink.grantId,
        secret: expiredLink.secret,
        decision: "approved",
      }),
      { state: "expired" },
    );
    assert.equal((await grantCount(expiredQuote.id))[0]?.document_hash == null, false);

    const beforeRevoked = owner.mail.messages.length;
    await owner.service.deliverQuotationDecisionGrant(owner.scope, revokedQuote.id, {
      expectedCurrentVersion: 1,
      contactId: owner.contactId,
    });
    const revokedLink = customerLink(owner.mail.messages[beforeRevoked]);
    await owner.service.revokeQuotationCustomerAccess(owner.scope, revokedLink.grantId as never);
    assert.deepEqual(
      await owner.service.submitCustomerQuotation({
        grantId: revokedLink.grantId,
        secret: revokedLink.secret,
        decision: "approved",
      }),
      { state: "revoked" },
    );

    const beforeConsumed = owner.mail.messages.length;
    await owner.service.deliverQuotationDecisionGrant(owner.scope, consumedQuote.id, {
      expectedCurrentVersion: 1,
      contactId: owner.contactId,
    });
    const consumedLink = customerLink(owner.mail.messages[beforeConsumed]);
    assert.deepEqual(
      await owner.service.submitCustomerQuotation({
        grantId: consumedLink.grantId,
        secret: consumedLink.secret,
        decision: "approved",
      }),
      { state: "approved", version: 1 },
    );
    assert.deepEqual(
      await owner.service.submitCustomerQuotation({
        grantId: consumedLink.grantId,
        secret: consumedLink.secret,
        decision: "declined",
      }),
      { state: "used", decision: "approved", version: 1 },
    );
    const consumed = await getClient().execute({
      sql: "SELECT consumed_at FROM frigora_quotation_decision_grants WHERE id = ?",
      args: [consumedLink.grantId],
    });
    assert.equal(consumed.rows[0]?.consumed_at == null, false);
    const decisions = await getClient().execute({
      sql: "SELECT decision FROM frigora_quotation_decisions WHERE quotation_id = ?",
      args: [consumedQuote.id],
    });
    assert.deepEqual(decisions.rows.map((row) => String(row.decision)), ["approved"]);
  });
});
