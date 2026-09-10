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
