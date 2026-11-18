import type { VentureId, WorkspaceId } from "@/contracts";
import { ensureSchema, getClient } from "@/platform/persistence/db";
import { withFrigoraWriteTransaction, type FrigoraWriteClientFactory } from "./owned-write";
import {
  SARS_ZA_VAT_STANDARD_RULE,
  type TaxConfigurationEventRecord,
  type TaxConfigurationRecord,
  type TaxConfigurationStatus,
  type TaxRegistrationState,
  type TaxRuleRecord,
  type TaxRuleStatus,
} from "./tax-configuration";

export type TaxConfigurationWrite = {
  id: string;
  workspaceId: WorkspaceId;
  ventureId: VentureId;
  version: number;
  jurisdiction: string;
  registrationState: TaxRegistrationState;
  registrationNumber: string | null;
  liabilityDate: string | null;
  taxRuleId: string | null;
  evidenceReference: string | null;
  status: TaxConfigurationStatus;
  createdByUserId: string;
  createdAt: string;
  verifiedByUserId: string | null;
  verifiedAt: string | null;
  eventId: string;
  eventKind: string;
  eventSummary: string;
};

function textOrNull(value: unknown): string | null {
  if (value == null || value === "") return null;
  return String(value);
}

function mapRule(row: Record<string, unknown>): TaxRuleRecord {
  return {
    id: String(row.id),
    jurisdiction: String(row.jurisdiction),
    treatment: String(row.treatment),
    rateNumerator: Number(row.rate_numerator),
    rateDenominator: Number(row.rate_denominator),
    effectiveFrom: String(row.effective_from),
    effectiveUntil: textOrNull(row.effective_until),
    sourceTitle: String(row.source_title),
    sourceUrl: String(row.source_url),
    sourceStatementDate: String(row.source_statement_date),
    sourceNote: String(row.source_note),
    status: String(row.status) as TaxRuleStatus,
    approvedByUserId: textOrNull(row.approved_by_user_id),
    approvedAt: textOrNull(row.approved_at),
  };
}

function mapConfiguration(row: Record<string, unknown>): TaxConfigurationRecord {
  return {
    id: String(row.id),
    workspaceId: String(row.workspace_id),
    ventureId: String(row.venture_id),
    version: Number(row.version_number),
    jurisdiction: String(row.jurisdiction),
    registrationState: String(row.registration_state) as TaxRegistrationState,
    registrationNumber: textOrNull(row.registration_number),
    liabilityDate: textOrNull(row.liability_date),
    taxRuleId: textOrNull(row.tax_rule_id),
    evidenceReference: textOrNull(row.evidence_reference),
    status: String(row.status) as TaxConfigurationStatus,
    createdByUserId: String(row.created_by_user_id),
    createdAt: String(row.created_at),
    verifiedByUserId: textOrNull(row.verified_by_user_id),
    verifiedAt: textOrNull(row.verified_at),
  };
}

function mapEvent(row: Record<string, unknown>): TaxConfigurationEventRecord {
  return {
    id: String(row.id),
    configurationId: String(row.configuration_id),
    workspaceId: String(row.workspace_id),
    ventureId: String(row.venture_id),
    version: Number(row.version_number),
    kind: String(row.kind),
    occurredAt: String(row.occurred_at),
    actorUserId: String(row.actor_user_id),
    summary: String(row.summary),
  };
}

