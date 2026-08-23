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

## Known registration conflict

[VentureOS Frontend Master Blueprint v1.1](./VENTUREOS_FRONTEND_MASTER_BLUEPRINT.md) §16 and related passages name **Supabase Auth** as the identity provider of record. The live repository and this decision do not. Identity in `apps/web` is custom jose session cookies plus libSQL/SQLite (`apps/web/src/lib/auth/`, `apps/web/src/modules/auth/`, `apps/web/src/proxy.ts`, `apps/web/src/FOUNDATION.md`). This file does not amend the Blueprint text and does not amend Foundation law. The conflict is recorded for founder decision. See the alignment report heading **ARCHITECTURAL CONFLICT REQUIRES FOUNDER DECISION**.
