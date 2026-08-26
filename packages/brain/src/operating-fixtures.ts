import type {
  BrainVentureScope,
  CompanyKnowledgeObject,
  ContractKnowledgeObject,
  CustomerKnowledgeObject,
  DecisionKnowledgeObject,
  EvidenceKnowledgeObject,
  GoalKnowledgeObject,
  IncidentKnowledgeObject,
  InspectionKnowledgeObject,
  KnowledgeObjectKernel,
  KnowledgeRelationship,
  MeetingKnowledgeObject,
  OperatingDocumentKnowledgeObject,
  PersonKnowledgeObject,
  ProcedureKnowledgeObject,
  ProjectKnowledgeObject,
  ProviderKnowledgeObject,
  RiskKnowledgeObject,
  TaskKnowledgeObject,
} from "./types";

function kernel(
  id: string,
  title: string,
  related: KnowledgeRelationship[] = [],
): Omit<KnowledgeObjectKernel, "type"> {
  const scopes: BrainVentureScope[] = ["Qualora"];
  return {
    id,
    plane: "operating" as const,
    title,
    summary: `${title} operating fixture.`,
    purpose: `Hold the ${title} operating type.`,
    why: "Operating types share the kernel. They are not a second schema.",
    evidence: ["BRAIN-001 §6.3"],
    relationships: related,
    history: [{ at: "2026-08-22", note: "Operating fixture." }],
    owner: "Founder",
    status: "Specified" as const,
    reviewDate: "2026-08-22",
    lastReview: "2026-08-22",
    version: "1.0.0",
    aiContext: `${title} is organisational fact. Not a screen and not a Runtime event.`,
    scopes,
  };
}

/** Correlates with a venture identity id. Does not write VIC. */
export const operatingCompany: CompanyKnowledgeObject = {
  ...kernel("north-star", "Company", [{ objectId: "person-founder", kind: "owns" }]),
  type: "Company",
  legalName: "North Star Limited",
  operatingName: "North Star",
  definitionRef: "qualora@0.4.0",
  workspaceId: "ws-desk",
  stage: "incubating",
  genomePointers: ["quality-operations"],
};

export const operatingPerson: PersonKnowledgeObject = {
  ...kernel("person-founder", "Person", [{ objectId: "north-star" }]),
  type: "Person",
  role: "Founder",
  remit: "Decide from the desk.",
  companyId: "north-star",
  identityId: "user-founder",
};

export const operatingProcedure: ProcedureKnowledgeObject = {
  ...kernel("procedure-inspect", "Procedure", [{ objectId: "north-star", kind: "depends_on" }]),
  type: "Procedure",
  steps: ["Prepare evidence.", "Record the inspection.", "File the outcome."],
};

export const operatingEvidence: EvidenceKnowledgeObject = {
  ...kernel("evidence-audit", "Evidence", [{ objectId: "risk-capacity", kind: "evidence_for" }]),
  type: "Evidence",
  source: "Capacity audit",
  capturedAt: "2026-08-22",
  supportsObjectId: "risk-capacity",
  weightClass: "Primary",
};

export const operatingMeeting: MeetingKnowledgeObject = {
  ...kernel("meeting-standup", "Meeting", [{ objectId: "person-founder" }]),
  type: "Meeting",
  occurredAt: "2026-08-22T09:00:00Z",
  attendeeIds: ["person-founder"],
  decisionIds: ["decision-capacity"],
};

/** Same Decision type as the institutional kernel. Operating plane only. */
export const operatingDecision: DecisionKnowledgeObject = {
  ...kernel("decision-capacity", "Open capacity", [{ objectId: "risk-capacity", kind: "supports" }]),
  type: "Decision",
  impact: "Product",
  alternatives: ["Hire", "Defer"],
  issuedAt: "2026-08-22",
};

export const operatingRisk: RiskKnowledgeObject = {
  ...kernel("risk-capacity", "Risk", [{ objectId: "north-star" }]),
  type: "Risk",
  headline: "Capacity is thin.",
  signal: "Inspection backlog.",
  mitigation: "Staff the next inspection.",
};

export const operatingTask: TaskKnowledgeObject = {
  ...kernel("task-staff", "Task", [{ objectId: "goal-coverage", kind: "depends_on" }]),
  type: "Task",
  outcome: "Seat an inspector.",
  blockerIds: [],
};

export const operatingGoal: GoalKnowledgeObject = {
  ...kernel("goal-coverage", "Goal", [{ objectId: "north-star" }]),
  type: "Goal",
  objective: "Cover the inspection cadence.",
  horizon: "2026-Q3",
  taskIds: ["task-staff"],
};

export const operatingProject: ProjectKnowledgeObject = {
  ...kernel("project-coverage", "Project", [{ objectId: "north-star" }]),
  type: "Project",
  companyId: "north-star",
  outcome: "Inspection programme standing.",
  goalIds: ["goal-coverage"],
};

export const operatingIncident: IncidentKnowledgeObject = {
  ...kernel("incident-missed", "Incident", [{ objectId: "evidence-audit" }]),
  type: "Incident",
  whatBroke: "A booked inspection was missed.",
  evidenceIds: ["evidence-audit"],
  followUpDecisionIds: ["decision-capacity"],
};

export const operatingProvider: ProviderKnowledgeObject = {
  ...kernel("provider-labs", "Provider", [{ objectId: "north-star" }]),
  type: "Provider",
  supplies: "Assay capacity",
  contractIds: ["contract-labs"],
  inspectionIds: ["inspection-labs"],
};

export const operatingInspection: InspectionKnowledgeObject = {
  ...kernel("inspection-labs", "Inspection", [{ objectId: "evidence-audit", kind: "evidence_for" }]),
  type: "Inspection",
  subjectId: "provider-labs",
  outcome: "Passed with notes.",
  evidenceIds: ["evidence-audit"],
  nextDue: "2026-11-22",
};

export const operatingCustomer: CustomerKnowledgeObject = {
  ...kernel("customer-atlas", "Customer", [{ objectId: "north-star" }]),
  type: "Customer",
  companyId: "north-star",
  relationship: "Anchor account. Not a CRM record.",
};

export const operatingContract: ContractKnowledgeObject = {
  ...kernel("contract-labs", "Contract", [{ objectId: "provider-labs" }]),
  type: "Contract",
  partyIds: ["north-star", "provider-labs"],
  term: "2026-08-22/2027-08-21",
  obligations: "Provide assay capacity on the stated cadence.",
  evidenceIds: ["evidence-audit"],
};

export const operatingDocument: OperatingDocumentKnowledgeObject = {
  ...kernel("document-protocol", "Document", [{ objectId: "procedure-inspect" }]),
  type: "Document",
  kind: "protocol",
  documentStatus: "live",
  evidenceOfIds: ["procedure-inspect"],
};

export const operatingKernelCatalogue = [
  operatingCompany,
  operatingPerson,
  operatingProcedure,
  operatingEvidence,
  operatingMeeting,
  operatingDecision,
  operatingRisk,
  operatingTask,
  operatingGoal,
  operatingProject,
  operatingIncident,
  operatingProvider,
  operatingInspection,
  operatingCustomer,
  operatingContract,
  operatingDocument,
];
