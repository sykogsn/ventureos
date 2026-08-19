import type { Recommendation, RecommendationPriority } from "./types";

const priorityRank: Record<RecommendationPriority, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

export function sortRecommendations(items: Recommendation[]) {
  return [...items].sort(
    (a, b) =>
      Number(b.isPrimary) - Number(a.isPrimary) ||
      priorityRank[a.priority] - priorityRank[b.priority] ||
      b.confidence - a.confidence,
  );
}
