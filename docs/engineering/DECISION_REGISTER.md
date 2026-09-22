# Decision Register

**Purpose.** Engineering method and recovery decisions that Engineering HQ should remember.  
**Authority.** Engineering Records. Does not replace Architecture Decision Register (ADR) or Founder Decisions (FD).  
**Engineering standard.** [Master Engineering Prompt](./MASTER_ENGINEERING_PROMPT.md) · [Engineering Index](./README.md)  
**Last Updated.** 2026-09-22

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

## ERD-008 — Split builder, independent verifier, and Control

| Field | Record |
|---|---|
| Decision ID | ERD-008 |
| Title | Split builder, independent verifier, and Control |
| Problem | A builder agent can become trapped in self-directed phase changes: inventing successor revisions, rebuilding verification environments, repeating settled pre-flight checks, or treating its own checks as independent verification. That wastes time and weakens assurance. |
| Decision | Adopt the permanent pipeline `CONTROL → CURSOR BUILD → INDEPENDENT VERIFY → CURSOR FIX (only if needed) → NARROW INDEPENDENT RE-VERIFY → CONTROL CERTIFY`. A named packet grants authority only for that packet. Cursor may execute routine safe implementation/test/build work continuously inside scope, but may not self-promote to another phase. Independent Verification Work verifies the running product and does not implement fixes. Control alone authorises transitions and certification. |
| Reason | Preserve the fast Frigora development rhythm while restoring separation of duties, independent product evidence, and bounded phase authority. Avoid approval-by-screenshot loops for routine safe commands while keeping high-risk and permanence operations gated. |
| Outcome | Permanent protocol recorded in `CONTROLLED_DELIVERY_PROTOCOL.md` and inherited by VentureOS, Frigora, Farmora, Qualora, Calviora, and future Ventures. Narrow verification observations generate narrow correction/re-verification rather than full milestone restarts unless evidence proves the candidate unsafe. |
| Status | Accepted — Founder approval 2026-09-12 |
## ERD-009 — Risk-based engineering routing and automatic Astra escalation

| Field | Record |
|---|---|
| Decision ID | ERD-009 |
| Title | Risk-based engineering routing and automatic Astra escalation |
| Problem | A universal implementation-agent rule is inefficient. Routine bounded work does not need the same reasoning depth as concurrency, transaction, persistence, security, offline, migration, or cross-system work. Repeated corrective loops also create approval churn and can hide deeper integrity defects. |
| Decision | Control routes implementation by engineering risk. Cursor is the default implementation owner for bounded low-risk work with settled architecture. GPT-6 Astra / Codex is the default implementation owner for high-risk, cross-cutting, release-critical, and escalated work. One Cursor corrective loop is permitted per engineering concern; if another corrective implementation loop would be required, Control automatically escalates that concern to Astra. Control may escalate immediately when evidence reveals a high-risk class. |
| Reason | Preserve speed on straightforward implementation while applying stronger repo-wide reasoning where silent failure is costly. The routing law prevents endless approval/correction cycles without making Astra the universal executor. |
| Outcome | `AGENTS.md`, `CONTROLLED_DELIVERY_PROTOCOL.md`, `MASTER_ENGINEERING_PROMPT.md`, `ENGINEERING_CONSTITUTION.md`, and the Engineering Index are aligned to one risk-based model for VentureOS, Frigora, Farmora, Qualora, Calviora, and future Ventures. Lovable remains the frontend/visual owner when assigned; Independent Verification Work remains separate; Control alone certifies. |
| Status | Accepted — Founder approval 2026-09-22 |

