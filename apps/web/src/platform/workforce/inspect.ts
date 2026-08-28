import { and, desc, eq } from "drizzle-orm";
import type { VentureId, WorkspaceId } from "@/contracts";
import type { WorkforceRunId } from "@/contracts/ids";
import { ensureSchema, getDb } from "@/platform/persistence/db";
import {
  workforceApprovals as approvalTable,
  workforceExecutions as executionTable,
  workforceRuns as runTable,
  workforceVerifications as verificationTable,
} from "@/platform/persistence/schema";

export type WorkforceRunOperatorFields = {
  id: string;
  phase: string;
  completionKind: string | null;
  failureCategory: string | null;
  verificationOutcome: string | null;
  definitionId: string;
  definitionVersion: string;
  workspaceId: string;
  ventureId: string;
  agentInstanceId: string;
  capabilityId: string | null;
  executionId: string | null;
  requestedByUserId: string;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
};

export type WorkforceRunListItem = WorkforceRunOperatorFields;

export type WorkforceRunInspection = {
  run: WorkforceRunOperatorFields;
  approval?: {
    status: string;
    decidedByUserId: string | null;
  };
  execution?: {
    id: string;
    status: string;
    implementationId: string | null;
    implementationVersion: string | null;
    externalReference: string | null;
    errorCategory: string | null;
  };
  verification?: {
    status: string;
    failureCategory: string | null;
    implementationId: string | null;
    implementationVersion: string | null;
    predicateId: string;
    provenance: string | null;
  };
};

export async function inspectWorkforceRun(
  runId: WorkforceRunId,
): Promise<WorkforceRunInspection | undefined> {
  await ensureSchema();
  const db = getDb();
  const [run] = await db.select().from(runTable).where(eq(runTable.id, runId)).limit(1);
  if (!run) {
    return undefined;
  }

  const [approval] = await db
    .select()
    .from(approvalTable)
    .where(eq(approvalTable.runId, runId))
    .limit(1);
  const [verification] = await db
    .select()
    .from(verificationTable)
    .where(eq(verificationTable.runId, runId))
    .limit(1);
  const [execution] = run.executionId
    ? await db
        .select()
        .from(executionTable)
        .where(eq(executionTable.id, run.executionId))
        .limit(1)
    : [];

  return {
    run: toOperatorFields(run),
    ...(approval
      ? {
          approval: {
            status: approval.status,
            decidedByUserId: approval.decidedByUserId,
          },
        }
      : {}),
    ...(execution
      ? {
          execution: {
            id: execution.id,
            status: execution.status,
            implementationId: execution.implementationId,
            implementationVersion: execution.implementationVersion,
            externalReference: execution.externalReference,
            errorCategory: execution.errorCategory,
          },
        }
      : {}),
    ...(verification
      ? {
          verification: {
            status: verification.status,
            failureCategory: verification.failureCategory,
            implementationId: verification.implementationId,
            implementationVersion: verification.implementationVersion,
            predicateId: verification.predicateId,
            provenance: verification.provenance,
          },
        }
      : {}),
  };
}

/**
 * Session application code must still authorise before calling this.
 * Selects only operator-safe columns; never evidence, citations, or model JSON.
 */
export async function listWorkforceRunSummaries(input: {
  workspaceId: WorkspaceId;
  ventureId: VentureId;
}): Promise<WorkforceRunListItem[]> {
  await ensureSchema();
  const rows = await getDb()
    .select({
      id: runTable.id,
      phase: runTable.phase,
      completionKind: runTable.completionKind,
      failureCategory: runTable.failureCategory,
      verificationOutcome: runTable.verificationOutcome,
      definitionId: runTable.definitionId,
      definitionVersion: runTable.definitionVersion,
      workspaceId: runTable.workspaceId,
      ventureId: runTable.ventureId,
      agentInstanceId: runTable.agentInstanceId,
      capabilityId: runTable.selectedCapabilityId,
      executionId: runTable.executionId,
      requestedByUserId: runTable.requestedByUserId,
      createdAt: runTable.createdAt,
      updatedAt: runTable.updatedAt,
      completedAt: runTable.completedAt,
    })
    .from(runTable)
    .where(
      and(
        eq(runTable.workspaceId, input.workspaceId),
        eq(runTable.ventureId, input.ventureId),
      ),
    )
    .orderBy(desc(runTable.createdAt));
  return rows;
}

function toOperatorFields(
  run: typeof runTable.$inferSelect,
): WorkforceRunOperatorFields {
  return {
    id: run.id,
    phase: run.phase,
    completionKind: run.completionKind,
    failureCategory: run.failureCategory,
    verificationOutcome: run.verificationOutcome,
    definitionId: run.definitionId,
    definitionVersion: run.definitionVersion,
    workspaceId: run.workspaceId,
    ventureId: run.ventureId,
    agentInstanceId: run.agentInstanceId,
    capabilityId: run.selectedCapabilityId,
    executionId: run.executionId,
    requestedByUserId: run.requestedByUserId,
    createdAt: run.createdAt,
    updatedAt: run.updatedAt,
    completedAt: run.completedAt,
  };
}
