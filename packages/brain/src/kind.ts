import {
  KNOWLEDGE_RELATIONSHIP_KIND_ALIASES,
  KNOWLEDGE_RELATIONSHIP_KINDS,
  type KnowledgeRelationshipKind,
  type KnowledgeRelationshipKindAlias,
} from "./types";

const storedKinds = new Set<string>(KNOWLEDGE_RELATIONSHIP_KINDS);

function isAlias(value: string): value is KnowledgeRelationshipKindAlias {
  return value in KNOWLEDGE_RELATIONSHIP_KIND_ALIASES;
}

/** Normalise a relationship kind for storage. Does not walk the graph. */
export function normaliseRelationshipKind(value: string): KnowledgeRelationshipKind {
  const kind = value.trim();
  if (kind === "owned_by") {
    throw new Error(
      "Relationship kind owned_by is not stored. Store owns and derive the inverse.",
    );
  }
  if (isAlias(kind)) {
    return KNOWLEDGE_RELATIONSHIP_KIND_ALIASES[kind];
  }
  if (!storedKinds.has(kind)) {
    throw new Error(`Unknown relationship kind ${kind}.`);
  }
  return kind as KnowledgeRelationshipKind;
}
