import { asc } from "drizzle-orm";
import type { Actor, UserId, VentureId, WorkspaceId } from "@/contracts";
import { createId, nowIso } from "@/platform/ids";
import { ensureSchema, getDb } from "@/platform/persistence/db";
import { auditEvents } from "@/platform/persistence/schema";

export type AuditRecord = {
  id: string;
  action: string;
  occurredAt: string;
  actor?: Actor;
  metadata?: Record<string, string>;
};

export type AuditLog = {
  record(entry: Omit<AuditRecord, "id" | "occurredAt">): Promise<AuditRecord>;
  list(): Promise<AuditRecord[]>;
};

export function createAuditLog(): AuditLog {
  return {
    async record(entry) {
      const record: AuditRecord = {
        ...entry,
        id: createId(),
        occurredAt: nowIso(),
      };

      try {
        await ensureSchema();
        await getDb().insert(auditEvents).values({
          id: record.id,
          action: record.action,
          occurredAt: record.occurredAt,
          actorUserId: record.actor?.userId ?? null,
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

function scopeValue(
  record: AuditRecord,
  key: "workspaceId" | "ventureId",
): string {
  return record.metadata?.[key] ?? record.actor?.[key] ?? "";
}

function mapAuditRow(row: typeof auditEvents.$inferSelect): AuditRecord {
  const metadata = parseMetadata(row.metadataJson);
  const actor = row.actorUserId
    ? {
        userId: row.actorUserId as UserId,
        workspaceId: row.workspaceId
          ? (row.workspaceId as WorkspaceId)
          : undefined,
        ventureId: row.ventureId ? (row.ventureId as VentureId) : undefined,
      }
    : undefined;

  return {
    id: row.id,
    action: row.action,
    occurredAt: row.occurredAt,
    actor,
    metadata,
  };
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
