# VentureOS Frontend Protected Boundaries

**Document.** VentureOS Frontend Protected Boundaries  
**Date.** 2026-08-23  
**Status.** Safety contract for Lovable integration  
**Source.** [VentureOS Frontend Integration Discovery Report](./VENTUREOS_FRONTEND_INTEGRATION_DISCOVERY_REPORT.md)  
**Decision.** [VentureOS Frontend Integration Decision](./VENTUREOS_FRONTEND_INTEGRATION_DECISION.md)  
**Governance.** Subordinate to the [VentureOS Project Constitution](../PROJECT_CONSTITUTION.md)

This document uses **actual repository paths**. It does not invent directories. Lovable presentation is integrated into `apps/web`. Lovable does not own entire folders that also contain loaders, actions, or services.

---

## LOVABLE MAY MODIFY

Presentation-only files that may change during **approved** frontend sprints, after Cursor review and commit into GitHub.

These are visual and interaction surfaces. They are not a grant to rewrite the module that contains them.

### Auth experience (screens only)

Lovable may modify authentication **presentation**. Lovable may **not** modify session implementation, the auth service, OAuth implementation, the proxy, role maps, permission enforcement, or persistence.

- `apps/web/src/modules/auth/screens.tsx`
- `apps/web/src/modules/auth/executive-auth-shell.tsx`
- `apps/web/src/modules/auth/messages.ts`
- `apps/web/src/app/(auth)/login/page.tsx` (thin route shell)
- `apps/web/src/app/(auth)/signup/page.tsx`
- `apps/web/src/app/(auth)/forgot-password/page.tsx`
- `apps/web/src/app/(auth)/forgot-password/sent/page.tsx`
- `apps/web/src/app/(auth)/reset-password/page.tsx`
- `apps/web/src/app/(auth)/layout.tsx`
- `apps/web/src/app/(auth)/loading.tsx`

Do **not** treat `apps/web/src/modules/auth/` as wholly replaceable. `actions.ts`, `service.ts`, `google-oauth.ts`, `google-account.ts`, and `password-reset.ts` are protected. `apps/web/src/lib/auth/` (session, cookie, origin), `apps/web/src/proxy.ts`, `apps/web/src/platform/permissions/`, and persistence remain Cursor-owned.

### Shell chrome (visual files only)

- `apps/web/src/core/shell/os-shell.tsx` (structure/look; wiring stays Cursor-owned)
- `apps/web/src/core/shell/sidebar.tsx`
- `apps/web/src/core/shell/top-nav.tsx`
- `apps/web/src/core/shell/workspace-switcher.tsx` (chrome only)
- `apps/web/src/core/shell/venture-switcher.tsx` (chrome only)
- `apps/web/src/core/shell/command-palette.tsx`
- `apps/web/src/core/shell/navigation-progress.tsx`
- `apps/web/src/core/shell/theme-toggle.tsx`
- `apps/web/src/core/shell/page-frame.tsx`
- `apps/web/src/core/shell/page-header.tsx`
- `apps/web/src/core/shell/profile-menu.tsx`
- `apps/web/src/core/shell/notification-center.tsx`
- `apps/web/src/core/shell/empty-copy.tsx`
- `apps/web/src/core/shell/content-loading.tsx`
- `apps/web/src/core/shell/executive-loading.tsx`
- `apps/web/src/core/shell/deferred-operating-screen.tsx`
- `apps/web/src/core/shell/venture-mark.tsx`
- `apps/web/src/core/context/shell-context.tsx` (client chrome state only)

Do **not** treat `apps/web/src/core/shell/snapshot.ts` or `apps/web/src/core/shell/venture-route.ts` as Lovable-owned.

### Product screens

