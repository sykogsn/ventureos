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
  UpdateAssetInput,
  UpdateCustomerInput,
  UpdateSiteInput,
  UpdateWorkOrderInput,
} from "./types";
import {
  assignWorkOrderSchema,
  createAssetSchema,
  createCustomerSchema,
  createSiteSchema,
  createWorkOrderSchema,
  parseWithFrigora,
  recordVisitArrivalSchema,
  recordVisitDepartureSchema,
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
  };
}

let service: FrigoraService | undefined;

export function getFrigoraService(): FrigoraService {
  if (!service) {
    service = createFrigoraService();
  }
  return service;
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
