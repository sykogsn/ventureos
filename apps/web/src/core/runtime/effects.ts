import { createCompanyStory } from "../company-story";
import {
  createDecisionEngine,
  resolveDecision,
  type Decision,
} from "../decision-engine";
import { createExecutiveMemory, type MemoryRecord } from "../executive-memory";
import { createKnowledgeGraphState } from "../knowledge-graph";
import {
  bandFromScore,
  createOperatingHealth,
  createPortfolioHealth,
} from "../operating-health";
import type { Recommendation } from "../recommendation/types";
import type { Venture, VentureIntelligenceCore } from "../venture/types";
import {
  COMPANY_FOUNDED,
  FOUNDER_DECISION_RECORDED,
  type CompanyFounded,
  type RuntimeEvent,
} from "./types";

function findVenture(core: VentureIntelligenceCore, id: string) {
  return core.ventures.find(
    (venture) => venture.identity.id === id || venture.identity.slug === id,
  );
}

function replaceDecision(items: Decision[], next: Decision) {
  const exists = items.some((item) => item.id === next.id);
  if (!exists) {
    return [...items, next];
  }
  return items.map((item) => (item.id === next.id ? next : item));
}

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function healthLabel(band: ReturnType<typeof bandFromScore>) {
  if (band === "healthy") return "Healthy";
  if (band === "watch") return "Watch";
  return "Risk";
}

function decisionFromRecommendation(
  rec: Recommendation,
  decisionId: string,
): Decision {
  return {
    id: decisionId,
    ventureId: rec.ventureId,
    company: rec.company,
    companyHref: rec.companyHref,
    ownerRoleId: rec.ownerExecutive,
    question: rec.title,
    title: rec.title,
    recommendation: rec.recommendedAction,
    costOfInaction: rec.expectedImpact,
    decideBy: rec.estimatedEffort,
    actionLabel: rec.actionLabel,
    actionHref: rec.actionHref,
    status: "upcoming",
    briefing: rec.briefing,
  };
}

function locateDecision(
  core: VentureIntelligenceCore,
  venture: Venture,
  decisionId: string,
): Decision | undefined {
  return (
    venture.decisions.items.find((item) => item.id === decisionId) ??
    core.decisions.items.find((item) => item.id === decisionId)
  );
}

function locateRecommendation(
  core: VentureIntelligenceCore,
  venture: Venture,
  decisionId: string,
) {
  return (
    venture.recommendations.items.find((item) => item.id === decisionId) ??
    core.recommendations.items.find(
      (item) => item.id === decisionId || item.findingId === decisionId,
    )
  );
}

function memoryForDecision(decision: Decision, occurredAt: string): MemoryRecord {
  return {
    id: `mem-${decision.id}`,
    ventureId: decision.ventureId,
    ownerRoleId: "founder",
    recalledFrom: occurredAt,
    title: decision.title,
    note: decision.ruling ?? decision.recommendation,
    implication: decision.result ?? decision.costOfInaction,
    briefing: true,
    desk: true,
  };
}

function applyResolvedDecision(
  core: VentureIntelligenceCore,
  venture: Venture,
  resolved: Decision,
  wasOpen: boolean,
): VentureIntelligenceCore {
  const ventureDecisions = createDecisionEngine(
    replaceDecision(venture.decisions.items, resolved),
  );
  const coreDecisions = createDecisionEngine(
    replaceDecision(core.decisions.items, resolved),
  );
  const memoryRecord = memoryForDecision(resolved, resolved.resolvedOn ?? "");
  const hasMemory = venture.memory.records.some((item) => item.id === memoryRecord.id);
  const memory = hasMemory
    ? venture.memory
    : createExecutiveMemory([memoryRecord, ...venture.memory.records]);

  const nextScore = wasOpen
    ? clampScore(venture.health.score + 6)
    : venture.health.score;
  const band = bandFromScore(nextScore);
  const health = createOperatingHealth({
    ...venture.health,
    score: nextScore,
    band,
    label: healthLabel(band),
    posture: wasOpen ? "Call recorded" : venture.health.posture,
    judgement: resolved.ruling
      ? `Founder ruling: ${resolved.ruling}`
      : venture.health.judgement,
    summary: resolved.result ?? venture.health.summary,
    briefWatch: ventureDecisions.items.some((item) => item.status === "upcoming"),
  });

  const story = wasOpen
    ? createCompanyStory({
        ...venture.story,
        chapter:
          venture.story.chapter === "Founding" ? "First call" : venture.story.chapter,
        tension: `The founder recorded a call: ${resolved.ruling ?? resolved.recommendation}`,
      })
    : venture.story;

  const nextVenture: Venture = {
    ...venture,
    decisions: ventureDecisions,
    memory,
    health,
    story,
  };

  return {
    ...core,
    decisions: coreDecisions,
    ventures: core.ventures.map((item) =>
      item.identity.id === venture.identity.id ? nextVenture : item,
    ),
  };
}

