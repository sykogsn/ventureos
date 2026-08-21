# Foundation Capability Register

**Release.** VentureOS Foundation v1.0  
**Date.** 2026-08-21  
**Authority.** Shared Capability Registry. Source of truth: `apps/web/src/core/capability/` (`platformCapabilityCatalog`).  
**Law.** Capabilities govern. They do not dispatch, persist, or load modules. IDS does not declare capabilities.

This register is a release snapshot of the live catalogue. It does not create capabilities.

---

## Catalogue

| Id | Name | Class | Lifecycle | Role |
|---|---|---|---|---|
| `platform.capability-framework` | Shared Capability Framework | Platform | shared | Catalogue and validation of capabilities |
| `platform.identity` | Identity | Platform | stable | Users and authentication as a platform block |
| `data.venture-genome` | Venture Genome | Data | stable | Category, stage, and operating facts of a company |
| `intelligence.venture-core` | Venture Intelligence Core | Intelligence | stable | Company intelligence record the Runtime orchestrates |
| `intelligence.policy-engine` | Executive Policy Engine | Governance | stable | Policy findings during a Runtime run |
| `intelligence.recommendation-engine` | Recommendation Engine | Intelligence | stable | Recommendations; executive briefing is assembled here |
| `intelligence.executive-memory` | Executive Memory | Intelligence | stable | Decisions that must not be taken twice |
| `intelligence.operating-health` | Operating Health | Intelligence | stable | Cadence of the company |
| `intelligence.company-story` | Company Story | Intelligence | stable | What the OS already remembers |
| `intelligence.knowledge-graph` | Knowledge Graph | Intelligence | stable | Graph refresh in the Runtime pipeline |
| `intelligence.decision-engine` | Decision Engine | Governance | stable | Decision machinery consumed by the Runtime |
| `intelligence.risk` | Risk Intelligence | Intelligence | stable | Risk as an intelligence block |
| `intelligence.mission` | Mission Engine | Intelligence | stable | Mission as an intelligence block |
| `intelligence.briefing` | Executive Briefing | Intelligence | shared | Morning briefing; skipped when an instance cannot consume it |
| `intelligence.runtime` | Executive Intelligence Runtime | Intelligence | stable | The only orchestrator |
| `governance.executive-office` | Executive Office | Governance | stable | Seated judgement surface capability |
| `governance.founder-decision` | Founder Decision Recording | Governance | stable | FounderDecisionRecorded path |

Empty classifications (reserved, not missing): **AI**, **Security**, **Communication**, **Infrastructure**.

## Rules that this register does not relax

1. One purpose, one owner, one version.
2. No venture-specific logic inside a capability.
3. Independently testable without UI.
4. Runtime-required capabilities cannot be excluded by a definition.
5. Engines never depend on the Runtime. The Runtime depends on engines and this framework.
6. Do not import a shared implementation as a private shortcut when a capability id exists.

## Not capabilities

These are platform systems. They must not be registered as a second catalogue.

| System | Layer | Notes |
|---|---|---|
| Workspace Engine | Platform identity / tenancy | Workspaces, membership, workspace cookie |
| Persistence | Persistence | SQLite repositories; not an orchestrator |
| IntelligenceOS (IDS) | Presentation | Tokens, climate, brand overlay |
| Executive Layout v2 | Presentation | Workspace layout primitives |
| Interaction Engine | Presentation | Wayfinding, commands, focus |
| Brain | Shell / platform knowledge desk | In-memory institutional catalogue; not a Runtime |

## Venture-level variation

There is no second capability registry for products. Qualora, Calviora, and Farmora `use` or exclude ids from this register and declare desk features on their Venture Definitions.
