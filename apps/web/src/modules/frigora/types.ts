import type { UserId, VentureId, WorkspaceId } from "@/contracts";

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

export const FRIGORA_WORK_KINDS = ["reactive", "planned", "inspection"] as const;
export type FrigoraWorkKind = (typeof FRIGORA_WORK_KINDS)[number];

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
  reportedCondition: string | null;
  status: FrigoraWorkOrderStatus;
  assignedUserId: UserId | null;
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

export type AssignWorkOrderInput = {
  userId: string;
};

export type FrigoraVisit = {
  id: FrigoraVisitId;
  workspaceId: WorkspaceId;
  ventureId: VentureId;
  workOrderId: FrigoraWorkOrderId;
  attendingUserId: UserId;
  arrivedAt: string;
  departedAt: string | null;
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

export type FrigoraRefrigerantEvent = {
  id: FrigoraRefrigerantEventId;
  workspaceId: WorkspaceId;
  ventureId: VentureId;
  visitId: FrigoraVisitId;
  workOrderId: FrigoraWorkOrderId;
  assetId: FrigoraAssetId | null;
  refrigerantType: string;
  eventKind: FrigoraRefrigerantEventKind;
  quantityKg: number;
  reason: string | null;
  cylinderReference: string | null;
  occurredAt: string;
  handledByUserId: UserId;
  recordedByUserId: UserId;
  createdAt: string;
  updatedAt: string;
};

export type RecordRefrigerantEventInput = {
  refrigerantType: string;
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
  quantity: number;
  quantityUnit: FrigoraPartUsageUnit;
  notes: string | null;
  usedAt: string;
  usedByUserId: UserId;
  recordedByUserId: UserId;
  createdAt: string;
  updatedAt: string;
};

export type RecordPartUsageInput = {
  partDescription: string;
  quantity: number;
  quantityUnit: FrigoraPartUsageUnit;
  notes?: string | null;
  usedAt: string;
  usedByUserId: string;
  recordedByUserId: string;
  assetId?: string | null;
};
