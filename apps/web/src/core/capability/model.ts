import type { Capability, CapabilityManifest } from "./types";

export function createCapability(input: CapabilityManifest): Capability {
  return {
    ...input,
    dependencies: [...input.dependencies],
    provides: [...input.provides],
    requires: [...input.requires],
    guarantees: [...input.guarantees],
    limitations: [...input.limitations],
  };
}

export function createCapabilityManifest(input: CapabilityManifest): CapabilityManifest {
  return createCapability(input);
}
