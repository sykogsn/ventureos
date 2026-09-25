import type { Permission, PermissionService, StoredObjectId, UserId, VentureId, WorkspaceId } from "@/contracts";
import { createId, nowIso } from "@/platform/ids";
import { getPlatform } from "@/platform/kernel";
import { issueDomainAuthorizedMutation } from "@/platform/storage/domain-authority";
import { StoredObjectError } from "@/platform/storage/errors";
import { findStoredObjectById } from "@/platform/storage/metadata";
import { getPersistence } from "@/platform/persistence/repositories";
import { FrigoraError, FRIGORA_DISPATCH_CONFLICT_MESSAGE, isFrigoraError } from "./errors";
import {
  fingerprintFieldCaptureRequest,
  fingerprintTechnicalFindingRequest,
  fingerprintVisitEvidenceRequest,
  sha256HexOfBytes,
} from "./client-operation-fingerprint";
import { createFrigoraStore, type FrigoraStore } from "./store";
import type { AvailabilityMutationResult, EngineerUnavailability, UnavailabilityInput } from "./availability";
import { availabilityIdentitySchema, unavailabilitySchema } from "./validation";
import type {
  AssignWorkOrderInput,
  ClearWorkOrderAssignmentInput,
  ClearWorkOrderScheduleInput,
  DeclineWorkOrderAssignmentInput,
  CancelWorkOrderInput,
  CreateAssetInput,
  CreateCustomerInput,
  CreateSiteInput,
  CreateWorkOrderInput,
  FrigoraAsset,
  FrigoraAssetId,
  FrigoraCustomer,
  FrigoraCustomerId,
  FrigoraScope,
  FrigoraSite,
  FrigoraSiteId,
  FrigoraWorkOrder,
  FrigoraWorkOrderId,
  FrigoraWorkOrderStatus,
  FrigoraVisit,
  FrigoraVisitId,
  RecordVisitArrivalInput,
  RecordVisitDepartureInput,
  FrigoraFieldCapture,
  FrigoraFieldCaptureId,
  RecordFieldCaptureInput,
  FrigoraTechnicalFinding,
  FrigoraTechnicalFindingId,
  RecordTechnicalFindingInput,
  FrigoraClientOperationReceipt,
  FrigoraClientOperationReceiptId,
  SubmitClientTechnicalFindingInput,
  SubmitClientTechnicalFindingResult,
  SubmitClientFieldCaptureInput,
  SubmitClientFieldCaptureResult,
  SubmitClientVisitEvidenceInput,
  SubmitClientVisitEvidenceResult,
  LookupClientOperationAcceptanceInput,
  FrigoraClientOperationAcceptanceLookup,
  FrigoraCorrectiveAction,
  FrigoraCorrectiveActionId,
  RecordCorrectiveActionInput,
  FrigoraVisitOutcome,
  FrigoraVisitOutcomeId,
  RecordVisitOutcomeInput,
  FrigoraRecommendedAction,
  FrigoraRecommendedActionId,
  RecordRecommendedActionInput,
  FrigoraRefrigerantEvent,
  FrigoraRefrigerantEventId,
  RecordRefrigerantEventInput,
  FrigoraPartUsage,
  FrigoraPartUsageId,
  RecordPartUsageInput,
  FrigoraPartReference,
  FrigoraPartReferenceId,
  CreatePartReferenceInput,
  UpdatePartReferenceInput,
  FrigoraRefrigerantReference,
  FrigoraRefrigerantReferenceId,
  CreateRefrigerantReferenceInput,
  UpdateRefrigerantReferenceInput,
  FrigoraPartUsageUnit,
  FrigoraAssetOperationalCondition,
  FrigoraAssetOperationalConditionId,
  RecordAssetOperationalConditionInput,
  FrigoraVisitCustomerAcknowledgement,
  FrigoraVisitCustomerAcknowledgementId,
  RecordVisitCustomerAcknowledgementInput,
  FrigoraVisitEvidence,
  FrigoraVisitEvidenceId,
  RecordVisitEvidenceWithFileInput,
  LinkVisitEvidenceInput,
  ListScheduledWorkOrdersInput,
  ScheduleWorkOrderInput,
  FrigoraDispatchEvent,
  FrigoraDispatchEventId,
  FrigoraDispatchEventType,
  FrigoraAssetHistoryEntry,
  FrigoraAssetHistoryEventKind,
  UpdateAssetInput,
  UpdateCustomerInput,
  UpdateSiteInput,
  SetWorkOrderPriorityInput,
  UpdateWorkOrderInput,
  FrigoraVentureCommercialSettings,
  SetVentureLabourHourlyChargeInput,
  SetPartUsageUnitChargeInput,
  SetRefrigerantEventChargePerKgInput,
  SetVisitLabourHourlyChargeInput,
} from "./types";
import { FRIGORA_ASSET_HISTORY_EVENT_KINDS } from "./types";
import {
  computeWorkOrderTimeMaterials,
  type FrigoraTimeMaterialsSummary,
} from "./time-materials";
import {
  assignWorkOrderSchema,
  cancelWorkOrderSchema,
  clearWorkOrderAssignmentSchema,
  clearWorkOrderScheduleSchema,
  convertRecommendedActionSchema,
  createAssetSchema,
  createCustomerSchema,
  createSiteSchema,
  createWorkOrderSchema,
  declineWorkOrderAssignmentSchema,
  listScheduledWorkOrdersSchema,
  parseWithFrigora,
  recordVisitArrivalSchema,
  recordVisitDepartureSchema,
  recordFieldCaptureSchema,
  recordTechnicalFindingSchema,
  recordCorrectiveActionSchema,
  recordVisitOutcomeSchema,
  recordRecommendedActionSchema,
  recordRefrigerantEventSchema,
  recordPartUsageSchema,
  createPartReferenceSchema,
  updatePartReferenceSchema,
  createRefrigerantReferenceSchema,
  updateRefrigerantReferenceSchema,
  setVentureLabourHourlyChargeSchema,
  setPartUsageUnitChargeSchema,
  setRefrigerantEventChargePerKgSchema,
  setVisitLabourHourlyChargeSchema,
  canonicalizeRefrigerantCode,
  recordAssetOperationalConditionSchema,
  recordVisitCustomerAcknowledgementSchema,
  recordVisitEvidenceWithFileSchema,
  scheduleWorkOrderSchema,
  setWorkOrderPrioritySchema,
  linkVisitEvidenceSchema,
  updateAssetSchema,
  updateCustomerSchema,
  updateSiteSchema,
  updateWorkOrderSchema,
} from "./validation";

export type FrigoraService = {
  createUnavailability(scope: FrigoraScope, input: UnavailabilityInput): Promise<AvailabilityMutationResult>;
  updateUnavailability(scope: FrigoraScope, id: string, input: UnavailabilityInput & { expectedUpdatedAt: string }): Promise<AvailabilityMutationResult>;
  deleteUnavailability(scope: FrigoraScope, id: string, expectedUpdatedAt: string): Promise<AvailabilityMutationResult>;
  listUnavailability(scope: FrigoraScope, input: ListScheduledWorkOrdersInput): Promise<EngineerUnavailability[]>;
  createCustomer(scope: FrigoraScope, input: CreateCustomerInput): Promise<FrigoraCustomer>;
  updateCustomer(
    scope: FrigoraScope,
    id: FrigoraCustomerId,
    input: UpdateCustomerInput,
  ): Promise<FrigoraCustomer>;
  archiveCustomer(scope: FrigoraScope, id: FrigoraCustomerId): Promise<FrigoraCustomer>;
  getCustomer(scope: FrigoraScope, id: FrigoraCustomerId): Promise<FrigoraCustomer | null>;
  listCustomers(scope: FrigoraScope): Promise<FrigoraCustomer[]>;
  createSite(scope: FrigoraScope, input: CreateSiteInput): Promise<FrigoraSite>;
  updateSite(scope: FrigoraScope, id: FrigoraSiteId, input: UpdateSiteInput): Promise<FrigoraSite>;
  archiveSite(scope: FrigoraScope, id: FrigoraSiteId): Promise<FrigoraSite>;
  getSite(scope: FrigoraScope, id: FrigoraSiteId): Promise<FrigoraSite | null>;
  listSitesByCustomer(
    scope: FrigoraScope,
    customerId: FrigoraCustomerId,
  ): Promise<FrigoraSite[]>;
  createAsset(scope: FrigoraScope, input: CreateAssetInput): Promise<FrigoraAsset>;
  updateAsset(
    scope: FrigoraScope,
    id: FrigoraAssetId,
    input: UpdateAssetInput,
  ): Promise<FrigoraAsset>;
  decommissionAsset(scope: FrigoraScope, id: FrigoraAssetId): Promise<FrigoraAsset>;
  getAsset(scope: FrigoraScope, id: FrigoraAssetId): Promise<FrigoraAsset | null>;
  listAssetsBySite(scope: FrigoraScope, siteId: FrigoraSiteId): Promise<FrigoraAsset[]>;
  createWorkOrder(scope: FrigoraScope, input: CreateWorkOrderInput): Promise<FrigoraWorkOrder>;
  updateWorkOrder(
    scope: FrigoraScope,
    id: FrigoraWorkOrderId,
    input: UpdateWorkOrderInput,
  ): Promise<FrigoraWorkOrder>;
  setWorkOrderPriority(
    scope: FrigoraScope,
    id: FrigoraWorkOrderId,
    input: SetWorkOrderPriorityInput,
  ): Promise<FrigoraWorkOrder>;
  closeWorkOrder(scope: FrigoraScope, id: FrigoraWorkOrderId): Promise<FrigoraWorkOrder>;
  cancelWorkOrder(
    scope: FrigoraScope,
    id: FrigoraWorkOrderId,
    input: CancelWorkOrderInput,
  ): Promise<FrigoraWorkOrder>;
  reopenWorkOrder(scope: FrigoraScope, id: FrigoraWorkOrderId): Promise<FrigoraWorkOrder>;
  convertRecommendedActionToFollowUpWorkOrder(
    scope: FrigoraScope,
    recommendedActionId: FrigoraRecommendedActionId,
  ): Promise<FrigoraWorkOrder>;
  getFollowUpWorkOrderByRecommendedAction(
    scope: FrigoraScope,
    recommendedActionId: FrigoraRecommendedActionId,
  ): Promise<FrigoraWorkOrder | null>;
  getWorkOrder(
    scope: FrigoraScope,
    id: FrigoraWorkOrderId,
  ): Promise<FrigoraWorkOrder | null>;
  getWorkOrderByReference(
    scope: FrigoraScope,
    workReference: string,
  ): Promise<FrigoraWorkOrder | null>;
  listWorkOrders(
    scope: FrigoraScope,
    status?: FrigoraWorkOrderStatus,
  ): Promise<FrigoraWorkOrder[]>;
  listWorkOrdersByCustomer(
    scope: FrigoraScope,
    customerId: FrigoraCustomerId,
  ): Promise<FrigoraWorkOrder[]>;
  listWorkOrdersBySite(
    scope: FrigoraScope,
    siteId: FrigoraSiteId,
  ): Promise<FrigoraWorkOrder[]>;
  listWorkOrdersByAsset(
    scope: FrigoraScope,
    assetId: FrigoraAssetId,
  ): Promise<FrigoraWorkOrder[]>;
  assignWorkOrder(
    scope: FrigoraScope,
    id: FrigoraWorkOrderId,
    input: AssignWorkOrderInput,
  ): Promise<FrigoraWorkOrder>;
  clearWorkOrderAssignment(
    scope: FrigoraScope,
    id: FrigoraWorkOrderId,
    input: ClearWorkOrderAssignmentInput,
  ): Promise<FrigoraWorkOrder>;
  listWorkOrdersByAssignee(scope: FrigoraScope, userId: UserId): Promise<FrigoraWorkOrder[]>;
  scheduleWorkOrder(
    scope: FrigoraScope,
    id: FrigoraWorkOrderId,
    input: ScheduleWorkOrderInput,
  ): Promise<FrigoraWorkOrder>;
  clearWorkOrderSchedule(
    scope: FrigoraScope,
    id: FrigoraWorkOrderId,
    input: ClearWorkOrderScheduleInput,
  ): Promise<FrigoraWorkOrder>;
  acceptWorkOrderAssignment(
    scope: FrigoraScope,
    id: FrigoraWorkOrderId,
  ): Promise<FrigoraWorkOrder>;
  declineWorkOrderAssignment(
    scope: FrigoraScope,
    id: FrigoraWorkOrderId,
    input: DeclineWorkOrderAssignmentInput,
  ): Promise<FrigoraWorkOrder>;
  listScheduledWorkOrders(
    scope: FrigoraScope,
    input: ListScheduledWorkOrdersInput,
  ): Promise<FrigoraWorkOrder[]>;
  recordVisitArrival(
    scope: FrigoraScope,
    workOrderId: FrigoraWorkOrderId,
    input: RecordVisitArrivalInput,
  ): Promise<FrigoraVisit>;
  recordVisitDeparture(
    scope: FrigoraScope,
    id: FrigoraVisitId,
    input: RecordVisitDepartureInput,
  ): Promise<FrigoraVisit>;
  cancelVisit(scope: FrigoraScope, id: FrigoraVisitId): Promise<FrigoraVisit>;
  getVisit(scope: FrigoraScope, id: FrigoraVisitId): Promise<FrigoraVisit | null>;
  listVisitsByWorkOrder(
    scope: FrigoraScope,
    workOrderId: FrigoraWorkOrderId,
  ): Promise<FrigoraVisit[]>;
  listVisitsByAttendingUser(scope: FrigoraScope, userId: UserId): Promise<FrigoraVisit[]>;
  recordFieldCapture(
    scope: FrigoraScope,
    visitId: FrigoraVisitId,
    input: RecordFieldCaptureInput,
  ): Promise<FrigoraFieldCapture>;
  getFieldCapture(
    scope: FrigoraScope,
    id: FrigoraFieldCaptureId,
  ): Promise<FrigoraFieldCapture | null>;
  listFieldCapturesByVisit(
    scope: FrigoraScope,
    visitId: FrigoraVisitId,
  ): Promise<FrigoraFieldCapture[]>;
  listFieldCapturesByWorkOrder(
    scope: FrigoraScope,
    workOrderId: FrigoraWorkOrderId,
  ): Promise<FrigoraFieldCapture[]>;
  listFieldCapturesByAsset(
    scope: FrigoraScope,
    assetId: FrigoraAssetId,
  ): Promise<FrigoraFieldCapture[]>;
  recordTechnicalFinding(
    scope: FrigoraScope,
    visitId: FrigoraVisitId,
    input: RecordTechnicalFindingInput,
  ): Promise<FrigoraTechnicalFinding>;
  /**
   * F33-03: explicit online acceptance of a locally captured technical finding.
   * Idempotent on (ventureId, clientOperationId) with request fingerprint enforcement.
   */
  submitClientTechnicalFinding(
    scope: FrigoraScope,
    visitId: FrigoraVisitId,
    input: SubmitClientTechnicalFindingInput,
  ): Promise<SubmitClientTechnicalFindingResult>;
  /**
   * F33-04: explicit online acceptance of a locally captured field capture.
   * Idempotent on (ventureId, clientOperationId) with request fingerprint enforcement.
   */
  submitClientFieldCapture(
    scope: FrigoraScope,
    visitId: FrigoraVisitId,
    input: SubmitClientFieldCaptureInput,
  ): Promise<SubmitClientFieldCaptureResult>;
  /**
   * F33-04: explicit online acceptance of locally captured visit evidence bytes.
   * Idempotent on (ventureId, clientOperationId); identical replay must not create a second StoredObject.
   */
  submitClientVisitEvidence(
    scope: FrigoraScope,
    visitId: FrigoraVisitId,
    input: SubmitClientVisitEvidenceInput,
  ): Promise<SubmitClientVisitEvidenceResult>;
  /**
   * F33-05: read whether this engineer already has an authoritative acceptance
   * for a client operation. Does not submit, upload, or require current assignment.
   */
  lookupClientOperationAcceptance(
    scope: FrigoraScope,
    input: LookupClientOperationAcceptanceInput,
  ): Promise<FrigoraClientOperationAcceptanceLookup>;
  getTechnicalFinding(
    scope: FrigoraScope,
    id: FrigoraTechnicalFindingId,
  ): Promise<FrigoraTechnicalFinding | null>;
  listTechnicalFindingsByVisit(
    scope: FrigoraScope,
    visitId: FrigoraVisitId,
  ): Promise<FrigoraTechnicalFinding[]>;
  listTechnicalFindingsByWorkOrder(
    scope: FrigoraScope,
    workOrderId: FrigoraWorkOrderId,
  ): Promise<FrigoraTechnicalFinding[]>;
  listTechnicalFindingsByAsset(
    scope: FrigoraScope,
    assetId: FrigoraAssetId,
  ): Promise<FrigoraTechnicalFinding[]>;
  recordCorrectiveAction(
    scope: FrigoraScope,
    visitId: FrigoraVisitId,
    input: RecordCorrectiveActionInput,
  ): Promise<FrigoraCorrectiveAction>;
  getCorrectiveAction(
    scope: FrigoraScope,
    id: FrigoraCorrectiveActionId,
  ): Promise<FrigoraCorrectiveAction | null>;
  listCorrectiveActionsByVisit(
    scope: FrigoraScope,
    visitId: FrigoraVisitId,
  ): Promise<FrigoraCorrectiveAction[]>;
  listCorrectiveActionsByWorkOrder(
    scope: FrigoraScope,
    workOrderId: FrigoraWorkOrderId,
  ): Promise<FrigoraCorrectiveAction[]>;
  listCorrectiveActionsByAsset(
    scope: FrigoraScope,
    assetId: FrigoraAssetId,
  ): Promise<FrigoraCorrectiveAction[]>;
  recordVisitOutcome(
    scope: FrigoraScope,
    visitId: FrigoraVisitId,
    input: RecordVisitOutcomeInput,
  ): Promise<FrigoraVisitOutcome>;
  getVisitOutcome(
    scope: FrigoraScope,
    id: FrigoraVisitOutcomeId,
  ): Promise<FrigoraVisitOutcome | null>;
  getVisitOutcomeByVisit(
    scope: FrigoraScope,
    visitId: FrigoraVisitId,
  ): Promise<FrigoraVisitOutcome | null>;
  listVisitOutcomesByWorkOrder(
    scope: FrigoraScope,
    workOrderId: FrigoraWorkOrderId,
  ): Promise<FrigoraVisitOutcome[]>;
  listVisitOutcomesByAsset(
    scope: FrigoraScope,
    assetId: FrigoraAssetId,
  ): Promise<FrigoraVisitOutcome[]>;
  recordRecommendedAction(
    scope: FrigoraScope,
    visitId: FrigoraVisitId,
    input: RecordRecommendedActionInput,
  ): Promise<FrigoraRecommendedAction>;
  getRecommendedAction(
    scope: FrigoraScope,
    id: FrigoraRecommendedActionId,
  ): Promise<FrigoraRecommendedAction | null>;
  listRecommendedActionsByVisit(
    scope: FrigoraScope,
    visitId: FrigoraVisitId,
  ): Promise<FrigoraRecommendedAction[]>;
  listRecommendedActionsByWorkOrder(
    scope: FrigoraScope,
    workOrderId: FrigoraWorkOrderId,
  ): Promise<FrigoraRecommendedAction[]>;
  listRecommendedActionsByAsset(
    scope: FrigoraScope,
    assetId: FrigoraAssetId,
  ): Promise<FrigoraRecommendedAction[]>;
  recordRefrigerantEvent(
    scope: FrigoraScope,
    visitId: FrigoraVisitId,
    input: RecordRefrigerantEventInput,
  ): Promise<FrigoraRefrigerantEvent>;
  getRefrigerantEvent(
    scope: FrigoraScope,
    id: FrigoraRefrigerantEventId,
  ): Promise<FrigoraRefrigerantEvent | null>;
  listRefrigerantEventsByVisit(
    scope: FrigoraScope,
    visitId: FrigoraVisitId,
  ): Promise<FrigoraRefrigerantEvent[]>;
  listRefrigerantEventsByWorkOrder(
    scope: FrigoraScope,
    workOrderId: FrigoraWorkOrderId,
  ): Promise<FrigoraRefrigerantEvent[]>;
  listRefrigerantEventsByAsset(
    scope: FrigoraScope,
    assetId: FrigoraAssetId,
  ): Promise<FrigoraRefrigerantEvent[]>;
  recordPartUsage(
    scope: FrigoraScope,
    visitId: FrigoraVisitId,
    input: RecordPartUsageInput,
  ): Promise<FrigoraPartUsage>;
  getPartUsage(
    scope: FrigoraScope,
    id: FrigoraPartUsageId,
  ): Promise<FrigoraPartUsage | null>;
  listPartUsagesByVisit(
    scope: FrigoraScope,
    visitId: FrigoraVisitId,
  ): Promise<FrigoraPartUsage[]>;
  listPartUsagesByWorkOrder(
    scope: FrigoraScope,
    workOrderId: FrigoraWorkOrderId,
  ): Promise<FrigoraPartUsage[]>;
  listPartUsagesByAsset(
    scope: FrigoraScope,
    assetId: FrigoraAssetId,
  ): Promise<FrigoraPartUsage[]>;
  createPartReference(
    scope: FrigoraScope,
    input: CreatePartReferenceInput,
  ): Promise<FrigoraPartReference>;
  updatePartReference(
    scope: FrigoraScope,
    id: FrigoraPartReferenceId,
    input: UpdatePartReferenceInput,
  ): Promise<FrigoraPartReference>;
  retirePartReference(
    scope: FrigoraScope,
    id: FrigoraPartReferenceId,
  ): Promise<FrigoraPartReference>;
  getPartReference(
    scope: FrigoraScope,
    id: FrigoraPartReferenceId,
  ): Promise<FrigoraPartReference | null>;
  listPartReferences(scope: FrigoraScope): Promise<FrigoraPartReference[]>;
  listActivePartReferences(scope: FrigoraScope): Promise<FrigoraPartReference[]>;
  createRefrigerantReference(
    scope: FrigoraScope,
    input: CreateRefrigerantReferenceInput,
  ): Promise<FrigoraRefrigerantReference>;
  updateRefrigerantReference(
    scope: FrigoraScope,
    id: FrigoraRefrigerantReferenceId,
    input: UpdateRefrigerantReferenceInput,
  ): Promise<FrigoraRefrigerantReference>;
  retireRefrigerantReference(
    scope: FrigoraScope,
    id: FrigoraRefrigerantReferenceId,
  ): Promise<FrigoraRefrigerantReference>;
  getRefrigerantReference(
    scope: FrigoraScope,
    id: FrigoraRefrigerantReferenceId,
  ): Promise<FrigoraRefrigerantReference | null>;
  listRefrigerantReferences(scope: FrigoraScope): Promise<FrigoraRefrigerantReference[]>;
  listActiveRefrigerantReferences(scope: FrigoraScope): Promise<FrigoraRefrigerantReference[]>;
  getVentureCommercialSettings(
    scope: FrigoraScope,
  ): Promise<FrigoraVentureCommercialSettings | null>;
  setVentureLabourHourlyCharge(
    scope: FrigoraScope,
    input: SetVentureLabourHourlyChargeInput,
  ): Promise<FrigoraVentureCommercialSettings>;
  setPartUsageUnitCharge(
    scope: FrigoraScope,
    partUsageId: FrigoraPartUsageId,
    input: SetPartUsageUnitChargeInput,
  ): Promise<FrigoraPartUsage>;
  setRefrigerantEventChargePerKg(
    scope: FrigoraScope,
    eventId: FrigoraRefrigerantEventId,
    input: SetRefrigerantEventChargePerKgInput,
  ): Promise<FrigoraRefrigerantEvent>;
  setVisitLabourHourlyCharge(
    scope: FrigoraScope,
    visitId: FrigoraVisitId,
    input: SetVisitLabourHourlyChargeInput,
  ): Promise<FrigoraVisit>;
  getWorkOrderTimeMaterials(
    scope: FrigoraScope,
    workOrderId: FrigoraWorkOrderId,
  ): Promise<FrigoraTimeMaterialsSummary>;
  recordAssetOperationalCondition(
    scope: FrigoraScope,
    input: RecordAssetOperationalConditionInput,
  ): Promise<FrigoraAssetOperationalCondition>;
  getAssetOperationalCondition(
    scope: FrigoraScope,
    id: FrigoraAssetOperationalConditionId,
  ): Promise<FrigoraAssetOperationalCondition | null>;
  listAssetOperationalConditionsByAsset(
    scope: FrigoraScope,
    assetId: FrigoraAssetId,
  ): Promise<FrigoraAssetOperationalCondition[]>;
  getCurrentAssetOperationalCondition(
    scope: FrigoraScope,
    assetId: FrigoraAssetId,
  ): Promise<FrigoraAssetOperationalCondition | null>;
  recordVisitCustomerAcknowledgement(
    scope: FrigoraScope,
    visitId: FrigoraVisitId,
    input: RecordVisitCustomerAcknowledgementInput,
  ): Promise<FrigoraVisitCustomerAcknowledgement>;
  getVisitCustomerAcknowledgement(
    scope: FrigoraScope,
    id: FrigoraVisitCustomerAcknowledgementId,
  ): Promise<FrigoraVisitCustomerAcknowledgement | null>;
  listVisitCustomerAcknowledgementsByVisit(
    scope: FrigoraScope,
    visitId: FrigoraVisitId,
  ): Promise<FrigoraVisitCustomerAcknowledgement[]>;
  listVisitCustomerAcknowledgementsByWorkOrder(
    scope: FrigoraScope,
    workOrderId: FrigoraWorkOrderId,
  ): Promise<FrigoraVisitCustomerAcknowledgement[]>;
  recordVisitEvidenceWithFile(
    scope: FrigoraScope,
    visitId: FrigoraVisitId,
    input: RecordVisitEvidenceWithFileInput,
  ): Promise<FrigoraVisitEvidence>;
  linkVisitEvidence(
    scope: FrigoraScope,
    visitId: FrigoraVisitId,
    input: LinkVisitEvidenceInput,
  ): Promise<FrigoraVisitEvidence>;
  getVisitEvidence(
    scope: FrigoraScope,
    id: FrigoraVisitEvidenceId,
  ): Promise<FrigoraVisitEvidence | null>;
  listVisitEvidenceByVisit(
    scope: FrigoraScope,
    visitId: FrigoraVisitId,
  ): Promise<FrigoraVisitEvidence[]>;
  listVisitEvidenceByWorkOrder(
    scope: FrigoraScope,
    workOrderId: FrigoraWorkOrderId,
  ): Promise<FrigoraVisitEvidence[]>;
  removeVisitEvidence(
    scope: FrigoraScope,
    id: FrigoraVisitEvidenceId,
  ): Promise<FrigoraVisitEvidence>;
  listAssetHistory(
    scope: FrigoraScope,
    assetId: FrigoraAssetId,
  ): Promise<FrigoraAssetHistoryEntry[]>;
};

