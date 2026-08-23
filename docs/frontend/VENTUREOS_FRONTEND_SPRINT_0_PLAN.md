# VentureOS Sprint 0 — Frontend Foundation Implementation Plan

**Document.** VentureOS Sprint 0 Frontend Foundation Implementation Plan  
**Date.** 2026-08-23  
**Status.** PLANNING ONLY — not an implementation authorisation  
**Blueprint.** [VENTUREOS_FRONTEND_MASTER_BLUEPRINT.md](./VENTUREOS_FRONTEND_MASTER_BLUEPRINT.md) v1.1.1  
**Decision.** [VENTUREOS_FRONTEND_INTEGRATION_DECISION.md](./VENTUREOS_FRONTEND_INTEGRATION_DECISION.md)  
**Boundaries.** [VENTUREOS_FRONTEND_PROTECTED_BOUNDARIES.md](./VENTUREOS_FRONTEND_PROTECTED_BOUNDARIES.md)  
**Contracts.** [VENTUREOS_FRONTEND_BACKEND_CONTRACT_REGISTER.md](./VENTUREOS_FRONTEND_BACKEND_CONTRACT_REGISTER.md)  
**Discovery.** [VENTUREOS_FRONTEND_INTEGRATION_DISCOVERY_REPORT.md](./VENTUREOS_FRONTEND_INTEGRATION_DISCOVERY_REPORT.md)  
**Governance.** Subordinate to the [VentureOS Project Constitution](../PROJECT_CONSTITUTION.md). Locked implementation sources remain the technical fact for Runtime, Capability Registry, Definition Registry, persistence, and IDS token values.

This plan establishes the frontend foundation for later Lovable presentation work. It does **not** start Sprint 0. It does **not** authorise product screens, IDS redesign, authentication redesign, or any change to EIR / VIC / Runtime.

Where Blueprint v1.1.1 names differ from certified IDS or live Foundation, **Foundation and IDS win**. The frontend adapts to VentureOS.

---

## 0. Locked architecture (do not reopen)

- Lovable-generated presentation integrates into the existing `apps/web` Next.js application.
- No separate production Lovable SPA.
- No Supabase.
- Existing VentureOS authentication remains authoritative.
- Existing libSQL/SQLite persistence remains authoritative.
- Existing Next.js App Router remains authoritative.
- Existing RSC loaders and Server Actions remain the integration mechanism unless Cursor explicitly changes a contract.
- EIR, VIC, Runtime, Capability Framework, Knowledge, Venture Definition Framework, Venture Instance Framework, and Workspace Registry remain authoritative.
- `packages/ids` remains the design-system foundation.
- Executive Light and Executive Dark remain the two appearance modes.
- Lovable owns presentation generation. Cursor owns architecture and integration. GitHub remains the single source of truth.

---

## 1. Current frontend foundation (verified inventory)

Inspected on disk 2026-08-23. Paths below exist unless marked **MISSING**.

### 1.1 Application host

| Fact | Path / evidence |
|---|---|
| One app | `apps/web` — Next.js 16.3, React 19, Tailwind CSS v4 |
| Package manager | workspace `pnpm@9.0.0` |
| Design system | `@repo/ids` workspace package |
| Thin UI helpers | `@repo/ui` — `Button`, `Card`, `cn` only |
| Request gate | `apps/web/src/proxy.ts` (no `middleware.ts`) |
| Persistence | libSQL/SQLite — not in Sprint 0 scope |

### 1.2 App Router

**Root** — `apps/web/src/app/`

| File | Role |
|---|---|
| `layout.tsx` | HTML shell, `next/font/local`, `globals.css`, `Providers` |
| `providers.tsx` | Client wrapper → `ThemeProvider` |
| `globals.css` | `@import "@repo/ids/tokens.css"` + Tailwind v4 + `@source` for `packages/ui` and `packages/ids` |
| `page.tsx` | Redirect `/` → `/dashboard` |
| `not-found.tsx` | Standalone 404 |
| `icon.svg`, `apple-icon.svg` | Favicons |

**MISSING at root:** `loading.tsx` (intentionally removed — must not return), `error.tsx`, `global-error.tsx`, `template.tsx`, `tailwind.config.*`.

**`(auth)`** — `apps/web/src/app/(auth)/`

- `layout.tsx` → `ExecutiveAuthShell`
- `loading.tsx` → `ContentLoading` (**only** `loading.tsx` on disk)
- `login/page.tsx`, `signup/page.tsx`, `forgot-password/page.tsx`, `forgot-password/sent/page.tsx`, `reset-password/page.tsx`

**`(app)`** — `apps/web/src/app/(app)/`

- `layout.tsx` → `getSession` + `getShellSnapshot` + `OsShell`
- `not-found.tsx`, `[...notFound]/page.tsx`
- **No** `(app)/loading.tsx` and **no** segment `loading.tsx` files (intentionally removed)
- Nested: `(app)/ventures/[ventureId]/layout.tsx` → `VentureWorkspace`

Authenticated pages include dashboard, situation/intelligence surfaces, ventures (list, launch, HQ, scoped rooms), brain, engineering, settings, agents.

**OAuth routes (protected):** `apps/web/src/app/auth/google/route.ts`, `.../callback/route.ts`.

### 1.3 Provider and theme chain

```
app/layout.tsx
  └── Providers → core/theme/theme-provider.tsx (next-themes)
        attribute="class"  storageKey="theme"  enableSystem
(app)/layout.tsx
  └── OsShell
        ├── ShellProvider          core/context/shell-context.tsx
        ├── IdsBrandBinder         core/theme/ids-brand-binder.tsx
        └── ShellFrame
              SkipLink + Sidebar + TopNav + NavigationProgress
              + WorkspaceMain#main-content + CommandPalette
```

