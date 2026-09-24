import { asc } from "drizzle-orm";
import { setTimeout as delay } from "node:timers/promises";
import type { Actor, UserId, VentureId, WorkspaceId } from "@/contracts";
import type { AgentInstanceId } from "@/contracts/ids";
import type { WorkforceActor } from "@/core/workforce/types";
import { isAgentActor, isHumanActor, isSystemActor } from "@/core/workforce/actor";
import { createId, nowIso } from "@/platform/ids";
import { ensureSchema, getDb } from "@/platform/persistence/db";
import {
  executeDurability,
  isSqliteConstraint,
  SQLITE_CONTENTION_BUDGET_MS,
  SQLITE_DURABILITY_RETRY_DELAY_MS,
  withDurabilityClient,
} from "@/platform/persistence/durability-client";
import { auditEvents } from "@/platform/persistence/schema";

export type AuditActor = Actor | WorkforceActor;

export type AuditRecord = {
  id: string;
  action: string;
  occurredAt: string;
  actor?: WorkforceActor;
  metadata?: Record<string, string>;
};

export type AuditLog = {
  record(entry: {
    action: string;
    actor?: AuditActor;
    metadata?: Record<string, string>;
  }): Promise<AuditRecord>;
  list(): Promise<AuditRecord[]>;
};

export function createAuditLog(): AuditLog {
  return {
    async record(entry) {
      const actor = normalizeActor(entry.actor);
      const record: AuditRecord = {
        action: entry.action,
        metadata: entry.metadata,
        actor,
        id: createId(),
        occurredAt: nowIso(),
      };

      try {
        await ensureSchema();
        if (record.action === "stored_object.created") {
          await persistStoredObjectCreationAudit({
            id: record.id,
            action: record.action,
            occurredAt: record.occurredAt,
            actorUserId: humanUserId(actor),
            actorKind: actor?.kind ?? null,
            actorAgentInstanceId: agentInstanceId(actor),
            actorComponent: systemComponent(actor),
            workspaceId: scopeValue(record, "workspaceId"),
            ventureId: scopeValue(record, "ventureId"),
            metadataJson: JSON.stringify(record.metadata ?? {}),
          });
        } else {
          await getDb().insert(auditEvents).values({
            id: record.id,
            action: record.action,
            occurredAt: record.occurredAt,
            actorUserId: humanUserId(actor),
            actorKind: actor?.kind ?? null,
            actorAgentInstanceId: agentInstanceId(actor),
            actorComponent: systemComponent(actor),
            workspaceId: scopeValue(record, "workspaceId"),
            ventureId: scopeValue(record, "ventureId"),
            metadataJson: JSON.stringify(record.metadata ?? {}),
          });
        }
      } catch (error) {
        // Do not report a successful StoredObject creation when its audit failed.
        // Other audit actions retain their existing error contract.
        if (record.action === "stored_object.created") throw error;
        const detail = error instanceof Error ? error.message : "unknown error";
        console.error("[audit] persist failed", record.id, record.action, detail);
      }

      return record;
    },
    async list() {
      await ensureSchema();
      const rows = await getDb()
        .select()
        .from(auditEvents)
        .orderBy(asc(auditEvents.occurredAt), asc(auditEvents.id));

      return rows.map(mapAuditRow);
    },
  };
}

type StoredObjectCreatedAuditValues = {
  id: string;
  action: string;
  occurredAt: string;
  actorUserId: string | null;
  actorKind: string | null;
  actorAgentInstanceId: string | null;
  actorComponent: string | null;
  workspaceId: string;
  ventureId: string;
  metadataJson: string;
};

