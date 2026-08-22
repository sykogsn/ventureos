# Capability Framework

**Purpose.** Explain the Shared Capability Framework as catalogue and governance for reusable building blocks.

**Authority.** Library explanation. Implementation source of truth: `apps/web/src/core/capability/README.md` and `platformCapabilityCatalog`.

**Audience.** Engineers adding or consuming capabilities.

**Dependencies.** [Architecture Overview](./Architecture-Overview.md) · [Runtime](./Runtime.md)

**Related Documents.** [Venture Definitions](./Venture-Definitions.md) · [Twelve Founding Principles](../01-FOUNDATION/Twelve-Founding-Principles.md) · [Products](../06-PRODUCTS/README.md) · [ADR-009](../../foundation/architecture/ADR-009-VentureOS-Brain.md)

**Status.** Approved (locked)

**Version.** 1.1.0

**Owner.** Capability Framework

**Last Updated.** 2026-08-20

---

A capability is a reusable organisational building block. It is not a route, a page, a plugin, or a second runtime.

The registry is the source of truth. Rendered catalogue: `capabilityCatalogue()`. Dependency order: `capabilityDependencyMap()`.

The Executive Intelligence Runtime remains the only orchestrator. This framework does not dispatch, persist, or load modules. IDS does not declare capabilities. There is no `brain.*` dispatch id ([ADR-009](../../foundation/architecture/ADR-009-VentureOS-Brain.md)).

## Catalogue (Foundation v1.1)

| Id | Name | Class | Lifecycle |
|---|---|---|---|
| `platform.capability-framework` | Shared Capability Framework | Platform | shared |
| `platform.identity` | Identity | Platform | stable |
| `data.venture-genome` | Venture Genome | Data | stable |
| `intelligence.venture-core` | Venture Intelligence Core | Intelligence | stable |
| `intelligence.policy-engine` | Executive Policy Engine | Governance | stable |
| `intelligence.recommendation-engine` | Recommendation Engine | Intelligence | stable |
| `intelligence.executive-memory` | Executive Memory | Intelligence | stable |
| `intelligence.operating-health` | Operating Health | Intelligence | stable |
| `intelligence.company-story` | Company Story | Intelligence | stable |
| `intelligence.knowledge-graph` | Knowledge Graph | Intelligence | stable |
| `intelligence.decision-engine` | Decision Engine | Governance | stable |
| `intelligence.risk` | Risk Intelligence | Intelligence | stable |
| `intelligence.mission` | Mission Engine | Intelligence | stable |
| `intelligence.briefing` | Executive Briefing | Intelligence | shared |
| `intelligence.runtime` | Executive Intelligence Runtime | Intelligence | stable |
| `governance.executive-office` | Executive Office | Governance | stable |
| `governance.founder-decision` | Founder Decision Recording | Governance | stable |

Classifications with no entries yet: AI, Security, Communication, Infrastructure. They exist in the taxonomy for future product use.

## Design standard

- Single responsibility. One purpose, one owner, one version.
- No venture-specific logic. Qualora, Calviora, and Farmora consume; they do not live inside the capability.
- Independently testable without UI.
- Lifecycle: Experimental → Internal → Shared → Stable → Deprecated (forward adjacent, or any live stage to Deprecated).
- Fail fast: duplicate ids, missing dependencies, cycles, unknown contracts, illegal transitions.
- Engines never depend on the Runtime. The Runtime depends on engines and the capability framework.

Typical load order: identity and genome → VIC → policy / memory / health / story / graph / decisions / risk / mission → recommendations → briefing → Runtime → founder-decision.

## Adding a capability

Declare a manifest in the platform catalogue. Provide contracts from `CAPABILITY_CONTRACTS`. Declare dependencies by capability id. Registry creation fails fast on invalid graphs.

Do not import a shared implementation as a private shortcut when a capability id exists.
