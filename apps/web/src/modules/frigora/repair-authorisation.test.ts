import assert from "node:assert/strict";
import { createClient } from "@libsql/client";
import { beforeEach, describe, it } from "node:test";
import type { Role, UserId, VentureId, WorkspaceId } from "@/contracts";
import { createPermissionService } from "@/platform/permissions/service";
import { createDbMembershipStore } from "@/platform/permissions/membership-store";
import { applyFrigoraQuotationIdentitySeals, ensureFrigoraCommercialLinesSchema, ensureSchema, getClient, getDatabaseUrl } from "@/platform/persistence/db";
import { getPersistence, resetPersistenceLifecycle } from "@/platform/persistence/repositories";
import type { PersistedVenture } from "@/platform/persistence/repositories/ports";
import { exampleQuotationCommercial } from "./quotation-commercial";
import { installQuotationDeliveryPayloadTestKeys } from "./quotation-delivery-payload";
import {
  FrigoraError,
  FRIGORA_CUSTOMER_APPROVAL_REQUIRED_MESSAGE,
} from "./errors";
import type { FrigoraMailMessage, FrigoraMailRuntime } from "./mail";
import type { FrigoraWriteClientFactory } from "./owned-write";
import { readDecisionFragment } from "./quotation-decision-fragment";
import { createFrigoraService } from "./service";
import { createFrigoraStore } from "./store";
import { closeFrigoraPersistenceAfterFile } from "./test-persistence-lifecycle";
import { allowSyntheticNotRegisteredQuotationSend } from "./tax-configuration-fixture";
import type {
  FrigoraQuotationId,
  FrigoraRecommendedActionId,
  FrigoraScope,
  FrigoraWorkOrderId,
  QuotationDecisionGrantDelivery,
} from "./types";

const NOW = "2026-10-24T08:00:00.000Z";
const ARRIVED = "2026-10-24T08:05:00.000Z";
const RECOMMENDED_AT = "2026-10-24T08:20:00.000Z";

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

async function seed(options: {
  reset?: boolean;
  role?: Role;
  userId?: UserId;
  workspaceId?: WorkspaceId;
  ventureId?: VentureId;
  createWriteClient?: FrigoraWriteClientFactory;
  mail?: FrigoraMailRuntime;
} = {}) {
  if (options.reset !== false) {
    await resetPersistenceLifecycle();
    await ensureSchema();
  }
  const userId = options.userId ?? ("user-owner" as UserId);
  const workspaceId = options.workspaceId ?? ("ws-frigora" as WorkspaceId);
  const ventureId = options.ventureId ?? ("ven-frigora" as VentureId);
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
  const store = createFrigoraStore({ createWriteClient: options.createWriteClient });
  return {
    workspaceId,
    ventureId,
    userId,
    store,
    scope: { userId, workspaceId, ventureId } satisfies FrigoraScope,
    service: createFrigoraService({
      store,
      permissions: createPermissionService(createDbMembershipStore()),
      now: () => NOW,
      mail: options.mail,
    }),
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

async function expectCode(run: () => Promise<unknown>, code: FrigoraError["code"]) {
  await assert.rejects(run, (error: unknown) => {
    assert.ok(error instanceof FrigoraError, String(error));
    assert.equal(error.code, code);
    assert.equal(error.message.includes("FuelCo"), false);
    assert.equal(error.message.includes("ven-other"), false);
    if (code === "customer_approval_required") {
      assert.equal(error.message, FRIGORA_CUSTOMER_APPROVAL_REQUIRED_MESSAGE);
    }
    return true;
  });
}

async function followUpCount(actionId: string) {
  const result = await getClient().execute({
    sql: "SELECT COUNT(*) AS n FROM frigora_work_orders WHERE source_recommended_action_id = ?",
    args: [actionId],
  });
  return Number(result.rows[0]?.n ?? 0);
}

async function auditActions() {
  const result = await getClient().execute(
    "SELECT action, metadata_json FROM audit_events WHERE action LIKE 'frigora.repair_follow_up.%'",
  );
  return result.rows.map((row) => ({
    action: String(row.action),
    metadata: String(row.metadata_json),
  }));
}

async function sql(statement: string, args: Array<string | number | null> = []) {
  await getClient().execute({ sql: statement, args });
}

function captureDelivery() {
  const secrets: string[] = [];
  const delivery: QuotationDecisionGrantDelivery = {
    async deliver(proof) {
      secrets.push(proof.secret);
    },
  };
  return { secrets, delivery };
}

async function seedRepair(
  owner: Awaited<ReturnType<typeof seed>>,
  options: { quotationRequired?: boolean; reference?: string; suffix?: string } = {},
) {
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
    workReference: options.reference ?? "WO-1864",
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
    ...(options.quotationRequired === undefined
      ? {}
      : { quotationRequired: options.quotationRequired }),
  });
  return { customer, site, asset, workOrder, visit, recommendation, attendeeId };
}

async function sendQuotation(
  owner: Awaited<ReturnType<typeof seed>>,
  recommendationId: FrigoraRecommendedActionId,
) {
  const draft = await owner.service.createQuotation(owner.scope, {
    recommendedActionId: recommendationId,
    description: "Replace compressor",
    commercial: exampleQuotationCommercial(),
  });
  await allowSyntheticNotRegisteredQuotationSend(owner.service, owner.scope);
  return owner.service.sendQuotation(owner.scope, draft.id, {
    expectedCurrentVersion: 1,
    recipient: "accounts@fuelco.test",
  });
}

