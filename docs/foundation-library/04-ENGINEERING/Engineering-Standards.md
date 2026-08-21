# Engineering Standards

**Purpose.** Bind how code is written on VentureOS without restating Runtime or IDS law.

**Authority.** Engineering standard for Foundation v1.1. Compatible with `apps/web/src/FOUNDATION.md` and package READMEs.

**Audience.** Engineers and AI agents writing code.

**Dependencies.** [Twelve Founding Principles](../01-FOUNDATION/Twelve-Founding-Principles.md) · [Architecture Overview](../02-ARCHITECTURE/Architecture-Overview.md)

**Related Documents.** [Sprint Standard](./Sprint-Standard.md) · [Git Workflow](./Git-Workflow.md) · [Review Process](./Review-Process.md) · [Runtime](../02-ARCHITECTURE/Runtime.md) · [IDS](../03-DESIGN/IDS.md)

**Status.** Approved

**Version.** 1.1.0

**Owner.** Engineering

**Last Updated.** 2026-08-20

---

## Workspace

- `apps/web` — VentureOS application (Next.js)
- `packages/ids` — IntelligenceOS Design System
- `packages/ui` — shared primitives that consume IDS
- `packages/eslint-config`, `packages/typescript-config` — presets

Package manager: pnpm. Node 18+. Tasks: `pnpm dev`, `pnpm build`, `pnpm lint`, `pnpm check-types`. Application tests: `pnpm --filter web test`.

Next.js in this repository has breaking changes versus older training data. Read the relevant guide under `apps/web/node_modules/next/dist/docs/` before inventing App Router patterns.

## Layer rules

- Presentation does not import `runExecutiveIntelligenceRuntime`.
- Capabilities do not dispatch or persist.
- Repositories do CRUD and mapping only. The intelligence service persists Runtime snapshots.
- Platform identity does not import Runtime.
- Screens consume IDS semantic roles. No hard-coded hex. No raw Tailwind type utilities as a substitute for IDS roles.
- Do not add a Product Registry.

## Quality bar

- New behaviour has tests at the layer it belongs to (registry, Runtime, service, projection). Registry tests must not require UI.
- Fail fast at definition and capability boundaries.
- Do not swallow redirect or schema errors in auth and persistence adapters.
- No unrelated refactoring inside a feature sprint.
- Do not commit secrets.

## Copy and accessibility

UI copy follows the [Writing Constitution](../03-DESIGN/Writing-Constitution.md). Interactive surfaces follow [Accessibility](../03-DESIGN/Accessibility.md).

## Documentation

If behaviour changes a Foundation fact, update this library in the same change set. Do not leave a second unmarked copy of the truth.
