import { and, eq } from "drizzle-orm";
import type { JobId, UserId, VentureId, WorkspaceId } from "@/contracts";
import type {
  AgentDefinitionId,
  AgentInstanceId,
  WorkforceRunId,
} from "@/contracts/ids";
import type {
  ProposedAction,
  WorkforceRunCompletionKind,
  WorkforceRunFailure,
  WorkforceRunPhase,
} from "@/core/workforce/types";
import type {
  WorkforceRunRecord,
  WorkforceRunStore,
} from "@/core/workforce/run";
import { nowIso } from "@/platform/ids";
import { ensureSchema, getClient, getDb } from "@/platform/persistence/db";
import {
  workforceExecutions as executionTable,
  workforceRuns as runTable,
} from "@/platform/persistence/schema";

export type {
  WorkforceRunInsert,
  WorkforceRunPatch,
  WorkforceRunRecord,
  WorkforceRunStore,
} from "@/core/workforce/run";

export function createWorkforceRunStore(): WorkforceRunStore {
  let recovery: Promise<void> | undefined;

  async function ready() {
    await ensureSchema();
    if (!recovery) {
      recovery = recoverActiveRuns();
    }
    await recovery;
  }

  return {
    async recoverInterrupted() {
      await ready();
      return 0;
    },
    async insert(row) {
      await ready();
      const now = nowIso();
      await getDb().insert(runTable).values({
        id: row.id,
        jobId: row.jobId ?? null,
        workspaceId: row.workspaceId,
        ventureId: row.ventureId,
        agentInstanceId: row.agentInstanceId,
        definitionId: row.definitionId,
        definitionVersion: row.definitionVersion,
        objective: row.objective,
        phase: "queued",
        completionKind: null,
        failureCategory: null,
        sourceRequestId: row.sourceRequestId,
        selectedCapabilityId: null,
        selectedActionIndex: null,
        selectedActionJson: null,
        argumentHash: null,
        fingerprintHash: null,
        executionId: null,
        approvalId: null,
        modelCallCount: row.modelCallCount,
        requestedByUserId: row.requestedByUserId,
        createdAt: now,
        updatedAt: now,
        completedAt: null,
      });
      const stored = await loadById(row.id);
      if (!stored) {
        throw new Error("Workforce run missing after insert.");
      }
      return stored;
    },
    async get(id) {
      await ready();
      return loadById(id);
    },
    async claimPhase(id, from, to) {
      await ready();
      const now = nowIso();
      const result = await getClient().execute({
        sql: `UPDATE workforce_runs SET phase = ?, updated_at = ? WHERE id = ? AND phase = ?`,
        args: [to, now, id, from],
      });
      if (result.rowsAffected !== 1) {
        return undefined;
      }
      return loadById(id);
    },
    async claimModelCall(id) {
      await ready();
      const now = nowIso();
      const result = await getClient().execute({
        sql: `UPDATE workforce_runs SET model_call_count = model_call_count + 1, updated_at = ? WHERE id = ? AND model_call_count = 0`,
        args: [now, id],
      });
      return result.rowsAffected === 1;
    },
    async patch(id, patch) {
      await ready();
      await getDb()
        .update(runTable)
        .set({
          ...(patch.jobId !== undefined ? { jobId: patch.jobId } : {}),
          ...(patch.phase !== undefined ? { phase: patch.phase } : {}),
          ...(patch.completionKind !== undefined
            ? { completionKind: patch.completionKind }
            : {}),
          ...(patch.failureCategory !== undefined
            ? { failureCategory: patch.failureCategory }
            : {}),
          ...(patch.selectedCapabilityId !== undefined
            ? { selectedCapabilityId: patch.selectedCapabilityId }
            : {}),
          ...(patch.selectedActionIndex !== undefined
            ? { selectedActionIndex: patch.selectedActionIndex }
            : {}),
          ...(patch.selectedAction !== undefined
            ? { selectedActionJson: JSON.stringify(patch.selectedAction) }
            : {}),
          ...(patch.argumentHash !== undefined
            ? { argumentHash: patch.argumentHash }
            : {}),
          ...(patch.fingerprintHash !== undefined
            ? { fingerprintHash: patch.fingerprintHash }
            : {}),
          ...(patch.executionId !== undefined
            ? { executionId: patch.executionId }
            : {}),
          ...(patch.approvalId !== undefined ? { approvalId: patch.approvalId } : {}),
          ...(patch.modelCallCount !== undefined
            ? { modelCallCount: patch.modelCallCount }
            : {}),
          ...(patch.completedAt !== undefined
            ? { completedAt: patch.completedAt }
            : {}),
          updatedAt: nowIso(),
        })
        .where(eq(runTable.id, id));
    },
  };
}

