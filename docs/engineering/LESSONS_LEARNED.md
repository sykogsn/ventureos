# Lessons Learned

**Purpose.** Living engineering journal.  
**Authority.** Engineering Records. Outcomes stay in [DECISION_REGISTER.md](./DECISION_REGISTER.md); this file records what the work taught.  
**Last Updated.** 2026-08-21

Grow this document after every major sprint. Do not invent lessons. Do not copy ADR/FD tables here — link them.

---

## How to add a lesson

After a sprint close-out, add one entry with: sprint ID, date if known, the lesson in one sentence, and the evidence (file or certification). Do not rewrite earlier lessons.

---

## LL-001 — Diagnose before implementing

**Sprint.** VS-007  
**Date.** 2026-08-21

Guessing that Theme Provider or IDS was “disconnected” would have redesigned a working architecture. Phase 1 evidence showed login HTTP 500 and `Can't resolve './generated/breakpoints.css'` on a stale `next dev` while production build passed.

See [ERD-001](./DECISION_REGISTER.md#erd-001--diagnose-before-implementing) and [FOUNDATION_CERTIFICATION_v1.1.md](./FOUNDATION_CERTIFICATION_v1.1.md).

## LL-002 — Runtime problems are not always architecture problems

**Sprint.** VS-007  
**Date.** 2026-08-21

The Executive Design System and Theme Provider were connected in source. The running process was serving a failed CSS graph. Treat the development server, lock file, and Turbopack cache as suspects equal to architecture.

## LL-003 — Build pipelines should fail early

**Sprint.** VS-007  
**Date.** 2026-08-21

A missing generated file that only appears after `next dev` has started produces a 500 page that looks like a product bug. Generate-before-dev, refuse a live stale lock, and validate `/login` at startup so a broken graph is not served.

Evidence: `apps/web/scripts/ids-dev-guard.ts`, `apps/web/scripts/dev.ts`.

## LL-004 — One source of truth prevents configuration drift

**Sprint.** VS-007 (token pipeline) and standing ADR-001 / ADR-003

Copying breakpoint lengths into `globals.css` or keeping a second orchestrator creates two truths. Generated `tokens/generated/breakpoints.css` from `foundation.css`, one Runtime entry, and one Definition Registry are the same lesson at different layers.

See [ERD-003](./DECISION_REGISTER.md#erd-003--one-source-of-truth).

## LL-005 — Git history must exist before the work is only local

**Sprint.** VS-005

Engineering knowledge that never lands in git is conversation residue. [Git Workflow](../foundation-library/04-ENGINEERING/Git-Workflow.md) binds branches, commits, and pull requests so Foundation documents and code share one timeline. Significant development without that timeline cannot be recovered by Engineering HQ.

## LL-006 — Verify before committing

**Sprint.** VS-007, VS-008A, VS-008B

VS-007 forbade commit until quality gates and runtime checks passed. VS-008A/B require founder approval before commit. A green local edit that is not verified is not a close-out.

Definition of Done: [ENGINEERING_CONSTITUTION.md](./ENGINEERING_CONSTITUTION.md).

## LL-007 — Architecture is easier to maintain than repeated patches

**Sprint.** VS-007

Killing PID 3076 once would have restored login until the next missing generate. Guards (stamp, lock, generate, login assert) cost less than diagnosing the same 500 again.

See [ERD-002](./DECISION_REGISTER.md#erd-002--never-fix-the-same-bug-twice).
