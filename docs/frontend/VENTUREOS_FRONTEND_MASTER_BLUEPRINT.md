# VentureOS Frontend Master Blueprint

**Version:** 1.1
**Status:** AUTHORITATIVE / APPROVED FOR INTEGRATION PLANNING
**Registered:** 2026-08-23
**Governance.** Subordinate to the [VentureOS Project Constitution](../PROJECT_CONSTITUTION.md). Locked implementation sources remain the technical fact for Runtime, Capability Registry, Definition Registry, persistence, and IDS token values.

This file replaces the 2026-08-23 repository scaffold (Version Unset). The specification body below is Blueprint v1.1 as received. It is not rewritten.

---
**Version 1.1 — Architecturally hardened. Supersedes v1.0 in full.**

Scope note: this blueprint governs the **presentation layer only**. The Executive Intelligence Runtime (EIR), Venture Intelligence Core (VIC), Shared Capability Framework, Venture Definition Framework, Venture Instance Framework, Runtime Orchestration, Knowledge architecture, Executive Office, Situation Room, Company HQ, the existing architecture and the existing GitHub repository remain the source of truth. The frontend consumes them; it never re-defines them.

Status of v1.1: architectural hardening pass before implementation. No code, React, Tailwind, or Supabase change has been produced as part of this revision.

Convention used throughout: **BACKEND CONTRACT REQUIRED** marks a dependency where the authoritative backend contract is not currently known to the frontend and must be supplied by the runtime/architecture owner before the dependent surface is implemented. No endpoint, table, field, or entity has been invented to fill such a gap.

---

## Contents

1. Product Vision
2. Information Architecture
3. Frontend ↔ VentureOS Domain Mapping Contract
4. Executive Workspace Definition
5. Screen Inventory
6. Screen Contracts
7. Layout System
8. Design System
9. Appearance System — Executive Light / Executive Dark
10. Venture Brand Layer
11. Multi-Venture Frontend Architecture
12. UX Behaviour
13. Performance Standards
14. Accessibility
15. Responsive Behaviour
16. Authentication
17. Frontend Engineering Boundary (Lovable ↔ Cursor)
18. Executive Experience Specification
19. VentureOS Frontend Implementation Programme
20. Frontend Architecture Decision Register
21. Frontend Non-Goals
22. Acceptance Criteria
23. Blueprint Revision Report

---

## 1. Product Vision

*(Preserved from v1.0, unchanged.)*

### 1.1 What VentureOS should feel like
VentureOS is the operating surface of an executive mind. It should feel like sitting at the desk of a Chief Executive who has an entire intelligence staff behind the wall: quiet, immediate, absolutely certain. The interface is not a dashboard product — it is a **command environment**. The user arrives, and the system already knows what changed, what matters, and what requires a decision.

Sensory register: pressurised calm. Dense information, zero visual noise. Weighted, deliberate motion — like a well-machined drawer sliding shut. Never playful, never "SaaS-cheerful", never a wall of purple gradients.

### 1.2 Executive experience principles
1. **Decision-first, not data-first.** Every screen opens with the conclusion, then the evidence, then the raw object. Never the reverse.
2. **The system speaks first.** Where intelligence exists (EIR/VIC), the surface states it in plain executive language before offering controls.
3. **Nothing is ever "loading the app".** Shell is permanent; only the smallest changed region ever moves.
4. **One decision per surface.** Each screen has a single primary action; everything else is secondary or contextual.
5. **Time is the scarcest asset.** Any interaction over three steps is a design defect. Keyboard beats mouse everywhere.
6. **Confidence is displayed, not implied.** Intelligence output always carries provenance, freshness, and confidence.
7. **Never surprise an executive.** Destructive or externally visible actions require explicit, typed or two-step confirmation.
8. **Silence is a feature.** Empty states, quiet periods, and "nothing needs you" are first-class, designed states.

### 1.3 UX philosophy
- **Persistent context.** The user never loses their place: company, workspace, filters, scroll position, and open panels survive navigation.
- **Progressive depth.** Summary → Analysis → Object → Raw. Four depths maximum, each one click or one keystroke away.
- **Everything addressable.** Every entity, view, filter state, and panel has a URL.
- **Command over navigation.** The command palette is the fastest path to anything; the sidebar is the map, not the road.
- **Intelligence is ambient.** AI is not a chat bubble bolted on; it is present in-context on every object, with the command centre as its home.
- **Restraint as luxury.** Fewer colours, fewer weights, more space, more precision.

### 1.4 One operating system, many Ventures
A user moving from Qualora to Farmora must immediately recognise that they are still operating VentureOS. Venture identity is expressed through a controlled brand layer (§10), never through a divergent design system, layout, or navigation paradigm.

---

## 2. Information Architecture

### 2.1 Global structure
```text
+--------------------------------------------------------------+
|  HEADER  (venture switch | breadcrumb | search | AI | user)   |
+---------+----------------------------------------------------+
| SIDEBAR |  CONTENT REGION                                     |
| (nav)   |  (route outlet, scrolls independently)              |
|         |                                    +-------------+  |
|         |                                    | CONTEXT     |  |
|         |                                    | PANEL (opt) |  |
+---------+----------------------------------------------------+
|  STATUS STRIP (runtime health | last sync | active ventures)  |
+--------------------------------------------------------------+
```

### 2.2 Global navigation model
Three navigation planes, always available:
- **Spatial plane** — sidebar: where things live.
- **Command plane** — palette (`Cmd/Ctrl+K`): what you want to do.
- **Intelligence plane** — AI command centre (`Cmd/Ctrl+J`): what you want to know or decide.

Navigation order in the sidebar is fixed and reflects executive priority, not alphabetical or technical grouping. The Venture Brand Layer may not reorder, rename beyond approved terminology (§11.4), or restructure these planes.

### 2.3 Sidebar
Structure, top to bottom:
1. **VentureOS Workspace selector** (compact, top of rail) — operating scope (§4.1).
2. **Priority group** — Situation Room, Executive Workspace, Executive Office.
3. **Venture group** — Company HQ, Ventures list (expandable tree of Venture Instances), Capabilities.
4. **Intelligence group** — Knowledge, Reports, Runtime (orchestration observability, read-only for most roles).
5. **Operations group** — Notifications, Users, Teams.
6. **Footer** — Settings, Administration (role-gated), Profile, appearance switch (Light/Dark), collapse control.

Behaviour:
- Three states: **expanded (260px)**, **collapsed rail (64px, icons + tooltips)**, **overlay** (tablet/mobile).
- State persists per user, per device.
- Active route indicated by a solid left marker plus elevated background — never by colour alone.
- Groups are collapsible; collapse state persists.
- Counts/badges appear inline (notifications, decisions pending) and are aria-labelled with meaning, not just numbers.
- Sidebar never re-mounts on navigation.

### 2.4 Header
Fixed 56px. Left → right:
- **Venture/company switcher** (primary context; shows Venture mark from the Brand Layer, name, and environment tag).
- **Breadcrumb / route title**, truncating from the middle, with copy-link affordance.
- **Global search** (click or `/`), presented as an inline field on desktop, icon on smaller widths.
- **AI command centre trigger** (`Cmd/Ctrl+J`), with a subtle activity indicator when the runtime is working.
- **Notifications bell** with unread state.
- **User menu** — profile, appearance mode, keyboard shortcuts, sign out.

Header never scrolls, never changes height, never re-mounts.

### 2.5 Workspace switching
- A **VentureOS Workspace** is the operating scope (§4.1): the set of Ventures/companies, capabilities, and data the executive is currently operating over.
- Switcher lives at the top of the sidebar; keyboard `Cmd/Ctrl+Shift+W`.
- Switching preserves the current *route shape* where valid (e.g. Reports stays Reports) and falls back to Situation Room when the route has no equivalent.
- Workspace is encoded in the URL so links are unambiguous and shareable.
- Recent workspaces surface first; search filters beyond five.
- **BACKEND CONTRACT REQUIRED** — the authoritative definition, membership, and permission scope of a Workspace object (or the runtime concept it maps to) must be supplied; the frontend must not persist its own workspace registry.

### 2.6 Venture / company switching
- Venture context feeds Company HQ, Executive Office, Knowledge, Reports, and the active Venture Brand Layer.
- Switcher in header; keyboard `Cmd/Ctrl+Shift+O`.
- Presents: Venture mark, name, lifecycle stage, runtime status dot, and last intelligence refresh.
- Switching is instant: shell and route persist, only Venture-scoped regions re-resolve, with skeletons confined to those regions. The Brand Layer accent and mark swap within the same frame; the appearance mode (Light/Dark) does not change.
- Cross-Venture comparison is a Reports/Situation Room capability, not a switcher behaviour.

### 2.7 Search
- Single global search across Knowledge Objects, Ventures, companies, reports, people, capabilities, and settings pages.
- Opens as an overlay; `/` or click. Results grouped by type, ranked by recency + relevance + current context.
- Every result shows type, Venture scope, and last-updated.
- Supports scoped syntax: `venture:`, `type:`, `owner:`, `since:`.
- Recent searches and recent objects shown on empty query.
- Search is read-only; actions on results are offered as secondary affordances (open, pin, share link).
- **BACKEND CONTRACT REQUIRED** — unified search endpoint, ranking semantics, and permission filtering. The frontend must not build a client-side index over privileged data.

### 2.8 AI command centre
- Home of executive intelligence interaction. Opens as a right-side panel (420–520px) or expands full-surface for long-form work.
- Always context-aware: knows current workspace, Venture, route, and selected object; the context chips are visible and removable.
- Three modes: **Ask** (question → answer with citations), **Act** (proposes runtime actions requiring confirmation), **Brief** (generates or refreshes an executive briefing).
- Every answer carries: source Knowledge Objects, freshness, confidence, and a "show working" expansion.
- Streaming responses; interruptible; never blocks the rest of the interface.
- Inline entry points: an "Ask about this" affordance on every object header, seeding the panel with that object as context.
- History is per workspace, resumable, and addressable by URL.
- The command centre **renders** intelligence produced by EIR/VIC. It never composes, ranks, summarises, or scores intelligence client-side (§17.4).

---

## 3. Frontend ↔ VentureOS Domain Mapping Contract

The frontend must not invent a parallel domain model. Every frontend concept below is classified as one of:

- **DOMAIN-MAPPED** — corresponds to an existing authoritative VentureOS domain concept.
- **PRESENTATION-ONLY** — a view composition over authoritative objects; no backend entity exists or is required.
- **CONTRACT PENDING** — a concept the UI depends on for which the authoritative backend contract is not currently known.

### 3.1 Mapping table

| Frontend term | Classification | Meaning in the frontend | Authoritative source | Explicitly NOT allowed to redefine |
|---|---|---|---|---|
| **VentureOS Workspace** | CONTRACT PENDING | The operating scope: which Ventures/companies, capabilities and intelligence the user is currently operating over. | **BACKEND CONTRACT REQUIRED** — scope/tenancy object owned by the runtime and permission model. | Tenancy, membership, permission scope, data visibility. The frontend may not create, merge, or infer workspaces. |
| **Executive Workspace** | PRESENTATION-ONLY | The executive's primary operating environment: a composed destination assembling decisions, briefings and assignments for the active scope (§4.2). | Composition over EIR outputs, Knowledge Objects, capability runs, and assignment data. | It is not a container, not a tenancy boundary, and holds no state of its own beyond user view preferences. |
| **Company** | DOMAIN-MAPPED | An operating entity the executive governs. | Venture Instance Framework / entity registry. **BACKEND CONTRACT REQUIRED** for the exact company↔Venture-instance relationship (1:1, 1:N, or distinct registries). | Entity identity, lifecycle, ownership, hierarchy. |
| **Venture** | DOMAIN-MAPPED | A VentureOS product/business defined by the Venture Definition Framework and instantiated by the Venture Instance Framework (e.g. Qualora, Calviora, Farmora). | Venture Definition Framework + Venture Instance Framework. | Definition schema, capability entitlement, lifecycle stages, instance state. |
| **Portfolio** | PRESENTATION-ONLY | A multi-Venture view produced by the current Workspace scope. | Derived from Workspace scope + Venture Instances. | It is not a stored grouping entity unless the backend already defines one. The frontend must not persist ad-hoc portfolios. |
| **Division** | CONTRACT PENDING | An organisational sub-scope beneath a company, used only for filtering and grouping. | **BACKEND CONTRACT REQUIRED** — no division entity is assumed to exist. | If no backend concept exists, Division is removed from the UI rather than invented. |
| **Executive Desk** | PRESENTATION-ONLY | A region *within* Executive Workspace (§4.3), not a separate destination. | Composition over assignments, pinned objects, drafts, follow-ups. | It is not a store; pins/drafts must persist through an authoritative user-state contract — **BACKEND CONTRACT REQUIRED** for user pins, drafts, and follow-ups. |
| **Executive Office** | DOMAIN-MAPPED | The surface where capability runs are commissioned, reviewed and approved. | Shared Capability Framework + Runtime Orchestration. | Capability registry, invocation semantics, orchestration state machine, approval authority. |
| **Company HQ** | DOMAIN-MAPPED | The single company/Venture-instance operating truth surface. | Venture Instance + VIC + Knowledge + capability coverage. | Instance state, metric definitions, coverage computation. |
| **Situation Room** | DOMAIN-MAPPED | Cross-scope surface of what changed and what needs a decision now. | EIR (signals, judgements, decision queue) + Runtime health. | Signal generation, prioritisation, severity, decision-queue ordering. The frontend renders EIR ordering; it does not re-rank. |
| **Knowledge** | DOMAIN-MAPPED | Browse/inspect surface over Knowledge Objects. | Knowledge architecture. | Object schema, lineage, versioning, freshness/confidence computation, creation authority. |
| **Capability** | DOMAIN-MAPPED | An executable unit offered to the executive. | Shared Capability Framework. | Registry, versioning, availability, input contracts, execution. |
| **Decision** | DOMAIN-MAPPED | An item requiring executive resolution. | EIR decision queue. **BACKEND CONTRACT REQUIRED** for the resolve/defer/delegate action contract. | Lifecycle, authority, audit. |
| **Insight / Judgement** | DOMAIN-MAPPED | An intelligence statement with confidence, provenance, freshness. | EIR / VIC. | Content, confidence, provenance, reasoning. Never synthesised client-side. |
| **Report** | DOMAIN-MAPPED | A generated executive document. | Reporting/runtime output. **BACKEND CONTRACT REQUIRED** for scheduling and template contracts. | Generation, content authority, distribution. |
| **Runtime run / trace** | DOMAIN-MAPPED | Read-only observability of orchestration. | Runtime Orchestration. | Run state, retries, step semantics. |
| **User / Team / Role** | DOMAIN-MAPPED | Identity and access presentation. | Supabase Auth + server-side authorisation model. | Authoritative permissions, role definitions, enforcement (§17.5). |
| **View / Saved view / Filter state** | PRESENTATION-ONLY | UI state, URL-encoded; optionally persisted as user preference. | Frontend + user-preference store. **BACKEND CONTRACT REQUIRED** if saved views must sync across devices. | Must never encode business rules or permission logic. |
| **Appearance mode / Brand Layer** | PRESENTATION-ONLY | Executive Light / Executive Dark + Venture identity properties (§9, §10). | Venture Definition metadata for brand properties. **BACKEND CONTRACT REQUIRED** for the brand-property source. | Must not alter behaviour, permissions, or data. |

