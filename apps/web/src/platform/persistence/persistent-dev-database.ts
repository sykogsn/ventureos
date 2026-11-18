import { createHash, timingSafeEqual } from "node:crypto";
import { runInNewContext } from "node:vm";
import { setFlagsFromString } from "node:v8";
import { closeSync, existsSync, lstatSync, mkdirSync, openSync, readFileSync, realpathSync, unlinkSync, writeFileSync } from "node:fs";
import { basename, dirname, resolve, sep } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { setTimeout as delay } from "node:timers/promises";
import {
  createClient,
  type Client,
  type Config,
  type InArgs,
  type InStatement,
  type Transaction,
  type TransactionMode,
} from "@libsql/client";
import {
  REQUIRED_SCHEMA_FINGERPRINT,
  REQUIRED_SCHEMA_OBJECT_NAMES,
} from "./persistent-dev-schema-catalog";

/** Schema generation owned by this application. Not a new allocation. */
export const PERSISTENT_SCHEMA_GENERATION = 40;

const PERSISTENT_FLAG = "VENTUREOS_PERSISTENT_DEV";
const AUTHORISE_INIT_FLAG = "VENTUREOS_AUTHORISE_DATABASE_INIT";
const IDENTITY_FLAG = "VENTUREOS_DATABASE_IDENTITY";
const INSTANCE_FLAG = "VENTUREOS_DATABASE_INSTANCE_ID";
const DEMO_MARKER = "frg-demo-env-02";
export const DATABASE_INSTANCE_RECORD_ID = "ventureos-database-instance";

export class PersistentDevelopmentDatabaseError extends Error {
  readonly code: string;

  constructor(code: string) {
    super(`Persistent development database check failed: ${code}`);
    this.name = "PersistentDevelopmentDatabaseError";
    this.code = code;
  }
}

type AuthorizedDatabase = { path: string; instanceId: string };

type PersistentProcessState = {
  initialisationClaim: string | null;
  authorized: AuthorizedDatabase | null;
  maintenanceDepth: number;
};

/**
 * Next.js compiles instrumentation and server actions as separate modules.
 * The shared client already lives on globalThis. This record has to as well,
 * or a server action sees the client and treats the empty module slot as a changed database.
 */
function persistentProcessState(): PersistentProcessState {
  const store = globalThis as typeof globalThis & { __vosPersistentProcess?: PersistentProcessState };
  if (!store.__vosPersistentProcess) {
    store.__vosPersistentProcess = {
      initialisationClaim: null,
      authorized: null,
      maintenanceDepth: 0,
    };
  }
  return store.__vosPersistentProcess;
}

let failCleanupForTests = false;

/** Test-only. Drops the process authorization record. The shared client and database files stay in place. */
export function clearPersistentProcessAuthorizationForTests() {
  persistentProcessState().authorized = null;
}

/** Test-only. Reports the instance id recorded for this process, when one has been verified. */
export function persistentProcessInstanceIdForTests() {
  return persistentProcessState().authorized?.instanceId ?? null;
}

/** Test-only. Reports schema-maintenance depth shared by every module evaluation in this process. */
export function persistentProcessMaintenanceDepthForTests() {
  return persistentProcessState().maintenanceDepth;
}

export function persistentDevelopmentDatabaseEnabled() {
  if (process.env.NEXT_RUNTIME === "nodejs") return true;
  return process.env[PERSISTENT_FLAG] === "1";
}

function refuseProductionBuildDatabaseAccess() {
  if (process.env.NEXT_PHASE === "phase-production-build") {
    throw new PersistentDevelopmentDatabaseError("persistent_database_build_access_refused");
  }
}

/** Test-only. Forces deletion of a database created by this process to fail. */
export function setPersistentDevelopmentCleanupFailureForTests(fail: boolean) {
  failCleanupForTests = fail;
}

export function describePersistentDevelopmentDatabase() {
  if (!persistentDevelopmentDatabaseEnabled()) {
    return {
      environment: "disposable",
      schemaGeneration: PERSISTENT_SCHEMA_GENERATION,
      identity: "not-required",
    } as const;
  }
  return {
    environment: "persistent-development",
    schemaGeneration: PERSISTENT_SCHEMA_GENERATION,
    identity: "required",
  } as const;
}

