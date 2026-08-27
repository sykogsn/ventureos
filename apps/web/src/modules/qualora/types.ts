import type { AgentInstanceId, WorkforceRunId } from "@/contracts/ids";
import type { VentureId, WorkspaceId } from "@/contracts";

export const QUALORA_VENTURE_DEFINITION_ID = "qualora";

export const QUALORA_EVIDENCE_ASSESSMENT_CAPABILITY_ID =
  "assurance.evidence-assessment";

export const QUALORA_EVIDENCE_ANALYST_DEFINITION_ID =
  "qualora.evidence-analyst" as const;

export const QUALORA_EVIDENCE_ANALYST_DEFINITION_VERSION = "1";

export const QUALORA_EVIDENCE_ASSESSMENT_BINDING_ID =
  "qualora.evidence-assessment.v1";

export const QUALORA_EVIDENCE_ASSESSMENT_IMPLEMENTATION_VERSION = "1.0.0";

export const QUALORA_ASSESSMENT_STATUS_PROPOSED = "proposed";
export const QUALORA_ASSESSMENT_PROVENANCE_AI_GENERATED = "ai_generated";

export const QUALORA_GAP_KINDS = [
  "NOT_SUPPORTED",
  "INSUFFICIENT_EVIDENCE",
  "CONTRADICTED",
] as const;

export type QualoraGapKind = (typeof QUALORA_GAP_KINDS)[number];

export const QUALORA_REQUIREMENT_SOURCE_TYPE = "assurance-requirement";
export const QUALORA_EVIDENCE_SOURCE_TYPE = "synthetic-evidence";

export const QUALORA_SUMMARY_LIMIT = 500;
export const QUALORA_CITED_EVIDENCE_LIMIT = 8;

export const QUALORA_AUDIT_RECORDED = "qualora.evidence-assessment.recorded";

export const QUALORA_PREDICATE_ID = "assurance.evidence-assessment.proposed-gap";
export const QUALORA_PREDICATE_VERSION = "1";

export const QUALORA_REVIEW_DECISIONS = ["CONFIRMED", "DISMISSED"] as const;
export type QualoraReviewDecision = (typeof QUALORA_REVIEW_DECISIONS)[number];

export const QUALORA_REVIEW_PERMISSION = "venture.update" as const;
export const QUALORA_AUDIT_REVIEWED = "qualora.evidence-assessment.reviewed";
export const QUALORA_RATIONALE_LIMIT = 500;

/**
 * Durable Qualora record. Always AI-generated, proposed, and unconfirmed.
 * Presence of this row is not a compliance determination.
 */
export type QualoraEvidenceAssessment = {
  id: string;
  workspaceId: WorkspaceId;
  ventureId: VentureId;
  requirementId: string;
  sourceRunId: WorkforceRunId;
  sourceAgentInstanceId: AgentInstanceId;
  executionIdempotencyKey: string;
  gapKind: QualoraGapKind;
  summary: string;
  citedEvidenceIds: string[];
  status: typeof QUALORA_ASSESSMENT_STATUS_PROPOSED;
  provenance: typeof QUALORA_ASSESSMENT_PROVENANCE_AI_GENERATED;
  implementationId: string | null;
  implementationVersion: string | null;
  createdAt: string;
  updatedAt: string;
};

/**
 * Human review of a proposed Qualora evidence-gap assessment.
 *
 * CONFIRMED means only that an authorised human confirms the proposed
 * assessment is an appropriate assessment of the supplied evidence.
 * It does not mean regulatory compliance or non-compliance, a CQC
 * conclusion, or Sprint 7 VERIFIED execution state.
 *
 * DISMISSED preserves the original AI-generated proposed assessment.
 */
export type QualoraEvidenceAssessmentReview = {
  id: string;
  assessmentId: string;
  workspaceId: WorkspaceId;
  ventureId: VentureId;
  assessmentFingerprint: string;
  reviewerUserId: string;
  decision: QualoraReviewDecision;
  rationale: string | null;
  createdAt: string;
  updatedAt: string;
};
