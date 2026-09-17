# VentureOS Master Engineering Prompt

**Status.** Permanent engineering constitution of VentureOS  
**Version.** 1.3.0  
**Date.** 2026-09-17  
**Owner.** Engineering  
**Applies to.** Every sprint, implementation, review, refactor, and bug fix on VentureOS, Qualora, Calviora, Farmora, Frigora, and every future Venture on this OS  
**Index.** [Engineering Index](./README.md)  
**Delivery law.** [Controlled Delivery & Independent Verification Protocol](./CONTROLLED_DELIVERY_PROTOCOL.md)

This document is the authoritative engineering standard for this repository. It is subordinate to the [VentureOS Project Constitution](../PROJECT_CONSTITUTION.md) and the [VentureOS Platform Constitution](../architecture/VENTUREOS_PLATFORM_CONSTITUTION.md). The Project Constitution is the supreme governing document. If this document and a higher constitution conflict, the higher document wins.

Read it before Diagnostic Mode. Obey it through certification. Close the sprint against it. Reviews, refactors, and bug fixes follow the same law. Do not start work until the pre-flight checklist is green.

Architecture still answers *what may exist*. This document answers *how a sprint is allowed to proceed*. Engineering may define implementation. Engineering may not redefine architecture.

The [Engineering Constitution](./ENGINEERING_CONSTITUTION.md) remains the VES lifecycle and mode law. The [Controlled Delivery Protocol](./CONTROLLED_DELIVERY_PROTOCOL.md) is the permanent execution-role and phase-transition law. The [Engineering Creed](./ENGINEERING_CREED.md) remains the culture. Sprint write-up shape remains in the Foundation Library [Sprint Standard](../foundation-library/04-ENGINEERING/Sprint-Standard.md).

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
| Separation of duties | Control decides; Astra builds by default; Cursor adversarially reviews or implements only when Control assigns ownership; Independent Verification Work verifies; Control certifies. |
| One writer at a time | Astra and Cursor must not concurrently edit the same candidate. Control owns implementation handoff. |
| Speed without bureaucracy | Routine safe work inside an authorised packet proceeds continuously. Only material scope/risk/permanence transitions return to Control. |

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
| Generated design tokens | `pnpm --filter @repo/ids generate` (or `generate --check`) succeeds when relevant. Tokens come from the pipeline, not from a hand-edited copy. |
| Generated CSS | Generated CSS is present, imported, and valid. No `@custom-media`. No `var()` inside `@media`. No `--breakpoint-*: var(...)`. |
| TypeScript | `pnpm check-types` (or the sprint’s stated type gate) passes. |
| ESLint | `pnpm lint` passes. |
| Tests | Workspace tests pass (`pnpm test`). |
| Build | `pnpm build` (or the sprint’s stated build) passes. |
| Next.js health | The application starts without CSS parse errors, missing generated files, or server crash. |
| Running processes | No stale `next dev` or leftover lock PID serving a failed graph. Recover with `pnpm recover-dev` when the running process disagrees with source. |
| Port availability | The intended port is free, or the occupant is the current healthy server. |
| Localhost accessibility | The running application answers on localhost. A process that is up but unreachable is not healthy. |

A green pre-flight is reusable evidence inside the same authorised packet. Do not repeatedly re-run the same baseline checks merely because an agent lost conversational context. Re-run pre-flight when a phase genuinely starts, when the environment materially changes, or when contradictory evidence appears.

If the running process disagrees with source, treat the running process as a first-class suspect. Restarting is recovery, not a root-cause fix.

---

## 3. Controlled Delivery Roles and Phase Lock

The default high-risk / product-facing delivery pipeline is:

`CONTROL → ASTRA BUILD → CURSOR ADVERSARIAL REVIEW (when warranted) → ASTRA CORRECTION (only if Control accepts a finding) → INDEPENDENT VERIFY → NARROW INDEPENDENT RE-VERIFY (if needed) → CONTROL CERTIFY`

The default low-risk fast path is:

`CONTROL → ASTRA BUILD → AUTOMATED EVIDENCE → CONTROL CLOSE`

Control decides which path applies.

### Control

Control owns architecture, scope, sequencing, acceptance criteria, implementation packets, review packets, verification packets, interpretation of evidence, agent routing, phase transitions, and certification.

### Astra / primary implementation agent