async function recoverActiveRuns() {
  const now = nowIso();
  await getDb()
    .update(runTable)
    .set({
      phase: "failed",
      failureCategory: "INTERRUPTED",
      completedAt: now,
      updatedAt: now,
    })
    .where(eq(runTable.phase, "reasoning"));

  const executing = await getDb()
    .select()
    .from(runTable)
    .where(eq(runTable.phase, "executing"));

  for (const row of executing) {
    const [execution] = await getDb()
      .select()
      .from(executionTable)
      .where(eq(executionTable.sourceRequestId, row.sourceRequestId))
      .limit(1);
    if (execution?.status === "succeeded") {
      await getDb()
        .update(runTable)
        .set({
          phase: "completed",
          completionKind: "executed",
          executionId: execution.id,
          completedAt: execution.completedAt ?? now,
          updatedAt: now,
        })
        .where(and(eq(runTable.id, row.id), eq(runTable.phase, "executing")));
      continue;
    }
    await getDb()
      .update(runTable)
      .set({
        phase: "failed",
        failureCategory: "INTERRUPTED",
        executionId: execution?.id ?? row.executionId,
        completedAt: now,
        updatedAt: now,
      })
      .where(and(eq(runTable.id, row.id), eq(runTable.phase, "executing")));
  }
}

async function loadById(id: string) {
  const [row] = await getDb()
    .select()
    .from(runTable)
    .where(eq(runTable.id, id))
    .limit(1);
  return row ? toRecord(row) : undefined;
}

function toRecord(row: typeof runTable.$inferSelect): WorkforceRunRecord {
  return {
    id: row.id as WorkforceRunId,
    jobId: (row.jobId as JobId | null) ?? null,
    workspaceId: row.workspaceId as WorkspaceId,
    ventureId: row.ventureId as VentureId,
    agentInstanceId: row.agentInstanceId as AgentInstanceId,
    definitionId: row.definitionId as AgentDefinitionId,
    definitionVersion: row.definitionVersion,
    objective: row.objective,
    phase: row.phase as WorkforceRunPhase,
    completionKind: (row.completionKind as WorkforceRunCompletionKind | null) ?? null,
    failureCategory: (row.failureCategory as WorkforceRunFailure | null) ?? null,
    sourceRequestId: row.sourceRequestId,
    selectedCapabilityId: row.selectedCapabilityId,
    selectedActionIndex:
      row.selectedActionIndex === null ? null : Number(row.selectedActionIndex),
    selectedAction: parseAction(row.selectedActionJson),
    argumentHash: row.argumentHash,
    fingerprintHash: row.fingerprintHash,
    executionId: row.executionId,
    approvalId: row.approvalId,
    modelCallCount: Number(row.modelCallCount),
    requestedByUserId: row.requestedByUserId as UserId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    completedAt: row.completedAt,
  };
}

function parseAction(raw: string | null): ProposedAction | null {
  if (!raw) {
    return null;
  }
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return null;
    }
    const record = value as Record<string, unknown>;
    if (
      typeof record.capabilityId !== "string" ||
      typeof record.intent !== "string" ||
      typeof record.rationale !== "string" ||
      !record.arguments ||
      typeof record.arguments !== "object" ||
      Array.isArray(record.arguments) ||
      !Array.isArray(record.evidenceIds)
    ) {
      return null;
    }
    return {
      capabilityId: record.capabilityId,
      intent: record.intent,
      rationale: record.rationale,
      arguments: record.arguments as ProposedAction["arguments"],
      evidenceIds: record.evidenceIds.filter(
        (item): item is string => typeof item === "string",
      ),
    };
  } catch {
    return null;
  }
}