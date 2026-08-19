import type { HealthBand } from "../shared";

export type RiskSeverity = "low" | "moderate" | "high";

export type RiskSignal = {
  id: string;
  title: string;
  severity: RiskSeverity;
  band: HealthBand;
  summary: string;
  mitigation: string;
};

export type RiskIntelligence = {
  headline: string;
  signals: RiskSignal[];
};
