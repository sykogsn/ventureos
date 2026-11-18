import assert from "node:assert/strict";
import { linkSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import {
  applyFrigoraQuotationIdentitySeals,
  ensureFrigoraCommercialLinesSchema,
  ensureSchema,
  getClient,
  getDatabaseUrl,
  resetDatabaseLifecycle,
  setIdentitySealCommitReplacementForTests,
} from "@/platform/persistence/db";
import {
  addIdentitySealProtectedPathForTests,
  assertUsablePhysicalIdentity,
  IDENTITY_SEAL_PREREQUISITE_MESSAGE,
  quotationIdentitySealInsertTriggerSql,
  quotationIdentitySealTableSql,
  quotationIdentitySealTriggerCatalog,
  refuseIdentitySealDatabaseUrl,
} from "@/platform/persistence/frigora-quotation-identity-seal";
import { resetPersistenceLifecycle } from "@/platform/persistence/repositories";
import { closeFrigoraPersistenceAfterFile } from "./test-persistence-lifecycle";
// @ts-expect-error TS7016 The installed libsql package does not ship TypeScript declarations.
import Database from "../../../../../node_modules/.pnpm/libsql@0.5.29/node_modules/libsql/index.js";

const NOW = "2026-11-11T12:00:00.000Z";
const DB_SOURCE = fileURLToPath(new URL("../../platform/persistence/db.ts", import.meta.url));
const LINES_DDL = fileURLToPath(new URL("../../platform/persistence/frigora-commercial-lines-ddl.ts", import.meta.url));
const STORE_SOURCE = fileURLToPath(new URL("./quotation-store.ts", import.meta.url));
const LINES_SOURCE = fileURLToPath(new URL("./quotation-lines.ts", import.meta.url));
const PROTECTED_PATH = fileURLToPath(new URL("../../../data/ventureos.db", import.meta.url)).replaceAll("\\", "/");

closeFrigoraPersistenceAfterFile();

beforeEach(async () => {
  setIdentitySealCommitReplacementForTests(null);
  await resetPersistenceLifecycle();
  await ensureSchema();
  const url = getDatabaseUrl();
  if (url.toLowerCase().includes("ventureos.db") || url.toLowerCase().includes("frg-r1-v2-hosted")) {
    throw new Error("Refusing a protected database");
  }
});

type RawDatabase = InstanceType<typeof Database>;

function rawDatabase(): RawDatabase {
  const url = getDatabaseUrl();
  if (url.toLowerCase().includes("ventureos.db") || url.toLowerCase().includes("frg-r1-v2-hosted")) {
    throw new Error("Refusing a protected database");
  }
  return new Database(url.slice("file:".length));
}

function setMode(db: RawDatabase, foreignKeys: number) {
  db.pragma(`foreign_keys = ${foreignKeys}`);
  db.pragma("recursive_triggers = OFF");
  assert.equal((db.prepare("PRAGMA foreign_keys").get() as { foreign_keys: number }).foreign_keys, foreignKeys);
  assert.equal((db.prepare("PRAGMA recursive_triggers").get() as { recursive_triggers: number }).recursive_triggers, 0);
}

async function seedParty(assetId: string | null) {
  await getClient().execute({
    sql: `INSERT INTO frigora_customers (id, workspace_id, venture_id, code, display_name, created_at, updated_at)
          VALUES ('cus-a','ws','ven','A','Customer A',?,?), ('cus-b','ws','ven','B','Customer B',?,?)`,
    args: [NOW, NOW, NOW, NOW],
  });
  await getClient().execute({
    sql: `INSERT INTO frigora_sites (id, workspace_id, venture_id, customer_id, code, name, created_at, updated_at)
          VALUES ('site-a','ws','ven','cus-a','SA','Site A',?,?), ('site-b','ws','ven','cus-b','SB','Site B',?,?)`,
    args: [NOW, NOW, NOW, NOW],
  });
  if (assetId) {
    await getClient().execute({
      sql: `INSERT INTO frigora_assets (id, workspace_id, venture_id, site_id, tag, created_at, updated_at)
            VALUES (?,'ws','ven','site-a','TAG',?,?)`,
      args: [assetId, NOW, NOW],
    });
  }
  await getClient().execute({
    sql: `INSERT INTO frigora_work_orders (
            id, workspace_id, venture_id, customer_id, site_id, work_reference, work_kind, created_at, updated_at
          ) VALUES ('wo-a','ws','ven','cus-a','site-a','WO-A','reactive',?,?)`,
    args: [NOW, NOW],
  });
  await getClient().execute({
    sql: `INSERT INTO frigora_recommended_actions (
            id, workspace_id, venture_id, visit_id, work_order_id, asset_id, description,
            recommended_at, recommended_by_user_id, recorded_by_user_id, created_at, updated_at
          ) VALUES ('rec-a','ws','ven','visit-a','wo-a',?,'Repair',?,?,?,?,?)`,
    args: [assetId, NOW, "user-a", "user-a", NOW, NOW],
  });
}

async function seedQuotation(id: string, assetId: string | null, actionId = "rec-a") {
  await getClient().execute({
    sql: `INSERT INTO frigora_quotations (
            id, workspace_id, venture_id, customer_id, site_id, asset_id,
            original_work_order_id, recommended_action_id, current_version, created_at, updated_at
          ) VALUES (?,'ws','ven','cus-a','site-a',?,'wo-a',?,1,?,?)`,
    args: [id, assetId, actionId, NOW, NOW],
  });
  await getClient().execute({
    sql: `INSERT INTO frigora_quotation_versions (
            quotation_id, workspace_id, venture_id, version_number, status, description,
            total_minor, currency, document_hash
          ) VALUES (?,'ws','ven',1,'awaiting_customer_approval','Issued offer',1495000,'ZAR','hash-issued')`,
    args: [id],
  });
}

function comparable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(comparable);
  if (value && typeof value === "object") {
    const copy: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value)) {
      if (key === "_metadata") continue;
      copy[key] = comparable(entry);
    }
    return copy;
  }
  return value;
}

