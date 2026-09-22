import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readFile } from "node:fs/promises";
import { afterEach, describe, it } from "node:test";
import type { DomainAuthorizedMutation, UserId, VentureId, WorkspaceId } from "@/contracts";
import { platformVentureRegistry } from "@/core/venture-definition/catalog";
import { createDocumentPort } from "@/platform/documents/port";
import { createAuditLog } from "@/platform/audit/log";
import { ensureSchema } from "@/platform/persistence/db";
import { getDb } from "@/platform/persistence/db";
import { storedObjectDurability } from "@/platform/persistence/durability-client";
import { resetPersistenceLifecycle } from "@/platform/persistence/repositories/sqlite";
import { storedObjects } from "@/platform/persistence/schema";
import { createPermissionService } from "@/platform/permissions/service";
import { createDbMembershipStore } from "@/platform/permissions/membership-store";
import { issueDomainAuthorizedMutation } from "./domain-authority";
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
    await removeDir(objectRoot);
    objectRoot = undefined;
  }
  if (tempDir) {
    await removeDir(tempDir);
    tempDir = undefined;
  }
});

async function removeDir(dir: string) {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    try {
      await rm(dir, { recursive: true, force: true });
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }
  await rm(dir, { recursive: true, force: true });
}

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

function isLibsqlStatementObject(
  statement: unknown,
): statement is { sql: string; args?: unknown } {
  return (
    typeof statement === "object" &&
    statement !== null &&
    "sql" in statement &&
    typeof statement.sql === "string"
  );
}

function durabilityStatementSql(statement: unknown): string {
  if (typeof statement === "string") {
    return statement;
  }
  return isLibsqlStatementObject(statement) ? statement.sql : "";
}

