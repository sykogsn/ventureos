# VentureOS Lovable Integration Plan

**Document.** VentureOS Lovable → Cursor Frontend Integration Plan  
**Date.** 2026-08-24  
**Status.** DISCOVERY / PLANNING ONLY — not an implementation authorisation  
**Worktree.** `C:\Users\sykog\Projects\ventureos-frontend-integration`  
**Branch.** `feat/frontend-sprint-0`  
**VentureOS HEAD.** `7e7d927438b5b4bc5ac8909cfd8713d354ffff27` — `certify: complete Foundation v1.0 (F-001 to F-003)`  
**Workshop inspected.** `sykogsn/ventureos-frontend-workshop` `main` @ `4816526fa89320b1b5b2c233f475a9a88769f9c7` — `Widened desktop inspector width` (2026-08-23)  
**Governance.** The existing VentureOS Foundation wins wherever workshop implementation differs. Adapt approved Lovable presentation to VentureOS. Do not redesign Foundation.

This file is planning only. It does not authorise application-code changes.

The workshop was inspected from a sibling clone at `C:\Users\sykog\Projects\_ventureos-frontend-workshop-inspect`. That clone is **not** part of VentureOS. It must not be merged, vendored, or committed into this repository.

The original working directory `C:\Users\sykog\Projects\ventureos` was not used and must not be used for this programme.

---

## 1. Current clean-worktree confirmation

| Check | Result |
|---|---|
| Root | `C:/Users/sykog/Projects/ventureos-frontend-integration` |
| Branch | `feat/frontend-sprint-0` tracking `origin/main` |
| HEAD | `7e7d927438b5b4bc5ac8909cfd8713d354ffff27` |
| Message | `certify: complete Foundation v1.0 (F-001 to F-003)` |
| Working tree at plan start | Clean (no application diffs) |
| Host | Next.js 16.3 in `apps/web`, pnpm 9, Turbo |
| `docs/frontend/` at HEAD | Did not exist (this plan creates it) |

This worktree is the certified Foundation line. Later uncommitted work in the original directory is out of scope.

---

## 2. Workshop repository revision inspected

| Item | Value |
|---|---|
| Repository | `https://github.com/sykogsn/ventureos-frontend-workshop` (private) |
| Default branch | `main` |
| Inspected SHA | `4816526fa89320b1b5b2c233f475a9a88769f9c7` |
| Latest meaningful commits | `4816526` inspector width; `2412300` Sprint 1 Exec Workspace; `db83910` foundation shell |
| Host | TanStack Start + Vite 8 (`package.json` name `tanstack_start_ts`) |
| Self-declaration | `VENTUREOS_WORKSHOP_BOUNDARY.md`: **THIS REPOSITORY IS NOT VENTUREOS** |

Approved workshop content at this revision:

- Sprint 0 presentation foundation and visual refinement
- Foundation Gallery (`src/routes/foundation.tsx`)
- Shell presentation (`src/components/shell/*`)
- Executive Light / Dark preview (`.dark` + workshop context)
- Venture Brand Layer preview (`data-venture` + accent-only CSS)
- Presentation primitives (`src/components/presentation/*`)
- Sprint 1 Executive Workspace (`src/routes/index.tsx` + `executive-workspace-regions.tsx`)
- Judgement Inspector (Significance, Decision context, Recent changes, Evidence & trust, Uncertainty)
- Responsive / a11y / feedback-state presentation
- Table/data presentation (`data-table.tsx`)

Situation Room, Company HQ, Executive Office, Knowledge, and Reports workshop routes are **stubs** (`DestinationPlaceholder`). They are not product implementations.

---

## 3. Workshop inventory and classification

Classification key: **PORT DIRECTLY** · **ADAPT TO VENTUREOS** · **MAP TO EXISTING IDS** · **MAP TO EXISTING VENTUREOS COMPONENT** · **WORKSHOP-ONLY — DO NOT PORT** · **REJECT**

