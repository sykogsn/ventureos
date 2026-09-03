# Decision Register

**Purpose.** Engineering method and recovery decisions that Engineering HQ should remember.  
**Authority.** Engineering Records. Does not replace Architecture Decision Register (ADR) or Founder Decisions (FD).  
**Engineering standard.** [Master Engineering Prompt](./MASTER_ENGINEERING_PROMPT.md) · [Engineering Index](./README.md)  
**Last Updated.** 2026-09-03

Cross-links:

- Architecture: `docs/foundation-library/05-GOVERNANCE/Architecture-Decision-Register.md`
- Founder product calls: `docs/foundation-library/05-GOVERNANCE/Founder-Decisions.md`

---

## ERD-001 — Diagnose before implementing

| Field | Record |
|---|---|
| Decision ID | ERD-001 |
| Title | Diagnose before implementing |
| Problem | The running desk can look “unstyled” or themeless while production builds pass. Guessing leads to redesigning IDS or Theme Provider. |
| Decision | Complete a written diagnostic with evidence before changing code. VS-007 Phase 1 forbade edits until the single root cause was named. |
| Reason | Sprint Standard: locked context, one objective, validation. Foundation Governance: do not hide architecture change inside a feature sprint. |
| Outcome | VS-007 found a stale Turbopack CSS graph, not a disconnected design system. Hardening targeted the development environment. |
| Status | Accepted |

## ERD-002 — Never fix the same bug twice

| Field | Record |
|---|---|
| Decision ID | ERD-002 |
| Title | Never fix the same bug twice |
| Problem | Restarting `next dev` once hides a class of failures (missing generated files, stale locks, cached failed CSS) until the next token-pipeline change. |
| Decision | When a development-environment failure is proven, add a guard that fails closed: generate before start, refuse a live stale lock, invalidate token-stamped Turbopack cache, validate login CSS at startup. |
| Reason | Engineering Standards quality bar: fail fast. VS-007 objective was to eliminate the class, not only restore one session. |
| Outcome | `apps/web/scripts/ids-dev-guard.ts` and `scripts/dev.ts` are the guard. A second `next dev` while PID 3076 lived was refused until that process was stopped. |
| Status | Accepted |

## ERD-003 — One source of truth

| Field | Record |
|---|---|
| Decision ID | ERD-003 |
| Title | One source of truth |
| Problem | Copied breakpoint values, dual documentation, and a second orchestrator all produce drift. |
| Decision | Generated IDS breakpoint CSS is emitted from `tokens/foundation.css`. Runtime has one orchestrator. Definitions have one registry. Engineering memory for HQ lives in `docs/engineering/` and cross-links Foundation documents instead of duplicating unmarked copies. |
| Reason | Twelve Founding Principles 1–4. Engineering Standards: do not leave a second unmarked copy of the truth. ADR-001, ADR-003. |
| Outcome | VS-007 kept static `@theme` lengths in generated CSS rather than patching `globals.css`. Foundation Library remains the teaching source; this folder is the sprint/certification memory. |
| Status | Accepted |

## ERD-004 — VentureOS builds itself

| Field | Record |
|---|---|
| Decision ID | ERD-004 |
| Title | VentureOS builds itself |
| Problem | Engineering knowledge that lives only in chat is lost. A later Engineering HQ would have nothing canonical to consume. |
| Decision | VentureOS records its own engineering history, certifications, decisions, debt, and releases in-repo. HQ will read those records rather than a parallel tracker. |
| Reason | VS-008A objective. Git Workflow: Foundation knowledge and code share one timeline. |
| Outcome | `docs/engineering/` seeded 2026-08-21. HQ is not built yet. |
| Status | Accepted |

## ERD-005 — Engineering HQ becomes the engineering workspace

| Field | Record |
|---|---|
| Decision ID | ERD-005 |
| Title | Engineering HQ becomes the engineering workspace |
| Problem | Sprints, debt, and certification are not yet visible on the desk. |
| Decision | Engineering HQ, when built, is the workspace that consumes Engineering Records directly. VS-008A creates records only; it does not build HQ. |
| Reason | Founder programme split: VS-008A records, later HQ UI. Do not invent a second engineering database. |
| Outcome | Pending HQ programme. Records exist for that programme to read. |
| Status | Accepted (HQ not implemented) |

## ERD-006 — Freeze certified foundation

| Field | Record |
|---|---|
| Decision ID | ERD-006 |
| Title | Freeze certified foundation |
| Problem | Feature sprints reopen Runtime, IDS hex, Theme Provider, or layout as side quests. |
| Decision | After Foundation Certification v1.1, do not amend locked layers unless a named Foundation amendment says so. VS-007 stopped Qualora, Calviora, Farmora, Knowledge Objects, UI, themes-as-features, browser-automation programmes, and releases until recovery completed. |
| Reason | FD-005 (Foundation v1.1 is locked). Foundation Governance lock list. Certification Index gate. |
| Outcome | VS-007 certified without redesigning IDS, Theme Provider, or Runtime. |
| Status | Accepted |

## ERD-007 — Build Qualora only after Foundation certification

| Field | Record |
|---|---|
| Decision ID | ERD-007 |
| Title | Build Qualora only after Foundation certification |
| Problem | Product headquarters paint on an uncertified or broken development foundation produces false “design system” failures. |
| Decision | Do not open Qualora (or Calviora / Farmora) visual programmes until Foundation v1.1 is certified. Roadmap still sequences Qualora after atmosphere plumbing (RM-002). |
| Reason | VS-007 stop-work. FD-003 products run on the OS. RM-002. |
| Outcome | Certification recorded 2026-08-21. Qualora visual programme is not opened by VS-008A. |
| Status | Accepted |

## ERD-008 — Cursor-first diagnosis and certification discipline

| Field | Record |
|---|---|
| Decision ID | ERD-008 |
| Title | Cursor-first diagnosis and certification discipline |
| Problem | Unexplained failures were being chased with pasted guardrail prompts and founder-operated terminal sequences. Assertions could pass while a process hung or exited non-zero, and speculative stacked fixes mixed with verification-only runs. |
| Decision | Refine ERD-001: Cursor is the default execution environment for inspection, commands, tests, diagnostics, and read-only Git. Unexplained failures receive a read-only diagnostic report (root cause, evidence, ownership A–D, smallest correction, rebuild, regression, certification impact, confidence) before code changes. One hypothesis receives one authorised correction. Targeted verification precedes the full suite and does not waive sprint-completion gates. A failing or hanging verification-only gate stops; it does not silently repair. Dirty files are classified before staging. Exact-path staging only; never `git add .` or `git add -A`. Certification reports assertions and process-exit evidence. Approved process improvements are written into the Master Engineering Prompt so future Ventures inherit them. |
| Reason | Frigora F2.0 certification: a hanging `visit-evidence` FileTest was diagnosed as a VentureOS kernel scheduler side-effect of `getPlatform()`, not as domain-logic failure. Constrained Cursor diagnosis outperformed manual terminal loops. [LL-008](./LESSONS_LEARNED.md#ll-008--cursor-read-only-diagnosis-before-correction). |
| Outcome | Standing law in [Master Engineering Prompt §10](./MASTER_ENGINEERING_PROMPT.md#10-diagnostic-correction-and-certification-operating-protocol). Cursor alwaysApply rule points at §10. Engineering Constitution Diagnostic and Verification Modes aligned. Git Workflow exact-path staging aligned. |
| Status | Accepted |
