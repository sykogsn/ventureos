import { existsSync, mkdirSync } from "node:fs";
import { unlink } from "node:fs/promises";
import { basename, dirname, join, relative, resolve } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { setFlagsFromString } from "node:v8";
import { runInNewContext } from "node:vm";
import type { Client, Transaction } from "@libsql/client";
import { drizzle, type LibSQLDatabase } from "drizzle-orm/libsql";
import {
  ProductionProcessError,
  assertProductionDatabaseReadyToOpen,
} from "@/platform/runtime/production-process-contract";
import { runBeforePersistenceReset } from "./before-reset";
import { applyFrigoraCommercialCatalogueSchema } from "./frigora-commercial-catalogue-ddl";
import { applyFrigoraCommercialLinesSchema } from "./frigora-commercial-lines-ddl";
import {
  IDENTITY_SEAL_UNCERTAIN_MESSAGE,
  addIdentitySealProtectedPathForTests,
  refuseIdentitySealDatabaseUrl,
  runQuotationIdentitySealMigration,
} from "./frigora-quotation-identity-seal";
import { ensureFrigoraStockSchema } from "./frigora-stock-ddl";
import {
  PERSISTENT_SCHEMA_GENERATION,
  PersistentDevelopmentDatabaseError,
  beginPersistentDatabaseMaintenance,
  createGuardedDatabaseClient,
  endPersistentDatabaseMaintenance,
  persistentDevelopmentDatabaseEnabled,
  recheckPersistentDevelopmentDatabase,
  resolvePersistentDevelopmentDatabase,
} from "./persistent-dev-database";
import * as schema from "./schema";

const DEFAULT_URL = "file:./data/ventureos.db";

export type Database = LibSQLDatabase<typeof schema>;

// Generation 33 is the uncommitted Frigora quotation candidate on the generation-32 baseline.
// It includes quotation tables, decision grants, approved/declined version status,
// and the commercial labour, travel, and tax snapshot.
// Generation 34 adds the quotation delivery outbox and its attempt history.
// Generation 35 adds append-only supervised contact verification. It does not
// rebuild quotation tables or reuse email_verified_at.
// Generation 36 adds one customer-delivery operation per quotation version and
// designated contact. It does not rebuild quotation tables or the issue outbox.
// Generation 37 adds a recoverable claim owner and lease on that delivery row.
// It does not rebuild quotation tables, the issue outbox, or delivery history.
// Generation 38 adds the provider-request hold deadline on that same row.
// It does not rebuild quotation tables, the issue outbox, or delivery history.
// Generation 39 adds nullable payload_read_failure on that same row.
// It does not rebuild quotation tables, the issue outbox, or delivery history.
// Generation 40 remains the core schema generation. It does not allocate 41.
// ensureSchema does not create stock tables, stock triggers, or the stock
// supporting indexes on ventures and part references. Call
// ensureFrigoraStockSchemaReady when stock storage is required. That function
// applies the unchanged generation-40 stock DDL only after this core schema
// has succeeded. It does not change SCHEMA_GENERATION and does not rebuild
// quotation, contact, delivery, or part-usage tables.
// Commercial catalogue tables are not part of generation 40. Call
// ensureFrigoraCommercialCatalogueSchema when catalogue storage is required.
// That path does not initialise stock and does not allocate generation 41.
// The number lives in process memory. A process that already finished an older
// generation clears its ready promise and runs this DDL again. The statements
// are CREATE TABLE IF NOT EXISTS and DROP TRIGGER IF EXISTS, so a fresh
// database, a generation-33 database, and a database that already has some
// outbox objects converge without rebuilding quotation tables.
// If the DDL throws, the generation is cleared and the next ensureSchema retries.
// IMP-01A's uncommitted assurance_evaluations claim is not this successor.
// Generation 32 remains the combined successor of IAM-001 workspace_invitations and F34-04 priority.
const SCHEMA_GENERATION = 40;

export const IMP01A_ALTERNATIVE_SCHEMA_ERROR =
  "Database contains IMP-01A assurance_evaluations and is not the quotation generation-33 schema.";

const globalStore = globalThis as typeof globalThis & {
  __vosDb?: Database;
  __vosClient?: Client;
  __vosSchemaReady?: Promise<void>;
  __vosSchemaGeneration?: number;
  __vosStockSchemaReady?: Promise<void>;
  __vosCommercialCatalogueReady?: Promise<void>;
  __vosCommercialLinesReady?: Promise<void>;
  __vosQuotationIdentitySealsReady?: string;
  __vosQuotationIdentitySealUncertain?: boolean;
  __vosDatabaseUrl?: string;
  __vosEphemeralDatabaseUrl?: string;
};

/** Native busy_timeout for the process singleton. Not used as a BUSY-retry vehicle. */
const SQLITE_PLATFORM_BUSY_TIMEOUT_MS = 250;

function configuredDatabaseUrl() {
  return globalStore.__vosDatabaseUrl ?? process.env.DATABASE_URL ?? DEFAULT_URL;
}

function isConfiguredMemoryUrl(url: string) {
  return url === ":memory:" || url === "file::memory:";
}

function isMemoryDatabaseUrl(url: string) {
  return url === ":memory:" || url.startsWith("file::memory:");
}

/** Resolved URL shared by the process singleton and short-lived durability clients. */
export function getDatabaseUrl() {
  if (process.env.NEXT_PHASE === "phase-production-build") {
    throw new PersistentDevelopmentDatabaseError("persistent_database_build_access_refused");
  }
  const url = configuredDatabaseUrl();
  assertProductionDatabaseReadyToOpen(url);
  if (isConfiguredMemoryUrl(url)) {
    if (persistentDevelopmentDatabaseEnabled()) {
      throw new PersistentDevelopmentDatabaseError("persistent_database_url_malformed");
    }
    if (!globalStore.__vosEphemeralDatabaseUrl) {
      const path = join(tmpdir(), `vos-ephemeral-${randomUUID()}.db`).replaceAll("\\", "/");
      globalStore.__vosEphemeralDatabaseUrl = `file:${path}`;
    }
    return globalStore.__vosEphemeralDatabaseUrl;
  }
  if (!persistentDevelopmentDatabaseEnabled()) return url;
  if (PERSISTENT_SCHEMA_GENERATION !== SCHEMA_GENERATION) {
    throw new PersistentDevelopmentDatabaseError("persistent_database_generation_mismatch");
  }
  return resolvePersistentDevelopmentDatabase(url);
}

export function ensureFileDatabase(url: string) {
  if (!url.startsWith("file:") || isMemoryDatabaseUrl(url)) {
    return;
  }
  if (process.env.NODE_ENV === "production") {
    assertProductionDatabaseReadyToOpen(url);
    const filePath = resolve(url.slice("file:".length));
    if (!existsSync(dirname(filePath))) {
      throw new ProductionProcessError("production_database_parent_missing");
    }
    return;
  }

  const filePath = resolve(url.slice("file:".length));
  mkdirSync(dirname(filePath), { recursive: true });
}

function discardPersistentClient() {
  const client = globalStore.__vosClient;
  globalStore.__vosClient = undefined;
  globalStore.__vosDb = undefined;
  globalStore.__vosSchemaReady = undefined;
  try {
    client?.close();
  } catch {
    // The rejected client is no longer reusable.
  }
}

export function getClient() {
  if (globalStore.__vosClient) {
    try {
      recheckPersistentDevelopmentDatabase();
    } catch (error) {
      discardPersistentClient();
      throw error;
    }
    return globalStore.__vosClient;
  }

  const url = getDatabaseUrl();
  ensureFileDatabase(url);
  const client = createGuardedDatabaseClient({ url, timeout: SQLITE_PLATFORM_BUSY_TIMEOUT_MS });
  try {
    recheckPersistentDevelopmentDatabase();
  } catch (error) {
    try {
      client.close();
    } catch {
      // The client did not remain assigned.
    }
    throw error;
  }
  globalStore.__vosClient = client;
  return globalStore.__vosClient;
}

export function getDb() {
  if (globalStore.__vosDb) {
    try {
      recheckPersistentDevelopmentDatabase();
    } catch (error) {
      discardPersistentClient();
      throw error;
    }
    return globalStore.__vosDb;
  }

  globalStore.__vosDb = drizzle(getClient(), { schema });
  return globalStore.__vosDb;
}

/** Exact basename produced by getDatabaseUrl() for configured in-memory persistence. */
const OWNED_EPHEMERAL_DATABASE_BASENAME =
  /^vos-ephemeral-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.db$/;

/**
 * Sidecars observed for this runtime are absent after close: journal_mode is delete,
 * so no -wal/-shm file remains. Remove those exact SQLite suffixes only when present.
 */
const OWNED_EPHEMERAL_SIDECAR_SUFFIXES = ["-wal", "-shm"] as const;

/** Windows releases the native libSQL handle on the next finalizer pass. */
const EPHEMERAL_CLEANUP_ATTEMPTS = 8;
const EPHEMERAL_CLEANUP_DELAY_MS = 50;

let collectGarbage: (() => void) | undefined;

