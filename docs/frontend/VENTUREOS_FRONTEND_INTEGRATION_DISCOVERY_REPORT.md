# VentureOS Frontend Integration Discovery Report

**Document:** VentureOS Frontend Integration Discovery Report  
**Date:** 2026-08-23  
**Status:** Completed  
**Purpose:** Read-only architectural discovery performed before the VentureOS frontend replacement programme.

**Nature.** Read-only inspection of the repository as it existed on 2026-08-23. No application files were modified during discovery.  
**Supreme law.** [`docs/PROJECT_CONSTITUTION.md`](../PROJECT_CONSTITUTION.md). Foundation ownership: [`apps/web/src/FOUNDATION.md`](../../apps/web/src/FOUNDATION.md).  
**Blueprint at discovery time.** [`docs/frontend/VENTUREOS_FRONTEND_MASTER_BLUEPRINT.md`](./VENTUREOS_FRONTEND_MASTER_BLUEPRINT.md) was then a **scaffold** (Version Unset). This report was written against that scaffold. The scaffold has since been replaced by Blueprint v1.1; findings below are not rewritten.

This is **not** a rebuild of VentureOS. The Foundation stays. Lovable may eventually own presentation. Cursor remains responsible for architecture, Runtime, backend, intelligence, and integration.

---

## 1. Repository Architecture Map

VentureOS is a **pnpm + Turbo monorepo**. There is **one application**: Next.js 16.3 in `apps/web`. There is **no separate backend process**, **no `app/api` HTTP API**, and **no Supabase**. Domain logic runs in-process on the Next.js server.

```
ventureos/
├── apps/web/                 Sole product application (Next.js desk)
├── packages/ids/             IntelligenceOS Design System (@repo/ids)
├── packages/ui/              Thin shared React helpers (@repo/ui)
├── packages/brain/           KnowledgeObject kernel — NOT a web dependency
├── packages/eslint-config/
├── packages/typescript-config/
└── docs/                     Constitutions, Foundation Library, engineering
```

| Area | Actual location | Responsibility |
|---|---|---|
| Frontend application | `apps/web` | The desk. App Router pages, OsShell, feature screens |
| Backend | Same process as `apps/web` | Server Components, server actions, `src/platform` |
| APIs | `apps/web/src/api/*` | **Empty unused barrels.** Not a live HTTP layer |
| HTTP routes that exist | `apps/web/src/app/auth/google/route.ts`, `.../callback/route.ts` | Google OAuth only |
| Services | `apps/web/src/modules/*/service.ts` | Auth, workspaces, ventures, intelligence |
| Runtime / EIR | `apps/web/src/core/runtime/` — `runExecutiveIntelligenceRuntime` in `pipeline.ts`; `RUNTIME_PIPELINE` in `contract.ts` | Sole orchestrator. Only production caller: `modules/intelligence/service.ts` |
| VIC | `apps/web/src/core/venture/types.ts` — `VentureIntelligenceCore` | Intelligence snapshot. Persisted via intelligence service + SQLite |
| Capability Framework | `apps/web/src/core/capability/` | Catalogue and governance. Does not execute engines |
| Venture definitions | `apps/web/src/core/venture-definition/` | Only product-definition system. Instantiation in `instantiation.ts` |
| Venture instances | `apps/web/src/core/venture-registry/` + `modules/ventures/service.ts` + persistence `ventures` table | Companies in a workspace, carrying Definition Registry refs |
| Knowledge | Three layers: Runtime `core/knowledge-graph/`; live catalogue `platform/brain/`; unused package `packages/brain/` | UI Brain module reads the platform catalogue |
| Authentication | `lib/auth/*`, `modules/auth/*`, `src/proxy.ts` | Custom jose JWT + SQLite sessions. Not NextAuth. Not Supabase |
| Supabase | **Absent.** Zero matches for `supabase` / `@supabase` | Persistence is **libSQL/SQLite** (`file:./data/ventureos.db`, override `DATABASE_URL`) |
| Shared types | `apps/web/src/contracts/` | Branded IDs, permissions, commands, events, extensions |
| Configuration | `apps/web/next.config.js`, `turbo.json`, `pnpm-workspace.yaml`, Tailwind v4 via `postcss.config.mjs` + `globals.css` (no `tailwind.config.*`) | — |
| Tests | Co-located `*.test.ts`; `pnpm --filter web test` is an explicit file list | Runtime, registries, auth, boot, persistence, layout |
| Build | `pnpm build` → Turbo → `next build` | — |
| Deployment | **No** `.github/`, `vercel.json`, Dockerfile, or Railway config | Local `pnpm dev` on port 3000 |
| Design system | `packages/ids` | Certified tokens, Executive Light/Dark climate, product atmospheres |

