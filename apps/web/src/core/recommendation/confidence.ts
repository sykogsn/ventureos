import type { ConfidenceLabel, ConsensusLabel, RecommendationPriority } from "./types";
import type { HealthBand } from "../shared";

export function confidenceLabel(score: number): ConfidenceLabel {
  if (score >= 80) return "High";
  if (score >= 60) return "Moderate";
  return "Low";
}

export function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function scoreConfidence(input: {
  evidenceCount: number;
  healthBand: HealthBand;
  consensusAlignment: number;
  memorySupport: boolean;
  decisionOpen: boolean;
  policySeverity: RecommendationPriority;
}): number {
  let score = 48 + input.evidenceCount * 6;

  if (input.healthBand === "risk") score += 8;
  if (input.healthBand === "watch") score += 4;
  if (input.decisionOpen) score += 10;
  if (input.memorySupport) score += 8;
  if (input.policySeverity === "critical") score += 10;
  if (input.policySeverity === "high") score += 6;
  if (input.policySeverity === "medium") score += 3;

  score += Math.round(input.consensusAlignment * 0.18);

  return clampScore(score);
}

export function consensusLabel(alignment: number): ConsensusLabel {
  if (alignment >= 90) return "unanimous";
  if (alignment >= 70) return "strong";
  if (alignment >= 45) return "split";
  return "weak";
}