export function assertPersistentDevelopmentDatabaseReady(selectedUrl = process.env.DATABASE_URL ?? "") {
  if (!persistentDevelopmentDatabaseEnabled()) return;
  resolvePersistentDevelopmentDatabase(selectedUrl);
}

/** Returns the canonical file URL that passed the persistent-development contract. */
export function resolvePersistentDevelopmentDatabase(selectedUrl: string) {
  refuseProductionBuildDatabaseAccess();
  if (!persistentDevelopmentDatabaseEnabled()) return selectedUrl;
  assertCatalogConfigured();
  const configured = process.env.DATABASE_URL;
  if (!configured) throw new PersistentDevelopmentDatabaseError("persistent_database_url_missing");
  const identity = requiredIdentityToken();
  const configuredPath = canonicalDatabasePath(configured);
  const selectedPath = canonicalDatabasePath(selectedUrl);
  if (!samePath(configuredPath, selectedPath)) {
    throw new PersistentDevelopmentDatabaseError("persistent_database_selection_mismatch");
  }
  refuseProtectedDevelopmentDatabase(configuredPath);
  const state = persistentProcessState();
  if (state.initialisationClaim && samePath(state.initialisationClaim, configuredPath)) {
    return fileUrl(configuredPath);
  }
  if (!existsSync(configuredPath)) {
    throw new PersistentDevelopmentDatabaseError("persistent_database_missing");
  }
  const opened = openedDatabasePath(configuredPath);
  const instanceId = verifyExistingDatabase(opened, identity);
  state.authorized = { path: opened, instanceId };
  return fileUrl(opened);
}

/**
 * Read-only identity check for readiness.
 * It does not create files, migrate, stamp, or record process authorisation.
 */
export function inspectPersistentDevelopmentDatabase(selectedUrl: string) {
  refuseProductionBuildDatabaseAccess();
  if (!persistentDevelopmentDatabaseEnabled()) {
    throw new PersistentDevelopmentDatabaseError("persistent_database_not_initialised");
  }
  assertCatalogConfigured();
  const configured = process.env.DATABASE_URL;
  if (!configured) throw new PersistentDevelopmentDatabaseError("persistent_database_url_missing");
  const identity = requiredIdentityToken();
  const configuredPath = canonicalDatabasePath(configured);
  const selectedPath = canonicalDatabasePath(selectedUrl);
  if (!samePath(configuredPath, selectedPath)) {
    throw new PersistentDevelopmentDatabaseError("persistent_database_selection_mismatch");
  }
  refuseProtectedDevelopmentDatabase(configuredPath);
  if (!existsSync(configuredPath)) {
    throw new PersistentDevelopmentDatabaseError("persistent_database_missing");
  }
  const listing = lstatSync(configuredPath);
  if (listing.isSymbolicLink() || !listing.isFile() || listing.size === 0) {
    throw new PersistentDevelopmentDatabaseError("persistent_database_not_initialised");
  }
  const opened = openedDatabasePath(configuredPath);
  try {
    verifyExistingDatabase(opened, identity);
  } catch (error) {
    if (error instanceof PersistentDevelopmentDatabaseError) throw error;
    throw new PersistentDevelopmentDatabaseError("persistent_database_not_initialised");
  }
}

/** Schema maintenance temporarily drops and recreates required objects. */
export function beginPersistentDatabaseMaintenance() {
  persistentProcessState().maintenanceDepth += 1;
}

export function endPersistentDatabaseMaintenance() {
  const state = persistentProcessState();
  state.maintenanceDepth = Math.max(0, state.maintenanceDepth - 1);
}

