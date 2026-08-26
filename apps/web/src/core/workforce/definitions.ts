import type { AgentDefinition, AgentDefinitionId } from "./types";

export type WorkforceDefinitionRegistry = {
  get(id: AgentDefinitionId, version: string): AgentDefinition | undefined;
  has(id: AgentDefinitionId): boolean;
};

export function createWorkforceDefinitionRegistry(
  definitions: AgentDefinition[],
): WorkforceDefinitionRegistry {
  const byKey = new Map<string, AgentDefinition>();
  const ids = new Set<string>();

  for (const definition of definitions) {
    const key = definitionKey(definition.id, definition.version);
    if (byKey.has(key)) {
      throw new Error(`Duplicate agent definition: ${key}.`);
    }
    byKey.set(key, cloneDefinition(definition));
    ids.add(definition.id);
  }

  return {
    get(id, version) {
      const found = byKey.get(definitionKey(id, version));
      return found ? cloneDefinition(found) : undefined;
    },
    has(id) {
      return ids.has(id);
    },
  };
}

function definitionKey(id: AgentDefinitionId, version: string) {
  return `${id}@${version}`;
}

function cloneDefinition(definition: AgentDefinition): AgentDefinition {
  return {
    ...definition,
    responsibilities: [...definition.responsibilities],
    capabilityAllowList: [...definition.capabilityAllowList],
    capabilityDenyList: [...definition.capabilityDenyList],
  };
}
