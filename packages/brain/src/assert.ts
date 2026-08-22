import { normaliseRelationshipKind } from "./kind";
import { assertOperatingPayload, isOperatingKnowledgeObject } from "./operating";
import {
  isOperatingKnowledgeType,
  KNOWLEDGE_OBJECT_KERNEL_FIELDS,
  KNOWLEDGE_TYPES,
  OPERATING_KNOWLEDGE_TYPES,
} from "./types";
import type { KnowledgeObject, KnowledgeType, OperatingKnowledgeType } from "./types";

function requireText(id: string, field: string, value: string) {
  if (!value.trim()) {
    throw new Error(`Knowledge Object ${id} is missing ${field}.`);
  }
}

export function assertKnowledgeObject(record: KnowledgeObject) {
  requireText(record.id, "id", record.id);
  requireText(record.id, "title", record.title);
  requireText(record.id, "summary", record.summary);
  requireText(record.id, "purpose", record.purpose);
  requireText(record.id, "why", record.why);
  requireText(record.id, "owner", record.owner);
  requireText(record.id, "reviewDate", record.reviewDate);
  requireText(record.id, "lastReview", record.lastReview);
  requireText(record.id, "version", record.version);
  requireText(record.id, "aiContext", record.aiContext);

  if (record.history.length === 0) {
    throw new Error(`Knowledge Object ${record.id} has no history.`);
  }
  if (record.scopes.length === 0) {
    throw new Error(`Knowledge Object ${record.id} has no scopes.`);
  }
  if (isOperatingKnowledgeType(record.type) && record.plane !== "operating") {
    throw new Error(
      `Knowledge Object ${record.id} of type ${record.type} must use the operating plane.`,
    );
  }
  if (
    !isOperatingKnowledgeType(record.type) &&
    record.type !== "Decision" &&
    record.plane !== "institutional"
  ) {
    throw new Error(
      `Knowledge Object ${record.id} of type ${record.type} cannot use the operating plane.`,
    );
  }
  if (record.type === "Decision") {
    if (record.alternatives.length === 0) {
      throw new Error(`Decision ${record.id} has no alternatives.`);
    }
    requireText(record.id, "issuedAt", record.issuedAt);
  }

  for (const field of KNOWLEDGE_OBJECT_KERNEL_FIELDS) {
    if (!(field in record)) {
      throw new Error(`Knowledge Object ${record.id} is missing kernel field ${field}.`);
    }
  }

  for (const rel of record.relationships) {
    requireText(record.id, "relationship objectId", rel.objectId);
    if (rel.kind === undefined) {
      continue;
    }
    const stored = normaliseRelationshipKind(rel.kind);
    if (stored !== rel.kind) {
      throw new Error(
        `Knowledge Object ${record.id} must store relationship kind ${stored}, not ${rel.kind}.`,
      );
    }
  }

  if (isOperatingKnowledgeObject(record)) {
    assertOperatingPayload(record);
  }
}

export function assertOperatingCatalogue(records: KnowledgeObject[]) {
  const ids = new Set<string>();
  const types = new Set<OperatingKnowledgeType>();

  for (const record of records) {
    if (ids.has(record.id)) {
      throw new Error(`Duplicate Knowledge Object id ${record.id}.`);
    }
    ids.add(record.id);
    assertKnowledgeObject(record);
    if (isOperatingKnowledgeObject(record)) {
      types.add(record.type);
      continue;
    }
    if (record.type === "Decision" && record.plane === "operating") {
      continue;
    }
    throw new Error(
      `Operating catalogue cannot include ${record.id} of type ${record.type} on the ${record.plane} plane.`,
    );
  }

  for (const type of OPERATING_KNOWLEDGE_TYPES) {
    if (!types.has(type)) {
      throw new Error(`Operating catalogue has no Knowledge Object of type ${type}.`);
    }
  }

  for (const record of records) {
    for (const rel of record.relationships) {
      if (!ids.has(rel.objectId)) {
        throw new Error(`Broken relationship ${record.id} → ${rel.objectId}.`);
      }
    }
  }
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
    assertKnowledgeObject(record);
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
}
