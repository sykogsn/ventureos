import type { Actor } from "@/contracts";
import { createId, nowIso } from "@/platform/ids";

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
  const records: AuditRecord[] = [];

  return {
    async record(entry) {
      const record: AuditRecord = {
        ...entry,
        id: createId(),
        occurredAt: nowIso(),
      };
      records.push(record);
      return record;
    },
    async list() {
      return [...records];
    },
  };
}
