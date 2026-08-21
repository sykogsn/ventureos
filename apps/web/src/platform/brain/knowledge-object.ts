import type {
  DecisionKnowledgeObject,
  GovernanceInstrument,
  KnowledgeObject,
  KnowledgeType,
} from "./types";
import { GOVERNANCE_CARDS, KNOWLEDGE_TYPES } from "./types";

export function knowledgeObjectHref(id: string) {
  return `/brain/library/${id}`;
}

export function isDecision(object: KnowledgeObject): object is DecisionKnowledgeObject {
  return object.type === "Decision";
}

export function listByType(type: KnowledgeType, records: KnowledgeObject[]) {
  return records.filter((item) => item.type === type);
}

export function listDecisions(records: KnowledgeObject[]) {
  return records.filter(isDecision);
}

export function resolveRelationships(object: KnowledgeObject, records: KnowledgeObject[]) {
  const byId = new Map(records.map((item) => [item.id, item]));
  return object.relationships.map((rel) => ({
    objectId: rel.objectId,
    object: byId.get(rel.objectId) ?? null,
  }));
}

export function listGovernance(records: KnowledgeObject[]): GovernanceInstrument[] {
  const byId = new Map(records.map((item) => [item.id, item]));
  return GOVERNANCE_CARDS.map((card) => {
    const object = byId.get(card.objectId);
    if (!object) {
      throw new Error(`Governance card is missing Knowledge Object ${card.objectId}.`);
    }
    return {
      id: object.id,
      title: card.title,
      status: object.status,
      version: object.version,
      owner: object.owner,
      lastReview: object.lastReview,
      href: knowledgeObjectHref(object.id),
    };
  });
}

export function assertKnowledgeCatalogue(records: KnowledgeObject[]) {
  const ids = new Set<string>();
  const types = new Set<KnowledgeType>();

  for (const record of records) {
    if (ids.has(record.id)) {
      throw new Error(`Duplicate Knowledge Object id ${record.id}.`);
    }
    ids.add(record.id);
    types.add(record.type);

    if (!record.title.trim() || !record.summary.trim() || !record.purpose.trim() || !record.why.trim()) {
      throw new Error(`Knowledge Object ${record.id} is missing a required layout field.`);
    }
    if (!record.aiContext.trim()) {
      throw new Error(`Knowledge Object ${record.id} is missing AI context.`);
    }
    if (record.history.length === 0) {
      throw new Error(`Knowledge Object ${record.id} has no history.`);
    }
  }

  for (const type of KNOWLEDGE_TYPES) {
    if (!types.has(type)) {
      throw new Error(`Catalogue has no Knowledge Object of type ${type}.`);
    }
  }

  for (const record of records) {
    for (const rel of record.relationships) {
      if (!ids.has(rel.objectId)) {
        throw new Error(`Broken relationship ${record.id} → ${rel.objectId}.`);
      }
    }
  }

  for (const card of GOVERNANCE_CARDS) {
    if (!ids.has(card.objectId)) {
      throw new Error(`Governance card ${card.title} is missing object ${card.objectId}.`);
    }
  }
}
