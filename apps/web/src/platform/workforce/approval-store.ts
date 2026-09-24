import { eq } from "drizzle-orm";
import type { UserId, VentureId, WorkspaceId } from "@/contracts";
import type { AgentInstanceId, WorkforceRunId } from "@/contracts/ids";
import type { WorkforceApprovalSatisfactionPort } from "@/core/workforce/execution";
import type {
  WorkforceApprovalRecord,
  WorkforceApprovalStore,
} from "@/core/workforce/run";
import type { ApprovalStatus } from "@/core/workforce/types";
import { createId, nowIso } from "@/platform/ids";
import { ensureSchema, getClient, getDb } from "@/platform/persistence/db";
import { workforceApprovals as approvalTable } from "@/platform/persistence/schema";

export const WORKFORCE_APPROVAL_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export type {
  WorkforceApprovalInsert,
  WorkforceApprovalRecord,
  WorkforceApprovalStore,
} from "@/core/workforce/run";

export function createWorkforceApprovalStore(): WorkforceApprovalStore {
  return {
    async insertPending(row, ttlMs = WORKFORCE_APPROVAL_TTL_MS) {
      await ensureSchema();
      const now = nowIso();
      const record: WorkforceApprovalRecord = {
        ...row,
        id: createId(),
        status: "PENDING",
        requestedAt: now,
        expiresAt: new Date(Date.parse(now) + ttlMs).toISOString(),
        decidedAt: null,
        decidedByUserId: null,
      };
      await getDb().insert(approvalTable).values({
        id: record.id,
        runId: record.runId,
        workspaceId: record.workspaceId,
        ventureId: record.ventureId,
        agentInstanceId: record.agentInstanceId,
        capabilityId: record.capabilityId,
        sourceRequestId: record.sourceRequestId,
        sourceActionIndex: record.sourceActionIndex,
        argumentHash: record.argumentHash,
        fingerprintHash: record.fingerprintHash,
        status: record.status,
        requestedAt: record.requestedAt,
        expiresAt: record.expiresAt,
        decidedAt: null,
        decidedByUserId: null,
      });
      return record;
    },
    async get(id) {
      await ensureSchema();
      return loadById(id);
    },
    async getByRunId(runId) {
      await ensureSchema();
      const [row] = await getDb()
        .select()
        .from(approvalTable)
        .where(eq(approvalTable.runId, runId))
        .limit(1);
      return row ? toRecord(row) : undefined;
    },
    async decide(id, status, decidedByUserId) {
      await ensureSchema();
      const now = nowIso();
      await expireIfDueRow(id, now);
      const result = await getClient().execute({
        sql: `UPDATE workforce_approvals SET status = ?, decided_at = ?, decided_by_user_id = ? WHERE id = ? AND status = ? AND expires_at >= ?`,
        args: [status, now, decidedByUserId, id, "PENDING", now],
      });
      if (result.rowsAffected !== 1) {
        return undefined;
      }
      return loadById(id);
    },
    async expireIfDue(id) {
      await ensureSchema();
      return expireIfDueRow(id, nowIso());
    },
  };
}

export function createWorkforceApprovalSatisfactionPort(
  store: WorkforceApprovalStore,
): WorkforceApprovalSatisfactionPort {
  return {
    async satisfy(input) {
      const approval = await store.getByRunId(input.sourceRequestId as WorkforceRunId);
      if (!approval) {
        return { approved: false, fingerprintHash: input.fingerprintHash };
      }
      const current = (await store.expireIfDue(approval.id)) ?? approval;
      if (current.status !== "APPROVED") {
        return { approved: false, fingerprintHash: input.fingerprintHash };
      }
      if (
        current.workspaceId !== input.workspaceId ||
        current.ventureId !== input.ventureId ||
        current.agentInstanceId !== input.agentInstanceId ||
        current.capabilityId !== input.capabilityId ||
        current.sourceRequestId !== input.sourceRequestId ||
        current.sourceActionIndex !== input.sourceActionIndex ||
        current.fingerprintHash !== input.fingerprintHash
      ) {
        return { approved: false, fingerprintHash: input.fingerprintHash };
      }
      return { approved: true, fingerprintHash: current.fingerprintHash };
    },
  };
}

async function expireIfDueRow(id: string, now: string) {
  await getClient().execute({
    sql: `UPDATE workforce_approvals SET status = ?, decided_at = ? WHERE id = ? AND status = ? AND expires_at < ?`,
    args: ["EXPIRED", now, id, "PENDING", now],
  });
  return loadById(id);
}

async function loadById(id: string) {
  const [row] = await getDb()
    .select()
    .from(approvalTable)
    .where(eq(approvalTable.id, id))
    .limit(1);
  return row ? toRecord(row) : undefined;
}

function toRecord(row: typeof approvalTable.$inferSelect): WorkforceApprovalRecord {
  return {
    id: row.id,
    runId: row.runId as WorkforceRunId,
    workspaceId: row.workspaceId as WorkspaceId,
    ventureId: row.ventureId as VentureId,
    agentInstanceId: row.agentInstanceId as AgentInstanceId,
    capabilityId: row.capabilityId,
    sourceRequestId: row.sourceRequestId,
    sourceActionIndex: Number(row.sourceActionIndex),
    argumentHash: row.argumentHash,
    fingerprintHash: row.fingerprintHash,
    status: row.status as ApprovalStatus,
    requestedAt: row.requestedAt,
    expiresAt: row.expiresAt,
    decidedAt: row.decidedAt,
    decidedByUserId: (row.decidedByUserId as UserId | null) ?? null,
  };
}
