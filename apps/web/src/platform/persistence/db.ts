import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { createClient, type Client } from "@libsql/client";
import { drizzle, type LibSQLDatabase } from "drizzle-orm/libsql";
import * as schema from "./schema";

const DEFAULT_URL = "file:./data/ventureos.db";

export type Database = LibSQLDatabase<typeof schema>;

const SCHEMA_GENERATION = 7; // bump when ensureSchema DDL is extended

const globalStore = globalThis as typeof globalThis & {
  __vosDb?: Database;
  __vosClient?: Client;
  __vosSchemaReady?: Promise<void>;
  __vosSchemaGeneration?: number;
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
  globalStore.__vosSchemaGeneration = undefined;
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
  if (globalStore.__vosSchemaGeneration !== SCHEMA_GENERATION) {
    globalStore.__vosSchemaReady = undefined;
    globalStore.__vosSchemaGeneration = SCHEMA_GENERATION;
  }

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
    })();
  }

  await globalStore.__vosSchemaReady;
}
