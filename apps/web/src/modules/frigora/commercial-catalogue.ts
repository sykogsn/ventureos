import type { Permission, PermissionService, UserId, VentureId, WorkspaceId } from "@/contracts";
import { createId, nowIso } from "@/platform/ids";
import { ensureFrigoraCommercialCatalogueSchema, getClient } from "@/platform/persistence/db";
import { getPersistence } from "@/platform/persistence/repositories";
import { z } from "zod";
import { FrigoraError } from "./errors";
import { withFrigoraWriteTransaction } from "./owned-write";
import type { FrigoraPartUsageUnit, FrigoraScope } from "./types";
import { FRIGORA_PART_USAGE_UNITS } from "./types";
import { FRIGORA_QUOTE_TAX_TREATMENTS, type FrigoraQuoteTaxTreatment } from "./quotation-commercial";
import { zarCentsSchema } from "./validation";

const boundedText = (max: number) => z.string().trim().max(max);

const createItemSchema = z
  .object({
    sku: z.string().trim().min(1).max(64),
    description: z.string().trim().min(1).max(400),
    category: boundedText(120),
    manufacturer: boundedText(120),
    model: boundedText(120),
    unit: z.enum(FRIGORA_PART_USAGE_UNITS),
    sellingPriceMinor: zarCentsSchema,
    taxTreatment: z.enum(FRIGORA_QUOTE_TAX_TREATMENTS),
    supplierReference: boundedText(200),
  })
  .strict();

const updateItemSchema = z
  .object({
    sku: z.string().trim().min(1).max(64).optional(),
    description: z.string().trim().min(1).max(400).optional(),
    category: boundedText(120).optional(),
    manufacturer: boundedText(120).optional(),
    model: boundedText(120).optional(),
    unit: z.enum(FRIGORA_PART_USAGE_UNITS).optional(),
    sellingPriceMinor: zarCentsSchema.optional(),
    taxTreatment: z.enum(FRIGORA_QUOTE_TAX_TREATMENTS).optional(),
    supplierReference: boundedText(200).optional(),
    status: z.enum(["active", "discontinued"]).optional(),
  })
  .strict();

const blankToUndefined = (value: string | undefined) =>
  value && value.trim().length > 0 ? value.trim() : undefined;

const listSchema = z
  .object({
    sku: z.string().trim().max(64).optional(),
    description: z.string().trim().max(400).optional(),
    manufacturer: z.string().trim().max(120).optional(),
    model: z.string().trim().max(120).optional(),
    category: z.string().trim().max(120).optional(),
    status: z.enum(["active", "discontinued"]).optional(),
  })
  .strict()
  .transform((value) => ({
    sku: blankToUndefined(value.sku),
    description: blankToUndefined(value.description),
    manufacturer: blankToUndefined(value.manufacturer),
    model: blankToUndefined(value.model),
    category: blankToUndefined(value.category),
    status: value.status,
  }));

const searchSchema = z
  .object({
    sku: z.string().trim().min(1).max(64).optional(),
    description: z.string().trim().min(1).max(400).optional(),
    manufacturer: z.string().trim().min(1).max(120).optional(),
    model: z.string().trim().min(1).max(120).optional(),
  })
  .strict()
  .refine((value) => Boolean(value.sku || value.description || value.manufacturer || value.model), {
    message: "Search needs a SKU, description, manufacturer, or model.",
  });

const costSchema = z.object({ purchaseCostMinor: zarCentsSchema }).strict();

export type FrigoraCommercialItemStatus = "active" | "discontinued";

/** Selling-side catalogue item. Purchase cost is never part of this object. */
export type FrigoraCommercialItem = {
  id: string;
  workspaceId: WorkspaceId;
  ventureId: VentureId;
  sku: string;
  description: string;
  category: string;
  manufacturer: string;
  model: string;
  unit: FrigoraPartUsageUnit;
  sellingPriceMinor: number;
  currency: "ZAR";
  taxTreatment: FrigoraQuoteTaxTreatment;
  supplierReference: string;
  status: FrigoraCommercialItemStatus;
  createdAt: string;
  createdByUserId: UserId;
  updatedAt: string;
  updatedByUserId: UserId;
};

export type FrigoraCommercialItemCost = {
  purchaseCostMinor: number;
  currency: "ZAR";
  updatedAt: string;
  updatedByUserId: UserId;
};

