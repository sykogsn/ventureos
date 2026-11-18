export type CustomerQuotationCommercialView = {
  labourQuantityMilli: number;
  labourUnit: string;
  labourRateMinor: number;
  labourAmountMinor: number;
  travelKilometresMilli: number;
  distanceBasis: "one_way" | "return";
  travelRateMinor: number;
  travelAmountMinor: number;
  taxableAmountMinor: number;
  taxTreatment: "not_registered" | "configured_rule";
  taxAmountMinor: number;
  taxRateNumerator: number | null;
  taxRateDenominator: number | null;
};

export type CustomerQuotationLineView = {
  id: string;
  lineNumber: number;
  description: string;
  quantityMilli: number;
  unit: string;
  unitPriceMinor: number;
  lineTotalMinor: number;
  lineRole: "mandatory" | "optional";
  taxTreatment: "not_registered" | "configured_rule";
};

export type CustomerQuotationReview =
  | { state: "invalid" }
  | { state: "expired" }
  | { state: "revoked" }
  | { state: "limited" }
  | { state: "used"; decision: "approved" | "declined"; version: number }
  | { state: "stale" }
  | {
      state: "ready";
      version: number;
      description: string;
      currency: "ZAR";
      totalMinor: number;
      customerName: string;
      siteName: string;
      issuedAt: string | null;
      expiresAt: string;
      commercial: CustomerQuotationCommercialView | null;
      lines: CustomerQuotationLineView[];
      offerTotalMinor: number;
    };

export type CustomerQuotationSubmission =
  | { state: "approved" | "declined"; version: number }
  | { state: "invalid" }
  | { state: "expired" }
  | { state: "revoked" }
  | { state: "limited" }
  | { state: "used"; decision: "approved" | "declined"; version: number }
  | { state: "stale" };

export function formatQuotationMoney(currency: string, totalMinor: number) {
  if (currency !== "ZAR" || !Number.isInteger(totalMinor) || totalMinor < 0) {
    return "";
  }
  return new Intl.NumberFormat("en-ZA", { style: "currency", currency: "ZAR" }).format(totalMinor / 100);
}
