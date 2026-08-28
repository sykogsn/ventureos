import { and, asc, eq } from "drizzle-orm";
import type { VentureId, WorkspaceId, UserId } from "@/contracts";
import { ensureSchema, getDb } from "@/platform/persistence/db";
import {
  frigoraAssets,
  frigoraCustomers,
  frigoraSites,
  frigoraVisits,
  frigoraFieldCaptures,
  frigoraWorkOrders,
} from "@/platform/persistence/schema";
import { FrigoraError } from "./errors";
import type {
  FrigoraAsset,
  FrigoraAssetId,
  FrigoraAssetKind,
  FrigoraAssetStatus,
  FrigoraCustomer,
  FrigoraCustomerId,
  FrigoraCustomerStatus,
  FrigoraSite,
  FrigoraSiteId,
  FrigoraSiteStatus,
  FrigoraWorkOrder,
  FrigoraWorkOrderId,
  FrigoraWorkOrderStatus,
  FrigoraWorkKind,
  FrigoraVisit,
  FrigoraVisitId,
  FrigoraVisitStatus,
  FrigoraFieldCapture,
  FrigoraFieldCaptureCode,
  FrigoraFieldCaptureId,
  FrigoraFieldCaptureKind,
  FrigoraFieldCaptureUnit,
} from "./types";

export type FrigoraStore = {
  insertCustomer(row: FrigoraCustomer): Promise<void>;
  updateCustomer(row: FrigoraCustomer): Promise<void>;
  findCustomer(
    workspaceId: WorkspaceId,
    ventureId: VentureId,
    id: FrigoraCustomerId,
  ): Promise<FrigoraCustomer | null>;
  findCustomerByCode(
    workspaceId: WorkspaceId,
    ventureId: VentureId,
    code: string,
  ): Promise<FrigoraCustomer | null>;
  listCustomers(
    workspaceId: WorkspaceId,
    ventureId: VentureId,
  ): Promise<FrigoraCustomer[]>;
  insertSite(row: FrigoraSite): Promise<void>;
  updateSite(row: FrigoraSite): Promise<void>;
  findSite(
    workspaceId: WorkspaceId,
    ventureId: VentureId,
    id: FrigoraSiteId,
  ): Promise<FrigoraSite | null>;
  findSiteByCode(
    workspaceId: WorkspaceId,
    ventureId: VentureId,
    customerId: FrigoraCustomerId,
    code: string,
  ): Promise<FrigoraSite | null>;
  listSitesByCustomer(
    workspaceId: WorkspaceId,
    ventureId: VentureId,
    customerId: FrigoraCustomerId,
  ): Promise<FrigoraSite[]>;
  insertAsset(row: FrigoraAsset): Promise<void>;
  updateAsset(row: FrigoraAsset): Promise<void>;
  findAsset(
    workspaceId: WorkspaceId,
    ventureId: VentureId,
    id: FrigoraAssetId,
  ): Promise<FrigoraAsset | null>;
  findAssetByTag(
    workspaceId: WorkspaceId,
    ventureId: VentureId,
    siteId: FrigoraSiteId,
    tag: string,
  ): Promise<FrigoraAsset | null>;
  findAssetBySerial(
    workspaceId: WorkspaceId,
    ventureId: VentureId,
    serialNumber: string,
  ): Promise<FrigoraAsset | null>;
  listAssetsBySite(
    workspaceId: WorkspaceId,
    ventureId: VentureId,
    siteId: FrigoraSiteId,
  ): Promise<FrigoraAsset[]>;
  insertWorkOrder(row: FrigoraWorkOrder): Promise<void>;
  updateWorkOrder(row: FrigoraWorkOrder): Promise<void>;
  findWorkOrder(
    workspaceId: WorkspaceId,
    ventureId: VentureId,
    id: FrigoraWorkOrderId,
  ): Promise<FrigoraWorkOrder | null>;
  findWorkOrderByReference(
    workspaceId: WorkspaceId,
    ventureId: VentureId,
    workReference: string,
  ): Promise<FrigoraWorkOrder | null>;
  listWorkOrders(
    workspaceId: WorkspaceId,
    ventureId: VentureId,
    status?: FrigoraWorkOrderStatus,
  ): Promise<FrigoraWorkOrder[]>;
  listWorkOrdersByCustomer(
    workspaceId: WorkspaceId,
    ventureId: VentureId,
    customerId: FrigoraCustomerId,
  ): Promise<FrigoraWorkOrder[]>;
  listWorkOrdersBySite(
    workspaceId: WorkspaceId,
    ventureId: VentureId,
    siteId: FrigoraSiteId,
  ): Promise<FrigoraWorkOrder[]>;
  listWorkOrdersByAsset(
    workspaceId: WorkspaceId,
    ventureId: VentureId,
    assetId: FrigoraAssetId,
  ): Promise<FrigoraWorkOrder[]>;
  listWorkOrdersByAssignee(
    workspaceId: WorkspaceId,
    ventureId: VentureId,
    userId: UserId,
  ): Promise<FrigoraWorkOrder[]>;
  insertVisit(row: FrigoraVisit): Promise<void>;
  updateVisit(row: FrigoraVisit): Promise<void>;
  findVisit(
    workspaceId: WorkspaceId,
    ventureId: VentureId,
    id: FrigoraVisitId,
  ): Promise<FrigoraVisit | null>;
  listVisitsByWorkOrder(
    workspaceId: WorkspaceId,
    ventureId: VentureId,
    workOrderId: FrigoraWorkOrderId,
  ): Promise<FrigoraVisit[]>;
  listVisitsByAttendingUser(
    workspaceId: WorkspaceId,
    ventureId: VentureId,
    userId: UserId,
  ): Promise<FrigoraVisit[]>;
  insertFieldCapture(row: FrigoraFieldCapture): Promise<void>;
  findFieldCapture(
    workspaceId: WorkspaceId,
    ventureId: VentureId,
    id: FrigoraFieldCaptureId,
  ): Promise<FrigoraFieldCapture | null>;
  listFieldCapturesByVisit(
    workspaceId: WorkspaceId,
    ventureId: VentureId,
    visitId: FrigoraVisitId,
  ): Promise<FrigoraFieldCapture[]>;
  listFieldCapturesByWorkOrder(
    workspaceId: WorkspaceId,
    ventureId: VentureId,
    workOrderId: FrigoraWorkOrderId,
  ): Promise<FrigoraFieldCapture[]>;
  listFieldCapturesByAsset(
    workspaceId: WorkspaceId,
    ventureId: VentureId,
    assetId: FrigoraAssetId,
  ): Promise<FrigoraFieldCapture[]>;
};

