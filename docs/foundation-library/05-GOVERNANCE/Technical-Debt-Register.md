# Technical Debt Register

**Purpose.** Name known engineering debt that Foundation v1.1 accepted or inherited.

**Authority.** Living register. Debt is not permission to violate locked layers.

**Audience.** Engineering.

**Dependencies.** [Engineering Standards](../04-ENGINEERING/Engineering-Standards.md) · [Architecture Overview](../02-ARCHITECTURE/Architecture-Overview.md)

**Related Documents.** [Assumption Register](./Assumption-Register.md) · [Roadmap Register](./Roadmap-Register.md)

**Status.** Living

**Version.** 1.1.0

**Owner.** Engineering

**Last Updated.** 2026-08-21

---

| ID | Debt | Notes |
|---|---|---|
| TD-001 | Brand overlay is not a headquarters change | Expected; atmosphere is RM-001. |
| TD-002 | Schema bootstrap cached on `globalThis` | Additive tables need a generation bump (password reset tokens). |
| TD-003 | Server session TTL is 14 days even when the cookie is session-scoped | Remember me is cookie policy; server row may outlive the browser. |
| TD-004 | `policy_findings` denormalized recovery path | `loadState` falls back for pre-H2 rows. |
| TD-005 | Empty HTTP API barrels | Unused facades; do not treat as an application layer. |
| TD-006 | Middleware file convention deprecated by Next.js 16 | Closed 2026-08-22. Session gate is `apps/web/src/proxy.ts`. |
| TD-007 | Code-adjacent OAuth comment lag | `FOUNDATION.md` still notes no OAuth login route; Google sign-in now exists. Library is source of reading; code comment should be updated in an application sprint, not DOC-001. |
| TD-008 | Product rooms still compose Tailwind layout | 46 inventoried files. Layout v2 certified; rooms not migrated. See `docs/foundation/release/04-TECHNICAL-DEBT-REGISTER.md`. |
| TD-009 | Brain catalogue is in-memory | Not persistence. Knowledge Object layout programme paused. |
| TD-010 | Command dialog width tokenised to measure.md | Accepted Layout v2 delta. |
| TD-011 | Page header title rhythm uses Stack compact | Accepted Layout v2 delta. |
