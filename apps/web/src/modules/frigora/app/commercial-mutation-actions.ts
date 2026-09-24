"use server";

import { revalidatePath } from "next/cache";
import {
  setPartUsageUnitChargeAction,
  setRefrigerantEventChargePerKgAction,
  setVentureLabourHourlyChargeAction,
  setVisitLabourHourlyChargeAction,
} from "@/modules/frigora/actions";
import { parseZarInputToCents } from "@/modules/frigora/time-materials";

export type CommercialFormState = {
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

function parseOptionalZarCents(raw: string): { cents: number | null; error?: string } {
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

function parseRequiredZarCents(raw: string): { cents?: number; error?: string } {
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return { error: "Amount is required." };
  }
  try {
    const cents = parseZarInputToCents(trimmed);
    if (cents === null) {
      return { error: "Amount is required." };
    }
    return { cents };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Invalid amount.",
    };
  }
}

function revalidateWork(ventureId: string, workOrderId: string) {
  revalidatePath(`/ventures/${ventureId}/work/${workOrderId}`);
  revalidatePath(`/ventures/${ventureId}/catalogue`);
}

export async function setVentureLabourHourlyChargeFormAction(
  _prev: CommercialFormState,
  formData: FormData,
): Promise<CommercialFormState> {
  const scope = scopeFromForm(formData);
  const values = { labourHourlyCharge: text(formData, "labourHourlyCharge") };
  const parsed = parseOptionalZarCents(values.labourHourlyCharge);
  if (parsed.error) {
    return { error: parsed.error, values };
  }
  const result = await setVentureLabourHourlyChargeAction({
    ...scope,
    labourHourlyChargeCents: parsed.cents,
  });
  if (result.error) {
    return { error: result.error, values };
  }
  revalidatePath(`/ventures/${scope.ventureId}/catalogue`);
  return {};
}

export async function setPartUsageUnitChargeFormAction(
  _prev: CommercialFormState,
  formData: FormData,
): Promise<CommercialFormState> {
  const scope = scopeFromForm(formData);
  const workOrderId = text(formData, "workOrderId");
  const values = { unitCharge: text(formData, "unitCharge") };
  const parsed = parseRequiredZarCents(values.unitCharge);
  if (parsed.error || parsed.cents === undefined) {
    return { error: parsed.error ?? "Amount is required.", values };
  }
  const result = await setPartUsageUnitChargeAction({
    ...scope,
    partUsageId: text(formData, "partUsageId"),
    unitChargeCents: parsed.cents,
  });
  if (result.error) {
    return { error: result.error, values };
  }
  revalidateWork(scope.ventureId, workOrderId);
  return {};
}

export async function setRefrigerantEventChargePerKgFormAction(
  _prev: CommercialFormState,
  formData: FormData,
): Promise<CommercialFormState> {
  const scope = scopeFromForm(formData);
  const workOrderId = text(formData, "workOrderId");
  const values = { chargePerKg: text(formData, "chargePerKg") };
  const parsed = parseRequiredZarCents(values.chargePerKg);
  if (parsed.error || parsed.cents === undefined) {
    return { error: parsed.error ?? "Amount is required.", values };
  }
  const result = await setRefrigerantEventChargePerKgAction({
    ...scope,
    eventId: text(formData, "eventId"),
    chargePerKgCents: parsed.cents,
  });
  if (result.error) {
    return { error: result.error, values };
  }
  revalidateWork(scope.ventureId, workOrderId);
  return {};
}

export async function setVisitLabourHourlyChargeFormAction(
  _prev: CommercialFormState,
  formData: FormData,
): Promise<CommercialFormState> {
  const scope = scopeFromForm(formData);
  const workOrderId = text(formData, "workOrderId");
  const values = { labourHourlyCharge: text(formData, "labourHourlyCharge") };
  const parsed = parseRequiredZarCents(values.labourHourlyCharge);
  if (parsed.error || parsed.cents === undefined) {
    return { error: parsed.error ?? "Amount is required.", values };
  }
  const result = await setVisitLabourHourlyChargeAction({
    ...scope,
    visitId: text(formData, "visitId"),
    labourHourlyChargeCents: parsed.cents,
  });
  if (result.error) {
    return { error: result.error, values };
  }
  revalidateWork(scope.ventureId, workOrderId);
  return {};
}