- `apps/web/src/modules/situation-room/` screens and `components/`
- `apps/web/src/modules/executive-office/` screens and `components/`
- `apps/web/src/modules/ventures/screens.tsx`
- `apps/web/src/modules/ventures/workspace.tsx`
- `apps/web/src/modules/ventures/workspace-nav.tsx`
- `apps/web/src/modules/ventures/launch/launch-venture-wizard.tsx`
- `apps/web/src/modules/ventures/launch/venture-hq-screen.tsx`
- `apps/web/src/modules/ventures/launch/components/`
- `apps/web/src/modules/ventures/launch/hq/artefact-cards.tsx`
- `apps/web/src/modules/brain/` screens and `components/`
- `apps/web/src/modules/settings/screens.tsx`
- `apps/web/src/modules/settings/appearance.tsx`
- `apps/web/src/modules/engineering-hq/screens/`
- `apps/web/src/modules/engineering-hq/components/`
- `apps/web/src/modules/dashboard/components/`
- `apps/web/src/modules/workspaces/create-form.tsx` (form chrome only)
- `apps/web/src/modules/intelligence/founder-call-action.tsx` (button chrome only)
- `apps/web/src/modules/crm/screens.tsx`
- `apps/web/src/modules/finance/screens.tsx`
- `apps/web/src/modules/documents/screens.tsx`

### Thin App Router shells

`apps/web/src/app/(app)/**/page.tsx` files may change **imports and composition** of screens. They must keep calling existing loaders. They must not import Runtime.

### Extensions presentation

- `apps/web/src/extensions/builtin.ts` (nav/command labels and hrefs)

`apps/web/src/contracts/extensions.ts` and `apps/web/src/extensions/registry.ts` remain Cursor-owned.

### Shared UI helpers

- `packages/ui/src/button.tsx`
- `packages/ui/src/card.tsx`

These are thin helpers. IDS remains the design-system foundation.

---

## CURSOR INTEGRATION REQUIRED

Lovable-generated presentation may need these interfaces. Cursor must perform or approve the connection. Lovable must not re-implement them.

| Interface | Location | Role |
|---|---|---|
| `getSession` | `apps/web/src/lib/auth/session.ts` | Session resolution |
| `getShellSnapshot` | `apps/web/src/core/shell/snapshot.ts` | Shell catalogue DTO |
| `bootDesk` | `apps/web/src/modules/intelligence/boot.ts` | Session, workspace, company before intelligence |
| `loadActiveIntelligence` | `apps/web/src/modules/intelligence/request.ts` | VIC read for the active desk |
| `loadVentureScopedIntelligence` | `apps/web/src/modules/intelligence/request.ts` | VIC read pinned to a route company |
| `getFoundedCompanyBySlug` | `apps/web/src/modules/intelligence/service.ts` | Company HQ artefact |
| `signupAction` | `apps/web/src/modules/auth/actions.ts` | Registration |
| `loginAction` | `apps/web/src/modules/auth/actions.ts` | Sign-in |
| `logoutAction` | `apps/web/src/modules/auth/actions.ts` | Sign-out |
| `forgotPasswordAction` | `apps/web/src/modules/auth/actions.ts` | Reset request |
| `resetPasswordAction` | `apps/web/src/modules/auth/actions.ts` | Reset completion |
| Google OAuth routes | `apps/web/src/app/auth/google/route.ts`, `.../callback/route.ts` | OAuth start and callback |
| `createWorkspaceAction` | `apps/web/src/modules/workspaces/actions.ts` | Create workspace |
| `selectWorkspaceAction` | `apps/web/src/modules/workspaces/actions.ts` | Switch workspace |
| `selectVentureAction` | `apps/web/src/modules/ventures/actions.ts` | Switch company |
| `foundCompanyAction` | `apps/web/src/modules/intelligence/actions.ts` | Found company through Runtime |
| `recordFounderDecisionAction` | `apps/web/src/modules/intelligence/actions.ts` | Founder ruling through Runtime |
| `projectSituationRoom` / `projectExecutiveFloor` | `apps/web/src/core/venture/model.ts` | Read projections |
| `useShell` | `apps/web/src/core/context/shell-context.tsx` | Client chrome state hydrated from RSC |
| Theme bind | `apps/web/src/core/theme/theme-provider.tsx`, `ids-brand-binder.tsx` | Executive Light/Dark + atmosphere |

