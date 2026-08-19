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

## Platform boundaries

Identity, sessions, workspace cookies, membership, and permissions live in platform services. They do not import Runtime. Navigation (`OsShell`, extensions) is presentation and routing only.

Empty `src/api/*` barrels are unused HTTP facades retained as future extension points. They are not a second application layer.

`workspace.create` remains on owner/admin role maps. Workspace creation today grants the creator `owner` after session check; the permission is not separately asserted.

OAuth providers exist on identity rows (`google`, `github`, `apple`). `linkAuthIdentity` can persist a link. There is no OAuth login route.

## Governance boundaries

Founder decisions require `venture.update` before Runtime `FounderDecisionRecorded`. Instance feature and capability enforcement stays inside Runtime. Policy evaluation stays inside Runtime.
