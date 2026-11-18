import {
  priceQuotationCommercial,
  type FrigoraQuotationCommercialSnapshot,
} from "./quotation-commercial";

/**
 * Public SARS reference for the standard VAT rate.
 *
 * Verified from SARS pages on 29 October 2026:
 * - https://www.sars.gov.za/tax-rates/other-taxes/ (page last updated 26 February 2026)
 *   states, dated 25 February 2026, that VAT is levied at the standard rate of 15%
 *   on supplies by registered vendors.
 * - https://www.sars.gov.za/types-of-tax/value-added-tax/ records that the Rates Bill
 *   introduced on 24 April 2025 proposes to maintain that rate at 15% from 1 May 2025.
 *
 * Those pages also state registration thresholds. A threshold is not this venture's
 * registration status, and this reference does not verify any venture.
 */
export const SARS_ZA_VAT_STANDARD_RULE = {
  id: "sars-za-vat-standard-15",
  jurisdiction: "ZA",
  treatment: "standard_rated",
  rateNumerator: 15,
  rateDenominator: 100,
  effectiveFrom: "2025-05-01",
  effectiveUntil: null as string | null,
  sourceTitle: "SARS Other Taxes — Value-added Tax (VAT)",
  sourceUrl: "https://www.sars.gov.za/tax-rates/other-taxes/",
  sourceStatementDate: "2026-02-25",
  sourceNote:
    "SARS Other Taxes, last updated 26 February 2026, states on 25 February 2026 that VAT is levied at the standard rate of 15% on the supply of goods and services by registered vendors. The SARS VAT page records that the Rates Bill introduced on 24 April 2025 proposes to maintain the rate at 15% from 1 May 2025. Registration thresholds on those pages are not a venture registration fact.",
} as const;

export const TAX_CONFIGURATION_SEND_BLOCKED =
  "Sending is blocked. This venture has no verified tax configuration. Record evidence of its VAT registration or non-registration, and have an authorised person verify that configuration. A rate or rule typed on the quotation does not establish either fact.";

/** Same tax-bearing test used by issue/send. A zero-tax not-registered snapshot is false. */
export function quotationCommercialChargesVat(
  commercial: FrigoraQuotationCommercialSnapshot,
): boolean {
  return commercial.taxTreatment !== "not_registered"
    || commercial.taxAmountMinor !== 0
    || commercial.taxRuleId != null
    || commercial.taxRateNumerator != null
    || commercial.taxRateDenominator != null;
}

export type TaxRuleStatus = "reference" | "approved" | "revoked";
export type TaxRegistrationState = "unverified" | "pending_review" | "registered" | "not_registered";
export type TaxConfigurationStatus = "draft" | "pending_review" | "verified" | "revoked";

export type TaxRuleRecord = {
  id: string;
  jurisdiction: string;
  treatment: string;
  rateNumerator: number;
  rateDenominator: number;
  effectiveFrom: string;
  effectiveUntil: string | null;
  sourceTitle: string;
  sourceUrl: string;
  sourceStatementDate: string;
  sourceNote: string;
  status: TaxRuleStatus;
  approvedByUserId: string | null;
  approvedAt: string | null;
};

export type TaxConfigurationRecord = {
  id: string;
  workspaceId: string;
  ventureId: string;
  version: number;
  jurisdiction: string;
  registrationState: TaxRegistrationState;
  registrationNumber: string | null;
  liabilityDate: string | null;
  taxRuleId: string | null;
  evidenceReference: string | null;
  status: TaxConfigurationStatus;
  createdByUserId: string;
  createdAt: string;
  verifiedByUserId: string | null;
  verifiedAt: string | null;
};

export type TaxConfigurationEventRecord = {
  id: string;
  configurationId: string;
  workspaceId: string;
  ventureId: string;
  version: number;
  kind: string;
  occurredAt: string;
  actorUserId: string;
  summary: string;
};

