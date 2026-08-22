import type {
  DecisionKnowledgeObject,
  DocumentKnowledgeObject,
  InstitutionalKnowledgeType,
  KnowledgeObject,
} from "./types";

function history() {
  return [{ at: "2026-08-22", note: "Kernel fixture." }];
}

function document(
  id: string,
  type: Exclude<InstitutionalKnowledgeType, "Decision">,
  related: KnowledgeObject["relationships"],
): DocumentKnowledgeObject {
  return {
    id,
    type,
    plane: "institutional",
    title: type,
    summary: `${type} kernel fixture.`,
    purpose: `Hold the ${type} institutional type.`,
    why: "Every institutional type must exist on the kernel.",
    evidence: ["BRAIN-001 §6.1"],
    relationships: related,
    history: history(),
    owner: "Architecture",
    status: "Approved",
    reviewDate: "2026-08-22",
    lastReview: "2026-08-22",
    version: "1.0.0",
    aiContext: `Institutional ${type}. Not a prompt that executes.`,
    scopes: ["Platform"],
  };
}

const creed: DocumentKnowledgeObject = document("creed", "Constitution", [
  { objectId: "adr-001", kind: "supports" },
]);

const runtime: DocumentKnowledgeObject = document("runtime", "Architecture", [
  { objectId: "adr-001" },
]);

const research: DocumentKnowledgeObject = document("research", "Research", [
  { objectId: "creed" },
]);

const decision: DecisionKnowledgeObject = {
  id: "adr-001",
  type: "Decision",
  plane: "institutional",
  title: "One orchestrator",
  summary: "Runtime remains the sole orchestrator.",
  purpose: "Keep Brain a substrate.",
  why: "A second pipeline is unconstitutional.",
  evidence: ["ADR-001", "ADR-009"],
  relationships: [{ objectId: "runtime", kind: "derived_from" }],
  history: history(),
  owner: "Architecture",
  status: "Approved",
  reviewDate: "2026-08-22",
  lastReview: "2026-08-22",
  version: "1.0.0",
  aiContext: "Decision is one type. Plane and impact distinguish governance.",
  scopes: ["Platform"],
  impact: "Platform",
  alternatives: ["A second Runtime"],
  issuedAt: "2026-08-22",
};

const roadmap: DocumentKnowledgeObject = document("roadmap", "Roadmap", [
  { objectId: "runtime" },
]);
const blueprint: DocumentKnowledgeObject = document("blueprint", "Blueprint", [
  { objectId: "runtime" },
]);
const standard: DocumentKnowledgeObject = document("standard", "Standard", [
  { objectId: "creed" },
]);
const policy: DocumentKnowledgeObject = document("policy", "Policy", [
  { objectId: "creed", kind: "supports" },
]);
const playbook: DocumentKnowledgeObject = document("playbook", "Playbook", [
  { objectId: "standard" },
]);

export const institutionalKernelCatalogue: KnowledgeObject[] = [
  creed,
  runtime,
  research,
  decision,
  roadmap,
  blueprint,
  standard,
  policy,
  playbook,
];
