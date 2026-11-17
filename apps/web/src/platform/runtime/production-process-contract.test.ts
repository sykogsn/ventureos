import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, statSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, it } from "node:test";
import { GET as live } from "@/app/api/health/live/route";
import { GET as ready } from "@/app/api/health/ready/route";
import { clearDatabaseSelectionForTests, ensureFileDatabase, ensureSchema, getClient, getDatabaseUrl, resetDatabaseLifecycle } from "@/platform/persistence/db";
import { initialisePersistentDevelopmentDatabase, recordDatabaseInstance } from "@/platform/persistence/persistent-dev-database";
import { createLocalBlobStorageAdapter } from "@/platform/storage/local-adapter";
import {
  INITIAL_PUBLIC_ORIGIN,
  PRODUCTION_RUNTIME_REQUIREMENT,
  ProductionProcessError,
  assertProductionDatabaseUrl,
  assertProductionObjectRoot,
  assertProductionStartup,
  assessReadiness,
  resolvePublicAppOrigin,
} from "./production-process-contract";

const SECRET = "production-process-contract-test-secret";
const previous = {
  NODE_ENV: process.env.NODE_ENV,
  DATABASE_URL: process.env.DATABASE_URL,
  VENTUREOS_PERSISTENT_ROOT: process.env.VENTUREOS_PERSISTENT_ROOT,
  STORED_OBJECT_ROOT: process.env.STORED_OBJECT_ROOT,
  AUTH_SECRET: process.env.AUTH_SECRET,
  AUTH_URL: process.env.AUTH_URL,
  NEXT_RUNTIME: process.env.NEXT_RUNTIME,
  NEXT_PHASE: process.env.NEXT_PHASE,
  VENTUREOS_PERSISTENT_DEV: process.env.VENTUREOS_PERSISTENT_DEV,
};

afterEach(() => {
  clearDatabaseSelectionForTests();
  restore("NODE_ENV", previous.NODE_ENV);
  restore("DATABASE_URL", previous.DATABASE_URL);
  restore("VENTUREOS_PERSISTENT_ROOT", previous.VENTUREOS_PERSISTENT_ROOT);
  restore("STORED_OBJECT_ROOT", previous.STORED_OBJECT_ROOT);
  restore("AUTH_SECRET", previous.AUTH_SECRET);
  restore("AUTH_URL", previous.AUTH_URL);
  restore("NEXT_RUNTIME", previous.NEXT_RUNTIME);
  restore("NEXT_PHASE", previous.NEXT_PHASE);
  restore("VENTUREOS_PERSISTENT_DEV", previous.VENTUREOS_PERSISTENT_DEV);
});