export function createFrigoraService(options: {
  store?: FrigoraStore;
  permissions?: PermissionService;
} = {}): FrigoraService {
  const store = options.store ?? createFrigoraStore();
  const permissions = options.permissions;

  async function permissionService(): Promise<PermissionService> {
    return permissions ?? getPlatform().permissions;
  }
  async function saveUnavailability(scope: FrigoraScope, input: UnavailabilityInput, identity?: { id: string; expectedUpdatedAt: string }) {
    await assertFrigoraAccess(await permissionService(), scope, "venture.update");
    const parsed = parseWithFrigora(unavailabilitySchema, input);
    const version = identity ? parseWithFrigora(availabilityIdentitySchema, identity) : undefined;
    await requireWorkspaceMember(scope.workspaceId, parsed.userId as UserId);
    const now = nowIso();
    const id = version?.id ?? createId();
    return store.mutateUnavailability({ scope, id, expectedUpdatedAt: version?.expectedUpdatedAt,
      next: { ...parsed, id, workspaceId: scope.workspaceId, ventureId: scope.ventureId,
        userId: parsed.userId as UserId, createdByUserId: scope.userId, createdAt: now, updatedAt: now } });
  }
  return {
    createUnavailability: (scope, input) => saveUnavailability(scope, input),
    updateUnavailability: (scope, id, input) => saveUnavailability(scope, input, { id, expectedUpdatedAt: input.expectedUpdatedAt }),
    async deleteUnavailability(scope, id, expectedUpdatedAt) {
      await assertFrigoraAccess(await permissionService(), scope, "venture.update");
      const parsed = parseWithFrigora(availabilityIdentitySchema, { id, expectedUpdatedAt });
      return store.mutateUnavailability({ scope, ...parsed, next: null });
    },
    async listUnavailability(scope, input) {
      await assertFrigoraAccess(await permissionService(), scope, "venture.read");
      const parsed = parseWithFrigora(listScheduledWorkOrdersSchema, input);
      return store.listUnavailability(scope, parsed.rangeStart, parsed.rangeEnd);
    },
    async createCustomer(scope, input) {
      await assertFrigoraAccess(await permissionService(), scope, "venture.update");
      const parsed = parseWithFrigora(createCustomerSchema, input);
      await assertUniqueCustomerCode(store, scope, parsed.code);
      const now = nowIso();
      const row: FrigoraCustomer = {
        id: createId<FrigoraCustomerId>(),
        workspaceId: scope.workspaceId,
        ventureId: scope.ventureId,
        code: parsed.code,
        displayName: parsed.displayName,
        legalName: parsed.legalName ?? null,
        status: "active",
        notes: parsed.notes ?? null,
        createdAt: now,
        updatedAt: now,
      };
      await store.insertCustomer(row);
      return row;
    },
    async updateCustomer(scope, id, input) {
      await assertFrigoraAccess(await permissionService(), scope, "venture.update");
      const existing = await requireCustomer(store, scope, id);
      const parsed = parseWithFrigora(updateCustomerSchema, input);
      const next: FrigoraCustomer = {
        ...existing,
        code: parsed.code ?? existing.code,
        displayName: parsed.displayName ?? existing.displayName,
        legalName: parsed.legalName !== undefined ? parsed.legalName : existing.legalName,
        notes: parsed.notes !== undefined ? parsed.notes : existing.notes,
        updatedAt: nowIso(),
      };
      if (next.code !== existing.code) {
        await assertUniqueCustomerCode(store, scope, next.code, existing.id);
      }
      await store.updateCustomer(next);
      return next;
    },
    async archiveCustomer(scope, id) {
      await assertFrigoraAccess(await permissionService(), scope, "venture.update");
      const existing = await requireCustomer(store, scope, id);
      if (existing.status === "archived") {
        return existing;
      }
      const next: FrigoraCustomer = {
        ...existing,
        status: "archived",
        updatedAt: nowIso(),
      };
      await store.updateCustomer(next);
      return next;
    },
    async getCustomer(scope, id) {
      if (!(await allowFrigoraRead(await permissionService(), scope))) {
        return null;
      }
      return store.findCustomer(scope.workspaceId, scope.ventureId, id);
    },
    async listCustomers(scope) {
      if (!(await allowFrigoraRead(await permissionService(), scope))) {
        return [];
      }
      return store.listCustomers(scope.workspaceId, scope.ventureId);
    },
    async createSite(scope, input) {
      await assertFrigoraAccess(await permissionService(), scope, "venture.update");
      const parsed = parseWithFrigora(createSiteSchema, input);
      const customer = await requireCustomer(
        store,
        scope,
        parsed.customerId as FrigoraCustomerId,
      );
      if (customer.status !== "active") {
        throw new FrigoraError(
          "archived_parent",
          "Archived customers cannot receive new sites.",
        );
      }
      await assertUniqueSiteCode(store, scope, customer.id, parsed.code);
      const now = nowIso();
      const row: FrigoraSite = {
        id: createId<FrigoraSiteId>(),
        workspaceId: customer.workspaceId,
        ventureId: customer.ventureId,
        customerId: customer.id,
        code: parsed.code,
        name: parsed.name,
        addressLine1: parsed.addressLine1 ?? null,
        addressLine2: parsed.addressLine2 ?? null,
        city: parsed.city ?? null,
        region: parsed.region ?? null,
        postalCode: parsed.postalCode ?? null,
        country: parsed.country ?? null,
        status: "active",
        notes: parsed.notes ?? null,
        createdAt: now,
        updatedAt: now,
      };
      await store.insertSite(row);
      return row;
    },
    async updateSite(scope, id, input) {
      await assertFrigoraAccess(await permissionService(), scope, "venture.update");
      const existing = await requireSite(store, scope, id);
      const parsed = parseWithFrigora(updateSiteSchema, input);
      const next: FrigoraSite = {
        ...existing,
        code: parsed.code ?? existing.code,
        name: parsed.name ?? existing.name,
        addressLine1:
          parsed.addressLine1 !== undefined ? parsed.addressLine1 : existing.addressLine1,
        addressLine2:
          parsed.addressLine2 !== undefined ? parsed.addressLine2 : existing.addressLine2,
        city: parsed.city !== undefined ? parsed.city : existing.city,
        region: parsed.region !== undefined ? parsed.region : existing.region,
        postalCode: parsed.postalCode !== undefined ? parsed.postalCode : existing.postalCode,
        country: parsed.country !== undefined ? parsed.country : existing.country,
        notes: parsed.notes !== undefined ? parsed.notes : existing.notes,
        updatedAt: nowIso(),
      };
      if (next.code !== existing.code) {
        await assertUniqueSiteCode(store, scope, existing.customerId, next.code, existing.id);
      }
      await store.updateSite(next);
      return next;
    },
    async archiveSite(scope, id) {
      await assertFrigoraAccess(await permissionService(), scope, "venture.update");
      const existing = await requireSite(store, scope, id);
      if (existing.status === "archived") {
        return existing;
      }
      const next: FrigoraSite = {
        ...existing,
        status: "archived",
        updatedAt: nowIso(),
      };
      await store.updateSite(next);
      return next;
    },
    async getSite(scope, id) {
      if (!(await allowFrigoraRead(await permissionService(), scope))) {
        return null;
      }
      return store.findSite(scope.workspaceId, scope.ventureId, id);
    },
    async listSitesByCustomer(scope, customerId) {
      if (!(await allowFrigoraRead(await permissionService(), scope))) {
        return [];
      }
      const customer = await store.findCustomer(
        scope.workspaceId,
        scope.ventureId,
        customerId,
      );
      if (!customer) {
        return [];
      }
      return store.listSitesByCustomer(scope.workspaceId, scope.ventureId, customerId);
    },
    async createAsset(scope, input) {
      await assertFrigoraAccess(await permissionService(), scope, "venture.update");
      const parsed = parseWithFrigora(createAssetSchema, input);
      const site = await requireSite(store, scope, parsed.siteId as FrigoraSiteId);
      if (site.status !== "active") {
        throw new FrigoraError(
          "archived_parent",
          "Archived sites cannot receive new assets.",
        );
      }
      await assertUniqueAssetTag(store, scope, site.id, parsed.tag);
      if (parsed.serialNumber) {
        await assertUniqueSerial(store, scope, parsed.serialNumber);
      }
      const now = nowIso();
      const row: FrigoraAsset = {
        id: createId<FrigoraAssetId>(),
        workspaceId: site.workspaceId,
        ventureId: site.ventureId,
        siteId: site.id,
        tag: parsed.tag,
        name: parsed.name ?? null,
        assetKind: parsed.assetKind ?? null,
        manufacturer: parsed.manufacturer ?? null,
        model: parsed.model ?? null,
        serialNumber: parsed.serialNumber ?? null,
        status: "active",
        designTargetCelsius: parsed.designTargetCelsius ?? null,
        refrigerantType: parsed.refrigerantType ?? null,
        locationOnSite: parsed.locationOnSite ?? null,
        installedOn: parsed.installedOn ?? null,
        commissionedOn: parsed.commissionedOn ?? null,
        notes: parsed.notes ?? null,
        createdAt: now,
        updatedAt: now,
      };
      await store.insertAsset(row);
      return row;
    },
    async updateAsset(scope, id, input) {
      await assertFrigoraAccess(await permissionService(), scope, "venture.update");
      const existing = await requireAsset(store, scope, id);
      const parsed = parseWithFrigora(updateAssetSchema, input);
      let siteId = existing.siteId;
      let workspaceId = existing.workspaceId;
      let ventureId = existing.ventureId;
      if (parsed.siteId && parsed.siteId !== existing.siteId) {
        const destination = await requireSite(store, scope, parsed.siteId as FrigoraSiteId);
        if (destination.status !== "active") {
          throw new FrigoraError(
            "archived_parent",
            "Assets cannot move to an archived site.",
          );
        }
        siteId = destination.id;
        workspaceId = destination.workspaceId;
        ventureId = destination.ventureId;
      }
      const next: FrigoraAsset = {
        ...existing,
        workspaceId,
        ventureId,
        siteId,
        tag: parsed.tag ?? existing.tag,
        name: parsed.name !== undefined ? parsed.name : existing.name,
        assetKind: parsed.assetKind !== undefined ? parsed.assetKind : existing.assetKind,
        manufacturer:
          parsed.manufacturer !== undefined ? parsed.manufacturer : existing.manufacturer,
        model: parsed.model !== undefined ? parsed.model : existing.model,
        serialNumber:
          parsed.serialNumber !== undefined ? parsed.serialNumber : existing.serialNumber,
        designTargetCelsius:
          parsed.designTargetCelsius !== undefined
            ? parsed.designTargetCelsius
            : existing.designTargetCelsius,
        refrigerantType:
          parsed.refrigerantType !== undefined
            ? parsed.refrigerantType
            : existing.refrigerantType,
        locationOnSite:
          parsed.locationOnSite !== undefined ? parsed.locationOnSite : existing.locationOnSite,
        installedOn:
          parsed.installedOn !== undefined ? parsed.installedOn : existing.installedOn,
        commissionedOn:
          parsed.commissionedOn !== undefined ? parsed.commissionedOn : existing.commissionedOn,
        notes: parsed.notes !== undefined ? parsed.notes : existing.notes,
        updatedAt: nowIso(),
      };
      if (next.tag !== existing.tag || next.siteId !== existing.siteId) {
        await assertUniqueAssetTag(store, scope, next.siteId, next.tag, existing.id);
      }
      if (next.serialNumber && next.serialNumber !== existing.serialNumber) {
        await assertUniqueSerial(store, scope, next.serialNumber, existing.id);
      }
      await store.updateAsset(next);
      return next;
    },
    async decommissionAsset(scope, id) {
      await assertFrigoraAccess(await permissionService(), scope, "venture.update");
      const existing = await requireAsset(store, scope, id);
      if (existing.status === "decommissioned") {
        return existing;
      }
      const next: FrigoraAsset = {
        ...existing,
        status: "decommissioned",
        updatedAt: nowIso(),
      };
      await store.updateAsset(next);
      return next;
    },
    async getAsset(scope, id) {
      if (!(await allowFrigoraRead(await permissionService(), scope))) {
        return null;
      }
      return store.findAsset(scope.workspaceId, scope.ventureId, id);
    },
    async listAssetsBySite(scope, siteId) {
      if (!(await allowFrigoraRead(await permissionService(), scope))) {
        return [];
      }
      const site = await store.findSite(scope.workspaceId, scope.ventureId, siteId);
      if (!site) {
        return [];
      }
      return store.listAssetsBySite(scope.workspaceId, scope.ventureId, siteId);
    },
    async createWorkOrder(scope, input) {
      await assertFrigoraAccess(await permissionService(), scope, "venture.update");
      const parsed = parseWithFrigora(createWorkOrderSchema, input, true);
      const site = await requireSite(store, scope, parsed.siteId as FrigoraSiteId);
      await assertSiteAcceptsWorkOrder(store, scope, site);
      const primaryAssetId = await resolvePrimaryAssetAssociation(
        store,
        scope,
        site.id,
        parsed.primaryAssetId === undefined ? null : parsed.primaryAssetId,
      );
      const now = nowIso();
      const row: FrigoraWorkOrder = {
        id: createId<FrigoraWorkOrderId>(),
        workspaceId: site.workspaceId,
        ventureId: site.ventureId,
        customerId: site.customerId,
        siteId: site.id,
        primaryAssetId,
        workReference: parsed.workReference,
        workKind: parsed.workKind,
        priority: "normal",
        reportedCondition: parsed.reportedCondition ?? null,
        status: "open",
        assignedUserId: null,
        scheduledStartAt: null,
        scheduledEndAt: null,
        assignmentAcceptedAt: null,
        assignmentDeclinedAt: null,
        assignmentDeclineReason: null,
        cancellationReason: null,
        sourceRecommendedActionId: null,
        createdAt: now,
        updatedAt: now,
      };
      await store.insertWorkOrder(row);
      return row;
    },
    async updateWorkOrder(scope, id, input) {
      await assertFrigoraAccess(await permissionService(), scope, "venture.update");
      const existing = await requireOpenWorkOrder(store, scope, id);
      const parsed = parseWithFrigora(updateWorkOrderSchema, input, true);
      let primaryAssetId = existing.primaryAssetId;
      if (parsed.primaryAssetId !== undefined) {
        primaryAssetId = await resolvePrimaryAssetAssociation(
          store,
          scope,
          existing.siteId,
          parsed.primaryAssetId,
        );
      }
      const next: FrigoraWorkOrder = {
        ...existing,
        workKind: parsed.workKind ?? existing.workKind,
        reportedCondition:
          parsed.reportedCondition !== undefined
            ? parsed.reportedCondition
            : existing.reportedCondition,
        primaryAssetId,
        updatedAt: nowIso(),
      };
      await store.updateWorkOrder(next);
      return next;
    },
    async setWorkOrderPriority(scope, id, input) {
      await assertFrigoraAccess(await permissionService(), scope, "venture.update");
      const existing = await requireOpenWorkOrder(store, scope, id);
      const parsed = parseWithFrigora(setWorkOrderPrioritySchema, input);
      assertExpectedDispatchToken(existing, parsed.expectedUpdatedAt);
      await assertWorkOrderHasNoOpenVisit(store, scope, existing.id);
      if (existing.priority === parsed.priority) {
        return existing;
      }
      const next: FrigoraWorkOrder = {
        ...existing,
        priority: parsed.priority,
        updatedAt: nowIso(),
      };
      await store.compareAndSetWorkOrderPriority(existing, next);
      return next;
    },
    async closeWorkOrder(scope, id) {
      await assertFrigoraAccess(await permissionService(), scope, "venture.update");
      const existing = await requireWorkOrder(store, scope, id);
      if (existing.status === "closed") {
        return existing;
      }
      if (existing.status !== "open") {
        throw new FrigoraError(
          "invalid_status",
          "Only open work orders can be closed.",
        );
      }
      await assertWorkOrderMayComplete(store, scope, existing.id);
      const next: FrigoraWorkOrder = {
        ...existing,
        status: "closed",
        updatedAt: nowIso(),
      };
      await store.updateWorkOrder(next);
      return next;
    },
    async cancelWorkOrder(scope, id, input) {
      await assertFrigoraAccess(await permissionService(), scope, "venture.update");
      const existing = await requireWorkOrder(store, scope, id);
      if (existing.status === "cancelled") {
        return existing;
      }
      if (existing.status !== "open") {
        throw new FrigoraError(
          "invalid_status",
          "Only open work orders can be cancelled.",
        );
      }
      const parsed = parseWithFrigora(cancelWorkOrderSchema, input);
      await assertWorkOrderHasNoOpenVisit(store, scope, existing.id);
      const next: FrigoraWorkOrder = {
        ...existing,
        status: "cancelled",
        cancellationReason: parsed.reason,
        updatedAt: nowIso(),
      };
      await store.updateWorkOrder(next);
      return next;
    },
    async reopenWorkOrder(scope, id) {
      await assertFrigoraAccess(await permissionService(), scope, "venture.update");
      const existing = await requireWorkOrder(store, scope, id);
      if (existing.status === "open") {
        return existing;
      }
      if (existing.status !== "closed") {
        throw new FrigoraError(
          "invalid_status",
          "Only closed work orders can be reopened.",
        );
      }
      const next: FrigoraWorkOrder = {
        ...existing,
        status: "open",
        updatedAt: nowIso(),
      };
      await store.updateWorkOrder(next);
      return next;
    },
    async convertRecommendedActionToFollowUpWorkOrder(scope, recommendedActionId) {
      await assertFrigoraAccess(await permissionService(), scope, "venture.update");
      const parsed = parseWithFrigora(convertRecommendedActionSchema, {
        recommendedActionId,
      });
      const recommendation = await store.findRecommendedAction(
        scope.workspaceId,
        scope.ventureId,
        parsed.recommendedActionId as FrigoraRecommendedActionId,
      );
      if (!recommendation) {
        throw new FrigoraError("not_found", "Recommended action was not found.");
      }
      const existingFollowUp = await store.findWorkOrderBySourceRecommendedActionId(
        scope.workspaceId,
        scope.ventureId,
        recommendation.id,
      );
      if (existingFollowUp) {
        throw new FrigoraError(
          "duplicate",
          "This recommended action already has a follow-up work order.",
        );
      }
      const sourceWorkOrder = await requireWorkOrder(store, scope, recommendation.workOrderId);
      const site = await requireSite(store, scope, sourceWorkOrder.siteId);
      await assertSiteAcceptsWorkOrder(store, scope, site);
      let primaryAssetId = sourceWorkOrder.primaryAssetId;
      if (recommendation.assetId) {
        const recommendedAsset = await store.findAsset(
          scope.workspaceId,
          scope.ventureId,
          recommendation.assetId,
        );
        if (recommendedAsset && recommendedAsset.siteId === sourceWorkOrder.siteId) {
          primaryAssetId = recommendedAsset.id;
        }
      }
      const now = nowIso();
      const row: FrigoraWorkOrder = {
        id: createId<FrigoraWorkOrderId>(),
        workspaceId: sourceWorkOrder.workspaceId,
        ventureId: sourceWorkOrder.ventureId,
        customerId: sourceWorkOrder.customerId,
        siteId: sourceWorkOrder.siteId,
        primaryAssetId,
        workReference: `FUP-${recommendation.id}`,
        workKind: "reactive",
        priority: "normal",
        reportedCondition: recommendation.description,
        status: "open",
        assignedUserId: null,
        scheduledStartAt: null,
        scheduledEndAt: null,
        assignmentAcceptedAt: null,
        assignmentDeclinedAt: null,
        assignmentDeclineReason: null,
        cancellationReason: null,
        sourceRecommendedActionId: recommendation.id,
        createdAt: now,
        updatedAt: now,
      };
      await store.insertWorkOrder(row);
      return row;
    },
    async getFollowUpWorkOrderByRecommendedAction(scope, recommendedActionId) {
      if (!(await allowFrigoraRead(await permissionService(), scope))) {
        return null;
      }
      return store.findWorkOrderBySourceRecommendedActionId(
        scope.workspaceId,
        scope.ventureId,
        recommendedActionId,
      );
    },
    async getWorkOrder(scope, id) {
      if (!(await allowFrigoraRead(await permissionService(), scope))) {
        return null;
      }
      return store.findWorkOrder(scope.workspaceId, scope.ventureId, id);
    },
    async getWorkOrderByReference(scope, workReference) {
      if (!(await allowFrigoraRead(await permissionService(), scope))) {
        return null;
      }
      const trimmed = workReference.trim();
      if (!trimmed) {
        return null;
      }
      return store.findWorkOrderByReference(
        scope.workspaceId,
        scope.ventureId,
        trimmed,
      );
    },
    async listWorkOrders(scope, status) {
      if (!(await allowFrigoraRead(await permissionService(), scope))) {
        return [];
      }
      return store.listWorkOrders(scope.workspaceId, scope.ventureId, status);
    },
    async listWorkOrdersByCustomer(scope, customerId) {
      if (!(await allowFrigoraRead(await permissionService(), scope))) {
        return [];
      }
      const customer = await store.findCustomer(
        scope.workspaceId,
        scope.ventureId,
        customerId,
      );
      if (!customer) {
        return [];
      }
      return store.listWorkOrdersByCustomer(
        scope.workspaceId,
        scope.ventureId,
        customerId,
      );
    },
    async listWorkOrdersBySite(scope, siteId) {
      if (!(await allowFrigoraRead(await permissionService(), scope))) {
        return [];
      }
      const site = await store.findSite(scope.workspaceId, scope.ventureId, siteId);
      if (!site) {
        return [];
      }
      return store.listWorkOrdersBySite(scope.workspaceId, scope.ventureId, siteId);
    },
    async listWorkOrdersByAsset(scope, assetId) {
      if (!(await allowFrigoraRead(await permissionService(), scope))) {
        return [];
      }
      const asset = await store.findAsset(scope.workspaceId, scope.ventureId, assetId);
      if (!asset) {
        return [];
      }
      return store.listWorkOrdersByAsset(scope.workspaceId, scope.ventureId, assetId);
    },
    async assignWorkOrder(scope, id, input) {
      await assertFrigoraAccess(await permissionService(), scope, "venture.update");
      const existing = await requireOpenWorkOrder(store, scope, id);
      const parsed = parseWithFrigora(assignWorkOrderSchema, input);
      assertExpectedDispatchToken(existing, parsed.expectedUpdatedAt);
      const assigneeId = parsed.userId as UserId;
      await requireWorkspaceMember(scope.workspaceId, assigneeId);

      const stampsClear = responseStampsAreClear(existing);
      if (existing.assignedUserId === assigneeId && stampsClear) {
        await store.applyGuardedDispatchMutation({ expected: existing, next: null, event: null });
        return existing;
      }

      const occurredAt = nowIso();
      const next: FrigoraWorkOrder = {
        ...existing,
        assignedUserId: assigneeId,
        assignmentAcceptedAt: null,
        assignmentDeclinedAt: null,
        assignmentDeclineReason: null,
        updatedAt: occurredAt,
      };

      const event =
        existing.assignedUserId === assigneeId
          ? null
          : buildDispatchEvent({
              workOrder: existing,
              actorUserId: scope.userId,
              eventType: existing.assignedUserId === null ? "ASSIGNED" : "REASSIGNED",
              occurredAt,
              previousAssignedUserId: existing.assignedUserId,
              nextAssignedUserId: assigneeId,
              previousScheduledStartAt: existing.scheduledStartAt,
              previousScheduledEndAt: existing.scheduledEndAt,
              nextScheduledStartAt: existing.scheduledStartAt,
              nextScheduledEndAt: existing.scheduledEndAt,
            });

      await store.applyGuardedDispatchMutation({ expected: existing, next, event, confirmDoubleBooking: parsed.confirmDoubleBooking });
      return next;
    },
    async clearWorkOrderAssignment(scope, id, input) {
      await assertFrigoraAccess(await permissionService(), scope, "venture.update");
      const existing = await requireOpenWorkOrder(store, scope, id);
      const parsed = parseWithFrigora(clearWorkOrderAssignmentSchema, input);
      assertExpectedDispatchToken(existing, parsed.expectedUpdatedAt);

      if (existing.assignedUserId === null && responseStampsAreClear(existing)) {
        await store.applyGuardedDispatchMutation({ expected: existing, next: null, event: null });
        return existing;
      }

      const occurredAt = nowIso();
      const next: FrigoraWorkOrder = {
        ...existing,
        assignedUserId: null,
        assignmentAcceptedAt: null,
        assignmentDeclinedAt: null,
        assignmentDeclineReason: null,
        updatedAt: occurredAt,
      };

      const event =
        existing.assignedUserId === null
          ? null
          : buildDispatchEvent({
              workOrder: existing,
              actorUserId: scope.userId,
              eventType: "UNASSIGNED",
              occurredAt,
              previousAssignedUserId: existing.assignedUserId,
              nextAssignedUserId: null,
              previousScheduledStartAt: existing.scheduledStartAt,
              previousScheduledEndAt: existing.scheduledEndAt,
              nextScheduledStartAt: existing.scheduledStartAt,
              nextScheduledEndAt: existing.scheduledEndAt,
            });

      await store.applyGuardedDispatchMutation({ expected: existing, next, event });
      return next;
    },
    async listWorkOrdersByAssignee(scope, userId) {
      if (!(await allowFrigoraRead(await permissionService(), scope))) {
        return [];
      }
      const permissions = await permissionService();
      const hasHigherAuthority = await permissions.can({
        userId: scope.userId,
        permission: "venture.update",
        resource: { type: "workspace", id: scope.workspaceId },
      });
      if (!hasHigherAuthority && scope.userId !== userId) {
        return [];
      }
      const member = await getPersistence().memberships.getRole(userId, scope.workspaceId);
      if (!member) {
        return [];
      }
      return store.listWorkOrdersByAssignee(
        scope.workspaceId,
        scope.ventureId,
        userId,
      );
    },
    async scheduleWorkOrder(scope, id, input) {
      await assertFrigoraAccess(await permissionService(), scope, "venture.update");
      const existing = await requireOpenWorkOrder(store, scope, id);
      const parsed = parseWithFrigora(scheduleWorkOrderSchema, input);
      assertExpectedDispatchToken(existing, parsed.expectedUpdatedAt);

      const windowUnchanged =
        existing.scheduledStartAt === parsed.scheduledStartAt &&
        existing.scheduledEndAt === parsed.scheduledEndAt;
      if (windowUnchanged && responseStampsAreClear(existing)) {
        await store.applyGuardedDispatchMutation({ expected: existing, next: null, event: null });
        return existing;
      }

      const occurredAt = nowIso();
      const next: FrigoraWorkOrder = {
        ...existing,
        scheduledStartAt: parsed.scheduledStartAt,
        scheduledEndAt: parsed.scheduledEndAt,
        assignmentAcceptedAt: null,
        assignmentDeclinedAt: null,
        assignmentDeclineReason: null,
        updatedAt: occurredAt,
      };

      const event = windowUnchanged
        ? null
        : buildDispatchEvent({
            workOrder: existing,
            actorUserId: scope.userId,
            eventType:
              existing.scheduledStartAt === null || existing.scheduledEndAt === null
                ? "SCHEDULED"
                : "RESCHEDULED",
            occurredAt,
            previousAssignedUserId: existing.assignedUserId,
            nextAssignedUserId: existing.assignedUserId,
            previousScheduledStartAt: existing.scheduledStartAt,
            previousScheduledEndAt: existing.scheduledEndAt,
            nextScheduledStartAt: parsed.scheduledStartAt,
            nextScheduledEndAt: parsed.scheduledEndAt,
          });

      await store.applyGuardedDispatchMutation({ expected: existing, next, event, confirmDoubleBooking: parsed.confirmDoubleBooking });
      return next;
    },
    async clearWorkOrderSchedule(scope, id, input) {
      await assertFrigoraAccess(await permissionService(), scope, "venture.update");
      const existing = await requireOpenWorkOrder(store, scope, id);
      const parsed = parseWithFrigora(clearWorkOrderScheduleSchema, input);
      assertExpectedDispatchToken(existing, parsed.expectedUpdatedAt);

      const hadSchedule =
        existing.scheduledStartAt !== null || existing.scheduledEndAt !== null;
      if (!hadSchedule && responseStampsAreClear(existing)) {
        await store.applyGuardedDispatchMutation({ expected: existing, next: null, event: null });
        return existing;
      }

      const occurredAt = nowIso();
      const next: FrigoraWorkOrder = {
        ...existing,
        scheduledStartAt: null,
        scheduledEndAt: null,
        assignmentAcceptedAt: null,
        assignmentDeclinedAt: null,
        assignmentDeclineReason: null,
        updatedAt: occurredAt,
      };

      const event = !hadSchedule
        ? null
        : buildDispatchEvent({
            workOrder: existing,
            actorUserId: scope.userId,
            eventType: "SCHEDULE_CLEARED",
            occurredAt,
            previousAssignedUserId: existing.assignedUserId,
            nextAssignedUserId: existing.assignedUserId,
            previousScheduledStartAt: existing.scheduledStartAt,
            previousScheduledEndAt: existing.scheduledEndAt,
            nextScheduledStartAt: null,
            nextScheduledEndAt: null,
          });

      await store.applyGuardedDispatchMutation({ expected: existing, next, event });
      return next;
    },
    async acceptWorkOrderAssignment(scope, id) {
      await assertFrigoraAccess(await permissionService(), scope, "venture.read");
      const existing = await requireOpenWorkOrder(store, scope, id);
      assertCurrentAssignmentMayRespond(existing, scope.userId);
      assertHasScheduledServiceWindow(existing);
      const acceptedAt = nowIso();
      const next: FrigoraWorkOrder = {
        ...existing,
        assignmentAcceptedAt: acceptedAt,
        assignmentDeclinedAt: null,
        assignmentDeclineReason: null,
        updatedAt: acceptedAt,
      };
      await store.updateWorkOrder(next);
      return next;
    },
    async declineWorkOrderAssignment(scope, id, input) {
      await assertFrigoraAccess(await permissionService(), scope, "venture.read");
      const existing = await requireOpenWorkOrder(store, scope, id);
      assertCurrentAssignmentMayRespond(existing, scope.userId);
      const parsed = parseWithFrigora(declineWorkOrderAssignmentSchema, input);
      assertHasScheduledServiceWindow(existing);
      const declinedAt = nowIso();
      const next: FrigoraWorkOrder = {
        ...existing,
        assignmentAcceptedAt: null,
        assignmentDeclinedAt: declinedAt,
        assignmentDeclineReason: parsed.reason,
        updatedAt: declinedAt,
      };
      await store.updateWorkOrder(next);
      return next;
    },
    async listScheduledWorkOrders(scope, input) {
      if (!(await allowFrigoraRead(await permissionService(), scope))) {
        return [];
      }
      const parsed = parseWithFrigora(listScheduledWorkOrdersSchema, input);
      return store.listScheduledWorkOrders(
        scope.workspaceId,
        scope.ventureId,
        parsed.rangeStart,
        parsed.rangeEnd,
      );
    },
    async recordVisitArrival(scope, workOrderId, input) {
      await assertFrigoraAccess(await permissionService(), scope, "venture.read");
      const workOrder = await requireOpenWorkOrder(store, scope, workOrderId);
      const authority = await assertWorkOrderOperationalAccess(
        await permissionService(),
        scope,
        workOrder,
      );
      const parsed = parseWithFrigora(recordVisitArrivalSchema, input);
      const attendingUserId = parsed.userId as UserId;
      assertAssignedEngineerActorIdentity(authority, scope, attendingUserId);
      await requireWorkspaceMember(scope.workspaceId, attendingUserId);
      const now = nowIso();
      const row: FrigoraVisit = {
        id: createId<FrigoraVisitId>(),
        workspaceId: workOrder.workspaceId,
        ventureId: workOrder.ventureId,
        workOrderId: workOrder.id,
        attendingUserId,
        arrivedAt: parsed.arrivedAt,
        departedAt: null,
        labourHourlyChargeCents: null,
        status: "open",
        createdAt: now,
        updatedAt: now,
      };
      await store.insertVisit(row);
      return row;
    },
    async recordVisitDeparture(scope, id, input) {
      await assertFrigoraAccess(await permissionService(), scope, "venture.read");
      const existing = await requireOpenVisit(store, scope, id);
      const workOrder = await requireWorkOrder(store, scope, existing.workOrderId);
      await assertWorkOrderOperationalAccess(await permissionService(), scope, workOrder);
      const parsed = parseWithFrigora(recordVisitDepartureSchema, input);
      assertDepartedAfterArrived(existing.arrivedAt, parsed.departedAt);
      const commercial = await store.getVentureCommercialSettings(
        scope.workspaceId,
        scope.ventureId,
      );
      const labourHourlyChargeCents =
        commercial?.labourHourlyChargeCents != null
          ? commercial.labourHourlyChargeCents
          : null;
      const next: FrigoraVisit = {
        ...existing,
        departedAt: parsed.departedAt,
        labourHourlyChargeCents,
        status: "departed",
        updatedAt: nowIso(),
      };
      await store.updateVisit(next);
      return next;
    },
    async cancelVisit(scope, id) {
      await assertFrigoraAccess(await permissionService(), scope, "venture.update");
      const existing = await requireOpenVisit(store, scope, id);
      const next: FrigoraVisit = {
        ...existing,
        status: "cancelled",
        updatedAt: nowIso(),
      };
      await store.updateVisit(next);
      return next;
    },
    async getVisit(scope, id) {
      if (!(await allowFrigoraRead(await permissionService(), scope))) {
        return null;
      }
      return store.findVisit(scope.workspaceId, scope.ventureId, id);
    },
    async listVisitsByWorkOrder(scope, workOrderId) {
      if (!(await allowFrigoraRead(await permissionService(), scope))) {
        return [];
      }
      const workOrder = await store.findWorkOrder(
        scope.workspaceId,
        scope.ventureId,
        workOrderId,
      );
      if (!workOrder) {
        return [];
      }
      return store.listVisitsByWorkOrder(scope.workspaceId, scope.ventureId, workOrderId);
    },
    async listVisitsByAttendingUser(scope, userId) {
      if (!(await allowFrigoraRead(await permissionService(), scope))) {
        return [];
      }
      const member = await getPersistence().memberships.getRole(userId, scope.workspaceId);
      if (!member) {
        return [];
      }
      return store.listVisitsByAttendingUser(scope.workspaceId, scope.ventureId, userId);
    },
    async recordFieldCapture(scope, visitId, input) {
      const row = await prepareFieldCaptureRow(
        store,
        await permissionService(),
        scope,
        visitId,
        input,
      );
      await store.insertFieldCapture(row);
      return row;
    },
    async submitClientFieldCapture(scope, visitId, input) {
      await assertFrigoraAccess(await permissionService(), scope, "venture.read");
      if (!input.clientOperationId || input.clientOperationId.trim().length === 0) {
        throw new FrigoraError("invalid_input", "clientOperationId is required.");
      }
      const clientOperationId = input.clientOperationId.trim();
      const workOrderIdInput = input.workOrderId?.trim();
      if (!workOrderIdInput) {
        throw new FrigoraError("invalid_input", "workOrderId is required.");
      }

      const fingerprint = fingerprintFieldCaptureRequest({
        ventureId: scope.ventureId,
        actorUserId: scope.userId,
        workOrderId: workOrderIdInput,
        visitId,
        captureKind: input.captureKind,
        captureCode: input.captureCode,
        valueNumeric: input.valueNumeric,
        valueUnit: input.valueUnit,
        description: input.description,
        observedAt: input.observedAt,
        userId: input.userId,
        assetId: input.assetId,
      });

      const existingReceipt = await store.findClientOperationReceipt(
        scope.ventureId,
        clientOperationId,
      );
      if (existingReceipt) {
        return resolveExistingClientFieldCaptureAcceptance({
          store,
          scope,
          visitId,
          workOrderId: workOrderIdInput,
          clientOperationId,
          fingerprint,
          receipt: existingReceipt,
        });
      }

      const row = await prepareFieldCaptureRow(
        store,
        await permissionService(),
        scope,
        visitId,
        input,
      );
      if (row.workOrderId !== workOrderIdInput) {
        throw new FrigoraError(
          "invalid_input",
          "workOrderId does not match the visit work order.",
        );
      }

      const now = nowIso();
      const receipt: FrigoraClientOperationReceipt = {
        id: createId<FrigoraClientOperationReceiptId>(),
        workspaceId: row.workspaceId,
        ventureId: row.ventureId,
        actorUserId: scope.userId,
        clientOperationId,
        operationType: "recordFieldCapture",
        workOrderId: row.workOrderId,
        visitId: row.visitId,
        requestFingerprint: fingerprint,
        acceptedEntityId: row.id,
        acceptedAt: now,
        createdAt: now,
      };

      try {
        await store.insertFieldCaptureWithClientOperationReceipt(row, receipt);
        return { capture: row, receipt, duplicate: false };
      } catch (error) {
        if (isFrigoraError(error) && error.code === "duplicate") {
          const raced = await store.findClientOperationReceipt(
            scope.ventureId,
            clientOperationId,
          );
          if (!raced) {
            throw error;
          }
          return resolveExistingClientFieldCaptureAcceptance({
            store,
            scope,
            visitId,
            workOrderId: workOrderIdInput,
            clientOperationId,
            fingerprint,
            receipt: raced,
          });
        }
        throw error;
      }
    },
    async getFieldCapture(scope, id) {
      if (!(await allowFrigoraRead(await permissionService(), scope))) {
        return null;
      }
      return store.findFieldCapture(scope.workspaceId, scope.ventureId, id);
    },
    async listFieldCapturesByVisit(scope, visitId) {
      if (!(await allowFrigoraRead(await permissionService(), scope))) {
        return [];
      }
      const visit = await store.findVisit(scope.workspaceId, scope.ventureId, visitId);
      if (!visit) {
        return [];
      }
      return store.listFieldCapturesByVisit(scope.workspaceId, scope.ventureId, visitId);
    },
    async listFieldCapturesByWorkOrder(scope, workOrderId) {
      if (!(await allowFrigoraRead(await permissionService(), scope))) {
        return [];
      }
      const workOrder = await store.findWorkOrder(
        scope.workspaceId,
        scope.ventureId,
        workOrderId,
      );
      if (!workOrder) {
        return [];
      }
      return store.listFieldCapturesByWorkOrder(
        scope.workspaceId,
        scope.ventureId,
        workOrderId,
      );
    },
    async listFieldCapturesByAsset(scope, assetId) {
      if (!(await allowFrigoraRead(await permissionService(), scope))) {
        return [];
      }
      const asset = await store.findAsset(scope.workspaceId, scope.ventureId, assetId);
      if (!asset) {
        return [];
      }
      return store.listFieldCapturesByAsset(scope.workspaceId, scope.ventureId, assetId);
    },
    async recordTechnicalFinding(scope, visitId, input) {
      const row = await prepareTechnicalFindingRow(
        store,
        await permissionService(),
        scope,
        visitId,
        input,
      );
      await store.insertTechnicalFinding(row);
      return row;
    },
    async submitClientTechnicalFinding(scope, visitId, input) {
      await assertFrigoraAccess(await permissionService(), scope, "venture.read");
      if (!input.clientOperationId || input.clientOperationId.trim().length === 0) {
        throw new FrigoraError("invalid_input", "clientOperationId is required.");
      }
      const clientOperationId = input.clientOperationId.trim();
      const workOrderIdInput = input.workOrderId?.trim();
      if (!workOrderIdInput) {
        throw new FrigoraError("invalid_input", "workOrderId is required.");
      }

      const fingerprint = fingerprintTechnicalFindingRequest({
        ventureId: scope.ventureId,
        actorUserId: scope.userId,
        workOrderId: workOrderIdInput,
        visitId,
        findingKind: input.findingKind,
        description: input.description,
        assertedAt: input.assertedAt,
        userId: input.userId,
        assetId: input.assetId,
        sourceFieldCaptureIds: input.sourceFieldCaptureIds,
      });

      const existingReceipt = await store.findClientOperationReceipt(
        scope.ventureId,
        clientOperationId,
      );
      if (existingReceipt) {
        return resolveExistingClientTechnicalFindingAcceptance({
          store,
          scope,
          visitId,
          workOrderId: workOrderIdInput,
          clientOperationId,
          fingerprint,
          receipt: existingReceipt,
        });
      }

      const row = await prepareTechnicalFindingRow(
        store,
        await permissionService(),
        scope,
        visitId,
        input,
      );
      if (row.workOrderId !== workOrderIdInput) {
        throw new FrigoraError(
          "invalid_input",
          "workOrderId does not match the visit work order.",
        );
      }

      const now = nowIso();
      const receipt: FrigoraClientOperationReceipt = {
        id: createId<FrigoraClientOperationReceiptId>(),
        workspaceId: row.workspaceId,
        ventureId: row.ventureId,
        actorUserId: scope.userId,
        clientOperationId,
        operationType: "recordTechnicalFinding",
        workOrderId: row.workOrderId,
        visitId: row.visitId,
        requestFingerprint: fingerprint,
        acceptedEntityId: row.id,
        acceptedAt: now,
        createdAt: now,
      };

      try {
        await store.insertTechnicalFindingWithClientOperationReceipt(row, receipt);
        return { finding: row, receipt, duplicate: false };
      } catch (error) {
        if (isFrigoraError(error) && error.code === "duplicate") {
          const raced = await store.findClientOperationReceipt(
            scope.ventureId,
            clientOperationId,
          );
          if (!raced) {
            throw error;
          }
          return resolveExistingClientTechnicalFindingAcceptance({
            store,
            scope,
            visitId,
            workOrderId: workOrderIdInput,
            clientOperationId,
            fingerprint,
            receipt: raced,
          });
        }
        throw error;
      }
    },
    async getTechnicalFinding(scope, id) {
      if (!(await allowFrigoraRead(await permissionService(), scope))) {
        return null;
      }
      return store.findTechnicalFinding(scope.workspaceId, scope.ventureId, id);
    },
    async listTechnicalFindingsByVisit(scope, visitId) {
      if (!(await allowFrigoraRead(await permissionService(), scope))) {
        return [];
      }
      const visit = await store.findVisit(scope.workspaceId, scope.ventureId, visitId);
      if (!visit) {
        return [];
      }
      return store.listTechnicalFindingsByVisit(scope.workspaceId, scope.ventureId, visitId);
    },
    async listTechnicalFindingsByWorkOrder(scope, workOrderId) {
      if (!(await allowFrigoraRead(await permissionService(), scope))) {
        return [];
      }
      const workOrder = await store.findWorkOrder(
        scope.workspaceId,
        scope.ventureId,
        workOrderId,
      );
      if (!workOrder) {
        return [];
      }
      return store.listTechnicalFindingsByWorkOrder(
        scope.workspaceId,
        scope.ventureId,
        workOrderId,
      );
    },
    async listTechnicalFindingsByAsset(scope, assetId) {
      if (!(await allowFrigoraRead(await permissionService(), scope))) {
        return [];
      }
      const asset = await store.findAsset(scope.workspaceId, scope.ventureId, assetId);
      if (!asset) {
        return [];
      }
      return store.listTechnicalFindingsByAsset(scope.workspaceId, scope.ventureId, assetId);
    },
    async recordCorrectiveAction(scope, visitId, input) {
      await assertFrigoraAccess(await permissionService(), scope, "venture.read");
      const visit = await requireVisit(store, scope, visitId);
      assertVisitAcceptsCorrectiveAction(visit);
      const workOrder = await requireWorkOrder(store, scope, visit.workOrderId);
      const authority = await assertWorkOrderOperationalAccess(
        await permissionService(),
        scope,
        workOrder,
      );
      const parsed = parseWithFrigora(recordCorrectiveActionSchema, input);
      assertPerformedAtWithinVisit(visit, parsed.performedAt);
      const performedByUserId = parsed.performedByUserId as UserId;
      const recordedByUserId = parsed.recordedByUserId as UserId;
      assertAssignedEngineerActorIdentity(
        authority,
        scope,
        performedByUserId,
        recordedByUserId,
      );
      await requireWorkspaceMember(scope.workspaceId, performedByUserId);
      await requireWorkspaceMember(scope.workspaceId, recordedByUserId);
      const assetId = await resolveFieldCaptureAsset(
        store,
        scope,
        workOrder,
        parsed.assetId === undefined ? null : parsed.assetId,
      );
      const sourceTechnicalFindingIds = await resolveSourceTechnicalFindingIds(
        store,
        scope,
        visit,
        parsed.sourceTechnicalFindingIds,
      );
      const now = nowIso();
      const row: FrigoraCorrectiveAction = {
        id: createId<FrigoraCorrectiveActionId>(),
        workspaceId: visit.workspaceId,
        ventureId: visit.ventureId,
        visitId: visit.id,
        workOrderId: visit.workOrderId,
        assetId,
        description: parsed.description,
        sourceTechnicalFindingIds,
        performedAt: parsed.performedAt,
        performedByUserId,
        recordedByUserId,
        createdAt: now,
        updatedAt: now,
      };
      await store.insertCorrectiveAction(row);
      return row;
    },
    async getCorrectiveAction(scope, id) {
      if (!(await allowFrigoraRead(await permissionService(), scope))) {
        return null;
      }
      return store.findCorrectiveAction(scope.workspaceId, scope.ventureId, id);
    },
    async listCorrectiveActionsByVisit(scope, visitId) {
      if (!(await allowFrigoraRead(await permissionService(), scope))) {
        return [];
      }
      const visit = await store.findVisit(scope.workspaceId, scope.ventureId, visitId);
      if (!visit) {
        return [];
      }
      return store.listCorrectiveActionsByVisit(scope.workspaceId, scope.ventureId, visitId);
    },
    async listCorrectiveActionsByWorkOrder(scope, workOrderId) {
      if (!(await allowFrigoraRead(await permissionService(), scope))) {
        return [];
      }
      const workOrder = await store.findWorkOrder(
        scope.workspaceId,
        scope.ventureId,
        workOrderId,
      );
      if (!workOrder) {
        return [];
      }
      return store.listCorrectiveActionsByWorkOrder(
        scope.workspaceId,
        scope.ventureId,
        workOrderId,
      );
    },
    async listCorrectiveActionsByAsset(scope, assetId) {
      if (!(await allowFrigoraRead(await permissionService(), scope))) {
        return [];
      }
      const asset = await store.findAsset(scope.workspaceId, scope.ventureId, assetId);
      if (!asset) {
        return [];
      }
      return store.listCorrectiveActionsByAsset(scope.workspaceId, scope.ventureId, assetId);
    },
    async recordVisitOutcome(scope, visitId, input) {
      await assertFrigoraAccess(await permissionService(), scope, "venture.read");
      const visit = await requireVisit(store, scope, visitId);
      assertVisitAcceptsVisitOutcome(visit);
      const workOrder = await requireWorkOrder(store, scope, visit.workOrderId);
      const authority = await assertWorkOrderOperationalAccess(
        await permissionService(),
        scope,
        workOrder,
      );
      const existing = await store.findVisitOutcomeByVisit(
        scope.workspaceId,
        scope.ventureId,
        visit.id,
      );
      if (existing) {
        throw new FrigoraError(
          "duplicate",
          "A visit outcome already exists for this visit.",
        );
      }
      const parsed = parseWithFrigora(recordVisitOutcomeSchema, input);
      assertOutcomeAtWithinVisit(visit, parsed.outcomeAt);
      const recordedByUserId = parsed.recordedByUserId as UserId;
      assertAssignedEngineerActorIdentity(authority, scope, recordedByUserId);
      await requireWorkspaceMember(scope.workspaceId, recordedByUserId);
      const assetId = await resolveFieldCaptureAsset(
        store,
        scope,
        workOrder,
        parsed.assetId === undefined ? null : parsed.assetId,
      );
      const now = nowIso();
      const row: FrigoraVisitOutcome = {
        id: createId<FrigoraVisitOutcomeId>(),
        workspaceId: visit.workspaceId,
        ventureId: visit.ventureId,
        visitId: visit.id,
        workOrderId: visit.workOrderId,
        assetId,
        description: parsed.description,
        outcomeAt: parsed.outcomeAt,
        recordedByUserId,
        createdAt: now,
        updatedAt: now,
      };
      await store.insertVisitOutcome(row);
      return row;
    },
    async getVisitOutcome(scope, id) {
      if (!(await allowFrigoraRead(await permissionService(), scope))) {
        return null;
      }
      return store.findVisitOutcome(scope.workspaceId, scope.ventureId, id);
    },
    async getVisitOutcomeByVisit(scope, visitId) {
      if (!(await allowFrigoraRead(await permissionService(), scope))) {
        return null;
      }
      const visit = await store.findVisit(scope.workspaceId, scope.ventureId, visitId);
      if (!visit) {
        return null;
      }
      return store.findVisitOutcomeByVisit(scope.workspaceId, scope.ventureId, visitId);
    },
    async listVisitOutcomesByWorkOrder(scope, workOrderId) {
      if (!(await allowFrigoraRead(await permissionService(), scope))) {
        return [];
      }
      const workOrder = await store.findWorkOrder(
        scope.workspaceId,
        scope.ventureId,
        workOrderId,
      );
      if (!workOrder) {
        return [];
      }
      return store.listVisitOutcomesByWorkOrder(
        scope.workspaceId,
        scope.ventureId,
        workOrderId,
      );
    },
    async listVisitOutcomesByAsset(scope, assetId) {
      if (!(await allowFrigoraRead(await permissionService(), scope))) {
        return [];
      }
      const asset = await store.findAsset(scope.workspaceId, scope.ventureId, assetId);
      if (!asset) {
        return [];
      }
      return store.listVisitOutcomesByAsset(scope.workspaceId, scope.ventureId, assetId);
    },
    async recordRecommendedAction(scope, visitId, input) {
      await assertFrigoraAccess(await permissionService(), scope, "venture.read");
      const visit = await requireVisit(store, scope, visitId);
      assertVisitAcceptsRecommendedAction(visit);
      const workOrder = await requireWorkOrder(store, scope, visit.workOrderId);
      const authority = await assertWorkOrderOperationalAccess(
        await permissionService(),
        scope,
        workOrder,
      );
      const parsed = parseWithFrigora(recordRecommendedActionSchema, input);
      assertRecommendedAtWithinVisit(visit, parsed.recommendedAt);
      const recommendedByUserId = parsed.recommendedByUserId as UserId;
      const recordedByUserId = parsed.recordedByUserId as UserId;
      assertAssignedEngineerActorIdentity(
        authority,
        scope,
        recommendedByUserId,
        recordedByUserId,
      );
      await requireWorkspaceMember(scope.workspaceId, recommendedByUserId);
      await requireWorkspaceMember(scope.workspaceId, recordedByUserId);
      const assetId = await resolveFieldCaptureAsset(
        store,
        scope,
        workOrder,
        parsed.assetId === undefined ? null : parsed.assetId,
      );
      const now = nowIso();
      const row: FrigoraRecommendedAction = {
        id: createId<FrigoraRecommendedActionId>(),
        workspaceId: visit.workspaceId,
        ventureId: visit.ventureId,
        visitId: visit.id,
        workOrderId: visit.workOrderId,
        assetId,
        description: parsed.description,
        recommendedAt: parsed.recommendedAt,
        recommendedByUserId,
        recordedByUserId,
        createdAt: now,
        updatedAt: now,
      };
      await store.insertRecommendedAction(row);
      return row;
    },
    async getRecommendedAction(scope, id) {
      if (!(await allowFrigoraRead(await permissionService(), scope))) {
        return null;
      }
      return store.findRecommendedAction(scope.workspaceId, scope.ventureId, id);
    },
    async listRecommendedActionsByVisit(scope, visitId) {
      if (!(await allowFrigoraRead(await permissionService(), scope))) {
        return [];
      }
      const visit = await store.findVisit(scope.workspaceId, scope.ventureId, visitId);
      if (!visit) {
        return [];
      }
      return store.listRecommendedActionsByVisit(scope.workspaceId, scope.ventureId, visitId);
    },
    async listRecommendedActionsByWorkOrder(scope, workOrderId) {
      if (!(await allowFrigoraRead(await permissionService(), scope))) {
        return [];
      }
      const workOrder = await store.findWorkOrder(
        scope.workspaceId,
        scope.ventureId,
        workOrderId,
      );
      if (!workOrder) {
        return [];
      }
      return store.listRecommendedActionsByWorkOrder(
        scope.workspaceId,
        scope.ventureId,
        workOrderId,
      );
    },
    async listRecommendedActionsByAsset(scope, assetId) {
      if (!(await allowFrigoraRead(await permissionService(), scope))) {
        return [];
      }
      const asset = await store.findAsset(scope.workspaceId, scope.ventureId, assetId);
      if (!asset) {
        return [];
      }
      return store.listRecommendedActionsByAsset(scope.workspaceId, scope.ventureId, assetId);
    },
    async recordRefrigerantEvent(scope, visitId, input) {
      await assertFrigoraAccess(await permissionService(), scope, "venture.read");
      const visit = await requireVisit(store, scope, visitId);
      assertVisitAcceptsRefrigerantEvent(visit);
      const workOrder = await requireWorkOrder(store, scope, visit.workOrderId);
      const authority = await assertWorkOrderOperationalAccess(
        await permissionService(),
        scope,
        workOrder,
      );
      const parsed = parseWithFrigora(recordRefrigerantEventSchema, input);
      assertOccurredAtWithinVisit(visit, parsed.occurredAt);
      const handledByUserId = parsed.handledByUserId as UserId;
      const recordedByUserId = parsed.recordedByUserId as UserId;
      assertAssignedEngineerActorIdentity(
        authority,
        scope,
        handledByUserId,
        recordedByUserId,
      );
      await requireWorkspaceMember(scope.workspaceId, handledByUserId);
      await requireWorkspaceMember(scope.workspaceId, recordedByUserId);
      const assetId = await resolveFieldCaptureAsset(
        store,
        scope,
        workOrder,
        parsed.assetId === undefined ? null : parsed.assetId,
      );
      let refrigerantReferenceId: FrigoraRefrigerantReferenceId | null = null;
      let refrigerantType: string;
      let chargePerKgCents: number | null = null;
      if (parsed.refrigerantReferenceId) {
        const reference = await store.findRefrigerantReference(
          scope.workspaceId,
          scope.ventureId,
          parsed.refrigerantReferenceId as FrigoraRefrigerantReferenceId,
        );
        if (!reference) {
          throw new FrigoraError("not_found", "Refrigerant reference was not found.");
        }
        if (reference.status !== "active") {
          throw new FrigoraError(
            "invalid_input",
            "Retired refrigerant references cannot be selected for new recording.",
          );
        }
        refrigerantReferenceId = reference.id;
        refrigerantType = reference.canonicalCode;
        if (parsed.eventKind === "added") {
          chargePerKgCents = reference.defaultChargePerKgCents;
        }
      } else {
        refrigerantType = parsed.refrigerantType as string;
      }
      const now = nowIso();
      const row: FrigoraRefrigerantEvent = {
        id: createId<FrigoraRefrigerantEventId>(),
        workspaceId: visit.workspaceId,
        ventureId: visit.ventureId,
        visitId: visit.id,
        workOrderId: visit.workOrderId,
        assetId,
        refrigerantType,
        refrigerantReferenceId,
        eventKind: parsed.eventKind,
        quantityKg: parsed.quantityKg,
        chargePerKgCents,
        reason: parsed.reason ?? null,
        cylinderReference: parsed.cylinderReference ?? null,
        occurredAt: parsed.occurredAt,
        handledByUserId,
        recordedByUserId,
        createdAt: now,
        updatedAt: now,
      };
      await store.insertRefrigerantEvent(row);
      return row;
    },
    async getRefrigerantEvent(scope, id) {
      if (!(await allowFrigoraRead(await permissionService(), scope))) {
        return null;
      }
      return store.findRefrigerantEvent(scope.workspaceId, scope.ventureId, id);
    },
    async listRefrigerantEventsByVisit(scope, visitId) {
      if (!(await allowFrigoraRead(await permissionService(), scope))) {
        return [];
      }
      const visit = await store.findVisit(scope.workspaceId, scope.ventureId, visitId);
      if (!visit) {
        return [];
      }
      return store.listRefrigerantEventsByVisit(scope.workspaceId, scope.ventureId, visitId);
    },
    async listRefrigerantEventsByWorkOrder(scope, workOrderId) {
      if (!(await allowFrigoraRead(await permissionService(), scope))) {
        return [];
      }
      const workOrder = await store.findWorkOrder(
        scope.workspaceId,
        scope.ventureId,
        workOrderId,
      );
      if (!workOrder) {
        return [];
      }
      return store.listRefrigerantEventsByWorkOrder(
        scope.workspaceId,
        scope.ventureId,
        workOrderId,
      );
    },
    async listRefrigerantEventsByAsset(scope, assetId) {
      if (!(await allowFrigoraRead(await permissionService(), scope))) {
        return [];
      }
      const asset = await store.findAsset(scope.workspaceId, scope.ventureId, assetId);
      if (!asset) {
        return [];
      }
      return store.listRefrigerantEventsByAsset(scope.workspaceId, scope.ventureId, assetId);
    },
    async recordPartUsage(scope, visitId, input) {
      await assertFrigoraAccess(await permissionService(), scope, "venture.read");
      const visit = await requireVisit(store, scope, visitId);
      assertVisitAcceptsPartUsage(visit);
      const workOrder = await requireWorkOrder(store, scope, visit.workOrderId);
      const authority = await assertWorkOrderOperationalAccess(
        await permissionService(),
        scope,
        workOrder,
      );
      const parsed = parseWithFrigora(recordPartUsageSchema, input);
      assertUsedAtWithinVisit(visit, parsed.usedAt);
      const usedByUserId = parsed.usedByUserId as UserId;
      const recordedByUserId = parsed.recordedByUserId as UserId;
      assertAssignedEngineerActorIdentity(
        authority,
        scope,
        usedByUserId,
        recordedByUserId,
      );
      await requireWorkspaceMember(scope.workspaceId, usedByUserId);
      await requireWorkspaceMember(scope.workspaceId, recordedByUserId);
      const assetId = await resolveFieldCaptureAsset(
        store,
        scope,
        workOrder,
        parsed.assetId === undefined ? null : parsed.assetId,
      );
      let partReferenceId: FrigoraPartReferenceId | null = null;
      let partDescription: string;
      let quantityUnit: FrigoraPartUsageUnit;
      let unitChargeCents: number | null = null;
      if (parsed.partReferenceId) {
        const reference = await store.findPartReference(
          scope.workspaceId,
          scope.ventureId,
          parsed.partReferenceId as FrigoraPartReferenceId,
        );
        if (!reference) {
          throw new FrigoraError("not_found", "Part reference was not found.");
        }
        if (reference.status !== "active") {
          throw new FrigoraError(
            "invalid_input",
            "Retired part references cannot be selected for new recording.",
          );
        }
        partReferenceId = reference.id;
        partDescription = reference.displayName;
        quantityUnit = parsed.quantityUnit ?? reference.defaultQuantityUnit;
        unitChargeCents = reference.defaultUnitChargeCents;
      } else {
        partDescription = parsed.partDescription as string;
        quantityUnit = parsed.quantityUnit as FrigoraPartUsageUnit;
      }
      const now = nowIso();
      const row: FrigoraPartUsage = {
        id: createId<FrigoraPartUsageId>(),
        workspaceId: visit.workspaceId,
        ventureId: visit.ventureId,
        visitId: visit.id,
        workOrderId: visit.workOrderId,
        assetId,
        partDescription,
        partReferenceId,
        quantity: parsed.quantity,
        quantityUnit,
        unitChargeCents,
        notes: parsed.notes ?? null,
        usedAt: parsed.usedAt,
        usedByUserId,
        recordedByUserId,
        createdAt: now,
        updatedAt: now,
      };
      await store.insertPartUsage(row);
      return row;
    },
    async getPartUsage(scope, id) {
      if (!(await allowFrigoraRead(await permissionService(), scope))) {
        return null;
      }
      return store.findPartUsage(scope.workspaceId, scope.ventureId, id);
    },
    async listPartUsagesByVisit(scope, visitId) {
      if (!(await allowFrigoraRead(await permissionService(), scope))) {
        return [];
      }
      const visit = await store.findVisit(scope.workspaceId, scope.ventureId, visitId);
      if (!visit) {
        return [];
      }
      return store.listPartUsagesByVisit(scope.workspaceId, scope.ventureId, visitId);
    },
    async listPartUsagesByWorkOrder(scope, workOrderId) {
      if (!(await allowFrigoraRead(await permissionService(), scope))) {
        return [];
      }
      const workOrder = await store.findWorkOrder(
        scope.workspaceId,
        scope.ventureId,
        workOrderId,
      );
      if (!workOrder) {
        return [];
      }
      return store.listPartUsagesByWorkOrder(
        scope.workspaceId,
        scope.ventureId,
        workOrderId,
      );
    },
    async listPartUsagesByAsset(scope, assetId) {
      if (!(await allowFrigoraRead(await permissionService(), scope))) {
        return [];
      }
      const asset = await store.findAsset(scope.workspaceId, scope.ventureId, assetId);
      if (!asset) {
        return [];
      }
      return store.listPartUsagesByAsset(scope.workspaceId, scope.ventureId, assetId);
    },
    async createPartReference(scope, input) {
      await assertFrigoraAccess(await permissionService(), scope, "venture.update");
      const parsed = parseWithFrigora(createPartReferenceSchema, input);
      const now = nowIso();
      const row: FrigoraPartReference = {
        id: createId<FrigoraPartReferenceId>(),
        workspaceId: scope.workspaceId,
        ventureId: scope.ventureId,
        displayName: parsed.displayName,
        defaultQuantityUnit: parsed.defaultQuantityUnit,
        defaultUnitChargeCents: parsed.defaultUnitChargeCents ?? null,
        status: "active",
        createdAt: now,
        updatedAt: now,
      };
      await store.insertPartReference(row);
      return row;
    },
    async updatePartReference(scope, id, input) {
      await assertFrigoraAccess(await permissionService(), scope, "venture.update");
      const existing = await store.findPartReference(scope.workspaceId, scope.ventureId, id);
      if (!existing) {
        throw new FrigoraError("not_found", "Part reference was not found.");
      }
      const parsed = parseWithFrigora(updatePartReferenceSchema, input);
      const next: FrigoraPartReference = {
        ...existing,
        displayName: parsed.displayName ?? existing.displayName,
        defaultQuantityUnit: parsed.defaultQuantityUnit ?? existing.defaultQuantityUnit,
        defaultUnitChargeCents:
          parsed.defaultUnitChargeCents !== undefined
            ? parsed.defaultUnitChargeCents
            : existing.defaultUnitChargeCents,
        updatedAt: nowIso(),
      };
      await store.updatePartReference(next);
      return next;
    },
    async retirePartReference(scope, id) {
      await assertFrigoraAccess(await permissionService(), scope, "venture.update");
      const existing = await store.findPartReference(scope.workspaceId, scope.ventureId, id);
      if (!existing) {
        throw new FrigoraError("not_found", "Part reference was not found.");
      }
      if (existing.status === "retired") {
        return existing;
      }
      const next: FrigoraPartReference = {
        ...existing,
        status: "retired",
        updatedAt: nowIso(),
      };
      await store.updatePartReference(next);
      return next;
    },
    async getPartReference(scope, id) {
      if (!(await allowFrigoraRead(await permissionService(), scope))) {
        return null;
      }
      return store.findPartReference(scope.workspaceId, scope.ventureId, id);
    },
    async listPartReferences(scope) {
      if (!(await allowFrigoraRead(await permissionService(), scope))) {
        return [];
      }
      return store.listPartReferences(scope.workspaceId, scope.ventureId);
    },
    async listActivePartReferences(scope) {
      if (!(await allowFrigoraRead(await permissionService(), scope))) {
        return [];
      }
      return store.listActivePartReferences(scope.workspaceId, scope.ventureId);
    },
    async createRefrigerantReference(scope, input) {
      await assertFrigoraAccess(await permissionService(), scope, "venture.update");
      const parsed = parseWithFrigora(createRefrigerantReferenceSchema, input);
      const code = canonicalizeRefrigerantCode(parsed.canonicalCode);
      const clash = await store.findRefrigerantReferenceByCanonicalCode(
        scope.workspaceId,
        scope.ventureId,
        code,
      );
      if (clash) {
        throw new FrigoraError(
          "duplicate",
          "A refrigerant reference with this canonical code already exists.",
        );
      }
      const now = nowIso();
      const row: FrigoraRefrigerantReference = {
        id: createId<FrigoraRefrigerantReferenceId>(),
        workspaceId: scope.workspaceId,
        ventureId: scope.ventureId,
        canonicalCode: code,
        displayName: parsed.displayName,
        defaultChargePerKgCents: parsed.defaultChargePerKgCents ?? null,
        status: "active",
        createdAt: now,
        updatedAt: now,
      };
      await store.insertRefrigerantReference(row);
      return row;
    },
    async updateRefrigerantReference(scope, id, input) {
      await assertFrigoraAccess(await permissionService(), scope, "venture.update");
      const existing = await store.findRefrigerantReference(
        scope.workspaceId,
        scope.ventureId,
        id,
      );
      if (!existing) {
        throw new FrigoraError("not_found", "Refrigerant reference was not found.");
      }
      const parsed = parseWithFrigora(updateRefrigerantReferenceSchema, input);
      const nextCode =
        parsed.canonicalCode !== undefined
          ? canonicalizeRefrigerantCode(parsed.canonicalCode)
          : existing.canonicalCode;
      if (nextCode !== existing.canonicalCode) {
        const clash = await store.findRefrigerantReferenceByCanonicalCode(
          scope.workspaceId,
          scope.ventureId,
          nextCode,
        );
        if (clash && clash.id !== existing.id) {
          throw new FrigoraError(
            "duplicate",
            "A refrigerant reference with this canonical code already exists.",
          );
        }
      }
      const next: FrigoraRefrigerantReference = {
        ...existing,
        canonicalCode: nextCode,
        displayName: parsed.displayName ?? existing.displayName,
        defaultChargePerKgCents:
          parsed.defaultChargePerKgCents !== undefined
            ? parsed.defaultChargePerKgCents
            : existing.defaultChargePerKgCents,
        updatedAt: nowIso(),
      };
      await store.updateRefrigerantReference(next);
      return next;
    },
    async retireRefrigerantReference(scope, id) {
      await assertFrigoraAccess(await permissionService(), scope, "venture.update");
      const existing = await store.findRefrigerantReference(
        scope.workspaceId,
        scope.ventureId,
        id,
      );
      if (!existing) {
        throw new FrigoraError("not_found", "Refrigerant reference was not found.");
      }
      if (existing.status === "retired") {
        return existing;
      }
      const next: FrigoraRefrigerantReference = {
        ...existing,
        status: "retired",
        updatedAt: nowIso(),
      };
      await store.updateRefrigerantReference(next);
      return next;
    },
    async getRefrigerantReference(scope, id) {
      if (!(await allowFrigoraRead(await permissionService(), scope))) {
        return null;
      }
      return store.findRefrigerantReference(scope.workspaceId, scope.ventureId, id);
    },
    async listRefrigerantReferences(scope) {
      if (!(await allowFrigoraRead(await permissionService(), scope))) {
        return [];
      }
      return store.listRefrigerantReferences(scope.workspaceId, scope.ventureId);
    },
    async listActiveRefrigerantReferences(scope) {
      if (!(await allowFrigoraRead(await permissionService(), scope))) {
        return [];
      }
      return store.listActiveRefrigerantReferences(scope.workspaceId, scope.ventureId);
    },
    async getVentureCommercialSettings(scope) {
      await assertFrigoraAccess(await permissionService(), scope, "venture.update");
      return store.getVentureCommercialSettings(scope.workspaceId, scope.ventureId);
    },
    async setVentureLabourHourlyCharge(scope, input) {
      await assertFrigoraAccess(await permissionService(), scope, "venture.update");
      const parsed = parseWithFrigora(setVentureLabourHourlyChargeSchema, input);
      const now = nowIso();
      const row: FrigoraVentureCommercialSettings = {
        workspaceId: scope.workspaceId,
        ventureId: scope.ventureId,
        labourHourlyChargeCents: parsed.labourHourlyChargeCents,
        updatedAt: now,
      };
      await store.upsertVentureCommercialSettings(row);
      return row;
    },
    async setPartUsageUnitCharge(scope, partUsageId, input) {
      await assertFrigoraAccess(await permissionService(), scope, "venture.update");
      const existing = await store.findPartUsage(
        scope.workspaceId,
        scope.ventureId,
        partUsageId,
      );
      if (!existing) {
        throw new FrigoraError("not_found", "Part usage was not found.");
      }
      const parsed = parseWithFrigora(setPartUsageUnitChargeSchema, input);
      const next: FrigoraPartUsage = {
        ...existing,
        unitChargeCents: parsed.unitChargeCents,
        updatedAt: nowIso(),
      };
      await store.updatePartUsage(next);
      return next;
    },
    async setRefrigerantEventChargePerKg(scope, eventId, input) {
      await assertFrigoraAccess(await permissionService(), scope, "venture.update");
      const existing = await store.findRefrigerantEvent(
        scope.workspaceId,
        scope.ventureId,
        eventId,
      );
      if (!existing) {
        throw new FrigoraError("not_found", "Refrigerant event was not found.");
      }
      if (existing.eventKind !== "added") {
        throw new FrigoraError(
          "invalid_input",
          "Charge per kg applies only to added refrigerant events.",
        );
      }
      const parsed = parseWithFrigora(setRefrigerantEventChargePerKgSchema, input);
      const next: FrigoraRefrigerantEvent = {
        ...existing,
        chargePerKgCents: parsed.chargePerKgCents,
        updatedAt: nowIso(),
      };
      await store.updateRefrigerantEvent(next);
      return next;
    },
    async setVisitLabourHourlyCharge(scope, visitId, input) {
      await assertFrigoraAccess(await permissionService(), scope, "venture.update");
      const existing = await requireVisit(store, scope, visitId);
      if (existing.status !== "departed") {
        throw new FrigoraError(
          "invalid_status",
          "Labour hourly charge can only be set on departed visits.",
        );
      }
      const parsed = parseWithFrigora(setVisitLabourHourlyChargeSchema, input);
      const next: FrigoraVisit = {
        ...existing,
        labourHourlyChargeCents: parsed.labourHourlyChargeCents,
        updatedAt: nowIso(),
      };
      await store.updateVisit(next);
      return next;
    },
    async getWorkOrderTimeMaterials(scope, workOrderId) {
      await assertFrigoraAccess(await permissionService(), scope, "venture.update");
      const workOrder = await store.findWorkOrder(
        scope.workspaceId,
        scope.ventureId,
        workOrderId,
      );
      if (!workOrder) {
        throw new FrigoraError("not_found", "Work order was not found.");
      }
      const [visits, partUsages, refrigerantEvents] = await Promise.all([
        store.listVisitsByWorkOrder(scope.workspaceId, scope.ventureId, workOrderId),
        store.listPartUsagesByWorkOrder(scope.workspaceId, scope.ventureId, workOrderId),
        store.listRefrigerantEventsByWorkOrder(
          scope.workspaceId,
          scope.ventureId,
          workOrderId,
        ),
      ]);
      return computeWorkOrderTimeMaterials({ visits, partUsages, refrigerantEvents });
    },
    async recordAssetOperationalCondition(scope, input) {
      await assertFrigoraAccess(await permissionService(), scope, "venture.read");
      const parsed = parseWithFrigora(recordAssetOperationalConditionSchema, input);
      const asset = await requireAsset(store, scope, parsed.assetId as FrigoraAssetId);
      const assertedByUserId = parsed.assertedByUserId as UserId;
      const recordedByUserId = parsed.recordedByUserId as UserId;
      const { visitId, workOrderId } = await resolveOperationalConditionContext(
        store,
        scope,
        asset.id,
        parsed.visitId === undefined ? null : parsed.visitId,
        parsed.workOrderId === undefined ? null : parsed.workOrderId,
      );
      const permissions = await permissionService();
      let authority: WorkOrderOperationalAuthority;
      if (workOrderId) {
        const workOrder = await requireWorkOrder(store, scope, workOrderId);
        authority = await assertWorkOrderOperationalAccess(permissions, scope, workOrder);
      } else {
        await assertFrigoraAccess(permissions, scope, "venture.update");
        authority = "venture_update";
      }
      assertAssignedEngineerActorIdentity(
        authority,
        scope,
        assertedByUserId,
        recordedByUserId,
      );
      await requireWorkspaceMember(scope.workspaceId, assertedByUserId);
      await requireWorkspaceMember(scope.workspaceId, recordedByUserId);
      const now = nowIso();
      const row: FrigoraAssetOperationalCondition = {
        id: createId<FrigoraAssetOperationalConditionId>(),
        workspaceId: asset.workspaceId,
        ventureId: asset.ventureId,
        assetId: asset.id,
        conditionKind: parsed.conditionKind,
        notes: parsed.notes ?? null,
        visitId,
        workOrderId,
        assertedAt: parsed.assertedAt,
        assertedByUserId,
        recordedByUserId,
        createdAt: now,
        updatedAt: now,
      };
      await store.insertAssetOperationalCondition(row);
      return row;
    },
    async getAssetOperationalCondition(scope, id) {
      if (!(await allowFrigoraRead(await permissionService(), scope))) {
        return null;
      }
      return store.findAssetOperationalCondition(scope.workspaceId, scope.ventureId, id);
    },
    async listAssetOperationalConditionsByAsset(scope, assetId) {
      if (!(await allowFrigoraRead(await permissionService(), scope))) {
        return [];
      }
      const asset = await store.findAsset(scope.workspaceId, scope.ventureId, assetId);
      if (!asset) {
        return [];
      }
      return store.listAssetOperationalConditionsByAsset(
        scope.workspaceId,
        scope.ventureId,
        assetId,
      );
    },
    async getCurrentAssetOperationalCondition(scope, assetId) {
      if (!(await allowFrigoraRead(await permissionService(), scope))) {
        return null;
      }
      const asset = await store.findAsset(scope.workspaceId, scope.ventureId, assetId);
      if (!asset) {
        return null;
      }
      const rows = await store.listAssetOperationalConditionsByAsset(
        scope.workspaceId,
        scope.ventureId,
        assetId,
      );
      return selectCurrentAssetOperationalCondition(rows);
    },
    async recordVisitCustomerAcknowledgement(scope, visitId, input) {
      await assertFrigoraAccess(await permissionService(), scope, "venture.read");
      const visit = await requireVisit(store, scope, visitId);
      assertVisitAcceptsVisitCustomerAcknowledgement(visit);
      const workOrder = await requireWorkOrder(store, scope, visit.workOrderId);
      const authority = await assertWorkOrderOperationalAccess(
        await permissionService(),
        scope,
        workOrder,
      );
      const parsed = parseWithFrigora(recordVisitCustomerAcknowledgementSchema, input);
      assertAcknowledgedAtNotBeforeArrival(visit, parsed.acknowledgedAt);
      const recordedByUserId = parsed.recordedByUserId as UserId;
      assertAssignedEngineerActorIdentity(authority, scope, recordedByUserId);
      await requireWorkspaceMember(scope.workspaceId, recordedByUserId);
      const now = nowIso();
      const row: FrigoraVisitCustomerAcknowledgement = {
        id: createId<FrigoraVisitCustomerAcknowledgementId>(),
        workspaceId: visit.workspaceId,
        ventureId: visit.ventureId,
        visitId: visit.id,
        workOrderId: visit.workOrderId,
        acknowledgementText: parsed.acknowledgementText,
        acknowledgerName: parsed.acknowledgerName,
        acknowledgedAt: parsed.acknowledgedAt,
        recordedByUserId,
        createdAt: now,
        updatedAt: now,
      };
      await store.insertVisitCustomerAcknowledgement(row);
      return row;
    },
    async getVisitCustomerAcknowledgement(scope, id) {
      if (!(await allowFrigoraRead(await permissionService(), scope))) {
        return null;
      }
      return store.findVisitCustomerAcknowledgement(scope.workspaceId, scope.ventureId, id);
    },
    async listVisitCustomerAcknowledgementsByVisit(scope, visitId) {
      if (!(await allowFrigoraRead(await permissionService(), scope))) {
        return [];
      }
      const visit = await store.findVisit(scope.workspaceId, scope.ventureId, visitId);
      if (!visit) {
        return [];
      }
      return store.listVisitCustomerAcknowledgementsByVisit(
        scope.workspaceId,
        scope.ventureId,
        visitId,
      );
    },
    async listVisitCustomerAcknowledgementsByWorkOrder(scope, workOrderId) {
      if (!(await allowFrigoraRead(await permissionService(), scope))) {
        return [];
      }
      const workOrder = await store.findWorkOrder(
        scope.workspaceId,
        scope.ventureId,
        workOrderId,
      );
      if (!workOrder) {
        return [];
      }
      return store.listVisitCustomerAcknowledgementsByWorkOrder(
        scope.workspaceId,
        scope.ventureId,
        workOrderId,
      );
    },
    async recordVisitEvidenceWithFile(scope, visitId, input) {
      await assertFrigoraAccess(await permissionService(), scope, "venture.read");
      const visit = await requireVisit(store, scope, visitId);
      assertVisitAcceptsVisitEvidence(visit);
      requireOpenVisitForEvidence(visit);
      const workOrder = await requireOpenWorkOrder(store, scope, visit.workOrderId);
      const authority = await assertWorkOrderOperationalAccess(
        await permissionService(),
        scope,
        workOrder,
      );
      const parsed = parseWithFrigora(recordVisitEvidenceWithFileSchema, input);
      const recordedByUserId = parsed.userId as UserId;
      assertAssignedEngineerActorIdentity(authority, scope, recordedByUserId);
      await requireWorkspaceMember(scope.workspaceId, recordedByUserId);
      const assetId = await resolveVisitEvidenceAsset(
        store,
        scope,
        workOrder,
        parsed.assetId === undefined ? null : parsed.assetId,
      );
      const storedObjectInput = {
        scope: { workspaceId: scope.workspaceId, ventureId: scope.ventureId },
        actorUserId: scope.userId,
        activeWorkspaceId: scope.workspaceId,
        body: parsed.body,
        originalFilename: parsed.originalFilename,
        mimeType: parsed.mimeType,
      };
      const assignedAuthority =
        authority === "assigned_engineer"
          ? assignedWorkOrderStorageAuthority(workOrder.id)
          : null;
      const storedMetadata = assignedAuthority
        ? await getPlatform().storedObjects.storeForDomain({
            ...storedObjectInput,
            authority: assignedAuthority,
          })
        : await getPlatform().storedObjects.store(storedObjectInput);
      try {
        return await insertVisitEvidenceRow(
          store,
          scope,
          visit,
          workOrder,
          assetId,
          storedMetadata,
          parsed.category,
          parsed.description ?? null,
          recordedByUserId,
        );
      } catch (error) {
        try {
          if (assignedAuthority) {
            await getPlatform().storedObjects.deleteForDomain({
              actorUserId: scope.userId,
              activeWorkspaceId: scope.workspaceId,
              objectId: storedMetadata.id,
              authority: assignedAuthority,
            });
          } else {
            await getPlatform().storedObjects.delete({
              actorUserId: scope.userId,
              activeWorkspaceId: scope.workspaceId,
              objectId: storedMetadata.id,
            });
          }
        } catch {
          throw new FrigoraError(
            "evidence_bytes_delete_failed",
            "Visit evidence was not recorded and stored object compensation failed.",
          );
        }
        throw error;
      }
    },
    async submitClientVisitEvidence(scope, visitId, input) {
      await assertFrigoraAccess(await permissionService(), scope, "venture.read");
      if (!input.clientOperationId || input.clientOperationId.trim().length === 0) {
        throw new FrigoraError("invalid_input", "clientOperationId is required.");
      }
      const clientOperationId = input.clientOperationId.trim();
      const workOrderIdInput = input.workOrderId?.trim();
      if (!workOrderIdInput) {
        throw new FrigoraError("invalid_input", "workOrderId is required.");
      }
      if (!(input.body instanceof Uint8Array) || input.body.byteLength === 0) {
        throw new FrigoraError("invalid_input", "Evidence body bytes are required.");
      }

      const contentSha256 = sha256HexOfBytes(input.body);
      const fingerprint = fingerprintVisitEvidenceRequest({
        ventureId: scope.ventureId,
        actorUserId: scope.userId,
        workOrderId: workOrderIdInput,
        visitId,
        category: input.category,
        description: input.description,
        originalFilename: input.originalFilename,
        mimeType: input.mimeType,
        byteLength: input.body.byteLength,
        contentSha256,
        userId: input.userId,
        assetId: input.assetId,
      });

      const existingReceipt = await store.findClientOperationReceipt(
        scope.ventureId,
        clientOperationId,
      );
      if (existingReceipt) {
        return resolveExistingClientVisitEvidenceAcceptance({
          store,
          scope,
          visitId,
          workOrderId: workOrderIdInput,
          fingerprint,
          receipt: existingReceipt,
        });
      }

      const visit = await requireVisit(store, scope, visitId);
      assertVisitAcceptsVisitEvidence(visit);
      requireOpenVisitForEvidence(visit);
      const workOrder = await requireOpenWorkOrder(store, scope, visit.workOrderId);
      if (workOrder.id !== workOrderIdInput) {
        throw new FrigoraError(
          "invalid_input",
          "workOrderId does not match the visit work order.",
        );
      }
      const authority = await assertWorkOrderOperationalAccess(
        await permissionService(),
        scope,
        workOrder,
      );
      const parsed = parseWithFrigora(recordVisitEvidenceWithFileSchema, {
        category: input.category,
        description: input.description,
        userId: input.userId,
        assetId: input.assetId,
        body: input.body,
        originalFilename: input.originalFilename,
        mimeType: input.mimeType,
      });
      const recordedByUserId = parsed.userId as UserId;
      assertAssignedEngineerActorIdentity(authority, scope, recordedByUserId);
      await requireWorkspaceMember(scope.workspaceId, recordedByUserId);
      const assetId = await resolveVisitEvidenceAsset(
        store,
        scope,
        workOrder,
        parsed.assetId === undefined ? null : parsed.assetId,
      );

      const storedObjectInput = {
        idempotency: { key: `frigora:recordVisitEvidence:${clientOperationId}`, requestFingerprint: fingerprint },
        scope: { workspaceId: scope.workspaceId, ventureId: scope.ventureId },
        actorUserId: scope.userId,
        activeWorkspaceId: scope.workspaceId,
        body: parsed.body,
        originalFilename: parsed.originalFilename,
        mimeType: parsed.mimeType,
      };
      const assignedAuthority =
        authority === "assigned_engineer"
          ? assignedWorkOrderStorageAuthority(workOrder.id)
          : null;
      const storedMetadata = assignedAuthority
        ? await getPlatform().storedObjects.storeForDomain({
            ...storedObjectInput,
            authority: assignedAuthority,
          })
        : await getPlatform().storedObjects.store(storedObjectInput);

      try {
        const now = nowIso();
        const evidence: FrigoraVisitEvidence = {
          id: createId<FrigoraVisitEvidenceId>(),
          workspaceId: visit.workspaceId,
          ventureId: visit.ventureId,
          visitId: visit.id,
          workOrderId: workOrder.id,
          assetId,
          storedObjectId: storedMetadata.id,
          category: parsed.category,
          description: parsed.description ?? null,
          capturedAt: now,
          recordedByUserId,
          createdAt: now,
          removedAt: null,
          originalFilename: storedMetadata.originalFilename,
          mimeType: storedMetadata.mimeType,
          sizeBytes: storedMetadata.sizeBytes,
        };
        const receipt: FrigoraClientOperationReceipt = {
          id: createId<FrigoraClientOperationReceiptId>(),
          workspaceId: evidence.workspaceId,
          ventureId: evidence.ventureId,
          actorUserId: scope.userId,
          clientOperationId,
          operationType: "recordVisitEvidence",
          workOrderId: evidence.workOrderId,
          visitId: evidence.visitId,
          requestFingerprint: fingerprint,
          acceptedEntityId: evidence.id,
          acceptedAt: now,
          createdAt: now,
        };
        await store.insertVisitEvidenceWithClientOperationReceipt(evidence, receipt);
        return { evidence, receipt, duplicate: false };
      } catch (error) {
        // Keep the durable reserved object for same-operation retry. It may already
        // belong to a concurrent accepted receipt; deleting it would corrupt that evidence.
        if (isFrigoraError(error) && error.code === "duplicate") {
          const raced = await store.findClientOperationReceipt(
            scope.ventureId,
            clientOperationId,
          );
          if (!raced) {
            throw error;
          }
          return resolveExistingClientVisitEvidenceAcceptance({
            store,
            scope,
            visitId,
            workOrderId: workOrderIdInput,
            fingerprint,
            receipt: raced,
          });
        }
        throw error;
      }
    },
    async lookupClientOperationAcceptance(scope, input) {
      await assertFrigoraAccess(await permissionService(), scope, "venture.read");
      return readClientOperationAcceptance(store, scope, input);
    },
    async linkVisitEvidence(scope, visitId, input) {
      await assertFrigoraAccess(await permissionService(), scope, "venture.update");
      const visit = await requireVisit(store, scope, visitId);
      assertVisitAcceptsVisitEvidence(visit);
      requireOpenVisitForEvidence(visit);
      const workOrder = await requireOpenWorkOrder(store, scope, visit.workOrderId);
      const parsed = parseWithFrigora(linkVisitEvidenceSchema, input);
      const recordedByUserId = parsed.userId as UserId;
      await requireWorkspaceMember(scope.workspaceId, recordedByUserId);
      const assetId = await resolveVisitEvidenceAsset(
        store,
        scope,
        workOrder,
        parsed.assetId === undefined ? null : parsed.assetId,
      );
      const storedMetadata = await validateStoredObjectForEvidenceLink(
        store,
        scope,
        parsed.storedObjectId as StoredObjectId,
      );
      return await insertVisitEvidenceRow(
        store,
        scope,
        visit,
        workOrder,
        assetId,
        storedMetadata,
        parsed.category,
        parsed.description ?? null,
        recordedByUserId,
      );
    },
    async getVisitEvidence(scope, id) {
      if (!(await allowFrigoraRead(await permissionService(), scope))) {
        return null;
      }
      return store.findVisitEvidence(scope.workspaceId, scope.ventureId, id);
    },
    async listVisitEvidenceByVisit(scope, visitId) {
      if (!(await allowFrigoraRead(await permissionService(), scope))) {
        return [];
      }
      const visit = await store.findVisit(scope.workspaceId, scope.ventureId, visitId);
      if (!visit) {
        return [];
      }
      return store.listActiveVisitEvidenceByVisit(
        scope.workspaceId,
        scope.ventureId,
        visitId,
      );
    },
    async listVisitEvidenceByWorkOrder(scope, workOrderId) {
      if (!(await allowFrigoraRead(await permissionService(), scope))) {
        return [];
      }
      const workOrder = await store.findWorkOrder(
        scope.workspaceId,
        scope.ventureId,
        workOrderId,
      );
      if (!workOrder) {
        return [];
      }
      return store.listActiveVisitEvidenceByWorkOrder(
        scope.workspaceId,
        scope.ventureId,
        workOrderId,
      );
    },
    async removeVisitEvidence(scope, id) {
      await assertFrigoraAccess(await permissionService(), scope, "venture.read");
      const existing = await store.findVisitEvidence(scope.workspaceId, scope.ventureId, id);
      if (!existing || existing.removedAt) {
        throw new FrigoraError("not_found", "Visit evidence was not found.");
      }
      const visit = await requireVisit(store, scope, existing.visitId);
      requireOpenVisitForEvidence(visit);
      assertVisitAcceptsVisitEvidence(visit);
      const workOrder = await requireOpenWorkOrder(store, scope, visit.workOrderId);
      const authority = await assertWorkOrderOperationalAccess(
        await permissionService(),
        scope,
        workOrder,
      );
      const tombstoned: FrigoraVisitEvidence = {
        ...existing,
        removedAt: nowIso(),
      };
      await store.updateVisitEvidence(tombstoned);
      try {
        const deleteInput = {
          actorUserId: scope.userId,
          activeWorkspaceId: scope.workspaceId,
          objectId: existing.storedObjectId,
        };
        if (authority === "venture_update") {
          await getPlatform().storedObjects.delete(deleteInput);
        } else {
          await getPlatform().storedObjects.deleteForDomain({
            ...deleteInput,
            authority: assignedWorkOrderStorageAuthority(workOrder.id),
          });
        }
      } catch (error) {
        if (error instanceof StoredObjectError) {
          throw new FrigoraError(
            "evidence_bytes_delete_failed",
            "Evidence was removed but stored object bytes could not be deleted.",
          );
        }
        throw error;
      }
      return tombstoned;
    },
    async listAssetHistory(scope, assetId) {
      if (!(await allowFrigoraRead(await permissionService(), scope))) {
        return [];
      }
      const asset = await store.findAsset(scope.workspaceId, scope.ventureId, assetId);
      if (!asset) {
        return [];
      }

      const entries: FrigoraAssetHistoryEntry[] = [];
      const workOrders = await store.listWorkOrdersByAsset(
        scope.workspaceId,
        scope.ventureId,
        assetId,
      );

      for (const workOrder of workOrders) {
        if (workOrder.reportedCondition !== null) {
          entries.push(mapReportedIntakeEntry(assetId, workOrder));
        }
        const visits = await store.listVisitsByWorkOrder(
          scope.workspaceId,
          scope.ventureId,
          workOrder.id,
        );
        for (const visit of visits) {
          entries.push(mapVisitArrivalEntry(assetId, visit));
          if (visit.departedAt !== null) {
            entries.push(mapVisitDepartureEntry(assetId, visit));
          }
        }
      }

      const [
        fieldCaptures,
        findings,
        correctiveActions,
        outcomes,
        recommendations,
        refrigerantEvents,
        partUsages,
        operationalConditions,
      ] = await Promise.all([
        store.listFieldCapturesByAsset(scope.workspaceId, scope.ventureId, assetId),
        store.listTechnicalFindingsByAsset(scope.workspaceId, scope.ventureId, assetId),
        store.listCorrectiveActionsByAsset(scope.workspaceId, scope.ventureId, assetId),
        store.listVisitOutcomesByAsset(scope.workspaceId, scope.ventureId, assetId),
        store.listRecommendedActionsByAsset(scope.workspaceId, scope.ventureId, assetId),
        store.listRefrigerantEventsByAsset(scope.workspaceId, scope.ventureId, assetId),
        store.listPartUsagesByAsset(scope.workspaceId, scope.ventureId, assetId),
        store.listAssetOperationalConditionsByAsset(scope.workspaceId, scope.ventureId, assetId),
      ]);

      for (const fieldCapture of fieldCaptures) {
        entries.push(mapObservedEntry(fieldCapture));
      }
      for (const finding of findings) {
        entries.push(mapFindingEntry(finding));
      }
      for (const correctiveAction of correctiveActions) {
        entries.push(mapCorrectiveActionEntry(correctiveAction));
      }
      for (const outcome of outcomes) {
        entries.push(mapOutcomeEntry(outcome));
      }
      for (const recommendation of recommendations) {
        entries.push(mapRecommendationEntry(recommendation));
      }
      for (const refrigerantEvent of refrigerantEvents) {
        entries.push(mapRefrigerantEntry(refrigerantEvent));
      }
      for (const partUsage of partUsages) {
        entries.push(mapPartUsageEntry(partUsage));
      }
      for (const operationalCondition of operationalConditions) {
        entries.push(mapOperationalConditionEntry(operationalCondition));
      }

      return sortAssetHistoryEntries(entries);
    },
  };
}

