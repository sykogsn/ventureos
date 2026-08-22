# ADR-009 — VentureOS Brain

**Status.** Accepted  
**Date.** 2026-08-22  
**Sprint.** VC-003  
**Owner.** Architecture  
**Foundation.** v1.0 remains frozen. This decision does not recertify, unfreeze, or amend Runtime, VIC, Capability Registry, Definition Registry, IDS, or the three rooms.

**Architecture.** [BRAIN-001](./BRAIN-001-VentureOS-Brain-Architecture.md) (VC-001, approved)  
**Roadmap.** [BRAIN-002](./BRAIN-002-VentureOS-Brain-Implementation-Roadmap.md) (VC-002, approved; FD-B0 accepted)  
**Certification gate.** [Foundation v1.0](../certification/FOUNDATION-V1.0.md)  
**Artefacts.** [Known development artefacts](../KNOWN-DEVELOPMENT-ARTEFACTS.md)  
**Review.** [Review Process](../../foundation-library/04-ENGINEERING/Review-Process.md)

Register index: [Architecture Decision Register](../../foundation-library/05-GOVERNANCE/Architecture-Decision-Register.md).

---

## Decision

The VentureOS Brain is the **intelligence substrate** of the operating system.

It provides knowledge, relationships, memory, reasoning, and executive intelligence products.

It **never orchestrates**.

The Executive Intelligence Runtime remains the sole orchestrator (`runExecutiveIntelligenceRuntime`, ADR-001). The Brain never executes pipelines, never dispatches capabilities, and never owns Runtime stages.

The Brain **evolves** the systems Foundation v1.0 already certified. It does not replace them and does not create a second Runtime, a second graph, a second Decision system, a second memory system, or a second orchestration layer.

The Brain desk (`modules/brain`) remains shell. That is unchanged from the [Platform Constitution](../../architecture/VENTUREOS_PLATFORM_CONSTITUTION.md) presentation rule. The substrate is the engines and object model behind existing Runtime stages, not a new desk and not a new pipeline.

---

## 1. Substrate

The Brain provides:

| Concern | Meaning |
|---|---|
| Knowledge | Typed Knowledge Objects (institutional and operating planes) |
| Relationships | One graph vocabulary; VIC graph is a projection |
| Memory | Working, session (platform-owned), venture, executive, long-term, ageing |
| Reasoning | Context assembly, evidence weight, confidence, conflict, recommendation grounding, explanation |
| Executive intelligence products | Morning Brief, Executive Brief, queues, risk summary, weekly review, recommendations, strategic alerts |

The Brain does not run these as a chat, a document store, or a search engine.

---

## 2. Runtime remains the sole orchestrator

- `runExecutiveIntelligenceRuntime` is the only intelligence orchestration entry.
- `RUNTIME_PIPELINE` remains seven stages. An eighth stage, an alternate entry, or persist-as-stage still requires a Foundation amendment (Runtime locked rule).
- Brain engines may be imported by existing stages. They never depend on the Runtime.
- Pages, navigation, and the Brain desk never call the Runtime.
- The Capability Registry catalogues and validates. It does not dispatch Brain. There is no `brain.*` dispatch id.

---

## 3. Evolve, do not fork

Forbidden second systems:

| Forbidden | Existing system that remains |
|---|---|
| Second Runtime | `apps/web/src/core/runtime/` · ADR-001 |
| Second graph | `apps/web/src/core/knowledge-graph/` on VIC · `intelligence.knowledge-graph` |
| Second Decision system | One Knowledge Object type `Decision`; VIC `DecisionEngine` and graph `decision` nodes are projections |
| Second memory system | `apps/web/src/core/executive-memory/` · `intelligence.executive-memory` |
| Second orchestration layer | No Brain pipeline, no Brain API gateway as orchestrator |

Do not add a `brain` field to `VentureIntelligenceCore`. Operating knowledge projects onto existing VIC slices.

---

## 4. The Brain owns

- Knowledge Objects
- Knowledge relationships
- Reasoning engines
- Memory engines
- Learning engines
- Executive intelligence products (assemblers and payloads)

Ownership means the Brain is the source of those facts and functions. Runtime still **calls** the engines. Rooms still **project** the VIC result.

---

## 5. The Brain never owns

| Concern | Owner |
|---|---|
| Authentication | Platform identity (ADR-006) |
| Navigation | Interaction Engine / shell |
| Rooms | Situation Room, Executive Office, Company HQ — presentation |
| Capability dispatch | Nobody. The registry does not dispatch (ADR-002) |
| Workspace lifecycle | Workspace Engine |
| Persistence policy | Persistence + intelligence service for VIC snapshots (ADR-005) |
| Pipeline sequencing | Runtime (`RUNTIME_PIPELINE`) |

---

## Brain Rule 001

Every Brain output must be traceable to deterministic evidence.

No recommendation may exist without named supporting Knowledge Objects.

Language models may explain reasoning but never determine evidence, confidence, or recommendations.

Same core and same event produce the same Brain outputs. A recommendation that cannot name its objects does not belong on the desk.

---

## Consequences

- VC-010 is the first implementation sprint. VC-003 does not begin it.
- RM-009 remains Brain **desk layout**, not this ADR and not kernel work.
- Foundation v1.0 stays certified on the locked layers. This ADR specifies Brain governance. It does not certify Brain as implemented, as persistence, or as a second Runtime.
- Inspector and extension hydration diffs remain non-application issues ([Known development artefacts](../KNOWN-DEVELOPMENT-ARTEFACTS.md)).
- Reviewers refuse a diff that adds an orchestrator, a `brain.*` dispatch capability, a second Decision type, or a recommendation without named objects ([Review Process](../../foundation-library/04-ENGINEERING/Review-Process.md)).

---

## Links

| Record | Role |
|---|---|
| [Foundation v1.0](../certification/FOUNDATION-V1.0.md) | Frozen product-development gate |
| [BRAIN-001](./BRAIN-001-VentureOS-Brain-Architecture.md) | Approved architecture (VC-001) |
| [BRAIN-002](./BRAIN-002-VentureOS-Brain-Implementation-Roadmap.md) | Approved implementation sequence (VC-002, FD-B0) |
| [Known development artefacts](../KNOWN-DEVELOPMENT-ARTEFACTS.md) | Non-application verification noise |
| [Review Process](../../foundation-library/04-ENGINEERING/Review-Process.md) | Review programme; Brain Rule 001 is a required check |
| [ADR-001](../../foundation-library/05-GOVERNANCE/Architecture-Decision-Register.md#adr-001--one-orchestrator) | One orchestrator |
| [Founder Decisions](../../foundation-library/05-GOVERNANCE/Founder-Decisions.md) | FD-B0 accepted |