export function recheckPersistentDevelopmentDatabase() {
  const state = persistentProcessState();
  if (!persistentDevelopmentDatabaseEnabled() || state.initialisationClaim) return;
  if (!state.authorized) {
    resolvePersistentDevelopmentDatabase(process.env.DATABASE_URL ?? "");
    if (!persistentProcessState().authorized) {
      throw new PersistentDevelopmentDatabaseError("persistent_database_changed");
    }
    return;
  }
  const instanceId = verifyExistingDatabase(state.authorized.path, requiredIdentityToken(), state.maintenanceDepth > 0);
  if (instanceId !== state.authorized.instanceId) {
    throw new PersistentDevelopmentDatabaseError("persistent_database_changed");
  }
}

/** Opens a client that rechecks database identity before every operation. */
export function createGuardedDatabaseClient(config: Config): Client {
  refuseProductionBuildDatabaseAccess();
  const client = createClient(config);
  if (!persistentDevelopmentDatabaseEnabled()) return client;
  return guardPersistentClient(client);
}

function assertPersistentOperation() {
  recheckPersistentDevelopmentDatabase();
}

function guardPersistentClient(client: Client): Client {
  const guarded: Client = {
    execute(stmt: InStatement | string, args?: InArgs) {
      assertPersistentOperation();
      if (typeof stmt === "string") return client.execute(stmt, args);
      return client.execute(stmt);
    },
    batch(stmts, mode) {
      assertPersistentOperation();
      return client.batch(stmts, mode);
    },
    migrate(stmts) {
      assertPersistentOperation();
      return client.migrate(stmts);
    },
    async transaction(mode?: TransactionMode) {
      assertPersistentOperation();
      return guardPersistentTransaction(await client.transaction(mode));
    },
    executeMultiple(sql) {
      assertPersistentOperation();
      return client.executeMultiple(sql);
    },
    sync() {
      assertPersistentOperation();
      return client.sync();
    },
    close() {
      client.close();
    },
    reconnect() {
      throw new PersistentDevelopmentDatabaseError("persistent_database_changed");
    },
    get closed() {
      return client.closed;
    },
    get protocol() {
      return client.protocol;
    },
  };
  return guarded;
}

function guardPersistentTransaction(transaction: Transaction): Transaction {
  return {
    execute(stmt) {
      assertPersistentOperation();
      return transaction.execute(stmt);
    },
    batch(stmts) {
      assertPersistentOperation();
      return transaction.batch(stmts);
    },
    executeMultiple(sql) {
      assertPersistentOperation();
      return transaction.executeMultiple(sql);
    },
    async commit() {
      try {
        assertPersistentOperation();
      } catch (error) {
        try {
          await transaction.rollback();
        } catch {
          // Unwinding must not replace the identity failure.
        }
        throw error;
      }
      await transaction.commit();
    },
    rollback() {
      return transaction.rollback();
    },
    close() {
      transaction.close();
    },
    get closed() {
      return transaction.closed;
    },
  };
}

export async function recordDatabaseInstance(
  execute: (statement: { sql: string; args: string[] }) => Promise<unknown>,
  instanceId: string,
) {
  await execute({
    sql: "INSERT INTO audit_events (id, action, occurred_at, workspace_id, venture_id, metadata_json) VALUES (?, 'ventureos.database.instance', '1970-01-01T00:00:00.000Z', '', '', ?)",
    args: [DATABASE_INSTANCE_RECORD_ID, JSON.stringify({ instanceId })],
  });
}

export function persistentApplicationId(identity: string) {
  const value = createHash("sha256").update(identity).digest().readUInt32BE(0) & 0x7fffffff;
  return value === 0 ? 1 : value;
}

export function schemaCatalogFingerprint(rows: Array<{ key: string; sql: string }>) {
  return createHash("sha256").update(rows.map((row) => `${row.key}\n${row.sql}`).join("\n")).digest("hex");
}

export function readSchemaCatalog(filePath: string) {
  const db = new DatabaseSync(filePath, { readOnly: true });
  try {
    db.exec("PRAGMA query_only = ON");
    return db.prepare(
      "SELECT type, name, sql FROM sqlite_master WHERE type IN ('table', 'index', 'trigger') AND name NOT LIKE 'sqlite_%' AND sql IS NOT NULL ORDER BY type, name",
    ).all().map((row) => ({
      key: `${String(row.type)}:${String(row.name)}`,
      sql: normalizeSchemaSql(String(row.sql)),
    }));
  } finally {
    db.close();
  }
}

