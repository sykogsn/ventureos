# VS-008 — Executive Design System Completion

Verification report. Foundation sprint. No GitHub Release. No tag. This does not certify Runtime, Capability, or Foundation v1.0 as a whole.

**Date.** 2026-08-22  
**Status.** Implementation complete. Login and signup visibly reflect IntelligenceOS. Authenticated rooms consume the same OsShell and IDS utilities. Live walk of Situation Room, Executive Office, and Company HQ was not signed in this session because credential entry was declined.

---

## Executive Summary

The Executive Design System already existed. Previous attempts only partly appeared because **the running app skipped the climate alias layer**.

Tokens, climates, brand, and atmosphere were loaded. Tailwind `@theme` and several surface utilities still painted from `--ids-foundation-*` primitives. Brand and atmosphere retint `--background`, `--surface`, `--card`, `--workspace`, `--accent`. Anything bound to foundation hex could not follow.

This programme finished consumption. It did not rebuild IDS. It did not add a second styling framework. It did not add Midnight or Slate climates.

**Verdict**

| Category | Result |
|---|---|
| Audit | **PASS** |
| Root cause | **PASS** — alias skip, evidenced in source |
| Typography, colour, surfaces, controls | **PASS** |
| Theme (Executive Light / Executive Dark / System) | **PASS** |
| Product atmospheres (Qualora / Calviora / Farmora) | **PASS** as overlays, not climates |
| Midnight / Slate as climates | **REFUSED** — locked law |
| Login / signup visible on localhost | **PASS** |
| Authenticated rooms live walk | **WARNING** — no session in this browser |
| Build / lint / tests / doctor | **PASS** |
| CSS / token / import errors | **PASS** |

---

## Files Changed

Consumption and certification only. Existing architecture reused.

| File | Change |
|---|---|
| `apps/web/src/app/globals.css` | `@theme` colour roles and surface/button/field utilities consume climate aliases |
| `packages/ids/themes/climate.css` | `--overlay` alias |
| `apps/web/src/core/theme/theme-provider.tsx` | `enableColorScheme`, persist key `theme` |
| `apps/web/src/modules/settings/appearance.tsx` | Executive Light / Executive Dark / System labels |
| `apps/web/src/modules/settings/screens.tsx` | Climate persistence copy |
| `apps/web/src/core/shell/theme-toggle.tsx` | Executive Light / Dark aria labels |
| `apps/web/scripts/ids-dev-guard.ts` | Fail if `@theme` or fills skip aliases |
| `apps/web/src/core/theme/ids-consumption.test.ts` | Consumption contract |
| `apps/web/scripts/doctor.ts` | IDS generate + source graph + token check |
| `apps/web/package.json` | `doctor` script; consumption test |
| `package.json` | `pnpm run doctor` |
| `packages/ids/package.json` | Atmosphere tests in IDS test run |
| `packages/ids/tokens/color.test.ts` | `--overlay` required |
| `packages/ids/tokens/atmosphere.test.ts` | `--overlay` on climate |

Not replaced: Runtime, Capability Registry, Venture Definitions, foundation hex, next-themes, `IdsBrandBinder`, layout primitives, `@repo/ui` Button/Card.

---

## Root Cause

**Evidence, not a guess.**

1. **Token pipeline was already fixed (VS-007).** Stale `next dev` and illegal `@custom-media` / `var()` media queries are closed. Login HTML 200. Served CSS has no `@custom-media` and no `width >= var()`.

2. **The remaining failure was consumption.**  
   `apps/web/src/app/globals.css` `@theme inline` previously bound Tailwind `--color-*` to `--ids-foundation-color-*`. Brand CSS writes `--background` and `--accent`. Atmosphere CSS writes `--workspace`, `--sidebar`, `--toolbar`, `--card`. Tailwind utilities that read `--color-background` never saw those retints.

3. **Surface utilities skipped the same layer.**  
   `ids-surface`, fields, secondary buttons, list items, and chips used `--ids-foundation-surface-fill` / `--ids-foundation-surface-border`. Body, workspace, sidebar, and toolbar already used `--workspace` / `--sidebar` / `--toolbar`. That is why only part of the desk looked themed.

4. **Not missing imports.** Root layout imports `./globals.css`. `globals.css` imports `@repo/ids/tokens.css`. `tokens/index.css` loads foundation, generated breakpoints, surfaces, climate, brand, atmosphere.

5. **Not the wrong provider.** `Providers` mounts `ThemeProvider` (`next-themes`, `attribute="class"`, `storageKey="theme"`). `IdsBrandBinder` lives in `OsShell` only, so login stays `data-ids-brand="ventureos"`.

6. **Not Tailwind absence.** Tailwind v4 `@theme inline` is the projection. It was pointing at the wrong variables.

7. **Not broken bind.** `brandFromDefinitionId` dual-writes `data-ids-brand` and `data-ids-atmosphere`. Login HTML includes both.

Guard now fails if `--color-background` binds to `--ids-foundation-color-background` or if `globals.css` still paints fills with `--ids-foundation-surface-fill`.

---

## Architecture Decisions

### Two climates only

Locked law (IDS-001, Visual Constitution, EAS-001, ADR-007): Executive Light (`:root`) and Executive Dark (`.dark`). System follows the device.

Settings and the header now name those climates. Persistence is `localStorage` key `theme`. Refresh keeps the choice. `/dashboard` redirect to login still measured `theme=light`, `--ids-foundation-color-background: #f7f6f3`, `--brand-primary: #3d5248`.

