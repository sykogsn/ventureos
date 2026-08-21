# VentureOS Platform Constitution

**Status.** Constitutional  
**Version.** 1.0.0  
**Date.** 2026-08-21  
**Foundation.** v1.1 (locked)  
**Owner.** Architecture

This document is the highest governing specification for **architectural decisions** on VentureOS.

It is not a README.  
It is not an implementation guide.  
It is not a product roadmap.

It consolidates architecture already established in Foundation v1.1. It does not invent a second architecture.

**Technical fact.** When a technical detail in this Constitution and a locked implementation source disagree, the named implementation source and the code are the fact. This Constitution shall then be amended. It shall not be used to override Runtime behaviour, Capability Registry behaviour, Definition Registry behaviour, persistence ownership, or IDS token values.

**Implementation sources of truth.**

- Runtime: `apps/web/src/core/runtime/README.md`
- Capability Framework: `apps/web/src/core/capability/README.md`
- Venture Definitions: `apps/web/src/core/venture-definition/README.md`
- Platform ownership: `apps/web/src/FOUNDATION.md`
- Persistence: `apps/web/src/platform/persistence/README.md`
- IDS: `docs/foundation/design-system/IDS-001-IntelligenceOS-Design-System-Foundation.md` and `IDS-002`
- Desk philosophy: `docs/foundation-library/`

---

## 1. Purpose of VentureOS

VentureOS is the operating system for companies.

The founder founds, operates, and decides from one desk. Situation Room, Company HQ, and the Executive Office are three rooms of one headquarters. They are not three products and not three applications.

The desk exists so judgement is legible: briefing, health, decision, story, and memory. It is not a dashboard farm, not a plugin host, and not a marketing kit.

Qualora, Calviora, and Farmora are products that run on the OS. A generic founded company uses the VentureOS Company definition. Products do not fork the shell, the Runtime, or the navigation model.

## 2. Platform Philosophy

VentureOS is **platform-first**.

1. **One OS, many products.** Architecture is shared. Identity arrives after architecture.
2. **One orchestrator.** Intelligence is run by the Executive Intelligence Runtime alone.
3. **One catalogue.** Reusable building blocks are capabilities in the Shared Capability Registry.
4. **One definition system.** Products are Venture Definitions. There is no Product Registry.
5. **One design constitution.** IntelligenceOS (IDS) clothes the OS. It does not become the OS.
6. **The founder is the principal.** Language, empty states, and primary actions address the person who founds and decides.
7. **Judgement over dashboard.** One primary action. One primary heading. Surfaces present operating judgement, not scoreboards.
8. **Fail visibly.** Missing intelligence is explained. Costumes for excluded features are forbidden.
9. **Identity after architecture.** Brand overlay and copy may change. Orchestration, capability, definition, and navigation models may not.

Calm before spectacle. Hierarchy before density. Guidance before vacancy.

## 3. Constitutional Principles

These restatement the Twelve Founding Principles. A change to any of them is a Foundation amendment, not a ticket.

1. The Executive Intelligence Runtime (`runExecutiveIntelligenceRuntime`) is the only intelligence orchestrator. Pages and the shell are presentational.
2. Capabilities govern; they do not dispatch. The registry catalogues and validates. It does not execute engines or load modules.
3. The Definition Registry is the only product-definition system. A definition is metadata. It does not execute.
4. IDS is presentation. Changing IDS must not require changing Runtime, Capability Framework, or Venture Definitions.
5. Persistence does not orchestrate. Repositories do CRUD and mapping. The intelligence service is the only adapter that persists Runtime mutation snapshots.
6. Platform owns identity. Identity, sessions, workspace cookies, membership, and permissions do not import Runtime.
7. One desk. Situation Room, Company HQ, and the Executive Office share chrome, type, spacing contract, and empty-state tone. Navigation is wayfinding. It does not instantiate ventures or call the Runtime.
8. The founder is the principal.
9. Judgement over dashboard.
10. Products run on the OS. They do not fork architecture.
11. Fail visibly. Generic “Loading…” and “No items” are unconstitutional.
12. Accessible by construction. Colour is never the only encoding of health, danger, or selection.

## 4. Platform Layers

No layer may impersonate another.

