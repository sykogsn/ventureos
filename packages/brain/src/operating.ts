import {
  EVIDENCE_WEIGHT_CLASSES,
  OPERATING_DOCUMENT_STATUSES,
  isOperatingKnowledgeType,
  type EvidenceWeightClass,
  type KnowledgeObject,
  type OperatingDocumentStatus,
  type OperatingKnowledgeObject,
} from "./types";

const evidenceWeights = new Set<string>(EVIDENCE_WEIGHT_CLASSES);
const documentStatuses = new Set<string>(OPERATING_DOCUMENT_STATUSES);

export function isOperatingKnowledgeObject(
  object: KnowledgeObject,
): object is OperatingKnowledgeObject {
  return isOperatingKnowledgeType(object.type);
}

function requireText(id: string, field: string, value: string) {
  if (!value.trim()) {
    throw new Error(`Knowledge Object ${id} is missing ${field}.`);
  }
}

function requireIds(id: string, field: string, values: string[]) {
  if (values.some((item) => !item.trim())) {
    throw new Error(`Knowledge Object ${id} has an empty ${field} entry.`);
  }
}

export function assertOperatingPayload(record: OperatingKnowledgeObject) {
  switch (record.type) {
    case "Company":
      requireText(record.id, "legalName", record.legalName);
      requireText(record.id, "operatingName", record.operatingName);
      requireText(record.id, "definitionRef", record.definitionRef);
      requireText(record.id, "workspaceId", record.workspaceId);
      requireText(record.id, "stage", record.stage);
      return;
    case "Person":
      requireText(record.id, "role", record.role);
      requireText(record.id, "remit", record.remit);
      requireText(record.id, "companyId", record.companyId);
      return;
    case "Procedure":
      if (record.steps.length === 0) {
        throw new Error(`Procedure ${record.id} has no steps.`);
      }
      requireIds(record.id, "steps", record.steps);
      return;
    case "Evidence":
      requireText(record.id, "source", record.source);
      requireText(record.id, "capturedAt", record.capturedAt);
      requireText(record.id, "supportsObjectId", record.supportsObjectId);
      if (!evidenceWeights.has(record.weightClass)) {
        throw new Error(`Evidence ${record.id} has an unknown weight class.`);
      }
      return;
    case "Meeting":
      requireText(record.id, "occurredAt", record.occurredAt);
      requireIds(record.id, "attendeeIds", record.attendeeIds);
      requireIds(record.id, "decisionIds", record.decisionIds);
      return;
    case "Risk":
      requireText(record.id, "headline", record.headline);
      requireText(record.id, "signal", record.signal);
      requireText(record.id, "mitigation", record.mitigation);
      return;
    case "Task":
      requireText(record.id, "outcome", record.outcome);
      requireIds(record.id, "blockerIds", record.blockerIds);
      return;
    case "Goal":
      requireText(record.id, "objective", record.objective);
      requireText(record.id, "horizon", record.horizon);
      requireIds(record.id, "taskIds", record.taskIds);
      return;
    case "Project":
      requireText(record.id, "companyId", record.companyId);
      requireText(record.id, "outcome", record.outcome);
      requireIds(record.id, "goalIds", record.goalIds);
      return;
    case "Incident":
      requireText(record.id, "whatBroke", record.whatBroke);
      requireIds(record.id, "evidenceIds", record.evidenceIds);
      requireIds(record.id, "followUpDecisionIds", record.followUpDecisionIds);
      return;
    case "Provider":
      requireText(record.id, "supplies", record.supplies);
      requireIds(record.id, "contractIds", record.contractIds);
      requireIds(record.id, "inspectionIds", record.inspectionIds);
      return;
    case "Inspection":
      requireText(record.id, "subjectId", record.subjectId);
      requireText(record.id, "outcome", record.outcome);
      requireText(record.id, "nextDue", record.nextDue);
      requireIds(record.id, "evidenceIds", record.evidenceIds);
      return;
    case "Customer":
      requireText(record.id, "companyId", record.companyId);
      requireText(record.id, "relationship", record.relationship);
      return;
    case "Contract":
      if (record.partyIds.length === 0) {
        throw new Error(`Contract ${record.id} has no parties.`);
      }
      requireIds(record.id, "partyIds", record.partyIds);
      requireText(record.id, "term", record.term);
      requireText(record.id, "obligations", record.obligations);
      requireIds(record.id, "evidenceIds", record.evidenceIds);
      return;
    case "Document":
      requireText(record.id, "kind", record.kind);
      if (!documentStatuses.has(record.documentStatus)) {
        throw new Error(`Document ${record.id} has an unknown document status.`);
      }
      requireIds(record.id, "evidenceOfIds", record.evidenceOfIds);
      return;
  }
}

export function isEvidenceWeightClass(value: string): value is EvidenceWeightClass {
  return evidenceWeights.has(value);
}

export function isOperatingDocumentStatus(value: string): value is OperatingDocumentStatus {
  return documentStatuses.has(value);
}