Climate is the `.dark` class, **not** Blueprint `data-appearance`. Preference is **localStorage** via `next-themes`, not a server preference contract. Sprint 0 preserves this. Do not rewrite climate onto a new attribute.

Venture identity is `data-ids-brand` + `data-ids-atmosphere` via `applyIdsBrand()` from `@repo/ids/themes/bind`. **Not** Blueprint `data-venture`. Sprint 0 preserves the IDS attributes.

### 1.4 Navigation shell

All under `apps/web/src/core/shell/`:

`os-shell.tsx`, `sidebar.tsx`, `top-nav.tsx`, `command-palette.tsx`, `navigation-progress.tsx`, `content-loading.tsx`, `executive-loading.tsx`, `deferred-operating-screen.tsx`, `empty-copy.tsx`, `page-frame.tsx`, `page-header.tsx`, `theme-toggle.tsx`, `workspace-switcher.tsx`, `venture-switcher.tsx`, `notification-center.tsx`, `profile-menu.tsx`, `icon-button.tsx`, `popover.tsx`, `venture-mark.tsx`, `snapshot.ts`, `venture-route.ts`.

Nav contributions: `apps/web/src/extensions/builtin.ts` (Situation Room, Ventures, Executive Office, Brain, Engineering HQ, Settings).

**Shell-level context panel: MISSING.** Page-level `Inspector` exists in `core/layout/primitives.tsx`. Sprint 0 may reserve a slot; it must not invent a backend Workspace or intelligence panel.

### 1.5 Layout system

`apps/web/src/core/layout/primitives.tsx` (~90 primitives), `index.ts`, `manifest.ts`, `MANIFEST.md`.

Product modules must compose these primitives. Raw Tailwind layout utilities in product modules are already gated by `product-layout.test.ts`.

Notable existing primitives: `Workspace`, `SkipLink`, `NavigationRail`, `SplitView`, `Stage`, `WorkspaceMain`, `WorkspaceCanvas`, `PageRoot`, `Dashboard`, `Inspector`, `CommandRegion`, `OverlayPanel`, `OverlayPulse`, `SurfaceTabs`, `Field`, `ControlFace`, `Hairline`, `Breadcrumb`, `Reveal`.

### 1.6 Shared UI

| Package | Exports | Path |
|---|---|---|
| `@repo/ui` | `Button`, `Card`, `cn` | `packages/ui/src/button.tsx`, `card.tsx`, `cn.ts` |
| Web re-export | `cn` | `apps/web/src/utils/cn.ts` |

Most chrome is IDS utilities in `globals.css` (`vos-btn-*`, `vos-field`, `ids-surface-*`, `ids-skeleton`, `ids-status-*`, `ids-pill`, `ids-chip`).

### 1.7 IDS consumption

| Item | Path |
|---|---|
| Package | `packages/ids` (`@repo/ids`) |
| Token entry | `packages/ids/tokens/index.css` |
| Foundation (both climates) | `packages/ids/tokens/foundation.css` — `:root` Executive Light, `.dark` Executive Dark |
| Surfaces | `packages/ids/tokens/surfaces.css` |
| Climate aliases | `packages/ids/themes/climate.css` |
| Brand accents | `packages/ids/tokens/brand/{ventureos,qualora,calviora,farmora}.css` |
| Atmosphere | `packages/ids/tokens/atmosphere/{ventureos,qualora,calviora,farmora}.css` |
| Generated breakpoints | `packages/ids/tokens/generated/breakpoints.css` — 640 / 768 / 1024 / 1280 |
| Bind API | `packages/ids/themes/bind.ts` — `IDS_BRANDS`, `brandFromDefinitionId`, `applyIdsBrand` |
| Generate | `pnpm --filter @repo/ids generate` · check: `tsx tokens/generate.ts --check` (also inside `@repo/ids` `test`) |
| Web bind | `apps/web/src/core/theme/ids-brand-binder.tsx` |
| Dev/build guard | `apps/web/scripts/ids-dev-guard.ts` |

**Do not redesign IDS.** Sprint 0 consumes it.

### 1.8 Fonts and icons

- `layout.tsx` references `./fonts/GeistVF.woff` and `./fonts/GeistMonoVF.woff`. **Font binaries are MISSING on disk.** Cursor owns recovery (restore files or switch to an existing self-hosted font). Lovable must not introduce Google Fonts or a second type system.
- Icons: `lucide-react` in shell chrome. Utilities `ids-icon-sm` / `ids-icon-md`.

### 1.9 Loading, error, empty

| Pattern | Status |
|---|---|
| Auth route loading | `(auth)/loading.tsx` → `ContentLoading` |
| Desk route `loading.tsx` | **Forbidden** — remounts OsShell |
| Navigation pending | `NavigationProgress` + `OverlayPulse` |
| Empty copy | `empty-copy.tsx` |
| Deferred rooms | `deferred-operating-screen.tsx` |
| Route `error.tsx` | **MISSING** at every level |
| Tooltip primitive | **MISSING** |
| Avatar primitive | **MISSING** |

### 1.10 Accessibility and motion already present

- `SkipLink` → `#main-content`
- Focus-visible rules in `globals.css`
- `prefers-reduced-motion` in `globals.css` (disables transitions; stops `.ids-skeleton`)
- `Reveal` maps to IDS `sm` / `md` / `lg`
- NavigationRail: overlay below `lg`, fixed at `lg+`

### 1.11 Existing tests Sprint 0 must keep green

