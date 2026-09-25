import type { StoredObjectId, UserId, VentureId, WorkspaceId } from "@/contracts";

export type FrigoraCustomerId = string & { readonly __brand: "FrigoraCustomerId" };
export type FrigoraSiteId = string & { readonly __brand: "FrigoraSiteId" };
export type FrigoraAssetId = string & { readonly __brand: "FrigoraAssetId" };
export type FrigoraWorkOrderId = string & { readonly __brand: "FrigoraWorkOrderId" };
export type FrigoraVisitId = string & { readonly __brand: "FrigoraVisitId" };
export type FrigoraFieldCaptureId = string & { readonly __brand: "FrigoraFieldCaptureId" };
export type FrigoraTechnicalFindingId = string & { readonly __brand: "FrigoraTechnicalFindingId" };
export type FrigoraCorrectiveActionId = string & { readonly __brand: "FrigoraCorrectiveActionId" };
export type FrigoraVisitOutcomeId = string & { readonly __brand: "FrigoraVisitOutcomeId" };
export type FrigoraRecommendedActionId = string & { readonly __brand: "FrigoraRecommendedActionId" };
export type FrigoraRefrigerantEventId = string & { readonly __brand: "FrigoraRefrigerantEventId" };
export type FrigoraPartUsageId = string & { readonly __brand: "FrigoraPartUsageId" };
export type FrigoraPartReferenceId = string & { readonly __brand: "FrigoraPartReferenceId" };
export type FrigoraRefrigerantReferenceId = string & {
  readonly __brand: "FrigoraRefrigerantReferenceId";
};
export type FrigoraAssetOperationalConditionId = string & {
  readonly __brand: "FrigoraAssetOperationalConditionId";
};
export type FrigoraVisitCustomerAcknowledgementId = string & {
  readonly __brand: "FrigoraVisitCustomerAcknowledgementId";
};
export type FrigoraVisitEvidenceId = string & { readonly __brand: "FrigoraVisitEvidenceId" };
export type FrigoraDispatchEventId = string & { readonly __brand: "FrigoraDispatchEventId" };

export const FRIGORA_DISPATCH_EVENT_TYPES = [
  "ASSIGNED",
  "UNASSIGNED",
  "REASSIGNED",
  "SCHEDULED",
  "RESCHEDULED",
  "SCHEDULE_CLEARED",
] as const;

export type FrigoraDispatchEventType = (typeof FRIGORA_DISPATCH_EVENT_TYPES)[number];

export type FrigoraDispatchEvent = {
  id: FrigoraDispatchEventId;
  workspaceId: WorkspaceId;
  ventureId: VentureId;
  workOrderId: FrigoraWorkOrderId;
  eventType: FrigoraDispatchEventType;
  actorUserId: UserId;
  occurredAt: string;
  previousAssignedUserId: UserId | null;
  nextAssignedUserId: UserId | null;
  previousScheduledStartAt: string | null;
  previousScheduledEndAt: string | null;
  nextScheduledStartAt: string | null;
  nextScheduledEndAt: string | null;
};

export const FRIGORA_VISIT_EVIDENCE_CATEGORIES = [
  "SITE_CONDITION",
  "BEFORE_WORK",
  "AFTER_WORK",
  "TECHNICAL",
  "PARTS",
  "REFRIGERANT",
  "DOCUMENTATION",
  "OTHER",
] as const;

export type FrigoraVisitEvidenceCategory = (typeof FRIGORA_VISIT_EVIDENCE_CATEGORIES)[number];

export type FrigoraCustomerStatus = "active" | "archived";
export type FrigoraSiteStatus = "active" | "archived";
export type FrigoraAssetStatus = "active" | "decommissioned";
export type FrigoraWorkOrderStatus = "open" | "closed" | "cancelled";
export type FrigoraVisitStatus = "open" | "departed" | "cancelled";
export type FrigoraFieldCaptureKind = "measurement" | "condition";
export type FrigoraTechnicalFindingKind = "symptom" | "suspected_fault" | "confirmed_fault";