let service: FrigoraService | undefined;

export function getFrigoraService(): FrigoraService {
  if (!service) {
    service = createFrigoraService();
  }
  return service;
}

function assetHistoryKindOrder(kind: FrigoraAssetHistoryEventKind): number {
  return FRIGORA_ASSET_HISTORY_EVENT_KINDS.indexOf(kind);
}

function sortAssetHistoryEntries(entries: FrigoraAssetHistoryEntry[]): FrigoraAssetHistoryEntry[] {
  return [...entries].sort((left, right) => {
    if (left.occurredAt !== right.occurredAt) {
      return left.occurredAt < right.occurredAt ? -1 : 1;
    }
    const kindDiff = assetHistoryKindOrder(left.kind) - assetHistoryKindOrder(right.kind);
    if (kindDiff !== 0) {
      return kindDiff;
    }
    return left.sourceId < right.sourceId ? -1 : left.sourceId > right.sourceId ? 1 : 0;
  });
}

function mapReportedIntakeEntry(
  assetId: FrigoraAssetId,
  workOrder: FrigoraWorkOrder,
): FrigoraAssetHistoryEntry {
  return {
    kind: "reported_intake",
    sourceId: workOrder.id,
    assetId,
    visitId: null,
    workOrderId: workOrder.id,
    occurredAt: workOrder.createdAt,
    recordedAt: workOrder.createdAt,
    actorUserId: null,
    recordedByUserId: null,
    detail: {
      workReference: workOrder.workReference,
      reportedCondition: workOrder.reportedCondition as string,
      workKind: workOrder.workKind,
    },
  };
}

