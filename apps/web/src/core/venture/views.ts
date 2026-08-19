import type { AttentionWindow, HealthBand } from "../shared";
import type { ExecutiveRoleId, OperatingStatus } from "../executive-office";
import type { Recommendation } from "../recommendation/types";

export type SituationHeader = {
  founderName: string;
  posture: string;
  worldLine: string;
};

export type TodaysMissionView = {
  company: string;
  companyHref: string;
  title: string;
  ask: string;
  whyNow: string;
  ifDeferred: string;
  timeNeeded: string;
  actionLabel: string;
  actionHref: string;
  originatingPolicyTitle?: string;
  policyOwner?: string;
  policySeverity?: string;
  finding?: string;
  ventureId?: string;
  decisionId?: string;
  ruling?: string;
};

export type BriefingImplicationView = {
  id: string;
  company: string;
  kind?: "opportunity" | "risk" | "outcome";
  point: string;
};

export type ExecutiveBriefingView = {
  preparedBy: string;
  headline: string;
  narrative: string;
  implications: BriefingImplicationView[];
};

export type OperatingHealthWatchView = {
  id: string;
  company: string;
  companyHref: string;
  band: HealthBand;
  judgement: string;
  ask: string;
};

export type OperatingHealthView = {
  score: number;
  label?: string;
  band: HealthBand;
  summary?: string;
  posture: string;
  verdict: string;
  watches: OperatingHealthWatchView[];
};

export type CriticalDecisionView = {
  id: string;
  question: string;
  company: string;
  companyHref: string;
  recommendation: string;
  costOfInaction: string;
  decideBy: string;
  actionLabel: string;
  actionHref: string;
  originatingPolicyTitle?: string;
  policyOwner?: string;
  policySeverity?: string;
  finding?: string;
  ventureId?: string;
  ruling?: string;
};

export type PortfolioCompanyView = {
  id: string;
  name: string;
  href: string;
  stage: string;
  band: HealthBand;
  founderAsk: string;
  attention: AttentionWindow;
};

export type StoryHighlightView = {
  id: string;
  company: string;
  companyHref: string;
  chapter: string;
  excerpt: string;
  tension: string;
};

export type MemoryItemView = {
  id: string;
  recalledFrom: string;
  title: string;
  note: string;
  implication: string;
};

export type SituationRoomModel = {
  header: SituationHeader;
  mission: TodaysMissionView;
  briefing: ExecutiveBriefingView;
  health: OperatingHealthView;
  decisions: CriticalDecisionView[];
  portfolio: PortfolioCompanyView[];
  stories: StoryHighlightView[];
  memory: MemoryItemView[];
};

export type ExecutiveRecommendationView = Recommendation;

export type TodaysBriefView = {
  headline: string;
  body: string;
  focus: string;
};

export type DecisionRecordView = {
  id: string;
  date: string;
  title: string;
  ruling: string;
  result: string;
};

export type UpcomingDecisionView = {
  id: string;
  question: string;
  company: string;
  due: string;
};

export type CorrespondenceNoteView = {
  id: string;
  at: string;
  author: string;
  body: string;
};

export type ExecutiveProfileView = {
  id: ExecutiveRoleId;
  role: string;
  name: string;
  remit: string;
  status: OperatingStatus;
  statusLabel: string;
  brief: TodaysBriefView;
  primaryRecommendation: ExecutiveRecommendationView;
  primaryAction: {
    label: string;
    href: string;
  };
  recommendations: ExecutiveRecommendationView[];
  decisions: DecisionRecordView[];
  memory: MemoryItemView[];
  upcoming: UpcomingDecisionView[];
  correspondence: CorrespondenceNoteView[];
};

export type ExecutiveFloorModel = {
  posture: string;
  worldLine: string;
  executives: ExecutiveProfileView[];
};
