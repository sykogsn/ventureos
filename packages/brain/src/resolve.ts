import type { KnowledgeObject, KnowledgeRelationshipKind } from "./types";

export type ResolvedRelationship = {
  objectId: string;
  kind?: KnowledgeRelationshipKind;
  object: KnowledgeObject | null;
};

/** Resolve incident ids. This is not a graph walk. */
export function resolveRelationships(
  object: KnowledgeObject,
  records: KnowledgeObject[],
): ResolvedRelationship[] {
  const byId = new Map(records.map((item) => [item.id, item]));
  return object.relationships.map((rel) => ({
    objectId: rel.objectId,
    kind: rel.kind,
    object: byId.get(rel.objectId) ?? null,
  }));
}

export function isDecision(
  object: KnowledgeObject,
): object is Extract<KnowledgeObject, { type: "Decision" }> {
  return object.type === "Decision";
}

export function listByType(type: KnowledgeObject["type"], records: KnowledgeObject[]) {
  return records.filter((item) => item.type === type);
}

export function listDecisions(records: KnowledgeObject[]) {
  return records.filter(isDecision);
}
