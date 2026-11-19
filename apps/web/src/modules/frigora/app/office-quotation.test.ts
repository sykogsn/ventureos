import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { buildVentureSurfaceLinks } from "@/modules/frigora/app/nav";
import {
  officeQuotationSendDecision,
  parseOfficeQuotationFields,
  readOfficeQuotationFields,
} from "@/modules/frigora/app/quotation-office";

const WEB_ROOT = join(process.cwd(), "src");

function fields(patch: Record<string, string> = {}) {
  return readOfficeQuotationFields({
    description: "Replace compressor",
    labourQuantity: "10",
    labourUnit: "hour",
    labourRate: "1000.00",
    travelKilometres: "100",
    distanceBasis: "one_way",
    travelRate: "49.50",
    taxTreatment: "not_registered",
    ...patch,
  });
}

describe("Frigora office quotation workflow", () => {
  it("adds Quotations only to the Frigora office navigation", () => {
    const frigora = buildVentureSurfaceLinks({
      ventureId: "ven-1",
      slug: "frigora-one",
      definitionId: "frigora",
      companyHomeHref: "/ventures/hq/frigora-one",
      canAccessOffice: true,
    });
    const quotations = frigora.find((link) => link.label === "Quotations");
    assert.equal(quotations?.href, "/ventures/ven-1/quotations");
    assert.equal(quotations?.match, "prefix");
    const company = buildVentureSurfaceLinks({
      ventureId: "ven-2",
      slug: "acme",
      definitionId: "ventureos.company",
      companyHomeHref: "/ventures/hq/acme",
    });
    assert.equal(company.some((link) => link.label === "Quotations"), false);
    assert.equal(
      existsSync(join(WEB_ROOT, "app/(app)/ventures/[ventureId]/quotations/page.tsx")),
      true,
    );
    assert.equal(
      existsSync(join(WEB_ROOT, "app/(app)/ventures/[ventureId]/quotations/[quotationId]/page.tsx")),
      true,
    );
  });

  it("prices an explicit draft and does not double return kilometres", () => {
    const parsed = parseOfficeQuotationFields(fields());
    assert.equal(parsed.ok, true);
    if (!parsed.ok) return;
    assert.equal(parsed.priced.labourAmountMinor, 1_000_000);
    assert.equal(parsed.priced.travelAmountMinor, 495_000);
    assert.equal(parsed.priced.taxAmountMinor, 0);
    assert.equal(parsed.priced.totalMinor, 1_495_000);
    assert.equal(parsed.commercial.distanceBasis, "one_way");

    const returnTrip = parseOfficeQuotationFields(fields({
      travelKilometres: "10",
      distanceBasis: "return",
      travelRate: "10.00",
    }));
    assert.equal(returnTrip.ok, true);
    if (!returnTrip.ok) return;
    assert.equal(returnTrip.commercial.travelKilometresMilli, 10_000);
    assert.equal(returnTrip.commercial.distanceBasis, "return");
    assert.equal(returnTrip.priced.travelAmountMinor, 10_000);
  });

  it("shows validation errors without inventing tax treatment or dropping the typed value", () => {
    const missingTax = parseOfficeQuotationFields(fields({ taxTreatment: "" }));
    assert.equal(missingTax.ok, false);
    if (missingTax.ok) return;
    assert.match(missingTax.error, /does not assume the business is not VAT-registered/);
    assert.equal(missingTax.values.taxTreatment, "");

    const missingDistance = parseOfficeQuotationFields(fields({ distanceBasis: "" }));
    assert.equal(missingDistance.ok, false);
    if (missingDistance.ok) return;
    assert.match(missingDistance.error, /not doubled/);

    const badRate = parseOfficeQuotationFields(fields({ labourRate: "12.555" }));
    assert.equal(badRate.ok, false);
    if (badRate.ok) return;
    assert.equal(badRate.values.labourRate, "12.555");

    const configured = parseOfficeQuotationFields(fields({ taxTreatment: "configured_rule" }));
    assert.equal(configured.ok, false);
    if (configured.ok) return;
    assert.match(configured.error, /does not supply a statutory rate/);
    assert.equal(configured.error.includes("15"), false);

    const mixed = parseOfficeQuotationFields(fields({
      taxTreatment: "not_registered",
      taxRuleId: "vat-15",
    }));
    assert.equal(mixed.ok, false);
    if (mixed.ok) return;
    assert.match(mixed.error, /cannot include a tax rule/);
    assert.equal(mixed.values.taxRuleId, "vat-15");
  });

  it("blocks office sending and does not report that block as a successful send", () => {
    const decision = officeQuotationSendDecision();
    assert.equal(decision.allowed, false);
    assert.equal(decision.sendsEmail, false);
    assert.match(decision.message, /held_pending_customer_access/);
    assert.match(decision.message, /does not email/i);
    assert.doesNotMatch(decision.message, /successfully sent|has been sent/i);

    const actions = readFileSync(
      join(WEB_ROOT, "modules/frigora/app/quotation-office-actions.ts"),
      "utf8",
    );
    assert.match(actions, /issueQuotation\(/);
    assert.equal(actions.includes("deliverQuotationDecisionGrant"), false);
    assert.equal(actions.includes("api.resend.com"), false);
    assert.equal(actions.includes("allowSyntheticNotRegisteredQuotationSend"), false);
    assert.equal(actions.includes("successfully sent"), false);
    assert.equal(actions.includes("createWorkOrder"), false);
    assert.equal(actions.includes("not_registered"), false);
    assert.match(actions, /You do not have permission to change a quotation/);

    const customerPage = readFileSync(
      join(WEB_ROOT, "app/quotation-decision/[grantId]/page.tsx"),
      "utf8",
    );
    const customerApi = readFileSync(
      join(WEB_ROOT, "app/api/quotation-decision/route.ts"),
      "utf8",
    );
    assert.equal(customerPage.includes("quotation-office"), false);
    const detail = readFileSync(
      join(WEB_ROOT, "modules/frigora/app/screens/quotation-detail-screen.tsx"),
      "utf8",
    );
    const forms = readFileSync(
      join(WEB_ROOT, "modules/frigora/app/forms/quotation-forms.tsx"),
      "utf8",
    );
    assert.match(detail, /Quotation identity/);
    assert.match(detail, /Mailbox verification/);
    assert.match(detail, /Supervised verification/);
    assert.match(detail, /awaiting customer decision/);
    assert.match(forms, /does not verify the mailbox/);
    assert.match(forms, /Supervised pilot test link/);
    assert.equal(forms.includes("email_verified_at"), false);
    assert.equal(detail.includes("deliverQuotationDecisionGrant"), false);
    assert.equal(customerApi.includes("quotation-office"), false);
    assert.equal(customerApi.includes("createOfficeQuotationFormAction"), false);
  });
});
