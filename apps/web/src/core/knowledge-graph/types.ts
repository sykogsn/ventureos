import type { NodeId } from "../shared";

export type KnowledgeNodeKind =
  | "founder"
  | "user"
  | "workspace"
  | "venture"
  | "executive"
  | "document"
  | "decision"
  | "risk"
  | "mission"
  | "agent"
  | "note";

export type KnowledgeEdgeKind =
  | "member_of"
  | "owns"
  | "contains"
  | "seated_in"
  | "informs"
  | "mitigates"
  | "related_to"
  | "derived_from";

export type KnowledgeNode = {
  id: NodeId;
  kind: KnowledgeNodeKind;
  label: string;
  properties: Record<string, string>;
};

export type KnowledgeEdge = {
  id: string;
  kind: KnowledgeEdgeKind;
  fromId: NodeId;
  toId: NodeId;
};

export type KnowledgeGraph = {
  nodes: KnowledgeNode[];
  edges: KnowledgeEdge[];
};

export type ReasonQuery = {
  fromId: NodeId;
  relation?: KnowledgeEdgeKind;
  depth?: number;
};

export type ReasonResult = {
  entities: KnowledgeNode[];
  relations: KnowledgeEdge[];
};
