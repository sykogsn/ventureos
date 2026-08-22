# Technical Debt Register

**Purpose.** Follow-up items named at Foundation Certification v1.1.  
**Authority.** Engineering Records. Foundation-layer debt also lives in `docs/foundation-library/05-GOVERNANCE/Technical-Debt-Register.md` and `docs/foundation/release/04-TECHNICAL-DEBT-REGISTER.md`.  
**Engineering standard.** [Master Engineering Prompt](./MASTER_ENGINEERING_PROMPT.md) · [Engineering Index](./README.md)  
**Last Updated.** 2026-08-21

This register starts with certification follow-ups only. It does not copy TD-001–TD-011 unless they appeared in the VS-007 remaining list.

Planned sprint is recorded only when a named programme already exists. Unknown means not assigned.

---

## ERT-001 — Root `pnpm test` script missing

| Field | Record |
|---|---|
| ID | ERT-001 |
| Priority | Low |
| Description | Repository `package.json` has no `test` script. `pnpm test` exits `ERR_PNPM_NO_SCRIPT`. Workspace tests pass via `turbo run test` / `pnpm --filter web test` and `pnpm --filter @repo/ids test`. |
| Impact | Certification checklists that say `pnpm test` look like a failed gate. |
| Planned Sprint | Not assigned |
| Status | Open |

## ERT-002 — Auth shell has no theme selector

| Field | Record |
|---|---|
| ID | ERT-002 |
| Priority | Medium |
| Description | Login and other auth layouts do not render `ThemeToggle` or Settings Appearance. Header toggle is `Reveal on="show-md"` inside authenticated chrome. |
| Impact | Climate can be proven via Theme Provider class/storage, but a founder on `/login` cannot click Light/Dark. |
| Planned Sprint | Not assigned |
| Status | Open |

## ERT-003 — Hydration mismatch overlay on login

| Field | Record |
|---|---|
| ID | ERT-003 |
| Priority | Medium |
| Description | After climate persistence (`localStorage.theme=dark`), Next.js reported 2 console hydration errors attributed to `apps/web/src/core/shell/venture-mark.tsx`. Login still rendered. Likely next-themes `html` class vs SSR, not a missing token file. |
| Impact | “No browser console errors” is not clean. Overlay can be mistaken for a broken Foundation. |
| Planned Sprint | Not assigned |
| Status | Open |

## ERT-004 — `127.0.0.1` blocked from Next HMR

| Field | Record |
|---|---|
| ID | ERT-004 |
| Priority | Low |
| Description | Next.js 16 blocked cross-origin dev resources from `127.0.0.1` (`allowedDevOrigins`). `http://localhost:3000` served the app correctly. |
| Impact | Agents or browsers that use the loopback IP see blocked HMR / incomplete pages. |
| Planned Sprint | Not assigned |
| Status | Open |

## ERT-005 — Next.js middleware file convention

| Field | Record |
|---|---|
| ID | ERT-005 |
| Priority | Low |
| Description | Next.js 16 deprecates the `middleware` file convention in favour of `proxy`. Already TD-006 / RM-011 in Foundation registers. |
| Impact | Dev-server deprecation warning. Not a Runtime or IDS failure. |
| Planned Sprint | RM-011 (Foundation Library roadmap). No VS id assigned. |
| Status | Closed 2026-08-22. Session gate is `apps/web/src/proxy.ts`. |
