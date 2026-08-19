/**
 * Abstract contracts capabilities may provide or require.
 * These are names, not implementations. The Runtime does not dispatch on them.
 */
export const CAPABILITY_CONTRACTS = {
  orchestration: "contract.orchestration",
  ventureIntelligenceCore: "contract.venture-intelligence-core",
  policyEvaluation: "contract.policy-evaluation",
  recommendationGeneration: "contract.recommendation-generation",
  executiveBriefing: "contract.executive-briefing",
  operatingHealth: "contract.operating-health",
  executiveMemory: "contract.executive-memory",
  companyStory: "contract.company-story",
  knowledgeGraph: "contract.knowledge-graph",
  decisionRecord: "contract.decision-record",
  riskIntelligence: "contract.risk-intelligence",
  missionConstraint: "contract.mission-constraint",
  executiveOffice: "contract.executive-office",
  founderIdentity: "contract.founder-identity",
  ventureGenome: "contract.venture-genome",
  capabilityRegistry: "contract.capability-registry",
} as const;

export type CapabilityContract =
  (typeof CAPABILITY_CONTRACTS)[keyof typeof CAPABILITY_CONTRACTS];

export function isCapabilityContract(value: string): value is CapabilityContract {
  return Object.values(CAPABILITY_CONTRACTS).includes(value as CapabilityContract);
}
