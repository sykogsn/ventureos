# Founder Decisions

**Purpose.** Record founder-level product decisions that the desk and the library must honour.

**Authority.** Living register of founder calls. Distinct from in-product `FounderDecisionRecorded` events.

**Audience.** Product and Foundation owners.

**Dependencies.** [VentureOS Creed](../01-FOUNDATION/VentureOS-Creed.md) · [Product Philosophy](../01-FOUNDATION/Product-Philosophy.md)

**Related Documents.** [Architecture Decision Register](./Architecture-Decision-Register.md) · [Roadmap Register](./Roadmap-Register.md) · [Products](../06-PRODUCTS/README.md)

**Status.** Living

**Version.** 1.2.0

**Owner.** Founder

**Last Updated.** 2026-09-10

---

| ID | Decision | Status |
|---|---|---|
| FD-001 | VentureOS is the operating system for companies | Accepted |
| FD-002 | The desk is Situation Room, Company HQ, and Executive Office | Accepted |
| FD-003 | Qualora, Calviora, and Farmora run on the OS; they are not separate apps | Accepted |
| FD-004 | The founder is the principal of all copy and primary action | Accepted |
| FD-005 | Foundation v1.1 is locked | Accepted |
| FD-006 | Calviora identity (livestock vs healthcare headquarters) is not ratified | Open |
| FD-007 | Every marketed VentureOS-built Venture is a distinct customer-facing software product with its own branded sign-in and application identity. VentureOS remains the shared underlying platform and is customer-invisible by default. | Accepted |
| FD-B0 | Accept BRAIN-002 as the Brain implementation sequence | Accepted |

FD-003 remains accepted. Historical meaning: marketed Ventures are not separate platform architectures or operating-system stacks. They share one OS, one Runtime, one Capability Framework, one Definition Registry, shared Platform Identity, and one Workspace Engine. FD-003 does not mean that all products must expose the same VentureOS-branded customer interface. Customer-facing product identity is FD-007 and [ADR-010](./Architecture-Decision-Register.md#adr-010--product-branded-customer-surfaces).

FD-006 blocks painting Calviora atmosphere. The live definition remains livestock operating cadence. See [Assumption Register](./Assumption-Register.md) A-001 and [Calviora](../06-PRODUCTS/Calviora/README.md).

FD-007 accepts customer-facing product sovereignty. Production and customer-facing authentication must resolve and present the Venture’s own identity. The same applies to customer application chrome. VentureOS branding remains legitimate for founder, portfolio, Company, internal, engineering, development, and verification surfaces. A VentureOS-branded F3.0 verification login is not a retroactive defect. Implementation of production customer-facing identity is a later dedicated programme. This decision is law, not a UI sprint. Constitutional restatement: [Project Constitution](../../PROJECT_CONSTITUTION.md). Architecture: [ADR-010](./Architecture-Decision-Register.md#adr-010--product-branded-customer-surfaces).

FD-B0 accepts [BRAIN-002](../../foundation/architecture/BRAIN-002-VentureOS-Brain-Implementation-Roadmap.md). Governance is [ADR-009](../../foundation/architecture/ADR-009-VentureOS-Brain.md). The first code sprint is VC-010 and is not opened by FD-B0.

## Frigora programme decision history

These existing Frigora programme records retain their original branch-local FD-007–FD-010 labels and checkpoint context. They do not replace current main FD-007 (customer-facing product sovereignty), renumber decisions, or reopen a programme. [Frigora Programme 1](../06-PRODUCTS/Frigora/Programme-1.md) retains their programme context.

FD-007 locks [Frigora Programme 1 — Reactive Service Operations](../06-PRODUCTS/Frigora/Programme-1.md). Sequence: certified F2.0 → F2.1 Work Execution → F2.2 Service Desk & Dispatch → F2.3 Engineer Job Workflow → Programme 1 certification gate. At the time of FD-007, F2.1–F2.3 were authorised roadmap milestones and the live definition remained `frigora@0.16.0`. Do not add F2.4. Capabilities after F2.3 remain provisional and unnumbered until a later founder lock. FD-007 does not open an implementation sprint by itself.

FD-008 scope-locks **F2.1 Work Execution** inside that programme. It authorised implementation within the contract in [Programme 1 — F2.1](../06-PRODUCTS/Frigora/Programme-1.md#f21--work-execution). At the time of FD-008, F2.1 remained not implemented or certified and the live definition remained `frigora@0.16.0` / F2.0. FD-008 itself did not bump the definition, certify F2.1, or open F2.2 or F2.3.

FD-009 formally admits the already-implemented and certified **F2.1 Work Execution** capability at checkpoint `3d27699de63923c1cfc5a08bddab8ea8b356c422` into Frigora's live product baseline as `frigora@0.17.0`. F2.0 Visit Evidence remains certified history. The Planning-First governance checkpoint `ee5fee673d1f6f8c726f392c67b57cf8cde41e6d` follows the F2.1 implementation checkpoint. Programme 1 remains active. Once this product/governance reconciliation is certified and checkpointed, F2.2 Service Desk & Dispatch is formally open for Planning-First planning; it is not implemented. F2.3 remains after certified F2.2, followed by the Programme 1 certification gate. Do not add F2.4. Post-Programme-1 capabilities remain provisional unless separately Founder-approved.

FD-010 formally admits the implemented and certified **F2.2 Service Desk & Dispatch** capability at checkpoint `bee64990c10a28cc5df4c9b88c99c636cd37c38b` into Frigora's live product baseline as `frigora@0.18.0`. The admitted capability comprises the UTC Service Desk/day board, persisted service windows, coordination through the existing WorkOrder assignment model, exact-assignee acceptance or decline, derived dispatch readiness and attention, repository-backed controls, existing authorization boundaries, and additive persistence support. It does not create a second WorkOrder lifecycle, `dispatchStatus`, an Engineer entity, a second assignment model, automatic Visit creation, assignee/Visit-attendee binding, operational priority vocabulary, F2.3 job workflow, offline/PWA/mobile architecture, customer signature, or CSAM. F2.1 remains certified. F2.3 Engineer Job Workflow is the next Planning-First capability and is not yet implemented. The Programme 1 certification gate remains closed until F2.3 is implemented, certified, checkpointed, and reconciled. Do not add F2.4.
