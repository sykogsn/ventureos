# VentureOS Frontend Integration Decision

**Document.** VentureOS Frontend Integration Decision  
**Date.** 2026-08-23  
**Status.** **APPROVED — 2026-08-23**  
**Authority.** Founder-approved integration model for the VentureOS Frontend Replacement Programme  
**Governance.** Subordinate to the [VentureOS Project Constitution](../PROJECT_CONSTITUTION.md). Locked implementation sources remain the technical fact for Runtime, Capability Registry, Definition Registry, persistence, and IDS token values.

---

## Decision

The new VentureOS presentation layer will be integrated into the existing `apps/web` Next.js application.

Lovable will be used as a specialist frontend design and generation environment.

Lovable does not own the VentureOS application architecture.

Cursor remains responsible for integration.

---

## Integration model

```
Lovable Presentation
        ↓
Cursor-owned integration boundary
        ↓
Existing RSC loaders / Server Actions
        ↓
Existing VentureOS services
        ↓
EIR / VIC / Runtime / Capabilities / Knowledge
        ↓
Existing persistence
```

Lovable will **not** become a separate VentureOS production application. Lovable-generated presentation work will be integrated into the existing `apps/web` Next.js application. That application remains the VentureOS application host.

The existing architecture remains authoritative, including:

- Next.js App Router
- React Server Components
- existing server actions
- existing loaders
- existing authentication/session architecture
- existing workspace and Venture context
- EIR
- VIC
- Runtime
- Capability Framework
- Venture Definition Framework
- Venture Instance Framework
- Knowledge architecture
- libSQL/SQLite persistence
- IDS design system

---

## Explicitly rejected for this programme

- separate production Lovable SPA
- Supabase migration
- replacement authentication architecture
- second backend
- second Runtime
- frontend-owned business logic
- frontend-owned authoritative permissions
- direct frontend database access
- redesign of VentureOS Foundation to accommodate Lovable

A second production backend must not be created. A second Runtime must not be created. A separate production Lovable SPA must not be created unless a future architectural decision explicitly authorises it.

---

## Design System

The existing `packages/ids` remains the authoritative VentureOS design-system foundation.

- Lovable must consume IDS.
- Lovable must not fork IDS.
- Executive Light and Executive Dark remain the authoritative appearance climates.
- Venture identity must continue through the existing controlled brand/atmosphere architecture rather than separate application design systems.

---

## Repository ownership

GitHub remains the single source of truth.

Lovable-generated presentation changes are not authoritative until reviewed, integrated and committed into the VentureOS repository.

---

## Rollback principle

Existing presentation must not be deleted prematurely.

Frontend replacement occurs incrementally.

Each approved frontend increment must remain independently reversible through Git history until the replacement programme is certified.

---

## Foundation mappings (approved 2026-08-23)

These founder decisions reconcile Blueprint assumptions to the verified VentureOS Foundation. Foundation is not modified. The frontend adapts to VentureOS.

### Authentication

Existing VentureOS authentication is retained. Supabase Auth is rejected and must not be introduced.

Authoritative implementation remains:

- custom VentureOS authentication
- jose-based JWT/session handling
- httpOnly `vos_session` cookie
- existing SQLite/libSQL persistence
- existing session table
- existing Google OAuth
- existing proxy/route protection
- existing server-side role and permission enforcement

Lovable owns authentication **presentation** only. Cursor owns authentication implementation and integration.

### Company / Venture Instance

Company is a frontend **presentation label** mapped to the existing Venture / Venture Instance architecture:

- Venture Registry
- Venture Definition Registry
- Venture Registry entries representing founded companies / Venture instances
- existing Venture services and instantiation path

Do not create a Company Registry. Do not create another entity. Do not change the Venture Definition or Venture Instance Framework.

### Workspace

Workspace maps to the existing Workspace Registry architecture:

- Workspace Registry
- existing workspace records
- workspace membership
- `bootDesk`
- existing workspace context
- existing workspace selection behaviour

**Executive Workspace** remains a presentation / environment concept. It must not become a second backend Workspace entity.