| Workshop item | Path | Class |
|---|---|---|
| Presentation Surface | `src/components/presentation/surface.tsx` | **ADAPT TO VENTUREOS** / **MAP TO EXISTING IDS** |
| Typography | `src/components/presentation/typography.tsx` | **ADAPT TO VENTUREOS** / **MAP TO EXISTING IDS** (`ids-*` / `vos-*` utilities) |
| Status indicator | `src/components/presentation/status-indicator.tsx` | **ADAPT TO VENTUREOS** / **MAP TO EXISTING IDS** (`ids-status-*`, `--danger` / `--warning` / `--success` / `--info`) |
| State block | `src/components/presentation/state-block.tsx` | **ADAPT TO VENTUREOS** |
| Signal / metric / confidence | `src/components/presentation/signal.tsx` | **ADAPT TO VENTUREOS** (presentation only; no scoring) |
| Region / Group / ItemList | `src/components/presentation/region.tsx` | **ADAPT TO VENTUREOS** / **MAP TO EXISTING VENTUREOS COMPONENT** (`Region` → layout `Stack` / `Dashboard`) |
| Data table | `src/components/presentation/data-table.tsx` | **ADAPT TO VENTUREOS** / **MAP TO EXISTING VENTUREOS COMPONENT** (`Ledger`) |
| App shell layout | `src/components/shell/app-shell.tsx` | **ADAPT TO VENTUREOS** / **MAP TO EXISTING VENTUREOS COMPONENT** (`OsShell`) |
| Top bar | `src/components/shell/top-bar.tsx` | **ADAPT TO VENTUREOS** / **MAP TO EXISTING VENTUREOS COMPONENT** (`top-nav.tsx`) |
| Primary nav | `src/components/shell/primary-nav.tsx` | **ADAPT TO VENTUREOS** / **MAP TO EXISTING VENTUREOS COMPONENT** (`sidebar.tsx` + `extensions/builtin.ts`) |
| Page | `src/components/shell/page.tsx` | **ADAPT TO VENTUREOS** / **MAP TO EXISTING VENTUREOS COMPONENT** (`page-frame.tsx`) |
| Context panel / Inspector dock | `src/components/shell/context-panel.tsx` | **ADAPT TO VENTUREOS** / **MAP TO EXISTING VENTUREOS COMPONENT** (layout `Inspector`; no global slot today) |
| Command palette chrome | `src/components/shell/command-palette.tsx` | **ADAPT TO VENTUREOS** / **MAP TO EXISTING VENTUREOS COMPONENT** (`command-palette.tsx` + `CommandRegion`) |
| Executive Workspace regions | `src/components/workspace/executive-workspace-regions.tsx` | **ADAPT TO VENTUREOS** — Sprint 1 only; replace fixtures |
| Foundation Gallery | `src/routes/foundation.tsx` | **ADAPT TO VENTUREOS** as a review surface, not as a Vite route |
| Compatibility CSS tokens | `src/styles.css` `:root` / `.dark` / `@theme inline` | **MAP TO EXISTING IDS** — do not copy token values |
| shadcn / Radix `src/components/ui/*` (46 files) | vendor | **REJECT** as a second design system. Replace with `@repo/ui` + layout primitives. Isolated overlay behaviour may be **ADAPT**ed later only if Cursor approves a single primitive |
| Workshop context | `src/workshop/workshop-context.tsx` | **WORKSHOP-ONLY — DO NOT PORT** |
| Inspector context | `src/workshop/inspector-context.tsx` | **WORKSHOP-ONLY — DO NOT PORT** |
| Workshop controls | `src/components/workshop/workshop-controls.tsx` | **WORKSHOP-ONLY — DO NOT PORT** |
| Fake `VENTURES` | workshop context | **REJECT** |
| Executive Workspace fixtures | `src/workshop/fixtures/executive-workspace.ts` | **WORKSHOP-ONLY — DO NOT PORT** |
| Workshop state selector on `/` | `src/routes/index.tsx` | **WORKSHOP-ONLY — DO NOT PORT** |
| Appearance / Venture preview toggle | workshop controls | **MAP TO EXISTING VENTUREOS COMPONENT** (`theme-toggle.tsx`, `venture-switcher.tsx`, `IdsBrandBinder`) |
| `data-venture` | `styles.css` + workshop context | **REJECT** as production attribute — map to `data-ids-brand` / `data-ids-atmosphere` |
| Google Fonts Geist | `__root.tsx` | **REJECT** — Cursor owns VentureOS fonts (`next/font/local`) |
| TanStack router / `routeTree.gen.ts` / `router.tsx` | host | **REJECT** |
| Vite / Lovable vite config / `bun.lock` | host | **REJECT** |
| `start.ts` / `server.ts` / Lovable error reporting | host | **REJECT** |
| Placeholder product routes | `situation-room.tsx` etc. | **WORKSHOP-ONLY — DO NOT PORT** |
| Sample User / disabled account menu | `top-bar.tsx` | **WORKSHOP-ONLY — DO NOT PORT** |
| `tw-animate-css` / shadcn animate-in | motion | **REJECT** — use IDS motion tokens |
| `components.json` | shadcn config | **REJECT** |

