# VentureOS Engineering Constitution

**Status.** Constitutional for engineering method  
**Version.** 1.1.0  
**Date.** 2026-09-12  
**Programme.** VS-008B  
**Owner.** Engineering  
**Amended.** 2026-09-12 — Controlled Delivery & Independent Verification (ERD-008)

This document is the official engineering lifecycle rulebook for VentureOS and every future Venture built on it.

It is subordinate to the [VentureOS Project Constitution](../PROJECT_CONSTITUTION.md) and the [VentureOS Platform Constitution](../architecture/VENTUREOS_PLATFORM_CONSTITUTION.md). The Project Constitution is the supreme governing document of the repository. If this Constitution and a higher constitution conflict, the higher document wins.

The authoritative engineering standard is the [Master Engineering Prompt](./MASTER_ENGINEERING_PROMPT.md). Every sprint, implementation, review, refactor, and bug fix follows it by default. It binds pre-flight, development rules, root-cause policy, validation, git practice, completion, and reporting. If this Constitution and the Master Engineering Prompt appear to conflict on those subjects, the Master Engineering Prompt wins. Index: [Engineering Index](./README.md).

The permanent execution-role law is the [Controlled Delivery & Independent Verification Protocol](./CONTROLLED_DELIVERY_PROTOCOL.md). It defines the default separation between Control, Cursor implementation, Independent Verification Work, correction, re-verification, and certification. It is part of this Constitution's operating law.

It does not replace the Project Constitution or the Platform Constitution. It does not restate locked architecture. Sprint shape remains in the Foundation Library [Sprint Standard](../foundation-library/04-ENGINEERING/Sprint-Standard.md). Accepted method decisions remain in [DECISION_REGISTER.md](./DECISION_REGISTER.md).

---

## 1. Purpose

This document defines **how VentureOS software is engineered**.

