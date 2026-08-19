import type { Capability, CapabilityGraph, CapabilityId } from "./types";

export function capabilityEdges(capabilities: Capability[]): CapabilityGraph["edges"] {
  return capabilities.flatMap((capability) =>
    capability.dependencies.map((dependency) => ({
      from: capability.id,
      to: dependency,
    })),
  );
}

export function topologicalOrder(capabilities: Capability[]): CapabilityId[] {
  const ids = capabilities.map((item) => item.id);
  const known = new Set(ids);
  const inbound = new Map<CapabilityId, number>(ids.map((id) => [id, 0]));
  const outbound = new Map<CapabilityId, CapabilityId[]>(ids.map((id) => [id, []]));

  for (const capability of capabilities) {
    for (const dependency of capability.dependencies) {
      if (!known.has(dependency)) {
        continue;
      }
      outbound.get(dependency)?.push(capability.id);
      inbound.set(capability.id, (inbound.get(capability.id) ?? 0) + 1);
    }
  }

  const queue = ids.filter((id) => (inbound.get(id) ?? 0) === 0).sort();
  const order: CapabilityId[] = [];

  while (queue.length > 0) {
    const id = queue.shift() as CapabilityId;
    order.push(id);
    for (const next of outbound.get(id) ?? []) {
      const remaining = (inbound.get(next) ?? 0) - 1;
      inbound.set(next, remaining);
      if (remaining === 0) {
        queue.push(next);
        queue.sort();
      }
    }
  }

  if (order.length !== ids.length) {
    const cyclic = ids.filter((id) => !order.includes(id));
    throw new Error(`Circular capability dependency: ${cyclic.join(" → ")}.`);
  }

  return order;
}

export function buildCapabilityGraph(capabilities: Capability[]): CapabilityGraph {
  return {
    nodes: capabilities.map((item) => item.id),
    edges: capabilityEdges(capabilities),
    order: topologicalOrder(capabilities),
  };
}
