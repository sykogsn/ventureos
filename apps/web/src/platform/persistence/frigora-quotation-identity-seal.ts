import { realpathSync, statSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import type { Transaction } from "@libsql/client";

const PROTECTED_DATABASE_PATH = resolve(
  process.cwd(),
  "data",
  "ventureos.db",
);
const HOSTED_VERIFICATION_MARKER = "frg-r1-v2-hosted";
const HOSTED_VERIFICATION_DATABASE_PATH = join(
  tmpdir(),
  "frg-r1-v2-hosted-f5b0f89ed3e94d66859cb496f1ef3268",
  "isolated.db",
);
const additionalProtectedPathsForTests = new Set<string>();

const SEAL_TRIGGER_NAMES = [
  "frigora_quotations_identity_seal_update",
  "frigora_quotations_identity_seal_guard",
  "frigora_quotation_identity_seals_update",
  "frigora_quotation_identity_seals_delete",
  "frigora_quotation_identity_seals_insert",
] as const;

export const quotationIdentitySealTableSql = `
  CREATE TABLE IF NOT EXISTS frigora_quotation_identity_seals (
    quotation_id TEXT NOT NULL,
    copy INTEGER NOT NULL CHECK (copy IN (0, 1)),
    customer_id TEXT NOT NULL,
    site_id TEXT NOT NULL,
    original_work_order_id TEXT NOT NULL,
    asset_id TEXT,
    recommended_action_id TEXT NOT NULL,
    PRIMARY KEY (quotation_id, copy)
  )
`;

const HEADER_UPDATE_TRIGGER = `
  CREATE TRIGGER frigora_quotations_identity_seal_update
  BEFORE UPDATE OF customer_id, site_id, original_work_order_id,
                   asset_id, recommended_action_id
  ON frigora_quotations
  WHEN NEW.customer_id IS NOT OLD.customer_id
    OR NEW.site_id IS NOT OLD.site_id
    OR NEW.original_work_order_id IS NOT OLD.original_work_order_id
    OR NEW.asset_id IS NOT OLD.asset_id
    OR NEW.recommended_action_id IS NOT OLD.recommended_action_id
  BEGIN
    SELECT RAISE(ABORT, 'quotation identity cannot be changed');
  END
`;

const HEADER_INSERT_TRIGGER = `
  CREATE TRIGGER frigora_quotations_identity_seal_guard
  BEFORE INSERT ON frigora_quotations
  BEGIN
    SELECT RAISE(ABORT, 'quotation identity cannot be changed')
    WHERE (
      SELECT COUNT(*) FROM frigora_quotation_identity_seals
      WHERE quotation_id = NEW.id
    ) NOT IN (0, 2);

    SELECT RAISE(ABORT, 'quotation identity cannot be changed')
    WHERE EXISTS (
      SELECT 1
      FROM frigora_quotation_identity_seals a
      JOIN frigora_quotation_identity_seals b
        ON b.quotation_id = a.quotation_id AND b.copy <> a.copy
      WHERE a.quotation_id = NEW.id
        AND (
          a.customer_id IS NOT b.customer_id
          OR a.site_id IS NOT b.site_id
          OR a.original_work_order_id IS NOT b.original_work_order_id
          OR a.asset_id IS NOT b.asset_id
          OR a.recommended_action_id IS NOT b.recommended_action_id
        )
    );

    SELECT RAISE(ABORT, 'quotation identity cannot be changed')
    WHERE EXISTS (
      SELECT 1 FROM frigora_quotation_identity_seals existing
      WHERE existing.quotation_id = NEW.id
        AND (
          existing.customer_id IS NOT NEW.customer_id
          OR existing.site_id IS NOT NEW.site_id
          OR existing.original_work_order_id IS NOT NEW.original_work_order_id
          OR existing.asset_id IS NOT NEW.asset_id
          OR existing.recommended_action_id IS NOT NEW.recommended_action_id
        )
    );

    INSERT INTO frigora_quotation_identity_seals (
      quotation_id, copy, customer_id, site_id, original_work_order_id,
      asset_id, recommended_action_id
    )
    SELECT NEW.id, 0, NEW.customer_id, NEW.site_id, NEW.original_work_order_id,
           NEW.asset_id, NEW.recommended_action_id
    WHERE (
      SELECT COUNT(*) FROM frigora_quotation_identity_seals
      WHERE quotation_id = NEW.id
    ) = 0;

    INSERT INTO frigora_quotation_identity_seals (
      quotation_id, copy, customer_id, site_id, original_work_order_id,
      asset_id, recommended_action_id
    )
    SELECT NEW.id, 1, NEW.customer_id, NEW.site_id, NEW.original_work_order_id,
           NEW.asset_id, NEW.recommended_action_id
    WHERE (
      SELECT COUNT(*) FROM frigora_quotation_identity_seals
      WHERE quotation_id = NEW.id AND copy = 0
    ) = 1
      AND (
        SELECT COUNT(*) FROM frigora_quotation_identity_seals
        WHERE quotation_id = NEW.id AND copy = 1
      ) = 0;
  END
`;

const SEAL_UPDATE_TRIGGER = `
  CREATE TRIGGER frigora_quotation_identity_seals_update
  BEFORE UPDATE ON frigora_quotation_identity_seals
  BEGIN
    SELECT RAISE(ABORT, 'quotation identity seal cannot be changed');
  END
`;

const SEAL_DELETE_TRIGGER = `
  CREATE TRIGGER frigora_quotation_identity_seals_delete
  BEFORE DELETE ON frigora_quotation_identity_seals
  BEGIN
    SELECT RAISE(ABORT, 'quotation identity seal cannot be changed');
  END
`;

export const quotationIdentitySealInsertTriggerSql = `
  CREATE TRIGGER frigora_quotation_identity_seals_insert
  BEFORE INSERT ON frigora_quotation_identity_seals
  WHEN EXISTS (
    SELECT 1
    FROM frigora_quotation_identity_seals existing
    WHERE existing.quotation_id = NEW.quotation_id
      AND existing.copy = NEW.copy
  )
  OR EXISTS (
    SELECT 1
    FROM frigora_quotation_identity_seals other
    WHERE other.quotation_id = NEW.quotation_id
      AND other.copy <> NEW.copy
      AND (
        other.customer_id IS NOT NEW.customer_id
        OR other.site_id IS NOT NEW.site_id
        OR other.original_work_order_id IS NOT NEW.original_work_order_id
        OR other.asset_id IS NOT NEW.asset_id
        OR other.recommended_action_id IS NOT NEW.recommended_action_id
      )
  )
  BEGIN
    SELECT RAISE(ABORT, 'quotation identity seal cannot be changed');
  END
`;

export function quotationIdentitySealTriggerCatalog(): ReadonlyArray<{ name: string; sql: string }> {
  return [
    { name: "frigora_quotations_identity_seal_update", sql: HEADER_UPDATE_TRIGGER },
    { name: "frigora_quotations_identity_seal_guard", sql: HEADER_INSERT_TRIGGER },
    { name: "frigora_quotation_identity_seals_update", sql: SEAL_UPDATE_TRIGGER },
    { name: "frigora_quotation_identity_seals_delete", sql: SEAL_DELETE_TRIGGER },
    { name: "frigora_quotation_identity_seals_insert", sql: quotationIdentitySealInsertTriggerSql },
  ];
}

const CORROBORATION_SQL = `
  SELECT quotation_id, conflict_class FROM (
    SELECT q.id AS quotation_id, 'decision_customer_site' AS conflict_class
    FROM frigora_quotations q
    JOIN frigora_quotation_decisions d ON d.quotation_id = q.id
    WHERE d.customer_id IS NOT q.customer_id
       OR d.site_id IS NOT q.site_id
       OR d.workspace_id IS NOT q.workspace_id
       OR d.venture_id IS NOT q.venture_id
    UNION ALL
    SELECT q.id, 'grant_customer_site'
    FROM frigora_quotations q
    JOIN frigora_quotation_decision_grants g ON g.quotation_id = q.id
    WHERE g.customer_id IS NOT q.customer_id
       OR g.site_id IS NOT q.site_id
       OR g.workspace_id IS NOT q.workspace_id
       OR g.venture_id IS NOT q.venture_id
    UNION ALL
    SELECT q.id, 'work_order_customer_site'
    FROM frigora_quotations q
    LEFT JOIN frigora_work_orders w ON w.id = q.original_work_order_id
    WHERE w.id IS NULL
       OR w.customer_id IS NOT q.customer_id
       OR w.site_id IS NOT q.site_id
       OR w.workspace_id IS NOT q.workspace_id
       OR w.venture_id IS NOT q.venture_id
    UNION ALL
    SELECT q.id, 'site_customer'
    FROM frigora_quotations q
    LEFT JOIN frigora_sites s ON s.id = q.site_id
    WHERE s.id IS NULL
       OR s.customer_id IS NOT q.customer_id
       OR s.workspace_id IS NOT q.workspace_id
       OR s.venture_id IS NOT q.venture_id
    UNION ALL
    SELECT q.id, 'missing_customer'
    FROM frigora_quotations q
    LEFT JOIN frigora_customers c ON c.id = q.customer_id
    WHERE c.id IS NULL
       OR c.workspace_id IS NOT q.workspace_id
       OR c.venture_id IS NOT q.venture_id
    UNION ALL
    SELECT q.id, 'asset_site'
    FROM frigora_quotations q
    WHERE q.asset_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM frigora_assets a
        WHERE a.id = q.asset_id
          AND a.site_id IS q.site_id
          AND a.workspace_id IS q.workspace_id
          AND a.venture_id IS q.venture_id
      )
    UNION ALL
    SELECT q.id, 'recommended_action_work_order_asset'
    FROM frigora_quotations q
    LEFT JOIN frigora_recommended_actions r ON r.id = q.recommended_action_id
    WHERE r.id IS NULL
       OR r.work_order_id IS NOT q.original_work_order_id
       OR r.asset_id IS NOT q.asset_id
       OR r.workspace_id IS NOT q.workspace_id
       OR r.venture_id IS NOT q.venture_id
  )
  ORDER BY quotation_id, conflict_class
`;

const INSERT_SEAL_COPY_0 = `
  INSERT INTO frigora_quotation_identity_seals (
    quotation_id, copy, customer_id, site_id, original_work_order_id,
    asset_id, recommended_action_id
  )
  SELECT q.id, 0, q.customer_id, q.site_id, q.original_work_order_id,
         q.asset_id, q.recommended_action_id
  FROM frigora_quotations q
  WHERE NOT EXISTS (
    SELECT 1 FROM frigora_quotation_identity_seals existing
    WHERE existing.quotation_id = q.id
  )
`;

const INSERT_SEAL_COPY_1 = `
  INSERT INTO frigora_quotation_identity_seals (
    quotation_id, copy, customer_id, site_id, original_work_order_id,
    asset_id, recommended_action_id
  )
  SELECT q.id, 1, q.customer_id, q.site_id, q.original_work_order_id,
         q.asset_id, q.recommended_action_id
  FROM frigora_quotations q
  WHERE EXISTS (
    SELECT 1 FROM frigora_quotation_identity_seals existing
    WHERE existing.quotation_id = q.id AND existing.copy = 0
  )
    AND NOT EXISTS (
      SELECT 1 FROM frigora_quotation_identity_seals existing
      WHERE existing.quotation_id = q.id AND existing.copy = 1
    )
`;

export const IDENTITY_SEAL_UNCERTAIN_MESSAGE =
  "Quotation identity seal migration outcome is uncertain. Read-only inspection is required before another attempt.";

export const IDENTITY_SEAL_PREREQUISITE_MESSAGE =
  "Quotation identity seal prerequisites are absent.";

const IDENTITY_SEAL_PREREQUISITES = [
  {
    table: "frigora_quotations",
    columns: [
      "id",
      "customer_id",
      "site_id",
      "original_work_order_id",
      "asset_id",
      "recommended_action_id",
      "workspace_id",
      "venture_id",
    ],
  },
  {
    table: "frigora_quotation_decisions",
    columns: ["quotation_id", "customer_id", "site_id", "workspace_id", "venture_id"],
  },
  {
    table: "frigora_quotation_decision_grants",
    columns: ["quotation_id", "customer_id", "site_id", "workspace_id", "venture_id"],
  },
  {
    table: "frigora_work_orders",
    columns: ["id", "customer_id", "site_id", "workspace_id", "venture_id"],
  },
  {
    table: "frigora_sites",
    columns: ["id", "customer_id", "workspace_id", "venture_id"],
  },
  {
    table: "frigora_customers",
    columns: ["id", "workspace_id", "venture_id"],
  },
  {
    table: "frigora_assets",
    columns: ["id", "site_id", "workspace_id", "venture_id"],
  },
  {
    table: "frigora_recommended_actions",
    columns: ["id", "work_order_id", "asset_id", "workspace_id", "venture_id"],
  },
] as const;

/** Adds a disposable fixture. It cannot remove the built-in protected files. */
export function addIdentitySealProtectedPathForTests(filePath: string | null): void {
  if (filePath === null) {
    additionalProtectedPathsForTests.clear();
    return;
  }
  additionalProtectedPathsForTests.add(resolve(filePath));
}

export function assertUsablePhysicalIdentity(dev: bigint, ino: bigint): void {
  if (dev === 0n || ino === 0n) {
    throw new Error("Quotation identity seal database identity cannot be established.");
  }
}

export function refuseIdentitySealDatabaseUrl(url: string): void {
  const lexical = lexicalFilePath(url);
  if (isProtectedPath(lexical)) {
    throw new Error("Refusing quotation identity seal migration for a protected database.");
  }
  let finalPath: string;
  try {
    finalPath = existingOrParentPath(lexical);
  } catch {
    throw new Error("Quotation identity seal database identity cannot be established.");
  }
  if (isProtectedPath(finalPath)) {
    throw new Error("Refusing quotation identity seal migration for a protected database.");
  }
  refusePhysicallyProtectedFile(finalPath);
}

export async function runQuotationIdentitySealMigration(transaction: Transaction): Promise<void> {
  await assertIdentitySealPrerequisites(transaction);
  const existing = await transaction.execute(
    "SELECT 1 AS present FROM sqlite_master WHERE type = 'table' AND name = 'frigora_quotation_identity_seals'",
  );
  const tableExists = existing.rows.length > 0;
  if (!tableExists) {
    await transaction.execute(quotationIdentitySealTableSql);
  } else {
    await assertTriggerDefinitions(transaction);
    await assertSealRowsAreComplete(transaction);
  }
  await assertCorroboration(transaction);
  await transaction.execute(INSERT_SEAL_COPY_0);
  await transaction.execute(INSERT_SEAL_COPY_1);
  if (!tableExists) {
    await transaction.execute(HEADER_UPDATE_TRIGGER);
    await transaction.execute(HEADER_INSERT_TRIGGER);
    await transaction.execute(SEAL_UPDATE_TRIGGER);
    await transaction.execute(SEAL_DELETE_TRIGGER);
    await transaction.execute(quotationIdentitySealInsertTriggerSql);
  }
  await assertInstalled(transaction);
}

async function assertIdentitySealPrerequisites(transaction: Transaction): Promise<void> {
  const missing: string[] = [];
  for (const requirement of IDENTITY_SEAL_PREREQUISITES) {
    const rows = await transaction.execute(
      `SELECT name FROM pragma_table_info('${requirement.table}')`,
    );
    const present = new Set(rows.rows.map((row) => String(row.name)));
    if (present.size === 0) {
      missing.push(requirement.table);
      continue;
    }
    for (const column of requirement.columns) {
      if (!present.has(column)) missing.push(`${requirement.table}.${column}`);
    }
  }
  if (missing.length > 0) {
    throw new Error(`${IDENTITY_SEAL_PREREQUISITE_MESSAGE} ${missing.join(", ")}`);
  }
}

function lexicalFilePath(url: string): string {
  if (!url.startsWith("file:") || url === "file::memory:" || url.startsWith("file::memory:")) {
    throw new Error("Quotation identity seal database identity cannot be established.");
  }
  if (url.includes("#")) {
    throw new Error("Quotation identity seal database identity cannot be established.");
  }
  const queryAt = url.indexOf("?");
  const beforeQuery = queryAt === -1 ? url : url.slice(0, queryAt);
  if (queryAt !== -1) {
    for (const part of url.slice(queryAt + 1).split("&")) {
      if (part === "") continue;
      const key = decodeQueryComponent(part.split("=", 1)[0] ?? "");
      if (key !== "authToken" && key !== "tls") {
        throw new Error("Quotation identity seal database identity cannot be established.");
      }
    }
  }
  let pathText = beforeQuery.slice("file:".length);
  if (pathText.startsWith("//")) {
    const authorityAndPath = pathText.slice(2);
    const slash = authorityAndPath.indexOf("/");
    const authority = slash === -1 ? authorityAndPath : authorityAndPath.slice(0, slash);
    const host = authority.replace(/:\d+$/, "").toLowerCase();
    if (host !== "" && host !== "localhost") {
      throw new Error("Quotation identity seal database identity cannot be established.");
    }
    pathText = slash === -1 ? "" : authorityAndPath.slice(slash);
  }
  let decoded: string;
  try {
    decoded = decodeURIComponent(pathText);
  } catch {
    throw new Error("Quotation identity seal database identity cannot be established.");
  }
  if (decoded.includes("file:") || decoded.includes("?") || decoded.includes("#")) {
    throw new Error("Quotation identity seal database identity cannot be established.");
  }
  return resolve(decoded);
}

function decodeQueryComponent(value: string): string {
  try {
    return decodeURIComponent(value.replaceAll("+", " "));
  } catch {
    throw new Error("Quotation identity seal database identity cannot be established.");
  }
}

function existingOrParentPath(candidate: string): string {
  try {
    return realpathSync.native(candidate);
  } catch (error) {
    const code = error && typeof error === "object" && "code" in error ? error.code : undefined;
    if (code !== "ENOENT") {
      throw error;
    }
    const parent = dirname(candidate);
    if (parent === candidate) {
      throw error;
    }
    return resolve(realpathSync.native(parent), basename(candidate));
  }
}

function isProtectedPath(candidate: string): boolean {
  const folded = candidate.toLowerCase();
  const protectedPath = PROTECTED_DATABASE_PATH.toLowerCase();
  return folded === protectedPath
    || folded.endsWith("\\ventureos.db")
    || folded.endsWith("/ventureos.db")
    || folded.includes(HOSTED_VERIFICATION_MARKER);
}

type PhysicalFileIdentity = { dev: bigint; ino: bigint };

function readPhysicalIdentity(filePath: string): PhysicalFileIdentity | null {
  let stats;
  try {
    stats = statSync(filePath, { bigint: true });
  } catch (error) {
    const code = error && typeof error === "object" && "code" in error ? String(error.code) : "";
    if (code === "ENOENT") return null;
    throw new Error("Quotation identity seal database identity cannot be established.");
  }
  assertUsablePhysicalIdentity(stats.dev, stats.ino);
  return { dev: stats.dev, ino: stats.ino };
}

function refusePhysicallyProtectedFile(candidatePath: string): void {
  const candidate = readPhysicalIdentity(candidatePath);
  if (candidate === null) return;
  const hostedDirectory = dirname(HOSTED_VERIFICATION_DATABASE_PATH);
  const protectedPaths = [
    PROTECTED_DATABASE_PATH,
    HOSTED_VERIFICATION_DATABASE_PATH,
    hostedDirectory,
    ...additionalProtectedPathsForTests,
  ];
  for (const protectedPath of protectedPaths) {
    const protectedIdentity = readPhysicalIdentity(protectedPath);
    if (protectedIdentity === null) continue;
    if (candidate.dev === protectedIdentity.dev && candidate.ino === protectedIdentity.ino) {
      throw new Error("Refusing quotation identity seal migration for a protected database.");
    }
  }
  const parentIdentity = readPhysicalIdentity(dirname(candidatePath));
  const hostedDirectoryIdentity = readPhysicalIdentity(hostedDirectory);
  if (
    parentIdentity
    && hostedDirectoryIdentity
    && parentIdentity.dev === hostedDirectoryIdentity.dev
    && parentIdentity.ino === hostedDirectoryIdentity.ino
  ) {
    throw new Error("Refusing quotation identity seal migration for a protected database.");
  }
}

function normalizeTriggerSql(sql: string): string {
  return sql.replace(/\s+/g, " ").trim().replace(/;$/, "").toLowerCase();
}

async function assertTriggerDefinitions(transaction: Transaction): Promise<void> {
  const expected = quotationIdentitySealTriggerCatalog();
  const names = expected.map((trigger) => trigger.name);
  if (names.length !== SEAL_TRIGGER_NAMES.length || names.some((name, index) => name !== SEAL_TRIGGER_NAMES[index])) {
    throw new Error("Quotation identity seal installation is incomplete.");
  }
  const rows = await transaction.execute({
    sql: `SELECT name, sql FROM sqlite_master WHERE type = 'trigger' AND name IN (${names.map(() => "?").join(", ")})`,
    args: names,
  });
  if (rows.rows.length !== names.length) {
    throw new Error("Quotation identity seal installation is incomplete.");
  }
  const byName = new Map(rows.rows.map((row) => [String(row.name), String(row.sql ?? "")]));
  for (const trigger of expected) {
    const actual = byName.get(trigger.name);
    if (actual === undefined || normalizeTriggerSql(actual) !== normalizeTriggerSql(trigger.sql)) {
      throw new Error(`Quotation identity seal installation is incomplete: ${trigger.name}`);
    }
  }
}

async function assertSealRowsAreComplete(transaction: Transaction): Promise<void> {
  const partial = await transaction.execute(`
    SELECT quotation_id
    FROM frigora_quotation_identity_seals
    GROUP BY quotation_id
    HAVING COUNT(*) <> 2
  `);
  const mismatched = await transaction.execute(`
    SELECT a.quotation_id
    FROM frigora_quotation_identity_seals a
    JOIN frigora_quotation_identity_seals b
      ON b.quotation_id = a.quotation_id AND b.copy <> a.copy
    WHERE a.customer_id IS NOT b.customer_id
       OR a.site_id IS NOT b.site_id
       OR a.original_work_order_id IS NOT b.original_work_order_id
       OR a.asset_id IS NOT b.asset_id
       OR a.recommended_action_id IS NOT b.recommended_action_id
  `);
  const headerMismatch = await transaction.execute(`
    SELECT s.quotation_id
    FROM frigora_quotation_identity_seals s
    JOIN frigora_quotations q ON q.id = s.quotation_id
    WHERE s.customer_id IS NOT q.customer_id
       OR s.site_id IS NOT q.site_id
       OR s.original_work_order_id IS NOT q.original_work_order_id
       OR s.asset_id IS NOT q.asset_id
       OR s.recommended_action_id IS NOT q.recommended_action_id
  `);
  const ids = [...partial.rows, ...mismatched.rows, ...headerMismatch.rows]
    .map((row) => String(row.quotation_id));
  if (ids.length > 0) {
    throw new Error(`Quotation identity seal installation is incomplete: ${uniqueIds(ids).join(", ")}`);
  }
}

async function assertCorroboration(transaction: Transaction): Promise<void> {
  const conflicts = await transaction.execute(CORROBORATION_SQL);
  if (conflicts.rows.length === 0) return;
  const summary = conflicts.rows.slice(0, 20).map((row) => `${String(row.quotation_id)}:${String(row.conflict_class)}`);
  throw new Error(`Quotation identity seal corroboration conflict: ${summary.join(", ")}`);
}

async function assertInstalled(transaction: Transaction): Promise<void> {
  await assertTriggerDefinitions(transaction);
  const missing = await transaction.execute(`
    SELECT q.id AS quotation_id
    FROM frigora_quotations q
    LEFT JOIN (
      SELECT quotation_id, COUNT(*) AS copies
      FROM frigora_quotation_identity_seals
      GROUP BY quotation_id
    ) seals ON seals.quotation_id = q.id
    WHERE seals.copies IS NULL OR seals.copies <> 2
  `);
  if (missing.rows.length > 0) {
    throw new Error(`Quotation identity seal installation is incomplete: ${missing.rows.map((row) => String(row.quotation_id)).join(", ")}`);
  }
}

function uniqueIds(ids: string[]): string[] {
  return [...new Set(ids)].slice(0, 20);
}