### 3.2 Rules
1. If a frontend surface needs data with no known authoritative source, it is marked **BACKEND CONTRACT REQUIRED** and the surface is deferred — never backed by a frontend-invented entity, local database table, or client-side derivation.
2. The frontend may compose and project authoritative objects; it may not originate domain objects.
3. Presentation-only concepts must never leak into API request shapes as if they were domain entities.
4. Terminology in the UI may be adapted per Venture only through approved terminology configuration (§11.4); the underlying domain term remains unchanged in code, URLs, and contracts.

---

## 4. Executive Workspace Definition

v1.0 used "workspace" both as an operating scope and, implicitly, as a place. v1.1 separates the two permanently.

### 4.1 VentureOS Workspace (technical/contextual operating scope)
- Definition: the **scope** in which the executive is operating — which Ventures, companies, capabilities, knowledge and intelligence are in view, and under which permissions.
- It is a *context*, not a *destination*. There is no route named "Workspace".
- It is selected in the sidebar selector, encoded in the URL, and applied to every data request as scope.
- It is authoritative-backed: **BACKEND CONTRACT REQUIRED** (§3.1).
- Changing it changes what every screen shows; it never changes which screen you are on (where a route equivalent exists).

### 4.2 Executive Workspace (the executive's primary operating environment)
- Definition: the **destination** the executive lands in by default after Situation Room triage — their personal operating environment for the active VentureOS Workspace scope.
- Route: `/workspace`.
- It is a composed surface, presentation-only, assembling: today's briefing, decisions assigned to the executive, active engagements they own, drafts, pinned objects, and follow-ups.
- It is scoped by the active VentureOS Workspace and Venture context.

### 4.3 Resolution of Executive Desk
Assessment: Executive Desk (v1.0 §3.5) and Executive Workspace serve the same user need — the executive's personal queue. Maintaining both produces two destinations with near-identical content, violating the "one decision per surface" and "avoid overlapping screens" principles.

**Decision:** Executive Desk is **not removed and not promoted**. It becomes the **primary region within Executive Workspace** — the personal queue region (Today, My decisions, Assigned to me, Drafts, Pinned, Follow-ups). It is no longer a separate route or sidebar entry.

Reasoning:
- The distinguishing content of Executive Desk was entirely personal-queue content, which is precisely what an executive's primary operating environment must lead with.
- Retaining "Desk" as vocabulary preserves the executive metaphor and the work already specified, without a second destination.
- Situation Room remains distinct because it is *portfolio-wide and time-critical*; the Desk region is *personal and owned*.

### 4.4 Authoritative model
```text
VentureOS Workspace (scope, in URL, applies to everything)
   |
   +-- Situation Room        /situation-room     cross-scope, what changed / what needs a decision NOW
   +-- Executive Workspace   /workspace          the executive's own environment
   |        +-- Desk region        personal queue: today, decisions, assigned, drafts, pinned, follow-ups
   |        +-- Briefing region    the current EIR briefing
   |        +-- Attention region   items the runtime nominates for this executive
   +-- Executive Office      /office             commission / review / approve capability work
   +-- Company HQ            /companies/:id      one company/Venture instance operating truth
   +-- Knowledge, Reports, Runtime, Operations, Settings, Administration
```

Boundaries that must not blur:
| Surface | Owns | Must not contain |
|---|---|---|
| Situation Room | Cross-Venture signals, decision queue, risk board, runtime health | Personal drafts, personal pins, capability commissioning |
| Executive Workspace | Personal queue, briefing, personal follow-ups | Portfolio-wide risk boards, capability catalogue browsing |
| Executive Office | Capability catalogue, engagements, deliverables, approvals | Personal queue, portfolio signal feed |
| Company HQ | One entity's truth | Cross-company comparison (that is Reports/Situation Room) |

Global navigation reflects exactly four priority destinations: Situation Room, Executive Workspace, Executive Office, Company HQ. Company/Venture context is a header concern, not a navigation destination.

---

## 5. Screen Inventory

Directional inventory; every primary screen additionally carries a formal Screen Contract in §6.

### 5.1 Authentication
Sign in; magic-link sent; MFA challenge; MFA enrolment; SSO callback/processing; forgot/reset password; invitation acceptance; access denied / no workspace.

### 5.2 Situation Room
Signal header (EIR headline judgement), decision queue, live signals feed, risk & exception board, runtime health, cross-Venture comparison strip.

### 5.3 Executive Workspace
Briefing region, Desk region (today, my decisions, assigned to me, drafts, pinned, follow-ups), attention region.

### 5.4 Executive Office
Office overview, active engagements, capability launcher, deliverables, approvals, advisor/agent roster, engagement detail.

### 5.5 Company HQ
Identity header, executive summary, capability coverage map, Venture definition snapshot, key metrics, recent knowledge, open decisions, activity timeline.

### 5.6 Knowledge
Knowledge library (faceted), Knowledge object detail, collections.

### 5.7 Reports
Report library, report viewer, report builder/schedule.

### 5.8 Notifications
Inbox, notification preferences.

### 5.9 Settings
General; Appearance (Light/Dark, density, reduced motion, sidebar default); Notifications; Companies; Capabilities; Knowledge; Integrations; API keys & webhooks; Billing & usage (role-gated); Security; Danger zone.

### 5.10 Users
User list, user detail, invite user.

### 5.11 Teams
Team list, team detail, create/edit team.

### 5.12 Profile
Identity, preferences, appearance, shortcut reference, connected accounts, MFA management, sessions.

### 5.13 Administration (role-gated)
Admin overview; organisation settings; roles & permissions; audit log; runtime & orchestration observability; capability administration; Venture configuration & Brand Layer administration (§11.4); system status & incidents.

### 5.14 Utility screens
404, 403, 500/error boundary, offline, maintenance, session-expired re-auth modal.

---

## 6. Screen Contracts

Every primary screen carries a formal contract. Contract sections are fixed: Identity, Context, Data Dependencies, Information Hierarchy, Regions, Components, Intelligence Behaviour, Actions, Interaction Behaviour, System States, Responsive Transformation, URL State.

System states are enumerated identically for every screen: **loading, empty, filtered-empty, stale, degraded, error, offline, permission-denied**. Where a screen has no meaningful variant of a state, the contract says so explicitly.

---

### 6.1 Screen Contract — Situation Room

**Identity**
- Name: Situation Room. Purpose: present, within two seconds, what changed across scope and what requires a decision now.
- Primary user: executive/principal; secondary: chief of staff, operator roles.
- Route: `/situation-room`.
- Permissions: any authenticated user with at least read scope on one Venture; region-level gating for runtime health and cross-Venture comparison.

**Context**
- Venture/company scope: all Ventures within the active VentureOS Workspace; optional filter to one.
- Workspace scope: active workspace, URL-encoded.
- EIR context: headline judgement, signal stream, decision queue, risk register for the scope.
- VIC context: per-Venture intelligence state used by the comparison strip.

**Data Dependencies**
- Authoritative: EIR signals & judgements; EIR decision queue; Runtime Orchestration health; VIC per-Venture summary.
- Required: headline judgement text + confidence + freshness; decision items with severity, Venture, owner, due state; signal events with timestamp and source; runtime status by component.
- Optional: cross-Venture comparison metrics; scan-now availability.
- Freshness: headline ≤ 15 min; decision queue near-real-time (push or ≤ 60s poll); signals streaming where available; runtime health ≤ 30s.
- **BACKEND CONTRACT REQUIRED** — decision queue read + resolve/defer/delegate; signal stream transport (SSE/websocket/poll); scan-now trigger; runtime health read model.

**Information Hierarchy**
1. Headline judgement (one executive sentence, with confidence + freshness).
2. Count and nature of items requiring a decision.
3. Top decision, fully actionable in place.
4. Risk & exception board.
5. Live signal feed.
6. Runtime health.
7. Cross-Venture comparison strip.

**Regions**
Signal header; decision queue; risk & exception board; live signals feed; runtime health strip; cross-Venture comparison strip; filter bar (sticky).

**Components**
Insight card; decision card; filter bar; saved-view chip; status dot; confidence meter; freshness stamp; timeline (signal feed); heatmap/bar (comparison); banner; empty-state block; context panel.

**Intelligence Behaviour**
- EIR supplies the headline, the queue ordering and severity. The frontend renders that ordering verbatim; it never re-ranks or re-scores.
- Every intelligence element shows confidence (3-segment + numeric), provenance (source Knowledge Objects, linked), freshness stamp, and a "show working" expansion revealing the reasoning outline and orchestration steps.
- Evidence opens in the context panel, never navigating away from the queue.
- Recommended actions are presented as proposals with approve/modify/reject; nothing executes automatically.

**Actions**
- Primary: resolve the top decision.
- Secondary: defer/snooze, delegate, open evidence, ask about this, filter, save view, scan now.
- Contextual (per row): open Venture HQ, open source object, copy link, mute signal type.
- Destructive: dismiss a decision permanently — modal confirm naming the decision; audit-logged.

**Interaction Behaviour**
- Click: row opens the context panel (detail), never a full navigation, preserving queue position.
- Keyboard: `j/k` move, `Enter` open, `R` resolve, `D` defer, `E` evidence, `Esc` close panel; roving tabindex in the queue.
- Command palette: "Resolve decision…", "Filter Situation Room by…", "Scan now".
- Drill-down: judgement → evidence → Knowledge Object → raw payload (4 depths max).
- Back: restores scroll, filters, selection, and panel state.
- Deep link: `/situation-room?...&decision=<id>` opens with that decision selected and its panel open.

**System States**
- Loading: skeleton for header + 5 queue rows at exact final geometry; shell never in loading.
- Empty: "Nothing requires your attention", last-scan time, scan-now action — designed as a positive state.
- Filtered-empty: "No items match these filters" + clear-filters.
- Stale: banner "Last intelligence refresh 42m ago" with refresh; data remains visible.
- Degraded: runtime partially unavailable — banner naming affected components; unaffected regions fully usable.
- Error: region-level error block with retry and reference ID; shell and other regions unaffected.
- Offline: last-good data with an offline banner; actions disabled with reason.
- Permission denied: regions the user cannot see are omitted, not greyed; if no scope at all, an explanatory screen with request-access.

**Responsive Transformation**
- Desktop XL: three-column board; inline context panel; comparison strip full width.
- Desktop: two-column; context panel overlays.
- Laptop: single column, priority order as §Information Hierarchy; comparison strip collapses to a summary row.
- Tablet: stacked; queue rows become entity rows; panel becomes a bottom drawer.
- Mobile (future): decision queue only by default, with a segmented control to reach other regions; read-and-resolve first.

**URL State**
`workspace`, optional `venture`, `severity`, `capability`, `window`, `view` (saved view id), `decision` (selected), `panel` (evidence|ai|none), `q`.

---

### 6.2 Screen Contract — Executive Workspace

**Identity**
- Name: Executive Workspace. Purpose: the executive's own operating environment — what is mine, today.
- Primary user: executive/principal.
- Route: `/workspace`.
- Permissions: authenticated; content is inherently self-scoped.

**Context**
- Venture scope: all Ventures in the active workspace; items carry Venture badges.
- Workspace scope: active workspace.
- EIR: personal briefing, nominated attention items.
- VIC: per-item Venture intelligence used for badges and summaries.

**Data Dependencies**
- Authoritative: EIR briefing; assignment/ownership data; capability engagement ownership; Knowledge Objects for pins/drafts.
- Required: today's briefing; decisions owned by the user; items assigned to the user; follow-ups with due state.
- Optional: pinned objects; drafts; suggested next actions.
- Freshness: briefing ≤ 1 hour or on-demand; assignments ≤ 60s.
- **BACKEND CONTRACT REQUIRED** — user pins, drafts, follow-ups persistence; assignment model; briefing generation/refresh contract.

**Information Hierarchy**
1. Briefing headline (or "start today's briefing").
2. Decisions owned by the user.
3. Assigned to me.
4. Follow-ups due.
5. Drafts.
6. Pinned objects.

**Regions**
Briefing region; Desk region (Today, My decisions, Assigned to me, Drafts, Pinned, Follow-ups); Attention region (EIR nominations); context panel.

**Components**
Insight card; entity card; list rows; tabs (one level, within Desk region); pill; freshness stamp; empty-state block; command palette entries.

**Intelligence Behaviour**
Briefing is EIR-produced, with sources, confidence, freshness, and "show working". Attention nominations carry the reason ("Runtime flagged: variance exceeds threshold") and link to evidence. Priority ordering comes from EIR's priority score; manual pin overrides ordering for display only and is never sent back as an intelligence signal.

**Actions**
- Primary: start/open today's briefing.
- Secondary: resolve a decision, open assignment, complete follow-up, pin/unpin, resume draft.
- Contextual: ask about this, copy link, open in Company HQ.
- Destructive: discard draft — confirm naming the draft.

