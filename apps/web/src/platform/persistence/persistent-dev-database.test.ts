import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdtempSync, readFileSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { afterEach, describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { createFrigoraWriteClient } from "@/modules/frigora/owned-write";
import { storedObjectDurability } from "@/platform/persistence/durability-client";
import {
  applyFrigoraQuotationIdentitySeals,
  ensureSchema,
  getClient,
  getDatabaseUrl,
  resetDatabaseLifecycle,
} from "./db";
import {
  PersistentDevelopmentDatabaseError,
  beginPersistentDatabaseMaintenance,
  createGuardedDatabaseClient,
  endPersistentDatabaseMaintenance,
  initialisePersistentDevelopmentDatabase,
  persistentApplicationId,
  recordDatabaseInstance,
  setPersistentDevelopmentCleanupFailureForTests,
} from "./persistent-dev-database";

const EMAIL = "pkg01-r1-owner@example.test";
const TOKEN = "pkg01-r1-isolated-identity";
const OTHER_TOKEN = "pkg01-r1-other-identity";
const INSTANCE = "11111111-1111-4111-8111-111111111111";
const OTHER_INSTANCE = "22222222-2222-4222-8222-222222222222";
const previous = {
  DATABASE_URL: process.env.DATABASE_URL,
  VENTUREOS_PERSISTENT_DEV: process.env.VENTUREOS_PERSISTENT_DEV,
  VENTUREOS_AUTHORISE_DATABASE_INIT: process.env.VENTUREOS_AUTHORISE_DATABASE_INIT,
  VENTUREOS_DATABASE_IDENTITY: process.env.VENTUREOS_DATABASE_IDENTITY,
  VENTUREOS_DATABASE_INSTANCE_ID: process.env.VENTUREOS_DATABASE_INSTANCE_ID,
  NEXT_RUNTIME: process.env.NEXT_RUNTIME,
  NEXT_PHASE: process.env.NEXT_PHASE,
};

afterEach(async () => {
  restore("DATABASE_URL", previous.DATABASE_URL);
  restore("VENTUREOS_PERSISTENT_DEV", previous.VENTUREOS_PERSISTENT_DEV);
  restore("VENTUREOS_AUTHORISE_DATABASE_INIT", previous.VENTUREOS_AUTHORISE_DATABASE_INIT);
  restore("VENTUREOS_DATABASE_IDENTITY", previous.VENTUREOS_DATABASE_IDENTITY);
  restore("VENTUREOS_DATABASE_INSTANCE_ID", previous.VENTUREOS_DATABASE_INSTANCE_ID);
  restore("NEXT_RUNTIME", previous.NEXT_RUNTIME);
  restore("NEXT_PHASE", previous.NEXT_PHASE);
  setPersistentDevelopmentCleanupFailureForTests(false);
  await resetDatabaseLifecycle();
});

describe("persistent development database contract", () => {
  it("keeps an authorised identity available to a new process", async () => {
    const protectedBefore = protectedDatabaseStamps();
    const databaseUrl = isolatedDatabaseUrl("restart");
    await initialise(databaseUrl);
    delete process.env.VENTUREOS_AUTHORISE_DATABASE_INIT;
    await resetDatabaseLifecycle(databaseUrl);
    await seedIdentity();
    await resetDatabaseLifecycle(databaseUrl);
    const child = spawnChild("read", databaseUrl, EMAIL);
    const result = await child;
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(JSON.parse(result.stdout), { users: 1, role: "owner", definitionId: "frigora" });
    assert.deepEqual(protectedDatabaseStamps(), protectedBefore);
  });

  it("refuses a different override, a forged header, a wrong catalog, and a wrong identity", async () => {
    const databaseUrl = isolatedDatabaseUrl("good");
    await initialise(databaseUrl);
    delete process.env.VENTUREOS_AUTHORISE_DATABASE_INIT;
    const bad = isolatedDatabaseUrl("bad");
    const badDb = new DatabaseSync(bad.slice("file:".length));
    badDb.exec("CREATE TABLE decoy (id TEXT)");
    badDb.exec("PRAGMA user_version = 31");
    badDb.close();
    await resetDatabaseLifecycle(bad);
    await assert.rejects(() => ensureSchema(), code("persistent_database_selection_mismatch"));
    assert.throws(() => createFrigoraWriteClient(), code("persistent_database_selection_mismatch"));
    assert.throws(() => storedObjectDurability.openClient(250), code("persistent_database_selection_mismatch"));
    await assert.rejects(() => applyFrigoraQuotationIdentitySeals(), code("persistent_database_selection_mismatch"));
    assert.deepEqual(tableNames(bad), ["decoy"]);

    const forged = isolatedDatabaseUrl("forged");
    const forgedDb = new DatabaseSync(forged.slice("file:".length));
    forgedDb.exec(`PRAGMA application_id = ${persistentApplicationId(TOKEN)}`);
    forgedDb.exec("PRAGMA user_version = 40");
    forgedDb.close();
    await resetDatabaseLifecycle(forged);
    process.env.DATABASE_URL = forged;
    await assert.rejects(() => ensureSchema(), code("persistent_database_fingerprint_mismatch"));
    assert.deepEqual(tableNames(forged), []);

    const catalog = isolatedDatabaseUrl("catalog");
    const catalogDb = new DatabaseSync(catalog.slice("file:".length));
    catalogDb.exec("CREATE TABLE decoy (id TEXT)");
    catalogDb.exec(`PRAGMA application_id = ${persistentApplicationId(TOKEN)}`);
    catalogDb.exec("PRAGMA user_version = 40");
    catalogDb.close();
    await resetDatabaseLifecycle(catalog);
    process.env.DATABASE_URL = catalog;
    await assert.rejects(() => ensureSchema(), code("persistent_database_fingerprint_mismatch"));
    assert.deepEqual(tableNames(catalog), ["decoy"]);

    process.env.DATABASE_URL = databaseUrl;
    process.env.VENTUREOS_DATABASE_IDENTITY = OTHER_TOKEN;
    await resetDatabaseLifecycle(databaseUrl);
    await assert.rejects(() => ensureSchema(), code("persistent_database_identity_mismatch"));
    assert.equal(tableNames(databaseUrl).includes("users"), true);
  });

  it("does not let initialisation stamp or create over an existing or missing ordinary startup", async () => {
    const existing = isolatedDatabaseUrl("existing");
    const existingDb = new DatabaseSync(existing.slice("file:".length));
    existingDb.exec("CREATE TABLE decoy (id TEXT)");
    existingDb.close();
    assign(existing, true);
    await resetDatabaseLifecycle(existing);
    await assert.rejects(
      () => initialisePersistentDevelopmentDatabase(() => ensureSchema(), async () => {}, async () => {}, async () => {}),
      code("persistent_database_exists"),
    );
    await assert.rejects(() => ensureSchema(), code("persistent_database_not_initialised"));
    assert.deepEqual(tableNames(existing), ["decoy"]);

    const missing = isolatedDatabaseUrl("missing");
    assign(missing, true);
    await resetDatabaseLifecycle(missing);
    await assert.rejects(() => ensureSchema(), code("persistent_database_missing"));
    assert.equal(existsSync(missing.slice("file:".length)), false);
  });

  it("fails closed for missing configuration, worktree paths, and direct server entry", async () => {
    process.env.VENTUREOS_PERSISTENT_DEV = "1";
    process.env.VENTUREOS_DATABASE_IDENTITY = TOKEN;
    delete process.env.DATABASE_URL;
    await resetDatabaseLifecycle("file:./data/ventureos.db");
    assert.throws(() => getDatabaseUrl(), code("persistent_database_url_missing"));
    process.env.DATABASE_URL = "file:./data/ventureos.db";
    await resetDatabaseLifecycle(process.env.DATABASE_URL);
    assert.throws(() => getDatabaseUrl(), code("persistent_database_worktree_default_refused"));
    process.env.DATABASE_URL = "file:///C:/Users/sykog/AppData/Local/Temp/vos-pkg01-r1-not-real/apps/web/data/ventureos.db";
    await resetDatabaseLifecycle(process.env.DATABASE_URL);
    assert.throws(() => getDatabaseUrl(), code("persistent_database_worktree_default_refused"));

    process.env.VENTUREOS_PERSISTENT_DEV = "0";
    delete process.env.DATABASE_URL;
    process.env.NEXT_RUNTIME = "nodejs";
    assert.throws(() => getDatabaseUrl(), code("persistent_database_url_missing"));

    const probe = readFileSync(fileURLToPath(new URL("../../../scripts/dev-restart-probe.ts", import.meta.url)), "utf8");
    const probeMain = probe.slice(probe.indexOf("async function main"));
    const start = readFileSync(fileURLToPath(new URL("../../../scripts/start.ts", import.meta.url)), "utf8");
    assert.ok(probeMain.indexOf("assertPersistentDevelopmentDatabaseReady") < probeMain.indexOf("recoverStaleDevServer"));
    assert.match(start, /assertPersistentDevelopmentDatabaseReady/);
    assert.match(readFileSync(fileURLToPath(new URL("../../../package.json", import.meta.url)), "utf8"), /"start": "tsx scripts\/start.ts"/);
  });

  it("follows a directory junction to the target and leaves a generation mismatch unchanged", async () => {
    const target = isolatedDatabaseUrl("junction-target");
    const targetDb = new DatabaseSync(target.slice("file:".length));
    targetDb.exec("CREATE TABLE decoy (id TEXT)");
    targetDb.exec("PRAGMA user_version = 31");
    targetDb.close();
    const linkDir = mkdtempSync(join(tmpdir(), "vos-pkg01-r1-junction-"));
    const junction = join(linkDir, "junction");
    const linked = spawnSync("cmd", ["/c", "mklink", "/J", junction, join(target.slice("file:".length), "..")], { encoding: "utf8" });
    assert.equal(linked.status, 0, linked.stdout + linked.stderr);
    const junctionUrl = `file:${join(junction, "identity.db").replaceAll("\\", "/")}`;
    assign(junctionUrl, false);
    await resetDatabaseLifecycle(junctionUrl);
    await assert.rejects(() => ensureSchema(), code("persistent_database_generation_mismatch"));
    assert.deepEqual(tableNames(target), ["decoy"]);

    const symlinkDir = mkdtempSync(join(tmpdir(), "vos-pkg01-r1-symlink-"));
    const link = join(symlinkDir, "link.db");
    const targetPath = target.slice("file:".length).replaceAll("/", "\\");
    const symlink = spawnSync(`mklink "${link}" "${targetPath}"`, { shell: true, encoding: "utf8" });
    if (symlink.status !== 0) {
      assert.match(`${symlink.stdout}\n${symlink.stderr}`, /privilege/i);
      return;
    }
    assign(`file:${link.replaceAll("\\", "/")}`, false);
    await resetDatabaseLifecycle(`file:${link.replaceAll("\\", "/")}`);
    await assert.rejects(() => ensureSchema(), code("persistent_database_symlink_refused"));
  });

  it("lets one initialiser win and keeps disposable mode available", async () => {
    const databaseUrl = isolatedDatabaseUrl("race");
    const first = spawnChild("init", databaseUrl);
    const second = spawnChild("init", databaseUrl);
    const results = await Promise.all([first, second]);
    const succeeded = results.filter((result) => result.status === 0);
    const failed = results.filter((result) => result.status !== 0);
    assert.equal(succeeded.length, 1);
    assert.match(failed[0]?.stderr ?? "", /persistent_database_concurrent_initialisation|persistent_database_exists/);
    assert.equal(tableNames(databaseUrl).includes("users"), true);

    const blocked = join(mkdtempSync(join(tmpdir(), "vos-pkg01-r2-blocked-")), "data", "ventureos.db");
    const blockedUrl = `file:${blocked.replaceAll("\\", "/")}`;
    process.env.VENTUREOS_PERSISTENT_DEV = "0";
    process.env.NEXT_RUNTIME = "nodejs";
    process.env.DATABASE_URL = blockedUrl;
    process.env.VENTUREOS_DATABASE_IDENTITY = TOKEN;
    process.env.VENTUREOS_DATABASE_INSTANCE_ID = INSTANCE;
    await resetDatabaseLifecycle(blockedUrl);
    await assert.rejects(() => ensureSchema(), code("persistent_database_worktree_default_refused"));
    assert.equal(existsSync(blocked), false);

    delete process.env.NEXT_RUNTIME;
    delete process.env.VENTUREOS_PERSISTENT_DEV;
    delete process.env.VENTUREOS_DATABASE_IDENTITY;
    delete process.env.VENTUREOS_DATABASE_INSTANCE_ID;
    const disposable = isolatedDatabaseUrl("disposable");
    await resetDatabaseLifecycle(disposable);
    await ensureSchema();
    assert.equal(tableNames(disposable).includes("users"), true);
  });

  it("rejects another instance, a replaced file, and a failed initialisation", async () => {
    const primary = isolatedDatabaseUrl("instance-a");
    const secondary = isolatedDatabaseUrl("instance-b");
    await initialise(primary);
    await initialise(secondary, OTHER_INSTANCE);
    process.env.VENTUREOS_DATABASE_INSTANCE_ID = INSTANCE;
    delete process.env.VENTUREOS_AUTHORISE_DATABASE_INIT;
    await resetDatabaseLifecycle(secondary);
    await assert.rejects(() => ensureSchema(), code("persistent_database_identity_mismatch"));
    copyFileSync(`${primary.slice("file:".length)}.ventureos-identity`, `${secondary.slice("file:".length)}.ventureos-identity`);
    await resetDatabaseLifecycle(secondary);
    await assert.rejects(() => ensureSchema(), code("persistent_database_identity_mismatch"));

    process.env.DATABASE_URL = primary;
    await resetDatabaseLifecycle(primary);
    await getClient();
    const decoy = isolatedDatabaseUrl("replacement");
    const decoyDb = new DatabaseSync(decoy.slice("file:".length));
    decoyDb.exec("CREATE TABLE decoy (id TEXT)");
    decoyDb.close();
    copyFileSync(decoy.slice("file:".length), primary.slice("file:".length));
    assert.throws(() => getClient(), (error: unknown) => error instanceof PersistentDevelopmentDatabaseError);
    assert.deepEqual(tableNames(primary), ["decoy"]);

    const failed = isolatedDatabaseUrl("cleanup");
    assign(failed, true);
    await resetDatabaseLifecycle(failed);
    await assert.rejects(
      () => initialisePersistentDevelopmentDatabase(
        () => ensureSchema(),
        async () => { throw new Error("stamp-failed"); },
        async () => {},
        () => resetDatabaseLifecycle(failed),
      ),
      (error: unknown) => error instanceof Error && error.message === "stamp-failed",
    );
    assert.equal(existsSync(failed.slice("file:".length)), false);
    assert.equal(existsSync(`${failed.slice("file:".length)}.ventureos-init.lock`), false);

    const stuck = isolatedDatabaseUrl("cleanup-stuck");
    assign(stuck, true);
    setPersistentDevelopmentCleanupFailureForTests(true);
    await resetDatabaseLifecycle(stuck);
    await assert.rejects(
      () => initialisePersistentDevelopmentDatabase(
        () => ensureSchema(),
        async () => { throw new Error("stamp-failed"); },
        async () => {},
        () => resetDatabaseLifecycle(stuck),
      ),
      code("persistent_database_cleanup_failed"),
    );
    assert.equal(existsSync(stuck.slice("file:".length)), true);
  });

  it("rejects retained writes after replacement and a delayed second initialiser", async () => {
    const databaseUrl = isolatedDatabaseUrl("retained");
    await initialise(databaseUrl);
    delete process.env.VENTUREOS_AUTHORISE_DATABASE_INIT;
    process.env.DATABASE_URL = databaseUrl;
    await resetDatabaseLifecycle(databaseUrl);
    const retained = getClient();
    const writer = createFrigoraWriteClient();
    const transaction = await retained.transaction("write");
    const statement = { sql: "CREATE TABLE probe_statement (id TEXT)", args: [] as string[] };
    const decoy = isolatedDatabaseUrl("retained-decoy");
    const decoyDb = new DatabaseSync(decoy.slice("file:".length));
    decoyDb.exec("CREATE TABLE decoy (id TEXT)");
    decoyDb.close();
    copyFileSync(decoy.slice("file:".length), databaseUrl.slice("file:".length));

    await assertOperationClosed(() => retained.execute("CREATE TABLE probe_execute (id TEXT)"));
    await assertOperationClosed(() => retained.execute(statement));
    await assertOperationClosed(() => transaction.execute("CREATE TABLE probe_tx (id TEXT)"));
    await assertOperationClosed(() => transaction.batch([{ sql: "CREATE TABLE probe_tx_batch (id TEXT)", args: [] }]));
    await assertOperationClosed(() => transaction.commit());
    await assertOperationClosed(() => retained.transaction("write"));
    await assertOperationClosed(() => writer.execute("CREATE TABLE probe_writer (id TEXT)"));
    await assertOperationClosed(() => writer.batch(["CREATE TABLE probe_batch (id TEXT)"], "write"));
    await assertOperationClosed(() => writer.executeMultiple("CREATE TABLE probe_script (id TEXT);"));
    await assertOperationClosed(() => retained.execute("CREATE TABLE probe_repeat (id TEXT)"));
    assert.throws(() => retained.reconnect(), code("persistent_database_changed"));
    await assertOperationClosed(() => getClient().execute("CREATE TABLE probe_fresh (id TEXT)"));
    assert.deepEqual(tableNames(databaseUrl), ["decoy"]);

    const delayed = isolatedDatabaseUrl("delayed");
    const first = await spawnChild("init", delayed);
    assert.equal(first.status, 0, first.stderr);
    const second = await spawnChild("init", delayed);
    assert.notEqual(second.status, 0);
    assert.match(second.stderr ?? "", /persistent_database_exists/);
    assert.equal(tableNames(delayed).includes("users"), true);
    assert.equal(existsSync(`${delayed.slice("file:".length)}.ventureos-identity`), true);
  });

  it("rejects a replacement during schema maintenance and refuses build-time file access", async () => {
    const databaseUrl = isolatedDatabaseUrl("maintenance");
    await initialise(databaseUrl);
    delete process.env.VENTUREOS_AUTHORISE_DATABASE_INIT;
    delete process.env.NEXT_PHASE;
    process.env.NEXT_RUNTIME = "nodejs";
    process.env.DATABASE_URL = databaseUrl;
    await resetDatabaseLifecycle(databaseUrl);
    const runtimeUrl = getDatabaseUrl();
    assert.equal(runtimeUrl.includes("identity.db"), true);
    const retained = getClient();
    const transaction = await retained.transaction("write");
    const decoy = isolatedDatabaseUrl("maintenance-decoy");
    const decoyDb = new DatabaseSync(decoy.slice("file:".length));
    decoyDb.exec("CREATE TABLE decoy (id TEXT)");
    decoyDb.close();
    copyFileSync(decoy.slice("file:".length), databaseUrl.slice("file:".length));
    beginPersistentDatabaseMaintenance();
    try {
      await assertOperationClosed(() => retained.execute("CREATE TABLE probe_maint (id TEXT)"));
      await assertOperationClosed(() => transaction.execute("CREATE TABLE probe_maint_tx (id TEXT)"));
      await assertOperationClosed(() => transaction.commit());
      await assertOperationClosed(() => retained.migrate(["CREATE TABLE probe_migrate (id TEXT)"]));
      assert.deepEqual(tableNames(databaseUrl), ["decoy"]);
    } finally {
      endPersistentDatabaseMaintenance();
    }
    await assertOperationClosed(() => retained.execute("CREATE TABLE probe_after (id TEXT)"));
    assert.deepEqual(tableNames(databaseUrl), ["decoy"]);

    const explicit = isolatedDatabaseUrl("build-explicit");
    process.env.NEXT_PHASE = "phase-production-build";
    process.env.NEXT_RUNTIME = "nodejs";
    process.env.VENTUREOS_PERSISTENT_DEV = "1";
    process.env.DATABASE_URL = explicit;
    await resetDatabaseLifecycle(explicit);
    assert.throws(() => getDatabaseUrl(), code("persistent_database_build_access_refused"));
    assert.throws(() => createGuardedDatabaseClient({ url: explicit }), code("persistent_database_build_access_refused"));
    await assert.rejects(() => ensureSchema(), code("persistent_database_build_access_refused"));
    assert.equal(existsSync(explicit.slice("file:".length)), false);

    const implicit = await spawnBuildDefault();
    assert.equal(implicit.status, 0, implicit.stderr);
    assert.equal(implicit.stdout, "persistent_database_build_access_refused");
  });
});

function code(expected: string) {
  return (error: unknown) => error instanceof PersistentDevelopmentDatabaseError && error.code === expected;
}

async function assertOperationClosed(run: () => unknown) {
  try {
    await run();
  } catch (error) {
    assert.ok(error instanceof PersistentDevelopmentDatabaseError, error instanceof Error ? error.message : String(error));
    return;
  }
  throw new Error("database operation was authorised");
}

async function initialise(databaseUrl: string, instanceId = INSTANCE) {
  assign(databaseUrl, true);
  process.env.VENTUREOS_DATABASE_INSTANCE_ID = instanceId;
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
}

async function seedIdentity() {
  await getClient().execute({
    sql: "INSERT INTO users (id, email, password_hash, name, created_at) VALUES (?, ?, ?, ?, ?)",
    args: ["user-pkg01-r1", EMAIL, "not-a-login-secret", "Pkg01 Owner", "2026-11-17T00:00:00.000Z"],
  });
  await getClient().execute({
    sql: "INSERT INTO workspaces (id, name, slug, created_at) VALUES (?, ?, ?, ?)",
    args: ["ws-pkg01-r1", "Pkg01", "pkg01-r1", "2026-11-17T00:00:00.000Z"],
  });
  await getClient().execute({
    sql: "INSERT INTO workspace_members (workspace_id, user_id, role, created_at) VALUES (?, ?, ?, ?)",
    args: ["ws-pkg01-r1", "user-pkg01-r1", "owner", "2026-11-17T00:00:00.000Z"],
  });
  await getClient().execute({
    sql: "INSERT INTO ventures (id, workspace_id, name, slug, created_at, definition_id) VALUES (?, ?, ?, ?, ?, ?)",
    args: ["ven-pkg01-r1", "ws-pkg01-r1", "Pkg01 Frigora", "pkg01-r1-frigora", "2026-11-17T00:00:00.000Z", "frigora"],
  });
}

function assign(databaseUrl: string, authorise: boolean) {
  process.env.DATABASE_URL = databaseUrl;
  process.env.VENTUREOS_PERSISTENT_DEV = "1";
  process.env.VENTUREOS_DATABASE_IDENTITY = TOKEN;
  process.env.VENTUREOS_DATABASE_INSTANCE_ID = INSTANCE;
  if (authorise) process.env.VENTUREOS_AUTHORISE_DATABASE_INIT = "1";
  else delete process.env.VENTUREOS_AUTHORISE_DATABASE_INIT;
}

function isolatedDatabaseUrl(label: string) {
  const directory = mkdtempSync(join(tmpdir(), `vos-pkg01-r1-${label}-`));
  return `file:${join(directory, "identity.db").replaceAll("\\", "/")}`;
}

function tableNames(databaseUrl: string) {
  const db = new DatabaseSync(databaseUrl.slice("file:".length), { readOnly: true });
  try {
    return db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all().map((row) => String(row.name));
  } finally {
    db.close();
  }
}

function restore(name: string, value: string | undefined) {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}

function protectedDatabaseStamps() {
  return [
    "C:/Users/sykog/Projects/frigora-quote-01/apps/web/data/ventureos.db",
    "C:/Users/sykog/Projects/ventureos-frigora-f34-04/apps/web/data/ventureos.db",
    "C:/Users/sykog/AppData/Local/Temp/frg-demo-env-02/db/demo.db",
  ].map((filePath) => {
    const stamp = statSync(filePath);
    return { filePath, size: stamp.size, mtimeMs: stamp.mtimeMs };
  });
}

function spawnBuildDefault() {
  const args = ["--import", "tsx", fileURLToPath(new URL("./persistent-dev-database.child.ts", import.meta.url)), "build-default"];
  return new Promise<{ status: number | null; stdout: string; stderr: string }>((resolvePromise, reject) => {
    const env: NodeJS.ProcessEnv = {
      ...process.env,
      NEXT_PHASE: "phase-production-build",
      NEXT_RUNTIME: "nodejs",
      VENTUREOS_PERSISTENT_DEV: "1",
    };
    delete (env as { DATABASE_URL?: string }).DATABASE_URL;
    const child = spawn(process.execPath, args, {
      cwd: fileURLToPath(new URL("../../..", import.meta.url)),
      env,
    });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", reject);
    child.on("close", (status) => resolvePromise({ status, stdout, stderr }));
  });
}

function spawnChild(mode: string, databaseUrl: string, email?: string) {
  const args = ["--import", "tsx", fileURLToPath(new URL("./persistent-dev-database.child.ts", import.meta.url)), mode];
  if (email) args.push(email);
  return new Promise<{ status: number | null; stdout: string; stderr: string }>((resolvePromise, reject) => {
    const child = spawn(process.execPath, args, {
      cwd: fileURLToPath(new URL("../../..", import.meta.url)),
      env: {
        ...process.env,
        DATABASE_URL: databaseUrl,
        VENTUREOS_PERSISTENT_DEV: "1",
        VENTUREOS_DATABASE_IDENTITY: TOKEN,
        VENTUREOS_DATABASE_INSTANCE_ID: INSTANCE,
        ...(mode === "init" ? { VENTUREOS_AUTHORISE_DATABASE_INIT: "1" } : {}),
      },
    });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", reject);
    child.on("close", (status) => resolvePromise({ status, stdout, stderr }));
  });
}
