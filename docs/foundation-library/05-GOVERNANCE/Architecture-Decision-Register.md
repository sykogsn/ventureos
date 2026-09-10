# Architecture Decision Register

**Purpose.** Record architecture decisions that Foundation v1.1 depends on.

**Authority.** Living register. Entries here do not replace code-adjacent READMEs; they index the decisions those READMEs implement.

**Audience.** Architects, reviewers, and agents about to change a layer.

**Dependencies.** [Foundation Governance](../01-FOUNDATION/Foundation-Governance.md) · [Architecture Overview](../02-ARCHITECTURE/Architecture-Overview.md)

**Related Documents.** [Founder Decisions](./Founder-Decisions.md) · [Runtime](../02-ARCHITECTURE/Runtime.md) · [Capability Framework](../02-ARCHITECTURE/Capability-Framework.md) · [Venture Definitions](../02-ARCHITECTURE/Venture-Definitions.md) · [ADR-009](../../foundation/architecture/ADR-009-VentureOS-Brain.md) · [Product Philosophy](../01-FOUNDATION/Product-Philosophy.md)

**Status.** Living

**Version.** 1.2.0

**Owner.** Architecture

**Last Updated.** 2026-09-10

---

| ID | Decision | Status |
|---|---|---|
| ADR-001 | Executive Intelligence Runtime is the only orchestrator | Accepted |
| ADR-002 | Capability Registry is governance, not dispatch | Accepted |
| ADR-003 | Definition Registry is the only product-definition system; no Product Registry | Accepted |
| ADR-004 | IDS is presentation only | Accepted |
| ADR-005 | Intelligence service is the only adapter that persists Runtime snapshots | Accepted |
| ADR-006 | Platform identity does not import Runtime | Accepted |
| ADR-007 | Two climates only; brand is overlay; atmosphere specified separately (EAS-001) | Accepted |
| ADR-008 | Unknown atmosphere/brand ids fail closed to VentureOS | Accepted |
| ADR-009 | VentureOS Brain is the intelligence substrate; Runtime remains the sole orchestrator | Accepted |
| ADR-010 | Product-branded customer surfaces over shared Platform Identity | Accepted |

### ADR-001 — One orchestrator

`runExecutiveIntelligenceRuntime` is the only intelligence orchestration entry. Persist is not a stage. See [Runtime](../02-ARCHITECTURE/Runtime.md).

### ADR-002 — Capabilities govern

The registry catalogues and validates. Engines are imported by the Runtime. Capabilities do not call each other as a pipeline.

### ADR-003 — Definitions define products

The founder selects a Product. Products resolve through the Definition Registry. Instantiation fails fast.

### ADR-004 — IDS is presentation

IDS-001 / IDS-002. Changing IDS must not require changing Runtime, capabilities, or definitions.

### ADR-005 — Persistence ownership

Repositories CRUD. Mutation snapshots are written by the intelligence service.

### ADR-006 — Platform identity

Sessions, membership, and permissions stay outside Runtime. Founder decisions still require `venture.update` before `FounderDecisionRecorded`.

### ADR-007 — Climate and atmosphere

Climate is live (Light/Dark). Executive Atmosphere is specified in EAS-001 and is not implemented as headquarters recognition.

### ADR-008 — Fail closed

Unknown definition-to-brand mapping uses VentureOS. Pre-definition rows map to `ventureos.company@1.0.0`.

### ADR-009 — Brain is substrate

The VentureOS Brain provides knowledge, relationships, memory, reasoning, and executive intelligence products. It never orchestrates. Runtime remains the sole orchestrator. The Brain evolves existing systems; it does not create a second Runtime, graph, Decision system, memory system, or orchestration layer.

**Brain Rule 001.** Every Brain output must be traceable to deterministic evidence. No recommendation may exist without named supporting Knowledge Objects. Language models may explain reasoning but never determine evidence, confidence, or recommendations.

Full text: [ADR-009 — VentureOS Brain](../../foundation/architecture/ADR-009-VentureOS-Brain.md). Architecture: [BRAIN-001](../../foundation/architecture/BRAIN-001-VentureOS-Brain-Architecture.md). Roadmap: [BRAIN-002](../../foundation/architecture/BRAIN-002-VentureOS-Brain-Implementation-Roadmap.md).

### ADR-010 — Product-branded customer surfaces

Product branding and login presentation are definition-driven product identity. Authentication, session handling, and tenancy remain VentureOS platform services.

Required architectural statement:

- Branding and login presentation resolve through the Venture Definition or approved product-identity configuration. There is no Product Registry.
- Authentication, sessions, workspace isolation, membership, permissions, and role authority remain Platform Identity and the Workspace Engine.
- There is no product-specific authentication fork.
- There is no second Runtime.
- There is no second Workspace Engine.
- There is no second Product Registry.

A Frigora, Farmora, Qualora, Calviora, or future marketed-Venture customer login may look product-specific while Platform Identity performs authentication underneath. Shared desk architecture does not require VentureOS branding on those customer surfaces.

Law: [FD-007](./Founder-Decisions.md) · [Project Constitution](../../PROJECT_CONSTITUTION.md) · [Platform Constitution](../../architecture/VENTUREOS_PLATFORM_CONSTITUTION.md).