GPT-6 Astra / Codex is the default primary engineering executor. Astra owns repo-grounded implementation inside the currently authorised packet. It may inspect, implement, debug, run automated tests, typecheck, lint, build, and perform narrow local runtime checks required by that packet.

A named packet grants authority only for that packet. Astra MUST NOT infer or invent the next revision or phase. Completion of `IMP` does not authorise a successor revision, environment phase, independent verification, certification, commit, push, PR, release, deployment, schema changes, dependency changes, or production mutation unless the current packet explicitly grants that authority.

At the end of its packet Astra returns COMPLETE, PARTIAL, or BLOCKED with evidence and stops.

### Cursor / adversarial reviewer and secondary implementation agent

Cursor's default role is read-only adversarial review of the current candidate. It may inspect source, tests, persistence, architecture, diffs, evidence, and regression risk and report concrete findings to Control.

Cursor MUST NOT modify Astra's active candidate during review. Cursor becomes implementation owner only when Control explicitly transfers ownership for a named packet or correction. When ownership changes, the previous implementation agent stops editing that candidate.

### Lovable

Lovable remains the preferred implementation owner for frontend and visual refinement when Control explicitly assigns that scope.

### Independent Verification Work

Independent Work verifies the running product against the authorised acceptance criteria. It does not implement fixes and does not certify. It is the independent product-evidence authority, not a second builder.

### Control certification

Control alone converts the evidence into authoritative state. IMPLEMENTED, VERIFIED, and CERTIFIED remain distinct.

---

## 4. Routine Execution Fast Path

Do not turn ordinary engineering into an approval-by-screenshot loop.

Inside an authorised implementation packet, the current implementation owner may proceed continuously with routine safe work, including:

- read-only Git inspection;
- reading source/docs/configuration;
- scoped code changes inside the authorised design;
- focused and affected tests;
- regression tests;
- `pnpm check-types`;
- `pnpm lint`;
- `pnpm test`;
- `pnpm build`;
- normal local startup and narrow health checks required by the packet.

A tool or IDE may still request a security approval click. That UI requirement does not create a new governance phase.

Stop and return to Control before any unapproved:

- dependency or lockfile change;
- schema/migration change;
- architecture change;
- destructive Git/file operation;
- branch/worktree creation outside the authorised setup;
- stage/commit/push/PR/merge/release/deploy;
- production data mutation;
- dedicated verification environment creation;
- independent verification start;
- successor milestone/revision/phase;
- implementation ownership transfer to another agent.

---

## 5. Development Rules

- One logical change at a time.
- Keep changes small.
- Reuse existing architecture.
- Never duplicate code.
- Never redesign the architecture unless explicitly instructed.
- Never bypass validation.
- Never self-promote from one named packet to another.
- Never treat agent confusion as repository corruption.
- Never allow two implementation agents to edit the same candidate concurrently.
- Use isolated branches/worktrees for comparative or benchmark implementations.

Further standing rules:

- Do not modify Runtime, IDS constitution or token hex, Capability Registry behaviour, Definition Registry behaviour, persistence ownership, or Executive Environments unless that is the named programme.
- Do not create a second orchestrator, Product Registry, type system, or engineering-memory store.
- Do not assume a marketed customer product should display generic VentureOS branding. Real customer deployments must present the correct Venture-branded login and application identity. Internal, development, and verification surfaces may keep a generic VentureOS shell. See the [Project Constitution](../PROJECT_CONSTITUTION.md) (Customer-Facing Product Sovereignty), FD-007, and ADR-010.
- Do not mix a Foundation amendment with an unrelated feature.
- Do not leave knowledge only in a conversation. Record facts in this folder.

---

## 6. Root Cause Policy

Every issue must:

1. Identify the root cause.
2. Explain why it occurred.
3. Permanently prevent recurrence.

Never patch symptoms.

A restart, a cache wipe, or a copy-level edit is not a fix if the same class of failure can be generated again. A proven failure gets a guard that fails closed. If the same bug can return, the sprint is not complete.

Agent context loss or unauthorised phase jumping is a process error, not proof that the repository or certified baseline is corrupt. Do not restart, reseed, or rebuild a milestone solely because an agent became confused.

---

## 7. Validation Requirements

