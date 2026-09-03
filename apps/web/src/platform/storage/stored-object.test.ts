import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readFile } from "node:fs/promises";
import { afterEach, describe, it } from "node:test";
import type { UserId, VentureId, WorkspaceId } from "@/contracts";
import { platformVentureRegistry } from "@/core/venture-definition/catalog";
import { createDocumentPort } from "@/platform/documents/port";
import { createAuditLog } from "@/platform/audit/log";
import { ensureSchema } from "@/platform/persistence/db";
import { getDb } from "@/platform/persistence/db";
import { resetPersistenceLifecycle } from "@/platform/persistence/repositories/sqlite";
import { storedObjects } from "@/platform/persistence/schema";
import { createPermissionService } from "@/platform/permissions/service";
import { createDbMembershipStore } from "@/platform/permissions/membership-store";
import { StoredObjectError } from "./errors";
import { createLocalBlobStorageAdapter } from "./local-adapter";
import { findStoredObjectById } from "./metadata";
import { createStoredObjectService } from "./service";
import type { BlobStorageAdapter } from "./types";
import { storedObjectMaxBytes } from "./validation";

let objectRoot: string | undefined;
let tempDir: string | undefined;

afterEach(async () => {
  await resetPersistenceLifecycle(":memory:");
  delete process.env.STORED_OBJECT_ROOT;
  delete process.env.STORED_OBJECT_MAX_BYTES;
  if (objectRoot) {
    await rm(objectRoot, { recursive: true, force: true });
    objectRoot = undefined;
  }
  if (tempDir) {
    await rm(tempDir, { recursive: true, force: true });
    tempDir = undefined;
  }
});

async function prepareObjectRoot() {
  objectRoot = await mkdtemp(join(tmpdir(), "vos-obj-"));
  process.env.STORED_OBJECT_ROOT = objectRoot;
}

function jpegBytes(extra = 0) {
  const bytes = [0xff, 0xd8, 0xff, 0xd9];
  return new Uint8Array(bytes.concat(Array(extra).fill(0)));
}

function pdfBytes() {
  return new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]);
}

async function seedWorkspace(role: "owner" | "admin" | "member" = "owner") {
  await resetPersistenceLifecycle(":memory:");
  await ensureSchema();
  const workspaceId = "ws-storage" as WorkspaceId;
  const ventureId = "ven-storage" as VentureId;
  const ownerId = "user-owner" as UserId;
  const memberId = "user-member" as UserId;
  const store = (await import("@/platform/persistence/repositories/sqlite")).getPersistence();
  await store.organisations.insert({
    id: workspaceId,
    name: "Storage Workspace",
    slug: "ws-storage",
    createdAt: "2026-09-01T00:00:00.000Z",
  });
  const memberships = createDbMembershipStore();
  await memberships.setRole(ownerId, workspaceId, "owner");
  await memberships.setRole(memberId, workspaceId, role);
  return { workspaceId, ventureId, ownerId, memberId };
}

function createService(adapter: BlobStorageAdapter) {
  return createStoredObjectService({
    adapter,
    audit: createAuditLog(),
    permissions: createPermissionService(createDbMembershipStore()),
  });
}