Empty `apps/web/src/api/*` barrels are **not** a live contract. Filling them is a Cursor programme, not a Lovable task.

---

## PROTECTED

Lovable must not modify these paths without explicit architectural approval.

### Runtime / EIR

- `apps/web/src/core/runtime/`
- `apps/web/src/FOUNDATION.md`

### VIC and intelligence engines

- `apps/web/src/core/venture/`
- `apps/web/src/core/policy/`
- `apps/web/src/core/recommendation/`
- `apps/web/src/core/decision-engine/`
- `apps/web/src/core/executive-memory/`
- `apps/web/src/core/operating-health/`
- `apps/web/src/core/knowledge-graph/`
- `apps/web/src/core/company-story/`
- `apps/web/src/core/mission-engine/`
- `apps/web/src/core/risk-intelligence/`
- `apps/web/src/core/document-intelligence/`
- `apps/web/src/core/executive-office/`
- `apps/web/src/core/venture-genome/`
- `apps/web/src/core/identity/`
- `apps/web/src/modules/intelligence/service.ts`
- `apps/web/src/modules/intelligence/boot.ts`
- `apps/web/src/modules/intelligence/governance.ts`
- `apps/web/src/modules/intelligence/request.ts`

### Capability Framework

- `apps/web/src/core/capability/`

### Venture Definition Framework

- `apps/web/src/core/venture-definition/`

### Venture Registry and Workspace Registry

- `apps/web/src/core/venture-registry/`
- `apps/web/src/core/workspace-registry/`
- `apps/web/src/modules/ventures/service.ts`
- `apps/web/src/modules/ventures/select.ts`
- `apps/web/src/modules/ventures/launch/artefacts.ts`
- `apps/web/src/modules/ventures/launch/bootstrap.ts`
- `apps/web/src/modules/ventures/launch/validation.ts`

### Knowledge

- `apps/web/src/platform/brain/`
- `apps/web/src/core/knowledge-graph/`
- `packages/brain/`

### Persistence

- `apps/web/src/platform/persistence/`
- `apps/web/data/`

### Security, permissions, authentication implementation

Lovable must not modify session implementation, the auth service, OAuth implementation, the proxy, role maps, permission enforcement, or persistence.

- `apps/web/src/platform/permissions/`
- `apps/web/src/platform/kernel.ts`
- `apps/web/src/platform/bootstrap.ts`
- `apps/web/src/platform/events/`
- `apps/web/src/platform/audit/`
- `apps/web/src/lib/auth/`
- `apps/web/src/modules/auth/service.ts`
- `apps/web/src/modules/auth/actions.ts`
- `apps/web/src/modules/auth/google-oauth.ts`
- `apps/web/src/modules/auth/google-account.ts`
- `apps/web/src/modules/auth/password-reset.ts`
- `apps/web/src/proxy.ts`
- `apps/web/src/app/auth/google/`

### Platform contracts

- `apps/web/src/contracts/`
- `apps/web/src/platform/ids.ts`

### IDS token generation

- `packages/ids/tokens/`
- `packages/ids/themes/bind.ts`

### Constitutions

- `docs/PROJECT_CONSTITUTION.md`
- `docs/architecture/VENTUREOS_PLATFORM_CONSTITUTION.md`
- `docs/engineering/MASTER_ENGINEERING_PROMPT.md`
- Locked `docs/foundation/`
- `docs/foundation-library/`

---

## FORBIDDEN WITHOUT ARCHITECTURAL APPROVAL

- Direct database access from presentation (`getPersistence()`, Drizzle, `apps/web/data/`)
- Introducing Supabase
- New persistence architecture
- Second Runtime or second orchestration system
- Shadow backend (including filling empty `apps/web/src/api/*` barrels without a Cursor programme)
- Replacement authentication architecture
- Duplicated domain models (do not add another `Venture` / `User` beside `contracts/` and `core/venture/`)
- Frontend implementation of authoritative permissions
- Lovable modifications to protected paths
- Replacing IDS with hard-coded design values
- Restoring a root `app/loading.tsx` that unmounts OsShell
- Importing `@/core/runtime` from pages or screens
