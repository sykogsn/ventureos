import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import type { Role, UserId, VentureId, WorkspaceId } from "@/contracts";
import { createPermissionService } from "@/platform/permissions/service";
import { createDbMembershipStore } from "@/platform/permissions/membership-store";
import { ensureSchema, getClient } from "@/platform/persistence/db";
import { getPersistence, resetPersistenceLifecycle } from "@/platform/persistence/repositories";
import type { PersistedVenture } from "@/platform/persistence/repositories/ports";
import { FrigoraError } from "./errors";
import { exampleQuotationCommercial, priceQuotationCommercial, quotationDocumentHash } from "./quotation-commercial";
import { installQuotationDeliveryPayloadTestKeys } from "./quotation-delivery-payload";
import { createFrigoraService } from "./service";
import { createFrigoraStore } from "./store";
import { closeFrigoraPersistenceAfterFile } from "./test-persistence-lifecycle";
import {
  quotationTaxCorrectionBlocker,
  quotationTaxSendBlocker,
  SARS_ZA_VAT_STANDARD_RULE,
  type TaxConfigurationRecord,
  type TaxRuleRecord,
} from "./tax-configuration";
import type { FrigoraScope } from "./types";

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

async function seed(role: Role = "owner") {
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
  await persistence.memberships.setRole({ userId, workspaceId, role, createdAt: NOW });
  await persistence.ventures.insert(ventureRow());
  const store = createFrigoraStore();
  const scope = { userId, workspaceId, ventureId } satisfies FrigoraScope;
  return { scope, service: createFrigoraService({ store, permissions: createPermissionService(createDbMembershipStore()) }) };
}