Presentation primitives do **not** import `src/components/ui/*`. That is useful: the portable layer is already separated from vendor chrome.

---

## 4. Production VentureOS inventory (this worktree)

Exact paths at `7e7d927`:

### Application host

| Concern | Path |
|---|---|
| App Router root | `apps/web/src/app/layout.tsx`, `page.tsx`, `providers.tsx`, `globals.css` |
| Authenticated desk | `apps/web/src/app/(app)/layout.tsx` → `OsShell` |
| Auth desk | `apps/web/src/app/(auth)/layout.tsx` → `ExecutiveAuthShell` |
| Request gate | `apps/web/src/proxy.ts` (no `middleware.ts`) |

### Shell and navigation

| Concern | Path |
|---|---|
| OS shell | `apps/web/src/core/shell/os-shell.tsx` |
| Sidebar | `apps/web/src/core/shell/sidebar.tsx` |
| Top navigation | `apps/web/src/core/shell/top-nav.tsx` |
| Page layout | `apps/web/src/core/shell/page-frame.tsx`, `page-header.tsx` |
| Command palette | `apps/web/src/core/shell/command-palette.tsx` |
| Notifications chrome | `apps/web/src/core/shell/notification-center.tsx` |
| Theme toggle | `apps/web/src/core/shell/theme-toggle.tsx` |
| Workspace switcher | `apps/web/src/core/shell/workspace-switcher.tsx` |
| Venture switcher | `apps/web/src/core/shell/venture-switcher.tsx` |
| Shell snapshot | `apps/web/src/core/shell/snapshot.ts` |
| Shell client state | `apps/web/src/core/context/shell-context.tsx` |
| Nav registry | `apps/web/src/extensions/builtin.ts` |

### Layout / Inspector

| Concern | Path |
|---|---|
| Layout primitives | `apps/web/src/core/layout/primitives.tsx` |
| Inspector (page-level) | `Inspector` — `lg:w-[var(--ids-foundation-layout-sidebar-lg)]` (17.5rem) |
| Desk split | `Desk` — `lg:grid-cols-[minmax(0,1fr)_var(--ids-foundation-layout-sidebar-lg)]` |
| Skip link | `SkipLink` → `#main-content` |
| Global context-panel slot in OsShell | **MISSING** |

### Primitives, type, theme, IDS

| Concern | Path |
|---|---|
| Button / Card | `packages/ui/src/button.tsx`, `card.tsx`, `cn.ts` |
| Typography utilities | `apps/web/src/app/globals.css` (`ids-*`, `vos-*`) |
| Theme | `apps/web/src/core/theme/theme-provider.tsx` (`next-themes`, `class`, `storageKey="theme"`) |
| Venture atmosphere | `apps/web/src/core/theme/ids-brand-binder.tsx` + `@repo/ids/themes/bind` |
| IDS tokens | `packages/ids/tokens/index.css`, `foundation.css`, `surfaces.css` |
| Climate aliases | `packages/ids/themes/climate.css` |
| Brand / atmosphere | `packages/ids/tokens/brand/*`, `tokens/atmosphere/*` |
| Breakpoints | `packages/ids/tokens/generated/breakpoints.css` — 640 / 768 / 1024 / 1280 |

### Loading, error, auth presentation