**Architectural fact that governs Lovable.** Pages and the shell are presentational. The intelligence service is the only Runtime adapter that persists mutation snapshots. Repositories do CRUD only. Navigation does not import Runtime.

---

## 2. Existing Frontend Inventory

### Routes (App Router)

Auth: `/login`, `/signup`, `/forgot-password`, `/forgot-password/sent`, `/reset-password`.  
Desk: `/dashboard` (Situation Room), `/settings`, `/agents`, `/agents/[role]`, `/brain` and Brain children, `/engineering` and Engineering HQ children, `/ventures`, `/ventures/launch`, `/ventures/hq/[slug]`, `/ventures/[ventureId]` plus agents/documents/finance/crm.  
`/` redirects to `/dashboard`. `/intelligence` redirects to `/dashboard`.

Layouts: root `app/layout.tsx`; authenticated `app/(app)/layout.tsx` (OsShell); `app/(auth)/layout.tsx`; company-scoped `app/(app)/ventures/[ventureId]/layout.tsx`.

**Loading.** After the navigation pass, the only remaining `loading.tsx` is `app/(auth)/loading.tsx`. Authenticated routes have no full-page loaders. Pending in-app clicks use `NavigationProgress` / `OverlayPulse`.

**Errors.** `app/not-found.tsx` and `app/(app)/not-found.tsx`. **No `error.tsx` anywhere.**

### Shell and chrome

`core/shell/os-shell.tsx` (Sidebar, TopNav, workspace/venture switchers, command palette, profile, notifications, theme toggle). Hydrated by `getShellSnapshot` in `(app)/layout.tsx`.

### Screens (presentation modules)

Situation Room, Executive Office, Ventures list/HQ/launch wizard, Brain, Settings, Engineering HQ, auth screens, deferred CRM/Documents/Finance placeholders.

### Theme and tokens

IDS `packages/ids` (foundation + climate + brand/atmosphere CSS). App bridge: `core/theme/theme-provider.tsx` (next-themes, `storageKey="theme"`, `defaultTheme="system"`), `ids-brand-binder.tsx`, `theme-toggle.tsx`, `settings/appearance.tsx`.

### Classification of important frontend areas

| Area | Class | Why |
|---|---|---|
| `packages/ids` tokens, generate pipeline, climate/atmosphere | **PROTECT** | Certified design system. Lovable must consume, not fork hex or invent Midnight/Slate climates |
| `core/layout` primitives + manifest | **PROTECT** (API) / **REFACTOR** (visual skin) | Layout law is Foundation. A new look can restyle through tokens, not replace the primitive contract without approval |
| OsShell, sidebar, top-nav, switchers | **REPLACE** visually / **PROTECT** wiring | Chrome may be redesigned. `snapshot.ts`, cookies, `VentureRouteSync`, and server actions must stay Cursor-owned |
| Route `page.tsx` files | **KEEP** as thin RSC shells or **REPLACE** only the imported screen | Pages must keep calling existing loaders; they must not import Runtime |
| Situation Room / Executive Office / HQ / launch / Brain / Settings / auth screens | **REPLACE** | These are the presentation Lovable is for |
| CRM / Documents / Finance screens | **KEEP** as deferred placeholders until those programmes exist | Not a frontend rebuild target |
| Engineering HQ screens | **REPLACE** UI / **PROTECT** `records/` and `intelligence/` parsers | Those folders read `docs/engineering`, not a second store |
| `ExecutiveLoading` / `ContentLoading` / `OverlayPulse` | **REFACTOR** | Visual language can change; do not restore root `app/loading.tsx` above OsShell |
| `error.tsx` | **REPLACE** (add) | Missing. Presentation concern. Must not swallow auth/schema errors |
| `packages/ui` button/card | **REPLACE** or absorb | Thin helpers, not the system |
| `src/extensions/builtin.ts` | **REFACTOR** | Nav contributions are presentation. Registry types in `contracts/extensions.ts` are **PROTECT** |
| Runtime, VIC model, capability, definitions, persistence, auth service, proxy | **PROTECT** | Not frontend |

