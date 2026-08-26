import { eq } from "drizzle-orm";
import type { VentureId, WorkspaceId } from "@/contracts";
import type { AgentInstanceId, WorkforceRunId } from "@/contracts/ids";
import type {
  ExecutionArguments,
  VerificationFailure,
  VerificationObservation,
  VerificationProvenance,
  VerificationStatus,
} from "@/core/workforce/types";
import type {
  WorkforceVerificationRecord,
  WorkforceVerificationStore,
} from "@/core/workforce/verification";
import { createId, nowIso } from "@/platform/ids";
import { ensureSchema, getClient, getDb } from "@/platform/persistence/db";
import { workforceVerifications as verificationTable } from "@/platform/persistence/schema";

export type {
  WorkforceVerificationInsert,
  WorkforceVerificationRecord,
  WorkforceVerificationStore,
} from "@/core/workforce/verification";
import { isTerminalVerificationStatus } from "@/core/workforce/verification";

export { isTerminalVerificationStatus };

export function createWorkforceVerificationStore(): WorkforceVerificationStore {
  return {
    async insertPending(row) {
      await ensureSchema();
      const existing = await loadByRunId(row.runId);
      if (existing) {
        return existing;
      }
      const now = nowIso();
      const record: WorkforceVerificationRecord = {
        id: createId(),
        runId: row.runId,
        executionId: row.executionId,
        workspaceId: row.workspaceId,
        ventureId: row.ventureId,
        agentInstanceId: row.agentInstanceId,
        capabilityId: row.capabilityId,
        sourceRequestId: row.sourceRequestId,
        sourceActionIndex: row.sourceActionIndex,
        predicateId: row.predicate.id,
        predicateVersion: row.predicate.version,
        predicateFingerprint: row.predicate.fingerprint,
        expected: row.predicate.expected,
        status: "pending",
        failureCategory: null,
        attemptCount: 0,
        observation: null,
        evidenceJson: null,
        provenance: null,
        claimNonce: null,
        implementationId: row.implementationId ?? null,
        implementationVersion: row.implementationVersion ?? null,
        createdAt: now,
        updatedAt: now,
        completedAt: null,
      };
      try {
        await getDb().insert(verificationTable).values({
          id: record.id,
          runId: record.runId,
          executionId: record.executionId,
          workspaceId: record.workspaceId,
          ventureId: record.ventureId,
          agentInstanceId: record.agentInstanceId,
          capabilityId: record.capabilityId,
          sourceRequestId: record.sourceRequestId,
          sourceActionIndex: record.sourceActionIndex,
          predicateId: record.predicateId,
          predicateVersion: record.predicateVersion,
          predicateFingerprint: record.predicateFingerprint,
          expectedJson: JSON.stringify(record.expected),
          status: record.status,
          failureCategory: null,
          attemptCount: 0,
          observationJson: null,
          evidenceJson: null,
          provenance: null,
          claimNonce: null,
          implementationId: row.implementationId ?? null,
          implementationVersion: row.implementationVersion ?? null,
          createdAt: now,
          updatedAt: now,
          completedAt: null,
        });
      } catch {
        const raced = await loadByRunId(row.runId);
        if (raced) {
          return raced;
        }
        throw new Error("Workforce verification insert failed.");
      }
      const stored = await loadById(record.id);
      if (!stored) {
        throw new Error("Workforce verification missing after insert.");
      }
      return stored;
    },
    async get(id) {
      await ensureSchema();
      return loadById(id);
    },
    async getByRunId(runId) {
      await ensureSchema();
      return loadByRunId(runId);
    },
    async claimObserving(id) {
      await ensureSchema();
      const now = nowIso();
      const nonce = createId();
      const result = await getClient().execute({
        sql: `UPDATE workforce_verifications SET status = ?, attempt_count = attempt_count + 1, claim_nonce = ?, updated_at = ? WHERE id = ? AND status = ?`,
        args: ["observing", nonce, now, id, "pending"],
      });
      if (result.rowsAffected !== 1) {
        return undefined;
      }
      return loadById(id);
    },
    async adoptObserving(id) {
      await ensureSchema();
      const now = nowIso();
      const nonce = createId();
      const result = await getClient().execute({
        sql: `UPDATE workforce_verifications SET claim_nonce = ?, updated_at = ? WHERE id = ? AND status = ? AND observation_json IS NULL AND claim_nonce IS NULL`,
        args: [nonce, now, id, "observing"],
      });
      if (result.rowsAffected !== 1) {
        return undefined;
      }
      return loadById(id);
    },
    async releaseStaleObserving(id) {
      await ensureSchema();
      const now = nowIso();
      const result = await getClient().execute({
        sql: `UPDATE workforce_verifications SET claim_nonce = NULL, updated_at = ? WHERE id = ? AND status = ? AND observation_json IS NULL`,
        args: [now, id, "observing"],
      });
      if (result.rowsAffected !== 1) {
        return undefined;
      }
      return loadById(id);
    },
    async persistObservation(id, observation) {
      await ensureSchema();
      const now = nowIso();
      const result = await getClient().execute({
        sql: `UPDATE workforce_verifications SET observation_json = ?, updated_at = ? WHERE id = ? AND status = ?`,
        args: [JSON.stringify(observation), now, id, "observing"],
      });
      if (result.rowsAffected !== 1) {
        return undefined;
      }
      return loadById(id);
    },
    async releasePending(id) {
      await ensureSchema();
      const now = nowIso();
      const result = await getClient().execute({
        sql: `UPDATE workforce_verifications SET status = ?, observation_json = NULL, claim_nonce = NULL, updated_at = ? WHERE id = ? AND status = ?`,
        args: ["pending", now, id, "observing"],
      });
      if (result.rowsAffected !== 1) {
        return undefined;
      }
      return loadById(id);
    },
    async complete(id, outcome, evidenceJson, provenance) {
      await ensureSchema();
      const now = nowIso();
      const status = outcome === "VERIFIED" ? "verified" : "not_verified";
      const result = await getClient().execute({
        sql: `UPDATE workforce_verifications SET status = ?, evidence_json = ?, provenance = ?, completed_at = ?, updated_at = ? WHERE id = ? AND status = ?`,
        args: [status, evidenceJson, provenance, now, now, id, "observing"],
      });
      if (result.rowsAffected !== 1) {
        return undefined;
      }
      return loadById(id);
    },
    async fail(id, failure) {
      await ensureSchema();
      const now = nowIso();
      const result = await getClient().execute({
        sql: `UPDATE workforce_verifications SET status = ?, failure_category = ?, completed_at = ?, updated_at = ? WHERE id = ? AND status IN (?, ?)`,
        args: ["failed", failure, now, now, id, "pending", "observing"],
      });
      if (result.rowsAffected !== 1) {
        return undefined;
      }
      return loadById(id);
    },
  };
}

