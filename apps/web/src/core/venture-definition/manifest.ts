import type { CapabilityRegistry } from "../capability/registry";
import { validateVentureManifest } from "./validation";
import type { VentureDefinition } from "./types";

export function parseVentureManifest(
  input: unknown,
  capabilities: CapabilityRegistry,
): VentureDefinition {
  if (!input || typeof input !== "object") {
    throw new Error("Venture manifest must be an object.");
  }
  return validateVentureManifest(input as VentureDefinition, capabilities);
}
