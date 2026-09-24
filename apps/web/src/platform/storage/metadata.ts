import { eq } from "drizzle-orm";
import type { StoredObjectId, UserId, VentureId, WorkspaceId } from "@/contracts";
import { ensureSchema, getDb } from "@/platform/persistence/db";
import {
  executeDurability,
  SQLITE_CONTENTION_BUDGET_MS,
} from "@/platform/persistence/durability-client";
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

/** Reservation-path lookup: BUSY recovers on a new dedicated client; never allocates identity. */
export async function findReservedStoredObjectById(id: StoredObjectId): Promise<StoredObjectRow | null> {
  await ensureSchema();
  const result = await executeDurability({
    sql: `SELECT id, workspace_id, venture_id, storage_key, original_filename, mime_type, size_bytes, sha256, created_by_user_id, created_at, deleted_at FROM stored_objects WHERE id = ?`,
    args: [id],
  }, Date.now() + SQLITE_CONTENTION_BUDGET_MS);
  const row = result.rows[0];
  if (!row) {
    return null;
  }
  return {
    id: String(row.id) as StoredObjectId,
    workspaceId: String(row.workspace_id) as WorkspaceId,
    ventureId: (row.venture_id == null ? null : String(row.venture_id)) as VentureId | null,
    storageKey: String(row.storage_key),
    originalFilename: String(row.original_filename),
    mimeType: String(row.mime_type),
    sizeBytes: Number(row.size_bytes),
    sha256: String(row.sha256),
    createdByUserId: String(row.created_by_user_id) as UserId,
    createdAt: String(row.created_at),
    deletedAt: row.deleted_at == null ? null : String(row.deleted_at),
  };
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

/** SQLite uniqueness arbitrates across connections/processes; reservations survive restarts. */
export async function reserveStoredObject(scopeKey: string, fingerprint: string, proposed: StoredObjectRow) {
  await ensureSchema();
  const deadline = Date.now() + SQLITE_CONTENTION_BUDGET_MS;
  await executeDurability({
    sql: "INSERT INTO stored_object_reservations (scope_key, request_fingerprint, object_row_json) VALUES (?, ?, ?) ON CONFLICT(scope_key) DO NOTHING",
    args: [scopeKey, fingerprint, JSON.stringify(proposed)],
  }, deadline);
  const result = await executeDurability({
    sql: "SELECT request_fingerprint, object_row_json FROM stored_object_reservations WHERE scope_key = ?",
    args: [scopeKey],
  }, deadline);
  const record = result.rows[0];
  if (!record) throw new Error("Stored object reservation disappeared");
  return { fingerprint: String(record.request_fingerprint), row: JSON.parse(String(record.object_row_json)) as StoredObjectRow };
}

export async function insertReservedStoredObject(row: StoredObjectRow): Promise<void> {
  await ensureSchema();
  await executeDurability({
    sql: `INSERT INTO stored_objects (id, workspace_id, venture_id, storage_key, original_filename, mime_type, size_bytes, sha256, created_by_user_id, created_at, deleted_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO NOTHING`,
    args: [
      row.id,
      row.workspaceId,
      row.ventureId,
      row.storageKey,
      row.originalFilename,
      row.mimeType,
      row.sizeBytes,
      row.sha256,
      row.createdByUserId,
      row.createdAt,
      row.deletedAt,
    ],
  }, Date.now() + SQLITE_CONTENTION_BUDGET_MS);
}
