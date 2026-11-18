import type { FrigoraScope } from "@/modules/frigora/types";
import { FRIGORA_PART_USAGE_UNITS } from "@/modules/frigora/types";
import { FRIGORA_QUOTE_TAX_TREATMENTS } from "@/modules/frigora/quotation-commercial";
import { parseZarInputToCents } from "@/modules/frigora/time-materials";
import { createCommercialCatalogue, type FrigoraCommercialItem } from "@/modules/frigora/commercial-catalogue";
import { isFrigoraError } from "@/modules/frigora/errors";

export const COMMERCIAL_ITEM_FIELDS = [
  "sku",
  "description",
  "category",
  "manufacturer",
  "model",
  "unit",
  "sellingPrice",
  "taxTreatment",
  "supplierReference",
  "status",
] as const;

export type CommercialItemField = (typeof COMMERCIAL_ITEM_FIELDS)[number];
export type CommercialItemFieldValues = Record<CommercialItemField, string>;

type Catalogue = ReturnType<typeof createCommercialCatalogue>;

export function emptyCommercialItemFields(): CommercialItemFieldValues {
  return {
    sku: "",
    description: "",
    category: "",
    manufacturer: "",
    model: "",
    unit: "each",
    sellingPrice: "",
    taxTreatment: "not_registered",
    supplierReference: "",
    status: "active",
  };
}

export function commercialItemFieldsFromForm(formData: FormData): CommercialItemFieldValues {
  const values = emptyCommercialItemFields();
  for (const key of COMMERCIAL_ITEM_FIELDS) {
    const value = formData.get(key);
    values[key] = typeof value === "string" ? value : values[key];
  }
  return values;
}

export function parseCommercialItemFields(values: CommercialItemFieldValues):
  | {
      ok: true;
      sku: string;
      description: string;
      category: string;
      manufacturer: string;
      model: string;
      unit: (typeof FRIGORA_PART_USAGE_UNITS)[number];
      sellingPriceMinor: number;
      taxTreatment: (typeof FRIGORA_QUOTE_TAX_TREATMENTS)[number];
      supplierReference: string;
      status: "active" | "discontinued";
    }
  | { ok: false; error: string } {
  const sku = values.sku.trim();
  const description = values.description.trim();
  if (!sku) return { ok: false, error: "Enter a SKU." };
  if (!description) return { ok: false, error: "Enter a description." };
  if (!FRIGORA_PART_USAGE_UNITS.includes(values.unit as (typeof FRIGORA_PART_USAGE_UNITS)[number])) {
    return { ok: false, error: "Choose a unit of measure." };
  }
  if (!FRIGORA_QUOTE_TAX_TREATMENTS.includes(values.taxTreatment as (typeof FRIGORA_QUOTE_TAX_TREATMENTS)[number])) {
    return { ok: false, error: "Choose a tax treatment." };
  }
  const status = values.status === "discontinued" ? "discontinued" : "active";
  let sellingPriceMinor: number;
  try {
    const parsed = parseZarInputToCents(values.sellingPrice);
    if (parsed === null) return { ok: false, error: "Enter a selling price." };
    sellingPriceMinor = parsed;
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Enter a selling price in rand." };
  }
  return {
    ok: true,
    sku,
    description,
    category: values.category.trim(),
    manufacturer: values.manufacturer.trim(),
    model: values.model.trim(),
    unit: values.unit as (typeof FRIGORA_PART_USAGE_UNITS)[number],
    sellingPriceMinor,
    taxTreatment: values.taxTreatment as (typeof FRIGORA_QUOTE_TAX_TREATMENTS)[number],
    supplierReference: values.supplierReference.trim(),
    status,
  };
}

function failure(error: unknown): string {
  if (isFrigoraError(error)) return error.message;
  throw error;
}

export async function saveCommercialItem(
  catalogue: Catalogue,
  scope: FrigoraScope,
  formData: FormData,
): Promise<{ error?: string; item?: FrigoraCommercialItem }> {
  const values = commercialItemFieldsFromForm(formData);
  const parsed = parseCommercialItemFields(values);
  if (!parsed.ok) return { error: parsed.error };
  const body = {
    sku: parsed.sku,
    description: parsed.description,
    category: parsed.category,
    manufacturer: parsed.manufacturer,
    model: parsed.model,
    unit: parsed.unit,
    sellingPriceMinor: parsed.sellingPriceMinor,
    taxTreatment: parsed.taxTreatment,
    supplierReference: parsed.supplierReference,
  };
  try {
    const id = formData.get("id");
    if (typeof id === "string" && id.length > 0) {
      const item = await catalogue.updateItem(scope, id, { ...body, status: parsed.status });
      return { item };
    }
    const item = await catalogue.createItem(scope, body);
    return { item };
  } catch (error) {
    return { error: failure(error) };
  }
}

export async function saveCommercialItemCost(
  catalogue: Catalogue,
  scope: FrigoraScope,
  formData: FormData,
): Promise<{ error?: string }> {
  const id = formData.get("id");
  if (typeof id !== "string" || id.length === 0) {
    return { error: "The commercial item is missing. Refresh the catalogue and try again." };
  }
  const raw = formData.get("purchaseCost");
  const text = typeof raw === "string" ? raw : "";
  if (text.trim().length === 0) {
    return { error: "Enter a purchase cost. An unavailable cost is not zero." };
  }
  let purchaseCostMinor: number;
  try {
    const parsed = parseZarInputToCents(text);
    if (parsed === null) return { error: "Enter a purchase cost. An unavailable cost is not zero." };
    purchaseCostMinor = parsed;
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Enter a purchase cost in rand." };
  }
  try {
    await catalogue.setItemCost(scope, id, { purchaseCostMinor });
    return {};
  } catch (error) {
    return { error: failure(error) };
  }
}

export async function selectCommercialItemForOffice(
  catalogue: Catalogue,
  scope: FrigoraScope,
  itemId: string,
): Promise<{ error?: string; item?: FrigoraCommercialItem }> {
  try {
    const item = await catalogue.selectItem(scope, itemId);
    return { item };
  } catch (error) {
    return { error: failure(error) };
  }
}

/** Cost is loaded only after the caller has already passed the server permission check. */
export async function commercialItemCosts(
  catalogue: Catalogue,
  scope: FrigoraScope,
  items: FrigoraCommercialItem[],
  allowed: boolean,
): Promise<Record<string, number | null> | null> {
  if (!allowed) return null;
  const entries = await Promise.all(
    items.map(async (item) => {
      const cost = await catalogue.readItemCost(scope, item.id);
      return [item.id, cost === null ? null : cost.purchaseCostMinor] as const;
    }),
  );
  return Object.fromEntries(entries);
}
