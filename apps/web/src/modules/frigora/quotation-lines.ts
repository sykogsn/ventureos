import type { Transaction } from "@libsql/client";
import type { PermissionService } from "@/contracts";
import { createId } from "@/platform/ids";
import { ensureFrigoraCommercialLinesSchema, getClient } from "@/platform/persistence/db";
import { getPersistence } from "@/platform/persistence/repositories";
import { createCommercialCatalogue } from "./commercial-catalogue";
import { FrigoraError } from "./errors";
import type { FrigoraQuoteTaxTreatment, QuotationOfferLine } from "./quotation-commercial";
import { FRIGORA_QUOTE_TAX_TREATMENTS } from "./quotation-commercial";
import type { FrigoraPartUsageUnit, FrigoraScope } from "./types";
import { FRIGORA_PART_USAGE_UNITS } from "./types";

const LINE_TABLE = "frigora_quotation_line_snapshots";

const LINE_COLUMNS = `
  id, quotation_id, version_number, workspace_id, venture_id, line_number,
  source_type, catalogue_item_id, sku, description, unit, quantity_milli,
  unit_price_minor, currency, tax_treatment, line_role, discount_eligible,
  created_at, created_by_user_id
`;

export type QuotationLineRole = "mandatory" | "optional";

type LineIdentity = {
  lineNumber: number;
  lineRole: QuotationLineRole;
  quantityMilli: number;
  discountEligible?: number;
};

export type QuotationLineDraft =
  | (LineIdentity & {
      source: "catalogue";
      catalogueItemId: string;
    })
  | (LineIdentity & {
      source: "custom";
      description: string;
      unit: FrigoraPartUsageUnit;
      unitPriceMinor: number;
      taxTreatment: FrigoraQuoteTaxTreatment;
    });

export type QuotationLineInsert = {
  id: string;
  quotationId: string;
  versionNumber: number;
  workspaceId: string;
  ventureId: string;
  lineNumber: number;
  sourceType: "catalogue" | "custom";
  catalogueItemId: string | null;
  sku: string | null;
  description: string;
  unit: FrigoraPartUsageUnit;
  quantityMilli: number;
  unitPriceMinor: number;
  currency: "ZAR";
  taxTreatment: FrigoraQuoteTaxTreatment;
  lineRole: QuotationLineRole;
  discountEligible: 0;
  createdAt: string;
  createdByUserId: string;
};

export type QuotationLineSnapshot = QuotationLineInsert;

type LineRow = {
  id: string;
  quotation_id: string;
  version_number: number;
  workspace_id: string;
  venture_id: string;
  line_number: number;
  source_type: string;
  catalogue_item_id: string | null;
  sku: string | null;
  description: string;
  unit: string;
  quantity_milli: number;
  unit_price_minor: number;
  currency: string;
  tax_treatment: string;
  line_role: string;
  discount_eligible: number;
  created_at: string;
  created_by_user_id: string;
};

function integerAtLeast(value: number, minimum: number, label: string) {
  if (!Number.isSafeInteger(value) || value < minimum) {
    throw new FrigoraError("invalid_input", `${label} is not valid.`);
  }
}

function discountFlag(value: number | undefined): 0 {
  if (value !== undefined && value !== 0) {
    throw new FrigoraError(
      "invalid_input",
      "Discount eligibility cannot be set in this release.",
    );
  }
  return 0;
}

function assertDraftShape(draft: QuotationLineDraft) {
  integerAtLeast(draft.lineNumber, 1, "Line number");
  integerAtLeast(draft.quantityMilli, 0, "Quantity");
  if (draft.lineRole !== "mandatory" && draft.lineRole !== "optional") {
    throw new FrigoraError("invalid_input", "Line role is not valid.");
  }
  discountFlag(draft.discountEligible);
}

export async function commercialLinesTableExists(): Promise<boolean> {
  const found = await getClient().execute({
    sql: "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?",
    args: [LINE_TABLE],
  });
  return found.rows.length > 0;
}

