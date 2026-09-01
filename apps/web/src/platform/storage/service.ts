import { createHash } from "node:crypto";
import type {
  PermissionService,
  StoredObjectMetadata,
  StoredObjectPort,
  StoredObjectRef,
  VentureId,
  WorkspaceId,
} from "@/contracts";
import type { StoredObjectId, UserId } from "@/contracts/ids";
import type { AuditLog } from "@/platform/audit/log";
import { createId, nowIso } from "@/platform/ids";
import { StoredObjectError } from "./errors";
import {
  findStoredObjectById,
  insertStoredObject,
  tombstoneStoredObject,
  type StoredObjectRow,
} from "./metadata";
import type { BlobStorageAdapter } from "./types";
import {
  assertSafeStorageKeySegment,
  validateStoredObjectUpload,
} from "./validation";

type StoredObjectServiceDeps = {
  adapter: BlobStorageAdapter;
  audit: AuditLog;
  permissions: PermissionService;
  insertMetadata?: (row: StoredObjectRow) => Promise<void>;
};

function toMetadata(row: StoredObjectRow): StoredObjectMetadata {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    ventureId: row.ventureId,
    originalFilename: row.originalFilename,
    mimeType: row.mimeType,
    sizeBytes: row.sizeBytes,
    sha256: row.sha256,
    createdByUserId: row.createdByUserId,
    createdAt: row.createdAt,
    deletedAt: row.deletedAt,
  };
}

function toRef(metadata: StoredObjectMetadata): StoredObjectRef {
  return {
    id: metadata.id,
    workspaceId: metadata.workspaceId,
    ventureId: metadata.ventureId,
    mimeType: metadata.mimeType,
    sizeBytes: metadata.sizeBytes,
    originalFilename: metadata.originalFilename,
    createdAt: metadata.createdAt,
  };
}

function buildStorageKey(workspaceId: WorkspaceId, objectId: StoredObjectId) {
  assertSafeStorageKeySegment(workspaceId, "workspaceId");
  assertSafeStorageKeySegment(objectId, "objectId");
  return `${workspaceId}/${objectId}`;
}

async function assertWorkspaceMembership(
  userId: UserId,
  workspaceId: WorkspaceId,
  permissions: PermissionService,
) {
  const role = await permissions.roleFor(userId, workspaceId);
  if (!role) {
    throw new StoredObjectError("FORBIDDEN", "Workspace membership is required.");
  }
}

async function assertActiveWorkspace(activeWorkspaceId: WorkspaceId, workspaceId: WorkspaceId) {
  if (activeWorkspaceId !== workspaceId) {
    throw new StoredObjectError("FORBIDDEN", "Active workspace does not match the object scope.");
  }
}

async function assertStorePermission(
  userId: UserId,
  workspaceId: WorkspaceId,
  ventureId: VentureId | undefined,
  permissions: PermissionService,
) {
  const permission = ventureId ? "venture.update" : "workspace.update";
  const allowed = await permissions.can({
    userId,
    permission,
    resource: { type: "workspace", id: workspaceId },
  });
  if (!allowed) {
    throw new StoredObjectError("FORBIDDEN", "Upload is not permitted for this scope.");
  }
}

async function assertReadPermission(
  userId: UserId,
  workspaceId: WorkspaceId,
  ventureId: VentureId | null,
  permissions: PermissionService,
) {
  const permission = ventureId ? "venture.read" : "workspace.read";
  const allowed = await permissions.can({
    userId,
    permission,
    resource: { type: "workspace", id: workspaceId },
  });
  if (!allowed) {
    throw new StoredObjectError("FORBIDDEN", "Read access is not permitted for this object.");
  }
}

