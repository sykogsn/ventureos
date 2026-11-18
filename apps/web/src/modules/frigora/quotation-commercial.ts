import { createHash } from "node:crypto";

/**
 * Commercial basis of one quotation version.
 *
 * There is no venture tax-rule register and no statutory rate in this module.
 * A configured rule is an explicit snapshot supplied with the quotation.
 * Distance basis is recorded and never chosen here. Return kilometres are not doubled.
 */
export const FRIGORA_DISTANCE_BASES = ["one_way", "return"] as const;
export type FrigoraDistanceBasis = (typeof FRIGORA_DISTANCE_BASES)[number];

export const FRIGORA_QUOTE_TAX_TREATMENTS = ["not_registered", "configured_rule"] as const;
export type FrigoraQuoteTaxTreatment = (typeof FRIGORA_QUOTE_TAX_TREATMENTS)[number];

export type FrigoraQuotationCommercialInput = {
  labourQuantityMilli: number;
  labourUnit: string;
  labourRateMinor: number;
  travelKilometresMilli: number;
  distanceBasis: FrigoraDistanceBasis;
  travelRateMinor: number;
  taxTreatment: FrigoraQuoteTaxTreatment;
  taxRuleId?: string | null;
  taxRuleVersion?: string | null;
  taxRateNumerator?: number | null;
  taxRateDenominator?: number | null;
  /** When present, must equal the tax amount produced by the configured rule. */
  enteredTaxAmountMinor?: number | null;
};

export type FrigoraQuotationCommercialSnapshot = {
  labourQuantityMilli: number;
  labourUnit: string;
  labourRateMinor: number;
  labourAmountMinor: number;
  travelKilometresMilli: number;
  distanceBasis: FrigoraDistanceBasis;
  travelRateMinor: number;
  travelAmountMinor: number;
  taxTreatment: FrigoraQuoteTaxTreatment;
  taxRuleId: string | null;
  taxRuleVersion: string | null;
  taxRateNumerator: number | null;
  taxRateDenominator: number | null;
  taxableAmountMinor: number;
  taxAmountMinor: number;
  totalMinor: number;
  currency: "ZAR";
};

export class QuotationCommercialError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "QuotationCommercialError";
  }
}

function reject(message: string): never {
  throw new QuotationCommercialError(message);
}

function nonNegativeInteger(value: number, label: string): number {
  if (!Number.isSafeInteger(value) || value < 0) {
    reject(`${label} must be a non-negative integer ZAR cents.`);
  }
  return value;
}

function nonNegativeMilli(value: number, label: string): number {
  if (!Number.isSafeInteger(value) || value < 0) {
    reject(`${label} must be a non-negative integer.`);
  }
  return value;
}

/** Half-up integer division for non-negative values. Avoids binary floating point. */
export function roundMulDiv(left: number, right: number, divisor: number): number {
  if (
    !Number.isSafeInteger(left) ||
    !Number.isSafeInteger(right) ||
    !Number.isSafeInteger(divisor) ||
    left < 0 ||
    right < 0 ||
    divisor <= 0
  ) {
    reject("Charge rounding inputs must be non-negative integers.");
  }
  const rounded = (BigInt(left) * BigInt(right) + BigInt(divisor) / 2n) / BigInt(divisor);
  const value = Number(rounded);
  if (!Number.isSafeInteger(value)) {
    reject("Charge rounding exceeded a safe integer.");
  }
  return value;
}

