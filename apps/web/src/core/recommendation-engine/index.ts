export type {
  BriefingImplication,
  ExecutiveBriefing,
  Recommendation,
  RecommendationEngine,
} from "../recommendation/types";
export {
  createExecutiveBriefing,
  createRecommendationEngine,
  primaryRecommendation,
  recommendationsForRole,
} from "../recommendation/model";
export { confidenceLabel as confidenceBand } from "../recommendation/confidence";