It binds the lifecycle, modes, definition of done, and permanent rules that every VS programme must follow. It applies to the operating system and to products that run on it (Qualora, Calviora, Farmora, Frigora, and future Ventures).

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
| Builder and verifier are separate | Control decides; Cursor builds; Independent Verification Work verifies; Control certifies. [ERD-008](./DECISION_REGISTER.md#erd-008--split-builder-independent-verifier-and-control). |
| Quality over speed | A sprint that skips verification is not done. Speed that reopens a certified foundation is not progress. |
| Speed without bureaucracy | Routine safe work inside an authorised packet proceeds continuously. High-risk, phase-transition, architecture, schema, dependency, permanence, deployment, and production operations remain explicitly gated. |

---

## 3. VentureOS Engineering Standard (VES)

Official engineering lifecycle. Stages are sequential unless the founder explicitly re-opens an earlier mode.

```text
Diagnostic Mode
    ↓
Design Mode
    ↓
Founder / Control Approval
    ↓
Implementation Mode — Cursor
    ↓
Independent Running-Product Verification
    ↓
Observation Correction Loop — only if required
    ↓
Control Certification Decision
    ↓
Git Permanence / Push when authorised
    ↓
Release when authorised
```

| Stage | Purpose |
|---|---|
| **Diagnostic Mode** | Prove what is true. Name the root cause with files and runtime evidence. No implementation. |
| **Design Mode** | Name the smallest change that removes that class of failure. State what must not be redesigned. |
| **Founder / Control Approval** | Accept diagnosis, design, scope, acceptance criteria, and the implementation packet before code changes. |
| **Implementation Mode** | Cursor executes only the approved packet, including routine repo inspection, implementation, debugging, tests, typecheck, lint, build, and narrow local runtime checks needed by that packet. |
| **Independent Running-Product Verification** | A separate verifier proves the real product behaviour against the authorised acceptance criteria. The builder does not self-verify as the independent authority. |
| **Observation Correction Loop** | Verification findings become named narrow observations. Cursor fixes only the proven defect and necessary siblings; Independent Work performs narrow re-verification. |
| **Control Certification Decision** | Control interprets builder + verifier evidence and decides IMPLEMENTED / VERIFIED / CERTIFIED state. |
| **Git Permanence / Push** | Record and publish verified/certified history only when the current programme authorises permanence. |
| **Release** | Declare a named release only when Release Process and founder require it. Tags and GitHub Releases are not automatic with a push. |

Pre-flight, validation, completion, and reporting stay in the [Master Engineering Prompt](./MASTER_ENGINEERING_PROMPT.md). Role boundaries and phase locks stay in the [Controlled Delivery Protocol](./CONTROLLED_DELIVERY_PROTOCOL.md). Sprint write-up shape stays in the [Sprint Standard](../foundation-library/04-ENGINEERING/Sprint-Standard.md). Git branch and commit practice stays in [Git Workflow](../foundation-library/04-ENGINEERING/Git-Workflow.md). Release declaration stays in [Release Process](../foundation-library/04-ENGINEERING/Release-Process.md) and [RELEASE_HISTORY.md](./RELEASE_HISTORY.md).

---

## 4. Engineering Modes

### Diagnostic Mode

**Purpose.** Establish facts.

**Rules.** Do not modify application code. Do not guess. Record working vs broken vs root cause vs evidence. If the running process disagrees with source, treat the running process as a first-class suspect (VS-007).

### Design Mode

**Purpose.** Propose the minimal approved change.

**Rules.** Do not implement. Name files, guards, acceptance criteria, and non-goals. Do not redesign Runtime, IDS, Theme Provider, or the desk unless that is the named programme.

### Implementation Mode

**Purpose.** Change only what Design Mode and Control approval named.

**Rules.** No unrelated refactoring. No second source of truth. Update Engineering Records when the change creates a fact this folder must remember.

Routine safe commands inside the authorised packet are not separate governance phases. Cursor may proceed continuously with the read/implement/debug/test/type/lint/build work needed to finish the packet.

A named packet grants authority only for that packet. Cursor must not invent or begin a successor revision, recovery phase, verification environment, independent verification step, certification step, commit/push/PR/release/deployment, schema change, dependency change, or production mutation unless the current packet explicitly authorises it.

At packet completion Cursor returns COMPLETE, PARTIAL, or BLOCKED with evidence, then stops for Control.

### Independent Verification Mode

**Purpose.** Prove the running product matches the authorised acceptance criteria independently of the builder.

**Rules.** The verifier does not implement fixes or certify the milestone. It tests product journeys, permissions, UI/mobile behaviour, evidence, contradictions, regression behaviour, and other runtime claims required by the packet. Narrow product mutation is allowed only when the verification packet explicitly authorises a named fixture/state change.

If a defect is found, Control names an observation/correction packet. The milestone is not restarted merely because of a narrow defect.

### Certification Mode

**Purpose.** Convert evidence into authoritative programme state.

**Rules.** Control alone decides certification. IMPLEMENTED, VERIFIED, and CERTIFIED are distinct states. Automated tests are not independent verification. Independent verification is not certification. A commit/push is not certification.

### Release Mode

**Purpose.** Name what was shipped, if anything is to be shipped.

**Rules.** Never release without verification. Do not invent version numbers absent from [RELEASE_HISTORY.md](./RELEASE_HISTORY.md) and the Foundation [Release Register](../foundation-library/05-GOVERNANCE/Release-Register.md). Tags and GitHub Releases require explicit authority.

---

## 5. Definition of Done

A sprint is complete only when all of the following that apply to that sprint are true:

| Gate | Required |
|---|---|
| Architecture reviewed | Locked layers named; no silent Foundation amendment |
| Root cause understood | Diagnostic written when the sprint is a failure class |
| Solution approved | Founder / Control accepted the design and packet |
| Feature implemented | Only if the sprint is an implementation programme |
| Build passes | `pnpm build` (or the sprint’s stated build) |
| TypeScript passes | `pnpm check-types` |
| Lint passes | `pnpm lint` |
| Tests pass | Workspace tests (`pnpm test`) |
| Runtime checked by builder | Narrow implementation/runtime health evidence where required |
| Independently verified | Required for product-facing claims unless Control explicitly records a justified exception |
| Observation loop closed | Any material verification observations are corrected and narrowly re-verified |
| Control certification decision | Required before the milestone may be called CERTIFIED |
| Git committed | After verification/certification stage and only when authorised |
| GitHub pushed | After commit, when authorised |
| Documentation updated | Engineering Records and, if a Foundation fact changed, the Foundation Library |

Documentation-only sprints skip application implementation and independent product verification unless the document itself changes operational tooling. They are not done until the documents exist and the founder has approved the permanence action.

---

## 6. Engineering Rules

Permanent. Not optional inside a feature crunch.

- Never guess.
- Never implement before understanding.
- Never release without verification.
- Never duplicate architecture (no second orchestrator, no Product Registry, no second type system).
- Never create a second source of truth.
- Never let a builder self-promote into an unauthorised next phase.
- Never treat agent confusion as repository corruption.
- Never restart/reseed/rebuild a valid milestone merely because context was lost. Reuse settled evidence unless contradictory evidence appears.
- Never restart an entire milestone for a narrow verification observation unless evidence proves the candidate fundamentally unsafe or incoherent.
- No engineering knowledge should exist only in conversations. Close the sprint in [ENGINEERING_HISTORY.md](./ENGINEERING_HISTORY.md) and grow [LESSONS_LEARNED.md](./LESSONS_LEARNED.md).

---

## 7. Relationship to the VentureOS Constitution

The [VentureOS Project Constitution](../PROJECT_CONSTITUTION.md) is the supreme governing document of the repository.

The [VentureOS Platform Constitution](../architecture/VENTUREOS_PLATFORM_CONSTITUTION.md) defines **the platform**: one desk, one Runtime, Capability Registry, Definition Registry, persistence ownership, IDS as presentation.

This Engineering Constitution defines the VES lifecycle and separation of duties.

The [Master Engineering Prompt](./MASTER_ENGINEERING_PROMPT.md) defines pre-flight, development rules, validation, completion, and reporting.

The [Controlled Delivery & Independent Verification Protocol](./CONTROLLED_DELIVERY_PROTOCOL.md) defines the operational handoff between Control, builder, independent verifier, correction loop, and certification authority.

If documents appear to conflict, the Project Constitution wins first. Architecture wins on *what may exist*. The Master Engineering Prompt wins on checklist, validation, completion, and reporting. This document wins on lifecycle and mode sequence. The Controlled Delivery Protocol governs role boundaries and phase transitions. None may be used to override a named implementation source of truth (`FOUNDATION.md`, Runtime README, IDS specifications) when a technical fact is in dispute — amend the Constitution that is wrong.
