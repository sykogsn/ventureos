import { and, eq } from "drizzle-orm";
import type { AgentInstanceId, WorkforceRunId } from "@/contracts/ids";
import type { VentureId, WorkspaceId } from "@/contracts";
import { createId, nowIso } from "@/platform/ids";
import { ensureSchema, getDb } from "@/platform/persistence/db";
import { qualoraEvidenceAssessments as assessmentTable } from "@/platform/persistence/schema";
import {
  QUALORA_ASSESSMENT_PROVENANCE_AI_GENERATED,
  QUALORA_ASSESSMENT_STATUS_PROPOSED,
  QUALORA_EVIDENCE_ASSESSMENT_BINDING_ID,
  QUALORA_EVIDENCE_ASSESSMENT_IMPLEMENTATION_VERSION,
  QUALORA_GAP_KINDS,
  type QualoraEvidenceAssessment,
  type QualoraGapKind,
} from "./types";

export type QualoraEvidenceAssessmentInsert = {
  workspaceId: WorkspaceId;
  ventureId: VentureId;
  requirementId: string;
  sourceRunId: WorkforceRunId;
  sourceAgentInstanceId: AgentInstanceId;
  executionIdempotencyKey: string;
  gapKind: QualoraGapKind;
  summary: string;
  citedEvidenceIds: string[];
};

export type QualoraEvidenceAssessmentWrite =
  | { kind: "created"; record: QualoraEvidenceAssessment }
  | { kind: "reused"; record: QualoraEvidenceAssessment }
  | { kind: "conflict" };

export type QualoraEvidenceAssessmentStore = {
  insert(row: QualoraEvidenceAssessmentInsert): Promise<QualoraEvidenceAssessmentWrite>;
  getByIdempotencyKey(
    key: string,
  ): Promise<QualoraEvidenceAssessment | undefined>;
  getBySourceRun(input: {
    workspaceId: WorkspaceId;
    ventureId: VentureId;
    sourceRunId: string;
  }): Promise<QualoraEvidenceAssessment | undefined>;
  listByVenture(input: {
    workspaceId: WorkspaceId;
    ventureId: VentureId;
  }): Promise<QualoraEvidenceAssessment[]>;
};

