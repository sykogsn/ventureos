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
  provenance?: CapabilityProvenance;
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

/** Structural reference contracts only. No Brain import, registry, persistence or execution. */
export type CapabilityKnowledgeReference = {
  id: string;
  kind: "Evidence" | "Learning";
  workspaceId: string;
  ventureId: string;
};
export type CapabilityProvenance = {
  origin: { workspaceId: string; ventureId: string; sourceRef: string };
  implementationRefs: { id: string; version: string }[];
  dependencyRefs: { capabilityId: string; version: string }[];
  validationContexts: {
    id: string;
    workspaceId: string;
    ventureId: string;
    at: string;
    implementationVersion: string;
    evidenceIds: string[];
    result: "SUPPORTED" | "CHALLENGED" | "INCONCLUSIVE";
  }[];
  performanceEvidenceIds: string[];
  learningIds: string[];
  reuseEvidenceIds: string[];
  reuseAssessment: {
    classification: "DOMAIN_SPECIFIC" | "REUSABLE_CAPABILITY_CANDIDATE";
    rationale: string;
    proposedBy: string;
    at: string;
  };
  promotionAuthority?: {
    reference: string;
    actor: string;
    at: string;
    evidenceIds: string[];
  };
};
/**
 * Caller-supplied resolution facts, NOT an evidence model/store or a live adapter.
 * Origin keys must name underlying sources, never copy ids or source versions.
 * Integration responsible for supplying trustworthy resolutions is deferred.
 */
export type CapabilityProvenanceContext = {
  capabilities: { id: string; version: string }[];
  references: CapabilityKnowledgeReference[];
  evidenceOrigins: { evidenceId: string; originKeys: string[] }[];
};
