import type { Transaction, Row } from "@libsql/client";
import type { UserId, VentureId, WorkspaceId } from "@/contracts";
import { ensureSchema, getClient } from "@/platform/persistence/db";
import type { AvailabilityMutationResult, EngineerUnavailability } from "./availability";
import { FrigoraError, type SchedulingConflict } from "./errors";
import { withFrigoraWriteTransaction, type FrigoraWriteClientFactory } from "./owned-write";

type Scope = { workspaceId: WorkspaceId; ventureId: VentureId };
type Window = Scope & { userId: UserId; start: string; end: string };

const columns = `id, workspace_id AS workspaceId, venture_id AS ventureId,
  user_id AS userId, unavailable_start_at AS unavailableStartAt,
  unavailable_end_at AS unavailableEndAt, created_by_user_id AS createdByUserId,
  created_at AS createdAt, updated_at AS updatedAt`;

function period(row: Row): EngineerUnavailability {
  return {
    id: String(row.id), workspaceId: String(row.workspaceId) as WorkspaceId,
    ventureId: String(row.ventureId) as VentureId, userId: String(row.userId) as UserId,
    unavailableStartAt: String(row.unavailableStartAt), unavailableEndAt: String(row.unavailableEndAt),
    createdByUserId: String(row.createdByUserId) as UserId,
    createdAt: String(row.createdAt), updatedAt: String(row.updatedAt),
  };
}

/** Caller owns the write transaction. Half-open intervals allow adjacent bookings. */
export async function findScheduledConflicts(tx: Transaction, window: Window, excludeId = ""): Promise<SchedulingConflict[]> {
  const result = await tx.execute({
    sql: `SELECT id, work_reference, scheduled_start_at, scheduled_end_at
      FROM frigora_work_orders WHERE workspace_id = ? AND venture_id = ?
      AND assigned_user_id = ? AND status = 'open' AND id <> ?
      AND scheduled_start_at < ? AND scheduled_end_at > ? ORDER BY scheduled_start_at, id`,
    args: [window.workspaceId, window.ventureId, window.userId, excludeId, window.end, window.start],
  });
  return result.rows.map((row) => ({ id: String(row.id), workReference: String(row.work_reference),
    scheduledStartAt: String(row.scheduled_start_at), scheduledEndAt: String(row.scheduled_end_at) }));
}

export async function assertSchedulingWindow(tx: Transaction, window: Window, workOrderId: string, confirmed: boolean) {
  const unavailable = await tx.execute({
    sql: `SELECT id FROM frigora_engineer_unavailability WHERE workspace_id = ? AND venture_id = ?
      AND user_id = ? AND unavailable_start_at < ? AND unavailable_end_at > ? LIMIT 1`,
    args: [window.workspaceId, window.ventureId, window.userId, window.end, window.start],
  });
  if (unavailable.rows.length) {
    throw new FrigoraError("engineer_unavailable", "The engineer is unavailable for the selected window.");
  }
  // Always recompute, including an explicitly confirmed retry.
  const conflicts = await findScheduledConflicts(tx, window, workOrderId);
  if (conflicts.length && !confirmed) {
    throw new FrigoraError("double_booking", "This window overlaps scheduled work. Confirm double-booking to proceed.", conflicts);
  }
}

export function createAvailabilityStore(createWriteClient?: FrigoraWriteClientFactory) {
  return {
    async listUnavailability(scope: Scope, start: string, end: string): Promise<EngineerUnavailability[]> {
      await ensureSchema();
      const result = await getClient().execute({
        sql: `SELECT ${columns} FROM frigora_engineer_unavailability WHERE workspace_id = ? AND venture_id = ?
          AND unavailable_start_at < ? AND unavailable_end_at > ? ORDER BY unavailable_start_at, id`,
        args: [scope.workspaceId, scope.ventureId, end, start],
      });
      return result.rows.map(period);
    },
    async mutateUnavailability(input: {
      scope: Scope; id: string; expectedUpdatedAt?: string;
      next: EngineerUnavailability | null;
    }): Promise<AvailabilityMutationResult> {
      await ensureSchema();
      return withFrigoraWriteTransaction(async (tx) => {
        const { scope, id, expectedUpdatedAt } = input;
        let next = input.next;
        if (expectedUpdatedAt !== undefined) {
          const current = (await tx.execute({
            sql: `SELECT ${columns} FROM frigora_engineer_unavailability WHERE workspace_id = ? AND venture_id = ? AND id = ?`,
            args: [scope.workspaceId, scope.ventureId, id],
          })).rows[0];
          if (!current || current.updatedAt !== expectedUpdatedAt) {
            throw new FrigoraError("availability_conflict", "This unavailable period changed. Refresh before trying again.");
          }
          if (next) {
            const existing = period(current);
            next = { ...next, createdAt: existing.createdAt, createdByUserId: existing.createdByUserId,
              updatedAt: new Date(Math.max(Date.now(), Date.parse(existing.updatedAt) + 1)).toISOString() };
          }
          const result = next ? await tx.execute({
            sql: `UPDATE frigora_engineer_unavailability SET user_id = ?, unavailable_start_at = ?, unavailable_end_at = ?, updated_at = ?
              WHERE workspace_id = ? AND venture_id = ? AND id = ? AND updated_at = ?`,
            args: [next.userId, next.unavailableStartAt, next.unavailableEndAt, next.updatedAt, scope.workspaceId, scope.ventureId, id, expectedUpdatedAt],
          }) : await tx.execute({
            sql: `DELETE FROM frigora_engineer_unavailability WHERE workspace_id = ? AND venture_id = ? AND id = ? AND updated_at = ?`,
            args: [scope.workspaceId, scope.ventureId, id, expectedUpdatedAt],
          });
          if (result.rowsAffected !== 1) throw new FrigoraError("availability_conflict", "This unavailable period changed. Refresh before trying again.");
        } else {
          if (!next) throw new FrigoraError("invalid_input", "An unavailable period is required.");
          await tx.execute({
            sql: `INSERT INTO frigora_engineer_unavailability
              (id, workspace_id, venture_id, user_id, unavailable_start_at, unavailable_end_at, created_by_user_id, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            args: [id, scope.workspaceId, scope.ventureId, next.userId, next.unavailableStartAt, next.unavailableEndAt,
              next.createdByUserId, next.createdAt, next.updatedAt],
          });
        }
        const affectedWorkOrders = next ? await findScheduledConflicts(tx, { ...scope, userId: next.userId,
          start: next.unavailableStartAt, end: next.unavailableEndAt }) : [];
        return { period: next, affectedWorkOrders };
      }, createWriteClient);
    },
  };
}