---

## 3. Protected Architecture Map

Lovable must not modify these paths without explicit architectural approval. Every path below **exists**.

### Runtime / EIR
- `apps/web/src/core/runtime/`
- `apps/web/src/FOUNDATION.md` (ownership law)

### VIC and intelligence engines
- `apps/web/src/core/venture/`
- `apps/web/src/core/policy/`, `recommendation/`, `decision-engine/`, `executive-memory/`, `operating-health/`, `knowledge-graph/`, `company-story/`, `mission-engine/`, `risk-intelligence/`, `document-intelligence/`, `executive-office/`, `venture-genome/`, `identity/`
- `apps/web/src/modules/intelligence/service.ts`
- `apps/web/src/modules/intelligence/boot.ts`
- `apps/web/src/modules/intelligence/governance.ts`
- `apps/web/src/modules/intelligence/request.ts` (until an approved adapter wraps it)

### Capability Framework
- `apps/web/src/core/capability/`

### Venture Definition and Instance Frameworks
- `apps/web/src/core/venture-definition/`
- `apps/web/src/core/venture-registry/`
- `apps/web/src/core/workspace-registry/`
- `apps/web/src/modules/ventures/service.ts`
- `apps/web/src/modules/ventures/select.ts`
- `apps/web/src/modules/ventures/launch/artefacts.ts`, `bootstrap.ts`, `validation.ts` (instantiation path)

### Knowledge
- `apps/web/src/platform/brain/`
- `apps/web/src/core/knowledge-graph/`
- `packages/brain/` (kernel; unused by web today)

### Persistence, security, permissions
- `apps/web/src/platform/persistence/`
- `apps/web/src/platform/permissions/`
- `apps/web/src/platform/kernel.ts`, `bootstrap.ts`, `events/`, `audit/`
- `apps/web/data/` (local SQLite). Do not treat as a frontend database.
- `apps/web/src/lib/auth/`
- `apps/web/src/modules/auth/service.ts`, `google-oauth.ts`, `google-account.ts`, `password-reset.ts`, `actions.ts`
- `apps/web/src/proxy.ts`
- `apps/web/src/app/auth/google/`

### Contracts and platform IDs
- `apps/web/src/contracts/`
- `apps/web/src/platform/ids.ts`

### IDS constitution (presentation tokens, not product UI)
- `packages/ids/tokens/`
- `packages/ids/themes/bind.ts`

### Constitutions
- `docs/PROJECT_CONSTITUTION.md`
- `docs/architecture/VENTUREOS_PLATFORM_CONSTITUTION.md`
- `docs/engineering/MASTER_ENGINEERING_PROMPT.md`
- Locked `docs/foundation/` and `docs/foundation-library/`

**There is no migration folder.** Schema is created by `ensureSchema()` in `platform/persistence/db.ts`. Lovable must not add Drizzle/Supabase migrations.

---

## 4. Frontend ↔ Backend Interface Inventory

There is **no REST/GraphQL surface** for the desk. The live boundary is **RSC loaders + Next server actions + two OAuth route handlers**.

