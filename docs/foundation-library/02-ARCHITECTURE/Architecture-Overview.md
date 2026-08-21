# Architecture Overview

**Purpose.** Map ownership across Runtime, capabilities, definitions, persistence, platform identity, and presentation so no layer impersonates another.

**Authority.** Explanatory map of locked Foundation architecture. Technical source: `apps/web/src/FOUNDATION.md`.

**Audience.** Engineers and reviewers before they touch more than one layer.

**Dependencies.** [Twelve Founding Principles](../01-FOUNDATION/Twelve-Founding-Principles.md) · [Foundation Governance](../01-FOUNDATION/Foundation-Governance.md)

**Related Documents.** [Runtime](./Runtime.md) · [Capability Framework](./Capability-Framework.md) · [Venture Definitions](./Venture-Definitions.md) · [IDS](../03-DESIGN/IDS.md) · [Architecture Decision Register](../05-GOVERNANCE/Architecture-Decision-Register.md)

**Status.** Approved

**Version.** 1.1.0

**Owner.** Architecture

**Last Updated.** 2026-08-20

---

```
Founder
  → Product (launch wizard)
    → Definition Registry
      → Venture Instance (VIC + definition ref)
        → Runtime (only orchestrator)
          → engines (policy, recommendation, health, graph, …)
        → intelligence service persists snapshots
      → IDS binds atmosphere from definition id
  → Platform (identity, session, workspace, membership)
  → Shell (Situation Room, HQ, Office) — presentation and routing only
```

## Layers

| Layer | Does | Does not |
|---|---|---|
| Runtime | Orchestrate intelligence for a Venture Intelligence Core | Persist, route, theme, authenticate |
| Capability Registry | Catalogue and validate reusable capabilities | Dispatch, persist, load modules |
| Definition Registry | Authoritative metadata for products | Execute, store companies, theme |
| Persistence | CRUD and JSON mapping for snapshots and platform data | Orchestrate intelligence |
| Platform identity | Users, sessions, workspaces, membership, permissions | Import Runtime |
| IDS | Tokens, climate, brand overlay | Execute, persist, instantiate |
| Shell and modules | Project Runtime output onto the desk | Become a second application layer |

Empty `src/api/*` barrels are unused HTTP facades retained as future extension points. They are not a second application layer.

## Persistence

SQLite repositories store VIC snapshots, auth, workspaces, and membership. Authoritative notes: `apps/web/src/platform/persistence/README.md`.

`getDb()` / `getClient()` are process-scoped. The intelligence service is the only adapter that persists Runtime mutation snapshots.

Pre-definition venture rows map empty definition columns to `ventureos.company@1.0.0` so they remain valid instances.

## Platform identity

Identity, sessions, workspace cookies, membership, and permissions live in platform services. Founder decisions require `venture.update` before Runtime `FounderDecisionRecorded`. Instance feature and capability enforcement stays inside Runtime. Policy evaluation stays inside Runtime.

`workspace.create` remains on owner/admin role maps. Workspace creation grants the creator `owner` after session check; the permission is not separately asserted.

## Presentation

OsShell, navigation, and module screens are presentation and routing. They consume semantic IDS roles. They do not import `runExecutiveIntelligenceRuntime`.

Executive Atmosphere (Foundation v1.1) is specified in EAS-001 and is not yet applied as a headquarters change. Climate switching (Executive Light / Executive Dark) is live.

## Where to go next

Read [Runtime](./Runtime.md), then [Capability Framework](./Capability-Framework.md), then [Venture Definitions](./Venture-Definitions.md), then the three rooms of the desk.