export const FRIGORA_REFRIGERANT_EVENT_KINDS = ["added", "recovered", "removed"] as const;
export type FrigoraRefrigerantEventKind = (typeof FRIGORA_REFRIGERANT_EVENT_KINDS)[number];

export const FRIGORA_PART_USAGE_UNITS = ["each", "metre", "litre", "kilogram", "other"] as const;
export type FrigoraPartUsageUnit = (typeof FRIGORA_PART_USAGE_UNITS)[number];

export const FRIGORA_CATALOGUE_REFERENCE_STATUSES = ["active", "retired"] as const;
export type FrigoraCatalogueReferenceStatus =
  (typeof FRIGORA_CATALOGUE_REFERENCE_STATUSES)[number];

export const FRIGORA_ASSET_OPERATIONAL_CONDITION_KINDS = [
  "operational",
  "partially_operational",
  "non_operational",
  "unknown",
] as const;
export type FrigoraAssetOperationalConditionKind =
  (typeof FRIGORA_ASSET_OPERATIONAL_CONDITION_KINDS)[number];

export const FRIGORA_WORK_KINDS = ["reactive", "planned", "inspection"] as const;
export type FrigoraWorkKind = (typeof FRIGORA_WORK_KINDS)[number];

export const FRIGORA_WORK_ORDER_PRIORITIES = ["normal", "high", "urgent"] as const;
export type FrigoraWorkOrderPriority = (typeof FRIGORA_WORK_ORDER_PRIORITIES)[number];

export const FRIGORA_WORK_ORDER_PRIORITY_LABELS: Record<FrigoraWorkOrderPriority, string> = {
  normal: "Normal",
  high: "High",
  urgent: "Urgent",
};

/** Lower rank is presented first: urgent, then high, then normal. */
export const FRIGORA_WORK_ORDER_PRIORITY_RANK: Record<FrigoraWorkOrderPriority, number> = {
  urgent: 0,
  high: 1,
  normal: 2,
};

export const FRIGORA_ASSET_KINDS = [
  "display_freezer",
  "cold_room",
  "condensing_unit",
  "evaporator",
  "packaged_unit",
  "cabinet",
  "other",
] as const;

export type FrigoraAssetKind = (typeof FRIGORA_ASSET_KINDS)[number];

export const FRIGORA_FIELD_CAPTURE_CODES = [
  "temperature",
  "suction_pressure",
  "discharge_pressure",
  "voltage",
  "current",
  "visual_condition",
  "other",
] as const;

export type FrigoraFieldCaptureCode = (typeof FRIGORA_FIELD_CAPTURE_CODES)[number];

export const FRIGORA_FIELD_CAPTURE_UNITS = [
  "celsius",
  "bar",
  "volt",
  "ampere",
  "other",
] as const;

export type FrigoraFieldCaptureUnit = (typeof FRIGORA_FIELD_CAPTURE_UNITS)[number];

export type FrigoraScope = {
  userId: UserId;
  workspaceId: WorkspaceId;
  ventureId: VentureId;
};

