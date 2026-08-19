import type {
  AiExecutiveId,
  SelectOption,
  VentureCategoryId,
  VentureGoalId,
  VentureStageId,
} from "./types";

export const categoryOptions: SelectOption<VentureCategoryId>[] = [
  { id: "saas", label: "SaaS", description: "B2B software with recurring revenue." },
  { id: "marketplace", label: "Marketplace", description: "Two-sided network, supply and demand." },
  { id: "consumer", label: "Consumer", description: "Direct to people, brand-led growth." },
  { id: "agency", label: "Studio / agency", description: "Services that can productise later." },
  { id: "deep-tech", label: "Deep tech", description: "Long-cycle science, IP, or infrastructure." },
  { id: "other", label: "Other", description: "A company that does not fit the defaults." },
];

export const stageOptions: SelectOption<VentureStageId>[] = [
  { id: "idea", label: "Idea", description: "Thesis and first experiments." },
  { id: "pre-seed", label: "Pre-seed", description: "Finding a sharp problem and a wedge." },
  { id: "seed", label: "Seed", description: "Repeating a motion that works." },
  { id: "launch", label: "Launch", description: "Going to market in public." },
  { id: "growth", label: "Growth", description: "Scaling what already converts." },
];

export const goalOptions: SelectOption<VentureGoalId>[] = [
  { id: "mvp", label: "Ship the MVP", description: "A usable product in customers’ hands." },
  { id: "customers", label: "Win first customers", description: "Paid proof, not waitlist vanity." },
  { id: "raise", label: "Raise the round", description: "A clean narrative and a tight process." },
  { id: "hire", label: "Hire the core team", description: "The first operators who change capacity." },
  { id: "ops", label: "Install the operating system", description: "Cadence, owners, and a single source of truth." },
];

export const executiveOptions: SelectOption<AiExecutiveId>[] = [
  { id: "chief-of-staff", label: "Chief of Staff", description: "Priorities, cadence, and founder leverage." },
  { id: "growth", label: "Chief Growth Officer", description: "Acquisition, positioning, and experiments." },
  { id: "finance", label: "Chief Financial Officer", description: "Runway, pricing, and cash discipline." },
  { id: "legal", label: "General Counsel", description: "Contracts, structure, and risk." },
  { id: "product", label: "Chief Product Officer", description: "Roadmap, discovery, and shipping." },
  { id: "revenue", label: "Chief Revenue Officer", description: "Pipeline, close motion, and expansion." },
];

export function labelFor<T extends string>(
  options: SelectOption<T>[],
  id: T | null,
) {
  return options.find((option) => option.id === id)?.label ?? "Not set";
}