| Concern | Path |
|---|---|
| Loading | `apps/web/src/app/loading.tsx`, `(app)/loading.tsx`, several segment `loading.tsx`, `core/shell/executive-loading.tsx` |
| Empty | `core/shell/empty-copy.tsx`, `deferred-operating-screen.tsx` |
| Route `error.tsx` | **MISSING** at every level |
| Auth presentation | `modules/auth/screens.tsx`, `executive-auth-shell.tsx` |
| Auth implementation (protected) | `lib/auth/*`, `modules/auth/{actions,service,google-*}.ts`, `app/auth/google/` |

### Executive Workspace production target

There is **no** `/workspace` or `/executive-workspace` route.

| Product surface | URL | Module |
|---|---|---|
| Situation Room (portfolio desk) | `/dashboard` | `modules/situation-room/screens.tsx` |
| `/` | redirects to `/dashboard` | `app/page.tsx` |
| `/intelligence` | redirects to `/dashboard` | `app/(app)/intelligence/page.tsx` |
| Executive Office floor | `/agents` | `modules/executive-office/screens.tsx` |
| Executive desk | `/agents/[role]` | `modules/executive-office/office-screen.tsx` |
| Company HQ | `/ventures/hq/[slug]` | `modules/ventures/launch/venture-hq-screen.tsx` |

Workshop “Executive Workspace” is a **composed presentation** (judgement-first). Production currently serves Situation Room at `/dashboard`. Route and contract for a dedicated Executive Workspace surface are **CONTRACT REQUIRED** (Sprint 1). Do not invent `/workspace` in Sprint 0.

### Missing vs workshop (this worktree)

- `docs/frontend/` (created by this plan)
- `frontend-foundation` module
- Geist font binaries referenced by `app/layout.tsx`
- Any `error.tsx`
- Global Inspector slot in `OsShell`
- Token-only ESLint rule

---

## 5. Detailed mapping matrix

### 5.1 Surfaces and colour

| Workshop semantic | VentureOS IDS / climate | Rule |
|---|---|---|
| `--surface-primary` / `bg-surface-primary` | `--background` / `--workspace` | **MAP TO EXISTING IDS** |
| `--surface-secondary` | `--sidebar` / `--ids-foundation-surface-fill` | **MAP TO EXISTING IDS** |
| `--surface-elevated` | `--surface-elevated` / `ids-surface-elevated` | **MAP TO EXISTING IDS** |
| `--surface-sunken` | `--surface` | **MAP TO EXISTING IDS** |
| `--surface-selected` | `--surface-selected` | **MAP TO EXISTING IDS** |
| `--surface-interactive` | `--surface-hover` | **MAP TO EXISTING IDS** |
| `--text-primary` / `--text-secondary` / `--text-muted` / `--text-inverse` | same climate names | **MAP TO EXISTING IDS** |
| `--border-subtle` | `--border` / `--divider` | **MAP TO EXISTING IDS** |
| `--border-strong` | `--ids-foundation-color-border` (stronger use) | **MAP TO EXISTING IDS** |
| `--accent` / venture accent | `--accent` via brand CSS + `IdsBrandBinder` | **MAP TO EXISTING IDS** |
| `--status-critical` | `--danger` / `ids-status-risk` | **MAP TO EXISTING IDS** |
| `--status-high` | `--warning` / `ids-status-watch` | **MAP TO EXISTING IDS** |
| `--status-medium` | `--info` | **MAP TO EXISTING IDS** |
| `--status-positive` | `--success` / `ids-status-healthy` | **MAP TO EXISTING IDS** |
| `--status-neutral` | `--text-muted` / `ids-status-quiet` | **MAP TO EXISTING IDS** |
| `--focus-ring` | `--ring` | **MAP TO EXISTING IDS** |
| `--ease-executive` | `--ids-foundation-motion-ease-*` | **MAP TO EXISTING IDS** |
| `--shadow-elevation-*` | `--ids-foundation-shadow-*` / `--shadow-panel` | **MAP TO EXISTING IDS** |
| shadcn `--color-background` etc. | unused in production | **REJECT** |

Do **not** copy workshop hex or oklch values into `packages/ids`. If a visual gap remains after mapping, that is an IDS programme — not a frontend token fork.

### 5.2 Components