function interceptDurability(
  handler: (
    sql: string,
    statement: unknown,
    execute: (...args: Parameters<ReturnType<typeof storedObjectDurability.openClient>["execute"]>) => ReturnType<
      ReturnType<typeof storedObjectDurability.openClient>["execute"]
    >,
    args: Parameters<ReturnType<typeof storedObjectDurability.openClient>["execute"]>,
  ) => ReturnType<ReturnType<typeof storedObjectDurability.openClient>["execute"]>,
) {
  const open = storedObjectDurability.openClient.bind(storedObjectDurability);
  storedObjectDurability.openClient = (timeoutMs) => {
    const client = open(timeoutMs);
    const execute = client.execute.bind(client);
    client.execute = async (...args: Parameters<typeof execute>) => {
      const statement = args[0];
      const sql = durabilityStatementSql(statement);
      return handler(sql, statement, execute, args);
    };
    return client;
  };
  return () => {
    storedObjectDurability.openClient = open;
  };
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

  it("accepts issued domain authority without broadening normal uploads or deletes", async () => {
    await prepareObjectRoot();
    const { workspaceId, ventureId, ownerId, memberId } = await seedWorkspace("member");
    const service = createService(createLocalBlobStorageAdapter());
    const authority = issueDomainAuthorizedMutation({
      domain: "frigora",
      relation: "assigned_work_order",
      resourceId: "work-order-1",
    });
    const ownerObject = await service.store({
      scope: { workspaceId, ventureId },
      actorUserId: ownerId,
      activeWorkspaceId: workspaceId,
      body: jpegBytes(),
      originalFilename: "owner.jpg",
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
    await assert.rejects(
      () =>
        service.delete({
          actorUserId: memberId,
          activeWorkspaceId: workspaceId,
          objectId: ownerObject.id,
        }),
      (error: unknown) => error instanceof StoredObjectError && error.code === "FORBIDDEN",
    );
    await assert.rejects(
      () =>
        service.storeForDomain({
          scope: { workspaceId, ventureId },
          actorUserId: memberId,
          activeWorkspaceId: workspaceId,
          body: jpegBytes(),
          originalFilename: "shaped.jpg",
          mimeType: "image/jpeg",
          authority: {
            domain: "frigora",
            relation: "assigned_work_order",
            resourceId: "work-order-1",
          },
        }),
      (error: unknown) => error instanceof StoredObjectError && error.code === "FORBIDDEN",
    );
    const reconstructedSeal = Symbol.for(
      "ventureos.storage.issuedDomainAuthorizedMutation",
    );
    await assert.rejects(
      () =>
        service.storeForDomain({
          scope: { workspaceId, ventureId },
          actorUserId: memberId,
          activeWorkspaceId: workspaceId,
          body: jpegBytes(),
          originalFilename: "reconstructed.jpg",
          mimeType: "image/jpeg",
          authority: {
            domain: "frigora",
            relation: "assigned_work_order",
            resourceId: "work-order-1",
            [reconstructedSeal]: true,
          } as DomainAuthorizedMutation,
        }),
      (error: unknown) => error instanceof StoredObjectError && error.code === "FORBIDDEN",
    );
    assert.throws(
      () =>
        issueDomainAuthorizedMutation({
          domain: "unknown-domain",
          relation: "assigned_work_order",
          resourceId: "work-order-1",
        }),
      (error: unknown) => error instanceof StoredObjectError && error.code === "FORBIDDEN",
    );
    assert.throws(
      () =>
        issueDomainAuthorizedMutation({
          domain: "qualora",
          relation: "assigned_work_order",
          resourceId: "work-order-1",
        }),
      (error: unknown) => error instanceof StoredObjectError && error.code === "FORBIDDEN",
    );

    const metadata = await service.storeForDomain({
      scope: { workspaceId, ventureId },
      actorUserId: memberId,
      activeWorkspaceId: workspaceId,
      body: jpegBytes(),
      originalFilename: "assigned-work.jpg",
      mimeType: "image/jpeg",
      authority,
    });
    assert.equal(await service.exists(metadata.id), true);
    assert.equal(metadata.createdByUserId, memberId);

    await assert.rejects(
      () =>
        service.deleteForDomain({
          actorUserId: memberId,
          activeWorkspaceId: workspaceId,
          objectId: metadata.id,
          authority: issueDomainAuthorizedMutation({
            domain: "frigora",
            relation: "assigned_work_order",
            resourceId: "work-order-2",
          }),
        }),
      (error: unknown) => error instanceof StoredObjectError && error.code === "FORBIDDEN",
    );
    await assert.rejects(
      () =>
        service.deleteForDomain({
          actorUserId: memberId,
          activeWorkspaceId: workspaceId,
          objectId: ownerObject.id,
          authority,
        }),
      (error: unknown) => error instanceof StoredObjectError && error.code === "FORBIDDEN",
    );

    await service.deleteForDomain({
      actorUserId: memberId,
      activeWorkspaceId: workspaceId,
      objectId: metadata.id,
      authority,
    });
    assert.equal(await service.exists(metadata.id), false);

    await assert.rejects(
      () =>
        service.storeForDomain({
          scope: { workspaceId: "ws-other" as WorkspaceId, ventureId },
          actorUserId: memberId,
          activeWorkspaceId: workspaceId,
          body: jpegBytes(),
          originalFilename: "cross-workspace.jpg",
          mimeType: "image/jpeg",
          authority,
        }),
      (error: unknown) => error instanceof StoredObjectError && error.code === "FORBIDDEN",
    );
  });

  it("rejects globalThis WeakSet injection through storeForDomain", async () => {
    await prepareObjectRoot();
    const { workspaceId, ventureId, memberId } = await seedWorkspace("member");
    const service = createService(createLocalBlobStorageAdapter());
    const forged = {
      domain: "frigora",
      relation: "assigned_work_order",
      resourceId: "work-order-global-inject",
    } as DomainAuthorizedMutation;
    const key = Symbol.for("ventureos.storage.issuedDomainAuthorizedMutation.registry");
    const globalScope = globalThis as typeof globalThis & {
      [key: symbol]: { issued: WeakSet<object> } | undefined;
    };
    globalScope[key] = { issued: new WeakSet<object>() };
    globalScope[key]!.issued.add(forged);
    try {
      await assert.rejects(
        () =>
          service.storeForDomain({
            scope: { workspaceId, ventureId },
            actorUserId: memberId,
            activeWorkspaceId: workspaceId,
            body: jpegBytes(),
            originalFilename: "global-inject.jpg",
            mimeType: "image/jpeg",
            authority: forged,
          }),
        (error: unknown) => error instanceof StoredObjectError && error.code === "FORBIDDEN",
      );
    } finally {
      delete globalScope[key];
    }
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
    assert.equal(platformVentureRegistry.resolve("frigora").version, "0.22.0");
    const dbSource = await readFile(
      join(process.cwd(), "src/platform/persistence/db.ts"),
      "utf8",
    );
    assert.match(dbSource, /SCHEMA_GENERATION = 28/);
  });
});


describe("F33-04 durable platform idempotency", () => {
  it("reuses one identity across server processes and a crash after byte publication", async (context) => {
    await prepareObjectRoot();
    tempDir = await mkdtemp(join(tmpdir(), "vos-storage-reservation-"));
    const databaseUrl = `file:${join(tempDir, "reservation.db").replaceAll("\\", "/")}`;
    // The locked native driver can retain file handles after client.close().
    // Keep every file-backed connection in a subprocess; OS exit is the release boundary.
    const { fork } = await import("node:child_process");
    const { fileURLToPath } = await import("node:url");
    const workerPath = fileURLToPath(new URL("./fixtures/idempotency-worker.ts", import.meta.url));
    const children: { child: ReturnType<typeof fork>; finished: Promise<unknown> }[] = [];
    function worker(mode: string) {
      const child = fork(workerPath, [databaseUrl, mode], { execArgv: ["--import", "tsx"], silent: true });
      let id: string | undefined;
      let acceptedAuditId: string | undefined;
      let stderr = "";
      let clientClosed = false;
      let snapshot: { reservations: { id: string }[]; objects: { id: string; deletedAt: string | null }[]; audits: { id: string; storedObjectId: string }[] } | undefined;
      let abnormal: Error | undefined;
      const deadline = setTimeout(() => {
        abnormal = new Error(`Storage worker ${child.pid} exceeded its lifecycle deadline`);
        child.kill();
      }, 20_000);
      child.stdout!.resume();
      child.stderr!.on("data", (data) => { stderr += String(data); });
      const ready = new Promise<void>((resolve, reject) => {
        child.on("message", (message) => { if (message === "ready") resolve(); });
        child.once("error", reject);
        child.once("close", () => reject(abnormal ?? new Error(`Worker closed before readiness: ${stderr}`)));
      });
      child.on("message", (message) => {
        if (typeof message === "object" && message && "auditWrite" in message) {
          context.diagnostic(`Native audit write: ${JSON.stringify(message.auditWrite)}`);
        }
        if (typeof message === "object" && message && "auditFailure" in message) {
          context.diagnostic(`Native audit failure: ${JSON.stringify(message.auditFailure)}`);
        }
        if (typeof message === "object" && message && "acceptedAuditId" in message) {
          acceptedAuditId = String((message as { acceptedAuditId: string }).acceptedAuditId);
        }
        if (typeof message === "object" && message && "id" in message) id = String(message.id);
        if (typeof message === "object" && message && "clientClosed" in message) clientClosed = message.clientClosed === true;
        if (typeof message === "object" && message && "reservations" in message) snapshot = message as typeof snapshot;
      });
      const finished = new Promise<{ code: number | null; id: string | undefined; acceptedAuditId: string | undefined; clientClosed: boolean; snapshot: typeof snapshot; stderr: string; abnormal: Error | undefined }>((resolve) => {
        child.once("error", (error) => { abnormal = error; });
        // close follows exit and closure of IPC/stdout/stderr, unlike exit alone.
        child.once("close", (code) => {
          clearTimeout(deadline);
          resolve({ code, id, acceptedAuditId, clientClosed, snapshot, stderr, abnormal });
        });
      });
      const handle = { child, ready, finished, start: () => child.send("go") };
      children.push(handle);
      return handle;
    }
    async function run(mode: string) {
      const current = worker(mode);
      await current.ready;
      current.start();
      const result = await current.finished;
      assert.equal(result.abnormal, undefined);
      assert.equal(result.stderr, "");
      assert.equal(result.code, mode === "crash-after-bytes" ? 73 : 0);
      if (mode !== "crash-after-bytes") assert.equal(result.clientClosed, true);
      return result;
    }
    try {
    await run("setup");
    await run("crash-after-bytes");
    const before = (await run("inspect")).snapshot!;
    assert.equal(before.reservations.length, 1);
    const reservedId = before.reservations[0]!.id;
    assert.equal(before.objects.length, 0);
    const workers = Array.from({ length: 4 }, () => worker("accept"));
    await Promise.all(workers.map((current) => current.ready));
    workers.forEach((current) => current.start());
    const results = await Promise.all(workers.map((current) => current.finished));
    const acceptedAuditIds: string[] = [];
    for (const result of results) {
      assert.equal(result.abnormal, undefined);
      assert.equal(result.stderr, "");
      assert.equal(result.code, 0);
      assert.equal(result.clientClosed, true);
      assert.equal(result.id, reservedId);
      assert.equal(typeof result.acceptedAuditId, "string");
      acceptedAuditIds.push(result.acceptedAuditId!);
    }
    const after = (await run("inspect")).snapshot!;
    context.diagnostic(`Persisted audits: ${JSON.stringify(after.audits)}`);
    assert.equal(after.objects.length, 1);
    assert.equal(after.objects[0]!.id, reservedId);
    assert.equal(after.objects[0]!.deletedAt, null);
    assert.equal(after.audits.length, workers.length);
    assert.equal(new Set(after.audits.map((row) => row.id)).size, workers.length);
    assert.ok(after.audits.every((row) => row.storedObjectId === reservedId));
    for (const auditId of acceptedAuditIds) {
      assert.ok(after.audits.some((row) => row.id === auditId), `successful worker audit ${auditId} missing from independent inspect`);
    }
    context.diagnostic(`All ${after.audits.length} independent-process creation audits persisted for the reserved identity`);
    context.diagnostic(`crash/restart: ${workers.length} independent callers reused ${reservedId}; one live StoredObject`);
    } finally {
      for (const current of children) {
        if (current.child.exitCode === null && current.child.signalCode === null) current.child.kill();
      }
      await Promise.all(children.map((current) => current.finished));
      context.diagnostic(`All ${children.length} subprocess close events received before file cleanup; parent never opened reservation.db`);
    }
  });

  it("retries creation audit BUSY with identical values and persists one event", async () => {
    await prepareObjectRoot();
    const { workspaceId, ownerId } = await seedWorkspace();
    const attempts: string[] = [];
    const restore = interceptDurability(async (sql, statement, execute, args) => {
      if (/insert into audit_events/i.test(sql)) {
        attempts.push(JSON.stringify(statement));
        if (attempts.length <= 2) throw Object.assign(new Error("database is locked"), { code: "SQLITE_BUSY" });
      }
      return execute(...args);
    });
    try {
      const object = await createService(createLocalBlobStorageAdapter()).store({
        scope: { workspaceId }, actorUserId: ownerId, activeWorkspaceId: workspaceId,
        body: jpegBytes(), originalFilename: "audit.jpg", mimeType: "image/jpeg",
        idempotency: { key: "audit-busy", requestFingerprint: "same" },
      });
      assert.equal(attempts.length, 3);
      assert.equal(new Set(attempts).size, 1);
      const events = (await createAuditLog().list()).filter((row) => row.action === "stored_object.created");
      assert.equal(events.length, 1);
      assert.equal(events[0]!.metadata?.storedObjectId, object.id);
    } finally {
      restore();
    }
  });

  for (const code of ["SQLITE_LOCKED", "SQLITE_CONSTRAINT", "UNKNOWN_DATABASE_ERROR"]) {
    it(`fails creation closed without retry for ${code}`, async () => {
      await prepareObjectRoot();
      const { workspaceId, ownerId } = await seedWorkspace();
      const failure = Object.assign(new Error("injected audit failure"), { code });
      let attempts = 0;
      const restore = interceptDurability(async (sql, _statement, execute, args) => {
        if (/insert into audit_events/i.test(sql)) { attempts++; throw failure; }
        return execute(...args);
      });
      try {
        await assert.rejects(createService(createLocalBlobStorageAdapter()).store({
          scope: { workspaceId }, actorUserId: ownerId, activeWorkspaceId: workspaceId,
          body: jpegBytes(), originalFilename: "audit.jpg", mimeType: "image/jpeg",
          idempotency: { key: "audit-permanent", requestFingerprint: "same" },
        }), (error: unknown) => error === failure);
        assert.equal(attempts, 1);
        assert.equal((await createAuditLog().list()).filter((row) => row.action === "stored_object.created").length, 0);
        assert.equal((await getDb().select().from(storedObjects)).length, 1);
      } finally {
        restore();
      }
    });
  }

  it("fails creation audit closed when the BUSY deadline is exhausted", async (context) => {
    await seedWorkspace();
    context.mock.timers.enable({ apis: ["Date"] });
    const failure = Object.assign(new Error("database is locked"), { code: "SQLITE_BUSY" });
    let attempts = 0;
    const restore = interceptDurability(async (sql, _statement, execute, args) => {
      if (/insert into audit_events/i.test(sql)) {
        attempts++;
        context.mock.timers.tick(5_001);
        throw failure;
      }
      return execute(...args);
    });
    try {
      await assert.rejects(createAuditLog().record({ action: "stored_object.created" }),
        (error: unknown) => error === failure);
      assert.equal(attempts, 1);
      assert.equal((await createAuditLog().list()).length, 0);
    } finally {
      restore();
      context.mock.timers.reset();
    }
  });

  it("recovers native SQLITE_BUSY on a new client and never accepts same-client local success", async (context) => {
    await prepareObjectRoot();
    tempDir = await mkdtemp(join(tmpdir(), "vos-storage-native-busy-"));
    const databaseUrl = `file:${join(tempDir, "busy.db").replaceAll("\\", "/")}`;
    const { fork } = await import("node:child_process");
    const { fileURLToPath } = await import("node:url");
    const workerPath = fileURLToPath(new URL("./fixtures/idempotency-worker.ts", import.meta.url));
    const child = fork(workerPath, [databaseUrl, "native-busy"], { execArgv: ["--import", "tsx"], silent: true });
    let stderr = "";
    let probe: { id?: string; nativeBusy?: number; reusedPoisoned?: number; durableAudits?: number; durableStoredObjectId?: string | null } | undefined;
    child.stdout!.resume();
    child.stderr!.on("data", (data) => { stderr += String(data); });
    const ready = new Promise<void>((resolve, reject) => {
      child.on("message", (message) => { if (message === "ready") resolve(); });
      child.once("error", reject);
      child.once("close", () => reject(new Error(`Native BUSY worker closed before readiness: ${stderr}`)));
    });
    child.on("message", (message) => {
      if (typeof message === "object" && message && "nativeBusy" in message) {
        probe = message as typeof probe;
        context.diagnostic(`Native BUSY probe: ${JSON.stringify(message)}`);
      }
    });
    const finished = new Promise<{ code: number | null }>((resolve) => {
      child.once("close", (code) => resolve({ code }));
    });
    await ready;
    child.send("go");
    const result = await finished;
    assert.equal(stderr, "");
    assert.equal(result.code, 0);
    assert.ok((probe?.nativeBusy ?? 0) >= 1);
    assert.equal(probe?.reusedPoisoned, 0);
    assert.equal(probe?.durableAudits, 1);
    assert.equal(probe?.durableStoredObjectId, probe?.id);
  });

  it("recovers reserved-object lookup BUSY on a fresh connection without allocating another identity", async () => {
    await prepareObjectRoot();
    const { workspaceId, ownerId } = await seedWorkspace();
    const lookupClients: object[] = [];
    let lookupBusy = 0;
    const restore = interceptDurability(async (sql, _statement, execute, args) => {
      if (/from stored_objects where id/i.test(sql)) {
        lookupClients.push(execute);
        if (lookupBusy === 0) {
          lookupBusy++;
          throw Object.assign(new Error("database is locked"), { code: "SQLITE_BUSY" });
        }
      }
      return execute(...args);
    });
    try {
      const first = await createService(createLocalBlobStorageAdapter()).store({
        scope: { workspaceId }, actorUserId: ownerId, activeWorkspaceId: workspaceId,
        body: jpegBytes(), originalFilename: "lookup.jpg", mimeType: "image/jpeg",
        idempotency: { key: "lookup-busy", requestFingerprint: "same" },
      });
      assert.equal(lookupBusy, 1);
      assert.ok(lookupClients.length >= 2);
      const second = await createService(createLocalBlobStorageAdapter()).store({
        scope: { workspaceId }, actorUserId: ownerId, activeWorkspaceId: workspaceId,
        body: jpegBytes(), originalFilename: "lookup.jpg", mimeType: "image/jpeg",
        idempotency: { key: "lookup-busy", requestFingerprint: "same" },
      });
      assert.equal(second.id, first.id);
      assert.equal((await getDb().select().from(storedObjects)).length, 1);
    } finally {
      restore();
    }
  });

  it("arbitrates twelve concurrent requests, conflicts on changed bytes and fingerprint, survives service recreation", async () => {
    await prepareObjectRoot();
    const { workspaceId, ownerId } = await seedWorkspace();
    const adapter = createLocalBlobStorageAdapter();
    const request = { scope: { workspaceId }, actorUserId: ownerId, activeWorkspaceId: workspaceId,
      body: jpegBytes(), originalFilename: "same.jpg", mimeType: "image/jpeg",
      idempotency: { key: "multi-request", requestFingerprint: "request-1" } };
    const results = await Promise.all(Array.from({length: 12}, () => createService(adapter).store(request)));
    assert.equal(new Set(results.map(row => row.id)).size, 1);
    assert.equal((await getDb().select().from(storedObjects)).length, 1);
    for (const change of [{ body: jpegBytes(1) }, { idempotency: { ...request.idempotency, requestFingerprint: "request-2" } }]) {
      await assert.rejects(createService(adapter).store({ ...request, ...change }),
        (error: unknown) => error instanceof StoredObjectError && error.code === "IDEMPOTENCY_CONFLICT");
    }
    assert.equal((await createService(adapter).store(request)).id, results[0]!.id);
    assert.equal((await getDb().select().from(storedObjects)).length, 1);
  });

  it("recovers reserved bytes after metadata persistence failure without another allocation", async () => {
    await prepareObjectRoot();
    const { workspaceId, ownerId } = await seedWorkspace();
    const adapter = createLocalBlobStorageAdapter();
    const keys: string[] = [];
    const tracking = { ...adapter, async put(key: string, bytes: Uint8Array) { keys.push(key); await adapter.put(key, bytes); } };
    const request = { scope: { workspaceId }, actorUserId: ownerId, activeWorkspaceId: workspaceId,
      body: jpegBytes(), originalFilename: "retry.jpg", mimeType: "image/jpeg",
      idempotency: { key: "partial", requestFingerprint: "same" } };
    const failing = createStoredObjectService({ adapter: tracking, audit: createAuditLog(),
      permissions: createPermissionService(createDbMembershipStore()), insertMetadata: async () => { throw Error("Injected metadata outage"); } });
    await assert.rejects(failing.store(request), /metadata outage/);
    assert.equal((await getDb().select().from(storedObjects)).length, 0);
    await createService(tracking).store(request);
    assert.equal(new Set(keys).size, 1);
    assert.equal((await getDb().select().from(storedObjects)).length, 1);
  });

  it("reports failed byte compensation explicitly", async () => {
    const { workspaceId, ownerId } = await seedWorkspace();
    const service = createStoredObjectService({ adapter: {
      async put() {}, async get() { return null; }, async exists() { return true; },
      async delete() { throw Error("Injected cleanup outage"); },
    }, audit: createAuditLog(), permissions: createPermissionService(createDbMembershipStore()),
      insertMetadata: async () => { throw Error("Injected metadata outage"); } });
    await assert.rejects(service.store({ scope: { workspaceId }, actorUserId: ownerId, activeWorkspaceId: workspaceId,
      body: jpegBytes(), originalFilename: "retry.jpg", mimeType: "image/jpeg" }),
      (error: unknown) => error instanceof StoredObjectError && error.code === "DELETE_BYTES_FAILED");
  });
});
