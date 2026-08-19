import { buildCapabilityGraph } from "./dependency-graph";
import { validateCapabilitySet } from "./validation";
import type { CapabilityClassification } from "./taxonomy";
import type {
  Capability,
  CapabilityGraph,
  CapabilityId,
  CapabilityManifest,
} from "./types";
import { RUNTIME_REQUIRED_CAPABILITIES } from "./types";

export type CapabilityRegistry = {
  list(): Capability[];
  get(id: CapabilityId): Capability | undefined;
  resolve(id: CapabilityId): Capability;
  byClassification(classification: CapabilityClassification): Capability[];
  graph(): CapabilityGraph;
  resolveOrder(id: CapabilityId): Capability[];
};

export function createCapabilityRegistry(
  manifests: CapabilityManifest[],
): CapabilityRegistry {
  const capabilities = validateCapabilitySet(manifests);
  const byId = new Map(capabilities.map((item) => [item.id, item]));
  const graph = buildCapabilityGraph(capabilities);

  function list() {
    return capabilities.map((item) => ({ ...item, dependencies: [...item.dependencies] }));
  }

  function get(id: CapabilityId) {
    const found = byId.get(id);
    return found ? { ...found, dependencies: [...found.dependencies] } : undefined;
  }

  function resolve(id: CapabilityId) {
    const found = get(id);
    if (!found) {
      throw new Error(`Unknown capability: ${id}.`);
    }
    return found;
  }

  return {
    list,
    get,
    resolve,
    byClassification(classification) {
      return list().filter((item) => item.classification === classification);
    },
    graph() {
      return {
        nodes: [...graph.nodes],
        edges: graph.edges.map((edge) => ({ ...edge })),
        order: [...graph.order],
      };
    },
    resolveOrder(id) {
      const target = resolve(id);
      const needed = new Set<CapabilityId>([target.id]);
      const walk = (current: CapabilityId) => {
        for (const dependency of byId.get(current)?.dependencies ?? []) {
          if (needed.has(dependency)) {
            continue;
          }
          needed.add(dependency);
          walk(dependency);
        }
      };
      walk(target.id);
      return graph.order.filter((item) => needed.has(item)).map((item) => resolve(item));
    },
  };
}

export function assertRuntimeCapabilities(registry: CapabilityRegistry) {
  for (const id of RUNTIME_REQUIRED_CAPABILITIES) {
    const capability = registry.resolve(id);
    if (capability.lifecycle === "deprecated" || capability.lifecycle === "experimental") {
      throw new Error(
        `Runtime required capability ${id} is not usable (lifecycle: ${capability.lifecycle}).`,
      );
    }
  }
}
