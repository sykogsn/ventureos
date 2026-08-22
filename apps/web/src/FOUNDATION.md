# VentureOS Foundation

Certified architecture for VentureOS Foundation v1.0. This file describes ownership and boundaries. It is not a product roadmap.

## Runtime ownership

Executive Intelligence Runtime (`runExecutiveIntelligenceRuntime`) is the only orchestrator. Pages and the shell are presentational. Capability resolution is governance, not plugin dispatch. See `core/runtime/README.md`.

## Persistence ownership

SQLite repositories store VIC snapshots, auth, workspaces, and membership. The intelligence service is the only adapter that persists Runtime mutation snapshots. Repositories do CRUD and mapping only. See `platform/persistence/README.md`.

## Capability ownership

The Shared Capability Registry catalogues reusable capabilities. The Runtime asserts required capabilities and instance profiles. The registry does not execute engines. See `core/capability/README.md`.

## Venture Definition ownership

The Definition Registry is the only product-definition system. Product Bootstrap maps founder-facing product ids onto definition ids. There is no Product Registry. Instantiation validates capability, runtime, and governance profiles. See `core/venture-definition/README.md`.

## Platform catalogues

Workspace Registry catalogues organisations the founder may enter. Venture Registry catalogues companies in the active workspace and carries Definition Registry refs. Both are governance over existing persistence. They are not databases, bounded contexts, or a Product Registry. See `core/workspace-registry/README.md` and `core/venture-registry/README.md`.

Desk boot (`modules/intelligence/boot.ts`) resolves session, workspace, and company before intelligence. It does not import Runtime. The intelligence service remains the only Runtime caller.

## Platform boundaries

Identity, sessions, workspace and company cookies, membership, and permissions live in platform services. They do not import Runtime. Navigation (`OsShell`, extensions) is presentation and routing only.

Empty `src/api/*` barrels are unused HTTP facades retained as future extension points. They are not a second application layer.

`workspace.create` remains on owner/admin role maps. The Workspace Registry asserts it after the first workspace: founding the first workspace is session-only; later creates require `workspace.create` on the scoped workspace (owner/admin). Members are denied.

OAuth providers exist on identity rows (`google`, `github`, `apple`). Google sign-in is a login route. `linkAuthIdentity` can persist a link.

## Governance boundaries

Founder decisions require `venture.update` before Runtime `FounderDecisionRecorded`. Instance feature and capability enforcement stays inside Runtime. Policy evaluation stays inside Runtime.