function mapVisitArrivalEntry(
  assetId: FrigoraAssetId,
  visit: FrigoraVisit,
): FrigoraAssetHistoryEntry {
  return {
    kind: "visit_arrival",
    sourceId: visit.id,
    assetId,
    visitId: visit.id,
    workOrderId: visit.workOrderId,
    occurredAt: visit.arrivedAt,
    recordedAt: visit.createdAt,
    actorUserId: visit.attendingUserId,
    recordedByUserId: null,
    detail: {
      status: visit.status,
      attendingUserId: visit.attendingUserId,
    },
  };
}

function mapVisitDepartureEntry(
  assetId: FrigoraAssetId,
  visit: FrigoraVisit,
): FrigoraAssetHistoryEntry {
  return {
    kind: "visit_departure",
    sourceId: visit.id,
    assetId,
    visitId: visit.id,
    workOrderId: visit.workOrderId,
    occurredAt: visit.departedAt as string,
    recordedAt: visit.updatedAt,
    actorUserId: visit.attendingUserId,
    recordedByUserId: null,
    detail: {
      status: visit.status,
      attendingUserId: visit.attendingUserId,
    },
  };
}

function mapObservedEntry(fieldCapture: FrigoraFieldCapture): FrigoraAssetHistoryEntry {
  return {
    kind: "observed",
    sourceId: fieldCapture.id,
    assetId: fieldCapture.assetId as FrigoraAssetId,
    visitId: fieldCapture.visitId,
    workOrderId: fieldCapture.workOrderId,
    occurredAt: fieldCapture.observedAt,
    recordedAt: fieldCapture.createdAt,
    actorUserId: fieldCapture.capturedByUserId,
    recordedByUserId: null,
    detail: {
      captureKind: fieldCapture.captureKind,
      captureCode: fieldCapture.captureCode,
      valueNumeric: fieldCapture.valueNumeric,
      valueUnit: fieldCapture.valueUnit,
      description: fieldCapture.description,
    },
  };
}

