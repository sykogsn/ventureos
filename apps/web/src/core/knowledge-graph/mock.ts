import { createKnowledgeGraphState } from "./model";

export const harborKnowledgeMock = createKnowledgeGraphState({
  nodes: [
    {
      id: "n1",
      kind: "note",
      label: "Venture Genome",
      properties: {
        body: "Harbor Pay is a SaaS company at early stage, pointed at winning first customers. Motion: Prove a paid motion before expanding surface area.",
      },
    },
    {
      id: "n2",
      kind: "note",
      label: "Operating cadence",
      properties: {
        body: "Daily Executive Office briefing, weekly founder review.",
      },
    },
    {
      id: "n3",
      kind: "note",
      label: "Risk posture",
      properties: {
        body: "This company is currently focused. Protect focus until Sprint 1 produces a signal.",
      },
    },
    {
      id: "harbor-node",
      kind: "venture",
      label: "Harbor Pay",
      properties: { slug: "harbor-pay" },
    },
  ],
  edges: [
    {
      id: "e1",
      kind: "derived_from",
      fromId: "n1",
      toId: "harbor-node",
    },
  ],
});
