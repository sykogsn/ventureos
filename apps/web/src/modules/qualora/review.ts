import type { UserId, VentureId, WorkspaceId } from "@/contracts";
import { isAgentActor, isHumanActor, isSystemActor } from "@/core/workforce/actor";
import type { HumanWorkforceActor, WorkforceActor } from "@/core/workforce/types";
import { createAuditLog } from "@/platform/audit/log";
import { getPlatform } from "@/platform/kernel";
import { getPersistence } from "@/platform/persistence/repositories";
import { fingerprintQualoraEvidenceAssessment } from "./fingerprint";
import {
  createQualoraEvidenceAssessmentReviewStore,
  type QualoraEvidenceAssessmentReviewStore,
} from "./review-store";
import {
  createQualoraEvidenceAssessmentStore,
  type QualoraEvidenceAssessmentStore,
} from "./store";
import {
  QUALORA_AUDIT_REVIEWED,
  QUALORA_RATIONALE_LIMIT,
  QUALORA_REVIEW_DECISIONS,
  QUALORA_REVIEW_PERMISSION,
  QUALORA_VENTURE_DEFINITION_ID,
  type QualoraEvidenceAssessmentReview,
  type QualoraReviewDecision,
} from "./types";

export type QualoraReviewFailure =
  | "UNAUTHENTICATED"
  | "AGENT_CANNOT_REVIEW"
  | "SYSTEM_CANNOT_REVIEW"
  | "NOT_HUMAN"
  | "UNAUTHORISED"
  | "NOT_FOUND"
  | "SCOPE_MISMATCH"
  | "VENTURE_NOT_QUALORA"
  | "STALE_ASSESSMENT"
  | "INVALID_DECISION"
  | "CONFLICT";

export type QualoraReviewResult =
  | { ok: true; review: QualoraEvidenceAssessmentReview; reused?: true }
  | { ok: false; failure: QualoraReviewFailure };

export type QualoraReviewInput = {
  actor?: WorkforceActor;
  assessmentId: string;
  workspaceId: WorkspaceId;
  ventureId: VentureId;
  fingerprint: string;
  decision: QualoraReviewDecision;
  rationale?: string;
};

export type QualoraReviewDeps = {
  assessments?: QualoraEvidenceAssessmentStore;
  reviews?: QualoraEvidenceAssessmentReviewStore;
  canReview?: (userId: UserId, workspaceId: WorkspaceId) => Promise<boolean>;
  loadVentureDefinitionId?: (ventureId: string) => Promise<string | undefined>;
  audit?: {
    record(entry: {
      action: string;
      actor?: HumanWorkforceActor;
      metadata?: Record<string, string>;
    }): Promise<unknown>;
  };
};

export function authoriseReviewer(
  actor: WorkforceActor | undefined,
):
  | { ok: true; actor: HumanWorkforceActor }
  | {
      ok: false;
      reason:
        | "UNAUTHENTICATED"
        | "AGENT_CANNOT_REVIEW"
        | "SYSTEM_CANNOT_REVIEW"
        | "NOT_HUMAN";
    } {
  if (!actor) {
    return { ok: false, reason: "UNAUTHENTICATED" };
  }
  if (isAgentActor(actor)) {
    return { ok: false, reason: "AGENT_CANNOT_REVIEW" };
  }
  if (isSystemActor(actor)) {
    return { ok: false, reason: "SYSTEM_CANNOT_REVIEW" };
  }
  if (!isHumanActor(actor)) {
    return { ok: false, reason: "NOT_HUMAN" };
  }
  return { ok: true, actor };
}

/**
 * Records one final human CONFIRMED or DISMISSED decision against the
 * exact proposed Qualora assessment. This is not Workforce verification
 * and is not a regulatory compliance verdict.
 */
export async function reviewQualoraEvidenceAssessment(
  input: QualoraReviewInput,
  deps: QualoraReviewDeps = {},
): Promise<QualoraReviewResult> {
  const authorised = authoriseReviewer(input.actor);
  if (!authorised.ok) {
    return { ok: false, failure: authorised.reason };
  }

  if (!(QUALORA_REVIEW_DECISIONS as readonly string[]).includes(input.decision)) {
    return { ok: false, failure: "INVALID_DECISION" };
  }
  const rationale = readRationale(input.rationale);
  if (rationale === undefined) {
    return { ok: false, failure: "INVALID_DECISION" };
  }

  const canReview =
    deps.canReview ??
    ((userId: UserId, workspaceId: WorkspaceId) =>
      getPlatform().permissions.can({
        userId,
        permission: QUALORA_REVIEW_PERMISSION,
        resource: { type: "workspace", id: workspaceId },
      }));
  const allowed = await canReview(authorised.actor.userId, input.workspaceId);
  if (!allowed) {
    return { ok: false, failure: "UNAUTHORISED" };
  }

  const assessments = deps.assessments ?? createQualoraEvidenceAssessmentStore();
  const assessment = await assessments.getById(input.assessmentId);
  if (!assessment) {
    return { ok: false, failure: "NOT_FOUND" };
  }
  if (
    assessment.workspaceId !== input.workspaceId ||
    assessment.ventureId !== input.ventureId
  ) {
    return { ok: false, failure: "SCOPE_MISMATCH" };
  }

  const loadVentureDefinitionId =
    deps.loadVentureDefinitionId ??
    (async (ventureId: string) => {
      const venture = await getPersistence().ventures.findById(
        ventureId as VentureId,
      );
      return venture?.definitionId;
    });
  const definitionId = await loadVentureDefinitionId(input.ventureId);
  if (definitionId !== QUALORA_VENTURE_DEFINITION_ID) {
    return { ok: false, failure: "VENTURE_NOT_QUALORA" };
  }

  const fingerprint = fingerprintQualoraEvidenceAssessment(assessment);
  if (fingerprint !== input.fingerprint.trim()) {
    return { ok: false, failure: "STALE_ASSESSMENT" };
  }

  const reviews = deps.reviews ?? createQualoraEvidenceAssessmentReviewStore();
  const written = await reviews.insert({
    assessmentId: assessment.id,
    workspaceId: assessment.workspaceId,
    ventureId: assessment.ventureId,
    assessmentFingerprint: fingerprint,
    reviewerUserId: authorised.actor.userId,
    decision: input.decision,
    rationale,
  });
  if (written.kind === "conflict") {
    return { ok: false, failure: "CONFLICT" };
  }

  if (written.kind === "created") {
    const audit = deps.audit ?? createAuditLog();
    await audit.record({
      action: QUALORA_AUDIT_REVIEWED,
      actor: authorised.actor,
      metadata: {
        workspaceId: assessment.workspaceId,
        ventureId: assessment.ventureId,
        assessmentId: assessment.id,
        decision: written.record.decision,
        reviewerUserId: written.record.reviewerUserId,
      },
    });
  }

  return {
    ok: true,
    review: written.record,
    ...(written.kind === "reused" ? { reused: true as const } : {}),
  };
}

function readRationale(value: string | undefined): string | null | undefined {
  if (value === undefined) {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  if (trimmed.length > QUALORA_RATIONALE_LIMIT) {
    return undefined;
  }
  return trimmed;
}
