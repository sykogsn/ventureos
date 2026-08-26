import type { AgentDefinition } from "@/core/workforce/types";
import type { AgentDefinitionId } from "@/contracts/ids";
import {
  QUALORA_EVIDENCE_ANALYST_DEFINITION_ID,
  QUALORA_EVIDENCE_ANALYST_DEFINITION_VERSION,
  QUALORA_EVIDENCE_ASSESSMENT_CAPABILITY_ID,
} from "./types";

/**
 * Qualora Evidence Analyst. Assists assurance by proposing at most one
 * AI-generated, unconfirmed evidence-gap assessment. It does not determine
 * regulatory truth, confirm findings, or update compliance status.
 */
export const QUALORA_EVIDENCE_ANALYST_DEFINITION: AgentDefinition = {
  id: QUALORA_EVIDENCE_ANALYST_DEFINITION_ID as AgentDefinitionId,
  version: QUALORA_EVIDENCE_ANALYST_DEFINITION_VERSION,
  role: "Qualora Evidence Analyst",
  responsibilities: [
    "Assess whether supplied evidence supports one supplied assurance requirement.",
    "Where a potential evidence gap is identified, create one traceable AI-generated proposed assessment.",
    "This employee assists assurance. It does not determine regulatory truth.",
    "Do not confirm, dismiss, close, or delete a finding.",
    "Do not update an authoritative compliance status, assurance score, or requirement.",
    "Do not declare CQC outcomes, contact a regulator, or approve this run.",
  ],
  capabilityAllowList: [QUALORA_EVIDENCE_ASSESSMENT_CAPABILITY_ID],
  capabilityDenyList: [],
  autonomyCeiling: "execute",
  approvalBoundary: "",
  memoryPolicy: "run-scoped",
  escalationPolicy: "fail-run",
  evaluationProfile: "proposed-gap-state-verification",
  lifecycle: "ACTIVE",
};