| Test | Path |
|---|---|
| IDS consumption | `apps/web/src/core/theme/ids-consumption.test.ts` |
| Brand bind | `apps/web/src/core/theme/ids-bind.test.ts` |
| Layout manifest | `apps/web/src/core/layout/product-layout.test.ts` |
| Shell continuity | `apps/web/src/core/shell/navigation-continuity.test.ts` |
| Venture route | `apps/web/src/core/shell/venture-route.test.ts` |
| IDS guard | `apps/web/scripts/ids-dev-guard.test.ts` |
| IDS package | `packages/ids` color / surface / atmosphere / css-media / bind tests |
| Foundation / Runtime / auth / registry | listed in `apps/web/package.json` `"test"` |

### 1.12 Blueprint names that must not overwrite IDS

| Blueprint name | Live Foundation / IDS | Sprint 0 rule |
|---|---|---|
| `data-appearance="light\|dark"` | `next-themes` class `.dark` | Keep live climate |
| `data-venture="<id>"` | `data-ids-brand` + `data-ids-atmosphere` | Keep IDS attributes |
| `brand-accent` token name | `--ids-brand-{id}-accent` → `--accent` | Consume aliases |
| `critical` | `--danger` / `--ids-foundation-color-danger` | Use IDS status colours |
| `surface-raised` | `--surface-elevated` | Use IDS aliases |
| Brand validation gate / mark tokens | Not in IDS | Do **not** invent inside `packages/ids` |
| ≥1600px token | Not generated (xl = 1280) | Do **not** add an IDS breakpoint in Sprint 0 |

---

## 2. Sprint 0 objective

Make `apps/web` ready for **controlled** Lovable presentation development without weakening Foundation.

Sprint 0 establishes:

1. A signed preservation inventory (this section plus Discovery).
2. IDS consumption rules Lovable must follow.
3. Preserved Executive Light / Executive Dark switching.
4. Brand Layer mapped to existing atmosphere — no Venture-specific design systems.
5. A minimum primitive set, preferring KEEP/REFINE over CREATE.
6. A component gallery that proves tokens, climates, and atmospheres.
7. Shell structure that stays mounted, with a reserved context-panel **slot**.
8. Reusable loading / empty / error **presentation** patterns.
9. Responsive, accessibility, and motion foundations using existing IDS tokens.
10. Quality gates and a certification checklist.

Sprint 0 does **not** implement Situation Room, Executive Workspace, Company HQ, or Executive Office product intelligence. Placeholders may exist only to prove shell composition.

---

## 3. Scope

### A. IDS consumption

**Owner.** Cursor defines the rule. Lovable obeys it. Cursor does not regenerate or restyle IDS tokens.

Lovable-generated presentation must:

- Import no colour hex, rgb, or named CSS colours in `apps/web` presentation files.
- Use climate aliases (`--background`, `--surface`, `--text-primary`, `--accent`, `--danger`, …) or the existing `@utility` classes in `globals.css`.
- Use typography utilities (`ids-display`, `ids-heading`, `ids-body`, `vos-*`) — not ad-hoc font stacks.
- Use spacing / radius / elevation / motion from `--ids-foundation-*` or existing utilities (`ids-transition`).
- Use status utilities (`ids-status-healthy`, `watch`, `risk`, `info`, `quiet`) — do not invent a parallel status palette.
- Express Venture identity only through `IdsBrandBinder` + existing brand/atmosphere CSS. Do not create Qualora.css / Calviora.css / Farmora.css outside `packages/ids`.

**Cursor Sprint 0 work (allowed, still not an IDS redesign):**

- Add a **web-side** lint or test that fails on hex / `rgb(` / raw colour in presentation globs (`modules/**/screens.tsx`, `modules/**/components/**`, new gallery). Reuse the convention already tested by `ids-consumption.test.ts` and `surface.test.ts`. There is **no** token-only ESLint rule today.
- Document the allowed class/token list in the gallery.
- Restore missing Geist font files or an approved self-hosted substitute so `layout.tsx` does not reference absent binaries.

**Forbidden:** editing `packages/ids/tokens/foundation.css` hex, adding climates, forking IDS, introducing Tailwind config that bypasses `@repo/ids/tokens.css`.

### B. Executive Light / Executive Dark

**Preserve** `theme-provider.tsx`, `theme-toggle.tsx`, Settings appearance (`modules/settings/appearance.tsx`), and command `theme.toggle`.

Required behaviour (already largely true):

- Both climates function from one semantic architecture in `foundation.css`.
- Switch is client-side; `disableTransitionOnChange` is already set — no reload.
- Preference persists in `localStorage` key `theme`.
- System preference is allowed (`enableSystem`).
- Venture switch must not change climate.

Sprint 0 **does not** implement Blueprint server-side appearance persistence (no BCR for it; do not invent). Local device persistence is sufficient.

Sprint 0 **does not** migrate to `data-appearance`.

Work: prove both modes on the gallery; fix any presentation hex that breaks a climate; keep `ids-consumption.test.ts` green.

### C. Venture Brand Layer → existing atmosphere

Map Blueprint §10 onto live architecture:

| Blueprint term | Live source |
|---|---|
| Venture identity | Active Venture Registry entry + `definitionId` |
| Mark / logo | `core/shell/venture-mark.tsx` + display name from shell snapshot |
| Approved accent | `packages/ids/tokens/brand/{id}.css` via `data-ids-brand` |
| Atmosphere / chrome tint | `packages/ids/tokens/atmosphere/{id}.css` via `data-ids-atmosphere` |
| Metadata (stage, name) | Existing venture record fields shown in `venture-switcher.tsx` / `page-header.tsx` |

Rules:

- Qualora, Calviora, Farmora remain recognisably VentureOS: same shell, type, spacing, nav.
- Calviora atmosphere is overlay-only today (held in IDS). Do not “complete” Calviora chrome in Sprint 0.
- Blueprint Brand Layer validation gate (contrast + mark sizes + reject bad config) is **not** an IDS programme in Sprint 0. If a presentation-only check is added, it lives in web tests and fail-closes to `ventureos` via existing `brandFromDefinitionId`.
- Empty configuration path already exists: unknown definition → `ventureos`.
- Do not add `data-venture`. Do not create Venture-specific component libraries.

### D. Component foundation (classify before creating)

Evaluate existing pieces first. `@repo/ui` stays thin. Prefer wrapping `globals.css` utilities and `core/layout` primitives over a new component kit.

| Primitive | Current location | Class | Sprint 0 action |
|---|---|---|---|
| Button | `packages/ui/src/button.tsx` + `vos-btn-*` | **KEEP** | Consume; do not restyle hex |
| IconButton | `core/shell/icon-button.tsx` | **KEEP** | Require accessible name |
| Card | `packages/ui/src/card.tsx` + `ids-surface-card` | **KEEP** | |
| Surface | `ids-surface*` + layout `Panel` / `InsetSurface` | **KEEP** | |
| Input | `vos-field` + layout `Field` / `ExecutiveField` | **REFINE** | Thin labelled wrapper over existing utility |
| Textarea | same field utility | **REFINE** | Same wrapper, `textarea` element |
| Select | no shared primitive | **CREATE** | Native `<select>` styled with `vos-field` — no new library |
| Checkbox | native in auth screens | **REFINE** | Shared labelled control using `vos-control` |
| Toggle | appearance segmented control in settings | **REFINE** | Extract presentation only if gallery needs it |
| Badge | `ids-pill`, `ids-chip` | **REFINE** | Thin wrappers |
| Status | `ids-status-*` | **REFINE** | Thin wrappers; colour + text |
| Tooltip | **MISSING** | **CREATE** | Minimal, keyboard-dismissible; no business logic |
| Popover | `core/shell/popover.tsx` | **KEEP** | |
| Dropdown | popover menus in chrome | **REFINE** | Reuse popover; do not add a second menu system |
| Dialog | `vos-dialog` + `OverlayPanel` | **REFINE** | Focus trap + restore; presentation only |
| Drawer / Sheet | `NavigationRail` overlay + `ids-surface-drawer` | **KEEP** | Do not add a second drawer kit |
| Tabs | `SurfaceTabs` / `SurfaceTabFace` | **KEEP** | |
| Skeleton | `ids-skeleton` | **REFINE** | Region recipes matching canvas geometry |
| EmptyState | `EmptyCopy`, `DeferredOperatingScreen` | **REFINE** | Shared empty / filtered-empty recipes |
| ErrorState | **MISSING** as a primitive | **CREATE** | Presentation block; string message only (BCR-011 not implemented) |
| Avatar | **MISSING** | **CREATE** | Initials fallback; no new identity store |
| Breadcrumb | layout `Breadcrumb` + `page-header.tsx` | **KEEP** | |
| Separator | `Hairline`, `HeaderRule` | **KEEP** | |
| ScrollArea | native overflow | **KEEP** | Do not add a scroll library in Sprint 0 |
| Command primitive | `CommandRegion` + command palette | **KEEP** | Mount point only |
| Table foundation | layout `Ledger` | **REFINE** | Gallery demo only; no reporting backend |

Do not duplicate working primitives. Do not introduce shadcn/Radix as a second design system unless Cursor explicitly approves a single primitive that IDS cannot express — default is **no**.

---

## 4. Folder ownership

Lovable does **not** own `apps/web`. Ownership is file-specific. See also Protected Boundaries.

### 4.1 LOVABLE PRESENTATION SAFE (Sprint 0)

New or visual-only work after Cursor review:

| Area | Path | Limit |
|---|---|---|
| Foundation gallery | `apps/web/src/modules/frontend-foundation/` (**create**) | Gallery screens, primitive demos, empty/error recipes. No loaders, no actions, no Runtime |
| Gallery route shell | `apps/web/src/app/(app)/engineering/foundation/page.tsx` **or** a new thin page Cursor adds under Engineering HQ | Import gallery only; keep existing loaders if the page already has them |
| Auth presentation | listed auth screens/layout/loading in Protected Boundaries | Presentation only |
| Shell chrome look | listed `core/shell/*.tsx` visual files | Wiring, snapshot, and route sync stay Cursor-owned |
| Shared helpers | `packages/ui/src/button.tsx`, `card.tsx` | Token classes only |
| Settings appearance chrome | `modules/settings/appearance.tsx` | Labels/layout; do not change persistence |

**Staging (preferred first landing).** Lovable generates into `apps/web/src/modules/frontend-foundation/` first. Cursor promotes into shell/auth only after review.

### 4.2 CURSOR INTEGRATION

Cursor connects presentation to existing contracts. Lovable must not re-implement:

| Interface | Path |
|---|---|
| Session | `apps/web/src/lib/auth/session.ts` |
| Shell DTO | `apps/web/src/core/shell/snapshot.ts` |
| Desk boot | `apps/web/src/modules/intelligence/boot.ts` |
| Theme bind | `apps/web/src/core/theme/theme-provider.tsx`, `ids-brand-binder.tsx` |
| Layout route | `apps/web/src/app/(app)/layout.tsx`, `(auth)/layout.tsx` |
| Nav continuity tests | `apps/web/src/core/shell/navigation-continuity.test.ts` |
| IDS guard / generate | `apps/web/scripts/ids-dev-guard.ts`, `packages/ids/tokens/generate.ts` |
| Font recovery | `apps/web/src/app/layout.tsx` + font files |
| CODEOWNERS / path filters | repository root (Cursor adds if missing) |

### 4.3 PROTECTED (Lovable never modifies without architectural approval)

