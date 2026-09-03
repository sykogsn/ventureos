# VentureOS Engineering Constitution

**Status.** Constitutional for engineering method  
**Version.** 1.0.0  
**Date.** 2026-08-21  
**Programme.** VS-008B  
**Owner.** Engineering

This document is the official engineering lifecycle rulebook for VentureOS and every future Venture built on it.

It is subordinate to the [VentureOS Project Constitution](../PROJECT_CONSTITUTION.md) and the [VentureOS Platform Constitution](../architecture/VENTUREOS_PLATFORM_CONSTITUTION.md). The Project Constitution is the supreme governing document of the repository. If this Constitution and a higher constitution conflict, the higher document wins.

The authoritative engineering standard is the [Master Engineering Prompt](./MASTER_ENGINEERING_PROMPT.md). Every sprint, implementation, review, refactor, and bug fix follows it by default. It binds pre-flight, development rules, root-cause policy, validation, git practice, completion, reporting, and the diagnostic, correction, and certification operating protocol ([§10](./MASTER_ENGINEERING_PROMPT.md#10-diagnostic-correction-and-certification-operating-protocol)). If this Constitution and the Master Engineering Prompt appear to conflict on those subjects, the Master Engineering Prompt wins. Index: [Engineering Index](./README.md).

It does not replace the Project Constitution or the Platform Constitution. It does not restate locked architecture. Sprint shape remains in the Foundation Library [Sprint Standard](../foundation-library/04-ENGINEERING/Sprint-Standard.md). Accepted method decisions remain in [DECISION_REGISTER.md](./DECISION_REGISTER.md).

---

## 1. Purpose

This document defines **how VentureOS software is engineered**.

It binds the lifecycle, modes, definition of done, and permanent rules that every VS programme must follow. It applies to the operating system and to products that run on it (Qualora, Calviora, Farmora, and future Ventures).

Architecture answers *what the platform is*. This Constitution answers *how work is allowed to proceed*.

---

## 2. Engineering Principles

These principles are the same method already accepted as ERD-001–ERD-008. They are stated here as standing law, not as a second unmarked copy of those outcomes.

| Principle | Meaning |
|---|---|
| Investigate before implementing | Written diagnostic with evidence before code. [ERD-001](./DECISION_REGISTER.md#erd-001--diagnose-before-implementing). |
| Evidence before approval | Founder approval is on a named root cause and a named design, not on a guess. |
| Root cause over symptoms | Restarting a process or patching a copy is not a fix if the class of failure remains. [ERD-002](./DECISION_REGISTER.md#erd-002--never-fix-the-same-bug-twice). |
| Foundation before features | Locked layers and a certified running foundation come before product headquarters paint. [ERD-006](./DECISION_REGISTER.md#erd-006--freeze-certified-foundation), [ERD-007](./DECISION_REGISTER.md#erd-007--build-qualora-only-after-foundation-certification). |
| One source of truth | One orchestrator, one definition registry, one generated token pipeline, one engineering-memory folder. [ERD-003](./DECISION_REGISTER.md#erd-003--one-source-of-truth). |
| Never fix the same bug twice | A proven development-environment failure gets a guard that fails closed. |
| VentureOS builds itself | Engineering knowledge is recorded in-repo so Engineering HQ can consume it. [ERD-004](./DECISION_REGISTER.md#erd-004--ventureos-builds-itself). |
| Quality over speed | A sprint that skips verification is not done. Speed that reopens a certified foundation is not progress. |

---

## 3. VentureOS Engineering Standard (VES)

Official engineering lifecycle. Stages are sequential unless the founder explicitly re-opens an earlier mode.

```
Diagnostic Mode
    ↓
Design Mode
    ↓
Founder Approval
    ↓
Implementation Mode
    ↓
Verification Mode
    ↓
Git Commit
    ↓
GitHub Push
    ↓
Release
```

| Stage | Purpose |
|---|---|
| **Diagnostic Mode** | Prove what is true. Name the single root cause with files and runtime evidence. No implementation. |
| **Design Mode** | Name the smallest change that removes that class of failure. State what must not be redesigned. |
| **Founder Approval** | The founder accepts the diagnosis and the design before code changes (or accepts a documentation-only design). |
| **Implementation Mode** | Execute only the approved design. No side-quest architecture. |
| **Verification Mode** | Run the quality gates and the runtime checks the sprint named. Do not commit on a failed gate. |
| **Git Commit** | Record the why on the branch after verification. Only when the founder has asked, or the sprint has reached this stage with approval. |
| **GitHub Push** | Publish the verified history to the remote. Not a substitute for verification. |
| **Release** | Declare a named release only when the Release Process and founder require it. Tags and GitHub Releases are not automatic with a push. |

Pre-flight, validation, completion, reporting, and the diagnostic / certification operating protocol stay in the [Master Engineering Prompt](./MASTER_ENGINEERING_PROMPT.md). Sprint write-up shape (context, objective, constraints, validation, A/B close) stays in the [Sprint Standard](../foundation-library/04-ENGINEERING/Sprint-Standard.md). Git branch and commit practice stays in [Git Workflow](../foundation-library/04-ENGINEERING/Git-Workflow.md). Release declaration stays in [Release Process](../foundation-library/04-ENGINEERING/Release-Process.md) and [RELEASE_HISTORY.md](./RELEASE_HISTORY.md). Index: [Engineering Index](./README.md).

---

## 4. Engineering Modes

### Diagnostic Mode

**Purpose.** Establish facts.

**Rules.** Do not modify application code. Do not guess. Record working vs broken vs root cause vs evidence. If the running process disagrees with source, treat the running process as a first-class suspect (VS-007). The diagnostic report fields, ownership classes, and Cursor-first execution rule are [Master Engineering Prompt §10](./MASTER_ENGINEERING_PROMPT.md#10-diagnostic-correction-and-certification-operating-protocol).

### Design Mode

**Purpose.** Propose the minimal approved change.

**Rules.** Do not implement. Name files, guards, and non-goals. Do not redesign Runtime, IDS, Theme Provider, or the desk unless that is the named programme.

### Implementation Mode

**Purpose.** Change only what Design Mode and founder approval named.

**Rules.** No unrelated refactoring. No second source of truth. Update Engineering Records when the change creates a fact this folder must remember.

### Verification Mode

**Purpose.** Prove the implementation matches the objective.

**Rules.** Run lint, types, tests, and build as the sprint requires. Verify runtime (and UI where the sprint requires it). During diagnosis and correction, use the targeted-first verification ladder in [Master Engineering Prompt §10.5](./MASTER_ENGINEERING_PROMPT.md#105-targeted-first-verification); that ladder does not waive full-suite sprint completion. If a verification-only or certification gate fails, hangs, cancels, or exits unexpectedly, stop that run and return to Diagnostic Mode. Do not silently repair during verification-only. Do not commit on a failed gate.

### Release Mode

**Purpose.** Name what was shipped, if anything is to be shipped.

**Rules.** Never release without verification. Do not invent version numbers absent from [RELEASE_HISTORY.md](./RELEASE_HISTORY.md) and the Foundation [Release Register](../foundation-library/05-GOVERNANCE/Release-Register.md). VS-007 and VS-008A/B forbade tags and GitHub Releases unless the founder opens Release Mode.

---

## 5. Definition of Done

A sprint is complete only when all of the following that apply to that sprint are true:

| Gate | Required |
|---|---|
| Architecture reviewed | Locked layers named; no silent Foundation amendment |
| Root cause understood | Diagnostic written when the sprint is a failure class |
| Solution approved | Founder (or named approver) accepted the design |
| Feature implemented | Only if the sprint is an implementation programme |
| Build passes | `pnpm build` (or the sprint’s stated build) |
| TypeScript passes | `pnpm check-types` |
| Lint passes | `pnpm lint` |
| Tests pass | Workspace tests (`pnpm test`) |
| Runtime verified | The running app matches the claim (for example login 200) |
| UI verified | Where the sprint claims a visible change |
| Git committed | After verification, and after founder approval to commit |
| GitHub pushed | After commit, when the founder has asked to publish |
| Documentation updated | Engineering Records and, if a Foundation fact changed, the Foundation Library |

Documentation-only sprints (VS-008A, VS-008B) skip application implementation and UI verification. They are not done until the documents exist and the founder has approved the commit.

---

## 6. Engineering Rules

Permanent. Not optional inside a feature crunch.

- Never guess.
- Never implement before understanding.
- Never release without verification.
- Never duplicate architecture (no second orchestrator, no Product Registry, no second type system).
- Never create a second source of truth.
- No engineering knowledge should exist only in conversations. Close the sprint in [ENGINEERING_HISTORY.md](./ENGINEERING_HISTORY.md) and grow [LESSONS_LEARNED.md](./LESSONS_LEARNED.md).

---

## 7. Relationship to the VentureOS Constitution

The [VentureOS Project Constitution](../PROJECT_CONSTITUTION.md) is the supreme governing document of the repository.

The [VentureOS Platform Constitution](../architecture/VENTUREOS_PLATFORM_CONSTITUTION.md) defines **the platform**: one desk, one Runtime, Capability Registry, Definition Registry, persistence ownership, IDS as presentation.

This Engineering Constitution defines the VES lifecycle: diagnose, design, approve, implement, verify, then commit, push, and release.

The [Master Engineering Prompt](./MASTER_ENGINEERING_PROMPT.md) defines pre-flight, development rules, root-cause policy, validation, completion, reporting, and the diagnostic, correction, and certification operating protocol for every sprint, implementation, review, refactor, and bug fix.

If documents appear to conflict, the Project Constitution wins first. Architecture wins on *what may exist*. The Master Engineering Prompt wins on checklist, validation, completion, and reporting. This document wins on lifecycle and mode sequence. Neither may be used to override a named implementation source of truth (`FOUNDATION.md`, Runtime README, IDS specifications) when a technical fact is in dispute — amend the Constitution that is wrong.
