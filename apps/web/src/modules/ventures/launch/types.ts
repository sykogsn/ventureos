import type { Venture } from "@/core/venture";
import type { LaunchProductId } from "./products";

export type { LaunchProductId };

export const launchSteps = [
  { id: "product", label: "Product", title: "Choose a product", description: "This is the company you are founding on VentureOS." },
  { id: "name", label: "Name", title: "Name the company", description: "This is how the company will appear across VentureOS." },
  { id: "category", label: "Category", title: "Choose a category", description: "Sets the default operating playbook." },
  { id: "stage", label: "Stage", title: "Where is it today?", description: "Stage changes what VentureOS optimises for first." },
  { id: "goal", label: "Goal", title: "Primary goal", description: "The single outcome this company exists to hit next." },
  { id: "ai", label: "Office", title: "Open the Executive Office", description: "VentureOS can seat an executive office and brief you daily." },
  { id: "team", label: "Seats", title: "Seat the Executive Office", description: "Choose the operators that will run with you." },
  { id: "mission", label: "Mission", title: "Mission Control", description: "Confirm the Venture Genome, then run the launch sequence." },
] as const;

export type LaunchStepId = (typeof launchSteps)[number]["id"];

export type VentureCategoryId =
  | "saas"
  | "marketplace"
  | "consumer"
  | "agency"
  | "deep-tech"
  | "other";

export type VentureStageId = "idea" | "pre-seed" | "seed" | "launch" | "growth";

export type VentureGoalId = "mvp" | "customers" | "raise" | "hire" | "ops";

export type AiExecutiveId =
  | "chief-of-staff"
  | "growth"
  | "finance"
  | "legal"
  | "product"
  | "revenue";

export type SelectOption<T extends string> = {
  id: T;
  label: string;
  description: string;
};

export type LaunchDraft = {
  name: string;
  productId: LaunchProductId | null;
  categoryId: VentureCategoryId | null;
  stageId: VentureStageId | null;
  goalId: VentureGoalId | null;
  aiEnabled: boolean | null;
  executiveIds: AiExecutiveId[];
  definitionId?: string;
  definitionVersion?: string;
};

export type { GenomePosture, GenomeRisk, VentureGenome } from "@/core/venture-genome";
export type { HealthBand } from "@/core/shared";
export type { Venture };

export type LaunchArtefactId =
  | "founder-hq"
  | "executive-office"
  | "sprint-1"
  | "company-story"
  | "knowledge-base"
  | "suggested-documents"
  | "operating-health";

export type LaunchArtefactMeta = {
  id: LaunchArtefactId;
  label: string;
};

export const launchArtefactCatalog: LaunchArtefactMeta[] = [
  { id: "founder-hq", label: "Founder HQ" },
  { id: "executive-office", label: "Executive Office" },
  { id: "sprint-1", label: "Sprint 1" },
  { id: "company-story", label: "Company Story" },
  { id: "knowledge-base", label: "Knowledge Base" },
  { id: "suggested-documents", label: "Suggested Documents" },
  { id: "operating-health", label: "Operating Health" },
];

export type SprintTask = {
  id: string;
  title: string;
  owner: string;
};

export type FoundedCompany = {
  slug: string;
  foundedAt: string;
  draft: LaunchDraft;
  venture: Venture;
};

export const emptyLaunchDraft: LaunchDraft = {
  name: "",
  productId: null,
  categoryId: null,
  stageId: null,
  goalId: null,
  aiEnabled: null,
  executiveIds: [],
};