function blankToNull(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function priceQuotationCommercial(
  input: FrigoraQuotationCommercialInput,
): FrigoraQuotationCommercialSnapshot {
  const labourUnit = input.labourUnit?.trim?.() ?? "";
  if (!labourUnit) reject("Labour unit is required.");
  if (!FRIGORA_DISTANCE_BASES.includes(input.distanceBasis)) {
    reject("Billable distance basis must be one_way or return.");
  }
  const labourQuantityMilli = nonNegativeMilli(input.labourQuantityMilli, "Labour quantity");
  const labourRateMinor = nonNegativeInteger(input.labourRateMinor, "Labour rate");
  const travelKilometresMilli = nonNegativeMilli(input.travelKilometresMilli, "Travel kilometres");
  const travelRateMinor = nonNegativeInteger(input.travelRateMinor, "Travel rate");
  const labourAmountMinor = roundMulDiv(labourQuantityMilli, labourRateMinor, 1000);
  const travelAmountMinor = roundMulDiv(travelKilometresMilli, travelRateMinor, 1000);
  const taxableAmountMinor = labourAmountMinor + travelAmountMinor;
  if (!Number.isSafeInteger(taxableAmountMinor)) {
    reject("Taxable amount exceeded a safe integer.");
  }

  const taxRuleId = blankToNull(input.taxRuleId);
  const taxRuleVersion = blankToNull(input.taxRuleVersion);
  const hasNumerator = input.taxRateNumerator != null;
  const hasDenominator = input.taxRateDenominator != null;
  const entered = input.enteredTaxAmountMinor;

  if (input.taxTreatment === "not_registered") {
    if (taxRuleId || taxRuleVersion || hasNumerator || hasDenominator) {
      reject("A business that is not VAT-registered cannot carry a tax rule on the quotation.");
    }
    if (entered != null && entered !== 0) {
      reject("Entered tax must be zero when no tax rule applies.");
    }
    return {
      labourQuantityMilli,
      labourUnit,
      labourRateMinor,
      labourAmountMinor,
      travelKilometresMilli,
      distanceBasis: input.distanceBasis,
      travelRateMinor,
      travelAmountMinor,
      taxTreatment: "not_registered",
      taxRuleId: null,
      taxRuleVersion: null,
      taxRateNumerator: null,
      taxRateDenominator: null,
      taxableAmountMinor,
      taxAmountMinor: 0,
      totalMinor: taxableAmountMinor,
      currency: "ZAR",
    };
  }

  if (input.taxTreatment !== "configured_rule") {
    reject("Tax treatment must be not_registered or configured_rule.");
  }
  if (!taxRuleId || !taxRuleVersion) {
    reject("A configured tax rule id and version are required.");
  }
  if (!hasNumerator || !hasDenominator || input.taxRateNumerator == null || input.taxRateDenominator == null) {
    reject("A configured tax rule rate is required.");
  }
  const taxRateNumerator = nonNegativeInteger(input.taxRateNumerator, "Tax rate numerator");
  if (!Number.isSafeInteger(input.taxRateDenominator) || input.taxRateDenominator <= 0) {
    reject("Tax rate denominator must be a positive integer.");
  }
  const taxAmountMinor = roundMulDiv(taxableAmountMinor, taxRateNumerator, input.taxRateDenominator);
  if (entered != null && entered !== taxAmountMinor) {
    reject("Entered tax does not match the configured rule.");
  }
  const totalMinor = taxableAmountMinor + taxAmountMinor;
  if (!Number.isSafeInteger(totalMinor)) {
    reject("Quotation total exceeded a safe integer.");
  }
  return {
    labourQuantityMilli,
    labourUnit,
    labourRateMinor,
    labourAmountMinor,
    travelKilometresMilli,
    distanceBasis: input.distanceBasis,
    travelRateMinor,
    travelAmountMinor,
    taxTreatment: "configured_rule",
    taxRuleId,
    taxRuleVersion,
    taxRateNumerator,
    taxRateDenominator: input.taxRateDenominator,
    taxableAmountMinor,
    taxAmountMinor,
    totalMinor,
    currency: "ZAR",
  };
}

/** 10 hours at R1000 plus 100 one-way kilometres at R49.50, with no tax rule. Total R14,950.00. */
export function exampleQuotationCommercial(
  patch: Partial<FrigoraQuotationCommercialInput> = {},
): FrigoraQuotationCommercialInput {
  return {
    labourQuantityMilli: 10_000,
    labourUnit: "hour",
    labourRateMinor: 100_000,
    travelKilometresMilli: 100_000,
    distanceBasis: "one_way",
    travelRateMinor: 4_950,
    taxTreatment: "not_registered",
    taxRuleId: null,
    taxRuleVersion: null,
    taxRateNumerator: null,
    taxRateDenominator: null,
    enteredTaxAmountMinor: null,
    ...patch,
  };
}

export function quotationDocumentHash(content: {
  version: number;
  description: string;
} & FrigoraQuotationCommercialSnapshot): string {
  const canonical = JSON.stringify({
    currency: content.currency,
    description: content.description,
    distanceBasis: content.distanceBasis,
    labourAmountMinor: content.labourAmountMinor,
    labourQuantityMilli: content.labourQuantityMilli,
    labourRateMinor: content.labourRateMinor,
    labourUnit: content.labourUnit,
    taxAmountMinor: content.taxAmountMinor,
    taxRateDenominator: content.taxRateDenominator,
    taxRateNumerator: content.taxRateNumerator,
    taxRuleId: content.taxRuleId,
    taxRuleVersion: content.taxRuleVersion,
    taxTreatment: content.taxTreatment,
    taxableAmountMinor: content.taxableAmountMinor,
    totalMinor: content.totalMinor,
    travelAmountMinor: content.travelAmountMinor,
    travelKilometresMilli: content.travelKilometresMilli,
    travelRateMinor: content.travelRateMinor,
    version: content.version,
  });
  return createHash("sha256").update(canonical, "utf8").digest("hex");
}

/** Commercial line used to hash an offer and to price a customer selection. */
export type QuotationOfferLine = {
  /** Sort tie-breaker only. It is not part of the document hash. */
  id: string;
  lineNumber: number;
  catalogueItemId: string | null;
  sku: string | null;
  description: string;
  unit: string;
  quantityMilli: number;
  unitPriceMinor: number;
  currency: "ZAR";
  taxTreatment: FrigoraQuoteTaxTreatment;
  lineRole: "mandatory" | "optional";
};

/** Same half-up rule as labour and travel. Quantity is thousandths of a unit. */
export function lineTotalMinor(quantityMilli: number, unitPriceMinor: number): number {
  return roundMulDiv(quantityMilli, unitPriceMinor, 1000);
}

function sortedOfferLines(lines: readonly QuotationOfferLine[]): QuotationOfferLine[] {
  return [...lines].sort((left, right) => {
    if (left.lineNumber !== right.lineNumber) return left.lineNumber - right.lineNumber;
    if (left.id < right.id) return -1;
    if (left.id > right.id) return 1;
    return 0;
  });
}

/**
 * Lineless quotations keep quotationDocumentHash exactly.
 * A version with lines adds one lines array. The labour total inside the hash
 * stays the stored labour-and-travel snapshot.
 */
export function quotationOfferHash(
  content: {
    version: number;
    description: string;
    lines?: readonly QuotationOfferLine[];
  } & FrigoraQuotationCommercialSnapshot,
): string {
  const lines = content.lines ?? [];
  if (lines.length === 0) {
    return quotationDocumentHash(content);
  }
  const canonical = JSON.stringify({
    currency: content.currency,
    description: content.description,
    distanceBasis: content.distanceBasis,
    labourAmountMinor: content.labourAmountMinor,
    labourQuantityMilli: content.labourQuantityMilli,
    labourRateMinor: content.labourRateMinor,
    labourUnit: content.labourUnit,
    lines: sortedOfferLines(lines).map((line) => ({
      catalogueItemId: line.catalogueItemId,
      currency: line.currency,
      description: line.description,
      discountEligible: 0,
      lineRole: line.lineRole,
      lineTotalMinor: lineTotalMinor(line.quantityMilli, line.unitPriceMinor),
      quantityMilli: line.quantityMilli,
      sku: line.sku,
      taxTreatment: line.taxTreatment,
      unit: line.unit,
      unitPriceMinor: line.unitPriceMinor,
    })),
    taxAmountMinor: content.taxAmountMinor,
    taxRateDenominator: content.taxRateDenominator,
    taxRateNumerator: content.taxRateNumerator,
    taxRuleId: content.taxRuleId,
    taxRuleVersion: content.taxRuleVersion,
    taxTreatment: content.taxTreatment,
    taxableAmountMinor: content.taxableAmountMinor,
    totalMinor: content.totalMinor,
    travelAmountMinor: content.travelAmountMinor,
    travelKilometresMilli: content.travelKilometresMilli,
    travelRateMinor: content.travelRateMinor,
    version: content.version,
  });
  return createHash("sha256").update(canonical, "utf8").digest("hex");
}

export type QuotationSelectionTotals = {
  offerTotalMinor: number;
  authorisedTotalMinor: number;
  offerTaxAmountMinor: number;
  authorisedTaxAmountMinor: number;
};

function lineAmount(line: QuotationOfferLine): number {
  const total = lineTotalMinor(line.quantityMilli, line.unitPriceMinor);
  if (total < 0) reject("Line total cannot be negative.");
  return total;
}

function taxOnBase(commercial: FrigoraQuotationCommercialSnapshot, taxableBase: number): number {
  if (commercial.taxTreatment === "not_registered") return 0;
  if (
    commercial.taxRateNumerator == null
    || commercial.taxRateDenominator == null
    || commercial.taxRateDenominator <= 0
  ) {
    reject("A configured tax rule rate is required.");
  }
  return roundMulDiv(taxableBase, commercial.taxRateNumerator, commercial.taxRateDenominator);
}

function amountForLines(
  commercial: FrigoraQuotationCommercialSnapshot,
  lines: readonly QuotationOfferLine[],
): { totalMinor: number; taxAmountMinor: number } {
  let configured = 0;
  let untaxed = 0;
  for (const line of lines) {
    if (line.currency !== "ZAR") reject("Quotation lines must be priced in ZAR.");
    if (commercial.taxTreatment === "not_registered" && line.taxTreatment === "configured_rule") {
      reject("A business that is not VAT-registered cannot issue a configured-rule line.");
    }
    const amount = lineAmount(line);
    if (line.taxTreatment === "configured_rule") configured += amount;
    else untaxed += amount;
  }
  const labourAndTravel = commercial.labourAmountMinor + commercial.travelAmountMinor;
  const taxableBase = labourAndTravel + configured;
  if (!Number.isSafeInteger(taxableBase)) reject("Taxable amount exceeded a safe integer.");
  const taxAmountMinor = taxOnBase(commercial, taxableBase);
  const totalMinor = taxableBase + untaxed + taxAmountMinor;
  if (!Number.isSafeInteger(totalMinor) || totalMinor < 0) {
    reject("Quotation total exceeded a safe integer.");
  }
  return { totalMinor, taxAmountMinor };
}

/**
 * The offer prices every line. The authorised amount prices mandatory lines
 * plus the selected optional ids. VAT is rounded once on each taxable base.
 */
export function priceQuotationSelection(
  commercial: FrigoraQuotationCommercialSnapshot,
  lines: readonly QuotationOfferLine[],
  selectedOptionalIds: readonly string[],
): QuotationSelectionTotals {
  const seen = new Set<string>();
  for (const id of selectedOptionalIds) {
    if (seen.has(id)) reject("An optional line was submitted more than once.");
    seen.add(id);
    const line = lines.find((candidate) => candidate.id === id);
    if (!line) reject("An optional line is not on this quotation version.");
    if (line.lineRole !== "optional") reject("A mandatory line cannot be submitted as a choice.");
  }
  const selected = lines.filter(
    (line) => line.lineRole === "mandatory" || selectedOptionalIds.includes(line.id),
  );
  const offer = amountForLines(commercial, lines);
  const authorised = amountForLines(commercial, selected);
  return {
    offerTotalMinor: offer.totalMinor,
    authorisedTotalMinor: authorised.totalMinor,
    offerTaxAmountMinor: offer.taxAmountMinor,
    authorisedTaxAmountMinor: authorised.taxAmountMinor,
  };
}
