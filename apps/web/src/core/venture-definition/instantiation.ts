import type { CapabilityRegistry } from "../capability/registry";
import { platformCapabilityRegistry } from "../capability/catalog";
import { platformVentureRegistry } from "./catalog";
import type { VentureDefinitionRegistry } from "./registry";
import { validateVentureManifest } from "./validation";
import type { VentureDefinition, VentureDefinitionRef } from "./types";
import { DEFAULT_VENTURE_DEFINITION_REF } from "./types";

export function instantiateVentureDefinition(
  ref: VentureDefinitionRef = DEFAULT_VENTURE_DEFINITION_REF,
  registry: VentureDefinitionRegistry = platformVentureRegistry,
  capabilities: CapabilityRegistry = platformCapabilityRegistry,
): { ref: VentureDefinitionRef; definition: VentureDefinition } {
  if (!ref.id.trim()) {
    throw new Error("Venture definition id is required.");
  }
  if (!ref.version.trim() || !/^\d+\.\d+\.\d+$/.test(ref.version)) {
    throw new Error(`Venture definition version does not exist: ${ref.version || "(empty)"}.`);
  }

  const found = registry.get(ref.id);
  if (!found) {
    throw new Error(`Venture definition does not exist: ${ref.id}.`);
  }
  if (found.version !== ref.version) {
    throw new Error(
      `Venture definition version does not exist: ${ref.id}@${ref.version}.`,
    );
  }

  const definition = validateVentureManifest(found, capabilities);
  return {
    ref: { id: definition.id, version: definition.version },
    definition,
  };
}