export function createFrigoraStore(): FrigoraStore {
  return {
    async insertCustomer(row) {
      await ensureSchema();
      try {
        await getDb().insert(frigoraCustomers).values(toCustomerValues(row));
      } catch (error) {
        throw uniqueOrOriginal(error, "Customer code already exists in this venture.");
      }
    },
    async updateCustomer(row) {
      await ensureSchema();
      try {
        await getDb()
          .update(frigoraCustomers)
          .set(toCustomerValues(row))
          .where(
            and(
              eq(frigoraCustomers.id, row.id),
              eq(frigoraCustomers.workspaceId, row.workspaceId),
              eq(frigoraCustomers.ventureId, row.ventureId),
            ),
          );
      } catch (error) {
        throw uniqueOrOriginal(error, "Customer code already exists in this venture.");
      }
    },
    async findCustomer(workspaceId, ventureId, id) {
      await ensureSchema();
      const [row] = await getDb()
        .select()
        .from(frigoraCustomers)
        .where(
          and(
            eq(frigoraCustomers.id, id),
            eq(frigoraCustomers.workspaceId, workspaceId),
            eq(frigoraCustomers.ventureId, ventureId),
          ),
        )
        .limit(1);
      return row ? mapCustomer(row) : null;
    },
    async findCustomerByCode(workspaceId, ventureId, code) {
      await ensureSchema();
      const [row] = await getDb()
        .select()
        .from(frigoraCustomers)
        .where(
          and(
            eq(frigoraCustomers.workspaceId, workspaceId),
            eq(frigoraCustomers.ventureId, ventureId),
            eq(frigoraCustomers.code, code),
          ),
        )
        .limit(1);
      return row ? mapCustomer(row) : null;
    },
    async listCustomers(workspaceId, ventureId) {
      await ensureSchema();
      const rows = await getDb()
        .select()
        .from(frigoraCustomers)
        .where(
          and(
            eq(frigoraCustomers.workspaceId, workspaceId),
            eq(frigoraCustomers.ventureId, ventureId),
          ),
        )
        .orderBy(asc(frigoraCustomers.createdAt), asc(frigoraCustomers.id));
      return rows.map(mapCustomer);
    },
    async insertSite(row) {
      await ensureSchema();
      try {
        await getDb().insert(frigoraSites).values(toSiteValues(row));
      } catch (error) {
        throw uniqueOrOriginal(error, "Site code already exists for this customer.");
      }
    },
    async updateSite(row) {
      await ensureSchema();
      try {
        await getDb()
          .update(frigoraSites)
          .set(toSiteValues(row))
          .where(
            and(
              eq(frigoraSites.id, row.id),
              eq(frigoraSites.workspaceId, row.workspaceId),
              eq(frigoraSites.ventureId, row.ventureId),
            ),
          );
      } catch (error) {
        throw uniqueOrOriginal(error, "Site code already exists for this customer.");
      }
    },
    async findSite(workspaceId, ventureId, id) {
      await ensureSchema();
      const [row] = await getDb()
        .select()
        .from(frigoraSites)
        .where(
          and(
            eq(frigoraSites.id, id),
            eq(frigoraSites.workspaceId, workspaceId),
            eq(frigoraSites.ventureId, ventureId),
          ),
        )
        .limit(1);
      return row ? mapSite(row) : null;
    },
    async findSiteByCode(workspaceId, ventureId, customerId, code) {
      await ensureSchema();
      const [row] = await getDb()
        .select()
        .from(frigoraSites)
        .where(
          and(
            eq(frigoraSites.workspaceId, workspaceId),
            eq(frigoraSites.ventureId, ventureId),
            eq(frigoraSites.customerId, customerId),
            eq(frigoraSites.code, code),
          ),
        )
        .limit(1);
      return row ? mapSite(row) : null;
    },
    async listSitesByCustomer(workspaceId, ventureId, customerId) {
      await ensureSchema();
      const rows = await getDb()
        .select()
        .from(frigoraSites)
        .where(
          and(
            eq(frigoraSites.workspaceId, workspaceId),
            eq(frigoraSites.ventureId, ventureId),
            eq(frigoraSites.customerId, customerId),
          ),
        )
        .orderBy(asc(frigoraSites.createdAt), asc(frigoraSites.id));
      return rows.map(mapSite);
    },
    async insertAsset(row) {
      await ensureSchema();
      try {
        await getDb().insert(frigoraAssets).values(toAssetValues(row));
      } catch (error) {
        throw uniqueOrOriginal(error, duplicateAssetMessage(error));
      }
    },
    async updateAsset(row) {
      await ensureSchema();
      try {
        await getDb()
          .update(frigoraAssets)
          .set(toAssetValues(row))
          .where(
            and(
              eq(frigoraAssets.id, row.id),
              eq(frigoraAssets.workspaceId, row.workspaceId),
              eq(frigoraAssets.ventureId, row.ventureId),
            ),
          );
      } catch (error) {
        throw uniqueOrOriginal(error, duplicateAssetMessage(error));
      }
    },
    async findAsset(workspaceId, ventureId, id) {
      await ensureSchema();
      const [row] = await getDb()
        .select()
        .from(frigoraAssets)
        .where(
          and(
            eq(frigoraAssets.id, id),
            eq(frigoraAssets.workspaceId, workspaceId),
            eq(frigoraAssets.ventureId, ventureId),
          ),
        )
        .limit(1);
      return row ? mapAsset(row) : null;
    },
    async findAssetByTag(workspaceId, ventureId, siteId, tag) {
      await ensureSchema();
      const [row] = await getDb()
        .select()
        .from(frigoraAssets)
        .where(
          and(
            eq(frigoraAssets.workspaceId, workspaceId),
            eq(frigoraAssets.ventureId, ventureId),
            eq(frigoraAssets.siteId, siteId),
            eq(frigoraAssets.tag, tag),
          ),
        )
        .limit(1);
      return row ? mapAsset(row) : null;
    },
    async findAssetBySerial(workspaceId, ventureId, serialNumber) {
      await ensureSchema();
      const [row] = await getDb()
        .select()
        .from(frigoraAssets)
        .where(
          and(
            eq(frigoraAssets.workspaceId, workspaceId),
            eq(frigoraAssets.ventureId, ventureId),
            eq(frigoraAssets.serialNumber, serialNumber),
          ),
        )
        .limit(1);
      return row ? mapAsset(row) : null;
    },
    async listAssetsBySite(workspaceId, ventureId, siteId) {
      await ensureSchema();
      const rows = await getDb()
        .select()
        .from(frigoraAssets)
        .where(
          and(
            eq(frigoraAssets.workspaceId, workspaceId),
            eq(frigoraAssets.ventureId, ventureId),
            eq(frigoraAssets.siteId, siteId),
          ),
        )
        .orderBy(asc(frigoraAssets.createdAt), asc(frigoraAssets.id));
      return rows.map(mapAsset);
    },
    async insertWorkOrder(row) {
      await ensureSchema();
      try {
        await getDb().insert(frigoraWorkOrders).values(toWorkOrderValues(row));
      } catch (error) {
        throw uniqueOrOriginal(
          error,
          "Work reference already exists in this venture.",
        );
      }
    },
    async updateWorkOrder(row) {
      await ensureSchema();
      try {
        await getDb()
          .update(frigoraWorkOrders)
          .set(toWorkOrderValues(row))
          .where(
            and(
              eq(frigoraWorkOrders.id, row.id),
              eq(frigoraWorkOrders.workspaceId, row.workspaceId),
              eq(frigoraWorkOrders.ventureId, row.ventureId),
            ),
          );
      } catch (error) {
        throw uniqueOrOriginal(
          error,
          "Work reference already exists in this venture.",
        );
      }
    },
    async findWorkOrder(workspaceId, ventureId, id) {
      await ensureSchema();
      const [row] = await getDb()
        .select()
        .from(frigoraWorkOrders)
        .where(
          and(
            eq(frigoraWorkOrders.id, id),
            eq(frigoraWorkOrders.workspaceId, workspaceId),
            eq(frigoraWorkOrders.ventureId, ventureId),
          ),
        )
        .limit(1);
      return row ? mapWorkOrder(row) : null;
    },
    async findWorkOrderByReference(workspaceId, ventureId, workReference) {
      await ensureSchema();
      const [row] = await getDb()
        .select()
        .from(frigoraWorkOrders)
        .where(
          and(
            eq(frigoraWorkOrders.workspaceId, workspaceId),
            eq(frigoraWorkOrders.ventureId, ventureId),
            eq(frigoraWorkOrders.workReference, workReference),
          ),
        )
        .limit(1);
      return row ? mapWorkOrder(row) : null;
    },
    async listWorkOrders(workspaceId, ventureId, status) {
      await ensureSchema();
      const filters = [
        eq(frigoraWorkOrders.workspaceId, workspaceId),
        eq(frigoraWorkOrders.ventureId, ventureId),
      ];
      if (status) {
        filters.push(eq(frigoraWorkOrders.status, status));
      }
      const rows = await getDb()
        .select()
        .from(frigoraWorkOrders)
        .where(and(...filters))
        .orderBy(asc(frigoraWorkOrders.createdAt), asc(frigoraWorkOrders.id));
      return rows.map(mapWorkOrder);
    },
    async listWorkOrdersByCustomer(workspaceId, ventureId, customerId) {
      await ensureSchema();
      const rows = await getDb()
        .select()
        .from(frigoraWorkOrders)
        .where(
          and(
            eq(frigoraWorkOrders.workspaceId, workspaceId),
            eq(frigoraWorkOrders.ventureId, ventureId),
            eq(frigoraWorkOrders.customerId, customerId),
          ),
        )
        .orderBy(asc(frigoraWorkOrders.createdAt), asc(frigoraWorkOrders.id));
      return rows.map(mapWorkOrder);
    },
    async listWorkOrdersBySite(workspaceId, ventureId, siteId) {
      await ensureSchema();
      const rows = await getDb()
        .select()
        .from(frigoraWorkOrders)
        .where(
          and(
            eq(frigoraWorkOrders.workspaceId, workspaceId),
            eq(frigoraWorkOrders.ventureId, ventureId),
            eq(frigoraWorkOrders.siteId, siteId),
          ),
        )
        .orderBy(asc(frigoraWorkOrders.createdAt), asc(frigoraWorkOrders.id));
      return rows.map(mapWorkOrder);
    },
    async listWorkOrdersByAsset(workspaceId, ventureId, assetId) {
      await ensureSchema();
      const rows = await getDb()
        .select()
        .from(frigoraWorkOrders)
        .where(
          and(
            eq(frigoraWorkOrders.workspaceId, workspaceId),
            eq(frigoraWorkOrders.ventureId, ventureId),
            eq(frigoraWorkOrders.primaryAssetId, assetId),
          ),
        )
        .orderBy(asc(frigoraWorkOrders.createdAt), asc(frigoraWorkOrders.id));
      return rows.map(mapWorkOrder);
    },
    async listWorkOrdersByAssignee(workspaceId, ventureId, userId) {
      await ensureSchema();
      const rows = await getDb()
        .select()
        .from(frigoraWorkOrders)
        .where(
          and(
            eq(frigoraWorkOrders.workspaceId, workspaceId),
            eq(frigoraWorkOrders.ventureId, ventureId),
            eq(frigoraWorkOrders.assignedUserId, userId),
          ),
        )
        .orderBy(asc(frigoraWorkOrders.createdAt), asc(frigoraWorkOrders.id));
      return rows.map(mapWorkOrder);
    },
    async insertVisit(row) {
      await ensureSchema();
      await getDb().insert(frigoraVisits).values(toVisitValues(row));
    },
    async updateVisit(row) {
      await ensureSchema();
      await getDb()
        .update(frigoraVisits)
        .set(toVisitValues(row))
        .where(
          and(
            eq(frigoraVisits.id, row.id),
            eq(frigoraVisits.workspaceId, row.workspaceId),
            eq(frigoraVisits.ventureId, row.ventureId),
          ),
        );
    },
    async findVisit(workspaceId, ventureId, id) {
      await ensureSchema();
      const rows = await getDb()
        .select()
        .from(frigoraVisits)
        .where(
          and(
            eq(frigoraVisits.id, id),
            eq(frigoraVisits.workspaceId, workspaceId),
            eq(frigoraVisits.ventureId, ventureId),
          ),
        )
        .limit(1);
      return rows[0] ? mapVisit(rows[0]) : null;
    },
    async listVisitsByWorkOrder(workspaceId, ventureId, workOrderId) {
      await ensureSchema();
      const rows = await getDb()
        .select()
        .from(frigoraVisits)
        .where(
          and(
            eq(frigoraVisits.workspaceId, workspaceId),
            eq(frigoraVisits.ventureId, ventureId),
            eq(frigoraVisits.workOrderId, workOrderId),
          ),
        )
        .orderBy(asc(frigoraVisits.arrivedAt), asc(frigoraVisits.id));
      return rows.map(mapVisit);
    },
    async listVisitsByAttendingUser(workspaceId, ventureId, userId) {
      await ensureSchema();
      const rows = await getDb()
        .select()
        .from(frigoraVisits)
        .where(
          and(
            eq(frigoraVisits.workspaceId, workspaceId),
            eq(frigoraVisits.ventureId, ventureId),
            eq(frigoraVisits.attendingUserId, userId),
          ),
        )
        .orderBy(asc(frigoraVisits.arrivedAt), asc(frigoraVisits.id));
      return rows.map(mapVisit);
    },
    async insertFieldCapture(row) {
      await ensureSchema();
      await getDb().insert(frigoraFieldCaptures).values(toFieldCaptureValues(row));
    },
    async findFieldCapture(workspaceId, ventureId, id) {
      await ensureSchema();
      const rows = await getDb()
        .select()
        .from(frigoraFieldCaptures)
        .where(
          and(
            eq(frigoraFieldCaptures.id, id),
            eq(frigoraFieldCaptures.workspaceId, workspaceId),
            eq(frigoraFieldCaptures.ventureId, ventureId),
          ),
        )
        .limit(1);
      return rows[0] ? mapFieldCapture(rows[0]) : null;
    },
    async listFieldCapturesByVisit(workspaceId, ventureId, visitId) {
      await ensureSchema();
      const rows = await getDb()
        .select()
        .from(frigoraFieldCaptures)
        .where(
          and(
            eq(frigoraFieldCaptures.workspaceId, workspaceId),
            eq(frigoraFieldCaptures.ventureId, ventureId),
            eq(frigoraFieldCaptures.visitId, visitId),
          ),
        )
        .orderBy(asc(frigoraFieldCaptures.observedAt), asc(frigoraFieldCaptures.id));
      return rows.map(mapFieldCapture);
    },
    async listFieldCapturesByWorkOrder(workspaceId, ventureId, workOrderId) {
      await ensureSchema();
      const rows = await getDb()
        .select()
        .from(frigoraFieldCaptures)
        .where(
          and(
            eq(frigoraFieldCaptures.workspaceId, workspaceId),
            eq(frigoraFieldCaptures.ventureId, ventureId),
            eq(frigoraFieldCaptures.workOrderId, workOrderId),
          ),
        )
        .orderBy(asc(frigoraFieldCaptures.observedAt), asc(frigoraFieldCaptures.id));
      return rows.map(mapFieldCapture);
    },
    async listFieldCapturesByAsset(workspaceId, ventureId, assetId) {
      await ensureSchema();
      const rows = await getDb()
        .select()
        .from(frigoraFieldCaptures)
        .where(
          and(
            eq(frigoraFieldCaptures.workspaceId, workspaceId),
            eq(frigoraFieldCaptures.ventureId, ventureId),
            eq(frigoraFieldCaptures.assetId, assetId),
          ),
        )
        .orderBy(asc(frigoraFieldCaptures.observedAt), asc(frigoraFieldCaptures.id));
      return rows.map(mapFieldCapture);
    },
  };
}

