import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, describe, it } from "node:test";
import { createClient } from "@libsql/client";
import {
  createFrigoraWriteClient,
  withFrigoraWriteTransaction,
} from "@/modules/frigora/owned-write";
import { ensureFrigoraStockSchemaReady, ensureSchema, getClient, resetDatabaseLifecycle } from "./db";

const STOCK_TABLES = [
  "frigora_stock_balances",
  "frigora_stock_defect_event_sequences",
  "frigora_stock_defect_events",
  "frigora_stock_defect_reports",
  "frigora_stock_items",
  "frigora_stock_locations",
  "frigora_stock_movements",
  "frigora_stock_operation_receipts",
  "frigora_stock_price_overrides",
  "frigora_stock_price_policies",
];

function fileUrl(name: string) {
  const dir = mkdtempSync(join(tmpdir(), "frigora-stock-"));
  return `file:${join(dir, name).replaceAll("\\", "/")}`;
}

async function stockTables() {
  const rows = await getClient().execute(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name LIKE 'frigora_stock_%' ORDER BY name",
  );
  return rows.rows.map((row) => String(row.name));
}

async function openCore() {
  const url = fileUrl("core.db");
  await resetDatabaseLifecycle(url);
  await ensureSchema();
  return url;
}

async function openFresh() {
  const url = fileUrl("fresh.db");
  await resetDatabaseLifecycle(url);
  await ensureSchema();
  await ensureFrigoraStockSchemaReady();
  return url;
}

after(async () => {
  await resetDatabaseLifecycle("file::memory:");
});