Everything listed in [VENTUREOS_FRONTEND_PROTECTED_BOUNDARIES.md](./VENTUREOS_FRONTEND_PROTECTED_BOUNDARIES.md), including:

- `apps/web/src/core/runtime/`, `FOUNDATION.md`
- VIC / intelligence engines and `modules/intelligence/{service,boot,governance,request}.ts`
- Capability, Venture Definition, Venture Registry, Workspace Registry
- Persistence (`platform/persistence/`, `apps/web/data/`)
- Auth implementation: `lib/auth/`, `modules/auth/{service,actions,google-* ,password-reset}.ts`, `proxy.ts`, `app/auth/google/`
- Permissions, kernel, bootstrap, events, audit
- `apps/web/src/contracts/`, `packages/ids/tokens/`, `packages/ids/themes/bind.ts`
- Constitutions under `docs/PROJECT_CONSTITUTION.md`, `docs/foundation/`, `docs/foundation-library/`

Also protected for Sprint 0:

- Restoring `apps/web/src/app/loading.tsx` or `(app)/**/loading.tsx`
- Filling `apps/web/src/api/*`
- Product screen rewrites of Situation Room, HQ, Executive Office, Brain (those sprints are later)

---

## 5. Lovable handoff model

Prefer the **safest maintainable** workflow, not the fastest generation loop.

### Recommended method — staged generation, Cursor-owned GitHub

1. **Does Lovable connect directly to GitHub?**  
   **No write access to `main`.** Optional read of the repository. If Lovable Git sync is used at all, it may push **only** to `feat/frontend-sprint-0-lovable`. Cursor never grants Lovable rights to protected paths via a blanket app install.

2. **Branch.**  
   Lovable works on `feat/frontend-sprint-0-lovable`, branched from Cursor’s `feat/frontend-sprint-0`. See §16.

3. **Paths Lovable may modify.**  
   Only §4.1. Default landing: `apps/web/src/modules/frontend-foundation/**`.

4. **Final location vs staging.**  
   **Staging first.** Components are generated in `frontend-foundation/`. Cursor copies or re-exports into `core/shell` / `@repo/ui` only when KEEP/REFINE requires it. Direct edits to OsShell wiring are Cursor-only.

5. **Cursor review.**  
   Every Lovable push is a GitHub PR into `feat/frontend-sprint-0`. Cursor reviews diff against Protected Boundaries, IDS consumption, and this plan. No merge without review.

6. **Connecting loaders/actions.**  
   Cursor keeps `(app)/layout.tsx` calling `getSession` / `getShellSnapshot`. Gallery pages receive **fixture or existing snapshot props** only. Lovable does not add `getPersistence()`, fetch to new hosts, or Server Actions.

7. **Preventing protected edits.**  
   Cursor adds `CODEOWNERS` for protected globs (Runtime, persistence, auth implementation, IDS tokens, `proxy.ts`). PR CI (or review checklist) rejects files outside the allow-list. Lovable brief includes the Protected Boundaries file verbatim.

8. **Conflicts.**  
   Cursor’s `feat/frontend-sprint-0` wins on protected and integration files. Lovable rebases onto it. Do not resolve conflicts by accepting generated Runtime/auth/IDS hunks.

9. **Reject / revert.**  
   Close the Lovable PR, or `git revert` the merge commit on `feat/frontend-sprint-0`. Existing presentation is not deleted until the replacement is certified (Integration Decision rollback principle).

10. **Certification before merge to `main`.**  
    Cursor runs §10 gates and §14 checklist on `feat/frontend-sprint-0`. Founder/Cursor certify. Only then PR to `main`. Lovable PRs never target `main`.

### Explicitly rejected handoff patterns

- Lovable as the production app host
- Lovable writing to `main`
- Generating a parallel Vite/SPA repo
- “Export ZIP into apps/web” without PR review
- Letting Lovable “fix” TypeScript by editing services

---

## 6. Application shell foundation

Sprint 0 may refine **structure and chrome presentation**. It must not implement product intelligence.

| Region | Existing | Sprint 0 |
|---|---|---|
| Persistent header | `top-nav.tsx` | KEEP; refine density/tokens only |
| Sidebar / rail | `sidebar.tsx` + `NavigationRail` | KEEP; do not reorder destinations into a new IA |
| Content canvas | `WorkspaceMain` + `page-frame.tsx` | KEEP |
| Context panel **slot** | `Inspector` is page-level; no shell slot | ADD an empty, collapsed slot in layout primitives **or** document that `Inspector` is the slot. No data. No EIR. Placeholder copy only |
| Responsive shell | rail overlay below `lg` | KEEP; prove at Blueprint-mapped widths using IDS breakpoints |
| Navigation presentation | `extensions/builtin.ts` labels/hrefs | Cursor-owned registry; Lovable may refine labels only with Cursor |
| Venture identity region | `venture-mark.tsx`, `venture-switcher.tsx` | KEEP; atmosphere via binder |
| User / profile | `profile-menu.tsx` | KEEP |
| Theme switcher | `theme-toggle.tsx` | KEEP |
| Command palette mount | `CommandPalette` in `OsShell` | KEEP; do not build Ask-AI product |
| Notification mount | `notification-center.tsx` | KEEP chrome; no notification backend (BCR-008) |
| Loading region | `NavigationProgress` + `OverlayPulse` | KEEP; never add desk `loading.tsx` |

Shell must remain mounted across route changes (`navigation-continuity.test.ts`).

Placeholder content for the gallery or a reserved `/engineering/foundation` surface may show labelled regions (“Header”, “Rail”, “Canvas”, “Context slot”) using `EmptyCopy`. It must not call intelligence loaders beyond what the existing page already does.

---

