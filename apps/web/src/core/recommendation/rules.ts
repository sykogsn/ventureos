import type { PolicyFinding } from "../policy/types";
import { actionableFindings } from "../policy/model";
import type { RecommendationDraft, SupportingEvidence } from "./types";

function toEvidence(finding: PolicyFinding): SupportingEvidence[] {
  return finding.evidence.map((item) => ({
    id: item.id,
    source: item.source,
    label: item.label,
    detail: item.detail,
  }));
}

export function applyRecommendationRules(
  findings: PolicyFinding[],
): RecommendationDraft[] {
  const drafts = actionableFindings(findings).map((item) => {
    const draft: RecommendationDraft = {
      id: `rec-from-${item.id}`,
      ventureId: item.ventureId,
      company: item.company,
      companyHref: item.companyHref,
      title: item.title,
      summary: item.finding,
      recommendedAction: item.requiredAction,
      reason: item.reason,
      supportingEvidence: toEvidence(item),
      ownerExecutive: item.actingRole,
      priority: item.severity,
      expectedImpact: item.expectedImpact,
      estimatedEffort: item.estimatedEffort,
      actionLabel: item.actionLabel,
      actionHref: item.actionHref,
      briefing: item.briefing,
      alliedRoles: item.alliedRoles,
      originatingPolicyId: item.policyId,
      originatingPolicyTitle: item.policyTitle,
      policyOwner: item.policyOwner,
      policySeverity: item.severity,
      findingId: item.id,
      finding: item.finding,
    };
    return draft;
  });

  const seen = new Set<string>();
  return drafts.filter((item) => {
    if (seen.has(item.id)) {
      return false;
    }
    seen.add(item.id);
    return true;
  });
}