function mapFindingEntry(finding: FrigoraTechnicalFinding): FrigoraAssetHistoryEntry {
  return {
    kind: "finding",
    sourceId: finding.id,
    assetId: finding.assetId as FrigoraAssetId,
    visitId: finding.visitId,
    workOrderId: finding.workOrderId,
    occurredAt: finding.assertedAt,
    recordedAt: finding.createdAt,
    actorUserId: finding.recordedByUserId,
    recordedByUserId: finding.recordedByUserId,
    detail: {
      findingKind: finding.findingKind,
      description: finding.description,
    },
  };
}

function mapCorrectiveActionEntry(action: FrigoraCorrectiveAction): FrigoraAssetHistoryEntry {
  return {
    kind: "corrective_action",
    sourceId: action.id,
    assetId: action.assetId as FrigoraAssetId,
    visitId: action.visitId,
    workOrderId: action.workOrderId,
    occurredAt: action.performedAt,
    recordedAt: action.createdAt,
    actorUserId: action.performedByUserId,
    recordedByUserId: action.recordedByUserId,
    detail: {
      description: action.description,
    },
  };
}

function mapPartUsageEntry(partUsage: FrigoraPartUsage): FrigoraAssetHistoryEntry {
  return {
    kind: "part_usage",
    sourceId: partUsage.id,
    assetId: partUsage.assetId as FrigoraAssetId,
    visitId: partUsage.visitId,
    workOrderId: partUsage.workOrderId,
    occurredAt: partUsage.usedAt,
    recordedAt: partUsage.createdAt,
    actorUserId: partUsage.usedByUserId,
    recordedByUserId: partUsage.recordedByUserId,
    detail: {
      partDescription: partUsage.partDescription,
      quantity: partUsage.quantity,
      quantityUnit: partUsage.quantityUnit,
      notes: partUsage.notes,
    },
  };
}