## 7. Loading / error / empty foundations

These are **presentation components**. Do not invent backend state machines.

| Pattern | Presentation source | Backend |
|---|---|---|
| Initial / auth loading | `ContentLoading` | None |
| Desk navigation pending | `NavigationProgress` + `OverlayPulse` | None — client transition (BCR-009) |
| Region loading | `ids-skeleton` recipes in gallery | None |
| Empty | `EmptyCopy` | None |
| Filtered empty | refine `EmptyCopy` with “clear filters” **chrome** | No search contract (BCR-007 deferred) |
| Error | new `ErrorState` block | Display `{ error?: string }` only. Machine codes = BCR-011, **do not implement** |
| Degraded / stale | banner using `ids-status-watch` + existing copy | No freshness contract in Sprint 0 |
| Permission denied | presentation state | Server already enforces; UI may show a static denied block. Do not authorise client-side |
| Offline | optional `navigator.onLine` banner | No offline API |

**Do not add** `(app)/loading.tsx` or root `app/loading.tsx`.  
**Do not add** a global error contract implementation. A route-level `error.tsx` **inside `(app)`** that renders `ErrorState` and does not remount OsShell may be added by Cursor if it is presentation-only.

---

## 8. Responsive foundation

Certified IDS breakpoints (`packages/ids/tokens/generated/breakpoints.css`):

| Token | Width | Maps to Blueprint §15 |
|---|---|---|
| `sm` | 640px | below tablet; future mobile starts `<768` |
| `md` | 768px | Tablet |
| `lg` | 1024px | Laptop / rail breakpoint (live shell) |
| `xl` | 1280px | Desktop |

**≥1600px is not an IDS token.** Sprint 0 must not add `--breakpoint-*` in `packages/ids`. Extra-wide behaviour uses existing `measure.xl` / canvas max-width. A later IDS programme may add `2xl` if approved.

| Width | Shell | Sidebar | Context slot | Density / touch |
|---|---|---|---|---|
| ≥1280 (`xl+`) | Header + rail + canvas | Expanded rail | Slot may sit inline if space; default overlay/collapsed in Sprint 0 | Comfortable; mouse |
| 1024–1279 (`lg`–`xl`) | Same | Live code: rail visible at `lg`. Do not invent a new icon-rail system unless Cursor refines `NavigationRail` using existing tokens | Overlay | Comfortable |
| 768–1023 (`md`–`lg`) | Condensed header | Overlay drawer (already) | Overlay / hidden | Touch targets ≥44px on interactive chrome |
| <768 | Single column; command full-screen if opened | Overlay | Hidden | Future; do not build bottom nav product IA |

Spacing follows `--ids-foundation-space-*` and `vos-screen`. Density tokens are **not** in IDS; do not invent a density system in Sprint 0.

---

## 9. Accessibility foundation

Target: **WCAG 2.2 AA** on Sprint 0 surfaces (gallery, shell chrome, auth presentation if touched).

Sprint 0 must establish or preserve:

| Requirement | Live starting point | Sprint 0 |
|---|---|---|
| Focus-visible | `globals.css` | KEEP; verify on gallery controls |
| Keyboard | Shell popovers, palette, skip link | Tab through header, rail, theme, profile, gallery |
| Skip link | `SkipLink` → `#main-content` | KEEP |
| Landmarks | `WorkspaceMain` is main | KEEP; gallery must not add a second `main` |
| Icon-button names | `IconButton` | Enforce `aria-label` in gallery and chrome |
| Reduced motion | `globals.css` | KEEP; gallery motion uses `ids-transition` only |
| Contrast | IDS climates | Manual + axe on gallery in both modes × `ventureos` atmosphere |
| Dialog focus | `OverlayPanel` | REFINE trap/restore if missing |
| Tooltip keyboard | **MISSING** | Esc dismiss; not hover-only |
| Touch targets | mixed | ≥24×24 CSS px (Blueprint); ≥44px on tablet chrome |

Do not implement a full shortcut customiser in Sprint 0. Document existing shortcuts (`theme.toggle`, palette) only.

---

## 10. Motion foundation

Use IDS motion tokens from `foundation.css`:

- `--ids-foundation-motion-duration-*` (fast / base / slow / skeleton)
- `--ids-foundation-motion-ease-*`

Allowed: colour/opacity on climate switch (already disabled via `disableTransitionOnChange`), overlay fade, skeleton pulse, `OverlayPulse` navigation bar.

Forbidden: decorative parallax, looping attention animations, page-wide morphs, motion that implies intelligence “thinking” beyond existing chrome.

`prefers-reduced-motion: reduce` already kills transitions and skeleton animation. New motion must honour it.

VentureOS should feel fast and calm. No animation system package.

---

## 11. Quality gates (actual commands)

Do not invent scripts. Use the workspace as it exists.

| Gate | Command |
|---|---|
| Types | `pnpm check-types` (turbo) or `pnpm --filter web check-types` |
| Lint | `pnpm lint` or `pnpm --filter web lint` (`eslint --max-warnings 0`) |
| App tests | `pnpm --filter web test` |
| IDS tests + generate check | `pnpm --filter @repo/ids test` |
| IDS generate | `pnpm --filter @repo/ids generate` |
| Build | `pnpm --filter web build` (runs `ids-dev-guard.ts --build` then `next build`) |
| Doctor | `pnpm doctor` |
| Format (optional) | `pnpm format` |

**Manual / existing automated complements**

