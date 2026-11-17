import { randomUUID } from "node:crypto";
import { chmodSync, cpSync, existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { ensureSchema, getClient, resetDatabaseLifecycle } from "@/platform/persistence/db";
import {
  initialisePersistentDevelopmentDatabase,
  inspectPersistentDevelopmentDatabase,
  recordDatabaseInstance,
} from "@/platform/persistence/persistent-dev-database";
import {
  DEMONSTRATION_BACKUP_STAGE_PREFIX,
  ProductionProcessError,
  assertDemonstrationBackupDestination,
  assertDemonstrationBackupSource,
  assertDemonstrationBackupStage,
  assertDemonstrationDatabaseTarget,
  assertDemonstrationObjectTarget,
  assertDemonstrationRestoreTarget,
  assertProductionObjectRoot,
  removeDemonstrationBackupStage,
} from "@/platform/runtime/production-process-contract";

const BACKUP_MARKER = "backup-complete.json";
const BACKUP_MANIFEST = {
  format: "ventureos-demonstration-backup",
  database: "database.db",
  objects: "objects",
} as const;

/**
 * One process may write the demonstration database and object directory.
 * Stop that writer before backup. The SQLite snapshot and the object copy are separate steps.
 * Node cannot pin the directory against a concurrent junction swap.
 */
export const DEMONSTRATION_RUNTIME_REQUIREMENT = {
  applicationInstances: 1,
  objectDirectoryAccess: "exclusive-write",
  backupConsistency: "quiesced-snapshot-then-objects",
  enforcement: "hosting",
} as const;

/**
 * Provisioning creates the empty database and object directory only.
 * A workspace still comes from the existing signup path.
 * A Frigora venture still comes from createVenture.
 * Customer credentials still come from signup or invitation.
 * This module does not seed accounts, workspaces, ventures, or records.
 */
export const DEMONSTRATION_ACCOUNT_DEPENDENCY = {
  workspace: "existing-signup",
  venture: "existing-createVenture",
  credentials: "existing-signup-or-invitation",
  records: "not-seeded",
} as const;

export async function provisionDemonstrationEnvironment() {
  if (process.env.NODE_ENV !== "production") {
    throw new ProductionProcessError("demonstration_production_contract_required");
  }
  const databaseUrl = process.env.DATABASE_URL?.trim() ?? "";
  assertDemonstrationDatabaseTarget(databaseUrl);
  const objectDirectory = preparedObjectDirectory();
  try {
    await resetDatabaseLifecycle(databaseUrl);
    await initialisePersistentDevelopmentDatabase(
      () => ensureSchema(),
      async (applicationId, userVersion) => {
        await getClient().execute(`PRAGMA application_id = ${applicationId}`);
        await getClient().execute(`PRAGMA user_version = ${userVersion}`);
      },
      (instanceId) => recordDatabaseInstance((statement) => getClient().execute(statement), instanceId),
      () => resetDatabaseLifecycle(databaseUrl),
    );
  } catch (error) {
    if (demonstrationResidue(databaseUrl)) {
      throw new ProductionProcessError("demonstration_provision_partial");
    }
    throw error;
  }
  await resetDatabaseLifecycle(databaseUrl);
  inspectPersistentDevelopmentDatabase(databaseUrl);
  return {
    objectAccess: restrictObjectDirectory(objectDirectory),
    accounts: DEMONSTRATION_ACCOUNT_DEPENDENCY.records,
  } as const;
}

export function backupDemonstrationEnvironment(destination: string) {
  const target = assertDemonstrationBackupDestination(destination);
  const databasePath = assertDemonstrationBackupSource();
  const objectDirectory = assertProductionObjectRoot();
  const stage = assertDemonstrationBackupStage(resolve(target.root, `${DEMONSTRATION_BACKUP_STAGE_PREFIX}${randomUUID()}`));
  try {
    mkdirSync(stage);
    const backupDatabase = resolve(stage, "database.db");
    const source = new DatabaseSync(databasePath);
    try {
      source.exec(`VACUUM INTO '${sqlString(backupDatabase)}'`);
    } finally {
      source.close();
    }
    copyIdentitySidecar(databasePath, backupDatabase);
    copyObjectTree(objectDirectory, resolve(stage, "objects"));
    writeBackupMarker(stage);
    assertBackupPayload(stage, true);
    if (existsSync(target.destination)) throw new ProductionProcessError("demonstration_backup_exists");
    mkdirSync(dirname(target.destination), { recursive: true });
    renameSync(stage, target.destination);
  } catch (error) {
    if (existsSync(stage)) {
      if (lstatSync(stage).isSymbolicLink()) {
        throw new ProductionProcessError("demonstration_backup_cleanup_failed");
      }
      try {
        removeDemonstrationBackupStage(stage);
      } catch {
        throw new ProductionProcessError("demonstration_backup_cleanup_failed");
      }
    }
    throw error;
  }
  return { database: "database.db", objects: "objects" } as const;
}

export function restoreDemonstrationEnvironment(backup: string, databasePath: string, objectDirectory: string) {
  const target = assertDemonstrationRestoreTarget(databasePath, objectDirectory);
  assertBackupPayload(backup, false);
  const backupDatabase = resolve(backup, "database.db");
  const backupObjects = resolve(backup, "objects");
  const stage = resolve(dirname(target.databasePath), `.restore-${randomUUID()}`);
  let publishedDatabase = false;
  let publishedSidecar = false;
  let publishedObjects = false;
  try {
    mkdirSync(dirname(target.databasePath), { recursive: true });
    mkdirSync(dirname(target.objectDirectory), { recursive: true });
    mkdirSync(stage);
    cpSync(backupDatabase, resolve(stage, "database.db"));
    copyIdentitySidecar(backupDatabase, resolve(stage, "database.db"));
    copyObjectTree(backupObjects, resolve(stage, "objects"));
    if (
      existsSync(target.databasePath) ||
      existsSync(`${target.databasePath}.ventureos-identity`) ||
      existsSync(target.objectDirectory)
    ) {
      throw new ProductionProcessError("demonstration_restore_exists");
    }
    renameSync(resolve(stage, "database.db"), target.databasePath);
    publishedDatabase = true;
    renameSync(resolve(stage, "database.db.ventureos-identity"), `${target.databasePath}.ventureos-identity`);
    publishedSidecar = true;
    renameSync(resolve(stage, "objects"), target.objectDirectory);
    publishedObjects = true;
  } catch (error) {
    if (publishedObjects) rmSync(target.objectDirectory, { recursive: true, force: true });
    if (publishedSidecar) rmSync(`${target.databasePath}.ventureos-identity`, { force: true });
    if (publishedDatabase) rmSync(target.databasePath, { force: true });
    throw error;
  } finally {
    if (existsSync(stage)) rmSync(stage, { recursive: true, force: true });
  }
}

function preparedObjectDirectory() {
  const configured = process.env.STORED_OBJECT_ROOT?.trim() ?? "";
  if (!configured) throw new ProductionProcessError("production_object_root_missing");
  const located = assertDemonstrationObjectTarget(configured);
  if (!located) throw new ProductionProcessError("production_object_root_missing");
  if (!existsSync(located)) {
    mkdirSync(located);
  } else if (readdirSync(located).length > 0) {
    throw new ProductionProcessError("demonstration_object_directory_exists");
  }
  const confirmed = assertProductionObjectRoot();
  if (lstatSync(confirmed).isSymbolicLink()) {
    throw new ProductionProcessError("production_object_root_symlink_refused");
  }
  return confirmed;
}

function restrictObjectDirectory(objectDirectory: string) {
  chmodSync(objectDirectory, 0o700);
  const mode = statSync(objectDirectory).mode & 0o077;
  return mode === 0 ? "restricted" as const : "host-acl-required" as const;
}

function demonstrationResidue(databaseUrl: string) {
  const filePath = filePathFromUrl(databaseUrl);
  return existsSync(filePath) || existsSync(`${filePath}.ventureos-identity`) || existsSync(`${filePath}.ventureos-init.lock`);
}

function assertBackupPayload(backup: string, publishing: boolean) {
  const resolved = resolve(backup);
  if (!publishing && basename(resolved).startsWith(DEMONSTRATION_BACKUP_STAGE_PREFIX)) {
    throw new ProductionProcessError("demonstration_backup_invalid");
  }
  const backupDatabase = resolve(resolved, "database.db");
  const backupObjects = resolve(resolved, "objects");
  const marker = resolve(resolved, BACKUP_MARKER);
  if (existsSync(backupObjects)) refuseSymlinkTree(backupObjects);
  if (!existsSync(backupDatabase) || !existsSync(backupObjects) || !existsSync(`${backupDatabase}.ventureos-identity`) || !existsSync(marker)) {
    throw new ProductionProcessError("demonstration_backup_invalid");
  }
  for (const candidate of [backupDatabase, backupObjects, `${backupDatabase}.ventureos-identity`, marker]) {
    if (lstatSync(candidate).isSymbolicLink()) {
      throw new ProductionProcessError("production_object_root_symlink_refused");
    }
  }
  let parsed: { format?: unknown; database?: unknown; objects?: unknown };
  try {
    parsed = JSON.parse(readFileSync(marker, "utf8")) as { format?: unknown; database?: unknown; objects?: unknown };
  } catch {
    throw new ProductionProcessError("demonstration_backup_invalid");
  }
  if (parsed.format !== BACKUP_MANIFEST.format || parsed.database !== BACKUP_MANIFEST.database || parsed.objects !== BACKUP_MANIFEST.objects) {
    throw new ProductionProcessError("demonstration_backup_invalid");
  }
}

function refuseSymlinkTree(directory: string) {
  const listing = lstatSync(directory);
  if (listing.isSymbolicLink()) throw new ProductionProcessError("production_object_root_symlink_refused");
  if (!listing.isDirectory()) return;
  for (const name of readdirSync(directory)) {
    const child = resolve(directory, name);
    const childListing = lstatSync(child);
    if (childListing.isSymbolicLink()) throw new ProductionProcessError("production_object_root_symlink_refused");
    if (childListing.isDirectory()) refuseSymlinkTree(child);
  }
}

function writeBackupMarker(stage: string) {
  const listing = lstatSync(stage);
  if (listing.isSymbolicLink() || !listing.isDirectory()) {
    throw new ProductionProcessError("production_path_symlink_refused");
  }
  writeFileSync(resolve(stage, BACKUP_MARKER), JSON.stringify(BACKUP_MANIFEST), { flag: "wx" });
}

function copyIdentitySidecar(databasePath: string, destinationDatabase: string) {
  const sidecar = `${databasePath}.ventureos-identity`;
  if (!existsSync(sidecar)) throw new ProductionProcessError("demonstration_backup_invalid");
  cpSync(sidecar, `${destinationDatabase}.ventureos-identity`);
}

function copyObjectTree(source: string, destination: string) {
  mkdirSync(destination);
  for (const name of readdirSync(source)) {
    const from = resolve(source, name);
    const listing = lstatSync(from);
    if (listing.isSymbolicLink()) {
      throw new ProductionProcessError("production_object_root_symlink_refused");
    }
    const to = resolve(destination, name);
    if (listing.isDirectory()) copyObjectTree(from, to);
    else cpSync(from, to);
  }
}

function filePathFromUrl(databaseUrl: string) {
  if (!databaseUrl.startsWith("file:")) {
    throw new ProductionProcessError("production_database_url_malformed");
  }
  return resolve(databaseUrl.slice("file:".length));
}

function sqlString(filePath: string) {
  return filePath.replaceAll("\\", "/").replaceAll("'", "''");
}
