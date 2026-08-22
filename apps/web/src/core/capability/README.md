# Shared Capability Framework

Registry, contract and governance for reusable VentureOS capabilities.

The Executive Intelligence Runtime remains the only orchestrator. This framework does not dispatch, persist, or load modules.

## 1. Capability Catalogue

Live catalogue is `platformCapabilityCatalog` (`catalog.ts`). Rendered form:

The registry is the source of truth. Generate markdown with `capabilityCatalogue()`.

Initial shared capabilities:

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

Classifications with no entries yet: AI, Security, Communication, Infrastructure. They exist in the taxonomy for future capabilities. They do not encode a Venture by name.

## 2. Capability Dependency Map

Engines depend on VIC. The Runtime depends on engines and the capability framework. Engines never depend on the Runtime.

Typical load order: identity and genome → VIC → policy / memory / health / story / graph / decisions / risk / mission → recommendations → briefing → Runtime → founder-decision.

See `capabilityDependencyMap()` for the exact topological order.

```
Venture
  → Capability Registry
    → Capability (manifest + contracts)
```

The Runtime resolves `RUNTIME_REQUIRED_CAPABILITIES` through the registry at the start of a run. It still imports engines directly. Resolution is governance, not dynamic dispatch.

Runtime call graph: `core/runtime/README.md` (`RUNTIME_PIPELINE`).

## 3. Capability Design Standard

See `CAPABILITY_DESIGN_STANDARD` in `documentation.ts`.

Summary:

- Reusable, versioned, independently testable, single responsibility.
- Free of venture-specific logic.
- Lifecycle: Experimental → Internal → Shared → Stable → Deprecated (forward adjacent, or any live stage to Deprecated).
- Fail fast: duplicate ids, missing dependencies, cycles, unknown contracts, illegal transitions.