| Concern | How |
|---|---|
| Foundation / Runtime / registry / auth | already inside `web` `test` — must stay green |
| Executive Light / Dark | gallery + `ids-consumption.test.ts` + ThemeToggle |
| Hard-coded colours | new presentation glob test (Cursor) + existing IDS surface/hex rules |
| Hydration / console | `pnpm --filter web recover-dev` then exercise gallery and login chrome |
| Route regressions | navigate dashboard → settings → engineering foundation; OsShell stays mounted |
| Auth regressions | login / logout / Google routes **untouched** in implementation; smoke existing flows |
| EIR / VIC / Runtime | no Sprint 0 edits; Runtime tests must pass unchanged |
| Accessibility | axe on gallery (add only if Cursor chooses a documented runner; otherwise manual axe + keyboard). Do not invent a CI script name that does not exist |
| Responsive | DevTools widths 640, 768, 1024, 1280 |

---

## 12. Visual acceptance tests (manual)

### Appearance

1. Sign in with existing VentureOS auth (do not redesign).
2. Open the foundation gallery.
3. Switch Executive Light → Executive Dark → Executive Light via theme toggle.
4. Verify: no full reload; no white/black flash on revisit (next-themes boot script); no lost scroll/nav state; readable contrast; surfaces use climate aliases.

### Venture identity

1. Switch among available Venture contexts (`venture-switcher`).
2. Verify: mark/name/accent/atmosphere change; OsShell structure identical; climate unchanged; no Qualora-only layout.

### Responsive

1. 1280, 1024, 768, 640 widths.
2. Verify rail → overlay behaviour; canvas readable; no clipped primary chrome.

### Keyboard

1. Skip link to main.
2. Tab: rail, switchers, command, theme, profile, gallery controls.
3. Esc closes popover/dialog/tooltip.

### Loading

1. Client-navigate between two `(app)` routes.
2. Verify previous page stays visible; `OverlayPulse` may show; OsShell does not remount; no full-page skeleton desk.

### Error

1. Render `ErrorState` in the gallery with a fixture string.
2. Verify region-level failure, not a blank app.

---

## 13. Explicit Sprint 0 non-goals

Sprint 0 must **not** implement:

- Situation Room intelligence
- Executive Workspace intelligence
- Company HQ product functionality
- Executive Office product functionality
- Knowledge search
- AI chat / Ask AI product
- EIR, VIC, or Runtime redesign
- Capability execution redesign
- Notification backend
- Reporting backend
- Supabase
- Database migration
- Authentication redesign
- Microsoft authentication, magic link, MFA
- New business logic
- New Venture domain entities
- Company Registry or a second Workspace entity
- Filling `apps/web/src/api/*`
- Restoring desk `loading.tsx` files
- IDS token hex / climate / breakpoint redesign
- Server-persisted appearance preference
- Blueprint `data-appearance` / `data-venture` migration

---

## 14. Deliverables

| Deliverable | Owner | Target path | Dependency | Validation | Rollback |
|---|---|---|---|---|---|
| This plan (done at planning) | Cursor | `docs/frontend/VENTUREOS_FRONTEND_SPRINT_0_PLAN.md` | Blueprint v1.1.1 | Review | Revert docs commit |
| Preservation sign-off | Cursor | Amend Discovery or a short addendum under `docs/frontend/` | This inventory | Founder/Cursor sign | Revert docs |
| `CODEOWNERS` + Sprint 0 allow-list | Cursor | repo root / `.github` | Boundaries | PR rejects protected paths | Revert file |
| Font recovery | Cursor | `apps/web/src/app/fonts/` or layout fix | Missing binaries | `next build` | Restore previous layout |
| Token-only presentation test | Cursor | `apps/web/src/core/theme/` or `frontend-foundation/*.test.ts` | IDS consumption tests | `pnpm --filter web test` | Revert test |
| Foundation gallery | Lovable → Cursor | `apps/web/src/modules/frontend-foundation/` | IDS utilities, layout primitives | Visual + axe + both climates | Delete module / revert PR |
| Gallery route | Cursor | Thin `page.tsx` under Engineering or agreed path | Existing `(app)` layout | Shell stays mounted | Revert page |
| Primitive REFINE/CREATE set | Lovable + Cursor | `frontend-foundation/primitives/` then promote | §3.D | Gallery variants | Revert |
| Shell context **slot** (empty) | Cursor | `core/layout` + optional `os-shell.tsx` structure | Layout primitives | Continuity test | Revert slot |
| ErrorState / empty recipes | Lovable | `frontend-foundation/` | `EmptyCopy` | Gallery | Revert |
| Auth presentation polish | Lovable | listed auth screens only | Existing actions | Login still works | Revert screens |
| Theme/atmosphere proof | Shared | existing theme stack | IDS bind | §12 appearance + venture | Revert chrome only |

---

## 15. Completion gate (certification checklist)

Sprint 0 may be certified only when **all** are true:

- [ ] Foundation intact: Runtime, VIC, EIR, Capability, Definition, persistence, auth implementation, IDS tokens unchanged unless a named Cursor exception is recorded
- [ ] Protected paths untouched by Lovable
- [ ] No `app/loading.tsx` or `(app)/**/loading.tsx` restored
- [ ] Presentation consumes IDS (climate aliases / existing utilities); no presentation hex
- [ ] Executive Light and Executive Dark pass gallery + toggle (no reload, no climate forced by Venture)
- [ ] Venture atmosphere/brand: switch among available Ventures; shell remains VentureOS
- [ ] Shell foundation works; OsShell persists; skip link; command and notification **mounts** only
- [ ] Responsive foundation verified at 640 / 768 / 1024 / 1280
- [ ] Accessibility foundation: keyboard path, focus-visible, reduced-motion, labelled icon buttons
- [ ] No Supabase dependency or config
- [ ] No second backend or filled `src/api/*`
- [ ] No business logic in presentation; no client authorisation
- [ ] `pnpm --filter @repo/ids test` passes
- [ ] `pnpm --filter web check-types` passes
- [ ] `pnpm --filter web lint` passes
- [ ] `pnpm --filter web test` passes (including Foundation and auth tests)
- [ ] `pnpm --filter web build` passes
- [ ] Git diff reviewed; only Sprint 0 files; no unrelated dirty-tree files
- [ ] Rollback proven: `git revert` of the Sprint 0 merge (or equivalent) documented
- [ ] Documentation updated (`docs/frontend/` certification note)
- [ ] Preservation assessment signed: nothing deleted before it was inventoried

