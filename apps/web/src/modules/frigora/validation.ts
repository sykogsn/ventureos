import { z } from "zod";
import {
  FRIGORA_ASSET_KINDS,
  FRIGORA_ASSET_OPERATIONAL_CONDITION_KINDS,
  FRIGORA_FIELD_CAPTURE_CODES,
  FRIGORA_FIELD_CAPTURE_UNITS,
  FRIGORA_PART_USAGE_UNITS,
  FRIGORA_REFRIGERANT_EVENT_KINDS,
  FRIGORA_VISIT_EVIDENCE_CATEGORIES,
  FRIGORA_WORK_KINDS,
} from "./types";
import { FrigoraError } from "./errors";

/** Minimal refrigerant identity canonicalisation (R404a → R404A). */
export function canonicalizeRefrigerantCode(raw: string): string {
  return raw.trim().toUpperCase();
}

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

const canonicalIsoInstant = z.string().trim().transform((value, ctx) => {
  if (
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/.test(
      value,
    )
  ) {
    ctx.addIssue({ code: "custom", message: "Timestamp must be a valid ISO instant." });
    return z.NEVER;
  }
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) {
    ctx.addIssue({ code: "custom", message: "Timestamp must be a valid ISO instant." });
    return z.NEVER;
  }
  return new Date(parsed).toISOString();
});

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

/** Exact stored updatedAt token — no trim / ISO rewrite (CAS equality). */
const expectedUpdatedAtToken = z.string().min(1, "Required text is empty.");

export const assignWorkOrderSchema = z.object({
  confirmDoubleBooking: z.boolean().optional(),
  userId: requiredText,
  expectedUpdatedAt: expectedUpdatedAtToken,
});

export const clearWorkOrderAssignmentSchema = z.object({
  expectedUpdatedAt: expectedUpdatedAtToken,
});

export const unavailabilitySchema = z.object({
  userId: requiredText,
  unavailableStartAt: canonicalIsoInstant,
  unavailableEndAt: canonicalIsoInstant,
}).refine((value) => value.unavailableEndAt > value.unavailableStartAt, {
  message: "Unavailable end must be after start.", path: ["unavailableEndAt"],
});

export const availabilityIdentitySchema = z.object({
  id: requiredText,
  expectedUpdatedAt: expectedUpdatedAtToken,
});

export const scheduleWorkOrderSchema = z
  .object({
    confirmDoubleBooking: z.boolean().optional(),
    scheduledStartAt: canonicalIsoInstant,
    scheduledEndAt: canonicalIsoInstant,
    expectedUpdatedAt: expectedUpdatedAtToken,
  })
  .superRefine((value, ctx) => {
    if (Date.parse(value.scheduledEndAt) <= Date.parse(value.scheduledStartAt)) {
      ctx.addIssue({
        code: "custom",
        message: "Scheduled end must be after scheduled start.",
        path: ["scheduledEndAt"],
      });
    }
  });

export const clearWorkOrderScheduleSchema = z.object({
  expectedUpdatedAt: expectedUpdatedAtToken,
});

export const declineWorkOrderAssignmentSchema = z.object({
  reason: requiredText,
});

export const listScheduledWorkOrdersSchema = z
  .object({
    rangeStart: canonicalIsoInstant,
    rangeEnd: canonicalIsoInstant,
  })
  .superRefine((value, ctx) => {
    if (Date.parse(value.rangeEnd) <= Date.parse(value.rangeStart)) {
      ctx.addIssue({
        code: "custom",
        message: "Range end must be after range start.",
        path: ["rangeEnd"],
      });
    }
  });

export const cancelWorkOrderSchema = z.object({
  reason: requiredText,
});

