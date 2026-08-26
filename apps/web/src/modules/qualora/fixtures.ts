import type { ModelContextCitation, ModelEvidenceRef } from "@/core/workforce/types";
import {
  QUALORA_EVIDENCE_SOURCE_TYPE,
  QUALORA_REQUIREMENT_SOURCE_TYPE,
} from "./types";

/**
 * Synthetic fixtures only. These are not real patients, service users,
 * medical records, or production care records.
 */
export const SYNTHETIC_REQUIREMENT_ID =
  "req.synthetic.medication-administration-record";

export const SYNTHETIC_REQUIREMENT_CITATION: ModelContextCitation = {
  sourceType: QUALORA_REQUIREMENT_SOURCE_TYPE,
  sourceId: SYNTHETIC_REQUIREMENT_ID,
  excerpt:
    "Synthetic assurance requirement: a completed medication-administration checklist must be present for the sampled synthetic episode. This fixture is not a CQC standard and does not describe a real person.",
};

export const SYNTHETIC_GAP_EVIDENCE: ModelEvidenceRef[] = [
  {
    id: "ev.synthetic.procedure-file",
    sourceType: QUALORA_EVIDENCE_SOURCE_TYPE,
    excerpt:
      "Synthetic pack: the local procedure file describes how to complete a checklist. It does not include a completed checklist for the sampled synthetic episode.",
  },
  {
    id: "ev.synthetic.blank-log",
    sourceType: QUALORA_EVIDENCE_SOURCE_TYPE,
    excerpt:
      "Synthetic pack: the supplied log page is blank. No completed entries are present for the sampled synthetic episode.",
  },
];

export const SYNTHETIC_SUFFICIENT_EVIDENCE: ModelEvidenceRef[] = [
  {
    id: "ev.synthetic.completed-checklist",
    sourceType: QUALORA_EVIDENCE_SOURCE_TYPE,
    excerpt:
      "Synthetic pack: a completed medication-administration checklist is present for the sampled synthetic episode in this WorkforceRun.",
  },
];

export const SYNTHETIC_GAP_CITATIONS: ModelContextCitation[] = [
  SYNTHETIC_REQUIREMENT_CITATION,
];

export const SYNTHETIC_SUFFICIENT_CITATIONS: ModelContextCitation[] = [
  SYNTHETIC_REQUIREMENT_CITATION,
];

export const QUALORA_EVIDENCE_ANALYST_OBJECTIVE =
  "Assess whether the supplied synthetic evidence supports the supplied synthetic assurance requirement. If a potential evidence gap is identified, propose one unconfirmed Qualora evidence-gap assessment. Do not declare compliance, CQC outcomes, or regulatory truth.";
