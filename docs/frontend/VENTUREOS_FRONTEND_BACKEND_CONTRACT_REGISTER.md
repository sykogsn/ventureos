# VentureOS Frontend Backend Contract Register

**Document.** VentureOS Frontend Backend Contract Register  
**Date.** 2026-08-23  
**Status.** Seeded from Integration Discovery. No contracts implemented in this change.  
**Decision.** Lovable presentation stays inside `apps/web`. See [VENTUREOS_FRONTEND_INTEGRATION_DECISION.md](./VENTUREOS_FRONTEND_INTEGRATION_DECISION.md).  
**Governance.** Subordinate to the [VentureOS Project Constitution](../PROJECT_CONSTITUTION.md)

Allowed statuses: `OPEN` · `PARTIALLY RESOLVED` · `RESOLVED` · `DEFERRED` · `NOT REQUIRED`

This register does **not** implement APIs. It records what a replacement presentation needs versus what the repository already has.

---

## BCR-001

**ID.** BCR-001  
**STATUS.** OPEN  
**FRONTEND REQUIREMENT.** Documented shell DTO: user, workspaces, ventures, active ids (Blueprint navigation / workspace / architecture).  
**EXISTING IMPLEMENTATION.** `getShellSnapshot` in `apps/web/src/core/shell/snapshot.ts` over `bootDesk` in `apps/web/src/modules/intelligence/boot.ts`. Consumed by `(app)/layout.tsx`.  
**AUTHORITATIVE OWNER.** Cursor / desk boot  
**DECISION REQUIRED.** Publish the existing snapshot as the official shell contract for Lovable-in-`apps/web`, without inventing HTTP.  
**PRIORITY.** P0  
**NOTES.** Same-origin RSC remains the transport. Cross-origin HTTP is not required after the 2026-08-23 host decision.

---

## BCR-002

**ID.** BCR-002  
**STATUS.** OPEN  
**FRONTEND REQUIREMENT.** VIC read and projection contract for Situation Room, Executive Office, and Company HQ.  
**EXISTING IMPLEMENTATION.** `loadActiveIntelligence` and `loadVentureScopedIntelligence` in `apps/web/src/modules/intelligence/request.ts`. Projections `projectSituationRoom` and `projectExecutiveFloor` in `apps/web/src/core/venture/model.ts`.  
**AUTHORITATIVE OWNER.** Cursor / intelligence  
**DECISION REQUIRED.** Whether Lovable receives projections only, never the in-process VIC object.  
**PRIORITY.** P0  
**NOTES.** Implementation exists. A frontend-safe DTO is not yet written down. Still required because screens must not import engine types.

---

## BCR-003

**ID.** BCR-003  
**STATUS.** OPEN  
**FRONTEND REQUIREMENT.** Found-company command contract.  
**EXISTING IMPLEMENTATION.** `foundCompanyAction` in `apps/web/src/modules/intelligence/actions.ts` → `persistFoundedCompany` / Definition Registry instantiation.  
**AUTHORITATIVE OWNER.** Cursor / intelligence + Definition Registry  
**DECISION REQUIRED.** Keep as the only founding path. Document input/error shape for presentation.  
**PRIORITY.** P0  
**NOTES.** Remains a server action. Not replaced by HTTP. Still required as a written contract so Lovable does not invent a Product Registry.

---

## BCR-004

**ID.** BCR-004  
**STATUS.** OPEN  
**FRONTEND REQUIREMENT.** Founder-decision command contract.  
**EXISTING IMPLEMENTATION.** `recordFounderDecisionAction` in `apps/web/src/modules/intelligence/actions.ts` → `venture.update` → Runtime `FounderDecisionRecorded`.  
**AUTHORITATIVE OWNER.** Cursor / intelligence + permissions  
**DECISION REQUIRED.** Document fields (`decisionId`, `ventureId`, `ruling`) and `{ error? }` for presentation.  
**PRIORITY.** P0  
**NOTES.** Remains a server action. Still required as a written contract.

---

## BCR-005

**ID.** BCR-005  
**STATUS.** PARTIALLY RESOLVED  
**FRONTEND REQUIREMENT.** Session / cross-origin contract.  
**EXISTING IMPLEMENTATION.** jose JWT in `vos_session` plus SQLite session rows. `apps/web/src/lib/auth/`, `apps/web/src/proxy.ts`. Google OAuth routes under `apps/web/src/app/auth/google/`.  
**AUTHORITATIVE OWNER.** Cursor / auth  
**DECISION REQUIRED.** Founder decision on Blueprint §16 naming Supabase Auth versus the live jose/SQLite architecture. See alignment conflict.  
**PRIORITY.** P0  
**NOTES.** Cross-origin session is **not required** for this programme because Lovable stays in `apps/web`. The existing same-origin cookie session remains. A written session contract for Sprint 0 (refresh, expiry UX) is still outstanding. Microsoft, magic link, and MFA named in Blueprint §16 are **not** in the repository.

---

## BCR-006

