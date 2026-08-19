import { createCompanyIdentity, createFounderIdentity } from "./model";

export const founderIdentityMock = createFounderIdentity({
  id: "founder-sonny",
  name: "Sonny",
  title: "Founder",
  posture: "Attention is the constraint",
  worldLine:
    "Four companies are compounding without you. Two need a founder call before the week turns.",
});

export const harborIdentityMock = createCompanyIdentity({
  id: "harbor",
  slug: "harbor-pay",
  name: "Harbor Pay",
  href: "/ventures",
  foundedAt: "2025-03-12T09:00:00.000Z",
  category: "SaaS",
  stage: "Early",
  owner: "Sonny",
  hqSummary:
    "Harbor Pay is open. This is the command surface for the company.",
});
