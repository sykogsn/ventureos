export type GenomePosture = "ai-native" | "human-led";

export type GenomeRisk = "exploratory" | "focused" | "scaling";

export type VentureGenome = {
  thesis: string;
  category: string;
  stage: string;
  goal: string;
  posture: GenomePosture;
  risk: GenomeRisk;
  motion: string;
  cadence: string;
};
