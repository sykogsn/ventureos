import { z } from "zod";
import { FRIGORA_ASSET_KINDS } from "./types";
import { FrigoraError } from "./errors";

const requiredText = z.string().trim().min(1, "Required text is empty.");

const nullableText = z
  .string()
  .trim()
  .transform((value) => (value.length === 0 ? null : value))
  .nullable();

const patchText = z
  .union([z.string(), z.null()])
  .optional()
  .transform((value) => {
    if (value === undefined) {
      return undefined;
    }
    if (value === null) {
      return null;
    }
    const trimmed = value.trim();
    return trimmed.length === 0 ? null : trimmed;
  });

const patchFiniteNumber = z
  .union([z.number(), z.null()])
  .optional()
  .superRefine((value, ctx) => {
    if (value == null) {
      return;
    }
    if (!Number.isFinite(value)) {
      ctx.addIssue({
        code: "custom",
        message: "Design target must be a finite number.",
      });
    }
  });

const patchAssetKind = z.union([z.enum(FRIGORA_ASSET_KINDS), z.null()]).optional();

const patchDate = z
  .union([z.string(), z.null()])
  .optional()
  .transform((value, ctx) => {
    if (value === undefined) {
      return undefined;
    }
    if (value === null || value.trim() === "") {
      return null;
    }
    const trimmed = value.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      ctx.addIssue({ code: "custom", message: "Date must be YYYY-MM-DD." });
      return z.NEVER;
    }
    const parsed = new Date(`${trimmed}T00:00:00.000Z`);
    if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== trimmed) {
      ctx.addIssue({ code: "custom", message: "Date is not a valid calendar day." });
      return z.NEVER;
    }
    return trimmed;
  });

function parseIsoDate(value: string, ctx: z.RefinementCtx) {
  const trimmed = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    ctx.addIssue({ code: "custom", message: "Date must be YYYY-MM-DD." });
    return z.NEVER;
  }
  const parsed = new Date(`${trimmed}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== trimmed) {
    ctx.addIssue({ code: "custom", message: "Date is not a valid calendar day." });
    return z.NEVER;
  }
  return trimmed;
}

const optionalIsoDate = z
  .string()
  .trim()
  .transform((value, ctx) => parseIsoDate(value, ctx))
  .nullable()
  .optional();

const optionalFiniteNumber = z
  .number()
  .finite({ message: "Design target must be a finite number." })
  .nullable()
  .optional();

const optionalAssetKind = z.enum(FRIGORA_ASSET_KINDS).nullable().optional();

export const createCustomerSchema = z.object({
  code: requiredText,
  displayName: requiredText,
  legalName: nullableText.optional(),
  notes: nullableText.optional(),
});

export const updateCustomerSchema = z.object({
  code: requiredText.optional(),
  displayName: requiredText.optional(),
  legalName: patchText,
  notes: patchText,
});

export const createSiteSchema = z.object({
  customerId: requiredText,
  code: requiredText,
  name: requiredText,
  addressLine1: nullableText.optional(),
  addressLine2: nullableText.optional(),
  city: nullableText.optional(),
  region: nullableText.optional(),
  postalCode: nullableText.optional(),
  country: nullableText.optional(),
  notes: nullableText.optional(),
});

export const updateSiteSchema = z.object({
  code: requiredText.optional(),
  name: requiredText.optional(),
  addressLine1: patchText,
  addressLine2: patchText,
  city: patchText,
  region: patchText,
  postalCode: patchText,
  country: patchText,
  notes: patchText,
});

export const createAssetSchema = z.object({
  siteId: requiredText,
  tag: requiredText,
  name: nullableText.optional(),
  assetKind: optionalAssetKind,
  manufacturer: nullableText.optional(),
  model: nullableText.optional(),
  serialNumber: nullableText.optional(),
  designTargetCelsius: optionalFiniteNumber,
  refrigerantType: nullableText.optional(),
  locationOnSite: nullableText.optional(),
  installedOn: optionalIsoDate,
  commissionedOn: optionalIsoDate,
  notes: nullableText.optional(),
});

export const updateAssetSchema = z.object({
  siteId: requiredText.optional(),
  tag: requiredText.optional(),
  name: patchText,
  assetKind: patchAssetKind,
  manufacturer: patchText,
  model: patchText,
  serialNumber: patchText,
  designTargetCelsius: patchFiniteNumber,
  refrigerantType: patchText,
  locationOnSite: patchText,
  installedOn: patchDate,
  commissionedOn: patchDate,
  notes: patchText,
});

export const scopeSchema = z.object({
  workspaceId: requiredText,
  ventureId: requiredText,
});

export function parseWithFrigora<T>(
  schema: z.ZodType<T>,
  input: unknown,
  invalidKind = false,
): T {
  const result = schema.safeParse(input);
  if (result.success) {
    return result.data;
  }

  const issue = result.error.issues[0];
  const message = issue?.message ?? "Invalid input.";
  if (
    invalidKind ||
    issue?.path.includes("assetKind") ||
    /Invalid option|Invalid enum/i.test(message)
  ) {
    throw new FrigoraError("invalid_kind", "Asset kind is not allowed.");
  }
  if (issue?.path.includes("designTargetCelsius") || /finite number/i.test(message)) {
    throw new FrigoraError("invalid_input", "Design target must be a finite number.");
  }
  throw new FrigoraError("invalid_input", message);
}
