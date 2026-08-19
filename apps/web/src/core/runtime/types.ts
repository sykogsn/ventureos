import type { PolicyFinding } from "../policy/types";
import type { Venture, VentureIntelligenceCore } from "../venture/types";

export const FOUNDER_DECISION_RECORDED = "FounderDecisionRecorded" as const;
export const COMPANY_FOUNDED = "CompanyFounded" as const;
export const INTELLIGENCE_REFRESH = "IntelligenceRefresh" as const;

export const RUNTIME_MUTATIONS = [
  FOUNDER_DECISION_RECORDED,
  COMPANY_FOUNDED,
] as const;

export type FounderDecisionRecorded = {
  type: typeof FOUNDER_DECISION_RECORDED;
  occurredAt: string;
  decisionId: string;
  ventureId: string;
  ruling: string;
  result?: string;
};

export type CompanyFounded = {
  type: typeof COMPANY_FOUNDED;
  occurredAt: string;
  venture: Venture;
};

export type IntelligenceRefresh = {
  type: typeof INTELLIGENCE_REFRESH;
  occurredAt: string;
};

export type RuntimeEvent =
  | FounderDecisionRecorded
  | CompanyFounded
  | IntelligenceRefresh;

export type IntelligenceSnapshot = {
  core: VentureIntelligenceCore;
  event: RuntimeEvent;
  findings: PolicyFinding[];
  occurredAt: string;
};

export function isRuntimeMutation(
  event: RuntimeEvent,
): event is FounderDecisionRecorded | CompanyFounded {
  return (RUNTIME_MUTATIONS as readonly string[]).includes(event.type);
}