export async function countQuotationLines(
  scope: Pick<FrigoraScope, "workspaceId" | "ventureId">,
  quotationId: string,
  versionNumber: number,
): Promise<number> {
  if (!(await commercialLinesTableExists())) {
    return 0;
  }
  const found = await getClient().execute({
    sql: `
      SELECT COUNT(*) AS n
      FROM frigora_quotation_line_snapshots
      WHERE quotation_id = ? AND version_number = ? AND workspace_id = ? AND venture_id = ?
    `,
    args: [quotationId, versionNumber, scope.workspaceId, scope.ventureId],
  });
  return Number(found.rows[0]?.n ?? 0);
}

export const COMMERCIAL_LINE_ISSUE_BLOCKED =
  "This line-bearing quotation cannot be issued.";

const LINE_ISSUE_REJECTION =
  /line-bearing quotation cannot be issued|discount-eligible quotation lines cannot be issued|configured-rule lines require a configured tax snapshot|line-bearing quotation versions require a commercial snapshot/i;

function lineIssueIsBlocked(row: {
  discount_eligible: number;
  tax_treatment: string;
  version_tax_treatment: string | null;
}): boolean {
  if (Number(row.discount_eligible) !== 0) return true;
  if (row.version_tax_treatment == null || row.version_tax_treatment === "") return true;
  return row.tax_treatment === "configured_rule" && row.version_tax_treatment !== "configured_rule";
}

/** Rejects an inconsistent line-bearing version. A consistent one may be issued. */
export async function assertQuotationIssueHasNoLines(
  scope: Pick<FrigoraScope, "workspaceId" | "ventureId">,
  quotationId: string,
  versionNumber: number,
): Promise<void> {
  if (!(await commercialLinesTableExists())) return;
  const found = await getClient().execute({
    sql: `
      SELECT line.discount_eligible AS discount_eligible,
             line.tax_treatment AS tax_treatment,
             version.tax_treatment AS version_tax_treatment
      FROM frigora_quotation_line_snapshots line
      JOIN frigora_quotation_versions version
        ON version.quotation_id = line.quotation_id
       AND version.version_number = line.version_number
       AND version.workspace_id = line.workspace_id
       AND version.venture_id = line.venture_id
      WHERE line.quotation_id = ?
        AND line.version_number = ?
        AND line.workspace_id = ?
        AND line.venture_id = ?
    `,
    args: [quotationId, versionNumber, scope.workspaceId, scope.ventureId],
  });
  if (found.rows.some((row) => lineIssueIsBlocked(row as unknown as {
    discount_eligible: number;
    tax_treatment: string;
    version_tax_treatment: string | null;
  }))) {
    throw new FrigoraError("invalid_status", COMMERCIAL_LINE_ISSUE_BLOCKED);
  }
}

/**
 * Authoritative send check. Caller must already hold the write transaction
 * that will change the version to awaiting_customer_approval. This does not
 * initialise the line schema: a missing table means this version has no lines.
 * A consistent line-bearing version is allowed. An inconsistent one is not.
 */
export async function assertSendableVersionHasNoLines(
  transaction: Transaction,
  scope: Pick<FrigoraScope, "workspaceId" | "ventureId">,
  quotationId: string,
  versionNumber: number,
): Promise<void> {
  const table = await transaction.execute({
    sql: "SELECT 1 AS present FROM sqlite_master WHERE type = 'table' AND name = ? LIMIT 1",
    args: [LINE_TABLE],
  });
  if (table.rows.length === 0) {
    return;
  }
  const found = await transaction.execute({
    sql: `
      SELECT line.discount_eligible AS discount_eligible,
             line.tax_treatment AS tax_treatment,
             version.tax_treatment AS version_tax_treatment
      FROM frigora_quotation_line_snapshots line
      JOIN frigora_quotation_versions version
        ON version.quotation_id = line.quotation_id
       AND version.version_number = line.version_number
       AND version.workspace_id = line.workspace_id
       AND version.venture_id = line.venture_id
      WHERE line.quotation_id = ?
        AND line.version_number = ?
        AND line.workspace_id = ?
        AND line.venture_id = ?
    `,
    args: [quotationId, versionNumber, scope.workspaceId, scope.ventureId],
  });
  if (found.rows.some((row) => lineIssueIsBlocked(row as unknown as {
    discount_eligible: number;
    tax_treatment: string;
    version_tax_treatment: string | null;
  }))) {
    throw new FrigoraError("invalid_status", COMMERCIAL_LINE_ISSUE_BLOCKED);
  }
}

