import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import type { UserId, VentureId, WorkspaceId } from "@/contracts";
import { createDbMembershipStore } from "@/platform/permissions/membership-store";
import { createPermissionService } from "@/platform/permissions/service";
import { ensureSchema, getClient, getDatabaseUrl } from "@/platform/persistence/db";
import { getPersistence, resetPersistenceLifecycle } from "@/platform/persistence/repositories";
import type { PersistedVenture } from "@/platform/persistence/repositories/ports";
import { exampleQuotationCommercial } from "./quotation-commercial";
import { createFrigoraService } from "./service";
import { createFrigoraStore } from "./store";
import { closeFrigoraPersistenceAfterFile } from "./test-persistence-lifecycle";
import { allowSyntheticNotRegisteredQuotationSend } from "./tax-configuration-fixture";
import type { FrigoraScope } from "./types";

const NOW = "2026-10-24T08:00:00.000Z";
const ARRIVED = "2026-10-24T08:05:00.000Z";
const RECOMMENDED_AT = "2026-10-24T08:20:00.000Z";
const DB_SOURCE = fileURLToPath(new URL("../../platform/persistence/db.ts", import.meta.url));

closeFrigoraPersistenceAfterFile();

type SchemaMemory = typeof globalThis & {
  __vosSchemaGeneration?: number;
  __vosSchemaReady?: Promise<void>;
};

function schemaMemory(): SchemaMemory {
  return globalThis as SchemaMemory;
}

function assertDisposableDatabase(url: string) {
  const normalised = url.replaceAll("\\", "/");
  if (
    normalised === "file:./data/ventureos.db"
    || normalised.endsWith("/data/ventureos.db")
    || !normalised.includes("/frigora-m1c1-schema-")
  ) {
    throw new Error(`Refusing non-disposable database URL: ${normalised}`);
  }
}

beforeEach(async () => {
  const directory = mkdtempSync(join(tmpdir(), "frigora-m1c1-schema-"));
  const url = `file:${join(directory, "schema.db").replaceAll("\\", "/")}`;
  assertDisposableDatabase(url);
  await resetPersistenceLifecycle(url);
  const bound = getDatabaseUrl();
  assert.equal(bound, url);
  assertDisposableDatabase(bound);
});

function ventureRow(): PersistedVenture {
  return {
    id: "ven-frigora" as VentureId,
    workspaceId: "ws-frigora" as WorkspaceId,
    name: "Frigora One",
    slug: "frigora-one",
    stage: "Idea",
    href: "/ventures/hq/frigora-one",
    foundedAt: NOW,
    category: "Operations",
    owner: "Founder",
    hqSummary: "Open.",
    genome: {
      thesis: "Keep the cold chain honest.",
      category: "Operations",
      stage: "Idea",
      goal: "Admit operational identity.",
      posture: "human-led",
      risk: "focused",
      motion: "Serve refrigeration sites.",
      cadence: "Weekly",
    },
    mission: {
      today: {
        title: "", ask: "", whyNow: "", ifDeferred: "", timeNeeded: "",
        actionLabel: "", actionHref: "/dashboard", attention: "hold", founderAsk: "", active: false,
      },
      sprint: { name: "", objective: "", tasks: [] },
    },
    launchDraft: {},
    documents: { documents: [] },
    risk: { headline: "", signals: [] },
    definitionId: "frigora",
    definitionVersion: "0.21.0",
    lifecycle: "operating",
    createdAt: NOW,
    updatedAt: NOW,
  };
}

