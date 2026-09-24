// Regression subprocess: real SQLite and local adapter, isolated test storage only.
import { createStoredObjectService } from "../service";
import { createLocalBlobStorageAdapter } from "../local-adapter";
import { createAuditLog } from "@/platform/audit/log";
import { createClient } from "@libsql/client";
import { resetDatabaseLifecycle, ensureSchema, getClient } from "@/platform/persistence/db";
import { isSqliteBusy, storedObjectDurability } from "@/platform/persistence/durability-client";
import { createPermissionService } from "@/platform/permissions/service";
import { createDbMembershipStore } from "@/platform/permissions/membership-store";
import type { UserId, WorkspaceId } from "@/contracts";

function requiredWorkerDatabaseUrl(): string {
  const url = process.argv[2];
  if (typeof url !== "string" || url.length === 0) {
    throw new Error("idempotency-worker requires a database URL as argv[2]");
  }
  return url;
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

function durabilityStatementPositionalArg(statement: unknown): unknown {
  if (!isLibsqlStatementObject(statement) || !Array.isArray(statement.args)) {
    return undefined;
  }
  return statement.args[0];
}

const databaseUrl = requiredWorkerDatabaseUrl();
await resetDatabaseLifecycle(databaseUrl);
await ensureSchema();
const openDurabilityClient = storedObjectDurability.openClient.bind(storedObjectDurability);
storedObjectDurability.openClient = (timeoutMs) => {
  const client = openDurabilityClient(timeoutMs);
  const execute = client.execute.bind(client);
  client.execute = async (...args: Parameters<typeof execute>) => {
    const statement = args[0];
    const sql = durabilityStatementSql(statement);
    try {
      const result = await execute(...args);
      if (/insert into audit_events/i.test(sql)) {
        process.send?.({ auditWrite: { pid: process.pid, rowsAffected: result.rowsAffected,
          auditId: durabilityStatementPositionalArg(statement) } });
      }
      return result;
    } catch (error) {
      if (/insert into audit_events/i.test(sql)) {
        const causes = [];
        let current: unknown = error;
        while (current && typeof current === "object") {
          const detail = current as Record<string, unknown>;
          causes.push({
            class: current.constructor.name, name: detail.name,
            code: detail.code, extendedCode: detail.extendedCode,
            rawCode: detail.rawCode, message: detail.message,
          });
          current = detail.cause;
        }
        process.send?.({ auditFailure: { pid: process.pid, mode: process.argv[3],
          connection: "short-lived durability client; reservation.db", operation: "INSERT audit_events", causes } });
      }
      throw error;
    }
  };
  return client;
};
process.send?.("ready");
await new Promise<void>((resolve) => process.once("message", () => resolve()));
const adapter = createLocalBlobStorageAdapter();
const put = adapter.put;
adapter.put = async (key, bytes) => {
  await put(key, bytes);
  if (process.argv[3] === "crash-after-bytes") process.exit(73);
};
try {
  if (process.argv[3] === "setup") {
    await createDbMembershipStore().setRole("user-owner" as UserId, "ws-storage" as WorkspaceId, "owner");
  } else if (process.argv[3] === "inspect") {
    const reservations = await getClient().execute("SELECT object_row_json FROM stored_object_reservations");
    const objects = await getClient().execute("SELECT id, deleted_at FROM stored_objects");
    const audits = await getClient().execute("SELECT id, metadata_json FROM audit_events WHERE action = 'stored_object.created'");
    process.send?.({
      reservations: reservations.rows.map((row) => JSON.parse(String(row.object_row_json))),
      objects: objects.rows.map((row) => ({ id: String(row.id), deletedAt: row.deleted_at })),
      audits: audits.rows.map((row) => ({ id: String(row.id), storedObjectId: JSON.parse(String(row.metadata_json)).storedObjectId })),
    });
  } else if (process.argv[3] === "native-busy") {
    await createDbMembershipStore().setRole("user-owner" as UserId, "ws-storage" as WorkspaceId, "owner");
    const poisoned = new WeakSet<object>();
    let nativeBusy = 0;
    let reusedPoisoned = 0;
    const blocker = createClient({ url: databaseUrl, timeout: 0 });
    let lockState: "idle" | "held" | "released" = "idle";
    const open = storedObjectDurability.openClient.bind(storedObjectDurability);
    storedObjectDurability.openClient = (timeoutMs) => {
      const client = open(timeoutMs);
      const execute = client.execute.bind(client);
      client.execute = async (...args: Parameters<typeof execute>) => {
        if (poisoned.has(client)) reusedPoisoned++;
        if (lockState === "idle") {
          await blocker.execute("BEGIN IMMEDIATE");
          lockState = "held";
        }
        try {
          return await execute(...args);
        } catch (error) {
          if (isSqliteBusy(error)) {
            poisoned.add(client);
            nativeBusy++;
            if (lockState === "held") {
              await blocker.execute("ROLLBACK");
              blocker.close();
              lockState = "released";
            }
          }
          throw error;
        }
      };
      return client;
    };
    const service = createStoredObjectService({
      adapter, audit: createAuditLog(), permissions: createPermissionService(createDbMembershipStore()),
    });
    const object = await service.store({
      scope: { workspaceId: "ws-storage" as WorkspaceId },
      actorUserId: "user-owner" as UserId,
      activeWorkspaceId: "ws-storage" as WorkspaceId,
      body: new Uint8Array([255, 216, 255, 217]), originalFilename: "native.jpg", mimeType: "image/jpeg",
      idempotency: { key: "native-busy", requestFingerprint: "same" },
    });
    const observer = createClient({ url: databaseUrl, timeout: 250 });
    try {
      const audits = await observer.execute({
        sql: "SELECT id, metadata_json FROM audit_events WHERE action = ?",
        args: ["stored_object.created"],
      });
      process.send?.({
        id: object.id,
        nativeBusy,
        reusedPoisoned,
        durableAudits: audits.rows.length,
        durableStoredObjectId: audits.rows[0] ? JSON.parse(String(audits.rows[0].metadata_json)).storedObjectId : null,
      });
    } finally {
      observer.close();
      try { blocker.close(); } catch { /* already closed */ }
    }
  } else {
  const audit = createAuditLog();
  const record = audit.record.bind(audit);
  audit.record = async (entry) => {
    const recorded = await record(entry);
    if (entry.action === "stored_object.created") process.send?.({ acceptedAuditId: recorded.id });
    return recorded;
  };
  const service = createStoredObjectService({
    adapter, audit, permissions: createPermissionService(createDbMembershipStore()),
  });
  const object = await service.store({
    scope: { workspaceId: "ws-storage" as WorkspaceId },
    actorUserId: "user-owner" as UserId,
    activeWorkspaceId: "ws-storage" as WorkspaceId,
    body: new Uint8Array([255, 216, 255, 217]), originalFilename: "process.jpg", mimeType: "image/jpeg",
    idempotency: { key: "process-operation", requestFingerprint: "process-request" },
  });
  process.send?.({ id: object.id });
  }
} finally {
  const client = getClient();
  client.close();
  process.send?.({ clientClosed: client.closed }, () => process.disconnect());
}
