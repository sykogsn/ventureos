import { resolvedDecisions } from "../decision-engine";
import { briefingMemory } from "../executive-memory";
import { primaryRisk } from "../risk-intelligence";
import type { PolicyFinding } from "../policy/types";
import type { Venture, VentureIntelligenceCore } from "../venture/types";
import type {
  BriefingImplication,
  BriefingImplicationKind,
  ExecutiveBriefing,
  Recommendation,
} from "./types";
import { sortRecommendations } from "./ranking";

export type MorningIntelligence = {
  action?: Recommendation;
  judgement?: Recommendation;
  opportunity?: BriefingImplication;
  risk?: BriefingImplication;
  outcome?: BriefingImplication;
};

function text(value: string | undefined) {
  const next = value?.trim();
  return next ? next : undefined;
}

function firstText(...parts: Array<string | undefined>) {
  for (const part of parts) {
    const next = text(part);
    if (next) {
      return next;
    }
  }
  return undefined;
}

function joinSentences(parts: Array<string | undefined>) {
  const seen = new Set<string>();
  const sentences: string[] = [];
  for (const part of parts) {
    const next = text(part);
    if (!next || seen.has(next)) {
      continue;
    }
    seen.add(next);
    sentences.push(next);
  }
  return sentences.join(" ");
}

function implication(
  kind: BriefingImplicationKind,
  venture: Venture,
  point: string,
): BriefingImplication {
  return {
    id: `${venture.identity.id}-${kind}`,
    ventureId: venture.identity.id,
    company: venture.identity.name,
    kind,
    point,
  };
}

export function selectHighestPriorityAction(
  items: Recommendation[],
): Recommendation | undefined {
  return sortRecommendations(items)[0];
}

export function selectFounderJudgement(
  items: Recommendation[],
): Recommendation | undefined {
  const ranked = sortRecommendations(items);
  return (
    ranked.find(
      (item) =>
        item.ownerExecutive === "founder" &&
        (item.briefing || item.priority === "critical" || item.priority === "high"),
    ) ?? ranked.find((item) => item.ownerExecutive === "founder")
  );
}

function selectOpportunity(
  venture: Venture,
  items: Recommendation[],
): BriefingImplication | undefined {
  const secondary = sortRecommendations(items).find(
    (item) =>
      item.ventureId === venture.identity.id &&
      item.priority !== "critical" &&
      text(item.expectedImpact),
  );
  const point = firstText(
    venture.genome.motion,
    venture.story.promise,
    secondary?.expectedImpact,
    venture.mission.sprint.objective,
  );
  return point ? implication("opportunity", venture, point) : undefined;
}

function selectRisk(
  venture: Venture,
  findings: PolicyFinding[],
): BriefingImplication | undefined {
  const signal = primaryRisk(venture.risk);
  const finding = [...findings]
    .filter((item) => item.ventureId === venture.identity.id)
    .sort((a, b) => {
      const rank = { critical: 0, high: 1, medium: 2, low: 3 };
      return rank[a.severity] - rank[b.severity];
    })[0];
  const point = firstText(
    joinSentences([signal?.title, signal?.summary, signal?.mitigation]),
    venture.risk.headline,
    venture.health.judgement,
    finding?.finding,
  );
  return point ? implication("risk", venture, point) : undefined;
}

function selectOutcome(venture: Venture): BriefingImplication | undefined {
  const resolved = [...resolvedDecisions(venture.decisions)].sort((a, b) =>
    (b.resolvedOn ?? "").localeCompare(a.resolvedOn ?? ""),
  )[0];
  const memory = briefingMemory(venture.memory)[0];
  const point = firstText(
    resolved?.result,
    resolved?.ruling,
    resolved?.title,
    joinSentences([memory?.title, memory?.note]),
    joinSentences([venture.story.chapter, venture.story.excerpt]),
  );
  return point ? implication("outcome", venture, point) : undefined;
}

function focusVenture(
  core: VentureIntelligenceCore,
  action?: Recommendation,
): Venture | undefined {
  if (action) {
    return core.ventures.find((venture) => venture.identity.id === action.ventureId);
  }
  return (
    core.ventures.find((venture) => venture.mission.today.active) ?? core.ventures[0]
  );
}

export function assembleMorningIntelligence(
  core: VentureIntelligenceCore,
): MorningIntelligence {
  const items = core.recommendations.items;
  const action = selectHighestPriorityAction(items);
  const judgement = selectFounderJudgement(items);
  const venture = focusVenture(core, action ?? judgement);
  if (!venture) {
    return { action, judgement };
  }

  const scoped = items.filter((item) => item.ventureId === venture.identity.id);
  return {
    action,
    judgement,
    opportunity: selectOpportunity(venture, scoped),
    risk: selectRisk(venture, core.policy.findings),
    outcome: selectOutcome(venture),
  };
}

export function assembleExecutiveBriefing(
  core: VentureIntelligenceCore,
): ExecutiveBriefing {
  const morning = assembleMorningIntelligence(core);
  const venture = focusVenture(core, morning.action ?? morning.judgement);

  if (!venture) {
    return {
      preparedBy: core.briefing.preparedBy,
      headline: text(core.briefing.headline) ?? core.founder.worldLine,
      narrative:
        text(core.briefing.narrative) ??
        joinSentences([core.founder.posture, core.health.verdict]),
      implications: [],
    };
  }

  const implications = [
    morning.opportunity,
    morning.risk,
    morning.outcome,
  ].filter((item): item is BriefingImplication => Boolean(item));

  return {
    preparedBy: core.briefing.preparedBy,
    headline:
      text(morning.judgement?.recommendedAction) ??
      text(morning.action?.recommendedAction) ??
      text(venture.mission.today.ask) ??
      core.health.verdict,
    narrative: joinSentences([
      morning.judgement?.summary ?? morning.action?.summary,
      venture.health.summary,
      venture.story.tension,
    ]),
    implications,
  };
}