async function assertCanWriteLines(permissions: PermissionService, scope: FrigoraScope) {
  const allowed = await permissions.can({
    userId: scope.userId,
    permission: "venture.update",
    resource: { type: "workspace", id: scope.workspaceId },
  });
  if (!allowed) {
    throw new FrigoraError("forbidden", "Not allowed.");
  }
  const venture = await getPersistence().ventures.findById(scope.ventureId);
    if (!venture || venture.workspaceId !== scope.workspaceId) {
    throw new FrigoraError("not_found", "Venture was not found.");
  }
  if (venture.definitionId !== "frigora") {
    throw new FrigoraError(
      "not_frigora",
      "Frigora operational records can only belong to a Frigora venture.",
    );
  }
}

export async function prepareQuotationLineSnapshots(input: {
  permissions: PermissionService;
  scope: FrigoraScope;
  quotationId: string;
  versionNumber: number;
  drafts: QuotationLineDraft[];
  actorUserId: string;
  createdAt: string;
}): Promise<QuotationLineInsert[]> {
  await assertCanWriteLines(input.permissions, input.scope);
  const seen = new Set<number>();
  const catalogue = createCommercialCatalogue({ permissions: input.permissions });
  const rows: QuotationLineInsert[] = [];
  for (const draft of input.drafts) {
    assertDraftShape(draft);
    if (seen.has(draft.lineNumber)) {
      throw new FrigoraError("duplicate", "A line number is already used on this quotation version.");
    }
    seen.add(draft.lineNumber);
    if (draft.source === "catalogue") {
      const item = await catalogue.selectItem(input.scope, draft.catalogueItemId);
      rows.push({
        id: createId<string>(),
        quotationId: input.quotationId,
        versionNumber: input.versionNumber,
        workspaceId: input.scope.workspaceId,
        ventureId: input.scope.ventureId,
        lineNumber: draft.lineNumber,
        sourceType: "catalogue",
        catalogueItemId: item.id,
        sku: item.sku,
        description: item.description,
        unit: item.unit,
        quantityMilli: draft.quantityMilli,
        unitPriceMinor: item.sellingPriceMinor,
        currency: "ZAR",
        taxTreatment: item.taxTreatment,
        lineRole: draft.lineRole,
        discountEligible: 0,
        createdAt: input.createdAt,
        createdByUserId: input.actorUserId,
      });
      continue;
    }
    const description = draft.description.trim();
    if (description.length < 1 || description.length > 400) {
      throw new FrigoraError("invalid_input", "Enter a line description.");
    }
    if (!FRIGORA_PART_USAGE_UNITS.includes(draft.unit)) {
      throw new FrigoraError("invalid_input", "Choose a unit of measure.");
    }
    integerAtLeast(draft.unitPriceMinor, 0, "Selling price");
    if (!FRIGORA_QUOTE_TAX_TREATMENTS.includes(draft.taxTreatment)) {
      throw new FrigoraError("invalid_input", "Choose a tax treatment.");
    }
    rows.push({
      id: createId<string>(),
      quotationId: input.quotationId,
      versionNumber: input.versionNumber,
      workspaceId: input.scope.workspaceId,
      ventureId: input.scope.ventureId,
      lineNumber: draft.lineNumber,
      sourceType: "custom",
      catalogueItemId: null,
      sku: null,
      description,
      unit: draft.unit,
      quantityMilli: draft.quantityMilli,
      unitPriceMinor: draft.unitPriceMinor,
      currency: "ZAR",
      taxTreatment: draft.taxTreatment,
      lineRole: draft.lineRole,
      discountEligible: 0,
      createdAt: input.createdAt,
      createdByUserId: input.actorUserId,
    });
  }
  return rows;
}

