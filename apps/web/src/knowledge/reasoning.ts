import type { KnowledgeGraph } from "./graph";
import type { ReasonQuery, ReasonResult } from "./types";

export type Reasoner = {
  expand(query: ReasonQuery): ReasonResult;
};

export function createReasoner(graph: KnowledgeGraph): Reasoner {
  return {
    expand(query) {
      return graph.neighbors(query);
    },
  };
}
