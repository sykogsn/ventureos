import type { ExecutiveRoleId } from "../executive-office";
import type { VentureId } from "../shared";

export type RecommendationPriority = "critical" | "high" | "medium" | "low";

export type ConfidenceLabel = "High" | "Moderate" | "Low";

export type EvidenceSource =
  | "health"
  | "mission"
  | "decision"
  | "risk"
  | "memory"
  | "story"
  | "office"
  | "genome"
  | "policy";

export type SupportingEvidence = {
  id: string;
  source: EvidenceSource;
  label: string;
  detail: string;
};

export type ConsensusStance = "agree" | "dissent" | "silent";

export type ConsensusVote = {
  roleId: ExecutiveRoleId;
  role: string;
  stance: ConsensusStance;
  note: string;
};

export type ConsensusLabel = "unanimous" | "strong" | "split" | "weak";

export type ExecutiveConsensus = {
  alignment: number;
  label: ConsensusLabel;
  votes: ConsensusVote[];
};

export type Recommendation = {
  id: string;
  ventureId: VentureId;
  company: string;
  companyHref: string;
  title: string;
  summary: string;
  recommendedAction: string;
  reason: string;
  supportingEvidence: SupportingEvidence[];
  confidence: number;
  confidenceLabel: ConfidenceLabel;
  executiveConsensus: ExecutiveConsensus;
  ownerExecutive: ExecutiveRoleId;
  priority: RecommendationPriority;
  expectedImpact: string;
  estimatedEffort: string;
  actionLabel: string;
  actionHref: string;
  isPrimary: boolean;
  briefing: boolean;
  originatingPolicyId: string;
  originatingPolicyTitle: string;
  policyOwner: ExecutiveRoleId;
  policySeverity: RecommendationPriority;
  findingId: string;
  finding: string;
};

export type BriefingImplicationKind = "opportunity" | "risk" | "outcome";

export type BriefingImplication = {
  id: string;
  ventureId: VentureId;
  company: string;
  kind?: BriefingImplicationKind;
  point: string;
};

export type ExecutiveBriefing = {
  preparedBy: string;
  headline: string;
  narrative: string;
  implications: BriefingImplication[];
};

export type RecommendationEngine = {
  items: Recommendation[];
};

export type RecommendationDraft = Omit<
  Recommendation,
  "confidence" | "confidenceLabel" | "executiveConsensus" | "isPrimary"
> & {
  alliedRoles: ExecutiveRoleId[];
};