describe("Stored object platform", () => {
  it("stores and retrieves bytes with matching metadata", async () => {
    await prepareObjectRoot();
    const { workspaceId, ownerId } = await seedWorkspace();
    const service = createService(createLocalBlobStorageAdapter());
    const body = jpegBytes();

    const metadata = await service.store({
      scope: { workspaceId },
      actorUserId: ownerId,
      activeWorkspaceId: workspaceId,
      body,
      originalFilename: "photo.jpg",
      mimeType: "image/jpeg",
    });

    const opened = await service.open({
      actorUserId: ownerId,
      activeWorkspaceId: workspaceId,
      objectId: metadata.id,
    });

    assert.ok(opened);
    assert.equal(opened.body.byteLength, body.byteLength);
    assert.equal(opened.metadata.originalFilename, "photo.jpg");
    assert.equal(await service.exists(metadata.id), true);
  });

  it("deletes objects and treats them as missing afterward", async () => {
    await prepareObjectRoot();
    const { workspaceId, ownerId } = await seedWorkspace();
    const service = createService(createLocalBlobStorageAdapter());
    const metadata = await service.store({
      scope: { workspaceId },
      actorUserId: ownerId,
      activeWorkspaceId: workspaceId,
      body: pdfBytes(),
      originalFilename: "sheet.pdf",
      mimeType: "application/pdf",
    });

    await service.delete({
      actorUserId: ownerId,
      activeWorkspaceId: workspaceId,
      objectId: metadata.id,
    });

    assert.equal(
      await service.open({
        actorUserId: ownerId,
        activeWorkspaceId: workspaceId,
        objectId: metadata.id,
      }),
      null,
    );
    assert.equal(await service.exists(metadata.id), false);
  });

  it("isolates workspace tenancy", async () => {
    await prepareObjectRoot();
    const first = await seedWorkspace();
    const secondWorkspaceId = "ws-other" as WorkspaceId;
    const secondOwnerId = "user-other" as UserId;
    const store = (await import("@/platform/persistence/repositories/sqlite")).getPersistence();
    await store.organisations.insert({
      id: secondWorkspaceId,
      name: "Other Workspace",
      slug: "ws-other",
      createdAt: "2026-09-01T00:00:00.000Z",
    });
    await createDbMembershipStore().setRole(secondOwnerId, secondWorkspaceId, "owner");

    const service = createService(createLocalBlobStorageAdapter());
    const metadata = await service.store({
      scope: { workspaceId: first.workspaceId },
      actorUserId: first.ownerId,
      activeWorkspaceId: first.workspaceId,
      body: jpegBytes(),
      originalFilename: "photo.jpg",
      mimeType: "image/jpeg",
    });

    assert.equal(
      await service.open({
        actorUserId: secondOwnerId,
        activeWorkspaceId: secondWorkspaceId,
        objectId: metadata.id,
      }),
      null,
    );
  });

  it("scopes venture objects to venture permissions", async () => {
    await prepareObjectRoot();
    const { workspaceId, ventureId, ownerId, memberId } = await seedWorkspace("member");
    const service = createService(createLocalBlobStorageAdapter());
    const metadata = await service.store({
      scope: { workspaceId, ventureId },
      actorUserId: ownerId,
      activeWorkspaceId: workspaceId,
      body: jpegBytes(),
      originalFilename: "photo.jpg",
      mimeType: "image/jpeg",
    });

    await assert.rejects(
      () =>
        service.store({
          scope: { workspaceId, ventureId },
          actorUserId: memberId,
          activeWorkspaceId: workspaceId,
          body: jpegBytes(),
          originalFilename: "blocked.jpg",
          mimeType: "image/jpeg",
        }),
      (error: unknown) => error instanceof StoredObjectError && error.code === "FORBIDDEN",
    );

    const opened = await service.open({
      actorUserId: memberId,
      activeWorkspaceId: workspaceId,
      objectId: metadata.id,
    });
    assert.ok(opened);
    assert.equal(opened!.metadata.id, metadata.id);
  });

  it("allows workspace-only objects with workspace read permission", async () => {
    await prepareObjectRoot();
    const { workspaceId, ownerId, memberId } = await seedWorkspace("member");
    const service = createService(createLocalBlobStorageAdapter());
    const metadata = await service.store({
      scope: { workspaceId },
      actorUserId: ownerId,
      activeWorkspaceId: workspaceId,
      body: jpegBytes(),
      originalFilename: "photo.jpg",
      mimeType: "image/jpeg",
    });

    const opened = await service.open({
      actorUserId: memberId,
      activeWorkspaceId: workspaceId,
      objectId: metadata.id,
    });
    assert.ok(opened);
  });

  it("rejects oversized, forbidden, zero-byte, and unsafe filename uploads", async () => {
    await prepareObjectRoot();
    const { workspaceId, ownerId } = await seedWorkspace();
    const service = createService(createLocalBlobStorageAdapter());

    await assert.rejects(
      () =>
        service.store({
          scope: { workspaceId },
          actorUserId: ownerId,
          activeWorkspaceId: workspaceId,
          body: new Uint8Array(),
          originalFilename: "empty.jpg",
          mimeType: "image/jpeg",
        }),
      (error: unknown) => error instanceof StoredObjectError && error.code === "VALIDATION",
    );

    const oversized = jpegBytes(storedObjectMaxBytes());
    await assert.rejects(
      () =>
        service.store({
          scope: { workspaceId },
          actorUserId: ownerId,
          activeWorkspaceId: workspaceId,
          body: oversized,
          originalFilename: "big.jpg",
          mimeType: "image/jpeg",
        }),
      (error: unknown) => error instanceof StoredObjectError && error.code === "VALIDATION",
    );

    await assert.rejects(
      () =>
        service.store({
          scope: { workspaceId },
          actorUserId: ownerId,
          activeWorkspaceId: workspaceId,
          body: jpegBytes(),
          originalFilename: "bad.jpg",
          mimeType: "application/javascript",
        }),
      (error: unknown) => error instanceof StoredObjectError && error.code === "VALIDATION",
    );

    const metadata = await service.store({
      scope: { workspaceId },
      actorUserId: ownerId,
      activeWorkspaceId: workspaceId,
      body: jpegBytes(),
      originalFilename: "../../passwd",
      mimeType: "image/jpeg",
    });
    assert.equal(metadata.originalFilename, "passwd");
  });

  it("does not persist metadata when adapter write fails", async () => {
    await prepareObjectRoot();
    const { workspaceId, ownerId } = await seedWorkspace();
    const failingAdapter: BlobStorageAdapter = {
      async put() {
        throw new StoredObjectError("STORAGE", "write failed");
      },
      async get() {
        return null;
      },
      async delete() {},
      async exists() {
        return false;
      },
    };
    const service = createService(failingAdapter);

    await assert.rejects(
      () =>
        service.store({
          scope: { workspaceId },
          actorUserId: ownerId,
          activeWorkspaceId: workspaceId,
          body: jpegBytes(),
          originalFilename: "photo.jpg",
          mimeType: "image/jpeg",
        }),
      (error: unknown) => error instanceof StoredObjectError && error.code === "STORAGE",
    );

    const rows = await getDb().select().from(storedObjects);
    assert.equal(rows.length, 0);
  });

  it("compensates byte writes when metadata insert fails", async () => {
    await prepareObjectRoot();
    const { workspaceId, ownerId } = await seedWorkspace();
    const adapter = createLocalBlobStorageAdapter();
    let putKey: string | undefined;
    const trackingAdapter: BlobStorageAdapter = {
      async put(storageKey, body) {
        putKey = storageKey;
        await adapter.put(storageKey, body);
      },
      get: adapter.get,
      delete: adapter.delete,
      exists: adapter.exists,
    };
    const trackedService = createStoredObjectService({
      adapter: trackingAdapter,
      audit: createAuditLog(),
      permissions: createPermissionService(createDbMembershipStore()),
      insertMetadata: async () => {
        throw new Error("metadata insert failed");
      },
    });

    await assert.rejects(
      () =>
        trackedService.store({
          scope: { workspaceId },
          actorUserId: ownerId,
          activeWorkspaceId: workspaceId,
          body: jpegBytes(),
          originalFilename: "photo.jpg",
          mimeType: "image/jpeg",
        }),
      (error: unknown) => error instanceof StoredObjectError && error.code === "STORAGE",
    );
    assert.ok(putKey);
    assert.equal(await adapter.exists(putKey!), false);
    const rows = await getDb().select().from(storedObjects);
    assert.equal(rows.length, 0);
  });

  it("returns null when bytes are missing but metadata remains", async () => {
    await prepareObjectRoot();
    const { workspaceId, ownerId } = await seedWorkspace();
    const adapter = createLocalBlobStorageAdapter();
    const service = createService(adapter);
    const metadata = await service.store({
      scope: { workspaceId },
      actorUserId: ownerId,
      activeWorkspaceId: workspaceId,
      body: jpegBytes(),
      originalFilename: "photo.jpg",
      mimeType: "image/jpeg",
    });

    const row = await findStoredObjectById(metadata.id);
    assert.ok(row);
    await adapter.delete(row!.storageKey);

    assert.equal(
      await service.open({
        actorUserId: ownerId,
        activeWorkspaceId: workspaceId,
        objectId: metadata.id,
      }),
      null,
    );
  });

  it("retains tombstone when byte deletion fails", async () => {
    await prepareObjectRoot();
    const { workspaceId, ownerId } = await seedWorkspace();
    const adapter = createLocalBlobStorageAdapter();
    const service = createService(adapter);
    const metadata = await service.store({
      scope: { workspaceId },
      actorUserId: ownerId,
      activeWorkspaceId: workspaceId,
      body: jpegBytes(),
      originalFilename: "photo.jpg",
      mimeType: "image/jpeg",
    });

    const row = await findStoredObjectById(metadata.id);
    assert.ok(row);
    const failingDeleteAdapter: BlobStorageAdapter = {
      put: adapter.put,
      get: adapter.get,
      exists: adapter.exists,
      async delete() {
        throw new StoredObjectError("STORAGE", "delete failed");
      },
    };
    const deleteService = createService(failingDeleteAdapter);

    await assert.rejects(
      () =>
        deleteService.delete({
          actorUserId: ownerId,
          activeWorkspaceId: workspaceId,
          objectId: metadata.id,
        }),
      (error: unknown) =>
        error instanceof StoredObjectError && error.code === "DELETE_BYTES_FAILED",
    );

    const tombstoned = await findStoredObjectById(metadata.id);
    assert.ok(tombstoned?.deletedAt);
    assert.equal(await adapter.exists(row!.storageKey), true);
  });

  it("keeps DocumentPort and Frigora definition unchanged", async () => {
    const documents = createDocumentPort();
    assert.equal(await documents.get("doc-1" as never), null);
    assert.deepEqual(await documents.list({ workspaceId: "ws-1" as WorkspaceId }), []);
    assert.equal(platformVentureRegistry.resolve("frigora").version, "0.16.0");
    const dbSource = await readFile(
      join(process.cwd(), "src/platform/persistence/db.ts"),
      "utf8",
    );
    assert.match(dbSource, /SCHEMA_GENERATION = 22/);
  });
});
