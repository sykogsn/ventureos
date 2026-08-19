import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { createClient, type Client } from "@libsql/client";
import { drizzle, type LibSQLDatabase } from "drizzle-orm/libsql";
import * as schema from "./schema";

const DEFAULT_URL = "file:./data/ventureos.db";

export type Database = LibSQLDatabase<typeof schema>;

const globalStore = globalThis as typeof globalThis & {
  __vosDb?: Database;
  __vosClient?: Client;
  __vosSchemaReady?: Promise<void>;
  __vosDatabaseUrl?: string;
};

function databaseUrl() {
  return globalStore.__vosDatabaseUrl ?? process.env.DATABASE_URL ?? DEFAULT_URL;
}

function ensureFileDatabase(url: string) {
  if (!url.startsWith("file:")) {
    return;
  }

  const filePath = resolve(url.slice("file:".length));
  mkdirSync(dirname(filePath), { recursive: true });
}

export function getClient() {
  if (!globalStore.__vosClient) {
    const url = databaseUrl();
    ensureFileDatabase(url);
    globalStore.__vosClient = createClient({ url });
  }

  return globalStore.__vosClient;
}

export function getDb() {
  if (!globalStore.__vosDb) {
    globalStore.__vosDb = drizzle(getClient(), { schema });
  }

  return globalStore.__vosDb;
}

/** Drops the process DB client so the next getDb() binds a live connection. */
export async function resetDatabaseLifecycle(databaseUrl?: string) {
  const client = globalStore.__vosClient;
  globalStore.__vosClient = undefined;
  globalStore.__vosDb = undefined;
  globalStore.__vosSchemaReady = undefined;
  if (databaseUrl) {
    globalStore.__vosDatabaseUrl = databaseUrl;
  }
  if (client) {
    try {
      client.close();
    } catch {
      // Client already closed.
    }
  }
}

async function exec(sql: string) {
  await getClient().execute(sql);
}

async function addColumn(table: string, column: string, definition: string) {
  try {
    await exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  } catch {
    // Column already exists on upgraded databases.
  }
}

export async function ensureSchema() {
  if (!globalStore.__vosSchemaReady) {
    globalStore.__vosSchemaReady = (async () => {
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
    })();
  }

  await globalStore.__vosSchemaReady;
}