async function seedCommercialRecords() {
  const workspaceId = "ws-frigora" as WorkspaceId;
  const ventureId = "ven-frigora" as VentureId;
  const userId = "user-owner" as UserId;
  const persistence = getPersistence();
  await persistence.organisations.insert({
    id: workspaceId,
    name: "Frigora Workspace",
    slug: "ws-frigora",
    createdAt: NOW,
  });
  await persistence.memberships.setRole({ userId, workspaceId, role: "owner", createdAt: NOW });
  await persistence.ventures.insert(ventureRow());
  const store = createFrigoraStore();
  const scope = { userId, workspaceId, ventureId } satisfies FrigoraScope;
  const service = createFrigoraService({
    store,
    permissions: createPermissionService(createDbMembershipStore()),
  });
  await allowSyntheticNotRegisteredQuotationSend(service, scope);
  const attendeeId = "user-attendee" as UserId;
  await persistence.memberships.setRole({
    userId: attendeeId,
    workspaceId,
    role: "member",
    createdAt: NOW,
  });
  const customer = await service.createCustomer(scope, { code: "FUELCO", displayName: "FuelCo" });
  const site = await service.createSite(scope, { customerId: customer.id, code: "SANDTON-N", name: "Sandton North" });
  const asset = await service.createAsset(scope, { siteId: site.id, tag: "EVAP-01", name: "Evaporator" });
  const workOrder = await service.createWorkOrder(scope, {
    siteId: site.id,
    workReference: "WO-1864",
    workKind: "reactive",
    primaryAssetId: asset.id,
    reportedCondition: "display freezer warm",
  });
  const visit = await service.recordVisitArrival(scope, workOrder.id, { userId: attendeeId, arrivedAt: ARRIVED });
  const recommendation = await service.recordRecommendedAction(scope, visit.id, {
    description: "Replace compressor",
    recommendedAt: RECOMMENDED_AT,
    recommendedByUserId: attendeeId,
    recordedByUserId: attendeeId,
    assetId: asset.id,
  });
  const quotation = await service.createQuotation(scope, {
    recommendedActionId: recommendation.id,
    description: "Replace compressor",
    commercial: exampleQuotationCommercial(),
  });
  const posture = await service.getTaxPosture(scope);
  const configuration = posture.configurations.find((item) => item.status === "verified");
  assert.ok(configuration);
  await getClient().execute({
    sql: `
      INSERT INTO audit_events (
        id, action, occurred_at, actor_user_id, actor_kind,
        actor_agent_instance_id, actor_component, workspace_id, venture_id, metadata_json
      ) VALUES ('audit-m1c1', 'frigora.quotation.schema_probe', ?, ?, 'human', NULL, NULL, ?, ?, '{}')
    `,
    args: [NOW, userId, workspaceId, ventureId],
  });
  return { quotation, configuration };
}

async function names(type: string, table?: string) {
  const result = table
    ? await getClient().execute({
      sql: "SELECT name FROM sqlite_master WHERE type = ? AND tbl_name = ? ORDER BY name",
      args: [type, table],
    })
    : await getClient().execute({
      sql: "SELECT name FROM sqlite_master WHERE type = ? ORDER BY name",
      args: [type],
    });
  return result.rows.map((row) => String(row.name));
}

async function objectSql(type: string, name: string) {
  const result = await getClient().execute({
    sql: "SELECT sql FROM sqlite_master WHERE type = ? AND name = ?",
    args: [type, name],
  });
  const sql = result.rows[0]?.sql;
  assert.equal(typeof sql, "string", `${type} ${name} is missing`);
  return String(sql);
}

async function assertOutboxSchema() {
  const outbox = await objectSql("table", "frigora_quotation_delivery_outbox");
  assert.match(outbox, /held_pending_customer_access/);
  assert.match(outbox, /accepted_by_provider/);
  assert.match(outbox, /rejected_by_provider/);
  assert.match(outbox, /outcome_unknown/);
  assert.match(outbox, /UNIQUE \(quotation_id, version_number\)/);
  const attempts = await objectSql("table", "frigora_quotation_delivery_attempts");
  assert.match(attempts, /outcome_unknown/);
  assert.match(attempts, /detail TEXT NOT NULL/);
  assert.ok((await names("index", "frigora_quotation_delivery_outbox")).includes(
    "frigora_quotation_delivery_outbox_scope_idx",
  ));
  assert.ok((await names("index", "frigora_quotation_delivery_attempts")).includes(
    "frigora_quotation_delivery_attempts_outbox_idx",
  ));
  const triggers = await names("trigger");
  for (const trigger of [
    "frigora_quotation_delivery_outbox_transition",
    "frigora_quotation_delivery_attempts_no_update",
    "frigora_quotation_delivery_attempts_no_delete",
  ]) {
    assert.ok(triggers.includes(trigger), trigger);
  }
  const tables = await names("table");
  for (const table of [
    "frigora_quotations",
    "frigora_quotation_versions",
    "frigora_quotation_events",
    "frigora_tax_rules",
    "frigora_tax_configurations",
    "audit_events",
  ]) {
    assert.ok(tables.includes(table), table);
  }
  assert.match(readFileSync(DB_SOURCE, "utf8"), /SCHEMA_GENERATION = 40/);
  assert.equal(schemaMemory().__vosSchemaGeneration, 40);
}

async function snapshot() {
  const quotation = await getClient().execute(
    "SELECT id, current_version FROM frigora_quotations ORDER BY id",
  );
  const version = await getClient().execute(
    "SELECT quotation_id, version_number, status, document_hash, total_minor, tax_amount_minor FROM frigora_quotation_versions ORDER BY quotation_id, version_number",
  );
  const events = await getClient().execute(
    "SELECT id, kind FROM frigora_quotation_events ORDER BY id",
  );
  const tax = await getClient().execute(
    "SELECT id, status, registration_state, evidence_reference, tax_rule_id FROM frigora_tax_configurations ORDER BY id",
  );
  const audit = await getClient().execute(
    "SELECT id, action, metadata_json FROM audit_events WHERE id = 'audit-m1c1'",
  );
  return {
    quotation: quotation.rows,
    version: version.rows,
    events: events.rows,
    tax: tax.rows,
    audit: audit.rows,
  };
}

