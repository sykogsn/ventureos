import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { beforeEach, describe, it } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import type { UserId, VentureId, WorkspaceId } from "@/contracts";
import { takeAuthMailOutbox } from "@/modules/auth/mail";
import { GET, POST } from "@/app/api/quotation-decision/route";
import { createPermissionService } from "@/platform/permissions/service";
import { createDbMembershipStore } from "@/platform/permissions/membership-store";
import { ensureSchema, getClient, getDatabaseUrl } from "@/platform/persistence/db";
import { getPersistence, resetPersistenceLifecycle } from "@/platform/persistence/repositories";
import type { PersistedVenture } from "@/platform/persistence/repositories/ports";
import { exampleQuotationCommercial, priceQuotationCommercial } from "./quotation-commercial";
import { installQuotationDeliveryPayloadTestKeys } from "./quotation-delivery-payload";
import { FrigoraError } from "./errors";
import { allowSyntheticNotRegisteredQuotationSend } from "./tax-configuration-fixture";
import type { FrigoraMailMessage, FrigoraMailRuntime } from "./mail";
import { quotationDecisionReviewLink } from "./mail";
import { isQuotationDecisionPublicPath } from "./quotation-decision-public-path";
import { allowQuotationDecisionAttempt, resetQuotationDecisionAttempts } from "./quotation-decision-rate-limit";
import { readDecisionFragment } from "./quotation-decision-fragment";
import { QuotationDecisionView } from "./quotation-decision-view";
import { quotationDocumentHash } from "./quotation-workflow";
import { createFrigoraService } from "./service";
import { createFrigoraStore } from "./store";
import { closeFrigoraPersistenceAfterFile } from "./test-persistence-lifecycle";
import type { FrigoraScope } from "./types";

const NOW = "2026-10-24T08:00:00.000Z";
const ARRIVED = "2026-10-24T08:05:00.000Z";
const RECOMMENDED_AT = "2026-10-24T08:20:00.000Z";
const ISSUED_AT = "2026-10-24T12:00:00.000Z";
const BASIS = "Office recorded this mailbox as the commercial approver for this site.";

closeFrigoraPersistenceAfterFile();
installQuotationDeliveryPayloadTestKeys();

