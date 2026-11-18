import {
  priceQuotationCommercial,
  type FrigoraQuotationCommercialInput,
  type FrigoraQuotationCommercialSnapshot,
} from "@/modules/frigora/quotation-commercial";
import { QUOTATION_ISSUE_OFFICE_NOTICE } from "@/modules/frigora/quotation-delivery";
import { TAX_CONFIGURATION_SEND_BLOCKED } from "@/modules/frigora/tax-configuration";
import { parseZarInputToCents } from "@/modules/frigora/time-materials";

export const FRIGORA_OFFICE_QUOTATION_SEND_BLOCKED = TAX_CONFIGURATION_SEND_BLOCKED;

export function officeQuotationSendDecision(): { allowed: false; sendsEmail: false; message: string } {
  return { allowed: false, sendsEmail: false, message: QUOTATION_ISSUE_OFFICE_NOTICE };
}

export const OFFICE_QUOTATION_FIELD_KEYS = [
  "recommendedActionId",
  "description",
  "labourQuantity",
  "labourUnit",
  "labourRate",
  "travelKilometres",
  "distanceBasis",
  "travelRate",
  "taxTreatment",
  "taxRuleId",
  "taxRuleVersion",
  "taxRateNumerator",
  "taxRateDenominator",
  "enteredTaxAmount",
] as const;

export type OfficeQuotationFieldKey = (typeof OFFICE_QUOTATION_FIELD_KEYS)[number];

export type OfficeQuotationFieldValues = Record<OfficeQuotationFieldKey, string>;

export function emptyOfficeQuotationFields(): OfficeQuotationFieldValues {
  return {
    recommendedActionId: "",
    description: "",
    labourQuantity: "",
    labourUnit: "",
    labourRate: "",
    travelKilometres: "",
    distanceBasis: "",
    travelRate: "",
    taxTreatment: "",
    taxRuleId: "",
    taxRuleVersion: "",
    taxRateNumerator: "",
    taxRateDenominator: "",
    enteredTaxAmount: "",
  };
}

export function readOfficeQuotationFields(
  source: Partial<Record<OfficeQuotationFieldKey, string>>,
): OfficeQuotationFieldValues {
  const values = emptyOfficeQuotationFields();
  for (const key of OFFICE_QUOTATION_FIELD_KEYS) {
    const value = source[key];
    values[key] = typeof value === "string" ? value : "";
  }
  return values;
}

export function officeQuotationFieldsFromForm(formData: FormData): OfficeQuotationFieldValues {
  const source: Partial<Record<OfficeQuotationFieldKey, string>> = {};
  for (const key of OFFICE_QUOTATION_FIELD_KEYS) {
    const value = formData.get(key);
    source[key] = typeof value === "string" ? value : "";
  }
  return readOfficeQuotationFields(source);
}

export type OfficeQuotationParseResult =
  | {
      ok: true;
      description: string;
      commercial: FrigoraQuotationCommercialInput;
      priced: FrigoraQuotationCommercialSnapshot;
      values: OfficeQuotationFieldValues;
    }
  | {
      ok: false;
      error: string;
      values: OfficeQuotationFieldValues;
    };

export function parseQuantityMilli(raw: string, label: string): number {
  const trimmed = raw.trim();
  if (!/^\d+(\.\d{1,3})?$/.test(trimmed)) {
    throw new RangeError(`${label} must be a non-negative number with up to three decimal places.`);
  }
  const [wholePart, fractionPart = ""] = trimmed.split(".");
  const whole = Number(wholePart);
  const fraction = Number(fractionPart.padEnd(3, "0"));
  if (!Number.isSafeInteger(whole) || !Number.isSafeInteger(fraction)) {
    throw new RangeError(`${label} is too large.`);
  }
  const milli = whole * 1000 + fraction;
  if (!Number.isSafeInteger(milli)) {
    throw new RangeError(`${label} is too large.`);
  }
  return milli;
}

export function formatQuantityMilli(milli: number): string {
  const sign = milli < 0 ? "-" : "";
  const absolute = Math.abs(milli);
  const whole = Math.trunc(absolute / 1000);
  const fraction = absolute % 1000;
  if (fraction === 0) {
    return `${sign}${whole}`;
  }
  const digits = String(fraction).padStart(3, "0").replace(/0+$/, "");
  return `${sign}${whole}.${digits}`;
}

export function formatZarMinor(minor: number): string {
  const sign = minor < 0 ? "-" : "";
  const absolute = Math.abs(minor);
  const whole = Math.trunc(absolute / 100);
  const fraction = String(absolute % 100).padStart(2, "0");
  return `${sign}${whole}.${fraction}`;
}