**Interaction Behaviour**
Keyboard `j/k`, `Enter`, `P` pin, `C` complete; command palette "Open briefing", "My decisions"; drill-down into evidence via panel; back restores tab, scroll, selection; deep link to a Desk tab and selected item.

**System States**
Loading: region skeletons. Empty: "Desk clear" with EIR-suggested next actions. Filtered-empty: per-tab message with clear filter. Stale: briefing age banner with refresh. Degraded: briefing unavailable → Desk still fully functional with an explanatory note. Error: per-region. Offline: read-only with cached content. Permission denied: not applicable at screen level; individual items are omitted.

**Responsive Transformation**
XL/Desktop: two-column (briefing + Desk) with inline panel. Laptop: single column, briefing collapsible. Tablet: tabs become a select; panel becomes drawer. Mobile (future): Today first, other tabs behind a selector.

**URL State**
`workspace`, `tab` (today|decisions|assigned|drafts|pinned|followups), `item`, `panel`.

---

### 6.3 Screen Contract — Executive Office

**Identity**
- Name: Executive Office. Purpose: commission, review and approve capability work.
- Primary user: executive; secondary: analysts/operators with capability rights.
- Routes: `/office`, `/office/engagements/:id`.
- Permissions: capability invocation and approval rights are server-authoritative; the UI reflects them only.

**Context**
Venture scope: active Venture, or all in workspace with a Venture filter. EIR: approval nominations. VIC: Venture-specific capability context and inputs.

**Data Dependencies**
- Authoritative: Shared Capability Framework registry (available capabilities, versions, input contracts); Runtime Orchestration (engagement/run state, traces); deliverables; approvals.
- Required: capability catalogue for scope; active engagements with status and owner; deliverables with freshness; approvals awaiting the user.
- Optional: advisor/agent roster with live status.
- Freshness: engagement state near-real-time; catalogue ≤ 1 hour cache.
- **BACKEND CONTRACT REQUIRED** — capability invocation request/response shape; engagement lifecycle states; approval action contract; streaming trace transport; advisor/agent roster source.

**Information Hierarchy**
1. Approvals awaiting the executive.
2. Active engagements and their state.
3. Recent deliverables.
4. Capability launcher.
5. Advisor/agent roster.

**Regions**
Office overview strip; approvals; active engagements; deliverables; capability launcher; roster. Engagement detail: inputs → orchestration trace (read-only) → outputs → citations → decision bar.

**Components**
Entity card; action card; table (engagements); timeline (trace); dialog/sheet (launch form); form primitives; status dot; confidence meter; document viewer (deliverables).

**Intelligence Behaviour**
Capability output is EIR/VIC-authoritative. Every deliverable shows confidence, provenance, freshness, and full reasoning access via the trace. Proposed actions arising from a run are shown as an explicit plan requiring approve/modify/reject. The frontend never summarises or re-words intelligence output for display beyond truncation with a full-value affordance.

**Actions**
- Primary: commission a capability run.
- Secondary: approve, request changes, reject, open trace, export deliverable, re-run with modified inputs.
- Contextual: ask about this engagement; copy link; assign reviewer.
- Destructive: cancel a running engagement (confirm, naming it), archive a deliverable (typed confirmation if externally distributed).

**Interaction Behaviour**
Launcher opens as a sheet with a stepped form; validation on blur/submit. Trace streams with a stop control. Keyboard: `N` new run, `A` approve (with confirm), `T` trace. Deep link to engagement, trace step, or deliverable page.

**System States**
Loading: catalogue skeleton grid; engagement table skeleton rows preserving column widths. Empty: capability catalogue as the entry point. Filtered-empty: clear filters. Stale: deliverable freshness banner. Degraded: runtime queue backed up → engagements show queued state with expected wait; commissioning may be disabled with an explanation. Error: launch failure shows the runtime's reason plus retry; never a generic message. Offline: catalogue viewable; commissioning disabled with reason. Permission denied: capabilities the user cannot invoke are shown disabled with reason, or hidden where their existence is itself privileged.

**Responsive Transformation**
XL: three-up catalogue, split engagement list/detail. Desktop: two-up, detail overlays. Laptop: single column, detail full-region. Tablet: list → detail navigation with back. Mobile (future): approvals and deliverable reading only; commissioning deferred.

**URL State**
`workspace`, `venture`, `status`, `capability`, `engagement`, `step` (trace step), `tab`, `panel`.

---

### 6.4 Screen Contract — Company HQ

**Identity**
- Name: Company HQ. Purpose: one company/Venture instance's operating truth.
- Primary user: executive and Venture owner.
- Route: `/companies/:companyId`.
- Permissions: read scope on that company; region gating for metrics and decisions.

**Context**
Venture scope: exactly one. Workspace scope: must contain the company; otherwise an explanatory state with a switch action. EIR: company-scoped judgement and open decisions. VIC: company intelligence, metrics, coverage.

**Data Dependencies**
- Authoritative: Venture Instance (identity, stage, ownership, status); Venture Definition snapshot; capability coverage; VIC metrics; Knowledge Objects; EIR decisions; activity/audit timeline.
- Required: identity, stage, status, executive summary, key metrics, open decisions.
- Optional: coverage map, recent knowledge, activity timeline.
- Freshness: summary ≤ 1 hour; metrics per metric definition; decisions near-real-time.
- **BACKEND CONTRACT REQUIRED** — metric definitions and units; capability coverage computation; activity timeline source.

**Information Hierarchy**
1. Identity + status + last intelligence refresh.
2. Executive summary (EIR judgement).
3. Open decisions for this company.
4. Key metrics.
5. Capability coverage map.
6. Venture definition snapshot.
7. Recent knowledge.
8. Activity timeline.

**Regions**
Identity header; summary; decisions; metrics grid; coverage heatmap; definition snapshot; knowledge list; timeline; context panel.

**Components**
Entity header; insight card; metric card; heatmap; table; timeline; tag; status dot; freshness stamp.

**Intelligence Behaviour**
Executive summary is EIR output with confidence/provenance/freshness and "show working". Metrics link to their defining Knowledge Object or metric definition; no metric is displayed without a definition path. Coverage map states what is measured and as of when.

**Actions**
- Primary: open the current briefing for this company.
- Secondary: commission a capability for this company, resolve a decision, open Knowledge filtered to this company, generate a report.
- Contextual: copy link, ask about this company, pin.
- Destructive: none on this screen; lifecycle changes live in Administration/Venture configuration.

**Interaction Behaviour**
Metric click opens the metric detail panel (definition, history, source). Coverage cell click filters the capability list. Keyboard region jumps (`g` then region key). Deep link to any region and any selected metric.

**System States**
Loading: region skeletons at final geometry. Empty: onboarding checklist for an unconfigured company. Filtered-empty: knowledge/decision lists show their own message. Stale: per-region freshness stamps escalate past threshold, plus a page banner if the whole summary is stale. Degraded: metrics unavailable → cards show "unavailable" with reason, not zeros. Error: per-region. Offline: cached view with banner. Permission denied: whole-screen 403 with the scope explained and a request-access action.

**Responsive Transformation**
XL: three-column with inline panel. Desktop: two-column. Laptop: single column with sticky region nav. Tablet: accordion regions; heatmap becomes a ranked list. Mobile (future): summary, decisions, top metrics only.

**URL State**
`companyId`, `workspace`, `region` (scroll anchor), `metric`, `panel`, `range`.

---

### 6.5 Screen Contract — Knowledge Library

**Identity**
- Name: Knowledge Library. Purpose: find and triage Knowledge Objects.
- Route: `/knowledge`. Permissions: read scope; object-level filtering server-side.

**Context** Workspace + optional Venture filter. VIC/EIR context supplies freshness and confidence attributes on objects.

**Data Dependencies** Authoritative: Knowledge architecture (object list, types, facets, lineage, freshness, confidence). Required: paginated/virtualised object list with type, Venture, owner, updated-at, confidence, freshness. Optional: saved views, collections. Freshness ≤ 5 min. **BACKEND CONTRACT REQUIRED** — facet/filter query contract and pagination/cursor semantics.

**Information Hierarchy** Filter bar → result count and scope statement → object rows (type, title, Venture, freshness, confidence) → selected object preview.

**Regions** Filter bar (sticky); facet rail; result list/grid; preview panel; saved-view chips.

**Components** Filter bar; table/list; tag; confidence meter; freshness stamp; saved-view chip; empty-state block; context panel.

**Intelligence Behaviour** Confidence and freshness are displayed as supplied; the frontend never computes or estimates them. "Ask about these results" seeds the AI panel with the current filter scope as explicit context chips.

**Actions** Primary: open object. Secondary: save view, add to collection, pin, share link, export list. Contextual: ask about this, view lineage. Destructive: none (creation and deletion are runtime-owned; if a delete contract exists it requires typed confirmation).

**Interaction Behaviour** Arrow-key list navigation, `Enter` opens preview, `Cmd+Enter` opens full detail; filters are URL state; selection survives refresh; infinite virtualised scroll beyond 200 rows.

**System States** Loading: skeleton rows with fixed column widths. Empty: explanation that objects arrive from the runtime, with no fake create action. Filtered-empty: clear-filters. Stale: banner. Degraded: partial index → banner stating results may be incomplete. Error: retry with reference ID. Offline: cached page only, filters disabled with reason. Permission denied: restricted objects omitted with a count notice where policy permits.

**Responsive Transformation** XL/Desktop: facet rail + list + preview. Laptop: facets in a popover. Tablet: list → detail navigation. Mobile (future): search-first, card rows.

**URL State** `workspace`, `venture`, `type`, `owner`, `freshness`, `confidence`, `q`, `sort`, `cursor`, `view`, `object`, `panel`.

---

### 6.6 Screen Contract — Knowledge Object Detail

**Identity** Name: Knowledge Object Detail. Purpose: inspect one object with full provenance. Route: `/knowledge/:objectId`. Permissions: object-level read, server-enforced.

**Context** Object's own Venture/company scope, which may differ from the current filter; the header states the scope explicitly.

**Data Dependencies** Authoritative: object content, type, version history, lineage/linked objects, citations, usage ("where used"), freshness, confidence. **BACKEND CONTRACT REQUIRED** — lineage graph and usage-reference contracts. Freshness: as supplied by the object.

**Information Hierarchy** Header (type, scope, freshness, confidence, lineage summary) → executive summary if present → content → citations → linked objects → usage → version history.

**Regions** Object header; content; citations; graph of linked objects; usage list; version timeline; AI panel entry.

**Components** Entity header; document view; timeline; tags; confidence meter; freshness stamp; hover card (entity previews); copy/identifier block.

**Intelligence Behaviour** Any derived statement inside the object is attributed to its producing capability/run with a link to the trace. "Show working" reaches the orchestration trace. No client-side re-derivation of any value.

**Actions** Primary: ask about this object. Secondary: open lineage, compare versions, add to collection, pin, copy link, export. Destructive: none by default.

**Interaction Behaviour** Version compare opens split view; graph nodes open in the panel; `Esc` returns; deep link to a version and to a citation anchor.

**System States** Loading: header + content skeleton. Empty: object with no content renders a designed "no content yet" state naming the producing capability. Filtered-empty: n/a. Stale: freshness escalation banner with the next expected refresh. Degraded: lineage unavailable → section shows an explanatory note, content still readable. Error: region-level. Offline: cached read. Permission denied: 403 naming the required scope.

**Responsive Transformation** XL: content + rail (citations/usage). Desktop: rail collapses to tabs. Laptop/Tablet: stacked sections. Mobile (future): content and citations only.

**URL State** `objectId`, `version`, `tab`, `anchor`, `panel`.

---

### 6.7 Screen Contract — Reports (Library, Viewer, Builder)

**Identity** Routes: `/reports`, `/reports/:reportId`, `/reports/new`. Purpose: generate, read and distribute executive documents. Permissions: read scope; generation and scheduling role-gated.

**Context** Workspace + Venture scope; period selection is first-class.

**Data Dependencies** Authoritative: report registry, generated documents, templates, schedules, recipients. **BACKEND CONTRACT REQUIRED** — template registry, generation trigger, schedule/recipient management, export/rendering contract. Freshness: generated-at timestamp shown always.

**Information Hierarchy** Library: latest report for the current scope → scheduled/upcoming → archive. Viewer: title + period + provenance footer → section rail → document body. Builder: template → scope → period → cadence → recipients → review.

**Regions** Library: filter bar, latest strip, list. Viewer: document header, section rail, body, comments, provenance footer. Builder: stepped form + live preview.

**Components** Table; document viewer; section rail; form primitives; dialog; timeline (comments); export menu.

**Intelligence Behaviour** Reports render EIR/VIC output verbatim; the frontend never recomputes figures for display. The provenance footer lists source objects, generation run id, and generated-at. Any AI assistance in the builder is proposal-only, requiring explicit accept.

**Actions** Primary: generate or open latest. Secondary: export (PDF/link), schedule, comment, share. Destructive: delete a report or cancel a schedule with named confirmation; typed confirmation if already distributed externally.

**Interaction Behaviour** Section rail scroll-spy; `Cmd+F` in-document find; keyboard section jumps; deep link to a section anchor and to a builder step; unsaved-builder navigation guard.

**System States** Loading: document skeleton preserving page geometry. Empty: template gallery. Filtered-empty: clear filters. Stale: "generated 9 days ago" with regenerate. Degraded: generation queue delayed → status with expected time. Error: generation failure with the runtime reason and retry. Offline: previously loaded reports readable; generation disabled. Permission denied: viewer accessible, generation controls hidden with reason.

**Responsive Transformation** XL/Desktop: rail + document. Laptop: rail collapses to a select. Tablet: document only, rail in a drawer. Mobile (future): read and export only.

**URL State** `workspace`, `venture`, `period`, `template`, `reportId`, `section`, `step`, `panel`.

---

### 6.8 Screen Contract — Notifications

**Identity** Routes: `/notifications`, `/settings/notifications`. Purpose: triage everything the system needs the executive to know. Permissions: self-scoped.

**Data Dependencies** Authoritative: notification store with type, source, Venture scope, created-at, read state. **BACKEND CONTRACT REQUIRED** — notification read model, read/mute/snooze mutations, and delivery preference matrix. Freshness: near-real-time.