| Interface | Location | Purpose | Consumer | Owner | Lovable consume directly? | Adapter? | Fate |
|---|---|---|---|---|---|---|---|
| `getSession` | `lib/auth/session.ts` | Resolve jose session | Layouts, loaders, actions | Cursor / auth | No (server + cookies) | Yes, if Lovable is a separate origin | Preserve |
| `getShellSnapshot` / `bootDesk` | `core/shell/snapshot.ts`, `modules/intelligence/boot.ts` | Workspace/company catalogue for chrome | `(app)/layout.tsx`, settings, ventures list | Cursor / desk boot | No | Yes — shell DTO | Preserve |
| `loadActiveIntelligence` | `modules/intelligence/request.ts` | VIC read for active desk | dashboard, agents, HQ | Cursor / intelligence | No | Yes — read model DTO | Preserve |
| `loadVentureScopedIntelligence` | same | VIC read pinned to route company | venture-scoped agent pages | Cursor | No | Yes | Preserve |
| `getFoundedCompanyBySlug` | `modules/intelligence/service.ts` | HQ artefact | HQ page | Cursor | No | Yes | Preserve |
| `signupAction` / `loginAction` / logout / password reset | `modules/auth/actions.ts` | Auth mutations | Auth screens, profile, settings | Cursor | Only if remaining on Next same-origin | Required if SPA elsewhere | Preserve |
| `createWorkspaceAction` / `selectWorkspaceAction` | `modules/workspaces/actions.ts` | Workspace create/switch | Switcher, create form | Cursor | Same | Yes | Preserve |
| `selectVentureAction` | `modules/ventures/actions.ts` | Company switch cookie | Venture switcher | Cursor | Same | Yes | Preserve |
| `foundCompanyAction` | `modules/intelligence/actions.ts` | Found company through Runtime | Launch wizard | Cursor | No | Yes | Preserve |
| `recordFounderDecisionAction` | same | Founder ruling through Runtime | Situation Room, HQ cards | Cursor | No | Yes | Preserve |
| Google `GET` routes | `app/auth/google/*` | OAuth | Auth screens | Cursor | No | Keep as redirects | Preserve |
| `useShell` | `core/context/shell-context.tsx` | Client chrome state | Shell widgets | Presentation, hydrated by RSC | Visual only | — | Refactor with new chrome |
| `useCommandExecutor` | `core/commands/use-command-executor.ts` | Nav + theme, no domain | Command palette | Presentation | Yes for UX | — | Replace with new palette |
| `src/api/*` | empty `as const` objects | Unused facades | **Nobody** | Future extension | **Not a contract** | Must be designed, not filled ad hoc | Do not treat as API |
| Supabase client | — | — | — | — | — | — | **Does not exist** |
| Realtime / RPC | `platform/events/bus.ts` in-process only | Kernel subscribe | Not the browser | Cursor | No | BCR if UI needs live push | Preserve as backend |

**Authoritative error shapes today:** action `{ error?: string }`. Not a shared error contract.

---

## 5. EIR Interface Inventory

**How the frontend reaches EIR today**

The UI **does not** call `runExecutiveIntelligenceRuntime`.

Read path: page → `loadActiveIntelligence` / `loadVentureIntelligence` → `executeIntelligenceRuntime` (no event) → `runExecutiveIntelligenceRuntime`.  
Write path: action → `recordFounderDecision` or `persistFoundedCompany` → `executeIntelligenceRuntime({ event })` → persist snapshot + publish platform event.

**Actual available interfaces (do not invent more)**

- `executeIntelligenceRuntime` — `modules/intelligence/service.ts` (internal)
- `loadVentureIntelligence` — cached read
- `loadActiveIntelligence` / `loadVentureScopedIntelligence` — RSC
- `foundCompanyAction` — `CompanyFounded`
- `recordFounderDecisionAction` — `FounderDecisionRecorded`
- Projections: `projectSituationRoom`, `projectExecutiveFloor` in `core/venture/model.ts` (used by pages/screens, not by Runtime import in UI)

**Gaps vs Blueprint sections at discovery time (scaffold headings)**

| Need implied by Blueprint | Status |
|---|---|
| Public EIR HTTP/RPC | **BACKEND CONTRACT REQUIRED** |
| Streaming / conversational Runtime | **BACKEND CONTRACT REQUIRED** — `apps/web/src/ai/runtime.ts` is `disconnectedRuntime` |
| Client-safe intelligence DTO distinct from VIC engines | Partial: pages pass `core` through. **BACKEND CONTRACT REQUIRED** for a Lovable SPA |
| Subscribe to Runtime events in the browser | **BACKEND CONTRACT REQUIRED** |

---

## 6. VIC Interface Inventory

**Existing**

