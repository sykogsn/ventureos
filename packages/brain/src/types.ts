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

export type InstitutionalKnowledgeType = (typeof KNOWLEDGE_TYPES)[number];

export const OPERATING_KNOWLEDGE_TYPES = [
  "Company",
  "Person",
  "Procedure",
  "Evidence",
  "Meeting",
  "Risk",
  "Task",
  "Goal",
  "Project",
  "Incident",
  "Provider",
  "Inspection",
  "Customer",
  "Contract",
  "Document",
] as const;

export type OperatingKnowledgeType = (typeof OPERATING_KNOWLEDGE_TYPES)[number];

export type KnowledgeType = InstitutionalKnowledgeType | OperatingKnowledgeType;

const operatingTypeSet = new Set<string>(OPERATING_KNOWLEDGE_TYPES);

export function isOperatingKnowledgeType(type: string): type is OperatingKnowledgeType {
  return operatingTypeSet.has(type);
}

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
  type: Exclude<InstitutionalKnowledgeType, "Decision">;
};

export const EVIDENCE_WEIGHT_CLASSES = [
  "Primary",
  "Supporting",
  "Historical",
  "Contested",
] as const;

export type EvidenceWeightClass = (typeof EVIDENCE_WEIGHT_CLASSES)[number];

export const OPERATING_DOCUMENT_STATUSES = ["suggested", "draft", "live"] as const;

export type OperatingDocumentStatus = (typeof OPERATING_DOCUMENT_STATUSES)[number];

export type CompanyKnowledgeObject = KnowledgeObjectKernel & {
  type: "Company";
  legalName: string;
  operatingName: string;
  definitionRef: string;
  workspaceId: string;
  stage: string;
  genomePointers: string[];
};

export type PersonKnowledgeObject = KnowledgeObjectKernel & {
  type: "Person";
  role: string;
  remit: string;
  companyId: string;
  identityId?: string;
};

export type ProcedureKnowledgeObject = KnowledgeObjectKernel & {
  type: "Procedure";
  steps: string[];
};

export type EvidenceKnowledgeObject = KnowledgeObjectKernel & {
  type: "Evidence";
  source: string;
  capturedAt: string;
  supportsObjectId: string;
  weightClass: EvidenceWeightClass;
};

export type MeetingKnowledgeObject = KnowledgeObjectKernel & {
  type: "Meeting";
  occurredAt: string;
  attendeeIds: string[];
  decisionIds: string[];
};

export type RiskKnowledgeObject = KnowledgeObjectKernel & {
  type: "Risk";
  headline: string;
  signal: string;
  mitigation: string;
};

export type TaskKnowledgeObject = KnowledgeObjectKernel & {
  type: "Task";
  outcome: string;
  blockerIds: string[];
};

export type GoalKnowledgeObject = KnowledgeObjectKernel & {
  type: "Goal";
  objective: string;
  horizon: string;
  taskIds: string[];
};

export type ProjectKnowledgeObject = KnowledgeObjectKernel & {
  type: "Project";
  companyId: string;
  outcome: string;
  goalIds: string[];
};

export type IncidentKnowledgeObject = KnowledgeObjectKernel & {
  type: "Incident";
  whatBroke: string;
  evidenceIds: string[];
  followUpDecisionIds: string[];
};

export type ProviderKnowledgeObject = KnowledgeObjectKernel & {
  type: "Provider";
  supplies: string;
  contractIds: string[];
  inspectionIds: string[];
};

export type InspectionKnowledgeObject = KnowledgeObjectKernel & {
  type: "Inspection";
  subjectId: string;
  outcome: string;
  evidenceIds: string[];
  nextDue: string;
};

export type CustomerKnowledgeObject = KnowledgeObjectKernel & {
  type: "Customer";
  companyId: string;
  relationship: string;
};

export type ContractKnowledgeObject = KnowledgeObjectKernel & {
  type: "Contract";
  partyIds: string[];
  term: string;
  obligations: string;
  evidenceIds: string[];
};

export type OperatingDocumentKnowledgeObject = KnowledgeObjectKernel & {
  type: "Document";
  kind: string;
  documentStatus: OperatingDocumentStatus;
  evidenceOfIds: string[];
};

export type OperatingKnowledgeObject =
  | CompanyKnowledgeObject
  | PersonKnowledgeObject
  | ProcedureKnowledgeObject
  | EvidenceKnowledgeObject
  | MeetingKnowledgeObject
  | RiskKnowledgeObject
  | TaskKnowledgeObject
  | GoalKnowledgeObject
  | ProjectKnowledgeObject
  | IncidentKnowledgeObject
  | ProviderKnowledgeObject
  | InspectionKnowledgeObject
  | CustomerKnowledgeObject
  | ContractKnowledgeObject
  | OperatingDocumentKnowledgeObject;

export type KnowledgeObject =
  | DecisionKnowledgeObject
  | DocumentKnowledgeObject
  | OperatingKnowledgeObject;