**Information Hierarchy** Unread requiring a decision → unread informational → today → earlier.

**Regions** Filter/type bar; grouped list; bulk action bar; preferences (separate route).

**Components** Inbox item; badge; bulk action bar; toggle matrix; empty-state block.

**Intelligence Behaviour** Notifications carry the runtime's own severity; the frontend does not re-prioritise. Decision-required notifications deep-link to the exact decision in Situation Room or Executive Workspace.

**Actions** Primary: open the item's target. Secondary: mark read, mute type, mute Venture, snooze, bulk select. Destructive: clear all — confirm with count.

**Interaction Behaviour** `j/k`, `x` select, `e` mark read, `Shift+click` range select; bulk bar states count and scope; optimistic read state with rollback.

**System States** Loading: skeleton rows. Empty: "You're up to date." Filtered-empty: clear filters. Stale: n/a (live). Degraded: delivery delayed banner. Error: retry. Offline: cached list, actions queued or disabled with reason. Permission denied: n/a.

**Responsive Transformation** Desktop: list + preview. Laptop/Tablet: list → detail. Mobile (future): list with swipe-free explicit actions.

**URL State** `filter`, `type`, `venture`, `unread`, `item`.

---

### 6.9 Screen Contract — Users, Teams & Administration

**Identity** Routes: `/users`, `/users/:id`, `/teams`, `/teams/:id`, `/admin/*`. Purpose: manage people, access presentation and system observability. Permissions: strictly role-gated, server-enforced; the UI shows only what the server permits and never decides authority itself (§17.5).

**Data Dependencies** Authoritative: identity provider (Supabase Auth), server-side role/permission model, audit log, runtime observability, capability registry, Venture configuration. **BACKEND CONTRACT REQUIRED** — role matrix read/write, invitation contract, audit query contract, Venture configuration read/write, Brand Layer property store.

**Information Hierarchy** Users: list with role, teams, status, MFA state, last active → detail. Teams: list → detail (members, permissions, assigned Ventures). Admin overview: tenancy health → usage → runtime status → incidents.

**Regions** Filter bar; table; detail panel or page; role matrix; audit table; runtime run table; Venture configuration & Brand Layer editor (§11.4).

**Components** Table; entity card; role matrix; form primitives; audit timeline; dialog; typed-confirmation dialog.

**Intelligence Behaviour** Minimal. Admin surfaces may show runtime-produced health assessments, always attributed and time-stamped. No AI recommendation may alter permissions without an explicit human approval step.

**Actions** Primary: invite user / edit role (role-gated). Secondary: resend invite, deactivate, assign team, export audit. Destructive: remove user, delete team, revoke sessions, change organisation-wide MFA policy — all typed confirmation and audit-logged.

**Interaction Behaviour** Table keyboard navigation; bulk selection with explicit count; every privileged mutation shows the consequence before commit; failures surface the server's reason.

**System States** Loading: skeleton table. Empty: "Teams group access and ownership" with create action; user list is never empty in practice. Filtered-empty: clear filters. Stale: audit view shows query time. Degraded: observability partially unavailable. Error: server reason with reference id. Offline: read-only. Permission denied: whole-route 403 with required role named.

**Responsive Transformation** Desktop: table + detail split. Laptop: prioritised columns. Tablet: entity rows → detail page. Mobile (future): read-only administration.

**URL State** `tab`, `role`, `team`, `status`, `q`, `sort`, `cursor`, `userId`/`teamId`, `range` (audit), `panel`.

---

### 6.10 Screen Contract — Authentication Surfaces

**Identity** Routes: `/auth/sign-in`, `/auth/magic-link-sent`, `/auth/mfa`, `/auth/mfa/enrol`, `/auth/callback`, `/auth/forgot`, `/auth/reset`, `/auth/invitation/:token`, `/auth/no-access`. Purpose: authenticate without friction or ambiguity. Permissions: public (unauthenticated) except enrolment and no-access.

**Context** No workspace or Venture context exists pre-authentication. Appearance follows system preference until a user preference is known. Brand Layer is **not** applied to sign-in unless the entry point is a Venture-specific invitation, in which case only the mark and name may appear.

**Data Dependencies** Authoritative: Supabase Auth (sessions, providers, MFA, magic links, invitations). **BACKEND CONTRACT REQUIRED** — invitation payload (organisation, role, scope) and forced-enrolment signalling. Freshness: n/a.

**Information Hierarchy** Provider buttons → email/password → secondary paths (magic link, forgot). No marketing content anywhere.

**Regions** Brand-minimal header; auth card; provider list; status/error area; footer (legal, support).

**Components** Form primitives; OTP input; button variants; inline banner; progress (determinate for callback).

**Intelligence Behaviour** None. No AI on authentication surfaces.

**Actions** Primary: continue/sign in. Secondary: switch method, resend (with cooldown), change address, use recovery code. Destructive: none.

**Interaction Behaviour** Full keyboard and password-manager support with correct autocomplete and one-time-code hints; `Enter` submits; errors never enumerate account existence; rate-limit feedback surfaced from the backend verbatim.

**System States** Loading: button-level, never full-page. Empty: n/a. Filtered-empty: n/a. Stale: expired magic link/invitation states with a clear next step. Degraded: provider unavailable → that provider disabled with reason, others usable. Error: specific, non-enumerating. Offline: explicit offline state with retry. Permission denied: `/auth/no-access` explains the state and offers request-access and sign-out.

**Responsive Transformation** Single centred column at all breakpoints; touch targets ≥44px below 1024px.

**URL State** `redirect` (validated allowlist), `provider`, `token`, `reason`.

---

### 6.11 Screen Contract — Settings & Profile

**Identity** Routes: `/settings/*`, `/profile`. Purpose: control personal and workspace preferences. Permissions: personal always; workspace-level sections role-gated.

**Data Dependencies** Authoritative: user preference store, workspace configuration, Supabase Auth (sessions, MFA), integrations registry. **BACKEND CONTRACT REQUIRED** — preference persistence contract (server-side, cross-device) and integration/API-key contracts.

**Information Hierarchy** Section rail → section title and description → grouped settings → danger zone last.

**Regions** Section rail; content; save/dirty bar; danger zone.

**Components** Form primitives; toggle; segmented control (appearance mode, density); table (sessions, keys); typed-confirmation dialog.

**Intelligence Behaviour** None, except surfacing runtime-derived usage figures with timestamps.

**Actions** Primary: save (explicit, with dirty guard) or autosave with a "Saved HH:MM" indicator — never ambiguous. Destructive: leave workspace, revoke keys, delete — typed confirmation.

**Interaction Behaviour** Appearance changes apply instantly and preview live; navigation with unsaved changes is intercepted; deep link to any section.

**System States** Standard set; degraded = preference sync unavailable → changes apply locally with a banner stating they are not yet saved.

**Responsive Transformation** Desktop: rail + content. Laptop/Tablet: rail becomes a select. Mobile (future): list → section page.

**URL State** `section`, `subsection`, `panel`.

---

### 6.12 Screen Contract — Utility Screens

404, 403, 500/error boundary, offline, maintenance, session-expired modal.

- Identity: no data dependencies; always renders inside the persistent shell where a session exists.
- Hierarchy: what happened → what it means → what to do next → reference ID (copyable).
- Actions: retry, go to Situation Room, contact support, sign out.
- Session-expired: in-place modal that preserves unsaved work; re-auth returns the user to the exact prior state.
- Responsive: single column at all sizes. URL state: `reason`, `ref`.

---

## 7. Layout System

### 7.1 Persistent shell
- Shell = header + sidebar + status strip + optional context panel. It mounts **once** per session and never unmounts on navigation.
- Route changes swap only the content region.
- Scroll containers are per-region; the document body does not scroll.
- Grid: 12-column fluid content grid, 24px gutters desktop, 16px below 1280px.
- Max content width 1680px, centred; full-bleed permitted for boards and tables.
- Vertical rhythm on a 4px base; component spacing steps 4/8/12/16/24/32/48/64.
- The shell is Core UI (§11.1). No Venture may replace, restructure, or bypass it.

### 7.2 Content region
- Standard anatomy: **page header** (title, context meta, primary action, overflow menu) → **filter/toolbar row** (sticky) → **body** → optional **footer bar** for bulk actions.
- Body patterns: single column, two-column (main + rail 320px), board, split (list + detail with independent scroll), document.
- Detail views prefer **split** over full navigation, preserving list context.

### 7.3 Context panel
- Right-hand overlay/inline panel (420–520px) for object detail, AI command centre, activity, and filters.
- Inline (pushes content) at ≥1600px; overlay below. Dismiss on `Esc`, retains state per route.

### 7.4 Navigation behaviour
- Sidebar and header state are independent of route.
- Route transitions: instant shell, region-level skeletons only where data is genuinely absent; cached data renders immediately and revalidates silently.
- Preloading on intent (hover/focus) for sidebar links and list rows.
- Back/forward restores scroll, filters, panel state, and selection.
- Deep links restore the same state a click would produce.

### 7.5 Responsive layout mechanics
- ≥1600px: sidebar expanded, inline context panel, full table density options.
- 1280–1599px: sidebar expanded, context panel overlays.
- 1024–1279px: sidebar collapses to rail by default.
- 768–1023px: sidebar becomes overlay drawer; tables switch to prioritised columns; split views become stacked list→detail navigation.
- <768px (future): bottom navigation for the four priority destinations; single column; command palette full-screen.

---

## 8. Design System

Global rules: all colour, elevation, radius, motion, and typographic values are **semantic tokens**. No component declares a raw colour. Every interactive element has visible hover, active, focus-visible, disabled, and loading states. Every component supports a compact and comfortable density.

### 8.1 Foundations
- **Type scale**: display 32/40, h1 24/32, h2 20/28, h3 16/24, body 14/22, small 13/20, caption 12/16, mono 13/20 for identifiers and numerics. Two families maximum: a precise geometric/grotesque for UI, a monospace for data. Tabular numerals mandatory in tables and metrics. **The type system is fixed VentureOS-wide and is not a Brand Layer property.**
- **Radius**: sm 6, md 8, lg 12, xl 16, pill. Fixed system-wide.
- **Elevation**: 4 levels, expressed as layered shadow + border, tuned per appearance mode (dark leans on border and surface lift, not shadow).
- **Spacing/density**: comfortable (default) and compact (−25% vertical padding), user-selectable. Fixed system-wide.
- **Iconography**: single stroke-based set, 16/20/24, 1.5px stroke; never the sole carrier of meaning.

### 8.2 Buttons
- Variants: `primary`, `secondary`, `ghost`, `outline`, `destructive`, `link`, `command`, `ai`.
- Sizes: xs, sm, md, lg; icon-only variants with mandatory accessible label and tooltip.
- States: default, hover, active, focus-visible (2px ring, offset), disabled, loading (spinner replaces icon, width locked), success pulse (one-shot, respects reduced motion).
- Rules: one primary per surface; destructive never adjacent to primary without separation; labels are verbs.

### 8.3 Cards
- Variants: `surface`, `metric`, `entity`, `insight` (EIR output with confidence + provenance), `action`, `empty`.
- Anatomy: optional header (title, meta, actions), body, optional footer.
- Interactive cards: whole-card target with a real link inside, hover lift ≤2px, focus ring on the card.

### 8.4 Forms
- Components: text, textarea (auto-grow), number, select, multi-select, combobox with async search, date/date-range, time, toggle, checkbox, radio group, segmented control, slider, file/upload, tag input, rich text (constrained), password with strength and reveal, OTP input.
- Anatomy: label always visible (never placeholder-as-label), optional description, control, help/error, character or unit affordance.
- Validation: on blur and on submit, never per keystroke; errors specific and actionable; first invalid field focused; form-level summary for long forms.
- Layout: single column by default; two-column only for short paired fields.
- Saving: explicit save with dirty-state guard, or autosave with an explicit "Saved HH:MM" indicator.

### 8.5 Tables
- Features: sticky header, sticky first column, column resize/reorder/visibility, multi-sort, filter chips, grouping, row selection with bulk action bar, inline row actions, expandable rows, pagination or virtualised infinite scroll (virtualise beyond 200 rows), density toggle, saved views, export.
- Cell types: text, numeric (tabular, right-aligned), status, tag, entity, date/relative-time, progress, sparkline, action menu.
- States: loading (skeleton rows preserving column widths), empty, filtered-empty, error with retry, partial/stale banner with data still visible.
- Rules: never reflow columns during load; never lose selection on refresh; full keyboard navigation.

### 8.6 Charts
- Types: line/area, bar/stacked, horizontal bar, sparkline, gauge/radial, heatmap (capability × Venture), waterfall, scatter, funnel.
- Rules: token colours only; max six series before "Other"; always axis labels and units; direct labelling preferred; crosshair tooltip; keyboard-navigable data points; "view as table" equivalent for every chart; annotations for runtime events; no 3D, no pie charts beyond two segments.
- States: loading skeleton at fixed height, empty, insufficient-data, error.

### 8.7 Dialogs
- Variants: `modal`, `confirm`, `destructive-confirm` (typed), `sheet`, `drawer`, `fullscreen`.
- Behaviour: focus trap, restore focus on close, `Esc` closes unless dirty (then confirm discard), scroll lock on the layer only, one modal deep — no stacking.

### 8.8 Menus
Dropdown, context, overflow, select, nested submenu (one level), split button. Sections with headings, icons, shortcut hints, destructive styling, disabled-with-reason, type-ahead, full keyboard control.

### 8.9 Tooltips
400ms open delay, 0ms within a group, instant on keyboard focus, dismiss on `Esc`. Short, non-essential clarification or the accessible label for icon-only controls (which must also carry `aria-label`). Rich hover-card variant for entity previews and metric definitions; never contains interactive-only content.

### 8.10 Command palette
`Cmd/Ctrl+K`. Sections: Actions, Navigate, Recent, Ventures, Knowledge, Ask AI. Fuzzy match with highlighted ranges; prefixes (`>` actions, `#` knowledge, `@` people, `/` settings, `?` ask). Shortcut hints; `Enter` executes; `Cmd+Enter` opens in the context panel. Sub-3ms perceived input latency; streaming results without layout jump.

