const CEILING = "9007199254740991";

const CLIENT_OPERATION = `
  length(client_operation_id) BETWEEN 1 AND 128
  AND client_operation_id = trim(client_operation_id)
`;

/**
 * Generation-40 stock foundation. Ten tables from Specification 07 Section 5.
 * Pair groups are identifiers, not a table. Specification 08 ownership is not
 * a constraint here: a reversal movement may name a different item or location
 * than its report so a later malformed-history fixture can be stored.
 *
 * ensureSchema does not call this function. The supported entry point is
 * ensureFrigoraStockSchemaReady in db.ts. That entry point finishes core
 * schema first, because the unique indexes below require ventures and
 * frigora_part_references to exist already. Calling this function does not
 * change SCHEMA_GENERATION, delete stock rows, or alter stock business rules.
 */
export async function ensureFrigoraStockSchema(
  exec: (sql: string) => Promise<void>,
): Promise<void> {
  await exec(
    `CREATE UNIQUE INDEX IF NOT EXISTS ventures_id_workspace_uidx ON ventures (id, workspace_id)`,
  );
  await exec(
    `CREATE UNIQUE INDEX IF NOT EXISTS frigora_part_references_id_scope_uidx ON frigora_part_references (id, workspace_id, venture_id)`,
  );

  await exec(`
    CREATE TABLE IF NOT EXISTS frigora_stock_locations (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      venture_id TEXT NOT NULL,
      name TEXT NOT NULL,
      kind TEXT NOT NULL CHECK (kind IN ('warehouse', 'storage', 'technician_custody')),
      status TEXT NOT NULL CHECK (status IN ('active', 'retired')),
      custodian_user_id TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE (id, workspace_id, venture_id)
    )
  `);
  await exec(
    `CREATE INDEX IF NOT EXISTS frigora_stock_locations_scope_idx ON frigora_stock_locations (workspace_id, venture_id, status)`,
  );
  await exec("DROP TRIGGER IF EXISTS frigora_stock_locations_identity");
  await exec(`
    CREATE TRIGGER frigora_stock_locations_identity
    BEFORE UPDATE ON frigora_stock_locations
    WHEN NEW.id != OLD.id
      OR NEW.workspace_id != OLD.workspace_id
      OR NEW.venture_id != OLD.venture_id
      OR NEW.name != OLD.name
      OR NEW.kind != OLD.kind
      OR NEW.created_at != OLD.created_at
    BEGIN
      SELECT RAISE(ABORT, 'stock location identity is immutable');
    END
  `);
  await exec("DROP TRIGGER IF EXISTS frigora_stock_locations_no_delete");
  await exec(`
    CREATE TRIGGER frigora_stock_locations_no_delete
    BEFORE DELETE ON frigora_stock_locations
    BEGIN
      SELECT RAISE(ABORT, 'stock locations are not deleted');
    END
  `);

  await exec(`
    CREATE TABLE IF NOT EXISTS frigora_stock_items (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      venture_id TEXT NOT NULL,
      part_reference_id TEXT,
      description TEXT NOT NULL CHECK (length(description) BETWEEN 1 AND 200),
      description_normalised TEXT NOT NULL CHECK (length(description_normalised) BETWEEN 1 AND 200),
      unit TEXT NOT NULL CHECK (unit IN ('each', 'metre', 'litre', 'kilogram', 'other')),
      unit_custom_label TEXT,
      unit_custom_label_normalised TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('active', 'retired')),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      CHECK (
        (part_reference_id IS NOT NULL AND length(part_reference_id) > 0)
        OR part_reference_id IS NULL
      ),
      CHECK (
        (unit = 'other' AND unit_custom_label IS NOT NULL AND length(trim(unit_custom_label)) BETWEEN 1 AND 40)
        OR (unit != 'other' AND unit_custom_label IS NULL AND unit_custom_label_normalised = '')
      ),
      UNIQUE (id, workspace_id, venture_id),
      FOREIGN KEY (part_reference_id, workspace_id, venture_id)
        REFERENCES frigora_part_references (id, workspace_id, venture_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT
    )
  `);
  await exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS frigora_stock_items_part_reference_uidx
    ON frigora_stock_items (workspace_id, venture_id, part_reference_id)
    WHERE part_reference_id IS NOT NULL
  `);
  await exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS frigora_stock_items_standalone_uidx
    ON frigora_stock_items (workspace_id, venture_id, description_normalised, unit, unit_custom_label_normalised)
    WHERE part_reference_id IS NULL
  `);
  await exec("DROP TRIGGER IF EXISTS frigora_stock_items_identity");
  await exec(`
    CREATE TRIGGER frigora_stock_items_identity
    BEFORE UPDATE ON frigora_stock_items
    WHEN NEW.id != OLD.id
      OR NEW.workspace_id != OLD.workspace_id
      OR NEW.venture_id != OLD.venture_id
      OR NEW.part_reference_id IS NOT OLD.part_reference_id
      OR NEW.description != OLD.description
      OR NEW.description_normalised != OLD.description_normalised
      OR NEW.unit != OLD.unit
      OR NEW.unit_custom_label IS NOT OLD.unit_custom_label
      OR NEW.unit_custom_label_normalised != OLD.unit_custom_label_normalised
      OR NEW.created_at != OLD.created_at
    BEGIN
      SELECT RAISE(ABORT, 'stock item identity is immutable');
    END
  `);
  await exec("DROP TRIGGER IF EXISTS frigora_stock_items_no_delete");
  await exec(`
    CREATE TRIGGER frigora_stock_items_no_delete
    BEFORE DELETE ON frigora_stock_items
    BEGIN
      SELECT RAISE(ABORT, 'stock items are not deleted');
    END
  `);

  await exec(`
    CREATE TABLE IF NOT EXISTS frigora_stock_defect_reports (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      venture_id TEXT NOT NULL,
      client_operation_id TEXT NOT NULL CHECK (${CLIENT_OPERATION}),
      kind TEXT NOT NULL CHECK (kind IN ('custody', 'customer_site')),
      stock_item_id TEXT,
      location_id TEXT,
      description_snapshot TEXT,
      unit_snapshot TEXT,
      unit_custom_label_snapshot TEXT,
      customer_label TEXT,
      site_label TEXT,
      work_order_id TEXT,
      quantity_milli INTEGER NOT NULL CHECK (typeof(quantity_milli) = 'integer' AND quantity_milli BETWEEN 1 AND ${CEILING}),
      reporter_user_id TEXT NOT NULL,
      reason TEXT NOT NULL,
      evidence_reference TEXT,
      inspected_milli INTEGER NOT NULL CHECK (typeof(inspected_milli) = 'integer' AND inspected_milli BETWEEN 0 AND ${CEILING}),
      released_milli INTEGER NOT NULL CHECK (typeof(released_milli) = 'integer' AND released_milli BETWEEN 0 AND ${CEILING}),
      supplier_returned_milli INTEGER NOT NULL CHECK (typeof(supplier_returned_milli) = 'integer' AND supplier_returned_milli BETWEEN 0 AND ${CEILING}),
      written_off_milli INTEGER NOT NULL CHECK (typeof(written_off_milli) = 'integer' AND written_off_milli BETWEEN 0 AND ${CEILING}),
      reversed_milli INTEGER NOT NULL CHECK (typeof(reversed_milli) = 'integer' AND reversed_milli BETWEEN 0 AND ${CEILING}),
      status TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      CHECK (
        released_milli + supplier_returned_milli + written_off_milli + reversed_milli <= quantity_milli
        AND released_milli + supplier_returned_milli + written_off_milli <= inspected_milli
        AND inspected_milli + reversed_milli <= quantity_milli
      ),
      CHECK (
        (
          kind = 'customer_site'
          AND status = 'recorded'
          AND inspected_milli = 0
          AND released_milli = 0
          AND supplier_returned_milli = 0
          AND written_off_milli = 0
          AND reversed_milli = 0
          AND description_snapshot IS NOT NULL
          AND length(trim(description_snapshot)) >= 1
          AND customer_label IS NOT NULL
          AND length(trim(customer_label)) >= 1
          AND site_label IS NOT NULL
          AND length(trim(site_label)) >= 1
        )
        OR (
          kind = 'custody'
          AND stock_item_id IS NOT NULL
          AND location_id IS NOT NULL
          AND customer_label IS NULL
          AND site_label IS NULL
          AND (
            (
              status = 'open'
              AND quantity_milli - released_milli - supplier_returned_milli - written_off_milli - reversed_milli > 0
            )
            OR (
              status = 'closed'
              AND quantity_milli - released_milli - supplier_returned_milli - written_off_milli - reversed_milli = 0
            )
          )
        )
      ),
      UNIQUE (id, workspace_id, venture_id),
      UNIQUE (venture_id, client_operation_id),
      FOREIGN KEY (stock_item_id, workspace_id, venture_id)
        REFERENCES frigora_stock_items (id, workspace_id, venture_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
      FOREIGN KEY (location_id, workspace_id, venture_id)
        REFERENCES frigora_stock_locations (id, workspace_id, venture_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT
    )
  `);
  await exec("DROP TRIGGER IF EXISTS frigora_stock_defect_reports_facts");
  await exec(`
    CREATE TRIGGER frigora_stock_defect_reports_facts
    BEFORE UPDATE ON frigora_stock_defect_reports
    WHEN NEW.id != OLD.id
      OR NEW.workspace_id != OLD.workspace_id
      OR NEW.venture_id != OLD.venture_id
      OR NEW.client_operation_id != OLD.client_operation_id
      OR NEW.kind != OLD.kind
      OR NEW.stock_item_id IS NOT OLD.stock_item_id
      OR NEW.location_id IS NOT OLD.location_id
      OR NEW.description_snapshot IS NOT OLD.description_snapshot
      OR NEW.unit_snapshot IS NOT OLD.unit_snapshot
      OR NEW.unit_custom_label_snapshot IS NOT OLD.unit_custom_label_snapshot
      OR NEW.customer_label IS NOT OLD.customer_label
      OR NEW.site_label IS NOT OLD.site_label
      OR NEW.work_order_id IS NOT OLD.work_order_id
      OR NEW.quantity_milli != OLD.quantity_milli
      OR NEW.reporter_user_id != OLD.reporter_user_id
      OR NEW.reason != OLD.reason
      OR NEW.evidence_reference IS NOT OLD.evidence_reference
      OR NEW.created_at != OLD.created_at
    BEGIN
      SELECT RAISE(ABORT, 'stock defect report facts are immutable');
    END
  `);
  await exec("DROP TRIGGER IF EXISTS frigora_stock_defect_reports_no_delete");
  await exec(`
    CREATE TRIGGER frigora_stock_defect_reports_no_delete
    BEFORE DELETE ON frigora_stock_defect_reports
    BEGIN
      SELECT RAISE(ABORT, 'stock defect reports are not deleted');
    END
  `);

  await exec(`
    CREATE TABLE IF NOT EXISTS frigora_stock_movements (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      venture_id TEXT NOT NULL,
      stock_item_id TEXT NOT NULL,
      location_id TEXT NOT NULL,
      kind TEXT NOT NULL,
      movement_leg TEXT NOT NULL,
      quantity_milli INTEGER NOT NULL CHECK (typeof(quantity_milli) = 'integer' AND quantity_milli BETWEEN 1 AND ${CEILING}),
      unit_snapshot TEXT NOT NULL,
      unit_custom_label_snapshot TEXT,
      description_snapshot TEXT NOT NULL,
      occurred_at TEXT NOT NULL,
      recorded_at TEXT NOT NULL,
      actor_user_id TEXT NOT NULL,
      reason TEXT,
      client_operation_id TEXT NOT NULL CHECK (${CLIENT_OPERATION}),
      receipt_reference TEXT,
      supplier_reference TEXT,
      supporting_document_reference TEXT,
      entered_unit_cost_minor INTEGER,
      currency TEXT,
      cost_source_movement_id TEXT,
      pair_group_id TEXT,
      corrects_movement_id TEXT,
      defect_report_id TEXT,
      CHECK (
        (kind = 'receipt' AND movement_leg = 'only')
        OR (kind = 'receipt_reversal' AND movement_leg = 'only')
        OR (kind = 'receipt_reinstatement' AND movement_leg = 'only')
        OR (kind = 'transfer_out' AND movement_leg = 'out')
        OR (kind = 'transfer_in' AND movement_leg = 'in')
        OR (kind = 'adjustment_in' AND movement_leg = 'only')
        OR (kind = 'adjustment_out' AND movement_leg = 'only')
        OR (kind = 'quarantine_out' AND movement_leg = 'available_out')
        OR (kind = 'quarantine_in' AND movement_leg = 'quarantine_in')
        OR (kind = 'quarantine_reversal_from_quarantine' AND movement_leg = 'quarantine_reversal_out')
        OR (kind = 'quarantine_reversal_to_available' AND movement_leg = 'quarantine_reversal_in')
        OR (kind = 'quarantine_release' AND movement_leg = 'only')
        OR (kind = 'release_reversal' AND movement_leg = 'only')
        OR (kind = 'supplier_return' AND movement_leg = 'only')
        OR (kind = 'supplier_return_reversal' AND movement_leg = 'only')
        OR (kind = 'write_off' AND movement_leg = 'only')
        OR (kind = 'write_off_reversal' AND movement_leg = 'only')
      ),
      CHECK (
        (
          kind IN (
            'transfer_out', 'transfer_in',
            'quarantine_out', 'quarantine_in',
            'quarantine_reversal_from_quarantine', 'quarantine_reversal_to_available'
          )
          AND pair_group_id IS NOT NULL
        )
        OR (
          kind IN (
            'receipt', 'receipt_reversal', 'receipt_reinstatement',
            'adjustment_in', 'adjustment_out',
            'quarantine_release', 'release_reversal',
            'supplier_return', 'supplier_return_reversal',
            'write_off', 'write_off_reversal'
          )
          AND pair_group_id IS NULL
        )
      ),
      CHECK (
        (
          kind IN (
            'quarantine_out', 'quarantine_in',
            'quarantine_reversal_from_quarantine', 'quarantine_reversal_to_available',
            'quarantine_release', 'release_reversal',
            'supplier_return', 'supplier_return_reversal',
            'write_off', 'write_off_reversal'
          )
          AND defect_report_id IS NOT NULL
        )
        OR (
          kind IN (
            'receipt', 'receipt_reversal', 'receipt_reinstatement',
            'transfer_out', 'transfer_in',
            'adjustment_in', 'adjustment_out'
          )
          AND defect_report_id IS NULL
        )
      ),
      CHECK (
        (entered_unit_cost_minor IS NULL AND currency IS NULL)
        OR (
          typeof(entered_unit_cost_minor) = 'integer'
          AND entered_unit_cost_minor BETWEEN 0 AND ${CEILING}
          AND currency = 'ZAR'
        )
      ),
      CHECK (
        kind IN ('receipt', 'receipt_reversal', 'receipt_reinstatement')
        OR entered_unit_cost_minor IS NULL
      ),
      CHECK (
        (
          kind IN ('receipt_reversal', 'receipt_reinstatement')
          AND cost_source_movement_id IS NOT NULL
        )
        OR (
          kind NOT IN ('receipt_reversal', 'receipt_reinstatement')
          AND cost_source_movement_id IS NULL
        )
      ),
      UNIQUE (id, workspace_id, venture_id),
      UNIQUE (id, defect_report_id, workspace_id, venture_id),
      UNIQUE (id, client_operation_id, workspace_id, venture_id),
      UNIQUE (venture_id, client_operation_id, movement_leg),
      FOREIGN KEY (stock_item_id, workspace_id, venture_id)
        REFERENCES frigora_stock_items (id, workspace_id, venture_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
      FOREIGN KEY (location_id, workspace_id, venture_id)
        REFERENCES frigora_stock_locations (id, workspace_id, venture_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
      FOREIGN KEY (corrects_movement_id, workspace_id, venture_id)
        REFERENCES frigora_stock_movements (id, workspace_id, venture_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
      FOREIGN KEY (cost_source_movement_id, workspace_id, venture_id)
        REFERENCES frigora_stock_movements (id, workspace_id, venture_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
      FOREIGN KEY (defect_report_id, workspace_id, venture_id)
        REFERENCES frigora_stock_defect_reports (id, workspace_id, venture_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT
    )
  `);
  await exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS frigora_stock_movements_pair_leg_uidx
    ON frigora_stock_movements (pair_group_id, movement_leg)
    WHERE pair_group_id IS NOT NULL
  `);
  await exec(`
    CREATE INDEX IF NOT EXISTS frigora_stock_movements_location_idx
    ON frigora_stock_movements (workspace_id, venture_id, stock_item_id, location_id, recorded_at)
  `);
  await exec("DROP TRIGGER IF EXISTS frigora_stock_movements_no_update");
  await exec(`
    CREATE TRIGGER frigora_stock_movements_no_update
    BEFORE UPDATE ON frigora_stock_movements
    BEGIN
      SELECT RAISE(ABORT, 'stock movements are append-only');
    END
  `);
  await exec("DROP TRIGGER IF EXISTS frigora_stock_movements_no_delete");
  await exec(`
    CREATE TRIGGER frigora_stock_movements_no_delete
    BEFORE DELETE ON frigora_stock_movements
    BEGIN
      SELECT RAISE(ABORT, 'stock movements are append-only');
    END
  `);

  await exec(`
    CREATE TABLE IF NOT EXISTS frigora_stock_balances (
      workspace_id TEXT NOT NULL,
      venture_id TEXT NOT NULL,
      stock_item_id TEXT NOT NULL,
      location_id TEXT NOT NULL,
      available_milli INTEGER NOT NULL CHECK (typeof(available_milli) = 'integer' AND available_milli BETWEEN 0 AND ${CEILING}),
      quarantined_milli INTEGER NOT NULL CHECK (typeof(quarantined_milli) = 'integer' AND quarantined_milli BETWEEN 0 AND ${CEILING}),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (workspace_id, venture_id, stock_item_id, location_id),
      FOREIGN KEY (stock_item_id, workspace_id, venture_id)
        REFERENCES frigora_stock_items (id, workspace_id, venture_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
      FOREIGN KEY (location_id, workspace_id, venture_id)
        REFERENCES frigora_stock_locations (id, workspace_id, venture_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT
    )
  `);
  await exec("DROP TRIGGER IF EXISTS frigora_stock_balances_projection");
  await exec(`
    CREATE TRIGGER frigora_stock_balances_projection
    BEFORE UPDATE ON frigora_stock_balances
    WHEN NEW.workspace_id != OLD.workspace_id
      OR NEW.venture_id != OLD.venture_id
      OR NEW.stock_item_id != OLD.stock_item_id
      OR NEW.location_id != OLD.location_id
      OR NEW.created_at != OLD.created_at
    BEGIN
      SELECT RAISE(ABORT, 'stock balance identity is immutable');
    END
  `);
  await exec("DROP TRIGGER IF EXISTS frigora_stock_balances_no_delete");
  await exec(`
    CREATE TRIGGER frigora_stock_balances_no_delete
    BEFORE DELETE ON frigora_stock_balances
    BEGIN
      SELECT RAISE(ABORT, 'stock balances are not deleted');
    END
  `);

  await exec(`
    CREATE TABLE IF NOT EXISTS frigora_stock_operation_receipts (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      venture_id TEXT NOT NULL,
      actor_user_id TEXT NOT NULL,
      client_operation_id TEXT NOT NULL CHECK (${CLIENT_OPERATION}),
      operation_type TEXT NOT NULL,
      request_fingerprint TEXT NOT NULL,
      result_json TEXT NOT NULL,
      accepted_at TEXT NOT NULL,
      UNIQUE (venture_id, client_operation_id)
    )
  `);
  await exec("DROP TRIGGER IF EXISTS frigora_stock_operation_receipts_no_update");
  await exec(`
    CREATE TRIGGER frigora_stock_operation_receipts_no_update
    BEFORE UPDATE ON frigora_stock_operation_receipts
    BEGIN
      SELECT RAISE(ABORT, 'stock operation receipts are append-only');
    END
  `);
  await exec("DROP TRIGGER IF EXISTS frigora_stock_operation_receipts_no_delete");
  await exec(`
    CREATE TRIGGER frigora_stock_operation_receipts_no_delete
    BEFORE DELETE ON frigora_stock_operation_receipts
    BEGIN
      SELECT RAISE(ABORT, 'stock operation receipts are append-only');
    END
  `);

  await exec(`
    CREATE TABLE IF NOT EXISTS frigora_stock_price_policies (
      stock_item_id TEXT NOT NULL,
      version_number INTEGER NOT NULL CHECK (typeof(version_number) = 'integer' AND version_number >= 1),
      workspace_id TEXT NOT NULL,
      venture_id TEXT NOT NULL,
      method TEXT NOT NULL,
      markup_numerator INTEGER,
      markup_denominator INTEGER,
      fixed_minor_per_unit INTEGER,
      clears_override_number INTEGER,
      actor_user_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      PRIMARY KEY (stock_item_id, version_number),
      CHECK (
        (
          method = 'percentage'
          AND markup_numerator >= 0
          AND markup_denominator > 0
          AND fixed_minor_per_unit IS NULL
        )
        OR (
          method = 'fixed_per_unit'
          AND markup_numerator IS NULL
          AND markup_denominator IS NULL
          AND fixed_minor_per_unit IS NOT NULL
        )
        OR (
          method = 'unset'
          AND markup_numerator IS NULL
          AND markup_denominator IS NULL
          AND fixed_minor_per_unit IS NULL
        )
      ),
      FOREIGN KEY (stock_item_id, workspace_id, venture_id)
        REFERENCES frigora_stock_items (id, workspace_id, venture_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT
    )
  `);
  await exec("DROP TRIGGER IF EXISTS frigora_stock_price_policies_no_update");
  await exec(`
    CREATE TRIGGER frigora_stock_price_policies_no_update
    BEFORE UPDATE ON frigora_stock_price_policies
    BEGIN
      SELECT RAISE(ABORT, 'stock price policies are append-only');
    END
  `);
  await exec("DROP TRIGGER IF EXISTS frigora_stock_price_policies_no_delete");
  await exec(`
    CREATE TRIGGER frigora_stock_price_policies_no_delete
    BEFORE DELETE ON frigora_stock_price_policies
    BEGIN
      SELECT RAISE(ABORT, 'stock price policies are append-only');
    END
  `);

  await exec(`
    CREATE TABLE IF NOT EXISTS frigora_stock_price_overrides (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      venture_id TEXT NOT NULL,
      stock_item_id TEXT NOT NULL,
      override_number INTEGER NOT NULL CHECK (typeof(override_number) = 'integer' AND override_number >= 1),
      selling_price_minor INTEGER NOT NULL CHECK (typeof(selling_price_minor) = 'integer' AND selling_price_minor BETWEEN 0 AND ${CEILING}),
      reason TEXT NOT NULL CHECK (length(trim(reason)) >= 1),
      actor_user_id TEXT NOT NULL,
      occurred_at TEXT NOT NULL,
      UNIQUE (stock_item_id, override_number),
      FOREIGN KEY (stock_item_id, workspace_id, venture_id)
        REFERENCES frigora_stock_items (id, workspace_id, venture_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT
    )
  `);
  await exec("DROP TRIGGER IF EXISTS frigora_stock_price_overrides_no_update");
  await exec(`
    CREATE TRIGGER frigora_stock_price_overrides_no_update
    BEFORE UPDATE ON frigora_stock_price_overrides
    BEGIN
      SELECT RAISE(ABORT, 'stock price overrides are append-only');
    END
  `);
  await exec("DROP TRIGGER IF EXISTS frigora_stock_price_overrides_no_delete");
  await exec(`
    CREATE TRIGGER frigora_stock_price_overrides_no_delete
    BEFORE DELETE ON frigora_stock_price_overrides
    BEGIN
      SELECT RAISE(ABORT, 'stock price overrides are append-only');
    END
  `);

  await exec(`
    CREATE TABLE IF NOT EXISTS frigora_stock_defect_event_sequences (
      venture_id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      next_sequence INTEGER NOT NULL CHECK (typeof(next_sequence) = 'integer' AND next_sequence >= 0),
      UNIQUE (venture_id, workspace_id),
      FOREIGN KEY (venture_id, workspace_id)
        REFERENCES ventures (id, workspace_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT
    )
  `);
  await exec("DROP TRIGGER IF EXISTS frigora_stock_defect_event_sequences_increment");
  await exec(`
    CREATE TRIGGER frigora_stock_defect_event_sequences_increment
    BEFORE UPDATE ON frigora_stock_defect_event_sequences
    WHEN NEW.venture_id != OLD.venture_id
      OR NEW.workspace_id != OLD.workspace_id
      OR NEW.next_sequence != OLD.next_sequence + 1
    BEGIN
      SELECT RAISE(ABORT, 'stock defect sequence advances by one');
    END
  `);
  await exec("DROP TRIGGER IF EXISTS frigora_stock_defect_event_sequences_no_delete");
  await exec(`
    CREATE TRIGGER frigora_stock_defect_event_sequences_no_delete
    BEFORE DELETE ON frigora_stock_defect_event_sequences
    BEGIN
      SELECT RAISE(ABORT, 'stock defect sequences are not deleted');
    END
  `);

  await exec(`
    CREATE TABLE IF NOT EXISTS frigora_stock_defect_events (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      venture_id TEXT NOT NULL,
      report_id TEXT NOT NULL,
      client_operation_id TEXT NOT NULL CHECK (${CLIENT_OPERATION}),
      event_sequence INTEGER NOT NULL CHECK (typeof(event_sequence) = 'integer' AND event_sequence >= 1),
      event_type TEXT NOT NULL,
      quantity_milli INTEGER NOT NULL CHECK (typeof(quantity_milli) = 'integer' AND quantity_milli BETWEEN 1 AND ${CEILING}),
      actor_user_id TEXT NOT NULL,
      occurred_at TEXT NOT NULL,
      recorded_at TEXT NOT NULL,
      reason TEXT,
      evidence_reference TEXT,
      movement_id TEXT,
      pair_group_id TEXT,
      corrects_pair_group_id TEXT,
      corrects_event_id TEXT,
      supplier_reference TEXT,
      replacement_reference TEXT,
      supplier_credit_reference TEXT,
      CHECK (
        (event_type = 'inspected' AND movement_id IS NULL AND pair_group_id IS NULL AND corrects_pair_group_id IS NULL AND corrects_event_id IS NULL)
        OR (event_type = 'released' AND movement_id IS NOT NULL AND pair_group_id IS NULL AND corrects_pair_group_id IS NULL AND corrects_event_id IS NULL)
        OR (event_type = 'supplier_returned' AND movement_id IS NOT NULL AND pair_group_id IS NULL AND corrects_pair_group_id IS NULL AND corrects_event_id IS NULL)
        OR (event_type = 'written_off' AND movement_id IS NOT NULL AND pair_group_id IS NULL AND corrects_pair_group_id IS NULL AND corrects_event_id IS NULL)
        OR (event_type = 'disposition_reversed' AND movement_id IS NOT NULL AND pair_group_id IS NULL AND corrects_pair_group_id IS NULL AND corrects_event_id IS NOT NULL)
        OR (event_type = 'quarantine_reversed' AND movement_id IS NULL AND pair_group_id IS NOT NULL AND corrects_pair_group_id IS NOT NULL AND corrects_event_id IS NULL)
      ),
      CHECK (
        event_type = 'supplier_returned'
        OR (
          supplier_reference IS NULL
          AND replacement_reference IS NULL
          AND supplier_credit_reference IS NULL
        )
      ),
      UNIQUE (venture_id, event_sequence),
      UNIQUE (venture_id, client_operation_id),
      UNIQUE (id, report_id, workspace_id, venture_id),
      FOREIGN KEY (report_id, workspace_id, venture_id)
        REFERENCES frigora_stock_defect_reports (id, workspace_id, venture_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
      FOREIGN KEY (venture_id, workspace_id)
        REFERENCES frigora_stock_defect_event_sequences (venture_id, workspace_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
      FOREIGN KEY (movement_id, report_id, workspace_id, venture_id)
        REFERENCES frigora_stock_movements (id, defect_report_id, workspace_id, venture_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
      FOREIGN KEY (movement_id, client_operation_id, workspace_id, venture_id)
        REFERENCES frigora_stock_movements (id, client_operation_id, workspace_id, venture_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
      FOREIGN KEY (corrects_event_id, report_id, workspace_id, venture_id)
        REFERENCES frigora_stock_defect_events (id, report_id, workspace_id, venture_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT
    )
  `);
  await exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS frigora_stock_defect_events_movement_uidx
    ON frigora_stock_defect_events (movement_id)
    WHERE movement_id IS NOT NULL
  `);
  await exec("DROP TRIGGER IF EXISTS frigora_stock_defect_events_no_update");
  await exec(`
    CREATE TRIGGER frigora_stock_defect_events_no_update
    BEFORE UPDATE ON frigora_stock_defect_events
    BEGIN
      SELECT RAISE(ABORT, 'stock defect events are append-only');
    END
  `);
  await exec("DROP TRIGGER IF EXISTS frigora_stock_defect_events_no_delete");
  await exec(`
    CREATE TRIGGER frigora_stock_defect_events_no_delete
    BEFORE DELETE ON frigora_stock_defect_events
    BEGIN
      SELECT RAISE(ABORT, 'stock defect events are append-only');
    END
  `);
}
