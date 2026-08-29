import { z } from "zod";
import {
  FRIGORA_ASSET_KINDS,
  FRIGORA_ASSET_OPERATIONAL_CONDITION_KINDS,
  FRIGORA_FIELD_CAPTURE_CODES,
  FRIGORA_FIELD_CAPTURE_UNITS,
  FRIGORA_PART_USAGE_UNITS,
  FRIGORA_REFRIGERANT_EVENT_KINDS,
  FRIGORA_WORK_KINDS,
} from "./types";
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

const reportedConditionText = z
  .string()
  .trim()
  .superRefine((value, ctx) => {
    if (value.length > 2000) {
      ctx.addIssue({
        code: "custom",
        message: "Reported condition must be 2000 characters or fewer.",
      });
    }
  })
  .transform((value) => (value.length === 0 ? null : value))
  .nullable();

const patchReportedCondition = z
  .union([z.string(), z.null()])
  .optional()
  .transform((value, ctx) => {
    if (value === undefined) {
      return undefined;
    }
    if (value === null) {
      return null;
    }
    const trimmed = value.trim();
    if (trimmed.length > 2000) {
      ctx.addIssue({
        code: "custom",
        message: "Reported condition must be 2000 characters or fewer.",
      });
      return z.NEVER;
    }
    return trimmed.length === 0 ? null : trimmed;
  });

const patchAssetId = z.union([requiredText, z.null()]).optional();

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

function parseIsoTimestamp(value: string, ctx: z.RefinementCtx) {
  const trimmed = value.trim();
  const parsed = Date.parse(trimmed);
  if (Number.isNaN(parsed)) {
    ctx.addIssue({ code: "custom", message: "Timestamp must be a valid ISO instant." });
    return z.NEVER;
  }
  return trimmed;
}

const isoTimestamp = z.string().trim().transform((value, ctx) => parseIsoTimestamp(value, ctx));

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

export const createWorkOrderSchema = z.object({
  siteId: requiredText,
  workReference: requiredText,
  workKind: z.enum(FRIGORA_WORK_KINDS),
  reportedCondition: reportedConditionText.optional(),
  primaryAssetId: patchAssetId,
});

export const updateWorkOrderSchema = z.object({
  workKind: z.enum(FRIGORA_WORK_KINDS).optional(),
  reportedCondition: patchReportedCondition,
  primaryAssetId: patchAssetId,
});

export const assignWorkOrderSchema = z.object({
  userId: requiredText,
});

export const listWorkOrdersByAssigneeSchema = z.object({
  userId: requiredText,
});

export const recordVisitArrivalSchema = z.object({
  userId: requiredText,
  arrivedAt: isoTimestamp,
});

export const recordVisitDepartureSchema = z.object({
  departedAt: isoTimestamp,
});

export const listVisitsByWorkOrderSchema = z.object({
  workOrderId: requiredText,
});

export const listVisitsByAttendingUserSchema = z.object({
  userId: requiredText,
});

const patchAssetIdNullable = z.union([requiredText, z.null()]).optional();

export const recordFieldCaptureSchema = z
  .object({
    captureKind: z.enum(["measurement", "condition"]),
    captureCode: z.enum(FRIGORA_FIELD_CAPTURE_CODES),
    valueNumeric: z.number().finite().nullable().optional(),
    valueUnit: z.enum(FRIGORA_FIELD_CAPTURE_UNITS).nullable().optional(),
    description: nullableText.optional(),
    observedAt: isoTimestamp,
    userId: requiredText,
    assetId: patchAssetIdNullable,
  })
  .superRefine((value, ctx) => {
    if (value.captureKind === "measurement") {
      if (value.valueNumeric == null) {
        ctx.addIssue({
          code: "custom",
          message: "Measurement captures require a numeric value.",
          path: ["valueNumeric"],
        });
      }
      if (!value.valueUnit) {
        ctx.addIssue({
          code: "custom",
          message: "Measurement captures require a unit.",
          path: ["valueUnit"],
        });
      }
    }
    if (value.captureKind === "condition") {
      const description = value.description?.trim() ?? "";
      if (description.length === 0) {
        ctx.addIssue({
          code: "custom",
          message: "Condition captures require a description.",
          path: ["description"],
        });
      }
      if (value.valueNumeric != null) {
        ctx.addIssue({
          code: "custom",
          message: "Condition captures cannot include a numeric value.",
          path: ["valueNumeric"],
        });
      }
      if (value.valueUnit) {
        ctx.addIssue({
          code: "custom",
          message: "Condition captures cannot include a unit.",
          path: ["valueUnit"],
        });
      }
    }
  });

