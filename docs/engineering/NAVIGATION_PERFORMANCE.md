# Foundation UX and navigation performance

**Purpose.** Record the Foundation UX and Performance Optimisation phase. No new product features were added.  
**Date.** 2026-08-22  
**Desk.** `http://localhost:3000` on Next.js 16.3.0 (Turbopack, development)  
**Branch.** `feat/vc-012-company-workspace-boot`

This is not a VC-013 open. It is not a VC-012 certification. FAT-001 remains open until the founder walks the live desk.

---

## 1. Navigation performance before optimisation

The authenticated desk did not preserve its shell.

`app/loading.tsx` wrapped the `(app)` layout. `(app)/layout.tsx` is async (`getSession` + `getShellSnapshot` / `bootDesk`). On every client navigation that layout suspends. Next.js then showed the **root** loading fallback — `ExecutiveLoading` (“Opening VentureOS...”) inside a fresh `Workspace`. That **unmounted `OsShell`**. Sidebar, header, workspace selector, company selector, and primary navigation all disappeared and remounted.

Each product route also registered its own `loading.tsx` with a full-page `ExecutiveLoading` canvas (“Synchronising Executive Workspace...”, “Preparing Executive Intelligence...”, “Loading Company Context...”). Even when those only replaced `children`, the visual was a workspace reload.

The same request also did the work twice:

| Call | Layout | Page | Company HQ |
|---|---|---|---|
| `getSession` | yes | yes | yes |
| `bootDesk` | yes (via `getShellSnapshot`) | yes (via `loadActiveIntelligence`) | yes |
| `executeIntelligenceRuntime` | no | yes | **twice** (`loadActiveIntelligence` and `getFoundedCompanyBySlug`) |

`react.cache()` was not applied. React also received a new `user` object and new `workspaces` / `ventures` arrays on every layout render, so chrome re-rendered even when the catalogue had not changed.

Before numbers that can be stated as fact:

- **Shell remount rate:** 100% of client navigations inside the desk.
- **Full-page skeleton:** shown on every one of those navigations.
- **Uncached Intelligence Runtime read** (in-memory SQLite, `navigation-cost` test): first `executeIntelligenceRuntime` **34.9ms**, second **24.5ms**, duplicate HQ path **59.4ms**.
- A warm in-browser click average was not captured before the loaders were removed. The founder-visible defect was the remount, not a missing millisecond log.

---

## 2. Navigation performance after optimisation

The shell is persistent. Root and `(app)` `loading.tsx` files are gone. Previous page content stays visible. A thin `OverlayPulse` shows only after an in-app link click. Auth still uses a one-line `ContentLoading` indicator, not a workspace canvas.

Per request, session, desk boot, and read-only intelligence now share one `react.cache()` identity. Company HQ reads the same cached core as the page. Mutations still call uncached `executeIntelligenceRuntime`.

Regression locks: `src/core/shell/navigation-continuity.test.ts`.

Measured on the running desk at `http://localhost:3000` with an authenticated document GET (hard navigation, development, already compiled). Shell HTML stayed present (`primary-navigation`, toolbar). “Opening VentureOS” was absent.

| Route | Warm document time |
|---|---|
| `/dashboard` | 242ms |
| `/ventures` | 446ms |
| `/agents` | 723ms |
| `/brain` | 277ms |
| `/engineering` | 651ms |
| `/settings` | 760ms |
| **Mean of those six** | **517ms** |

A later averaged pass collided with the live `next dev` process (Brain 2979ms, Engineering 3738ms). Those spikes are development contention and first-compile cost, not the post-optimise architecture.

Client-side navigation is not a full document GET. The browser keeps `OsShell` mounted and waits only for the RSC flight. Perceived time is therefore the server work **without** a shell remount or a full-page skeleton. In-browser click timing was not completed here: password entry into the automated browser was skipped.

Gates after the change: `pnpm --filter web lint`, `pnpm --filter web check-types`, `pnpm --filter web test` — **231 passed**.

---

## 3. The three biggest performance bottlenecks

1. **Root loading fallback above the authenticated layout.** `app/loading.tsx` sat outside `OsShell`. Any suspend of `(app)/layout.tsx` replaced the whole workspace. This was the cause of the “every click reloads the desk” feel.

