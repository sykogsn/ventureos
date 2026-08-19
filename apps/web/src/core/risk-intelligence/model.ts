import type { RiskIntelligence, RiskSignal } from "./types";

export function createRiskIntelligence(input: RiskIntelligence): RiskIntelligence {
  return {
    headline: input.headline,
    signals: [...input.signals],
  };
}

export function primaryRisk(intel: RiskIntelligence): RiskSignal | undefined {
  return intel.signals[0];
}
