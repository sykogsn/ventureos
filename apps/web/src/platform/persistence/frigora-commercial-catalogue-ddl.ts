/**
 * Commercial catalogue foundation.
 *
 * ensureSchema does not call this function, and this function does not call
 * stock DDL. The supported entry point is ensureFrigoraCommercialCatalogueSchema
 * in db.ts, which finishes core schema first. Applying it does not change
 * SCHEMA_GENERATION and does not allocate generation 41.
 *
 * Purchase cost lives only on frigora_commercial_item_costs. Item reads must
 * not select that table.
 */
export async function applyFrigoraCommercialCatalogueSchema(
  exec: (sql: string) => Promise<void>,
): Promise<void> {
  await exec(`
    CREATE TABLE IF NOT EXISTS frigora_commercial_items (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      venture_id TEXT NOT NULL,
      sku TEXT NOT NULL CHECK (length(trim(sku)) BETWEEN 1 AND 64),
      sku_normalised TEXT NOT NULL CHECK (length(sku_normalised) BETWEEN 1 AND 64),
      description TEXT NOT NULL CHECK (length(trim(description)) BETWEEN 1 AND 400),
      category TEXT NOT NULL CHECK (length(category) <= 120),
      manufacturer TEXT NOT NULL CHECK (length(manufacturer) <= 120),
      model TEXT NOT NULL CHECK (length(model) <= 120),
      unit TEXT NOT NULL CHECK (unit IN ('each', 'metre', 'litre', 'kilogram', 'other')),
      selling_price_minor INTEGER NOT NULL CHECK (selling_price_minor >= 0),
      currency TEXT NOT NULL CHECK (currency = 'ZAR'),
      tax_treatment TEXT NOT NULL CHECK (tax_treatment IN ('not_registered', 'configured_rule')),
      supplier_reference TEXT NOT NULL CHECK (length(supplier_reference) <= 200),
      status TEXT NOT NULL CHECK (status IN ('active', 'discontinued')),
      created_at TEXT NOT NULL,
      created_by_user_id TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      updated_by_user_id TEXT NOT NULL,
      UNIQUE (id, workspace_id, venture_id)
    )
  `);
  await exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS frigora_commercial_items_sku_uidx
    ON frigora_commercial_items (workspace_id, venture_id, sku_normalised)
  `);
  await exec("DROP TRIGGER IF EXISTS frigora_commercial_items_identity");
  await exec(`
    CREATE TRIGGER frigora_commercial_items_identity
    BEFORE UPDATE ON frigora_commercial_items
    WHEN NEW.id != OLD.id
      OR NEW.workspace_id != OLD.workspace_id
      OR NEW.venture_id != OLD.venture_id
      OR NEW.created_at != OLD.created_at
      OR NEW.created_by_user_id != OLD.created_by_user_id
      OR NEW.currency != OLD.currency
    BEGIN
      SELECT RAISE(ABORT, 'commercial item identity is immutable');
    END
  `);
  await exec("DROP TRIGGER IF EXISTS frigora_commercial_items_no_delete");
  await exec(`
    CREATE TRIGGER frigora_commercial_items_no_delete
    BEFORE DELETE ON frigora_commercial_items
    BEGIN
      SELECT RAISE(ABORT, 'commercial items are not deleted');
    END
  `);

  await exec(`
    CREATE TABLE IF NOT EXISTS frigora_commercial_item_costs (
      item_id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      venture_id TEXT NOT NULL,
      purchase_cost_minor INTEGER NOT NULL CHECK (purchase_cost_minor >= 0),
      currency TEXT NOT NULL CHECK (currency = 'ZAR'),
      updated_at TEXT NOT NULL,
      updated_by_user_id TEXT NOT NULL,
      FOREIGN KEY (item_id, workspace_id, venture_id)
        REFERENCES frigora_commercial_items (id, workspace_id, venture_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT
    )
  `);
  await exec("DROP TRIGGER IF EXISTS frigora_commercial_item_costs_identity");
  await exec(`
    CREATE TRIGGER frigora_commercial_item_costs_identity
    BEFORE UPDATE ON frigora_commercial_item_costs
    WHEN NEW.item_id != OLD.item_id
      OR NEW.workspace_id != OLD.workspace_id
      OR NEW.venture_id != OLD.venture_id
      OR NEW.currency != OLD.currency
    BEGIN
      SELECT RAISE(ABORT, 'commercial item cost identity is immutable');
    END
  `);
  await exec("DROP TRIGGER IF EXISTS frigora_commercial_item_costs_no_delete");
  await exec(`
    CREATE TRIGGER frigora_commercial_item_costs_no_delete
    BEFORE DELETE ON frigora_commercial_item_costs
    BEGIN
      SELECT RAISE(ABORT, 'commercial item costs are not deleted');
    END
  `);
}
