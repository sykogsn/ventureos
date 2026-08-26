import type { WorkforceBinding } from "@/core/workforce/bindings";
import { createQualoraEvidenceAssessmentExecutor } from "./executor";
import { createQualoraEvidenceAssessmentVerifier } from "./verifier";
import {
  QUALORA_EVIDENCE_ASSESSMENT_BINDING_ID,
  QUALORA_EVIDENCE_ASSESSMENT_CAPABILITY_ID,
  QUALORA_EVIDENCE_ASSESSMENT_IMPLEMENTATION_VERSION,
} from "./types";

export const QUALORA_EVIDENCE_ASSESSMENT_BINDING: WorkforceBinding = {
  bindingId: QUALORA_EVIDENCE_ASSESSMENT_BINDING_ID,
  implementationVersion: QUALORA_EVIDENCE_ASSESSMENT_IMPLEMENTATION_VERSION,
  capabilityId: QUALORA_EVIDENCE_ASSESSMENT_CAPABILITY_ID,
  executor: createQualoraEvidenceAssessmentExecutor(),
  verifier: createQualoraEvidenceAssessmentVerifier(),
};