function identity(db: RawDatabase, quotationId: string) {
  const header = db.prepare(`
    SELECT customer_id, site_id, asset_id, original_work_order_id, recommended_action_id, current_version
    FROM frigora_quotations WHERE id = ?
  `).get(quotationId) as Record<string, unknown>;
  const seals = db.prepare(`
    SELECT copy, customer_id, site_id, asset_id, original_work_order_id, recommended_action_id
    FROM frigora_quotation_identity_seals WHERE quotation_id = ? ORDER BY copy
  `).all(quotationId) as Array<Record<string, unknown>>;
  const version = db.prepare(
    "SELECT document_hash FROM frigora_quotation_versions WHERE quotation_id = ? AND version_number = 1",
  ).get(quotationId) as { document_hash: string } | undefined;
  return { header, seals, hash: version?.document_hash ?? null };
}

function assertOriginal(db: RawDatabase, quotationId: string, assetId: string | null, actionId = "rec-a") {
  const state = identity(db, quotationId);
  assert.equal(state.header.customer_id, "cus-a");
  assert.equal(state.header.site_id, "site-a");
  assert.equal(state.header.asset_id, assetId);
  assert.equal(state.header.original_work_order_id, "wo-a");
  assert.equal(state.header.recommended_action_id, actionId);
  assert.equal(state.header.current_version, 1);
  assert.equal(state.hash, "hash-issued");
  assert.equal(state.seals.length, 2);
  for (const seal of state.seals) {
    assert.equal(seal.customer_id, "cus-a");
    assert.equal(seal.site_id, "site-a");
    assert.equal(seal.asset_id, assetId);
    assert.equal(seal.original_work_order_id, "wo-a");
    assert.equal(seal.recommended_action_id, actionId);
  }
}

