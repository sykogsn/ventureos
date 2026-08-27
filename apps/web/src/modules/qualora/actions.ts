"use server";

import type { VentureId, WorkspaceId } from "@/contracts";
import { getSession } from "@/lib/auth/session";
import { reviewQualoraEvidenceAssessment } from "./review";
import type { QualoraReviewDecision } from "./types";

export type QualoraReviewActionResult = {
  error?: string;
};

export async function confirmQualoraEvidenceAssessmentAction(input: {
  assessmentId: string;
  workspaceId: string;
  ventureId: string;
  fingerprint: string;
  rationale?: string;
}): Promise<QualoraReviewActionResult> {
  return decideReview("CONFIRMED", input);
}

export async function dismissQualoraEvidenceAssessmentAction(input: {
  assessmentId: string;
  workspaceId: string;
  ventureId: string;
  fingerprint: string;
  rationale?: string;
}): Promise<QualoraReviewActionResult> {
  return decideReview("DISMISSED", input);
}

async function decideReview(
  decision: QualoraReviewDecision,
  input: {
    assessmentId: string;
    workspaceId: string;
    ventureId: string;
    fingerprint: string;
    rationale?: string;
  },
): Promise<QualoraReviewActionResult> {
  const session = await getSession();
  if (!session) {
    return { error: "You must be signed in." };
  }

  const result = await reviewQualoraEvidenceAssessment({
    actor: {
      kind: "human",
      userId: session.id,
      workspaceId: input.workspaceId as WorkspaceId,
      ventureId: input.ventureId as VentureId,
    },
    assessmentId: input.assessmentId,
    workspaceId: input.workspaceId as WorkspaceId,
    ventureId: input.ventureId as VentureId,
    fingerprint: input.fingerprint,
    decision,
    rationale: input.rationale,
  });

  if (!result.ok) {
    return { error: "Review was not recorded." };
  }
  return {};
}
