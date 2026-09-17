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