function fail(values: OfficeQuotationFieldValues, error: string): OfficeQuotationParseResult {
  return { ok: false, error, values };
}

function integerField(raw: string, label: string): number {
  const trimmed = raw.trim();
  if (!/^\d+$/.test(trimmed)) {
    throw new RangeError(`${label} must be a non-negative whole number.`);
  }
  const value = Number(trimmed);
  if (!Number.isSafeInteger(value)) {
    throw new RangeError(`${label} is too large.`);
  }
  return value;
}

export function parseOfficeQuotationFields(
  values: OfficeQuotationFieldValues,
): OfficeQuotationParseResult {
  const description = values.description.trim();
  if (!description) {
    return fail(values, "Description is required.");
  }
  const labourUnit = values.labourUnit.trim();
  if (!labourUnit) {
    return fail(values, "Labour unit is required. The form does not assume an hour.");
  }
  if (values.distanceBasis !== "one_way" && values.distanceBasis !== "return") {
    return fail(
      values,
      "Choose whether the kilometres are one-way or return. Return kilometres are not doubled.",
    );
  }
  if (values.taxTreatment !== "not_registered" && values.taxTreatment !== "configured_rule") {
    return fail(
      values,
      "Choose a tax treatment. The form does not assume the business is not VAT-registered, and a typed rate is not a verified tax rule.",
    );
  }

  const ruleId = values.taxRuleId.trim();
  const ruleVersion = values.taxRuleVersion.trim();
  const numeratorRaw = values.taxRateNumerator.trim();
  const denominatorRaw = values.taxRateDenominator.trim();
  const enteredTaxRaw = values.enteredTaxAmount.trim();
  const hasRuleField = Boolean(ruleId || ruleVersion || numeratorRaw || denominatorRaw || enteredTaxRaw);
  if (values.taxTreatment === "not_registered" && hasRuleField) {
    return fail(
      values,
      "A not-registered treatment cannot include a tax rule or tax amount. Remove those fields, or choose configured rule. Neither choice is a verified legal status.",
    );
  }

  let labourQuantityMilli: number;
  let travelKilometresMilli: number;
  let labourRateMinor: number;
  let travelRateMinor: number;
  try {
    labourQuantityMilli = parseQuantityMilli(values.labourQuantity, "Labour quantity");
    travelKilometresMilli = parseQuantityMilli(values.travelKilometres, "Travel kilometres");
    const labourRate = parseZarInputToCents(values.labourRate);
    const travelRate = parseZarInputToCents(values.travelRate);
    if (labourRate == null || travelRate == null) {
      return fail(values, "Labour rate and travel rate are required in rand.");
    }
    labourRateMinor = labourRate;
    travelRateMinor = travelRate;
  } catch (error) {
    const message = error instanceof Error ? error.message : "A commercial amount is invalid.";
    return fail(values, message);
  }

  const commercial: FrigoraQuotationCommercialInput = {
    labourQuantityMilli,
    labourUnit,
    labourRateMinor,
    travelKilometresMilli,
    distanceBasis: values.distanceBasis,
    travelRateMinor,
    taxTreatment: values.taxTreatment,
    taxRuleId: null,
    taxRuleVersion: null,
    taxRateNumerator: null,
    taxRateDenominator: null,
    enteredTaxAmountMinor: null,
  };

  if (values.taxTreatment === "configured_rule") {
    if (!ruleId || !ruleVersion || !numeratorRaw || !denominatorRaw) {
      return fail(
        values,
        "A configured rule needs a rule id, version, numerator, and denominator. This form does not supply a statutory rate.",
      );
    }
    try {
      const taxRateNumerator = integerField(numeratorRaw, "Tax rate numerator");
      const taxRateDenominator = integerField(denominatorRaw, "Tax rate denominator");
      if (taxRateDenominator <= 0) {
        return fail(values, "Tax rate denominator must be greater than zero.");
      }
      commercial.taxRuleId = ruleId;
      commercial.taxRuleVersion = ruleVersion;
      commercial.taxRateNumerator = taxRateNumerator;
      commercial.taxRateDenominator = taxRateDenominator;
      if (enteredTaxRaw) {
        const entered = parseZarInputToCents(enteredTaxRaw);
        if (entered == null) {
          return fail(values, "Entered tax amount is required when provided.");
        }
        commercial.enteredTaxAmountMinor = entered;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "The tax rule is invalid.";
      return fail(values, message);
    }
  }

  try {
    const priced = priceQuotationCommercial(commercial);
    return { ok: true, description, commercial, priced, values };
  } catch (error) {
    const message = error instanceof Error ? error.message : "The commercial basis could not be priced.";
    return fail(values, message);
  }
}
