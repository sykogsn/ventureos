import type { Recommendation, RecommendationPriority } from "@/core/recommendation/types";
import type { ConfidenceLabel } from "@/core/recommendation/types";
import type { HealthBand } from "@/core/shared";
import type { CriticalDecisionView, SituationRoomModel } from "@/core/venture/views";
import type { ConfidenceLevel } from "@/modules/frontend-foundation/signal";
import type { WorkshopStatusLevel } from "@/modules/frontend-foundation/mapping";
import type {
  AttentionMatter,
  ExecutiveWorkspacePresentation,
  JudgementPresentation,
  PresentationEvidence,
  WatchPresentation,
} from "./types";

function mapConfidence(label?: ConfidenceLabel): ConfidenceLevel | undefined {
  if (label === "High") {
    return "high";
  }
  if (label === "Moderate") {
    return "moderate";
  }
  if (label === "Low") {
    return "low";
  }
  return undefined;
}

function mapPriority(priority?: RecommendationPriority | string): WorkshopStatusLevel {
  if (priority === "critical") {
    return "critical";
  }
  if (priority === "high") {
    return "high";
  }
  if (priority === "medium") {
    return "medium";
  }
  return "neutral";
}

function mapHealthBand(band: HealthBand): WorkshopStatusLevel {
  if (band === "risk") {
    return "critical";
  }
  if (band === "watch") {
    return "high";
  }
  return "positive";
}

function mapEvidence(items: Recommendation["supportingEvidence"] | undefined): PresentationEvidence[] {
  if (!items) {
    return [];
  }

  return items.map((item) => ({
    id: item.id,
    label: item.label,
    detail: item.detail,
    source: item.source,
  }));
}

function mapPrimary(
  decision: CriticalDecisionView,
  recommendation: Recommendation | undefined,
): JudgementPresentation {
  const significance = decision.finding ?? recommendation?.reason ?? recommendation?.summary;

  return {
    id: decision.id,
    ventureId: decision.ventureId,
    company: decision.company,
    companyHref: decision.companyHref,
    issue: decision.question,
    significance,
    decision: decision.recommendation,
    costOfInaction: decision.costOfInaction,
    severity: mapPriority(decision.policySeverity ?? recommendation?.priority),
    confidence: mapConfidence(recommendation?.confidenceLabel),
    evidence: mapEvidence(recommendation?.supportingEvidence),
    actionLabel: decision.actionLabel,
    actionHref: decision.actionHref,
    ruling: decision.ruling,
    policyTitle: decision.originatingPolicyTitle,
  };
}

function mapAttention(item: Recommendation): AttentionMatter | null {
  if (!item.title || !item.recommendedAction) {
    return null;
  }

  return {
    id: item.id,
    company: item.company,
    companyHref: item.companyHref,
    issue: item.title,
    decision: item.recommendedAction,
    significance: item.reason || item.summary || undefined,
    severity: mapPriority(item.priority),
    confidence: mapConfidence(item.confidenceLabel),
    evidence: mapEvidence(item.supportingEvidence),
    actionLabel: item.actionLabel,
    actionHref: item.actionHref,
  };
}

function mapWatch(watch: SituationRoomModel["health"]["watches"][number]): WatchPresentation {
  return {
    id: watch.id,
    company: watch.company,
    companyHref: watch.companyHref,
    judgement: watch.judgement,
    ask: watch.ask,
    band: mapHealthBand(watch.band),
  };
}

export function adaptExecutiveWorkspace(input: {
  room: SituationRoomModel;
  recommendations: Recommendation[];
}): ExecutiveWorkspacePresentation {
  const primaryDecision = input.room.decisions[0] ?? null;
  const matching = primaryDecision
    ? input.recommendations.find((item) => item.id === primaryDecision.id)
    : undefined;
  const primary = primaryDecision ? mapPrimary(primaryDecision, matching) : null;
  const primaryId = primary?.id;

  const attention = input.recommendations
    .filter((item) => item.id !== primaryId)
    .map(mapAttention)
    .filter((item): item is AttentionMatter => item !== null);

  return {
    founderName: input.room.header.founderName,
    posture: input.room.header.posture,
    worldLine: input.room.header.worldLine,
    brief: {
      headline: input.room.briefing.headline,
      narrative: input.room.briefing.narrative,
      implications: input.room.briefing.implications.map((item) => item.point),
    },
    primary,
    attention,
    watches: input.room.health.watches.map(mapWatch),
  };
}
