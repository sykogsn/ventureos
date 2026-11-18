import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it, beforeEach } from "node:test";
import { fileURLToPath } from "node:url";
import type { UserId, VentureId, WorkspaceId } from "@/contracts";
import { createPermissionService } from "@/platform/permissions/service";
import { createDbMembershipStore } from "@/platform/permissions/membership-store";
import { ensureSchema, getClient, getDatabaseUrl } from "@/platform/persistence/db";
import { getPersistence, resetPersistenceLifecycle } from "@/platform/persistence/repositories";
import type { PersistedVenture } from "@/platform/persistence/repositories/ports";
import { FrigoraError } from "./errors";
import { exampleQuotationCommercial, priceQuotationCommercial, quotationDocumentHash } from "./quotation-commercial";
import { QUOTATION_ISSUE_AUDIT_ACTION, QUOTATION_ISSUE_INTERRUPTED } from "./quotation-delivery";
import { createFrigoraService } from "./service";
import { createFrigoraStore } from "./store";
import { closeFrigoraPersistenceAfterFile } from "./test-persistence-lifecycle";
import { SARS_ZA_VAT_STANDARD_RULE } from "./tax-configuration";
import { allowSyntheticNotRegisteredQuotationSend } from "./tax-configuration-fixture";
import type { FrigoraScope } from "./types";

const NOW = "2026-10-24T08:00:00.000Z";
const ARRIVED = "2026-10-24T08:05:00.000Z";
const RECOMMENDED_AT = "2026-10-24T08:20:00.000Z";
const MODULE_ROOT = fileURLToPath(new URL(".", import.meta.url));

closeFrigoraPersistenceAfterFile();

function assertDisposableDatabase(url: string) {
  const normalised = url.replaceAll("\\", "/");
  if (
    normalised === "file:./data/ventureos.db"
    || normalised.endsWith("/data/ventureos.db")
    || !normalised.includes("/frigora-m1-issue-")
  ) {
    throw new Error(`Refusing non-disposable database URL: ${normalised}`);
  }
}

beforeEach(async () => {
  const directory = mkdtempSync(join(tmpdir(), "frigora-m1-issue-"));
  const url = `file:${join(directory, "issue.db").replaceAll("\\", "/")}`;
  assertDisposableDatabase(url);
  await resetPersistenceLifecycle(url);
  const bound = getDatabaseUrl();
  assert.equal(bound, url);
  assertDisposableDatabase(bound);
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
    ...overrides,
  };
}

async function seed(options: { verifyNotRegistered?: boolean } = {}) {
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
  const service = createFrigoraService({
    store,
    permissions: createPermissionService(createDbMembershipStore()),
  });
  if (options.verifyNotRegistered) {
    await allowSyntheticNotRegisteredQuotationSend(service, scope);
  }
  return { workspaceId, ventureId, userId, store, scope, service };
}