function asDuplicateLine(error: unknown): never {
  const message = error instanceof Error ? error.message : String(error);
  if (/UNIQUE constraint failed/i.test(message)) {
    throw new FrigoraError("duplicate", "A line number is already used on this quotation version.");
  }
  if (/issued quotation lines cannot be changed|quotation lines can only be added to a draft|quotation lines can only be added to the current draft|historical quotation lines cannot be changed|quotation lines cannot be moved onto another version/i.test(message)) {
    throw new FrigoraError("invalid_status", "Issued quotation lines cannot be changed.");
  }
  if (LINE_ISSUE_REJECTION.test(message)) {
    throw new FrigoraError("invalid_status", COMMERCIAL_LINE_ISSUE_BLOCKED);
  }
  throw error;
}

function insertArgs(row: QuotationLineInsert): Array<string | number | null> {
  return [
    row.id,
    row.quotationId,
    row.versionNumber,
    row.workspaceId,
    row.ventureId,
    row.lineNumber,
    row.sourceType,
    row.catalogueItemId,
    row.sku,
    row.description,
    row.unit,
    row.quantityMilli,
    row.unitPriceMinor,
    row.taxTreatment,
    row.lineRole,
    row.discountEligible,
    row.createdAt,
    row.createdByUserId,
  ];
}

export async function insertQuotationLineSnapshots(
  transaction: Transaction,
  rows: readonly QuotationLineInsert[],
): Promise<void> {
  for (const row of rows) {
    if (row.discountEligible !== 0) {
      throw new FrigoraError("invalid_input", "Discount eligibility cannot be set in this release.");
    }
    try {
      const inserted = await transaction.execute({
        sql: `
          INSERT INTO frigora_quotation_line_snapshots (
            id, quotation_id, version_number, workspace_id, venture_id, line_number,
            source_type, catalogue_item_id, sku, description, unit, quantity_milli,
            unit_price_minor, currency, tax_treatment, line_role, discount_eligible,
            created_at, created_by_user_id
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ZAR', ?, ?, ?, ?, ?)
        `,
        args: insertArgs(row),
      });
      if (Number(inserted.rowsAffected) !== 1) {
        throw new FrigoraError("invalid_input", "Quotation line was not stored.");
      }
    } catch (error) {
      if (error instanceof FrigoraError) {
        throw error;
      }
      asDuplicateLine(error);
    }
  }
}

export async function replaceDraftQuotationLines(
  transaction: Transaction,
  scope: Pick<FrigoraScope, "workspaceId" | "ventureId">,
  quotationId: string,
  versionNumber: number,
  rows: readonly QuotationLineInsert[],
): Promise<void> {
  const version = await transaction.execute({
    sql: `
      SELECT status FROM frigora_quotation_versions
      WHERE quotation_id = ? AND version_number = ? AND workspace_id = ? AND venture_id = ?
    `,
    args: [quotationId, versionNumber, scope.workspaceId, scope.ventureId],
  });
  if (String(version.rows[0]?.status ?? "") !== "in_preparation") {
    throw new FrigoraError("invalid_status", "Only a draft in preparation can be corrected.");
  }
  try {
    await transaction.execute({
      sql: `
        DELETE FROM frigora_quotation_line_snapshots
        WHERE quotation_id = ? AND version_number = ? AND workspace_id = ? AND venture_id = ?
      `,
      args: [quotationId, versionNumber, scope.workspaceId, scope.ventureId],
    });
  } catch (error) {
    asDuplicateLine(error);
  }
  await insertQuotationLineSnapshots(transaction, rows);
}