const ITEM_COLUMNS = `
  id, workspace_id, venture_id, sku, description, category, manufacturer, model,
  unit, selling_price_minor, currency, tax_treatment, supplier_reference, status,
  created_at, created_by_user_id, updated_at, updated_by_user_id
`;

type ItemRow = {
  id: string;
  workspace_id: string;
  venture_id: string;
  sku: string;
  description: string;
  category: string;
  manufacturer: string;
  model: string;
  unit: string;
  selling_price_minor: number;
  currency: string;
  tax_treatment: string;
  supplier_reference: string;
  status: string;
  created_at: string;
  created_by_user_id: string;
  updated_at: string;
  updated_by_user_id: string;
};

function parseCatalogue<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new FrigoraError("invalid_input", result.error.issues[0]?.message ?? "Invalid input.");
  }
  return result.data;
}

function normaliseSku(sku: string) {
  return sku.trim().toUpperCase();
}

function toItem(row: ItemRow): FrigoraCommercialItem {
  return {
    id: String(row.id),
    workspaceId: String(row.workspace_id) as WorkspaceId,
    ventureId: String(row.venture_id) as VentureId,
    sku: String(row.sku),
    description: String(row.description),
    category: String(row.category),
    manufacturer: String(row.manufacturer),
    model: String(row.model),
    unit: String(row.unit) as FrigoraPartUsageUnit,
    sellingPriceMinor: Number(row.selling_price_minor),
    currency: "ZAR",
    taxTreatment: String(row.tax_treatment) as FrigoraQuoteTaxTreatment,
    supplierReference: String(row.supplier_reference),
    status: String(row.status) as FrigoraCommercialItemStatus,
    createdAt: String(row.created_at),
    createdByUserId: String(row.created_by_user_id) as UserId,
    updatedAt: String(row.updated_at),
    updatedByUserId: String(row.updated_by_user_id) as UserId,
  };
}

function asDuplicateSku(error: unknown): never {
  const message = error instanceof Error ? error.message : String(error);
  if (/UNIQUE constraint failed/i.test(message)) {
    throw new FrigoraError(
      "duplicate",
      "A commercial item with this SKU already exists in the venture.",
    );
  }
  throw error;
}