function mapRefrigerantEntry(event: FrigoraRefrigerantEvent): FrigoraAssetHistoryEntry {
  return {
    kind: "refrigerant",
    sourceId: event.id,
    assetId: event.assetId as FrigoraAssetId,
    visitId: event.visitId,
    workOrderId: event.workOrderId,
    occurredAt: event.occurredAt,
    recordedAt: event.createdAt,
    actorUserId: event.handledByUserId,
    recordedByUserId: event.recordedByUserId,
    detail: {
      refrigerantType: event.refrigerantType,
      eventKind: event.eventKind,
      quantityKg: event.quantityKg,
      reason: event.reason,
      cylinderReference: event.cylinderReference,
    },
  };
}

function mapOutcomeEntry(outcome: FrigoraVisitOutcome): FrigoraAssetHistoryEntry {
  return {
    kind: "outcome",
    sourceId: outcome.id,
    assetId: outcome.assetId as FrigoraAssetId,
    visitId: outcome.visitId,
    workOrderId: outcome.workOrderId,
    occurredAt: outcome.outcomeAt,
    recordedAt: outcome.createdAt,
    actorUserId: null,
    recordedByUserId: outcome.recordedByUserId,
    detail: {
      description: outcome.description,
    },
  };
}

function mapRecommendationEntry(
  recommendation: FrigoraRecommendedAction,
): FrigoraAssetHistoryEntry {
  return {
    kind: "recommendation",
    sourceId: recommendation.id,
    assetId: recommendation.assetId as FrigoraAssetId,
    visitId: recommendation.visitId,
    workOrderId: recommendation.workOrderId,
    occurredAt: recommendation.recommendedAt,
    recordedAt: recommendation.createdAt,
    actorUserId: recommendation.recommendedByUserId,
    recordedByUserId: recommendation.recordedByUserId,
    detail: {
      description: recommendation.description,
    },
  };
}

