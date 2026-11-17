import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, it } from "node:test";
import { clearDatabaseSelectionForTests, resetDatabaseLifecycle } from "@/platform/persistence/db";
import { PersistentDevelopmentDatabaseError } from "@/platform/persistence/persistent-dev-database";
import { createLocalBlobStorageAdapter } from "@/platform/storage/local-adapter";
import {
  DEMONSTRATION_ACCOUNT_DEPENDENCY,
  DEMONSTRATION_RUNTIME_REQUIREMENT,
  backupDemonstrationEnvironment,
  provisionDemonstrationEnvironment,
  restoreDemonstrationEnvironment,
} from "./demonstration-provision";
import { DEMONSTRATION_BACKUP_STAGE_PREFIX, ProductionProcessError, assessReadiness } from "./production-process-contract";

const SECRET = "demonstration-provision-test-secret-value";
const IDENTITY = "vos-host-03-isolated-identity";
const INSTANCE = "55555555-5555-4555-8555-555555555555";
const ORIGIN = "https://frigora.ventureoperatingsystem.co.za";
const previous = {
  NODE_ENV: process.env.NODE_ENV,
  DATABASE_URL: process.env.DATABASE_URL,
  VENTUREOS_PERSISTENT_ROOT: process.env.VENTUREOS_PERSISTENT_ROOT,
  STORED_OBJECT_ROOT: process.env.STORED_OBJECT_ROOT,
  VENTUREOS_PERSISTENT_DEV: process.env.VENTUREOS_PERSISTENT_DEV,
  VENTUREOS_AUTHORISE_DATABASE_INIT: process.env.VENTUREOS_AUTHORISE_DATABASE_INIT,
  VENTUREOS_DATABASE_IDENTITY: process.env.VENTUREOS_DATABASE_IDENTITY,
  VENTUREOS_DATABASE_INSTANCE_ID: process.env.VENTUREOS_DATABASE_INSTANCE_ID,
  NEXT_RUNTIME: process.env.NEXT_RUNTIME,
  AUTH_SECRET: process.env.AUTH_SECRET,
  AUTH_URL: process.env.AUTH_URL,
};

afterEach(async () => {
  await resetDatabaseLifecycle();
  clearDatabaseSelectionForTests();
  restore("NODE_ENV", previous.NODE_ENV);
  restore("DATABASE_URL", previous.DATABASE_URL);
  restore("VENTUREOS_PERSISTENT_ROOT", previous.VENTUREOS_PERSISTENT_ROOT);
  restore("STORED_OBJECT_ROOT", previous.STORED_OBJECT_ROOT);
  restore("VENTUREOS_PERSISTENT_DEV", previous.VENTUREOS_PERSISTENT_DEV);
  restore("VENTUREOS_AUTHORISE_DATABASE_INIT", previous.VENTUREOS_AUTHORISE_DATABASE_INIT);
  restore("VENTUREOS_DATABASE_IDENTITY", previous.VENTUREOS_DATABASE_IDENTITY);
  restore("VENTUREOS_DATABASE_INSTANCE_ID", previous.VENTUREOS_DATABASE_INSTANCE_ID);
  restore("NEXT_RUNTIME", previous.NEXT_RUNTIME);
  restore("AUTH_SECRET", previous.AUTH_SECRET);
  restore("AUTH_URL", previous.AUTH_URL);
});

