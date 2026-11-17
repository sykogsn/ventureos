/**
 * Commercial quotation line snapshots.
 *
 * ensureSchema does not call this function. It does not call stock or catalogue
 * DDL. The supported entry point is ensureFrigoraCommercialLinesSchema in db.ts,
 * which finishes core schema first. Applying it does not change SCHEMA_GENERATION.
 *
 * Line rows copy selling fields. They do not store purchase cost, margin, or a
 * document hash. Issued lines are frozen by trigger. Draft lines can be replaced.
 */
export async function applyFrigoraCommercialLinesSchema(
  exec: (sql: string) => Promise<void>,
): Promise<void> {
  await exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS frigora_quotation_versions_scope_uidx
    ON frigora_quotation_versions (quotation_id, version_number, workspace_id, venture_id)
  `);
  await exec(`
    CREATE TABLE IF NOT EXISTS frigora_quotation_line_snapshots (
      id TEXT PRIMARY KEY,
      quotation_id TEXT NOT NULL,
      version_number INTEGER NOT NULL,
      workspace_id TEXT NOT NULL,
      venture_id TEXT NOT NULL,
      line_number INTEGER NOT NULL CHECK (line_number >= 1),
      source_type TEXT NOT NULL CHECK (source_type IN ('catalogue', 'custom')),
      catalogue_item_id TEXT,
      sku TEXT,
      description TEXT NOT NULL CHECK (length(trim(description)) BETWEEN 1 AND 400),
      unit TEXT NOT NULL CHECK (unit IN ('each', 'metre', 'litre', 'kilogram', 'other')),
      quantity_milli INTEGER NOT NULL CHECK (quantity_milli >= 0),
      unit_price_minor INTEGER NOT NULL CHECK (unit_price_minor >= 0),
      currency TEXT NOT NULL CHECK (currency = 'ZAR'),
      tax_treatment TEXT NOT NULL CHECK (tax_treatment IN ('not_registered', 'configured_rule')),
      line_role TEXT NOT NULL CHECK (line_role IN ('mandatory', 'optional')),
      discount_eligible INTEGER NOT NULL CHECK (discount_eligible IN (0, 1)),
      created_at TEXT NOT NULL,
      created_by_user_id TEXT NOT NULL,
      CHECK (
        (
          source_type = 'catalogue'
          AND catalogue_item_id IS NOT NULL
          AND length(trim(catalogue_item_id)) > 0
          AND sku IS NOT NULL
          AND length(trim(sku)) BETWEEN 1 AND 64
        )
        OR (
          source_type = 'custom'
          AND catalogue_item_id IS NULL
          AND sku IS NULL
        )
      ),
      FOREIGN KEY (quotation_id, version_number, workspace_id, venture_id)
        REFERENCES frigora_quotation_versions (quotation_id, version_number, workspace_id, venture_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT
    )
  `);
  await exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS frigora_quotation_line_snapshots_number_uidx
    ON frigora_quotation_line_snapshots (
      quotation_id, version_number, workspace_id, venture_id, line_number
    )
  `);
  await exec("DROP TRIGGER IF EXISTS frigora_quotation_line_snapshots_insert_draft");
  await exec(`
    CREATE TRIGGER frigora_quotation_line_snapshots_insert_draft
    BEFORE INSERT ON frigora_quotation_line_snapshots
    WHEN IFNULL((
      SELECT status FROM frigora_quotation_versions
      WHERE quotation_id = NEW.quotation_id
        AND version_number = NEW.version_number
        AND workspace_id = NEW.workspace_id
        AND venture_id = NEW.venture_id
    ), '') != 'in_preparation'
    BEGIN
      SELECT RAISE(ABORT, 'quotation lines can only be added to a draft');
    END
  `);
  await exec("DROP TRIGGER IF EXISTS frigora_quotation_line_snapshots_update_draft");
  await exec(`
    CREATE TRIGGER frigora_quotation_line_snapshots_update_draft
    BEFORE UPDATE ON frigora_quotation_line_snapshots
    WHEN IFNULL((
      SELECT status FROM frigora_quotation_versions
      WHERE quotation_id = OLD.quotation_id
        AND version_number = OLD.version_number
        AND workspace_id = OLD.workspace_id
        AND venture_id = OLD.venture_id
    ), '') != 'in_preparation'
    BEGIN
      SELECT RAISE(ABORT, 'issued quotation lines cannot be changed');
    END
  `);
  await exec("DROP TRIGGER IF EXISTS frigora_quotation_line_snapshots_delete_draft");
  await exec(`
    CREATE TRIGGER frigora_quotation_line_snapshots_delete_draft
    BEFORE DELETE ON frigora_quotation_line_snapshots
    WHEN IFNULL((
      SELECT status FROM frigora_quotation_versions
      WHERE quotation_id = OLD.quotation_id
        AND version_number = OLD.version_number
        AND workspace_id = OLD.workspace_id
        AND venture_id = OLD.venture_id
    ), '') != 'in_preparation'
    BEGIN
      SELECT RAISE(ABORT, 'issued quotation lines cannot be changed');
    END
  `);
  await exec("DROP TRIGGER IF EXISTS frigora_quotation_line_snapshots_insert_current");
  await exec(`
    CREATE TRIGGER frigora_quotation_line_snapshots_insert_current
    BEFORE INSERT ON frigora_quotation_line_snapshots
    WHEN NOT EXISTS (
      SELECT 1
      FROM frigora_quotation_versions v
      JOIN frigora_quotations q
        ON q.id = v.quotation_id
       AND q.workspace_id = v.workspace_id
       AND q.venture_id = v.venture_id
      WHERE v.quotation_id = NEW.quotation_id
        AND v.version_number = NEW.version_number
        AND v.workspace_id = NEW.workspace_id
        AND v.venture_id = NEW.venture_id
        AND v.status = 'in_preparation'
        AND (
          q.current_version = NEW.version_number
          OR q.current_version + 1 = NEW.version_number
        )
    )
    BEGIN
      SELECT RAISE(ABORT, 'quotation lines can only be added to the current draft');
    END
  `);
  await exec("DROP TRIGGER IF EXISTS frigora_quotation_line_snapshots_update_historical");
  await exec(`
    CREATE TRIGGER frigora_quotation_line_snapshots_update_historical
    BEFORE UPDATE ON frigora_quotation_line_snapshots
    WHEN NOT EXISTS (
      SELECT 1 FROM frigora_quotations q
      WHERE q.id = OLD.quotation_id
        AND q.workspace_id = OLD.workspace_id
        AND q.venture_id = OLD.venture_id
        AND q.current_version = OLD.version_number
    )
    BEGIN
      SELECT RAISE(ABORT, 'historical quotation lines cannot be changed');
    END
  `);
  await exec("DROP TRIGGER IF EXISTS frigora_quotation_line_snapshots_delete_historical");
  await exec(`
    CREATE TRIGGER frigora_quotation_line_snapshots_delete_historical
    BEFORE DELETE ON frigora_quotation_line_snapshots
    WHEN NOT EXISTS (
      SELECT 1 FROM frigora_quotations q
      WHERE q.id = OLD.quotation_id
        AND q.workspace_id = OLD.workspace_id
        AND q.venture_id = OLD.venture_id
        AND q.current_version = OLD.version_number
    )
    BEGIN
      SELECT RAISE(ABORT, 'historical quotation lines cannot be changed');
    END
  `);
  await exec("DROP TRIGGER IF EXISTS frigora_quotation_line_snapshots_reassign_blocked");
  await exec(`
    CREATE TRIGGER frigora_quotation_line_snapshots_reassign_blocked
    BEFORE UPDATE ON frigora_quotation_line_snapshots
    WHEN (
      NEW.quotation_id != OLD.quotation_id
      OR NEW.version_number != OLD.version_number
      OR NEW.workspace_id != OLD.workspace_id
      OR NEW.venture_id != OLD.venture_id
    )
    AND NOT EXISTS (
      SELECT 1
      FROM frigora_quotation_versions v
      JOIN frigora_quotations q
        ON q.id = v.quotation_id
       AND q.workspace_id = v.workspace_id
       AND q.venture_id = v.venture_id
      WHERE v.quotation_id = NEW.quotation_id
        AND v.version_number = NEW.version_number
        AND v.workspace_id = NEW.workspace_id
        AND v.venture_id = NEW.venture_id
        AND v.status = 'in_preparation'
        AND q.current_version = NEW.version_number
    )
    BEGIN
      SELECT RAISE(ABORT, 'quotation lines cannot be moved onto another version');
    END
  `);
  await exec("DROP TRIGGER IF EXISTS frigora_quotation_versions_block_line_issue_update");
  await exec(`
    CREATE TRIGGER frigora_quotation_versions_block_line_issue_update
    BEFORE UPDATE OF status ON frigora_quotation_versions
    WHEN NEW.status = 'awaiting_customer_approval'
      AND OLD.status != 'awaiting_customer_approval'
      AND EXISTS (
        SELECT 1 FROM frigora_quotation_line_snapshots line
        WHERE line.quotation_id = NEW.quotation_id
          AND line.version_number = NEW.version_number
          AND line.workspace_id = NEW.workspace_id
          AND line.venture_id = NEW.venture_id
          AND (
            NEW.tax_treatment IS NULL
            OR line.discount_eligible <> 0
            OR (
              line.tax_treatment = 'configured_rule'
              AND NEW.tax_treatment IS NOT 'configured_rule'
            )
          )
      )
    BEGIN
      SELECT RAISE(ABORT, 'line-bearing quotation cannot be issued');
    END
  `);
  await exec("DROP TRIGGER IF EXISTS frigora_quotation_versions_block_line_issue_insert");
  await exec(`
    CREATE TRIGGER frigora_quotation_versions_block_line_issue_insert
    BEFORE INSERT ON frigora_quotation_versions
    WHEN NEW.status = 'awaiting_customer_approval'
      AND EXISTS (
        SELECT 1 FROM frigora_quotation_line_snapshots line
        WHERE line.quotation_id = NEW.quotation_id
          AND line.version_number = NEW.version_number
          AND line.workspace_id = NEW.workspace_id
          AND line.venture_id = NEW.venture_id
          AND (
            NEW.tax_treatment IS NULL
            OR line.discount_eligible <> 0
            OR (
              line.tax_treatment = 'configured_rule'
              AND NEW.tax_treatment IS NOT 'configured_rule'
            )
          )
      )
    BEGIN
      SELECT RAISE(ABORT, 'line-bearing quotation cannot be issued');
    END
  `);
  await exec("DROP TRIGGER IF EXISTS frigora_quotations_identity_immutable");
  await exec(`
    CREATE TRIGGER frigora_quotations_identity_immutable
    BEFORE UPDATE OF current_version, workspace_id, venture_id ON frigora_quotations
    WHEN NEW.current_version < OLD.current_version
      OR NEW.workspace_id IS NOT OLD.workspace_id
      OR NEW.venture_id IS NOT OLD.venture_id
    BEGIN
      SELECT RAISE(ABORT, 'quotation identity and version history cannot be rewritten');
    END
  `);
  await exec("DROP TRIGGER IF EXISTS frigora_quotation_line_snapshots_identity_immutable");
  await exec(`
    CREATE TRIGGER frigora_quotation_line_snapshots_identity_immutable
    BEFORE UPDATE OF quotation_id, version_number, workspace_id, venture_id
    ON frigora_quotation_line_snapshots
    WHEN NEW.quotation_id IS NOT OLD.quotation_id
      OR NEW.version_number IS NOT OLD.version_number
      OR NEW.workspace_id IS NOT OLD.workspace_id
      OR NEW.venture_id IS NOT OLD.venture_id
    BEGIN
      SELECT RAISE(ABORT, 'quotation line identity cannot be changed');
    END
  `);
  await exec(`
    CREATE TABLE IF NOT EXISTS frigora_quotation_line_identities (
      line_id TEXT NOT NULL,
      copy INTEGER NOT NULL CHECK (copy IN (0, 1)),
      quotation_id TEXT NOT NULL,
      version_number INTEGER NOT NULL,
      workspace_id TEXT NOT NULL,
      venture_id TEXT NOT NULL,
      PRIMARY KEY (line_id, copy)
    )
  `);
  await exec(`
    CREATE TABLE IF NOT EXISTS frigora_quotation_version_seals (
      quotation_id TEXT NOT NULL,
      version_number INTEGER NOT NULL,
      copy INTEGER NOT NULL CHECK (copy IN (0, 1)),
      workspace_id TEXT NOT NULL,
      venture_id TEXT NOT NULL,
      PRIMARY KEY (quotation_id, version_number, copy)
    )
  `);
  await exec("DROP TRIGGER IF EXISTS frigora_quotations_delete_blocked");
  await exec(`
    CREATE TRIGGER frigora_quotations_delete_blocked
    BEFORE DELETE ON frigora_quotations
    BEGIN
      SELECT RAISE(ABORT, 'quotation identity and version history cannot be rewritten');
    END
  `);
  await exec("DROP TRIGGER IF EXISTS frigora_quotations_insert_guard");
  await exec(`
    CREATE TRIGGER frigora_quotations_insert_guard
    BEFORE INSERT ON frigora_quotations
    WHEN EXISTS (
      SELECT 1 FROM frigora_quotation_versions
      WHERE quotation_id = NEW.id
        AND (
          version_number > NEW.current_version
          OR workspace_id IS NOT NEW.workspace_id
          OR venture_id IS NOT NEW.venture_id
        )
    ) OR EXISTS (
      SELECT 1 FROM frigora_quotation_line_snapshots
      WHERE quotation_id = NEW.id
        AND (
          version_number > NEW.current_version
          OR workspace_id IS NOT NEW.workspace_id
          OR venture_id IS NOT NEW.venture_id
        )
    ) OR EXISTS (
      SELECT 1 FROM frigora_quotation_line_identities
      WHERE quotation_id = NEW.id
        AND (
          version_number > NEW.current_version
          OR workspace_id IS NOT NEW.workspace_id
          OR venture_id IS NOT NEW.venture_id
        )
    ) OR (
      (SELECT MAX(version_number) FROM frigora_quotation_versions WHERE quotation_id = NEW.id) IS NOT NULL
      AND (SELECT MAX(version_number) FROM frigora_quotation_versions WHERE quotation_id = NEW.id) != NEW.current_version
    )
    BEGIN
      SELECT RAISE(ABORT, 'quotation identity and version history cannot be rewritten');
    END
  `);
  await exec("DROP TRIGGER IF EXISTS frigora_quotations_version_sequence");
  await exec(`
    CREATE TRIGGER frigora_quotations_version_sequence
    BEFORE UPDATE OF current_version ON frigora_quotations
    WHEN NEW.current_version != OLD.current_version
      AND (
        NEW.current_version != OLD.current_version + 1
        OR NOT EXISTS (
          SELECT 1 FROM frigora_quotation_versions
          WHERE quotation_id = OLD.id
            AND version_number = NEW.current_version
            AND workspace_id = OLD.workspace_id
            AND venture_id = OLD.venture_id
        )
      )
    BEGIN
      SELECT RAISE(ABORT, 'quotation identity and version history cannot be rewritten');
    END
  `);
  await exec("DROP TRIGGER IF EXISTS frigora_quotation_versions_delete_blocked");
  await exec(`
    CREATE TRIGGER frigora_quotation_versions_delete_blocked
    BEFORE DELETE ON frigora_quotation_versions
    BEGIN
      SELECT RAISE(ABORT, 'quotation version history cannot be deleted');
    END
  `);
  await exec("DROP TRIGGER IF EXISTS frigora_quotation_versions_historical_update");
  await exec(`
    CREATE TRIGGER frigora_quotation_versions_historical_update
    BEFORE UPDATE ON frigora_quotation_versions
    WHEN NOT EXISTS (
      SELECT 1 FROM frigora_quotations q
      WHERE q.id = OLD.quotation_id
        AND q.workspace_id = OLD.workspace_id
        AND q.venture_id = OLD.venture_id
        AND q.current_version = OLD.version_number
    )
    BEGIN
      SELECT RAISE(ABORT, 'historical quotation versions cannot be changed');
    END
  `);
  await exec("DROP TRIGGER IF EXISTS frigora_quotation_versions_identity_immutable");
  await exec(`
    CREATE TRIGGER frigora_quotation_versions_identity_immutable
    BEFORE UPDATE OF quotation_id, version_number, workspace_id, venture_id
    ON frigora_quotation_versions
    WHEN NEW.quotation_id IS NOT OLD.quotation_id
      OR NEW.version_number IS NOT OLD.version_number
      OR NEW.workspace_id IS NOT OLD.workspace_id
      OR NEW.venture_id IS NOT OLD.venture_id
    BEGIN
      SELECT RAISE(ABORT, 'version identity blocked');
    END
  `);
  await exec("DROP TRIGGER IF EXISTS frigora_quotation_versions_sequence");
  await exec(`
    CREATE TRIGGER frigora_quotation_versions_sequence
    BEFORE INSERT ON frigora_quotation_versions
    WHEN NOT EXISTS (
      SELECT 1 FROM frigora_quotations q
      WHERE q.id = NEW.quotation_id
        AND q.workspace_id = NEW.workspace_id
        AND q.venture_id = NEW.venture_id
        AND (
          q.current_version = NEW.version_number
          OR q.current_version + 1 = NEW.version_number
        )
    )
    BEGIN
      SELECT RAISE(ABORT, 'quotation versions can only be added to the current draft');
    END
  `);
  await exec("DROP TRIGGER IF EXISTS frigora_quotation_versions_seal_guard");
  await exec(`
    CREATE TRIGGER frigora_quotation_versions_seal_guard
    BEFORE INSERT ON frigora_quotation_versions
    BEGIN
      SELECT RAISE(ABORT, 'version identity blocked')
      WHERE EXISTS (
        SELECT 1 FROM frigora_quotation_version_seals
        WHERE quotation_id = NEW.quotation_id
          AND version_number = NEW.version_number
      );
      INSERT INTO frigora_quotation_version_seals (
        quotation_id, version_number, copy, workspace_id, venture_id
      )
      SELECT NEW.quotation_id, NEW.version_number, 0, NEW.workspace_id, NEW.venture_id
      WHERE NOT EXISTS (
        SELECT 1 FROM frigora_quotation_version_seals
        WHERE quotation_id = NEW.quotation_id
          AND version_number = NEW.version_number
          AND copy = 0
      );
      INSERT INTO frigora_quotation_version_seals (
        quotation_id, version_number, copy, workspace_id, venture_id
      )
      SELECT NEW.quotation_id, NEW.version_number, 1, NEW.workspace_id, NEW.venture_id
      WHERE NOT EXISTS (
        SELECT 1 FROM frigora_quotation_version_seals
        WHERE quotation_id = NEW.quotation_id
          AND version_number = NEW.version_number
          AND copy = 1
      );
    END
  `);
  await exec("DROP TRIGGER IF EXISTS frigora_quotation_version_seals_update");
  await exec(`
    CREATE TRIGGER frigora_quotation_version_seals_update
    BEFORE UPDATE ON frigora_quotation_version_seals
    BEGIN
      SELECT RAISE(ABORT, 'quotation version seal cannot be changed');
    END
  `);
  await exec("DROP TRIGGER IF EXISTS frigora_quotation_version_seals_delete");
  await exec(`
    CREATE TRIGGER frigora_quotation_version_seals_delete
    BEFORE DELETE ON frigora_quotation_version_seals
    BEGIN
      SELECT RAISE(ABORT, 'quotation version seal cannot be changed');
    END
  `);
  await exec("DROP TRIGGER IF EXISTS frigora_quotation_version_seals_replace");
  await exec(`
    CREATE TRIGGER frigora_quotation_version_seals_replace
    BEFORE INSERT ON frigora_quotation_version_seals
    WHEN EXISTS (
      SELECT 1 FROM frigora_quotation_version_seals other
      WHERE other.quotation_id = NEW.quotation_id
        AND other.version_number = NEW.version_number
        AND other.copy != NEW.copy
        AND (
          other.workspace_id IS NOT NEW.workspace_id
          OR other.venture_id IS NOT NEW.venture_id
        )
    )
    BEGIN
      SELECT RAISE(ABORT, 'quotation version seal cannot be changed');
    END
  `);
  await exec("DROP TRIGGER IF EXISTS frigora_quotation_line_identities_update");
  await exec(`
    CREATE TRIGGER frigora_quotation_line_identities_update
    BEFORE UPDATE ON frigora_quotation_line_identities
    BEGIN
      SELECT RAISE(ABORT, 'quotation line identity cannot be changed');
    END
  `);
  await exec("DROP TRIGGER IF EXISTS frigora_quotation_line_identities_delete");
  await exec(`
    CREATE TRIGGER frigora_quotation_line_identities_delete
    BEFORE DELETE ON frigora_quotation_line_identities
    BEGIN
      SELECT RAISE(ABORT, 'quotation line identity cannot be changed');
    END
  `);
  await exec("DROP TRIGGER IF EXISTS frigora_quotation_line_identities_replace");
  await exec(`
    CREATE TRIGGER frigora_quotation_line_identities_replace
    BEFORE INSERT ON frigora_quotation_line_identities
    WHEN EXISTS (
      SELECT 1 FROM frigora_quotation_line_identities other
      WHERE other.line_id = NEW.line_id
        AND other.copy != NEW.copy
        AND (
          other.quotation_id IS NOT NEW.quotation_id
          OR other.version_number IS NOT NEW.version_number
          OR other.workspace_id IS NOT NEW.workspace_id
          OR other.venture_id IS NOT NEW.venture_id
        )
    )
    BEGIN
      SELECT RAISE(ABORT, 'quotation line identity cannot be changed');
    END
  `);
  await exec("DROP TRIGGER IF EXISTS frigora_quotation_line_snapshots_identity_guard");
  await exec(`
    CREATE TRIGGER frigora_quotation_line_snapshots_identity_guard
    BEFORE INSERT ON frigora_quotation_line_snapshots
    BEGIN
      SELECT RAISE(ABORT, 'quotation line identity cannot be changed')
      WHERE EXISTS (
        SELECT 1 FROM frigora_quotation_line_identities
        WHERE line_id = NEW.id
      );
      INSERT INTO frigora_quotation_line_identities (
        line_id, copy, quotation_id, version_number, workspace_id, venture_id
      )
      SELECT NEW.id, 0, NEW.quotation_id, NEW.version_number, NEW.workspace_id, NEW.venture_id
      WHERE NOT EXISTS (
        SELECT 1 FROM frigora_quotation_line_identities
        WHERE line_id = NEW.id AND copy = 0
      );
      INSERT INTO frigora_quotation_line_identities (
        line_id, copy, quotation_id, version_number, workspace_id, venture_id
      )
      SELECT NEW.id, 1, NEW.quotation_id, NEW.version_number, NEW.workspace_id, NEW.venture_id
      WHERE NOT EXISTS (
        SELECT 1 FROM frigora_quotation_line_identities
        WHERE line_id = NEW.id AND copy = 1
      );
    END
  `);
  await exec(`
    CREATE TABLE IF NOT EXISTS frigora_quotation_decision_lines (
      decision_id TEXT NOT NULL,
      line_id TEXT NOT NULL,
      inclusion TEXT NOT NULL CHECK (inclusion IN ('mandatory', 'selected_optional')),
      PRIMARY KEY (decision_id, line_id),
      FOREIGN KEY (decision_id) REFERENCES frigora_quotation_decisions(id),
      FOREIGN KEY (line_id) REFERENCES frigora_quotation_line_snapshots(id)
    )
  `);
  await exec("DROP TRIGGER IF EXISTS frigora_quotation_decision_lines_no_update");
  await exec(`
    CREATE TRIGGER frigora_quotation_decision_lines_no_update
    BEFORE UPDATE ON frigora_quotation_decision_lines
    BEGIN
      SELECT RAISE(ABORT, 'quotation decision lines are immutable');
    END
  `);
  await exec("DROP TRIGGER IF EXISTS frigora_quotation_decision_lines_no_delete");
  await exec(`
    CREATE TRIGGER frigora_quotation_decision_lines_no_delete
    BEFORE DELETE ON frigora_quotation_decision_lines
    BEGIN
      SELECT RAISE(ABORT, 'quotation decision lines are immutable');
    END
  `);
  await exec("DROP TRIGGER IF EXISTS frigora_quotation_decision_lines_insert_guard");
  await exec(`
    CREATE TRIGGER frigora_quotation_decision_lines_insert_guard
    BEFORE INSERT ON frigora_quotation_decision_lines
    WHEN NOT EXISTS (
      SELECT 1
      FROM frigora_quotation_decisions decision
      JOIN frigora_quotation_line_snapshots line
        ON line.id = NEW.line_id
      JOIN frigora_quotation_versions version
        ON version.quotation_id = decision.quotation_id
       AND version.version_number = decision.version_number
       AND version.workspace_id = decision.workspace_id
       AND version.venture_id = decision.venture_id
      WHERE decision.id = NEW.decision_id
        AND decision.decision = 'approved'
        AND version.status = 'awaiting_customer_approval'
        AND line.quotation_id = decision.quotation_id
        AND line.version_number = decision.version_number
        AND line.workspace_id = decision.workspace_id
        AND line.venture_id = decision.venture_id
        AND (
          (NEW.inclusion = 'mandatory' AND line.line_role = 'mandatory')
          OR (NEW.inclusion = 'selected_optional' AND line.line_role = 'optional')
        )
    )
    BEGIN
      SELECT RAISE(ABORT, 'quotation decision line is not part of this offer');
    END
  `);
  await exec("DROP TRIGGER IF EXISTS frigora_quotation_versions_line_approval_complete");
  await exec(`
    CREATE TRIGGER frigora_quotation_versions_line_approval_complete
    BEFORE UPDATE OF status ON frigora_quotation_versions
    WHEN NEW.status = 'approved'
      AND EXISTS (
        SELECT 1 FROM frigora_quotation_line_snapshots
        WHERE quotation_id = NEW.quotation_id
          AND version_number = NEW.version_number
          AND workspace_id = NEW.workspace_id
          AND venture_id = NEW.venture_id
      )
      AND (
        EXISTS (
          SELECT 1 FROM frigora_quotation_line_snapshots line
          WHERE line.quotation_id = NEW.quotation_id
            AND line.version_number = NEW.version_number
            AND line.workspace_id = NEW.workspace_id
            AND line.venture_id = NEW.venture_id
            AND line.line_role = 'mandatory'
            AND NOT EXISTS (
              SELECT 1
              FROM frigora_quotation_decision_lines selected
              JOIN frigora_quotation_decisions decision
                ON decision.id = selected.decision_id
              WHERE selected.line_id = line.id
                AND selected.inclusion = 'mandatory'
                AND decision.quotation_id = NEW.quotation_id
                AND decision.version_number = NEW.version_number
                AND decision.workspace_id = NEW.workspace_id
                AND decision.venture_id = NEW.venture_id
                AND decision.decision = 'approved'
            )
        )
        OR EXISTS (
          SELECT 1
          FROM frigora_quotation_decision_lines selected
          JOIN frigora_quotation_decisions decision
            ON decision.id = selected.decision_id
          JOIN frigora_quotation_line_snapshots line
            ON line.id = selected.line_id
          WHERE decision.quotation_id = NEW.quotation_id
            AND decision.version_number = NEW.version_number
            AND decision.workspace_id = NEW.workspace_id
            AND decision.venture_id = NEW.venture_id
            AND (
              line.quotation_id != decision.quotation_id
              OR line.version_number != decision.version_number
              OR line.workspace_id != decision.workspace_id
              OR line.venture_id != decision.venture_id
              OR (selected.inclusion = 'mandatory' AND line.line_role != 'mandatory')
              OR (selected.inclusion = 'selected_optional' AND line.line_role != 'optional')
            )
        )
      )
    BEGIN
      SELECT RAISE(ABORT, 'approved quotation lines are incomplete');
    END
  `);
  await exec(`
    INSERT INTO frigora_quotation_version_seals (
      quotation_id, version_number, copy, workspace_id, venture_id
    )
    SELECT quotation_id, version_number, 0, workspace_id, venture_id
    FROM frigora_quotation_versions AS source
    WHERE NOT EXISTS (
      SELECT 1 FROM frigora_quotation_version_seals AS existing
      WHERE existing.quotation_id = source.quotation_id
        AND existing.version_number = source.version_number
        AND existing.copy = 0
    )
  `);
  await exec(`
    INSERT INTO frigora_quotation_version_seals (
      quotation_id, version_number, copy, workspace_id, venture_id
    )
    SELECT quotation_id, version_number, 1, workspace_id, venture_id
    FROM frigora_quotation_versions AS source
    WHERE NOT EXISTS (
      SELECT 1 FROM frigora_quotation_version_seals AS existing
      WHERE existing.quotation_id = source.quotation_id
        AND existing.version_number = source.version_number
        AND existing.copy = 1
    )
  `);
  await exec(`
    INSERT INTO frigora_quotation_line_identities (
      line_id, copy, quotation_id, version_number, workspace_id, venture_id
    )
    SELECT id, 0, quotation_id, version_number, workspace_id, venture_id
    FROM frigora_quotation_line_snapshots AS source
    WHERE NOT EXISTS (
      SELECT 1 FROM frigora_quotation_line_identities AS existing
      WHERE existing.line_id = source.id AND existing.copy = 0
    )
  `);
  await exec(`
    INSERT INTO frigora_quotation_line_identities (
      line_id, copy, quotation_id, version_number, workspace_id, venture_id
    )
    SELECT id, 1, quotation_id, version_number, workspace_id, venture_id
    FROM frigora_quotation_line_snapshots AS source
    WHERE NOT EXISTS (
      SELECT 1 FROM frigora_quotation_line_identities AS existing
      WHERE existing.line_id = source.id AND existing.copy = 1
    )
  `);
}