function mapOperationalConditionEntry(
  condition: FrigoraAssetOperationalCondition,
): FrigoraAssetHistoryEntry {
  return {
    kind: "operational_condition",
    sourceId: condition.id,
    assetId: condition.assetId,
    visitId: condition.visitId,
    workOrderId: condition.workOrderId,
    occurredAt: condition.assertedAt,
    recordedAt: condition.createdAt,
    actorUserId: condition.assertedByUserId,
    recordedByUserId: condition.recordedByUserId,
    detail: {
      conditionKind: condition.conditionKind,
      notes: condition.notes,
    },
  };
}

function selectCurrentAssetOperationalCondition(
  rows: FrigoraAssetOperationalCondition[],
): FrigoraAssetOperationalCondition | null {
  if (rows.length === 0) {
    return null;
  }
  let current = rows[0]!;
  for (let index = 1; index < rows.length; index += 1) {
    const candidate = rows[index]!;
    if (candidate.assertedAt > current.assertedAt) {
      current = candidate;
      continue;
    }
    if (candidate.assertedAt === current.assertedAt && candidate.id > current.id) {
      current = candidate;
    }
  }
  return current;
}

async function resolveOperationalConditionContext(
  store: FrigoraStore,
  scope: FrigoraScope,
  assetId: FrigoraAssetId,
  visitIdInput: string | null,
  workOrderIdInput: string | null,
): Promise<{
  visitId: FrigoraVisitId | null;
  workOrderId: FrigoraWorkOrderId | null;
}> {
  let visitId: FrigoraVisitId | null = null;
  let workOrderId: FrigoraWorkOrderId | null = null;

  if (workOrderIdInput !== null) {
    const workOrder = await requireWorkOrder(
      store,
      scope,
      workOrderIdInput as FrigoraWorkOrderId,
    );
    if (workOrder.primaryAssetId !== assetId) {
      throw new FrigoraError(
        "invalid_input",
        "Work order primary asset must match the asserted asset.",
      );
    }
    workOrderId = workOrder.id;
  }

  if (visitIdInput !== null) {
    const visit = await requireVisit(store, scope, visitIdInput as FrigoraVisitId);
    if (visit.status === "cancelled") {
      throw new FrigoraError(
        "invalid_status",
        "Cancelled visits cannot receive operational condition context.",
      );
    }
    const visitWorkOrder = await requireWorkOrder(store, scope, visit.workOrderId);
    if (visitWorkOrder.primaryAssetId !== assetId) {
      throw new FrigoraError(
        "invalid_input",
        "Visit work order primary asset must match the asserted asset.",
      );
    }
    if (workOrderId !== null && visit.workOrderId !== workOrderId) {
      throw new FrigoraError(
        "invalid_input",
        "Visit must belong to the supplied work order.",
      );
    }
    visitId = visit.id;
  }

  return { visitId, workOrderId };
}

async function allowFrigoraRead(permissions: PermissionService, scope: FrigoraScope) {
  const allowed = await permissions.can({
    userId: scope.userId,
    permission: "venture.read",
    resource: { type: "workspace", id: scope.workspaceId },
  });
  if (!allowed) {
    throw new FrigoraError("forbidden", "Not allowed.");
  }
  const venture = await getPersistence().ventures.findById(scope.ventureId);
  return Boolean(
    venture && venture.workspaceId === scope.workspaceId && venture.definitionId === "frigora",
  );
}

async function assertFrigoraAccess(
  permissions: PermissionService,
  scope: FrigoraScope,
  permission: Permission,
) {
  const allowed = await permissions.can({
    userId: scope.userId,
    permission,
    resource: { type: "workspace", id: scope.workspaceId },
  });
  if (!allowed) {
    throw new FrigoraError("forbidden", "Not allowed.");
  }

  const venture = await getPersistence().ventures.findById(scope.ventureId);
  if (!venture || venture.workspaceId !== scope.workspaceId) {
    throw new FrigoraError("not_found", "Venture was not found.");
  }
  if (venture.definitionId !== "frigora") {
    throw new FrigoraError(
      "not_frigora",
      "Frigora operational records can only belong to a Frigora venture.",
    );
  }
}

type WorkOrderOperationalAuthority = "venture_update" | "assigned_engineer";

async function assertWorkOrderOperationalAccess(
  permissions: PermissionService,
  scope: FrigoraScope,
  workOrder: FrigoraWorkOrder,
): Promise<WorkOrderOperationalAuthority> {
  const hasHigherAuthority = await permissions.can({
    userId: scope.userId,
    permission: "venture.update",
    resource: { type: "workspace", id: scope.workspaceId },
  });
  if (hasHigherAuthority) {
    await assertFrigoraAccess(permissions, scope, "venture.update");
    return "venture_update";
  }

  await assertFrigoraAccess(permissions, scope, "venture.read");
  if (workOrder.assignedUserId !== scope.userId) {
    throw new FrigoraError(
      "forbidden",
      "Engineer operational access requires the current WorkOrder assignment.",
    );
  }
  return "assigned_engineer";
}

function assertAssignedEngineerActorIdentity(
  authority: WorkOrderOperationalAuthority,
  scope: FrigoraScope,
  ...actorUserIds: UserId[]
) {
  if (
    authority === "assigned_engineer" &&
    actorUserIds.some((userId) => userId !== scope.userId)
  ) {
    throw new FrigoraError(
      "forbidden",
      "Assigned engineers may record operational facts only as themselves.",
    );
  }
}

function assignedWorkOrderStorageAuthority(workOrderId: FrigoraWorkOrderId) {
  return issueDomainAuthorizedMutation({
    domain: "frigora",
    relation: "assigned_work_order",
    resourceId: workOrderId,
  });
}

async function requireCustomer(
  store: FrigoraStore,
  scope: FrigoraScope,
  id: FrigoraCustomerId,
) {
  const row = await store.findCustomer(scope.workspaceId, scope.ventureId, id);
  if (!row) {
    throw new FrigoraError("not_found", "Customer was not found.");
  }
  return row;
}

async function requireSite(store: FrigoraStore, scope: FrigoraScope, id: FrigoraSiteId) {
  const row = await store.findSite(scope.workspaceId, scope.ventureId, id);
  if (!row) {
    throw new FrigoraError("not_found", "Site was not found.");
  }
  return row;
}

async function requireAsset(store: FrigoraStore, scope: FrigoraScope, id: FrigoraAssetId) {
  const row = await store.findAsset(scope.workspaceId, scope.ventureId, id);
  if (!row) {
    throw new FrigoraError("not_found", "Asset was not found.");
  }
  return row;
}

async function requireWorkOrder(
  store: FrigoraStore,
  scope: FrigoraScope,
  id: FrigoraWorkOrderId,
) {
  const row = await store.findWorkOrder(scope.workspaceId, scope.ventureId, id);
  if (!row) {
    throw new FrigoraError("not_found", "Work order was not found.");
  }
  return row;
}

async function requireOpenWorkOrder(
  store: FrigoraStore,
  scope: FrigoraScope,
  id: FrigoraWorkOrderId,
) {
  const row = await requireWorkOrder(store, scope, id);
  if (row.status !== "open") {
    throw new FrigoraError(
      "invalid_status",
      "Work orders can only be updated while open.",
    );
  }
  return row;
}

async function assertWorkOrderMayComplete(
  store: FrigoraStore,
  scope: FrigoraScope,
  workOrderId: FrigoraWorkOrderId,
) {
  const visits = await store.listVisitsByWorkOrder(
    scope.workspaceId,
    scope.ventureId,
    workOrderId,
  );
  if (visits.length === 0) {
    throw new FrigoraError(
      "invalid_status",
      "A work order can be completed only after at least one visit exists.",
    );
  }
  if (visits.some((visit) => visit.status === "open")) {
    throw new FrigoraError(
      "invalid_status",
      "A work order cannot be completed while a visit is still open.",
    );
  }
  const departed = visits.filter((visit) => visit.status === "departed");
  if (departed.length === 0) {
    throw new FrigoraError(
      "invalid_status",
      "A work order can be completed only when at least one visit has departed.",
    );
  }
  const outcomes = await store.listVisitOutcomesByWorkOrder(
    scope.workspaceId,
    scope.ventureId,
    workOrderId,
  );
  const departedIds = new Set(departed.map((visit) => visit.id));
  if (!outcomes.some((outcome) => departedIds.has(outcome.visitId))) {
    throw new FrigoraError(
      "invalid_status",
      "A work order can be completed only when at least one departed visit has a visit outcome.",
    );
  }
}

function assertExpectedDispatchToken(
  existing: FrigoraWorkOrder,
  expectedUpdatedAt: string,
) {
  if (existing.updatedAt !== expectedUpdatedAt) {
    throw new FrigoraError("dispatch_conflict", FRIGORA_DISPATCH_CONFLICT_MESSAGE);
  }
}

function responseStampsAreClear(workOrder: FrigoraWorkOrder): boolean {
  return (
    workOrder.assignmentAcceptedAt === null &&
    workOrder.assignmentDeclinedAt === null &&
    workOrder.assignmentDeclineReason === null
  );
}

function buildDispatchEvent(args: {
  workOrder: FrigoraWorkOrder;
  actorUserId: UserId;
  eventType: FrigoraDispatchEventType;
  occurredAt: string;
  previousAssignedUserId: UserId | null;
  nextAssignedUserId: UserId | null;
  previousScheduledStartAt: string | null;
  previousScheduledEndAt: string | null;
  nextScheduledStartAt: string | null;
  nextScheduledEndAt: string | null;
}): FrigoraDispatchEvent {
  return {
    id: createId<FrigoraDispatchEventId>(),
    workspaceId: args.workOrder.workspaceId,
    ventureId: args.workOrder.ventureId,
    workOrderId: args.workOrder.id,
    eventType: args.eventType,
    actorUserId: args.actorUserId,
    occurredAt: args.occurredAt,
    previousAssignedUserId: args.previousAssignedUserId,
    nextAssignedUserId: args.nextAssignedUserId,
    previousScheduledStartAt: args.previousScheduledStartAt,
    previousScheduledEndAt: args.previousScheduledEndAt,
    nextScheduledStartAt: args.nextScheduledStartAt,
    nextScheduledEndAt: args.nextScheduledEndAt,
  };
}

async function assertWorkOrderHasNoOpenVisit(
  store: FrigoraStore,
  scope: FrigoraScope,
  workOrderId: FrigoraWorkOrderId,
) {
  const visits = await store.listVisitsByWorkOrder(
    scope.workspaceId,
    scope.ventureId,
    workOrderId,
  );
  if (visits.some((visit) => visit.status === "open")) {
    throw new FrigoraError(
      "invalid_status",
      "A work order cannot be changed while a visit is still open.",
    );
  }
}

function assertCurrentAssignmentMayRespond(
  workOrder: FrigoraWorkOrder,
  actingUserId: UserId,
) {
  if (workOrder.assignedUserId === null || workOrder.assignedUserId !== actingUserId) {
    throw new FrigoraError(
      "forbidden",
      "Only the current assignee can respond to this assignment.",
    );
  }
  if (
    workOrder.assignmentAcceptedAt !== null ||
    workOrder.assignmentDeclinedAt !== null
  ) {
    throw new FrigoraError(
      "invalid_status",
      "The current assignment already has a response.",
    );
  }
}

function assertHasScheduledServiceWindow(workOrder: FrigoraWorkOrder) {
  if (
    workOrder.scheduledStartAt === null ||
    workOrder.scheduledEndAt === null
  ) {
    throw new FrigoraError(
      "invalid_status",
      "Assignment responses require a scheduled service window.",
    );
  }
}

async function requireVisit(
  store: FrigoraStore,
  scope: FrigoraScope,
  id: FrigoraVisitId,
) {
  const row = await store.findVisit(scope.workspaceId, scope.ventureId, id);
  if (!row) {
    throw new FrigoraError("not_found", "Visit was not found.");
  }
  return row;
}

async function requireOpenVisit(
  store: FrigoraStore,
  scope: FrigoraScope,
  id: FrigoraVisitId,
) {
  const row = await requireVisit(store, scope, id);
  if (row.status !== "open") {
    throw new FrigoraError(
      "invalid_status",
      "Visits can only be updated while open.",
    );
  }
  return row;
}

function assertDepartedAfterArrived(arrivedAt: string, departedAt: string) {
  if (Date.parse(departedAt) < Date.parse(arrivedAt)) {
    throw new FrigoraError(
      "invalid_input",
      "Departure must not precede arrival.",
    );
  }
}

function assertVisitAcceptsVisitEvidence(visit: FrigoraVisit) {
  if (visit.status === "cancelled") {
    throw new FrigoraError(
      "invalid_status",
      "Visit evidence cannot be recorded against a cancelled visit.",
    );
  }
}

function requireOpenVisitForEvidence(visit: FrigoraVisit) {
  if (visit.status !== "open") {
    throw new FrigoraError(
      "invalid_status",
      "Visit evidence can only be changed while the visit is open.",
    );
  }
}

async function resolveVisitEvidenceAsset(
  store: FrigoraStore,
  scope: FrigoraScope,
  workOrder: FrigoraWorkOrder,
  assetIdInput: string | null | undefined,
): Promise<FrigoraAssetId | null> {
  if (assetIdInput === undefined || assetIdInput === null || assetIdInput.trim().length === 0) {
    return workOrder.primaryAssetId ?? null;
  }
  return resolveFieldCaptureAsset(store, scope, workOrder, assetIdInput);
}

async function validateStoredObjectForEvidenceLink(
  store: FrigoraStore,
  scope: FrigoraScope,
  storedObjectId: StoredObjectId,
) {
  const row = await findStoredObjectById(storedObjectId);
  if (!row || row.deletedAt) {
    throw new FrigoraError("not_found", "Stored object was not found.");
  }
  if (row.workspaceId !== scope.workspaceId || row.ventureId !== scope.ventureId) {
    throw new FrigoraError("forbidden", "Stored object does not match this venture.");
  }
  const existing = await store.findVisitEvidenceByStoredObjectId(
    scope.ventureId,
    storedObjectId,
  );
  if (existing) {
    throw new FrigoraError(
      "duplicate",
      "Stored object is already linked to evidence in this venture.",
    );
  }
  return row;
}

async function insertVisitEvidenceRow(
  store: FrigoraStore,
  scope: FrigoraScope,
  visit: FrigoraVisit,
  workOrder: FrigoraWorkOrder,
  assetId: FrigoraAssetId | null,
  storedMetadata: {
    id: StoredObjectId;
    originalFilename: string;
    mimeType: string;
    sizeBytes: number;
  },
  category: FrigoraVisitEvidence["category"],
  description: string | null,
  recordedByUserId: UserId,
): Promise<FrigoraVisitEvidence> {
  const now = nowIso();
  const evidence: FrigoraVisitEvidence = {
    id: createId<FrigoraVisitEvidenceId>(),
    workspaceId: visit.workspaceId,
    ventureId: visit.ventureId,
    visitId: visit.id,
    workOrderId: workOrder.id,
    assetId,
    storedObjectId: storedMetadata.id,
    category,
    description,
    capturedAt: now,
    recordedByUserId,
    createdAt: now,
    removedAt: null,
    originalFilename: storedMetadata.originalFilename,
    mimeType: storedMetadata.mimeType,
    sizeBytes: storedMetadata.sizeBytes,
  };
  await store.insertVisitEvidence(evidence);
  return evidence;
}

function assertVisitAcceptsFieldCapture(visit: FrigoraVisit) {
  if (visit.status === "cancelled") {
    throw new FrigoraError(
      "invalid_status",
      "Field captures cannot be recorded against a cancelled visit.",
    );
  }
}

function assertVisitAcceptsTechnicalFinding(visit: FrigoraVisit) {
  if (visit.status === "cancelled") {
    throw new FrigoraError(
      "invalid_status",
      "Technical findings cannot be recorded against a cancelled visit.",
    );
  }
}

async function prepareTechnicalFindingRow(
  store: FrigoraStore,
  permissions: PermissionService,
  scope: FrigoraScope,
  visitId: FrigoraVisitId,
  input: RecordTechnicalFindingInput,
): Promise<FrigoraTechnicalFinding> {
  await assertFrigoraAccess(permissions, scope, "venture.read");
  const visit = await requireVisit(store, scope, visitId);
  assertVisitAcceptsTechnicalFinding(visit);
  const workOrder = await requireWorkOrder(store, scope, visit.workOrderId);
  const authority = await assertWorkOrderOperationalAccess(permissions, scope, workOrder);
  const parsed = parseWithFrigora(recordTechnicalFindingSchema, input);
  assertAssertedAtWithinVisit(visit, parsed.assertedAt);
  const recordedByUserId = parsed.userId as UserId;
  assertAssignedEngineerActorIdentity(authority, scope, recordedByUserId);
  await requireWorkspaceMember(scope.workspaceId, recordedByUserId);
  const assetId = await resolveFieldCaptureAsset(
    store,
    scope,
    workOrder,
    parsed.assetId === undefined ? null : parsed.assetId,
  );
  const sourceFieldCaptureIds = await resolveSourceFieldCaptureIds(
    store,
    scope,
    visit,
    parsed.sourceFieldCaptureIds,
  );
  const now = nowIso();
  return {
    id: createId<FrigoraTechnicalFindingId>(),
    workspaceId: visit.workspaceId,
    ventureId: visit.ventureId,
    visitId: visit.id,
    workOrderId: visit.workOrderId,
    assetId,
    findingKind: parsed.findingKind,
    description: parsed.description,
    sourceFieldCaptureIds,
    assertedAt: parsed.assertedAt,
    recordedByUserId,
    createdAt: now,
    updatedAt: now,
  };
}

async function resolveExistingClientTechnicalFindingAcceptance(input: {
  store: FrigoraStore;
  scope: FrigoraScope;
  visitId: FrigoraVisitId;
  workOrderId: string;
  clientOperationId: string;
  fingerprint: string;
  receipt: FrigoraClientOperationReceipt;
}): Promise<SubmitClientTechnicalFindingResult> {
  const { store, scope, visitId, workOrderId, fingerprint, receipt } = input;
  if (receipt.actorUserId !== scope.userId) {
    throw new FrigoraError(
      "forbidden",
      "Client operation receipt belongs to a different actor partition.",
    );
  }
  if (receipt.operationType !== "recordTechnicalFinding") {
    throw new FrigoraError(
      "idempotency_conflict",
      "Client operation id was previously used for a different operation type.",
    );
  }
  if (receipt.visitId !== visitId || receipt.workOrderId !== workOrderId) {
    throw new FrigoraError(
      "idempotency_conflict",
      "Client operation id was previously accepted for a different visit or work order.",
    );
  }
  if (receipt.requestFingerprint !== fingerprint) {
    throw new FrigoraError(
      "idempotency_conflict",
      "Client operation id was previously accepted with a different request fingerprint.",
    );
  }
  const finding = await store.findTechnicalFinding(
    scope.workspaceId,
    scope.ventureId,
    receipt.acceptedEntityId as FrigoraTechnicalFindingId,
  );
  if (!finding) {
    throw new FrigoraError(
      "not_found",
      "Authoritative receipt exists but accepted technical finding was not found.",
    );
  }
  return { finding, receipt, duplicate: true };
}

async function prepareFieldCaptureRow(
  store: FrigoraStore,
  permissions: PermissionService,
  scope: FrigoraScope,
  visitId: FrigoraVisitId,
  input: RecordFieldCaptureInput,
): Promise<FrigoraFieldCapture> {
  await assertFrigoraAccess(permissions, scope, "venture.read");
  const visit = await requireVisit(store, scope, visitId);
  assertVisitAcceptsFieldCapture(visit);
  const workOrder = await requireWorkOrder(store, scope, visit.workOrderId);
  const authority = await assertWorkOrderOperationalAccess(permissions, scope, workOrder);
  const parsed = parseWithFrigora(recordFieldCaptureSchema, input);
  assertObservedAtWithinVisit(visit, parsed.observedAt);
  const capturedByUserId = parsed.userId as UserId;
  assertAssignedEngineerActorIdentity(authority, scope, capturedByUserId);
  await requireWorkspaceMember(scope.workspaceId, capturedByUserId);
  const assetId = await resolveFieldCaptureAsset(
    store,
    scope,
    workOrder,
    parsed.assetId === undefined ? null : parsed.assetId,
  );
  const now = nowIso();
  return {
    id: createId<FrigoraFieldCaptureId>(),
    workspaceId: visit.workspaceId,
    ventureId: visit.ventureId,
    visitId: visit.id,
    workOrderId: visit.workOrderId,
    assetId,
    captureKind: parsed.captureKind,
    captureCode: parsed.captureCode,
    valueNumeric:
      parsed.captureKind === "measurement" ? (parsed.valueNumeric as number) : null,
    valueUnit:
      parsed.captureKind === "measurement"
        ? (parsed.valueUnit as FrigoraFieldCapture["valueUnit"])
        : null,
    description:
      parsed.captureKind === "condition"
        ? (parsed.description as string)
        : (parsed.description ?? null),
    observedAt: parsed.observedAt,
    capturedByUserId,
    createdAt: now,
    updatedAt: now,
  };
}