### 8.11 In-app notifications
Toast (transient, top-right, 4s, max 3, pausable, never for errors requiring a decision); inline banner (persistent page-level state); inbox item; badge. Severity: info, success, warning, critical — always icon + text.

### 8.12 Timelines
Activity feed (grouped by day), runtime/orchestration trace (steps with duration and status), knowledge version history, audit trail. Node (icon + status), actor, action, target, timestamp (relative with absolute on hover), expandable payload. Filter by actor/type, jump-to-latest, lazy load upward.

### 8.13 Tags
Neutral, semantic (category-derived from a fixed token set), removable, count, entity tag with mark. Max two lines before "+N more"; deterministic colour per category; readable in both appearance modes.

### 8.14 Status indicators
- **Dot** — healthy, running, degraded, failed, idle, unknown, each with a text label or accessible name.
- **Pill** — lifecycle state (Draft, Active, Under review, Approved, Archived).
- **Confidence meter** — 3-segment plus numeric, always paired with freshness.
- **Freshness stamp** — relative time with stale-threshold escalation.
- **Progress** — determinate bar, indeterminate only for genuinely unknown durations, step indicator.
- Status is never conveyed by colour alone; every indicator has a tooltip explaining the state and the next expected transition.
- **Semantic status colours are core tokens and are never overridable by the Brand Layer.**

### 8.15 Additional primitives
Avatar & avatar group, breadcrumb, tabs (underline, one level), segmented control, accordion, skeleton, separator, kbd, scroll-area, resizable panels, popover, hover card, pagination, filter bar, saved-view chip, copy-to-clipboard, code/identifier block, empty-state block, error-state block.

---

## 9. Appearance System — Executive Light / Executive Dark

**The authoritative VentureOS appearance modes are exactly two: Executive Light and Executive Dark.** Midnight, Carbon, Qualora, Calviora and Farmora are removed as independent themes. Any Venture identity expression is handled by the Venture Brand Layer (§10).

### 9.1 Token architecture
Both modes share one semantic token architecture; only values differ.
1. **Primitive** — raw palette ramps (11 steps per hue), never consumed by components.
2. **Semantic** — `background`, `surface`, `surface-raised`, `surface-sunken`, `foreground`, `muted-foreground`, `border`, `border-strong`, `primary`, `primary-foreground`, `secondary`, `accent`, `accent-foreground`, `success`, `warning`, `critical`, `info`, `ring`, `overlay`, `chart-1…8`, `sidebar-*`, `header-*`, `brand-mark`, `brand-accent`, `brand-accent-foreground`.
3. **Component** — optional per-component overrides derived only from semantic tokens.

Additional token families: elevation (per mode), radius, motion durations/easings, typography, density.

Rules:
- All colour values are expressed in a perceptual colour space so ramps stay contrast-consistent across modes.
- Neither mode may define a token the other lacks. Token parity is a build-time check.
- Appearance mode is applied by a single root data attribute (`data-appearance="light|dark"`), with `prefers-color-scheme` used only for the initial default before a user preference exists.

### 9.2 Mode characters
| Mode | Character | Base | Foreground | Accent direction | Use |
|---|---|---|---|---|---|
| **Executive Light** | Daylight; paper-like, high clarity | Near-white with warm neutral tint | Near-black graphite | Deep authoritative blue-teal (default core accent) | Default for most users |
| **Executive Dark** | Night; low fatigue, high focus | Deep neutral charcoal | Soft white | Same accent family, lifted for contrast | Long sessions, evenings, presentations |

The high-drama "command room" quality previously assigned to Midnight and the achromatic density previously assigned to Carbon are absorbed as **density and surface options within the two modes** (compact density; a presentation/focus display option that dims chrome), not as separate themes.

### 9.3 Switching behaviour
- **Instant, no reload, no flash.** Switching changes only the root attribute; no component remounts, no data refetch, no scroll or focus loss.
- Applied before first paint via an inlined pre-hydration script reading the stored preference.
- Preference persists per user (server-side) and per device (local); server value wins on sign-in.
- Selection points: user menu, Settings → Appearance, command palette (`>appearance`). Cycling shortcut available.
- Optional automatic switching: follow system, or schedule by time.
- Venture context never forces an appearance mode. The user's explicit choice always wins.
- ≤150ms transition on colour properties only, disabled entirely under reduced motion.

### 9.4 Quality gates
- Both modes: ≥4.5:1 body text, ≥3:1 large text, UI borders, and non-text indicators.
- Eight-colour chart ramp distinguishable under the three common colour-vision deficiencies in both modes.
- Focus ring visible against every surface token in both modes.
- Full component gallery rendered in both modes × every registered Venture Brand Layer, with no unstyled or illegible component.

---

## 10. Venture Brand Layer

### 10.1 Purpose and hierarchy
Qualora, Calviora, Farmora and every future Venture must **not** become separate design systems. Venture identity is expressed through a single, controlled layer:

```text
VentureOS Design System
   -> Executive Light / Executive Dark   (appearance modes; shared token architecture)
      -> Venture Brand Layer             (controlled identity properties only)
         -> Venture-specific content and capability extensions
```

The goal is one operating system, many Ventures. A user moving from Qualora to Farmora must immediately recognise that they are still operating VentureOS.

### 10.2 Permitted properties (exhaustive)
The Brand Layer may control **only**:
1. **Venture logo/mark** — a monochrome-capable mark and an optional full lockup, supplied at defined sizes.
2. **Venture name and short name** — display strings used in the switcher, header, and page titles.
3. **A single controlled accent token** — `brand-accent`, with an automatically derived `brand-accent-foreground`. The value must pass contrast validation in both appearance modes or it is rejected at configuration time and the core accent is used.
4. **Selected identity metadata** — tagline, lifecycle stage label, jurisdiction/region label, owner display.
5. **Approved imagery** — a limited set of slots (sign-in illustration where a Venture-specific invitation applies, Company HQ header texture, report cover) with fixed dimensions and cropping rules.
6. **Limited presentation metadata** — approved terminology overrides from a fixed key set (§11.4), and default landing preference where the Venture configuration allows it.

### 10.3 Forbidden (exhaustive and binding)
The Brand Layer must **NOT** redefine:
- application layout or the persistent shell;
- component behaviour or component architecture;
- navigation architecture, ordering, or destinations;
- the typography system (families, scale, weights, tracking);
- the spacing, density, or radius systems;
- interaction behaviour, shortcuts, or motion vocabulary;
- accessibility behaviour or contrast requirements;
- core semantic status colours (`success`, `warning`, `critical`, `info`) or chart ramp semantics;
- data behaviour, permissions, or intelligence presentation rules.

### 10.4 Application rules
- `brand-accent` may be used for: the Venture mark surround, the active Venture chip in the header, a Venture-scoped selection indicator, and at most one accent element per screen region. It may never replace `primary` for primary buttons system-wide, never colour status, and never colour chart series.
- Where no Brand Layer is configured, the core accent applies; the interface must be complete and correct with zero Brand Layer values present.
- The Brand Layer is applied by a second root data attribute (`data-venture="<id>"`) resolving a small, validated token set. Switching Ventures re-resolves those tokens within a single frame and never remounts the shell or changes appearance mode.
- Brand Layer values are configuration data, not code. **BACKEND CONTRACT REQUIRED** — the authoritative source of Venture brand properties (expected to be Venture Definition/Instance metadata).
- Every Brand Layer configuration passes an automated gate: token completeness, contrast in both modes, mark legibility at 16/24/32px, and no forbidden property present. A failing configuration is rejected, not silently degraded.
- Authentication surfaces apply the Brand Layer only for Venture-specific invitations, and only the mark and name.

### 10.5 Governance
Adding or changing a Brand Layer configuration is an administrative action in Venture configuration (§11.4), audit-logged, and does not require a frontend release. Adding a new *permitted property* to the Brand Layer requires a Decision Register entry (§20).

---

## 11. Multi-Venture Frontend Architecture

VentureOS must support Qualora, Calviora, Farmora and future Ventures without the core frontend becoming a collection of product-specific conditionals.

```text
VentureOS Core UI
   -> Shared Capability UI
      -> Venture Configuration
         -> Venture Extensions
```

### 11.1 VentureOS Core UI
Universal executive operating-system behaviour. Contains: persistent shell (header, sidebar, status strip, context panel), routing, navigation planes, command palette, AI command centre chrome, appearance system, design-system primitives and components, intelligence presentation components (insight card, confidence meter, provenance, freshness, trace viewer), system-state components, accessibility infrastructure, error boundaries, performance infrastructure.

Rules: Core UI is Venture-agnostic. It must contain **zero** references to Qualora, Calviora, Farmora or any Venture identifier. A grep for Venture names in Core UI is a build-time failure.

### 11.2 Shared Capability UI
Reusable presentation surfaces for capabilities available across multiple Ventures: capability launcher and input forms driven by capability input contracts, engagement list and detail, trace viewer, deliverable viewer, coverage map, metric grid, decision queue, knowledge browsing, report viewer.

Rules: Shared Capability UI is driven by **capability metadata**, not by Venture identity. If a surface needs to differ per Venture, the difference must be expressed as capability configuration or terminology, never as a Venture conditional.

### 11.3 Venture Configuration
Declarative configuration determining, per Venture:
- which approved capabilities are enabled and in what order they surface;
- Brand Layer property values (§10.2);
- approved terminology overrides from a fixed key set;
- default landing destination within the allowed set;
- which optional regions appear on Company HQ;
- which report templates are available.

Rules: configuration is data, read from the authoritative Venture Definition/Instance source (**BACKEND CONTRACT REQUIRED**). It is validated against a schema; unknown keys are rejected. Configuration can never introduce new behaviour, only select among behaviours Core UI already provides.

### 11.4 Terminology overrides
A fixed, versioned key set (for example: the display label for "company", "engagement", "deliverable", "decision"). Overrides affect display strings only. Domain terms in code, URLs, API payloads, analytics, and documentation remain unchanged. Overrides must pass length constraints and must not alter meaning (validated at configuration time and reviewed administratively).

### 11.5 Venture Extensions
Reserved for genuinely Venture-specific workflows that cannot be represented through Shared Capability UI.

A Venture extension **must not**:
- duplicate a core component;
- fork or extend the design system;
- create a separate navigation paradigm;
- bypass EIR/VIC;
- introduce business logic into presentation code;
- redefine global interaction behaviour;
- introduce its own data store, authentication, or permission logic;
- ship its own tokens, fonts, or spacing.

A Venture extension **must**:
- render inside the standard content region of the persistent shell;
- compose only Core UI and Shared Capability UI components;
- obtain all data through the standard adapter layer (§17.2);
- declare its route under the Venture's namespace and be registered through Venture Configuration;
- satisfy the same accessibility, performance, responsive and system-state requirements as core screens;
- be reviewable against a written justification of why Shared Capability UI was insufficient.

Extension approval is an architectural decision recorded in the Decision Register (§20).

### 11.6 Introducing a new Venture
The target state: a new Venture is introduced by (1) creating its Venture Definition/Instance in the backend, (2) adding a Venture Configuration record with Brand Layer values and enabled capabilities, (3) passing the Brand Layer and configuration validation gates. **No frontend redesign, no new theme, no new navigation, and ideally no frontend release** is required. This is validated in Sprint 11 (§19).

---

## 12. UX Behaviour

### 12.1 Loading
- Shell is never in a loading state after first paint.
- Cached data renders immediately; revalidation is a subtle inline indicator, never a spinner over content.
- Skeletons only for first-load of a region, matched exactly to final dimensions.
- Any operation >400ms shows progress in place; >5s shows a message with what is happening and a cancel where possible.
- Optimistic UI for reversible mutations (pin, read, rename, assign) with silent rollback + toast on failure. Optimistic state is never applied to intelligence output, permissions, or runtime execution results (§17.6).
- No full-page loading screens anywhere, including after sign-in and Venture switch.

### 12.2 Navigation
- Perceived instant: intent-based preloading, cached shells, region-scoped updates.
- Scroll and selection restored on back; filters and panels are URL state.
- Unsaved changes intercept navigation with discard/save/cancel.
- Route errors render inside the content region, keeping the shell usable.

### 12.3 Transitions and animation
- Durations: micro 120ms, standard 180ms, panel 240ms, overlay 200ms in / 150ms out.
- Easing: ease-out for entrances, ease-in for exits; no bounce, no spring overshoot.
- Vocabulary: fade+2px rise for content, slide for panels/sheets, scale 0.98→1 for modals, height animation for accordions, crossfade for chart data changes.
- List reordering animates only when user-initiated. Never animate on data refresh — only on user intent or genuinely new items (single subtle one-shot highlight).
- All motion respects `prefers-reduced-motion`.

### 12.4 Empty states
Every empty state has an icon or mark, a one-line statement of what this is, a one-line statement of why it is empty, and either a primary action or an explanation of what will fill it. Distinguish: never-had-data, filtered-to-zero, cleared/completed (positive), access-restricted.

### 12.5 Errors
- Hierarchy: field error → form error summary → inline region error → page error boundary → global fallback. Contained at the smallest level.
- Every error states: what failed, what it means, what to do next, and a retry or contact path; technical detail collapsed behind "Details" with a copyable reference ID.
- Network failures keep last-good data visible with a stale banner.
- Permission errors explain scope and offer request-access.
- Session expiry shows an in-place re-auth modal; no work is lost.
- No raw stack traces; no "Something went wrong" without a next step.

### 12.6 Confirmations
- Reversible: execute immediately, toast plus undo (8s).
- Irreversible or externally visible: modal confirm naming the exact object and consequence.
- Destructive, high blast radius: typed confirmation of the object name; primary disabled until matched.
- Bulk actions state count and scope ("Archive 14 reports in Qualora").
- Never confirm trivial or reversible actions.