| Workshop | VentureOS | Rule |
|---|---|---|
| Presentation `Surface` | `ids-surface*` + layout `Panel` / `@repo/ui/card` | Refine wrappers; do not add a second Card kit |
| Presentation typography | `ids-display`, `ids-heading`, `ids-body`, `vos-*` | Adapt class names only |
| `status-indicator` | `ids-status-*` + existing pills | Adapt glyph+label pattern; keep IDS colours |
| `state-block` | no exact primitive; `EmptyCopy` / banners | Create thin presentation block on IDS surfaces |
| `Button` (shadcn) | `@repo/ui/button` + `vos-btn-*` | **KEEP VENTUREOS** |
| `Card` (shadcn) | `@repo/ui/card` | **KEEP VENTUREOS** |
| shadcn `Sheet` (mobile nav/inspector) | `NavigationRail` overlay + optional `OverlayPanel` | **KEEP VENTUREOS**; adapt behaviour, do not import Radix Sheet |
| shadcn `Command` | `CommandRegion` + existing palette | **KEEP VENTUREOS** |
| shadcn `Tooltip` | **MISSING** | **ADAPT** a minimal tooltip later if Sprint 0 needs it; do not import the full Radix set |
| App shell | `OsShell` | Visual refinement only; keep `getSession` / `getShellSnapshot` |
| Top bar | `top-nav.tsx` | Visual refinement; keep real switchers, theme, profile, logout |
| Primary nav | `sidebar.tsx` + `builtin.ts` | Visual refinement; keep extension registry |
| Page | `page-frame.tsx` | Visual refinement |
| Context panel | layout `Inspector` + optional OsShell slot | Cursor-owned composition |
| Appearance toggle | `theme-toggle.tsx` + `next-themes` | **KEEP VENTUREOS** |
| Venture switch | `venture-switcher.tsx` + Venture Registry + `IdsBrandBinder` | **KEEP VENTUREOS** |
| Workspace switch | `workspace-switcher.tsx` + Workspace Registry | Workshop has no equivalent — **KEEP VENTUREOS** |
| Foundation Gallery | new `modules/frontend-foundation/` + thin Engineering page **or** new route Cursor adds | Adapt demos to IDS classes |
| Executive Workspace UI | new presentation module in Sprint 1 | Awaits EIR/VIC / shell DTO — **CONTRACT REQUIRED** for live data |
| Judgement Inspector | compose layout `Inspector` | Presentation hierarchy ports; data is fixture until contracts exist |
| Sample intelligence | — | **REJECT** |

### 5.3 Attributes, fonts, widths

| Workshop | VentureOS | Rule |
|---|---|---|
| `.dark` class | `next-themes` `attribute="class"` | Compatible — **KEEP VENTUREOS** wiring |
| `data-venture` | `data-ids-brand` + `data-ids-atmosphere` | **KEEP VENTUREOS** |
| `localStorage` `workshop.appearance` | `storageKey="theme"` | **KEEP VENTUREOS** |
| `localStorage` `workshop.venture` | `vos_venture` cookie + shell snapshot | **KEEP VENTUREOS** |
| Google Fonts Geist | `next/font/local` GeistVF / GeistMonoVF (files **MISSING**) | Cursor font recovery; no Google Fonts |
| Inspector `w-[20rem]` / `2xl:w-[22rem]` | `--ids-foundation-layout-sidebar-lg: 17.5rem` | **KEEP VENTUREOS** token unless an approved IDS width change; presentation may use existing `panel-lg` (20rem) **only** if Cursor maps Inspector to that token — do not hard-code `w-[20rem]` |
| Nav `w-[14.5rem]` / `xl:w-[15.5rem]` | `--ids-foundation-layout-sidebar-sm/md` (13.75rem / 15rem) | **MAP TO EXISTING IDS** |
| Page `max-w-[86rem]` | `--ids-foundation-layout-measure-xl: 72rem` | **KEEP VENTUREOS** measure |
| Workshop `xl` inspector dock | IDS `xl` = 1280px | Compatible intent; implement with IDS breakpoints |

### 5.4 Absent mappings — CONTRACT REQUIRED