export const recordTechnicalFindingSchema = z.object({
  findingKind: z.enum(["symptom", "suspected_fault", "confirmed_fault"]),
  description: requiredText,
  assertedAt: isoTimestamp,
  userId: requiredText,
  assetId: patchAssetIdNullable,
  sourceFieldCaptureIds: z.array(requiredText).optional(),
});

export const recordCorrectiveActionSchema = z.object({
  description: requiredText,
  performedAt: isoTimestamp,
  performedByUserId: requiredText,
  recordedByUserId: requiredText,
  assetId: patchAssetIdNullable,
  sourceTechnicalFindingIds: z.array(requiredText).optional(),
});

export const recordVisitOutcomeSchema = z.object({
  description: requiredText,
  outcomeAt: isoTimestamp,
  recordedByUserId: requiredText,
  assetId: patchAssetIdNullable,
});

export const recordRecommendedActionSchema = z.object({
  description: requiredText,
  recommendedAt: isoTimestamp,
  recommendedByUserId: requiredText,
  recordedByUserId: requiredText,
  assetId: patchAssetIdNullable,
});

// Refrigerant added ≠ refrigerant leaked. quantityKg records handling only, not leak inference.
const positiveQuantityKg = z.number().superRefine((value, ctx) => {
  if (!Number.isFinite(value)) {
    ctx.addIssue({
      code: "custom",
      message: "Quantity must be a finite number.",
    });
  }
  if (value <= 0) {
    ctx.addIssue({
      code: "custom",
      message: "Quantity must be greater than zero.",
    });
  }
});

export const recordRefrigerantEventSchema = z.object({
  refrigerantType: requiredText,
  eventKind: z.enum(FRIGORA_REFRIGERANT_EVENT_KINDS),
  quantityKg: positiveQuantityKg,
  reason: patchText.optional(),
  cylinderReference: patchText.optional(),
  occurredAt: isoTimestamp,
  handledByUserId: requiredText,
  recordedByUserId: requiredText,
  assetId: patchAssetIdNullable,
});

const positiveQuantity = z.number().superRefine((value, ctx) => {
  if (!Number.isFinite(value)) {
    ctx.addIssue({
      code: "custom",
      message: "Quantity must be a finite number.",
    });
  }
  if (value <= 0) {
    ctx.addIssue({
      code: "custom",
      message: "Quantity must be greater than zero.",
    });
  }
});

export const recordPartUsageSchema = z.object({
  partDescription: requiredText,
  quantity: positiveQuantity,
  quantityUnit: z.enum(FRIGORA_PART_USAGE_UNITS),
  notes: patchText.optional(),
  usedAt: isoTimestamp,
  usedByUserId: requiredText,
  recordedByUserId: requiredText,
  assetId: patchAssetIdNullable,
});

export const recordAssetOperationalConditionSchema = z.object({
  assetId: requiredText,
  conditionKind: z.enum(FRIGORA_ASSET_OPERATIONAL_CONDITION_KINDS),
  notes: patchText.optional(),
  visitId: patchAssetIdNullable,
  workOrderId: patchAssetIdNullable,
  assertedAt: isoTimestamp,
  assertedByUserId: requiredText,
  recordedByUserId: requiredText,
});

export const listWorkOrdersSchema = z.object({
  status: z.enum(["open", "closed", "cancelled"]).optional(),
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
    issue?.path.includes("workKind") ||
    issue?.path.includes("captureKind") ||
    issue?.path.includes("captureCode") ||
    issue?.path.includes("eventKind") ||
    issue?.path.includes("quantityUnit") ||
    issue?.path.includes("conditionKind") ||
    /Invalid option|Invalid enum/i.test(message)
  ) {
    if (issue?.path.includes("workKind")) {
      throw new FrigoraError("invalid_kind", "Work kind is not allowed.");
    }
    if (issue?.path.includes("captureKind")) {
      throw new FrigoraError("invalid_kind", "Field capture kind is not allowed.");
    }
    if (issue?.path.includes("captureCode")) {
      throw new FrigoraError("invalid_kind", "Field capture code is not allowed.");
    }
    if (issue?.path.includes("eventKind")) {
      throw new FrigoraError("invalid_kind", "Refrigerant event kind is not allowed.");
    }
    if (issue?.path.includes("quantityUnit")) {
      throw new FrigoraError("invalid_kind", "Part usage unit is not allowed.");
    }
    if (issue?.path.includes("conditionKind")) {
      throw new FrigoraError(
        "invalid_kind",
        "Asset operational condition kind is not allowed.",
      );
    }
    throw new FrigoraError("invalid_kind", "Asset kind is not allowed.");
  }
  if (issue?.path.includes("designTargetCelsius") || /finite number/i.test(message)) {
    throw new FrigoraError("invalid_input", "Design target must be a finite number.");
  }
  throw new FrigoraError("invalid_input", message);
}
