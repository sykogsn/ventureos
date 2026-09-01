import { eq } from "drizzle-orm";
import type { StoredObjectId, UserId, VentureId, WorkspaceId } from "@/contracts";
import { ensureSchema, getDb } from "@/platform/persistence/db";
import { storedObjects } from "@/platform/persistence/schema";

export type StoredObjectRow = {
  id: StoredObjectId;
  workspaceId: WorkspaceId;
  ventureId: VentureId | null;
  storageKey: string;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
  sha256: string;
  createdByUserId: UserId;
  createdAt: string;
  deletedAt: string | null;
};

export async function insertStoredObject(row: StoredObjectRow): Promise<void> {
  await ensureSchema();
  await getDb()
    .insert(storedObjects)
    .values({
      id: row.id,
      workspaceId: row.workspaceId,
      ventureId: row.ventureId,
      storageKey: row.storageKey,
      originalFilename: row.originalFilename,
      mimeType: row.mimeType,
      sizeBytes: row.sizeBytes,
      sha256: row.sha256,
      createdByUserId: row.createdByUserId,
      createdAt: row.createdAt,
      deletedAt: row.deletedAt,
    });
}

export async function findStoredObjectById(id: StoredObjectId): Promise<StoredObjectRow | null> {
  await ensureSchema();
  const rows = await getDb().select().from(storedObjects).where(eq(storedObjects.id, id));
  const row = rows[0];
  if (!row) {
    return null;
  }
  return mapRow(row);
}

export async function tombstoneStoredObject(id: StoredObjectId, deletedAt: string): Promise<void> {
  await ensureSchema();
  await getDb()
    .update(storedObjects)
    .set({ deletedAt })
    .where(eq(storedObjects.id, id));
}

function mapRow(row: typeof storedObjects.$inferSelect): StoredObjectRow {
  return {
    id: row.id as StoredObjectId,
    workspaceId: row.workspaceId as WorkspaceId,
    ventureId: (row.ventureId as VentureId | null) ?? null,
    storageKey: row.storageKey,
    originalFilename: row.originalFilename,
    mimeType: row.mimeType,
    sizeBytes: row.sizeBytes,
    sha256: row.sha256,
    createdByUserId: row.createdByUserId as UserId,
    createdAt: row.createdAt,
    deletedAt: row.deletedAt ?? null,
  };
}
