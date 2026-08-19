import type { HealthBand } from "../shared";

export type OperatingHealth = {
  score: number;
  label: string;
  band: HealthBand;
  posture: string;
  summary: string;
  judgement: string;
  ask: string;
  briefWatch: boolean;
};

export type PortfolioHealth = {
  score: number;
  band: HealthBand;
  posture: string;
  verdict: string;
};
