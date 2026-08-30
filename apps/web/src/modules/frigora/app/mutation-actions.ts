"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import {
  assignWorkOrderAction,
  clearWorkOrderAssignmentAction,
  createAssetAction,
  createCustomerAction,
  createSiteAction,
  createWorkOrderAction,
} from "@/modules/frigora/actions";
import { FRIGORA_ASSET_KINDS, FRIGORA_WORK_KINDS } from "@/modules/frigora/types";

export type OfficeFormState = {
  error?: string;
  values?: Record<string, string>;
};

function text(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function optionalText(formData: FormData, key: string): string | null {
  const value = text(formData, key).trim();
  return value.length > 0 ? value : null;
}

function scopeFromForm(formData: FormData) {
  return {
    workspaceId: text(formData, "workspaceId"),
    ventureId: text(formData, "ventureId"),
  };
}

function customersPath(ventureId: string) {
  return `/ventures/${ventureId}/customers`;
}

function customerPath(ventureId: string, customerId: string) {
  return `/ventures/${ventureId}/customers/${customerId}`;
}

function sitePath(ventureId: string, customerId: string, siteId: string) {
  return `/ventures/${ventureId}/customers/${customerId}/sites/${siteId}`;
}

function workPath(ventureId: string) {
  return `/ventures/${ventureId}/work`;
}

function workDetailPath(ventureId: string, workOrderId: string) {
  return `/ventures/${ventureId}/work/${workOrderId}`;
}

function revalidateOffice(ventureId: string) {
  revalidatePath(customersPath(ventureId));
  revalidatePath(workPath(ventureId));
  revalidatePath(`/ventures/${ventureId}`, "layout");
}

export async function createCustomerFormAction(
  _prev: OfficeFormState,
  formData: FormData,
): Promise<OfficeFormState> {
  const scope = scopeFromForm(formData);
  const values = {
    code: text(formData, "code"),
    displayName: text(formData, "displayName"),
    legalName: text(formData, "legalName"),
    notes: text(formData, "notes"),
  };

  const result = await createCustomerAction({
    ...scope,
    code: values.code,
    displayName: values.displayName,
    legalName: optionalText(formData, "legalName"),
    notes: optionalText(formData, "notes"),
  });

  if (result.error || !result.record) {
    return { error: result.error ?? "Could not create customer.", values };
  }

  revalidateOffice(scope.ventureId);
  redirect(customerPath(scope.ventureId, result.record.id));
}

export async function createSiteFormAction(
  _prev: OfficeFormState,
  formData: FormData,
): Promise<OfficeFormState> {
  const scope = scopeFromForm(formData);
  const customerId = text(formData, "customerId");
  const values = {
    code: text(formData, "code"),
    name: text(formData, "name"),
    addressLine1: text(formData, "addressLine1"),
    city: text(formData, "city"),
    region: text(formData, "region"),
    postalCode: text(formData, "postalCode"),
    country: text(formData, "country"),
    notes: text(formData, "notes"),
  };

  const result = await createSiteAction({
    ...scope,
    customerId,
    code: values.code,
    name: values.name,
    addressLine1: optionalText(formData, "addressLine1"),
    addressLine2: optionalText(formData, "addressLine2"),
    city: optionalText(formData, "city"),
    region: optionalText(formData, "region"),
    postalCode: optionalText(formData, "postalCode"),
    country: optionalText(formData, "country"),
    notes: optionalText(formData, "notes"),
  });

  if (result.error || !result.record) {
    return { error: result.error ?? "Could not create site.", values };
  }

  revalidateOffice(scope.ventureId);
  revalidatePath(customerPath(scope.ventureId, customerId));
  redirect(sitePath(scope.ventureId, customerId, result.record.id));
}

export async function createAssetFormAction(
  _prev: OfficeFormState,
  formData: FormData,
): Promise<OfficeFormState> {
  const scope = scopeFromForm(formData);
  const customerId = text(formData, "customerId");
  const siteId = text(formData, "siteId");
  const assetKindRaw = text(formData, "assetKind").trim();
  const assetKind =
    assetKindRaw && (FRIGORA_ASSET_KINDS as readonly string[]).includes(assetKindRaw)
      ? (assetKindRaw as (typeof FRIGORA_ASSET_KINDS)[number])
      : null;

  const values = {
    tag: text(formData, "tag"),
    name: text(formData, "name"),
    assetKind: assetKindRaw,
    manufacturer: text(formData, "manufacturer"),
    model: text(formData, "model"),
    serialNumber: text(formData, "serialNumber"),
    refrigerantType: text(formData, "refrigerantType"),
    locationOnSite: text(formData, "locationOnSite"),
    notes: text(formData, "notes"),
  };

  const designRaw = text(formData, "designTargetCelsius").trim();
  const designTargetCelsius =
    designRaw.length > 0 && Number.isFinite(Number(designRaw)) ? Number(designRaw) : null;

  const result = await createAssetAction({
    ...scope,
    siteId,
    tag: values.tag,
    name: optionalText(formData, "name"),
    assetKind,
    manufacturer: optionalText(formData, "manufacturer"),
    model: optionalText(formData, "model"),
    serialNumber: optionalText(formData, "serialNumber"),
    designTargetCelsius,
    refrigerantType: optionalText(formData, "refrigerantType"),
    locationOnSite: optionalText(formData, "locationOnSite"),
    notes: optionalText(formData, "notes"),
  });

  if (result.error || !result.record) {
    return { error: result.error ?? "Could not create asset.", values };
  }

  revalidateOffice(scope.ventureId);
  revalidatePath(sitePath(scope.ventureId, customerId, siteId));
  redirect(
    `${sitePath(scope.ventureId, customerId, siteId)}/assets/${result.record.id}`,
  );
}

export async function createWorkOrderFormAction(
  _prev: OfficeFormState,
  formData: FormData,
): Promise<OfficeFormState> {
  const scope = scopeFromForm(formData);
  const workKindRaw = text(formData, "workKind").trim();
  const values = {
    customerId: text(formData, "customerId"),
    siteId: text(formData, "siteId"),
    primaryAssetId: text(formData, "primaryAssetId"),
    workReference: text(formData, "workReference"),
    workKind: workKindRaw,
    reportedCondition: text(formData, "reportedCondition"),
  };

  if (!(FRIGORA_WORK_KINDS as readonly string[]).includes(workKindRaw)) {
    return { error: "Select a valid work kind.", values };
  }

  const primaryAssetRaw = values.primaryAssetId.trim();
  const result = await createWorkOrderAction({
    ...scope,
    siteId: values.siteId,
    workReference: values.workReference,
    workKind: workKindRaw as (typeof FRIGORA_WORK_KINDS)[number],
    reportedCondition: optionalText(formData, "reportedCondition"),
    primaryAssetId: primaryAssetRaw.length > 0 ? primaryAssetRaw : null,
  });

  if (result.error || !result.record) {
    return { error: result.error ?? "Could not create work order.", values };
  }

  revalidateOffice(scope.ventureId);
  redirect(workDetailPath(scope.ventureId, result.record.id));
}

export async function assignToMeFormAction(
  _prev: OfficeFormState,
  formData: FormData,
): Promise<OfficeFormState> {
  const session = await getSession();
  if (!session) {
    return { error: "You must be signed in." };
  }

  const scope = scopeFromForm(formData);
  const workOrderId = text(formData, "workOrderId");

  const result = await assignWorkOrderAction({
    ...scope,
    id: workOrderId,
    userId: session.id,
  });

  if (result.error) {
    return { error: result.error };
  }

  revalidatePath(workDetailPath(scope.ventureId, workOrderId));
  revalidatePath(workPath(scope.ventureId));
  return {};
}

export async function clearAssignmentFormAction(
  _prev: OfficeFormState,
  formData: FormData,
): Promise<OfficeFormState> {
  const scope = scopeFromForm(formData);
  const workOrderId = text(formData, "workOrderId");

  const result = await clearWorkOrderAssignmentAction({
    ...scope,
    id: workOrderId,
  });

  if (result.error) {
    return { error: result.error };
  }

  revalidatePath(workDetailPath(scope.ventureId, workOrderId));
  revalidatePath(workPath(scope.ventureId));
  return {};
}
