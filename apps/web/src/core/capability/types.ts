import type { CapabilityClassification } from "./taxonomy";
import type { CapabilityLifecycle } from "./lifecycle";

export type CapabilityId = string;

export type CapabilityMaturity = "experimental" | "alpha" | "beta" | "ga";

export type Capability = {
  id: CapabilityId;
  name: string;
  classification: CapabilityClassification;
  purpose: string;
  owner: string;
  version: string;
  maturity: CapabilityMaturity;
  lifecycle: CapabilityLifecycle;
  dependencies: CapabilityId[];
  provides: string[];
  requires: string[];
  guarantees: string[];
  limitations: string[];
};

export type CapabilityManifest = Capability;

export type CapabilityGraphEdge = {
  from: CapabilityId;
  to: CapabilityId;
};

export type CapabilityGraph = {
  nodes: CapabilityId[];
  edges: CapabilityGraphEdge[];
  order: CapabilityId[];
};

export type CapabilityIssue = {
  code:
    | "duplicate-id"
    | "missing-dependency"
    | "circular-dependency"
    | "invalid-manifest"
    | "invalid-lifecycle"
    | "invalid-classification"
    | "invalid-contract"
    | "missing-capability";
  message: string;
  capabilityId?: CapabilityId;
};

export const RUNTIME_REQUIRED_CAPABILITIES = [
  "intelligence.venture-core",
  "intelligence.policy-engine",
  "intelligence.recommendation-engine",
  "intelligence.operating-health",
  "intelligence.knowledge-graph",
  "intelligence.runtime",
] as const;
