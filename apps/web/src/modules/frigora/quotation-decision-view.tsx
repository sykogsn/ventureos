import {
  formatQuotationMoney,
  type CustomerQuotationCommercialView,
  type CustomerQuotationReview,
} from "./quotation-decision-contract";
import { priceQuotationSelection, type FrigoraQuotationCommercialSnapshot } from "./quotation-commercial";

function quantity(milli: number) {
  return (milli / 1000).toLocaleString("en-ZA", { maximumFractionDigits: 3 });
}

function taxCopy(commercial: CustomerQuotationCommercialView) {
  if (commercial.taxTreatment === "not_registered") {
    return "Not registered. Tax on this issued quotation is zero.";
  }
  if (commercial.taxRateNumerator == null || commercial.taxRateDenominator == null) {
    return "Tax follows the rule stored on this issued quotation.";
  }
  return `Tax rate stored on this issued quotation: ${commercial.taxRateNumerator}/${commercial.taxRateDenominator}.`;
}

export function QuotationDecisionView({
  review,
  selectedOptionalIds = [],
  onToggleOptional,
}: {
  review: Extract<CustomerQuotationReview, { state: "ready" }>;
  selectedOptionalIds?: string[];
  onToggleOptional?: (lineId: string) => void;
}) {
  const priced = review.commercial && review.lines.length > 0
    ? priceQuotationSelection(snapshotForReview(review), review.lines.map((line) => ({
        id: line.id,
        lineNumber: line.lineNumber,
        catalogueItemId: null,
        sku: null,
        description: line.description,
        unit: line.unit,
        quantityMilli: line.quantityMilli,
        unitPriceMinor: line.unitPriceMinor,
        currency: "ZAR" as const,
        taxTreatment: line.taxTreatment,
        lineRole: line.lineRole,
      })), selectedOptionalIds)
    : null;
  const total = formatQuotationMoney(
    review.currency,
    priced ? priced.authorisedTotalMinor : review.totalMinor,
  );
  const commercial = review.commercial;
  return (
    <article className="grid gap-4 rounded-lg border border-border bg-surface p-4 sm:p-6">
      <p className="text-sm font-medium text-text-muted">Frigora</p>
      <p className="text-sm text-text-muted">
        {review.customerName} · {review.siteName}
      </p>
      <h1 className="text-2xl font-semibold text-text-primary">Quotation version {review.version}</h1>
      <p className="text-sm text-text-muted">Awaiting your decision</p>
      <p className="text-text-secondary">{review.description}</p>
      {review.issuedAt ? <p className="text-sm text-text-muted">Issued {review.issuedAt}</p> : null}
      <p className="text-sm text-text-muted">Decision link expires {review.expiresAt}</p>
      {commercial ? (
        <dl className="grid gap-2 text-sm">
          <div>
            <dt>Labour</dt>
            <dd>
              {quantity(commercial.labourQuantityMilli)} {commercial.labourUnit} at {formatQuotationMoney(review.currency, commercial.labourRateMinor)} = {formatQuotationMoney(review.currency, commercial.labourAmountMinor)}
            </dd>
          </div>
          <div>
            <dt>Travel</dt>
            <dd>
              {quantity(commercial.travelKilometresMilli)} km ({commercial.distanceBasis === "one_way" ? "one-way" : "return"}) at {formatQuotationMoney(review.currency, commercial.travelRateMinor)} = {formatQuotationMoney(review.currency, commercial.travelAmountMinor)}
            </dd>
          </div>
          <div>
            <dt>Subtotal</dt>
            <dd>{formatQuotationMoney(review.currency, commercial.taxableAmountMinor)}</dd>
          </div>
          <div>
            <dt>Tax</dt>
            <dd>
              {formatQuotationMoney(review.currency, commercial.taxAmountMinor)}. {taxCopy(commercial)}
            </dd>
          </div>
        </dl>
      ) : (
        <p className="text-sm text-text-muted">
          This issued version does not include a stored labour, travel, and tax breakdown.
        </p>
      )}
      {review.lines.length > 0 ? (
        <ul className="grid gap-3">
          {review.lines.map((line) => (
            <li key={line.id} className="rounded-md border border-border p-3 text-sm">
              <p className="font-medium text-text-primary">{line.description}</p>
              <p className="text-text-secondary">
                {line.lineRole === "mandatory" ? "Included" : "Optional"} · {quantity(line.quantityMilli)} {line.unit} at {formatQuotationMoney(review.currency, line.unitPriceMinor)} = {formatQuotationMoney(review.currency, line.lineTotalMinor)}
              </p>
              {line.lineRole === "optional" && onToggleOptional ? (
                <label className="mt-2 flex min-h-11 items-center gap-2">
                  <input
                    type="checkbox"
                    checked={selectedOptionalIds.includes(line.id)}
                    onChange={() => onToggleOptional(line.id)}
                  />
                  Include this optional item
                </label>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
      {priced ? (
        <p className="text-sm text-text-secondary">
          Full offer {formatQuotationMoney(review.currency, priced.offerTotalMinor)}. Amount for this selection {formatQuotationMoney(review.currency, priced.authorisedTotalMinor)}.
        </p>
      ) : null}
      <p className="text-xl font-semibold text-text-primary">
        <span className="sr-only">Total </span>
        {total}
        <span className="ml-2 text-sm font-normal text-text-muted">{review.currency}</span>
      </p>
      <p className="text-sm text-text-muted">
        You are deciding on version {review.version} only. Amounts are the issued snapshot and are not recalculated.
        This link does not by itself prove legal identity or organisational authority.
      </p>
    </article>
  );
}

function snapshotForReview(
  review: Extract<CustomerQuotationReview, { state: "ready" }>,
): FrigoraQuotationCommercialSnapshot {
  if (!review.commercial) {
    throw new Error("Line-bearing review is missing its commercial snapshot.");
  }
  return {
    ...review.commercial,
    currency: "ZAR",
    totalMinor: review.totalMinor,
    taxRuleId: null,
    taxRuleVersion: null,
  };
}