### 12.7 AI and intelligence interactions
- **Consent and clarity**: every AI surface is labelled; nothing is generated silently into saved work without an explicit accept step.
- **Streaming** with a visible stop control; partial output preserved on stop.
- **Provenance**: answers cite Knowledge Objects with links, freshness, and confidence; "show working" reveals reasoning outline and orchestration steps.
- **Actions**: proposals that trigger runtime orchestration are previewed as a plan with explicit approve/modify/reject.
- **Context transparency**: visible, removable chips for workspace, Venture, and object context.
- **Failure**: model or runtime failure shows a clear state with retry, and never fabricates a fallback answer.
- **Non-blocking**: the user can navigate away; the panel keeps running and notifies on completion.
- **Feedback**: thumbs and a short reason on substantive answers, feeding the existing runtime, not a new store.
- **Authority**: the frontend never determines intelligence. It displays, requests, and orchestrates interaction with EIR/VIC output only (§17.4).

---

## 13. Performance Standards

Benchmarks: navigation must feel comparable to Linear, Notion, and the Vercel dashboard.

Targets (95th percentile, mid-tier laptop, typical corporate network):
| Metric | Target |
|---|---|
| First contentful paint (cold) | < 1.2s |
| Time to interactive (cold) | < 2.0s |
| Warm route navigation (perceived) | < 100ms |
| Command palette open | < 50ms |
| Keystroke → filtered results | < 80ms |
| Venture/workspace switch (shell stable) | < 200ms to first meaningful region |
| Appearance mode switch | < 16ms, single frame, no reflow |
| Venture Brand Layer switch | < 16ms, single frame, no remount |
| Interaction latency (INP) | < 200ms |
| Cumulative layout shift | < 0.05 |
| Table scroll (10k rows virtualised) | sustained 60fps |

Engineering standards for the presentation layer:
- **Preserve layouts.** Reserve space for every async region; skeletons match final geometry; images and charts have fixed intrinsic sizes.
- **Prevent unnecessary re-renders.** Colocate state at its point of use; memoise expensive subtrees and derived data; keep list-item identity stable; never place high-frequency state in a global provider wrapping the shell; isolate context providers by concern.
- **Eliminate full-page loading screens.** The shell renders once and persists.
- Cache-first data with background revalidation; deduplicate in-flight requests; prefetch on intent; paginate and virtualise long collections.
- Code-split by route and heavy component (charts, editors, document viewer); keep the shell bundle lean; defer non-critical work to idle.
- Venture Extensions are lazily loaded and must not affect Core UI bundle size.
- No blocking third-party scripts; fonts self-hosted, preloaded, metrics-matched fallback.
- Performance is a release gate: budgets enforced in CI, regressions block merge.

---

## 14. Accessibility

Target: **WCAG 2.2 AA** across both appearance modes and every Brand Layer configuration, plus executive-grade keyboard efficiency.

- **Keyboard navigation**: every action reachable and operable by keyboard; logical tab order; skip-to-content; roving tabindex in lists, tables, menus, toolbars; `Esc` consistently dismisses; focus trapped in overlays and restored on close; visible focus ring (2px, 2px offset) meeting 3:1 against every surface.
- **Shortcut system**: documented, discoverable (`?`), non-conflicting with assistive tech and browser defaults, remappable where conflicting, disabled while typing.
- **Screen readers**: semantic landmarks; accessible names on every control; `aria-current` for active nav; live regions for toasts, streaming AI output (polite) and critical alerts (assertive); proper table header association and captions; charts expose a data-table alternative and text summary; dialogs correctly roled and labelled.
- **High contrast**: an intensification available for both modes; respects forced-colors; borders and focus indicators never rely on shadow alone.
- **Reduced motion**: removes transforms, parallax, autoplay, looping indicators; state changes remain fully conveyed.
- **Colour independence**: status, validation, and chart series always carry text, icon, or pattern in addition to colour.
- **Text and zoom**: 200% zoom and browser text scaling without loss of function; no truncation of essential content without an accessible full value.
- **Forms**: programmatic label association, errors linked via `aria-describedby`, focusable error summary.
- **Targets**: minimum 24×24px, 32×32 preferred; adequate spacing in dense tables.
- **Brand Layer**: no configuration may reduce contrast below thresholds; validation is automated and blocking.
- **Testing**: automated axe checks in CI, plus a manual keyboard-only and screen-reader pass per release on the primary screens.

---

## 15. Responsive Behaviour

| Breakpoint | Range | Behaviour |
|---|---|---|
| **Desktop XL** | ≥1600px | Sidebar expanded; inline context panel; multi-column boards; full table columns; charts side-by-side. |
| **Desktop** | 1280–1599px | Sidebar expanded; context panel overlays; boards two-up; tables full with horizontal scroll for extras. |
| **Laptop** | 1024–1279px | Sidebar collapses to icon rail by default; single main column plus overlay panel; tables prioritise essential columns with a visibility control; charts stack. |
| **Tablet** | 768–1023px | Sidebar becomes overlay drawer; header condenses; split views become list → detail navigation with back; tables become prioritised columns or entity rows; dialogs become bottom drawers; touch targets ≥44px; hover-only affordances gain persistent equivalents. |
| **Mobile (future)** | <768px | Bottom navigation with the four priority destinations; single-column stacked content; command palette and AI centre full-screen; tables become card lists; charts simplified with a series toggle; read-and-approve first, heavy authoring deferred. |

Rules: never hide functionality at smaller sizes without an equivalent path; orientation changes preserve state; the same URL renders equivalent content at every breakpoint. Every Screen Contract (§6) states its own transformation.

---

## 16. Authentication

Provider: **Supabase Auth** (existing backend of record). The frontend implements the experience only; identity, sessions, and policy remain server-owned.

### 16.1 Methods
- **Email + password** — strength guidance, breached-password messaging surfaced from the backend, rate-limit feedback.
- **Google** — OAuth, domain hint where configured.
- **Microsoft** — OAuth/Entra ID, work and school accounts.
- **Magic link** — passwordless; sent/confirm screen, resend cooldown, expiry messaging, same- and cross-device handling.
- **MFA** — TOTP enrolment and challenge, recovery codes, optional trusted-device period; organisation-mandated enforcement handled including forced enrolment on next sign-in.

### 16.2 Experience rules
- Single unified sign-in screen; provider buttons above the fold, email below, no marketing content.
- Provider identity remembered and surfaced ("You last signed in with Microsoft").
- Errors specific but never enumerating account existence.
- Post-authentication routes to the last visited location, else Situation Room. Never a blank loading screen — the shell renders with skeletons.
- Session: silent refresh; expiry produces an in-place re-auth modal preserving unsaved work; sign-out clears client state and returns to sign-in with a confirmation toast.
- Invitations carry role and scope, visible before acceptance.
- Fully keyboard and password-manager friendly (correct autocomplete, one-time-code hints).
- Auth screens honour the appearance system and default sensibly before a user preference exists; Brand Layer applies only to Venture-specific invitations (§10.4).
- **Session and permission contracts are server-authoritative.** Client-side gating is UX only (§17.5).

---

## 17. Frontend Engineering Boundary (Lovable ↔ Cursor)

### 17.1 Ownership split (permanent)

**Lovable owns**
React frontend; Tailwind presentation; pages; dashboards; forms; authentication presentation; navigation; layouts; responsive design; design system; frontend interaction behaviour; Supabase frontend integration where authorised; visual iteration.

**Cursor owns**
VentureOS Runtime; EIR; VIC; APIs; backend services; business logic; AI reasoning; orchestration; capability execution; architecture; performance engineering (backend); backend testing; security; optimisation; authoritative permissions.

**GitHub remains the single source of truth.** Both sides work against the same repository; the boundary is enforced by directory ownership and code review, not convention alone.

### 17.2 Boundary contracts

| Contract | Owner | Rule |
|---|---|---|
| **API contracts** | Cursor | Frontend consumes documented contracts only. No undocumented endpoint may be called. **BACKEND CONTRACT REQUIRED** wherever a screen depends on an undocumented surface. |
| **Frontend adapters** | Lovable | Every backend call passes through a thin adapter layer that maps transport payloads to view models. Components never call transport directly. Adapters contain mapping only — no business rules, no scoring, no derivation of intelligence. |
| **TypeScript/domain types** | Cursor generates, Lovable consumes | Domain types are generated from the backend contract and imported. The frontend may define view-model types that compose them but never re-declares a domain type by hand. |
| **Authentication/session** | Cursor (Supabase config), Lovable (experience) | Token handling follows the documented session contract; the frontend never mints, extends, or re-interprets a session. |
| **Permissions** | Cursor | The server returns the user's effective capability/visibility set. The frontend uses it to show, hide, or disable — never to authorise. Every privileged action is re-checked server-side. |
| **Error contracts** | Cursor | Errors carry a machine code, a human-safe message, and a reference ID. The frontend maps codes to states; it never invents error semantics or guesses at causes. |
| **Intelligence payloads** | Cursor | Every intelligence payload carries content, confidence, provenance (source object ids), freshness, and reasoning access. The frontend renders these fields; missing fields render as "not supplied", never as an assumed value. |
| **Streaming intelligence** | Cursor defines transport, Lovable renders | Streaming is chunk-ordered and cancellable; the frontend renders partials and preserves them on stop. The frontend never post-processes or re-summarises a stream. |
| **Capability invocation** | Cursor | Invocation uses the capability's declared input contract; the frontend renders the form from that contract and validates client-side for UX only. Server validation is authoritative. |
| **Runtime action requests** | Cursor | Any action that changes runtime state is an explicit request with a previewed plan and an approval step. The frontend never batches, retries automatically, or infers an action. |
| **Optimistic state** | Lovable | Permitted only for reversible, non-authoritative UI state (read, pin, rename, assign, filter). Never for intelligence output, permissions, approvals, or runtime execution. |
| **Server-authoritative state** | Cursor | Anything the server owns is displayed as returned; on conflict, the server wins and the UI reconciles visibly, never silently. |
| **Contract versioning** | Cursor | Contracts are versioned; the frontend pins a version and declares it. Breaking changes require a new version, not a mutation of the current one. |
| **Backwards compatibility** | Both | The frontend tolerates additive fields; the backend does not remove or repurpose fields within a version. Unknown enum values render as "unknown" with the raw value available, never as a crash. |
| **Failure handling** | Both | Backend failure produces a documented error contract; the frontend degrades to last-good data with a stale/degraded banner and never fabricates content. Frontend failure is contained at the smallest region boundary and reported with a reference ID. |

### 17.3 Working agreement
- Contract-first: a screen is not implemented until its data dependencies are either documented or explicitly deferred as **BACKEND CONTRACT REQUIRED**.
- Where a contract is pending, the frontend may build the surface against a contract-shaped fixture **only** when the shape has been agreed and recorded; otherwise the surface is deferred to a later sprint.
- No fabricated endpoints, no speculative tables, no frontend-invented domain fields.

### 17.4 Critical rule — intelligence authority
The frontend may **display, request, and orchestrate user interaction with** intelligence. The frontend may **NOT** independently determine authoritative executive intelligence. EIR and VIC remain authoritative for judgement, prioritisation, scoring, confidence, and recommendation. Any client-side sorting, filtering, or grouping is a *view* operation and must be visibly labelled as such where it differs from the runtime's own ordering.

### 17.5 Critical rule — permission authority
Frontend permission visibility is **UX only**. Authoritative access control remains server-side. Hiding a control is never a security measure; every privileged operation is enforced by the server regardless of what the UI shows.

### 17.6 Pending integration contracts
The following are marked **BACKEND CONTRACT REQUIRED** and consolidated in §23: workspace/scope object; decision queue read and resolve/defer/delegate; signal stream transport; scan-now trigger; runtime health read model; user pins/drafts/follow-ups; briefing generation/refresh; assignment model; capability invocation shape; engagement lifecycle states; approval action; trace streaming; advisor/agent roster; metric definitions; capability coverage computation; activity timeline; knowledge facet/pagination; lineage and usage references; report templates/generation/scheduling/export; notification read model and mutations; role matrix and invitation; audit query; Venture configuration and Brand Layer property store; preference persistence; unified search; company↔Venture-instance relationship; division concept (or its removal).

---

## 18. Executive Experience Specification

This section defines how VentureOS should **feel**, and is binding.

1. **Arrival.** Opening VentureOS presents a judgement, not a menu. Within two seconds the executive knows what changed, what is at risk, and what needs them. The Situation Room headline is a sentence a chief of staff would say out loud.
2. **Weight.** Interactions feel mechanical and consequential — precise easing, no bounce, no elastic play. Equipment, not toy.
3. **Silence.** No confetti, no unsolicited tips, no engagement badges. Notifications earn their place by requiring a decision.
4. **Certainty.** Every number carries provenance and freshness; the underlying Knowledge Object is one action away.
5. **Deference.** The interface never claims authorship of judgement. Intelligence is counsel — "The runtime assesses…" — with confidence stated and dissent surfaced when evidence conflicts.
6. **Speed as respect.** Waiting is a design failure; the interface is ready before the user finishes deciding to act.
7. **Continuity.** Context follows the executive across Ventures, workspaces, sessions and devices. Returning after a week feels like resuming a sentence.
8. **Density with air.** Information-rich, never cramped. Whitespace signals confidence.
9. **Reversibility.** Almost everything can be undone; the few things that cannot are unmistakably marked and deliberately slow.
10. **Discretion.** Designed for shoulder-surfing environments: a screen-share-safe mode masking financial and personal detail, no surprise auto-expanding content in presentations.
11. **Command.** Power users operate almost entirely by keyboard; mastery is rewarded with speed, never required for access.
12. **Consistency.** The same object looks and behaves identically wherever it appears. The executive learns the system once.
13. **Recognition across Ventures.** Moving between Qualora, Calviora and Farmora changes the mark, the accent and the content — never the way the system works.

---

## 19. VentureOS Frontend Implementation Programme

Implementation must not happen as one giant generation. Work proceeds in controlled frontend sprints.

**Permanent workflow:** Build → Test → Review → Commit → Push → Certify → Begin next sprint.
No sprint begins until the previous sprint passes its completion gate. Every sprint ends with a written certification against its acceptance criteria.

Universal per-sprint requirements (apply to all sprints): zero console errors/warnings; token-only styling lint passing; WCAG 2.2 AA on delivered surfaces in both appearance modes; performance budgets not regressed; no Venture names present in Core UI; no fabricated backend calls; every deferred dependency recorded as **BACKEND CONTRACT REQUIRED**.

