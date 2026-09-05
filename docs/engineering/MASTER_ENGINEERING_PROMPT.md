# VentureOS Master Engineering Prompt

**Status.** Permanent engineering constitution of VentureOS  
**Version.** 1.1.0  
**Date.** 2026-09-05  
**Owner.** Engineering  
**Applies to.** Every sprint, implementation, review, refactor, and bug fix on VentureOS, Qualora, Calviora, Farmora, and every future Venture on this OS  
**Index.** [Engineering Index](./README.md)

This document is the authoritative engineering standard for this repository. It is subordinate to the [VentureOS Project Constitution](../PROJECT_CONSTITUTION.md) and the [VentureOS Platform Constitution](../architecture/VENTUREOS_PLATFORM_CONSTITUTION.md). The Project Constitution is the supreme governing document. If this document and a higher constitution conflict, the higher document wins.

Read it before Diagnostic Mode. Obey it through Verification Mode. Close the sprint against it. Reviews, refactors, and bug fixes follow the same law. Do not start work until the pre-flight checklist is green.

Architecture still answers *what may exist*. This document answers *how a sprint is allowed to proceed*. Engineering may define implementation. Engineering may not redefine architecture.

The [Engineering Constitution](./ENGINEERING_CONSTITUTION.md) remains the VES lifecycle, role-ownership, and mode law. The [Engineering Creed](./ENGINEERING_CREED.md) remains the culture. Sprint write-up shape remains in the Foundation Library [Sprint Standard](../foundation-library/04-ENGINEERING/Sprint-Standard.md). If those documents appear to conflict with this one on checklist, validation, completion, reporting, or current execution-profile details, this document wins unless a higher constitution says otherwise.

---

## 1. Engineering Principles

| Principle | Meaning |
|---|---|
| Production quality only | Ship work that belongs in a company we will still owe in ten years. Prototype quality is not a delivery. |
| No temporary fixes | A workaround that leaves the class of failure alive is unfinished work. Do not land it. |
| Root cause first | Name the cause with evidence before changing code. Guessing is not engineering. |
| Protect architecture | One Runtime, one Capability Registry, one Definition Registry, one persistence owner, IDS as presentation. Do not invent a second source of truth. |
| Minimise technical debt | Accept debt only when it is named, justified, and recorded. Silent debt is a defect. |
| Scalability first | Prefer the change that still holds when the desk, the Ventures, and the team grow. Do not solve only for the file in front of you. |
| Security by default | Fail closed at auth, capability, definition, and secret boundaries. Do not commit secrets. Do not swallow redirect or schema errors. |
| Testability by default | New behaviour is proven at the layer it belongs to. A change that cannot be verified is not done. |

These principles are standing law. They are not optional inside a feature crunch.

---

## 2. Mandatory Pre-flight Checklist

Never continue on an unhealthy foundation. Verify every item below before implementation. If any item fails, stop, recover, and re-run the checklist. Do not start a sprint on a broken desk.

| Check | Prove |
|---|---|
| Git status | Working tree understood. No surprise dirty files. No accidental mix of unrelated work. |
| Current branch | Feature branch for the sprint. Not `main` unless the founder opened a documentation-only exception. |
| Node version | Node 18+ as required by the workspace. |
| pnpm version | Workspace package manager is pnpm. Do not introduce npm or yarn as a second installer. |
| Dependencies | Install and lockfile are consistent. Do not invent missing packages that already exist in the workspace. |
| Generated design tokens | `pnpm --filter @repo/ids generate` (or `generate --check`) succeeds. Tokens come from the pipeline, not from a hand-edited copy. |
| Generated CSS | Generated CSS is present, imported, and valid. No `@custom-media`. No `var()` inside `@media`. No `--breakpoint-*: var(...)`. |
| TypeScript | `pnpm check-types` (or the sprint’s stated type gate) passes. |
| ESLint | `pnpm lint` passes. |
| Tests | Workspace tests pass (`pnpm test`). |
| Build | `pnpm build` (or the sprint’s stated build) passes. |
| Next.js health | The application starts without CSS parse errors, missing generated files, or server crash. |
| Running processes | No stale `next dev` or leftover lock PID serving a failed graph. Recover with `pnpm recover-dev` when the running process disagrees with source. |
| Port availability | The intended port (default 3000) is free, or the occupant is the current healthy server. |
| Localhost accessibility | The running application answers on localhost. A process that is up but unreachable is not healthy. |

