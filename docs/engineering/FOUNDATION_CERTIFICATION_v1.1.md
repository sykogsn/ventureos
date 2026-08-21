# Foundation Certification v1.1

**Document type.** Permanent certification record  
**Programme.** VS-007 — Foundation Recovery & Certification  
**Date recorded.** 2026-08-21  
**Certification status.** FOUNDATION CERTIFIED  
**Approved.** Recorded as certified on 2026-08-21. Engineering Records commit awaits founder approval (VS-008A).

This file is the engineering-memory copy of the VS-007 certification. It does not replace `docs/foundation/release/03-CERTIFICATION-INDEX.md` (layer map) or `docs/foundation-library/` (teaching and governance).

---

## Quality Gates

Run 2026-08-21 against the recovered tree.

| Gate | Result |
|---|---|
| `pnpm lint` | Pass |
| `pnpm check-types` | Pass |
| `pnpm test` | No script at the repository root. `turbo run test`: `@repo/ids` 90 pass; `web` 186 pass |
| `pnpm build` | Pass (IDS generate + web production compile) |
| `pnpm --filter @repo/ids test` | 90 pass (earlier in VS-007) |
| `pnpm --filter @repo/ids build` | Pass |
| `pnpm --filter web build` | Pass |

---

## Architecture Summary

Unchanged by VS-007. Recovery hardened the development environment only.

| Concern | Status at certification |
|---|---|
| Executive Intelligence Runtime | Locked. Only orchestrator: `runExecutiveIntelligenceRuntime`. |
| Capability Registry | Locked. Governance, not dispatch. |
| Venture Definitions | Locked. No Product Registry. |
| Persistence | Locked. Intelligence service writes Runtime snapshots. |
| Platform identity | Implemented. Does not import Runtime. |
| IntelligenceOS (IDS) | Live as tokens. Presentation only. |
| Theme Provider | `next-themes`, `attribute="class"`, `defaultTheme="system"`. Mounted from `apps/web/src/app/providers.tsx`. |
| Climate | Two climates: Executive Light / Executive Dark. Brand/atmosphere via `data-ids-brand` and `data-ids-atmosphere`. |
| Executive Atmosphere (headquarters recognition) | Specified in EAS-001. Not treated as certified HQ paint. |
| Qualora / Calviora / Farmora as marketed HQ | Not certified. |

Source of architecture lock: `apps/web/src/FOUNDATION.md`, ADR-001–ADR-008, Foundation Certification Index.

---

## Development Environment Recovery

**Single root cause.** A long-running `next dev` (PID 3076 on port 3000) kept a failed CSS graph after `packages/ids/tokens/index.css` imported `./generated/breakpoints.css`. Production build succeeded. The running server returned HTTP 500 on `/login` with `CssSyntaxError: Can't resolve './generated/breakpoints.css'`. Theme Provider and IDS were connected in source and never reached the browser.

**What was hardened (application architecture not redesigned):**

- Generated breakpoint CSS is written before `web` `dev` and `build`.
- Source-graph guard: `globals.css` → `@repo/ids/tokens.css`; layout mounts `Providers` / Theme Provider; Appearance and header `setTheme` wiring.
- Live Next lock is refused so a stale process cannot keep serving a failed CSS graph.
- Token stamp invalidates `.next/dev/cache` when generated CSS changes.
- Dev wrapper asserts `/login` HTTP 200, IDS bind attributes, next-themes boot script, and IDS tokens in the served CSS bundle. Failure stops the server.

Evidence files: `apps/web/scripts/ids-dev-guard.ts`, `apps/web/scripts/dev.ts`, `packages/ids/tokens/generate.ts`, `turbo.json` `generate` / `dev` / `build` dependsOn.

---

## Executive Design System Verification

Proven on the running guarded server at `http://localhost:3000/login` on 2026-08-21.

| Check | Result |
|---|---|
| Login HTTP 200 | Yes |
| Root layout | `<html data-ids-brand="ventureos" data-ids-atmosphere="ventureos">` |
| Auth shell | Foundation v1.1 copy, IDS type roles (`ids-kicker`, `ids-display`) |
| Tokens | Light `--ids-foundation-color-background: #f7f6f3`. Dark `#12141a`. |
| Served CSS | Foundation tokens present, `.dark` present, no `@custom-media`, no `width >= var()`, no `CssSyntaxError` |

---

## Theme Provider Verification

| Check | Result |
|---|---|
| Mounted | `layout.tsx` → `Providers` → `ThemeProvider` (`NextThemesProvider`, `attribute="class"`) |
| Live class | `html` class included `light`, then `dark` |
| Persistence | `localStorage.theme=dark` survived reload |
| Visual climate change | Login UI changed from Executive Light to Executive Dark |

Theme selector UI is not on the login / auth shell. `ThemeToggle` lives in the authenticated header (`show-md`). Settings Appearance (Light / Dark / System) is login-gated. Climate was proven by the same `html` class and `theme` storage the provider uses.

---

## Remaining Follow-up Items

Recorded in [TECHNICAL_DEBT_REGISTER.md](./TECHNICAL_DEBT_REGISTER.md).

1. Repository root has no `test` script (`pnpm test` fails; `turbo run test` passes).
2. Login has no theme selector control.
3. Next.js overlay reported 2 console hydration mismatches attributed to `venture-mark.tsx` (typical next-themes `html` class mismatch). Page still rendered.
4. Access via `127.0.0.1` blocked Next HMR (`allowedDevOrigins`). Use `http://localhost:3000`.
5. Next.js 16 `middleware` → `proxy` deprecation (already TD-006 / RM-011).

Startup logs from the long-running recovered process still contained historical `@custom-media` warnings from before generated CSS dropped that at-rule. The served CSS at certification did not include `@custom-media`.

---

## Recommendation

Foundation recovery is closed. Do not reopen IDS, Theme Provider, or Runtime architecture for this class of failure.

Begin **VS-008A Engineering Records Foundation**, then Engineering HQ as a later programme. Do not start Qualora, Calviora, or Farmora visual programmes until the founder opens those roadmapped items.

Do not tag. Do not create a GitHub Release from this certification.

---

## Certification Status

**FOUNDATION CERTIFIED**

Quality gates, login, Executive Design System, Theme Provider, and climate switching were verified on 2026-08-21. Remaining items are named debt, not a failed foundation.
