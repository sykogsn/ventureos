import type { Permission, PermissionService, UserId, VentureId, WorkspaceId } from "@/contracts";
import { createId, nowIso } from "@/platform/ids";
import { getPlatform } from "@/platform/kernel";
import { getPersistence } from "@/platform/persistence/repositories";
import { FrigoraError } from "./errors";
import { createFrigoraStore, type FrigoraStore } from "./store";
import type {
  CreateAssetInput,
  CreateCustomerInput,
  CreateSiteInput,
  FrigoraAsset,
  FrigoraAssetId,
  FrigoraCustomer,
  FrigoraCustomerId,
  FrigoraScope,
  FrigoraSite,
  FrigoraSiteId,
  UpdateAssetInput,
  UpdateCustomerInput,
  UpdateSiteInput,
} from "./types";
import {
  createAssetSchema,
  createCustomerSchema,
  createSiteSchema,
  parseWithFrigora,
  updateAssetSchema,
  updateCustomerSchema,
  updateSiteSchema,
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
