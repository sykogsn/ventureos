import { nowIso } from "@/platform/ids";
import type { CapabilityVerifier } from "@/core/workforce/verifiers";
import type {
  BoundPredicate,
  ExecutionArguments,
  VerificationObservation,
  VerificationResult,
} from "@/core/workforce/types";
import type { TrustedObservationRequest } from "@/core/workforce/verification";
import {
  bindPredicateRecord,
  notVerifiedResult,
  verifiedResult,
} from "@/core/workforce/verification";
import { canonicalizeCitedEvidenceIds } from "./arguments";
import {
  createQualoraEvidenceAssessmentStore,
  type QualoraEvidenceAssessmentStore,
} from "./store";
import {
  QUALORA_ASSESSMENT_PROVENANCE_AI_GENERATED,
  QUALORA_ASSESSMENT_STATUS_PROPOSED,
  QUALORA_EVIDENCE_ASSESSMENT_CAPABILITY_ID,
  QUALORA_GAP_KINDS,
  QUALORA_PREDICATE_ID,
  QUALORA_PREDICATE_VERSION,
} from "./types";

export type QualoraVerifierDeps = {
  store?: QualoraEvidenceAssessmentStore;
};

/**
 * Independent Qualora state observer.
 *
 * VERIFIED means the intended Qualora assessment row was independently
 * observed with the expected bound fields. It does not mean the AI
 * judgement is correct, that an evidence gap objectively exists, that a
 * provider is non-compliant, or that a regulator would agree.
 */
export function createQualoraEvidenceAssessmentVerifier(
  deps: QualoraVerifierDeps = {},
): CapabilityVerifier {
  const store = deps.store ?? createQualoraEvidenceAssessmentStore();

  return {
    id: QUALORA_EVIDENCE_ASSESSMENT_CAPABILITY_ID,
    bindPredicate(args: ExecutionArguments) {
      const expected = boundExpected(args);
      if (!expected) {
        return { ok: false };
      }
      return {
        ok: true,
        predicate: bindPredicateRecord(
          {
            id: QUALORA_PREDICATE_ID,
            version: QUALORA_PREDICATE_VERSION,
            capabilityId: QUALORA_EVIDENCE_ASSESSMENT_CAPABILITY_ID,
          },
          expected,
        ),
      };
    },
    async observe(request: TrustedObservationRequest): Promise<VerificationObservation> {
      const row = await store.getBySourceRun({
        workspaceId: request.workspaceId as never,
        ventureId: request.ventureId as never,
        sourceRunId: request.sourceRequestId,
      });
      if (!row) {
        return { status: "missing", observedAt: nowIso() };
      }
      if (
        row.status !== QUALORA_ASSESSMENT_STATUS_PROPOSED ||
        row.provenance !== QUALORA_ASSESSMENT_PROVENANCE_AI_GENERATED
      ) {
        return { status: "invalid", observedAt: nowIso() };
      }
      return {
        status: "observed",
        observedAt: nowIso(),
        values: {
          requirementId: row.requirementId,
          gapKind: row.gapKind,
          citedEvidenceIds: row.citedEvidenceIds.join(","),
          status: row.status,
          provenance: row.provenance,
        },
      };
    },
    apply(
      predicate: BoundPredicate,
      observation: VerificationObservation,
    ): VerificationResult {
      if (observation.status !== "observed" || !observation.values) {
        return notVerifiedResult();
      }
      const expected = boundExpected(predicate.expected);
      const actual = boundExpected(observation.values);
      if (!expected || !actual) {
        return notVerifiedResult();
      }
      if (
        actual.status !== QUALORA_ASSESSMENT_STATUS_PROPOSED ||
        actual.provenance !== QUALORA_ASSESSMENT_PROVENANCE_AI_GENERATED
      ) {
        return notVerifiedResult();
      }
      return expected.requirementId === actual.requirementId &&
        expected.gapKind === actual.gapKind &&
        expected.citedEvidenceIds === actual.citedEvidenceIds
        ? verifiedResult()
        : notVerifiedResult();
    },
  };
}

function boundExpected(args: ExecutionArguments): ExecutionArguments | undefined {
  if (
    typeof args.requirementId !== "string" ||
    typeof args.gapKind !== "string" ||
    typeof args.citedEvidenceIds !== "string"
  ) {
    return undefined;
  }
  if (!(QUALORA_GAP_KINDS as readonly string[]).includes(args.gapKind)) {
    return undefined;
  }
  const cited = canonicalizeCitedEvidenceIds(args.citedEvidenceIds);
  if (!cited) {
    return undefined;
  }
  return {
    requirementId: args.requirementId,
    gapKind: args.gapKind,
    citedEvidenceIds: cited.join(","),
    status: QUALORA_ASSESSMENT_STATUS_PROPOSED,
    provenance: QUALORA_ASSESSMENT_PROVENANCE_AI_GENERATED,
  };
}