| Layer | Does | Does not |
|---|---|---|
| **Runtime** | Orchestrate intelligence for a Venture Intelligence Core | Persist, route, theme, authenticate, lay out the desk |
| **Capability Registry** | Catalogue and validate reusable capabilities | Dispatch, persist, load modules, theme |
| **Definition Registry** | Authoritative metadata for products | Execute, store companies, theme |
| **Persistence** | CRUD and mapping for snapshots and platform data | Orchestrate intelligence |
| **Workspace Engine** | Tenancy: workspaces, membership, workspace cookies, venture-to-workspace scope | Orchestrate intelligence, theme, define products |
| **Platform identity** | Users, sessions, authentication, permissions | Import Runtime |
| **Interaction Engine** | Wayfinding, commands, focus, primary action, interruption | Orchestrate intelligence, instantiate ventures |
| **IDS** | Tokens, climate, brand overlay, type and surface roles | Execute, persist, instantiate, catalogue capabilities |
| **Executive Layout** | Platform layout primitives and layout tokens | Business rules, venture logic, Runtime |
| **Shell and modules** | Project Runtime output onto the desk; route | Become a second application layer or a second orchestrator |

Empty `src/api/*` barrels are unused HTTP facades retained as future extension points. They are not a second application layer.

Presentation modules (including knowledge desks such as Brain) remain shell. They do not become Runtime, Capability Registry, or Definition Registry.

## 5. Runtime Authority

The only intelligence orchestration entry is `runExecutiveIntelligenceRuntime`.

The locked pipeline (`RUNTIME_PIPELINE`) is:

1. `resolve-capabilities`
2. `enforce-instance-profiles`
3. `apply-event`
4. `policy-evaluation`
5. `recommendation-engine`
6. `operating-health`
7. `knowledge-graph`

Memory and story are not separate Runtime stages. Persist is not a Runtime stage.

The Runtime asserts required capabilities and instance profiles. Capability resolution is governance, not dynamic dispatch. The Runtime still imports engines directly. Engines never depend on the Runtime.

The Runtime skips briefing assembly for instances that cannot consume `intelligence.briefing`.

Typical events include company founding, founder decision recorded, and intelligence refresh. Runs are deterministic for the same core and event. Idempotence is required for founding and founder-decision recording.

After a run, the intelligence service writes repositories from mutation snapshots. Screens project the resulting model. They do not re-run the pipeline.

**Amendment required** to add a stage, an alternate entry, or a persist stage.

## 6. Capability Ownership Rules

A capability is a reusable organisational building block. It is not a route, a page, a plugin, or a second runtime.

1. The Shared Capability Registry is the source of truth for capability identity, classification, lifecycle, contracts, and dependencies.
2. IDS does not declare capabilities.
3. The registry does not dispatch, persist, or load modules.
4. A capability has one purpose, one owner, one version.
5. A capability contains no venture-specific logic. Qualora, Calviora, and Farmora consume capabilities; they do not live inside them.
6. Capabilities are independently testable without UI.
7. Lifecycle moves Experimental → Internal → Shared → Stable, or any live stage → Deprecated. No other transitions.
8. Duplicate ids, missing dependencies, cycles, unknown contracts, and illegal transitions fail fast.
9. Do not import a shared implementation as a private shortcut when a capability id exists.
10. Runtime-required capabilities cannot be excluded by a definition.

Classifications include Platform, Data, Intelligence, Governance, and reserved taxonomy for AI, Security, Communication, and Infrastructure.

## 7. Workspace Engine Rules

The Workspace Engine is the established platform tenancy layer. It is not an intelligence orchestrator and not a product.

1. Workspaces, membership, and the workspace cookie live in platform services.
2. Platform identity and the Workspace Engine do not import Runtime.
3. A founded company (Venture Instance) belongs to a workspace.
4. Intelligence projections resolve workspace from the venture, then from the workspace cookie. They do not invent a second tenancy model.
5. `workspace.create` remains on owner/admin role maps. Workspace creation grants the creator `owner` after session check.
6. Navigation may switch workspace. Navigation does not instantiate ventures and does not call the Runtime.
7. A product may not ship a private workspace model, a private membership graph, or a private session cookie.

## 8. Interaction Engine Rules

The Interaction Engine is the established interaction constitution of the desk. It is not a chat Runtime and not an intelligence orchestrator.

