import type { CompanyStory } from "../company-story";
import type { DecisionEngine } from "../decision-engine";
import type { DocumentIntelligence } from "../document-intelligence";
import type { ExecutiveOffice, ExecutiveRoleId } from "../executive-office";
import type { ExecutiveMemory } from "../executive-memory";
import type { CompanyIdentity, FounderIdentity } from "../identity";
import type { KnowledgeGraph } from "../knowledge-graph";
import type { MissionEngine } from "../mission-engine";
import type { OperatingHealth, PortfolioHealth } from "../operating-health";
import type { PolicyEngine } from "../policy/types";
import type {
  ExecutiveBriefing,
  RecommendationEngine,
} from "../recommendation/types";
import type { RiskIntelligence } from "../risk-intelligence";
import type { VentureGenome } from "../venture-genome";
import type { VentureDefinitionRef } from "../venture-definition/types";

export type Venture = {
  identity: CompanyIdentity;
  definition?: VentureDefinitionRef;
  genome: VentureGenome;
  story: CompanyStory;
  executiveOffice: ExecutiveOffice;
  decisions: DecisionEngine;
  memory: ExecutiveMemory;
  knowledge: KnowledgeGraph;
  mission: MissionEngine;
  health: OperatingHealth;
  documents: DocumentIntelligence;
  risk: RiskIntelligence;
  recommendations: RecommendationEngine;
  policy: PolicyEngine;
};

export type VentureIntelligenceCore = {
  founder: FounderIdentity;
  office: ExecutiveOffice;
  briefing: ExecutiveBriefing;
  health: PortfolioHealth;
  memory: ExecutiveMemory;
  decisions: DecisionEngine;
  recommendations: RecommendationEngine;
  policy: PolicyEngine;
  ventures: Venture[];
};

export type FoundingInput = {
  id?: string;
  slug: string;
  name: string;
  href?: string;
  foundedAt?: string;
  owner?: string;
  genome: VentureGenome;
  officeEnabled: boolean;
  seatedRoleIds: ExecutiveRoleId[];
  definition?: VentureDefinitionRef;
};
