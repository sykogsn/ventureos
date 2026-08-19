export type ExecutiveRoleId =
  | "founder"
  | "cto"
  | "coo"
  | "cfo"
  | "cpo"
  | "cmo"
  | "counsel"
  | "sales";

export type OperatingStatus =
  | "awaiting-founder"
  | "in-session"
  | "watching"
  | "clear";

export type ExecutiveSeat = {
  id: ExecutiveRoleId;
  role: string;
  name: string;
  remit: string;
  seated: boolean;
  status: OperatingStatus;
  statusLabel: string;
};

export type ExecutiveBrief = {
  headline: string;
  body: string;
  focus: string;
};

export type CorrespondenceNote = {
  id: string;
  at: string;
  author: string;
  body: string;
};

export type ExecutiveAction = {
  label: string;
  href: string;
};

export type ExecutiveDesk = {
  seat: ExecutiveSeat;
  brief: ExecutiveBrief;
  primaryAction: ExecutiveAction;
  correspondence: CorrespondenceNote[];
};

export type ExecutiveOffice = {
  enabled: boolean;
  posture: string;
  worldLine: string;
  desks: ExecutiveDesk[];
};