export function createQualoraEvidenceAssessmentStore(): QualoraEvidenceAssessmentStore {
  return {
    async insert(row) {
      await ensureSchema();
      const now = nowIso();
      const record: QualoraEvidenceAssessment = {
        id: createId(),
        workspaceId: row.workspaceId,
        ventureId: row.ventureId,
        requirementId: row.requirementId,
        sourceRunId: row.sourceRunId,
        sourceAgentInstanceId: row.sourceAgentInstanceId,
        executionIdempotencyKey: row.executionIdempotencyKey,
        gapKind: row.gapKind,
        summary: row.summary,
        citedEvidenceIds: [...row.citedEvidenceIds],
        status: QUALORA_ASSESSMENT_STATUS_PROPOSED,
        provenance: QUALORA_ASSESSMENT_PROVENANCE_AI_GENERATED,
        implementationId: QUALORA_EVIDENCE_ASSESSMENT_BINDING_ID,
        implementationVersion: QUALORA_EVIDENCE_ASSESSMENT_IMPLEMENTATION_VERSION,
        createdAt: now,
        updatedAt: now,
      };

      try {
        await getDb().insert(assessmentTable).values({
          id: record.id,
          workspaceId: record.workspaceId,
          ventureId: record.ventureId,
          requirementId: record.requirementId,
          sourceRunId: record.sourceRunId,
          sourceAgentInstanceId: record.sourceAgentInstanceId,
          executionIdempotencyKey: record.executionIdempotencyKey,
          gapKind: record.gapKind,
          summary: record.summary,
          citedEvidenceIdsJson: JSON.stringify(record.citedEvidenceIds),
          status: record.status,
          provenance: record.provenance,
          implementationId: record.implementationId,
          implementationVersion: record.implementationVersion,
          createdAt: record.createdAt,
          updatedAt: record.updatedAt,
        });
        return { kind: "created", record };
      } catch (error) {
        if (!isUniqueConstraint(error)) {
          throw error;
        }
        const existing =
          (await this.getByIdempotencyKey(row.executionIdempotencyKey)) ??
          (await this.getBySourceRun({
            workspaceId: row.workspaceId,
            ventureId: row.ventureId,
            sourceRunId: row.sourceRunId,
          }));
        if (existing && sameWrite(existing, row)) {
          return { kind: "reused", record: existing };
        }
        return { kind: "conflict" };
      }
    },
    async getByIdempotencyKey(key) {
      await ensureSchema();
      const [row] = await getDb()
        .select()
        .from(assessmentTable)
        .where(eq(assessmentTable.executionIdempotencyKey, key))
        .limit(1);
      return row ? toRecord(row) : undefined;
    },
    async getBySourceRun(input) {
      await ensureSchema();
      const [row] = await getDb()
        .select()
        .from(assessmentTable)
        .where(
          and(
            eq(assessmentTable.workspaceId, input.workspaceId),
            eq(assessmentTable.ventureId, input.ventureId),
            eq(assessmentTable.sourceRunId, input.sourceRunId),
          ),
        )
        .limit(1);
      return row ? toRecord(row) : undefined;
    },
    async listByVenture(input) {
      await ensureSchema();
      const rows = await getDb()
        .select()
        .from(assessmentTable)
        .where(
          and(
            eq(assessmentTable.workspaceId, input.workspaceId),
            eq(assessmentTable.ventureId, input.ventureId),
          ),
        );
      return rows
        .map(toRecord)
        .filter((row): row is QualoraEvidenceAssessment => Boolean(row));
    },
  };
}

function toRecord(
  row: typeof assessmentTable.$inferSelect,
): QualoraEvidenceAssessment | undefined {
  if (
    row.status !== QUALORA_ASSESSMENT_STATUS_PROPOSED ||
    row.provenance !== QUALORA_ASSESSMENT_PROVENANCE_AI_GENERATED
  ) {
    return undefined;
  }
  if (!isGapKind(row.gapKind)) {
    return undefined;
  }
  return {
    id: row.id,
    workspaceId: row.workspaceId as WorkspaceId,
    ventureId: row.ventureId as VentureId,
    requirementId: row.requirementId,
    sourceRunId: row.sourceRunId as WorkforceRunId,
    sourceAgentInstanceId: row.sourceAgentInstanceId as AgentInstanceId,
    executionIdempotencyKey: row.executionIdempotencyKey,
    gapKind: row.gapKind,
    summary: row.summary,
    citedEvidenceIds: parseIds(row.citedEvidenceIdsJson),
    status: QUALORA_ASSESSMENT_STATUS_PROPOSED,
    provenance: QUALORA_ASSESSMENT_PROVENANCE_AI_GENERATED,
    implementationId: row.implementationId,
    implementationVersion: row.implementationVersion,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function sameWrite(
  existing: QualoraEvidenceAssessment,
  row: QualoraEvidenceAssessmentInsert,
) {
  return (
    existing.workspaceId === row.workspaceId &&
    existing.ventureId === row.ventureId &&
    existing.requirementId === row.requirementId &&
    existing.sourceRunId === row.sourceRunId &&
    existing.executionIdempotencyKey === row.executionIdempotencyKey &&
    existing.gapKind === row.gapKind &&
    existing.summary === row.summary &&
    existing.citedEvidenceIds.join(",") === row.citedEvidenceIds.join(",")
  );
}

function parseIds(raw: string): string[] {
  try {
    const value: unknown = JSON.parse(raw);
    if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
      return [];
    }
    return value;
  } catch {
    return [];
  }
}

function isGapKind(value: string): value is QualoraGapKind {
  return (QUALORA_GAP_KINDS as readonly string[]).includes(value);
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
