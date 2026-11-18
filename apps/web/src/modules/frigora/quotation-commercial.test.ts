import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import {
  exampleQuotationCommercial,
  priceQuotationCommercial,
  QuotationCommercialError,
  lineTotalMinor,
  priceQuotationSelection,
  quotationDocumentHash,
  quotationOfferHash,
  roundMulDiv,
  type QuotationOfferLine,
} from "./quotation-commercial";

const source = readFileSync(fileURLToPath(new URL("./quotation-commercial.ts", import.meta.url)), "utf8");

function priced(patch: Parameters<typeof exampleQuotationCommercial>[0] = {}) {
  return priceQuotationCommercial(exampleQuotationCommercial(patch));
}

test("prices labour and travel in integer cents without assuming distance basis", () => {
  const oneWay = priced();
  const returned = priced({ distanceBasis: "return" });
  assert.equal(oneWay.labourAmountMinor, 1_000_000);
  assert.equal(oneWay.travelAmountMinor, 495_000);
  assert.equal(oneWay.taxableAmountMinor, 1_495_000);
  assert.equal(oneWay.taxAmountMinor, 0);
  assert.equal(oneWay.totalMinor, 1_495_000);
  assert.equal(returned.travelAmountMinor, oneWay.travelAmountMinor);
  assert.equal(returned.distanceBasis, "return");
  assert.notEqual(oneWay.distanceBasis, returned.distanceBasis);
  assert.equal(roundMulDiv(501, 1, 1000), 1);
  assert.equal(roundMulDiv(499, 1, 1000), 0);
});

test("rejects a missing distance basis, labour unit, and unresolved tax treatment", () => {
  assert.throws(
    () => priced({ distanceBasis: "both" as "one_way" }),
    /one_way or return/,
  );
  assert.throws(() => priced({ labourUnit: "  " }), /Labour unit is required/);
  assert.throws(
    () => priced({ taxTreatment: "unknown" as "not_registered" }),
    /Tax treatment must be/,
  );
  assert.throws(
    () => priced({ labourRateMinor: 12.5 }),
    (error: unknown) => error instanceof QuotationCommercialError && /integer ZAR cents/.test(error.message),
  );
});

test("requires an explicit configured rule and rejects a mismatched manual tax amount", () => {
  assert.throws(
    () => priced({ taxTreatment: "configured_rule" }),
    /configured tax rule id and version are required/,
  );
  assert.throws(
    () => priced({
      taxTreatment: "configured_rule",
      taxRuleId: "venture-tax-2026",
      taxRuleVersion: "1",
    }),
    /configured tax rule rate is required/,
  );
  const ruled = priced({
    taxTreatment: "configured_rule",
    taxRuleId: "venture-tax-2026",
    taxRuleVersion: "1",
    taxRateNumerator: 3,
    taxRateDenominator: 20,
  });
  assert.equal(ruled.taxAmountMinor, roundMulDiv(1_495_000, 3, 20));
  assert.equal(ruled.totalMinor, 1_495_000 + ruled.taxAmountMinor);
  assert.throws(
    () => priced({
      taxTreatment: "configured_rule",
      taxRuleId: "venture-tax-2026",
      taxRuleVersion: "1",
      taxRateNumerator: 3,
      taxRateDenominator: 20,
      enteredTaxAmountMinor: ruled.taxAmountMinor + 1,
    }),
    /does not match the configured rule/,
  );
  assert.throws(
    () => priced({ taxTreatment: "not_registered", taxRuleId: "venture-tax-2026" }),
    /cannot carry a tax rule/,
  );
});