describe("demonstration provisioning", () => {
  it("requires one process and does not seed accounts", () => {
    assert.equal(DEMONSTRATION_RUNTIME_REQUIREMENT.applicationInstances, 1);
    assert.equal(DEMONSTRATION_RUNTIME_REQUIREMENT.objectDirectoryAccess, "exclusive-write");
    assert.equal(DEMONSTRATION_ACCOUNT_DEPENDENCY.records, "not-seeded");
  });

  it("refuses a protected path and an existing database without changing them", async () => {
    const root = mkdtempSync(join(tmpdir(), "vos-host-03-refuse-"));
    const existing = join(root, "kept.db");
    writeFileSync(existing, "keep");
    useEnv(root, existing, join(root, "objects"));
    await assert.rejects(provisionDemonstrationEnvironment(), code("demonstration_database_exists"));
    assert.equal(readFileSync(existing, "utf8"), "keep");

    const protectedDatabase = join(root, "data", "ventureos.db");
    process.env.DATABASE_URL = fileUrl(protectedDatabase);
    await assert.rejects(provisionDemonstrationEnvironment(), code("production_database_protected_path_refused"));
    assert.equal(existsSync(protectedDatabase), false);
  });

  it("refuses a junction object directory and an unauthorised initialiser", async () => {
    const root = mkdtempSync(join(tmpdir(), "vos-host-03-link-"));
    const outside = mkdtempSync(join(tmpdir(), "vos-host-03-outside-"));
    const linked = join(root, "linked-objects");
    symlinkSync(outside, linked, "junction");
    useEnv(root, join(root, "demo.db"), linked);
    await assert.rejects(provisionDemonstrationEnvironment(), code("production_path_symlink_refused"));
    assert.equal(existsSync(join(outside, "tenant")), false);

    delete process.env.VENTUREOS_AUTHORISE_DATABASE_INIT;
    process.env.STORED_OBJECT_ROOT = join(root, "objects");
    await assert.rejects(provisionDemonstrationEnvironment(), (error: unknown) => {
      return error instanceof PersistentDevelopmentDatabaseError && error.code === "persistent_database_initialisation_unauthorised";
    });
    assert.equal(existsSync(join(root, "demo.db")), false);
  });

  it("refuses an unsafe backup source and restore destination before writing", () => {
    const root = mkdtempSync(join(tmpdir(), "vos-host-03-r1-boundary-"));
    const outside = mkdtempSync(join(tmpdir(), "vos-host-03-r1-outside-"));
    const output = join(root, "backup-out");
    const objects = join(root, "objects");
    mkdirSync(objects);
    const outsideFile = join(outside, "copied.db");
    writeFileSync(outsideFile, "keep");
    useEnv(root, outsideFile, objects);
    assert.throws(() => backupDemonstrationEnvironment(output), code("production_path_outside_storage_root"));
    assert.equal(existsSync(output), false);
    assert.equal(readFileSync(outsideFile, "utf8"), "keep");

    const protectedFile = join(root, "ventureos.db");
    writeFileSync(protectedFile, "keep");
    process.env.DATABASE_URL = fileUrl(protectedFile);
    assert.throws(() => backupDemonstrationEnvironment(output), code("production_database_protected_path_refused"));
    assert.equal(existsSync(output), false);
    assert.equal(readFileSync(protectedFile, "utf8"), "keep");

    const linkedOutside = mkdtempSync(join(tmpdir(), "vos-host-03-r1-link-"));
    writeFileSync(join(linkedOutside, "demo.db"), "keep");
    symlinkSync(linkedOutside, join(root, "db-link"), "junction");
    process.env.DATABASE_URL = fileUrl(join(root, "db-link", "demo.db"));
    assert.throws(() => backupDemonstrationEnvironment(output), code("production_path_symlink_refused"));
    assert.equal(existsSync(output), false);
    assert.equal(readFileSync(join(linkedOutside, "demo.db"), "utf8"), "keep");

    const missingIdentity = join(root, "missing-identity.db");
    writeFileSync(missingIdentity, "keep");
    process.env.DATABASE_URL = fileUrl(missingIdentity);
    assert.throws(() => backupDemonstrationEnvironment(output), code("demonstration_backup_invalid"));
    assert.equal(existsSync(output), false);
    assert.equal(readFileSync(missingIdentity, "utf8"), "keep");

    const payload = join(root, "payload");
    mkdirSync(join(payload, "objects"), { recursive: true });
    writeFileSync(join(payload, "database.db"), "snapshot");
    writeFileSync(join(payload, "database.db.ventureos-identity"), "sidecar");
    const protectedDestination = join(root, "data", "ventureos.db");
    assert.throws(
      () => restoreDemonstrationEnvironment(payload, protectedDestination, join(root, "protected-objects")),
      code("production_database_protected_path_refused"),
    );
    assert.equal(existsSync(join(root, "data")), false);
    const outsideDestination = join(outside, "restored.db");
    assert.throws(
      () => restoreDemonstrationEnvironment(payload, outsideDestination, join(root, "outside-objects")),
      code("production_path_outside_storage_root"),
    );
    assert.equal(existsSync(outsideDestination), false);
    const existing = join(root, "existing.db");
    writeFileSync(existing, "keep");
    assert.throws(
      () => restoreDemonstrationEnvironment(payload, existing, join(root, "existing-objects")),
      code("demonstration_restore_exists"),
    );
    assert.equal(readFileSync(existing, "utf8"), "keep");
    symlinkSync(linkedOutside, join(root, "dest-link"), "junction");
    assert.throws(
      () => restoreDemonstrationEnvironment(payload, join(root, "dest-link", "restored.db"), join(root, "link-objects")),
      code("production_path_symlink_refused"),
    );
    assert.equal(existsSync(join(linkedOutside, "restored.db")), false);
    const outsideName = outside.split(/[/\\]/).pop();
    const traversed = join(outside, "traversed.db");
    assert.throws(
      () => restoreDemonstrationEnvironment(payload, `${root}/foo/../../${outsideName}/traversed.db`, join(root, "traversal-objects")),
      code("production_path_outside_storage_root"),
    );
    assert.equal(existsSync(traversed), false);
    symlinkSync(linkedOutside, join(payload, "objects", "link"), "junction");
    assert.throws(
      () => restoreDemonstrationEnvironment(payload, join(root, "partial.db"), join(root, "partial-objects")),
      code("production_object_root_symlink_refused"),
    );
    assert.equal(existsSync(join(root, "partial.db")), false);
    assert.equal(existsSync(join(root, "partial-objects")), false);
    assert.equal(readFileSync(join(linkedOutside, "demo.db"), "utf8"), "keep");
  });

  it("refuses backup destinations outside the volume and unpublished stages", () => {
    const root = mkdtempSync(join(tmpdir(), "vos-host-03-r2-dest-"));
    const outside = mkdtempSync(join(tmpdir(), "vos-host-03-r2-out-"));
    const objects = join(root, "objects");
    mkdirSync(objects);
    const source = join(root, "plain.db");
    writeFileSync(source, "keep");
    writeFileSync(join(root, "preexisting.txt"), "keep");
    useEnv(root, source, objects);
    symlinkSync(outside, join(root, "out-link"), "junction");
    const throughLink = join(root, "out-link", "linked-backup");
    assert.throws(() => backupDemonstrationEnvironment(throughLink), code("production_path_symlink_refused"));
    assert.equal(existsSync(join(outside, "linked-backup")), false);
    const outsideBackup = join(outside, "chosen-backup");
    assert.throws(() => backupDemonstrationEnvironment(outsideBackup), code("production_path_outside_storage_root"));
    assert.equal(existsSync(outsideBackup), false);
    const outsideName = outside.split(/[/\\]/).pop();
    const traversed = join(outside, "traversed-backup");
    assert.throws(
      () => backupDemonstrationEnvironment(`${root}/foo/../../${outsideName}/traversed-backup`),
      code("production_path_outside_storage_root"),
    );
    assert.equal(existsSync(traversed), false);
    const existing = join(root, "existing-backup");
    mkdirSync(existing);
    writeFileSync(join(existing, "keep.txt"), "keep");
    assert.throws(() => backupDemonstrationEnvironment(existing), code("demonstration_backup_exists"));
    assert.equal(readFileSync(join(existing, "keep.txt"), "utf8"), "keep");
    assert.equal(readFileSync(join(root, "preexisting.txt"), "utf8"), "keep");
    assert.equal(readdirSync(root).some((name) => name.startsWith(DEMONSTRATION_BACKUP_STAGE_PREFIX)), false);
    const abandoned = join(root, `${DEMONSTRATION_BACKUP_STAGE_PREFIX}abandoned`);
    mkdirSync(join(abandoned, "objects"), { recursive: true });
    writeFileSync(join(abandoned, "database.db"), "snapshot");
    writeFileSync(join(abandoned, "database.db.ventureos-identity"), "sidecar");
    writeFileSync(join(abandoned, "backup-complete.json"), JSON.stringify({
      format: "ventureos-demonstration-backup",
      database: "database.db",
      objects: "objects",
    }));
    const abandonedTarget = join(root, "from-stage.db");
    assert.throws(
      () => restoreDemonstrationEnvironment(abandoned, abandonedTarget, join(root, "from-stage-objects")),
      code("demonstration_backup_invalid"),
    );
    assert.equal(existsSync(abandonedTarget), false);
    assert.equal(existsSync(abandoned), true);
  });

  it("provisions an isolated database that survives a fresh process", async () => {
    const root = mkdtempSync(join(tmpdir(), "vos-host-03-live-"));
    const database = join(root, "demo.db");
    const objects = join(root, "objects");
    useEnv(root, database, objects);
    const result = await provisionDemonstrationEnvironment();
    assert.equal(result.accounts, "not-seeded");
    assert.equal(result.objectAccess === "restricted" || result.objectAccess === "host-acl-required", true);
    const ready = assessReadiness();
    assert.equal(ready.httpStatus, 200);
    const adapter = createLocalBlobStorageAdapter();
    await adapter.put("tenant/note", new Uint8Array([4, 5, 6]));
    const child = spawnSync("pnpm", [
      "exec", "tsx", "--tsconfig", "./tsconfig.test.json",
      "src/platform/runtime/demonstration-provision.child.ts",
    ], {
      cwd: process.cwd(),
      shell: true,
      encoding: "utf8",
      env: {
        ...process.env,
        NODE_ENV: "production",
        NEXT_RUNTIME: "nodejs",
        VENTUREOS_PERSISTENT_DEV: "1",
        DATABASE_URL: fileUrl(database),
        VENTUREOS_PERSISTENT_ROOT: root,
        STORED_OBJECT_ROOT: objects,
        VENTUREOS_DATABASE_IDENTITY: IDENTITY,
        VENTUREOS_DATABASE_INSTANCE_ID: INSTANCE,
        AUTH_SECRET: SECRET,
        AUTH_URL: ORIGIN,
      },
    });
    assert.equal(child.status, 0, child.stderr);
    assert.equal(child.stdout.trim(), '200 {"status":"ready"} {"n":0}');

    const backup = join(root, "backup");
    await resetDatabaseLifecycle();
    backupDemonstrationEnvironment(backup);
    assert.equal(existsSync(join(backup, "database.db")), true);
    assert.equal(existsSync(join(backup, "database.db.ventureos-identity")), true);
    assert.equal(existsSync(join(backup, "objects", "tenant", "note")), true);
    assert.throws(() => backupDemonstrationEnvironment(backup), code("demonstration_backup_exists"));
    assert.equal(existsSync(join(backup, "objects", "tenant", "note")), true);
    const outside = mkdtempSync(join(tmpdir(), "vos-host-03-r2-live-out-"));
    writeFileSync(join(outside, "marker.txt"), "keep");
    writeFileSync(join(root, "preexisting.txt"), "keep");
    symlinkSync(outside, join(objects, "escape"), "junction");
    const failedFinal = join(root, "failed-final");
    assert.throws(() => backupDemonstrationEnvironment(failedFinal), code("production_object_root_symlink_refused"));
    assert.equal(existsSync(failedFinal), false);
    assert.equal(readdirSync(root).some((name) => name.startsWith(DEMONSTRATION_BACKUP_STAGE_PREFIX)), false);
    assert.equal(readFileSync(join(root, "preexisting.txt"), "utf8"), "keep");
    assert.equal(readFileSync(join(outside, "marker.txt"), "utf8"), "keep");
    assert.equal(existsSync(join(outside, "failed-final")), false);
    process.env.VENTUREOS_DATABASE_IDENTITY = "vos-host-03-other-identity";
    const rejectedBackup = join(root, "rejected-backup");
    assert.throws(() => backupDemonstrationEnvironment(rejectedBackup), (error: unknown) => {
      return error instanceof PersistentDevelopmentDatabaseError && error.code === "persistent_database_identity_mismatch";
    });
    assert.equal(existsSync(rejectedBackup), false);
    process.env.VENTUREOS_DATABASE_IDENTITY = IDENTITY;
    await adapter.put("tenant/later", new Uint8Array([9]));
    const restoredDatabase = join(root, "restored.db");
    const restoredObjects = join(root, "restored-objects");
    restoreDemonstrationEnvironment(backup, restoredDatabase, restoredObjects);
    assert.deepEqual(Array.from(readFileSync(join(restoredObjects, "tenant", "note"))), [4, 5, 6]);
    assert.equal(existsSync(join(restoredObjects, "tenant", "later")), false);
    process.env.DATABASE_URL = fileUrl(restoredDatabase);
    process.env.STORED_OBJECT_ROOT = restoredObjects;
    assert.equal(assessReadiness().httpStatus, 200);
    process.env.VENTUREOS_DATABASE_IDENTITY = "vos-host-03-other-identity";
    const mismatch = assessReadiness();
    assert.equal(mismatch.httpStatus, 503);
    assert.equal(mismatch.body.reason, "database_unavailable");
  });
});

