# Twelve Founding Principles

**Purpose.** Name the twelve non-negotiables of Foundation v1.1 so a sprint cannot quietly violate them.

**Authority.** Constitutional. A change to any principle is a Foundation amendment, not a ticket.

**Audience.** Anyone proposing a change to the desk, the Runtime, IDS, or a product.

**Dependencies.** [VentureOS Creed](./VentureOS-Creed.md) · [Product Philosophy](./Product-Philosophy.md)

**Related Documents.** [Foundation Governance](./Foundation-Governance.md) · [Architecture Overview](../02-ARCHITECTURE/Architecture-Overview.md) · [Architecture Decision Register](../05-GOVERNANCE/Architecture-Decision-Register.md) · [Engineering Standards](../04-ENGINEERING/Engineering-Standards.md)

**Status.** Approved

**Version.** 1.1.0

**Owner.** Foundation

**Last Updated.** 2026-08-20

---

1. **One orchestrator.** The Executive Intelligence Runtime (`runExecutiveIntelligenceRuntime`) is the only intelligence orchestrator. Pages and the shell are presentational.

2. **Capabilities govern; they do not dispatch.** The Shared Capability Registry catalogues reusable capabilities. The Runtime asserts required capabilities and instance profiles. The registry does not execute engines or load modules.

3. **Definitions define products.** The Definition Registry is the only product-definition system. There is no Product Registry. A definition is metadata. It does not execute.

4. **IDS is presentation.** IntelligenceOS clothes the OS. It does not execute, persist, instantiate, or catalogue capabilities. Changing IDS must not require changing Runtime, Capability Framework, or Venture Definitions.

5. **Persistence does not orchestrate.** SQLite repositories store snapshots, auth, workspaces, and membership. The intelligence service is the only adapter that persists Runtime mutation snapshots. Repositories do CRUD and mapping only.

6. **Platform owns identity.** Identity, sessions, workspace cookies, membership, and permissions live in platform services. They do not import Runtime.

7. **One desk.** Situation Room, Company HQ, and the Executive Office share spacing, type, chrome, and empty-state tone. Navigation is wayfinding. It does not instantiate ventures or call the Runtime.

8. **The founder is the principal.** Language, empty states, and primary actions address the person who founds and decides.

9. **Judgement over dashboard.** Surfaces present briefing, health, decisions, and story. They are not scoreboards. One primary action. One primary heading.

10. **Products run on the OS.** Qualora, Calviora, and Farmora share the shell. They do not fork architecture. Identity comes after architecture.

11. **Fail visibly.** Missing intelligence is explained. Generic “Loading…” and “No items” are unconstitutional. Broken layout is not a brand moment.

12. **Accessible by construction.** Skip, focus, contrast, keyboard order, and reduced motion are constitutional, not a later pass. Colour is never the only encoding of health, danger, or selection.

These twelve are restated, not invented, from Foundation v1.0 ownership and the IDS constitution. They are the test every sprint must still pass after Foundation v1.1.
