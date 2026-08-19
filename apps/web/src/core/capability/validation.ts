import { buildCapabilityGraph } from "./dependency-graph";
import { validateManifest } from "./manifest";
import type { Capability, CapabilityId, CapabilityManifest } from "./types";

export function validateCapabilitySet(manifests: CapabilityManifest[]): Capability[] {
  const capabilities = manifests.map(validateManifest);
  const seen = new Set<CapabilityId>();

  for (const capability of capabilities) {
    if (seen.has(capability.id)) {
      throw new Error(`Duplicate capability id: ${capability.id}.`);
    }
    seen.add(capability.id);
  }

  for (const capability of capabilities) {
    for (const dependency of capability.dependencies) {
      if (!seen.has(dependency)) {
        throw new Error(
          `Capability ${capability.id} depends on missing capability ${dependency}.`,
        );
      }
    }
  }

  buildCapabilityGraph(capabilities);
  return capabilities;
}
