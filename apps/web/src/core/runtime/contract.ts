/**
 * Executive Intelligence Runtime contract.
 *
 * Canonical specification. The only orchestration entry is
 * `runExecutiveIntelligenceRuntime`. Pages stay presentational.
 * Persistence lives in the intelligence service after a mutation snapshot.
 *
 * The Runtime resolves required capabilities through the Shared Capability
 * Registry before the pipeline. Resolution is governance, not dispatch.
 *
 * Mutation path (service then Runtime then service):
 * load facts (intelligence service)
 * → CompanyFounded | FounderDecisionRecorded
 * → resolve capabilities (registry)
 * → enforce instance capability and feature profiles
 * → apply-event (venture, decision, memory, story)
 * → Executive Policy Engine (findings are engine output, not a separate stage)
 * → Recommendation Engine (briefing assembly lives here)
 * → Operating Health
 * → Knowledge Graph
 * → persist snapshot (intelligence service, mutations only)
 * → return Venture Intelligence Core
 *
 * Read path:
 * IntelligenceRefresh → same Runtime stages after load facts → return VIC (no persist)
 *
 * `RUNTIME_PIPELINE` names the Runtime function call graph only.
 * Executive memory and company story update inside apply-event, not as
 * separate Runtime stages. Persist is not a Runtime stage.
 */
export const RUNTIME_PIPELINE = [
  "resolve-capabilities",
  "enforce-instance-profiles",
  "apply-event",
  "policy-evaluation",
  "recommendation-engine",
  "operating-health",
  "knowledge-graph",
] as const;

export type RuntimePipelineStage = (typeof RUNTIME_PIPELINE)[number];

export const RUNTIME_GUARANTEES = {
  deterministic:
    "The same VIC facts and Runtime Event always produce the same snapshot.",
  vicSsot: "Venture Intelligence Core remains the document of record.",
  engines:
    "Policy evaluation and recommendation generation run only inside the Runtime.",
  capabilities:
    "Shared capabilities are resolved through the Capability Registry. The Runtime does not become a plugin host.",
  instanceProfiles:
    "Each Venture Instance may only consume capabilities and features declared on its Venture Definition.",
  mutations:
    "CompanyFounded and FounderDecisionRecorded are the only intelligence mutations.",
  mutationBehaviour:
    "Mutations change VIC facts. Replay with the same identity is a no-op for the mutated records.",
  reads:
    "IntelligenceRefresh hydrates engines, health, and graph in memory and does not persist.",
  persist:
    "The Runtime does not write storage. The intelligence service persists only after mutation events.",
  idempotent:
    "Replaying a mutation with the same identity does not duplicate memory, score, or ventures.",
} as const;