- Type: `VentureIntelligenceCore` and `Venture` in `core/venture/types.ts`
- Assembly: `loadIntelligenceFacts` + Runtime pipeline
- Persistence: `workspace_cores` and venture JSON columns via `getPersistence()`
- Desk context: `bootDesk` + cookies `vos_workspace` / `vos_venture` + `VentureRouteSync`
- UI consumers: Situation Room, Executive Office, HQ, agent pages — they receive `core` and project it

**Venture context handling (actual)**

1. Cookie `vos_workspace` / `vos_venture`
2. `bootDesk` resolves catalogues
3. Route slug/id can pin company (`persistActiveVentureSelection`, `resolveRouteVentureId`)
4. Rooms project with `activeVentureId`

**Missing for a replacement frontend**

| Need | Status |
|---|---|
| Stable JSON DTO for VIC (no engine class instances leaking) | **BACKEND CONTRACT REQUIRED** — current core is a rich in-process object |
| Cross-origin session + workspace/company scope | **BACKEND CONTRACT REQUIRED** |
| Duplicate `Venture` in `src/types/index.ts` (flat `{ id, name, workspaceId }`) vs VIC `Venture` | Presentation must not treat `src/types` as VIC |

---

## 7. Capability Interface Inventory

**Invocation mechanism.** The UI does **not** invoke capabilities. Capabilities are asserted **inside** Runtime (`assertRuntimeCapabilities`, `assertRuntimeInstanceUsage`).

**Frontend actions map to permissions, not capability ids:**

| UI act | Permission | Check | Runtime event |
|---|---|---|---|
| Record founder decision | `venture.update` | `canRecordFounderDecision` → `getPlatform().permissions.can` | `FounderDecisionRecorded` |
| Found company | `venture.create` | `persistFoundedCompany` | `CompanyFounded` |
| Create later workspace | `workspace.create` | `assertCanCreateWorkspace` (first workspace is session-only) | none (catalogue + seed) |
| Read desk | `venture.read` / workspace membership | `assertWorkspaceAccess` | none (read Runtime) |

**Parameters / responses.** Actions take form fields or `{ decisionId, ventureId, ruling }`. Responses are `{ error? }` or redirect.  
**Status / errors.** String `error` on the action state.  
**Audit.** Platform event bus publish on Runtime mutations. Not a user-visible audit API.  
**Safe for new frontend?** Safe **only** if Lovable keeps calling these server actions (or a future adapter that still enforces `permissions.can` server-side). Unsafe if Lovable calls persistence or invents capability dispatch.

---

## 8. Authentication & Permission Inventory

| Topic | Fact |
|---|---|
| Provider | Custom: bcrypt password identities + Google OAuth (PKCE). jose HS256 JWT |
| Supabase Auth | **None** |
| Session | `vos_session` httpOnly cookie + `sessions` table. `AUTH_SECRET` (dev default exists) |
| Scope cookies | `vos_workspace`, `vos_venture` |
| Route protection | `src/proxy.ts` + `(app)/layout.tsx` `getSession()` redirect |
| Roles | `owner` \| `admin` \| `member` (`contracts/permissions.ts`) |
| Role maps | `platform/permissions/service.ts` — owner has all six permissions; admin lacks `workspace.create`; member is read-only |
| Frontend permission visibility | Almost none. UI hides little; server denies |
| Authoritative enforcement | Server: `permissions.can`, proxy, actions, `assertWorkspaceAccess` |

**Lovable may own:** login/signup/reset layout, copy, fields, Google button chrome, signed-out autocomplete behaviour.  
**Cursor/backend must own:** credential verification, session issuance, cookie flags, OAuth client secrets, proxy, role maps, logout expiry of all auth cookies.

A Lovable app on another origin **cannot** use httpOnly `vos_session` without an adapter (BFF or token exchange). **BACKEND CONTRACT REQUIRED.**

---

## 9. Supabase Inventory

**Supabase is not in this repository.** No client, no generated types, no Supabase migrations, no realtime, no storage, no edge functions.

