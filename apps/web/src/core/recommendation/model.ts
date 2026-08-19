import type { ExecutiveRoleId } from "../executive-office";
import type { Venture, VentureIntelligenceCore } from "../venture/types";
import { confidenceLabel, scoreConfidence } from "./confidence";
import { buildConsensus } from "./consensus";
import { evaluateActionablePolicies, hydratePolicyEngine } from "../policy/evaluation";
import { actionableFindings } from "../policy/model";
import type { PolicyFinding } from "../policy/types";
import { applyRecommendationRules } from "./rules";
import { assembleExecutiveBriefing } from "./briefing";
import { mayConsumeBriefing } from "../venture-definition/enforcement";
import { sortRecommendations } from "./ranking";
import type {
  ExecutiveBriefing,
  Recommendation,
  RecommendationDraft,
  RecommendationEngine,
} from "./types";

export function createRecommendationEngine(
  items: Recommendation[],
): RecommendationEngine {
  return { items };
}

export function createExecutiveBriefing(
  input: ExecutiveBriefing,
): ExecutiveBriefing {
  return {
    ...input,
    implications: [...input.implications],
  };
}

export { sortRecommendations } from "./ranking";

export function recommendationsForRole(
  engine: RecommendationEngine,
  roleId: ExecutiveRoleId,
) {
  return sortRecommendations(
    engine.items.filter((item) => item.ownerExecutive === roleId),
  );
}

export function primaryRecommendation(
  engine: RecommendationEngine,
  roleId: ExecutiveRoleId,
) {
  return recommendationsForRole(engine, roleId)[0];
}

export function briefingRecommendations(engine: RecommendationEngine) {
  return sortRecommendations(engine.items.filter((item) => item.briefing));
}

function finalizeDraft(
  core: VentureIntelligenceCore,
  draft: RecommendationDraft,
): Recommendation {
  const venture = core.ventures.find(
    (item) => item.identity.id === draft.ventureId,
  ) as Venture;
  const consensus = buildConsensus(core.office, venture, draft.alliedRoles);
  const memorySupport = draft.supportingEvidence.some(
    (item) => item.source === "memory",
  );
  const decisionOpen = draft.supportingEvidence.some(
    (item) => item.source === "decision",
  );
  const confidence = scoreConfidence({
    evidenceCount: draft.supportingEvidence.length,
    healthBand: venture.health.band,
    consensusAlignment: consensus.alignment,
    memorySupport,
    decisionOpen,
    policySeverity: draft.policySeverity,
  });

  return {
    id: draft.id,
    ventureId: draft.ventureId,
    company: draft.company,
    companyHref: draft.companyHref,
    title: draft.title,
    summary: draft.summary,
    recommendedAction: draft.recommendedAction,
    reason: draft.reason,
    supportingEvidence: draft.supportingEvidence,
    confidence,
    confidenceLabel: confidenceLabel(confidence),
    executiveConsensus: consensus,
    ownerExecutive: draft.ownerExecutive,
    priority: draft.priority,
    expectedImpact: draft.expectedImpact,
    estimatedEffort: draft.estimatedEffort,
    actionLabel: draft.actionLabel,
    actionHref: draft.actionHref,
    isPrimary: false,
    briefing: draft.briefing,
    originatingPolicyId: draft.originatingPolicyId,
    originatingPolicyTitle: draft.originatingPolicyTitle,
    policyOwner: draft.policyOwner,
    policySeverity: draft.policySeverity,
    findingId: draft.findingId,
    finding: draft.finding,
  };
}

function markPrimaries(items: Recommendation[]): Recommendation[] {
  const seen = new Set<ExecutiveRoleId>();
  return sortRecommendations(items).map((item) => {
    if (seen.has(item.ownerExecutive)) {
      return item;
    }
    seen.add(item.ownerExecutive);
    return { ...item, isPrimary: true };
  });
}

export function runRecommendationEngine(
  core: VentureIntelligenceCore,
  findings?: PolicyFinding[],
): Recommendation[] {
  const resolved = findings ?? evaluateActionablePolicies(core);
  const drafts = applyRecommendationRules(resolved);
  return markPrimaries(drafts.map((draft) => finalizeDraft(core, draft)));
}

export function synthesizeBriefing(
  core: VentureIntelligenceCore,
): ExecutiveBriefing {
  return assembleExecutiveBriefing(core);
}

export function hydrateRecommendations(
  core: VentureIntelligenceCore,
): VentureIntelligenceCore {
  const prepared =
    core.policy.library.length > 0 ? core : hydratePolicyEngine(core);
  const findings = actionableFindings(prepared.policy.findings);
  const items = runRecommendationEngine(prepared, findings);
  const recommendations = createRecommendationEngine(items);
  const next: VentureIntelligenceCore = {
    ...prepared,
    recommendations,
    ventures: prepared.ventures.map((venture) => ({
      ...venture,
      recommendations: createRecommendationEngine(
        items.filter((item) => item.ventureId === venture.identity.id),
      ),
    })),
  };

  return {
    ...next,
    briefing: assembleExecutiveBriefing(coreForBriefing(next)),
  };
}

function coreForBriefing(core: VentureIntelligenceCore): VentureIntelligenceCore {
  const ventures = core.ventures.filter(mayConsumeBriefing);
  if (ventures.length === core.ventures.length) {
    return core;
  }
  const allowed = new Set(ventures.map((item) => item.identity.id));
  return {
    ...core,
    ventures,
    recommendations: createRecommendationEngine(
      core.recommendations.items.filter((item) => allowed.has(item.ventureId)),
    ),
  };
}

export function emptyRecommendationEngine() {
  return createRecommendationEngine([]);
}