export function createCommercialCatalogue(options: { permissions: PermissionService }) {
  async function assertPermission(scope: FrigoraScope, permission: Permission) {
    const allowed = await options.permissions.can({
      userId: scope.userId,
      permission,
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

  async function readItem(scope: FrigoraScope, id: string): Promise<FrigoraCommercialItem | null> {
    const found = await getClient().execute({
      sql: `SELECT ${ITEM_COLUMNS} FROM frigora_commercial_items WHERE id = ? AND workspace_id = ? AND venture_id = ?`,
      args: [id, scope.workspaceId, scope.ventureId],
    });
    const row = found.rows[0] as unknown as ItemRow | undefined;
    return row ? toItem(row) : null;
  }

  return {
    async createItem(scope: FrigoraScope, input: unknown): Promise<FrigoraCommercialItem> {
      await assertPermission(scope, "venture.update");
      const parsed = parseCatalogue(createItemSchema, input);
      await ensureFrigoraCommercialCatalogueSchema();
      const now = nowIso();
      const id = createId<string>();
      try {
        await withFrigoraWriteTransaction(async (transaction) => {
          await transaction.execute({
            sql: `
              INSERT INTO frigora_commercial_items (
                id, workspace_id, venture_id, sku, sku_normalised, description, category,
                manufacturer, model, unit, selling_price_minor, currency, tax_treatment,
                supplier_reference, status, created_at, created_by_user_id, updated_at, updated_by_user_id
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ZAR', ?, ?, 'active', ?, ?, ?, ?)
            `,
            args: [
              id,
              scope.workspaceId,
              scope.ventureId,
              parsed.sku,
              normaliseSku(parsed.sku),
              parsed.description,
              parsed.category,
              parsed.manufacturer,
              parsed.model,
              parsed.unit,
              parsed.sellingPriceMinor,
              parsed.taxTreatment,
              parsed.supplierReference,
              now,
              scope.userId,
              now,
              scope.userId,
            ],
          });
        });
      } catch (error) {
        asDuplicateSku(error);
      }
      const created = await readItem(scope, id);
      if (!created) {
        throw new FrigoraError("invalid_input", "Commercial item was not created.");
      }
      return created;
    },

    async updateItem(scope: FrigoraScope, id: string, input: unknown): Promise<FrigoraCommercialItem> {
      await assertPermission(scope, "venture.update");
      const parsed = parseCatalogue(updateItemSchema, input);
      const assignments: string[] = [];
      const args: Array<string | number> = [];
      if (parsed.sku !== undefined) {
        assignments.push("sku = ?", "sku_normalised = ?");
        args.push(parsed.sku, normaliseSku(parsed.sku));
      }
      const fields: Array<[keyof typeof parsed, string]> = [
        ["description", "description"],
        ["category", "category"],
        ["manufacturer", "manufacturer"],
        ["model", "model"],
        ["unit", "unit"],
        ["sellingPriceMinor", "selling_price_minor"],
        ["taxTreatment", "tax_treatment"],
        ["supplierReference", "supplier_reference"],
        ["status", "status"],
      ];
      for (const [key, column] of fields) {
        const value = parsed[key];
        if (value !== undefined) {
          assignments.push(`${column} = ?`);
          args.push(value);
        }
      }
      if (assignments.length === 0) {
        throw new FrigoraError("invalid_input", "Commercial item update is empty.");
      }
      assignments.push("updated_at = ?", "updated_by_user_id = ?");
      args.push(nowIso(), scope.userId, id, scope.workspaceId, scope.ventureId);
      await ensureFrigoraCommercialCatalogueSchema();
      try {
        await withFrigoraWriteTransaction(async (transaction) => {
          const updated = await transaction.execute({
            sql: `
              UPDATE frigora_commercial_items
              SET ${assignments.join(", ")}
              WHERE id = ? AND workspace_id = ? AND venture_id = ?
            `,
            args,
          });
          if (Number(updated.rowsAffected) !== 1) {
            throw new FrigoraError("not_found", "Commercial item was not found.");
          }
        });
      } catch (error) {
        if (error instanceof FrigoraError) {
          throw error;
        }
        asDuplicateSku(error);
      }
      const item = await readItem(scope, id);
      if (!item) {
        throw new FrigoraError("not_found", "Commercial item was not found.");
      }
      return item;
    },

    async getItem(scope: FrigoraScope, id: string): Promise<FrigoraCommercialItem> {
      await assertPermission(scope, "venture.update");
      await ensureFrigoraCommercialCatalogueSchema();
      const item = await readItem(scope, id);
      if (!item) {
        throw new FrigoraError("not_found", "Commercial item was not found.");
      }
      return item;
    },

    async listItems(scope: FrigoraScope, input: unknown = {}): Promise<FrigoraCommercialItem[]> {
      await assertPermission(scope, "venture.update");
      const parsed = parseCatalogue(listSchema, input);
      await ensureFrigoraCommercialCatalogueSchema();
      const clauses = ["workspace_id = ?", "venture_id = ?"];
      const args: string[] = [scope.workspaceId, scope.ventureId];
      if (parsed.sku) {
        clauses.push("INSTR(sku_normalised, ?) > 0");
        args.push(normaliseSku(parsed.sku));
      }
      if (parsed.description) {
        clauses.push("INSTR(lower(description), ?) > 0");
        args.push(parsed.description.toLowerCase());
      }
      if (parsed.manufacturer) {
        clauses.push("INSTR(lower(manufacturer), ?) > 0");
        args.push(parsed.manufacturer.toLowerCase());
      }
      if (parsed.model) {
        clauses.push("INSTR(lower(model), ?) > 0");
        args.push(parsed.model.toLowerCase());
      }
      if (parsed.category) {
        clauses.push("lower(category) = ?");
        args.push(parsed.category.toLowerCase());
      }
      if (parsed.status) {
        clauses.push("status = ?");
        args.push(parsed.status);
      }
      const found = await getClient().execute({
        sql: `
          SELECT ${ITEM_COLUMNS}
          FROM frigora_commercial_items
          WHERE ${clauses.join(" AND ")}
          ORDER BY sku_normalised, id
        `,
        args,
      });
      return found.rows.map((row) => toItem(row as unknown as ItemRow));
    },

    async searchItems(scope: FrigoraScope, input: unknown): Promise<FrigoraCommercialItem[]> {
      await assertPermission(scope, "venture.update");
      const parsed = parseCatalogue(searchSchema, input);
      await ensureFrigoraCommercialCatalogueSchema();
      const clauses = ["workspace_id = ?", "venture_id = ?"];
      const args: string[] = [scope.workspaceId, scope.ventureId];
      if (parsed.sku) {
        clauses.push("INSTR(sku_normalised, ?) > 0");
        args.push(normaliseSku(parsed.sku));
      }
      if (parsed.description) {
        clauses.push("INSTR(lower(description), ?) > 0");
        args.push(parsed.description.toLowerCase());
      }
      if (parsed.manufacturer) {
        clauses.push("INSTR(lower(manufacturer), ?) > 0");
        args.push(parsed.manufacturer.toLowerCase());
      }
      if (parsed.model) {
        clauses.push("INSTR(lower(model), ?) > 0");
        args.push(parsed.model.toLowerCase());
      }
      const found = await getClient().execute({
        sql: `
          SELECT ${ITEM_COLUMNS}
          FROM frigora_commercial_items
          WHERE ${clauses.join(" AND ")}
          ORDER BY sku_normalised, id
        `,
        args,
      });
      return found.rows.map((row) => toItem(row as unknown as ItemRow));
    },

    async selectItem(scope: FrigoraScope, id: string): Promise<FrigoraCommercialItem> {
      await assertPermission(scope, "venture.update");
      await ensureFrigoraCommercialCatalogueSchema();
      const item = await readItem(scope, id);
      if (!item) {
        throw new FrigoraError("not_found", "Commercial item was not found.");
      }
      if (item.status !== "active") {
        throw new FrigoraError(
          "invalid_status",
          "Discontinued commercial items cannot be selected.",
        );
      }
      return item;
    },

    async readItemCost(scope: FrigoraScope, id: string): Promise<FrigoraCommercialItemCost | null> {
      await assertPermission(scope, "venture.commercial_cost.read");
      await ensureFrigoraCommercialCatalogueSchema();
      const item = await readItem(scope, id);
      if (!item) {
        throw new FrigoraError("not_found", "Commercial item was not found.");
      }
      const found = await getClient().execute({
        sql: `
          SELECT purchase_cost_minor, currency, updated_at, updated_by_user_id
          FROM frigora_commercial_item_costs
          WHERE item_id = ? AND workspace_id = ? AND venture_id = ?
        `,
        args: [id, scope.workspaceId, scope.ventureId],
      });
      const row = found.rows[0];
      if (!row) {
        return null;
      }
      return {
        purchaseCostMinor: Number(row.purchase_cost_minor),
        currency: "ZAR",
        updatedAt: String(row.updated_at),
        updatedByUserId: String(row.updated_by_user_id) as UserId,
      };
    },

    async setItemCost(scope: FrigoraScope, id: string, input: unknown): Promise<FrigoraCommercialItemCost> {
      await assertPermission(scope, "venture.commercial_cost.update");
      const parsed = parseCatalogue(costSchema, input);
      await ensureFrigoraCommercialCatalogueSchema();
      const item = await readItem(scope, id);
      if (!item) {
        throw new FrigoraError("not_found", "Commercial item was not found.");
      }
      const now = nowIso();
      await withFrigoraWriteTransaction(async (transaction) => {
        await transaction.execute({
          sql: `
            INSERT INTO frigora_commercial_item_costs (
              item_id, workspace_id, venture_id, purchase_cost_minor, currency, updated_at, updated_by_user_id
            ) VALUES (?, ?, ?, ?, 'ZAR', ?, ?)
            ON CONFLICT (item_id) DO UPDATE SET
              purchase_cost_minor = excluded.purchase_cost_minor,
              updated_at = excluded.updated_at,
              updated_by_user_id = excluded.updated_by_user_id
          `,
          args: [id, scope.workspaceId, scope.ventureId, parsed.purchaseCostMinor, now, scope.userId],
        });
      });
      return {
        purchaseCostMinor: parsed.purchaseCostMinor,
        currency: "ZAR",
        updatedAt: now,
        updatedByUserId: scope.userId,
      };
    },
  };
}