export function createStoredObjectService(deps: StoredObjectServiceDeps): StoredObjectPort {
  return {
    async store(input) {
      await assertActiveWorkspace(input.activeWorkspaceId, input.scope.workspaceId);
      await assertWorkspaceMembership(input.actorUserId, input.scope.workspaceId, deps.permissions);
      await assertStorePermission(
        input.actorUserId,
        input.scope.workspaceId,
        input.scope.ventureId,
        deps.permissions,
      );

      const validated = validateStoredObjectUpload({
        body: input.body,
        originalFilename: input.originalFilename,
        mimeType: input.mimeType,
      });

      const id = createId<StoredObjectId>();
      const storageKey = buildStorageKey(input.scope.workspaceId, id);
      const sha256 = createHash("sha256").update(input.body).digest("hex");
      const createdAt = nowIso();

      try {
        await deps.adapter.put(storageKey, input.body);
      } catch (error) {
        if (error instanceof StoredObjectError) {
          throw error;
        }
        throw new StoredObjectError("STORAGE", "Could not store object bytes.");
      }

      const row: StoredObjectRow = {
        id,
        workspaceId: input.scope.workspaceId,
        ventureId: input.scope.ventureId ?? null,
        storageKey,
        originalFilename: validated.originalFilename,
        mimeType: validated.mimeType,
        sizeBytes: input.body.byteLength,
        sha256,
        createdByUserId: input.actorUserId,
        createdAt,
        deletedAt: null,
      };

      try {
        const insertMetadata = deps.insertMetadata ?? insertStoredObject;
        await insertMetadata(row);
      } catch (error) {
        try {
          await deps.adapter.delete(storageKey);
        } catch {
          // Best-effort compensation.
        }
        const detail = error instanceof Error ? error.message : "unknown error";
        throw new StoredObjectError("STORAGE", `Could not persist object metadata: ${detail}`);
      }

      const metadata = toMetadata(row);
      await deps.audit.record({
        action: "stored_object.created",
        actor: { userId: input.actorUserId },
        metadata: {
          storedObjectId: metadata.id,
          workspaceId: metadata.workspaceId,
          ventureId: metadata.ventureId ?? "",
          mimeType: metadata.mimeType,
          sizeBytes: String(metadata.sizeBytes),
          sha256: metadata.sha256,
        },
      });

      return metadata;
    },

    async open(input) {
      const row = await findStoredObjectById(input.objectId);
      if (!row || row.deletedAt) {
        return null;
      }

      if (row.workspaceId !== input.activeWorkspaceId) {
        return null;
      }

      try {
        await assertWorkspaceMembership(input.actorUserId, row.workspaceId, deps.permissions);
        await assertReadPermission(
          input.actorUserId,
          row.workspaceId,
          row.ventureId,
          deps.permissions,
        );
      } catch (error) {
        if (error instanceof StoredObjectError && error.code === "FORBIDDEN") {
          return null;
        }
        throw error;
      }

      const body = await deps.adapter.get(row.storageKey);
      if (!body) {
        await deps.audit.record({
          action: "stored_object.bytes_missing",
          actor: { userId: input.actorUserId },
          metadata: {
            storedObjectId: row.id,
            workspaceId: row.workspaceId,
            ventureId: row.ventureId ?? "",
          },
        });
        return null;
      }

      const metadata = toMetadata(row);
      await deps.audit.record({
        action: "stored_object.downloaded",
        actor: { userId: input.actorUserId },
        metadata: {
          storedObjectId: metadata.id,
          workspaceId: metadata.workspaceId,
          ventureId: metadata.ventureId ?? "",
        },
      });

      return { metadata, body };
    },

    async delete(input) {
      const row = await findStoredObjectById(input.objectId);
      if (!row || row.deletedAt) {
        throw new StoredObjectError("NOT_FOUND", "Stored object was not found.");
      }

      if (row.workspaceId !== input.activeWorkspaceId) {
        throw new StoredObjectError("NOT_FOUND", "Stored object was not found.");
      }

      await assertWorkspaceMembership(input.actorUserId, row.workspaceId, deps.permissions);
      await assertStorePermission(
        input.actorUserId,
        row.workspaceId,
        row.ventureId ?? undefined,
        deps.permissions,
      );

      const deletedAt = nowIso();
      await tombstoneStoredObject(row.id, deletedAt);

      try {
        await deps.adapter.delete(row.storageKey);
      } catch (error) {
        await deps.audit.record({
          action: "stored_object.deleted",
          actor: { userId: input.actorUserId },
          metadata: {
            storedObjectId: row.id,
            workspaceId: row.workspaceId,
            ventureId: row.ventureId ?? "",
            byteDeleteFailed: "true",
          },
        });
        const detail = error instanceof Error ? error.message : "unknown error";
        throw new StoredObjectError(
          "DELETE_BYTES_FAILED",
          `Object metadata was tombstoned but bytes could not be deleted: ${detail}`,
        );
      }

      await deps.audit.record({
        action: "stored_object.deleted",
        actor: { userId: input.actorUserId },
        metadata: {
          storedObjectId: row.id,
          workspaceId: row.workspaceId,
          ventureId: row.ventureId ?? "",
        },
      });
    },

    async exists(objectId) {
      const row = await findStoredObjectById(objectId);
      if (!row || row.deletedAt) {
        return false;
      }
      return deps.adapter.exists(row.storageKey);
    },
  };
}

export function toStoredObjectRef(metadata: StoredObjectMetadata): StoredObjectRef {
  return toRef(metadata);
}