| Persistence that actually exists | Classification |
|---|---|
| `apps/web/src/platform/persistence/db.ts` libSQL | **BACKEND ONLY** / **PROTECTED** |
| `schema.ts` / `ensureSchema()` tables: users, auth_identities, sessions, password_reset_tokens, workspaces, workspace_members, workspace_cores, ventures, executive_offices, recommendations, policy_states, policy_findings, executive_memory, decisions, operating_health, company_stories, knowledge_nodes, knowledge_edges | **PROTECTED** |
| Frontend importing `getPersistence()` | **BACKEND ONLY** — no client imports today; keep it that way |
| Direct table access from Lovable | **FORBIDDEN** |

Do not introduce Supabase as part of frontend replacement. That would be a persistence redesign.

---

## 10. Theme & Design-System Inventory

| Piece | Location | Preserve or replace |
|---|---|---|
| Token pipeline | `packages/ids/tokens/generate.ts`, `foundation.css`, generated breakpoints | **Preserve** |
| Executive Light default / Executive Dark `.dark` | `packages/ids/tokens/foundation.css`, `themes/climate.css` | **Preserve climates.** Do not invent new named climates |
| Brand + atmosphere (VentureOS, Qualora, Calviora, Farmora) | `packages/ids/tokens/brand/*`, `atmosphere/*`, `ids-brand-binder.tsx` | **Preserve binding.** Visual refresh through tokens |
| next-themes | `core/theme/theme-provider.tsx` | **Preserve behaviour** (system default, `localStorage` `"theme"`) unless Blueprint later changes it |
| Toggle + Settings appearance + palette theme commands | shell + settings + `use-command-executor` | **Replace chrome**, keep climate names |
| Tailwind | v4, no JS config; `@source` in `globals.css` | New UI must still consume IDS variables, not raw hex |
| Layout primitives | `core/layout/primitives.tsx` | **Preserve contract** if the Next shell remains. A detached Lovable app would need an approved token-consumption story |

**v1.1 design system.** IDS is already Foundation v1.1. A Lovable UI kit must **bind to IDS**, not replace it.

---

## 11. Shared Types & Contracts

**Consume, do not duplicate**

| Domain | Authoritative types |
|---|---|
| Users / session | `contracts/ids.ts` `UserId`; `lib/auth/session-token.ts` `SessionUser`; `modules/auth/service.ts` `UserRecord` |
| Permissions | `contracts/permissions.ts`; maps in `platform/permissions/service.ts` |
| Ventures (catalogue) | `core/venture-registry` `VentureRegistryEntry`; `modules/ventures/service.ts` `VentureRecord` |
| Venture instances / definitions | `core/venture-definition/types.ts` `VentureDefinition`, `VentureDefinitionRef` |
| VIC / intelligence | `core/venture/types.ts` `VentureIntelligenceCore`, `Venture` |
| Knowledge | `platform/brain/types.ts`; Runtime `core/knowledge-graph` |
| Runtime actions | `core/runtime` events (`CompanyFounded`, `FounderDecisionRecorded`) |
| Extensions | `contracts/extensions.ts` |

**Presentation duplication (flagged)**

- `apps/web/src/types/index.ts` defines a second `Venture` and `User` without branded IDs
- `apps/web/src/core/shared/types.ts` defines unbranded `VentureId = string`
- Launch draft ids in `modules/ventures/launch/types.ts` are founder-facing product UX, mapped through Product Bootstrap onto Definition Registry — do not promote them to a Product Registry

---

## 12. Frontend Replacement Map