describe("production process contract", () => {
  it("keeps one scheduler inside one host-enforced instance", () => {
    assert.equal(PRODUCTION_RUNTIME_REQUIREMENT.applicationInstances, 1);
    assert.equal(PRODUCTION_RUNTIME_REQUIREMENT.schedulerIntervalMs, 15_000);
    assert.equal(PRODUCTION_RUNTIME_REQUIREMENT.enforcement, "hosting");
  });

  it("requires an explicit production database and refuses the worktree default", () => {
    setNodeEnv("production");
    delete process.env.DATABASE_URL;
    assert.throws(
      () => assertProductionDatabaseUrl("file:./data/ventureos.db"),
      code("production_database_url_missing"),
    );
    process.env.DATABASE_URL = "file:./data/ventureos.db";
    assert.throws(
      () => assertProductionDatabaseUrl(process.env.DATABASE_URL ?? ""),
      code("production_database_protected_path_refused"),
    );
  });

  it("refuses protected development database paths before opening them", () => {
    const root = makeVolume();
    setNodeEnv("production");
    for (const databaseUrl of [
      "file:C:/Users/sykog/Projects/ventureos-frigora-f34-04/apps/web/data/copy.db",
      "file:C:/Users/sykog/AppData/Local/Temp/frg-demo-env-02/db/demo.db",
      "file:C:/Users/sykog/AppData/Local/Temp/frg-r1-v2-hosted-not-live/isolated.db",
      "file:C:/temp/apps/web/data/renamed.db",
    ]) {
      process.env.DATABASE_URL = databaseUrl;
      process.env.VENTUREOS_PERSISTENT_ROOT = root;
      assert.throws(() => assertProductionDatabaseUrl(databaseUrl), code("production_database_protected_path_refused"));
    }
  });

  it("refuses a missing, invalid, escaping, or symlink storage location", () => {
    const root = makeVolume();
    const database = join(root, "frigora.db");
    setNodeEnv("production");
    process.env.DATABASE_URL = fileUrl(database);
    delete process.env.VENTUREOS_PERSISTENT_ROOT;
    assert.throws(() => assertProductionDatabaseUrl(fileUrl(database)), code("production_storage_root_missing"));

    const notDirectory = join(root, "not-a-directory");
    writeFileSync(notDirectory, "");
    process.env.VENTUREOS_PERSISTENT_ROOT = notDirectory;
    assert.throws(() => assertProductionDatabaseUrl(fileUrl(database)), code("production_storage_root_invalid"));

    process.env.VENTUREOS_PERSISTENT_ROOT = root;
    const outside = join(root, "..", "outside.db");
    process.env.DATABASE_URL = fileUrl(outside);
    assert.throws(() => assertProductionDatabaseUrl(fileUrl(outside)), code("production_path_outside_storage_root"));
    assert.equal(existsSync(join(root, "..", "outside.db")), false);

    const elsewhere = mkdtempSync(join(tmpdir(), "vos-host-02-outside-"));
    const link = join(root, "alias");
    symlinkSync(elsewhere, link, "junction");
    const throughLink = join(link, "frigora.db");
    process.env.DATABASE_URL = fileUrl(throughLink);
    assert.throws(() => assertProductionDatabaseUrl(fileUrl(throughLink)), code("production_path_symlink_refused"));
    assert.equal(existsSync(throughLink), false);
  });

  it("accepts a database inside the volume without creating it", () => {
    const { root, database, objects } = productionFixture();
    useProductionEnv(root, database, objects);
    assertProductionStartup();
    assert.equal(existsSync(database), false);
    assert.throws(() => getDatabaseUrl(), code("production_database_unavailable"));
    assert.throws(() => ensureFileDatabase(fileUrl(database)), code("production_database_unavailable"));
    assert.equal(existsSync(database), false);
    const unreadiness = assessReadiness();
    assert.equal(unreadiness.httpStatus, 503);
    assert.equal(unreadiness.body.reason, "database_unavailable");
    writeFileSync(database, "");
    const readiness = assessReadiness();
    assert.equal(readiness.httpStatus, 503);
    assert.equal(readiness.body.reason, "database_unavailable");
    assert.equal(JSON.stringify(readiness.body).includes(root), false);
    assert.equal(JSON.stringify(readiness.body).includes(SECRET), false);
    assert.equal(readFileSync(database).length, 0);
  });

  it("reports ready only after read-only identity validation", async () => {
    const { root, database, objects } = productionFixture();
    useProductionEnv(root, database, objects);
    process.env.NEXT_RUNTIME = "nodejs";
    process.env.VENTUREOS_PERSISTENT_DEV = "1";
    process.env.VENTUREOS_AUTHORISE_DATABASE_INIT = "1";
    process.env.VENTUREOS_DATABASE_IDENTITY = "vos-host-02-r1-identity";
    process.env.VENTUREOS_DATABASE_INSTANCE_ID = "33333333-3333-4333-8333-333333333333";
    const url = fileUrl(database);
    await resetDatabaseLifecycle(url);
    await initialisePersistentDevelopmentDatabase(
      () => ensureSchema(),
      async (applicationId, userVersion) => {
        await getClient().execute(`PRAGMA application_id = ${applicationId}`);
        await getClient().execute(`PRAGMA user_version = ${userVersion}`);
      },
      (instanceId) => recordDatabaseInstance((statement) => getClient().execute(statement), instanceId),
      () => resetDatabaseLifecycle(url),
    );
    await resetDatabaseLifecycle(url);
    const before = snapshot(root);
    const readiness = assessReadiness();
    assert.equal(readiness.httpStatus, 200);
    assert.deepEqual(readiness.body, { status: "ready" });
    assert.equal(JSON.stringify(readiness.body).includes(root), false);
    assert.deepEqual(snapshot(root), before);
    await resetDatabaseLifecycle(url);
  });

  it("requires an explicit object directory inside the volume", () => {
    const { root, database, objects } = productionFixture();
    useProductionEnv(root, database, objects);
    delete process.env.STORED_OBJECT_ROOT;
    assert.throws(() => assertProductionObjectRoot(), code("production_object_root_missing"));
    process.env.STORED_OBJECT_ROOT = join(process.cwd(), "data", "objects");
    assert.throws(() => assertProductionObjectRoot(), code("production_object_root_worktree_refused"));
    process.env.STORED_OBJECT_ROOT = join(root, "..", "objects");
    assert.throws(() => assertProductionObjectRoot(), code("production_path_outside_storage_root"));
    process.env.STORED_OBJECT_ROOT = objects;
    assert.equal(assertProductionObjectRoot(), objects);
    return createLocalBlobStorageAdapter().exists("aa/bb").then((found) => {
      assert.equal(found, false);
      assert.equal(existsSync(join(objects, "aa", "bb")), false);
    });
  });

  it("keeps development database and object defaults", () => {
    setNodeEnv("development");
    delete process.env.DATABASE_URL;
    delete process.env.NEXT_RUNTIME;
    delete process.env.NEXT_PHASE;
    delete process.env.VENTUREOS_PERSISTENT_DEV;
    delete process.env.STORED_OBJECT_ROOT;
    assert.equal(getDatabaseUrl(), "file:./data/ventureos.db");
    const root = makeVolume();
    process.env.STORED_OBJECT_ROOT = root;
    return createLocalBlobStorageAdapter().exists("aa/bb").then((found) => {
      assert.equal(found, false);
    });
  });

  it("accepts one https origin and ignores forwarded hosts", () => {
    assert.equal(
      resolvePublicAppOrigin({
        nodeEnv: "production",
        authUrl: `${INITIAL_PUBLIC_ORIGIN}/`,
        forwardedHost: "app.ventureoperatingsystem.co.za",
        forwardedProto: "http",
        host: "evil.example",
      }),
      INITIAL_PUBLIC_ORIGIN,
    );
    assert.throws(
      () =>
        resolvePublicAppOrigin({
          nodeEnv: "production",
          authUrl: undefined,
          forwardedHost: "evil.example",
          forwardedProto: "https",
          host: "evil.example",
        }),
      code("production_auth_url_missing"),
    );
    assert.throws(
      () =>
        resolvePublicAppOrigin({
          nodeEnv: "production",
          authUrl: "https://app.ventureoperatingsystem.co.za",
          forwardedHost: null,
          forwardedProto: null,
          host: null,
        }),
      code("production_auth_url_invalid"),
    );
    assert.equal(
      resolvePublicAppOrigin({
        nodeEnv: "development",
        authUrl: undefined,
        forwardedHost: null,
        forwardedProto: null,
        host: null,
      }),
      "http://localhost:3000",
    );
  });

  it("reports liveness without readiness side effects", async () => {
    setNodeEnv("development");
    delete process.env.DATABASE_URL;
    const liveResponse = live();
    const readyResponse = ready();
    assert.equal(liveResponse.status, 200);
    assert.deepEqual(await liveResponse.json(), { status: "live" });
    assert.equal(readyResponse.status, 200);
    assert.deepEqual(await readyResponse.json(), { status: "ready" });
  });
});

function productionFixture() {
  const root = makeVolume();
  const objects = join(root, "objects");
  mkdirSync(objects);
  return { root, database: join(root, "frigora.db"), objects };
}

function useProductionEnv(root: string, database: string, objects: string) {
  setNodeEnv("production");
  delete process.env.NEXT_RUNTIME;
  delete process.env.NEXT_PHASE;
  delete process.env.VENTUREOS_PERSISTENT_DEV;
  process.env.VENTUREOS_PERSISTENT_ROOT = root;
  process.env.DATABASE_URL = fileUrl(database);
  process.env.STORED_OBJECT_ROOT = objects;
  process.env.AUTH_SECRET = SECRET;
  process.env.AUTH_URL = INITIAL_PUBLIC_ORIGIN;
}

function makeVolume() {
  return mkdtempSync(join(tmpdir(), "vos-host-02-"));
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
  return (error: unknown) => error instanceof ProductionProcessError && error.message === expected;
}

function snapshot(directory: string) {
  return readdirSync(directory).sort().map((name) => {
    const path = join(directory, name);
    const listing = statSync(path);
    if (listing.isDirectory()) return { name, kind: "directory" as const };
    return { name, kind: "file" as const, bytes: readFileSync(path).toString("base64") };
  });
}
