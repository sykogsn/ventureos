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

export const KNOWLEDGE_PLANES = ["institutional", "operating"] as const;

export type KnowledgePlane = (typeof KNOWLEDGE_PLANES)[number];

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

export const KNOWLEDGE_OBJECT_KERNEL_FIELDS = [
  "id",
  "type",
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
  "lastReview",
  "version",
  "aiContext",
  "scopes",
  "plane",
] as const;

export type KnowledgeHistoryEntry = {
  at: string;
  note: string;
};

/**
 * Stored relationship kinds on a Knowledge Object.
 * `owned_by` is the inverse of `owns` and is not stored.
 * `replaces` is an alias of `supersedes` and is not stored.
 */
export const KNOWLEDGE_RELATIONSHIP_KINDS = [
  "owns",
  "member_of",
  "contains",
  "seated_in",
  "informs",
  "mitigates",
  "related_to",
  "derived_from",
  "created_by",
  "evidence_for",
  "supports",
  "contradicts",
  "depends_on",
  "blocked_by",
  "supersedes",
] as const;

export type KnowledgeRelationshipKind = (typeof KNOWLEDGE_RELATIONSHIP_KINDS)[number];

export const KNOWLEDGE_RELATIONSHIP_KIND_ALIASES = {
  replaces: "supersedes",
} as const;

export type KnowledgeRelationshipKindAlias = keyof typeof KNOWLEDGE_RELATIONSHIP_KIND_ALIASES;

export type KnowledgeRelationship = {
  objectId: string;
  kind?: KnowledgeRelationshipKind;
};

export const DECISION_IMPACTS = ["Platform", "Product", "Presentation"] as const;

export type DecisionImpact = (typeof DECISION_IMPACTS)[number];

export type KnowledgeObjectKernel = {
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
  lastReview: string;
  version: string;
  aiContext: string;
  scopes: BrainVentureScope[];
  plane: KnowledgePlane;
};

export type DecisionKnowledgeObject = KnowledgeObjectKernel & {
  type: "Decision";
  impact: DecisionImpact;
  alternatives: string[];
  issuedAt: string;
};

export type DocumentKnowledgeObject = KnowledgeObjectKernel & {
  type: Exclude<KnowledgeType, "Decision">;
};

export type KnowledgeObject = DecisionKnowledgeObject | DocumentKnowledgeObject;
