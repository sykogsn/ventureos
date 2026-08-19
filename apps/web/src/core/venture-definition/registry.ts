import type { CapabilityRegistry } from "../capability/registry";
import { validateVentureSet } from "./validation";
import type {
  VentureDefinition,
  VentureDefinitionId,
  VentureDefinitionManifest,
} from "./types";

export type VentureDefinitionRegistry = {
  list(): VentureDefinition[];
  get(id: VentureDefinitionId): VentureDefinition | undefined;
  resolve(id: VentureDefinitionId): VentureDefinition;
  byOwner(owner: string): VentureDefinition[];
  byLifecycle(lifecycle: VentureDefinition["lifecycle"]): VentureDefinition[];
};

function clone(definition: VentureDefinition): VentureDefinition {
  return {
    ...definition,
    runtimeProfile: {
      orchestrator: definition.runtimeProfile.orchestrator,
      requiredCapabilities: [...definition.runtimeProfile.requiredCapabilities],
    },
    capabilityProfile: {
      uses: [...definition.capabilityProfile.uses],
      excludes: [...definition.capabilityProfile.excludes],
    },
    governanceProfile: { ...definition.governanceProfile },
    dependencies: [...definition.dependencies],
    supportedFeatures: [...definition.supportedFeatures],
    excludedFeatures: [...definition.excludedFeatures],
  };
}

export function createVentureDefinitionRegistry(
  manifests: VentureDefinitionManifest[],
  capabilities: CapabilityRegistry,
): VentureDefinitionRegistry {
  const definitions = validateVentureSet(manifests, capabilities);
  const byId = new Map(definitions.map((item) => [item.id, item]));

  function list() {
    return definitions.map(clone);
  }

  function get(id: VentureDefinitionId) {
    const found = byId.get(id);
    return found ? clone(found) : undefined;
  }

  function resolve(id: VentureDefinitionId) {
    const found = get(id);
    if (!found) {
      throw new Error(`Unknown venture definition: ${id}.`);
    }
    return found;
  }

  return {
    list,
    get,
    resolve,
    byOwner(owner) {
      return list().filter((item) => item.owner === owner);
    },
    byLifecycle(lifecycle) {
      return list().filter((item) => item.lifecycle === lifecycle);
    },
  };
}
