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

export type CycleOwnershipClass = "A" | "B" | "C" | "D";

export type CycleClosedAs = "certified" | "stopped" | "deferred";

export type CycleTernary = "YES" | "NO" | "UNKNOWN";

export type CycleEvidenceRecord = {
  id: string;
  title: string;
  scope: string;
  ownershipClass: CycleOwnershipClass | null;
  workItem: string;
  checkpointSha: string | null;
  erdRef: string | null;
  llRef: string | null;
  openedAt: string | null;
  closedAt: string | null;
  closedAs: CycleClosedAs | null;
  diagnosticCycles: number | null;
  correctionAttempts: number | null;
  failedCorrections: number | null;
  targetedTestRuns: number | null;
  relatedDomainTestRuns: number | null;
  fullSuiteRuns: number | null;
  certificationFailures: number | null;
  regressionsFound: number | null;
  manualFounderInterventions: number | null;
  manualTerminalInterventions: number | null;
  tests: number | null;
  pass: number | null;
  fail: number | null;
  cancelled: number | null;
  skipped: number | null;
  exitCode: number | null;
  cleanProcessExit: CycleTernary;
  failureClass: string | null;
  firstCorrectionHeld: CycleTernary;
  notes: string;
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
  cycles: CycleEvidenceRecord[];
  releases: ReleaseRecord[];
  certification: CertificationSnapshot;
  constitution: ConstitutionDocument[];
  upcomingNote: string;
};