2. **Duplicate session, boot, and Runtime work on one navigation.** Layout and page each opened the session and the desk. Company HQ ran the Executive Intelligence Runtime twice. That doubled persistence and pipeline cost on the heaviest route.

3. **Chrome re-render on every layout payload.** `OsShell` passed a new `user` literal and newly mapped catalogue arrays into `ShellProvider` on every request. Context identity changed even when names, slugs, and ids did not, so sidebar, header, and switchers re-rendered with the page.

---

## 4. What changed for each bottleneck

### 1. Persistent shell

- Deleted `apps/web/src/app/loading.tsx` and every `(app)/**/loading.tsx`.
- Slimmed `(auth)/loading.tsx` to `ContentLoading`.
- Mounted `NavigationProgress` in `OsShell` so pending navigation is a top `OverlayPulse`, not a canvas.
- Added `OverlayPulse` next to `Pulse` in Workspace Layout primitives (no new product surface).
- `product-layout.test.ts` now treats `content-loading.tsx` and `navigation-progress.tsx` as chrome, not `app/loading.tsx`.

### 2. One read per request

- `getSession` — `cache()` in `apps/web/src/lib/auth/session.ts`.
- `bootDesk` — `cache()` in `apps/web/src/modules/intelligence/boot.ts`.
- `loadVentureIntelligence` — `cache()` in `apps/web/src/modules/intelligence/service.ts`.
- `loadActiveIntelligence` and `loadVentureScopedIntelligence` call `loadVentureIntelligence` instead of a second `executeIntelligenceRuntime`.
- `getFoundedCompanyBySlug` already used `loadVentureIntelligence`, so HQ now shares that cache.

`unstable_cache` was not used for boot. A cached catalogue across requests would go stale after founding a workspace or company.

### 3. Stable chrome

- `ShellProvider` keeps `user`, `workspaces`, and `ventures` by value equality (`useStableValue`).
- `Sidebar`, `TopNav`, and `CommandPalette` are `memo`’d so a page child update does not redraw the rail and toolbar when context is unchanged.

Runtime, Capability Registry, Definition Registry, persistence ownership, and the three rooms were not redesigned.

---

## 5. Remaining performance and UX concerns

- Every client navigation still re-runs the dynamic `(app)` layout on the server. Cookies make the tree dynamic. Boot is deduped **inside** a request, not across navigations. That is correct after a company switch; it is still work.
- Development first-compile of a route remains hundreds of milliseconds to several seconds. That is Turbopack, not the shell bug.
- Situation Room, Agents, and Company HQ still run the Intelligence Runtime once per visit. That is the product read, not a duplicate.
- `NavigationProgress` listens for in-app `<a>` clicks. Command palette and other non-link navigations do not show the pulse. The shell still stays mounted.
- The first authenticated paint has no root skeleton. The founder waits on the existing document until `OsShell` arrives. That is preferred to unmounting a live desk; it is a colder first look than Linear’s cached chrome.
- Hard document GETs in development still sit in the 240–760ms band when the graph is warm. That is not yet Notion-instant. A production `next start` build was not the measurement environment.
- Settings, Agents, and Engineering HQ are the slower rooms in the warm pass. They were not given a second architecture pass in this phase.
- A local measurement account `nav-perf-20260822@ventureos.test` was created in `apps/web/data/ventureos.db`. It is not a product user. Delete it from the desk if it should not remain.
- Google OAuth still needs `apps/web/.env.local` (`AUTH_URL=http://localhost:3000`, client id/secret). That is unchanged FAT-001 defect 1.
- FAT-001 is still **Failed 2026-08-22** until the founder repeats the script on the live desk.
- VC-013 and VC-020 stay closed.

---

## Verification

| Gate | Result |
|---|---|
| Lint | `pnpm --filter web lint` passed |
| Types | `pnpm --filter web check-types` passed |
| Tests | `pnpm --filter web test` — 231 passed, including navigation continuity and navigation-cost |
| Running desk | `http://localhost:3000` served Situation Room HTML with sidebar and toolbar and without “Opening VentureOS” |
| Build | `pnpm --filter web build` passed. Compile 111s; TypeScript 11.9min while `next dev` still held `.next`; 41 pages generated. |
