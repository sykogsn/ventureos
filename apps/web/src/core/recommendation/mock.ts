import type { VentureIntelligenceCore } from "../venture/types";
import { hydrateRecommendations } from "./model";
import type { Recommendation } from "./types";

export function recommendationMockFrom(
  core: VentureIntelligenceCore,
): Recommendation[] {
  return hydrateRecommendations(core).recommendations.items;
}