async function decide(
  owner: Awaited<ReturnType<typeof seed>>,
  quotationId: FrigoraQuotationId,
  customerId: string,
  siteId: string,
  decision: "approved" | "declined",
  version = 1,
) {
  const captured = captureDelivery();
  const grant = await owner.service.issueQuotationDecisionGrant(
    owner.scope,
    quotationId,
    { expectedCurrentVersion: version },
    captured.delivery,
  );
  const secret = captured.secrets[0];
  assert.ok(secret);
  return owner.service.submitQuotationDecision(owner.scope, quotationId, {
    grantId: grant.id,
    secret,
    decision,
    customerId,
    siteId,
  });
}

async function approveAsCustomer(
  owner: Awaited<ReturnType<typeof seed>>,
  messages: FrigoraMailMessage[],
  quotationId: FrigoraQuotationId,
  customerId: string,
  siteId: string,
) {
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
  await owner.service.designateQuotationContact(owner.scope, contact.id, {
    basis: "Office recorded this mailbox as the commercial approver for this site.",
  });
  const verification = await owner.service.requestCustomerContactVerification(owner.scope, contact.id);
  const verificationLines = messages.find((message) => message.text.includes("Verification code:"))?.text.split("\n") ?? [];
  const code = verificationLines[verificationLines.indexOf("Verification code:") + 1] ?? "";
  assert.ok(code);
  await owner.service.confirmCustomerContactEmail(owner.scope, {
    challengeId: verification.challengeId,
    secret: code,
  });
  await owner.service.deliverQuotationDecisionGrant(owner.scope, quotationId, {
    expectedCurrentVersion: 1,
    contactId: contact.id,
  });
  const linkLine = messages
    .flatMap((message) => message.text.split("\n"))
    .find((line) => line.includes("/quotation-decision/"));
  assert.ok(linkLine);
  const link = new URL(linkLine);
  const submitted = await owner.service.submitCustomerQuotation({
    grantId: link.pathname.split("/").at(-1) ?? "",
    secret: readDecisionFragment(link.hash),
    decision: "approved",
  });
  assert.equal(submitted.state, "approved");
  return contact;
}