Every sprint must pass the gates that apply to its work. An implementation sprint must pass all applicable automated gates before it may be called IMPLEMENTED:

| Gate | Requirement |
|---|---|
| Lint | `pnpm lint` |
| Types | `pnpm check-types` |
| Tests | Workspace tests. New behaviour has tests at the layer it belongs to. |
| Build | `pnpm build` |
| Token generation | Design tokens generate cleanly from source when affected. |
| CSS validation | Generated and authored CSS remain parseable when affected. |
| Application startup | Next.js starts cleanly when the product/runtime claim requires it. |
| Regression checks | Prior certified behaviour still holds. Locked layers were not silently amended. |

For product-facing and high-risk milestones, automated gates are followed by independent running-product verification unless Control explicitly records a justified exception.

Do not commit on a failed gate. Do not skip a gate because the change “looks small.” Documentation-only sprints skip application implementation and product verification; they do not skip accuracy, registration, or founder approval to commit.

---

## 8. Independent Verification and Observation Loop

Independent verification tests the running product rather than trusting the builder’s narrative.

If verification passes, return the evidence to Control.

If adversarial review or independent verification finds a defect:

1. Control validates the finding and creates a named OBS / correction scope.
2. Control assigns exactly one implementation owner.
3. The implementation owner corrects only the proven defect and necessary siblings.
4. The implementation owner runs affected automated regression.
5. Independent Work performs narrow re-verification when product evidence is required.
6. Control closes or reopens the observation.

Do not restart the entire milestone for a narrow observation unless evidence proves the candidate fundamentally unsafe or incoherent.

---

## 9. Git Workflow

- Feature branches. Default integration branch is `main`.
- Conventional commits. Write the why, not a file list.
- Small commits. One logical change per commit.
- Push frequently once Control/founder has asked to publish, so verified work is not trapped on one machine.
- Never lose work. Do not rewrite shared history. Do not force-push `main`.
- Protect `main`. No unverified land. No Foundation amendment hidden inside a feature branch.
- Comparative implementation work must use isolated branches/worktrees.

Do not commit secrets, local databases, or `.next` artefacts. Tags and GitHub Releases are not automatic with a push. Release only when the Release Process and the founder require it.

---

## 10. Sprint Completion Standard

A sprint is **not** complete until all of the following that apply are true:

- Code compiles.
- Application runs.
- Feature works.
- Automated validation passes.
- Product-facing claims are independently verified where required.
- Material observations are closed.
- Control has made the required certification decision.
- Documentation is updated.
- Remaining risks are identified.

Documentation-only sprints still require the documents to exist, the standard to be registered, and remaining risks to be named. A sprint that skips required verification is not done. Speed that reopens a certified foundation is not progress.

---

## 11. Reporting Format

Every sprint must end with this close-out. Do not substitute a file list or a chat summary.

### Executive Summary

What changed for the founder or the platform, in plain language. State whether the objective is implemented, independently verified, and/or certified.

### Files Changed

Named files and the reason each exists. Do not dump an unmarked tree.

### Architecture Impact

What was protected. What, if anything, was allowed to change. Confirm that locked layers were not silently amended.

### Technical Debt

Debt accepted, debt closed, and debt refused. Silent debt is a defect. Named debt belongs in [TECHNICAL_DEBT_REGISTER.md](./TECHNICAL_DEBT_REGISTER.md) and, when Foundation-layer, in the library register as well.

### Risks

Remaining risks, including unverified surfaces, stale processes, and incomplete product coverage. If a date or fact is unknown, write that it was not recorded.

### Validation Results

Automated gates, adversarial review, and independent running-product verification are reported separately where applicable. Each is passed, skipped with reason, failed, or not established.

### Recommended Next Step

Exactly one recommendation. The builder or reviewer may recommend; it may not self-authorise the next phase.

---

## 12. Absolute Rules

Never tell the founder a task is complete until the required evidence exists.

A passing test suite is not a substitute for independent running-product verification when the milestone claims real product behaviour. A generated file is not healthy until the application that consumes it starts cleanly where runtime health is part of the claim. A commit is not completion. A push is not completion. A statement in chat is not completion.

No implementation or review agent may promote itself into the next named programme phase. Only Control authorises phase transitions, implementation ownership transfers, and certification.

Completion is a verified running system, or — for a documentation-only sprint — a registered document the founder can read in the tree.
