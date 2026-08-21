# VentureOS

The operating system for companies.

VentureOS is an executive OS: Situation Room, Company HQ, and the Executive Office on one desk.

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
