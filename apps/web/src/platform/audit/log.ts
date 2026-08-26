import { asc } from "drizzle-orm";
import type { Actor, UserId, VentureId, WorkspaceId } from "@/contracts";
import type { AgentInstanceId } from "@/contracts/ids";
import type { WorkforceActor } from "@/core/workforce/types";
import { isAgentActor, isHumanActor, isSystemActor } from "@/core/workforce/actor";
import { createId, nowIso } from "@/platform/ids";
import { ensureSchema, getDb } from "@/platform/persistence/db";
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
      } catch (error) {
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