1. One primary act per region. Secondary actions recede. Destructive acts are labelled as such.
2. Buttons express acts. Cards group a single judgement or artefact. Dialogs interrupt; they do not become a second app.
3. Navigation is wayfinding. It does not instantiate ventures or call the Runtime.
4. The command palette is a command surface. Ask is not a chat Runtime. Commands are grouped as Intelligence, Navigate, and System.
5. Keyboard order follows visual order. No interaction exists only on hover.
6. Skip to main content is OS chrome. The main landmark is `#main-content`. Focus indicators remain visible.
7. Authentication is part of the desk, not a marketing page. Fields stay empty after logout. Remembered credentials belong to the browser password manager, not to VentureOS storage.
8. Loading prefers structure. Empty states guide the next founding or return to the Situation Room.
9. If a definition excludes a feature, do not offer a control that leads nowhere. Hidden is honest. Disabled-as-costume is not.

## 9. Theme and Design Token Rules

IDS is the presentation constitution.

1. Two climates only: Executive Light and Executive Dark. Climate inverts paper and ink. It does not change brand, capabilities, or features.
2. Appearance Settings, header toggle, and `theme.*` commands are climate-only.
3. Colour hex lives in foundation colour tokens. Screens do not hard-code hex.
4. Brand is overlay keyed to definition id via `data-ids-brand`. Unknown brand ids fail closed to VentureOS.
5. Brand overlay does not alter capability, runtime, or governance profiles. Theme never restores an excluded feature.
6. Executive Atmosphere (EAS-001) is specified design. It is not implemented as headquarters until a dedicated visual programme ships it. Until then, live overlay is VentureOS.
7. Type uses official IDS roles. Raw Tailwind type utilities are not a substitute for those roles.
8. Surfaces use official surface roles. Components do not invent shadows, radius, or translucent fills.
9. **Layout is a platform concern.** Executive Layout primitives encapsulate Tailwind. Product screens compose primitives. They do not compose Tailwind layout utilities. Tailwind remains the rendering engine inside layout primitives and IDS utilities.
10. Layout tokens live in the IDS foundation. Arbitrary product-level spacing, widths, and containers are unconstitutional in product screens.
11. Changing IDS must not require changing Runtime, Capability Framework, or Venture Definitions.
12. Motion confirms change. It does not perform. Honour reduced motion. Theme change must not animate intelligence as if the Runtime were running.

## 10. Venture Boundaries

A Venture Definition is the authoritative metadata for a product on the OS. It is not a VIC company record. It is not a Runtime. It does not execute.

A founded company is a Venture Instance: Venture Intelligence Core plus `definition: { id, version }`.

1. One id, one owner, one lifecycle, one maturity per definition.
2. The orchestrator is always the Executive Intelligence Runtime.
3. Capability ids resolve through the Shared Capability Registry. Missing or unusable capabilities fail fast.
4. Runtime-required capabilities cannot be excluded.
5. Governance names policy, decision, and office capabilities; all three must be Governance-classified and listed in `uses`.
6. Supported and excluded features are disjoint.
7. Venture dependencies are other definition ids. Cycles fail fast.
8. IDS brand keys are definition ids.
9. Instantiation fails fast if the definition is missing, the version does not match, or profiles are invalid. Unknown products fail before instantiation.
10. The launch wizard never shows capability, runtime, or governance profiles.
11. Pre-definition rows map empty definition columns to `ventureos.company@1.0.0`.
12. Projections hide excluded Situation Room, HQ, and Executive Office surfaces. They do not costume them.

Live definitions: `ventureos.company`, `qualora`, `calviora`, `farmora`.

## 11. Platform vs Product Decision Framework

Ask, in order:

1. **Does this change how intelligence is orchestrated?**  
   Runtime. Foundation amendment. Not a product feature.

2. **Does this add a reusable organisational building block?**  
   Capability Registry. Not a page. Not a venture-private module.

3. **Does this define a product or vary which shared blocks a product uses?**  
   Venture Definition. Not a Product Registry. Not a fork of the shell.

4. **Does this change tenancy, session, or membership?**  
   Platform identity and Workspace Engine. Does not import Runtime.

5. **Does this change how the founder moves, focuses, or commands?**  
   Interaction Engine / IDS interaction constitution. Not a second app.

6. **Does this change climate, tokens, type, surface, or layout grammar?**  
   IDS and Executive Layout. Presentation only.

7. **Does this project existing intelligence onto the desk?**  
   Shell or module. Presentational. May not call the Runtime.

8. **Does this exist only so one product looks different?**  
   Copy and brand overlay keyed to definition id. Not architecture.

If the change would be required by a second product tomorrow, it is platform.  
If the change would be meaningless without a specific definition id, it is product identity or a definition profile — not a private stack.

## 12. Reuse Principles

