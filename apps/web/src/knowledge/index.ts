export type {
  EntityId,
  EntityKind,
  KnowledgeEntity,
  KnowledgeRelation,
  ReasonQuery,
  ReasonResult,
  RelationKind,
} from "./types";
export {
  isEntityKind,
  isRelationKind,
  listEntityKinds,
  listRelationKinds,
} from "./ontology";
export { createKnowledgeGraph } from "./graph";
export type { KnowledgeGraph } from "./graph";
export { createReasoner } from "./reasoning";
export type { Reasoner } from "./reasoning";