---

### Sprint 0 — Frontend Foundation
- **Objective:** establish the foundation without building product screens.
- **Included:** repository/frontend assessment; existing frontend preservation assessment (inventory what exists, what is reusable, what must be retired, with nothing deleted before it is documented); design tokens (primitive → semantic → component); Executive Light; Executive Dark; Venture Brand Layer foundation (attribute mechanism, validation gate, empty configuration path); typography; spacing/density; primitives (buttons, inputs, cards, skeletons, empty/error blocks); routing foundation; persistent shell foundation (header, sidebar, status strip, context panel slot); frontend/backend boundary preparation (adapter layer skeleton, generated domain types wired in, error-contract mapping).
- **Excluded:** any product screen; any intelligence surface; any data fetching beyond a health check; Venture extensions.
- **Backend dependencies:** generated domain types; error contract; session contract. All other contracts deferred.
- **Acceptance criteria:** both appearance modes render a complete component gallery with token parity verified by an automated check; appearance switch <16ms with no flash on hard refresh; Brand Layer validation gate rejects a deliberately non-compliant configuration; shell mounts once across 20 route changes; zero hardcoded colour values.
- **Testing:** component gallery snapshot in both modes; token parity test; axe pass on the gallery; shell remount test.
- **Architectural checks:** no Venture identifiers in Core UI; no component reads a raw colour; adapter layer contains no business logic.
- **Completion gate:** gallery certified in both modes; preservation assessment signed off.

### Sprint 1 — Authentication
- **Objective:** complete authentication experience end to end.
- **Included:** all §6.10 surfaces; session refresh and expiry modal; invitation acceptance; forced MFA enrolment; no-access screen.
- **Excluded:** administration of MFA policy (Sprint 9); Brand Layer on general sign-in.
- **Backend dependencies:** Supabase Auth configuration; invitation payload (**BACKEND CONTRACT REQUIRED**); forced-enrolment signalling (**BACKEND CONTRACT REQUIRED**).
- **Acceptance criteria:** all five methods function end to end including enrolment, recovery, forced enrolment, and expiry re-auth without work loss; no blank interim screen; no account enumeration; password-manager compatible.
- **Testing:** end-to-end per method; keyboard-only pass; error-path matrix.
- **Architectural checks:** no client-side authorisation decisions; no token handling outside the documented contract.
- **Completion gate:** authentication journeys certified; security review of the client session handling.

### Sprint 2 — VentureOS Application Shell
- **Objective:** the permanent shell and navigation planes.
- **Included:** header with workspace and Venture switchers; sidebar with all groups and states; status strip; context panel; command palette; global search shell (results wired where the search contract exists, otherwise deferred); AI command centre chrome without intelligence payloads; URL state infrastructure; back/forward restoration; error boundaries; utility screens (§6.12).
- **Excluded:** any destination screen content; live intelligence.
- **Backend dependencies:** workspace/scope object (**BACKEND CONTRACT REQUIRED**); Venture list; unified search (**BACKEND CONTRACT REQUIRED**).
- **Acceptance criteria:** shell mounts once; workspace and Venture switching re-resolve only scoped regions; palette opens <50ms; every navigation state URL-addressable; back/forward restores scroll, filters, selection, panel.
- **Testing:** remount instrumentation; URL round-trip tests; palette latency measurement; axe pass.
- **Architectural checks:** navigation defined once in Core UI; no Venture conditionals.
- **Completion gate:** shell certified against §7 and §12.2.

### Sprint 3 — Executive Workspace
- **Objective:** the executive's primary environment, including the Desk region.
- **Included:** §6.2 contract in full; briefing region; Desk tabs; attention region; personal actions.
- **Excluded:** cross-portfolio boards; capability commissioning.
- **Backend dependencies:** briefing contract; assignment model; pins/drafts/follow-ups (**all BACKEND CONTRACT REQUIRED**). Where deferred, the region ships in a designed "awaiting contract" state rather than with invented data.
- **Acceptance criteria:** contract §6.2 satisfied including all eight system states; no separate Executive Desk route exists; deep links restore tab and selection.
- **Testing:** state matrix per region; keyboard journey; axe.
- **Architectural checks:** no client-side priority scoring; ordering as supplied.
- **Completion gate:** Executive Workspace certified; Executive Desk confirmed absent as a destination.

### Sprint 4 — Situation Room
- **Objective:** the decision surface.
- **Included:** §6.1 contract in full; decision queue with resolve/defer/delegate; signal feed; risk board; runtime health; comparison strip; evidence panel; intelligence presentation components (confidence, provenance, freshness, show-working).
- **Excluded:** report generation; capability commissioning.
- **Backend dependencies:** EIR decision queue and mutations; signal transport; runtime health; scan-now (**all BACKEND CONTRACT REQUIRED**).
- **Acceptance criteria:** headline judgement, queue and evidence render with confidence, provenance and freshness on every element; no client-side re-ranking; all eight system states; resolve journey completable by keyboard alone.
- **Testing:** streaming and degraded-runtime simulations; state matrix; performance under a 5,000-item queue; axe including live-region announcements.
- **Architectural checks:** no intelligence composed client-side; ordering verbatim from EIR.
- **Completion gate:** Situation Room certified; intelligence presentation components frozen as Shared Capability UI.

### Sprint 5 — Company HQ
- **Objective:** single-entity operating truth.
- **Included:** §6.4 contract in full; metric cards with definition paths; coverage map; definition snapshot; timeline; Brand Layer applied at Venture scope.
- **Excluded:** editing Venture definitions; cross-company comparison.
- **Backend dependencies:** Venture instance read; metric definitions; coverage computation; activity timeline (**BACKEND CONTRACT REQUIRED** as noted).
- **Acceptance criteria:** no metric renders without a definition path; unavailable metrics show "unavailable", never zero; Brand Layer switch <16ms with no remount; all eight system states.
- **Testing:** two Ventures with different Brand Layer configurations rendered side by side; state matrix; axe.
- **Architectural checks:** no Venture conditionals; all differences come from configuration.
- **Completion gate:** Company HQ certified for at least two configured Ventures.

### Sprint 6 — Executive Office
- **Objective:** commissioning, review, approval.
- **Included:** §6.3 contract in full; capability launcher rendered from capability input contracts; engagement list and detail; trace viewer; deliverables; approvals.
- **Excluded:** capability administration (Sprint 9).
- **Backend dependencies:** capability registry and input contracts; invocation; engagement lifecycle; approval action; trace streaming (**all BACKEND CONTRACT REQUIRED**).
- **Acceptance criteria:** no runtime action executes without an explicit approved plan; launcher forms are generated from contracts, not hand-written per capability; trace streaming is cancellable with partials preserved; all eight system states.
- **Testing:** invocation happy path and every documented failure code; cancellation; permission-denied variants; axe.
- **Architectural checks:** zero capability-specific form code; no business logic in the frontend.
- **Completion gate:** Executive Office certified; capability form generation proven against at least three distinct capability contracts.

### Sprint 7 — Knowledge Experience
- **Objective:** find and inspect Knowledge Objects.
- **Included:** §6.5 and §6.6 contracts in full; collections; lineage graph; version history; usage.
- **Excluded:** object creation or deletion unless a contract exists.
- **Backend dependencies:** facet/pagination contract; lineage; usage references (**BACKEND CONTRACT REQUIRED**).
- **Acceptance criteria:** virtualised list sustains 60fps at 10,000 rows; confidence and freshness always displayed as supplied; every filter state URL-addressable; all eight system states.
- **Testing:** virtualisation performance; deep-link round trips; axe on graph and document views.
- **Completion gate:** Knowledge certified.

### Sprint 8 — Reports & Executive Intelligence Surfaces
- **Objective:** executive documents and remaining intelligence surfaces.
- **Included:** §6.7 contract in full; AI command centre wired to live intelligence payloads (Ask/Act/Brief); provenance footer; export.
- **Excluded:** new report templates (backend-owned).
- **Backend dependencies:** report registry, templates, generation, scheduling, export; AI payload and streaming contracts (**BACKEND CONTRACT REQUIRED**).
- **Acceptance criteria:** every AI output displays sources, freshness and confidence; streaming interruptible, non-blocking, announced to assistive technology; no figure recomputed client-side; all eight system states.
- **Testing:** streaming interruption; provenance completeness audit across 20 sample outputs; document rendering at print and export fidelity; axe.
- **Completion gate:** intelligence surfaces certified against §12.7 and §17.4.

### Sprint 9 — Users, Teams & Administration
- **Objective:** people, access presentation, and system observability.
- **Included:** §6.9 contract in full; Venture configuration and Brand Layer administration UI; audit log; runtime observability; capability administration; §6.11 Settings and Profile.
- **Excluded:** any client-side authorisation logic.
- **Backend dependencies:** role matrix; invitations; audit query; Venture configuration store; preference persistence (**BACKEND CONTRACT REQUIRED**).
- **Acceptance criteria:** every privileged mutation is typed-confirmed and audit-logged; permission-denied paths verified against a server that refuses regardless of UI state; Brand Layer configuration editor enforces the validation gate.
- **Testing:** privilege-escalation attempt tests (UI-forced actions must fail server-side); audit completeness; axe.
- **Architectural checks:** §17.5 verified explicitly.
- **Completion gate:** administration certified; security review passed.

### Sprint 10 — Responsive, Accessibility & Performance Hardening
- **Objective:** meet every non-functional standard across the delivered product.
- **Included:** all breakpoint transformations per Screen Contract; high-contrast intensification; reduced-motion audit; screen-reader passes; performance budget enforcement in CI; bundle and code-split review; screen-share-safe mode.
- **Excluded:** new features.
- **Backend dependencies:** none.
- **Acceptance criteria:** all §13 targets met at p95; WCAG 2.2 AA on all primary screens in both modes with zero critical automated violations; all §15 breakpoints verified with no functionality loss; 200% zoom usable everywhere.
- **Testing:** automated axe in CI; manual keyboard-only and two screen-reader passes; Lighthouse/field metrics; 10k-row table scroll.
- **Completion gate:** non-functional certification signed.

### Sprint 11 — Multi-Venture Validation
- **Objective:** prove the architecture supports Ventures without redesign.
- **Included:** configure Qualora, Calviora and Farmora through Venture Configuration and Brand Layer only; introduce a synthetic fourth Venture end to end; validate at most one justified Venture Extension against §11.5.
- **Excluded:** any Venture-specific styling, layout, or navigation.
- **Backend dependencies:** Venture configuration store (**BACKEND CONTRACT REQUIRED**).
- **Acceptance criteria:** a new Venture is introduced with configuration only — no frontend code change; zero Venture identifiers present in Core UI; every Brand Layer passes contrast and completeness gates in both appearance modes; navigation, layout, typography and interaction identical across all Ventures.
- **Testing:** automated Venture-name grep in Core UI; visual regression across all Ventures × both modes; new-Venture onboarding rehearsal timed and recorded.
- **Completion gate:** multi-Venture certification; blueprint conformance review complete.

---

## 20. Frontend Architecture Decision Register

| # | Decision | Rationale | Alternatives rejected | Consequences | Introduced | Status |
|---|---|---|---|---|---|---|
| FAD-001 | **Executive Light and Executive Dark are the only core appearance modes.** | Two modes keep contrast, testing and component quality tractable and give one recognisable operating system. | Seven independent themes (v1.0); per-Venture themes; unlimited user themes. | Midnight and Carbon retired as themes; their qualities absorbed as density/presentation options. Token parity is a build gate. | v1.1 | **Locked** |
| FAD-002 | **Venture Brand Layer replaces Venture-specific themes.** | Venture identity must be recognisable without forking the design system. | Full brand themes per Venture; per-Venture component libraries. | An exhaustive permitted-property list, a validation gate, and configuration-driven identity. Adding a permitted property requires a new register entry. | v1.1 | **Locked** |
| FAD-003 | **Persistent shell mounted once per session.** | Perceived instantaneity and continuity of context. | Per-route layouts; full-page transitions. | Global state must be isolated by concern; region-level error boundaries mandatory. | v1.0 | **Locked** |
| FAD-004 | **Decision-first information hierarchy.** | Executives need conclusions before data. | Data-first dashboards; configurable-by-default homepages. | Every screen contract must state its hierarchy explicitly; EIR must supply a headline. | v1.0 | **Locked** |
| FAD-005 | **All interface state is URL-addressable.** | Shareability, restorability, deep-linking, back/forward fidelity. | Component-local state; server-session-stored view state. | Every screen contract enumerates URL state; filters and panels must be serialisable. | v1.0 | **Locked** |
| FAD-006 | **EIR/VIC are authoritative for intelligence; the frontend never determines it.** | Prevents a shadow intelligence layer and preserves auditability. | Client-side scoring, ranking, or summarisation for "responsiveness". | Client-side sort/filter is a labelled view operation; missing intelligence fields render as "not supplied". | v1.1 (formalised) | **Locked** |
| FAD-007 | **Lovable/Cursor responsibility boundary with GitHub as single source of truth.** | Clear, permanent ownership prevents architectural drift. | Shared ownership of contracts; frontend-defined endpoints. | Contract-first development; **BACKEND CONTRACT REQUIRED** markers gate implementation. | v1.1 | **Locked** |
| FAD-008 | **Progressive-depth interaction model (Summary → Analysis → Object → Raw, max four).** | Bounded depth keeps navigation predictable and fast. | Unbounded drill-down; modal stacking. | Context panel is the primary depth mechanism; one modal deep. | v1.0 | **Locked** |
| FAD-009 | **Four-layer multi-Venture architecture (Core UI → Shared Capability UI → Venture Configuration → Venture Extensions).** | A new Venture must not require redesign. | Per-Venture applications; conditional branching in core screens. | Venture identifiers banned from Core UI; extensions require written justification and a register entry. | v1.1 | **Locked** |
| FAD-010 | **Executive Desk is a region within Executive Workspace, not a destination.** | Eliminates two overlapping personal-queue screens while preserving the metaphor. | Keeping both; deleting Desk entirely; merging Desk into Situation Room. | Four priority destinations only; Desk vocabulary retained as a region. | v1.1 | Revisitable after Sprint 3 usage review |
| FAD-011 | **"Division" is not adopted until a backend concept exists.** | Avoids inventing a domain entity for UI convenience. | Frontend-defined divisions; ad-hoc grouping stored client-side. | Division is absent from navigation and filters until a contract is supplied. | v1.1 | Revisitable on backend contract |
| FAD-012 | **Optimistic UI restricted to reversible, non-authoritative state.** | Prevents the UI implying an outcome the runtime has not confirmed. | Broad optimistic updates including approvals. | Approvals, permissions and runtime results always await server confirmation. | v1.1 (formalised) | **Locked** |
| FAD-013 | **Frontend permission gating is UX only.** | Security cannot depend on hidden controls. | Client-evaluated permission rules. | Every privileged action re-checked server-side; UI-forced action tests required in Sprint 9. | v1.1 (formalised) | **Locked** |

