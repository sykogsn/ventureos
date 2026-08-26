import type { WorkforceBinding } from "@/core/workforce/bindings";
import { QUALORA_EVIDENCE_ASSESSMENT_BINDING } from "@/modules/qualora/binding";

/**
 * Production Workforce bindings. Sprint 9 authorises exactly one:
 * Qualora Evidence Analyst → assurance.evidence-assessment.
 */
export const PRODUCTION_WORKFORCE_BINDINGS: WorkforceBinding[] = [
  QUALORA_EVIDENCE_ASSESSMENT_BINDING,
];
