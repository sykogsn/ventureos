import { platformVentureRegistry } from "@/core/venture-definition/catalog";
import type { VentureRegistryEntry } from "./types";

export function assertVentureDefinitionRef(entry: VentureRegistryEntry): void {
  if (!platformVentureRegistry.get(entry.definition.id)) {
    throw new Error("Unknown company definition.");
  }
}
