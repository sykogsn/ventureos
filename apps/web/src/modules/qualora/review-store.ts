import { eq } from "drizzle-orm";
import type { UserId, VentureId, WorkspaceId } from "@/contracts";
import { createId, nowIso } from "@/platform/ids";
import { ensureSchema, getDb } from "@/platform/persistence/db";
import { qualoraEvidenceAssessmentReviews as reviewTable } from "@/platform/persistence/schema";
import {
  QUALORA_REVIEW_DECISIONS,
  type QualoraEvidenceAssessmentReview,
  type QualoraReviewDecision,
} from "./types";

export type QualoraReviewInsert = {
  assessmentId: string;
  workspaceId: WorkspaceId;
  ventureId: VentureId;
  assessmentFingerprint: string;
  reviewerUserId: UserId;
  decision: QualoraReviewDecision;
  rationale: string | null;
};

export type QualoraReviewWrite =
  | { kind: "created"; record: QualoraEvidenceAssessmentReview }
  | { kind: "reused"; record: QualoraEvidenceAssessmentReview }
  | { kind: "conflict" };

export type QualoraEvidenceAssessmentReviewStore = {
  insert(row: QualoraReviewInsert): Promise<QualoraReviewWrite>;
  getByAssessmentId(
    assessmentId: string,
  ): Promise<QualoraEvidenceAssessmentReview | undefined>;
};

export function createQualoraEvidenceAssessmentReviewStore(): QualoraEvidenceAssessmentReviewStore {
  return {
    async insert(row) {
      await ensureSchema();
      const existing = await this.getByAssessmentId(row.assessmentId);
      if (existing) {
        return concludeExisting(existing, row);
      }

      const now = nowIso();
      const record: QualoraEvidenceAssessmentReview = {
        id: createId(),
        assessmentId: row.assessmentId,
        workspaceId: row.workspaceId,
        ventureId: row.ventureId,
        assessmentFingerprint: row.assessmentFingerprint,
        reviewerUserId: row.reviewerUserId,
        decision: row.decision,
        rationale: row.rationale,
        createdAt: now,
        updatedAt: now,
      };

      try {
        await getDb().insert(reviewTable).values({
          id: record.id,
          assessmentId: record.assessmentId,
          workspaceId: record.workspaceId,
          ventureId: record.ventureId,
          assessmentFingerprint: record.assessmentFingerprint,
          reviewerUserId: record.reviewerUserId,
          decision: record.decision,
          rationale: record.rationale,
          createdAt: record.createdAt,
          updatedAt: record.updatedAt,
        });
        return { kind: "created", record };
      } catch (error) {
        if (!isUniqueConstraint(error)) {
          throw error;
        }
        const raced = await this.getByAssessmentId(row.assessmentId);
        if (!raced) {
          throw error;
        }
        return concludeExisting(raced, row);
      }
    },
    async getByAssessmentId(assessmentId) {
      await ensureSchema();
      const [row] = await getDb()
        .select()
        .from(reviewTable)
        .where(eq(reviewTable.assessmentId, assessmentId))
        .limit(1);
      return row ? toRecord(row) : undefined;
    },
  };
}

function concludeExisting(
  existing: QualoraEvidenceAssessmentReview,
  row: QualoraReviewInsert,
): QualoraReviewWrite {
  if (existing.assessmentFingerprint !== row.assessmentFingerprint) {
    return { kind: "conflict" };
  }
  if (existing.decision !== row.decision) {
    return { kind: "conflict" };
  }
  return { kind: "reused", record: existing };
}

function toRecord(
  row: typeof reviewTable.$inferSelect,
): QualoraEvidenceAssessmentReview | undefined {
  if (!isDecision(row.decision)) {
    return undefined;
  }
  return {
    id: row.id,
    assessmentId: row.assessmentId,
    workspaceId: row.workspaceId as WorkspaceId,
    ventureId: row.ventureId as VentureId,
    assessmentFingerprint: row.assessmentFingerprint,
    reviewerUserId: row.reviewerUserId,
    decision: row.decision,
    rationale: row.rationale,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function isDecision(value: string): value is QualoraReviewDecision {
  return (QUALORA_REVIEW_DECISIONS as readonly string[]).includes(value);
}

function isUniqueConstraint(error: unknown) {
  let current: unknown = error;
  for (let depth = 0; depth < 6 && current; depth += 1) {
    const message = current instanceof Error ? current.message : String(current);
    if (/UNIQUE/i.test(message) || /SQLITE_CONSTRAINT/i.test(message)) {
      return true;
    }
    if (typeof current === "object" && current && "cause" in current) {
      current = (current as { cause: unknown }).cause;
      continue;
    }
    break;
  }
  return false;
}
