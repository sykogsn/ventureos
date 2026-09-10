"use server";

import { revalidatePath } from "next/cache";
import {
  createPartReferenceAction,
  createRefrigerantReferenceAction,
  retirePartReferenceAction,
  retireRefrigerantReferenceAction,
  updatePartReferenceAction,
  updateRefrigerantReferenceAction,
} from "@/modules/frigora/actions";
import { parseZarInputToCents } from "@/modules/frigora/time-materials";
import { FRIGORA_PART_USAGE_UNITS, type FrigoraPartUsageUnit } from "@/modules/frigora/types";

export type CatalogueFormState = {
  error?: string;
  values?: Record<string, string>;
};

function text(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function scopeFromForm(formData: FormData) {
  return {
    workspaceId: text(formData, "workspaceId"),
    ventureId: text(formData, "ventureId"),
  };
}

function revalidateCatalogue(ventureId: string) {
  revalidatePath(`/ventures/${ventureId}/catalogue`);
}

function parseOptionalDefaultCharge(
  raw: string,
): { cents: number | null; error?: string } {
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return { cents: null };
  }
  try {
    return { cents: parseZarInputToCents(trimmed) };
  } catch (error) {
    return {
      cents: null,
      error: error instanceof Error ? error.message : "Invalid amount.",
    };
  }
}

export async function createPartReferenceFormAction(
  _prev: CatalogueFormState,
  formData: FormData,
): Promise<CatalogueFormState> {
  const scope = scopeFromForm(formData);
  const values = {
    displayName: text(formData, "displayName"),
    defaultQuantityUnit: text(formData, "defaultQuantityUnit"),
    defaultUnitCharge: text(formData, "defaultUnitCharge"),
  };
  const unit = values.defaultQuantityUnit.trim();
  if (!(FRIGORA_PART_USAGE_UNITS as readonly string[]).includes(unit)) {
    return { error: "Select a valid default unit.", values };
  }
  const charge = parseOptionalDefaultCharge(values.defaultUnitCharge);
  if (charge.error) {
    return { error: charge.error, values };
  }
  const result = await createPartReferenceAction({
    ...scope,
    displayName: values.displayName.trim(),
    defaultQuantityUnit: unit as FrigoraPartUsageUnit,
    defaultUnitChargeCents: charge.cents,
  });
  if (result.error) {
    return { error: result.error, values };
  }
  revalidateCatalogue(scope.ventureId);
  return {};
}

export async function updatePartReferenceFormAction(
  _prev: CatalogueFormState,
  formData: FormData,
): Promise<CatalogueFormState> {
  const scope = scopeFromForm(formData);
  const id = text(formData, "id");
  const values = {
    displayName: text(formData, "displayName"),
    defaultQuantityUnit: text(formData, "defaultQuantityUnit"),
    defaultUnitCharge: text(formData, "defaultUnitCharge"),
  };
  const unit = values.defaultQuantityUnit.trim();
  if (!(FRIGORA_PART_USAGE_UNITS as readonly string[]).includes(unit)) {
    return { error: "Select a valid default unit.", values };
  }
  const charge = parseOptionalDefaultCharge(values.defaultUnitCharge);
  if (charge.error) {
    return { error: charge.error, values };
  }
  const result = await updatePartReferenceAction({
    ...scope,
    id,
    displayName: values.displayName.trim(),
    defaultQuantityUnit: unit as FrigoraPartUsageUnit,
    defaultUnitChargeCents: charge.cents,
  });
  if (result.error) {
    return { error: result.error, values };
  }
  revalidateCatalogue(scope.ventureId);
  return {};
}

export async function retirePartReferenceFormAction(
  _prev: CatalogueFormState,
  formData: FormData,
): Promise<CatalogueFormState> {
  const scope = scopeFromForm(formData);
  const result = await retirePartReferenceAction({
    ...scope,
    id: text(formData, "id"),
  });
  if (result.error) {
    return { error: result.error };
  }
  revalidateCatalogue(scope.ventureId);
  return {};
}

export async function createRefrigerantReferenceFormAction(
  _prev: CatalogueFormState,
  formData: FormData,
): Promise<CatalogueFormState> {
  const scope = scopeFromForm(formData);
  const values = {
    canonicalCode: text(formData, "canonicalCode"),
    displayName: text(formData, "displayName"),
    defaultChargePerKg: text(formData, "defaultChargePerKg"),
  };
  const charge = parseOptionalDefaultCharge(values.defaultChargePerKg);
  if (charge.error) {
    return { error: charge.error, values };
  }
  const result = await createRefrigerantReferenceAction({
    ...scope,
    canonicalCode: values.canonicalCode.trim(),
    displayName: values.displayName.trim(),
    defaultChargePerKgCents: charge.cents,
  });
  if (result.error) {
    return { error: result.error, values };
  }
  revalidateCatalogue(scope.ventureId);
  return {};
}

export async function updateRefrigerantReferenceFormAction(
  _prev: CatalogueFormState,
  formData: FormData,
): Promise<CatalogueFormState> {
  const scope = scopeFromForm(formData);
  const values = {
    canonicalCode: text(formData, "canonicalCode"),
    displayName: text(formData, "displayName"),
    defaultChargePerKg: text(formData, "defaultChargePerKg"),
  };
  const charge = parseOptionalDefaultCharge(values.defaultChargePerKg);
  if (charge.error) {
    return { error: charge.error, values };
  }
  const result = await updateRefrigerantReferenceAction({
    ...scope,
    id: text(formData, "id"),
    canonicalCode: values.canonicalCode.trim(),
    displayName: values.displayName.trim(),
    defaultChargePerKgCents: charge.cents,
  });
  if (result.error) {
    return { error: result.error, values };
  }
  revalidateCatalogue(scope.ventureId);
  return {};
}

export async function retireRefrigerantReferenceFormAction(
  _prev: CatalogueFormState,
  formData: FormData,
): Promise<CatalogueFormState> {
  const scope = scopeFromForm(formData);
  const result = await retireRefrigerantReferenceAction({
    ...scope,
    id: text(formData, "id"),
  });
  if (result.error) {
    return { error: result.error };
  }
  revalidateCatalogue(scope.ventureId);
  return {};
}
