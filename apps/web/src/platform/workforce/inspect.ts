import { eq } from "drizzle-orm";
import type { WorkforceRunId } from "@/contracts/ids";
import { ensureSchema, getDb } from "@/platform/persistence/db";
import {
  workforceApprovals as approvalTable,
  workforceExecutions as executionTable,
  workforceRuns as runTable,
  workforceVerifications as verificationTable,
} from "@/platform/persistence/schema";

export type WorkforceRunInspection = {
  run: {
    id: string;
    phase: string;
    completionKind: string | null;
    failureCategory: string | null;
    verificationOutcome: string | null;
    definitionVersion: string;
    workspaceId: string;
    ventureId: string;
    agentInstanceId: string;
    capabilityId: string | null;
    executionId: string | null;
  };
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
    run: {
      id: run.id,
      phase: run.phase,
      completionKind: run.completionKind,
      failureCategory: run.failureCategory,
      verificationOutcome: run.verificationOutcome,
      definitionVersion: run.definitionVersion,
      workspaceId: run.workspaceId,
      ventureId: run.ventureId,
      agentInstanceId: run.agentInstanceId,
      capabilityId: run.selectedCapabilityId,
      executionId: run.executionId,
    },
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