export function createTaxConfigurationPersistence(createWriteClient?: FrigoraWriteClientFactory) {
  return {
    async ensureReferenceTaxRule() {
      await ensureSchema();
      const rule = SARS_ZA_VAT_STANDARD_RULE;
      await getClient().execute({
        sql: `
          INSERT INTO frigora_tax_rules (
            id, jurisdiction, treatment, rate_numerator, rate_denominator,
            effective_from, effective_until, source_title, source_url,
            source_statement_date, source_note, status, approved_by_user_id, approved_at, created_at
          )
          SELECT ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, 'reference', NULL, NULL, ?
          WHERE NOT EXISTS (SELECT 1 FROM frigora_tax_rules WHERE id = ?)
        `,
        args: [
          rule.id,
          rule.jurisdiction,
          rule.treatment,
          rule.rateNumerator,
          rule.rateDenominator,
          rule.effectiveFrom,
          rule.sourceTitle,
          rule.sourceUrl,
          rule.sourceStatementDate,
          rule.sourceNote,
          rule.sourceStatementDate,
          rule.id,
        ],
      });
    },
    async listTaxRules(): Promise<TaxRuleRecord[]> {
      await this.ensureReferenceTaxRule();
      const result = await getClient().execute(
        "SELECT * FROM frigora_tax_rules ORDER BY effective_from, id",
      );
      return result.rows.map((row) => mapRule(row as Record<string, unknown>));
    },
    async listTaxConfigurations(workspaceId: WorkspaceId, ventureId: VentureId) {
      await ensureSchema();
      const result = await getClient().execute({
        sql: `
          SELECT * FROM frigora_tax_configurations
          WHERE workspace_id = ? AND venture_id = ?
          ORDER BY version_number, id
        `,
        args: [workspaceId, ventureId],
      });
      return result.rows.map((row) => mapConfiguration(row as Record<string, unknown>));
    },
    async listTaxConfigurationEvents(workspaceId: WorkspaceId, ventureId: VentureId) {
      await ensureSchema();
      const result = await getClient().execute({
        sql: `
          SELECT * FROM frigora_tax_configuration_events
          WHERE workspace_id = ? AND venture_id = ?
          ORDER BY occurred_at, id
        `,
        args: [workspaceId, ventureId],
      });
      return result.rows.map((row) => mapEvent(row as Record<string, unknown>));
    },
    async insertTaxConfiguration(input: TaxConfigurationWrite) {
      await this.ensureReferenceTaxRule();
      await withFrigoraWriteTransaction(async (transaction) => {
        await transaction.execute({
          sql: `
            INSERT INTO frigora_tax_configurations (
              id, workspace_id, venture_id, version_number, jurisdiction, registration_state,
              registration_number, liability_date, tax_rule_id, evidence_reference, status,
              created_by_user_id, created_at, verified_by_user_id, verified_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `,
          args: [
            input.id,
            input.workspaceId,
            input.ventureId,
            input.version,
            input.jurisdiction,
            input.registrationState,
            input.registrationNumber,
            input.liabilityDate,
            input.taxRuleId,
            input.evidenceReference,
            input.status,
            input.createdByUserId,
            input.createdAt,
            input.verifiedByUserId,
            input.verifiedAt,
          ],
        });
        await transaction.execute({
          sql: `
            INSERT INTO frigora_tax_configuration_events (
              id, configuration_id, workspace_id, venture_id, version_number,
              kind, occurred_at, actor_user_id, summary
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `,
          args: [
            input.eventId,
            input.id,
            input.workspaceId,
            input.ventureId,
            input.version,
            input.eventKind,
            input.createdAt,
            input.createdByUserId,
            input.eventSummary,
          ],
        });
      }, createWriteClient);
    },
    async setTaxRuleStatus(input: {
      id: string;
      from: TaxRuleStatus;
      to: TaxRuleStatus;
      actorUserId: string;
      at: string;
    }) {
      await this.ensureReferenceTaxRule();
      const updated = await getClient().execute({
        sql: `
          UPDATE frigora_tax_rules
          SET status = ?,
              approved_by_user_id = CASE WHEN ? = 'approved' THEN ? ELSE approved_by_user_id END,
              approved_at = CASE WHEN ? = 'approved' THEN ? ELSE approved_at END
          WHERE id = ? AND status = ?
        `,
        args: [input.to, input.to, input.actorUserId, input.to, input.at, input.id, input.from],
      });
      return updated.rowsAffected === 1;
    },
    async revokeTaxConfiguration(input: {
      id: string;
      workspaceId: WorkspaceId;
      ventureId: VentureId;
      eventId: string;
      actorUserId: string;
      at: string;
    }) {
      await ensureSchema();
      await withFrigoraWriteTransaction(async (transaction) => {
        const updated = await transaction.execute({
          sql: `
            UPDATE frigora_tax_configurations
            SET status = 'revoked'
            WHERE id = ? AND workspace_id = ? AND venture_id = ? AND status = 'verified'
          `,
          args: [input.id, input.workspaceId, input.ventureId],
        });
        if (updated.rowsAffected !== 1) {
          throw new Error("verified tax configuration was not revoked");
        }
        const current = await transaction.execute({
          sql: "SELECT version_number FROM frigora_tax_configurations WHERE id = ?",
          args: [input.id],
        });
        await transaction.execute({
          sql: `
            INSERT INTO frigora_tax_configuration_events (
              id, configuration_id, workspace_id, venture_id, version_number,
              kind, occurred_at, actor_user_id, summary
            ) VALUES (?, ?, ?, ?, ?, 'revoked', ?, ?, ?)
          `,
          args: [
            input.eventId,
            input.id,
            input.workspaceId,
            input.ventureId,
            Number(current.rows[0]?.version_number ?? 0),
            input.at,
            input.actorUserId,
            "Verified tax configuration revoked. Historical sent quotations were not rewritten.",
          ],
        });
      }, createWriteClient);
    },
  };
}
