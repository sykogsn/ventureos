import { platformCapabilityRegistry } from "@/core/capability/catalog";
import type { CapabilityRegistry } from "@/core/capability/registry";
import { definitionHasFeature } from "@/core/venture-definition/enforcement";
import { instantiateVentureDefinition } from "@/core/venture-definition/instantiation";
import { platformVentureRegistry } from "@/core/venture-definition/catalog";
import type { VentureDefinitionRegistry } from "@/core/venture-definition/registry";
import type { VentureFeature } from "@/core/venture-definition/features";
import type { VentureDefinitionRef } from "@/core/venture-definition/types";

export const LAUNCH_PRODUCT_IDS = [
  "ventureos.company",
  "qualora",
  "calviora",
  "farmora",
  "frigora",
] as const;

export type LaunchProductId = (typeof LAUNCH_PRODUCT_IDS)[number];

export function isLaunchProductId(id: string): id is LaunchProductId {
  return (LAUNCH_PRODUCT_IDS as readonly string[]).includes(id);
}

export function resolveLaunchProduct(
  productId: string,
  registry: VentureDefinitionRegistry = platformVentureRegistry,
): VentureDefinitionRef {
  if (!productId.trim() || !isLaunchProductId(productId)) {
    throw new Error(
      productId.trim() ? `Unknown product: ${productId}.` : "Unknown product.",
    );
  }

  const definition = registry.get(productId);
  if (!definition) {
    throw new Error(`Unknown definition: ${productId}.`);
  }

  return { id: definition.id, version: definition.version };
}

export function bootstrapProduct(
  productId: string,
  registry: VentureDefinitionRegistry = platformVentureRegistry,
  capabilities: CapabilityRegistry = platformCapabilityRegistry,
) {
  const ref = resolveLaunchProduct(productId, registry);
  return instantiateVentureDefinition(ref, registry, capabilities);
}

export function listLaunchProducts(
  registry: VentureDefinitionRegistry = platformVentureRegistry,
): Array<{ id: LaunchProductId; label: string; description: string }> {
  return LAUNCH_PRODUCT_IDS.map((id) => {
    const definition = registry.get(id);
    if (!definition) {
      throw new Error(`Unknown definition: ${id}.`);
    }
    return {
      id,
      label: definition.name,
      description: definition.purpose,
    };
  });
}

export function launchProductHasFeature(
  productId: string,
  feature: VentureFeature,
  registry: VentureDefinitionRegistry = platformVentureRegistry,
): boolean {
  const ref = resolveLaunchProduct(productId, registry);
  const definition = registry.get(ref.id);
  if (!definition) {
    throw new Error(`Unknown definition: ${ref.id}.`);
  }
  return definitionHasFeature(definition, feature);
}
