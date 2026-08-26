import type { AgentInstance, AgentInstanceId } from "./types";

export type WorkforceInstanceRegistry = {
  get(id: AgentInstanceId): Promise<AgentInstance | undefined>;
};

export function createWorkforceInstanceRegistry(
  instances: AgentInstance[],
): WorkforceInstanceRegistry {
  const byId = new Map<string, AgentInstance>();

  for (const instance of instances) {
    if (byId.has(instance.id)) {
      throw new Error(`Duplicate agent instance: ${instance.id}.`);
    }
    byId.set(instance.id, { ...instance });
  }

  return {
    async get(id) {
      const found = byId.get(id);
      return found ? { ...found } : undefined;
    },
  };
}
