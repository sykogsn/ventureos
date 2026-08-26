import { z } from "zod";
import {
  QUALORA_CITED_EVIDENCE_LIMIT,
  QUALORA_GAP_KINDS,
  QUALORA_SUMMARY_LIMIT,
} from "./types";

export const qualoraEvidenceAssessmentArgumentSchema = z
  .object({
    requirementId: z.string().min(1).max(128),
    gapKind: z.enum(QUALORA_GAP_KINDS),
    summary: z.string().min(1).max(QUALORA_SUMMARY_LIMIT),
    citedEvidenceIds: z.string().min(1).max(512),
  })
  .strict();

export function canonicalizeCitedEvidenceIds(raw: string): string[] | undefined {
  const ids = [
    ...new Set(
      raw
        .split(",")
        .map((item) => item.trim())
        .filter((item) => item.length > 0),
    ),
  ].sort();
  if (
    ids.length === 0 ||
    ids.length > QUALORA_CITED_EVIDENCE_LIMIT ||
    ids.some((id) => id.length > 64)
  ) {
    return undefined;
  }
  return ids;
}