describe("Frigora quotation identity seals", () => {
  it("keeps the migration out of normal initialisers and refuses protected urls", async () => {
    const dbSource = readFileSync(DB_SOURCE, "utf8");
    const ensureStart = dbSource.indexOf("export async function ensureSchema");
    const ensureEnd = dbSource.indexOf("export async function ensureFrigoraStockSchemaReady");
    const linesStart = dbSource.indexOf("export async function ensureFrigoraCommercialLinesSchema");
    const linesEnd = dbSource.indexOf("let identitySealCommitReplacementForTests");
    assert.equal(dbSource.slice(ensureStart, ensureEnd).includes("applyFrigoraQuotationIdentitySeals"), false);
    assert.equal(dbSource.slice(linesStart, linesEnd).includes("applyFrigoraQuotationIdentitySeals"), false);
    assert.equal(readFileSync(LINES_DDL, "utf8").includes("applyFrigoraQuotationIdentitySeals"), false);
    assert.equal(readFileSync(STORE_SOURCE, "utf8").includes("applyFrigoraQuotationIdentitySeals"), false);
    assert.equal(readFileSync(LINES_SOURCE, "utf8").includes("applyFrigoraQuotationIdentitySeals"), false);
    assert.match(dbSource, /const SCHEMA_GENERATION = 40;/);
    await ensureFrigoraCommercialLinesSchema();
    const tables = await getClient().execute(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'frigora_quotation_identity_seals'",
    );
    assert.equal(tables.rows.length, 0);

    assert.throws(
      () => refuseIdentitySealDatabaseUrl(`file:${PROTECTED_PATH}`),
      /protected database/,
    );
    assert.throws(
      () => refuseIdentitySealDatabaseUrl(`file:${PROTECTED_PATH.replaceAll(".", "%2E")}?authToken=test-token`),
      /protected database/,
    );
    assert.throws(
      () => refuseIdentitySealDatabaseUrl("file:C:/temp/frg-r1-v2-hosted-not-live/isolated.db"),
      /protected database/,
    );
    refuseIdentitySealDatabaseUrl(getDatabaseUrl());
  });

  it("backfills consistent identities and rejects a conflicting history without leaving seals", async () => {
    await ensureFrigoraCommercialLinesSchema();
    await seedParty("asset-a");
    await getClient().execute({
      sql: `INSERT INTO frigora_recommended_actions (
              id, workspace_id, venture_id, visit_id, work_order_id, asset_id, description,
              recommended_at, recommended_by_user_id, recorded_by_user_id, created_at, updated_at
            ) VALUES ('rec-null','ws','ven','visit-null','wo-a',NULL,'Repair',?,?,?,?,?)`,
      args: [NOW, "user-a", "user-a", NOW, NOW],
    });
    await seedQuotation("q-ok", "asset-a");
    await seedQuotation("q-null", null, "rec-null");
    await applyFrigoraQuotationIdentitySeals();
    await applyFrigoraQuotationIdentitySeals();
    const db = rawDatabase();
    try {
      assertOriginal(db, "q-ok", "asset-a");
      assertOriginal(db, "q-null", null, "rec-null");
      assert.throws(() => db.prepare("UPDATE frigora_quotations SET asset_id = 'asset-a' WHERE id = 'q-null'").run());
      assert.equal((db.prepare("SELECT asset_id FROM frigora_quotations WHERE id = 'q-null'").get() as { asset_id: string | null }).asset_id, null);
      db.prepare("UPDATE frigora_quotations SET asset_id = NULL WHERE id = 'q-null'").run();
      assert.equal((db.prepare("SELECT asset_id FROM frigora_quotation_identity_seals WHERE quotation_id = 'q-null' AND copy = 1").get() as { asset_id: string | null }).asset_id, null);
    } finally {
      db.close();
    }

    await resetPersistenceLifecycle();
    await ensureSchema();
    await ensureFrigoraCommercialLinesSchema();
    await seedParty("asset-a");
    await seedQuotation("q-conflict", "asset-a");
    await getClient().execute({
      sql: `INSERT INTO frigora_quotation_decisions (
              id, quotation_id, workspace_id, venture_id, customer_id, site_id, version_number,
              document_hash, decision, grant_id, decided_at
            ) VALUES ('dec-1','q-conflict','ws','ven','cus-b','site-a',1,'hash-issued','approved','grant-1',?)`,
      args: [NOW],
    });
    await assert.rejects(() => applyFrigoraQuotationIdentitySeals(), /corroboration conflict/);
    const after = await getClient().execute(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'frigora_quotation_identity_seals'",
    );
    assert.equal(after.rows.length, 0);
    await assert.rejects(() => applyFrigoraQuotationIdentitySeals(), /corroboration conflict/);
  });

  it("confirms rollback for a missing work order and stops after an uncertain commit", async () => {
    await ensureFrigoraCommercialLinesSchema();
    await seedParty("asset-a");
    await getClient().execute({
      sql: `INSERT INTO frigora_quotations (
              id, workspace_id, venture_id, customer_id, site_id, asset_id,
              original_work_order_id, recommended_action_id, current_version, created_at, updated_at
            ) VALUES ('q-missing','ws','ven','cus-a','site-a','asset-a','wo-missing','rec-a',1,?,?)`,
      args: [NOW, NOW],
    });
    await assert.rejects(() => applyFrigoraQuotationIdentitySeals(), /corroboration conflict/);
    await assert.rejects(() => applyFrigoraQuotationIdentitySeals(), /corroboration conflict/);

    await resetPersistenceLifecycle();
    await ensureSchema();
    await ensureFrigoraCommercialLinesSchema();
    await seedParty(null);
    await seedQuotation("q-uncertain", null);
    setIdentitySealCommitReplacementForTests(async () => {
      throw new Error("simulated commit failure");
    });
    await assert.rejects(() => applyFrigoraQuotationIdentitySeals(), /outcome is uncertain/);
    setIdentitySealCommitReplacementForTests(null);
    await assert.rejects(() => applyFrigoraQuotationIdentitySeals(), /Read-only inspection is required/);
    const rows = await getClient().execute(
      "SELECT COUNT(*) AS copies FROM sqlite_master WHERE type = 'table' AND name = 'frigora_quotation_identity_seals'",
    );
    assert.equal(Number(rows.rows[0]?.copies), 0);
  });

  it("rejects identity replacement and preserves a legitimate revision", async () => {
    await ensureFrigoraCommercialLinesSchema();
    await seedParty("asset-a");
    await seedQuotation("q-attack", "asset-a");
    await applyFrigoraQuotationIdentitySeals();
    const fields = [
      ["customer_id", "cus-b"],
      ["site_id", "site-b"],
      ["original_work_order_id", "wo-b"],
      ["asset_id", "asset-b"],
      ["recommended_action_id", "rec-b"],
    ] as const;
    const pairs: Array<Array<(typeof fields)[number]>> = [];
    for (let left = 0; left < fields.length; left += 1) {
      for (let right = left + 1; right < fields.length; right += 1) {
        const first = fields[left];
        const second = fields[right];
        if (first && second) pairs.push([first, second]);
      }
    }
    for (const foreignKeys of [0, 1]) {
      const db = rawDatabase();
      try {
        setMode(db, foreignKeys);
        const columns = (db.prepare("PRAGMA table_info(frigora_quotations)").all() as Array<{ name: string }>).map((column) => column.name);
        const attacks = [
          ...fields.map(([name, value]) => ({ label: name, set: `${name} = '${value}'` })),
          ...pairs.map((pair) => ({
            label: pair.map(([name]) => name).join("+"),
            set: pair.map(([name, value]) => `${name} = '${value}'`).join(", "),
          })),
          { label: "all-five", set: fields.map(([name, value]) => `${name} = '${value}'`).join(", ") },
        ];
        for (const attack of attacks) {
          for (const verb of ["UPDATE", "REPLACE", "INSERT OR REPLACE"]) {
            assert.throws(() => {
              if (verb === "UPDATE") {
                db.prepare(`UPDATE frigora_quotations SET ${attack.set} WHERE id = 'q-attack'`).run();
                return;
              }
              const selectList = columns.map((column) => {
                const replacement = fields.find(([name]) => attack.set.includes(`${name} =`) && column === name);
                return replacement ? `'${replacement[1]}'` : column;
              }).join(", ");
              const sql = verb === "REPLACE"
                ? `REPLACE INTO frigora_quotations (${columns.join(", ")}) SELECT ${selectList} FROM frigora_quotations WHERE id = 'q-attack'`
                : `INSERT OR REPLACE INTO frigora_quotations (${columns.join(", ")}) SELECT ${selectList} FROM frigora_quotations WHERE id = 'q-attack'`;
              db.prepare(sql).run();
            });
            assertOriginal(db, "q-attack", "asset-a");
          }
        }
        assert.throws(() => db.prepare("UPDATE frigora_quotation_identity_seals SET customer_id = 'cus-b' WHERE copy = 0").run());
        assert.throws(() => db.prepare("DELETE FROM frigora_quotation_identity_seals WHERE copy = 1").run());
        assert.throws(() => db.prepare(`
          INSERT INTO frigora_quotation_identity_seals (
            quotation_id, copy, customer_id, site_id, original_work_order_id, asset_id, recommended_action_id
          ) VALUES ('q-attack', 0, 'cus-b', 'site-a', 'wo-a', 'asset-a', 'rec-a')
        `).run());
        assertOriginal(db, "q-attack", "asset-a");
      } finally {
        db.close();
      }
    }
    const revision = rawDatabase();
    try {
      const columns = (revision.prepare("PRAGMA table_info(frigora_quotations)").all() as Array<{ name: string }>).map((column) => column.name);
      revision.prepare(`REPLACE INTO frigora_quotations (${columns.join(", ")}) SELECT ${columns.join(", ")} FROM frigora_quotations WHERE id = 'q-attack'`).run();
      assertOriginal(revision, "q-attack", "asset-a");
      revision.prepare("UPDATE frigora_quotations SET updated_at = '2026-11-11T13:00:00.000Z' WHERE id = 'q-attack'").run();
      revision.prepare(`
        INSERT INTO frigora_quotation_versions (
          quotation_id, workspace_id, venture_id, version_number, status, description,
          total_minor, currency, document_hash
        ) VALUES ('q-attack','ws','ven',2,'in_preparation','Revision',1495000,'ZAR','hash-next')
      `).run();
      revision.prepare("UPDATE frigora_quotations SET current_version = 2, updated_at = '2026-11-11T13:00:00.000Z' WHERE id = 'q-attack'").run();
      assert.equal((revision.prepare("SELECT current_version FROM frigora_quotations WHERE id = 'q-attack'").get() as { current_version: number }).current_version, 2);
      assert.equal((revision.prepare("SELECT customer_id FROM frigora_quotation_identity_seals WHERE quotation_id = 'q-attack' AND copy = 0").get() as { customer_id: string }).customer_id, "cus-a");
    } finally {
      revision.close();
    }
  });

  it("rejects a one-copy replacement and a null asset change", async () => {
    const db = rawDatabase();
    try {
      setMode(db, 0);
      db.exec(quotationIdentitySealTableSql);
      db.prepare(`
        INSERT INTO frigora_quotation_identity_seals (
          quotation_id, copy, customer_id, site_id, original_work_order_id, asset_id, recommended_action_id
        ) VALUES ('q-one', 0, 'cus-a', 'site-a', 'wo-a', NULL, 'rec-a')
      `).run();
      db.exec(quotationIdentitySealInsertTriggerSql);
      assert.throws(() => db.prepare(`
        INSERT OR REPLACE INTO frigora_quotation_identity_seals (
          quotation_id, copy, customer_id, site_id, original_work_order_id, asset_id, recommended_action_id
        ) VALUES ('q-one', 0, 'cus-b', 'site-b', 'wo-b', 'asset-b', 'rec-b')
      `).run());
      const seal = db.prepare("SELECT customer_id, asset_id FROM frigora_quotation_identity_seals WHERE quotation_id = 'q-one' AND copy = 0").get() as { customer_id: string; asset_id: string | null };
      assert.equal(seal.customer_id, "cus-a");
      assert.equal(seal.asset_id, null);
      assert.throws(() => db.prepare(`
        INSERT INTO frigora_quotation_identity_seals (
          quotation_id, copy, customer_id, site_id, original_work_order_id, asset_id, recommended_action_id
        ) VALUES ('q-one', 1, 'cus-b', 'site-a', 'wo-a', NULL, 'rec-a')
      `).run());
      assert.equal((db.prepare("SELECT COUNT(*) AS n FROM frigora_quotation_identity_seals WHERE quotation_id = 'q-one'").get() as { n: number }).n, 1);
    } finally {
      db.close();
    }
  });

  it("refuses a protected file through its normal path and through another hard-link name before createClient", async () => {
    assert.throws(() => refuseIdentitySealDatabaseUrl(`file:${PROTECTED_PATH}`), /protected database/);
    const sealSource = readFileSync(fileURLToPath(new URL("../../platform/persistence/frigora-quotation-identity-seal.ts", import.meta.url)), "utf8");
    const dbSource = readFileSync(DB_SOURCE, "utf8");
    assert.equal(sealSource.includes("createClient"), false);
    assert.equal(sealSource.includes("DROP TRIGGER"), false);
    const applyStart = dbSource.indexOf("export async function applyFrigoraQuotationIdentitySeals");
    const nextExport = dbSource.indexOf("\nexport ", applyStart + 10);
    const applyBody = dbSource.slice(applyStart, nextExport === -1 ? undefined : nextExport);
    const refuseAt = applyBody.indexOf("refuseIdentitySealDatabaseUrl");
    const guardedAt = applyBody.indexOf("createGuardedDatabaseClient");
    assert.ok(refuseAt >= 0 && guardedAt > refuseAt);
    assert.equal(/\bcreateClient\s*\(/.test(applyBody), false);

    const root = mkdtempSync(join(tmpdir(), "frg-h04-r1-hard-"));
    const original = join(root, "protected-stand-in.db");
    const alias = join(root, "alias-hardlink.db");
    const unrelated = join(root, "unrelated.db");
    const sentinel = "not-sqlite-sentinel";
    try {
      writeFileSync(original, sentinel);
      linkSync(original, alias);
      writeFileSync(unrelated, "unrelated-sentinel");
      const left = statSync(original, { bigint: true });
      const right = statSync(alias, { bigint: true });
      const other = statSync(unrelated, { bigint: true });
      assert.notEqual(original.toLowerCase(), alias.toLowerCase());
      assert.equal(left.dev, right.dev);
      assert.equal(left.ino, right.ino);
      assert.ok(left.nlink >= 2n);
      assert.notEqual(left.ino, other.ino);
      assert.equal(alias.toLowerCase().endsWith("ventureos.db"), false);
      assert.equal(alias.toLowerCase().includes("frg-r1-v2-hosted"), false);
      console.log(`hard-link identity dev=${left.dev} ino=${left.ino} nlink=${left.nlink} names=protected-stand-in.db,alias-hardlink.db`);
      addIdentitySealProtectedPathForTests(original);
      assert.throws(() => refuseIdentitySealDatabaseUrl(fileUrl(alias)), /protected database/);
      refuseIdentitySealDatabaseUrl(fileUrl(unrelated));
      assert.throws(() => assertUsablePhysicalIdentity(0n, left.ino), /cannot be established/);
      assert.throws(() => assertUsablePhysicalIdentity(left.dev, 0n), /cannot be established/);
      await resetDatabaseLifecycle(fileUrl(alias));
      addIdentitySealProtectedPathForTests(original);
      await assert.rejects(() => applyFrigoraQuotationIdentitySeals(), /protected database/);
      assert.equal(readFileSync(alias, "utf8"), sentinel);
      assert.equal(readFileSync(original, "utf8"), sentinel);
    } finally {
      addIdentitySealProtectedPathForTests(null);
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("refuses a junction alias and records when a file symlink cannot be created", async () => {
    const root = mkdtempSync(join(tmpdir(), "frg-h04-r1-junction-"));
    const realDir = join(root, "real");
    const junction = join(root, "junction");
    const sentinel = "not-sqlite-sentinel";
    try {
      mkdirSync(realDir);
      const original = join(realDir, "protected-stand-in.db");
      writeFileSync(original, sentinel);
      symlinkSync(realDir, junction, "junction");
      const alias = join(junction, "protected-stand-in.db");
      const left = statSync(original, { bigint: true });
      const right = statSync(alias, { bigint: true });
      assert.equal(left.dev, right.dev);
      assert.equal(left.ino, right.ino);
      addIdentitySealProtectedPathForTests(original);
      assert.throws(() => refuseIdentitySealDatabaseUrl(fileUrl(alias)), /protected database/);
      assert.equal(readFileSync(alias, "utf8"), sentinel);

      const link = join(root, "file-symlink.db");
      try {
        symlinkSync(original, link, "file");
      } catch (error) {
        const code = error && typeof error === "object" && "code" in error ? String(error.code) : "";
        console.log(`PLATFORM LIMITATION: file symlink creation failed with ${code}. Symlink alias refusal was not executed.`);
        assert.equal(code, "EPERM");
        return;
      }
      assert.throws(() => refuseIdentitySealDatabaseUrl(fileUrl(link)), /protected database/);
    } finally {
      addIdentitySealProtectedPathForTests(null);
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("fails closed when path metadata cannot be read", () => {
    assert.throws(
      () => refuseIdentitySealDatabaseUrl("file:C:/System Volume Information/frg-h04-r1-unreadable.db"),
      /cannot be established/,
    );
  });

  it("accepts a complete catalog on a fresh invocation and refuses a missing or malformed trigger without rewriting seals", async () => {
    await seedParty("asset-a");
    await seedQuotation("q-reentry", "asset-a");
    await applyFrigoraQuotationIdentitySeals();
    const before = rawDatabase();
    const original = identity(before, "q-reentry");
    const triggerSql = before.prepare(`
      SELECT name, sql FROM sqlite_master
      WHERE type = 'trigger' AND name IN (
        'frigora_quotations_identity_seal_update',
        'frigora_quotations_identity_seal_guard',
        'frigora_quotation_identity_seals_update',
        'frigora_quotation_identity_seals_delete',
        'frigora_quotation_identity_seals_insert'
      )
      ORDER BY name
    `).all() as Array<{ name: string; sql: string }>;
    before.close();
    assert.equal(triggerSql.length, 5);

    const url = await reopenSameDatabase();
    await applyFrigoraQuotationIdentitySeals();
    const after = rawDatabase();
    assert.deepEqual(comparable(identity(after, "q-reentry")), comparable(original));
    assert.deepEqual(after.prepare(`
      SELECT name, sql FROM sqlite_master
      WHERE type = 'trigger' AND name IN (
        'frigora_quotations_identity_seal_update',
        'frigora_quotations_identity_seal_guard',
        'frigora_quotation_identity_seals_update',
        'frigora_quotation_identity_seals_delete',
        'frigora_quotation_identity_seals_insert'
      )
      ORDER BY name
    `).all(), triggerSql);
    after.close();

    const missing = rawDatabase();
    missing.exec("DROP TRIGGER frigora_quotation_identity_seals_delete");
    missing.close();
    await reopenSameDatabase();
    await assert.rejects(() => applyFrigoraQuotationIdentitySeals(), /incomplete/);
    await assert.rejects(() => applyFrigoraQuotationIdentitySeals(), /incomplete/);
    const missingAfter = rawDatabase();
    assert.equal(missingAfter.prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE type = 'trigger' AND name = 'frigora_quotation_identity_seals_delete'").get().n, 0);
    assert.deepEqual(comparable(identity(missingAfter, "q-reentry")), comparable(original));
    missingAfter.close();

    await resetDatabaseLifecycle(url);
    const several = rawDatabase();
    several.exec("DROP TRIGGER frigora_quotations_identity_seal_update");
    several.exec("DROP TRIGGER frigora_quotations_identity_seal_guard");
    several.close();
    await reopenSameDatabase();
    await assert.rejects(() => applyFrigoraQuotationIdentitySeals(), /incomplete/);
    const severalAfter = rawDatabase();
    assert.equal(severalAfter.prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE type = 'trigger' AND name IN ('frigora_quotations_identity_seal_update', 'frigora_quotations_identity_seal_guard')").get().n, 0);
    assert.deepEqual(comparable(identity(severalAfter, "q-reentry")), comparable(original));
    severalAfter.close();
  });

  it("refuses a malformed trigger and a partial or mismatched seal pair without repairing them", async () => {
    await seedParty("asset-a");
    await seedQuotation("q-malformed", "asset-a");
    await applyFrigoraQuotationIdentitySeals();
    const before = rawDatabase();
    const original = identity(before, "q-malformed");
    const catalog = quotationIdentitySealTriggerCatalog();
    const update = catalog.find((trigger) => trigger.name === "frigora_quotation_identity_seals_update");
    assert.ok(update);
    before.exec("DROP TRIGGER frigora_quotation_identity_seals_update");
    before.exec(update.sql.replace("quotation identity seal cannot be changed", "altered trigger body"));
    before.close();
    await reopenSameDatabase();
    await assert.rejects(() => applyFrigoraQuotationIdentitySeals(), /frigora_quotation_identity_seals_update/);
    const malformed = rawDatabase();
    const stored = malformed.prepare("SELECT sql FROM sqlite_master WHERE type = 'trigger' AND name = 'frigora_quotation_identity_seals_update'").get() as { sql: string };
    assert.equal(stored.sql.includes("altered trigger body"), true);
    assert.deepEqual(comparable(identity(malformed, "q-malformed")), comparable(original));
    malformed.close();

    await resetPersistenceLifecycle();
    await ensureSchema();
    await seedParty("asset-a");
    await seedQuotation("q-partial", "asset-a");
    const partial = rawDatabase();
    partial.exec(quotationIdentitySealTableSql);
    partial.prepare(`
      INSERT INTO frigora_quotation_identity_seals (
        quotation_id, copy, customer_id, site_id, original_work_order_id, asset_id, recommended_action_id
      ) VALUES ('q-partial', 0, 'cus-a', 'site-a', 'wo-a', 'asset-a', 'rec-a')
    `).run();
    for (const trigger of quotationIdentitySealTriggerCatalog()) partial.exec(trigger.sql);
    partial.close();
    await assert.rejects(() => applyFrigoraQuotationIdentitySeals(), /q-partial/);
    const partialAfter = rawDatabase();
    assert.equal(partialAfter.prepare("SELECT COUNT(*) AS n FROM frigora_quotation_identity_seals WHERE quotation_id = 'q-partial'").get().n, 1);
    assert.equal(partialAfter.prepare("SELECT customer_id FROM frigora_quotations WHERE id = 'q-partial'").get().customer_id, "cus-a");
    partialAfter.close();

    await resetPersistenceLifecycle();
    await ensureSchema();
    await seedParty("asset-a");
    await seedQuotation("q-mismatch", "asset-a");
    const mismatch = rawDatabase();
    mismatch.exec(quotationIdentitySealTableSql);
    mismatch.exec(`
      INSERT INTO frigora_quotation_identity_seals (
        quotation_id, copy, customer_id, site_id, original_work_order_id, asset_id, recommended_action_id
      ) VALUES
        ('q-mismatch', 0, 'cus-a', 'site-a', 'wo-a', 'asset-a', 'rec-a'),
        ('q-mismatch', 1, 'cus-b', 'site-a', 'wo-a', 'asset-a', 'rec-a')
    `);
    for (const trigger of quotationIdentitySealTriggerCatalog()) mismatch.exec(trigger.sql);
    mismatch.close();
    await assert.rejects(() => applyFrigoraQuotationIdentitySeals(), /q-mismatch/);
    const mismatchAfter = rawDatabase();
    const copies = mismatchAfter.prepare("SELECT copy, customer_id FROM frigora_quotation_identity_seals WHERE quotation_id = 'q-mismatch' ORDER BY copy").all() as Array<{ copy: number; customer_id: string }>;
    assert.deepEqual(copies, [{ copy: 0, customer_id: "cus-a" }, { copy: 1, customer_id: "cus-b" }]);
    mismatchAfter.close();
  });

  it("keeps schema initialisation out of both migration functions", () => {
    const dbSource = readFileSync(DB_SOURCE, "utf8");
    const sealSource = readFileSync(
      fileURLToPath(new URL("../../platform/persistence/frigora-quotation-identity-seal.ts", import.meta.url)),
      "utf8",
    );
    const applyStart = dbSource.indexOf("export async function applyFrigoraQuotationIdentitySeals");
    const applyEnd = dbSource.indexOf("\nexport ", applyStart + 10);
    const applyBody = dbSource.slice(applyStart, applyEnd === -1 ? undefined : applyEnd);
    const migrationStart = sealSource.indexOf("export async function runQuotationIdentitySealMigration");
    const migrationEnd = sealSource.indexOf("async function assertIdentitySealPrerequisites");
    const migrationBody = sealSource.slice(migrationStart, migrationEnd);
    assert.ok(applyStart >= 0 && migrationStart >= 0 && migrationEnd > migrationStart);
    assert.equal(applyBody.includes("ensureSchema"), false);
    assert.equal(applyBody.includes("SCHEMA_GENERATION"), false);
    assert.equal(migrationBody.includes("ensureSchema"), false);
    assert.equal(migrationBody.includes("SCHEMA_GENERATION"), false);
    assert.equal(sealSource.includes("ensureSchema"), false);
    assert.equal(sealSource.includes("SCHEMA_GENERATION"), false);
    assert.match(dbSource, /const SCHEMA_GENERATION = 40;/);
    assert.equal(dbSource.includes("SCHEMA_GENERATION = 41"), false);
    const prerequisiteCall = migrationBody.indexOf("await assertIdentitySealPrerequisites(transaction)");
    const firstCreate = migrationBody.indexOf("quotationIdentitySealTableSql");
    assert.ok(prerequisiteCall >= 0 && firstCreate > prerequisiteCall);
  });

  it("fails closed before creating seals when the quotation schema is missing", async () => {
    const release = await usePrivateDatabase("missing-tables");
    try {
      await assertPrerequisiteFailure(/frigora_quotations(?!\.)/);
      await assertNoSealObjects();
      await assertPrerequisiteFailure(/frigora_recommended_actions/);
      assert.equal(sealReadyFlag(), undefined);
      assert.equal(sealUncertainFlag(), undefined);
    } finally {
      await release();
    }
  });

  it("fails closed before the first seal create when a required column is missing", async () => {
    const release = await usePrivateDatabase("missing-column");
    try {
      await createPrerequisiteTablesWithout("frigora_quotations.asset_id");
      const error = await prerequisiteError();
      assert.equal(error.message, `${IDENTITY_SEAL_PREREQUISITE_MESSAGE} frigora_quotations.asset_id`);
      await assertNoSealObjects();
      const again = await prerequisiteError();
      assert.equal(again.message, error.message);
      assert.equal(sealReadyFlag(), undefined);
      assert.equal(sealUncertainFlag(), undefined);
    } finally {
      await release();
    }
  });

  it("installs both seal copies and still allows a current-version revision", async () => {
    await ensureFrigoraCommercialLinesSchema();
    await seedParty("asset-a");
    await getClient().execute({
      sql: `INSERT INTO frigora_recommended_actions (
              id, workspace_id, venture_id, visit_id, work_order_id, asset_id, description,
              recommended_at, recommended_by_user_id, recorded_by_user_id, created_at, updated_at
            ) VALUES ('rec-null','ws','ven','visit-null','wo-a',NULL,'Repair',?,?,?,?,?)`,
      args: [NOW, "user-a", "user-a", NOW, NOW],
    });
    await seedQuotation("q-valued", "asset-a");
    await seedQuotation("q-empty", null, "rec-null");
    await applyFrigoraQuotationIdentitySeals();
    const url = await reopenSameDatabase();
    await applyFrigoraQuotationIdentitySeals();
    const db = rawDatabase();
    try {
      assertOriginal(db, "q-valued", "asset-a");
      assertOriginal(db, "q-empty", null, "rec-null");
      const triggers = db.prepare(`
        SELECT name FROM sqlite_master
        WHERE type = 'trigger' AND name IN (
          'frigora_quotations_identity_seal_update',
          'frigora_quotations_identity_seal_guard',
          'frigora_quotation_identity_seals_update',
          'frigora_quotation_identity_seals_delete',
          'frigora_quotation_identity_seals_insert'
        )
      `).all();
      assert.equal(triggers.length, 5);
      setMode(db, 0);
      assert.throws(() => db.prepare("UPDATE frigora_quotations SET asset_id = NULL WHERE id = 'q-valued'").run());
      assert.equal((db.prepare("SELECT asset_id FROM frigora_quotations WHERE id = 'q-valued'").get() as { asset_id: string | null }).asset_id, "asset-a");
      assert.throws(() => db.prepare("UPDATE frigora_quotations SET asset_id = 'asset-a' WHERE id = 'q-empty'").run());
      assert.equal((db.prepare("SELECT asset_id FROM frigora_quotations WHERE id = 'q-empty'").get() as { asset_id: string | null }).asset_id, null);
      for (const [column, value] of [
        ["customer_id", "cus-b"],
        ["site_id", "site-b"],
        ["original_work_order_id", "wo-b"],
        ["recommended_action_id", "rec-b"],
      ] as const) {
        assert.throws(() => db.prepare(`UPDATE frigora_quotations SET ${column} = '${value}' WHERE id = 'q-valued'`).run());
      }
      assert.throws(() => db.prepare(`
        INSERT INTO frigora_quotation_identity_seals (
          quotation_id, copy, customer_id, site_id, original_work_order_id, asset_id, recommended_action_id
        ) VALUES ('q-valued', 0, 'cus-b', 'site-a', 'wo-a', 'asset-a', 'rec-a')
      `).run());
      assertOriginal(db, "q-valued", "asset-a");
      db.prepare(`
        INSERT INTO frigora_quotation_versions (
          quotation_id, workspace_id, venture_id, version_number, status, description,
          total_minor, currency, document_hash
        ) VALUES ('q-valued','ws','ven',2,'in_preparation','Revision',1495000,'ZAR','hash-next')
      `).run();
      db.prepare("UPDATE frigora_quotations SET current_version = 2 WHERE id = 'q-valued'").run();
      assert.equal((db.prepare("SELECT current_version FROM frigora_quotations WHERE id = 'q-valued'").get() as { current_version: number }).current_version, 2);
      assert.equal((db.prepare("SELECT customer_id, asset_id FROM frigora_quotation_identity_seals WHERE quotation_id = 'q-valued' AND copy = 0").get() as { customer_id: string; asset_id: string }).customer_id, "cus-a");
      assert.equal((db.prepare("SELECT asset_id FROM frigora_quotation_identity_seals WHERE quotation_id = 'q-valued' AND copy = 1").get() as { asset_id: string }).asset_id, "asset-a");
    } finally {
      db.close();
    }
    assert.equal(url, getDatabaseUrl());
  });
});

function fileUrl(filePath: string): string {
  return `file:${filePath.replaceAll("\\", "/")}`;
}

async function usePrivateDatabase(label: string): Promise<() => Promise<void>> {
  const root = mkdtempSync(join(tmpdir(), `frg-cd01-imp-${label}-`));
  const url = fileUrl(join(root, "isolated.db"));
  if (url.toLowerCase().includes("ventureos.db") || url.toLowerCase().includes("frg-r1-v2-hosted")) {
    throw new Error("Refusing a protected database");
  }
  await resetDatabaseLifecycle(url);
  return async () => {
    await resetPersistenceLifecycle();
    try {
      const { setFlagsFromString } = await import("node:v8");
      const { runInNewContext } = await import("node:vm");
      setFlagsFromString("--expose-gc");
      const gc = runInNewContext("gc");
      if (typeof gc === "function") gc();
    } catch {
      // Closing the client is the required step. GC only helps Windows release it.
    }
    for (let attempt = 1; attempt <= 8; attempt += 1) {
      try {
        rmSync(root, { recursive: true, force: true });
        return;
      } catch (error) {
        const code = error && typeof error === "object" && "code" in error ? error.code : undefined;
        if ((code !== "EPERM" && code !== "EBUSY") || attempt === 8) throw error;
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
    }
  };
}

function sealReadyFlag(): string | undefined {
  return (globalThis as { __vosQuotationIdentitySealsReady?: string }).__vosQuotationIdentitySealsReady;
}

function sealUncertainFlag(): boolean | undefined {
  return (globalThis as { __vosQuotationIdentitySealUncertain?: boolean }).__vosQuotationIdentitySealUncertain;
}

async function prerequisiteError(): Promise<Error> {
  try {
    await applyFrigoraQuotationIdentitySeals();
  } catch (error) {
    assert.ok(error instanceof Error);
    assert.equal(error.message.includes(IDENTITY_SEAL_PREREQUISITE_MESSAGE), true);
    assert.equal(error.message.includes("uncertain"), false);
    assert.equal(error.message.includes("corroboration"), false);
    assert.equal(error.message.includes("incomplete"), false);
    return error;
  }
  assert.fail("identity seal migration succeeded without its prerequisite schema");
}

async function assertPrerequisiteFailure(detail: RegExp): Promise<void> {
  const error = await prerequisiteError();
  assert.match(error.message, detail);
}

async function assertNoSealObjects(): Promise<void> {
  const rows = await getClient().execute(
    `SELECT name FROM sqlite_master
     WHERE name = 'frigora_quotation_identity_seals'
        OR name LIKE 'frigora_quotation_identity_seal%'
        OR name LIKE 'frigora_quotations_identity_seal%'`,
  );
  assert.equal(rows.rows.length, 0);
}

async function createPrerequisiteTablesWithout(missingColumn: "frigora_quotations.asset_id"): Promise<void> {
  assert.equal(missingColumn, "frigora_quotations.asset_id");
  const statements = [
    `CREATE TABLE frigora_quotations (
      id TEXT, customer_id TEXT, site_id TEXT, original_work_order_id TEXT,
      recommended_action_id TEXT, workspace_id TEXT, venture_id TEXT
    )`,
    `CREATE TABLE frigora_quotation_decisions (
      quotation_id TEXT, customer_id TEXT, site_id TEXT, workspace_id TEXT, venture_id TEXT
    )`,
    `CREATE TABLE frigora_quotation_decision_grants (
      quotation_id TEXT, customer_id TEXT, site_id TEXT, workspace_id TEXT, venture_id TEXT
    )`,
    `CREATE TABLE frigora_work_orders (
      id TEXT, customer_id TEXT, site_id TEXT, workspace_id TEXT, venture_id TEXT
    )`,
    `CREATE TABLE frigora_sites (
      id TEXT, customer_id TEXT, workspace_id TEXT, venture_id TEXT
    )`,
    `CREATE TABLE frigora_customers (
      id TEXT, workspace_id TEXT, venture_id TEXT
    )`,
    `CREATE TABLE frigora_assets (
      id TEXT, site_id TEXT, workspace_id TEXT, venture_id TEXT
    )`,
    `CREATE TABLE frigora_recommended_actions (
      id TEXT, work_order_id TEXT, asset_id TEXT, workspace_id TEXT, venture_id TEXT
    )`,
  ];
  for (const statement of statements) {
    await getClient().execute(statement);
  }
}

async function reopenSameDatabase(): Promise<string> {
  const url = getDatabaseUrl();
  if (url.toLowerCase().includes("ventureos.db") || url.toLowerCase().includes("frg-r1-v2-hosted")) {
    throw new Error("Refusing a protected database");
  }
  await resetDatabaseLifecycle(url);
  return url;
}
