import type { VentureId } from "../shared";
import type { ExecutiveRoleId } from "../executive-office";

export type DecisionStatus = "upcoming" | "resolved";

export type Decision = {
  id: string;
  ventureId: VentureId;
  company: string;
  companyHref: string;
  ownerRoleId: ExecutiveRoleId;
  question: string;
  title: string;
  recommendation: string;
  costOfInaction: string;
  decideBy: string;
  actionLabel: string;
  actionHref: string;
  status: DecisionStatus;
  briefing: boolean;
  ruling?: string;
  result?: string;
  resolvedOn?: string;
};

export type DecisionEngine = {
  items: Decision[];
};