If the running process disagrees with source, treat the running process as a first-class suspect. Restarting is recovery, not a root-cause fix.

---

## 3. Development Rules

- One logical change at a time.
- Keep changes small.
- Reuse existing architecture.
- Never duplicate code.
- Never redesign the architecture unless explicitly instructed.
- Never bypass validation.

Further standing rules:

- Do not modify Runtime, IDS constitution or token hex, Capability Registry behaviour, Definition Registry behaviour, persistence ownership, or Executive Environments unless that is the named programme.
- Do not create a second orchestrator, Product Registry, type system, or engineering-memory store.
- Do not mix a Foundation amendment with an unrelated feature.
- Do not leave knowledge only in a conversation. Record facts in this folder.
- The planning and decision layer must select the execution profile before every repository implementation task.
- The founder/operator should not be asked to independently judge which model, reasoning effort, or speed tier to use. The approved implementation packet must state it.

---

## 4. Execution Profile Standard

Every implementation packet must include an **Execution Profile** before repository execution begins. This rule applies to VentureOS, Frigora, Farmora, Qualora, Calviora, and every future Venture built under this engineering system.

### 4.1 Ownership

The planning and decision layer selects the profile based on task complexity, architecture risk, failure history, certification sensitivity, expected context size, speed requirements, and cost. The founder/operator only performs any UI selection required to activate the approved profile.

If the selected tool or model is unavailable, deprecated, materially repriced, or demonstrably unsuitable, stop and return to the planning layer for a replacement profile. Do not improvise an expensive or weaker substitute silently.

### 4.2 Current Cursor routing matrix

The following matrix is the default while these Cursor capabilities remain available:

| Work class | Default execution profile | Use when |
|---|---|---|
| **Routine** | **Cursor Composer 2.5 Standard; Fast OFF** | Read-only repo verification, well-scoped implementation, ordinary tests, straightforward fixes, mechanical refactors within approved scope |
| **Complex** | **Cursor Grok 4.6 Medium; Fast OFF** | Non-trivial debugging, multi-module implementation, ambiguous runtime behaviour after repo inspection, or tasks where routine execution is unlikely to be reliable |
| **Exceptional** | **Cursor Grok 4.6 High; Fast OFF unless explicitly justified** | Architecture-sensitive work, repeated failure after a lower profile, difficult certification blockers, high-risk root-cause analysis, or major cross-cutting implementation |

**Fast mode is opt-in.** It may be selected only when the planning layer states why lower latency is worth the additional cost for that named task.

**On-demand spending is disabled by default.** No implementation packet may authorize paid on-demand usage unless the founder explicitly approves the spend for that task or period. A subscription allowance is a capacity budget, not permission to incur uncapped overage.

### 4.3 Quality rule

The cheapest profile is not automatically the correct profile. The planning layer must choose the **lowest-cost profile that can reliably meet the approved acceptance criteria and certification standard**. If a lower profile produces weak results, repeated failures, architecture uncertainty, or materially more rework, escalate deliberately.

Likewise, the strongest profile is not automatically the best default. Expensive reasoning must have a named engineering reason.

### 4.4 Mandatory implementation-packet header

Every repository implementation packet must begin with a block equivalent to:

```text
EXECUTION PROFILE
Tool: Cursor
Model: <selected model>
Effort: <selected effort, if applicable>
Speed: Standard / Fast
On-demand spend: Disabled / Explicitly approved
Reason: <one sentence explaining why this profile fits the task>
```

The packet must then proceed to mandatory read-only repository verification before any modification.

