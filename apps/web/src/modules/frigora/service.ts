import type { Permission, PermissionService, UserId, VentureId, WorkspaceId } from "@/contracts";
import { createId, nowIso } from "@/platform/ids";
import { getPlatform } from "@/platform/kernel";
import { getPersistence } from "@/platform/persistence/repositories";
import { FrigoraError } from "./errors";
import { createFrigoraStore, type FrigoraStore } from "./store";
import type {
  AssignWorkOrderInput,
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
  FrigoraAssetOperationalCondition,
  FrigoraAssetOperationalConditionId,
  RecordAssetOperationalConditionInput,
  FrigoraVisitCustomerAcknowledgement,
  FrigoraVisitCustomerAcknowledgementId,
  RecordVisitCustomerAcknowledgementInput,
  FrigoraAssetHistoryEntry,
  FrigoraAssetHistoryEventKind,
  UpdateAssetInput,
  UpdateCustomerInput,
  UpdateSiteInput,
  UpdateWorkOrderInput,
} from "./types";
import { FRIGORA_ASSET_HISTORY_EVENT_KINDS } from "./types";
import {
  assignWorkOrderSchema,
  createAssetSchema,
  createCustomerSchema,
  createSiteSchema,
  createWorkOrderSchema,
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
  recordAssetOperationalConditionSchema,
  recordVisitCustomerAcknowledgementSchema,
  updateAssetSchema,
  updateCustomerSchema,
  updateSiteSchema,
  updateWorkOrderSchema,
} from "./validation";