| Need | Why |
|---|---|
| Executive Workspace live DTO | Workshop fixtures are not EIR/VIC. Production Situation Room uses `projectSituationRoom`. A judgement-first DTO is not written down. |
| Executive Workspace route | Blueprint `/workspace` vs production `/dashboard`. Founder/Cursor must choose before Sprint 1 lands on a URL. |
| Inspector payload | Workshop `inspector-context` is fake. Production has no global inspector feed. |
| Shared error contract | No `error.tsx`; actions return `{ error?: string }`. |
| Brand-property store beyond accent | IDS brand files already hold accent. Mark/name come from venture records. Further Brand Layer fields are not a Sprint 0 blocker. |
| Notification feed | Chrome only. |

---

## 6. Conflicts

Default recommendation for every row: **KEEP VENTUREOS / ADAPT PRESENTATION**.

| Conflict | Workshop | VentureOS | Decision |
|---|---|---|---|
| Application host | Vite + TanStack Start | Next.js App Router + RSC | **KEEP VENTUREOS** |
| Routing | File routes `/`, `/foundation`, `/situation-room` | `(app)` / `(auth)` + existing URLs | **KEEP VENTUREOS** |
| Data boundary | Client fixtures | RSC loaders + Server Actions | **KEEP VENTUREOS** |
| Design tokens | Workshop CSS variables + hex/oklch | `packages/ids` + climate aliases | **KEEP VENTUREOS** |
| Brand attribute | `data-venture` | `data-ids-brand` / `data-ids-atmosphere` | **KEEP VENTUREOS** |
| Climate persistence | `workshop.appearance` | `next-themes` `theme` | **KEEP VENTUREOS** |
| UI kit | 46 shadcn/Radix components | `@repo/ui` (Button, Card) + layout primitives | **KEEP VENTUREOS** |
| Package policy | Radix, cmdk, vaul, recharts, react-hook-form, bun | pnpm workspace; web deps are jose, drizzle, next-themes, lucide | **KEEP VENTUREOS** — do not add the workshop dependency set |
| Fonts | Google Fonts | Self-hosted `next/font/local` | **KEEP VENTUREOS** |
| Auth | None (placeholders) | jose / `vos_session` / Google OAuth / `proxy.ts` | **KEEP VENTUREOS** |
| Shell data | Fake user / ventures | `getShellSnapshot` / `bootDesk` | **KEEP VENTUREOS** |
| Inspector width | 20rem / 22rem hardcoded | 17.5rem IDS token | **KEEP VENTUREOS** token; optional later IDS change is a separate approval |
| Loading | No Next `loading.tsx` | Certified `loading.tsx` files exist at this commit | **KEEP VENTUREOS** files; do not delete them to mimic the workshop |
| Intelligence | Sample £1.8m narrative | EIR / VIC only | **KEEP VENTUREOS** — no fixture intelligence in production |
| Motion library | `tw-animate-css` | IDS motion tokens + `globals.css` reduced-motion | **KEEP VENTUREOS** |
| Executive Workspace IA | Judgement-first composed page | Situation Room at `/dashboard` | Sprint 1: adapt presentation onto an agreed route; do not replace EIR ordering |

No conflict requires founder review to **start Sprint 0 integration**. Sprint 1 route choice (`/dashboard` refinement vs new `/workspace`) **does** require an explicit Cursor/founder call before product presentation lands.

---

## 7. Rejected workshop implementation (must never enter production)

- TanStack Router, `routeTree.gen.ts`, `router.tsx`, `src/routes/*` as routes
- Vite, `vite.config.ts`, `@lovable.dev/vite-tanstack-config`, `bun.lock`, `bunfig.toml`, Nitro
- `src/start.ts`, `src/server.ts`, `src/lib/lovable-error-reporting.ts`, `src/lib/error-capture.ts`, `src/lib/error-page.ts`
- `src/workshop/**` (context, inspector context, fixtures)
- `src/components/workshop/**`
- Fake `VENTURES` array and `workshop.*` localStorage keys
- `data-venture` as a production HTML attribute
- Workshop compatibility token **values** in `src/styles.css` (hex/oklch ramps, shadcn bridge)
- Google Fonts `<link>` workaround
- Entire `src/components/ui/**` shadcn tree and `components.json`
- Unnecessary Radix / cmdk / vaul / recharts / react-hook-form additions
- Sample intelligence (`SAMPLE_*`, invented exposure/breach copy)
- Workshop ready/loading/empty **state selector** as product UI
- Disabled “Sample User” account menu
- Placeholder Situation Room / HQ / Office / Knowledge / Reports pages
- `tw-animate-css` as a new motion system
- Hard-coded `w-[20rem]` / `w-[22rem]` inspector widths
- Duplicate Button/Card/Sidebar kits beside `@repo/ui` and `OsShell`