export function quotationTaxSendBlocker(input: {
  configurations: readonly TaxConfigurationRecord[];
  rules: readonly TaxRuleRecord[];
  commercial: FrigoraQuotationCommercialSnapshot;
  asOfDate: string;
}): string | null {
  const verified = input.configurations.filter((configuration) => configuration.status === "verified");
  if (verified.length === 0) {
    return TAX_CONFIGURATION_SEND_BLOCKED;
  }
  if (verified.length > 1) {
    return "Sending is blocked. More than one verified tax configuration is active, so the applicable treatment is conflicting. Revoke the configuration that should not apply.";
  }
  const configuration = verified[0];
  if (!configuration) {
    return TAX_CONFIGURATION_SEND_BLOCKED;
  }
  if (!configuration.evidenceReference?.trim() || !configuration.verifiedAt || !configuration.verifiedByUserId) {
    return "Sending is blocked. The verified configuration has no evidence reference or authorised verifier.";
  }
  if (configuration.registrationState === "not_registered") {
    if (configuration.taxRuleId) {
      return "Sending is blocked. A not-registered configuration cannot name a VAT rule.";
    }
    if (quotationCommercialChargesVat(input.commercial)) {
      return "Sending is blocked. A verified not-registered configuration cannot charge VAT. The quotation cannot override that.";
    }
    return null;
  }
  if (configuration.registrationState !== "registered") {
    return "Sending is blocked. The configuration is not a verified registered or not-registered status. An unverified or pending state cannot be used to send.";
  }
  if (!configuration.registrationNumber?.trim() || !configuration.liabilityDate || !configuration.taxRuleId) {
    return "Sending is blocked. A registered configuration needs a registration number, liability date, and an approved tax rule.";
  }
  if (configuration.liabilityDate > input.asOfDate) {
    return "Sending is blocked. The VAT liability date is after this quotation's send date, so the registration is not yet effective.";
  }
  const rule = input.rules.find((candidate) => candidate.id === configuration.taxRuleId);
  if (!rule || rule.status !== "approved") {
    return "Sending is blocked. The configuration names a tax rule that is not approved. A public SARS page does not by itself approve the rule or verify this venture.";
  }
  if (rule.jurisdiction !== configuration.jurisdiction) {
    return "Sending is blocked. The approved tax rule is outside this configuration's jurisdiction.";
  }
  if (rule.effectiveFrom > input.asOfDate) {
    return "Sending is blocked. The approved tax rule is not yet effective on the quotation send date.";
  }
  if (rule.effectiveUntil && rule.effectiveUntil < input.asOfDate) {
    return "Sending is blocked. The approved tax rule expired before the quotation send date.";
  }
  if (
    input.commercial.taxTreatment !== "configured_rule"
    || input.commercial.taxRuleId !== rule.id
    || input.commercial.taxRateNumerator !== rule.rateNumerator
    || input.commercial.taxRateDenominator !== rule.rateDenominator
  ) {
    return "Sending is blocked. The rate on the quotation does not match the approved tax rule. A quotation cannot set its own rate.";
  }
  try {
    const priced = priceQuotationCommercial({
      labourQuantityMilli: input.commercial.labourQuantityMilli,
      labourUnit: input.commercial.labourUnit,
      labourRateMinor: input.commercial.labourRateMinor,
      travelKilometresMilli: input.commercial.travelKilometresMilli,
      distanceBasis: input.commercial.distanceBasis,
      travelRateMinor: input.commercial.travelRateMinor,
      taxTreatment: "configured_rule",
      taxRuleId: rule.id,
      taxRuleVersion: rule.effectiveFrom,
      taxRateNumerator: rule.rateNumerator,
      taxRateDenominator: rule.rateDenominator,
      enteredTaxAmountMinor: input.commercial.taxAmountMinor,
    });
    if (priced.taxAmountMinor !== input.commercial.taxAmountMinor || priced.totalMinor !== input.commercial.totalMinor) {
      return "Sending is blocked. The quotation tax amount does not match the approved rule.";
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "The quotation tax amount does not match the approved rule.";
    return `Sending is blocked. ${message} A submitted rate cannot override the approved rule.`;
  }
  return null;
}

/**
 * Create, correction, and revision use the issue/send tax decision for the snapshot
 * that would be saved. A zero-tax not-registered draft may still be written before any
 * configuration is verified. That permission does not confirm the venture is registered
 * or not registered. A verified configuration that would refuse the snapshot refuses
 * the write as well.
 */
export function quotationTaxCorrectionBlocker(input: {
  configurations: readonly TaxConfigurationRecord[];
  rules: readonly TaxRuleRecord[];
  commercial: FrigoraQuotationCommercialSnapshot;
  asOfDate: string;
}): string | null {
  const sendBlocker = quotationTaxSendBlocker(input);
  if (sendBlocker === null) {
    return null;
  }
  const verified = input.configurations.filter((configuration) => configuration.status === "verified");
  if (verified.length === 0 && !quotationCommercialChargesVat(input.commercial)) {
    return null;
  }
  return sendBlocker;
}
