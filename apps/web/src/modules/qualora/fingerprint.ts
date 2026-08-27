import { createHash } from "node:crypto";
import type { QualoraEvidenceAssessment } from "./types";

/**
 * Binds a human review to the exact immutable AI assessment content.
 * Sprint 9 assessment rows are insert-only; this fingerprint still
 * fails closed if that content were ever altered.
 */
export function fingerprintQualoraEvidenceAssessment(
  assessment: QualoraEvidenceAssessment,
): string {
  return createHash("sha256")
    .update(
      [
        assessment.id,
        assessment.workspaceId,
        assessment.ventureId,
        assessment.requirementId,
        assessment.sourceRunId,
        assessment.gapKind,
        assessment.summary,
        [...assessment.citedEvidenceIds].sort().join(","),
        assessment.status,
        assessment.provenance,
      ].join("|"),
    )
    .digest("hex");
}
