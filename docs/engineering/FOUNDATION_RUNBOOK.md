# VentureOS Foundation Runbook

**Purpose.** Keep the certified VentureOS foundation healthy before and after every change.

**Authority.** Engineering operating runbook. It does not amend locked architecture.  
**Owner.** Engineering  
**Last Updated.** 2026-08-22

**Engineering standard.** The supreme governing document is the [VentureOS Project Constitution](../PROJECT_CONSTITUTION.md). Every use of this runbook follows the [Master Engineering Prompt](./MASTER_ENGINEERING_PROMPT.md). Read those documents before changing the tree.

This runbook is how an engineer or agent confirms the foundation is fit to work on. It does not replace `apps/web/src/FOUNDATION.md`, the [Foundation Library](../foundation-library/00-START-HERE.md), or the [Foundation Certification](./FOUNDATION_CERTIFICATION_v1.1.md).

---

## What is locked

Foundation v1.1 is certified. Do not amend these layers inside a feature sprint:

- Executive Intelligence Runtime
- IntelligenceOS Design System constitution or token hex
- Shared Capability Registry behaviour
- Venture Definition Registry behaviour
- Persistence ownership
- Executive Environments implementation

Ownership and freeze conditions: [Foundation Governance](../foundation-library/01-FOUNDATION/Foundation-Governance.md) · [FOUNDATION.md](../../apps/web/src/FOUNDATION.md) · [FOUNDATION_CERTIFICATION_v1.1.md](./FOUNDATION_CERTIFICATION_v1.1.md).

## Architecture map

| Concern | Start here |
|---|---|
| Platform law | [VentureOS Platform Constitution](../architecture/VENTUREOS_PLATFORM_CONSTITUTION.md) |
| Teaching path | [Foundation Library — Start Here](../foundation-library/00-START-HERE.md) |
| Specification register | [docs/foundation](../foundation/README.md) |
| Ownership in code | `apps/web/src/FOUNDATION.md` |

## Keep the desk healthy

Never continue on an unhealthy foundation. The Master Engineering Prompt pre-flight is mandatory. The checks that most often fail this repository:

| Check | Command or proof |
|---|---|
| Generated design tokens | `pnpm --filter @repo/ids generate` or `generate --check` |
| Generated CSS | `tokens/generated/breakpoints.css` exists, is imported, and contains static `@theme` lengths only |
| Types | `pnpm check-types` |
| Lint | `pnpm lint` |
| Tests | `pnpm test` |
| Build | `pnpm build` |
| Stale Next process | `pnpm recover-dev` when the running process disagrees with source |
| Application startup | `pnpm dev` starts without CSS parse errors or a crash |
| Localhost | The running application answers on the intended port (default 3000) |

If the running process disagrees with source, treat the running process as a first-class suspect. Restarting is recovery, not a root-cause fix. Illegal CSS (`@custom-media`, `var()` inside `@media`, `--breakpoint-*: var(...)`) must be rejected by the token pipeline, not patched in the running graph.

## After a change

A change that claims a running desk is not done until the application starts cleanly and the claimed path has been verified in that running application. Record remaining foundation risks in [TECHNICAL_DEBT_REGISTER.md](./TECHNICAL_DEBT_REGISTER.md).
