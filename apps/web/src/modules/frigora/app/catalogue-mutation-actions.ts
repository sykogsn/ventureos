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

export async function createPartReferenceFormAction(
  _prev: CatalogueFormState,
  formData: FormData,
): Promise<CatalogueFormState> {
  const scope = scopeFromForm(formData);
  const values = {
    displayName: text(formData, "displayName"),
    defaultQuantityUnit: text(formData, "defaultQuantityUnit"),
  };
  const unit = values.defaultQuantityUnit.trim();
  if (!(FRIGORA_PART_USAGE_UNITS as readonly string[]).includes(unit)) {
    return { error: "Select a valid default unit.", values };
  }
  const result = await createPartReferenceAction({
    ...scope,
    displayName: values.displayName.trim(),
    defaultQuantityUnit: unit as FrigoraPartUsageUnit,
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
  };
  const unit = values.defaultQuantityUnit.trim();
  if (!(FRIGORA_PART_USAGE_UNITS as readonly string[]).includes(unit)) {
    return { error: "Select a valid default unit.", values };
  }
  const result = await updatePartReferenceAction({
    ...scope,
    id,
    displayName: values.displayName.trim(),
    defaultQuantityUnit: unit as FrigoraPartUsageUnit,
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
  };
  const result = await createRefrigerantReferenceAction({
    ...scope,
    canonicalCode: values.canonicalCode.trim(),
    displayName: values.displayName.trim(),
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
  };
  const result = await updateRefrigerantReferenceAction({
    ...scope,
    id: text(formData, "id"),
    canonicalCode: values.canonicalCode.trim(),
    displayName: values.displayName.trim(),
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
