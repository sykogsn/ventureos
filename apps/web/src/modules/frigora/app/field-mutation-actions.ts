"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { nowIso } from "@/platform/ids";
import {
  recordAssetOperationalConditionAction,
  recordCorrectiveActionAction,
  recordFieldCaptureAction,
  recordPartUsageAction,
  recordRecommendedActionAction,
  recordRefrigerantEventAction,
  recordTechnicalFindingAction,
  recordVisitArrivalAction,
  recordVisitCustomerAcknowledgementAction,
  recordVisitDepartureAction,
  recordVisitEvidenceWithFileAction,
  removeVisitEvidenceAction,
  recordVisitOutcomeAction,
} from "@/modules/frigora/actions";
import { getWorkOrderQuery } from "@/modules/frigora/queries";
import {
  FRIGORA_ASSET_OPERATIONAL_CONDITION_KINDS,
  FRIGORA_FIELD_CAPTURE_CODES,
  FRIGORA_FIELD_CAPTURE_UNITS,
  FRIGORA_PART_USAGE_UNITS,
  FRIGORA_REFRIGERANT_EVENT_KINDS,
  type FrigoraFieldCaptureCode,
  type FrigoraFieldCaptureKind,
  type FrigoraFieldCaptureUnit,
  type FrigoraPartUsageUnit,
  type FrigoraRefrigerantEventKind,
  type FrigoraTechnicalFindingKind,
  type FrigoraAssetOperationalConditionKind,
  type FrigoraVisitEvidenceCategory,
} from "@/modules/frigora/types";

