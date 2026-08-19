import type { KnowledgeGraph, KnowledgeNode } from "./types";

export function createKnowledgeGraphState(
  graph: KnowledgeGraph,
): KnowledgeGraph {
  return {
    nodes: [...graph.nodes],
    edges: [...graph.edges],
  };
}

export function knowledgeNotes(graph: KnowledgeGraph) {
  return graph.nodes.filter((node) => node.kind === "note");
}

export function noteBody(node: KnowledgeNode) {
  return node.properties.body ?? "";
}