export const convertRecommendedActionSchema = z.object({
  recommendedActionId: requiredText,
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

/** Integer ZAR minor units (cents); non-negative. */
export const zarCentsSchema = z.number().superRefine((value, ctx) => {
  if (!Number.isInteger(value) || value < 0) {
    ctx.addIssue({
      code: "custom",
      message: "Amount must be a non-negative integer in ZAR cents.",
    });
  }
});

/** Optional nullable ZAR cents for catalogue / venture defaults. */
export const optionalNullableZarCentsSchema = z
  .union([zarCentsSchema, z.null()])
  .optional();

export const setVentureLabourHourlyChargeSchema = z.object({
  labourHourlyChargeCents: z.union([zarCentsSchema, z.null()]),
});

export const setPartUsageUnitChargeSchema = z.object({
  unitChargeCents: zarCentsSchema,
});

export const setRefrigerantEventChargePerKgSchema = z.object({
  chargePerKgCents: zarCentsSchema,
});

export const setVisitLabourHourlyChargeSchema = z.object({
  labourHourlyChargeCents: zarCentsSchema,
});

export const createPartReferenceSchema = z.object({
  displayName: requiredText,
  defaultQuantityUnit: z.enum(FRIGORA_PART_USAGE_UNITS),
  defaultUnitChargeCents: optionalNullableZarCentsSchema,
});

export const updatePartReferenceSchema = z.object({
  displayName: requiredText.optional(),
  defaultQuantityUnit: z.enum(FRIGORA_PART_USAGE_UNITS).optional(),
  defaultUnitChargeCents: optionalNullableZarCentsSchema,
});

export const createRefrigerantReferenceSchema = z.object({
  canonicalCode: requiredText.transform(canonicalizeRefrigerantCode),
  displayName: requiredText,
  defaultChargePerKgCents: optionalNullableZarCentsSchema,
});

export const updateRefrigerantReferenceSchema = z.object({
  canonicalCode: requiredText.transform(canonicalizeRefrigerantCode).optional(),
  displayName: requiredText.optional(),
  defaultChargePerKgCents: optionalNullableZarCentsSchema,
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

const optionalReferenceId = z
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

export const recordRefrigerantEventSchema = z
  .object({
    refrigerantType: z.string().trim().optional(),
    refrigerantReferenceId: optionalReferenceId,
    eventKind: z.enum(FRIGORA_REFRIGERANT_EVENT_KINDS),
    quantityKg: positiveQuantityKg,
    reason: patchText.optional(),
    cylinderReference: patchText.optional(),
    occurredAt: isoTimestamp,
    handledByUserId: requiredText,
    recordedByUserId: requiredText,
    assetId: patchAssetIdNullable,
  })
  .superRefine((data, ctx) => {
    const hasReference = Boolean(data.refrigerantReferenceId);
    const hasType = Boolean(data.refrigerantType && data.refrigerantType.length > 0);
    if (!hasReference && !hasType) {
      ctx.addIssue({
        code: "custom",
        path: ["refrigerantType"],
        message: "Required text is empty.",
      });
    }
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

export const recordPartUsageSchema = z
  .object({
    partDescription: z.string().trim().optional(),
    partReferenceId: optionalReferenceId,
    quantity: positiveQuantity,
    quantityUnit: z.enum(FRIGORA_PART_USAGE_UNITS).optional(),
    notes: patchText.optional(),
    usedAt: isoTimestamp,
    usedByUserId: requiredText,
    recordedByUserId: requiredText,
    assetId: patchAssetIdNullable,
  })
  .superRefine((data, ctx) => {
    const hasReference = Boolean(data.partReferenceId);
    const hasDescription = Boolean(data.partDescription && data.partDescription.length > 0);
    if (!hasReference && !hasDescription) {
      ctx.addIssue({
        code: "custom",
        path: ["partDescription"],
        message: "Required text is empty.",
      });
    }
    if (!hasReference && !data.quantityUnit) {
      ctx.addIssue({
        code: "custom",
        path: ["quantityUnit"],
        message: "Part usage unit is not allowed.",
      });
    }
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

const acknowledgementText = z
  .string()
  .trim()
  .superRefine((value, ctx) => {
    if (value.length === 0) {
      ctx.addIssue({
        code: "custom",
        message: "Required text is empty.",
      });
      return;
    }
    if (value.length > 2000) {
      ctx.addIssue({
        code: "custom",
        message: "Acknowledgement text must be 2000 characters or fewer.",
      });
    }
  });

export const recordVisitCustomerAcknowledgementSchema = z.object({
  acknowledgementText,
  acknowledgerName: requiredText,
  acknowledgedAt: isoTimestamp,
  recordedByUserId: requiredText,
});

const evidenceDescription = z
  .string()
  .trim()
  .max(2000, "Description must be 2000 characters or fewer.")
  .transform((value) => (value.length === 0 ? null : value))
  .nullable()
  .optional();

export const recordVisitEvidenceSchema = z
  .object({
    category: z.enum(FRIGORA_VISIT_EVIDENCE_CATEGORIES),
    description: evidenceDescription,
    userId: requiredText,
    assetId: nullableText.optional(),
  })
  .superRefine((value, ctx) => {
    if (value.category === "OTHER") {
      const description = value.description?.trim() ?? "";
      if (description.length === 0) {
        ctx.addIssue({
          code: "custom",
          message: "OTHER evidence requires a description.",
          path: ["description"],
        });
      }
    }
  });

export const recordVisitEvidenceWithFileSchema = recordVisitEvidenceSchema.extend({
  body: z.instanceof(Uint8Array),
  originalFilename: requiredText,
  mimeType: requiredText,
});

export const linkVisitEvidenceSchema = recordVisitEvidenceSchema.extend({
  storedObjectId: requiredText,
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
    issue?.path.includes("category") ||
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
