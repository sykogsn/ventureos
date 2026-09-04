# Founder Decisions

**Purpose.** Record founder-level product decisions that the desk and the library must honour.

**Authority.** Living register of founder calls. Distinct from in-product `FounderDecisionRecorded` events.

**Audience.** Product and Foundation owners.

**Dependencies.** [VentureOS Creed](../01-FOUNDATION/VentureOS-Creed.md) · [Product Philosophy](../01-FOUNDATION/Product-Philosophy.md)

**Related Documents.** [Architecture Decision Register](./Architecture-Decision-Register.md) · [Roadmap Register](./Roadmap-Register.md) · [Products](../06-PRODUCTS/README.md) · [Frigora Programme 1](../06-PRODUCTS/Frigora/Programme-1.md)

**Status.** Living

**Version.** 1.1.0

**Owner.** Founder

**Last Updated.** 2026-09-04

---

| ID | Decision | Status |
|---|---|---|
| FD-001 | VentureOS is the operating system for companies | Accepted |
| FD-002 | The desk is Situation Room, Company HQ, and Executive Office | Accepted |
| FD-003 | Qualora, Calviora, and Farmora run on the OS; they are not separate apps | Accepted |
| FD-004 | The founder is the principal of all copy and primary action | Accepted |
| FD-005 | Foundation v1.1 is locked | Accepted |
| FD-006 | Calviora identity (livestock vs healthcare headquarters) is not ratified | Open |
| FD-B0 | Accept BRAIN-002 as the Brain implementation sequence | Accepted |
| FD-007 | Lock Frigora Programme 1 — Reactive Service Operations (F2.1 → F2.2 → F2.3) | Accepted |

FD-006 blocks painting Calviora atmosphere. The live definition remains livestock operating cadence. See [Assumption Register](./Assumption-Register.md) A-001 and [Calviora](../06-PRODUCTS/Calviora/README.md).

FD-B0 accepts [BRAIN-002](../../foundation/architecture/BRAIN-002-VentureOS-Brain-Implementation-Roadmap.md). Governance is [ADR-009](../../foundation/architecture/ADR-009-VentureOS-Brain.md). The first code sprint is VC-010 and is not opened by FD-B0.

FD-007 locks [Frigora Programme 1 — Reactive Service Operations](../06-PRODUCTS/Frigora/Programme-1.md). Sequence: certified F2.0 → F2.1 Work Execution → F2.2 Service Desk & Dispatch → F2.3 Engineer Job Workflow → Programme 1 certification gate. F2.1–F2.3 are authorised roadmap milestones, not implemented. Live definition remains `frigora@0.16.0`. Do not add F2.4. Capabilities after F2.3 remain provisional and unnumbered until a later founder lock. FD-007 does not open an implementation sprint by itself.
