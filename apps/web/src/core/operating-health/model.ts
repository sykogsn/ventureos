import type { HealthBand } from "../shared";
import type { OperatingHealth, PortfolioHealth } from "./types";

export function createOperatingHealth(input: OperatingHealth): OperatingHealth {
  return { ...input };
}

export function createPortfolioHealth(input: PortfolioHealth): PortfolioHealth {
  return { ...input };
}

export function bandFromScore(score: number): HealthBand {
  if (score >= 80) return "healthy";
  if (score >= 65) return "watch";
  return "risk";
}
