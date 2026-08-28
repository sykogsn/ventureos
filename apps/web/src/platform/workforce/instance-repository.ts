import { and, eq } from "drizzle-orm";
import type { AgentDefinitionId, AgentInstanceId } from "@/contracts/ids";
import type { VentureId, WorkspaceId } from "@/contracts";
import type {
  AgentInstance,
  AgentInstanceStatus,
} from "@/core/workforce/types";
import type { WorkforceInstanceRegistry } from "@/core/workforce/instances";
import { nowIso } from "@/platform/ids";
import { ensureSchema, getDb } from "@/platform/persistence/db";
import { agentInstances as instanceTable } from "@/platform/persistence/schema";

export type WorkforceInstanceRepository = WorkforceInstanceRegistry & {
  insert(instance: AgentInstance): Promise<void>;
  setStatus(id: AgentInstanceId, status: AgentInstanceStatus): Promise<void>;
  listByScope(input: {
    workspaceId: WorkspaceId;
    ventureId: VentureId;
  }): Promise<AgentInstance[]>;
};

export function createWorkforceInstanceRepository(): WorkforceInstanceRepository {
  return {
    async get(id) {
      await ensureSchema();
      const [row] = await getDb()
        .select()
        .from(instanceTable)
        .where(eq(instanceTable.id, id))
        .limit(1);
      return row ? toInstance(row) : undefined;
    },
    async insert(instance) {
      await ensureSchema();
      const now = nowIso();
      await getDb().insert(instanceTable).values({
        id: instance.id,
        definitionId: instance.definitionId,
        definitionVersion: instance.definitionVersion,
        workspaceId: instance.workspaceId,
        ventureId: instance.ventureId,
        status: instance.status,
        createdAt: now,
        updatedAt: now,
      });
    },
    async setStatus(id, status) {
      await ensureSchema();
      await getDb()
        .update(instanceTable)
        .set({ status, updatedAt: nowIso() })
        .where(eq(instanceTable.id, id));
    },
    async listByScope(input) {
      await ensureSchema();
      const rows = await getDb()
        .select()
        .from(instanceTable)
        .where(
          and(
            eq(instanceTable.workspaceId, input.workspaceId),
            eq(instanceTable.ventureId, input.ventureId),
          ),
        );
      return rows.map(toInstance);
    },
  };
}

function toInstance(row: typeof instanceTable.$inferSelect): AgentInstance {
  return {
    id: row.id as AgentInstanceId,
    definitionId: row.definitionId as AgentDefinitionId,
    definitionVersion: row.definitionVersion,
    workspaceId: row.workspaceId as WorkspaceId,
    ventureId: row.ventureId as VentureId,
    status: row.status as AgentInstanceStatus,
  };
}