function toCustomerValues(row: FrigoraCustomer) {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    ventureId: row.ventureId,
    code: row.code,
    displayName: row.displayName,
    legalName: row.legalName,
    status: row.status,
    notes: row.notes,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toSiteValues(row: FrigoraSite) {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    ventureId: row.ventureId,
    customerId: row.customerId,
    code: row.code,
    name: row.name,
    addressLine1: row.addressLine1,
    addressLine2: row.addressLine2,
    city: row.city,
    region: row.region,
    postalCode: row.postalCode,
    country: row.country,
    status: row.status,
    notes: row.notes,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toAssetValues(row: FrigoraAsset) {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    ventureId: row.ventureId,
    siteId: row.siteId,
    tag: row.tag,
    name: row.name,
    assetKind: row.assetKind,
    manufacturer: row.manufacturer,
    model: row.model,
    serialNumber: row.serialNumber,
    status: row.status,
    designTargetCelsius: row.designTargetCelsius,
    refrigerantType: row.refrigerantType,
    locationOnSite: row.locationOnSite,
    installedOn: row.installedOn,
    commissionedOn: row.commissionedOn,
    notes: row.notes,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toWorkOrderValues(row: FrigoraWorkOrder) {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    ventureId: row.ventureId,
    customerId: row.customerId,
    siteId: row.siteId,
    primaryAssetId: row.primaryAssetId,
    workReference: row.workReference,
    workKind: row.workKind,
    reportedCondition: row.reportedCondition,
    status: row.status,
    assignedUserId: row.assignedUserId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toVisitValues(row: FrigoraVisit) {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    ventureId: row.ventureId,
    workOrderId: row.workOrderId,
    attendingUserId: row.attendingUserId,
    arrivedAt: row.arrivedAt,
    departedAt: row.departedAt,
    status: row.status,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toFieldCaptureValues(row: FrigoraFieldCapture) {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    ventureId: row.ventureId,
    visitId: row.visitId,
    workOrderId: row.workOrderId,
    assetId: row.assetId,
    captureKind: row.captureKind,
    captureCode: row.captureCode,
    valueNumeric: row.valueNumeric,
    valueUnit: row.valueUnit,
    description: row.description,
    observedAt: row.observedAt,
    capturedByUserId: row.capturedByUserId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function mapCustomer(row: typeof frigoraCustomers.$inferSelect): FrigoraCustomer {
  return {
    id: row.id as FrigoraCustomerId,
    workspaceId: row.workspaceId as WorkspaceId,
    ventureId: row.ventureId as VentureId,
    code: row.code,
    displayName: row.displayName,
    legalName: row.legalName ?? null,
    status: row.status as FrigoraCustomerStatus,
    notes: row.notes ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function mapSite(row: typeof frigoraSites.$inferSelect): FrigoraSite {
  return {
    id: row.id as FrigoraSiteId,
    workspaceId: row.workspaceId as WorkspaceId,
    ventureId: row.ventureId as VentureId,
    customerId: row.customerId as FrigoraCustomerId,
    code: row.code,
    name: row.name,
    addressLine1: row.addressLine1 ?? null,
    addressLine2: row.addressLine2 ?? null,
    city: row.city ?? null,
    region: row.region ?? null,
    postalCode: row.postalCode ?? null,
    country: row.country ?? null,
    status: row.status as FrigoraSiteStatus,
    notes: row.notes ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function mapAsset(row: typeof frigoraAssets.$inferSelect): FrigoraAsset {
  return {
    id: row.id as FrigoraAssetId,
    workspaceId: row.workspaceId as WorkspaceId,
    ventureId: row.ventureId as VentureId,
    siteId: row.siteId as FrigoraSiteId,
    tag: row.tag,
    name: row.name ?? null,
    assetKind: (row.assetKind as FrigoraAssetKind | null) ?? null,
    manufacturer: row.manufacturer ?? null,
    model: row.model ?? null,
    serialNumber: row.serialNumber ?? null,
    status: row.status as FrigoraAssetStatus,
    designTargetCelsius: row.designTargetCelsius ?? null,
    refrigerantType: row.refrigerantType ?? null,
    locationOnSite: row.locationOnSite ?? null,
    installedOn: row.installedOn ?? null,
    commissionedOn: row.commissionedOn ?? null,
    notes: row.notes ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function mapWorkOrder(row: typeof frigoraWorkOrders.$inferSelect): FrigoraWorkOrder {
  return {
    id: row.id as FrigoraWorkOrderId,
    workspaceId: row.workspaceId as WorkspaceId,
    ventureId: row.ventureId as VentureId,
    customerId: row.customerId as FrigoraCustomerId,
    siteId: row.siteId as FrigoraSiteId,
    primaryAssetId: (row.primaryAssetId as FrigoraAssetId | null) ?? null,
    workReference: row.workReference,
    workKind: row.workKind as FrigoraWorkKind,
    reportedCondition: row.reportedCondition ?? null,
    status: row.status as FrigoraWorkOrderStatus,
    assignedUserId: (row.assignedUserId as UserId | null) ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function mapVisit(row: typeof frigoraVisits.$inferSelect): FrigoraVisit {
  return {
    id: row.id as FrigoraVisitId,
    workspaceId: row.workspaceId as WorkspaceId,
    ventureId: row.ventureId as VentureId,
    workOrderId: row.workOrderId as FrigoraWorkOrderId,
    attendingUserId: row.attendingUserId as UserId,
    arrivedAt: row.arrivedAt,
    departedAt: row.departedAt ?? null,
    status: row.status as FrigoraVisitStatus,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function mapFieldCapture(row: typeof frigoraFieldCaptures.$inferSelect): FrigoraFieldCapture {
  return {
    id: row.id as FrigoraFieldCaptureId,
    workspaceId: row.workspaceId as WorkspaceId,
    ventureId: row.ventureId as VentureId,
    visitId: row.visitId as FrigoraVisitId,
    workOrderId: row.workOrderId as FrigoraWorkOrderId,
    assetId: (row.assetId as FrigoraAssetId | null) ?? null,
    captureKind: row.captureKind as FrigoraFieldCaptureKind,
    captureCode: row.captureCode as FrigoraFieldCaptureCode,
    valueNumeric: row.valueNumeric ?? null,
    valueUnit: (row.valueUnit as FrigoraFieldCaptureUnit | null) ?? null,
    description: row.description ?? null,
    observedAt: row.observedAt,
    capturedByUserId: row.capturedByUserId as UserId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function uniqueOrOriginal(error: unknown, message: string) {
  if (isUniqueConstraint(error)) {
    return new FrigoraError("duplicate", message);
  }
  return error;
}

function duplicateAssetMessage(error: unknown) {
  const text = error instanceof Error ? error.message : String(error);
  if (/serial/i.test(text)) {
    return "Serial number already exists in this venture.";
  }
  return "Asset tag already exists at this site.";
}

function isUniqueConstraint(error: unknown) {
  let current: unknown = error;
  for (let depth = 0; depth < 6 && current; depth += 1) {
    const message = current instanceof Error ? current.message : String(current);
    if (/UNIQUE/i.test(message) || /SQLITE_CONSTRAINT/i.test(message)) {
      return true;
    }
    if (typeof current === "object" && current && "cause" in current) {
      current = (current as { cause: unknown }).cause;
      continue;
    }
    break;
  }
  return false;
}
