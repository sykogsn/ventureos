import type { CapabilityId, CapabilityMaturity } from "../capability/types";
import type { VentureFeature } from "./features";
import type { VentureLifecycle } from "./lifecycle";

export type VentureDefinitionId = string;

export type VentureRuntimeProfile = {
  orchestrator: CapabilityId;
  requiredCapabilities: CapabilityId[];
};

export type VentureCapabilityProfile = {
  uses: CapabilityId[];
  excludes: CapabilityId[];
};

export type VentureGovernanceProfile = {
  owner: string;
  policyCapabilityId: CapabilityId;
  decisionCapabilityId: CapabilityId;
  officeCapabilityId: CapabilityId;
};

export type VentureDefinition = {
  id: VentureDefinitionId;
  name: string;
  purpose: string;
  description: string;
  owner: string;
  version: string;
  lifecycle: VentureLifecycle;
  maturity: CapabilityMaturity;
  runtimeProfile: VentureRuntimeProfile;
  capabilityProfile: VentureCapabilityProfile;
  governanceProfile: VentureGovernanceProfile;
  dependencies: VentureDefinitionId[];
  supportedFeatures: VentureFeature[];
  excludedFeatures: VentureFeature[];
};

export type VentureDefinitionManifest = VentureDefinition;

export type VentureDefinitionRef = {
  id: VentureDefinitionId;
  version: string;
};

export const VENTURE_RUNTIME_ORCHESTRATOR = "intelligence.runtime" as const;

export const DEFAULT_VENTURE_DEFINITION_REF: VentureDefinitionRef = {
  id: "ventureos.company",
  version: "1.0.0",
};