beforeEach(async () => {
  resetQuotationDecisionAttempts();
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
        title: "", ask: "", whyNow: "", ifDeferred: "", timeNeeded: "", actionLabel: "",
        actionHref: "/dashboard", attention: "hold", founderAsk: "", active: false,
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

function fakeMail() {
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

function decisionLink(message: FrigoraMailMessage | undefined) {
  const line = message?.text.split("\n").find((item) => item.includes("/quotation-decision/"));
  if (!line) return null;
  return new URL(line);
}

async function seed(options: { now?: () => string; mail?: FrigoraMailRuntime } = {}) {
  await resetPersistenceLifecycle();
  await ensureSchema();
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
  const store = createFrigoraStore();
  const scope = { userId, workspaceId, ventureId } satisfies FrigoraScope;
  return {
    userId,
    scope,
    service: createFrigoraService({
      store,
      permissions: createPermissionService(createDbMembershipStore()),
      now: options.now,
      mail: options.mail,
    }),
  };
}

async function seedSent(owner: Awaited<ReturnType<typeof seed>>) {
  const attendeeId = "user-attendee" as UserId;
  await getPersistence().memberships.setRole({
    userId: attendeeId,
    workspaceId: owner.scope.workspaceId,
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
  const visit = await owner.service.recordVisitArrival(owner.scope, workOrder.id, { userId: attendeeId, arrivedAt: ARRIVED });
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
  await owner.service.createCustomer(owner.scope, { code: "OTHER", displayName: "Other Co" });
  return { customer, site, sent };
}

async function deliver(owner: Awaited<ReturnType<typeof seed>>, messages: FrigoraMailMessage[], sentId: string, customerId: string, siteId: string) {
  await owner.service.setVentureMailIdentity(owner.scope, {
    fromName: "Frigora Quotes",
    fromEmail: "quotes@quotes.example",
  });
  const contact = await owner.service.createCustomerContact(owner.scope, {
    customerId,
    siteId,
    displayName: "Amina Naidoo",
    email: "amina@fuelco.test",
  });
  await owner.service.designateQuotationContact(owner.scope, contact.id, { basis: BASIS });
  const verification = await owner.service.requestCustomerContactVerification(owner.scope, contact.id);
  const verificationLink = messages[0]?.text.split("\n") ?? [];
  const verificationCode = verificationLink[verificationLink.indexOf("Verification code:") + 1] ?? "";
  await owner.service.confirmCustomerContactEmail(owner.scope, {
    challengeId: verification.challengeId,
    secret: verificationCode,
  });
  const delivery = await owner.service.deliverQuotationDecisionGrant(owner.scope, sentId as never, {
    expectedCurrentVersion: 1,
    contactId: contact.id,
  });
  return { contact, delivery, link: decisionLink(messages.at(-1)) };
}

function databaseText() {
  const url = getDatabaseUrl();
  const path = url.startsWith("file:") ? url.slice("file:".length) : url;
  return [path, `${path}-wal`, `${path}-shm`].filter((candidate) => existsSync(candidate)).map((candidate) => readFileSync(candidate));
}

const ISSUED_VERSION_SNAPSHOT_SQL = `
  SELECT status, document_hash, description, total_minor,
         labour_quantity_milli, labour_rate_minor, labour_amount_minor,
         travel_kilometres_milli, travel_rate_minor, travel_amount_minor,
         taxable_amount_minor, tax_treatment, tax_amount_minor
  FROM frigora_quotation_versions
  WHERE quotation_id = ? AND version_number = 1
`;

async function auditMetadata(action: string) {
  const audits = await getClient().execute({
    sql: "SELECT metadata_json FROM audit_events WHERE action = ?",
    args: [action],
  });
  return audits.rows.map((row) => JSON.parse(String(row.metadata_json)) as {
    grantId?: string;
    outcome?: string;
  });
}

async function submitRevokedCustomerDecision(decision: "approved" | "declined") {
  const mail = fakeMail();
  const owner = await seed({ now: () => ISSUED_AT, mail: mail.runtime });
  const databaseUrl = getDatabaseUrl();
  assert.match(databaseUrl, /vos-ephemeral-/);
  assert.equal(databaseUrl.includes("ventureos.db"), false);
  assert.equal(databaseUrl.includes("frg-quote-browser.db"), false);
  const { customer, site, sent } = await seedSent(owner);
  const { link } = await deliver(owner, mail.messages, sent.id, customer.id, site.id);
  assert.ok(link);
  const grantId = decodeURIComponent(link.pathname.split("/").at(-1) ?? "");
  const secret = readDecisionFragment(link.hash);
  const beforeQuotation = await owner.service.getQuotation(owner.scope, sent.id);
  const beforeVersion = beforeQuotation?.versions[0];
  assert.ok(beforeVersion);
  assert.equal(beforeVersion.status, "awaiting_customer_approval");
  const beforeStored = await getClient().execute({
    sql: ISSUED_VERSION_SNAPSHOT_SQL,
    args: [sent.id],
  });
  const listed = await owner.service.listQuotationCustomerAccess(owner.scope, sent.id);
  assert.equal(listed.length, 1);
  assert.equal(listed[0]?.id, grantId);
  await owner.service.revokeQuotationCustomerAccess(owner.scope, listed[0]!.id as never);
  const revokedGrant = await getClient().execute({
    sql: "SELECT consumed_at, revoked_at, document_hash FROM frigora_quotation_decision_grants WHERE id = ?",
    args: [grantId],
  });
  assert.equal(revokedGrant.rows[0]?.consumed_at, null);
  const revokedAt = String(revokedGrant.rows[0]?.revoked_at);
  assert.equal(revokedAt.length > 0, true);
  assert.equal(String(revokedGrant.rows[0]?.document_hash), beforeVersion.documentHash);
  const revocation = (await auditMetadata("frigora.quotation.customer_access_revoked"))
    .filter((row) => row.grantId === grantId);
  assert.equal(revocation.length, 1);
  assert.equal(revocation[0]?.outcome, undefined);
  assert.deepEqual(
    (await auditMetadata("frigora.quotation.customer_access"))
      .filter((row) => row.grantId === grantId)
      .map((row) => row.outcome),
    [],
  );
  const submitted = await owner.service.submitCustomerQuotation({ grantId, secret, decision });
  assert.deepEqual(submitted, { state: "revoked" });
  const decisions = await getClient().execute({
    sql: "SELECT id FROM frigora_quotation_decisions WHERE grant_id = ?",
    args: [grantId],
  });
  assert.equal(decisions.rows.length, 0);
  const afterGrant = await getClient().execute({
    sql: "SELECT consumed_at, revoked_at, document_hash FROM frigora_quotation_decision_grants WHERE id = ?",
    args: [grantId],
  });
  assert.equal(afterGrant.rows[0]?.consumed_at, null);
  assert.equal(String(afterGrant.rows[0]?.revoked_at), revokedAt);
  assert.equal(String(afterGrant.rows[0]?.document_hash), beforeVersion.documentHash);
  const afterQuotation = await owner.service.getQuotation(owner.scope, sent.id);
  assert.equal(afterQuotation?.decisions.length, 0);
  assert.deepEqual(afterQuotation?.versions[0], beforeVersion);
  const afterStored = await getClient().execute({
    sql: ISSUED_VERSION_SNAPSHOT_SQL,
    args: [sent.id],
  });
  assert.deepEqual(afterStored.rows[0], beforeStored.rows[0]);
  assert.equal(String(afterStored.rows[0]?.status), "awaiting_customer_approval");
  assert.deepEqual(
    (await auditMetadata("frigora.quotation.customer_access"))
      .filter((row) => row.grantId === grantId)
      .map((row) => row.outcome),
    ["revoked"],
  );
  const revocationAfter = (await auditMetadata("frigora.quotation.customer_access_revoked"))
    .filter((row) => row.grantId === grantId);
  assert.equal(revocationAfter.length, 1);
  assert.equal(revocationAfter[0]?.outcome, undefined);
}

const VERSION_SNAPSHOT_SQL = `
  SELECT status, document_hash, description, total_minor,
         labour_quantity_milli, labour_rate_minor, labour_amount_minor,
         travel_kilometres_milli, travel_rate_minor, travel_amount_minor,
         taxable_amount_minor, tax_treatment, tax_amount_minor
  FROM frigora_quotation_versions
  WHERE quotation_id = ? AND version_number = ?
`;

async function versionSnapshot(quotationId: string, version: number) {
  const stored = await getClient().execute({
    sql: VERSION_SNAPSHOT_SQL,
    args: [quotationId, version],
  });
  return stored.rows[0];
}

async function submitStaleCustomerDecision(decision: "approved" | "declined") {
  const mail = fakeMail();
  const owner = await seed({ now: () => ISSUED_AT, mail: mail.runtime });
  const databaseUrl = getDatabaseUrl();
  assert.match(databaseUrl, /vos-ephemeral-/);
  assert.equal(databaseUrl.includes("ventureos.db"), false);
  assert.equal(databaseUrl.includes("frg-quote-browser.db"), false);
  const { customer, site, sent } = await seedSent(owner);
  const { link } = await deliver(owner, mail.messages, sent.id, customer.id, site.id);
  assert.ok(link);
  const grantId = decodeURIComponent(link.pathname.split("/").at(-1) ?? "");
  const secret = readDecisionFragment(link.hash);
  const issued = await owner.service.getQuotation(owner.scope, sent.id);
  const issuedVersion = issued?.versions[0];
  assert.ok(issuedVersion);
  assert.equal(issued?.currentVersion, 1);
  assert.equal(issuedVersion.version, 1);
  assert.equal(issuedVersion.status, "awaiting_customer_approval");
  const issuedStored = await versionSnapshot(sent.id, 1);
  const issuedGrant = await getClient().execute({
    sql: "SELECT version_number, document_hash, consumed_at FROM frigora_quotation_decision_grants WHERE id = ?",
    args: [grantId],
  });
  assert.equal(Number(issuedGrant.rows[0]?.version_number), 1);
  assert.equal(issuedGrant.rows[0]?.consumed_at, null);
  assert.equal(String(issuedGrant.rows[0]?.document_hash), issuedVersion.documentHash);
  const revised = await owner.service.reviseQuotation(owner.scope, sent.id, {
    expectedCurrentVersion: 1,
    description: "Revised compressor scope",
    commercial: exampleQuotationCommercial({ travelRateMinor: 5000 }),
  });
  assert.equal(revised.currentVersion, 2);
  assert.equal(revised.versions.length, 2);
  assert.deepEqual(revised.versions[0], issuedVersion);
  const currentVersion = revised.versions[1];
  assert.ok(currentVersion);
  assert.equal(currentVersion.version, 2);
  assert.equal(currentVersion.status, "in_preparation");
  assert.notEqual(currentVersion.documentHash, issuedVersion.documentHash);
  const revisedStored = await versionSnapshot(sent.id, 1);
  const currentStored = await versionSnapshot(sent.id, 2);
  assert.deepEqual(revisedStored, issuedStored);
  assert.equal(String(currentStored?.status), "in_preparation");
  assert.equal(String(currentStored?.document_hash), currentVersion.documentHash);
  const revisionEvents = await getClient().execute({
    sql: "SELECT kind FROM frigora_quotation_events WHERE quotation_id = ? AND kind = 'revision_started'",
    args: [sent.id],
  });
  assert.equal(revisionEvents.rows.length, 1);
  assert.deepEqual(
    (await auditMetadata("frigora.quotation.customer_access"))
      .filter((row) => row.grantId === grantId),
    [],
  );
  const submitted = await owner.service.submitCustomerQuotation({ grantId, secret, decision });
  assert.deepEqual(submitted, { state: "stale" });
  const decisions = await getClient().execute({
    sql: "SELECT id FROM frigora_quotation_decisions WHERE grant_id = ?",
    args: [grantId],
  });
  assert.equal(decisions.rows.length, 0);
  const afterGrant = await getClient().execute({
    sql: "SELECT version_number, document_hash, consumed_at FROM frigora_quotation_decision_grants WHERE id = ?",
    args: [grantId],
  });
  assert.equal(afterGrant.rows[0]?.consumed_at, null);
  assert.equal(Number(afterGrant.rows[0]?.version_number), 1);
  assert.equal(String(afterGrant.rows[0]?.document_hash), issuedVersion.documentHash);
  const after = await owner.service.getQuotation(owner.scope, sent.id);
  assert.equal(after?.currentVersion, 2);
  assert.equal(after?.versions.length, 2);
  assert.equal(after?.decisions.length, 0);
  assert.deepEqual(after?.versions[0], issuedVersion);
  assert.deepEqual(after?.versions[1], currentVersion);
  assert.deepEqual(await versionSnapshot(sent.id, 1), issuedStored);
  assert.deepEqual(await versionSnapshot(sent.id, 2), currentStored);
  const versionCount = await getClient().execute({
    sql: "SELECT COUNT(*) AS n FROM frigora_quotation_versions WHERE quotation_id = ?",
    args: [sent.id],
  });
  assert.equal(Number(versionCount.rows[0]?.n), 2);
  const revisionAfter = await getClient().execute({
    sql: "SELECT kind FROM frigora_quotation_events WHERE quotation_id = ? AND kind = 'revision_started'",
    args: [sent.id],
  });
  assert.equal(revisionAfter.rows.length, 1);
  const staleAccess = (await auditMetadata("frigora.quotation.customer_access"))
    .filter((row) => row.grantId === grantId);
  assert.deepEqual(staleAccess.map((row) => row.outcome), ["stale"]);
  assert.equal(staleAccess.length, 1);
}

const REPEAT_AT = "2026-10-25T12:00:00.000Z";

function assertUsedResponse(
  response: object,
  decision: "approved" | "declined",
) {
  assert.deepEqual(response, { state: "used", decision, version: 1 });
  assert.deepEqual(Object.keys(response).sort(), ["decision", "state", "version"]);
}

async function submitConsumedCustomerDecision(recorded: "approved" | "declined") {
  let clock = ISSUED_AT;
  const mail = fakeMail();
  const owner = await seed({ now: () => clock, mail: mail.runtime });
  const databaseUrl = getDatabaseUrl();
  assert.match(databaseUrl, /vos-ephemeral-/);
  assert.equal(databaseUrl.includes("ventureos.db"), false);
  assert.equal(databaseUrl.includes("frg-quote-browser.db"), false);
  const { customer, site, sent } = await seedSent(owner);
  const { link } = await deliver(owner, mail.messages, sent.id, customer.id, site.id);
  assert.ok(link);
  const grantId = decodeURIComponent(link.pathname.split("/").at(-1) ?? "");
  const secret = readDecisionFragment(link.hash);
  const issued = await owner.service.getQuotation(owner.scope, sent.id);
  const issuedVersion = issued?.versions[0];
  assert.ok(issuedVersion);
  assert.equal(issuedVersion.documentHash.length > 0, true);
  const first = await owner.service.submitCustomerQuotation({ grantId, secret, decision: recorded });
  assert.deepEqual(first, { state: recorded, version: 1 });
  const recordedDecision = await getClient().execute({
    sql: `SELECT id, decision, decided_at, version_number, document_hash
          FROM frigora_quotation_decisions WHERE grant_id = ?`,
    args: [grantId],
  });
  assert.equal(recordedDecision.rows.length, 1);
  const decisionId = String(recordedDecision.rows[0]?.id);
  const decidedAt = String(recordedDecision.rows[0]?.decided_at);
  assert.equal(String(recordedDecision.rows[0]?.decision), recorded);
  assert.equal(decidedAt, ISSUED_AT);
  assert.equal(Number(recordedDecision.rows[0]?.version_number), 1);
  assert.equal(String(recordedDecision.rows[0]?.document_hash), issuedVersion.documentHash);
  const consumedGrant = await getClient().execute({
    sql: "SELECT version_number, document_hash, consumed_at, revoked_at FROM frigora_quotation_decision_grants WHERE id = ?",
    args: [grantId],
  });
  const consumedAt = String(consumedGrant.rows[0]?.consumed_at);
  assert.equal(consumedAt, ISSUED_AT);
  assert.equal(consumedGrant.rows[0]?.revoked_at, null);
  assert.equal(Number(consumedGrant.rows[0]?.version_number), 1);
  assert.equal(String(consumedGrant.rows[0]?.document_hash), issuedVersion.documentHash);
  const decidedSnapshot = await versionSnapshot(sent.id, 1);
  assert.equal(String(decidedSnapshot?.status), recorded);
  assert.equal(String(decidedSnapshot?.document_hash), issuedVersion.documentHash);
  assert.deepEqual(
    (await auditMetadata("frigora.quotation.customer_access"))
      .filter((row) => row.grantId === grantId)
      .map((row) => row.outcome),
    ["presented"],
  );
  assert.equal(
    (await auditMetadata("frigora.quotation.customer_decision_recorded"))
      .filter((row) => row.grantId === grantId).length,
    1,
  );
  clock = REPEAT_AT;
  const repeated = await owner.service.submitCustomerQuotation({ grantId, secret, decision: recorded });
  assertUsedResponse(repeated, recorded);
  const opposite = recorded === "approved" ? "declined" : "approved";
  const reversed = await owner.service.submitCustomerQuotation({ grantId, secret, decision: opposite });
  assertUsedResponse(reversed, recorded);
  const decisions = await getClient().execute({
    sql: `SELECT id, decision, decided_at, version_number, document_hash
          FROM frigora_quotation_decisions WHERE grant_id = ?`,
    args: [grantId],
  });
  assert.equal(decisions.rows.length, 1);
  assert.equal(String(decisions.rows[0]?.id), decisionId);
  assert.equal(String(decisions.rows[0]?.decision), recorded);
  assert.equal(String(decisions.rows[0]?.decided_at), decidedAt);
  assert.equal(Number(decisions.rows[0]?.version_number), 1);
  assert.equal(String(decisions.rows[0]?.document_hash), issuedVersion.documentHash);
  const afterGrant = await getClient().execute({
    sql: "SELECT version_number, document_hash, consumed_at, revoked_at FROM frigora_quotation_decision_grants WHERE id = ?",
    args: [grantId],
  });
  assert.equal(String(afterGrant.rows[0]?.consumed_at), consumedAt);
  assert.equal(afterGrant.rows[0]?.revoked_at, null);
  assert.equal(Number(afterGrant.rows[0]?.version_number), 1);
  assert.equal(String(afterGrant.rows[0]?.document_hash), issuedVersion.documentHash);
  assert.deepEqual(await versionSnapshot(sent.id, 1), decidedSnapshot);
  const quotationDecisions = await getClient().execute({
    sql: "SELECT COUNT(*) AS n FROM frigora_quotation_decisions WHERE quotation_id = ?",
    args: [sent.id],
  });
  assert.equal(Number(quotationDecisions.rows[0]?.n), 1);
  const access = (await auditMetadata("frigora.quotation.customer_access"))
    .filter((row) => row.grantId === grantId);
  assert.deepEqual(access.map((row) => row.outcome), ["presented", "consumed", "consumed"]);
  assert.equal(
    (await auditMetadata("frigora.quotation.customer_decision_recorded"))
      .filter((row) => row.grantId === grantId).length,
    1,
  );
}

function assertInvalidPublic(response: object) {
  assert.deepEqual(response, { state: "invalid" });
  assert.deepEqual(Object.keys(response), ["state"]);
}

async function issuedGrantFixture(now: () => string = () => ISSUED_AT) {
  const mail = fakeMail();
  const owner = await seed({ now, mail: mail.runtime });
  const databaseUrl = getDatabaseUrl();
  assert.match(databaseUrl, /vos-ephemeral-/);
  assert.equal(databaseUrl.includes("ventureos.db"), false);
  assert.equal(databaseUrl.includes("frg-quote-browser.db"), false);
  const { customer, site, sent } = await seedSent(owner);
  const { link } = await deliver(owner, mail.messages, sent.id, customer.id, site.id);
  assert.ok(link);
  const grantId = decodeURIComponent(link.pathname.split("/").at(-1) ?? "");
  const secret = readDecisionFragment(link.hash);
  const issued = await owner.service.getQuotation(owner.scope, sent.id);
  const issuedVersion = issued?.versions[0];
  assert.ok(issuedVersion);
  assert.equal(issuedVersion.status, "awaiting_customer_approval");
  const issuedStored = await versionSnapshot(sent.id, 1);
  const issuedGrant = await getClient().execute({
    sql: `SELECT version_number, document_hash, consumed_at, revoked_at, decision_id
          FROM frigora_quotation_decision_grants WHERE id = ?`,
    args: [grantId],
  });
  assert.equal(Number(issuedGrant.rows[0]?.version_number), 1);
  assert.equal(issuedGrant.rows[0]?.consumed_at, null);
  assert.equal(issuedGrant.rows[0]?.revoked_at, null);
  assert.equal(issuedGrant.rows[0]?.decision_id, null);
  assert.equal(String(issuedGrant.rows[0]?.document_hash), issuedVersion.documentHash);
  return { owner, sent, grantId, secret, issuedVersion, issuedStored, issuedGrant: issuedGrant.rows[0] };
}

async function reviewConsumedGrantWithoutDecision() {
  const fixture = await issuedGrantFixture();
  const consumed = await getClient().execute({
    sql: `UPDATE frigora_quotation_decision_grants
          SET consumed_at = ?
          WHERE id = ?
            AND consumed_at IS NULL
            AND revoked_at IS NULL`,
    args: [ISSUED_AT, fixture.grantId],
  });
  assert.equal(Number(consumed.rowsAffected), 1);
  const established = await getClient().execute({
    sql: `SELECT version_number, document_hash, consumed_at, revoked_at, decision_id
          FROM frigora_quotation_decision_grants WHERE id = ?`,
    args: [fixture.grantId],
  });
  assert.equal(String(established.rows[0]?.consumed_at), ISSUED_AT);
  assert.equal(established.rows[0]?.decision_id, null);
  assert.deepEqual(await versionSnapshot(fixture.sent.id, 1), fixture.issuedStored);
  const reviewed = await fixture.owner.service.reviewCustomerQuotation({
    grantId: fixture.grantId,
    secret: fixture.secret,
  });
  assertInvalidPublic(reviewed);
  assert.equal(JSON.stringify(reviewed).includes("Replace compressor"), false);
  const approved = await fixture.owner.service.submitCustomerQuotation({
    grantId: fixture.grantId,
    secret: fixture.secret,
    decision: "approved",
  });
  assertInvalidPublic(approved);
  const declined = await fixture.owner.service.submitCustomerQuotation({
    grantId: fixture.grantId,
    secret: fixture.secret,
    decision: "declined",
  });
  assertInvalidPublic(declined);
  const decisions = await getClient().execute({
    sql: "SELECT id FROM frigora_quotation_decisions WHERE quotation_id = ?",
    args: [fixture.sent.id],
  });
  assert.equal(decisions.rows.length, 0);
  const afterGrant = await getClient().execute({
    sql: `SELECT version_number, document_hash, consumed_at, revoked_at, decision_id
          FROM frigora_quotation_decision_grants WHERE id = ?`,
    args: [fixture.grantId],
  });
  assert.deepEqual(afterGrant.rows[0], established.rows[0]);
  assert.deepEqual(await versionSnapshot(fixture.sent.id, 1), fixture.issuedStored);
  assert.deepEqual(
    (await auditMetadata("frigora.quotation.customer_access"))
      .filter((row) => row.grantId === fixture.grantId),
    [],
  );
  assert.equal(
    (await auditMetadata("frigora.quotation.customer_decision_recorded"))
      .filter((row) => row.grantId === fixture.grantId).length,
    0,
  );
}

async function postUnavailableCustomerSubmission() {
  const fixture = await issuedGrantFixture(() => new Date().toISOString());
  resetQuotationDecisionAttempts();
  await getClient().execute(`
    CREATE TRIGGER customer_submission_persist_fail
    BEFORE INSERT ON frigora_quotation_decisions
    BEGIN
      SELECT RAISE(ABORT, 'forced decision persistence failure');
    END
  `);
  try {
    const response = await POST(new Request("https://quotes.example/api/quotation-decision", {
      method: "POST",
      body: JSON.stringify({
        action: "submit",
        grantId: fixture.grantId,
        secret: fixture.secret,
        decision: "approved",
      }),
    }));
    assert.equal(response.status, 503);
    const body = await response.json() as { state: string };
    assert.deepEqual(body, { state: "unavailable" });
    assert.equal(JSON.stringify(body).includes(fixture.secret), false);
    const decisions = await getClient().execute({
      sql: "SELECT id FROM frigora_quotation_decisions WHERE quotation_id = ?",
      args: [fixture.sent.id],
    });
    assert.equal(decisions.rows.length, 0);
    const afterGrant = await getClient().execute({
      sql: `SELECT version_number, document_hash, consumed_at, revoked_at, decision_id
            FROM frigora_quotation_decision_grants WHERE id = ?`,
      args: [fixture.grantId],
    });
    assert.deepEqual(afterGrant.rows[0], fixture.issuedGrant);
    assert.deepEqual(await versionSnapshot(fixture.sent.id, 1), fixture.issuedStored);
    assert.equal(
      (await auditMetadata("frigora.quotation.customer_decision_recorded"))
        .filter((row) => row.grantId === fixture.grantId).length,
      0,
    );
  } finally {
    await getClient().execute("DROP TRIGGER IF EXISTS customer_submission_persist_fail");
  }
}

async function reviewGrantForNonFrigoraVenture() {
  const fixture = await issuedGrantFixture();
  const venture = await getPersistence().ventures.findById(fixture.owner.scope.ventureId);
  assert.ok(venture);
  assert.equal(venture.definitionId, "frigora");
  await getPersistence().ventures.update({
    ...venture,
    definitionId: "ventureos.company",
    updatedAt: ISSUED_AT,
  });
  const changed = await getPersistence().ventures.findById(fixture.owner.scope.ventureId);
  assert.equal(changed?.definitionId, "ventureos.company");
  const reviewed = await fixture.owner.service.reviewCustomerQuotation({
    grantId: fixture.grantId,
    secret: fixture.secret,
  });
  assertInvalidPublic(reviewed);
  assert.equal(JSON.stringify(reviewed).includes("Replace compressor"), false);
  const decisions = await getClient().execute({
    sql: "SELECT id FROM frigora_quotation_decisions WHERE quotation_id = ?",
    args: [fixture.sent.id],
  });
  assert.equal(decisions.rows.length, 0);
  const afterGrant = await getClient().execute({
    sql: `SELECT version_number, document_hash, consumed_at, revoked_at, decision_id
          FROM frigora_quotation_decision_grants WHERE id = ?`,
    args: [fixture.grantId],
  });
  assert.deepEqual(afterGrant.rows[0], fixture.issuedGrant);
  assert.deepEqual(await versionSnapshot(fixture.sent.id, 1), fixture.issuedStored);
  assert.deepEqual(
    (await auditMetadata("frigora.quotation.customer_access"))
      .filter((row) => row.grantId === fixture.grantId),
    [],
  );
}

describe("customer quotation review", () => {
  it("opens the persisted version from a fragment link and records the designated contact", async () => {
    const mail = fakeMail();
    const owner = await seed({ now: () => ISSUED_AT, mail: mail.runtime });
    const { customer, site, sent } = await seedSent(owner);
    const { contact, link } = await deliver(owner, mail.messages, sent.id, customer.id, site.id);
    assert.ok(link);
    assert.equal(link.search, "");
    assert.equal(link.origin, "https://quotes.example");
    assert.equal(link.pathname, `/quotation-decision/${contact ? "" : ""}${link.pathname.split("/").at(-1)}`);
    const secret = readDecisionFragment(link.hash);
    assert.equal(link.search.includes(secret), false);
    assert.equal(JSON.stringify(mail.messages.at(-1)).includes("?"), false);
    const review = await owner.service.reviewCustomerQuotation({ grantId: link.pathname.split("/").at(-1) ?? "", secret });
    assert.equal(review.state, "ready");
    if (review.state !== "ready") return;
    assert.equal(review.version, 1);
    assert.equal(review.description, "Replace compressor");
    assert.equal(review.currency, "ZAR");
    assert.equal(review.totalMinor, 1495000);
    assert.equal(review.customerName, "FuelCo");
    assert.equal(review.siteName, "Sandton North");
    assert.ok(review.commercial);
    assert.equal(review.commercial?.labourQuantityMilli, 10_000);
    assert.equal(review.commercial?.labourAmountMinor, 1_000_000);
    assert.equal(review.commercial?.travelAmountMinor, 495_000);
    assert.equal(review.commercial?.taxAmountMinor, 0);
    assert.equal(review.commercial?.taxableAmountMinor, 1_495_000);
    assert.equal(JSON.stringify(review).includes("sars-za-vat"), false);
    assert.equal(JSON.stringify(review).includes("Other Co"), false);
    assert.equal(JSON.stringify(review).includes(secret), false);
    assert.equal(JSON.stringify(review).includes("ws-frigora"), false);
    const html = renderToStaticMarkup(createElement(QuotationDecisionView, { review }));
    assert.match(html, /Quotation version 1/);
    assert.match(html, /Replace compressor/);
    assert.match(html, /FuelCo/);
    assert.match(html, /Sandton North/);
    assert.equal(html.includes(secret), false);
    const logs: string[] = [];
    const log = console.log;
    const error = console.error;
    console.log = (...args: unknown[]) => { logs.push(args.map(String).join(" ")); };
    console.error = (...args: unknown[]) => { logs.push(args.map(String).join(" ")); };
    let submitted: Awaited<ReturnType<typeof owner.service.submitCustomerQuotation>>;
    try {
      submitted = await owner.service.submitCustomerQuotation({
        grantId: link.pathname.split("/").at(-1) ?? "",
        secret,
        decision: "approved",
      });
    } finally {
      console.log = log;
      console.error = error;
    }
    assert.deepEqual(submitted, { state: "approved", version: 1 });
    assert.equal(logs.some((line) => line.includes(secret)), false);
    assert.equal(databaseText().some((bytes) => bytes.includes(Buffer.from(secret))), false);
    const stored = await owner.service.getQuotation(owner.scope, sent.id);
    assert.equal(stored?.versions[0]?.status, "approved");
    assert.equal(stored?.decisions.length, 1);
    assert.equal(stored?.decisions[0]?.documentHash, quotationDocumentHash({
      version: 1,
      description: "Replace compressor",
      ...priceQuotationCommercial(exampleQuotationCommercial()),
    }));
    const event = stored?.events.find((item) => item.kind === "approved");
    assert.equal(event?.actorUserId, null);
    assert.equal(event?.actorContactId, contact.id);
    const audits = await getClient().execute(
      "SELECT metadata_json FROM audit_events WHERE action = 'frigora.quotation.customer_decision_recorded'",
    );
    assert.equal(String(audits.rows[0]?.metadata_json).includes(secret), false);
    assert.match(String(audits.rows[0]?.metadata_json), new RegExp(contact.id));
    const response = await POST(new Request("https://quotes.example/api/quotation-decision", {
      method: "POST",
      body: JSON.stringify({
        action: "review",
        grantId: link.pathname.split("/").at(-1),
        secret,
        customerId: "customer-injected",
      }),
    }));
    const body = await response.json() as { state: string };
    assert.equal(body.state, "used");
    assert.equal(JSON.stringify(body).includes(secret), false);
    assert.equal(takeAuthMailOutbox().length, 0);
  });

  it("hides commercial details for invalid, expired, revoked, consumed, and stale grants", async () => {
    let current = ISSUED_AT;
    const mail = fakeMail();
    const owner = await seed({ now: () => current, mail: mail.runtime });
    const { customer, site, sent } = await seedSent(owner);
    const { link } = await deliver(owner, mail.messages, sent.id, customer.id, site.id);
    assert.ok(link);
    const grantId = decodeURIComponent(link.pathname.split("/").at(-1) ?? "");
    const secret = readDecisionFragment(link.hash);
    const invalid = await owner.service.reviewCustomerQuotation({ grantId, secret: "wrong-secret" });
    assert.deepEqual(invalid, { state: "invalid" });
    assert.equal(JSON.stringify(invalid).includes("Replace compressor"), false);
    current = "2026-11-01T12:00:00.000Z";
    assert.deepEqual(await owner.service.reviewCustomerQuotation({ grantId, secret }), { state: "expired" });
    const revokedMail = fakeMail();
    const revokedOwner = await seed({ now: () => ISSUED_AT, mail: revokedMail.runtime });
    const revokedSent = await seedSent(revokedOwner);
    const revokedDelivery = await deliver(revokedOwner, revokedMail.messages, revokedSent.sent.id, revokedSent.customer.id, revokedSent.site.id);
    assert.ok(revokedDelivery.link);
    const revokedGrantId = decodeURIComponent(revokedDelivery.link.pathname.split("/").at(-1) ?? "");
    const revokedSecret = readDecisionFragment(revokedDelivery.link.hash);
    await getClient().execute({
      sql: "UPDATE frigora_quotation_decision_grants SET revoked_at = ? WHERE id = ?",
      args: [ISSUED_AT, revokedGrantId],
    });
    const revokedReview = await revokedOwner.service.reviewCustomerQuotation({
      grantId: revokedGrantId,
      secret: revokedSecret,
    });
    assert.deepEqual(revokedReview, { state: "revoked" });
    assert.equal(JSON.stringify(revokedReview).includes("Replace compressor"), false);
    const approvedOwnerMail = fakeMail();
    const approvedOwner = await seed({ now: () => ISSUED_AT, mail: approvedOwnerMail.runtime });
    const approvedSent = await seedSent(approvedOwner);
    const approvedDelivery = await deliver(
      approvedOwner,
      approvedOwnerMail.messages,
      approvedSent.sent.id,
      approvedSent.customer.id,
      approvedSent.site.id,
    );
    assert.ok(approvedDelivery.link);
    const approvedGrantId = decodeURIComponent(approvedDelivery.link.pathname.split("/").at(-1) ?? "");
    const approvedSecret = readDecisionFragment(approvedDelivery.link.hash);
    const approved = await approvedOwner.service.submitCustomerQuotation({
      grantId: approvedGrantId,
      secret: approvedSecret,
      decision: "declined",
    });
    assert.equal(approved.state, "declined");
    const used = await approvedOwner.service.reviewCustomerQuotation({
      grantId: approvedGrantId,
      secret: approvedSecret,
    });
    assert.equal(used.state, "used");
    assert.equal(JSON.stringify(used).includes("Replace compressor"), false);
    const again = await approvedOwner.service.submitCustomerQuotation({
      grantId: approvedGrantId,
      secret: approvedSecret,
      decision: "declined",
    });
    assert.equal(again.state, "used");
    const decisions = await getClient().execute("SELECT decision FROM frigora_quotation_decisions");
    assert.equal(decisions.rows.length, 1);
    assert.equal(String(decisions.rows[0]?.decision), "declined");
  });

  it("rejects an expired customer submission without a decision or grant consumption", async () => {
    let current = ISSUED_AT;
    const mail = fakeMail();
    const owner = await seed({ now: () => current, mail: mail.runtime });
    const databaseUrl = getDatabaseUrl();
    assert.match(databaseUrl, /vos-ephemeral-/);
    assert.equal(databaseUrl.includes("ventureos.db"), false);
    assert.equal(databaseUrl.includes("frg-quote-browser.db"), false);
    const { customer, site, sent } = await seedSent(owner);
    const { link } = await deliver(owner, mail.messages, sent.id, customer.id, site.id);
    assert.ok(link);
    const grantId = decodeURIComponent(link.pathname.split("/").at(-1) ?? "");
    const secret = readDecisionFragment(link.hash);
    const beforeQuotation = await owner.service.getQuotation(owner.scope, sent.id);
    const beforeVersion = beforeQuotation?.versions[0];
    assert.ok(beforeVersion);
    assert.equal(beforeVersion.status, "awaiting_customer_approval");
    assert.equal(beforeQuotation?.decisions.length, 0);
    const beforeDecisions = await getClient().execute({
      sql: "SELECT id FROM frigora_quotation_decisions WHERE quotation_id = ?",
      args: [sent.id],
    });
    assert.equal(beforeDecisions.rows.length, 0);
    const beforeGrant = await getClient().execute({
      sql: "SELECT expires_at, consumed_at, document_hash FROM frigora_quotation_decision_grants WHERE id = ?",
      args: [grantId],
    });
    const expiresAt = String(beforeGrant.rows[0]?.expires_at);
    const expiresMs = Date.parse(expiresAt);
    assert.equal(Number.isFinite(expiresMs), true);
    assert.equal(beforeGrant.rows[0]?.consumed_at, null);
    assert.equal(String(beforeGrant.rows[0]?.document_hash), beforeVersion.documentHash);
    const beforeStored = await getClient().execute({
      sql: `
        SELECT status, document_hash, description, total_minor,
               labour_quantity_milli, labour_rate_minor, labour_amount_minor,
               travel_kilometres_milli, travel_rate_minor, travel_amount_minor,
               taxable_amount_minor, tax_treatment, tax_amount_minor
        FROM frigora_quotation_versions
        WHERE quotation_id = ? AND version_number = 1
      `,
      args: [sent.id],
    });
    current = new Date(expiresMs + 1000).toISOString();
    const submitted = await owner.service.submitCustomerQuotation({
      grantId,
      secret,
      decision: "approved",
    });
    assert.deepEqual(submitted, { state: "expired" });
    const afterDecisions = await getClient().execute({
      sql: "SELECT id FROM frigora_quotation_decisions WHERE quotation_id = ?",
      args: [sent.id],
    });
    assert.equal(afterDecisions.rows.length, 0);
    const afterGrant = await getClient().execute({
      sql: "SELECT expires_at, consumed_at, document_hash FROM frigora_quotation_decision_grants WHERE id = ?",
      args: [grantId],
    });
    assert.equal(afterGrant.rows[0]?.consumed_at, null);
    assert.equal(String(afterGrant.rows[0]?.expires_at), expiresAt);
    assert.equal(String(afterGrant.rows[0]?.document_hash), beforeVersion.documentHash);
    const afterQuotation = await owner.service.getQuotation(owner.scope, sent.id);
    assert.equal(afterQuotation?.decisions.length, 0);
    assert.deepEqual(afterQuotation?.versions[0], beforeVersion);
    const afterStored = await getClient().execute({
      sql: `
        SELECT status, document_hash, description, total_minor,
               labour_quantity_milli, labour_rate_minor, labour_amount_minor,
               travel_kilometres_milli, travel_rate_minor, travel_amount_minor,
               taxable_amount_minor, tax_treatment, tax_amount_minor
        FROM frigora_quotation_versions
        WHERE quotation_id = ? AND version_number = 1
      `,
      args: [sent.id],
    });
    assert.deepEqual(afterStored.rows[0], beforeStored.rows[0]);
    assert.equal(String(afterStored.rows[0]?.status), "awaiting_customer_approval");
  });

  it("rejects an approved submission for a revoked grant without a decision or grant consumption", async () => {
    await submitRevokedCustomerDecision("approved");
  });

  it("rejects a declined submission for a revoked grant without a decision or grant consumption", async () => {
    await submitRevokedCustomerDecision("declined");
  });

  it("rejects an approved submission for a stale grant without changing either quotation version", async () => {
    await submitStaleCustomerDecision("approved");
  });

  it("rejects a declined submission for a stale grant without changing either quotation version", async () => {
    await submitStaleCustomerDecision("declined");
  });

  it("rejects a repeated approval and an opposite decline for a consumed approved grant", async () => {
    await submitConsumedCustomerDecision("approved");
  });

  it("rejects a repeated decline and an opposite approval for a consumed declined grant", async () => {
    await submitConsumedCustomerDecision("declined");
  });

  it("rejects an old grant after revision and a missing public origin", async () => {
    const mail = fakeMail();
    const owner = await seed({ now: () => ISSUED_AT, mail: mail.runtime });
    const { customer, site, sent } = await seedSent(owner);
    const { link } = await deliver(owner, mail.messages, sent.id, customer.id, site.id);
    assert.ok(link);
    const grantId = decodeURIComponent(link.pathname.split("/").at(-1) ?? "");
    const secret = readDecisionFragment(link.hash);
    await owner.service.reviseQuotation(owner.scope, sent.id, {
      expectedCurrentVersion: 1,
      description: "Revised compressor scope",
      commercial: exampleQuotationCommercial({ travelRateMinor: 5000 }),
    });
    assert.deepEqual(await owner.service.reviewCustomerQuotation({ grantId, secret }), { state: "stale" });
    assert.equal((await owner.service.submitCustomerQuotation({ grantId, secret, decision: "approved" })).state, "stale");
    const decisions = await getClient().execute("SELECT id FROM frigora_quotation_decisions");
    assert.equal(decisions.rows.length, 0);
    const unconfigured = await seed({
      now: () => ISSUED_AT,
      mail: { verifiedDomains: ["quotes.example"], env: {}, provider: mail.runtime.provider },
    });
    const second = await seedSent(unconfigured);
    await unconfigured.service.setVentureMailIdentity(unconfigured.scope, {
      fromName: "Frigora Quotes",
      fromEmail: "quotes@quotes.example",
    });
    const contact = await unconfigured.service.createCustomerContact(unconfigured.scope, {
      customerId: second.customer.id,
      siteId: second.site.id,
      displayName: "Amina Naidoo",
      email: "amina@fuelco.test",
    });
    await assert.rejects(
      () => unconfigured.service.deliverQuotationDecisionGrant(unconfigured.scope, second.sent.id, {
        expectedCurrentVersion: 1,
        contactId: contact.id,
      }),
      (error: unknown) => error instanceof FrigoraError && error.code === "mail_not_configured",
    );
    const grants = await getClient().execute("SELECT id FROM frigora_quotation_decision_grants");
    assert.equal(grants.rows.length, 0);
    assert.equal(quotationDecisionReviewLink("https://quotes.example", "grant-1", "secret-value").includes("?"), false);
    assert.equal(readDecisionFragment("#secret-value"), "secret-value");
  });

  it("accepts one of two concurrent decisions and does not echo the secret over GET", async () => {
    const mail = fakeMail();
    const owner = await seed({ now: () => ISSUED_AT, mail: mail.runtime });
    const { customer, site, sent } = await seedSent(owner);
    const { link } = await deliver(owner, mail.messages, sent.id, customer.id, site.id);
    assert.ok(link);
    const grantId = decodeURIComponent(link.pathname.split("/").at(-1) ?? "");
    const secret = readDecisionFragment(link.hash);
    const [left, right] = await Promise.allSettled([
      owner.service.submitCustomerQuotation({ grantId, secret, decision: "approved" }),
      owner.service.submitCustomerQuotation({ grantId, secret, decision: "declined" }),
    ]);
    const fulfilled = [left, right].filter((result) => result.status === "fulfilled");
    assert.equal(fulfilled.length >= 1, true);
    const decisions = await getClient().execute("SELECT decision FROM frigora_quotation_decisions");
    assert.equal(decisions.rows.length, 1);
    const getResponse = await GET();
    assert.equal(getResponse.status, 405);
    assert.equal(isQuotationDecisionPublicPath("/quotation-decision/grant-1"), true);
    assert.equal(isQuotationDecisionPublicPath("/api/quotation-decision"), true);
    assert.equal(isQuotationDecisionPublicPath("/login"), false);
    assert.equal(isQuotationDecisionPublicPath("/api/quotation-decision/extra"), false);
    assert.match(readFileSync(new URL("../../proxy.ts", import.meta.url), "utf8"), /isQuotationDecisionPublicPath/);
    resetQuotationDecisionAttempts();
    for (let attempt = 0; attempt < 7; attempt += 1) {
      assert.equal(allowQuotationDecisionAttempt("grant-rate", `wrong-${attempt}`), true);
    }
    assert.equal(allowQuotationDecisionAttempt("grant-rate", "correct-secret"), true);
    assert.equal(allowQuotationDecisionAttempt("grant-rate", "another-secret"), false);
    assert.equal(allowQuotationDecisionAttempt("grant-other", "another-secret"), true);
    const limited = await POST(new Request("https://quotes.example/api/quotation-decision", {
      method: "POST",
      body: JSON.stringify({ action: "review", grantId: "grant-rate", secret: "correct-secret" }),
    }));
    assert.equal(limited.status, 429);
    const limitedBody = await limited.json() as { state: string };
    assert.deepEqual(limitedBody, { state: "limited" });
    assert.equal(JSON.stringify(limitedBody).includes("secret-rate"), false);
    const posted = await POST(new Request("https://quotes.example/api/quotation-decision?secret=" + secret, {
      method: "POST",
      body: JSON.stringify({ action: "review", grantId, secret }),
    }));
    const postedBody = await posted.text();
    assert.equal(postedBody.includes(secret), false);
    assert.equal(posted.headers.get("referrer-policy"), "no-referrer");
  });

  it("creates a test decision link without emailing the quotation", async () => {
    const mail = fakeMail();
    const owner = await seed({ now: () => ISSUED_AT, mail: mail.runtime });
    const { customer, site, sent } = await seedSent(owner);
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
    await owner.service.designateQuotationContact(owner.scope, contact.id, { basis: BASIS });
    const verification = await owner.service.requestCustomerContactVerification(owner.scope, contact.id);
    const verificationLines = mail.messages[0]?.text.split("\n") ?? [];
    const verificationCode = verificationLines[verificationLines.indexOf("Verification code:") + 1] ?? "";
    await owner.service.confirmCustomerContactEmail(owner.scope, {
      challengeId: verification.challengeId,
      secret: verificationCode,
    });
    const mailCount = mail.messages.length;
    const activated = await owner.service.activateQuotationCustomerAccess(owner.scope, sent.id, {
      expectedCurrentVersion: 1,
    });
    assert.equal(mail.messages.length, mailCount);
    assert.match(activated.testOnlyPath, /^\/quotation-decision\/[^#]+#/);
    assert.equal(activated.testOnlyPath.includes("api.resend.com"), false);
    const hashStart = activated.testOnlyPath.indexOf("#");
    const secret = readDecisionFragment(activated.testOnlyPath.slice(hashStart));
    const grantId = decodeURIComponent(activated.testOnlyPath.slice("/quotation-decision/".length, hashStart));
    const review = await owner.service.reviewCustomerQuotation({ grantId, secret });
    assert.equal(review.state, "ready");
    if (review.state === "ready") {
      assert.equal(review.commercial?.labourAmountMinor, 1_000_000);
    }
    const grants = await owner.service.listQuotationCustomerAccess(owner.scope, sent.id);
    assert.equal(grants.length, 1);
    assert.equal(grants[0]?.state, "active");
    assert.equal(JSON.stringify(grants).includes(secret), false);
    await owner.service.revokeQuotationCustomerAccess(owner.scope, grants[0]!.id as never);
    assert.deepEqual(await owner.service.reviewCustomerQuotation({ grantId, secret }), { state: "revoked" });
    const audits = await getClient().execute(
      "SELECT metadata_json FROM audit_events WHERE action = 'frigora.quotation.customer_access_prepared'",
    );
    assert.equal(String(audits.rows[0]?.metadata_json).includes(secret), false);
  });

  it("rejects malformed, cross-bound, repeated, and failed decisions without changing the issued snapshot", async () => {
    const mail = fakeMail();
    const owner = await seed({ now: () => ISSUED_AT, mail: mail.runtime });
    const { customer, site, sent } = await seedSent(owner);
    const { link } = await deliver(owner, mail.messages, sent.id, customer.id, site.id);
    assert.ok(link);
    const grantId = decodeURIComponent(link.pathname.split("/").at(-1) ?? "");
    const secret = readDecisionFragment(link.hash);
    assert.deepEqual(await owner.service.reviewCustomerQuotation({ grantId: "", secret }), { state: "invalid" });
    assert.deepEqual(await owner.service.reviewCustomerQuotation({ grantId, secret: "" }), { state: "invalid" });
    assert.deepEqual(
      await owner.service.reviewCustomerQuotation({ grantId: "grant/other", secret }),
      { state: "invalid" },
    );
    assert.equal(isQuotationDecisionPublicPath("/quotation-decision/grant/other"), false);
    assert.equal(isQuotationDecisionPublicPath(`/ventures/${owner.scope.ventureId}/quotations/${sent.id}`), false);
    const first = await owner.service.reviewCustomerQuotation({ grantId, secret });
    assert.equal(first.state, "ready");
    if (first.state !== "ready") return;
    const gap = renderToStaticMarkup(createElement(QuotationDecisionView, {
      review: { ...first, commercial: null },
    }));
    assert.match(gap, /does not include a stored labour, travel, and tax breakdown/);
    assert.equal(gap.includes("Pty"), false);
    assert.equal(gap.includes(secret), false);
    const shown = renderToStaticMarkup(createElement(QuotationDecisionView, { review: first }));
    assert.match(shown, /Labour/);
    assert.match(shown, /Travel/);
    assert.match(shown, /Subtotal/);
    assert.match(shown, /Not registered/);
    assert.equal(shown.includes("sars-za-vat"), false);
    const posture = await owner.service.getTaxPosture(owner.scope);
    const verified = posture.configurations.find((configuration) => configuration.status === "verified");
    assert.ok(verified);
    await owner.service.revokeVerifiedTaxConfiguration(owner.scope, verified.id);
    const afterTaxChange = await owner.service.reviewCustomerQuotation({ grantId, secret });
    assert.equal(afterTaxChange.state, "ready");
    if (afterTaxChange.state === "ready") {
      assert.equal(afterTaxChange.commercial?.labourAmountMinor, first.commercial?.labourAmountMinor);
      assert.equal(afterTaxChange.commercial?.travelAmountMinor, first.commercial?.travelAmountMinor);
      assert.equal(afterTaxChange.commercial?.taxAmountMinor, first.commercial?.taxAmountMinor);
      assert.equal(afterTaxChange.totalMinor, first.totalMinor);
    }
    const approved = await owner.service.submitCustomerQuotation({ grantId, secret, decision: "approved" });
    assert.deepEqual(approved, { state: "approved", version: 1 });
    const duplicate = await owner.service.submitCustomerQuotation({ grantId, secret, decision: "approved" });
    assert.equal(duplicate.state, "used");
    const opposite = await owner.service.submitCustomerQuotation({ grantId, secret, decision: "declined" });
    assert.equal(opposite.state, "used");
    const decisions = await getClient().execute("SELECT decision FROM frigora_quotation_decisions");
    assert.equal(decisions.rows.length, 1);
    assert.equal(String(decisions.rows[0]?.decision), "approved");

    const failureMail = fakeMail();
    const failureOwner = await seed({ now: () => ISSUED_AT, mail: failureMail.runtime });
    const failureSent = await seedSent(failureOwner);
    const failureDelivery = await deliver(
      failureOwner,
      failureMail.messages,
      failureSent.sent.id,
      failureSent.customer.id,
      failureSent.site.id,
    );
    assert.ok(failureDelivery.link);
    const failureGrantId = decodeURIComponent(failureDelivery.link.pathname.split("/").at(-1) ?? "");
    const failureSecret = readDecisionFragment(failureDelivery.link.hash);
    await getClient().execute(`
      CREATE TRIGGER customer_access_audit_fail
      BEFORE INSERT ON audit_events
      WHEN NEW.action = 'frigora.quotation.customer_access'
      BEGIN
        SELECT RAISE(ABORT, 'forced customer access audit failure');
      END
    `);
    const unavailable = await POST(new Request("https://quotes.example/api/quotation-decision", {
      method: "POST",
      body: JSON.stringify({ action: "review", grantId: failureGrantId, secret: failureSecret }),
    }));
    assert.equal(unavailable.status, 503);
    const unavailableBody = await unavailable.json() as { state: string };
    assert.deepEqual(unavailableBody, { state: "unavailable" });
    assert.equal(JSON.stringify(unavailableBody).includes(failureSecret), false);
    await getClient().execute("DROP TRIGGER customer_access_audit_fail");
    await getClient().execute(`
      CREATE TRIGGER customer_decision_audit_fail
      BEFORE INSERT ON audit_events
      WHEN NEW.action = 'frigora.quotation.customer_decision_recorded'
      BEGIN
        SELECT RAISE(ABORT, 'forced customer decision audit failure');
      END
    `);
    await assert.rejects(
      () => failureOwner.service.submitCustomerQuotation({
        grantId: failureGrantId,
        secret: failureSecret,
        decision: "declined",
      }),
      /forced customer decision audit failure/,
    );
    const unchanged = await failureOwner.service.getQuotation(failureOwner.scope, failureSent.sent.id);
    assert.equal(unchanged?.versions[0]?.status, "awaiting_customer_approval");
    assert.equal(unchanged?.decisions.length, 0);
    const openGrant = await getClient().execute("SELECT consumed_at, revoked_at FROM frigora_quotation_decision_grants");
    assert.equal(openGrant.rows[0]?.consumed_at, null);
    assert.equal(openGrant.rows[0]?.revoked_at, null);
    await getClient().execute("DROP TRIGGER customer_decision_audit_fail");
    await getClient().execute(`
      CREATE TRIGGER customer_revoke_audit_fail
      BEFORE INSERT ON audit_events
      WHEN NEW.action = 'frigora.quotation.customer_access_revoked'
      BEGIN
        SELECT RAISE(ABORT, 'forced customer revoke audit failure');
      END
    `);
    const listed = await failureOwner.service.listQuotationCustomerAccess(failureOwner.scope, failureSent.sent.id);
    await assert.rejects(
      () => failureOwner.service.revokeQuotationCustomerAccess(failureOwner.scope, listed[0]!.id as never),
      /forced customer revoke audit failure/,
    );
    const stillActive = await failureOwner.service.listQuotationCustomerAccess(failureOwner.scope, failureSent.sent.id);
    assert.equal(stillActive[0]?.state, "active");
    const persisted = await failureOwner.service.submitCustomerQuotation({
      grantId: failureGrantId,
      secret: failureSecret,
      decision: "declined",
    });
    assert.deepEqual(persisted, { state: "declined", version: 1 });
    const secondMail = fakeMail();
    const secondOwner = await seed({ now: () => ISSUED_AT, mail: secondMail.runtime });
    const secondSent = await seedSent(secondOwner);
    const secondDelivery = await deliver(
      secondOwner,
      secondMail.messages,
      secondSent.sent.id,
      secondSent.customer.id,
      secondSent.site.id,
    );
    assert.ok(secondDelivery.link);
    await getClient().execute(`
      CREATE TRIGGER customer_decision_row_fail
      BEFORE INSERT ON frigora_quotation_decisions
      BEGIN
        SELECT RAISE(ABORT, 'forced decision persistence failure');
      END
    `);
    await assert.rejects(
      () => secondOwner.service.submitCustomerQuotation({
        grantId: decodeURIComponent(secondDelivery.link?.pathname.split("/").at(-1) ?? ""),
        secret: readDecisionFragment(secondDelivery.link?.hash ?? ""),
        decision: "approved",
      }),
      /forced decision persistence failure/,
    );
    const secondStored = await secondOwner.service.getQuotation(secondOwner.scope, secondSent.sent.id);
    assert.equal(secondStored?.versions[0]?.status, "awaiting_customer_approval");
    assert.equal(secondStored?.decisions.length, 0);
  });

  it("limits every secret for one grant at the API, including the correct secret", async () => {
    const mail = fakeMail();
    const owner = await seed({ now: () => ISSUED_AT, mail: mail.runtime });
    const { customer, site, sent } = await seedSent(owner);
    const { link } = await deliver(owner, mail.messages, sent.id, customer.id, site.id);
    assert.ok(link);
    const grantId = decodeURIComponent(link.pathname.split("/").at(-1) ?? "");
    const secret = readDecisionFragment(link.hash);
    resetQuotationDecisionAttempts();
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const response = await POST(new Request("https://quotes.example/api/quotation-decision", {
        method: "POST",
        body: JSON.stringify({ action: "review", grantId, secret: `wrong-${attempt}` }),
      }));
      assert.equal(response.status, 200);
      const body = await response.json() as { state: string };
      assert.deepEqual(body, { state: "invalid" });
      assert.equal(JSON.stringify(body).includes(secret), false);
    }
    const blockedReview = await POST(new Request("https://quotes.example/api/quotation-decision", {
      method: "POST",
      body: JSON.stringify({ action: "review", grantId, secret }),
    }));
    assert.equal(blockedReview.status, 429);
    const blockedReviewBody = await blockedReview.json() as { state: string };
    assert.deepEqual(blockedReviewBody, { state: "limited" });
    assert.equal(JSON.stringify(blockedReviewBody).includes(secret), false);
    const blockedSubmit = await POST(new Request("https://quotes.example/api/quotation-decision", {
      method: "POST",
      body: JSON.stringify({ action: "submit", grantId, secret, decision: "approved" }),
    }));
    assert.equal(blockedSubmit.status, 429);
    assert.deepEqual(await blockedSubmit.json(), { state: "limited" });
    const stored = await owner.service.getQuotation(owner.scope, sent.id);
    assert.equal(stored?.versions[0]?.status, "awaiting_customer_approval");
    assert.equal(stored?.decisions.length, 0);
    const other = await POST(new Request("https://quotes.example/api/quotation-decision", {
      method: "POST",
      body: JSON.stringify({ action: "review", grantId: `${grantId}-other`, secret: "different" }),
    }));
    assert.notEqual(other.status, 429);
  });

  it("returns invalid for a consumed grant that has no approved or declined decision", async () => {
    await reviewConsumedGrantWithoutDecision();
  });

  it("returns unavailable when a customer submission cannot be saved", async () => {
    await postUnavailableCustomerSubmission();
  });

  it("returns invalid for a grant whose venture is not Frigora", async () => {
    await reviewGrantForNonFrigoraVenture();
  });

  it("returns invalid for malformed customer decision JSON without changing the quotation", async () => {
    await postMalformedCustomerDecision();
  });
});

async function postMalformedCustomerDecision() {
  const fixture = await issuedGrantFixture();
  const response = await POST(new Request("https://quotes.example/api/quotation-decision", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: `{"secret":"${fixture.secret}"`,
  }));
  assert.equal(response.status, 400);
  const body = await response.json() as object;
  assert.deepEqual(body, { state: "invalid" });
  assert.equal(JSON.stringify(body).includes(fixture.secret), false);
  const decisions = await getClient().execute({
    sql: "SELECT id FROM frigora_quotation_decisions WHERE quotation_id = ?",
    args: [fixture.sent.id],
  });
  assert.equal(decisions.rows.length, 0);
  const afterGrant = await getClient().execute({
    sql: `SELECT version_number, document_hash, consumed_at, revoked_at, decision_id
          FROM frigora_quotation_decision_grants WHERE id = ?`,
    args: [fixture.grantId],
  });
  assert.deepEqual(afterGrant.rows[0], fixture.issuedGrant);
  assert.deepEqual(await versionSnapshot(fixture.sent.id, 1), fixture.issuedStored);
}