---

## 8. Sprint 0 integration scope

**Goal.** Land approved **foundation presentation** on the certified Next.js host, consuming IDS, without product intelligence.

In scope:

1. Documented IDS semantic mapping (this plan) applied as class/token replacements — not new IDS ramps.
2. Cursor font recovery for referenced Geist files (or approved self-hosted substitute).
3. Presentation wrappers in a new `apps/web/src/modules/frontend-foundation/` (Surface/typography/status/state recipes) using IDS utilities.
4. Visual refinement of existing shell chrome (`os-shell`, `sidebar`, `top-nav`, `page-frame`) — structure and wiring stay Cursor-owned.
5. Optional reserved Inspector **slot** in layout/OsShell: empty, no feed, no EIR.
6. Foundation Gallery as a thin authenticated page (prefer Engineering HQ / a Cursor-added review route). Fixtures for **component** demos only.
7. Feedback presentation: empty / region loading / error **block** using existing `EmptyCopy` / `ExecutiveLoading` and a new `ErrorState` that displays a string.
8. Responsive and a11y refinements that use existing IDS breakpoints and `SkipLink` / focus-visible / reduced-motion.
9. Token-only test for new presentation globs.

Out of scope for Sprint 0:

- Executive Workspace product page
- Judgement Inspector live content
- Situation Room / HQ / Office rebuilds
- Auth redesign
- Deleting certified `loading.tsx` files
- Adding Radix/shadcn packages
- Changing `packages/ids` token hex or bind API
- New routes that replace `/dashboard`

---

## 9. Sprint 1 integration scope

**Gate.** Sprint 0 certified first.

In scope after that:

1. Port Executive Workspace **composition** (judgement-first hierarchy, Inspector sections) as presentation over **agreed** production route.
2. Wire Inspector to Cursor-owned slot; no workshop `inspector-context`.
3. Replace fixtures with projections or explicit **CONTRACT REQUIRED** placeholders that do not look like EIR output (no invented £ figures in production).
4. Preserve real workspace/venture/auth/theme.

Out of scope until later sprints: Situation Room rebuild, Company HQ rebuild, Knowledge search, Ask AI, notification backend.

---

## 10. Port order

Verified against this worktree. Do not invert.

### Sprint 0

1. IDS semantic mapping applied as a consumption checklist (no IDS rewrite)
2. Font resolution (Cursor)
3. Reusable presentation wrappers on IDS / `@repo/ui` / layout primitives
4. Shell visual refinement (`OsShell` chrome only)
5. Responsive / a11y behaviour on shell + gallery
6. Feedback states (empty / skeleton / error block)
7. Foundation Gallery
8. Certification

### Sprint 1 (after Sprint 0 certification)

9. Inspector slot composition (still presentation)
10. Executive Workspace presentation (no fixture intelligence)
11. Real data / loader wiring (Cursor) — blocked where contracts are missing
12. Sprint 1 certification

---

## 11. Cursor-owned integration work

- All RSC loaders and Server Actions
- `getSession`, `getShellSnapshot`, `bootDesk`
- `IdsBrandBinder`, `theme-provider`, IDS generate / `ids-dev-guard`
- Auth implementation and `proxy.ts`
- Route decisions and `page.tsx` loader calls
- CODEOWNERS / PR allow-list
- Font recovery
- Mapping workshop classes → IDS utilities
- Rejecting workshop host/vendor files
- Quality gates and certification
- Optional Inspector slot in `OsShell` / layout primitives

---

## 12. Lovable presentation authority

Lovable remains authoritative for **approved visual intent**:

- Information hierarchy of Executive Workspace (Sprint 1)
- Judgement Inspector section order
- Foundation Gallery coverage
- Surface/status/typography **behaviour** (quiet, calm, colour + label)
- Responsive shell intent (rail overlay, inspector sheet below `xl`)
- Executive Light / Dark **look**, expressed through IDS
- Venture accent-only Brand Layer **look**, expressed through existing brand/atmosphere

Lovable is **not** authoritative for tokens, routes, session, registries, Runtime, or packages.

---

## 13. Remaining contracts

| Item | Blocks |
|---|---|
| Written shell DTO (existing `getShellSnapshot` unpublished) | Does **not** block Sprint 0 if current wiring is preserved |
| Error machine-code contract | Does **not** block Sprint 0 (`ErrorState` may show a string) |
| VIC / EIR judgement-first DTO | **Blocks Sprint 1 live data** |
| Executive Workspace URL decision | **Blocks Sprint 1 route landing** |
| Inspector feed contract | **Blocks Sprint 1 live inspector** |
| Notification API | Later sprint |
| Brand Layer fields beyond IDS accent + venture record | Not a Sprint 0 blocker |

---

## 14. Risks

| Risk | Mitigation |
|---|---|
| Wholesale copy of workshop host | Explicit reject list; no Vite/TanStack in `apps/web` |
| Workshop tokens become a second IDS | Map only; do not paste `styles.css` into `globals.css` |
| Radix/shadcn package creep | Do not add workshop `package.json` dependencies |
| Fixture intelligence ships | SampleTag / `SAMPLE_*` never enter production modules |
| `data-venture` overwrites IDS bind | Keep `IdsBrandBinder` only |
| Inspector width hardcoded | Use IDS width tokens |
| Dirty original worktree contamination | Stay in this worktree only |
| Deleting certified `loading.tsx` | Out of Sprint 0 scope |
| Font files missing | Cursor recovery before gallery certification |
| Sprint 1 starts before Sprint 0 cert | Hard gate in §9–10 |

---

## 15. Quality gates (actual commands)

From this worktree’s `package.json` files:

| Gate | Command |
|---|---|
| Types | `pnpm check-types` or `pnpm --filter web check-types` |
| Lint | `pnpm lint` or `pnpm --filter web lint` |
| Web tests (Foundation, auth, IDS consumption, layout) | `pnpm --filter web test` |
| IDS generate + tests | `pnpm --filter @repo/ids test` |
| IDS generate | `pnpm --filter @repo/ids generate` |
| Build | `pnpm --filter web build` (runs `ids-dev-guard.ts --build`) |
| Doctor | `pnpm doctor` |
| Format (optional) | `pnpm format` |

Manual / regression (no new invented CI script names):

- Executive Light / Dark via existing theme toggle — no reload, no Venture-forced climate
- Venture atmosphere via existing switcher — `data-ids-brand` / `data-ids-atmosphere` only
- Auth smoke: login / logout / Google routes untouched
- Navigation: `(app)` routes still load through `OsShell`
- Runtime / EIR / VIC: no edits; existing tests stay green
- Responsive: 640 / 768 / 1024 / 1280
- Keyboard: skip link, rail, theme, profile, gallery
- Hydration / console: `pnpm --filter web recover-dev` then exercise gallery + dashboard
- No presentation hex in new files

---

## 16. Rollback strategy

- One logical PR per integration slice on `feat/frontend-sprint-0`
- Revert the merge commit if certification fails
- Do not delete existing Situation Room / shell files until a replacement is certified
- Workshop clone remains outside this repo; deleting it does not affect VentureOS
- Never merge `ventureos-frontend-workshop` git history into `sykogsn/ventureos`

---

## 17. Recommended next implementation step

**Implement Sprint 0 integration only**, in this worktree, in this order:

1. Cursor: restore or replace missing Geist font files so `app/layout.tsx` does not reference absent binaries.
2. Cursor: add `apps/web/src/modules/frontend-foundation/` presentation wrappers that consume **existing** IDS utilities (no workshop `styles.css` copy).
3. Cursor: add a Foundation Gallery thin page that demonstrates those wrappers in both climates.
4. Then, and only then, apply **minimal** visual refinement to existing `OsShell` chrome.

Do not start Executive Workspace product integration.

Do not copy the workshop repository into `apps/web`.

---

*End of plan. No application code is authorised by this document.*