function releaseClosedClientHandles() {
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

function pathsEqual(left: string, right: string) {
  const resolvedLeft = resolve(left);
  const resolvedRight = resolve(right);
  if (process.platform === "win32") {
    return resolvedLeft.toLowerCase() === resolvedRight.toLowerCase();
  }
  return resolvedLeft === resolvedRight;
}

function filePathFromDatabaseUrl(url: string | undefined) {
  if (!url || !url.startsWith("file:") || isMemoryDatabaseUrl(url)) {
    return undefined;
  }
  return resolve(url.slice("file:".length));
}

/** Owned only when the resolved file is a direct tmpdir() child with the generated basename. */
function ownedEphemeralDatabasePath(url: string | undefined) {
  if (!url || !url.startsWith("file:") || isMemoryDatabaseUrl(url)) {
    return undefined;
  }
  const raw = url.slice("file:".length);
  const segments = raw.split(/[\\/]/);
  if (segments.includes("..") || segments.includes(".")) {
    return undefined;
  }
  const filePath = resolve(raw);
  const tempRoot = resolve(tmpdir());
  if (!pathsEqual(dirname(filePath), tempRoot)) {
    return undefined;
  }
  const base = basename(filePath);
  if (!OWNED_EPHEMERAL_DATABASE_BASENAME.test(base)) {
    return undefined;
  }
  const fromTemp = relative(tempRoot, filePath);
  if (!pathsEqual(join(tempRoot, fromTemp), filePath) || fromTemp !== base) {
    if (process.platform === "win32" && fromTemp.toLowerCase() === base.toLowerCase()) {
      return filePath;
    }
    return undefined;
  }
  return filePath;
}

function isRetryableCleanupError(error: unknown) {
  const code = error && typeof error === "object" && "code" in error ? error.code : undefined;
  return code === "EBUSY" || code === "EPERM";
}

async function unlinkOwnedEphemeralFile(filePath: string) {
  for (let attempt = 1; attempt <= EPHEMERAL_CLEANUP_ATTEMPTS; attempt += 1) {
    try {
      await unlink(filePath);
      return;
    } catch (error) {
      const code = error && typeof error === "object" && "code" in error ? error.code : undefined;
      if (code === "ENOENT") {
        return;
      }
      if (!isRetryableCleanupError(error) || attempt === EPHEMERAL_CLEANUP_ATTEMPTS) {
        throw error;
      }
      releaseClosedClientHandles();
      await delay(EPHEMERAL_CLEANUP_DELAY_MS);
    }
  }
}

async function removeOwnedEphemeralDatabase(previousUrl: string | undefined, nextUrl: string | undefined) {
  const filePath = ownedEphemeralDatabasePath(previousUrl);
  if (!filePath) {
    return;
  }
  const nextPath = filePathFromDatabaseUrl(nextUrl);
  if (nextPath && pathsEqual(filePath, nextPath)) {
    return;
  }
  releaseClosedClientHandles();
  for (const suffix of OWNED_EPHEMERAL_SIDECAR_SUFFIXES) {
    await unlinkOwnedEphemeralFile(`${filePath}${suffix}`);
  }
  await unlinkOwnedEphemeralFile(filePath);
}

/** Drops the process DB client so the next getDb() binds a live connection. */
export async function resetDatabaseLifecycle(databaseUrl?: string) {
  await runBeforePersistenceReset();
  const previousEphemeralUrl = globalStore.__vosEphemeralDatabaseUrl;
  const nextUrl = databaseUrl ?? configuredDatabaseUrl();
  const client = globalStore.__vosClient;
  globalStore.__vosClient = undefined;
  globalStore.__vosDb = undefined;
  globalStore.__vosSchemaReady = undefined;
  globalStore.__vosSchemaGeneration = undefined;
  globalStore.__vosStockSchemaReady = undefined;
  globalStore.__vosCommercialCatalogueReady = undefined;
  globalStore.__vosCommercialLinesReady = undefined;
  globalStore.__vosQuotationIdentitySealsReady = undefined;
  globalStore.__vosQuotationIdentitySealUncertain = undefined;
  identitySealCommitReplacementForTests = null;
  addIdentitySealProtectedPathForTests(null);
  globalStore.__vosEphemeralDatabaseUrl = undefined;
  if (client) {
    try {
      client.close();
    } catch {
      // Client already closed.
    }
  }
  await removeOwnedEphemeralDatabase(previousEphemeralUrl, nextUrl);
  if (databaseUrl) {
    globalStore.__vosDatabaseUrl = databaseUrl;
  }
}

/** Test-only. Drops a URL pinned by resetDatabaseLifecycle. */
export function clearDatabaseSelectionForTests() {
  globalStore.__vosDatabaseUrl = undefined;
}

async function exec(sql: string) {
  await getClient().execute(sql);
}

/** Fail closed when a database carries the uncommitted IMP-01A generation-33 table. */
async function rejectImp01aAlternativeSchema() {
  const found = await getClient().execute(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'assurance_evaluations' LIMIT 1",
  );
  if (found.rows.length > 0) {
    throw new Error(IMP01A_ALTERNATIVE_SCHEMA_ERROR);
  }
}

const QUOTATION_VERSION_DDL = `
  quotation_id TEXT NOT NULL,
  workspace_id TEXT NOT NULL,
  venture_id TEXT NOT NULL,
  version_number INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('in_preparation', 'awaiting_customer_approval', 'approved', 'declined')),
  description TEXT NOT NULL,
  total_minor INTEGER NOT NULL CHECK (total_minor >= 0),
  currency TEXT NOT NULL CHECK (currency = 'ZAR'),
  document_hash TEXT NOT NULL,
  sent_at TEXT,
  recipient TEXT,
  dispatch_evidence_ref TEXT,
  labour_quantity_milli INTEGER,
  labour_unit TEXT,
  labour_rate_minor INTEGER,
  labour_amount_minor INTEGER,
  travel_kilometres_milli INTEGER,
  distance_basis TEXT,
  travel_rate_minor INTEGER,
  travel_amount_minor INTEGER,
  tax_treatment TEXT,
  tax_rule_id TEXT,
  tax_rule_version TEXT,
  tax_rate_numerator INTEGER,
  tax_rate_denominator INTEGER,
  taxable_amount_minor INTEGER,
  tax_amount_minor INTEGER,
  CHECK (
    (
      labour_quantity_milli IS NULL
      AND labour_unit IS NULL
      AND labour_rate_minor IS NULL
      AND labour_amount_minor IS NULL
      AND travel_kilometres_milli IS NULL
      AND distance_basis IS NULL
      AND travel_rate_minor IS NULL
      AND travel_amount_minor IS NULL
      AND tax_treatment IS NULL
      AND tax_rule_id IS NULL
      AND tax_rule_version IS NULL
      AND tax_rate_numerator IS NULL
      AND tax_rate_denominator IS NULL
      AND taxable_amount_minor IS NULL
      AND tax_amount_minor IS NULL
    )
    OR (
      labour_quantity_milli >= 0
      AND length(labour_unit) > 0
      AND labour_rate_minor >= 0
      AND labour_amount_minor >= 0
      AND travel_kilometres_milli >= 0
      AND distance_basis IN ('one_way', 'return')
      AND travel_rate_minor >= 0
      AND travel_amount_minor >= 0
      AND taxable_amount_minor = labour_amount_minor + travel_amount_minor
      AND tax_amount_minor >= 0
      AND total_minor = taxable_amount_minor + tax_amount_minor
      AND (
        (
          tax_treatment = 'not_registered'
          AND tax_amount_minor = 0
          AND tax_rule_id IS NULL
          AND tax_rule_version IS NULL
          AND tax_rate_numerator IS NULL
          AND tax_rate_denominator IS NULL
        )
        OR (
          tax_treatment = 'configured_rule'
          AND length(tax_rule_id) > 0
          AND length(tax_rule_version) > 0
          AND tax_rate_numerator >= 0
          AND tax_rate_denominator > 0
        )
      )
    )
  ),
  PRIMARY KEY (quotation_id, version_number)
`;

const QUOTATION_EVENT_DDL = `
  id TEXT PRIMARY KEY,
  quotation_id TEXT NOT NULL,
  workspace_id TEXT NOT NULL,
  venture_id TEXT NOT NULL,
  version_number INTEGER NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('created', 'sent', 'revision_started', 'approved', 'declined')),
  occurred_at TEXT NOT NULL,
  actor_user_id TEXT,
  actor_contact_id TEXT,
  evidence_ref TEXT,
  CHECK (
    (actor_user_id IS NOT NULL AND actor_contact_id IS NULL)
    OR (actor_user_id IS NULL AND actor_contact_id IS NOT NULL)
  )
`;

/** CREATE TABLE IF NOT EXISTS does not widen a CHECK. Rebuild only that table and copy its rows. */
async function widenQuotationTableCheck(options: {
  name: "frigora_quotation_versions" | "frigora_quotation_events";
  columns: string;
  copyColumns: string;
}) {
  const found = await getClient().execute({
    sql: "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = ?",
    args: [options.name],
  });
  const ddl = String(found.rows[0]?.sql ?? "");
  if (!ddl || ddl.includes("'approved'")) {
    return;
  }
  const temporary = `${options.name}__decision_rebuild`;
  const transaction = await getClient().transaction("write");
  try {
    await transaction.execute(`DROP TABLE IF EXISTS ${temporary}`);
    await transaction.execute(`CREATE TABLE ${temporary} (${options.columns})`);
    await transaction.execute(
      `INSERT INTO ${temporary} (${options.copyColumns}) SELECT ${options.copyColumns} FROM ${options.name}`,
    );
    await transaction.execute(`DROP TABLE ${options.name}`);
    await transaction.execute(`ALTER TABLE ${temporary} RENAME TO ${options.name}`);
    await transaction.commit();
  } catch (error) {
    if (!transaction.closed) {
      await transaction.rollback();
    }
    throw error;
  } finally {
    transaction.close();
  }
}

const QUOTATION_VERSION_COPY_COLUMNS = `quotation_id, workspace_id, venture_id, version_number, status, description,
  total_minor, currency, document_hash, sent_at, recipient, dispatch_evidence_ref`;

/** Adds the commercial snapshot to a generation-33 table created before that snapshot existed. Existing rows stay, with no invented prices. */
async function ensureQuotationCommercialColumns() {
  const found = await getClient().execute({
    sql: "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = ?",
    args: ["frigora_quotation_versions"],
  });
  const ddl = String(found.rows[0]?.sql ?? "");
  if (!ddl || ddl.includes("labour_quantity_milli")) {
    return;
  }
  const temporary = "frigora_quotation_versions__commercial_rebuild";
  const transaction = await getClient().transaction("write");
  try {
    await transaction.execute(`DROP TABLE IF EXISTS ${temporary}`);
    await transaction.execute(`CREATE TABLE ${temporary} (${QUOTATION_VERSION_DDL})`);
    await transaction.execute(
      `INSERT INTO ${temporary} (${QUOTATION_VERSION_COPY_COLUMNS}) SELECT ${QUOTATION_VERSION_COPY_COLUMNS} FROM frigora_quotation_versions`,
    );
    await transaction.execute("DROP TABLE frigora_quotation_versions");
    await transaction.execute(`ALTER TABLE ${temporary} RENAME TO frigora_quotation_versions`);
    await transaction.commit();
  } catch (error) {
    if (!transaction.closed) {
      await transaction.rollback();
    }
    throw error;
  } finally {
    transaction.close();
  }
}

/** Generation 33 also creates venture tax configuration. This is not a new schema generation. */
async function ensureTaxConfigurationTables() {
  await exec(`
    CREATE TABLE IF NOT EXISTS frigora_tax_rules (
      id TEXT PRIMARY KEY,
      jurisdiction TEXT NOT NULL,
      treatment TEXT NOT NULL,
      rate_numerator INTEGER NOT NULL,
      rate_denominator INTEGER NOT NULL,
      effective_from TEXT NOT NULL,
      effective_until TEXT,
      source_title TEXT NOT NULL,
      source_url TEXT NOT NULL,
      source_statement_date TEXT NOT NULL,
      source_note TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('reference', 'approved', 'revoked')),
      approved_by_user_id TEXT,
      approved_at TEXT,
      created_at TEXT NOT NULL
    )
  `);
  await exec(`
    CREATE TABLE IF NOT EXISTS frigora_tax_configurations (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      venture_id TEXT NOT NULL,
      version_number INTEGER NOT NULL,
      jurisdiction TEXT NOT NULL,
      registration_state TEXT NOT NULL CHECK (registration_state IN ('unverified', 'pending_review', 'registered', 'not_registered')),
      registration_number TEXT,
      liability_date TEXT,
      tax_rule_id TEXT,
      evidence_reference TEXT,
      status TEXT NOT NULL CHECK (status IN ('draft', 'pending_review', 'verified', 'revoked')),
      created_by_user_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      verified_by_user_id TEXT,
      verified_at TEXT,
      UNIQUE (workspace_id, venture_id, version_number),
      CHECK (
        status != 'verified'
        OR (
          evidence_reference IS NOT NULL
          AND length(evidence_reference) > 0
          AND verified_by_user_id IS NOT NULL
          AND verified_at IS NOT NULL
          AND (
            (registration_state = 'not_registered' AND tax_rule_id IS NULL)
            OR (
              registration_state = 'registered'
              AND registration_number IS NOT NULL
              AND length(registration_number) > 0
              AND liability_date IS NOT NULL
              AND tax_rule_id IS NOT NULL
            )
          )
        )
      )
    )
  `);
  await exec(`
    CREATE TABLE IF NOT EXISTS frigora_tax_configuration_events (
      id TEXT PRIMARY KEY,
      configuration_id TEXT NOT NULL,
      workspace_id TEXT NOT NULL,
      venture_id TEXT NOT NULL,
      version_number INTEGER NOT NULL,
      kind TEXT NOT NULL,
      occurred_at TEXT NOT NULL,
      actor_user_id TEXT NOT NULL,
      summary TEXT NOT NULL
    )
  `);
  await exec("DROP TRIGGER IF EXISTS frigora_tax_rules_rate_immutable");
  await exec(`
    CREATE TRIGGER frigora_tax_rules_rate_immutable
    BEFORE UPDATE ON frigora_tax_rules
    WHEN NEW.rate_numerator != OLD.rate_numerator
      OR NEW.rate_denominator != OLD.rate_denominator
      OR NEW.effective_from != OLD.effective_from
      OR NEW.source_url != OLD.source_url
      OR NEW.jurisdiction != OLD.jurisdiction
      OR NEW.treatment != OLD.treatment
    BEGIN
      SELECT RAISE(ABORT, 'tax rule rate and provenance are immutable');
    END
  `);
  await exec("DROP TRIGGER IF EXISTS frigora_tax_configurations_verified_immutable");
  await exec(`
    CREATE TRIGGER frigora_tax_configurations_verified_immutable
    BEFORE UPDATE ON frigora_tax_configurations
    WHEN OLD.status = 'verified'
      AND (
        NEW.registration_state != OLD.registration_state
        OR NEW.registration_number IS NOT OLD.registration_number
        OR NEW.liability_date IS NOT OLD.liability_date
        OR NEW.tax_rule_id IS NOT OLD.tax_rule_id
        OR NEW.evidence_reference IS NOT OLD.evidence_reference
        OR NEW.jurisdiction != OLD.jurisdiction
        OR NEW.version_number != OLD.version_number
        OR NEW.workspace_id != OLD.workspace_id
        OR NEW.venture_id != OLD.venture_id
      )
    BEGIN
      SELECT RAISE(ABORT, 'verified tax configuration facts are immutable');
    END
  `);
  await exec("DROP TRIGGER IF EXISTS frigora_tax_configuration_events_no_update");
  await exec(`
    CREATE TRIGGER frigora_tax_configuration_events_no_update
    BEFORE UPDATE ON frigora_tax_configuration_events
    BEGIN
      SELECT RAISE(ABORT, 'tax configuration events are append-only');
    END
  `);
  await exec("DROP TRIGGER IF EXISTS frigora_tax_configuration_events_no_delete");
  await exec(`
    CREATE TRIGGER frigora_tax_configuration_events_no_delete
    BEFORE DELETE ON frigora_tax_configuration_events
    BEGIN
      SELECT RAISE(ABORT, 'tax configuration events are append-only');
    END
  `);
}

/** Office events keep a user actor. A bearer-link decision records the designated contact instead. */
async function ensureQuotationEventActorShape() {
  const found = await getClient().execute(
    "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'frigora_quotation_events'",
  );
  const ddl = String(found.rows[0]?.sql ?? "");
  if (ddl.includes("actor_contact_id") && !/actor_user_id TEXT NOT NULL/.test(ddl)) {
    return;
  }
  const temporary = "frigora_quotation_events__actor_rebuild";
  const transaction = await getClient().transaction("write");
  try {
    await transaction.execute(`DROP TABLE IF EXISTS ${temporary}`);
    await transaction.execute(`CREATE TABLE ${temporary} (${QUOTATION_EVENT_DDL})`);
    if (ddl.includes("actor_contact_id")) {
      await transaction.execute(`
        INSERT INTO ${temporary} (
          id, quotation_id, workspace_id, venture_id, version_number, kind,
          occurred_at, actor_user_id, actor_contact_id, evidence_ref
        )
        SELECT id, quotation_id, workspace_id, venture_id, version_number, kind,
               occurred_at, actor_user_id, actor_contact_id, evidence_ref
        FROM frigora_quotation_events
      `);
    } else {
      await transaction.execute(`
        INSERT INTO ${temporary} (
          id, quotation_id, workspace_id, venture_id, version_number, kind,
          occurred_at, actor_user_id, actor_contact_id, evidence_ref
        )
        SELECT id, quotation_id, workspace_id, venture_id, version_number, kind,
               occurred_at, actor_user_id, NULL, evidence_ref
        FROM frigora_quotation_events
      `);
    }
    await transaction.execute("DROP TABLE frigora_quotation_events");
    await transaction.execute(`ALTER TABLE ${temporary} RENAME TO frigora_quotation_events`);
    await transaction.commit();
  } catch (error) {
    if (!transaction.closed) {
      await transaction.rollback();
    }
    throw error;
  } finally {
    transaction.close();
  }
}

async function addColumn(table: string, column: string, definition: string) {
  try {
    await exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  } catch {
    // Column already exists on upgraded databases.
  }
}

async function ensureQuotationCustomerDelivery() {
  await exec(`
    CREATE TABLE IF NOT EXISTS frigora_quotation_customer_deliveries (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      venture_id TEXT NOT NULL,
      quotation_id TEXT NOT NULL,
      version_number INTEGER NOT NULL,
      customer_id TEXT NOT NULL,
      site_id TEXT NOT NULL,
      contact_id TEXT NOT NULL,
      grant_id TEXT NOT NULL,
      document_hash TEXT NOT NULL,
      idempotency_key TEXT NOT NULL UNIQUE,
      payload_fingerprint TEXT NOT NULL,
      payload_text TEXT,
      payload_read_failure TEXT,
      state TEXT NOT NULL CHECK (state IN (
        'prepared',
        'sending',
        'accepted_by_provider',
        'rejected_by_provider',
        'outcome_unknown',
        'reconciliation_required'
      )),
      provider_message_id TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      idempotency_started_at TEXT,
      actor_user_id TEXT NOT NULL,
      claim_owner TEXT,
      claim_lease_expires_at TEXT,
      provider_request_expires_at TEXT,
      UNIQUE (quotation_id, version_number, contact_id)
    )
  `);
  await exec(`
    CREATE TABLE IF NOT EXISTS frigora_quotation_customer_delivery_attempts (
      id TEXT PRIMARY KEY,
      delivery_id TEXT NOT NULL,
      occurred_at TEXT NOT NULL,
      actor_user_id TEXT NOT NULL,
      outcome TEXT NOT NULL CHECK (outcome IN (
        'sending',
        'accepted_by_provider',
        'rejected_by_provider',
        'outcome_unknown',
        'reconciliation_required'
      )),
      detail TEXT NOT NULL
    )
  `);
  await exec(
    `CREATE INDEX IF NOT EXISTS frigora_quotation_customer_delivery_attempts_idx ON frigora_quotation_customer_delivery_attempts (delivery_id, occurred_at)`,
  );
  await addColumn("frigora_quotation_customer_deliveries", "claim_owner", "TEXT");
  await addColumn("frigora_quotation_customer_deliveries", "claim_lease_expires_at", "TEXT");
  await addColumn("frigora_quotation_customer_deliveries", "provider_request_expires_at", "TEXT");
  await addColumn("frigora_quotation_customer_deliveries", "payload_read_failure", "TEXT");
  await exec("DROP TRIGGER IF EXISTS frigora_quotation_customer_deliveries_identity");
  await exec(`
    CREATE TRIGGER frigora_quotation_customer_deliveries_identity
    BEFORE UPDATE ON frigora_quotation_customer_deliveries
    WHEN NEW.id != OLD.id
      OR NEW.workspace_id != OLD.workspace_id
      OR NEW.venture_id != OLD.venture_id
      OR NEW.quotation_id != OLD.quotation_id
      OR NEW.version_number != OLD.version_number
      OR NEW.customer_id != OLD.customer_id
      OR NEW.site_id != OLD.site_id
      OR NEW.contact_id != OLD.contact_id
      OR NEW.grant_id != OLD.grant_id
      OR NEW.document_hash != OLD.document_hash
      OR NEW.idempotency_key != OLD.idempotency_key
      OR NEW.payload_fingerprint != OLD.payload_fingerprint
      OR NEW.created_at != OLD.created_at
      OR NEW.actor_user_id != OLD.actor_user_id
    BEGIN
      SELECT RAISE(ABORT, 'customer delivery identity is immutable');
    END
  `);
  await exec("DROP TRIGGER IF EXISTS frigora_quotation_customer_delivery_attempts_no_update");
  await exec(`
    CREATE TRIGGER frigora_quotation_customer_delivery_attempts_no_update
    BEFORE UPDATE ON frigora_quotation_customer_delivery_attempts
    BEGIN
      SELECT RAISE(ABORT, 'customer delivery attempts are append-only');
    END
  `);
  await exec("DROP TRIGGER IF EXISTS frigora_quotation_customer_delivery_attempts_no_delete");
  await exec(`
    CREATE TRIGGER frigora_quotation_customer_delivery_attempts_no_delete
    BEFORE DELETE ON frigora_quotation_customer_delivery_attempts
    BEGIN
      SELECT RAISE(ABORT, 'customer delivery attempts are append-only');
    END
  `);
}

async function ensureQuotationDeliveryOutbox() {
  await exec(`
    CREATE TABLE IF NOT EXISTS frigora_quotation_delivery_outbox (
      id TEXT PRIMARY KEY,
      quotation_id TEXT NOT NULL,
      workspace_id TEXT NOT NULL,
      venture_id TEXT NOT NULL,
      version_number INTEGER NOT NULL,
      document_hash TEXT NOT NULL,
      created_at TEXT NOT NULL,
      actor_user_id TEXT NOT NULL,
      state TEXT NOT NULL CHECK (state IN (
        'held_pending_customer_access',
        'accepted_by_provider',
        'rejected_by_provider',
        'outcome_unknown'
      )),
      hold_reason TEXT NOT NULL,
      provider_message_id TEXT,
      UNIQUE (quotation_id, version_number)
    )
  `);
  await exec(
    `CREATE INDEX IF NOT EXISTS frigora_quotation_delivery_outbox_scope_idx ON frigora_quotation_delivery_outbox (workspace_id, venture_id, quotation_id)`,
  );
  await exec(`
    CREATE TABLE IF NOT EXISTS frigora_quotation_delivery_attempts (
      id TEXT PRIMARY KEY,
      outbox_id TEXT NOT NULL,
      occurred_at TEXT NOT NULL,
      actor_user_id TEXT NOT NULL,
      outcome TEXT NOT NULL CHECK (outcome IN (
        'held_pending_customer_access',
        'accepted_by_provider',
        'rejected_by_provider',
        'outcome_unknown'
      )),
      detail TEXT NOT NULL
    )
  `);
  await exec(
    `CREATE INDEX IF NOT EXISTS frigora_quotation_delivery_attempts_outbox_idx ON frigora_quotation_delivery_attempts (outbox_id, occurred_at)`,
  );
  await exec("DROP TRIGGER IF EXISTS frigora_quotation_delivery_outbox_transition");
  await exec(`
    CREATE TRIGGER frigora_quotation_delivery_outbox_transition
    BEFORE UPDATE ON frigora_quotation_delivery_outbox
    WHEN NOT (
      OLD.state = 'held_pending_customer_access'
      AND NEW.state = 'outcome_unknown'
      AND NEW.id = OLD.id
      AND NEW.quotation_id = OLD.quotation_id
      AND NEW.workspace_id = OLD.workspace_id
      AND NEW.venture_id = OLD.venture_id
      AND NEW.version_number = OLD.version_number
      AND NEW.document_hash = OLD.document_hash
      AND NEW.created_at = OLD.created_at
      AND NEW.actor_user_id = OLD.actor_user_id
      AND NEW.hold_reason = OLD.hold_reason
      AND NEW.provider_message_id IS OLD.provider_message_id
    )
    BEGIN
      SELECT RAISE(ABORT, 'quotation delivery outbox transition is not allowed');
    END
  `);
  await exec("DROP TRIGGER IF EXISTS frigora_quotation_delivery_attempts_no_update");
  await exec(`
    CREATE TRIGGER frigora_quotation_delivery_attempts_no_update
    BEFORE UPDATE ON frigora_quotation_delivery_attempts
    BEGIN
      SELECT RAISE(ABORT, 'quotation delivery attempts are append-only');
    END
  `);
  await exec("DROP TRIGGER IF EXISTS frigora_quotation_delivery_attempts_no_delete");
  await exec(`
    CREATE TRIGGER frigora_quotation_delivery_attempts_no_delete
    BEFORE DELETE ON frigora_quotation_delivery_attempts
    BEGIN
      SELECT RAISE(ABORT, 'quotation delivery attempts are append-only');
    END
  `);
}

export async function ensureSchema() {
  if (globalStore.__vosSchemaGeneration !== SCHEMA_GENERATION) {
    globalStore.__vosSchemaReady = undefined;
    globalStore.__vosSchemaGeneration = SCHEMA_GENERATION;
  }

  if (!globalStore.__vosSchemaReady) {
    const generation = SCHEMA_GENERATION;
    globalStore.__vosSchemaReady = (async () => {
      beginPersistentDatabaseMaintenance();
      try {
        await rejectImp01aAlternativeSchema();
        await exec(`
        CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY,
          email TEXT NOT NULL,
          password_hash TEXT NOT NULL,
          name TEXT NOT NULL,
          created_at TEXT NOT NULL
        )
      `);
      await exec(`CREATE UNIQUE INDEX IF NOT EXISTS users_email_idx ON users (email)`);

      await exec(`
        CREATE TABLE IF NOT EXISTS auth_identities (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          provider TEXT NOT NULL,
          provider_subject TEXT NOT NULL,
          secret_hash TEXT,
          created_at TEXT NOT NULL
        )
      `);
      await exec(
        `CREATE UNIQUE INDEX IF NOT EXISTS auth_identities_provider_subject_idx ON auth_identities (provider, provider_subject)`,
      );

      await exec(`
        CREATE TABLE IF NOT EXISTS sessions (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          expires_at TEXT NOT NULL,
          created_at TEXT NOT NULL
        )
      `);

      await exec(`
        CREATE TABLE IF NOT EXISTS password_reset_tokens (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          token_hash TEXT NOT NULL,
          expires_at TEXT NOT NULL,
          used_at TEXT,
          created_at TEXT NOT NULL
        )
      `);
      await exec(
        `CREATE UNIQUE INDEX IF NOT EXISTS password_reset_tokens_hash_idx ON password_reset_tokens (token_hash)`,
      );

      await exec(`
        CREATE TABLE IF NOT EXISTS workspaces (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          slug TEXT NOT NULL,
          created_at TEXT NOT NULL
        )
      `);
      await exec(`CREATE UNIQUE INDEX IF NOT EXISTS workspaces_slug_idx ON workspaces (slug)`);

      await exec(`
        CREATE TABLE IF NOT EXISTS workspace_members (
          workspace_id TEXT NOT NULL,
          user_id TEXT NOT NULL,
          role TEXT NOT NULL,
          created_at TEXT NOT NULL
        )
      `);
      await exec(
        `CREATE UNIQUE INDEX IF NOT EXISTS workspace_members_pk ON workspace_members (workspace_id, user_id)`,
      );

      await exec(`
        CREATE TABLE IF NOT EXISTS workspace_invitations (
          id TEXT PRIMARY KEY,
          workspace_id TEXT NOT NULL,
          email TEXT NOT NULL,
          role TEXT NOT NULL,
          invited_by TEXT NOT NULL,
          token_hash TEXT NOT NULL,
          expires_at TEXT NOT NULL,
          accepted_at TEXT,
          revoked_at TEXT,
          created_at TEXT NOT NULL,
          active_slot TEXT,
          CHECK (role IN ('admin', 'member'))
        )
      `);
      await addColumn("workspace_invitations", "active_slot", "TEXT");
      await exec(
        `CREATE UNIQUE INDEX IF NOT EXISTS workspace_invitations_token_hash_idx ON workspace_invitations (token_hash)`,
      );
      await exec(
        `CREATE UNIQUE INDEX IF NOT EXISTS workspace_invitations_active_slot_idx ON workspace_invitations (active_slot) WHERE active_slot IS NOT NULL`,
      );
      await exec(
        `CREATE INDEX IF NOT EXISTS workspace_invitations_workspace_email_idx ON workspace_invitations (workspace_id, email)`,
      );

      await exec(`
        CREATE TABLE IF NOT EXISTS workspace_cores (
          workspace_id TEXT PRIMARY KEY,
          founder_json TEXT NOT NULL,
          briefing_json TEXT NOT NULL,
          updated_at TEXT NOT NULL
        )
      `);

      await exec(`
        CREATE TABLE IF NOT EXISTS ventures (
          id TEXT PRIMARY KEY,
          workspace_id TEXT NOT NULL,
          name TEXT NOT NULL,
          slug TEXT NOT NULL,
          created_at TEXT NOT NULL
        )
      `);
      await addColumn("ventures", "stage", "TEXT NOT NULL DEFAULT ''");
      await addColumn("ventures", "href", "TEXT NOT NULL DEFAULT ''");
      await addColumn("ventures", "founded_at", "TEXT NOT NULL DEFAULT ''");
      await addColumn("ventures", "category", "TEXT NOT NULL DEFAULT ''");
      await addColumn("ventures", "owner", "TEXT NOT NULL DEFAULT ''");
      await addColumn("ventures", "hq_summary", "TEXT NOT NULL DEFAULT ''");
      await addColumn("ventures", "genome_json", "TEXT NOT NULL DEFAULT '{}'");
      await addColumn("ventures", "mission_json", "TEXT NOT NULL DEFAULT '{}'");
      await addColumn("ventures", "launch_draft_json", "TEXT NOT NULL DEFAULT '{}'");
      await addColumn("ventures", "documents_json", "TEXT NOT NULL DEFAULT '{\"documents\":[]}'");
      await addColumn("ventures", "risk_json", "TEXT NOT NULL DEFAULT '{\"headline\":\"\",\"signals\":[]}'");
      await addColumn("ventures", "updated_at", "TEXT NOT NULL DEFAULT ''");
      await addColumn("ventures", "definition_id", "TEXT NOT NULL DEFAULT ''");
      await addColumn("ventures", "definition_version", "TEXT NOT NULL DEFAULT ''");
      await addColumn("ventures", "lifecycle", "TEXT NOT NULL DEFAULT 'operating'");
      await exec(
        `CREATE UNIQUE INDEX IF NOT EXISTS ventures_workspace_slug_idx ON ventures (workspace_id, slug)`,
      );

      await exec(`
        CREATE TABLE IF NOT EXISTS executive_offices (
          id TEXT PRIMARY KEY,
          workspace_id TEXT NOT NULL,
          venture_id TEXT NOT NULL DEFAULT '',
          document_json TEXT NOT NULL,
          updated_at TEXT NOT NULL
        )
      `);
      await exec(
        `CREATE UNIQUE INDEX IF NOT EXISTS executive_offices_workspace_venture_idx ON executive_offices (workspace_id, venture_id)`,
      );

      await exec(`
        CREATE TABLE IF NOT EXISTS recommendations (
          id TEXT PRIMARY KEY,
          workspace_id TEXT NOT NULL,
          venture_id TEXT NOT NULL DEFAULT '',
          document_json TEXT NOT NULL,
          updated_at TEXT NOT NULL
        )
      `);

      await exec(`
        CREATE TABLE IF NOT EXISTS policy_states (
          workspace_id TEXT PRIMARY KEY,
          library_json TEXT NOT NULL,
          findings_json TEXT NOT NULL,
          updated_at TEXT NOT NULL
        )
      `);

      await exec(`
        CREATE TABLE IF NOT EXISTS policy_findings (
          id TEXT PRIMARY KEY,
          workspace_id TEXT NOT NULL,
          venture_id TEXT NOT NULL,
          policy_id TEXT NOT NULL,
          document_json TEXT NOT NULL,
          updated_at TEXT NOT NULL
        )
      `);

      await exec(`
        CREATE TABLE IF NOT EXISTS executive_memory (
          id TEXT PRIMARY KEY,
          workspace_id TEXT NOT NULL,
          venture_id TEXT NOT NULL DEFAULT '',
          document_json TEXT NOT NULL,
          updated_at TEXT NOT NULL
        )
      `);

      await exec(`
        CREATE TABLE IF NOT EXISTS decisions (
          id TEXT PRIMARY KEY,
          workspace_id TEXT NOT NULL,
          venture_id TEXT NOT NULL,
          document_json TEXT NOT NULL,
          updated_at TEXT NOT NULL
        )
      `);

      await exec(`
        CREATE TABLE IF NOT EXISTS operating_health (
          id TEXT PRIMARY KEY,
          workspace_id TEXT NOT NULL,
          venture_id TEXT NOT NULL DEFAULT '',
          document_json TEXT NOT NULL,
          updated_at TEXT NOT NULL
        )
      `);
      await exec(
        `CREATE UNIQUE INDEX IF NOT EXISTS operating_health_workspace_venture_idx ON operating_health (workspace_id, venture_id)`,
      );

      await exec(`
        CREATE TABLE IF NOT EXISTS company_stories (
          venture_id TEXT PRIMARY KEY,
          workspace_id TEXT NOT NULL,
          document_json TEXT NOT NULL,
          updated_at TEXT NOT NULL
        )
      `);

      await exec(`
        CREATE TABLE IF NOT EXISTS knowledge_nodes (
          id TEXT PRIMARY KEY,
          workspace_id TEXT NOT NULL,
          venture_id TEXT NOT NULL DEFAULT '',
          document_json TEXT NOT NULL,
          updated_at TEXT NOT NULL
        )
      `);

      await exec(`
        CREATE TABLE IF NOT EXISTS knowledge_edges (
          id TEXT PRIMARY KEY,
          workspace_id TEXT NOT NULL,
          venture_id TEXT NOT NULL DEFAULT '',
          document_json TEXT NOT NULL,
          updated_at TEXT NOT NULL
        )
      `);

      await exec(`
        CREATE TABLE IF NOT EXISTS jobs (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          payload_json TEXT NOT NULL,
          status TEXT NOT NULL,
          run_at TEXT NOT NULL,
          attempts INTEGER NOT NULL,
          last_error TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        )
      `);
      await exec(
        `CREATE INDEX IF NOT EXISTS jobs_status_run_at_idx ON jobs (status, run_at)`,
      );

      await exec(`
        CREATE TABLE IF NOT EXISTS audit_events (
          id TEXT PRIMARY KEY,
          action TEXT NOT NULL,
          occurred_at TEXT NOT NULL,
          actor_user_id TEXT,
          workspace_id TEXT NOT NULL DEFAULT '',
          venture_id TEXT NOT NULL DEFAULT '',
          metadata_json TEXT NOT NULL
        )
      `);
      await addColumn("audit_events", "actor_kind", "TEXT");
      await addColumn("audit_events", "actor_agent_instance_id", "TEXT");
      await addColumn("audit_events", "actor_component", "TEXT");
      await exec(
        `CREATE INDEX IF NOT EXISTS audit_events_occurred_at_idx ON audit_events (occurred_at)`,
      );
      await exec(
        `CREATE INDEX IF NOT EXISTS audit_events_workspace_idx ON audit_events (workspace_id)`,
      );

      await exec(`
        CREATE TABLE IF NOT EXISTS stored_object_reservations (
          scope_key TEXT PRIMARY KEY,
          request_fingerprint TEXT NOT NULL,
          object_row_json TEXT NOT NULL
        )
      `);
      await exec(`
        CREATE TABLE IF NOT EXISTS stored_objects (
          id TEXT PRIMARY KEY,
          workspace_id TEXT NOT NULL,
          venture_id TEXT,
          storage_key TEXT NOT NULL,
          original_filename TEXT NOT NULL,
          mime_type TEXT NOT NULL,
          size_bytes INTEGER NOT NULL,
          sha256 TEXT NOT NULL,
          created_by_user_id TEXT NOT NULL,
          created_at TEXT NOT NULL,
          deleted_at TEXT
        )
      `);
      await exec(
        `CREATE UNIQUE INDEX IF NOT EXISTS stored_objects_storage_key_idx ON stored_objects (storage_key)`,
      );
      await exec(
        `CREATE INDEX IF NOT EXISTS stored_objects_workspace_idx ON stored_objects (workspace_id)`,
      );
      await exec(
        `CREATE INDEX IF NOT EXISTS stored_objects_workspace_venture_idx ON stored_objects (workspace_id, venture_id)`,
      );

      await exec(`
        CREATE TABLE IF NOT EXISTS workforce_executions (
          id TEXT PRIMARY KEY,
          idempotency_key TEXT NOT NULL,
          workspace_id TEXT NOT NULL,
          venture_id TEXT NOT NULL,
          agent_instance_id TEXT NOT NULL,
          capability_id TEXT NOT NULL,
          source_request_id TEXT NOT NULL,
          source_action_index INTEGER NOT NULL,
          argument_hash TEXT NOT NULL,
          fingerprint_hash TEXT NOT NULL,
          status TEXT NOT NULL,
          authority_context_version TEXT NOT NULL,
          authority_evaluated_at TEXT NOT NULL,
          outcome_json TEXT,
          error_category TEXT,
          implementation_id TEXT,
          implementation_version TEXT,
          external_reference TEXT,
          started_at TEXT NOT NULL,
          completed_at TEXT
        )
      `);
      await exec(
        `CREATE UNIQUE INDEX IF NOT EXISTS workforce_executions_idempotency_idx ON workforce_executions (idempotency_key)`,
      );
      await exec(
        `CREATE INDEX IF NOT EXISTS workforce_executions_workspace_venture_idx ON workforce_executions (workspace_id, venture_id)`,
      );
      await exec(
        `CREATE INDEX IF NOT EXISTS workforce_executions_status_idx ON workforce_executions (status)`,
      );

      await exec(`
        CREATE TABLE IF NOT EXISTS agent_definitions (
          id TEXT NOT NULL,
          version TEXT NOT NULL,
          role TEXT NOT NULL,
          responsibilities_json TEXT NOT NULL,
          capability_allow_json TEXT NOT NULL,
          capability_deny_json TEXT NOT NULL,
          autonomy_ceiling TEXT NOT NULL,
          approval_boundary TEXT NOT NULL,
          memory_policy TEXT NOT NULL,
          escalation_policy TEXT NOT NULL,
          evaluation_profile TEXT NOT NULL,
          lifecycle TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          PRIMARY KEY (id, version)
        )
      `);

      await exec(`
        CREATE TABLE IF NOT EXISTS agent_instances (
          id TEXT PRIMARY KEY,
          definition_id TEXT NOT NULL,
          definition_version TEXT NOT NULL,
          workspace_id TEXT NOT NULL,
          venture_id TEXT NOT NULL,
          status TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        )
      `);
      await exec(
        `CREATE INDEX IF NOT EXISTS agent_instances_workspace_venture_idx ON agent_instances (workspace_id, venture_id)`,
      );

      await exec(`
        CREATE TABLE IF NOT EXISTS workforce_runs (
          id TEXT PRIMARY KEY,
          job_id TEXT,
          workspace_id TEXT NOT NULL,
          venture_id TEXT NOT NULL,
          agent_instance_id TEXT NOT NULL,
          definition_id TEXT NOT NULL,
          definition_version TEXT NOT NULL,
          objective TEXT NOT NULL,
          phase TEXT NOT NULL,
          completion_kind TEXT,
          failure_category TEXT,
          source_request_id TEXT NOT NULL,
          selected_capability_id TEXT,
          selected_action_index INTEGER,
          selected_action_json TEXT,
          argument_hash TEXT,
          fingerprint_hash TEXT,
          execution_id TEXT,
          approval_id TEXT,
          verification_outcome TEXT,
          model_call_count INTEGER NOT NULL,
          requested_by_user_id TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          completed_at TEXT
        )
      `);
      await exec(
        `CREATE INDEX IF NOT EXISTS workforce_runs_phase_idx ON workforce_runs (phase)`,
      );
      await exec(
        `CREATE INDEX IF NOT EXISTS workforce_runs_workspace_idx ON workforce_runs (workspace_id)`,
      );

      await exec(`
        CREATE TABLE IF NOT EXISTS workforce_approvals (
          id TEXT PRIMARY KEY,
          run_id TEXT NOT NULL,
          workspace_id TEXT NOT NULL,
          venture_id TEXT NOT NULL,
          agent_instance_id TEXT NOT NULL,
          capability_id TEXT NOT NULL,
          source_request_id TEXT NOT NULL,
          source_action_index INTEGER NOT NULL,
          argument_hash TEXT NOT NULL,
          fingerprint_hash TEXT NOT NULL,
          status TEXT NOT NULL,
          requested_at TEXT NOT NULL,
          expires_at TEXT NOT NULL,
          decided_at TEXT,
          decided_by_user_id TEXT
        )
      `);
      await exec(
        `CREATE UNIQUE INDEX IF NOT EXISTS workforce_approvals_run_idx ON workforce_approvals (run_id)`,
      );
      await exec(
        `CREATE INDEX IF NOT EXISTS workforce_approvals_status_workspace_idx ON workforce_approvals (status, workspace_id)`,
      );

      await addColumn("workforce_runs", "verification_outcome", "TEXT");
      await addColumn("workforce_verifications", "claim_nonce", "TEXT");

      await exec(`
        CREATE TABLE IF NOT EXISTS workforce_verifications (
          id TEXT PRIMARY KEY,
          run_id TEXT NOT NULL,
          execution_id TEXT NOT NULL,
          workspace_id TEXT NOT NULL,
          venture_id TEXT NOT NULL,
          agent_instance_id TEXT NOT NULL,
          capability_id TEXT NOT NULL,
          source_request_id TEXT NOT NULL,
          source_action_index INTEGER NOT NULL,
          predicate_id TEXT NOT NULL,
          predicate_version TEXT NOT NULL,
          predicate_fingerprint TEXT NOT NULL,
          expected_json TEXT NOT NULL,
          status TEXT NOT NULL,
          failure_category TEXT,
          attempt_count INTEGER NOT NULL,
          observation_json TEXT,
          evidence_json TEXT,
          provenance TEXT,
          claim_nonce TEXT,
          implementation_id TEXT,
          implementation_version TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          completed_at TEXT
        )
      `);
      await exec(
        `CREATE UNIQUE INDEX IF NOT EXISTS workforce_verifications_run_idx ON workforce_verifications (run_id)`,
      );
      await exec(
        `CREATE INDEX IF NOT EXISTS workforce_verifications_status_idx ON workforce_verifications (status)`,
      );

      await addColumn("workforce_executions", "implementation_id", "TEXT");
      await addColumn("workforce_executions", "implementation_version", "TEXT");
      await addColumn("workforce_executions", "external_reference", "TEXT");
      await addColumn("workforce_verifications", "implementation_id", "TEXT");
      await addColumn("workforce_verifications", "implementation_version", "TEXT");

      await exec(`
        CREATE TABLE IF NOT EXISTS frigora_customers (
          id TEXT PRIMARY KEY,
          workspace_id TEXT NOT NULL,
          venture_id TEXT NOT NULL,
          code TEXT NOT NULL,
          display_name TEXT NOT NULL,
          legal_name TEXT,
          status TEXT NOT NULL DEFAULT 'active',
          notes TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        )
      `);
      await exec(
        `CREATE UNIQUE INDEX IF NOT EXISTS frigora_customers_venture_code_idx ON frigora_customers (venture_id, code)`,
      );
      await exec(
        `CREATE INDEX IF NOT EXISTS frigora_customers_workspace_venture_idx ON frigora_customers (workspace_id, venture_id)`,
      );
      await exec(
        `CREATE INDEX IF NOT EXISTS frigora_customers_venture_status_idx ON frigora_customers (venture_id, status)`,
      );

      await exec(`
        CREATE TABLE IF NOT EXISTS frigora_sites (
          id TEXT PRIMARY KEY,
          workspace_id TEXT NOT NULL,
          venture_id TEXT NOT NULL,
          customer_id TEXT NOT NULL,
          code TEXT NOT NULL,
          name TEXT NOT NULL,
          address_line1 TEXT,
          address_line2 TEXT,
          city TEXT,
          region TEXT,
          postal_code TEXT,
          country TEXT,
          status TEXT NOT NULL DEFAULT 'active',
          notes TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        )
      `);
      await exec(
        `CREATE UNIQUE INDEX IF NOT EXISTS frigora_sites_customer_code_idx ON frigora_sites (customer_id, code)`,
      );
      await exec(
        `CREATE INDEX IF NOT EXISTS frigora_sites_workspace_venture_idx ON frigora_sites (workspace_id, venture_id)`,
      );
      await exec(
        `CREATE INDEX IF NOT EXISTS frigora_sites_customer_idx ON frigora_sites (customer_id)`,
      );
      await exec(
        `CREATE INDEX IF NOT EXISTS frigora_sites_venture_status_idx ON frigora_sites (venture_id, status)`,
      );

      await exec(`
        CREATE TABLE IF NOT EXISTS frigora_assets (
          id TEXT PRIMARY KEY,
          workspace_id TEXT NOT NULL,
          venture_id TEXT NOT NULL,
          site_id TEXT NOT NULL,
          tag TEXT NOT NULL,
          name TEXT,
          asset_kind TEXT,
          manufacturer TEXT,
          model TEXT,
          serial_number TEXT,
          status TEXT NOT NULL DEFAULT 'active',
          design_target_celsius REAL,
          refrigerant_type TEXT,
          location_on_site TEXT,
          installed_on TEXT,
          commissioned_on TEXT,
          notes TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        )
      `);
      await exec(
        `CREATE UNIQUE INDEX IF NOT EXISTS frigora_assets_site_tag_idx ON frigora_assets (site_id, tag)`,
      );
      await exec(
        `CREATE UNIQUE INDEX IF NOT EXISTS frigora_assets_venture_serial_idx ON frigora_assets (venture_id, serial_number) WHERE serial_number IS NOT NULL`,
      );
      await exec(
        `CREATE INDEX IF NOT EXISTS frigora_assets_workspace_venture_idx ON frigora_assets (workspace_id, venture_id)`,
      );
      await exec(
        `CREATE INDEX IF NOT EXISTS frigora_assets_site_idx ON frigora_assets (site_id)`,
      );
      await exec(
        `CREATE INDEX IF NOT EXISTS frigora_assets_venture_status_idx ON frigora_assets (venture_id, status)`,
      );

      await exec(`
        CREATE TABLE IF NOT EXISTS frigora_work_orders (
          id TEXT PRIMARY KEY,
          workspace_id TEXT NOT NULL,
          venture_id TEXT NOT NULL,
          customer_id TEXT NOT NULL,
          site_id TEXT NOT NULL,
          primary_asset_id TEXT,
          work_reference TEXT NOT NULL,
          work_kind TEXT NOT NULL,
          priority TEXT NOT NULL DEFAULT 'normal',
          reported_condition TEXT,
          status TEXT NOT NULL DEFAULT 'open',
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          assigned_user_id TEXT,
          scheduled_start_at TEXT,
          scheduled_end_at TEXT,
          assignment_accepted_at TEXT,
          assignment_declined_at TEXT,
          assignment_decline_reason TEXT
        )
      `);
      await exec(
        `CREATE UNIQUE INDEX IF NOT EXISTS frigora_work_orders_venture_reference_idx ON frigora_work_orders (venture_id, work_reference)`,
      );
      await exec(
        `CREATE INDEX IF NOT EXISTS frigora_work_orders_workspace_venture_idx ON frigora_work_orders (workspace_id, venture_id)`,
      );
      await exec(
        `CREATE INDEX IF NOT EXISTS frigora_work_orders_venture_status_idx ON frigora_work_orders (venture_id, status)`,
      );
      await exec(
        `CREATE INDEX IF NOT EXISTS frigora_work_orders_customer_idx ON frigora_work_orders (customer_id)`,
      );
      await exec(
        `CREATE INDEX IF NOT EXISTS frigora_work_orders_site_idx ON frigora_work_orders (site_id)`,
      );
      await exec(
        `CREATE INDEX IF NOT EXISTS frigora_work_orders_primary_asset_idx ON frigora_work_orders (primary_asset_id)`,
      );
      await addColumn("frigora_work_orders", "assigned_user_id", "TEXT");
      await addColumn("frigora_work_orders", "scheduled_start_at", "TEXT");
      await addColumn("frigora_work_orders", "scheduled_end_at", "TEXT");
      await addColumn("frigora_work_orders", "assignment_accepted_at", "TEXT");
      await addColumn("frigora_work_orders", "assignment_declined_at", "TEXT");
      await addColumn("frigora_work_orders", "assignment_decline_reason", "TEXT");
      await exec(
        `CREATE INDEX IF NOT EXISTS frigora_work_orders_venture_assignee_idx ON frigora_work_orders (venture_id, assigned_user_id)`,
      );
      await exec(
        `CREATE INDEX IF NOT EXISTS frigora_work_orders_venture_scheduled_start_idx ON frigora_work_orders (venture_id, scheduled_start_at)`,
      );
      await addColumn("frigora_work_orders", "priority", "TEXT NOT NULL DEFAULT 'normal'");
      await addColumn("frigora_work_orders", "cancellation_reason", "TEXT");
      await addColumn("frigora_work_orders", "source_recommended_action_id", "TEXT");
      await addColumn("frigora_work_orders", "authorising_quotation_id", "TEXT");
      await addColumn("frigora_work_orders", "authorising_quotation_version", "INTEGER");
      await exec(
        `CREATE UNIQUE INDEX IF NOT EXISTS frigora_work_orders_source_recommended_action_idx ON frigora_work_orders (source_recommended_action_id) WHERE source_recommended_action_id IS NOT NULL`,
      );

      await exec(`
        CREATE TABLE IF NOT EXISTS frigora_visits (
          id TEXT PRIMARY KEY,
          workspace_id TEXT NOT NULL,
          venture_id TEXT NOT NULL,
          work_order_id TEXT NOT NULL,
          attending_user_id TEXT NOT NULL,
          arrived_at TEXT NOT NULL,
          departed_at TEXT,
          status TEXT NOT NULL DEFAULT 'open',
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        )
      `);
      await exec(
        `CREATE INDEX IF NOT EXISTS frigora_visits_workspace_venture_idx ON frigora_visits (workspace_id, venture_id)`,
      );
      await exec(
        `CREATE INDEX IF NOT EXISTS frigora_visits_venture_work_order_idx ON frigora_visits (venture_id, work_order_id)`,
      );
      await exec(
        `CREATE INDEX IF NOT EXISTS frigora_visits_venture_attending_user_idx ON frigora_visits (venture_id, attending_user_id)`,
      );

      await exec(`
        CREATE TABLE IF NOT EXISTS frigora_field_captures (
          id TEXT PRIMARY KEY,
          workspace_id TEXT NOT NULL,
          venture_id TEXT NOT NULL,
          visit_id TEXT NOT NULL,
          work_order_id TEXT NOT NULL,
          asset_id TEXT,
          capture_kind TEXT NOT NULL,
          capture_code TEXT NOT NULL,
          value_numeric REAL,
          value_unit TEXT,
          description TEXT,
          observed_at TEXT NOT NULL,
          captured_by_user_id TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        )
      `);
      await exec(
        `CREATE INDEX IF NOT EXISTS frigora_field_captures_venture_visit_idx ON frigora_field_captures (venture_id, visit_id)`,
      );
      await exec(
        `CREATE INDEX IF NOT EXISTS frigora_field_captures_venture_work_order_idx ON frigora_field_captures (venture_id, work_order_id)`,
      );
      await exec(
        `CREATE INDEX IF NOT EXISTS frigora_field_captures_venture_asset_idx ON frigora_field_captures (venture_id, asset_id)`,
      );

      await exec(`
        CREATE TABLE IF NOT EXISTS frigora_technical_findings (
          id TEXT PRIMARY KEY,
          workspace_id TEXT NOT NULL,
          venture_id TEXT NOT NULL,
          visit_id TEXT NOT NULL,
          work_order_id TEXT NOT NULL,
          asset_id TEXT,
          finding_kind TEXT NOT NULL,
          description TEXT NOT NULL,
          source_field_capture_ids TEXT,
          asserted_at TEXT NOT NULL,
          recorded_by_user_id TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        )
      `);
      await exec(
        `CREATE INDEX IF NOT EXISTS frigora_technical_findings_venture_visit_idx ON frigora_technical_findings (venture_id, visit_id)`,
      );
      await exec(
        `CREATE INDEX IF NOT EXISTS frigora_technical_findings_venture_work_order_idx ON frigora_technical_findings (venture_id, work_order_id)`,
      );
      await exec(
        `CREATE INDEX IF NOT EXISTS frigora_technical_findings_venture_asset_idx ON frigora_technical_findings (venture_id, asset_id)`,
      );

      await exec(`
        CREATE TABLE IF NOT EXISTS frigora_corrective_actions (
          id TEXT PRIMARY KEY,
          workspace_id TEXT NOT NULL,
          venture_id TEXT NOT NULL,
          visit_id TEXT NOT NULL,
          work_order_id TEXT NOT NULL,
          asset_id TEXT,
          description TEXT NOT NULL,
          source_technical_finding_ids TEXT,
          performed_at TEXT NOT NULL,
          performed_by_user_id TEXT NOT NULL,
          recorded_by_user_id TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        )
      `);
      await exec(
        `CREATE INDEX IF NOT EXISTS frigora_corrective_actions_venture_visit_idx ON frigora_corrective_actions (venture_id, visit_id)`,
      );
      await exec(
        `CREATE INDEX IF NOT EXISTS frigora_corrective_actions_venture_work_order_idx ON frigora_corrective_actions (venture_id, work_order_id)`,
      );
      await exec(
        `CREATE INDEX IF NOT EXISTS frigora_corrective_actions_venture_asset_idx ON frigora_corrective_actions (venture_id, asset_id)`,
      );

      await exec(`
        CREATE TABLE IF NOT EXISTS frigora_visit_outcomes (
          id TEXT PRIMARY KEY,
          workspace_id TEXT NOT NULL,
          venture_id TEXT NOT NULL,
          visit_id TEXT NOT NULL,
          work_order_id TEXT NOT NULL,
          asset_id TEXT,
          description TEXT NOT NULL,
          outcome_at TEXT NOT NULL,
          recorded_by_user_id TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        )
      `);
      await exec(
        `CREATE UNIQUE INDEX IF NOT EXISTS frigora_visit_outcomes_venture_visit_unique_idx ON frigora_visit_outcomes (venture_id, visit_id)`,
      );
      await exec(
        `CREATE INDEX IF NOT EXISTS frigora_visit_outcomes_venture_work_order_idx ON frigora_visit_outcomes (venture_id, work_order_id)`,
      );
      await exec(
        `CREATE INDEX IF NOT EXISTS frigora_visit_outcomes_venture_asset_idx ON frigora_visit_outcomes (venture_id, asset_id)`,
      );

      await exec(`
        CREATE TABLE IF NOT EXISTS frigora_recommended_actions (
          id TEXT PRIMARY KEY,
          workspace_id TEXT NOT NULL,
          venture_id TEXT NOT NULL,
          visit_id TEXT NOT NULL,
          work_order_id TEXT NOT NULL,
          asset_id TEXT,
          description TEXT NOT NULL,
          recommended_at TEXT NOT NULL,
          recommended_by_user_id TEXT NOT NULL,
          recorded_by_user_id TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        )
      `);
      await exec(
        `CREATE INDEX IF NOT EXISTS frigora_recommended_actions_venture_visit_idx ON frigora_recommended_actions (venture_id, visit_id)`,
      );
      await exec(
        `CREATE INDEX IF NOT EXISTS frigora_recommended_actions_venture_work_order_idx ON frigora_recommended_actions (venture_id, work_order_id)`,
      );
      await exec(
        `CREATE INDEX IF NOT EXISTS frigora_recommended_actions_venture_asset_idx ON frigora_recommended_actions (venture_id, asset_id)`,
      );
      await addColumn(
        "frigora_recommended_actions",
        "quotation_required",
        "INTEGER NOT NULL DEFAULT 0",
      );

      await exec(`
        CREATE TABLE IF NOT EXISTS frigora_refrigerant_events (
          id TEXT PRIMARY KEY,
          workspace_id TEXT NOT NULL,
          venture_id TEXT NOT NULL,
          visit_id TEXT NOT NULL,
          work_order_id TEXT NOT NULL,
          asset_id TEXT,
          refrigerant_type TEXT NOT NULL,
          event_kind TEXT NOT NULL,
          quantity_kg REAL NOT NULL,
          reason TEXT,
          cylinder_reference TEXT,
          occurred_at TEXT NOT NULL,
          handled_by_user_id TEXT NOT NULL,
          recorded_by_user_id TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        )
      `);
      await exec(
        `CREATE INDEX IF NOT EXISTS frigora_refrigerant_events_venture_visit_idx ON frigora_refrigerant_events (venture_id, visit_id)`,
      );
      await exec(
        `CREATE INDEX IF NOT EXISTS frigora_refrigerant_events_venture_work_order_idx ON frigora_refrigerant_events (venture_id, work_order_id)`,
      );
      await exec(
        `CREATE INDEX IF NOT EXISTS frigora_refrigerant_events_venture_asset_idx ON frigora_refrigerant_events (venture_id, asset_id)`,
      );

      await exec(`
        CREATE TABLE IF NOT EXISTS frigora_part_usages (
          id TEXT PRIMARY KEY,
          workspace_id TEXT NOT NULL,
          venture_id TEXT NOT NULL,
          visit_id TEXT NOT NULL,
          work_order_id TEXT NOT NULL,
          asset_id TEXT,
          part_description TEXT NOT NULL,
          quantity REAL NOT NULL,
          quantity_unit TEXT NOT NULL,
          notes TEXT,
          used_at TEXT NOT NULL,
          used_by_user_id TEXT NOT NULL,
          recorded_by_user_id TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        )
      `);
      await exec(
        `CREATE INDEX IF NOT EXISTS frigora_part_usages_venture_visit_idx ON frigora_part_usages (venture_id, visit_id)`,
      );
      await exec(
        `CREATE INDEX IF NOT EXISTS frigora_part_usages_venture_work_order_idx ON frigora_part_usages (venture_id, work_order_id)`,
      );
      await exec(
        `CREATE INDEX IF NOT EXISTS frigora_part_usages_venture_asset_idx ON frigora_part_usages (venture_id, asset_id)`,
      );

      await addColumn("frigora_refrigerant_events", "refrigerant_reference_id", "TEXT");
      await addColumn("frigora_part_usages", "part_reference_id", "TEXT");
      await addColumn("frigora_visits", "labour_hourly_charge_cents", "INTEGER");
      await addColumn("frigora_part_usages", "unit_charge_cents", "INTEGER");
      await addColumn("frigora_refrigerant_events", "charge_per_kg_cents", "INTEGER");

      await exec(`
        CREATE TABLE IF NOT EXISTS frigora_part_references (
          id TEXT PRIMARY KEY,
          workspace_id TEXT NOT NULL,
          venture_id TEXT NOT NULL,
          display_name TEXT NOT NULL,
          default_quantity_unit TEXT NOT NULL,
          status TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        )
      `);
      await exec(
        `CREATE INDEX IF NOT EXISTS frigora_part_references_venture_status_idx ON frigora_part_references (venture_id, status)`,
      );

      await exec(`
        CREATE TABLE IF NOT EXISTS frigora_refrigerant_references (
          id TEXT PRIMARY KEY,
          workspace_id TEXT NOT NULL,
          venture_id TEXT NOT NULL,
          canonical_code TEXT NOT NULL,
          display_name TEXT NOT NULL,
          status TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        )
      `);
      await exec(
        `CREATE UNIQUE INDEX IF NOT EXISTS frigora_refrigerant_references_venture_code_idx ON frigora_refrigerant_references (workspace_id, venture_id, canonical_code)`,
      );
      await exec(
        `CREATE INDEX IF NOT EXISTS frigora_refrigerant_references_venture_status_idx ON frigora_refrigerant_references (venture_id, status)`,
      );

      await addColumn("frigora_part_references", "default_unit_charge_cents", "INTEGER");
      await addColumn("frigora_refrigerant_references", "default_charge_per_kg_cents", "INTEGER");

      await exec(`
        CREATE TABLE IF NOT EXISTS frigora_venture_commercial_settings (
          workspace_id TEXT NOT NULL,
          venture_id TEXT NOT NULL,
          labour_hourly_charge_cents INTEGER,
          updated_at TEXT NOT NULL,
          PRIMARY KEY (workspace_id, venture_id)
        )
      `);

      await exec(`
        CREATE TABLE IF NOT EXISTS frigora_asset_operational_conditions (
          id TEXT PRIMARY KEY,
          workspace_id TEXT NOT NULL,
          venture_id TEXT NOT NULL,
          asset_id TEXT NOT NULL,
          condition_kind TEXT NOT NULL,
          notes TEXT,
          visit_id TEXT,
          work_order_id TEXT,
          asserted_at TEXT NOT NULL,
          asserted_by_user_id TEXT NOT NULL,
          recorded_by_user_id TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        )
      `);
      await exec(
        `CREATE INDEX IF NOT EXISTS frigora_asset_operational_conditions_venture_asset_idx ON frigora_asset_operational_conditions (venture_id, asset_id)`,
      );
      await exec(
        `CREATE INDEX IF NOT EXISTS frigora_asset_operational_conditions_venture_visit_idx ON frigora_asset_operational_conditions (venture_id, visit_id)`,
      );
      await exec(
        `CREATE INDEX IF NOT EXISTS frigora_asset_operational_conditions_venture_work_order_idx ON frigora_asset_operational_conditions (venture_id, work_order_id)`,
      );

      await exec(`
        CREATE TABLE IF NOT EXISTS frigora_visit_customer_acknowledgements (
          id TEXT PRIMARY KEY,
          workspace_id TEXT NOT NULL,
          venture_id TEXT NOT NULL,
          visit_id TEXT NOT NULL,
          work_order_id TEXT NOT NULL,
          acknowledgement_text TEXT NOT NULL,
          acknowledger_name TEXT NOT NULL,
          acknowledged_at TEXT NOT NULL,
          recorded_by_user_id TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        )
      `);
      await exec(
        `CREATE INDEX IF NOT EXISTS frigora_visit_customer_acknowledgements_venture_visit_idx ON frigora_visit_customer_acknowledgements (venture_id, visit_id)`,
      );
      await exec(
        `CREATE INDEX IF NOT EXISTS frigora_visit_customer_acknowledgements_venture_work_order_idx ON frigora_visit_customer_acknowledgements (venture_id, work_order_id)`,
      );

      await exec(`
        CREATE TABLE IF NOT EXISTS frigora_visit_evidence (
          id TEXT PRIMARY KEY,
          workspace_id TEXT NOT NULL,
          venture_id TEXT NOT NULL,
          visit_id TEXT NOT NULL,
          work_order_id TEXT NOT NULL,
          asset_id TEXT,
          stored_object_id TEXT NOT NULL,
          category TEXT NOT NULL,
          description TEXT,
          captured_at TEXT NOT NULL,
          recorded_by_user_id TEXT NOT NULL,
          created_at TEXT NOT NULL,
          removed_at TEXT,
          original_filename TEXT NOT NULL,
          mime_type TEXT NOT NULL,
          size_bytes INTEGER NOT NULL
        )
      `);
      await exec(
        `CREATE UNIQUE INDEX IF NOT EXISTS frigora_visit_evidence_venture_stored_object_idx ON frigora_visit_evidence (venture_id, stored_object_id)`,
      );
      await exec(
        `CREATE INDEX IF NOT EXISTS frigora_visit_evidence_venture_visit_idx ON frigora_visit_evidence (venture_id, visit_id)`,
      );
      await exec(
        `CREATE INDEX IF NOT EXISTS frigora_visit_evidence_venture_work_order_idx ON frigora_visit_evidence (venture_id, work_order_id)`,
      );
      await exec(
        `CREATE INDEX IF NOT EXISTS frigora_visit_evidence_venture_asset_idx ON frigora_visit_evidence (venture_id, asset_id)`,
      );

      await exec(`
        CREATE TABLE IF NOT EXISTS frigora_client_operation_receipts (
          id TEXT PRIMARY KEY,
          workspace_id TEXT NOT NULL,
          venture_id TEXT NOT NULL,
          actor_user_id TEXT NOT NULL,
          client_operation_id TEXT NOT NULL,
          operation_type TEXT NOT NULL,
          work_order_id TEXT NOT NULL,
          visit_id TEXT,
          request_fingerprint TEXT NOT NULL,
          accepted_entity_id TEXT NOT NULL,
          accepted_at TEXT NOT NULL,
          created_at TEXT NOT NULL
        )
      `);
      await exec(
        `CREATE UNIQUE INDEX IF NOT EXISTS frigora_client_operation_receipts_venture_client_op_idx ON frigora_client_operation_receipts (venture_id, client_operation_id)`,
      );
      await exec(
        `CREATE INDEX IF NOT EXISTS frigora_client_operation_receipts_workspace_venture_idx ON frigora_client_operation_receipts (workspace_id, venture_id)`,
      );

      await exec(`
        CREATE TABLE IF NOT EXISTS frigora_engineer_unavailability (
          id TEXT PRIMARY KEY,
          workspace_id TEXT NOT NULL,
          venture_id TEXT NOT NULL,
          user_id TEXT NOT NULL,
          unavailable_start_at TEXT NOT NULL,
          unavailable_end_at TEXT NOT NULL,
          created_by_user_id TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          CHECK (unavailable_end_at > unavailable_start_at)
        )
      `);
      await exec(`CREATE INDEX IF NOT EXISTS frigora_unavailability_engineer_range_idx
        ON frigora_engineer_unavailability (workspace_id, venture_id, user_id, unavailable_start_at, unavailable_end_at)`);
      await exec(`CREATE INDEX IF NOT EXISTS frigora_unavailability_venture_date_idx
        ON frigora_engineer_unavailability (workspace_id, venture_id, unavailable_start_at, unavailable_end_at)`);

      await exec(`
        CREATE TABLE IF NOT EXISTS frigora_dispatch_events (
          id TEXT PRIMARY KEY,
          workspace_id TEXT NOT NULL,
          venture_id TEXT NOT NULL,
          work_order_id TEXT NOT NULL,
          event_type TEXT NOT NULL,
          actor_user_id TEXT NOT NULL,
          occurred_at TEXT NOT NULL,
          previous_assigned_user_id TEXT,
          next_assigned_user_id TEXT,
          previous_scheduled_start_at TEXT,
          previous_scheduled_end_at TEXT,
          next_scheduled_start_at TEXT,
          next_scheduled_end_at TEXT,
          CHECK (
            event_type IN (
              'ASSIGNED',
              'UNASSIGNED',
              'REASSIGNED',
              'SCHEDULED',
              'RESCHEDULED',
              'SCHEDULE_CLEARED'
            )
          )
        )
      `);
      await exec(
        `CREATE INDEX IF NOT EXISTS frigora_dispatch_events_ws_ven_wo_occurred_idx ON frigora_dispatch_events (workspace_id, venture_id, work_order_id, occurred_at)`,
      );
      await exec(
        `CREATE INDEX IF NOT EXISTS frigora_dispatch_events_ws_ven_occurred_idx ON frigora_dispatch_events (workspace_id, venture_id, occurred_at)`,
      );
      await exec(`
        CREATE TABLE IF NOT EXISTS frigora_quotations (
          id TEXT PRIMARY KEY,
          workspace_id TEXT NOT NULL,
          venture_id TEXT NOT NULL,
          customer_id TEXT NOT NULL,
          site_id TEXT NOT NULL,
          asset_id TEXT,
          original_work_order_id TEXT NOT NULL,
          recommended_action_id TEXT NOT NULL,
          current_version INTEGER NOT NULL CHECK (current_version >= 1),
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        )
      `);
      await exec(
        `CREATE INDEX IF NOT EXISTS frigora_quotations_workspace_venture_idx ON frigora_quotations (workspace_id, venture_id)`,
      );
      await exec(
        `CREATE INDEX IF NOT EXISTS frigora_quotations_work_order_idx ON frigora_quotations (venture_id, original_work_order_id)`,
      );
      await exec(
        `CREATE INDEX IF NOT EXISTS frigora_quotations_asset_idx ON frigora_quotations (venture_id, asset_id)`,
      );
      await exec(
        `CREATE INDEX IF NOT EXISTS frigora_quotations_recommended_action_idx ON frigora_quotations (venture_id, recommended_action_id)`,
      );

      await exec(`CREATE TABLE IF NOT EXISTS frigora_quotation_versions (${QUOTATION_VERSION_DDL})`);
      await ensureQuotationCommercialColumns();
      await ensureTaxConfigurationTables();
      await widenQuotationTableCheck({
        name: "frigora_quotation_versions",
        columns: QUOTATION_VERSION_DDL,
        copyColumns: `quotation_id, workspace_id, venture_id, version_number, status, description,
          total_minor, currency, document_hash, sent_at, recipient, dispatch_evidence_ref`,
      });
      await exec(
        `CREATE INDEX IF NOT EXISTS frigora_quotation_versions_scope_idx ON frigora_quotation_versions (workspace_id, venture_id, quotation_id)`,
      );
      await exec(`CREATE TABLE IF NOT EXISTS frigora_quotation_events (${QUOTATION_EVENT_DDL})`);
      await widenQuotationTableCheck({
        name: "frigora_quotation_events",
        columns: QUOTATION_EVENT_DDL,
        copyColumns: `id, quotation_id, workspace_id, venture_id, version_number, kind,
          occurred_at, actor_user_id, evidence_ref`,
      });
      await ensureQuotationEventActorShape();
      await exec(
        `CREATE INDEX IF NOT EXISTS frigora_quotation_events_scope_idx ON frigora_quotation_events (workspace_id, venture_id, quotation_id, occurred_at)`,
      );
      await exec(`
        CREATE TABLE IF NOT EXISTS frigora_quotation_decision_grants (
          id TEXT PRIMARY KEY,
          secret_hash TEXT NOT NULL UNIQUE,
          quotation_id TEXT NOT NULL,
          workspace_id TEXT NOT NULL,
          venture_id TEXT NOT NULL,
          customer_id TEXT NOT NULL,
          site_id TEXT NOT NULL,
          version_number INTEGER NOT NULL,
          document_hash TEXT NOT NULL,
          expires_at TEXT NOT NULL,
          issued_at TEXT NOT NULL,
          issued_by_user_id TEXT NOT NULL,
          consumed_at TEXT,
          decision_id TEXT,
          revoked_at TEXT,
          contact_id TEXT
        )
      `);
      await exec(
        `CREATE INDEX IF NOT EXISTS frigora_quotation_decision_grants_target_idx ON frigora_quotation_decision_grants (workspace_id, venture_id, quotation_id, version_number)`,
      );
      await addColumn("frigora_quotation_decision_grants", "revoked_at", "TEXT");
      await addColumn("frigora_quotation_decision_grants", "contact_id", "TEXT");
      await exec(`
        CREATE TABLE IF NOT EXISTS frigora_quotation_decisions (
          id TEXT PRIMARY KEY,
          quotation_id TEXT NOT NULL,
          workspace_id TEXT NOT NULL,
          venture_id TEXT NOT NULL,
          customer_id TEXT NOT NULL,
          site_id TEXT NOT NULL,
          version_number INTEGER NOT NULL,
          document_hash TEXT NOT NULL,
          decision TEXT NOT NULL CHECK (decision IN ('approved', 'declined')),
          grant_id TEXT NOT NULL UNIQUE,
          decided_at TEXT NOT NULL,
          UNIQUE (quotation_id, version_number)
        )
      `);
      await exec(
        `CREATE INDEX IF NOT EXISTS frigora_quotation_decisions_scope_idx ON frigora_quotation_decisions (workspace_id, venture_id, quotation_id)`,
      );
      await ensureQuotationDeliveryOutbox();
      await ensureQuotationCustomerDelivery();
      await exec("DROP TRIGGER IF EXISTS frigora_quotation_versions_commercial_immutable");
      await exec(`
        CREATE TRIGGER frigora_quotation_versions_commercial_immutable
        BEFORE UPDATE ON frigora_quotation_versions
        WHEN OLD.status != 'in_preparation'
          AND (
          NEW.description != OLD.description
          OR NEW.total_minor != OLD.total_minor
          OR NEW.currency != OLD.currency
          OR NEW.document_hash != OLD.document_hash
          OR NEW.version_number != OLD.version_number
          OR NEW.quotation_id != OLD.quotation_id
          OR NEW.workspace_id != OLD.workspace_id
          OR NEW.venture_id != OLD.venture_id
          OR NEW.labour_quantity_milli IS NOT OLD.labour_quantity_milli
          OR NEW.labour_unit IS NOT OLD.labour_unit
          OR NEW.labour_rate_minor IS NOT OLD.labour_rate_minor
          OR NEW.labour_amount_minor IS NOT OLD.labour_amount_minor
          OR NEW.travel_kilometres_milli IS NOT OLD.travel_kilometres_milli
          OR NEW.distance_basis IS NOT OLD.distance_basis
          OR NEW.travel_rate_minor IS NOT OLD.travel_rate_minor
          OR NEW.travel_amount_minor IS NOT OLD.travel_amount_minor
          OR NEW.tax_treatment IS NOT OLD.tax_treatment
          OR NEW.tax_rule_id IS NOT OLD.tax_rule_id
          OR NEW.tax_rule_version IS NOT OLD.tax_rule_version
          OR NEW.tax_rate_numerator IS NOT OLD.tax_rate_numerator
          OR NEW.tax_rate_denominator IS NOT OLD.tax_rate_denominator
          OR NEW.taxable_amount_minor IS NOT OLD.taxable_amount_minor
          OR NEW.tax_amount_minor IS NOT OLD.tax_amount_minor
          )
        BEGIN
          SELECT RAISE(ABORT, 'quotation version commercial content is immutable');
        END
      `);
      await exec("DROP TRIGGER IF EXISTS frigora_quotation_versions_sent_immutable");
      await exec(`
        CREATE TRIGGER frigora_quotation_versions_sent_immutable
        BEFORE UPDATE ON frigora_quotation_versions
        WHEN OLD.status = 'awaiting_customer_approval'
          AND (
            NEW.status NOT IN ('approved', 'declined')
            OR NEW.sent_at IS NOT OLD.sent_at
            OR NEW.recipient IS NOT OLD.recipient
            OR NEW.dispatch_evidence_ref IS NOT OLD.dispatch_evidence_ref
            OR NEW.description != OLD.description
            OR NEW.total_minor != OLD.total_minor
            OR NEW.currency != OLD.currency
            OR NEW.document_hash != OLD.document_hash
            OR NEW.version_number != OLD.version_number
            OR NEW.quotation_id != OLD.quotation_id
            OR NEW.workspace_id != OLD.workspace_id
            OR NEW.venture_id != OLD.venture_id
            OR NEW.labour_quantity_milli IS NOT OLD.labour_quantity_milli
            OR NEW.labour_unit IS NOT OLD.labour_unit
            OR NEW.labour_rate_minor IS NOT OLD.labour_rate_minor
            OR NEW.labour_amount_minor IS NOT OLD.labour_amount_minor
            OR NEW.travel_kilometres_milli IS NOT OLD.travel_kilometres_milli
            OR NEW.distance_basis IS NOT OLD.distance_basis
            OR NEW.travel_rate_minor IS NOT OLD.travel_rate_minor
            OR NEW.travel_amount_minor IS NOT OLD.travel_amount_minor
            OR NEW.tax_treatment IS NOT OLD.tax_treatment
            OR NEW.tax_rule_id IS NOT OLD.tax_rule_id
            OR NEW.tax_rule_version IS NOT OLD.tax_rule_version
            OR NEW.tax_rate_numerator IS NOT OLD.tax_rate_numerator
            OR NEW.tax_rate_denominator IS NOT OLD.tax_rate_denominator
            OR NEW.taxable_amount_minor IS NOT OLD.taxable_amount_minor
            OR NEW.tax_amount_minor IS NOT OLD.tax_amount_minor
          )
        BEGIN
          SELECT RAISE(ABORT, 'sent quotation version is immutable');
        END
      `);
      await exec("DROP TRIGGER IF EXISTS frigora_quotation_versions_decided_immutable");
      await exec(`
        CREATE TRIGGER frigora_quotation_versions_decided_immutable
        BEFORE UPDATE ON frigora_quotation_versions
        WHEN OLD.status IN ('approved', 'declined')
        BEGIN
          SELECT RAISE(ABORT, 'decided quotation version is immutable');
        END
      `);
      await exec("DROP TRIGGER IF EXISTS frigora_quotation_versions_no_direct_decision");
      await exec(`
        CREATE TRIGGER frigora_quotation_versions_no_direct_decision
        BEFORE INSERT ON frigora_quotation_versions
        WHEN NEW.status IN ('approved', 'declined')
        BEGIN
          SELECT RAISE(ABORT, 'quotation decision cannot be inserted directly');
        END
      `);
      await exec("DROP TRIGGER IF EXISTS frigora_quotation_versions_decision_required");
      await exec(`
        CREATE TRIGGER frigora_quotation_versions_decision_required
        BEFORE UPDATE ON frigora_quotation_versions
        WHEN NEW.status IN ('approved', 'declined')
          AND NOT EXISTS (
            SELECT 1 FROM frigora_quotation_decisions
            WHERE quotation_id = NEW.quotation_id
              AND version_number = NEW.version_number
              AND decision = NEW.status
              AND document_hash = NEW.document_hash
              AND workspace_id = NEW.workspace_id
              AND venture_id = NEW.venture_id
          )
        BEGIN
          SELECT RAISE(ABORT, 'quotation decision is missing');
        END
      `);
      await exec("DROP TRIGGER IF EXISTS frigora_quotation_events_no_update");
      await exec(`
        CREATE TRIGGER frigora_quotation_events_no_update
        BEFORE UPDATE ON frigora_quotation_events
        BEGIN
          SELECT RAISE(ABORT, 'quotation events are append-only');
        END
      `);
      await exec("DROP TRIGGER IF EXISTS frigora_quotation_events_no_delete");
      await exec(`
        CREATE TRIGGER frigora_quotation_events_no_delete
        BEFORE DELETE ON frigora_quotation_events
        BEGIN
          SELECT RAISE(ABORT, 'quotation events are append-only');
        END
      `);
      await exec("DROP TRIGGER IF EXISTS frigora_quotation_events_decision_required");
      await exec(`
        CREATE TRIGGER frigora_quotation_events_decision_required
        BEFORE INSERT ON frigora_quotation_events
        WHEN NEW.kind IN ('approved', 'declined')
          AND NOT EXISTS (
            SELECT 1 FROM frigora_quotation_decisions
            WHERE id = NEW.evidence_ref
              AND quotation_id = NEW.quotation_id
              AND version_number = NEW.version_number
              AND decision = NEW.kind
              AND workspace_id = NEW.workspace_id
              AND venture_id = NEW.venture_id
          )
        BEGIN
          SELECT RAISE(ABORT, 'quotation decision event requires a decision');
        END
      `);
      await exec("DROP TRIGGER IF EXISTS frigora_quotation_decision_grants_consume_only");
      await exec(`
        CREATE TRIGGER frigora_quotation_decision_grants_consume_only
        BEFORE UPDATE ON frigora_quotation_decision_grants
        WHEN OLD.consumed_at IS NOT NULL
          OR OLD.revoked_at IS NOT NULL
          OR NEW.id != OLD.id
          OR NEW.contact_id IS NOT OLD.contact_id
          OR NEW.secret_hash != OLD.secret_hash
          OR NEW.quotation_id != OLD.quotation_id
          OR NEW.workspace_id != OLD.workspace_id
          OR NEW.venture_id != OLD.venture_id
          OR NEW.customer_id != OLD.customer_id
          OR NEW.site_id != OLD.site_id
          OR NEW.version_number != OLD.version_number
          OR NEW.document_hash != OLD.document_hash
          OR NEW.expires_at != OLD.expires_at
          OR NEW.issued_at != OLD.issued_at
          OR NEW.issued_by_user_id != OLD.issued_by_user_id
        BEGIN
          SELECT RAISE(ABORT, 'decision grant is immutable');
        END
      `);
      await exec("DROP TRIGGER IF EXISTS frigora_quotation_decisions_no_update");
      await exec(`
        CREATE TRIGGER frigora_quotation_decisions_no_update
        BEFORE UPDATE ON frigora_quotation_decisions
        BEGIN
          SELECT RAISE(ABORT, 'quotation decisions are immutable');
        END
      `);
      await exec("DROP TRIGGER IF EXISTS frigora_quotation_decisions_no_delete");
      await exec(`
        CREATE TRIGGER frigora_quotation_decisions_no_delete
        BEFORE DELETE ON frigora_quotation_decisions
        BEGIN
          SELECT RAISE(ABORT, 'quotation decisions are immutable');
        END
      `);

      await exec(`
        CREATE TABLE IF NOT EXISTS frigora_customer_contacts (
          id TEXT PRIMARY KEY,
          workspace_id TEXT NOT NULL,
          venture_id TEXT NOT NULL,
          customer_id TEXT NOT NULL,
          site_id TEXT NOT NULL,
          display_name TEXT NOT NULL,
          email TEXT NOT NULL,
          email_verified_at TEXT,
          status TEXT NOT NULL CHECK (status IN ('active', 'revoked')),
          created_by_user_id TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          UNIQUE (venture_id, site_id, email)
        )
      `);
      await exec(
        `CREATE INDEX IF NOT EXISTS frigora_customer_contacts_scope_idx ON frigora_customer_contacts (workspace_id, venture_id, customer_id)`,
      );
      await exec(`
        CREATE TABLE IF NOT EXISTS frigora_quotation_contact_designations (
          contact_id TEXT PRIMARY KEY,
          workspace_id TEXT NOT NULL,
          venture_id TEXT NOT NULL,
          customer_id TEXT NOT NULL,
          site_id TEXT NOT NULL,
          basis TEXT NOT NULL,
          designated_by_user_id TEXT NOT NULL,
          designated_at TEXT NOT NULL,
          revoked_at TEXT,
          revoked_by_user_id TEXT
        )
      `);
      await exec(`
        CREATE TABLE IF NOT EXISTS frigora_contact_verification_challenges (
          id TEXT PRIMARY KEY,
          contact_id TEXT NOT NULL,
          workspace_id TEXT NOT NULL,
          venture_id TEXT NOT NULL,
          customer_id TEXT NOT NULL,
          site_id TEXT NOT NULL,
          secret_hash TEXT NOT NULL UNIQUE,
          expires_at TEXT NOT NULL,
          created_at TEXT NOT NULL,
          consumed_at TEXT,
          revoked_at TEXT
        )
      `);
      await exec(
        `CREATE INDEX IF NOT EXISTS frigora_contact_verification_challenges_contact_idx ON frigora_contact_verification_challenges (contact_id)`,
      );
      await exec("DROP TRIGGER IF EXISTS frigora_contact_verification_challenges_consume_only");
      await exec(`
        CREATE TRIGGER frigora_contact_verification_challenges_consume_only
        BEFORE UPDATE ON frigora_contact_verification_challenges
        WHEN OLD.consumed_at IS NOT NULL
          OR OLD.revoked_at IS NOT NULL
          OR NEW.id != OLD.id
          OR NEW.contact_id != OLD.contact_id
          OR NEW.secret_hash != OLD.secret_hash
          OR NEW.workspace_id != OLD.workspace_id
          OR NEW.venture_id != OLD.venture_id
          OR NEW.customer_id != OLD.customer_id
          OR NEW.site_id != OLD.site_id
          OR NEW.expires_at != OLD.expires_at
          OR NEW.created_at != OLD.created_at
        BEGIN
          SELECT RAISE(ABORT, 'verification challenge is immutable');
        END
      `);
      await exec(`
        CREATE TABLE IF NOT EXISTS frigora_venture_mail_identities (
          workspace_id TEXT NOT NULL,
          venture_id TEXT NOT NULL,
          from_name TEXT NOT NULL,
          from_email TEXT NOT NULL,
          updated_by_user_id TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          PRIMARY KEY (workspace_id, venture_id)
        )
      `);
      await exec(`
        CREATE TABLE IF NOT EXISTS frigora_contact_supervised_verifications (
          id TEXT PRIMARY KEY,
          contact_id TEXT NOT NULL REFERENCES frigora_customer_contacts(id),
          workspace_id TEXT NOT NULL,
          venture_id TEXT NOT NULL,
          method TEXT NOT NULL CHECK (method IN ('telephone', 'in_person')),
          verified_by_user_id TEXT NOT NULL,
          verified_at TEXT NOT NULL,
          evidence_note TEXT NOT NULL,
          revoked_at TEXT,
          revoked_by_user_id TEXT
        )
      `);
      await exec(`
        CREATE INDEX IF NOT EXISTS frigora_contact_supervised_verifications_contact_idx
        ON frigora_contact_supervised_verifications (workspace_id, venture_id, contact_id)
      `);
      await exec(`
        CREATE UNIQUE INDEX IF NOT EXISTS frigora_contact_supervised_verifications_current_uidx
        ON frigora_contact_supervised_verifications (contact_id)
        WHERE revoked_at IS NULL
      `);
      await exec("DROP TRIGGER IF EXISTS frigora_contact_supervised_verifications_revoke_only");
      await exec(`
        CREATE TRIGGER frigora_contact_supervised_verifications_revoke_only
        BEFORE UPDATE ON frigora_contact_supervised_verifications
        WHEN OLD.revoked_at IS NOT NULL
          OR NEW.revoked_at IS NULL
          OR NEW.id != OLD.id
          OR NEW.contact_id != OLD.contact_id
          OR NEW.workspace_id != OLD.workspace_id
          OR NEW.venture_id != OLD.venture_id
          OR NEW.method != OLD.method
          OR NEW.verified_by_user_id != OLD.verified_by_user_id
          OR NEW.verified_at != OLD.verified_at
          OR NEW.evidence_note != OLD.evidence_note
        BEGIN
          SELECT RAISE(ABORT, 'supervised verification is append-only');
        END
      `);
      await exec("DROP TRIGGER IF EXISTS frigora_contact_supervised_verifications_no_delete");
      await exec(`
        CREATE TRIGGER frigora_contact_supervised_verifications_no_delete
        BEFORE DELETE ON frigora_contact_supervised_verifications
        BEGIN
          SELECT RAISE(ABORT, 'supervised verification is append-only');
        END
      `);
      await exec(
        "CREATE TABLE IF NOT EXISTS intelligence_catalogues (workspace_id TEXT PRIMARY KEY NOT NULL, version INTEGER NOT NULL CHECK (version >= 0), updated_at TEXT NOT NULL)",
      );
      await exec(
        "CREATE TABLE IF NOT EXISTS intelligence_objects (id TEXT PRIMARY KEY NOT NULL, workspace_id TEXT NOT NULL, originating_venture_id TEXT NOT NULL, object_type TEXT NOT NULL, current_revision INTEGER NOT NULL CHECK (current_revision > 0), current_revision_id TEXT NOT NULL, document_json TEXT NOT NULL, document_hash TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)",
      );
      await exec(
        "CREATE TABLE IF NOT EXISTS intelligence_revisions (revision_id TEXT PRIMARY KEY NOT NULL, mutation_id TEXT NOT NULL, object_id TEXT NOT NULL, workspace_id TEXT NOT NULL, originating_venture_id TEXT NOT NULL, object_type TEXT NOT NULL, revision INTEGER NOT NULL CHECK (revision > 0), mutation_kind TEXT NOT NULL CHECK (mutation_kind IN ('CREATE','AMEND','RETRACT','SUPERSEDE')), document_json TEXT NOT NULL, document_hash TEXT NOT NULL, previous_revision_id TEXT, previous_revision_hash TEXT, revision_hash TEXT NOT NULL, recorder_actor_id TEXT NOT NULL, required_permission TEXT NOT NULL, semantic_authority_ref TEXT, reason TEXT NOT NULL, evaluation_time TEXT NOT NULL, catalogue_version INTEGER NOT NULL CHECK (catalogue_version > 0), created_at TEXT NOT NULL)",
      );
      await exec(
        "CREATE INDEX IF NOT EXISTS intelligence_objects_workspace_idx ON intelligence_objects (workspace_id)",
      );
      await exec(
        "CREATE INDEX IF NOT EXISTS intelligence_objects_venture_idx ON intelligence_objects (workspace_id, originating_venture_id)",
      );
      await exec(
        "CREATE INDEX IF NOT EXISTS intelligence_objects_type_idx ON intelligence_objects (workspace_id, object_type)",
      );
      await exec(
        "CREATE UNIQUE INDEX IF NOT EXISTS intelligence_revisions_object_revision_idx ON intelligence_revisions (object_id, revision)",
      );
      await exec(
        "CREATE INDEX IF NOT EXISTS intelligence_revisions_workspace_idx ON intelligence_revisions (workspace_id, object_id)",
      );
      } catch (error) {
        if (globalStore.__vosSchemaGeneration === generation) {
          globalStore.__vosSchemaGeneration = undefined;
        }
        globalStore.__vosSchemaReady = undefined;
        discardPersistentClient();
        throw error;
      } finally {
        endPersistentDatabaseMaintenance();
      }
    })();
  }

  await globalStore.__vosSchemaReady;
}

/**
 * Applies the generation-40 stock DDL on purpose.
 * Core ensureSchema does not call this. A database reset clears the memo, and
 * a failed attempt clears it so the next call can retry. The statements are
 * CREATE TABLE IF NOT EXISTS and DROP TRIGGER IF EXISTS, so an existing stock
 * database is left in place. This does not change SCHEMA_GENERATION.
 */
export async function ensureFrigoraStockSchemaReady() {
  await ensureSchema();
  if (!globalStore.__vosStockSchemaReady) {
    globalStore.__vosStockSchemaReady = (async () => {
      try {
        await ensureFrigoraStockSchema(exec);
      } catch (error) {
        globalStore.__vosStockSchemaReady = undefined;
        throw error;
      }
    })();
  }
  await globalStore.__vosStockSchemaReady;
}

/**
 * Applies the commercial catalogue DDL on purpose.
 * Core ensureSchema does not call this, and this does not call stock DDL.
 * A database reset clears the memo. A failed attempt clears it so the next
 * call can retry. Existing catalogue rows are left in place. This does not
 * change SCHEMA_GENERATION.
 */
export async function ensureFrigoraCommercialCatalogueSchema() {
  await ensureSchema();
  if (!globalStore.__vosCommercialCatalogueReady) {
    globalStore.__vosCommercialCatalogueReady = (async () => {
      try {
        await applyFrigoraCommercialCatalogueSchema(exec);
      } catch (error) {
        globalStore.__vosCommercialCatalogueReady = undefined;
        throw error;
      }
    })();
  }
  await globalStore.__vosCommercialCatalogueReady;
}

/**
 * Applies commercial quotation line DDL on purpose.
 * Core ensureSchema does not call this. It does not call stock or catalogue DDL.
 * A database reset clears the memo. A failed attempt clears it so the next call
 * can retry. This does not change SCHEMA_GENERATION.
 */
export async function ensureFrigoraCommercialLinesSchema() {
  await ensureSchema();
  if (!globalStore.__vosCommercialLinesReady) {
    globalStore.__vosCommercialLinesReady = (async () => {
      try {
        await applyFrigoraCommercialLinesSchema(exec);
      } catch (error) {
        globalStore.__vosCommercialLinesReady = undefined;
        throw error;
      }
    })();
  }
  await globalStore.__vosCommercialLinesReady;
}

let identitySealCommitReplacementForTests: (() => Promise<void>) | null = null;

/** Test-only. Replaces transaction.commit() so a thrown commit stays uncertain. */
export function setIdentitySealCommitReplacementForTests(replacement: (() => Promise<void>) | null) {
  identitySealCommitReplacementForTests = replacement;
}

/**
 * Installs the five-field quotation identity seals on the current file database.
 * Commercial-line startup does not call this. The long-lived database and the
 * hosted verification database are refused before a client is opened.
 * The quotation schema must already exist. This function does not initialise it.
 */
export async function applyFrigoraQuotationIdentitySeals() {
  const url = getDatabaseUrl();
  refuseIdentitySealDatabaseUrl(url);
  if (globalStore.__vosQuotationIdentitySealUncertain) {
    throw new Error(IDENTITY_SEAL_UNCERTAIN_MESSAGE);
  }
  if (globalStore.__vosQuotationIdentitySealsReady === url) {
    return;
  }
  const client = createGuardedDatabaseClient({ url, timeout: SQLITE_PLATFORM_BUSY_TIMEOUT_MS, concurrency: 1 });
  let transaction: Transaction | undefined;
  let committed = false;
  let commitError: unknown = null;
  try {
    transaction = await client.transaction("write");
    await runQuotationIdentitySealMigration(transaction);
    try {
      if (identitySealCommitReplacementForTests) {
        await identitySealCommitReplacementForTests();
      } else {
        await transaction.commit();
      }
      committed = true;
    } catch (error) {
      commitError = error;
    }
  } catch (error) {
    if (transaction && !transaction.closed) {
      try {
        await transaction.rollback();
      } catch (rollbackError) {
        globalStore.__vosQuotationIdentitySealUncertain = true;
        throw new Error(IDENTITY_SEAL_UNCERTAIN_MESSAGE, { cause: rollbackError });
      }
      throw error;
    }
    globalStore.__vosQuotationIdentitySealUncertain = true;
    throw new Error(IDENTITY_SEAL_UNCERTAIN_MESSAGE, { cause: error });
  } finally {
    try {
      transaction?.close();
    } catch {
      // A returned commit stays committed. Close is cleanup.
    }
    try {
      client.close();
    } catch {
      // A returned commit stays committed. Close is cleanup.
    }
  }
  if (commitError || !committed) {
    globalStore.__vosQuotationIdentitySealUncertain = true;
    throw new Error(IDENTITY_SEAL_UNCERTAIN_MESSAGE, { cause: commitError ?? undefined });
  }
  globalStore.__vosQuotationIdentitySealsReady = url;
}