async function draftQuotation(
  owner: Awaited<ReturnType<typeof seed>>,
  commercial = exampleQuotationCommercial(),
  suffix = "1",
) {
  const attendeeId = `user-attendee-${suffix}` as UserId;
  await getPersistence().memberships.setRole({
    userId: attendeeId,
    workspaceId: owner.workspaceId,
    role: "member",
    createdAt: NOW,
  });
  const customer = await owner.service.createCustomer(owner.scope, {
    code: `FUELCO-${suffix}`,
    displayName: `FuelCo ${suffix}`,
  });
  const site = await owner.service.createSite(owner.scope, {
    customerId: customer.id,
    code: `SITE-${suffix}`,
    name: "Sandton North",
  });
  const asset = await owner.service.createAsset(owner.scope, {
    siteId: site.id,
    tag: `EVAP-${suffix}`,
    name: "Evaporator",
  });
  const workOrder = await owner.service.createWorkOrder(owner.scope, {
    siteId: site.id,
    workReference: `WO-${suffix}`,
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
  return owner.service.createQuotation(owner.scope, {
    recommendedActionId: recommendation.id,
    description: "Replace compressor",
    commercial,
  });
}

function issueInput(version = 1) {
  return { expectedCurrentVersion: version, recipient: "client@example.test" };
}

function registeredCommercial(numerator: number = SARS_ZA_VAT_STANDARD_RULE.rateNumerator) {
  const base = exampleQuotationCommercial({ travelKilometresMilli: 0, travelRateMinor: 0 });
  const priced = priceQuotationCommercial({
    ...base,
    taxTreatment: "configured_rule",
    taxRuleId: SARS_ZA_VAT_STANDARD_RULE.id,
    taxRuleVersion: SARS_ZA_VAT_STANDARD_RULE.effectiveFrom,
    taxRateNumerator: numerator,
    taxRateDenominator: SARS_ZA_VAT_STANDARD_RULE.rateDenominator,
  });
  return {
    ...base,
    taxTreatment: "configured_rule" as const,
    taxRuleId: SARS_ZA_VAT_STANDARD_RULE.id,
    taxRuleVersion: SARS_ZA_VAT_STANDARD_RULE.effectiveFrom,
    taxRateNumerator: numerator,
    taxRateDenominator: SARS_ZA_VAT_STANDARD_RULE.rateDenominator,
    enteredTaxAmountMinor: priced.taxAmountMinor,
  };
}

async function expectCode(run: () => Promise<unknown>, code: FrigoraError["code"]) {
  await assert.rejects(run, (error: unknown) => {
    assert.ok(error instanceof FrigoraError, String(error));
    assert.equal(error.code, code, error instanceof Error ? error.message : "");
    return true;
  });
}

async function scalar(sql: string, args: Array<string | number> = []) {
  const result = await getClient().execute({ sql, args });
  const row = result.rows[0];
  if (!row) return 0;
  return Number(Object.values(row)[0] ?? 0);
}

describe("Frigora quotation issue preparation", () => {
  it("prepares a held issue with a verified not-registered configuration and does not email", async () => {
    const owner = await seed({ verifyNotRegistered: true });
    const draft = await draftQuotation(owner);
    const hash = draft.versions[0]?.documentHash;
    const issued = await owner.service.issueQuotation(owner.scope, draft.id, issueInput());
    assert.equal(issued.idempotentReplay, false);
    assert.equal(issued.customerDelivery, "not_sent");
    assert.equal(issued.emailed, false);
    assert.equal(issued.decisionGrantCreated, false);
    assert.equal(issued.delivery.state, "held_pending_customer_access");
    assert.equal(issued.delivery.documentHash, hash);
    assert.equal(issued.delivery.version, 1);
    assert.equal(issued.delivery.providerMessageId, null);
    assert.match(issued.delivery.holdReason, /no email was sent/i);
    assert.equal(issued.quotation.versions[0]?.status, "awaiting_customer_approval");
    assert.equal(issued.quotation.versions[0]?.documentHash, hash);
    assert.equal(issued.quotation.events.filter((event) => event.kind === "sent").length, 1);
    assert.equal(await scalar("SELECT COUNT(*) AS n FROM frigora_quotation_decision_grants"), 0);
    assert.equal(await scalar("SELECT COUNT(*) AS n FROM frigora_quotation_delivery_outbox"), 1);
    assert.equal(await scalar("SELECT COUNT(*) AS n FROM frigora_quotation_delivery_attempts"), 1);
    assert.equal(
      await scalar(
        "SELECT COUNT(*) AS n FROM audit_events WHERE action = ?",
        [QUOTATION_ISSUE_AUDIT_ACTION],
      ),
      1,
    );
    const loaded = await owner.service.getQuotationDelivery(owner.scope, draft.id);
    assert.equal(loaded?.id, issued.delivery.id);
    assert.equal(loaded?.state, "held_pending_customer_access");

    const commands = readFileSync(join(MODULE_ROOT, "quotation-commands.ts"), "utf8");
    const issueBody = commands.slice(
      commands.indexOf("export async function issuePersistedQuotation"),
      commands.indexOf("export async function sendPersistedQuotation"),
    );
    assert.equal(issueBody.includes("deliverQuotationDecisionGrant"), false);
    assert.equal(issueBody.includes("api.resend.com"), false);
    assert.equal(issueBody.includes("allowSyntheticNotRegisteredQuotationSend"), false);
    assert.match(issueBody, /assertTaxAllowsQuotationSend/);
  });

  it("blocks issue when no tax configuration is verified", async () => {
    const owner = await seed();
    const draft = await draftQuotation(owner);
    await expectCode(
      () => owner.service.issueQuotation(owner.scope, draft.id, issueInput()),
      "tax_configuration_blocked",
    );
    const still = await owner.service.getQuotation(owner.scope, draft.id);
    assert.equal(still?.versions[0]?.status, "in_preparation");
    assert.equal(await scalar("SELECT COUNT(*) AS n FROM frigora_quotation_delivery_outbox"), 0);
    assert.equal(
      await scalar("SELECT COUNT(*) AS n FROM audit_events WHERE action = ?", [QUOTATION_ISSUE_AUDIT_ACTION]),
      0,
    );
  });

  it("blocks issue when the approved tax rule is expired", async () => {
    const owner = await seed();
    await owner.service.approveReferenceTaxRule(owner.scope);
    await owner.service.verifyTaxConfiguration(owner.scope, {
      jurisdiction: "ZA",
      registrationState: "registered",
      registrationNumber: "4123456789",
      liabilityDate: "2025-05-01",
      taxRuleId: SARS_ZA_VAT_STANDARD_RULE.id,
      evidenceReference: "synthetic-fixture:vat-registration-notice",
    });
    const draft = await draftQuotation(owner, registeredCommercial(), "expired");
    await getClient().execute({
      sql: "UPDATE frigora_tax_rules SET effective_until = ? WHERE id = ?",
      args: ["2020-01-01", SARS_ZA_VAT_STANDARD_RULE.id],
    });
    await expectCode(
      () => owner.service.issueQuotation(owner.scope, draft.id, issueInput()),
      "tax_configuration_blocked",
    );
    const still = await owner.service.getQuotation(owner.scope, draft.id);
    assert.equal(still?.versions[0]?.status, "in_preparation");
    assert.equal(await scalar("SELECT COUNT(*) AS n FROM frigora_quotation_delivery_outbox"), 0);
  });

  it("blocks issue when more than one verified configuration is active", async () => {
    const owner = await seed({ verifyNotRegistered: true });
    const draft = await draftQuotation(owner);
    await getClient().execute({
      sql: `
        INSERT INTO frigora_tax_configurations (
          id, workspace_id, venture_id, version_number, jurisdiction, registration_state,
          evidence_reference, status, created_by_user_id, created_at, verified_by_user_id, verified_at
        ) VALUES (?, ?, ?, 99, 'ZA', 'not_registered', ?, 'verified', ?, ?, ?, ?)
      `,
      args: [
        "config-extra",
        owner.workspaceId,
        owner.ventureId,
        "synthetic-fixture:second-not-registered",
        owner.userId,
        NOW,
        owner.userId,
        NOW,
      ],
    });
    await expectCode(
      () => owner.service.issueQuotation(owner.scope, draft.id, issueInput()),
      "tax_configuration_blocked",
    );
    assert.equal((await owner.service.getQuotation(owner.scope, draft.id))?.versions[0]?.status, "in_preparation");
  });

  it("blocks issue when a not-registered configuration would carry tax", async () => {
    const owner = await seed({ verifyNotRegistered: true });
    await expectCode(
      () => draftQuotation(owner, registeredCommercial(), "vat"),
      "tax_configuration_blocked",
    );
    assert.equal(await scalar("SELECT COUNT(*) AS n FROM frigora_quotations"), 0);
    const draft = await draftQuotation(owner);
    const priced = priceQuotationCommercial(registeredCommercial());
    const documentHash = quotationDocumentHash({
      version: 1,
      description: draft.versions[0]?.description ?? "",
      ...priced,
    });
    await getClient().execute({
      sql: `
        UPDATE frigora_quotation_versions
        SET total_minor = ?,
            document_hash = ?,
            labour_quantity_milli = ?,
            labour_unit = ?,
            labour_rate_minor = ?,
            labour_amount_minor = ?,
            travel_kilometres_milli = ?,
            distance_basis = ?,
            travel_rate_minor = ?,
            travel_amount_minor = ?,
            tax_treatment = ?,
            tax_rule_id = ?,
            tax_rule_version = ?,
            tax_rate_numerator = ?,
            tax_rate_denominator = ?,
            taxable_amount_minor = ?,
            tax_amount_minor = ?
        WHERE quotation_id = ? AND version_number = 1
      `,
      args: [
        priced.totalMinor,
        documentHash,
        priced.labourQuantityMilli,
        priced.labourUnit,
        priced.labourRateMinor,
        priced.labourAmountMinor,
        priced.travelKilometresMilli,
        priced.distanceBasis,
        priced.travelRateMinor,
        priced.travelAmountMinor,
        priced.taxTreatment,
        priced.taxRuleId,
        priced.taxRuleVersion,
        priced.taxRateNumerator,
        priced.taxRateDenominator,
        priced.taxableAmountMinor,
        priced.taxAmountMinor,
        draft.id,
      ],
    });
    await expectCode(
      () => owner.service.issueQuotation(owner.scope, draft.id, issueInput()),
      "tax_configuration_blocked",
    );
    const still = await owner.service.getQuotation(owner.scope, draft.id);
    assert.equal(still?.versions[0]?.status, "in_preparation");
    assert.equal(still?.currentVersion, 1);
    assert.equal(await scalar("SELECT COUNT(*) AS n FROM frigora_quotation_delivery_outbox"), 0);
  });

  it("rejects a manual tax amount that does not match the calculated rule", async () => {
    const owner = await seed({ verifyNotRegistered: true });
    await expectCode(
      () => draftQuotation(owner, {
        ...registeredCommercial(),
        enteredTaxAmountMinor: 1,
      }, "manual"),
      "invalid_input",
    );
    assert.equal(await scalar("SELECT COUNT(*) AS n FROM frigora_quotations"), 0);
  });

  it("blocks issue when the stored commercial snapshot does not match its hash", async () => {
    const owner = await seed({ verifyNotRegistered: true });
    const draft = await draftQuotation(owner);
    await getClient().execute({
      sql: "UPDATE frigora_quotation_versions SET document_hash = ? WHERE quotation_id = ?",
      args: ["tampered-hash", draft.id],
    });
    await expectCode(
      () => owner.service.issueQuotation(owner.scope, draft.id, issueInput()),
      "invalid_input",
    );
    const still = await owner.service.getQuotation(owner.scope, draft.id);
    assert.equal(still?.versions[0]?.status, "in_preparation");
    assert.equal(still?.versions[0]?.documentHash, "tampered-hash");
    assert.equal(await scalar("SELECT COUNT(*) AS n FROM frigora_quotation_delivery_outbox"), 0);
  });

  it("keeps one held outbox when two issue attempts run together", async () => {
    const owner = await seed({ verifyNotRegistered: true });
    const draft = await draftQuotation(owner);
    const results = await Promise.allSettled([
      owner.service.issueQuotation(owner.scope, draft.id, issueInput()),
      owner.service.issueQuotation(owner.scope, draft.id, issueInput()),
    ]);
    const fulfilled = results.filter((result) => result.status === "fulfilled");
    assert.ok(fulfilled.length >= 1);
    for (const result of fulfilled) {
      if (result.status !== "fulfilled") continue;
      assert.equal(result.value.customerDelivery, "not_sent");
      assert.equal(result.value.emailed, false);
      assert.equal(result.value.decisionGrantCreated, false);
      assert.equal(result.value.delivery.state, "held_pending_customer_access");
    }
    for (const result of results) {
      if (result.status === "rejected") {
        assert.ok(result.reason instanceof FrigoraError);
        assert.equal(result.reason.code, "quotation_conflict");
      }
    }
    assert.equal(await scalar("SELECT COUNT(*) AS n FROM frigora_quotation_delivery_outbox"), 1);
    assert.equal(await scalar("SELECT COUNT(*) AS n FROM frigora_quotation_events WHERE kind = 'sent'"), 1);
    assert.equal(await scalar("SELECT COUNT(*) AS n FROM frigora_quotation_decision_grants"), 0);
    const version = await getClient().execute({
      sql: "SELECT status, document_hash FROM frigora_quotation_versions WHERE quotation_id = ?",
      args: [draft.id],
    });
    assert.equal(version.rows[0]?.status, "awaiting_customer_approval");
    const outbox = await getClient().execute({
      sql: "SELECT document_hash, state FROM frigora_quotation_delivery_outbox WHERE quotation_id = ?",
      args: [draft.id],
    });
    assert.equal(outbox.rows[0]?.document_hash, version.rows[0]?.document_hash);
    assert.equal(outbox.rows[0]?.state, "held_pending_customer_access");
  });

  it("replays a held issue without a second event and keeps it after tax revocation", async () => {
    const owner = await seed({ verifyNotRegistered: true });
    const draft = await draftQuotation(owner);
    const first = await owner.service.issueQuotation(owner.scope, draft.id, issueInput());
    const posture = await owner.service.getTaxPosture(owner.scope);
    const verified = posture.configurations.find((configuration) => configuration.status === "verified");
    assert.ok(verified);
    await owner.service.revokeVerifiedTaxConfiguration(owner.scope, verified.id);
    const replay = await owner.service.issueQuotation(owner.scope, draft.id, issueInput());
    assert.equal(replay.idempotentReplay, true);
    assert.equal(replay.delivery.id, first.delivery.id);
    assert.equal(replay.delivery.state, "held_pending_customer_access");
    assert.equal(replay.customerDelivery, "not_sent");
    assert.equal(replay.quotation.versions[0]?.documentHash, first.quotation.versions[0]?.documentHash);
    assert.equal(replay.quotation.versions[0]?.commercial.taxAmountMinor, 0);
    assert.equal(await scalar("SELECT COUNT(*) AS n FROM frigora_quotation_events WHERE kind = 'sent'"), 1);
    assert.equal(await scalar("SELECT COUNT(*) AS n FROM frigora_quotation_delivery_outbox"), 1);
    await expectCode(
      () => owner.service.issueQuotation(owner.scope, draft.id, issueInput(2)),
      "quotation_conflict",
    );
  });

  it("binds the immutable issued snapshot to the outbox hash", async () => {
    const owner = await seed({ verifyNotRegistered: true });
    const draft = await draftQuotation(owner);
    const issued = await owner.service.issueQuotation(owner.scope, draft.id, issueInput());
    await assert.rejects(
      () => getClient().execute("UPDATE frigora_quotation_versions SET total_minor = 1 WHERE version_number = 1"),
      /immutable/,
    );
    await assert.rejects(
      () => getClient().execute({
        sql: "UPDATE frigora_quotation_delivery_outbox SET document_hash = 'changed' WHERE id = ?",
        args: [issued.delivery.id],
      }),
      /not allowed/,
    );
    const still = await owner.service.getQuotation(owner.scope, draft.id);
    assert.equal(still?.versions[0]?.documentHash, issued.delivery.documentHash);
    assert.equal(still?.versions[0]?.commercial.taxAmountMinor, draft.versions[0]?.commercial.taxAmountMinor);
  });

  it("does not report success when the issue audit cannot be written", async () => {
    const owner = await seed({ verifyNotRegistered: true });
    const draft = await draftQuotation(owner);
    await getClient().execute(`
      CREATE TRIGGER quote_issue_audit_fail
      BEFORE INSERT ON audit_events
      WHEN NEW.action = 'frigora.quotation.issue_prepared'
      BEGIN
        SELECT RAISE(ABORT, 'forced issue audit failure');
      END
    `);
    await assert.rejects(
      () => owner.service.issueQuotation(owner.scope, draft.id, issueInput()),
      /forced issue audit failure/,
    );
    const still = await owner.service.getQuotation(owner.scope, draft.id);
    assert.equal(still?.versions[0]?.status, "in_preparation");
    assert.equal(await scalar("SELECT COUNT(*) AS n FROM frigora_quotation_delivery_outbox"), 0);
    assert.equal(await scalar("SELECT COUNT(*) AS n FROM frigora_quotation_events WHERE kind = 'sent'"), 0);
    assert.equal(
      await scalar("SELECT COUNT(*) AS n FROM audit_events WHERE action = ?", [QUOTATION_ISSUE_AUDIT_ACTION]),
      0,
    );
  });

  it("rolls the issue back when the outbox insert fails", async () => {
    const owner = await seed({ verifyNotRegistered: true });
    const draft = await draftQuotation(owner);
    await getClient().execute(`
      CREATE TRIGGER quote_outbox_fail
      BEFORE INSERT ON frigora_quotation_delivery_outbox
      BEGIN
        SELECT RAISE(ABORT, 'forced outbox failure');
      END
    `);
    await assert.rejects(
      () => owner.service.issueQuotation(owner.scope, draft.id, issueInput()),
      /forced outbox failure/,
    );
    const still = await owner.service.getQuotation(owner.scope, draft.id);
    assert.equal(still?.versions[0]?.status, "in_preparation");
    assert.equal(await scalar("SELECT COUNT(*) AS n FROM frigora_quotation_events WHERE kind = 'sent'"), 0);
    assert.equal(await scalar("SELECT COUNT(*) AS n FROM frigora_quotation_delivery_attempts"), 0);
    assert.equal(await scalar("SELECT COUNT(*) AS n FROM frigora_quotation_decision_grants"), 0);
  });

  it("identifies a missing outbox and restores the held record without a grant or email", async () => {
    const owner = await seed({ verifyNotRegistered: true });
    const draft = await draftQuotation(owner);
    const issued = await owner.service.issueQuotation(owner.scope, draft.id, issueInput());
    await getClient().execute({
      sql: "DELETE FROM frigora_quotation_delivery_outbox WHERE id = ?",
      args: [issued.delivery.id],
    });
    assert.equal(await owner.service.getQuotationDelivery(owner.scope, draft.id), null);
    await expectCode(
      () => owner.service.issueQuotation(owner.scope, draft.id, issueInput()),
      "invalid_status",
    );
    const interrupted = await owner.service.issueQuotation(owner.scope, draft.id, issueInput()).catch((error: unknown) => error);
    assert.ok(interrupted instanceof FrigoraError);
    assert.match(interrupted.message, new RegExp(QUOTATION_ISSUE_INTERRUPTED.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    const restored = await owner.service.recoverQuotationDelivery(owner.scope, draft.id);
    assert.equal(restored.action, "restored_held");
    assert.equal(restored.customerDelivery, "not_sent");
    assert.equal(restored.decisionGrantCreated, false);
    assert.equal(restored.delivery.state, "held_pending_customer_access");
    assert.equal(restored.delivery.documentHash, issued.delivery.documentHash);
    assert.notEqual(restored.delivery.id, issued.delivery.id);
    const again = await owner.service.recoverQuotationDelivery(owner.scope, draft.id);
    assert.equal(again.action, "already_held");
    assert.equal(again.delivery.id, restored.delivery.id);
    const replay = await owner.service.issueQuotation(owner.scope, draft.id, issueInput());
    assert.equal(replay.idempotentReplay, true);
    assert.equal(await scalar("SELECT COUNT(*) AS n FROM frigora_quotation_decision_grants"), 0);
    assert.equal(await scalar("SELECT COUNT(*) AS n FROM frigora_quotation_delivery_outbox"), 1);
  });

  it("marks a hash mismatch as outcome unknown and does not treat it as delivery", async () => {
    const owner = await seed({ verifyNotRegistered: true });
    const draft = await draftQuotation(owner);
    const issued = await owner.service.issueQuotation(owner.scope, draft.id, issueInput());
    await getClient().execute({
      sql: "DELETE FROM frigora_quotation_delivery_outbox WHERE id = ?",
      args: [issued.delivery.id],
    });
    await getClient().execute({
      sql: `
        INSERT INTO frigora_quotation_delivery_outbox (
          id, quotation_id, workspace_id, venture_id, version_number, document_hash,
          created_at, actor_user_id, state, hold_reason, provider_message_id
        ) VALUES ('outbox-wrong', ?, ?, ?, 1, 'not-the-issued-hash', ?, ?, 'held_pending_customer_access', ?, NULL)
      `,
      args: [
        draft.id,
        owner.workspaceId,
        owner.ventureId,
        NOW,
        owner.userId,
        "mismatched snapshot",
      ],
    });
    const recovered = await owner.service.recoverQuotationDelivery(owner.scope, draft.id);
    assert.equal(recovered.action, "marked_outcome_unknown");
    assert.equal(recovered.delivery.state, "outcome_unknown");
    assert.equal(recovered.customerDelivery, "not_sent");
    assert.equal(recovered.decisionGrantCreated, false);
    assert.equal(await scalar("SELECT COUNT(*) AS n FROM frigora_quotation_decision_grants"), 0);
    await expectCode(
      () => owner.service.issueQuotation(owner.scope, draft.id, issueInput()),
      "invalid_status",
    );
    const repeat = await owner.service.recoverQuotationDelivery(owner.scope, draft.id);
    assert.equal(repeat.action, "already_unknown");
    assert.equal(repeat.delivery.state, "outcome_unknown");
  });

  it("keeps revision available and does not invent a customer decision", async () => {
    const owner = await seed({ verifyNotRegistered: true });
    const draft = await draftQuotation(owner);
    const issued = await owner.service.issueQuotation(owner.scope, draft.id, issueInput());
    const revised = await owner.service.reviseQuotation(owner.scope, draft.id, {
      expectedCurrentVersion: 1,
      description: "Replace compressor and filter drier",
      commercial: exampleQuotationCommercial({ travelRateMinor: 2500 }),
    });
    assert.equal(revised.currentVersion, 2);
    assert.equal(revised.versions.find((version) => version.version === 1)?.status, "awaiting_customer_approval");
    assert.equal(revised.versions.find((version) => version.version === 1)?.documentHash, issued.delivery.documentHash);
    assert.equal(revised.versions.find((version) => version.version === 2)?.status, "in_preparation");
    assert.equal(revised.decisions.length, 0);
    assert.equal(await owner.service.getQuotationDelivery(owner.scope, draft.id), null);
    const versionOne = await getClient().execute({
      sql: "SELECT state, document_hash FROM frigora_quotation_delivery_outbox WHERE quotation_id = ? AND version_number = 1",
      args: [draft.id],
    });
    assert.equal(versionOne.rows[0]?.state, "held_pending_customer_access");
    assert.equal(versionOne.rows[0]?.document_hash, issued.delivery.documentHash);
    assert.equal(await scalar("SELECT COUNT(*) AS n FROM frigora_quotation_decision_grants"), 0);
  });

  it("refuses issue from an actor who cannot update the venture", async () => {
    const owner = await seed({ verifyNotRegistered: true });
    const draft = await draftQuotation(owner);
    const memberId = "user-member" as UserId;
    await getPersistence().memberships.setRole({
      userId: memberId,
      workspaceId: owner.workspaceId,
      role: "member",
      createdAt: NOW,
    });
    const member = createFrigoraService({
      store: owner.store,
      permissions: createPermissionService(createDbMembershipStore()),
    });
    await expectCode(
      () => member.issueQuotation(
        { userId: memberId, workspaceId: owner.workspaceId, ventureId: owner.ventureId },
        draft.id,
        issueInput(),
      ),
      "forbidden",
    );
    assert.equal((await owner.service.getQuotation(owner.scope, draft.id))?.versions[0]?.status, "in_preparation");
    assert.equal(await scalar("SELECT COUNT(*) AS n FROM frigora_quotation_delivery_outbox"), 0);
  });
});
