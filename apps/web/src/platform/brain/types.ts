export const KNOWLEDGE_TYPES = [
  "Constitution",
  "Architecture",
  "Research",
  "Decision",
  "Roadmap",
  "Blueprint",
  "Standard",
  "Policy",
  "Playbook",
] as const;

export type KnowledgeType = (typeof KNOWLEDGE_TYPES)[number];

export const KNOWLEDGE_STATUSES = ["Approved", "Living", "Specified", "Concept"] as const;

export type KnowledgeStatus = (typeof KNOWLEDGE_STATUSES)[number];

export const BRAIN_VENTURE_SCOPES = ["Platform", "Qualora", "Calviora", "Farmora"] as const;

export type BrainVentureScope = (typeof BRAIN_VENTURE_SCOPES)[number];

export const KNOWLEDGE_OBJECT_SECTIONS = [
  "title",
  "summary",
  "purpose",
  "why",
  "evidence",
  "relationships",
  "history",
  "owner",
  "status",
  "reviewDate",
  "aiContext",
] as const;

export type KnowledgeObjectSection = (typeof KNOWLEDGE_OBJECT_SECTIONS)[number];

export type KnowledgeHistoryEntry = {
  at: string;
  note: string;
};

export type KnowledgeRelationship = {
  objectId: string;
};

export const DECISION_IMPACTS = ["Platform", "Product", "Presentation"] as const;

export type DecisionImpact = (typeof DECISION_IMPACTS)[number];

type KnowledgeObjectCore = {
  id: string;
  title: string;
  summary: string;
  purpose: string;
  why: string;
  evidence: string[];
  relationships: KnowledgeRelationship[];
  history: KnowledgeHistoryEntry[];
  owner: string;
  status: KnowledgeStatus;
  reviewDate: string;
  aiContext: string;
  version: string;
  lastReview: string;
  scopes: BrainVentureScope[];
};

export type DecisionKnowledgeObject = KnowledgeObjectCore & {
  type: "Decision";
  impact: DecisionImpact;
  alternatives: string[];
  issuedAt: string;
};

export type DocumentKnowledgeObject = KnowledgeObjectCore & {
  type: Exclude<KnowledgeType, "Decision">;
};

export type KnowledgeObject = DecisionKnowledgeObject | DocumentKnowledgeObject;

export type KnowledgeObjectRecord = KnowledgeObject;

export const GOVERNANCE_CARDS = [
  { objectId: "creed", title: "Constitution" },
  { objectId: "runtime", title: "Architecture Standard" },
  { objectId: "ids", title: "Design Constitution" },
  { objectId: "engineering-standard", title: "Engineering Standard" },
  { objectId: "product-operating-system", title: "Product Operating System" },
  { objectId: "ai-constitution", title: "AI Constitution" },
  { objectId: "security-standard", title: "Security Standard" },
] as const;

export type GovernanceInstrument = {
  id: string;
  title: string;
  status: KnowledgeStatus;
  version: string;
  owner: string;
  lastReview: string;
  href: string;
};

export type BrainActivity = {
  id: string;
  at: string;
  note: string;
  href: string;
};

export type BrainHealthMetric = {
  id: string;
  title: string;
  value: string;
  judgement: string;
  band: "healthy" | "watch" | "risk";
};

export type BrainSearchHit = {
  id: string;
  type: KnowledgeType;
  title: string;
  summary: string;
  href: string;
};
