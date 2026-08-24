import type { ConfidenceLevel } from "@/modules/frontend-foundation/signal";
import type { WorkshopStatusLevel } from "@/modules/frontend-foundation/mapping";

export type PresentationEvidence = {
  id: string;
  label: string;
  detail: string;
  source: string;
};

export type JudgementPresentation = {
  id: string;
  ventureId?: string;
  company: string;
  companyHref: string;
  issue: string;
  significance?: string;
  decision: string;
  costOfInaction?: string;
  severity: WorkshopStatusLevel;
  confidence?: ConfidenceLevel;
  evidence: PresentationEvidence[];
  actionLabel: string;
  actionHref: string;
  ruling?: string;
  policyTitle?: string;
};

export type AttentionMatter = {
  id: string;
  company: string;
  companyHref: string;
  issue: string;
  decision: string;
  significance?: string;
  severity: WorkshopStatusLevel;
  confidence?: ConfidenceLevel;
  evidence: PresentationEvidence[];
  actionLabel: string;
  actionHref: string;
};

export type WatchPresentation = {
  id: string;
  company: string;
  companyHref: string;
  judgement: string;
  ask: string;
  band: WorkshopStatusLevel;
};

export type ExecutiveBriefPresentation = {
  headline: string;
  narrative: string;
  implications: string[];
};

export type ExecutiveWorkspacePresentation = {
  founderName: string;
  posture: string;
  worldLine: string;
  brief: ExecutiveBriefPresentation;
  primary: JudgementPresentation | null;
  attention: AttentionMatter[];
  watches: WatchPresentation[];
};
