import type { HealthTone } from "../types";

export type SignalKind =
  | "records"
  | "git"
  | "github"
  | "ci"
  | "coverage"
  | "performance"
  | "security"
  | "agent";

export type SignalSource = {
  id: string;
  kind: SignalKind;
  available: boolean;
  note: string;
};

export type ProjectSignals = {
  rootTestScript: string | null;
  engineeringHqModulePresent: boolean;
};

export type ScoredCriterion = {
  id: string;
  label: string;
  points: number | null;
  max: number;
  evidence: string;
};

export type EngineeringHealthReport = {
  score: number | null;
  label: string;
  tone: HealthTone;
  method: string;
  criteria: ScoredCriterion[];
};

export type ArchitectureHealthReport = {
  verdict: "Healthy" | "Needs Attention" | "Critical" | "Unknown";
  tone: HealthTone;
  evidence: string[];
};

export type EngineeringRecommendation = {
  id: string;
  title: string;
  why: string;
  source: string;
};

export type SprintIntelligence = {
  currentId: string;
  currentTitle: string;
  completedCount: number;
  currentPhase: string;
  latestMilestone: string;
  nextPlanned: string;
  evidence: string[];
};

export type FoundationIntelligence = {
  status: string;
  version: string;
  date: string;
  outstanding: string[];
  gates: { gate: string; result: string; tone: HealthTone }[];
  history: { version: string; date: string; status: string }[];
  evidence: string[];
};

export type TimelineEvent = {
  id: string;
  title: string;
  date: string;
  status: string;
  summary: string;
  searchText: string;
};

export type DebtIntelligence = {
  total: number;
  high: number;
  medium: number;
  low: number;
  open: number;
  resolved: number;
  recentlyAdded: string;
  trend: string;
};

export type QualitySignal = {
  id: string;
  label: string;
  live: { tone: HealthTone; detail: string };
  recorded: { tone: HealthTone; detail: string };
};

export type QualityIntelligence = {
  overall: { tone: HealthTone; label: string; evidence: string };
  signals: QualitySignal[];
};

export type EngineeringIntelligence = {
  health: EngineeringHealthReport;
  architecture: ArchitectureHealthReport;
  recommendations: EngineeringRecommendation[];
  sprints: SprintIntelligence;
  foundation: FoundationIntelligence;
  timeline: TimelineEvent[];
  debt: DebtIntelligence;
  quality: QualityIntelligence;
  sources: SignalSource[];
};
