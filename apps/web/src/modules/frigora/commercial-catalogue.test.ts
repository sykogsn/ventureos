import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { beforeEach, describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import type { Role, UserId, VentureId, WorkspaceId } from "@/contracts";
import { createDbMembershipStore } from "@/platform/permissions/membership-store";
import { createPermissionService } from "@/platform/permissions/service";
import { ensureFrigoraCommercialCatalogueSchema, ensureSchema, getClient } from "@/platform/persistence/db";
import { getPersistence, resetPersistenceLifecycle } from "@/platform/persistence/repositories";
import type { PersistedVenture } from "@/platform/persistence/repositories/ports";
import { createCommercialCatalogue } from "./commercial-catalogue";
import { FrigoraError } from "./errors";
import { closeFrigoraPersistenceAfterFile } from "./test-persistence-lifecycle";
import type { FrigoraScope } from "./types";

const NOW = "2026-11-10T00:00:00.000Z";
const DB_SOURCE = fileURLToPath(new URL("../../platform/persistence/db.ts", import.meta.url));

closeFrigoraPersistenceAfterFile();

beforeEach(async () => {
  await resetPersistenceLifecycle();
  await ensureSchema();
});

function ventureRow(input: {
  id: VentureId;
  workspaceId: WorkspaceId;
  slug: string;
}): PersistedVenture {
  return {
    id: input.id,
    workspaceId: input.workspaceId,
    name: "Frigora Commercial",
    slug: input.slug,
    stage: "concept",
    href: `/ventures/${input.id}`,
    foundedAt: NOW,
    category: "Operations",
    owner: "founder",
    hqSummary: "Open.",
    genome: {
      thesis: "Price the work honestly.",
      category: "Operations",
      stage: "Idea",
      goal: "Keep a commercial catalogue.",
      posture: "human-led",
      risk: "focused",
      motion: "Serve refrigeration sites.",
      cadence: "Weekly",
    },
    mission: {
      today: {
        title: "",
        ask: "",
        whyNow: "",
        ifDeferred: "",
        timeNeeded: "",
        actionLabel: "",
        actionHref: "/dashboard",
        attention: "hold",
        founderAsk: "",
        active: false,
      },
      sprint: { name: "", objective: "", tasks: [] },
    },
    launchDraft: {},
    documents: { documents: [] },
    risk: { headline: "", signals: [] },
    createdAt: NOW,
    updatedAt: NOW,
    definitionId: "frigora",
    definitionVersion: "0.22.0",
    lifecycle: "operating",
  };
}

async function seed() {
  const workspaceId = "ws-commercial" as WorkspaceId;
  const ventureId = "ven-commercial" as VentureId;
  const otherVentureId = "ven-commercial-b" as VentureId;
  const store = getPersistence();
  await store.organisations.insert({
    id: workspaceId,
    name: "Commercial Workspace",
    slug: "ws-commercial",
    createdAt: NOW,
  });
  const catalogue = createCommercialCatalogue({
    permissions: createPermissionService(createDbMembershipStore()),
  });
  const bind = async (userId: UserId, role: Role, venture: VentureId) => {
    await store.memberships.setRole({ userId, workspaceId, role, createdAt: NOW });
    return { userId, workspaceId, ventureId: venture } satisfies FrigoraScope;
  };
  await store.ventures.insert(ventureRow({ id: ventureId, workspaceId, slug: "commercial-a" }));
  await store.ventures.insert(ventureRow({ id: otherVentureId, workspaceId, slug: "commercial-b" }));
  return {
    catalogue,
    owner: await bind("user-owner" as UserId, "owner", ventureId),
    admin: await bind("user-admin" as UserId, "admin", ventureId),
    member: await bind("user-member" as UserId, "member", ventureId),
    other: await bind("user-owner" as UserId, "owner", otherVentureId),
  };
}

function itemInput(overrides: Record<string, unknown> = {}) {
  return {
    sku: "COMP-100",
    description: "Scroll compressor",
    category: "Compressors",
    manufacturer: "Copeland",
    model: "ZR72",
    unit: "each",
    sellingPriceMinor: 100000,
    taxTreatment: "not_registered",
    supplierReference: "SUP-1",
    ...overrides,
  };
}

async function tableNames(like: string) {
  const rows = await getClient().execute({
    sql: "SELECT name FROM sqlite_master WHERE type = 'table' AND name LIKE ? ORDER BY name",
    args: [like],
  });
  return rows.rows.map((row) => String(row.name));
}

function assertCode(error: unknown, code: string) {
  assert.ok(error instanceof FrigoraError);
  assert.equal(error.code, code);
  return true;
}

describe("Frigora commercial catalogue", () => {
  it("creates a commercial item without purchase cost", async () => {
    const { catalogue, owner } = await seed();
    const created = await catalogue.createItem(owner, itemInput());
    assert.equal(created.sku, "COMP-100");
    assert.equal(created.sellingPriceMinor, 100000);
    assert.equal(created.currency, "ZAR");
    assert.equal(created.status, "active");
    assert.equal(created.createdByUserId, owner.userId);
    assert.equal("purchaseCostMinor" in created, false);
    assert.equal(JSON.stringify(created).includes("purchaseCost"), false);
    await assert.rejects(
      () => catalogue.createItem(owner, itemInput({ purchaseCostMinor: 10 })),
      (error: unknown) => assertCode(error, "invalid_input"),
    );
  });

  it("searches by SKU", async () => {
    const { catalogue, owner } = await seed();
    await catalogue.createItem(owner, itemInput());
    await catalogue.createItem(owner, itemInput({ sku: "VALVE-2", description: "Service valve", manufacturer: "Danfoss", model: "EVR-10" }));
    const found = await catalogue.searchItems(owner, { sku: "comp" });
    assert.deepEqual(found.map((item) => item.sku), ["COMP-100"]);
  });

  it("searches by description", async () => {
    const { catalogue, owner } = await seed();
    await catalogue.createItem(owner, itemInput());
    await catalogue.createItem(owner, itemInput({ sku: "VALVE-2", description: "Service valve", manufacturer: "Danfoss", model: "EVR-10" }));
    const found = await catalogue.searchItems(owner, { description: "valve" });
    assert.deepEqual(found.map((item) => item.sku), ["VALVE-2"]);
  });

  it("searches by manufacturer", async () => {
    const { catalogue, owner } = await seed();
    await catalogue.createItem(owner, itemInput());
    await catalogue.createItem(owner, itemInput({ sku: "VALVE-2", description: "Service valve", manufacturer: "Danfoss", model: "EVR-10" }));
    const found = await catalogue.searchItems(owner, { manufacturer: "copeland" });
    assert.deepEqual(found.map((item) => item.sku), ["COMP-100"]);
  });

  it("searches by model", async () => {
    const { catalogue, owner } = await seed();
    await catalogue.createItem(owner, itemInput());
    await catalogue.createItem(owner, itemInput({ sku: "VALVE-2", description: "Service valve", manufacturer: "Danfoss", model: "EVR-10" }));
    const found = await catalogue.searchItems(owner, { model: "evr-10" });
    assert.deepEqual(found.map((item) => item.sku), ["VALVE-2"]);
  });

  it("rejects a duplicate SKU in one venture, including a different case", async () => {
    const { catalogue, owner } = await seed();
    await catalogue.createItem(owner, itemInput({ sku: "Ab-1" }));
    await assert.rejects(
      () => catalogue.createItem(owner, itemInput({ sku: "ab-1", description: "Another" })),
      (error: unknown) => assertCode(error, "duplicate"),
    );
  });

  it("allows the same SKU in a different venture", async () => {
    const { catalogue, owner, other } = await seed();
    const first = await catalogue.createItem(owner, itemInput());
    const second = await catalogue.createItem(other, itemInput());
    assert.notEqual(first.id, second.id);
    assert.equal(second.ventureId, other.ventureId);
    assert.equal(second.sku, "COMP-100");
  });

  it("keeps catalogue reads inside the venture", async () => {
    const { catalogue, owner, other } = await seed();
    const created = await catalogue.createItem(owner, itemInput());
    await assert.rejects(
      () => catalogue.getItem(other, created.id),
      (error: unknown) => assertCode(error, "not_found"),
    );
    assert.deepEqual(await catalogue.searchItems(other, { sku: "COMP-100" }), []);
    await assert.rejects(
      () => catalogue.readItemCost(other, created.id),
      (error: unknown) => assertCode(error, "not_found"),
    );
  });

  it("keeps a discontinued item readable and rejects it for a new selection", async () => {
    const { catalogue, owner } = await seed();
    const created = await catalogue.createItem(owner, itemInput());
    const discontinued = await catalogue.updateItem(owner, created.id, { status: "discontinued" });
    assert.equal(discontinued.status, "discontinued");
    const read = await catalogue.getItem(owner, created.id);
    assert.equal(read.status, "discontinued");
    assert.equal(read.sku, "COMP-100");
    await assert.rejects(
      () => catalogue.selectItem(owner, created.id),
      (error: unknown) => assertCode(error, "invalid_status"),
    );
    const active = await catalogue.createItem(owner, itemInput({ sku: "VALVE-2", description: "Service valve" }));
    const selected = await catalogue.selectItem(owner, active.id);
    assert.equal(selected.status, "active");
  });

  it("does not give an administrator purchase cost and denies member catalogue reads", async () => {
    const { catalogue, owner, admin, member } = await seed();
    const created = await catalogue.createItem(owner, itemInput());
    await catalogue.setItemCost(owner, created.id, { purchaseCostMinor: 40000 });
    const visible = await catalogue.getItem(admin, created.id);
    assert.equal(visible.sellingPriceMinor, 100000);
    assert.equal("purchaseCostMinor" in visible, false);
    assert.equal("margin" in visible, false);
    assert.equal("grossProfitMinor" in visible, false);
    const searched = await catalogue.searchItems(admin, { sku: "COMP-100" });
    assert.equal(JSON.stringify(searched).includes("purchaseCost"), false);
    assert.equal(JSON.stringify(searched).includes("margin"), false);
    await assert.rejects(
      () => catalogue.getItem(member, created.id),
      (error: unknown) => assertCode(error, "forbidden"),
    );
    await assert.rejects(
      () => catalogue.listItems(member),
      (error: unknown) => assertCode(error, "forbidden"),
    );
    await assert.rejects(
      () => catalogue.searchItems(member, { sku: "COMP-100" }),
      (error: unknown) => assertCode(error, "forbidden"),
    );
  });

  it("rejects cost reads and writes for a venture.update user and a reader", async () => {
    const { catalogue, owner, admin, member } = await seed();
    const created = await catalogue.createItem(owner, itemInput());
    await assert.rejects(
      () => catalogue.readItemCost(admin, created.id),
      (error: unknown) => assertCode(error, "forbidden"),
    );
    await assert.rejects(
      () => catalogue.setItemCost(admin, created.id, { purchaseCostMinor: 1 }),
      (error: unknown) => assertCode(error, "forbidden"),
    );
    await assert.rejects(
      () => catalogue.readItemCost(member, created.id),
      (error: unknown) => assertCode(error, "forbidden"),
    );
    await assert.rejects(
      () => catalogue.updateItem(admin, created.id, { purchaseCostMinor: 1 }),
      (error: unknown) => assertCode(error, "invalid_input"),
    );
    const costRows = await getClient().execute("SELECT COUNT(*) AS n FROM frigora_commercial_item_costs");
    assert.equal(Number(costRows.rows[0]?.n), 0);
  });

  it("lets an authorised cost reader retrieve a recorded cost", async () => {
    const { catalogue, owner } = await seed();
    const created = await catalogue.createItem(owner, itemInput());
    const recorded = await catalogue.setItemCost(owner, created.id, { purchaseCostMinor: 45500 });
    const read = await catalogue.readItemCost(owner, created.id);
    assert.deepEqual(read, recorded);
    assert.equal(read?.purchaseCostMinor, 45500);
    const selling = await catalogue.getItem(owner, created.id);
    assert.equal("purchaseCostMinor" in selling, false);
  });

  it("does not treat a missing cost as zero", async () => {
    const { catalogue, owner } = await seed();
    const created = await catalogue.createItem(owner, itemInput());
    const missing = await catalogue.readItemCost(owner, created.id);
    assert.equal(missing, null);
    assert.notEqual(missing, 0);
  });

  it("does not rewrite quotation records when a selling price changes", async () => {
    const { catalogue, owner, admin } = await seed();
    const compressor = await catalogue.createItem(owner, itemInput());
    const valve = await catalogue.createItem(
      owner,
      itemInput({ sku: "VALVE-2", description: "Service valve", sellingPriceMinor: 20000 }),
    );
    await getClient().execute({
      sql: `
        INSERT INTO frigora_quotations (
          id, workspace_id, venture_id, customer_id, site_id, asset_id,
          original_work_order_id, recommended_action_id, current_version, created_at, updated_at
        ) VALUES ('quote-kept', ?, ?, 'customer-kept', 'site-kept', NULL, 'work-kept', 'action-kept', 1, ?, ?)
      `,
      args: [owner.workspaceId, owner.ventureId, NOW, NOW],
    });
    await getClient().execute({
      sql: `
        INSERT INTO frigora_quotation_versions (
          quotation_id, workspace_id, venture_id, version_number, status, description,
          total_minor, currency, document_hash, sent_at, recipient, dispatch_evidence_ref,
          labour_quantity_milli, labour_unit, labour_rate_minor, labour_amount_minor,
          travel_kilometres_milli, distance_basis, travel_rate_minor, travel_amount_minor,
          tax_treatment, tax_rule_id, tax_rule_version, tax_rate_numerator, tax_rate_denominator,
          taxable_amount_minor, tax_amount_minor
        ) VALUES (
          'quote-kept', ?, ?, 1, 'in_preparation', 'Kept quotation',
          1495000, 'ZAR', 'hash-kept', NULL, NULL, NULL,
          NULL, NULL, NULL, NULL,
          NULL, NULL, NULL, NULL,
          NULL, NULL, NULL, NULL, NULL,
          NULL, NULL
        )
      `,
      args: [owner.workspaceId, owner.ventureId],
    });
    const updated = await catalogue.updateItem(admin, compressor.id, { sellingPriceMinor: 250000 });
    assert.equal(updated.sellingPriceMinor, 250000);
    assert.equal(updated.createdByUserId, owner.userId);
    assert.equal(updated.updatedByUserId, admin.userId);
    assert.equal(updated.createdAt, compressor.createdAt);
    const unchanged = await catalogue.getItem(owner, valve.id);
    assert.equal(unchanged.sellingPriceMinor, 20000);
    const version = await getClient().execute(
      "SELECT status, description, total_minor, document_hash FROM frigora_quotation_versions WHERE quotation_id = 'quote-kept'",
    );
    assert.equal(version.rows[0]?.status, "in_preparation");
    assert.equal(version.rows[0]?.description, "Kept quotation");
    assert.equal(Number(version.rows[0]?.total_minor), 1495000);
    assert.equal(version.rows[0]?.document_hash, "hash-kept");
    const parts = await getClient().execute("SELECT COUNT(*) AS n FROM frigora_part_references");
    assert.equal(Number(parts.rows[0]?.n), 0);
  });

  it("does not create stock or catalogue tables during core schema startup", async () => {
    assert.deepEqual(await tableNames("frigora_stock_%"), []);
    assert.deepEqual(await tableNames("frigora_commercial_%"), []);
    await ensureFrigoraCommercialCatalogueSchema();
    await ensureFrigoraCommercialCatalogueSchema();
    assert.deepEqual(await tableNames("frigora_commercial_%"), [
      "frigora_commercial_item_costs",
      "frigora_commercial_items",
    ]);
    assert.deepEqual(await tableNames("frigora_stock_%"), []);
    const version = await getClient().execute(
      "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'frigora_quotation_versions'",
    );
    const sql = String(version.rows[0]?.sql);
    assert.match(sql, /'in_preparation'/);
    assert.match(sql, /'awaiting_customer_approval'/);
    assert.match(sql, /'approved'/);
    assert.match(sql, /'declined'/);
    const source = readFileSync(DB_SOURCE, "utf8");
    assert.match(source, /const SCHEMA_GENERATION = 40/);
    assert.doesNotMatch(source, /SCHEMA_GENERATION = 41/);
  });
});
