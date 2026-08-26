import { and, eq } from "drizzle-orm";
import type { AgentDefinitionId } from "@/contracts/ids";
import type {
  AgentDefinition,
  AgentDefinitionLifecycle,
} from "@/core/workforce/types";
import type { WorkforceDefinitionRegistry } from "@/core/workforce/definitions";
import { nowIso } from "@/platform/ids";
import { ensureSchema, getDb } from "@/platform/persistence/db";
import { agentDefinitions as definitionTable } from "@/platform/persistence/schema";

export type WorkforceDefinitionRepository = WorkforceDefinitionRegistry & {
  publish(definition: AgentDefinition): Promise<void>;
  setLifecycle(
    id: AgentDefinitionId,
    version: string,
    lifecycle: AgentDefinitionLifecycle,
  ): Promise<void>;
};

export function createWorkforceDefinitionRepository(): WorkforceDefinitionRepository {
  return {
    async get(id, version) {
      await ensureSchema();
      const [row] = await getDb()
        .select()
        .from(definitionTable)
        .where(
          and(eq(definitionTable.id, id), eq(definitionTable.version, version)),
        )
        .limit(1);
      return row ? toDefinition(row) : undefined;
    },
    async has(id) {
      await ensureSchema();
      const [row] = await getDb()
        .select({ id: definitionTable.id })
        .from(definitionTable)
        .where(eq(definitionTable.id, id))
        .limit(1);
      return Boolean(row);
    },
    async publish(definition) {
      await ensureSchema();
      const now = nowIso();
      try {
        await getDb().insert(definitionTable).values({
          id: definition.id,
          version: definition.version,
          role: definition.role,
          responsibilitiesJson: JSON.stringify(definition.responsibilities),
          capabilityAllowJson: JSON.stringify(definition.capabilityAllowList),
          capabilityDenyJson: JSON.stringify(definition.capabilityDenyList),
          autonomyCeiling: definition.autonomyCeiling,
          approvalBoundary: definition.approvalBoundary,
          memoryPolicy: definition.memoryPolicy,
          escalationPolicy: definition.escalationPolicy,
          evaluationProfile: definition.evaluationProfile,
          lifecycle: definition.lifecycle,
          createdAt: now,
          updatedAt: now,
        });
      } catch (error) {
        if (!isUniqueConstraint(error)) {
          throw error;
        }
        const existing = await this.get(definition.id, definition.version);
        if (!existing) {
          throw error;
        }
        if (contentFingerprint(existing) !== contentFingerprint(definition)) {
          throw new Error(
            `Agent definition ${definition.id}@${definition.version} is immutable.`,
          );
        }
      }
    },
    async setLifecycle(id, version, lifecycle) {
      await ensureSchema();
      await getDb()
        .update(definitionTable)
        .set({ lifecycle, updatedAt: nowIso() })
        .where(
          and(eq(definitionTable.id, id), eq(definitionTable.version, version)),
        );
    },
  };
}

function toDefinition(
  row: typeof definitionTable.$inferSelect,
): AgentDefinition {
  return {
    id: row.id as AgentDefinitionId,
    version: row.version,
    role: row.role,
    responsibilities: parseStringArray(row.responsibilitiesJson),
    capabilityAllowList: parseStringArray(row.capabilityAllowJson),
    capabilityDenyList: parseStringArray(row.capabilityDenyJson),
    autonomyCeiling: row.autonomyCeiling as AgentDefinition["autonomyCeiling"],
    approvalBoundary: row.approvalBoundary,
    memoryPolicy: row.memoryPolicy,
    escalationPolicy: row.escalationPolicy,
    evaluationProfile: row.evaluationProfile,
    lifecycle: row.lifecycle as AgentDefinitionLifecycle,
  };
}

function contentFingerprint(definition: AgentDefinition) {
  return JSON.stringify({
    role: definition.role,
    responsibilities: definition.responsibilities,
    capabilityAllowList: definition.capabilityAllowList,
    capabilityDenyList: definition.capabilityDenyList,
    autonomyCeiling: definition.autonomyCeiling,
    approvalBoundary: definition.approvalBoundary,
    memoryPolicy: definition.memoryPolicy,
    escalationPolicy: definition.escalationPolicy,
    evaluationProfile: definition.evaluationProfile,
  });
}

function parseStringArray(raw: string): string[] {
  try {
    const value: unknown = JSON.parse(raw);
    if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
      return [];
    }
    return value;
  } catch {
    return [];
  }
}

function isUniqueConstraint(error: unknown) {
  let current: unknown = error;
  for (let depth = 0; depth < 6 && current; depth += 1) {
    const message = current instanceof Error ? current.message : String(current);
    if (/UNIQUE/i.test(message) || /SQLITE_CONSTRAINT/i.test(message)) {
      return true;
    }
    if (typeof current === "object" && current && "cause" in current) {
      current = (current as { cause: unknown }).cause;
      continue;
    }
    break;
  }
  return false;
}