---

## 21. Frontend Non-Goals

The VentureOS frontend is **NOT**:
- a generic CRUD administration dashboard;
- a replacement for EIR;
- a replacement for VIC;
- a new business-logic layer;
- a second capability engine;
- a second Venture definition system;
- an AI chatbot wrapped in dashboards;
- seven separate branded applications;
- a collection of disconnected dashboards;
- an excuse to redesign the existing VentureOS backend.

These constraints are binding and are checked at every sprint completion gate.

---

## 22. Acceptance Criteria

The frontend is production-ready only when **all** of the following are objectively demonstrated. Criteria marked **[v1.1]** are new or amended in this revision.

### 22.1 Architecture and fidelity
- [ ] No existing VentureOS architecture, domain model, or backend contract has been altered; the frontend consumes EIR, VIC, Shared Capability Framework, Venture Definition/Instance Frameworks, Runtime Orchestration, and Knowledge architecture as they exist.
- [ ] **[v1.1]** The Frontend ↔ VentureOS Domain Mapping Contract (§3) is complete, and every frontend concept is classified DOMAIN-MAPPED, PRESENTATION-ONLY, or CONTRACT PENDING.
- [ ] **[v1.1]** No new backend domain concepts have been invented by the frontend; every gap is marked **BACKEND CONTRACT REQUIRED**.
- [ ] **[v1.1]** Executive Workspace and VentureOS Workspace are unambiguously defined and implemented per §4, with no separate Executive Desk destination and no overlapping screens.
- [ ] **[v1.1]** Every primary screen has a Screen Contract (§6) and the implementation matches it section by section.
- [ ] Every screen implements loading, empty, filtered-empty, stale, degraded, error, offline (where applicable), and permission-denied states.
- [ ] Every view state (filters, tabs, panel, selection) is URL-addressable and restorable.

### 22.2 Shell and layout
- [ ] Shell mounts once; no header/sidebar remount across 20 consecutive route changes.
- [ ] No full-page loading screen anywhere, including sign-in and Venture/workspace switch.
- [ ] Back/forward restores scroll position, filters, and panel state on all list and detail screens.

### 22.3 Design system
- [ ] Every component in §8 exists in a documented gallery with all variants, sizes, and states.
- [ ] Zero hardcoded colour values in component code; automated lint enforces token-only styling.
- [ ] Density toggle applies correctly across all components.

### 22.4 Appearance and Venture Brand Layer
- [ ] **[v1.1]** Executive Light and Executive Dark are the only appearance modes; no legacy theme remains in code, configuration, or UI.
- [ ] **[v1.1]** Both modes have complete, identical token coverage, verified by an automated parity check.
- [ ] Appearance switch completes within one frame, with no reload, remount, flash, or scroll/focus loss, including hard refresh.
- [ ] **[v1.1]** The Venture Brand Layer controls only the permitted properties in §10.2 and no forbidden property in §10.3; an automated gate rejects non-compliant configurations.
- [ ] **[v1.1]** Every registered Venture passes contrast and mark-legibility validation in both appearance modes.
- [ ] **[v1.1]** The component gallery is verified across both modes × every registered Venture with no unstyled or illegible component.

### 22.5 Multi-Venture architecture
- [ ] **[v1.1]** The four-layer architecture (§11) is implemented; Core UI contains zero Venture identifiers, enforced by an automated check.
- [ ] **[v1.1]** A new Venture can be introduced through configuration alone, demonstrated end to end in Sprint 11.
- [ ] **[v1.1]** Any Venture Extension satisfies every rule in §11.5 and carries a Decision Register entry.

### 22.6 Performance
- [ ] All §13 targets met at p95 in automated measurement.
- [ ] CLS < 0.05 on every primary screen.
- [ ] Tables of 10,000 rows scroll at sustained 60fps.
- [ ] **[v1.1]** Venture Brand Layer switch completes in one frame with no remount.
- [ ] Performance budgets enforced in CI; regressions block merge.

### 22.7 Accessibility
- [ ] WCAG 2.2 AA verified on all primary screens in both modes; zero critical automated violations.
- [ ] Complete keyboard-only traversal of every primary journey, including AI approval flows.
- [ ] Screen-reader pass (one Windows and one macOS reader) on the primary screens.
- [ ] Reduced-motion mode removes all non-essential motion with no information loss.
- [ ] No information conveyed by colour alone anywhere in the product.

### 22.8 Responsive
- [ ] All breakpoints in §15 verified with no loss of functionality or clipped content.
- [ ] **[v1.1]** Each Screen Contract's responsive transformation verified individually.
- [ ] Tablet flows complete for review-and-approve journeys.
- [ ] 200% zoom usable on all primary screens.

### 22.9 Authentication
- [ ] All five methods function end to end, including enrolment, recovery, forced enrolment, and expiry re-auth without work loss.
- [ ] Post-auth lands on the intended destination with no blank interim screen.

### 22.10 Intelligence and engineering boundary
- [ ] Every AI/intelligence output displays sources, freshness, and confidence; missing fields render as "not supplied".
- [ ] No runtime action executes without explicit user approval of a previewed plan.
- [ ] Streaming is interruptible, non-blocking, and announced to assistive technology.
- [ ] **[v1.1]** The frontend performs no authoritative intelligence determination; any client-side ordering differing from runtime ordering is visibly labelled.
- [ ] **[v1.1]** Frontend permission gating is proven to be UX only: UI-forced privileged actions are refused server-side.
- [ ] **[v1.1]** The Lovable/Cursor engineering boundary (§17) is documented, and every backend call passes through the adapter layer with generated domain types.
- [ ] **[v1.1]** All missing backend contracts are explicitly marked and tracked; no fabricated endpoint exists in the codebase.

### 22.11 Programme and governance
- [ ] **[v1.1]** The implementation programme (§19) exists and every completed sprint has a signed completion gate.
- [ ] **[v1.1]** The Architecture Decision Register (§20) exists and is current.
- [ ] **[v1.1]** Frontend Non-Goals (§21) are documented and checked at each gate.
- [ ] **[v1.1]** No code was generated during the production of this blueprint revision.

### 22.12 Quality gates
- [ ] Zero console errors or warnings in normal operation.
- [ ] Error boundaries contained at region level; a single failing widget never blanks a page.
- [ ] Documented keyboard shortcut reference reachable via `?`.
- [ ] Blueprint conformance review signed off per screen against §§1–21.

---

## 23. Blueprint Revision Report

### 23.1 Sections preserved
Product Vision and executive experience principles (§1); decision-first UX philosophy (§1.3); information architecture where compatible (§2); persistent application shell (§7.1); Situation Room, Company HQ, Executive Office concepts (§5, §6); Knowledge experience (§6.5–6.6); intelligence UX (§12.7); design system and component specifications (§8); loading behaviour (§12.1); error behaviour (§12.5); accessibility (§14); performance standards (§13); responsive architecture (§15); authentication experience (§16); executive experience specification (§18); acceptance criteria structure (§22).

### 23.2 Sections changed
- **§2 Information Architecture** — sidebar priority group now lists Executive Workspace (not Executive Desk); appearance switch replaces theme switch; search and switching scopes clarified; **BACKEND CONTRACT REQUIRED** markers added.
- **§5 Screen Inventory** — Executive Desk folded into Executive Workspace; Venture configuration and Brand Layer administration added to Administration.
- **§8 Design System** — typography, spacing, radius and semantic status colours explicitly declared non-overridable by any Venture.
- **§9 Appearance System** — replaces the v1.0 seven-theme catalogue with Executive Light and Executive Dark only; token architecture retained and hardened with parity gates.
- **§13 Performance** — added Brand Layer switch target; extension lazy-loading rule.
- **§14 Accessibility** — extended to cover every Brand Layer configuration.
- **§16 Authentication** — Brand Layer restriction on auth surfaces; explicit server-authoritative permission statement.
- **§18 Executive Experience** — added principle 13 (recognition across Ventures).
- **§22 Acceptance Criteria** — extended with all v1.1 certification conditions.

### 23.3 Sections added
§3 Frontend ↔ VentureOS Domain Mapping Contract; §4 Executive Workspace Definition; §6 Screen Contracts (twelve contracts); §10 Venture Brand Layer; §11 Multi-Venture Frontend Architecture; §17 Frontend Engineering Boundary (Lovable ↔ Cursor); §19 VentureOS Frontend Implementation Programme (Sprints 0–11); §20 Frontend Architecture Decision Register; §21 Frontend Non-Goals; §23 this report.

### 23.4 Architectural assumptions removed
1. Seven independent themes (Midnight, Carbon, Qualora, Calviora, Farmora as themes) — removed.
2. The assumption that Ventures may override typography, radius, or component styling — removed.
3. Executive Desk as a standalone destination — removed (folded into Executive Workspace).
4. The implicit dual meaning of "workspace" as both scope and place — removed.
5. "Division" as an assumed organisational entity — removed pending a backend contract.
6. "Portfolio" as a stored grouping entity — reclassified as presentation-only.
7. The assumption that the frontend may rank, score or summarise intelligence for responsiveness — removed.
8. The assumption that saved views, pins and drafts have a frontend-owned store — removed pending contracts.
9. The implication that company switching could imply or force a theme — removed.

### 23.5 BACKEND CONTRACT REQUIRED items identified
1. VentureOS Workspace/scope object: definition, membership, permission scope.
2. Company ↔ Venture Instance relationship and registry.
3. Division concept — existence to be confirmed or the concept dropped.
4. EIR decision queue read model and resolve/defer/delegate/dismiss actions.
5. Signal stream transport (SSE/websocket/poll) and event schema.
6. Scan-now trigger.
7. Runtime health read model.
8. Executive briefing generation and refresh contract.
9. Assignment/ownership model for items assigned to a user.
10. User pins, drafts, follow-ups persistence.
11. Capability registry, input contracts, and invocation request/response shape.
12. Engagement lifecycle states and transitions.
13. Approval action contract (approve / request changes / reject).
14. Orchestration trace streaming contract.
15. Advisor/agent roster source and status.
16. Metric definitions, units, and history.
17. Capability coverage computation.
18. Company activity timeline source.
19. Knowledge facet/filter query and pagination/cursor semantics.
20. Knowledge lineage graph contract.
21. Knowledge usage ("where used") references.
22. Report templates, generation trigger, scheduling, recipients, export/rendering.
23. Notification read model and read/mute/snooze mutations, plus delivery preference matrix.
24. Role matrix read/write and invitation payload (organisation, role, scope).
25. Forced MFA enrolment signalling.
26. Audit log query contract.
27. Venture Configuration store and Brand Layer property source.
28. User preference persistence (server-side, cross-device), including saved views.
29. Unified search endpoint, ranking semantics, and permission filtering.
30. Effective permission/capability set returned to the client for UX gating.
31. Canonical error contract (machine code, human-safe message, reference ID).
32. Generated domain TypeScript types and contract versioning policy.

### 23.6 Unresolved decisions
1. **Company vs Venture Instance** — whether "company" is the same object as a Venture Instance, a parent of it, or a separate registry. This determines the Company HQ route shape and the switcher model.
2. **Workspace authority** — whether VentureOS Workspace is an existing runtime/tenancy concept or must be introduced backend-side. The entire scoping model, URL structure, and permission filtering depend on it.
3. **Division** — retain (with a backend contract) or drop from the product vocabulary entirely.
4. **Personal state ownership** — whether pins, drafts, follow-ups and saved views are runtime-owned, a user-preference service, or out of scope for v1.
5. **Decision authority model** — who may resolve, defer, delegate or dismiss a decision, and what audit obligations attach.
6. **Intelligence streaming transport** — the agreed transport and cancellation semantics for signals, AI answers, and orchestration traces.
7. **Brand Layer property source** — whether brand properties live in the Venture Definition, the Venture Instance, or a separate configuration store, and who administers them.
8. **Existing frontend preservation** — the Sprint 0 assessment of the current repository has not yet been performed, so the reuse/retire boundary is unknown.

### 23.7 Readiness recommendation

**NOT READY FOR FRONTEND IMPLEMENTATION**

Reason: the specification itself is complete and internally coherent, but eight architectural questions (§23.6) and thirty-two backend contracts (§23.5) remain unresolved. Building screens against them now would force exactly the outcome this revision exists to prevent — a frontend-invented parallel domain model.

Recommended path to READY:
1. Resolve unresolved decisions 1, 2 and 4 (company/Venture, workspace authority, personal state ownership) — these are blocking for Sprints 2 and 3.
2. Publish the canonical error contract, the effective-permission contract, the session contract, and generated domain types — blocking for Sprint 0 completion.
3. Complete the Sprint 0 existing-frontend preservation assessment.
4. Confirm or drop Division and the Brand Layer property source.

**Sprint 0 may begin immediately.** It depends only on items 2 and 3 above and produces no product screens, so the foundation, the two appearance modes and the Venture Brand Layer mechanism can be built while the remaining contracts are settled. Sprints 1 onward are gated on their listed dependencies.

---

*End of VentureOS Frontend Master Blueprint v1.1. This document supersedes v1.0 in full. No code, React, Tailwind, or Supabase change has been produced. All subsequent frontend generation must conform to this document.*
