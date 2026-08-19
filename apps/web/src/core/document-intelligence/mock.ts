import { createDocumentIntelligence } from "./model";

export const harborDocumentsMock = createDocumentIntelligence([
  {
    id: "d1",
    title: "Harbor Pay one-pager",
    kind: "Narrative",
    status: "suggested",
    summary: "The sentence the market can repeat.",
  },
  {
    id: "d2",
    title: "Sprint 1 brief",
    kind: "Operating",
    status: "suggested",
    summary: "Constraint, proof, cadence.",
  },
  {
    id: "d3",
    title: "Founder decision log",
    kind: "Governance",
    status: "suggested",
    summary: "Calls already made. Do not reopen them.",
  },
  {
    id: "d4",
    title: "Executive Office charter",
    kind: "Team",
    status: "suggested",
    summary: "Who sits, what they own.",
  },
]);
