import type { ExecutiveRoleId } from "../executive-office";
import type { VentureId } from "../shared";

export type PolicyId = string;

export type PolicySeverity = "critical" | "high" | "medium" | "low";

export type PolicyFindingStatus = "breach" | "watch" | "compliant";

export type PolicyOwnerRole =
  | "founder"
  | "cto"
  | "coo"
  | "cfo"
  | "cmo"
  | "counsel";

export type PolicyEvidence = {
  id: string;
  source:
    | "health"
    | "mission"
    | "decision"
    | "risk"
    | "memory"
    | "story"
    | "office"
    | "genome"
    | "policy";
  label: string;
  detail: string;
};

export type ExecutivePolicy = {
  id: PolicyId;
  title: string;
  statement: string;
  owner: PolicyOwnerRole;
  severity: PolicySeverity;
  appliesWhen: string;
  requiredAction: string;
  alliedRoles: ExecutiveRoleId[];
  briefing: boolean;
};

export type PolicyFinding = {
  id: string;
  policyId: PolicyId;
  policyTitle: string;
  policyOwner: PolicyOwnerRole;
  severity: PolicySeverity;
  status: PolicyFindingStatus;
  ventureId: VentureId;
  company: string;
  companyHref: string;
  finding: string;
  reason: string;
  requiredAction: string;
  title: string;
  actingRole: ExecutiveRoleId;
  alliedRoles: ExecutiveRoleId[];
  briefing: boolean;
  expectedImpact: string;
  estimatedEffort: string;
  actionLabel: string;
  actionHref: string;
  evidence: PolicyEvidence[];
};

export type PolicyLibrary = ExecutivePolicy[];

export type PolicyEngine = {
  library: PolicyLibrary;
  findings: PolicyFinding[];
};