---

## 16. BCR review against Sprint 0

No BCR is implemented in Sprint 0. Classification:

| ID | Sprint 0 class | Reason |
|---|---|---|
| BCR-001 Shell DTO | **PARTIALLY RELEVANT** — **does not block** | `getShellSnapshot` already feeds OsShell. Sprint 0 keeps that wiring. Publishing a written DTO is useful but not required to ship a gallery. |
| BCR-002 VIC projections | **DEFER TO LATER SPRINT** | Product intelligence. |
| BCR-003 Found company | **DEFER TO LATER SPRINT** | Launch / HQ. |
| BCR-004 Founder decision | **DEFER TO LATER SPRINT** | Situation Room / HQ. |
| BCR-005 Auth presentation contract | **PARTIALLY RELEVANT** — **does not block** | Architecture resolved. Refresh/expiry copy is Sprint 1. Sprint 0 must not redesign auth. |
| BCR-006 Ask / Runtime | **DEFER TO LATER SPRINT** | Palette mount only. |
| BCR-007 Knowledge search | **DEFER TO LATER SPRINT** | |
| BCR-008 Notifications | **DEFER TO LATER SPRINT** | Chrome mount only. |
| BCR-009 Navigation pending | **PARTIALLY RELEVANT** — **does not block** | Continuity already enforced. Write the rule into Sprint 0 review: no desk `loading.tsx`; command-palette pulse is optional polish. |
| BCR-010 IDS host | **DOES NOT BLOCK SPRINT 0** | RESOLVED. Consume `packages/ids`. Token lint is a gate, not an open architecture question. |
| BCR-011 Error contract | **PARTIALLY RELEVANT** — **does not block** | `ErrorState` shows a string. Do not adopt `ApiResult` in Sprint 0. |
| BCR-012 Host / API | **DOES NOT BLOCK SPRINT 0** | RESOLVED. Stay in `apps/web`. |

**No BCR BLOCKS SPRINT 0** if Sprint 0 stays inside this plan.

---

## 17. Git strategy

### Current repository fact

`docs/frontend-integration-alignment` is the frontend **documentation** branch. The working tree has also contained **unrelated** uncommitted application work (auth/navigation/performance). Those files must **never** be staged into Sprint 0.

### Branches

| Branch | Role |
|---|---|
| `main` | Production / certified line. Sprint 0 does not merge here until certification. |
| `docs/frontend-integration-alignment` | Documentation only (this plan and prior frontend docs). |
| `feat/frontend-sprint-0` | Cursor implementation branch. **Created from a clean `origin/main`** (or a dedicated clean worktree), not from a dirty tree. |
| `feat/frontend-sprint-0-lovable` | Lovable presentation only. Branched from `feat/frontend-sprint-0`. PRs into the Cursor branch. |

Do **not** start Sprint 0 implementation on `docs/frontend-integration-alignment`. Do **not** start it on a worktree that still has unrelated auth/nav diffs.

### Review / merge path

```
Lovable commit → PR feat/frontend-sprint-0-lovable → feat/frontend-sprint-0
Cursor review + integration + gates
Cursor PR feat/frontend-sprint-0 → main
Certification, then merge. No force-push to main.
```

### Rollback

Git revert of the merge commit on `main`, or reset of the unmerged feature branch. Existing presentation remains in history until replacement is certified.

### Working-tree hygiene

Before creating `feat/frontend-sprint-0`:

1. `git status` — understand every dirty path.
2. Leave unrelated work on its own feature branch or stash **outside** the Sprint 0 worktree.
3. Prefer `git worktree add` from `origin/main` so Sprint 0 cannot accidentally add navigation/auth files.

GitHub remains the single source of truth. Lovable-generated files are not authoritative until Cursor merges them.

---

## 18. Risks

| Risk | Mitigation |
|---|---|
| Unrelated dirty files land in Sprint 0 | Clean worktree from `origin/main`; path-limited PRs |
| Lovable edits Runtime / auth / IDS | CODEOWNERS + review; staging directory |
| Desk `loading.tsx` restored | Continuity test; Protected Boundaries |
| Blueprint token names overwrite IDS | This plan’s mapping table; IDS wins |
| Missing Geist fonts break build | Cursor font recovery before Lovable brief if build is red |
| Brand validation gate implies IDS redesign | Deferred; fail-closed bind only |
| Context panel becomes a backend entity | Slot / `Inspector` only; no data |
| Second component library | KEEP/REFINE first; no shadcn default |
| Gallery becomes a product screen | Engineering/foundation route; no intelligence loaders |

---

## 19. How to brief Lovable (when implementation is authorised)

Give Lovable **only**:

1. This plan  
2. Protected Boundaries  
3. Integration Decision  
4. Blueprint v1.1.1 **presentation** sections that do not reopen Foundation (shell, appearance, a11y, motion)  
5. The allow-list in §4.1  

Do **not** ask Lovable to implement EIR, VIC, Runtime, persistence, or authentication.

Do **not** start that brief until the founder authorises Sprint 0 implementation. This document is planning only.

---

*End of VentureOS Sprint 0 Frontend Foundation Implementation Plan. No application code, IDS, authentication, or Runtime change is authorised by this document.*