export async function initialisePersistentDevelopmentDatabase(
  migrate: () => Promise<void>,
  stamp: (applicationId: number, userVersion: number) => Promise<void>,
  recordInstance: (instanceId: string) => Promise<void>,
  release: () => Promise<void>,
) {
  if (process.env[PERSISTENT_FLAG] !== "1" || process.env[AUTHORISE_INIT_FLAG] !== "1") {
    throw new PersistentDevelopmentDatabaseError("persistent_database_initialisation_unauthorised");
  }
  assertCatalogConfigured();
  const configured = process.env.DATABASE_URL;
  if (!configured) throw new PersistentDevelopmentDatabaseError("persistent_database_url_missing");
  const identity = requiredIdentityToken();
  const instanceId = requiredInstanceId();
  const filePath = canonicalDatabasePath(configured);
  refuseProtectedDevelopmentDatabase(filePath);
  const parent = dirname(filePath);
  if (existsSync(parent)) {
    refuseProtectedDevelopmentDatabase(joinReal(parent, basename(filePath)));
  } else {
    mkdirSync(parent, { recursive: true });
  }
  const sidecar = identitySidecarPath(filePath);
  const lockPath = `${filePath}.ventureos-init.lock`;
  let lock: number;
  try {
    lock = openSync(lockPath, "wx");
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "EEXIST") {
      throw new PersistentDevelopmentDatabaseError("persistent_database_concurrent_initialisation");
    }
    throw error;
  }

  let failure: unknown = null;
  let databaseOwned = false;
  let sidecarOwned = false;
  let databaseRemains = false;
  let sidecarRemains = false;
  let lockRemains = false;
  try {
    if (existsSync(filePath) || existsSync(sidecar)) {
      throw new PersistentDevelopmentDatabaseError("persistent_database_exists");
    }
    try {
      closeSync(openSync(filePath, "wx"));
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "EEXIST") {
        throw new PersistentDevelopmentDatabaseError("persistent_database_exists");
      }
      throw error;
    }
    databaseOwned = true;
    persistentProcessState().initialisationClaim = filePath;
    await migrate();
    if (!existsSync(filePath)) throw new PersistentDevelopmentDatabaseError("persistent_database_missing");
    await stamp(persistentApplicationId(identity), PERSISTENT_SCHEMA_GENERATION);
    await recordInstance(instanceId);
    writeIdentitySidecar(sidecar, identity, instanceId);
    sidecarOwned = true;
    const opened = openedDatabasePath(filePath);
    const recorded = verifyExistingDatabase(opened, identity);
    persistentProcessState().authorized = { path: opened, instanceId: recorded };
  } catch (error) {
    failure = error;
    await release();
  } finally {
    persistentProcessState().initialisationClaim = null;
    closeSync(lock);
    databaseRemains = failure !== null && databaseOwned && !(await removeCreatedFile(filePath));
    sidecarRemains = failure !== null && sidecarOwned && !(await removeCreatedFile(sidecar));
    lockRemains = !(await removeCreatedFile(lockPath));
  }
  if (databaseRemains || sidecarRemains || lockRemains) {
    throw new PersistentDevelopmentDatabaseError("persistent_database_cleanup_failed");
  }
  if (failure) throw failure;
}

function assertCatalogConfigured() {
  if (REQUIRED_SCHEMA_OBJECT_NAMES.length < 50 || REQUIRED_SCHEMA_FINGERPRINT.length !== 64) {
    throw new PersistentDevelopmentDatabaseError("persistent_database_fingerprint_mismatch");
  }
}

function requiredIdentityToken() {
  const identity = process.env[IDENTITY_FLAG] ?? "";
  if (identity.length < 16 || identity.length > 200 || /\s/.test(identity)) {
    throw new PersistentDevelopmentDatabaseError("persistent_database_identity_missing");
  }
  return identity;
}

