# Architecture Decision Register

**Purpose.** Record architecture decisions that Foundation v1.1 depends on.

**Authority.** Living register. Entries here do not replace code-adjacent READMEs; they index the decisions those READMEs implement.

**Audience.** Architects, reviewers, and agents about to change a layer.

**Dependencies.** [Foundation Governance](../01-FOUNDATION/Foundation-Governance.md) · [Architecture Overview](../02-ARCHITECTURE/Architecture-Overview.md)

**Related Documents.** [Founder Decisions](./Founder-Decisions.md) · [Runtime](../02-ARCHITECTURE/Runtime.md) · [Capability Framework](../02-ARCHITECTURE/Capability-Framework.md) · [Venture Definitions](../02-ARCHITECTURE/Venture-Definitions.md) · [ADR-009](../../foundation/architecture/ADR-009-VentureOS-Brain.md)

**Status.** Living

**Version.** 1.1.0

**Owner.** Architecture

**Last Updated.** 2026-08-22

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

### ADR-010 — Optional durable Platform StoredObject idempotency

Control authorisation: **F33-04-ASTRA-COR-01**, continued 2026-09-20. Shared Platform storage owns durable upload arbitration through schema-28 reservations. SQLite uniqueness remains StoredObject identity arbitration authority across concurrent processes and crash/restart; changed canonical content conflicts. Ventures retain completed business-acceptance receipts. Compensation is not the duplicate-prevention mechanism.

Durability-path SQL uses dedicated short-lived clients. Native `SQLITE_BUSY` is never retried on the same poisoned handle; each retry opens a new clean native client. Native timeout is 250ms. The absolute contention budget is 5 seconds. Reservation uses dedicated reservation `INSERT`/`SELECT`. Reserved metadata uses a dedicated reserved-object `INSERT`. Reserved-object lookup `SQLITE_BUSY` recovers on a fresh connection without allocating another identity. `stored_object.created` retains the same event ID and values across retry and requires an independent fresh-client read-back before success. `SQLITE_LOCKED` remains non-retry / fail-closed. Permanent, unknown, and deadline-exhausted failures remain fail-closed. WAL is not enabled. There is no dependency or package upgrade. SCHEMA generation remains 28. IndexedDB remains v1. The upstream libSQL failed-statement lifecycle defect is isolated, not fixed.

**F33-04 remains ACTIVE.** The engineering candidate awaits Independent Running-Product Verification and Control certification. Focused StoredObject evidence is 24/24 GREEN. See [COR-01 architecture and engineering evidence](../../engineering/FRIGORA_F3_3_ARCHITECTURE.md#cor-01-durable-evidence-correction). This records Control's authorised architecture and engineering evidence, not final product admission.