### 4.5 Future-proofing

Model names, effort labels, prices, and vendors are operational details and may change. The planning layer must periodically reassess this matrix when capabilities or economics materially change. Updating the routing matrix does not weaken the constitutional rule that the planning layer owns execution-profile selection and repository verification remains mandatory.

---

## 5. Root Cause Policy

Every issue must:

1. Identify the root cause.
2. Explain why it occurred.
3. Permanently prevent recurrence.

Never patch symptoms.

A restart, a cache wipe, or a copy-level edit is not a fix if the same class of failure can be generated again. A proven failure gets a guard that fails closed. If the same bug can return, the sprint is not complete.

---

## 6. Validation Requirements

Every sprint must pass the gates that apply to its work. An implementation sprint must pass all of the following before it may be called complete:

| Gate | Requirement |
|---|---|
| Lint | `pnpm lint` |
| Types | `pnpm check-types` |
| Tests | Workspace tests. New behaviour has tests at the layer it belongs to. |
| Build | `pnpm build` |
| Token generation | Design tokens generate cleanly from source. |
| CSS validation | Generated and authored CSS remain parseable. Illegal media CSS is rejected by the pipeline. |
| Application startup | Next.js starts cleanly. No CSS parse errors. No crash on boot. |
| Regression checks | Prior certified behaviour still holds. Locked layers were not silently amended. |

Do not commit on a failed gate. Do not skip a gate because the change “looks small.” Documentation-only sprints skip application implementation and UI verification; they do not skip accuracy, registration, or founder approval to commit.

---

## 7. Git Workflow

- Feature branches. Default integration branch is `main`.
- Conventional commits. Write the why, not a file list.
- Small commits. One logical change per commit.
- Push frequently once the founder has asked to publish, so verified work is not trapped on one machine.
- Never lose work. Do not rewrite shared history. Do not force-push `main`.
- Protect `main`. No unverified land. No Foundation amendment hidden inside a feature branch.

Do not commit secrets, local databases, or `.next` artefacts. Tags and GitHub Releases are not automatic with a push. Release only when the Release Process and the founder require it.

---

## 8. Sprint Completion Standard

A sprint is **not** complete until all of the following are true:

- Code compiles.
- Application runs.
- Feature works.
- Validation passes.
- Documentation updated.
- Remaining risks identified.

Documentation-only sprints still require the documents to exist, the standard to be registered, and remaining risks to be named. A sprint that skips verification is not done. Speed that reopens a certified foundation is not progress.

---

## 9. Reporting Format

Every sprint must end with this close-out. Do not substitute a file list or a chat summary.

### Executive Summary

What changed for the founder or the platform, in plain language. State whether the objective is complete.

### Files Changed

Named files and the reason each exists. Do not dump an unmarked tree.

### Architecture Impact

What was protected. What, if anything, was allowed to change. Confirm that locked layers were not silently amended.

### Technical Debt

Debt accepted, debt closed, and debt refused. Silent debt is a defect. Named debt belongs in [TECHNICAL_DEBT_REGISTER.md](./TECHNICAL_DEBT_REGISTER.md) and, when it is Foundation-layer, in the library register as well.

### Risks

Remaining risks, including unverified surfaces, stale processes, and incomplete product coverage. If a date or fact is unknown, write that it was not recorded.

### Validation Results

Lint, types, tests, build, token generation, CSS validation, application startup, and regression checks — each named as passed, skipped with reason, or failed.

### Recommended Next Sprint

Exactly one recommendation:

- **A** — complete for the stated objective.
- **B** — further work required, with the gap named.

---

## 10. Absolute Rule

Never tell the founder a task is complete until it has been verified in the running application.

A passing test suite is not a substitute for a running desk when the sprint claims a running desk. A generated file is not healthy until the application that consumes it starts cleanly. A commit is not completion. A push is not completion. A statement in chat is not completion.

Completion is a verified running system, or — for a documentation-only sprint — a registered document the founder can read in the tree.