test("changes the document hash for every commercially material field", () => {
  const base = priced();
  const hash = quotationDocumentHash({ version: 1, description: "Replace compressor", ...base });
  const changed = [
    priced({ labourQuantityMilli: 10_001 }),
    priced({ labourUnit: "day" }),
    priced({ labourRateMinor: 100_001 }),
    priced({ travelKilometresMilli: 100_001 }),
    priced({ distanceBasis: "return" }),
    priced({ travelRateMinor: 4_951 }),
    priced({
      taxTreatment: "configured_rule",
      taxRuleId: "venture-tax-2026",
      taxRuleVersion: "1",
      taxRateNumerator: 0,
      taxRateDenominator: 1,
    }),
  ];
  for (const commercial of changed) {
    assert.notEqual(
      quotationDocumentHash({ version: 1, description: "Replace compressor", ...commercial }),
      hash,
    );
  }
  assert.notEqual(
    quotationDocumentHash({ version: 2, description: "Replace compressor", ...base }),
    hash,
  );
  assert.equal(source.includes("0.15"), false);
  assert.equal(/rate\s*=\s*15\b/.test(source), false);
});

function offerLine(patch: Partial<QuotationOfferLine> = {}): QuotationOfferLine {
  return {
    id: "line-a",
    lineNumber: 1,
    catalogueItemId: null,
    sku: null,
    description: "Gasket",
    unit: "each",
    quantityMilli: 1_000,
    unitPriceMinor: 15_000,
    currency: "ZAR",
    taxTreatment: "not_registered",
    lineRole: "mandatory",
    ...patch,
  };
}

test("keeps a lineless hash and prices a selection without double tax", () => {
  const base = priced();
  assert.equal(
    quotationOfferHash({ version: 1, description: "Replace compressor", ...base, lines: [] }),
    quotationDocumentHash({ version: 1, description: "Replace compressor", ...base }),
  );
  const mandatory = offerLine();
  const optional = offerLine({
    id: "line-b",
    lineNumber: 2,
    description: "Filter",
    quantityMilli: 2_000,
    lineRole: "optional",
  });
  const withLines = quotationOfferHash({
    version: 1,
    description: "Replace compressor",
    ...base,
    lines: [optional, mandatory],
  });
  assert.equal(
    withLines,
    quotationOfferHash({
      version: 1,
      description: "Replace compressor",
      ...base,
      lines: [mandatory, { ...optional, id: "different-id" }],
    }),
  );
  assert.notEqual(
    withLines,
    quotationOfferHash({
      version: 1,
      description: "Replace compressor",
      ...base,
      lines: [{ ...mandatory, description: "Changed gasket" }, optional],
    }),
  );
  assert.equal(lineTotalMinor(1_000, 15_000), 15_000);
  assert.equal(lineTotalMinor(2_000, 15_000), 30_000);
  const selection = priceQuotationSelection(base, [mandatory, optional], []);
  assert.equal(selection.offerTotalMinor, base.totalMinor + 45_000);
  assert.equal(selection.authorisedTotalMinor, base.totalMinor + 15_000);
  const chosen = priceQuotationSelection(base, [mandatory, optional], ["line-b"]);
  assert.equal(chosen.authorisedTotalMinor, selection.offerTotalMinor);
  assert.equal(chosen.offerTotalMinor, selection.offerTotalMinor);
  const rated = priced({
    taxTreatment: "configured_rule",
    taxRuleId: "rule",
    taxRuleVersion: "1",
    taxRateNumerator: 15,
    taxRateDenominator: 100,
  });
  const taxedLine = offerLine({ taxTreatment: "configured_rule" });
  const taxed = priceQuotationSelection(rated, [taxedLine], []);
  const baseTax = roundMulDiv(rated.labourAmountMinor + rated.travelAmountMinor, 15, 100);
  assert.equal(rated.taxAmountMinor, baseTax);
  const expandedBase = rated.labourAmountMinor + rated.travelAmountMinor + 15_000;
  assert.equal(taxed.offerTaxAmountMinor, roundMulDiv(expandedBase, 15, 100));
  assert.equal(taxed.offerTotalMinor, expandedBase + taxed.offerTaxAmountMinor);
  assert.throws(
    () => priceQuotationSelection(base, [taxedLine], []),
    /not VAT-registered/,
  );
  assert.throws(
    () => priceQuotationSelection(base, [mandatory, optional], ["missing"]),
    /not on this quotation version/,
  );
});