export type FieldFormState = {
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

function assignedPath(ventureId: string) {
  return `/ventures/${ventureId}/work/assigned`;
}

function workPath(ventureId: string) {
  return `/ventures/${ventureId}/work`;
}

function workDetailPath(ventureId: string, workOrderId: string) {
  return `/ventures/${ventureId}/work/${workOrderId}`;
}

function visitEntryPath(ventureId: string, workOrderId: string) {
  return `/ventures/${ventureId}/work/${workOrderId}/visit`;
}

function visitRecorderPath(ventureId: string, workOrderId: string, visitId: string) {
  return `/ventures/${ventureId}/work/${workOrderId}/visit/${visitId}`;
}

function revalidateFieldSurfaces(
  ventureId: string,
  workOrderId: string,
  visitId?: string,
) {
  revalidatePath(assignedPath(ventureId));
  revalidatePath(workPath(ventureId));
  revalidatePath(workDetailPath(ventureId, workOrderId));
  revalidatePath(visitEntryPath(ventureId, workOrderId));
  if (visitId) {
    revalidatePath(visitRecorderPath(ventureId, workOrderId, visitId));
  }
  revalidatePath(`/ventures/${ventureId}`, "layout");
}

async function requireSessionWriterForWorkOrder(
  scope: { workspaceId: string; ventureId: string },
  workOrderId: string,
): Promise<{ session: { id: string }; error?: string }> {
  const session = await getSession();
  if (!session) {
    return { session: { id: "" }, error: "You must be signed in." };
  }

  const workResult = await getWorkOrderQuery({ ...scope, id: workOrderId });
  if (workResult.error) {
    return { session, error: workResult.error };
  }
  const workOrder = workResult.record;
  if (!workOrder) {
    return { session, error: "Work order not found." };
  }
  if (workOrder.status !== "open") {
    return { session, error: "Work order is not open." };
  }
  if (workOrder.assignedUserId !== session.id) {
    return { session, error: "Field execution is for the assigned user." };
  }

  return { session };
}

function parseOptionalAssetId(formData: FormData): string | null {
  const raw = text(formData, "assetId").trim();
  return raw.length > 0 ? raw : null;
}

function parseFiniteNumber(raw: string): number | null {
  if (raw.trim().length === 0) {
    return null;
  }
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

export async function startVisitFormAction(
  _prev: FieldFormState,
  formData: FormData,
): Promise<FieldFormState> {
  const scope = scopeFromForm(formData);
  const workOrderId = text(formData, "workOrderId");

  const gate = await requireSessionWriterForWorkOrder(scope, workOrderId);
  if (gate.error) {
    return { error: gate.error };
  }

  const result = await recordVisitArrivalAction({
    ...scope,
    workOrderId,
    userId: gate.session.id,
    arrivedAt: nowIso(),
  });

  if (result.error || !result.record) {
    return { error: result.error ?? "Could not start visit." };
  }

  revalidateFieldSurfaces(scope.ventureId, workOrderId, result.record.id);
  redirect(visitRecorderPath(scope.ventureId, workOrderId, result.record.id));
}

export async function finishVisitFormAction(
  _prev: FieldFormState,
  formData: FormData,
): Promise<FieldFormState> {
  const scope = scopeFromForm(formData);
  const workOrderId = text(formData, "workOrderId");
  const visitId = text(formData, "visitId");

  const gate = await requireSessionWriterForWorkOrder(scope, workOrderId);
  if (gate.error) {
    return { error: gate.error };
  }

  const result = await recordVisitDepartureAction({
    ...scope,
    id: visitId,
    departedAt: nowIso(),
  });

  if (result.error) {
    return { error: result.error };
  }

  revalidateFieldSurfaces(scope.ventureId, workOrderId, visitId);
  return {};
}

export async function recordFieldCaptureFormAction(
  _prev: FieldFormState,
  formData: FormData,
): Promise<FieldFormState> {
  const scope = scopeFromForm(formData);
  const workOrderId = text(formData, "workOrderId");
  const visitId = text(formData, "visitId");

  const gate = await requireSessionWriterForWorkOrder(scope, workOrderId);
  if (gate.error) {
    return { error: gate.error };
  }

  const captureKindRaw = text(formData, "captureKind").trim();
  const captureCodeRaw = text(formData, "captureCode").trim();
  const values = {
    captureKind: captureKindRaw,
    captureCode: captureCodeRaw,
    valueNumeric: text(formData, "valueNumeric"),
    valueUnit: text(formData, "valueUnit"),
    description: text(formData, "description"),
  };

  if (
    captureKindRaw !== "measurement" &&
    captureKindRaw !== "condition"
  ) {
    return { error: "Select a valid capture kind.", values };
  }
  if (!(FRIGORA_FIELD_CAPTURE_CODES as readonly string[]).includes(captureCodeRaw)) {
    return { error: "Select a valid capture code.", values };
  }

  const captureKind = captureKindRaw as FrigoraFieldCaptureKind;
  const captureCode = captureCodeRaw as FrigoraFieldCaptureCode;

  let valueNumeric: number | null = null;
  let valueUnit: FrigoraFieldCaptureUnit | null = null;
  let description: string | null = null;

  if (captureKind === "measurement") {
    valueNumeric = parseFiniteNumber(values.valueNumeric);
    const unitRaw = values.valueUnit.trim();
    if (!(FRIGORA_FIELD_CAPTURE_UNITS as readonly string[]).includes(unitRaw)) {
      return { error: "Select a valid unit.", values };
    }
    valueUnit = unitRaw as FrigoraFieldCaptureUnit;
  } else {
    description = optionalText(formData, "description");
  }

  const result = await recordFieldCaptureAction({
    ...scope,
    visitId,
    captureKind,
    captureCode,
    valueNumeric,
    valueUnit,
    description,
    observedAt: nowIso(),
    userId: gate.session.id,
    assetId: parseOptionalAssetId(formData),
  });

  if (result.error) {
    return { error: result.error, values };
  }

  revalidateFieldSurfaces(scope.ventureId, workOrderId, visitId);
  return {};
}

export async function recordTechnicalFindingFormAction(
  _prev: FieldFormState,
  formData: FormData,
): Promise<FieldFormState> {
  const scope = scopeFromForm(formData);
  const workOrderId = text(formData, "workOrderId");
  const visitId = text(formData, "visitId");
  const values = { findingKind: text(formData, "findingKind"), description: text(formData, "description") };

  const gate = await requireSessionWriterForWorkOrder(scope, workOrderId);
  if (gate.error) {
    return { error: gate.error, values };
  }

  const findingKindRaw = values.findingKind.trim();
  const kinds: FrigoraTechnicalFindingKind[] = [
    "symptom",
    "suspected_fault",
    "confirmed_fault",
  ];
  if (!kinds.includes(findingKindRaw as FrigoraTechnicalFindingKind)) {
    return { error: "Select a valid finding kind.", values };
  }

  const result = await recordTechnicalFindingAction({
    ...scope,
    visitId,
    findingKind: findingKindRaw as FrigoraTechnicalFindingKind,
    description: values.description.trim(),
    assertedAt: nowIso(),
    userId: gate.session.id,
    assetId: parseOptionalAssetId(formData),
  });

  if (result.error) {
    return { error: result.error, values };
  }

  revalidateFieldSurfaces(scope.ventureId, workOrderId, visitId);
  return {};
}

export async function recordCorrectiveActionFormAction(
  _prev: FieldFormState,
  formData: FormData,
): Promise<FieldFormState> {
  const scope = scopeFromForm(formData);
  const workOrderId = text(formData, "workOrderId");
  const visitId = text(formData, "visitId");
  const values = { description: text(formData, "description") };

  const gate = await requireSessionWriterForWorkOrder(scope, workOrderId);
  if (gate.error) {
    return { error: gate.error, values };
  }

  const result = await recordCorrectiveActionAction({
    ...scope,
    visitId,
    description: values.description.trim(),
    performedAt: nowIso(),
    performedByUserId: gate.session.id,
    recordedByUserId: gate.session.id,
    assetId: parseOptionalAssetId(formData),
  });

  if (result.error) {
    return { error: result.error, values };
  }

  revalidateFieldSurfaces(scope.ventureId, workOrderId, visitId);
  return {};
}

export async function recordPartUsageFormAction(
  _prev: FieldFormState,
  formData: FormData,
): Promise<FieldFormState> {
  const scope = scopeFromForm(formData);
  const workOrderId = text(formData, "workOrderId");
  const visitId = text(formData, "visitId");
  const values = {
    partDescription: text(formData, "partDescription"),
    quantity: text(formData, "quantity"),
    quantityUnit: text(formData, "quantityUnit"),
    notes: text(formData, "notes"),
  };

  const gate = await requireSessionWriterForWorkOrder(scope, workOrderId);
  if (gate.error) {
    return { error: gate.error, values };
  }

  const unitRaw = values.quantityUnit.trim();
  if (!(FRIGORA_PART_USAGE_UNITS as readonly string[]).includes(unitRaw)) {
    return { error: "Select a valid quantity unit.", values };
  }
  const quantity = parseFiniteNumber(values.quantity);
  if (quantity === null || quantity <= 0) {
    return { error: "Quantity must be greater than zero.", values };
  }

  const result = await recordPartUsageAction({
    ...scope,
    visitId,
    partDescription: values.partDescription.trim(),
    quantity,
    quantityUnit: unitRaw as FrigoraPartUsageUnit,
    notes: optionalText(formData, "notes"),
    usedAt: nowIso(),
    usedByUserId: gate.session.id,
    recordedByUserId: gate.session.id,
    assetId: parseOptionalAssetId(formData),
  });

  if (result.error) {
    return { error: result.error, values };
  }

  revalidateFieldSurfaces(scope.ventureId, workOrderId, visitId);
  return {};
}

export async function recordRefrigerantEventFormAction(
  _prev: FieldFormState,
  formData: FormData,
): Promise<FieldFormState> {
  const scope = scopeFromForm(formData);
  const workOrderId = text(formData, "workOrderId");
  const visitId = text(formData, "visitId");
  const values = {
    refrigerantType: text(formData, "refrigerantType"),
    eventKind: text(formData, "eventKind"),
    quantityKg: text(formData, "quantityKg"),
    reason: text(formData, "reason"),
    cylinderReference: text(formData, "cylinderReference"),
  };

  const gate = await requireSessionWriterForWorkOrder(scope, workOrderId);
  if (gate.error) {
    return { error: gate.error, values };
  }

  const eventKindRaw = values.eventKind.trim();
  if (!(FRIGORA_REFRIGERANT_EVENT_KINDS as readonly string[]).includes(eventKindRaw)) {
    return { error: "Select a valid refrigerant event kind.", values };
  }
  const quantityKg = parseFiniteNumber(values.quantityKg);
  if (quantityKg === null || quantityKg <= 0) {
    return { error: "Quantity must be greater than zero.", values };
  }

  const result = await recordRefrigerantEventAction({
    ...scope,
    visitId,
    refrigerantType: values.refrigerantType.trim(),
    eventKind: eventKindRaw as FrigoraRefrigerantEventKind,
    quantityKg,
    reason: optionalText(formData, "reason"),
    cylinderReference: optionalText(formData, "cylinderReference"),
    occurredAt: nowIso(),
    handledByUserId: gate.session.id,
    recordedByUserId: gate.session.id,
    assetId: parseOptionalAssetId(formData),
  });

  if (result.error) {
    return { error: result.error, values };
  }

  revalidateFieldSurfaces(scope.ventureId, workOrderId, visitId);
  return {};
}

export async function recordVisitOutcomeFormAction(
  _prev: FieldFormState,
  formData: FormData,
): Promise<FieldFormState> {
  const scope = scopeFromForm(formData);
  const workOrderId = text(formData, "workOrderId");
  const visitId = text(formData, "visitId");
  const values = { description: text(formData, "description") };

  const gate = await requireSessionWriterForWorkOrder(scope, workOrderId);
  if (gate.error) {
    return { error: gate.error, values };
  }

  const result = await recordVisitOutcomeAction({
    ...scope,
    visitId,
    description: values.description.trim(),
    outcomeAt: nowIso(),
    recordedByUserId: gate.session.id,
    assetId: parseOptionalAssetId(formData),
  });

  if (result.error) {
    return { error: result.error, values };
  }

  revalidateFieldSurfaces(scope.ventureId, workOrderId, visitId);
  return {};
}

export async function recordOperationalConditionFormAction(
  _prev: FieldFormState,
  formData: FormData,
): Promise<FieldFormState> {
  const scope = scopeFromForm(formData);
  const workOrderId = text(formData, "workOrderId");
  const visitId = text(formData, "visitId");
  const assetId = text(formData, "assetId").trim();
  const values = {
    conditionKind: text(formData, "conditionKind"),
    notes: text(formData, "notes"),
  };

  const gate = await requireSessionWriterForWorkOrder(scope, workOrderId);
  if (gate.error) {
    return { error: gate.error, values };
  }

  if (!assetId) {
    return { error: "Asset is required for operational condition.", values };
  }

  const kindRaw = values.conditionKind.trim();
  if (
    !(FRIGORA_ASSET_OPERATIONAL_CONDITION_KINDS as readonly string[]).includes(kindRaw)
  ) {
    return { error: "Select a valid operational condition.", values };
  }

  const result = await recordAssetOperationalConditionAction({
    ...scope,
    assetId,
    conditionKind: kindRaw as FrigoraAssetOperationalConditionKind,
    notes: optionalText(formData, "notes"),
    visitId,
    workOrderId,
    assertedAt: nowIso(),
    assertedByUserId: gate.session.id,
    recordedByUserId: gate.session.id,
  });

  if (result.error) {
    return { error: result.error, values };
  }

  revalidateFieldSurfaces(scope.ventureId, workOrderId, visitId);
  return {};
}

export async function recordRecommendedActionFormAction(
  _prev: FieldFormState,
  formData: FormData,
): Promise<FieldFormState> {
  const scope = scopeFromForm(formData);
  const workOrderId = text(formData, "workOrderId");
  const visitId = text(formData, "visitId");
  const values = { description: text(formData, "description") };

  const gate = await requireSessionWriterForWorkOrder(scope, workOrderId);
  if (gate.error) {
    return { error: gate.error, values };
  }

  const result = await recordRecommendedActionAction({
    ...scope,
    visitId,
    description: values.description.trim(),
    recommendedAt: nowIso(),
    recommendedByUserId: gate.session.id,
    recordedByUserId: gate.session.id,
    assetId: parseOptionalAssetId(formData),
  });

  if (result.error) {
    return { error: result.error, values };
  }

  revalidateFieldSurfaces(scope.ventureId, workOrderId, visitId);
  return {};
}

export async function recordCustomerAcknowledgementFormAction(
  _prev: FieldFormState,
  formData: FormData,
): Promise<FieldFormState> {
  const scope = scopeFromForm(formData);
  const workOrderId = text(formData, "workOrderId");
  const visitId = text(formData, "visitId");
  const values = {
    acknowledgementText: text(formData, "acknowledgementText"),
    acknowledgerName: text(formData, "acknowledgerName"),
  };

  const gate = await requireSessionWriterForWorkOrder(scope, workOrderId);
  if (gate.error) {
    return { error: gate.error, values };
  }

  const result = await recordVisitCustomerAcknowledgementAction({
    ...scope,
    visitId,
    acknowledgementText: values.acknowledgementText.trim(),
    acknowledgerName: values.acknowledgerName.trim(),
    acknowledgedAt: nowIso(),
    recordedByUserId: gate.session.id,
  });

  if (result.error) {
    return { error: result.error, values };
  }

  revalidateFieldSurfaces(scope.ventureId, workOrderId, visitId);
  return {};
}

export async function recordVisitEvidenceFormAction(
  _prev: FieldFormState,
  formData: FormData,
): Promise<FieldFormState> {
  const scope = scopeFromForm(formData);
  const workOrderId = text(formData, "workOrderId");
  const visitId = text(formData, "visitId");
  const values = {
    category: text(formData, "category"),
    description: text(formData, "description"),
  };

  const gate = await requireSessionWriterForWorkOrder(scope, workOrderId);
  if (gate.error) {
    return { error: gate.error, values };
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Choose a photo or file to upload.", values };
  }

  const body = new Uint8Array(await file.arrayBuffer());
  const originalFilename = file.name.trim().length > 0 ? file.name : "evidence.jpg";
  const mimeType = file.type.trim().length > 0 ? file.type : "image/jpeg";

  const result = await recordVisitEvidenceWithFileAction({
    ...scope,
    visitId,
    category: values.category as FrigoraVisitEvidenceCategory,
    description: optionalText(formData, "description"),
    userId: gate.session.id,
    assetId: parseOptionalAssetId(formData),
    body,
    originalFilename,
    mimeType,
  });

  if (result.error) {
    return { error: result.error, values };
  }

  revalidateFieldSurfaces(scope.ventureId, workOrderId, visitId);
  return {};
}

export async function removeVisitEvidenceFormAction(
  _prev: FieldFormState,
  formData: FormData,
): Promise<FieldFormState> {
  const scope = scopeFromForm(formData);
  const workOrderId = text(formData, "workOrderId");
  const visitId = text(formData, "visitId");
  const evidenceId = text(formData, "evidenceId");

  const gate = await requireSessionWriterForWorkOrder(scope, workOrderId);
  if (gate.error) {
    return { error: gate.error };
  }

  const result = await removeVisitEvidenceAction({
    ...scope,
    id: evidenceId,
  });

  if (result.error) {
    return { error: result.error };
  }

  revalidateFieldSurfaces(scope.ventureId, workOrderId, visitId);
  return {};
}