function requiredInstanceId() {
  const instanceId = process.env[INSTANCE_FLAG] ?? "";
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(instanceId)) {
    throw new PersistentDevelopmentDatabaseError("persistent_database_instance_missing");
  }
  return instanceId.toLowerCase();
}

function verifyExistingDatabase(filePath: string, identity: string, suspendCatalog = false) {
  const header = readHeader(filePath);
  if (header.userVersion !== PERSISTENT_SCHEMA_GENERATION) {
    throw new PersistentDevelopmentDatabaseError(
      header.userVersion === 0 ? "persistent_database_not_initialised" : "persistent_database_generation_mismatch",
    );
  }
  if (header.applicationId !== persistentApplicationId(identity)) {
    throw new PersistentDevelopmentDatabaseError("persistent_database_identity_mismatch");
  }
  let fingerprint = REQUIRED_SCHEMA_FINGERPRINT;
  if (!suspendCatalog) {
    const catalog = readSchemaCatalog(filePath);
    const byKey = new Map(catalog.map((row) => [row.key, row.sql]));
    const required = REQUIRED_SCHEMA_OBJECT_NAMES.map((key) => {
      const sql = byKey.get(key);
      if (!sql) throw new PersistentDevelopmentDatabaseError("persistent_database_fingerprint_mismatch");
      return { key, sql };
    });
    fingerprint = schemaCatalogFingerprint(required);
    if (fingerprint !== REQUIRED_SCHEMA_FINGERPRINT) {
      throw new PersistentDevelopmentDatabaseError("persistent_database_fingerprint_mismatch");
    }
  }
  const instanceId = requiredInstanceId();
  const recordedInstance = readDatabaseInstanceId(filePath);
  const recorded = readIdentitySidecar(identitySidecarPath(filePath));
  const identityHash = createHash("sha256").update(identity).digest("hex");
  if (
    !sameText(recorded.identityHash, identityHash) ||
    !sameText(recorded.schemaFingerprint, fingerprint) ||
    !sameText(recorded.instanceId, instanceId) ||
    !sameText(recordedInstance, instanceId)
  ) {
    throw new PersistentDevelopmentDatabaseError("persistent_database_identity_mismatch");
  }
  return instanceId;
}

function readHeader(filePath: string) {
  const db = new DatabaseSync(filePath, { readOnly: true });
  try {
    db.exec("PRAGMA query_only = ON");
    return {
      applicationId: Number(db.prepare("PRAGMA application_id").get()?.application_id ?? 0),
      userVersion: Number(db.prepare("PRAGMA user_version").get()?.user_version ?? 0),
    };
  } finally {
    db.close();
  }
}

function canonicalDatabasePath(url: string) {
  if (!url.startsWith("file:") || url === "file:" || url.includes("?") || url.includes("#") || url.startsWith("file::memory:")) {
    throw new PersistentDevelopmentDatabaseError("persistent_database_url_malformed");
  }
  const raw = url.slice("file:".length);
  const filePath = resolve(raw);
  if (basename(filePath) === "" || dirname(filePath) === filePath) {
    throw new PersistentDevelopmentDatabaseError("persistent_database_url_malformed");
  }
  return filePath;
}

function openedDatabasePath(filePath: string) {
  const listing = lstatSync(filePath);
  if (listing.isSymbolicLink()) {
    throw new PersistentDevelopmentDatabaseError("persistent_database_symlink_refused");
  }
  const opened = realpathSync(filePath);
  refuseProtectedDevelopmentDatabase(opened);
  if (lstatSync(opened).isSymbolicLink()) {
    throw new PersistentDevelopmentDatabaseError("persistent_database_symlink_refused");
  }
  return opened;
}

function refuseProtectedDevelopmentDatabase(filePath: string) {
  const folded = filePath.toLowerCase();
  const worktreeDefault = `${sep}data${sep}ventureos.db`.toLowerCase();
  if (folded.endsWith(worktreeDefault) || folded.includes("frg-r1-v2-hosted") || folded.includes(DEMO_MARKER)) {
    throw new PersistentDevelopmentDatabaseError("persistent_database_worktree_default_refused");
  }
}