1. Reuse through the Capability Registry, Definition Registry, IDS, Executive Layout, Workspace Engine, and Interaction Engine.
2. Do not copy a shared engine into a product folder.
3. Do not fork spacing, type, or navigation.
4. Do not add a second orchestrator “just for this product”.
5. Shared capabilities remain venture-agnostic.
6. Presentation reuse is primitives and tokens, not duplicated Tailwind layout in each module.
7. Persistence reuse is repositories and mapping, not a second snapshot writer.
8. Prefer fail-fast shared validation over silent product-local workarounds.

## 13. Architectural Review Process

Every review shall check:

1. **Layer.** Did presentation import Runtime? Did a repository orchestrate? Did IDS grow a business rule? Did a product screen compose Tailwind layout?
2. **Lock.** Did the diff touch Runtime, IDS, definitions, persistence ownership, or Executive Environments without that being the sprint?
3. **Product honesty.** Did a theme or empty state restore an excluded feature?
4. **Copy.** Does language address the founder? Are empty and error states executive?
5. **Accessibility.** Skip, focus, keyboard, contrast, reduced motion.
6. **Knowledge.** If a Foundation fact changed, were this Constitution and the Foundation Library updated together?

Approve, request changes, or reject as a Foundation amendment smuggled into a feature.

Architecture, IDS, definition, Runtime, and layout-grammar changes cannot hide inside a feature sprint.

Record architectural outcomes in the Architecture Decision Register.

## 14. Certification Requirements

Certification is layer-specific. One certificate shall not stand for another.

| Concern | What certification means | What it does not mean |
|---|---|---|
| Runtime | Pipeline, events, idempotence, instance enforcement | That the desk looks executive |
| Capability Framework | Catalogue validity, lifecycle, fail-fast graph | That a product is ready |
| Venture Definitions | Instantiation, profiles, feature honesty | That atmosphere is painted |
| Persistence | Snapshot ownership, mapping, no orchestration | Intelligence quality |
| Platform identity / Workspace Engine | Session, membership, tenancy | Runtime health |
| IDS | Tokens, climate, overlay, type/surface roles | Runtime or capability certification |
| Executive Layout | Product screens compose primitives; tokens not arbitrary in product code | That every room has already migrated |
| Desk rooms | Projection honesty, founder copy, accessibility | A second orchestrator |

IDS certification is a presentation concern. It is not Runtime or Capability certification.

Executive Layout v1 treats Authentication as the reference implementation. Other rooms remain to be migrated. Absence of migration is not a licence to compose layout in product screens of those rooms.

Records live under `docs/foundation/certification/` and the Release Register.

## 15. Definition of Platform Capabilities

**Platform capabilities** are reusable building blocks catalogued in the Shared Capability Registry and classified as Platform (and the platform services that already exist beside that catalogue).

They include, as already established:

- Shared Capability Framework (`platform.capability-framework`)
- Identity (`platform.identity`)
- Workspace Engine (tenancy, membership, workspace cookie — platform services)
- Persistence of platform data (not Runtime orchestration)
- IDS (presentation constitution)
- Executive Layout (presentation layout constitution)
- Interaction Engine (wayfinding and command constitution)

A platform capability:

- is venture-agnostic
- is consumed by definitions, not owned by a product folder
- does not execute intelligence (except the Runtime capability, which is the orchestrator itself)
- may not be replaced by a product-private copy

Intelligence, Data, and Governance capabilities in the shared catalogue are also **shared**. They are not product-private. They are not “venture capabilities”.

## 16. Definition of Venture Capabilities

There is **no second capability registry** for products.

**Venture-level variation** is expressed only on a Venture Definition:

- which shared capabilities the definition `uses` or excludes (except Runtime-required capabilities)
- which desk **features** it supports or excludes
- brand overlay keyed to definition id
- copy that fits the product’s purpose

Those profiles are not capabilities. They are instance law.

A product may not:

- invent a capability the registry does not catalogue
- embed venture-specific logic inside a shared capability
- treat a feature flag as a private Runtime
- restore an excluded feature with theme, empty-state costume, or disabled chrome

## 17. Forbidden Architectural Patterns

The following are unconstitutional:

1. A second intelligence orchestrator, or any page/shell/module calling `runExecutiveIntelligenceRuntime`.
2. A Product Registry.
3. Capability dispatch, capability persistence, or capability module loading.
4. Persist as a Runtime stage.
5. Repositories that orchestrate intelligence.
6. Platform identity or Workspace Engine importing Runtime.
7. IDS, layout primitives, or interaction chrome executing founder-decision, policy, or instantiation logic.
8. Engines depending on the Runtime.
9. A second type system, spacing system, or navigation model per product.
10. Product screens composing Tailwind layout utilities (flex, grid, gap, padding, width, breakpoint atoms) instead of Executive Layout primitives.
11. Hard-coded hex in screens.
12. Theme, overlay, or empty state restoring an excluded feature.
13. Generic “Loading…” / “No items” as product copy.
14. Colour as the only encoding of health, danger, or selection.
15. Ask or command palette used as a chat Runtime.
16. A private workspace, session, or membership model inside a product.
17. Duplicate unmarked sources of architectural truth.
18. A Foundation amendment hidden inside a feature sprint.
19. Implementing EAS-001 as an architecture fork rather than a dedicated visual programme.
20. Treating IDS or layout certification as Runtime certification.

## 18. Evolution Rules

1. Foundation v1.1 is locked. Sprints that are not Foundation amendments must not change Runtime behaviour, IDS constitution or token hex, Capability Registry behaviour, Definition Registry behaviour, persistence ownership, or Executive Environments implementation.
2. New shared building blocks are added as capabilities, with fail-fast manifests, not as plugins.
3. New products are added as Venture Definitions, not as application forks.
4. New desk surfaces are modules that project existing intelligence. They do not grow a pipeline.
5. Layout grammar grows by adding platform primitives and tokens, then migrating rooms. It does not grow by extra Tailwind in a single screen.
6. Atmosphere ships only through a named visual programme against EAS-001.
7. Reserved capability classifications (AI, Security, Communication, Infrastructure) may gain entries without changing Runtime authority.
8. Knowledge in the Foundation Library and this Constitution must move in the same change set as the fact they describe.

## 19. Decision Tree for New Features

Before writing code, classify the feature:

```
Is this intelligence orchestration?
  YES → Runtime amendment. Stop. Record ADR.
  NO ↓
Is this a reusable organisational block other products will need?
  YES → Capability Registry. No UI required to prove the block.
  NO ↓
Is this a new product or a change to what a product may use?
  YES → Venture Definition. No private stack.
  NO ↓
Is this tenancy, session, or membership?
  YES → Workspace Engine / platform identity. No Runtime import.
  NO ↓
Is this how the founder moves or commands?
  YES → Interaction Engine. Not a second app.
  NO ↓
Is this climate, token, type, surface, or layout?
  YES → IDS / Executive Layout. Presentation only.
  NO ↓
Is this projecting existing intelligence onto a room of the desk?
  YES → Shell/module. Compose Executive Layout. Do not call Runtime.
  NO ↓
Is this only copy or brand for one definition?
  YES → Overlay and writing. Do not fork architecture.
  NO → The feature is unclassified. Do not implement until it is placed.
```

If two answers are yes, the change is too large. Split it. Do not smuggle a layer crossing inside a single feature.

## 20. Amendment Process

This Constitution is amended only as a Foundation amendment.

1. Record the proposal in the Architecture Decision Register, and in Founder Decisions when the founder is the authority.
2. Name every document and code-adjacent README that must change together: this Constitution, the Foundation Library entry, and the implementation source of truth.
3. Run the architectural review process. The amendment cannot hide inside a feature sprint.
4. Do not modify Runtime, IDS token hex, Capability Registry behaviour, Definition Registry behaviour, or persistence ownership unless the amendment explicitly names that layer.
5. Record the outcome in the Release Register.
6. Update this Constitution in the same change set. Version it. Date it. Do not leave the previous article silently true.

Supersession is explicit. Deleting a locked rule without a dated replacement is unconstitutional.

---

## Authority and consistency

This Constitution restates, and does not replace:

- VentureOS Creed
- Product Philosophy
- Twelve Founding Principles
- Foundation Governance
- Architecture Overview, Runtime, Capability Framework, Venture Definitions
- Situation Room, Company HQ, Executive Office
- IDS, Visual Constitution, Interaction Constitution
- Engineering Standards, Review Process, Sprint Standard
- ADR-001 through ADR-008
- `apps/web/src/FOUNDATION.md`

**Workspace Engine** and **Interaction Engine** in this document are constitutional names for platform tenancy and desk interaction as they already exist. They are not new orchestrators.

**Executive Layout** is the presentation layout law already directed by platform-first IDS: primitives encapsulate Tailwind; product screens compose primitives. Authentication is the reference implementation.

End of Constitution.