export async function copyQuotationLinesToRevision(
  transaction: Transaction,
  scope: Pick<FrigoraScope, "workspaceId" | "ventureId">,
  quotationId: string,
  fromVersion: number,
  toVersion: number,
  actorUserId: string,
  createdAt: string,
): Promise<void> {
  const table = await transaction.execute({
    sql: "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?",
    args: [LINE_TABLE],
  });
  if (table.rows.length === 0) {
    return;
  }
  const existing = await transaction.execute({
    sql: `
      SELECT ${LINE_COLUMNS}
      FROM frigora_quotation_line_snapshots
      WHERE quotation_id = ? AND version_number = ? AND workspace_id = ? AND venture_id = ?
      ORDER BY line_number, id
    `,
    args: [quotationId, fromVersion, scope.workspaceId, scope.ventureId],
  });
  const copies = existing.rows.map((row) => {
    const line = toSnapshot(row as unknown as LineRow);
    return {
      ...line,
      id: createId<string>(),
      versionNumber: toVersion,
      createdAt,
      createdByUserId: actorUserId,
    };
  });
  await insertQuotationLineSnapshots(transaction, copies);
}

function toSnapshot(row: LineRow): QuotationLineSnapshot {
  return {
    id: String(row.id),
    quotationId: String(row.quotation_id),
    versionNumber: Number(row.version_number),
    workspaceId: String(row.workspace_id),
    ventureId: String(row.venture_id),
    lineNumber: Number(row.line_number),
    sourceType: String(row.source_type) === "custom" ? "custom" : "catalogue",
    catalogueItemId: row.catalogue_item_id == null ? null : String(row.catalogue_item_id),
    sku: row.sku == null ? null : String(row.sku),
    description: String(row.description),
    unit: String(row.unit) as FrigoraPartUsageUnit,
    quantityMilli: Number(row.quantity_milli),
    unitPriceMinor: Number(row.unit_price_minor),
    currency: "ZAR",
    taxTreatment: String(row.tax_treatment) as FrigoraQuoteTaxTreatment,
    lineRole: String(row.line_role) === "optional" ? "optional" : "mandatory",
    discountEligible: 0,
    createdAt: String(row.created_at),
    createdByUserId: String(row.created_by_user_id),
  };
}

export async function readQuotationLineSnapshots(
  scope: Pick<FrigoraScope, "workspaceId" | "ventureId">,
  quotationId: string,
  versionNumber: number,
): Promise<QuotationLineSnapshot[]> {
  if (!(await commercialLinesTableExists())) return [];
  const found = await getClient().execute({
    sql: `
      SELECT ${LINE_COLUMNS}
      FROM frigora_quotation_line_snapshots
      WHERE quotation_id = ? AND version_number = ? AND workspace_id = ? AND venture_id = ?
      ORDER BY line_number, id
    `,
    args: [quotationId, versionNumber, scope.workspaceId, scope.ventureId],
  });
  return found.rows.map((row) => toSnapshot(row as unknown as LineRow));
}

export async function listQuotationLineSnapshots(
  scope: Pick<FrigoraScope, "workspaceId" | "ventureId">,
  quotationId: string,
  versionNumber: number,
): Promise<QuotationLineSnapshot[]> {
  await ensureFrigoraCommercialLinesSchema();
  const found = await getClient().execute({
    sql: `
      SELECT ${LINE_COLUMNS}
      FROM frigora_quotation_line_snapshots
      WHERE quotation_id = ? AND version_number = ? AND workspace_id = ? AND venture_id = ?
      ORDER BY line_number, id
    `,
    args: [quotationId, versionNumber, scope.workspaceId, scope.ventureId],
  });
  return found.rows.map((row) => toSnapshot(row as unknown as LineRow));
}

export function offerLineFromSnapshot(line: QuotationLineSnapshot): QuotationOfferLine {
  return {
    id: line.id,
    lineNumber: line.lineNumber,
    catalogueItemId: line.catalogueItemId,
    sku: line.sku,
    description: line.description,
    unit: line.unit,
    quantityMilli: line.quantityMilli,
    unitPriceMinor: line.unitPriceMinor,
    currency: "ZAR",
    taxTreatment: line.taxTreatment,
    lineRole: line.lineRole,
  };
}
