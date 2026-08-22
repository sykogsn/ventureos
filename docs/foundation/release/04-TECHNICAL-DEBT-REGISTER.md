# Foundation Technical Debt Register

**Release.** VentureOS Foundation v1.0  
**Date.** 2026-08-21  
**Authority.** Living engineering debt. Debt is not permission to violate locked layers.  
**Related.** Foundation Library [Technical Debt Register](../../foundation-library/05-GOVERNANCE/Technical-Debt-Register.md)

This is the release snapshot. New debt must be added here and in the library register together.

---

| ID | Debt | Layer | Notes |
|---|---|---|---|
| TD-001 | Brand overlay is not headquarters recognition | Presentation | Expected until atmosphere (RM-001). |
| TD-002 | Schema bootstrap cached on `globalThis` | Persistence | Additive tables need a generation bump. |
| TD-003 | Server session TTL is 14 days even when the cookie is session-scoped | Identity | Remember me is cookie policy; the server row may outlive the browser. |
| TD-004 | `policy_findings` denormalized recovery path | Persistence | `loadState` falls back for pre-H2 rows. |
| TD-005 | Empty HTTP API barrels | Platform | Unused facades. Not a second application layer. |
| TD-006 | Next.js 16 middleware file convention | Engineering | Closed 2026-08-22. Session gate is `apps/web/src/proxy.ts`. |
| TD-007 | `FOUNDATION.md` still notes no OAuth login route | Knowledge | Google sign-in exists. Update the code-adjacent comment in an application sprint. Do not treat the stale sentence as architecture. |
| TD-008 | Product rooms still compose Tailwind layout | Presentation | 46 inventoried files. Layout v2 is certified; those rooms are not migrated. Allowlist must not grow. |
| TD-009 | Brain catalogue is in-memory | Platform knowledge | Not persistence. Not a document manager. Knowledge Object layout programme was paused. |
| TD-010 | Command dialog width tokenised to measure.md | Presentation | Accepted Layout v2 delta from 36rem (`max-w-xl`) to 32rem. |
| TD-011 | Page header title rhythm uses Stack compact | Presentation | Accepted Layout v2 delta versus prior ad-hoc margins. |

## Refusals

The following are not debt. They are forbidden, not deferred:

- A second orchestrator
- A Product Registry
- Capability dispatch
- Persist as a Runtime stage
- A third climate
- Theme restoring an excluded feature
