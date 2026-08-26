import type { ModelContextCitation, ModelEvidenceRef } from "@/core/workforce/types";
import {
  SYNTHETIC_GAP_CITATIONS,
  SYNTHETIC_GAP_EVIDENCE,
  SYNTHETIC_SUFFICIENT_CITATIONS,
  SYNTHETIC_SUFFICIENT_EVIDENCE,
} from "./fixtures";

export type QualoraEvidencePackKind = "gap" | "sufficient";

export function qualoraEvidencePack(kind: QualoraEvidencePackKind): {
  evidence: ModelEvidenceRef[];
  citations: ModelContextCitation[];
} {
  if (kind === "sufficient") {
    return {
      evidence: SYNTHETIC_SUFFICIENT_EVIDENCE,
      citations: SYNTHETIC_SUFFICIENT_CITATIONS,
    };
  }
  return {
    evidence: SYNTHETIC_GAP_EVIDENCE,
    citations: SYNTHETIC_GAP_CITATIONS,
  };
}