describe("FRG-FD012-STAGE-02-WP01 stock schema", () => {
  it("starts core schema without stock tables or stock supporting indexes", async () => {
    await openCore();
    assert.deepEqual(await stockTables(), []);
    const indexes = await getClient().execute(
      `SELECT name FROM sqlite_master WHERE type = 'index' AND name IN (
        'ventures_id_workspace_uidx',
        'frigora_part_references_id_scope_uidx'
      )`,
    );
    assert.equal(indexes.rows.length, 0);
    const version = await getClient().execute(
      "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'frigora_quotation_versions'",
    );
    const sql = String(version.rows[0]?.sql);
    assert.match(sql, /'in_preparation'/);
    assert.match(sql, /'awaiting_customer_approval'/);
    assert.match(sql, /'approved'/);
    assert.match(sql, /'declined'/);
    const users = await getClient().execute(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'users'",
    );
    assert.equal(users.rows.length, 1);
    const generation = readFileSync(new URL("./db.ts", import.meta.url), "utf8");
    assert.match(generation, /const SCHEMA_GENERATION = 40/);
    assert.doesNotMatch(generation, /SCHEMA_GENERATION = 41/);
  });

  it("creates exactly ten stock tables when stock schema is requested", async () => {
    await openFresh();
    await ensureFrigoraStockSchemaReady();
    assert.deepEqual(await stockTables(), STOCK_TABLES);
  });

  it("adds the venture and part-reference supporting indexes", async () => {
    await openFresh();
    const rows = await getClient().execute(
      `SELECT name FROM sqlite_master WHERE type = 'index' AND name IN (
        'ventures_id_workspace_uidx',
        'frigora_part_references_id_scope_uidx'
      ) ORDER BY name`,
    );
    assert.deepEqual(
      rows.rows.map((row) => String(row.name)),
      ["frigora_part_references_id_scope_uidx", "ventures_id_workspace_uidx"],
    );
  });

  it("upgrades a generation-39 file without rewriting preserved rows", async () => {
    const url = fileUrl("upgrade.db");
    const setup = createClient({ url });
    await setup.execute(`
      CREATE TABLE ventures (
        id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL,
        name TEXT NOT NULL,
        slug TEXT NOT NULL,
        created_at TEXT NOT NULL
      )
    `);
    await setup.execute(
      "INSERT INTO ventures (id, workspace_id, name, slug, created_at) VALUES ('venture-kept', 'workspace-kept', 'Preserved Venture', 'preserved', '2026-11-06T00:00:00.000Z')",
    );
    await setup.execute(`
      CREATE TABLE frigora_part_references (
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
    await setup.execute(
      "INSERT INTO frigora_part_references (id, workspace_id, venture_id, display_name, default_quantity_unit, status, created_at, updated_at) VALUES ('part-kept', 'workspace-kept', 'venture-kept', 'Preserved Filter', 'each', 'active', '2026-11-06T00:00:00.000Z', '2026-11-06T00:00:00.000Z')",
    );
    setup.close();

    await resetDatabaseLifecycle(url);
    await ensureSchema();
    assert.deepEqual(await stockTables(), []);
    await ensureFrigoraStockSchemaReady();

    assert.deepEqual(await stockTables(), STOCK_TABLES);
    const venture = await getClient().execute(
      "SELECT name, slug FROM ventures WHERE id = 'venture-kept'",
    );
    assert.equal(venture.rows[0]?.name, "Preserved Venture");
    assert.equal(venture.rows[0]?.slug, "preserved");
    const part = await getClient().execute(
      "SELECT display_name, default_quantity_unit FROM frigora_part_references WHERE id = 'part-kept'",
    );
    assert.equal(part.rows[0]?.display_name, "Preserved Filter");
    assert.equal(part.rows[0]?.default_quantity_unit, "each");
  });

  it("retries schema creation after a failed open and then completes", async () => {
    const url = fileUrl("retry.db");
    const setup = createClient({ url });
    await setup.execute("CREATE TABLE assurance_evaluations (id TEXT PRIMARY KEY)");
    setup.close();
    await resetDatabaseLifecycle(url);
    await assert.rejects(() => ensureSchema(), /IMP-01A/);
    await assert.rejects(() => ensureFrigoraStockSchemaReady(), /IMP-01A/);
    assert.deepEqual(await stockTables(), []);
    await getClient().execute("DROP TABLE assurance_evaluations");
    await ensureSchema();
    assert.deepEqual(await stockTables(), []);
    await ensureFrigoraStockSchemaReady();
    assert.deepEqual(await stockTables(), STOCK_TABLES);
  });

  it("uses one connection and enables foreign keys before the write transaction", async () => {
    await openFresh();
    const client = createFrigoraWriteClient();
    const held = await client.transaction("read");
    await assert.rejects(() => client.execute("SELECT 1"), /single connection/);
    await held.rollback();

    await client.execute("PRAGMA foreign_keys = OFF");
    const disabled = await client.execute("PRAGMA foreign_keys");
    assert.equal(Number(disabled.rows[0]?.foreign_keys), 0);
    await assert.rejects(
      () =>
        withFrigoraWriteTransaction(async (transaction) => {
          const restored = await transaction.execute("PRAGMA foreign_keys");
          assert.equal(Number(restored.rows[0]?.foreign_keys), 1);
          await transaction.execute(`
            INSERT INTO frigora_stock_items (
              id, workspace_id, venture_id, part_reference_id, description, description_normalised,
              unit, unit_custom_label, unit_custom_label_normalised, status, created_at, updated_at
            ) VALUES (
              'item-dangling', 'workspace-a', 'venture-a', 'part-missing', 'Filter', 'filter',
              'each', NULL, '', 'active', '2026-11-06T00:00:00.000Z', '2026-11-06T00:00:00.000Z'
            )
          `);
        }, () => client),
      /FOREIGN KEY|SQLITE_CONSTRAINT/,
    );
    const rows = await getClient().execute("SELECT COUNT(*) AS n FROM frigora_stock_items");
    assert.equal(Number(rows.rows[0]?.n), 0);
  });

  it("enforces movement foreign keys and append-only rows", async () => {
    await openFresh();
    await withFrigoraWriteTransaction(async (transaction) => {
      await transaction.execute(
        "INSERT INTO ventures (id, workspace_id, name, slug, created_at) VALUES ('venture-a', 'workspace-a', 'A', 'a', '2026-11-06T00:00:00.000Z')",
      );
      await transaction.execute(
        "INSERT INTO ventures (id, workspace_id, name, slug, created_at) VALUES ('venture-b', 'workspace-a', 'B', 'b', '2026-11-06T00:00:00.000Z')",
      );
      await transaction.execute(`
        INSERT INTO frigora_stock_locations (
          id, workspace_id, venture_id, name, kind, status, custodian_user_id, created_at, updated_at
        ) VALUES (
          'location-a', 'workspace-a', 'venture-a', 'Warehouse', 'warehouse', 'active', NULL,
          '2026-11-06T00:00:00.000Z', '2026-11-06T00:00:00.000Z'
        )
      `);
      await transaction.execute(`
        INSERT INTO frigora_stock_items (
          id, workspace_id, venture_id, part_reference_id, description, description_normalised,
          unit, unit_custom_label, unit_custom_label_normalised, status, created_at, updated_at
        ) VALUES (
          'item-a', 'workspace-a', 'venture-a', NULL, 'Filter', 'filter',
          'each', NULL, '', 'active', '2026-11-06T00:00:00.000Z', '2026-11-06T00:00:00.000Z'
        )
      `);
      await transaction.execute(`
        INSERT INTO frigora_stock_movements (
          id, workspace_id, venture_id, stock_item_id, location_id, kind, movement_leg, quantity_milli,
          unit_snapshot, unit_custom_label_snapshot, description_snapshot, occurred_at, recorded_at,
          actor_user_id, reason, client_operation_id, receipt_reference, supplier_reference,
          supporting_document_reference, entered_unit_cost_minor, currency, cost_source_movement_id,
          pair_group_id, corrects_movement_id, defect_report_id
        ) VALUES (
          'movement-a', 'workspace-a', 'venture-a', 'item-a', 'location-a', 'receipt', 'only', 1000,
          'each', NULL, 'Filter', '2026-11-06T00:00:00.000Z', '2026-11-06T00:00:00.000Z',
          'actor-a', 'opening_balance', 'op-receipt', 'R-1', NULL,
          NULL, 100, 'ZAR', NULL,
          NULL, NULL, NULL
        )
      `);
    });

    await assert.rejects(
      () =>
        withFrigoraWriteTransaction(async (transaction) => {
          await transaction.execute(`
            INSERT INTO frigora_stock_movements (
              id, workspace_id, venture_id, stock_item_id, location_id, kind, movement_leg, quantity_milli,
              unit_snapshot, unit_custom_label_snapshot, description_snapshot, occurred_at, recorded_at,
              actor_user_id, reason, client_operation_id, receipt_reference, supplier_reference,
              supporting_document_reference, entered_unit_cost_minor, currency, cost_source_movement_id,
              pair_group_id, corrects_movement_id, defect_report_id
            ) VALUES (
              'movement-cross', 'workspace-a', 'venture-b', 'item-a', 'location-a', 'receipt', 'only', 1,
              'each', NULL, 'Filter', '2026-11-06T00:00:00.000Z', '2026-11-06T00:00:00.000Z',
              'actor-a', NULL, 'op-cross', NULL, NULL,
              NULL, NULL, NULL, NULL,
              NULL, NULL, NULL
            )
          `);
        }),
      /FOREIGN KEY|SQLITE_CONSTRAINT/,
    );
    await assert.rejects(
      () =>
        withFrigoraWriteTransaction(async (transaction) => {
          await transaction.execute(`
            INSERT INTO frigora_stock_movements (
              id, workspace_id, venture_id, stock_item_id, location_id, kind, movement_leg, quantity_milli,
              unit_snapshot, unit_custom_label_snapshot, description_snapshot, occurred_at, recorded_at,
              actor_user_id, reason, client_operation_id, receipt_reference, supplier_reference,
              supporting_document_reference, entered_unit_cost_minor, currency, cost_source_movement_id,
              pair_group_id, corrects_movement_id, defect_report_id
            ) VALUES (
              'movement-missing', 'workspace-a', 'venture-a', 'item-a', 'location-missing', 'receipt', 'only', 1,
              'each', NULL, 'Filter', '2026-11-06T00:00:00.000Z', '2026-11-06T00:00:00.000Z',
              'actor-a', NULL, 'op-missing', NULL, NULL,
              NULL, NULL, NULL, NULL,
              NULL, NULL, NULL
            )
          `);
        }),
      /FOREIGN KEY|SQLITE_CONSTRAINT/,
    );

    await assert.rejects(
      () => getClient().execute("UPDATE frigora_stock_movements SET quantity_milli = 2 WHERE id = 'movement-a'"),
      /append-only/,
    );
    await assert.rejects(
      () => getClient().execute("DELETE FROM frigora_stock_movements WHERE id = 'movement-a'"),
      /append-only/,
    );

    await withFrigoraWriteTransaction(async (transaction) => {
      await transaction.execute(`
        INSERT INTO frigora_stock_balances (
          workspace_id, venture_id, stock_item_id, location_id, available_milli, quarantined_milli, created_at, updated_at
        ) VALUES (
          'workspace-a', 'venture-a', 'item-a', 'location-a', 1000, 0,
          '2026-11-06T00:00:00.000Z', '2026-11-06T00:00:00.000Z'
        )
      `);
      await transaction.execute(
        "UPDATE frigora_stock_balances SET available_milli = 900, updated_at = '2026-11-06T01:00:00.000Z' WHERE stock_item_id = 'item-a'",
      );
    });
    await assert.rejects(
      () =>
        getClient().execute(
          "UPDATE frigora_stock_balances SET created_at = '2026-11-07T00:00:00.000Z' WHERE stock_item_id = 'item-a'",
        ),
      /immutable/,
    );

    await withFrigoraWriteTransaction(async (transaction) => {
      await transaction.execute(
        "INSERT INTO frigora_stock_defect_event_sequences (venture_id, workspace_id, next_sequence) VALUES ('venture-a', 'workspace-a', 0)",
      );
      await transaction.execute(
        "UPDATE frigora_stock_defect_event_sequences SET next_sequence = 1 WHERE venture_id = 'venture-a'",
      );
    });
    await assert.rejects(
      () =>
        getClient().execute(
          "UPDATE frigora_stock_defect_event_sequences SET next_sequence = 3 WHERE venture_id = 'venture-a'",
        ),
      /advances by one/,
    );
    await assert.rejects(
      () =>
        getClient().execute(
          "UPDATE frigora_stock_defect_event_sequences SET workspace_id = 'workspace-other' WHERE venture_id = 'venture-a'",
        ),
      /advances by one/,
    );
    await assert.rejects(
      () => getClient().execute("DELETE FROM frigora_stock_defect_event_sequences WHERE venture_id = 'venture-a'"),
      /not deleted/,
    );

    await withFrigoraWriteTransaction(async (transaction) => {
      await transaction.execute(`
        INSERT INTO frigora_stock_defect_reports (
          id, workspace_id, venture_id, client_operation_id, kind, stock_item_id, location_id,
          description_snapshot, unit_snapshot, unit_custom_label_snapshot, customer_label, site_label,
          work_order_id, quantity_milli, reporter_user_id, reason, evidence_reference,
          inspected_milli, released_milli, supplier_returned_milli, written_off_milli, reversed_milli,
          status, created_at, updated_at
        ) VALUES (
          'report-a', 'workspace-a', 'venture-a', 'op-report', 'custody', 'item-a', 'location-a',
          'Filter', 'each', NULL, NULL, NULL,
          NULL, 1, 'actor-a', 'damaged seal', NULL,
          0, 0, 0, 0, 0,
          'open', '2026-11-06T00:00:00.000Z', '2026-11-06T00:00:00.000Z'
        )
      `);
      await transaction.execute(`
        INSERT INTO frigora_stock_defect_events (
          id, workspace_id, venture_id, report_id, client_operation_id, event_sequence, event_type,
          quantity_milli, actor_user_id, occurred_at, recorded_at, reason, evidence_reference,
          movement_id, pair_group_id, corrects_pair_group_id, corrects_event_id,
          supplier_reference, replacement_reference, supplier_credit_reference
        ) VALUES (
          'event-a', 'workspace-a', 'venture-a', 'report-a', 'op-event', 1, 'inspected',
          1, 'actor-a', '2026-11-06T00:00:00.000Z', '2026-11-06T00:00:00.000Z', NULL, NULL,
          NULL, NULL, NULL, NULL,
          NULL, NULL, NULL
        )
      `);
    });
    await assert.rejects(
      () => getClient().execute("UPDATE frigora_stock_defect_events SET quantity_milli = 2 WHERE id = 'event-a'"),
      /append-only/,
    );
    await assert.rejects(
      () => getClient().execute("DELETE FROM frigora_stock_defect_events WHERE id = 'event-a'"),
      /append-only/,
    );

    await withFrigoraWriteTransaction(async (transaction) => {
      await transaction.execute(`
        INSERT INTO frigora_stock_operation_receipts (
          id, workspace_id, venture_id, actor_user_id, client_operation_id, operation_type, request_fingerprint, result_json, accepted_at
        ) VALUES (
          'receipt-row', 'workspace-a', 'venture-a', 'actor-a', 'op-receipt', 'receiveStock', 'abc', '{}', '2026-11-06T00:00:00.000Z'
        )
      `);
      await transaction.execute(`
        INSERT INTO frigora_stock_price_policies (
          stock_item_id, version_number, workspace_id, venture_id, method, markup_numerator, markup_denominator,
          fixed_minor_per_unit, clears_override_number, actor_user_id, created_at
        ) VALUES (
          'item-a', 1, 'workspace-a', 'venture-a', 'unset', NULL, NULL, NULL, NULL, 'actor-a', '2026-11-06T00:00:00.000Z'
        )
      `);
      await transaction.execute(`
        INSERT INTO frigora_stock_price_overrides (
          id, workspace_id, venture_id, stock_item_id, override_number, selling_price_minor, reason, actor_user_id, occurred_at
        ) VALUES (
          'override-a', 'workspace-a', 'venture-a', 'item-a', 1, 1500, 'counter price', 'actor-a', '2026-11-06T00:00:00.000Z'
        )
      `);
    });
    await assert.rejects(
      () => getClient().execute("UPDATE frigora_stock_operation_receipts SET result_json = '[]' WHERE id = 'receipt-row'"),
      /append-only/,
    );
    await assert.rejects(
      () => getClient().execute("DELETE FROM frigora_stock_price_policies WHERE stock_item_id = 'item-a'"),
      /append-only/,
    );
    await assert.rejects(
      () => getClient().execute("UPDATE frigora_stock_price_overrides SET reason = 'changed' WHERE id = 'override-a'"),
      /append-only/,
    );
  });

  it("allows customer-site references and requires meaningful description, customer, and site", async () => {
    await openFresh();
    await withFrigoraWriteTransaction(async (transaction) => {
      await transaction.execute(
        "INSERT INTO ventures (id, workspace_id, name, slug, created_at) VALUES ('venture-a', 'workspace-a', 'A', 'a', '2026-11-06T00:00:00.000Z')",
      );
      await transaction.execute(`
        INSERT INTO frigora_stock_locations (
          id, workspace_id, venture_id, name, kind, status, custodian_user_id, created_at, updated_at
        ) VALUES (
          'location-a', 'workspace-a', 'venture-a', 'Warehouse', 'warehouse', 'active', NULL,
          '2026-11-06T00:00:00.000Z', '2026-11-06T00:00:00.000Z'
        )
      `);
      await transaction.execute(`
        INSERT INTO frigora_stock_items (
          id, workspace_id, venture_id, part_reference_id, description, description_normalised,
          unit, unit_custom_label, unit_custom_label_normalised, status, created_at, updated_at
        ) VALUES (
          'item-a', 'workspace-a', 'venture-a', NULL, 'Filter', 'filter',
          'each', NULL, '', 'active', '2026-11-06T00:00:00.000Z', '2026-11-06T00:00:00.000Z'
        )
      `);
      await transaction.execute(`
        INSERT INTO frigora_stock_defect_reports (
          id, workspace_id, venture_id, client_operation_id, kind, stock_item_id, location_id,
          description_snapshot, unit_snapshot, unit_custom_label_snapshot, customer_label, site_label,
          work_order_id, quantity_milli, reporter_user_id, reason, evidence_reference,
          inspected_milli, released_milli, supplier_returned_milli, written_off_milli, reversed_milli,
          status, created_at, updated_at
        ) VALUES (
          'site-omitted', 'workspace-a', 'venture-a', 'op-site-omitted', 'customer_site', NULL, NULL,
          'Leaking valve', NULL, NULL, 'Ada', 'Cold room',
          NULL, 1, 'actor-a', 'seen on site', NULL,
          0, 0, 0, 0, 0,
          'recorded', '2026-11-06T00:00:00.000Z', '2026-11-06T00:00:00.000Z'
        )
      `);
      await transaction.execute(`
        INSERT INTO frigora_stock_defect_reports (
          id, workspace_id, venture_id, client_operation_id, kind, stock_item_id, location_id,
          description_snapshot, unit_snapshot, unit_custom_label_snapshot, customer_label, site_label,
          work_order_id, quantity_milli, reporter_user_id, reason, evidence_reference,
          inspected_milli, released_milli, supplier_returned_milli, written_off_milli, reversed_milli,
          status, created_at, updated_at
        ) VALUES (
          'site-linked', 'workspace-a', 'venture-a', 'op-site-linked', 'customer_site', 'item-a', 'location-a',
          'Leaking valve', NULL, NULL, 'Ada', 'Cold room',
          NULL, 1, 'actor-a', 'seen on site', NULL,
          0, 0, 0, 0, 0,
          'recorded', '2026-11-06T00:00:00.000Z', '2026-11-06T00:00:00.000Z'
        )
      `);
      await transaction.execute(`
        INSERT INTO frigora_stock_defect_reports (
          id, workspace_id, venture_id, client_operation_id, kind, stock_item_id, location_id,
          description_snapshot, unit_snapshot, unit_custom_label_snapshot, customer_label, site_label,
          work_order_id, quantity_milli, reporter_user_id, reason, evidence_reference,
          inspected_milli, released_milli, supplier_returned_milli, written_off_milli, reversed_milli,
          status, created_at, updated_at
        ) VALUES (
          'site-item-only', 'workspace-a', 'venture-a', 'op-site-item-only', 'customer_site', 'item-a', NULL,
          'Leaking valve', NULL, NULL, 'Ada', 'Cold room',
          NULL, 1, 'actor-a', 'seen on site', NULL,
          0, 0, 0, 0, 0,
          'recorded', '2026-11-06T00:00:00.000Z', '2026-11-06T00:00:00.000Z'
        )
      `);
      await transaction.execute(`
        INSERT INTO frigora_stock_defect_reports (
          id, workspace_id, venture_id, client_operation_id, kind, stock_item_id, location_id,
          description_snapshot, unit_snapshot, unit_custom_label_snapshot, customer_label, site_label,
          work_order_id, quantity_milli, reporter_user_id, reason, evidence_reference,
          inspected_milli, released_milli, supplier_returned_milli, written_off_milli, reversed_milli,
          status, created_at, updated_at
        ) VALUES (
          'site-location-only', 'workspace-a', 'venture-a', 'op-site-location-only', 'customer_site', NULL, 'location-a',
          'Leaking valve', NULL, NULL, 'Ada', 'Cold room',
          NULL, 1, 'actor-a', 'seen on site', NULL,
          0, 0, 0, 0, 0,
          'recorded', '2026-11-06T00:00:00.000Z', '2026-11-06T00:00:00.000Z'
        )
      `);
    });
    await assert.rejects(
      () =>
        withFrigoraWriteTransaction(async (transaction) => {
          await transaction.execute(`
            INSERT INTO frigora_stock_defect_reports (
              id, workspace_id, venture_id, client_operation_id, kind, stock_item_id, location_id,
              description_snapshot, unit_snapshot, unit_custom_label_snapshot, customer_label, site_label,
              work_order_id, quantity_milli, reporter_user_id, reason, evidence_reference,
              inspected_milli, released_milli, supplier_returned_milli, written_off_milli, reversed_milli,
              status, created_at, updated_at
            ) VALUES (
              'site-blank', 'workspace-a', 'venture-a', 'op-site-blank', 'customer_site', NULL, NULL,
              '   ', NULL, NULL, 'Ada', 'Cold room',
              NULL, 1, 'actor-a', 'seen on site', NULL,
              0, 0, 0, 0, 0,
              'recorded', '2026-11-06T00:00:00.000Z', '2026-11-06T00:00:00.000Z'
            )
          `);
        }),
      /CHECK constraint failed/,
    );
    await assert.rejects(
      () =>
        withFrigoraWriteTransaction(async (transaction) => {
          await transaction.execute(`
            INSERT INTO frigora_stock_defect_reports (
              id, workspace_id, venture_id, client_operation_id, kind, stock_item_id, location_id,
              description_snapshot, unit_snapshot, unit_custom_label_snapshot, customer_label, site_label,
              work_order_id, quantity_milli, reporter_user_id, reason, evidence_reference,
              inspected_milli, released_milli, supplier_returned_milli, written_off_milli, reversed_milli,
              status, created_at, updated_at
            ) VALUES (
              'site-missing-item', 'workspace-a', 'venture-a', 'op-site-missing', 'customer_site', 'item-missing', NULL,
              'Leaking valve', NULL, NULL, 'Ada', 'Cold room',
              NULL, 1, 'actor-a', 'seen on site', NULL,
              0, 0, 0, 0, 0,
              'recorded', '2026-11-06T00:00:00.000Z', '2026-11-06T00:00:00.000Z'
            )
          `);
        }),
      /FOREIGN KEY|SQLITE_CONSTRAINT/,
    );
    await assert.rejects(
      () =>
        withFrigoraWriteTransaction(async (transaction) => {
          await transaction.execute(`
            INSERT INTO frigora_stock_defect_reports (
              id, workspace_id, venture_id, client_operation_id, kind, stock_item_id, location_id,
              description_snapshot, unit_snapshot, unit_custom_label_snapshot, customer_label, site_label,
              work_order_id, quantity_milli, reporter_user_id, reason, evidence_reference,
              inspected_milli, released_milli, supplier_returned_milli, written_off_milli, reversed_milli,
              status, created_at, updated_at
            ) VALUES (
              'site-missing-location', 'workspace-a', 'venture-a', 'op-site-missing-location', 'customer_site', NULL, 'location-missing',
              'Leaking valve', NULL, NULL, 'Ada', 'Cold room',
              NULL, 1, 'actor-a', 'seen on site', NULL,
              0, 0, 0, 0, 0,
              'recorded', '2026-11-06T00:00:00.000Z', '2026-11-06T00:00:00.000Z'
            )
          `);
        }),
      /FOREIGN KEY|SQLITE_CONSTRAINT/,
    );
    const rejectDescriptive = async (
      id: string,
      description: string | null,
      customer: string | null,
      site: string | null,
    ) => {
      await assert.rejects(
        () =>
          withFrigoraWriteTransaction(async (transaction) => {
            await transaction.execute({
              sql: `
                INSERT INTO frigora_stock_defect_reports (
                  id, workspace_id, venture_id, client_operation_id, kind, stock_item_id, location_id,
                  description_snapshot, unit_snapshot, unit_custom_label_snapshot, customer_label, site_label,
                  work_order_id, quantity_milli, reporter_user_id, reason, evidence_reference,
                  inspected_milli, released_milli, supplier_returned_milli, written_off_milli, reversed_milli,
                  status, created_at, updated_at
                ) VALUES (
                  ?, 'workspace-a', 'venture-a', ?, 'customer_site', NULL, NULL,
                  ?, NULL, NULL, ?, ?,
                  NULL, 1, 'actor-a', 'seen on site', NULL,
                  0, 0, 0, 0, 0,
                  'recorded', '2026-11-06T00:00:00.000Z', '2026-11-06T00:00:00.000Z'
                )
              `,
              args: [id, `op-${id}`, description, customer, site],
            });
          }),
        /CHECK constraint failed/,
      );
    };
    await rejectDescriptive("site-description-null", null, "Ada", "Cold room");
    await rejectDescriptive("site-description-empty", "", "Ada", "Cold room");
    await rejectDescriptive("site-customer-null", "Leaking valve", null, "Cold room");
    await rejectDescriptive("site-customer-empty", "Leaking valve", "", "Cold room");
    await rejectDescriptive("site-customer-blank", "Leaking valve", "   ", "Cold room");
    await rejectDescriptive("site-label-null", "Leaking valve", "Ada", null);
    await rejectDescriptive("site-label-empty", "Leaking valve", "Ada", "");
    await rejectDescriptive("site-label-blank", "Leaking valve", "Ada", "   ");
    const stored = await getClient().execute(
      "SELECT id FROM frigora_stock_defect_reports WHERE kind = 'customer_site' ORDER BY id",
    );
    assert.deepEqual(
      stored.rows.map((row) => String(row.id)),
      ["site-item-only", "site-linked", "site-location-only", "site-omitted"],
    );
  });

  it("keeps a valid supervised verification and rejects an unknown contact", async () => {
    await openFresh();
    await getClient().execute(`
      INSERT INTO frigora_customer_contacts (
        id, workspace_id, venture_id, customer_id, site_id, display_name, email, email_verified_at,
        status, created_by_user_id, created_at, updated_at
      ) VALUES (
        'contact-real', 'workspace-a', 'venture-a', 'customer-a', 'site-a', 'Ada', 'ada@example.com', NULL,
        'active', 'actor-a', '2026-11-06T00:00:00.000Z', '2026-11-06T00:00:00.000Z'
      )
    `);
    await withFrigoraWriteTransaction(async (transaction) => {
      const inserted = await transaction.execute({
        sql: `
          INSERT INTO frigora_contact_supervised_verifications (
            id, contact_id, workspace_id, venture_id, method,
            verified_by_user_id, verified_at, evidence_note, revoked_at, revoked_by_user_id
          )
          SELECT ?, id, workspace_id, venture_id, ?, ?, ?, ?, NULL, NULL
          FROM frigora_customer_contacts
          WHERE id = ? AND workspace_id = ? AND venture_id = ? AND status = 'active'
        `,
        args: [
          "verification-real",
          "telephone",
          "actor-a",
          "2026-11-06T00:00:00.000Z",
          "Called the customer",
          "contact-real",
          "workspace-a",
          "venture-a",
        ],
      });
      assert.equal(inserted.rowsAffected, 1);
      const missing = await transaction.execute({
        sql: `
          INSERT INTO frigora_contact_supervised_verifications (
            id, contact_id, workspace_id, venture_id, method,
            verified_by_user_id, verified_at, evidence_note, revoked_at, revoked_by_user_id
          )
          SELECT ?, id, workspace_id, venture_id, ?, ?, ?, ?, NULL, NULL
          FROM frigora_customer_contacts
          WHERE id = ? AND workspace_id = ? AND venture_id = ? AND status = 'active'
        `,
        args: [
          "verification-missing",
          "telephone",
          "actor-a",
          "2026-11-06T00:00:00.000Z",
          "Called nobody",
          "contact-missing",
          "workspace-a",
          "venture-a",
        ],
      });
      assert.equal(missing.rowsAffected, 0);
    });
    await assert.rejects(
      () =>
        withFrigoraWriteTransaction(async (transaction) => {
          await transaction.execute(`
            INSERT INTO frigora_contact_supervised_verifications (
              id, contact_id, workspace_id, venture_id, method,
              verified_by_user_id, verified_at, evidence_note, revoked_at, revoked_by_user_id
            ) VALUES (
              'verification-dangling', 'contact-missing', 'workspace-a', 'venture-a', 'telephone',
              'actor-a', '2026-11-06T00:00:00.000Z', 'No contact', NULL, NULL
            )
          `);
        }),
      /FOREIGN KEY|SQLITE_CONSTRAINT/,
    );
  });
});