async function resolveExistingClientFieldCaptureAcceptance(input: {
  store: FrigoraStore;
  scope: FrigoraScope;
  visitId: FrigoraVisitId;
  workOrderId: string;
  clientOperationId: string;
  fingerprint: string;
  receipt: FrigoraClientOperationReceipt;
}): Promise<SubmitClientFieldCaptureResult> {
  const { store, scope, visitId, workOrderId, fingerprint, receipt } = input;
  if (receipt.actorUserId !== scope.userId) {
    throw new FrigoraError(
      "forbidden",
      "Client operation receipt belongs to a different actor partition.",
    );
  }
  if (receipt.operationType !== "recordFieldCapture") {
    throw new FrigoraError(
      "idempotency_conflict",
      "Client operation id was previously used for a different operation type.",
    );
  }
  if (receipt.visitId !== visitId || receipt.workOrderId !== workOrderId) {
    throw new FrigoraError(
      "idempotency_conflict",
      "Client operation id was previously accepted for a different visit or work order.",
    );
  }
  if (receipt.requestFingerprint !== fingerprint) {
    throw new FrigoraError(
      "idempotency_conflict",
      "Client operation id was previously accepted with a different request fingerprint.",
    );
  }
  const capture = await store.findFieldCapture(
    scope.workspaceId,
    scope.ventureId,
    receipt.acceptedEntityId as FrigoraFieldCaptureId,
  );
  if (!capture) {
    throw new FrigoraError(
      "not_found",
      "Authoritative receipt exists but accepted field capture was not found.",
    );
  }
  return { capture, receipt, duplicate: true };
}

async function resolveExistingClientVisitEvidenceAcceptance(input: {
  store: FrigoraStore;
  scope: FrigoraScope;
  visitId: FrigoraVisitId;
  workOrderId: string;
  fingerprint: string;
  receipt: FrigoraClientOperationReceipt;
}): Promise<SubmitClientVisitEvidenceResult> {
  const { store, scope, visitId, workOrderId, fingerprint, receipt } = input;
  if (receipt.actorUserId !== scope.userId) {
    throw new FrigoraError(
      "forbidden",
      "Client operation receipt belongs to a different actor partition.",
    );
  }
  if (receipt.operationType !== "recordVisitEvidence") {
    throw new FrigoraError(
      "idempotency_conflict",
      "Client operation id was previously used for a different operation type.",
    );
  }
  if (receipt.visitId !== visitId || receipt.workOrderId !== workOrderId) {
    throw new FrigoraError(
      "idempotency_conflict",
      "Client operation id was previously accepted for a different visit or work order.",
    );
  }
  if (receipt.requestFingerprint !== fingerprint) {
    throw new FrigoraError(
      "idempotency_conflict",
      "Client operation id was previously accepted with a different request fingerprint.",
    );
  }
  const evidence = await store.findVisitEvidence(
    scope.workspaceId,
    scope.ventureId,
    receipt.acceptedEntityId as FrigoraVisitEvidenceId,
  );
  if (!evidence) {
    throw new FrigoraError(
      "not_found",
      "Authoritative receipt exists but accepted visit evidence was not found.",
    );
  }
  return { evidence, receipt, duplicate: true };
}

const CLIENT_OPERATION_ACCEPTANCE_MISMATCH: FrigoraClientOperationAcceptanceLookup = {
  status: "MISMATCH",
};

/**
 * Read-only acceptance check. Current WorkOrder assignment is intentionally
 * not required: a receipt accepted before reassignment must still reconcile.
 * This function performs no insert, upload, or reservation.
 */
async function readClientOperationAcceptance(
  store: FrigoraStore,
  scope: FrigoraScope,
  input: LookupClientOperationAcceptanceInput,
): Promise<FrigoraClientOperationAcceptanceLookup> {
  const clientOperationId = input.clientOperationId.trim();
  const workOrderId = input.workOrderId.trim();
  const visitId = input.visitId.trim();
  if (!clientOperationId || !workOrderId || !visitId) {
    return CLIENT_OPERATION_ACCEPTANCE_MISMATCH;
  }
  if (
    input.operationType !== "recordTechnicalFinding" &&
    input.operationType !== "recordFieldCapture" &&
    input.operationType !== "recordVisitEvidence"
  ) {
    return CLIENT_OPERATION_ACCEPTANCE_MISMATCH;
  }

  const fingerprint = fingerprintLookupRequest(scope, input, workOrderId, visitId);
  const receipt = await store.findClientOperationReceipt(scope.ventureId, clientOperationId);
  if (!receipt) {
    return { status: "NOT_FOUND" };
  }
  if (
    receipt.actorUserId !== scope.userId ||
    receipt.workspaceId !== scope.workspaceId ||
    receipt.operationType !== input.operationType ||
    receipt.workOrderId !== workOrderId ||
    receipt.visitId !== visitId ||
    receipt.requestFingerprint !== fingerprint
  ) {
    return CLIENT_OPERATION_ACCEPTANCE_MISMATCH;
  }
  const entityMatches = await acceptedEntityMatchesReceipt(store, scope, receipt);
  if (!entityMatches) {
    return CLIENT_OPERATION_ACCEPTANCE_MISMATCH;
  }
  return {
    status: "ACCEPTED",
    receiptId: receipt.id,
    clientOperationId: receipt.clientOperationId,
    acceptedEntityId: receipt.acceptedEntityId,
    operationType: receipt.operationType,
    acceptedAt: receipt.acceptedAt,
    workOrderId: receipt.workOrderId,
    visitId: receipt.visitId,
  };
}

function fingerprintLookupRequest(
  scope: FrigoraScope,
  input: LookupClientOperationAcceptanceInput,
  workOrderId: string,
  visitId: string,
): string {
  if (input.operationType === "recordTechnicalFinding") {
    return fingerprintTechnicalFindingRequest({
      ventureId: scope.ventureId,
      actorUserId: scope.userId,
      workOrderId,
      visitId,
      findingKind: input.findingKind,
      description: input.description,
      assertedAt: input.assertedAt,
      userId: scope.userId,
      assetId: input.assetId,
      sourceFieldCaptureIds: input.sourceFieldCaptureIds,
    });
  }
  if (input.operationType === "recordFieldCapture") {
    return fingerprintFieldCaptureRequest({
      ventureId: scope.ventureId,
      actorUserId: scope.userId,
      workOrderId,
      visitId,
      captureKind: input.captureKind,
      captureCode: input.captureCode,
      valueNumeric: input.valueNumeric,
      valueUnit: input.valueUnit,
      description: input.description,
      observedAt: input.observedAt,
      userId: scope.userId,
      assetId: input.assetId,
    });
  }
  return fingerprintVisitEvidenceRequest({
    ventureId: scope.ventureId,
    actorUserId: scope.userId,
    workOrderId,
    visitId,
    category: input.category,
    description: input.description,
    originalFilename: input.originalFilename,
    mimeType: input.mimeType,
    byteLength: input.byteLength,
    contentSha256: input.contentSha256,
    userId: scope.userId,
    assetId: input.assetId,
  });
}

async function acceptedEntityMatchesReceipt(
  store: FrigoraStore,
  scope: FrigoraScope,
  receipt: FrigoraClientOperationReceipt,
): Promise<boolean> {
  if (receipt.operationType === "recordTechnicalFinding") {
    const finding = await store.findTechnicalFinding(
      scope.workspaceId,
      scope.ventureId,
      receipt.acceptedEntityId as FrigoraTechnicalFindingId,
    );
    return Boolean(
      finding &&
        finding.visitId === receipt.visitId &&
        finding.workOrderId === receipt.workOrderId,
    );
  }
  if (receipt.operationType === "recordFieldCapture") {
    const capture = await store.findFieldCapture(
      scope.workspaceId,
      scope.ventureId,
      receipt.acceptedEntityId as FrigoraFieldCaptureId,
    );
    return Boolean(
      capture &&
        capture.visitId === receipt.visitId &&
        capture.workOrderId === receipt.workOrderId,
    );
  }
  const evidence = await store.findVisitEvidence(
    scope.workspaceId,
    scope.ventureId,
    receipt.acceptedEntityId as FrigoraVisitEvidenceId,
  );
  return Boolean(
    evidence &&
      evidence.storedObjectId &&
      evidence.visitId === receipt.visitId &&
      evidence.workOrderId === receipt.workOrderId,
  );
}

function assertVisitAcceptsCorrectiveAction(visit: FrigoraVisit) {
  if (visit.status === "cancelled") {
    throw new FrigoraError(
      "invalid_status",
      "Corrective actions cannot be recorded against a cancelled visit.",
    );
  }
}

function assertVisitAcceptsVisitOutcome(visit: FrigoraVisit) {
  if (visit.status === "cancelled") {
    throw new FrigoraError(
      "invalid_status",
      "Visit outcomes cannot be recorded against a cancelled visit.",
    );
  }
}

function assertVisitAcceptsRecommendedAction(visit: FrigoraVisit) {
  if (visit.status === "cancelled") {
    throw new FrigoraError(
      "invalid_status",
      "Recommended actions cannot be recorded against a cancelled visit.",
    );
  }
}

function assertVisitAcceptsRefrigerantEvent(visit: FrigoraVisit) {
  if (visit.status === "cancelled") {
    throw new FrigoraError(
      "invalid_status",
      "Refrigerant events cannot be recorded against a cancelled visit.",
    );
  }
}

function assertVisitAcceptsPartUsage(visit: FrigoraVisit) {
  if (visit.status === "cancelled") {
    throw new FrigoraError(
      "invalid_status",
      "Part usages cannot be recorded against a cancelled visit.",
    );
  }
}

function assertVisitAcceptsVisitCustomerAcknowledgement(visit: FrigoraVisit) {
  if (visit.status === "cancelled") {
    throw new FrigoraError(
      "invalid_status",
      "Customer acknowledgements cannot be recorded against a cancelled visit.",
    );
  }
}

function assertAcknowledgedAtNotBeforeArrival(visit: FrigoraVisit, acknowledgedAt: string) {
  const acknowledgedMs = Date.parse(acknowledgedAt);
  const arrivedMs = Date.parse(visit.arrivedAt);
  if (acknowledgedMs < arrivedMs) {
    throw new FrigoraError(
      "invalid_input",
      "Acknowledgement time must not precede visit arrival.",
    );
  }
}

function assertObservedAtWithinVisit(visit: FrigoraVisit, observedAt: string) {
  const observedMs = Date.parse(observedAt);
  const arrivedMs = Date.parse(visit.arrivedAt);
  if (observedMs < arrivedMs) {
    throw new FrigoraError(
      "invalid_input",
      "Observed time must not precede visit arrival.",
    );
  }
  if (visit.status === "departed" && visit.departedAt) {
    const departedMs = Date.parse(visit.departedAt);
    if (observedMs > departedMs) {
      throw new FrigoraError(
        "invalid_input",
        "Observed time must not follow visit departure.",
      );
    }
  }
}

function assertAssertedAtWithinVisit(visit: FrigoraVisit, assertedAt: string) {
  const assertedMs = Date.parse(assertedAt);
  const arrivedMs = Date.parse(visit.arrivedAt);
  if (assertedMs < arrivedMs) {
    throw new FrigoraError(
      "invalid_input",
      "Asserted time must not precede visit arrival.",
    );
  }
  if (visit.status === "departed" && visit.departedAt) {
    const departedMs = Date.parse(visit.departedAt);
    if (assertedMs > departedMs) {
      throw new FrigoraError(
        "invalid_input",
        "Asserted time must not follow visit departure.",
      );
    }
  }
}

function assertPerformedAtWithinVisit(visit: FrigoraVisit, performedAt: string) {
  const performedMs = Date.parse(performedAt);
  const arrivedMs = Date.parse(visit.arrivedAt);
  if (performedMs < arrivedMs) {
    throw new FrigoraError(
      "invalid_input",
      "Performed time must not precede visit arrival.",
    );
  }
  if (visit.status === "departed" && visit.departedAt) {
    const departedMs = Date.parse(visit.departedAt);
    if (performedMs > departedMs) {
      throw new FrigoraError(
        "invalid_input",
        "Performed time must not follow visit departure.",
      );
    }
  }
}

function assertOutcomeAtWithinVisit(visit: FrigoraVisit, outcomeAt: string) {
  const outcomeMs = Date.parse(outcomeAt);
  const arrivedMs = Date.parse(visit.arrivedAt);
  if (outcomeMs < arrivedMs) {
    throw new FrigoraError(
      "invalid_input",
      "Outcome time must not precede visit arrival.",
    );
  }
  if (visit.status === "departed" && visit.departedAt) {
    const departedMs = Date.parse(visit.departedAt);
    if (outcomeMs > departedMs) {
      throw new FrigoraError(
        "invalid_input",
        "Outcome time must not follow visit departure.",
      );
    }
  }
}

function assertRecommendedAtWithinVisit(visit: FrigoraVisit, recommendedAt: string) {
  const recommendedMs = Date.parse(recommendedAt);
  const arrivedMs = Date.parse(visit.arrivedAt);
  if (recommendedMs < arrivedMs) {
    throw new FrigoraError(
      "invalid_input",
      "Recommended time must not precede visit arrival.",
    );
  }
  if (visit.status === "departed" && visit.departedAt) {
    const departedMs = Date.parse(visit.departedAt);
    if (recommendedMs > departedMs) {
      throw new FrigoraError(
        "invalid_input",
        "Recommended time must not follow visit departure.",
      );
    }
  }
}

function assertOccurredAtWithinVisit(visit: FrigoraVisit, occurredAt: string) {
  const occurredMs = Date.parse(occurredAt);
  const arrivedMs = Date.parse(visit.arrivedAt);
  if (occurredMs < arrivedMs) {
    throw new FrigoraError(
      "invalid_input",
      "Occurrence time must not precede visit arrival.",
    );
  }
  if (visit.status === "departed" && visit.departedAt) {
    const departedMs = Date.parse(visit.departedAt);
    if (occurredMs > departedMs) {
      throw new FrigoraError(
        "invalid_input",
        "Occurrence time must not follow visit departure.",
      );
    }
  }
}

function assertUsedAtWithinVisit(visit: FrigoraVisit, usedAt: string) {
  const usedMs = Date.parse(usedAt);
  const arrivedMs = Date.parse(visit.arrivedAt);
  if (usedMs < arrivedMs) {
    throw new FrigoraError(
      "invalid_input",
      "Usage time must not precede visit arrival.",
    );
  }
  if (visit.status === "departed" && visit.departedAt) {
    const departedMs = Date.parse(visit.departedAt);
    if (usedMs > departedMs) {
      throw new FrigoraError(
        "invalid_input",
        "Usage time must not follow visit departure.",
      );
    }
  }
}

async function resolveSourceFieldCaptureIds(
  store: FrigoraStore,
  scope: FrigoraScope,
  visit: FrigoraVisit,
  ids: string[] | undefined,
): Promise<FrigoraFieldCaptureId[] | null> {
  if (!ids || ids.length === 0) {
    return null;
  }
  const unique = [...new Set(ids)];
  const resolved: FrigoraFieldCaptureId[] = [];
  for (const id of unique) {
    const capture = await store.findFieldCapture(
      scope.workspaceId,
      scope.ventureId,
      id as FrigoraFieldCaptureId,
    );
    if (!capture) {
      throw new FrigoraError(
        "not_found",
        "Referenced field capture was not found in this venture.",
      );
    }
    if (capture.visitId !== visit.id) {
      throw new FrigoraError(
        "invalid_input",
        "Referenced field captures must belong to the same visit.",
      );
    }
    resolved.push(capture.id);
  }
  return resolved.sort();
}

async function resolveSourceTechnicalFindingIds(
  store: FrigoraStore,
  scope: FrigoraScope,
  visit: FrigoraVisit,
  ids: string[] | undefined,
): Promise<FrigoraTechnicalFindingId[] | null> {
  if (!ids || ids.length === 0) {
    return null;
  }
  const unique = [...new Set(ids)];
  const resolved: FrigoraTechnicalFindingId[] = [];
  for (const id of unique) {
    const finding = await store.findTechnicalFinding(
      scope.workspaceId,
      scope.ventureId,
      id as FrigoraTechnicalFindingId,
    );
    if (!finding) {
      throw new FrigoraError(
        "not_found",
        "Referenced technical finding was not found in this venture.",
      );
    }
    if (finding.visitId !== visit.id) {
      throw new FrigoraError(
        "invalid_input",
        "Referenced technical findings must belong to the same visit.",
      );
    }
    resolved.push(finding.id);
  }
  return resolved.sort();
}

async function resolveFieldCaptureAsset(
  store: FrigoraStore,
  scope: FrigoraScope,
  workOrder: FrigoraWorkOrder,
  assetId: string | null,
): Promise<FrigoraAssetId | null> {
  if (assetId === null) {
    return null;
  }
  const asset = await requireAsset(store, scope, assetId as FrigoraAssetId);
  if (asset.siteId !== workOrder.siteId) {
    throw new FrigoraError(
      "invalid_input",
      "Asset must belong to the work order site.",
    );
  }
  return asset.id;
}

async function assertSiteAcceptsWorkOrder(
  store: FrigoraStore,
  scope: FrigoraScope,
  site: FrigoraSite,
) {
  if (site.status !== "active") {
    throw new FrigoraError(
      "archived_parent",
      "Archived sites cannot receive new work orders.",
    );
  }
  const customer = await requireCustomer(store, scope, site.customerId);
  if (customer.status !== "active") {
    throw new FrigoraError(
      "archived_parent",
      "Archived customers cannot receive new work orders.",
    );
  }
}

async function resolvePrimaryAssetAssociation(
  store: FrigoraStore,
  scope: FrigoraScope,
  siteId: FrigoraSiteId,
  primaryAssetId: string | null,
): Promise<FrigoraAssetId | null> {
  if (primaryAssetId === null) {
    return null;
  }
  const asset = await requireAsset(store, scope, primaryAssetId as FrigoraAssetId);
  if (asset.siteId !== siteId) {
    throw new FrigoraError(
      "invalid_input",
      "Primary asset must belong to the work order site.",
    );
  }
  if (asset.status !== "active") {
    throw new FrigoraError(
      "archived_parent",
      "Decommissioned assets cannot be newly associated.",
    );
  }
  return asset.id;
}

async function requireWorkspaceMember(workspaceId: WorkspaceId, userId: UserId) {
  const role = await getPersistence().memberships.getRole(userId, workspaceId);
  if (!role) {
    throw new FrigoraError("not_found", "Assignee is not a workspace member.");
  }
}

async function assertUniqueCustomerCode(
  store: FrigoraStore,
  scope: FrigoraScope,
  code: string,
  exceptId?: FrigoraCustomerId,
) {
  const existing = await store.findCustomerByCode(
    scope.workspaceId,
    scope.ventureId,
    code,
  );
  if (existing && existing.id !== exceptId) {
    throw new FrigoraError("duplicate", "Customer code already exists in this venture.");
  }
}

async function assertUniqueSiteCode(
  store: FrigoraStore,
  scope: FrigoraScope,
  customerId: FrigoraCustomerId,
  code: string,
  exceptId?: FrigoraSiteId,
) {
  const existing = await store.findSiteByCode(
    scope.workspaceId,
    scope.ventureId,
    customerId,
    code,
  );
  if (existing && existing.id !== exceptId) {
    throw new FrigoraError("duplicate", "Site code already exists for this customer.");
  }
}

async function assertUniqueAssetTag(
  store: FrigoraStore,
  scope: FrigoraScope,
  siteId: FrigoraSiteId,
  tag: string,
  exceptId?: FrigoraAssetId,
) {
  const existing = await store.findAssetByTag(
    scope.workspaceId,
    scope.ventureId,
    siteId,
    tag,
  );
  if (existing && existing.id !== exceptId) {
    throw new FrigoraError("duplicate", "Asset tag already exists at this site.");
  }
}

async function assertUniqueSerial(
  store: FrigoraStore,
  scope: FrigoraScope,
  serialNumber: string,
  exceptId?: FrigoraAssetId,
) {
  const existing = await store.findAssetBySerial(
    scope.workspaceId,
    scope.ventureId,
    serialNumber,
  );
  if (existing && existing.id !== exceptId) {
    throw new FrigoraError("duplicate", "Serial number already exists in this venture.");
  }
}

export function createScope(input: {
  userId: UserId;
  workspaceId: string;
  ventureId: string;
}): FrigoraScope {
  return {
    userId: input.userId,
    workspaceId: input.workspaceId as WorkspaceId,
    ventureId: input.ventureId as VentureId,
  };
}