| Current area | Location | Class | Lovable | Cursor | Notes | Dependencies | Risk |
|---|---|---|---|---|---|---|---|
| Auth screens | `modules/auth/screens.tsx` | REPLACE | Visual forms | Actions, OAuth, cookies | Keep credential autocomplete behaviour | `auth/actions.ts` | HIGH if SPA splits origin |
| Auth layout | `app/(auth)/*` | REPLACE | Layout | Route protection | — | `proxy.ts` | MEDIUM |
| OsShell chrome | `core/shell/*` | REPLACE visual / PROTECT data | Look and motion | `snapshot.ts`, cookies, switcher actions | Do not remount shell via root `loading.tsx` | `bootDesk` | HIGH |
| Situation Room | `modules/situation-room/*` | REPLACE | Screen | `loadActiveIntelligence` + projections | — | VIC read | MEDIUM |
| Executive Office | `modules/executive-office/*` | REPLACE | Screen | Same loaders | `/agents` is the OS name | VIC | MEDIUM |
| Company HQ | `modules/ventures/launch/venture-hq-screen.tsx` | REPLACE | Screen | `getFoundedCompanyBySlug`, founder action | — | Runtime write | HIGH |
| Launch wizard | `modules/ventures/launch/*` | REPLACE UI / PROTECT validation | Steps chrome | `foundCompanyAction`, Definition Registry | Must not invent a Product Registry | Instantiation | CRITICAL |
| Ventures index | `modules/ventures/screens.tsx` | REPLACE | List | `getShellSnapshot` | — | Catalogue | LOW |
| Brain screens | `modules/brain/*` | REPLACE | Screens | `platform/brain` query | VC-020 still closed as a programme | Catalogue | MEDIUM |
| Settings | `modules/settings/*` | REPLACE | Screens | logout action | Theme labels stay Executive Light/Dark | Auth | LOW |
| Engineering HQ UI | `modules/engineering-hq/screens/*` | REPLACE | Screens | `records/` parsers | Not a second engineering DB | `docs/engineering` | LOW |
| Deferred CRM/Finance/Docs | `modules/{crm,finance,documents}` | KEEP | None yet | Programme later | Placeholders | — | LOW |
| Route files | `app/(app)/**/page.tsx` | REFACTOR | New screen import | Loader calls | Keep RSC data on the server | Loaders | MEDIUM |
| IDS | `packages/ids` | PROTECT | Consume tokens | Token pipeline | — | Generate | CRITICAL if forked |
| Runtime / persistence / auth service | `core/runtime`, `platform/*`, `lib/auth` | PROTECT | None | All | — | Foundation | CRITICAL |

---

## 13. Missing Contract Register

Compared to the **scaffold** Blueprint at discovery time. Seeded into [VENTUREOS_FRONTEND_BACKEND_CONTRACT_REGISTER.md](./VENTUREOS_FRONTEND_BACKEND_CONTRACT_REGISTER.md).

| ID | Frontend requirement | Required information/action | Subsystem | Partial implementation | Architectural question | Priority |
|---|---|---|---|---|---|---|
| BCR-001 | Navigation / Workspace / Architecture | Shell DTO | Desk boot | `getShellSnapshot`, `bootDesk` | Same-origin RSC vs HTTP BFF? | P0 |
| BCR-002 | Rooms 18–20 | VIC read DTO + projection | Intelligence / VIC | loaders + projections | Projections only? | P0 |
| BCR-003 | Company HQ | Found-company command | Intelligence + Definition Registry | `foundCompanyAction` | Stay a server action? | P0 |
| BCR-004 | Situation Room | Founder-decision command | Intelligence + permissions | `recordFounderDecisionAction` | Same | P0 |
| BCR-005 | Authentication | Cross-origin or BFF session | Auth | jose cookies, Google routes | Can Lovable stay inside Next? | P0 if detached SPA |
| BCR-006 | AI Experience | Connected AI/Runtime API | `src/ai/runtime.ts` disconnected | Status label only | Is Ask allowed to touch Runtime? | P1 |
| BCR-007 | Search / Knowledge | Search/query API | `platform/brain/query.ts` | In-process functions | HTTP vs RSC | P1 |
| BCR-008 | Notifications | Notification API | notification-center UI; notifications port | No live feed | Inventing a store is out of scope | P2 |
| BCR-009 | Loading / Performance | Navigation pending contract | `NavigationProgress` | No `useLinkStatus` | Keep previous-page continuity | P1 |
| BCR-010 | Design System / Theme | Token consumption for external React | IDS | `packages/ids` | Must Lovable ship inside Next? | P0 if detached |
| BCR-011 | Accessibility / Acceptance | Shared error contract | `{ error: string }` | `ApiResult` unused | Typed errors | P1 |
| BCR-012 | Frontend Architecture | HTTP facade vs Lovable-in-`apps/web` | `src/api/*` empty | Empty barrels | Filling barrels invents a layer | P0 |

Post-decision statuses live in the Backend Contract Register. They are not rewritten here.

---

## 14. Migration Risk Register

