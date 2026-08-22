# Contributing to VentureOS

Read [`docs/PROJECT_CONSTITUTION.md`](docs/PROJECT_CONSTITUTION.md) first. It is the supreme governing document of this repository.

Then read [`docs/engineering/MASTER_ENGINEERING_PROMPT.md`](docs/engineering/MASTER_ENGINEERING_PROMPT.md) before you change the tree. Every sprint, implementation, review, refactor, and bug fix follows it by default.

## Start here

1. [Project Constitution](docs/PROJECT_CONSTITUTION.md) — supreme law
2. Master Engineering Prompt — mandatory engineering standard
3. [Engineering Index](docs/engineering/README.md) — Foundation Runbook, architecture, coding standards, branch strategy, release process, sprint process
4. [Foundation Library — Start Here](docs/foundation-library/00-START-HERE.md) — what the platform is

Do not continue on an unhealthy foundation. Do not claim a task is complete until it has been verified in the running application.

## Workspace

From the repository root:

```sh
pnpm install
pnpm lint
pnpm check-types
pnpm exec turbo run test
pnpm build
```

Recover a stale development server with `pnpm recover-dev`. Start the desk with `pnpm dev`.
