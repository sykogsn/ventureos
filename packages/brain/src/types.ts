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
  "Claim",
  "Learning",
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

export function isOperatingKnowledgeType(
  type: string,
): type is OperatingKnowledgeType {
  return operatingTypeSet.has(type);
}

export const KNOWLEDGE_PLANES = ["institutional", "operating"] as const;

export type KnowledgePlane = (typeof KNOWLEDGE_PLANES)[number];

export const KNOWLEDGE_STATUSES = [
  "Approved",
  "Living",
  "Specified",
  "Concept",
] as const;

export type KnowledgeStatus = (typeof KNOWLEDGE_STATUSES)[number];

export const BRAIN_VENTURE_SCOPES = [
  "Platform",
  "Qualora",
  "Calviora",
  "Farmora",
] as const;

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

export type KnowledgeRelationshipKind =
  (typeof KNOWLEDGE_RELATIONSHIP_KINDS)[number];

export const KNOWLEDGE_RELATIONSHIP_KIND_ALIASES = {
  replaces: "supersedes",
} as const;

export type KnowledgeRelationshipKindAlias =
  keyof typeof KNOWLEDGE_RELATIONSHIP_KIND_ALIASES;

export type KnowledgeRelationship = {
  objectId: string;
  kind?: KnowledgeRelationshipKind;
};

export const DECISION_IMPACTS = [
  "Platform",
  "Product",
  "Presentation",
] as const;

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
  operatingScope?: OperatingScope;
};

export type DecisionKnowledgeObject = KnowledgeObjectKernel & {
  type: "Decision";
  impact: DecisionImpact;
  alternatives: string[];
  issuedAt: string;
  traceability?: DecisionTraceability;
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

export const OPERATING_DOCUMENT_STATUSES = [
  "suggested",
  "draft",
  "live",
] as const;

export type OperatingDocumentStatus =
  (typeof OPERATING_DOCUMENT_STATUSES)[number];

export type CompanyKnowledgeObject = KnowledgeObjectKernel & {
  type: "Company";
  legalName: string;
  operatingName: string;
  definitionRef: string;
  workspaceId: string;
  stage: string;
  genomePointers: string[];
  intent?: VentureIntent;
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
  provenance?: EvidenceProvenance;
  outcomeObservation?: OutcomeObservation;
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
  measures?: ObjectiveMeasures;
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
  | ClaimKnowledgeObject
  | LearningKnowledgeObject
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

/** Contract metadata only; these are structural declarations, not access controls. */
export type VentureAddress = { workspaceId: string; ventureId: string };
export type OperatingScope = {
  workspaceId: string;
  originatingVentureId: string;
  applicability: VentureAddress[];
  sharing: { recipients: VentureAddress[]; authorityRef?: string };
};
export type SourceReference = {
  system: string;
  recordId: string;
  version: string;
};
/** A bounded score, never an assertion of calibrated probability. */
export type KnowledgeConfidence = {
  value: number;
  method: string;
  evidenceIds: string[];
};
export const CLAIM_CLASSIFICATIONS = [
  "FACT",
  "EVIDENCED_CLAIM",
  "INFERENCE",
  "ASSUMPTION",
  "HYPOTHESIS",
  "OPINION",
  "UNKNOWN",
] as const;
export type ClaimClassification = (typeof CLAIM_CLASSIFICATIONS)[number];
export const KNOWLEDGE_VALIDITIES = [
  "ACTIVE",
  "UNKNOWN",
  "SUPERSEDED",
  "RETRACTED",
] as const;
export type KnowledgeValidity = (typeof KNOWLEDGE_VALIDITIES)[number];
export type KnowledgeRetraction = { reason: string; actor: string; at: string };
export type ClaimKnowledgeObject = KnowledgeObjectKernel & {
  type: "Claim";
  operatingScope: OperatingScope;
  statement: string;
  classification: ClaimClassification;
  evidenceIds: string[];
  sourceRefs: SourceReference[];
  assumptions: string[];
  confidence?: KnowledgeConfidence;
  effectiveFrom: string;
  effectiveTo?: string;
  recordedAt: string;
  validity: KnowledgeValidity;
  supersededById?: string;
  retraction?: KnowledgeRetraction;
};
export type EvidenceProvenance = {
  source: SourceReference;
  observedAt: string;
  method: string;
  origin: "OBSERVED" | "DERIVED";
};
export type OutcomeObservation = {
  decisionId?: string;
  executionRef?: SourceReference;
  metric: string;
  expectedValue: number | string;
  observedValue: number | string;
  unit?: string;
  observedAt: string;
  window: { from: string; to: string };
  assessment: "MET" | "MISSED" | "INCONCLUSIVE";
};
export type SuccessCriterion = {
  metric: string;
  target: number;
  threshold: number;
  comparison: "AT_LEAST" | "AT_MOST" | "EQUAL";
  unit?: string;
};
/** Brain Company context; Definition/Genome projection is deferred. */
export type VentureIntent = {
  mission: string;
  customerProblem: string;
  targetOutcomes: string[];
  economicObjectives: string[];
  constraints: string[];
  priorities: string[];
  nonGoals: string[];
  reviewConditions: string[];
};
export type ObjectiveMeasures = {
  successCriteria: SuccessCriterion[];
  constraints: string[];
  priority: number;
  nonGoals: string[];
  reviewConditions: string[];
};
export type DecisionTraceability = {
  goalIds: string[];
  claimIds: string[];
  evidenceIds: string[];
  assumptions: string[];
  selectedAction: string;
  businessRationale: string;
  expectedOutcomes: string[];
  successThresholds: SuccessCriterion[];
  authorityRef: string;
  reviewConditions: string[];
};
export const LEARNING_MATURITIES = [
  "OBSERVATION",
  "HYPOTHESIS",
  "REPEATED_PATTERN",
  "VALIDATED_ORGANISATIONAL_PRINCIPLE",
] as const;
export type LearningMaturity = (typeof LEARNING_MATURITIES)[number];
export type LearningValidation = {
  id: string;
  at: string;
  actor: string;
  context: string;
  evidenceIds: string[];
  result: "SUPPORTED" | "CHALLENGED" | "INCONCLUSIVE";
};
export type LearningMaturityTransition = {
  from: LearningMaturity;
  to: LearningMaturity;
  at: string;
  actor: string;
  reason: string;
  validationIds: string[];
};
export type LearningKnowledgeObject = KnowledgeObjectKernel & {
  type: "Learning";
  operatingScope: OperatingScope;
  sourceEvidenceIds: string[];
  sourceEventRefs: SourceReference[];
  expectedResult: string;
  actualResult: string;
  deviation: string;
  rootCause: {
    statement: string;
    classification: ClaimClassification;
    evidenceIds: string[];
  };
  lesson: string;
  confidence: KnowledgeConfidence;
  proposedChange: string;
  recordedAt: string;
  maturity: LearningMaturity;
  /** Initial maturity is OBSERVATION; all subsequent changes are explicitly recorded. */
  maturityHistory: LearningMaturityTransition[];
  validationHistory: LearningValidation[];
  validity: KnowledgeValidity;
  supersededById?: string;
  retraction?: KnowledgeRetraction;
};
