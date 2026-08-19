import type { VentureDefinition, VentureDefinitionManifest } from "./types";

export function createVentureDefinition(
  input: VentureDefinitionManifest,
): VentureDefinition {
  return {
    ...input,
    runtimeProfile: {
      orchestrator: input.runtimeProfile.orchestrator,
      requiredCapabilities: [...input.runtimeProfile.requiredCapabilities],
    },
    capabilityProfile: {
      uses: [...input.capabilityProfile.uses],
      excludes: [...input.capabilityProfile.excludes],
    },
    governanceProfile: { ...input.governanceProfile },
    dependencies: [...input.dependencies],
    supportedFeatures: [...input.supportedFeatures],
    excludedFeatures: [...input.excludedFeatures],
  };
}

export function createVentureManifest(
  input: VentureDefinitionManifest,
): VentureDefinitionManifest {
  return createVentureDefinition(input);
}
