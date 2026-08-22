# VentureOS

The operating system for companies.

VentureOS is an executive OS: Situation Room, Company HQ, and the Executive Office on one desk.

## Governance

The supreme governing document of this repository is [`docs/PROJECT_CONSTITUTION.md`](docs/PROJECT_CONSTITUTION.md). Every developer, AI agent, contributor, and future employee must follow it.

Before any sprint, implementation, review, refactor, or bug fix, read that constitution, then [`docs/engineering/MASTER_ENGINEERING_PROMPT.md`](docs/engineering/MASTER_ENGINEERING_PROMPT.md).

The [Engineering Index](docs/engineering/README.md) is the map: Foundation Runbook, architecture, coding standards, branch strategy, release process, and sprint process. Contributors start at [`CONTRIBUTING.md`](CONTRIBUTING.md). Agents start at [`AGENTS.md`](AGENTS.md).

## Workspace

- `apps/web` — VentureOS application
- `packages/ids` — IntelligenceOS Design System
- `packages/ui` — shared primitives that consume IDS
- `packages/eslint-config` — ESLint presets
- `packages/typescript-config` — TypeScript presets

Architecture and ownership: start at [`docs/foundation-library/00-START-HERE.md`](docs/foundation-library/00-START-HERE.md). Locked specifications remain in `docs/foundation/` and beside the code (`apps/web/src/FOUNDATION.md`).

## Develop

```sh
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000). Unauthenticated sessions are sent to sign in.

## Build

```sh
pnpm build
```

## Check

```sh
pnpm lint
pnpm check-types
```