function useEnv(root: string, database: string, objects: string) {
  setNodeEnv("production");
  process.env.NEXT_RUNTIME = "nodejs";
  process.env.VENTUREOS_PERSISTENT_DEV = "1";
  process.env.VENTUREOS_AUTHORISE_DATABASE_INIT = "1";
  process.env.VENTUREOS_DATABASE_IDENTITY = IDENTITY;
  process.env.VENTUREOS_DATABASE_INSTANCE_ID = INSTANCE;
  process.env.VENTUREOS_PERSISTENT_ROOT = root;
  process.env.DATABASE_URL = fileUrl(database);
  process.env.STORED_OBJECT_ROOT = objects;
  process.env.AUTH_SECRET = SECRET;
  process.env.AUTH_URL = ORIGIN;
  mkdirSync(root, { recursive: true });
}

function fileUrl(filePath: string) {
  return `file:${filePath.replaceAll("\\", "/")}`;
}

function restore(name: string, value: string | undefined) {
  if (name === "NODE_ENV") {
    setNodeEnv(value);
    return;
  }
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}

function setNodeEnv(value: string | undefined) {
  if (value === undefined) delete (process.env as { NODE_ENV?: string }).NODE_ENV;
  else (process.env as { NODE_ENV?: string }).NODE_ENV = value;
}

function code(expected: string) {
  return (error: unknown) => error instanceof ProductionProcessError && error.code === expected;
}