| Risk | Rating | Mitigation |
|---|---|---|
| Assuming Supabase / rewriting persistence | **CRITICAL** | There is no Supabase. Do not add one for the frontend |
| Lovable SPA on another origin vs httpOnly cookies | **CRITICAL** | Keep presentation in `apps/web` until BCR-005 exists |
| UI calling Runtime or `getPersistence()` | **CRITICAL** | Protected-path list; review every Lovable PR for those imports |
| Launch wizard bypassing Definition Registry | **CRITICAL** | Only `foundCompanyAction` / `persistFoundedCompany` |
| Forking IDS tokens / inventing climates | **HIGH** | Consume `@repo/ids`; Cursor owns generate |
| Duplicated `Venture` / `User` types | **HIGH** | Do not treat `src/types` duplicates as VIC |
| Filling empty `src/api` as a shadow backend | **HIGH** | Adapter is a named Cursor programme |
| Restoring `app/loading.tsx` above OsShell | **HIGH** | Navigation continuity tests |
| `@repo/brain` vs `platform/brain` confusion | **MEDIUM** | Web uses platform catalogue |
| Disconnected AI treated as a chat Runtime | **HIGH** | Ask stays a command surface until a Cursor-owned AI programme |
| No CI (`.github` absent) | **MEDIUM** | Local gates: lint, types, test, build, running desk |
| No `error.tsx` | **MEDIUM** | Add as presentation; fail closed on auth |
| Dev SQLite file coupling | **MEDIUM** | Never commit `data/ventureos.db` |
| Deleting `apps/web` prematurely | **CRITICAL** | Incremental replacement; Git history |
| Deployment story missing | **MEDIUM** | Replacement does not invent hosting |

---

## 15. Rollback Strategy

The repository **already supports** the safe path:

| Mechanism | Actual support |
|---|---|
| Feature branch + PR to `main` | Yes — `docs/foundation-library/04-ENGINEERING/Git-Workflow.md` |
| Parallel frontend package | Possible (`apps/*` workspace) but **not present** |
| Feature flags | **Not found** |
| Alternate routes (e.g. `/v2`) | **Not found** |
| Worktrees | Git supports them; not a product mechanism |

**Safest approach based on this repo**

1. Do **not** delete `apps/web` presentation.
2. Do **not** stand up a second production origin until BCR-001/005/012 are decided.
3. Open a feature branch from `main` (or the current integration branch). GitHub remains SSoT.
4. Replace screens **module by module** behind the existing RSC loaders and server actions.
5. If a Lovable export is a separate Vite tree, import it as a package **or** copy presentation only — Cursor lands the integration.
6. Rollback = revert the PR / keep the previous screen file. SQLite and Runtime stay untouched.

---

## 16. Recommended Integration Architecture

Adapted to **what is here**, not a redesign:

```
Lovable presentation
  (React screens, chrome look, motion)
        ↓
Cursor-owned adapter  (today: RSC pages + server actions;
  tomorrow: the same functions behind an explicit contract module)
        ↓
Existing VentureOS interfaces
  bootDesk / getShellSnapshot
  loadActiveIntelligence / loadVentureIntelligence
  foundCompanyAction / recordFounderDecisionAction
  auth actions + proxy
        ↓
EIR / VIC / Runtime / Capabilities / Knowledge / Persistence
  modules/intelligence/service.ts
  core/runtime
  core/capability
  core/venture-definition
  platform/persistence
```

Do **not** insert a Product Registry, a second orchestrator, Supabase, or a Brain Runtime. Empty `src/api` barrels stay empty until Cursor defines a real contract.

**Practical Sprint shape:** Lovable designs and implements **screens**. Cursor keeps every file in section 3, every action, and every loader. The Next.js App Router remains the host until an approved BFF exists.

---

## 17. Sprint 0 Readiness (as of discovery)

**NOT READY FOR SPRINT 0**

Discovery concluded that a Lovable replacement programme should not start until: the Blueprint was more than a scaffold; a host decision existed; Supabase was not assumed; BCR-012 was decided.

Those documentation conditions are handled in the 2026-08-23 alignment step. This section is not rewritten. Updated readiness is in the alignment report.
