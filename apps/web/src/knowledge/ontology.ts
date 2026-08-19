import type { EntityKind, RelationKind } from "./types";

const entityKinds = new Set<EntityKind>([
  "founder",
  "user",
  "workspace",
  "venture",
  "executive",
  "document",
  "decision",
  "risk",
  "mission",
  "agent",
  "note",
]);

const relationKinds = new Set<RelationKind>([
  "member_of",
  "owns",
  "contains",
  "seated_in",
  "informs",
  "mitigates",
  "related_to",
  "derived_from",
]);

export function listEntityKinds() {
  return [...entityKinds];
}

export function listRelationKinds() {
  return [...relationKinds];
}

export function isEntityKind(value: string): value is EntityKind {
  return entityKinds.has(value as EntityKind);
}

export function isRelationKind(value: string): value is RelationKind {
  return relationKinds.has(value as RelationKind);
}