### Midnight and Slate

VS-008 asked for Midnight and Slate as selectable themes. That would be a third climate. Brain catalogue already rejected “Midnight climate”. Slate is Qualora material language, not a climate.

They are **not** next-themes values. Product identity continues as atmosphere overlays.

### Product themes

Qualora, Calviora, Farmora bind from `definition.id` via `applyIdsBrand`. Architecture already supports them. Completing consumption is what makes those overlays visible on surfaces, cards, fields, and buttons.

### Layers (unchanged)

| Layer | Owner |
|---|---|
| Primitive hex | `packages/ids/tokens/foundation.css` |
| Surface geometry | `packages/ids/tokens/surfaces.css` |
| Climate aliases | `packages/ids/themes/climate.css` |
| Brand retint | `packages/ids/tokens/brand/*.css` |
| Atmosphere overlay | `packages/ids/tokens/atmosphere/*.css` |
| Tailwind projection | `apps/web/src/app/globals.css` `@theme inline` |
| Climate selection | `next-themes` class on `<html>` |
| Product selection | `data-ids-brand` / `data-ids-atmosphere` |

---

## Validation

Use `pnpm run doctor`. Bare `pnpm doctor` is pnpm’s own installer check, not this script.

| Check | Result |
|---|---|
| `pnpm run doctor` | PASS — IDS generate, source graph, token `--check` |
| `pnpm --filter web lint` | PASS |
| `pnpm --filter web check-types` | PASS |
| `pnpm --filter web test` | PASS including IDS consumption and guard |
| `pnpm --filter @repo/ids test` | PASS including atmosphere tokens |
| `pnpm --filter web build` | PASS |
| Login HTTP 200 | PASS |
| Login HTML `data-ids-brand` / `data-ids-atmosphere` / next-themes boot | PASS |
| Served CSS: foundation tokens, `.dark` `#12141a`, no illegal media | PASS |
| Served CSS: `--color-background: var(--background)` | PASS |
| Localhost Executive Dark then Executive Light | PASS — computed styles |
| Light persists across refresh and `/dashboard` redirect | PASS |

Live computed styles (login, after setting `theme=light` and refresh):

- `--ids-foundation-color-background: #f7f6f3`
- `--brand-primary: #3d5248`
- `--surface: #fffefb`
- body background light paper
- primary button `rgb(61, 82, 72)`

Live computed styles (login, persisted `theme=dark` before switch):

- `--ids-foundation-color-background: #12141a`
- `--brand-primary: #c4b08a`
- `--surface: #191c24`
- `<html>` class includes `dark`

---

## Screens Verified

| Screen | Evidence |
|---|---|
| Login | Live. Executive Dark then Executive Light. Fields `vos-field`, primary `vos-btn-primary`, Google `vos-btn-secondary`, type roles `ids-display` / `ids-lead` / `ids-kicker`. |
| Signup / create account | Live Executive Light. Same shell and controls. |
| Theme persist | `localStorage.theme`, class on `<html>`, survives refresh and route change to `/login?next=/dashboard`. |
| Situation Room (`/dashboard`) | Same `OsShell` + `PageFrame` + `SectionCard` (`ids-surface-card`). Live session not opened. |
| Executive Office (`/agents`) | Same chrome. `PageFrame`. Live session not opened. |
| Company HQ / founder workspace (`/ventures`, launch) | `PageFrame`, `vos-btn-primary`, `vos-field`, `ids-surface-card`. Live session not opened. |
| Settings appearance | Source: Executive Light / Dark / System; header toggle Light↔Dark. |
| Navigation, tables, dashboard panels | Navigation rail `ids-surface-sidebar`; toolbar `ids-surface-toolbar`; lists are `StackList` / `Ledger`, not HTML tables. |

---

## Remaining Risks

1. **Authenticated visual sign-off.** This browser did not open a desk session. Founder should walk Situation Room, Office, HQ, and Settings after sign-in and confirm climate switch on those routes.

2. **Next.js hydration overlay on login.** Devtools reported a hydration mismatch at `VentureMark`. Root `<html>` already has `suppressHydrationWarning` for next-themes. This is a known class-on-html flash, not a token error. It did not block Light/Dark paint.

3. **Next.js middleware deprecation.** `middleware` → `proxy` warning. Unrelated to IDS.

4. **Qualora / Calviora / Farmora HQ identity.** Atmospheres are overlays. Product headquarters identity remains EAS Phase 4 debt. Do not treat this certificate as product UX complete.

5. **Derived focus/selected borders.** Width, radius, and shadow still use `--ids-foundation-surface-*` geometry. Colour fills now use aliases. `--ids-foundation-surface-border-selected` still mixes foundation brand; low risk.

6. **`pnpm doctor` vs `pnpm run doctor`.** The builtin pnpm command is not this programme’s doctor.

---

## Recommendations

1. Founder signs in once and confirms climate on Situation Room, Office, HQ, and Settings.
2. Do not add Midnight, Carbon, or Slate climates.
3. Keep `@theme` and utilities on climate aliases. The guard will fail a regression.
4. Treat atmosphere files as the product-theme path. Do not invent a second theme provider.
5. Hydration overlay on `VentureMark` can be a later polish ticket. It is not an IDS rebuild.

---

## Gate

IntelligenceOS presentation consumption is complete for Foundation.

This certificate is **not** Runtime certification, Capability certification, or permission to amend foundation hex.

Foundation v1.0 remains gated on the Certification Index. Do not announce Foundation complete from this report alone.