async function draftQuotation(
  owner: Awaited<ReturnType<typeof seed>>,
  commercial = exampleQuotationCommercial(),
  suffix = "1",
) {
  const attendeeId = "user-attendee" as UserId;
  await getPersistence().memberships.setRole({
    userId: attendeeId,
    workspaceId: owner.scope.workspaceId,
    role: "member",
    createdAt: NOW,
  });
  const customer = await owner.service.createCustomer(owner.scope, { code: `FUELCO-${suffix}`, displayName: `FuelCo ${suffix}` });
  const site = await owner.service.createSite(owner.scope, { customerId: customer.id, code: `SITE-${suffix}`, name: "Sandton North" });
  const asset = await owner.service.createAsset(owner.scope, { siteId: site.id, tag: `EVAP-${suffix}`, name: "Evaporator" });
  const workOrder = await owner.service.createWorkOrder(owner.scope, {
    siteId: site.id,
    workReference: `WO-${suffix}`,
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
  return owner.service.createQuotation(owner.scope, {
    recommendedActionId: recommendation.id,
    description: "Replace compressor",
    commercial,
  });
}

function registeredCommercial(
  numerator: number = SARS_ZA_VAT_STANDARD_RULE.rateNumerator,
  patch: Partial<ReturnType<typeof exampleQuotationCommercial>> = {},
) {
  const base = exampleQuotationCommercial({ travelKilometresMilli: 0, travelRateMinor: 0, ...patch });
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

async function expectBlocked(run: () => Promise<unknown>, pattern: RegExp) {
  await assert.rejects(run, (error: unknown) => {
    assert.ok(error instanceof FrigoraError);
    assert.equal(error.code, "tax_configuration_blocked");
    assert.match(error.message, pattern);
    return true;
  });
}

async function countTable(table: "frigora_quotations" | "frigora_quotation_events" | "frigora_quotation_versions") {
  const result = await getClient().execute(`SELECT COUNT(*) AS n FROM ${table}`);
  const row = result.rows[0];
  return Number(row ? Object.values(row)[0] : 0);
}

async function plantCommercial(
  quotationId: string,
  version: number,
  description: string,
  commercial: ReturnType<typeof priceQuotationCommercial>,
) {
  const documentHash = quotationDocumentHash({ version, description, ...commercial });
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
      WHERE quotation_id = ? AND version_number = ?
    `,
    args: [
      commercial.totalMinor,
      documentHash,
      commercial.labourQuantityMilli,
      commercial.labourUnit,
      commercial.labourRateMinor,
      commercial.labourAmountMinor,
      commercial.travelKilometresMilli,
      commercial.distanceBasis,
      commercial.travelRateMinor,
      commercial.travelAmountMinor,
      commercial.taxTreatment,
      commercial.taxRuleId,
      commercial.taxRuleVersion,
      commercial.taxRateNumerator,
      commercial.taxRateDenominator,
      commercial.taxableAmountMinor,
      commercial.taxAmountMinor,
      quotationId,
      version,
    ],
  });
}

function persistedIdentity(quote: Awaited<ReturnType<Awaited<ReturnType<typeof seed>>["service"]["getQuotation"]>>) {
  return {
    currentVersion: quote?.currentVersion ?? null,
    versions: (quote?.versions ?? []).map((version) => ({
      version: version.version,
      status: version.status,
      hash: version.documentHash,
      taxTreatment: version.commercial.taxTreatment,
      taxAmountMinor: version.commercial.taxAmountMinor,
    })),
    events: (quote?.events ?? []).map((event) => ({
      id: event.id,
      kind: event.kind,
      version: event.version,
    })),
  };
}

describe("Frigora tax configuration", () => {
  it("keeps a missing configuration unverified and blocks sending outside the office UI", async () => {
    const owner = await seed();
    const posture = await owner.service.getTaxPosture(owner.scope);
    assert.equal(posture.configurations.length, 0);
    assert.equal(posture.rules[0]?.status, "reference");
    assert.equal(posture.rules[0]?.rateNumerator, 15);
    assert.equal(posture.rules[0]?.rateDenominator, 100);
    const quote = await draftQuotation(owner);
    const orders = await owner.service.listWorkOrders(owner.scope);
    await expectBlocked(
      () => owner.service.sendQuotation(owner.scope, quote.id, { expectedCurrentVersion: 1, recipient: "accounts@fuelco.test" }),
      /no verified tax configuration/,
    );
    assert.equal((await owner.service.getQuotation(owner.scope, quote.id))?.versions[0]?.status, "in_preparation");
    assert.equal((await owner.service.listWorkOrders(owner.scope)).length, orders.length);
  });

  it("does not let a public rule or missing evidence activate the venture", async () => {
    const owner = await seed();
    const quote = await draftQuotation(owner);
    await owner.service.approveReferenceTaxRule(owner.scope);
    await expectBlocked(
      () => owner.service.sendQuotation(owner.scope, quote.id, { expectedCurrentVersion: 1, recipient: "accounts@fuelco.test" }),
      /no verified tax configuration/,
    );
    await assert.rejects(
      () => owner.service.verifyTaxConfiguration(owner.scope, {
        jurisdiction: "ZA",
        registrationState: "registered",
        registrationNumber: "4123456789",
        liabilityDate: "2025-05-01",
        taxRuleId: SARS_ZA_VAT_STANDARD_RULE.id,
        evidenceReference: "",
      }),
      (error: unknown) => {
        assert.ok(error instanceof FrigoraError);
        assert.equal(error.code, "invalid_input");
        assert.match(error.message, /evidence/i);
        return true;
      },
    );
    assert.equal((await owner.service.getTaxPosture(owner.scope)).configurations.length, 0);
  });

  it("rejects unauthorised activation and VAT on a verified not-registered configuration", async () => {
    const owner = await seed();
    const memberId = "user-clerk" as UserId;
    await getPersistence().memberships.setRole({
      userId: memberId,
      workspaceId: owner.scope.workspaceId,
      role: "member",
      createdAt: NOW,
    });
    await assert.rejects(
      () => owner.service.verifyTaxConfiguration(
        { ...owner.scope, userId: memberId },
        {
          jurisdiction: "ZA",
          registrationState: "not_registered",
          evidenceReference: "synthetic-fixture:not-a-live-vat-registration",
        },
      ),
      (error: unknown) => error instanceof FrigoraError && error.code === "forbidden",
    );
    await owner.service.verifyTaxConfiguration(owner.scope, {
      jurisdiction: "ZA",
      registrationState: "not_registered",
      evidenceReference: "synthetic-fixture:not-a-live-vat-registration",
    });
    const priced = registeredCommercial();
    const quotationsBefore = await countTable("frigora_quotations");
    const eventsBefore = await countTable("frigora_quotation_events");
    await expectBlocked(
      () => draftQuotation(owner, priced, "vat"),
      /cannot charge VAT/,
    );
    assert.equal(await countTable("frigora_quotations"), quotationsBefore);
    assert.equal(await countTable("frigora_quotation_events"), eventsBefore);
    const plain = await draftQuotation(owner, exampleQuotationCommercial(), "plain");
    const sent = await owner.service.sendQuotation(owner.scope, plain.id, {
      expectedCurrentVersion: 1,
      recipient: "accounts@fuelco.test",
    });
    assert.equal(sent.versions[0]?.status, "awaiting_customer_approval");
    assert.equal(sent.versions[0]?.commercial.taxAmountMinor, 0);
    const hash = sent.versions[0]?.documentHash;
    await owner.service.saveTaxConfigurationDraft(owner.scope, {
      jurisdiction: "ZA",
      registrationState: "unverified",
    });
    assert.equal((await owner.service.getQuotation(owner.scope, sent.id))?.versions[0]?.documentHash, hash);
    await assert.rejects(() => owner.service.deliverQuotationDecisionGrant(owner.scope, sent.id, {
      expectedCurrentVersion: 1,
      contactId: "missing-contact",
    }));
    const afterMail = await owner.service.getQuotation(owner.scope, sent.id);
    assert.equal(afterMail?.versions[0]?.status, "awaiting_customer_approval");
    assert.equal(afterMail?.versions[0]?.documentHash, hash);
  });

  it("requires an approved rule for registered sending and rejects a quotation-supplied rate", async () => {
    const owner = await seed();
    await expectBlocked(
      () => owner.service.verifyTaxConfiguration(owner.scope, {
        jurisdiction: "ZA",
        registrationState: "registered",
        registrationNumber: "4123456789",
        liabilityDate: "2025-05-01",
        taxRuleId: SARS_ZA_VAT_STANDARD_RULE.id,
        evidenceReference: "synthetic-fixture:vat-registration-notice",
      }),
      /not approved/,
    );
    await owner.service.approveReferenceTaxRule(owner.scope);
    const verified = await owner.service.verifyTaxConfiguration(owner.scope, {
      jurisdiction: "ZA",
      registrationState: "registered",
      registrationNumber: "4123456789",
      liabilityDate: "2025-05-01",
      taxRuleId: SARS_ZA_VAT_STANDARD_RULE.id,
      evidenceReference: "synthetic-fixture:vat-registration-notice",
    });
    assert.equal(verified.status, "verified");
    await expectBlocked(
      () => draftQuotation(owner, registeredCommercial(14), "wrong"),
      /cannot set its own rate/,
    );
    assert.equal(await countTable("frigora_quotations"), 0);
    assert.equal(await countTable("frigora_quotation_events"), 0);
    const matching = await draftQuotation(owner, registeredCommercial(), "match");
    const stored = matching.versions[0];
    assert.ok(stored);
    await plantCommercial(
      matching.id,
      1,
      stored.description,
      priceQuotationCommercial(registeredCommercial(14)),
    );
    await expectBlocked(
      () => owner.service.sendQuotation(owner.scope, matching.id, { expectedCurrentVersion: 1, recipient: "accounts@fuelco.test" }),
      /cannot set its own rate/,
    );
    assert.equal((await owner.service.getQuotation(owner.scope, matching.id))?.versions[0]?.status, "in_preparation");
    await plantCommercial(matching.id, 1, stored.description, stored.commercial);
    const orders = await owner.service.listWorkOrders(owner.scope);
    const sent = await owner.service.sendQuotation(owner.scope, matching.id, {
      expectedCurrentVersion: 1,
      recipient: "accounts@fuelco.test",
    });
    assert.equal(sent.versions[0]?.status, "awaiting_customer_approval");
    assert.equal(sent.versions[0]?.commercial.taxRateNumerator, 15);
    assert.equal((await owner.service.listWorkOrders(owner.scope)).length, orders.length);
    const hash = sent.versions[0]?.documentHash;
    await owner.service.revokeVerifiedTaxConfiguration(owner.scope, verified.id);
    assert.equal((await owner.service.getQuotation(owner.scope, sent.id))?.versions[0]?.documentHash, hash);
    assert.equal((await owner.service.getQuotation(owner.scope, sent.id))?.versions[0]?.status, "awaiting_customer_approval");
    const events = (await owner.service.getTaxPosture(owner.scope)).events;
    assert.equal(events.some((event) => event.kind === "verified"), true);
    assert.equal(events.some((event) => event.kind === "revoked"), true);
    assert.equal(events.some((event) => event.summary.includes("4123456789")), false);
    await assert.rejects(
      () => getClient().execute("UPDATE frigora_tax_configuration_events SET summary = 'rewritten'"),
      /append-only/,
    );
  });

  it("blocks expired, future, revoked, and conflicting rules", () => {
    const rule: TaxRuleRecord = {
      id: SARS_ZA_VAT_STANDARD_RULE.id,
      jurisdiction: "ZA",
      treatment: "standard_rated",
      rateNumerator: 15,
      rateDenominator: 100,
      effectiveFrom: "2025-05-01",
      effectiveUntil: "2025-05-02",
      sourceTitle: SARS_ZA_VAT_STANDARD_RULE.sourceTitle,
      sourceUrl: SARS_ZA_VAT_STANDARD_RULE.sourceUrl,
      sourceStatementDate: SARS_ZA_VAT_STANDARD_RULE.sourceStatementDate,
      sourceNote: SARS_ZA_VAT_STANDARD_RULE.sourceNote,
      status: "approved",
      approvedByUserId: "user-owner",
      approvedAt: NOW,
    };
    const configuration: TaxConfigurationRecord = {
      id: "config-1",
      workspaceId: "ws",
      ventureId: "ven",
      version: 1,
      jurisdiction: "ZA",
      registrationState: "registered",
      registrationNumber: "4123456789",
      liabilityDate: "2025-05-01",
      taxRuleId: rule.id,
      evidenceReference: "synthetic-fixture:vat-registration-notice",
      status: "verified",
      createdByUserId: "user-owner",
      createdAt: NOW,
      verifiedByUserId: "user-owner",
      verifiedAt: NOW,
    };
    const commercial = priceQuotationCommercial(registeredCommercial());
    assert.match(quotationTaxSendBlocker({
      configurations: [configuration],
      rules: [rule],
      commercial,
      asOfDate: "2026-10-29",
    }) ?? "", /expired/);
    assert.match(quotationTaxSendBlocker({
      configurations: [configuration],
      rules: [{ ...rule, effectiveUntil: null, effectiveFrom: "2099-01-01" }],
      commercial,
      asOfDate: "2026-10-29",
    }) ?? "", /not yet effective/);
    assert.match(quotationTaxSendBlocker({
      configurations: [configuration],
      rules: [{ ...rule, effectiveUntil: null, status: "revoked" }],
      commercial,
      asOfDate: "2026-10-29",
    }) ?? "", /not approved/);
    assert.match(quotationTaxSendBlocker({
      configurations: [configuration, { ...configuration, id: "config-2", version: 2 }],
      rules: [{ ...rule, effectiveUntil: null }],
      commercial,
      asOfDate: "2026-10-29",
    }) ?? "", /conflicting/);
    assert.match(quotationTaxCorrectionBlocker({
      configurations: [configuration],
      rules: [rule],
      commercial,
      asOfDate: "2026-10-29",
    }) ?? "", /expired/);
    assert.match(quotationTaxCorrectionBlocker({
      configurations: [configuration],
      rules: [{ ...rule, effectiveUntil: null, effectiveFrom: "2099-01-01" }],
      commercial,
      asOfDate: "2026-10-29",
    }) ?? "", /not yet effective/);
    assert.match(quotationTaxCorrectionBlocker({
      configurations: [configuration],
      rules: [{ ...rule, effectiveUntil: null, status: "revoked" }],
      commercial,
      asOfDate: "2026-10-29",
    }) ?? "", /not approved/);
    const zero = priceQuotationCommercial(exampleQuotationCommercial());
    assert.match(quotationTaxCorrectionBlocker({
      configurations: [configuration, { ...configuration, id: "config-2", version: 2 }],
      rules: [{ ...rule, effectiveUntil: null }],
      commercial: zero,
      asOfDate: "2026-10-29",
    }) ?? "", /conflicting/);
    assert.equal(quotationTaxCorrectionBlocker({
      configurations: [],
      rules: [],
      commercial: zero,
      asOfDate: "2026-10-29",
    }), null);
  });

  it("rejects a tax-bearing correction that issue would refuse and keeps the saved snapshot", async () => {
    const owner = await seed();
    const unconfigured = await draftQuotation(owner, exampleQuotationCommercial(), "bare");
    const unconfiguredBefore = await owner.service.getQuotation(owner.scope, unconfigured.id);
    await expectBlocked(
      () => owner.service.correctQuotation(owner.scope, unconfigured.id, {
        expectedCurrentVersion: 1,
        description: "Replace compressor",
        commercial: registeredCommercial(),
      }),
      /no verified tax configuration/,
    );
    const unconfiguredAfter = await owner.service.getQuotation(owner.scope, unconfigured.id);
    assert.equal(unconfiguredAfter?.versions[0]?.documentHash, unconfiguredBefore?.versions[0]?.documentHash);
    assert.equal(unconfiguredAfter?.versions[0]?.commercial.taxAmountMinor, 0);
    assert.equal(unconfiguredAfter?.versions[0]?.commercial.taxTreatment, "not_registered");
    assert.equal(unconfiguredAfter?.currentVersion, 1);
    assert.equal(unconfiguredAfter?.events.length, unconfiguredBefore?.events.length);

    await owner.service.submitTaxConfigurationForReview(owner.scope, {
      jurisdiction: "ZA",
      registrationState: "pending_review",
      evidenceReference: "synthetic-pending-note",
    });
    const pending = await draftQuotation(owner, exampleQuotationCommercial(), "pending");
    const pendingBefore = await owner.service.getQuotation(owner.scope, pending.id);
    await expectBlocked(
      () => owner.service.correctQuotation(owner.scope, pending.id, {
        expectedCurrentVersion: 1,
        description: "Replace compressor",
        commercial: registeredCommercial(),
      }),
      /no verified tax configuration/,
    );
    const pendingAfter = await owner.service.getQuotation(owner.scope, pending.id);
    assert.equal(pendingAfter?.versions[0]?.documentHash, pendingBefore?.versions[0]?.documentHash);
    assert.equal(pendingAfter?.versions[0]?.commercial.taxTreatment, "not_registered");
    assert.equal(pendingAfter?.currentVersion, 1);

    const zeroCorrected = await owner.service.correctQuotation(owner.scope, pending.id, {
      expectedCurrentVersion: 1,
      description: "Replace compressor and filter drier",
      commercial: exampleQuotationCommercial({ travelRateMinor: 2500 }),
    });
    assert.equal(zeroCorrected.currentVersion, 1);
    assert.equal(zeroCorrected.versions.length, 1);
    assert.equal(zeroCorrected.versions[0]?.commercial.taxAmountMinor, 0);
    assert.equal(zeroCorrected.versions[0]?.commercial.taxTreatment, "not_registered");
    assert.equal(zeroCorrected.versions[0]?.commercial.travelAmountMinor, 250_000);
    assert.notEqual(zeroCorrected.versions[0]?.documentHash, pendingBefore?.versions[0]?.documentHash);

    await owner.service.verifyTaxConfiguration(owner.scope, {
      jurisdiction: "ZA",
      registrationState: "not_registered",
      evidenceReference: "synthetic-fixture:not-a-live-vat-registration",
    });
    const notRegistered = await draftQuotation(owner, exampleQuotationCommercial(), "nr");
    const kept = await owner.service.correctQuotation(owner.scope, notRegistered.id, {
      expectedCurrentVersion: 1,
      description: "Replace compressor",
      commercial: exampleQuotationCommercial({ travelRateMinor: 2500 }),
    });
    assert.equal(kept.versions[0]?.commercial.taxAmountMinor, 0);
    assert.equal(kept.versions[0]?.commercial.travelAmountMinor, 250_000);
    assert.equal(kept.currentVersion, 1);
    const vatAttemptBefore = await owner.service.getQuotation(owner.scope, notRegistered.id);
    await expectBlocked(
      () => owner.service.correctQuotation(owner.scope, notRegistered.id, {
        expectedCurrentVersion: 1,
        description: "Replace compressor",
        commercial: registeredCommercial(),
      }),
      /cannot charge VAT/,
    );
    const vatAttemptAfter = await owner.service.getQuotation(owner.scope, notRegistered.id);
    assert.equal(vatAttemptAfter?.versions[0]?.documentHash, vatAttemptBefore?.versions[0]?.documentHash);
    assert.equal(vatAttemptAfter?.versions[0]?.commercial.taxAmountMinor, 0);
    assert.equal(vatAttemptAfter?.versions[0]?.commercial.taxTreatment, "not_registered");
    assert.equal(vatAttemptAfter?.currentVersion, 1);
    assert.equal(vatAttemptAfter?.events.length, 1);
    const sent = await owner.service.sendQuotation(owner.scope, notRegistered.id, {
      expectedCurrentVersion: 1,
      recipient: "accounts@fuelco.test",
    });
    assert.equal(sent.versions[0]?.status, "awaiting_customer_approval");
    assert.equal(sent.versions[0]?.commercial.taxAmountMinor, 0);
  });

  it("accepts only the approved tax amount when a synthetic registered configuration is verified", async () => {
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
    await expectBlocked(
      () => draftQuotation(owner, exampleQuotationCommercial(), "zero"),
      /does not match the approved tax rule/,
    );
    assert.equal(await countTable("frigora_quotations"), 0);
    assert.equal(await countTable("frigora_quotation_events"), 0);
    const approved = registeredCommercial();
    const quote = await draftQuotation(owner, approved, "reg");
    const before = await owner.service.getQuotation(owner.scope, quote.id);
    await expectBlocked(
      () => owner.service.correctQuotation(owner.scope, quote.id, {
        expectedCurrentVersion: 1,
        description: "Replace compressor",
        commercial: exampleQuotationCommercial(),
      }),
      /does not match the approved tax rule/,
    );
    assert.equal(
      (await owner.service.getQuotation(owner.scope, quote.id))?.versions[0]?.documentHash,
      before?.versions[0]?.documentHash,
    );
    await expectBlocked(
      () => owner.service.correctQuotation(owner.scope, quote.id, {
        expectedCurrentVersion: 1,
        description: "Replace compressor",
        commercial: registeredCommercial(14),
      }),
      /cannot set its own rate/,
    );
    assert.equal(
      (await owner.service.getQuotation(owner.scope, quote.id))?.versions[0]?.documentHash,
      before?.versions[0]?.documentHash,
    );
    const corrected = await owner.service.correctQuotation(owner.scope, quote.id, {
      expectedCurrentVersion: 1,
      description: "Replace compressor and filter drier",
      commercial: approved,
    });
    assert.equal(corrected.currentVersion, 1);
    assert.equal(corrected.versions.length, 1);
    assert.equal(corrected.versions[0]?.commercial.taxTreatment, "configured_rule");
    assert.equal(corrected.versions[0]?.commercial.taxRateNumerator, 15);
    assert.equal(corrected.versions[0]?.commercial.taxAmountMinor, approved.enteredTaxAmountMinor);
    assert.equal(corrected.events.length, 1);
    const pricedHash = corrected.versions[0]?.documentHash;
    const wrongAmount = { ...approved, enteredTaxAmountMinor: (approved.enteredTaxAmountMinor ?? 0) + 1 };
    await assert.rejects(
      () => owner.service.correctQuotation(owner.scope, quote.id, {
        expectedCurrentVersion: 1,
        description: "Replace compressor",
        commercial: wrongAmount,
      }),
      (error: unknown) => {
        assert.ok(error instanceof FrigoraError);
        assert.equal(error.code, "invalid_input");
        assert.match(error.message, /Entered tax does not match/);
        return true;
      },
    );
    assert.equal(
      (await owner.service.getQuotation(owner.scope, quote.id))?.versions[0]?.documentHash,
      pricedHash,
    );
    const sent = await owner.service.sendQuotation(owner.scope, quote.id, {
      expectedCurrentVersion: 1,
      recipient: "accounts@fuelco.test",
    });
    assert.equal(sent.versions[0]?.status, "awaiting_customer_approval");
    assert.equal(sent.versions[0]?.commercial.taxAmountMinor, approved.enteredTaxAmountMinor);
  });

  it("rejects a VAT-bearing creation when the verified configuration is not registered and writes nothing", async () => {
    const owner = await seed();
    await owner.service.verifyTaxConfiguration(owner.scope, {
      jurisdiction: "ZA",
      registrationState: "not_registered",
      evidenceReference: "synthetic-fixture:not-a-live-vat-registration",
    });
    await expectBlocked(
      () => draftQuotation(owner, registeredCommercial(), "vat-create"),
      /cannot charge VAT/,
    );
    assert.equal(await countTable("frigora_quotations"), 0);
    assert.equal(await countTable("frigora_quotation_versions"), 0);
    assert.equal(await countTable("frigora_quotation_events"), 0);
  });

  it("keeps a zero-tax draft where the shared decision allows it and rejects an unverified tax-bearing creation", async () => {
    const owner = await seed();
    const bare = await draftQuotation(owner, exampleQuotationCommercial(), "bare");
    assert.equal(bare.versions[0]?.commercial.taxAmountMinor, 0);
    assert.equal(bare.versions[0]?.commercial.taxTreatment, "not_registered");
    const beforeVat = await countTable("frigora_quotations");
    await expectBlocked(
      () => draftQuotation(owner, registeredCommercial(), "unverified-vat"),
      /no verified tax configuration/,
    );
    assert.equal(await countTable("frigora_quotations"), beforeVat);
    assert.equal((await owner.service.getQuotation(owner.scope, bare.id))?.events.length, 1);

    await owner.service.submitTaxConfigurationForReview(owner.scope, {
      jurisdiction: "ZA",
      registrationState: "pending_review",
      evidenceReference: "synthetic-pending-note",
    });
    await expectBlocked(
      () => draftQuotation(owner, registeredCommercial(), "pending-vat"),
      /no verified tax configuration/,
    );
    assert.equal(await countTable("frigora_quotations"), beforeVat);

    await owner.service.verifyTaxConfiguration(owner.scope, {
      jurisdiction: "ZA",
      registrationState: "not_registered",
      evidenceReference: "synthetic-fixture:not-a-live-vat-registration",
    });
    const notRegistered = await draftQuotation(owner, exampleQuotationCommercial(), "nr-zero");
    assert.equal(notRegistered.versions[0]?.commercial.taxAmountMinor, 0);
    assert.equal(notRegistered.versions[0]?.commercial.taxTreatment, "not_registered");
  });

  it("rejects a VAT-bearing revision on a verified not-registered configuration and keeps the issued version", async () => {
    const owner = await seed();
    await owner.service.verifyTaxConfiguration(owner.scope, {
      jurisdiction: "ZA",
      registrationState: "not_registered",
      evidenceReference: "synthetic-fixture:not-a-live-vat-registration",
    });
    const draft = await draftQuotation(owner, exampleQuotationCommercial(), "revise-vat");
    const sent = await owner.service.sendQuotation(owner.scope, draft.id, {
      expectedCurrentVersion: 1,
      recipient: "accounts@fuelco.test",
    });
    const before = persistedIdentity(sent);
    await expectBlocked(
      () => owner.service.reviseQuotation(owner.scope, sent.id, {
        expectedCurrentVersion: 1,
        description: "Replace compressor",
        commercial: registeredCommercial(),
      }),
      /cannot charge VAT/,
    );
    assert.deepEqual(persistedIdentity(await owner.service.getQuotation(owner.scope, sent.id)), before);
  });

  it("rejects a tax-bearing revision when no configuration is verified and still allows the zero-tax revision", async () => {
    const owner = await seed();
    const verified = await owner.service.verifyTaxConfiguration(owner.scope, {
      jurisdiction: "ZA",
      registrationState: "not_registered",
      evidenceReference: "synthetic-fixture:not-a-live-vat-registration",
    });
    const draft = await draftQuotation(owner, exampleQuotationCommercial(), "revise-missing");
    const sent = await owner.service.sendQuotation(owner.scope, draft.id, {
      expectedCurrentVersion: 1,
      recipient: "accounts@fuelco.test",
    });
    await owner.service.revokeVerifiedTaxConfiguration(owner.scope, verified.id);
    await owner.service.submitTaxConfigurationForReview(owner.scope, {
      jurisdiction: "ZA",
      registrationState: "pending_review",
      evidenceReference: "synthetic-pending-note",
    });
    const before = persistedIdentity(await owner.service.getQuotation(owner.scope, sent.id));
    await expectBlocked(
      () => owner.service.reviseQuotation(owner.scope, sent.id, {
        expectedCurrentVersion: 1,
        description: "Replace compressor",
        commercial: registeredCommercial(),
      }),
      /no verified tax configuration/,
    );
    assert.deepEqual(persistedIdentity(await owner.service.getQuotation(owner.scope, sent.id)), before);
    const revised = await owner.service.reviseQuotation(owner.scope, sent.id, {
      expectedCurrentVersion: 1,
      description: "Replace compressor and filter drier",
      commercial: exampleQuotationCommercial({ travelRateMinor: 2500 }),
    });
    assert.equal(revised.currentVersion, 2);
    assert.equal(revised.versions.find((version) => version.version === 1)?.documentHash, before.versions[0]?.hash);
    assert.equal(revised.versions.find((version) => version.version === 1)?.status, "awaiting_customer_approval");
    assert.equal(revised.versions.find((version) => version.version === 2)?.status, "in_preparation");
    assert.equal(revised.versions.find((version) => version.version === 2)?.commercial.taxAmountMinor, 0);
    assert.equal(revised.versions.find((version) => version.version === 2)?.commercial.taxTreatment, "not_registered");
    assert.equal(revised.events.length, (before.events?.length ?? 0) + 1);
  });

  it("follows the shared tax decision for an expired, future, revoked, or conflicting rule on revision", async () => {
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
    const draft = await draftQuotation(owner, registeredCommercial(), "revise-rule");
    const sent = await owner.service.sendQuotation(owner.scope, draft.id, {
      expectedCurrentVersion: 1,
      recipient: "accounts@fuelco.test",
    });
    const reviseVat = () => owner.service.reviseQuotation(owner.scope, sent.id, {
      expectedCurrentVersion: 1,
      description: "Replace compressor",
      commercial: registeredCommercial(),
    });

    await getClient().execute({
      sql: "UPDATE frigora_tax_rules SET effective_until = ? WHERE id = ?",
      args: ["2020-01-01", SARS_ZA_VAT_STANDARD_RULE.id],
    });
    const expiredBefore = persistedIdentity(await owner.service.getQuotation(owner.scope, sent.id));
    await expectBlocked(reviseVat, /expired/);
    assert.deepEqual(persistedIdentity(await owner.service.getQuotation(owner.scope, sent.id)), expiredBefore);

    await getClient().execute({
      sql: "UPDATE frigora_tax_rules SET effective_until = NULL, status = 'revoked' WHERE id = ?",
      args: [SARS_ZA_VAT_STANDARD_RULE.id],
    });
    await expectBlocked(reviseVat, /not approved/);
    assert.deepEqual(persistedIdentity(await owner.service.getQuotation(owner.scope, sent.id)), expiredBefore);

    await getClient().execute({
      sql: "UPDATE frigora_tax_rules SET status = 'approved' WHERE id = ?",
      args: [SARS_ZA_VAT_STANDARD_RULE.id],
    });
    await getClient().execute({
      sql: `
        INSERT INTO frigora_tax_configurations (
          id, workspace_id, venture_id, version_number, jurisdiction, registration_state,
          evidence_reference, status, created_by_user_id, created_at, verified_by_user_id, verified_at
        ) VALUES (?, ?, ?, 99, 'ZA', 'not_registered', ?, 'verified', ?, ?, ?, ?)
      `,
      args: [
        "config-extra",
        owner.scope.workspaceId,
        owner.scope.ventureId,
        "synthetic-fixture:second-not-registered",
        owner.scope.userId,
        NOW,
        owner.scope.userId,
        NOW,
      ],
    });
    await expectBlocked(reviseVat, /conflicting/);
    assert.deepEqual(persistedIdentity(await owner.service.getQuotation(owner.scope, sent.id)), expiredBefore);
    await getClient().execute("DELETE FROM frigora_tax_configurations WHERE id = 'config-extra'");

    await getClient().execute("DROP TRIGGER IF EXISTS frigora_tax_rules_rate_immutable");
    await getClient().execute({
      sql: "UPDATE frigora_tax_rules SET effective_from = ? WHERE id = ?",
      args: ["2099-01-01", SARS_ZA_VAT_STANDARD_RULE.id],
    });
    await expectBlocked(reviseVat, /not yet effective/);
    assert.deepEqual(persistedIdentity(await owner.service.getQuotation(owner.scope, sent.id)), expiredBefore);
  });

  it("creates the next version when a revision matches the shared tax decision", async () => {
    const owner = await seed();
    await owner.service.verifyTaxConfiguration(owner.scope, {
      jurisdiction: "ZA",
      registrationState: "not_registered",
      evidenceReference: "synthetic-fixture:not-a-live-vat-registration",
    });
    const draft = await draftQuotation(owner, exampleQuotationCommercial(), "revise-ok");
    const sent = await owner.service.sendQuotation(owner.scope, draft.id, {
      expectedCurrentVersion: 1,
      recipient: "accounts@fuelco.test",
    });
    const issuedHash = sent.versions[0]?.documentHash;
    const revised = await owner.service.reviseQuotation(owner.scope, sent.id, {
      expectedCurrentVersion: 1,
      description: "Replace compressor and filter drier",
      commercial: exampleQuotationCommercial({ travelRateMinor: 2500 }),
    });
    assert.equal(revised.currentVersion, 2);
    assert.equal(revised.versions.find((version) => version.version === 1)?.status, "awaiting_customer_approval");
    assert.equal(revised.versions.find((version) => version.version === 1)?.documentHash, issuedHash);
    const next = revised.versions.find((version) => version.version === 2);
    assert.equal(next?.status, "in_preparation");
    assert.equal(next?.commercial.taxAmountMinor, 0);
    assert.equal(next?.commercial.taxTreatment, "not_registered");
    assert.equal(next?.commercial.travelAmountMinor, 250_000);
    assert.equal(revised.events.filter((event) => event.kind === "revision_started").length, 1);
    assert.equal(revised.events.filter((event) => event.kind === "sent").length, 1);
  });
});