const INSERT_STORED_OBJECT_CREATED = {
  sql: `INSERT INTO audit_events (id, action, occurred_at, actor_user_id, actor_kind, actor_agent_instance_id, actor_component, workspace_id, venture_id, metadata_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
};

function auditInsertArgs(values: StoredObjectCreatedAuditValues) {
  return [
    values.id,
    values.action,
    values.occurredAt,
    values.actorUserId,
    values.actorKind,
    values.actorAgentInstanceId,
    values.actorComponent,
    values.workspaceId,
    values.ventureId,
    values.metadataJson,
  ];
}

function rowMatchesAudit(row: Record<string, unknown>, values: StoredObjectCreatedAuditValues) {
  return (
    String(row.id) === values.id &&
    String(row.action) === values.action &&
    String(row.occurred_at) === values.occurredAt &&
    (row.actor_user_id == null ? null : String(row.actor_user_id)) === values.actorUserId &&
    (row.actor_kind == null ? null : String(row.actor_kind)) === values.actorKind &&
    (row.actor_agent_instance_id == null ? null : String(row.actor_agent_instance_id)) ===
      values.actorAgentInstanceId &&
    (row.actor_component == null ? null : String(row.actor_component)) === values.actorComponent &&
    String(row.workspace_id ?? "") === values.workspaceId &&
    String(row.venture_id ?? "") === values.ventureId &&
    String(row.metadata_json) === values.metadataJson
  );
}

async function observeStoredObjectCreatedAudit(
  values: StoredObjectCreatedAuditValues,
  deadline: number,
): Promise<"match" | "mismatch" | "absent"> {
  const result = await withDurabilityClient(
    (client) =>
      client.execute({
        sql: `SELECT id, action, occurred_at, actor_user_id, actor_kind, actor_agent_instance_id, actor_component, workspace_id, venture_id, metadata_json FROM audit_events WHERE id = ?`,
        args: [values.id],
      }),
    deadline,
  );
  const row = result.rows[0];
  if (!row) return "absent";
  return rowMatchesAudit(row as Record<string, unknown>, values) ? "match" : "mismatch";
}

async function persistStoredObjectCreationAudit(values: StoredObjectCreatedAuditValues): Promise<void> {
  const deadline = Date.now() + SQLITE_CONTENTION_BUDGET_MS;
  let lastError: unknown;
  for (;;) {
    if (Date.now() >= deadline) {
      throw lastError ?? new Error("Stored object creation audit contention deadline exhausted");
    }
    try {
      await executeDurability(
        { sql: INSERT_STORED_OBJECT_CREATED.sql, args: auditInsertArgs(values) },
        deadline,
      );
    } catch (error) {
      if (isSqliteConstraint(error)) {
        const visible = await observeStoredObjectCreatedAudit(values, deadline);
        if (visible === "match") return;
        throw error;
      }
      throw error;
    }
    const visible = await observeStoredObjectCreatedAudit(values, deadline);
    if (visible === "match") return;
    if (visible === "mismatch") {
      throw lastError ?? new Error("stored_object.created audit did not match the expected durable values");
    }
    lastError = new Error("stored_object.created audit was not independently visible");
    if (Date.now() >= deadline) throw lastError;
    const wait = Math.min(SQLITE_DURABILITY_RETRY_DELAY_MS, Math.max(0, deadline - Date.now()));
    if (wait === 0) throw lastError;
    await delay(wait);
  }
}

function normalizeActor(actor: AuditActor | undefined): WorkforceActor | undefined {
  if (!actor) {
    return undefined;
  }
  if (isHumanActor(actor) || isAgentActor(actor) || isSystemActor(actor)) {
    return actor;
  }
  if ("userId" in actor && typeof actor.userId === "string") {
    return {
      kind: "human",
      userId: actor.userId,
      workspaceId: actor.workspaceId,
      ventureId: actor.ventureId,
    };
  }
  return undefined;
}

function humanUserId(actor: WorkforceActor | undefined) {
  return actor && isHumanActor(actor) ? actor.userId : null;
}

function agentInstanceId(actor: WorkforceActor | undefined) {
  return actor && isAgentActor(actor) ? actor.agentInstanceId : null;
}

function systemComponent(actor: WorkforceActor | undefined) {
  return actor && isSystemActor(actor) ? actor.component : null;
}

function scopeValue(
  record: AuditRecord,
  key: "workspaceId" | "ventureId",
): string {
  const actor = record.actor;
  const fromActor =
    actor && key in actor
      ? (actor as { workspaceId?: WorkspaceId; ventureId?: VentureId })[key]
      : undefined;
  return record.metadata?.[key] ?? fromActor ?? "";
}

function mapAuditRow(row: typeof auditEvents.$inferSelect): AuditRecord {
  const metadata = parseMetadata(row.metadataJson);
  return {
    id: row.id,
    action: row.action,
    occurredAt: row.occurredAt,
    actor: mapActor(row),
    metadata,
  };
}

function mapActor(row: typeof auditEvents.$inferSelect): WorkforceActor | undefined {
  const kind = row.actorKind ?? (row.actorUserId ? "human" : undefined);
  const workspaceId = row.workspaceId
    ? (row.workspaceId as WorkspaceId)
    : undefined;
  const ventureId = row.ventureId ? (row.ventureId as VentureId) : undefined;

  if (kind === "human" && row.actorUserId) {
    return {
      kind: "human",
      userId: row.actorUserId as UserId,
      workspaceId,
      ventureId,
    };
  }
  if (kind === "agent" && row.actorAgentInstanceId) {
    return {
      kind: "agent",
      agentInstanceId: row.actorAgentInstanceId as AgentInstanceId,
      workspaceId: (workspaceId ?? "") as WorkspaceId,
      ventureId: (ventureId ?? "") as VentureId,
    };
  }
  if (kind === "system" && row.actorComponent) {
    return {
      kind: "system",
      component: row.actorComponent,
      workspaceId,
    };
  }
  return undefined;
}

function parseMetadata(raw: string): Record<string, string> | undefined {
  try {
    const value = JSON.parse(raw) as unknown;
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return undefined;
    }

    const metadata: Record<string, string> = {};
    for (const [key, entry] of Object.entries(value)) {
      if (typeof entry === "string") {
        metadata[key] = entry;
      }
    }

    return metadata;
  } catch {
    return undefined;
  }
}
