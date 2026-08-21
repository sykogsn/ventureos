# Architecture Decision Register

**Purpose.** Record architecture decisions that Foundation v1.1 depends on.

**Authority.** Living register. Entries here do not replace code-adjacent READMEs; they index the decisions those READMEs implement.

**Audience.** Architects, reviewers, and agents about to change a layer.

**Dependencies.** [Foundation Governance](../01-FOUNDATION/Foundation-Governance.md) · [Architecture Overview](../02-ARCHITECTURE/Architecture-Overview.md)

**Related Documents.** [Founder Decisions](./Founder-Decisions.md) · [Runtime](../02-ARCHITECTURE/Runtime.md) · [Capability Framework](../02-ARCHITECTURE/Capability-Framework.md) · [Venture Definitions](../02-ARCHITECTURE/Venture-Definitions.md)

**Status.** Living

**Version.** 1.1.0

**Owner.** Architecture

**Last Updated.** 2026-08-20

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