async function loadById(id: string) {
  const [row] = await getDb()
    .select()
    .from(verificationTable)
    .where(eq(verificationTable.id, id))
    .limit(1);
  return row ? toRecord(row) : undefined;
}

async function loadByRunId(runId: string) {
  const [row] = await getDb()
    .select()
    .from(verificationTable)
    .where(eq(verificationTable.runId, runId))
    .limit(1);
  return row ? toRecord(row) : undefined;
}

function toRecord(
  row: typeof verificationTable.$inferSelect,
): WorkforceVerificationRecord {
  return {
    id: row.id,
    runId: row.runId as WorkforceRunId,
    executionId: row.executionId,
    workspaceId: row.workspaceId as WorkspaceId,
    ventureId: row.ventureId as VentureId,
    agentInstanceId: row.agentInstanceId as AgentInstanceId,
    capabilityId: row.capabilityId,
    sourceRequestId: row.sourceRequestId,
    sourceActionIndex: Number(row.sourceActionIndex),
    predicateId: row.predicateId,
    predicateVersion: row.predicateVersion,
    predicateFingerprint: row.predicateFingerprint,
    expected: parseExpected(row.expectedJson),
    status: row.status as VerificationStatus,
    failureCategory: (row.failureCategory as VerificationFailure | null) ?? null,
    attemptCount: Number(row.attemptCount),
    observation: parseObservation(row.observationJson),
    evidenceJson: row.evidenceJson,
    provenance: (row.provenance as VerificationProvenance | null) ?? null,
    claimNonce: row.claimNonce,
    implementationId: row.implementationId,
    implementationVersion: row.implementationVersion,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    completedAt: row.completedAt,
  };
}

function parseExpected(raw: string): ExecutionArguments {
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return {};
    }
    const args: ExecutionArguments = {};
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      if (
        typeof entry === "string" ||
        typeof entry === "number" ||
        typeof entry === "boolean" ||
        entry === null
      ) {
        args[key] = entry;
      }
    }
    return args;
  } catch {
    return {};
  }
}

function parseObservation(raw: string | null): VerificationObservation | null {
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
      record.status !== "observed" &&
      record.status !== "missing" &&
      record.status !== "unavailable" &&
      record.status !== "timeout" &&
      record.status !== "invalid"
    ) {
      return null;
    }
    if (typeof record.observedAt !== "string") {
      return null;
    }
    return {
      status: record.status,
      observedAt: record.observedAt,
      values:
        record.values && typeof record.values === "object" && !Array.isArray(record.values)
          ? parseExpected(JSON.stringify(record.values))
          : undefined,
    };
  } catch {
    return null;
  }
}