export type FrigoraCustomer = {
  id: FrigoraCustomerId;
  workspaceId: WorkspaceId;
  ventureId: VentureId;
  code: string;
  displayName: string;
  legalName: string | null;
  status: FrigoraCustomerStatus;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type FrigoraSite = {
  id: FrigoraSiteId;
  workspaceId: WorkspaceId;
  ventureId: VentureId;
  customerId: FrigoraCustomerId;
  code: string;
  name: string;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  region: string | null;
  postalCode: string | null;
  country: string | null;
  status: FrigoraSiteStatus;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type FrigoraAsset = {
  id: FrigoraAssetId;
  workspaceId: WorkspaceId;
  ventureId: VentureId;
  siteId: FrigoraSiteId;
  tag: string;
  name: string | null;
  assetKind: FrigoraAssetKind | null;
  manufacturer: string | null;
  model: string | null;
  serialNumber: string | null;
  status: FrigoraAssetStatus;
  designTargetCelsius: number | null;
  refrigerantType: string | null;
  locationOnSite: string | null;
  installedOn: string | null;
  commissionedOn: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type FrigoraWorkOrder = {
  id: FrigoraWorkOrderId;
  workspaceId: WorkspaceId;
  ventureId: VentureId;
  customerId: FrigoraCustomerId;
  siteId: FrigoraSiteId;
  primaryAssetId: FrigoraAssetId | null;
  workReference: string;
  workKind: FrigoraWorkKind;
  priority: FrigoraWorkOrderPriority;
  reportedCondition: string | null;
  status: FrigoraWorkOrderStatus;
  assignedUserId: UserId | null;
  scheduledStartAt: string | null;
  scheduledEndAt: string | null;
  assignmentAcceptedAt: string | null;
  assignmentDeclinedAt: string | null;
  assignmentDeclineReason: string | null;
  cancellationReason: string | null;
  sourceRecommendedActionId: FrigoraRecommendedActionId | null;
  createdAt: string;
  updatedAt: string;
};

export type CreateCustomerInput = {
  code: string;
  displayName: string;
  legalName?: string | null;
  notes?: string | null;
};

export type UpdateCustomerInput = {
  code?: string;
  displayName?: string;
  legalName?: string | null;
  notes?: string | null;
};

export type CreateSiteInput = {
  customerId: string;
  code: string;
  name: string;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  region?: string | null;
  postalCode?: string | null;
  country?: string | null;
  notes?: string | null;
};

export type UpdateSiteInput = {
  code?: string;
  name?: string;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  region?: string | null;
  postalCode?: string | null;
  country?: string | null;
  notes?: string | null;
};

export type CreateAssetInput = {
  siteId: string;
  tag: string;
  name?: string | null;
  assetKind?: FrigoraAssetKind | null;
  manufacturer?: string | null;
  model?: string | null;
  serialNumber?: string | null;
  designTargetCelsius?: number | null;
  refrigerantType?: string | null;
  locationOnSite?: string | null;
  installedOn?: string | null;
  commissionedOn?: string | null;
  notes?: string | null;
};

export type UpdateAssetInput = {
  siteId?: string;
  tag?: string;
  name?: string | null;
  assetKind?: FrigoraAssetKind | null;
  manufacturer?: string | null;
  model?: string | null;
  serialNumber?: string | null;
  designTargetCelsius?: number | null;
  refrigerantType?: string | null;
  locationOnSite?: string | null;
  installedOn?: string | null;
  commissionedOn?: string | null;
  notes?: string | null;
};

export type CreateWorkOrderInput = {
  siteId: string;
  workReference: string;
  workKind: FrigoraWorkKind;
  reportedCondition?: string | null;
  primaryAssetId?: string | null;
};

export type UpdateWorkOrderInput = {
  workKind?: FrigoraWorkKind;
  reportedCondition?: string | null;
  primaryAssetId?: string | null;
};

export type SetWorkOrderPriorityInput = {
  priority: FrigoraWorkOrderPriority;
  /** Exact WorkOrder.updatedAt the dispatcher acted upon. */
  expectedUpdatedAt: string;
};

export type CancelWorkOrderInput = {
  reason: string;
};

export type AssignWorkOrderInput = {
  confirmDoubleBooking?: boolean;
  userId: string;
  /** Exact WorkOrder.updatedAt the dispatcher acted upon. */
  expectedUpdatedAt: string;
};

export type ClearWorkOrderAssignmentInput = {
  expectedUpdatedAt: string;
};

export type ScheduleWorkOrderInput = {
  confirmDoubleBooking?: boolean;
  scheduledStartAt: string;
  scheduledEndAt: string;
  expectedUpdatedAt: string;
};

export type ClearWorkOrderScheduleInput = {
  expectedUpdatedAt: string;
};

export type DeclineWorkOrderAssignmentInput = {
  reason: string;
};

export type ListScheduledWorkOrdersInput = {
  rangeStart: string;
  rangeEnd: string;
};

export type FrigoraVisit = {
  id: FrigoraVisitId;
  workspaceId: WorkspaceId;
  ventureId: VentureId;
  workOrderId: FrigoraWorkOrderId;
  attendingUserId: UserId;
  arrivedAt: string;
  departedAt: string | null;
  /** F3.1 customer labour hourly charge snapshot in ZAR cents; set at departure when configured. */
  labourHourlyChargeCents: number | null;
  status: FrigoraVisitStatus;
  createdAt: string;
  updatedAt: string;
};

export type RecordVisitArrivalInput = {
  userId: string;
  arrivedAt: string;
};

export type RecordVisitDepartureInput = {
  departedAt: string;
};

export type FrigoraFieldCapture = {
  id: FrigoraFieldCaptureId;
  workspaceId: WorkspaceId;
  ventureId: VentureId;
  visitId: FrigoraVisitId;
  workOrderId: FrigoraWorkOrderId;
  assetId: FrigoraAssetId | null;
  captureKind: FrigoraFieldCaptureKind;
  captureCode: FrigoraFieldCaptureCode;
  valueNumeric: number | null;
  valueUnit: FrigoraFieldCaptureUnit | null;
  description: string | null;
  observedAt: string;
  capturedByUserId: UserId;
  createdAt: string;
  updatedAt: string;
};

export type RecordFieldCaptureInput = {
  captureKind: FrigoraFieldCaptureKind;
  captureCode: string;
  valueNumeric?: number | null;
  valueUnit?: string | null;
  description?: string | null;
  observedAt: string;
  userId: string;
  assetId?: string | null;
};

export type FrigoraTechnicalFinding = {
  id: FrigoraTechnicalFindingId;
  workspaceId: WorkspaceId;
  ventureId: VentureId;
  visitId: FrigoraVisitId;
  workOrderId: FrigoraWorkOrderId;
  assetId: FrigoraAssetId | null;
  findingKind: FrigoraTechnicalFindingKind;
  description: string;
  sourceFieldCaptureIds: FrigoraFieldCaptureId[] | null;
  assertedAt: string;
  recordedByUserId: UserId;
  createdAt: string;
  updatedAt: string;
};

export type RecordTechnicalFindingInput = {
  findingKind: FrigoraTechnicalFindingKind;
  description: string;
  assertedAt: string;
  userId: string;
  assetId?: string | null;
  sourceFieldCaptureIds?: string[];
};

/** F33-03 server receipt for an accepted client operation. */
export type FrigoraClientOperationReceiptId = string & {
  readonly __brand: "FrigoraClientOperationReceiptId";
};

export type FrigoraClientOperationReceipt = {
  id: FrigoraClientOperationReceiptId;
  workspaceId: WorkspaceId;
  ventureId: VentureId;
  actorUserId: UserId;
  clientOperationId: string;
  operationType: "recordTechnicalFinding" | "recordFieldCapture" | "recordVisitEvidence";
  workOrderId: FrigoraWorkOrderId;
  visitId: FrigoraVisitId | null;
  requestFingerprint: string;
  acceptedEntityId: string;
  acceptedAt: string;
  createdAt: string;
};

export type SubmitClientTechnicalFindingInput = RecordTechnicalFindingInput & {
  clientOperationId: string;
  workOrderId: string;
};

export type SubmitClientTechnicalFindingResult = {
  finding: FrigoraTechnicalFinding;
  receipt: FrigoraClientOperationReceipt;
  duplicate: boolean;
};

export type SubmitClientFieldCaptureInput = RecordFieldCaptureInput & {
  clientOperationId: string;
  workOrderId: string;
};

export type SubmitClientFieldCaptureResult = {
  capture: FrigoraFieldCapture;
  receipt: FrigoraClientOperationReceipt;
  duplicate: boolean;
};

export type FrigoraCorrectiveAction = {
  id: FrigoraCorrectiveActionId;
  workspaceId: WorkspaceId;
  ventureId: VentureId;
  visitId: FrigoraVisitId;
  workOrderId: FrigoraWorkOrderId;
  assetId: FrigoraAssetId | null;
  description: string;
  sourceTechnicalFindingIds: FrigoraTechnicalFindingId[] | null;
  performedAt: string;
  performedByUserId: UserId;
  recordedByUserId: UserId;
  createdAt: string;
  updatedAt: string;
};

export type RecordCorrectiveActionInput = {
  description: string;
  performedAt: string;
  performedByUserId: string;
  recordedByUserId: string;
  assetId?: string | null;
  sourceTechnicalFindingIds?: string[];
};

export type FrigoraVisitOutcome = {
  id: FrigoraVisitOutcomeId;
  workspaceId: WorkspaceId;
  ventureId: VentureId;
  visitId: FrigoraVisitId;
  workOrderId: FrigoraWorkOrderId;
  assetId: FrigoraAssetId | null;
  description: string;
  outcomeAt: string;
  recordedByUserId: UserId;
  createdAt: string;
  updatedAt: string;
};

export type RecordVisitOutcomeInput = {
  description: string;
  outcomeAt: string;
  recordedByUserId: string;
  assetId?: string | null;
};

export type FrigoraRecommendedAction = {
  id: FrigoraRecommendedActionId;
  workspaceId: WorkspaceId;
  ventureId: VentureId;
  visitId: FrigoraVisitId;
  workOrderId: FrigoraWorkOrderId;
  assetId: FrigoraAssetId | null;
  description: string;
  recommendedAt: string;
  recommendedByUserId: UserId;
  recordedByUserId: UserId;
  createdAt: string;
  updatedAt: string;
};

export type RecordRecommendedActionInput = {
  description: string;
  recommendedAt: string;
  recommendedByUserId: string;
  recordedByUserId: string;
  assetId?: string | null;
};

export type FrigoraPartReference = {
  id: FrigoraPartReferenceId;
  workspaceId: WorkspaceId;
  ventureId: VentureId;
  displayName: string;
  defaultQuantityUnit: FrigoraPartUsageUnit;
  /** Optional F3.1 default customer unit charge in ZAR cents. */
  defaultUnitChargeCents: number | null;
  status: FrigoraCatalogueReferenceStatus;
  createdAt: string;
  updatedAt: string;
};

export type CreatePartReferenceInput = {
  displayName: string;
  defaultQuantityUnit: FrigoraPartUsageUnit;
  defaultUnitChargeCents?: number | null;
};

export type UpdatePartReferenceInput = {
  displayName?: string;
  defaultQuantityUnit?: FrigoraPartUsageUnit;
  defaultUnitChargeCents?: number | null;
};

export type FrigoraRefrigerantReference = {
  id: FrigoraRefrigerantReferenceId;
  workspaceId: WorkspaceId;
  ventureId: VentureId;
  canonicalCode: string;
  displayName: string;
  /** Optional F3.1 default customer charge per kg in ZAR cents. */
  defaultChargePerKgCents: number | null;
  status: FrigoraCatalogueReferenceStatus;
  createdAt: string;
  updatedAt: string;
};

export type CreateRefrigerantReferenceInput = {
  canonicalCode: string;
  displayName: string;
  defaultChargePerKgCents?: number | null;
};

export type UpdateRefrigerantReferenceInput = {
  canonicalCode?: string;
  displayName?: string;
  defaultChargePerKgCents?: number | null;
};

/** Venture-scoped F3.1 customer charge defaults. */
export type FrigoraVentureCommercialSettings = {
  workspaceId: WorkspaceId;
  ventureId: VentureId;
  labourHourlyChargeCents: number | null;
  updatedAt: string;
};

export type SetVentureLabourHourlyChargeInput = {
  labourHourlyChargeCents: number | null;
};

export type SetPartUsageUnitChargeInput = {
  unitChargeCents: number;
};

export type SetRefrigerantEventChargePerKgInput = {
  chargePerKgCents: number;
};

export type SetVisitLabourHourlyChargeInput = {
  labourHourlyChargeCents: number;
};

export type FrigoraRefrigerantEvent = {
  id: FrigoraRefrigerantEventId;
  workspaceId: WorkspaceId;
  ventureId: VentureId;
  visitId: FrigoraVisitId;
  workOrderId: FrigoraWorkOrderId;
  assetId: FrigoraAssetId | null;
  refrigerantType: string;
  refrigerantReferenceId: FrigoraRefrigerantReferenceId | null;
  eventKind: FrigoraRefrigerantEventKind;
  quantityKg: number;
  /** F3.1 customer charge-per-kg snapshot in ZAR cents; required for added events to complete T&M. */
  chargePerKgCents: number | null;
  reason: string | null;
  cylinderReference: string | null;
  occurredAt: string;
  handledByUserId: UserId;
  recordedByUserId: UserId;
  createdAt: string;
  updatedAt: string;
};

export type RecordRefrigerantEventInput = {
  refrigerantType?: string;
  refrigerantReferenceId?: string | null;
  eventKind: FrigoraRefrigerantEventKind;
  quantityKg: number;
  reason?: string | null;
  cylinderReference?: string | null;
  occurredAt: string;
  handledByUserId: string;
  recordedByUserId: string;
  assetId?: string | null;
};

export type FrigoraPartUsage = {
  id: FrigoraPartUsageId;
  workspaceId: WorkspaceId;
  ventureId: VentureId;
  visitId: FrigoraVisitId;
  workOrderId: FrigoraWorkOrderId;
  assetId: FrigoraAssetId | null;
  partDescription: string;
  partReferenceId: FrigoraPartReferenceId | null;
  quantity: number;
  quantityUnit: FrigoraPartUsageUnit;
  /** F3.1 customer unit-charge snapshot in ZAR cents. */
  unitChargeCents: number | null;
  notes: string | null;
  usedAt: string;
  usedByUserId: UserId;
  recordedByUserId: UserId;
  createdAt: string;
  updatedAt: string;
};

export type RecordPartUsageInput = {
  partDescription?: string;
  partReferenceId?: string | null;
  quantity: number;
  quantityUnit?: FrigoraPartUsageUnit;
  notes?: string | null;
  usedAt: string;
  usedByUserId: string;
  recordedByUserId: string;
  assetId?: string | null;
};

export type FrigoraAssetOperationalCondition = {
  id: FrigoraAssetOperationalConditionId;
  workspaceId: WorkspaceId;
  ventureId: VentureId;
  assetId: FrigoraAssetId;
  conditionKind: FrigoraAssetOperationalConditionKind;
  notes: string | null;
  visitId: FrigoraVisitId | null;
  workOrderId: FrigoraWorkOrderId | null;
  assertedAt: string;
  assertedByUserId: UserId;
  recordedByUserId: UserId;
  createdAt: string;
  updatedAt: string;
};

export type RecordAssetOperationalConditionInput = {
  assetId: string;
  conditionKind: FrigoraAssetOperationalConditionKind;
  notes?: string | null;
  visitId?: string | null;
  workOrderId?: string | null;
  assertedAt: string;
  assertedByUserId: string;
  recordedByUserId: string;
};

export type FrigoraVisitCustomerAcknowledgement = {
  id: FrigoraVisitCustomerAcknowledgementId;
  workspaceId: WorkspaceId;
  ventureId: VentureId;
  visitId: FrigoraVisitId;
  workOrderId: FrigoraWorkOrderId;
  acknowledgementText: string;
  acknowledgerName: string;
  acknowledgedAt: string;
  recordedByUserId: UserId;
  createdAt: string;
  updatedAt: string;
};

export type RecordVisitCustomerAcknowledgementInput = {
  acknowledgementText: string;
  acknowledgerName: string;
  acknowledgedAt: string;
  recordedByUserId: string;
};

export type FrigoraVisitEvidence = {
  id: FrigoraVisitEvidenceId;
  workspaceId: WorkspaceId;
  ventureId: VentureId;
  visitId: FrigoraVisitId;
  workOrderId: FrigoraWorkOrderId;
  assetId: FrigoraAssetId | null;
  storedObjectId: StoredObjectId;
  category: FrigoraVisitEvidenceCategory;
  description: string | null;
  capturedAt: string;
  recordedByUserId: UserId;
  createdAt: string;
  removedAt: string | null;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
};

export type RecordVisitEvidenceInput = {
  category: FrigoraVisitEvidenceCategory;
  description?: string | null;
  userId: string;
  assetId?: string | null;
};

export type RecordVisitEvidenceWithFileInput = RecordVisitEvidenceInput & {
  body: Uint8Array;
  originalFilename: string;
  mimeType: string;
};

export type SubmitClientVisitEvidenceInput = RecordVisitEvidenceWithFileInput & {
  clientOperationId: string;
  workOrderId: string;
};

export type SubmitClientVisitEvidenceResult = {
  evidence: FrigoraVisitEvidence;
  receipt: FrigoraClientOperationReceipt;
  duplicate: boolean;
};

/**
 * F33-05 read-only acceptance probe. Canonical fields are recomputed on the
 * server. This input must not carry evidence bytes.
 */
export type LookupClientOperationAcceptanceInput = {
  ventureId: string;
  workspaceId: string;
  actorUserId: string;
  clientOperationId: string;
  workOrderId: string;
  visitId: string;
} & (
  | {
      operationType: "recordTechnicalFinding";
      findingKind: string;
      description: string;
      assertedAt: string;
      assetId?: string | null;
      sourceFieldCaptureIds?: string[] | null;
    }
  | {
      operationType: "recordFieldCapture";
      captureKind: string;
      captureCode: string;
      valueNumeric?: number | null;
      valueUnit?: string | null;
      description?: string | null;
      observedAt: string;
      assetId?: string | null;
    }
  | {
      operationType: "recordVisitEvidence";
      category: string;
      description?: string | null;
      originalFilename: string;
      mimeType: string;
      byteLength: number;
      contentSha256: string;
      assetId?: string | null;
    }
);

/** Narrow read result. MISMATCH and NOT_FOUND carry no foreign receipt data. */
export type FrigoraClientOperationAcceptanceLookup =
  | { status: "NOT_FOUND" }
  | { status: "MISMATCH" }
  | {
      status: "ACCEPTED";
      receiptId: FrigoraClientOperationReceiptId;
      clientOperationId: string;
      acceptedEntityId: string;
      operationType: FrigoraClientOperationReceipt["operationType"];
      acceptedAt: string;
      workOrderId: FrigoraWorkOrderId;
      visitId: FrigoraVisitId | null;
    };

export type LinkVisitEvidenceInput = RecordVisitEvidenceInput & {
  storedObjectId: string;
};

export const FRIGORA_ASSET_HISTORY_EVENT_KINDS = [
  "reported_intake",
  "visit_arrival",
  "visit_departure",
  "observed",
  "finding",
  "corrective_action",
  "part_usage",
  "refrigerant",
  "outcome",
  "recommendation",
  "operational_condition",
] as const;

export type FrigoraAssetHistoryEventKind = (typeof FRIGORA_ASSET_HISTORY_EVENT_KINDS)[number];

type FrigoraAssetHistoryEntryBase = {
  assetId: FrigoraAssetId;
  visitId: FrigoraVisitId | null;
  workOrderId: FrigoraWorkOrderId | null;
  occurredAt: string;
  recordedAt: string;
  actorUserId: UserId | null;
  recordedByUserId: UserId | null;
};

export type FrigoraAssetHistoryReportedIntakeDetail = {
  workReference: string;
  reportedCondition: string;
  workKind: FrigoraWorkKind;
};

export type FrigoraAssetHistoryVisitAttendanceDetail = {
  status: FrigoraVisitStatus;
  attendingUserId: UserId;
};

export type FrigoraAssetHistoryObservedDetail = {
  captureKind: FrigoraFieldCaptureKind;
  captureCode: FrigoraFieldCaptureCode;
  valueNumeric: number | null;
  valueUnit: FrigoraFieldCaptureUnit | null;
  description: string | null;
};

export type FrigoraAssetHistoryFindingDetail = {
  findingKind: FrigoraTechnicalFindingKind;
  description: string;
};

export type FrigoraAssetHistoryCorrectiveActionDetail = {
  description: string;
};

export type FrigoraAssetHistoryPartUsageDetail = {
  partDescription: string;
  quantity: number;
  quantityUnit: FrigoraPartUsageUnit;
  notes: string | null;
};

export type FrigoraAssetHistoryRefrigerantDetail = {
  refrigerantType: string;
  eventKind: FrigoraRefrigerantEventKind;
  quantityKg: number;
  reason: string | null;
  cylinderReference: string | null;
};

export type FrigoraAssetHistoryOutcomeDetail = {
  description: string;
};

export type FrigoraAssetHistoryRecommendationDetail = {
  description: string;
};

export type FrigoraAssetHistoryOperationalConditionDetail = {
  conditionKind: FrigoraAssetOperationalConditionKind;
  notes: string | null;
};

export type FrigoraAssetHistoryEntry =
  | (FrigoraAssetHistoryEntryBase & {
      kind: "reported_intake";
      sourceId: FrigoraWorkOrderId;
      detail: FrigoraAssetHistoryReportedIntakeDetail;
    })
  | (FrigoraAssetHistoryEntryBase & {
      kind: "visit_arrival";
      sourceId: FrigoraVisitId;
      detail: FrigoraAssetHistoryVisitAttendanceDetail;
    })
  | (FrigoraAssetHistoryEntryBase & {
      kind: "visit_departure";
      sourceId: FrigoraVisitId;
      detail: FrigoraAssetHistoryVisitAttendanceDetail;
    })
  | (FrigoraAssetHistoryEntryBase & {
      kind: "observed";
      sourceId: FrigoraFieldCaptureId;
      detail: FrigoraAssetHistoryObservedDetail;
    })
  | (FrigoraAssetHistoryEntryBase & {
      kind: "finding";
      sourceId: FrigoraTechnicalFindingId;
      detail: FrigoraAssetHistoryFindingDetail;
    })
  | (FrigoraAssetHistoryEntryBase & {
      kind: "corrective_action";
      sourceId: FrigoraCorrectiveActionId;
      detail: FrigoraAssetHistoryCorrectiveActionDetail;
    })
  | (FrigoraAssetHistoryEntryBase & {
      kind: "part_usage";
      sourceId: FrigoraPartUsageId;
      detail: FrigoraAssetHistoryPartUsageDetail;
    })
  | (FrigoraAssetHistoryEntryBase & {
      kind: "refrigerant";
      sourceId: FrigoraRefrigerantEventId;
      detail: FrigoraAssetHistoryRefrigerantDetail;
    })
  | (FrigoraAssetHistoryEntryBase & {
      kind: "outcome";
      sourceId: FrigoraVisitOutcomeId;
      detail: FrigoraAssetHistoryOutcomeDetail;
    })
  | (FrigoraAssetHistoryEntryBase & {
      kind: "recommendation";
      sourceId: FrigoraRecommendedActionId;
      detail: FrigoraAssetHistoryRecommendationDetail;
    })
  | (FrigoraAssetHistoryEntryBase & {
      kind: "operational_condition";
      sourceId: FrigoraAssetOperationalConditionId;
      detail: FrigoraAssetHistoryOperationalConditionDetail;
    });
