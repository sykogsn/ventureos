import { createVentureGenome } from "./model";

export const harborGenomeMock = createVentureGenome({
  thesis:
    "Harbor Pay is a SaaS company at early stage, pointed at winning first customers.",
  category: "SaaS",
  stage: "Early",
  goal: "Win first customers",
  posture: "ai-native",
  risk: "focused",
  motion: "Prove a paid motion before expanding surface area.",
  cadence: "Daily Executive Office briefing, weekly founder review.",
});