export function applyRuntimeEvent(
  core: VentureIntelligenceCore,
  event: RuntimeEvent,
): VentureIntelligenceCore {
  if (event.type === COMPANY_FOUNDED) {
    return applyCompanyFounded(core, event);
  }

  if (event.type !== FOUNDER_DECISION_RECORDED) {
    return core;
  }

  if (!event.ruling) {
    throw new Error("A founder ruling is required.");
  }

  const venture = findVenture(core, event.ventureId);
  if (!venture) {
    throw new Error("That company is not in this workspace.");
  }

  const existing = locateDecision(core, venture, event.decisionId);
  const source =
    existing ??
    (() => {
      const rec = locateRecommendation(core, venture, event.decisionId);
      return rec ? decisionFromRecommendation(rec, event.decisionId) : undefined;
    })();

  if (!source) {
    throw new Error("No decision or recommendation matches that call.");
  }

  const wasOpen = source.status === "upcoming";
  const resolved = resolveDecision(source, {
    ruling: event.ruling,
    result: event.result,
    resolvedOn: event.occurredAt,
  });

  return applyResolvedDecision(core, venture, resolved, wasOpen);
}

export function refreshOperatingHealth(
  core: VentureIntelligenceCore,
): VentureIntelligenceCore {
  const ventures = core.ventures.map((venture) => {
    const rec = venture.recommendations.items[0];
    const open = venture.decisions.items.some((item) => item.status === "upcoming");
    const band = bandFromScore(venture.health.score);
    return {
      ...venture,
      health: createOperatingHealth({
        ...venture.health,
        band,
        label: healthLabel(band),
        ask: rec?.recommendedAction ?? venture.health.ask,
        briefWatch: open || band !== "healthy",
      }),
    };
  });

  if (ventures.length === 0) {
    return {
      ...core,
      ventures,
      health: createPortfolioHealth({
        score: 0,
        band: "watch",
        posture: "Empty",
        verdict: "No companies are in this workspace yet.",
      }),
    };
  }

  const score = clampScore(
    ventures.reduce((sum, venture) => sum + venture.health.score, 0) / ventures.length,
  );
  const band = bandFromScore(score);
  const watches = ventures.filter((venture) => venture.health.briefWatch).length;

  return {
    ...core,
    ventures,
    health: createPortfolioHealth({
      score,
      band,
      posture: watches > 0 ? "Stable — with watches" : healthLabel(band),
      verdict:
        core.briefing.headline ||
        (watches > 0
          ? "The portfolio has open founder calls. Record them before adding work."
          : "No founder call is queued."),
    }),
  };
}

function foundingMemory(venture: Venture, occurredAt: string): MemoryRecord {
  return {
    id: `mem-founded-${venture.identity.id}`,
    ventureId: venture.identity.id,
    ownerRoleId: "founder",
    recalledFrom: occurredAt,
    title: `${venture.identity.name} was founded`,
    note: venture.genome.thesis,
    implication: "Sprint 1 is the policy until evidence exists.",
    briefing: true,
    desk: true,
  };
}

function applyCompanyFounded(
  core: VentureIntelligenceCore,
  event: CompanyFounded,
): VentureIntelligenceCore {
  const existing = findVenture(core, event.venture.identity.id);
  if (existing) {
    return core;
  }

  const memoryRecord = foundingMemory(event.venture, event.occurredAt);
  const hasMemory = event.venture.memory.records.some(
    (item) => item.id === memoryRecord.id,
  );
  const venture: Venture = {
    ...event.venture,
    memory: hasMemory
      ? event.venture.memory
      : createExecutiveMemory([memoryRecord, ...event.venture.memory.records]),
    story: createCompanyStory({
      ...event.venture.story,
      chapter: event.venture.story.chapter || "Founding",
      tension:
        event.venture.story.tension || "Sprint 1 is the next sentence.",
    }),
  };

  return {
    ...core,
    ventures: [...core.ventures, venture],
  };
}

export function refreshKnowledgeGraph(
  core: VentureIntelligenceCore,
): VentureIntelligenceCore {
  return {
    ...core,
    ventures: core.ventures.map((venture) => {
      const nodeId = venture.identity.id;
      const hasNode = venture.knowledge.nodes.some((node) => node.id === nodeId);
      const edgeId = `owns-${core.founder.id}-${nodeId}`;
      const hasEdge = venture.knowledge.edges.some((edge) => edge.id === edgeId);
      return {
        ...venture,
        knowledge: createKnowledgeGraphState({
          nodes: hasNode
            ? venture.knowledge.nodes
            : [
                ...venture.knowledge.nodes,
                {
                  id: nodeId,
                  kind: "venture",
                  label: venture.identity.name,
                  properties: {
                    slug: venture.identity.slug,
                    stage: venture.identity.stage,
                  },
                },
              ],
          edges: hasEdge
            ? venture.knowledge.edges
            : [
                ...venture.knowledge.edges,
                {
                  id: edgeId,
                  kind: "owns",
                  fromId: core.founder.id,
                  toId: nodeId,
                },
              ],
        }),
      };
    }),
  };
}
