export type EngineeringMode =
  | "Diagnostic"
  | "Design"
  | "Implementation"
  | "Verification"
  | "Release";

export type HealthTone = "healthy" | "watch" | "risk" | "unknown";

export type SprintBucket = "completed" | "current" | "upcoming";

export type SprintRecord = {
  id: string;
  title: string;
  objective: string;
  status: string;
  completion: string;
  summary: string;
  bucket: SprintBucket;
  source: "engineering-history" | "desk";
};

export type DecisionRecord = {
  id: string;
  title: string;
  problem: string;
  decision: string;
  reason: string;
  outcome: string;
  status: string;
};

export type DebtRecord = {
  id: string;
  title: string;
  priority: string;
  description: string;
  impact: string;
  owner: string;
  sprint: string;
  status: string;
};

export type LessonRecord = {
  id: string;
  title: string;
  sprint: string;
  date: string;
  category: string;
  body: string;
};

export type ReleaseRecord = {
  name: string;
  status: string;
  date: string;
  notes: string;
};

export type QualityGate = {
  gate: string;
  result: string;
  tone: HealthTone;
};

export type FoundationIndicator = {
  id: string;
  label: string;
  detail: string;
  tone: HealthTone;
};

export type CertificationSnapshot = {
  status: string;
  date: string;
  programme: string;
  version: string;
  outstanding: string[];
  recommendation: string;
  gates: QualityGate[];
  architecture: { concern: string; status: string }[];
};

export type ConstitutionDocument = {
  id: string;
  title: string;
  source: string;
  markdown: string;
};

export type EngineeringCatalogue = {
  sprints: SprintRecord[];
  decisions: DecisionRecord[];
  debt: DebtRecord[];
  lessons: LessonRecord[];
  releases: ReleaseRecord[];
  certification: CertificationSnapshot;
  constitution: ConstitutionDocument[];
  upcomingNote: string;
};