describe("repair authorisation gate", () => {
  it("defaults quotation-required to false and lets an ordinary follow-up convert", async () => {
    const owner = await seed();
    const repair = await seedRepair(owner);
    assert.equal(repair.recommendation.quotationRequired, false);
    const followUp = await owner.service.convertRecommendedActionToFollowUpWorkOrder(
      owner.scope,
      repair.recommendation.id,
    );
    assert.equal(followUp.sourceRecommendedActionId, repair.recommendation.id);
    assert.equal(followUp.authorisingQuotationId, null);
    assert.equal(followUp.authorisingQuotationVersion, null);
    assert.equal(followUp.status, "open");
    assert.equal(followUp.assignedUserId, null);
    const engineer = "user-engineer" as UserId;
    await getPersistence().memberships.setRole({
      userId: engineer,
      workspaceId: owner.workspaceId,
      role: "member",
      createdAt: NOW,
    });
    const unrelated = await owner.service.createWorkOrder(owner.scope, {
      siteId: repair.site.id,
      workReference: "WO-UNRELATED",
      workKind: "planned",
      primaryAssetId: repair.asset.id,
    });
    const assigned = await owner.service.assignWorkOrder(owner.scope, unrelated.id, {
      userId: engineer,
      expectedUpdatedAt: unrelated.updatedAt,
    });
    assert.equal(assigned.assignedUserId, engineer);
    assert.equal(assigned.sourceRecommendedActionId, null);
    assert.equal(assigned.authorisingQuotationId, null);
  });

  it("persists an explicit quotation requirement and rejects a member designation", async () => {
    const owner = await seed();
    const repair = await seedRepair(owner);
    const member = await seed({
      reset: false,
      role: "member",
      userId: "user-member" as UserId,
    });
    await expectCode(
      () =>
        member.service.setRecommendedActionQuotationRequirement(
          member.scope,
          repair.recommendation.id,
          { quotationRequired: true },
        ),
      "forbidden",
    );
    const designated = await owner.service.setRecommendedActionQuotationRequirement(
      owner.scope,
      repair.recommendation.id,
      { quotationRequired: true },
    );
    assert.equal(designated.quotationRequired, true);
    const stored = await owner.service.getRecommendedAction(owner.scope, repair.recommendation.id);
    assert.equal(stored?.quotationRequired, true);
    const recorded = await owner.service.recordRecommendedAction(owner.scope, repair.visit.id, {
      description: "Replace fan motor",
      recommendedAt: "2026-10-24T08:25:00.000Z",
      recommendedByUserId: repair.attendeeId,
      recordedByUserId: repair.attendeeId,
      assetId: repair.asset.id,
      quotationRequired: true,
    });
    assert.equal(recorded.quotationRequired, true);
    const unchanged = await owner.service.getRecommendedAction(owner.scope, repair.recommendation.id);
    assert.equal(unchanged?.quotationRequired, true);
    await expectCode(
      () =>
        owner.service.setRecommendedActionQuotationRequirement(
          owner.scope,
          repair.recommendation.id,
          { quotationRequired: false },
        ),
      "invalid_status",
    );
    await expectCode(
      () =>
        owner.service.setRecommendedActionQuotationRequirement(
          owner.scope,
          repair.recommendation.id,
          {} as never,
        ),
      "invalid_input",
    );
    const afterClearAttempt = await owner.service.getRecommendedAction(
      owner.scope,
      repair.recommendation.id,
    );
    assert.equal(afterClearAttempt?.quotationRequired, true);
    const omitted = await owner.service.recordRecommendedAction(owner.scope, repair.visit.id, {
      description: "Monitor the cabinet",
      recommendedAt: "2026-10-24T08:30:00.000Z",
      recommendedByUserId: repair.attendeeId,
      recordedByUserId: repair.attendeeId,
      assetId: repair.asset.id,
    });
    assert.equal(omitted.quotationRequired, false);
    assert.equal(
      (await owner.service.getRecommendedAction(owner.scope, repair.recommendation.id))
        ?.quotationRequired,
      true,
    );
  });

  it("converts a quotation-required repair only when the current version is approved", async () => {
    const mail = fakeMail();
    const owner = await seed({ mail: mail.runtime });
    const repair = await seedRepair(owner, { quotationRequired: true });
    const sent = await sendQuotation(owner, repair.recommendation.id);
    const contact = await approveAsCustomer(
      owner,
      mail.messages,
      sent.id,
      repair.customer.id,
      repair.site.id,
    );
    const approved = await owner.service.getQuotation(owner.scope, sent.id);
    assert.equal(approved?.versions[0]?.status, "approved");
    const event = approved?.events.find((item) => item.kind === "approved");
    assert.equal(event?.actorContactId, contact.id);
    assert.equal(event?.actorUserId, null);
    const before = await owner.service.getRecommendedAction(owner.scope, repair.recommendation.id);
    const followUp = await owner.service.convertRecommendedActionToFollowUpWorkOrder(
      owner.scope,
      repair.recommendation.id,
    );
    assert.equal(followUp.authorisingQuotationId, sent.id);
    assert.equal(followUp.authorisingQuotationVersion, 1);
    assert.equal(followUp.sourceRecommendedActionId, repair.recommendation.id);
    assert.equal(followUp.customerId, repair.customer.id);
    assert.equal(followUp.siteId, repair.site.id);
    assert.equal(followUp.primaryAssetId, repair.asset.id);
    const after = await owner.service.getRecommendedAction(owner.scope, repair.recommendation.id);
    assert.equal(after?.updatedAt, before?.updatedAt);
    assert.equal(after?.description, before?.description);
    await expectCode(
      () =>
        owner.service.convertRecommendedActionToFollowUpWorkOrder(
          owner.scope,
          repair.recommendation.id,
        ),
      "duplicate",
    );
    assert.equal(await followUpCount(repair.recommendation.id), 1);
    const audits = await auditActions();
    assert.equal(audits.some((row) => row.action === "frigora.repair_follow_up.converted"), true);
    assert.equal(audits.some((row) => row.metadata.includes(sent.id)), true);
  });

  it("rejects conversion when no quotation, draft, awaiting, or declined evidence exists", async () => {
    const missing = await seed();
    const missingRepair = await seedRepair(missing, { quotationRequired: true });
    await expectCode(
      () =>
        missing.service.convertRecommendedActionToFollowUpWorkOrder(
          missing.scope,
          missingRepair.recommendation.id,
        ),
      "customer_approval_required",
    );
    assert.equal(await followUpCount(missingRepair.recommendation.id), 0);

    const draftOwner = await seed();
    const draftRepair = await seedRepair(draftOwner, { quotationRequired: true, reference: "WO-DRAFT" });
    await draftOwner.service.createQuotation(draftOwner.scope, {
      recommendedActionId: draftRepair.recommendation.id,
      description: "Replace compressor",
      commercial: exampleQuotationCommercial({
        labourQuantityMilli: 1,
        travelKilometresMilli: 0,
        travelRateMinor: 0,
      }),
    });
    await expectCode(
      () =>
        draftOwner.service.convertRecommendedActionToFollowUpWorkOrder(
          draftOwner.scope,
          draftRepair.recommendation.id,
        ),
      "customer_approval_required",
    );
    assert.equal(await followUpCount(draftRepair.recommendation.id), 0);

    const waiting = await seed();
    const waitingRepair = await seedRepair(waiting, { quotationRequired: true, reference: "WO-WAIT" });
    await sendQuotation(waiting, waitingRepair.recommendation.id);
    await expectCode(
      () =>
        waiting.service.convertRecommendedActionToFollowUpWorkOrder(
          waiting.scope,
          waitingRepair.recommendation.id,
        ),
      "customer_approval_required",
    );

    const declinedOwner = await seed();
    const declinedRepair = await seedRepair(declinedOwner, {
      quotationRequired: true,
      reference: "WO-NO",
    });
    const declinedSent = await sendQuotation(declinedOwner, declinedRepair.recommendation.id);
    await decide(
      declinedOwner,
      declinedSent.id,
      declinedRepair.customer.id,
      declinedRepair.site.id,
      "declined",
    );
    const unchanged = await declinedOwner.service.getRecommendedAction(
      declinedOwner.scope,
      declinedRepair.recommendation.id,
    );
    await expectCode(
      () =>
        declinedOwner.service.convertRecommendedActionToFollowUpWorkOrder(
          declinedOwner.scope,
          declinedRepair.recommendation.id,
        ),
      "customer_approval_required",
    );
    const still = await declinedOwner.service.getRecommendedAction(
      declinedOwner.scope,
      declinedRepair.recommendation.id,
    );
    assert.equal(still?.updatedAt, unchanged?.updatedAt);
    assert.equal(await followUpCount(declinedRepair.recommendation.id), 0);
    const audits = await auditActions();
    const rejected = audits.filter(
      (row) =>
        row.action === "frigora.repair_follow_up.rejected" &&
        row.metadata.includes(declinedRepair.recommendation.id),
    );
    assert.equal(rejected.length, 1);
    assert.equal(rejected[0]?.metadata.includes("FuelCo"), false);
  });

  it("does not let an older approved version authorise a revised quotation", async () => {
    const mail = fakeMail();
    const owner = await seed({ mail: mail.runtime });
    const repair = await seedRepair(owner, { quotationRequired: true });
    const sent = await sendQuotation(owner, repair.recommendation.id);
    await approveAsCustomer(owner, mail.messages, sent.id, repair.customer.id, repair.site.id);
    const revised = await owner.service.reviseQuotation(owner.scope, sent.id, {
      expectedCurrentVersion: 1,
      description: "Replace compressor and fan",
      commercial: exampleQuotationCommercial({ travelRateMinor: 6000 }),
    });
    assert.equal(revised.currentVersion, 2);
    const current = revised.versions.find((version) => Number(version.version) === 2);
    assert.equal(current?.status, "in_preparation");
    const historical = await getClient().execute({
      sql: "SELECT status FROM frigora_quotation_versions WHERE quotation_id = ? AND version_number = 1",
      args: [sent.id],
    });
    assert.equal(String(historical.rows[0]?.status), "approved");
    await expectCode(
      () =>
        owner.service.convertRecommendedActionToFollowUpWorkOrder(
          owner.scope,
          repair.recommendation.id,
        ),
      "customer_approval_required",
    );
    assert.equal(await followUpCount(repair.recommendation.id), 0);
  });

  it("rejects a quotation whose scope, repair linkage, or decision evidence does not match", async () => {
    async function approvedRepair(reference: string) {
      const mail = fakeMail();
      const owner = await seed({ mail: mail.runtime });
      const repair = await seedRepair(owner, { quotationRequired: true, reference });
      const sent = await sendQuotation(owner, repair.recommendation.id);
      await approveAsCustomer(owner, mail.messages, sent.id, repair.customer.id, repair.site.id);
      return { owner, repair, sent };
    }

    const otherVenture = await approvedRepair("WO-VEN");
    await ensureFrigoraCommercialLinesSchema();
    await assert.rejects(
      () =>
        sql("UPDATE frigora_quotations SET venture_id = ? WHERE id = ?", [
          "ven-other",
          otherVenture.sent.id,
        ]),
      /quotation identity and version history cannot be rewritten/i,
    );
    const storedVenture = await getClient().execute({
      sql: "SELECT venture_id FROM frigora_quotations WHERE id = ?",
      args: [otherVenture.sent.id],
    });
    assert.equal(String(storedVenture.rows[0]?.venture_id), otherVenture.owner.ventureId);
    assert.equal(await followUpCount(otherVenture.repair.recommendation.id), 0);

    const otherCustomer = await approvedRepair("WO-CUS");
    await sql("UPDATE frigora_quotations SET customer_id = ? WHERE id = ?", [
      "customer-other",
      otherCustomer.sent.id,
    ]);
    await expectCode(
      () =>
        otherCustomer.owner.service.convertRecommendedActionToFollowUpWorkOrder(
          otherCustomer.owner.scope,
          otherCustomer.repair.recommendation.id,
        ),
      "customer_approval_required",
    );

    const otherSite = await approvedRepair("WO-SITE");
    await sql("UPDATE frigora_quotations SET site_id = ? WHERE id = ?", [
      "site-other",
      otherSite.sent.id,
    ]);
    await expectCode(
      () =>
        otherSite.owner.service.convertRecommendedActionToFollowUpWorkOrder(
          otherSite.owner.scope,
          otherSite.repair.recommendation.id,
        ),
      "customer_approval_required",
    );

    const otherAsset = await approvedRepair("WO-ASSET");
    await sql("UPDATE frigora_quotations SET asset_id = ? WHERE id = ?", [
      "asset-other",
      otherAsset.sent.id,
    ]);
    await expectCode(
      () =>
        otherAsset.owner.service.convertRecommendedActionToFollowUpWorkOrder(
          otherAsset.owner.scope,
          otherAsset.repair.recommendation.id,
        ),
      "customer_approval_required",
    );

    const otherWork = await approvedRepair("WO-SRC");
    await sql("UPDATE frigora_quotations SET original_work_order_id = ? WHERE id = ?", [
      "wo-other",
      otherWork.sent.id,
    ]);
    await expectCode(
      () =>
        otherWork.owner.service.convertRecommendedActionToFollowUpWorkOrder(
          otherWork.owner.scope,
          otherWork.repair.recommendation.id,
        ),
      "customer_approval_required",
    );

    const otherAction = await approvedRepair("WO-ACT");
    await sql("UPDATE frigora_quotations SET recommended_action_id = ? WHERE id = ?", [
      "action-other",
      otherAction.sent.id,
    ]);
    await expectCode(
      () =>
        otherAction.owner.service.convertRecommendedActionToFollowUpWorkOrder(
          otherAction.owner.scope,
          otherAction.repair.recommendation.id,
        ),
      "customer_approval_required",
    );

    const missingDecision = await approvedRepair("WO-DEC");
    await sql("DROP TRIGGER IF EXISTS frigora_quotation_decisions_no_delete");
    await sql("DELETE FROM frigora_quotation_decisions WHERE quotation_id = ?", [
      missingDecision.sent.id,
    ]);
    await expectCode(
      () =>
        missingDecision.owner.service.convertRecommendedActionToFollowUpWorkOrder(
          missingDecision.owner.scope,
          missingDecision.repair.recommendation.id,
        ),
      "customer_approval_required",
    );

    const badHash = await approvedRepair("WO-HASH");
    await sql("DROP TRIGGER IF EXISTS frigora_quotation_decisions_no_update");
    await sql("UPDATE frigora_quotation_decisions SET document_hash = ? WHERE quotation_id = ?", [
      "forged-hash",
      badHash.sent.id,
    ]);
    await expectCode(
      () =>
        badHash.owner.service.convertRecommendedActionToFollowUpWorkOrder(
          badHash.owner.scope,
          badHash.repair.recommendation.id,
        ),
      "customer_approval_required",
    );
    assert.equal(await followUpCount(badHash.repair.recommendation.id), 0);
    assert.equal(await followUpCount(missingDecision.repair.recommendation.id), 0);
  });

  it("ignores a caller-supplied approval and blocks a direct work-order bypass", async () => {
    const owner = await seed();
    const repair = await seedRepair(owner, { quotationRequired: true });
    await sendQuotation(owner, repair.recommendation.id);
    await expectCode(
      () =>
        (
          owner.service.convertRecommendedActionToFollowUpWorkOrder as (
            scope: FrigoraScope,
            id: FrigoraRecommendedActionId,
            forged?: {
              status: "approved";
              version: number;
              documentHash: string;
              approved: boolean;
            },
          ) => Promise<unknown>
        )(owner.scope, repair.recommendation.id, {
          status: "approved",
          version: 1,
          documentHash: "forged",
          approved: true,
        }),
      "customer_approval_required",
    );
    const direct = await owner.service.createWorkOrder(owner.scope, {
      siteId: repair.site.id,
      workReference: "WO-DIRECT",
      workKind: "reactive",
      primaryAssetId: repair.asset.id,
      sourceRecommendedActionId: repair.recommendation.id,
      quotationStatus: "approved",
      approved: true,
    } as never);
    assert.equal(direct.sourceRecommendedActionId, null);
    assert.equal(direct.authorisingQuotationId, null);
    const updated = await owner.service.updateWorkOrder(owner.scope, direct.id, {
      reportedCondition: "still unrelated",
      sourceRecommendedActionId: repair.recommendation.id,
      approved: true,
    } as never);
    assert.equal(updated.sourceRecommendedActionId, null);
    assert.equal(await followUpCount(repair.recommendation.id), 0);
  });

  it("lets one concurrent conversion win and keeps a stale approval from winning a revision race", async () => {
    const mail = fakeMail();
    const owner = await seed({
      mail: mail.runtime,
      createWriteClient: () => createClient({ url: getDatabaseUrl(), timeout: 5000 }),
    });
    const repair = await seedRepair(owner, { quotationRequired: true });
    const sent = await sendQuotation(owner, repair.recommendation.id);
    await approveAsCustomer(owner, mail.messages, sent.id, repair.customer.id, repair.site.id);
    const raced = await Promise.allSettled([
      owner.service.convertRecommendedActionToFollowUpWorkOrder(
        owner.scope,
        repair.recommendation.id,
      ),
      owner.service.convertRecommendedActionToFollowUpWorkOrder(
        owner.scope,
        repair.recommendation.id,
      ),
    ]);
    const fulfilled = raced.filter((row) => row.status === "fulfilled");
    const rejected = raced.filter((row) => row.status === "rejected");
    assert.equal(fulfilled.length, 1);
    assert.equal(rejected.length, 1);
    assert.ok(rejected[0]?.status === "rejected");
    assert.ok(rejected[0].reason instanceof FrigoraError);
    assert.ok(
      rejected[0].reason.code === "duplicate" || rejected[0].reason.code === "quotation_conflict",
    );
    assert.equal(await followUpCount(repair.recommendation.id), 1);
    await expectCode(
      () =>
        owner.service.convertRecommendedActionToFollowUpWorkOrder(
          owner.scope,
          repair.recommendation.id,
        ),
      "duplicate",
    );
    assert.equal(await followUpCount(repair.recommendation.id), 1);

    const raceMail = fakeMail();
    const racing = await seed({
      mail: raceMail.runtime,
      createWriteClient: () => createClient({ url: getDatabaseUrl(), timeout: 5000 }),
    });
    const held = await seedRepair(racing, { quotationRequired: true, reference: "WO-RACE" });
    const heldSent = await sendQuotation(racing, held.recommendation.id);
    await approveAsCustomer(
      racing,
      raceMail.messages,
      heldSent.id,
      held.customer.id,
      held.site.id,
    );
    const holder = createClient({ url: getDatabaseUrl(), timeout: 5000 });
    const lock = await holder.transaction("write");
    await lock.execute("SELECT 1");
    const pending = racing.service.convertRecommendedActionToFollowUpWorkOrder(
      racing.scope,
      held.recommendation.id,
    );
    await lock.execute({
      sql: `
        INSERT INTO frigora_quotation_versions (
          quotation_id, workspace_id, venture_id, version_number, status, description,
          total_minor, currency, document_hash, sent_at, recipient, dispatch_evidence_ref
        )
        SELECT id, workspace_id, venture_id, 2, 'in_preparation', 'Revised after approval',
          1600000, 'ZAR', 'revision-hash', NULL, NULL, NULL
        FROM frigora_quotations
        WHERE id = ? AND current_version = 1
      `,
      args: [heldSent.id],
    });
    const bumped = await lock.execute({
      sql: `
        UPDATE frigora_quotations
        SET current_version = 2, updated_at = ?
        WHERE id = ? AND current_version = 1
      `,
      args: [NOW, heldSent.id],
    });
    assert.equal(bumped.rowsAffected, 1);
    await lock.commit();
    lock.close();
    holder.close();
    await expectCode(() => pending, "customer_approval_required");
    assert.equal(await followUpCount(held.recommendation.id), 0);
    const versions = await getClient().execute({
      sql: `
        SELECT version_number, status
        FROM frigora_quotation_versions
        WHERE quotation_id = ?
        ORDER BY version_number
      `,
      args: [heldSent.id],
    });
    assert.equal(String(versions.rows[0]?.status), "approved");
    assert.equal(Number(versions.rows[0]?.version_number), 1);
    assert.equal(String(versions.rows[1]?.status), "in_preparation");
    assert.equal(Number(versions.rows[1]?.version_number), 2);
  });

  it("rejects an office-recorded approval and a customer grant consumed by an office user", async () => {
    const office = await seed();
    const officeRepair = await seedRepair(office, { quotationRequired: true });
    const officeSent = await sendQuotation(office, officeRepair.recommendation.id);
    await decide(office, officeSent.id, officeRepair.customer.id, officeRepair.site.id, "approved");
    await expectCode(
      () =>
        office.service.convertRecommendedActionToFollowUpWorkOrder(
          office.scope,
          officeRepair.recommendation.id,
        ),
      "customer_approval_required",
    );
    assert.equal(await followUpCount(officeRepair.recommendation.id), 0);
    const officeAudits = (await auditActions()).filter(
      (row) =>
        row.action === "frigora.repair_follow_up.rejected" &&
        row.metadata.includes(officeRepair.recommendation.id),
    );
    assert.equal(officeAudits.length, 1);

    const mail = fakeMail();
    const owner = await seed({ mail: mail.runtime });
    const repair = await seedRepair(owner, { quotationRequired: true, reference: "WO-OFFICE-GRANT" });
    const sent = await sendQuotation(owner, repair.recommendation.id);
    await owner.service.setVentureMailIdentity(owner.scope, {
      fromName: "Frigora Quotes",
      fromEmail: "quotes@quotes.example",
    });
    const contact = await owner.service.createCustomerContact(owner.scope, {
      customerId: repair.customer.id,
      siteId: repair.site.id,
      displayName: "Amina Naidoo",
      email: "amina@fuelco.test",
    });
    await owner.service.designateQuotationContact(owner.scope, contact.id, {
      basis: "Office recorded this mailbox as the commercial approver for this site.",
    });
    const verification = await owner.service.requestCustomerContactVerification(owner.scope, contact.id);
    const verificationLines = mail.messages.find((message) => message.text.includes("Verification code:"))?.text.split("\n") ?? [];
    const code = verificationLines[verificationLines.indexOf("Verification code:") + 1] ?? "";
    await owner.service.confirmCustomerContactEmail(owner.scope, {
      challengeId: verification.challengeId,
      secret: code,
    });
    await owner.service.deliverQuotationDecisionGrant(owner.scope, sent.id, {
      expectedCurrentVersion: 1,
      contactId: contact.id,
    });
    const linkLine = mail.messages
      .flatMap((message) => message.text.split("\n"))
      .find((line) => line.includes("/quotation-decision/"));
    assert.ok(linkLine);
    const link = new URL(linkLine);
    const recorded = await owner.service.submitQuotationDecision(owner.scope, sent.id, {
      grantId: link.pathname.split("/").at(-1) ?? "",
      secret: readDecisionFragment(link.hash),
      decision: "approved",
      customerId: repair.customer.id,
      siteId: repair.site.id,
    });
    assert.equal(recorded.versions.find((version) => Number(version.version) === 1)?.status, "approved");
    const actor = await getClient().execute({
      sql: `
        SELECT actor_user_id, actor_contact_id
        FROM frigora_quotation_events
        WHERE quotation_id = ? AND kind = 'approved'
      `,
      args: [sent.id],
    });
    assert.equal(String(actor.rows[0]?.actor_user_id), owner.userId);
    assert.equal(actor.rows[0]?.actor_contact_id, null);
    await expectCode(
      () =>
        owner.service.convertRecommendedActionToFollowUpWorkOrder(
          owner.scope,
          repair.recommendation.id,
        ),
      "customer_approval_required",
    );
    assert.equal(await followUpCount(repair.recommendation.id), 0);
  });

  it("rejects an unused grant and a customer approval whose contact evidence was changed", async () => {
    const mail = fakeMail();
    const unused = await seed({ mail: mail.runtime });
    const unusedRepair = await seedRepair(unused, { quotationRequired: true, reference: "WO-UNUSED" });
    const unusedSent = await sendQuotation(unused, unusedRepair.recommendation.id);
    await unused.service.setVentureMailIdentity(unused.scope, {
      fromName: "Frigora Quotes",
      fromEmail: "quotes@quotes.example",
    });
    const contact = await unused.service.createCustomerContact(unused.scope, {
      customerId: unusedRepair.customer.id,
      siteId: unusedRepair.site.id,
      displayName: "Amina Naidoo",
      email: "amina@fuelco.test",
    });
    await unused.service.designateQuotationContact(unused.scope, contact.id, {
      basis: "Office recorded this mailbox as the commercial approver for this site.",
    });
    const verification = await unused.service.requestCustomerContactVerification(unused.scope, contact.id);
    const verificationLines = mail.messages.find((message) => message.text.includes("Verification code:"))?.text.split("\n") ?? [];
    const code = verificationLines[verificationLines.indexOf("Verification code:") + 1] ?? "";
    await unused.service.confirmCustomerContactEmail(unused.scope, {
      challengeId: verification.challengeId,
      secret: code,
    });
    await unused.service.deliverQuotationDecisionGrant(unused.scope, unusedSent.id, {
      expectedCurrentVersion: 1,
      contactId: contact.id,
    });
    const grant = await getClient().execute({
      sql: "SELECT consumed_at FROM frigora_quotation_decision_grants WHERE quotation_id = ?",
      args: [unusedSent.id],
    });
    assert.equal(grant.rows[0]?.consumed_at, null);
    await expectCode(
      () =>
        unused.service.convertRecommendedActionToFollowUpWorkOrder(
          unused.scope,
          unusedRepair.recommendation.id,
        ),
      "customer_approval_required",
    );

    const approvedMail = fakeMail();
    const owner = await seed({ mail: approvedMail.runtime });
    const repair = await seedRepair(owner, { quotationRequired: true, reference: "WO-CONTACT" });
    const sent = await sendQuotation(owner, repair.recommendation.id);
    await approveAsCustomer(owner, approvedMail.messages, sent.id, repair.customer.id, repair.site.id);
    await sql("DROP TRIGGER IF EXISTS frigora_quotation_events_no_update");
    await sql(
      "UPDATE frigora_quotation_events SET actor_contact_id = ? WHERE quotation_id = ? AND kind = 'approved'",
      ["contact-other", sent.id],
    );
    await expectCode(
      () =>
        owner.service.convertRecommendedActionToFollowUpWorkOrder(
          owner.scope,
          repair.recommendation.id,
        ),
      "customer_approval_required",
    );
    assert.equal(await followUpCount(repair.recommendation.id), 0);
    const consumedMail = fakeMail();
    const consumedOwner = await seed({ mail: consumedMail.runtime });
    const consumedRepair = await seedRepair(consumedOwner, {
      quotationRequired: true,
      reference: "WO-UNCONSUMED",
    });
    const consumedSent = await sendQuotation(consumedOwner, consumedRepair.recommendation.id);
    await approveAsCustomer(
      consumedOwner,
      consumedMail.messages,
      consumedSent.id,
      consumedRepair.customer.id,
      consumedRepair.site.id,
    );
    await sql("DROP TRIGGER IF EXISTS frigora_quotation_decision_grants_consume_only");
    await sql(
      "UPDATE frigora_quotation_decision_grants SET consumed_at = NULL, decision_id = NULL WHERE quotation_id = ?",
      [consumedSent.id],
    );
    await expectCode(
      () =>
        consumedOwner.service.convertRecommendedActionToFollowUpWorkOrder(
          consumedOwner.scope,
          consumedRepair.recommendation.id,
        ),
      "customer_approval_required",
    );
    assert.equal(await followUpCount(consumedRepair.recommendation.id), 0);
  });

  it("reads a designation that commits before conversion and blocks a linked low-level insert", async () => {
    const owner = await seed({
      createWriteClient: () => createClient({ url: getDatabaseUrl(), timeout: 5000 }),
    });
    const repair = await seedRepair(owner);
    assert.equal(repair.recommendation.quotationRequired, false);
    const holder = createClient({ url: getDatabaseUrl(), timeout: 5000 });
    const lock = await holder.transaction("write");
    await lock.execute("SELECT 1");
    const pending = owner.service.convertRecommendedActionToFollowUpWorkOrder(
      owner.scope,
      repair.recommendation.id,
    );
    const updated = await lock.execute({
      sql: "UPDATE frigora_recommended_actions SET quotation_required = 1 WHERE id = ?",
      args: [repair.recommendation.id],
    });
    assert.equal(updated.rowsAffected, 1);
    await lock.commit();
    lock.close();
    holder.close();
    await expectCode(() => pending, "customer_approval_required");
    assert.equal(await followUpCount(repair.recommendation.id), 0);
    const designated = await owner.service.getRecommendedAction(owner.scope, repair.recommendation.id);
    assert.equal(designated?.quotationRequired, true);

    const ordinary = await owner.service.createWorkOrder(owner.scope, {
      siteId: repair.site.id,
      workReference: "WO-PLAIN",
      workKind: "planned",
    });
    assert.equal(ordinary.sourceRecommendedActionId, null);
    await expectCode(
      () =>
        owner.store.insertWorkOrder({
          ...ordinary,
          id: "wo-linked-bypass" as FrigoraWorkOrderId,
          workReference: "WO-LINKED",
          sourceRecommendedActionId: repair.recommendation.id,
          authorisingQuotationId: null,
          authorisingQuotationVersion: null,
        }),
      "customer_approval_required",
    );
    assert.equal(await followUpCount(repair.recommendation.id), 0);
  });

  it("rolls back a follow-up when the conversion audit insert fails, then retries once", async () => {
    const mail = fakeMail();
    const owner = await seed({ mail: mail.runtime });
    const repair = await seedRepair(owner, { quotationRequired: true, reference: "WO-AUDIT" });
    const sent = await sendQuotation(owner, repair.recommendation.id);
    await approveAsCustomer(owner, mail.messages, sent.id, repair.customer.id, repair.site.id);
    await sql(`
      CREATE TRIGGER frigora_repair_converted_audit_fail
      BEFORE INSERT ON audit_events
      WHEN NEW.action = 'frigora.repair_follow_up.converted'
      BEGIN
        SELECT RAISE(ABORT, 'injected audit failure');
      END
    `);
    try {
      await assert.rejects(
        () =>
          owner.service.convertRecommendedActionToFollowUpWorkOrder(
            owner.scope,
            repair.recommendation.id,
          ),
        /audit evidence failed to persist/,
      );
      assert.equal(await followUpCount(repair.recommendation.id), 0);
      const failedAudits = (await auditActions()).filter(
        (row) =>
          row.action === "frigora.repair_follow_up.converted" &&
          row.metadata.includes(repair.recommendation.id),
      );
      assert.equal(failedAudits.length, 0);
    } finally {
      await sql("DROP TRIGGER IF EXISTS frigora_repair_converted_audit_fail");
    }
    const followUp = await owner.service.convertRecommendedActionToFollowUpWorkOrder(
      owner.scope,
      repair.recommendation.id,
    );
    assert.equal(followUp.authorisingQuotationId, sent.id);
    assert.equal(followUp.authorisingQuotationVersion, 1);
    assert.equal(followUp.sourceRecommendedActionId, repair.recommendation.id);
    const converted = (await auditActions()).filter(
      (row) =>
        row.action === "frigora.repair_follow_up.converted" &&
        row.metadata.includes(repair.recommendation.id),
    );
    assert.equal(converted.length, 1);
    assert.equal(converted[0]?.metadata.includes(followUp.id), true);
    assert.equal(converted[0]?.metadata.includes(sent.id), true);
    await expectCode(
      () =>
        owner.service.convertRecommendedActionToFollowUpWorkOrder(
          owner.scope,
          repair.recommendation.id,
        ),
      "duplicate",
    );
    assert.equal(await followUpCount(repair.recommendation.id), 1);
    assert.equal(
      (await auditActions()).filter(
        (row) =>
          row.action === "frigora.repair_follow_up.converted" &&
          row.metadata.includes(repair.recommendation.id),
      ).length,
      1,
    );
  });

  it("rejects a late quotation designation after an ordinary follow-up exists", async () => {
    const owner = await seed();
    const repair = await seedRepair(owner);
    assert.equal(repair.recommendation.quotationRequired, false);
    const followUp = await owner.service.convertRecommendedActionToFollowUpWorkOrder(
      owner.scope,
      repair.recommendation.id,
    );
    assert.equal(followUp.authorisingQuotationId, null);
    assert.equal(followUp.sourceRecommendedActionId, repair.recommendation.id);
    const beforeAction = await owner.service.getRecommendedAction(owner.scope, repair.recommendation.id);
    const beforeOrder = await owner.service.getWorkOrder(owner.scope, followUp.id);
    await expectCode(
      () =>
        owner.service.setRecommendedActionQuotationRequirement(
          owner.scope,
          repair.recommendation.id,
          { quotationRequired: true },
        ),
      "invalid_status",
    );
    const afterAction = await owner.service.getRecommendedAction(owner.scope, repair.recommendation.id);
    const afterOrder = await owner.service.getWorkOrder(owner.scope, followUp.id);
    assert.equal(afterAction?.quotationRequired, false);
    assert.equal(afterAction?.updatedAt, beforeAction?.updatedAt);
    assert.equal(afterOrder?.id, beforeOrder?.id);
    assert.equal(afterOrder?.status, beforeOrder?.status);
    assert.equal(afterOrder?.updatedAt, beforeOrder?.updatedAt);
    assert.equal(afterOrder?.sourceRecommendedActionId, repair.recommendation.id);
    assert.equal(afterOrder?.authorisingQuotationId, null);
    assert.equal(afterOrder?.authorisingQuotationVersion, null);
  });

  it("keeps grant approval and the original follow-up working after identity seals are installed", async () => {
    const url = getDatabaseUrl();
    if (url.toLowerCase().includes("ventureos.db") || url.toLowerCase().includes("frg-r1-v2-hosted")) {
      throw new Error("Refusing a protected database");
    }
    const mail = fakeMail();
    const owner = await seed({ mail: mail.runtime });
    const repair = await seedRepair(owner, { quotationRequired: true, reference: "WO-SEAL" });
    const sent = await sendQuotation(owner, repair.recommendation.id);
    await applyFrigoraQuotationIdentitySeals();
    const seals = await getClient().execute({
      sql: `SELECT copy, customer_id, site_id, asset_id, original_work_order_id, recommended_action_id
            FROM frigora_quotation_identity_seals WHERE quotation_id = ? ORDER BY copy`,
      args: [sent.id],
    });
    assert.equal(seals.rows.length, 2);
    await approveAsCustomer(owner, mail.messages, sent.id, repair.customer.id, repair.site.id);
    const followUp = await owner.service.convertRecommendedActionToFollowUpWorkOrder(
      owner.scope,
      repair.recommendation.id,
    );
    assert.equal(followUp.authorisingQuotationId, sent.id);
    assert.equal(followUp.authorisingQuotationVersion, 1);
    assert.equal(followUp.customerId, repair.customer.id);
    assert.equal(followUp.siteId, repair.site.id);
    assert.equal(followUp.primaryAssetId, repair.asset.id);
    const header = await getClient().execute({
      sql: `SELECT customer_id, site_id, asset_id, original_work_order_id, recommended_action_id
            FROM frigora_quotations WHERE id = ?`,
      args: [sent.id],
    });
    assert.equal(String(header.rows[0]?.customer_id), repair.customer.id);
    assert.equal(String(header.rows[0]?.site_id), repair.site.id);
    assert.equal(String(header.rows[0]?.asset_id), repair.asset.id);
    assert.equal(String(header.rows[0]?.original_work_order_id), repair.workOrder.id);
    assert.equal(String(header.rows[0]?.recommended_action_id), repair.recommendation.id);
  });
});
