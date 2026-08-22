# Runtime

**Purpose.** Explain the Executive Intelligence Runtime as the only intelligence orchestrator, including its call graph and what is deliberately not a stage.

**Authority.** Library explanation. Implementation source of truth: `apps/web/src/core/runtime/README.md` and `runExecutiveIntelligenceRuntime`.

**Audience.** Engineers changing intelligence, projections, or persistence adapters.

**Dependencies.** [Architecture Overview](./Architecture-Overview.md)

**Related Documents.** [Capability Framework](./Capability-Framework.md) · [Venture Definitions](./Venture-Definitions.md) · [Situation Room](./Situation-Room.md) · [Engineering Standards](../04-ENGINEERING/Engineering-Standards.md) · [ADR-009](../../foundation/architecture/ADR-009-VentureOS-Brain.md)

**Status.** Approved (locked)

**Version.** 1.1.0

**Owner.** Runtime

**Last Updated.** 2026-08-20

---

The only intelligence orchestration entry is `runExecutiveIntelligenceRuntime`.

IDS must not import, wrap, or duplicate the Runtime pipeline. Persist is not a Runtime stage. Memory and story are not separate Runtime stages.

## Call graph

`RUNTIME_PIPELINE`:

1. `resolve-capabilities` — `assertRuntimeCapabilities`
2. `enforce-instance-profiles` — `assertRuntimeInstanceUsage`
3. `apply-event` — `applyRuntimeEvent` (venture, decisions, executive memory, company story)
4. `policy-evaluation` — `hydratePolicyEngine` (policy findings are this stage's output)
5. `recommendation-engine` — `hydrateRecommendations` (executive briefing is assembled here)
6. `operating-health` — `refreshOperatingHealth`
7. `knowledge-graph` — `refreshKnowledgeGraph`

The Runtime still imports engines directly. Capability resolution is governance, not dynamic dispatch.

The Runtime skips briefing assembly for instances that cannot consume `intelligence.briefing`.

## Events

Typical events include company founding, founder decision recorded, and intelligence refresh. Runs are deterministic for the same core and event. Idempotence is required for founding and founder-decision recording.

## After the run

The intelligence service writes repositories from mutation snapshots. Repositories do not call the Runtime. Screens project the resulting model. They do not re-run the pipeline.

## Locked rule

Do not add a stage, an alternate entry, or a persist stage without a Foundation amendment recorded in the [Architecture Decision Register](../05-GOVERNANCE/Architecture-Decision-Register.md). Brain engines may grow behind existing stages. They do not become stages ([ADR-009](../../foundation/architecture/ADR-009-VentureOS-Brain.md)).