async function dropOutboxObjects() {
  await getClient().execute("DROP TRIGGER IF EXISTS frigora_quotation_delivery_outbox_transition");
  await getClient().execute("DROP TRIGGER IF EXISTS frigora_quotation_delivery_attempts_no_update");
  await getClient().execute("DROP TRIGGER IF EXISTS frigora_quotation_delivery_attempts_no_delete");
  await getClient().execute("DROP TABLE IF EXISTS frigora_quotation_delivery_attempts");
  await getClient().execute("DROP TABLE IF EXISTS frigora_quotation_delivery_outbox");
}

function pretendGeneration33Finished() {
  const store = schemaMemory();
  store.__vosSchemaGeneration = 33;
  store.__vosSchemaReady = Promise.resolve();
}

describe("Frigora quotation delivery schema migration", () => {
  it("initialises a fresh database with the outbox schema at generation 34", async () => {
    await ensureSchema();
    await assertOutboxSchema();
  });

  it("migrates a generation-33 database that has commercial rows and no outbox tables", async () => {
    await ensureSchema();
    const seeded = await seedCommercialRecords();
    const before = await snapshot();
    assert.equal(seeded.quotation.versions[0]?.documentHash, before.version[0]?.document_hash);
    await dropOutboxObjects();
    assert.equal((await names("table")).includes("frigora_quotation_delivery_outbox"), false);
    pretendGeneration33Finished();
    await ensureSchema();
    await assertOutboxSchema();
    assert.deepEqual(await snapshot(), before);
  });

  it("completes a database that already has the outbox table but not the attempt history", async () => {
    await ensureSchema();
    const seeded = await seedCommercialRecords();
    const documentHash = seeded.quotation.versions[0]?.documentHash;
    assert.ok(documentHash);
    await getClient().execute({
      sql: `
        INSERT INTO frigora_quotation_delivery_outbox (
          id, quotation_id, workspace_id, venture_id, version_number, document_hash,
          created_at, actor_user_id, state, hold_reason, provider_message_id
        ) VALUES ('outbox-partial', ?, ?, ?, 1, ?, ?, ?, 'held_pending_customer_access', 'held', NULL)
      `,
      args: [
        seeded.quotation.id,
        seeded.quotation.workspaceId,
        seeded.quotation.ventureId,
        documentHash,
        NOW,
        "user-owner",
      ],
    });
    await getClient().execute("DROP TRIGGER IF EXISTS frigora_quotation_delivery_attempts_no_update");
    await getClient().execute("DROP TRIGGER IF EXISTS frigora_quotation_delivery_attempts_no_delete");
    await getClient().execute("DROP TABLE frigora_quotation_delivery_attempts");
    const before = await snapshot();
    pretendGeneration33Finished();
    await ensureSchema();
    await assertOutboxSchema();
    assert.deepEqual(await snapshot(), before);
    const outbox = await getClient().execute(
      "SELECT id, document_hash, state FROM frigora_quotation_delivery_outbox",
    );
    assert.equal(outbox.rows.length, 1);
    assert.equal(outbox.rows[0]?.id, "outbox-partial");
    assert.equal(outbox.rows[0]?.document_hash, seeded.quotation.versions[0]?.documentHash);
    assert.equal(outbox.rows[0]?.state, "held_pending_customer_access");
  });

  it("keeps records unchanged when schema initialisation runs again", async () => {
    await ensureSchema();
    await seedCommercialRecords();
    const before = await snapshot();
    await ensureSchema();
    await ensureSchema();
    await ensureSchema();
    await assertOutboxSchema();
    assert.deepEqual(await snapshot(), before);
    assert.equal(schemaMemory().__vosSchemaGeneration, 40);
  });

  it("does not keep a failed migration marked current, and a later retry can finish", async () => {
    await ensureSchema();
    await seedCommercialRecords();
    const before = await snapshot();
    await getClient().execute("DROP TABLE frigora_quotation_delivery_attempts");
    await getClient().execute(
      "CREATE TABLE frigora_quotation_delivery_attempts (id TEXT PRIMARY KEY)",
    );
    pretendGeneration33Finished();
    await assert.rejects(() => ensureSchema(), /no such column/i);
    assert.notEqual(schemaMemory().__vosSchemaGeneration, 40);
    assert.deepEqual(await snapshot(), before);
    await getClient().execute("DROP TABLE frigora_quotation_delivery_attempts");
    await ensureSchema();
    await assertOutboxSchema();
    assert.deepEqual(await snapshot(), before);
    const attempts = await objectSql("table", "frigora_quotation_delivery_attempts");
    assert.match(attempts, /outbox_id TEXT NOT NULL/);
  });
});