function joinReal(parent: string, name: string) {
  return resolve(realpathSync(parent), name);
}

function fileUrl(filePath: string) {
  return `file:${filePath.replaceAll("\\", "/")}`;
}

function samePath(left: string, right: string) {
  return process.platform === "win32" ? left.toLowerCase() === right.toLowerCase() : left === right;
}

function sameText(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function identitySidecarPath(filePath: string) {
  return `${filePath}.ventureos-identity`;
}

function writeIdentitySidecar(filePath: string, identity: string, instanceId: string) {
  if (existsSync(filePath)) throw new PersistentDevelopmentDatabaseError("persistent_database_exists");
  const body = JSON.stringify({
    identityHash: createHash("sha256").update(identity).digest("hex"),
    schemaFingerprint: REQUIRED_SCHEMA_FINGERPRINT,
    instanceId,
  });
  writeFileSync(filePath, body, { flag: "wx" });
}

function readIdentitySidecar(filePath: string) {
  if (!existsSync(filePath)) throw new PersistentDevelopmentDatabaseError("persistent_database_identity_mismatch");
  if (lstatSync(filePath).isSymbolicLink()) {
    throw new PersistentDevelopmentDatabaseError("persistent_database_symlink_refused");
  }
  let parsed: { identityHash?: unknown; schemaFingerprint?: unknown; instanceId?: unknown };
  try {
    parsed = JSON.parse(readFileSync(filePath, "utf8")) as { identityHash?: unknown; schemaFingerprint?: unknown; instanceId?: unknown };
  } catch {
    throw new PersistentDevelopmentDatabaseError("persistent_database_identity_mismatch");
  }
  if (typeof parsed.identityHash !== "string" || typeof parsed.schemaFingerprint !== "string" || typeof parsed.instanceId !== "string") {
    throw new PersistentDevelopmentDatabaseError("persistent_database_identity_mismatch");
  }
  return { identityHash: parsed.identityHash, schemaFingerprint: parsed.schemaFingerprint, instanceId: parsed.instanceId };
}

function readDatabaseInstanceId(filePath: string) {
  const db = new DatabaseSync(filePath, { readOnly: true });
  try {
    db.exec("PRAGMA query_only = ON");
    const row = db.prepare("SELECT metadata_json FROM audit_events WHERE id = ?").get(DATABASE_INSTANCE_RECORD_ID) as { metadata_json?: string } | undefined;
    const metadata = JSON.parse(String(row?.metadata_json ?? "{}")) as { instanceId?: unknown };
    if (typeof metadata.instanceId !== "string") {
      throw new PersistentDevelopmentDatabaseError("persistent_database_identity_mismatch");
    }
    return metadata.instanceId;
  } catch (error) {
    if (error instanceof PersistentDevelopmentDatabaseError) throw error;
    throw new PersistentDevelopmentDatabaseError("persistent_database_identity_mismatch");
  } finally {
    db.close();
  }
}

let collectGarbage: (() => void) | undefined;

function releaseDeletedFileHandles() {
  if (collectGarbage === undefined) {
    try {
      setFlagsFromString("--expose-gc");
      const gc = runInNewContext("gc");
      collectGarbage = typeof gc === "function" ? (gc as () => void) : () => {};
    } catch {
      collectGarbage = () => {};
    }
  }
  collectGarbage();
}

async function removeCreatedFile(filePath: string) {
  if (!existsSync(filePath)) return true;
  if (isProtectedPath(filePath)) return false;
  if (failCleanupForTests && filePath.endsWith(".db")) return false;
  for (let attempt = 0; attempt < 20; attempt += 1) {
    try {
      unlinkSync(filePath);
      return !existsSync(filePath);
    } catch {
      releaseDeletedFileHandles();
      await delay(100);
    }
  }
  return !existsSync(filePath);
}

function isProtectedPath(filePath: string) {
  try {
    refuseProtectedDevelopmentDatabase(filePath);
    return false;
  } catch {
    return true;
  }
}

function normalizeSchemaSql(sql: string) {
  return sql.replace(/\s+/g, " ").trim();
}
