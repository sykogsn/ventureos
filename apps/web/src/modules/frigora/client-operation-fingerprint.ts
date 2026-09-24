import { createHash } from "node:crypto";

export type TechnicalFindingRequestFingerprintInput = {
  ventureId: string;
  actorUserId: string;
  workOrderId: string;
  visitId: string;
  findingKind: string;
  description: string;
  assertedAt: string;
  userId: string;
  assetId?: string | null;
  sourceFieldCaptureIds?: string[] | null;
};

/**
 * Deterministic SHA-256 fingerprint of the server-relevant technical-finding request.
 * Same clientOperationId + same fingerprint → identical acceptance.
 * Same clientOperationId + different fingerprint → idempotency conflict.
 */
export function fingerprintTechnicalFindingRequest(
  input: TechnicalFindingRequestFingerprintInput,
): string {
  const sourceIds = Array.isArray(input.sourceFieldCaptureIds)
    ? [...input.sourceFieldCaptureIds].map(String).sort()
    : [];
  const canonical = {
    ventureId: input.ventureId,
    actorUserId: input.actorUserId,
    operationType: "recordTechnicalFinding",
    workOrderId: input.workOrderId,
    visitId: input.visitId,
    findingKind: input.findingKind,
    description: input.description,
    assertedAt: input.assertedAt,
    userId: input.userId,
    assetId: input.assetId ?? null,
    sourceFieldCaptureIds: sourceIds.length > 0 ? sourceIds : null,
  };
  return createHash("sha256").update(JSON.stringify(canonical), "utf8").digest("hex");
}

export type FieldCaptureRequestFingerprintInput = {
  ventureId: string;
  actorUserId: string;
  workOrderId: string;
  visitId: string;
  captureKind: string;
  captureCode: string;
  valueNumeric?: number | null;
  valueUnit?: string | null;
  description?: string | null;
  observedAt: string;
  userId: string;
  assetId?: string | null;
};

export function fingerprintFieldCaptureRequest(
  input: FieldCaptureRequestFingerprintInput,
): string {
  const canonical = {
    ventureId: input.ventureId,
    actorUserId: input.actorUserId,
    operationType: "recordFieldCapture",
    workOrderId: input.workOrderId,
    visitId: input.visitId,
    captureKind: input.captureKind,
    captureCode: input.captureCode,
    valueNumeric: input.captureKind === "measurement" ? (input.valueNumeric ?? null) : null,
    valueUnit: input.captureKind === "measurement" ? (input.valueUnit ?? null) : null,
    description:
      input.captureKind === "condition"
        ? (input.description ?? "").trim()
        : input.description?.trim()
          ? input.description.trim()
          : null,
    observedAt: input.observedAt,
    userId: input.userId,
    assetId: input.assetId ?? null,
  };
  return createHash("sha256").update(JSON.stringify(canonical), "utf8").digest("hex");
}

export type VisitEvidenceRequestFingerprintInput = {
  ventureId: string;
  actorUserId: string;
  workOrderId: string;
  visitId: string;
  category: string;
  description?: string | null;
  originalFilename: string;
  mimeType: string;
  byteLength: number;
  contentSha256: string;
  userId: string;
  assetId?: string | null;
};

/**
 * Evidence fingerprint includes semantic metadata + SHA-256 of bytes.
 * Must NOT embed the full binary body.
 */
export function fingerprintVisitEvidenceRequest(
  input: VisitEvidenceRequestFingerprintInput,
): string {
  const description =
    input.category === "OTHER"
      ? (input.description ?? "").trim()
      : input.description?.trim()
        ? input.description.trim()
        : null;
  const canonical = {
    ventureId: input.ventureId,
    actorUserId: input.actorUserId,
    operationType: "recordVisitEvidence",
    workOrderId: input.workOrderId,
    visitId: input.visitId,
    category: input.category,
    description,
    originalFilename: input.originalFilename,
    mimeType: input.mimeType,
    byteLength: input.byteLength,
    contentSha256: input.contentSha256.toLowerCase(),
    userId: input.userId,
    assetId: input.assetId ?? null,
  };
  return createHash("sha256").update(JSON.stringify(canonical), "utf8").digest("hex");
}

/** Deterministic SHA-256 hex of exact binary bytes (Node). */
export function sha256HexOfBytes(bytes: ArrayBuffer | Uint8Array): string {
  const view =
    bytes instanceof Uint8Array
      ? bytes
      : new Uint8Array(bytes instanceof ArrayBuffer ? bytes : Buffer.from(bytes as ArrayBuffer));
  return createHash("sha256").update(view).digest("hex");
}