export type FrigoraService = {
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
  closeWorkOrder(scope: FrigoraScope, id: FrigoraWorkOrderId): Promise<FrigoraWorkOrder>;
  cancelWorkOrder(scope: FrigoraScope, id: FrigoraWorkOrderId): Promise<FrigoraWorkOrder>;
  reopenWorkOrder(scope: FrigoraScope, id: FrigoraWorkOrderId): Promise<FrigoraWorkOrder>;
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
  ): Promise<FrigoraWorkOrder>;
  listWorkOrdersByAssignee(scope: FrigoraScope, userId: UserId): Promise<FrigoraWorkOrder[]>;
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
  return {
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
        reportedCondition: parsed.reportedCondition ?? null,
        status: "open",
        assignedUserId: null,
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
      const next: FrigoraWorkOrder = {
        ...existing,
        status: "closed",
        updatedAt: nowIso(),
      };
      await store.updateWorkOrder(next);
      return next;
    },
    async cancelWorkOrder(scope, id) {
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
      const next: FrigoraWorkOrder = {
        ...existing,
        status: "cancelled",
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
      const assigneeId = parsed.userId as UserId;
      await requireWorkspaceMember(scope.workspaceId, assigneeId);
      const next: FrigoraWorkOrder = {
        ...existing,
        assignedUserId: assigneeId,
        updatedAt: nowIso(),
      };
      await store.updateWorkOrder(next);
      return next;
    },
    async clearWorkOrderAssignment(scope, id) {
      await assertFrigoraAccess(await permissionService(), scope, "venture.update");
      const existing = await requireOpenWorkOrder(store, scope, id);
      if (existing.assignedUserId === null) {
        return existing;
      }
      const next: FrigoraWorkOrder = {
        ...existing,
        assignedUserId: null,
        updatedAt: nowIso(),
      };
      await store.updateWorkOrder(next);
      return next;
    },
    async listWorkOrdersByAssignee(scope, userId) {
      if (!(await allowFrigoraRead(await permissionService(), scope))) {
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
    async recordVisitArrival(scope, workOrderId, input) {
      await assertFrigoraAccess(await permissionService(), scope, "venture.update");
      const workOrder = await requireOpenWorkOrder(store, scope, workOrderId);
      const parsed = parseWithFrigora(recordVisitArrivalSchema, input);
      const attendingUserId = parsed.userId as UserId;
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
        status: "open",
        createdAt: now,
        updatedAt: now,
      };
      await store.insertVisit(row);
      return row;
    },
    async recordVisitDeparture(scope, id, input) {
      await assertFrigoraAccess(await permissionService(), scope, "venture.update");
      const existing = await requireOpenVisit(store, scope, id);
      const parsed = parseWithFrigora(recordVisitDepartureSchema, input);
      assertDepartedAfterArrived(existing.arrivedAt, parsed.departedAt);
      const next: FrigoraVisit = {
        ...existing,
        departedAt: parsed.departedAt,
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
      await assertFrigoraAccess(await permissionService(), scope, "venture.update");
      const visit = await requireVisit(store, scope, visitId);
      assertVisitAcceptsFieldCapture(visit);
      const workOrder = await requireWorkOrder(store, scope, visit.workOrderId);
      const parsed = parseWithFrigora(recordFieldCaptureSchema, input);
      assertObservedAtWithinVisit(visit, parsed.observedAt);
      const capturedByUserId = parsed.userId as UserId;
      await requireWorkspaceMember(scope.workspaceId, capturedByUserId);
      const assetId = await resolveFieldCaptureAsset(
        store,
        scope,
        workOrder,
        parsed.assetId === undefined ? null : parsed.assetId,
      );
      const now = nowIso();
      const row: FrigoraFieldCapture = {
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
      await store.insertFieldCapture(row);
      return row;
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
      await assertFrigoraAccess(await permissionService(), scope, "venture.update");
      const visit = await requireVisit(store, scope, visitId);
      assertVisitAcceptsTechnicalFinding(visit);
      const workOrder = await requireWorkOrder(store, scope, visit.workOrderId);
      const parsed = parseWithFrigora(recordTechnicalFindingSchema, input);
      assertAssertedAtWithinVisit(visit, parsed.assertedAt);
      const recordedByUserId = parsed.userId as UserId;
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
      const row: FrigoraTechnicalFinding = {
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
      await store.insertTechnicalFinding(row);
      return row;
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
      await assertFrigoraAccess(await permissionService(), scope, "venture.update");
      const visit = await requireVisit(store, scope, visitId);
      assertVisitAcceptsCorrectiveAction(visit);
      const workOrder = await requireWorkOrder(store, scope, visit.workOrderId);
      const parsed = parseWithFrigora(recordCorrectiveActionSchema, input);
      assertPerformedAtWithinVisit(visit, parsed.performedAt);
      const performedByUserId = parsed.performedByUserId as UserId;
      const recordedByUserId = parsed.recordedByUserId as UserId;
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
      await assertFrigoraAccess(await permissionService(), scope, "venture.update");
      const visit = await requireVisit(store, scope, visitId);
      assertVisitAcceptsVisitOutcome(visit);
      const workOrder = await requireWorkOrder(store, scope, visit.workOrderId);
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
      await assertFrigoraAccess(await permissionService(), scope, "venture.update");
      const visit = await requireVisit(store, scope, visitId);
      assertVisitAcceptsRecommendedAction(visit);
      const workOrder = await requireWorkOrder(store, scope, visit.workOrderId);
      const parsed = parseWithFrigora(recordRecommendedActionSchema, input);
      assertRecommendedAtWithinVisit(visit, parsed.recommendedAt);
      const recommendedByUserId = parsed.recommendedByUserId as UserId;
      const recordedByUserId = parsed.recordedByUserId as UserId;
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
      await assertFrigoraAccess(await permissionService(), scope, "venture.update");
      const visit = await requireVisit(store, scope, visitId);
      assertVisitAcceptsRefrigerantEvent(visit);
      const workOrder = await requireWorkOrder(store, scope, visit.workOrderId);
      const parsed = parseWithFrigora(recordRefrigerantEventSchema, input);
      assertOccurredAtWithinVisit(visit, parsed.occurredAt);
      const handledByUserId = parsed.handledByUserId as UserId;
      const recordedByUserId = parsed.recordedByUserId as UserId;
      await requireWorkspaceMember(scope.workspaceId, handledByUserId);
      await requireWorkspaceMember(scope.workspaceId, recordedByUserId);
      const assetId = await resolveFieldCaptureAsset(
        store,
        scope,
        workOrder,
        parsed.assetId === undefined ? null : parsed.assetId,
      );
      const now = nowIso();
      const row: FrigoraRefrigerantEvent = {
        id: createId<FrigoraRefrigerantEventId>(),
        workspaceId: visit.workspaceId,
        ventureId: visit.ventureId,
        visitId: visit.id,
        workOrderId: visit.workOrderId,
        assetId,
        refrigerantType: parsed.refrigerantType,
        eventKind: parsed.eventKind,
        quantityKg: parsed.quantityKg,
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
      await assertFrigoraAccess(await permissionService(), scope, "venture.update");
      const visit = await requireVisit(store, scope, visitId);
      assertVisitAcceptsPartUsage(visit);
      const workOrder = await requireWorkOrder(store, scope, visit.workOrderId);
      const parsed = parseWithFrigora(recordPartUsageSchema, input);
      assertUsedAtWithinVisit(visit, parsed.usedAt);
      const usedByUserId = parsed.usedByUserId as UserId;
      const recordedByUserId = parsed.recordedByUserId as UserId;
      await requireWorkspaceMember(scope.workspaceId, usedByUserId);
      await requireWorkspaceMember(scope.workspaceId, recordedByUserId);
      const assetId = await resolveFieldCaptureAsset(
        store,
        scope,
        workOrder,
        parsed.assetId === undefined ? null : parsed.assetId,
      );
      const now = nowIso();
      const row: FrigoraPartUsage = {
        id: createId<FrigoraPartUsageId>(),
        workspaceId: visit.workspaceId,
        ventureId: visit.ventureId,
        visitId: visit.id,
        workOrderId: visit.workOrderId,
        assetId,
        partDescription: parsed.partDescription,
        quantity: parsed.quantity,
        quantityUnit: parsed.quantityUnit,
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
    async recordAssetOperationalCondition(scope, input) {
      await assertFrigoraAccess(await permissionService(), scope, "venture.update");
      const parsed = parseWithFrigora(recordAssetOperationalConditionSchema, input);
      const asset = await requireAsset(store, scope, parsed.assetId as FrigoraAssetId);
      const assertedByUserId = parsed.assertedByUserId as UserId;
      const recordedByUserId = parsed.recordedByUserId as UserId;
      await requireWorkspaceMember(scope.workspaceId, assertedByUserId);
      await requireWorkspaceMember(scope.workspaceId, recordedByUserId);
      const { visitId, workOrderId } = await resolveOperationalConditionContext(
        store,
        scope,
        asset.id,
        parsed.visitId === undefined ? null : parsed.visitId,
        parsed.workOrderId === undefined ? null : parsed.workOrderId,
      );
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
      await assertFrigoraAccess(await permissionService(), scope, "venture.update");
      const visit = await requireVisit(store, scope, visitId);
      assertVisitAcceptsVisitCustomerAcknowledgement(visit);
      await requireWorkOrder(store, scope, visit.workOrderId);
      const parsed = parseWithFrigora(recordVisitCustomerAcknowledgementSchema, input);
      assertAcknowledgedAtNotBeforeArrival(visit, parsed.acknowledgedAt);
      const recordedByUserId = parsed.recordedByUserId as UserId;
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