**ID.** BCR-006  
**STATUS.** OPEN  
**FRONTEND REQUIREMENT.** AI / Runtime interaction for Blueprint AI experience.  
**EXISTING IMPLEMENTATION.** `apps/web/src/ai/runtime.ts` is `disconnectedRuntime`. TopNav shows a status label only. Ask is a command surface.  
**AUTHORITATIVE OWNER.** Cursor / architecture  
**DECISION REQUIRED.** Whether Ask may ever call Runtime. Foundation: no second orchestrator; pages do not run intelligence.  
**PRIORITY.** P1  
**NOTES.** Unchanged by the in-`apps/web` host decision.

---

## BCR-007

**ID.** BCR-007  
**STATUS.** OPEN  
**FRONTEND REQUIREMENT.** Knowledge search / query contract.  
**EXISTING IMPLEMENTATION.** In-process `apps/web/src/platform/brain/query.ts`. Brain screens call it from RSC, not HTTP.  
**AUTHORITATIVE OWNER.** Cursor / knowledge  
**DECISION REQUIRED.** Document the query function as the official read for Brain UI inside `apps/web`.  
**PRIORITY.** P1  
**NOTES.** HTTP is not required after the host decision. A written query contract is still required before a new search surface.

---

## BCR-008

**ID.** BCR-008  
**STATUS.** DEFERRED  
**FRONTEND REQUIREMENT.** Notification read/write API.  
**EXISTING IMPLEMENTATION.** `apps/web/src/core/shell/notification-center.tsx` is chrome. `apps/web/src/contracts/notifications.ts` is a port. No live feed.  
**AUTHORITATIVE OWNER.** Cursor / platform  
**DECISION REQUIRED.** Whether notifications are in v1 scope.  
**PRIORITY.** P2  
**NOTES.** Inventing a store is out of scope. Host decision does not create this contract.

---

## BCR-009

**ID.** BCR-009  
**STATUS.** PARTIALLY RESOLVED  
**FRONTEND REQUIREMENT.** Navigation pending behaviour.  
**EXISTING IMPLEMENTATION.** No root `(app)` `loading.tsx`. `NavigationProgress` + `OverlayPulse`. Previous page stays visible.  
**AUTHORITATIVE OWNER.** Cursor / presentation integration  
**DECISION REQUIRED.** Whether command-palette navigations must show the same pulse.  
**PRIORITY.** P1  
**NOTES.** Shell remount via `app/loading.tsx` is already forbidden. Still required as a written rule for Sprint 0 shell work.

---

## BCR-010

**ID.** BCR-010  
**STATUS.** PARTIALLY RESOLVED  
**FRONTEND REQUIREMENT.** IDS consumption for new presentation.  
**EXISTING IMPLEMENTATION.** `packages/ids`, `apps/web/src/core/theme/`, `globals.css` Tailwind v4 `@source`.  
**AUTHORITATIVE OWNER.** Cursor / IDS  
**DECISION REQUIRED.** None for host: Lovable-in-`apps/web` can import existing CSS variables. Token-only lint remains a sprint gate.  
**PRIORITY.** P0  
**NOTES.** External-bundle IDS story is **not required**. Forking IDS remains forbidden.

---

## BCR-011

**ID.** BCR-011  
**STATUS.** OPEN  
**FRONTEND REQUIREMENT.** Shared error contract (machine code, human-safe message, reference ID).  
**EXISTING IMPLEMENTATION.** Actions return `{ error?: string }`. `apps/web/src/contracts/result.ts` `ApiResult` is unused by actions.  
**AUTHORITATIVE OWNER.** Cursor  
**DECISION REQUIRED.** Whether to adopt `ApiResult` for actions or leave string errors until a later sprint.  
**PRIORITY.** P1  
**NOTES.** Blueprint §17.2 and §23.5 item 31 still require this. Host decision does not resolve it.

---

## BCR-012

**ID.** BCR-012  
**STATUS.** RESOLVED  
**FRONTEND REQUIREMENT.** Frontend integration / API-host decision.  
**EXISTING IMPLEMENTATION.** Empty unused `apps/web/src/api/*` barrels. Live boundary is RSC loaders and server actions.  
**AUTHORITATIVE OWNER.** Founder / Cursor  
**DECISION REQUIRED.** None. Approved 2026-08-23: Lovable presentation stays in `apps/web`. No second production SPA. No second backend. Empty API barrels stay empty unless a later Cursor programme defines a real contract.  
**PRIORITY.** P0  
**NOTES.** This is the only BCR closed by the integration decision. Other BCRs are not automatically resolved.

---

## Host-decision effect

| ID | Effect of in-`apps/web` decision |
|---|---|
| BCR-012 | Resolved |
| BCR-005 | Cross-origin half not required; session write-up and Blueprint §16 conflict remain |
| BCR-010 | External-bundle half not required; token consumption inside Next remains |
| BCR-001–004, BCR-006–009, BCR-011 | Still required or deferred as written. Transport stays RSC/server actions, not a new HTTP API |
