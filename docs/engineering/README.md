# VentureOS Engineering Index

**Purpose.** This folder is the engineering memory of VentureOS and the index of how engineering work is allowed to proceed.

**Status.** Governance Foundation complete (VS-008A–C). Project Constitution registered as supreme law (2026-08-22).  
**Owner.** Engineering  
**Last Updated.** 2026-09-04

These records do not replace the Foundation Library, code-adjacent READMEs, or Runtime/IDS/Definition implementation sources. They index completed engineering work so the desk can remember it. They also name the standard every future change must follow.

## Before you change the tree

Read the [VentureOS Project Constitution](../PROJECT_CONSTITUTION.md). It is the supreme governing document of the repository.

Then read the [Master Engineering Prompt](./MASTER_ENGINEERING_PROMPT.md). Every sprint, implementation, review, refactor, and bug fix follows it by default. Unexplained failures, corrections, and certification follow [§10](./MASTER_ENGINEERING_PROMPT.md#10-diagnostic-correction-and-certification-operating-protocol). Do not start work on an unhealthy foundation. Do not tell the founder a task is complete until it has been verified in the running application.

How the VES lifecycle and modes proceed remains in the [Engineering Constitution](./ENGINEERING_CONSTITUTION.md). How engineers are expected to think remains in the [Engineering Creed](./ENGINEERING_CREED.md). What the platform *is* remains the [VentureOS Platform Constitution](../architecture/VENTUREOS_PLATFORM_CONSTITUTION.md) and the [VentureOS Creed](../foundation-library/01-FOUNDATION/VentureOS-Creed.md).

The Project Constitution is supreme. The Platform Constitution defines architecture. The Master Engineering Prompt is the sprint operating standard. The Engineering Constitution defines the lifecycle. The Engineering Creed defines the culture.

Locked architecture and teaching documents remain at:

- `docs/foundation-library/` — how Foundation is read and governed
- `docs/foundation/` — specifications and the v1.0 release pack
- `apps/web/src/FOUNDATION.md` — ownership and boundaries in code
- `packages/ids/` — IntelligenceOS tokens and bind

## Operating standards

Every future sprint, implementation, review, refactor, and bug fix uses this index.

| Standard | Document |
|---|---|
| Supreme governing document | [VentureOS Project Constitution](../PROJECT_CONSTITUTION.md) |
| Architecture Constitution | [VentureOS Platform Constitution](../architecture/VENTUREOS_PLATFORM_CONSTITUTION.md) |
| Authoritative engineering standard | [Master Engineering Prompt](./MASTER_ENGINEERING_PROMPT.md) |
| Diagnostic, correction, and certification protocol | [Master Engineering Prompt §10](./MASTER_ENGINEERING_PROMPT.md#10-diagnostic-correction-and-certification-operating-protocol) |
| Foundation Runbook | [FOUNDATION_RUNBOOK.md](./FOUNDATION_RUNBOOK.md) |
| Architecture documentation | [Architecture Overview](../foundation-library/02-ARCHITECTURE/Architecture-Overview.md) · [VentureOS Platform Constitution](../architecture/VENTUREOS_PLATFORM_CONSTITUTION.md) |
| Coding standards | [Engineering Standards](../foundation-library/04-ENGINEERING/Engineering-Standards.md) |
| Branch strategy | [Git Workflow](../foundation-library/04-ENGINEERING/Git-Workflow.md) |
| Release process | [Release Process](../foundation-library/04-ENGINEERING/Release-Process.md) |
| Sprint process | [Sprint Standard](../foundation-library/04-ENGINEERING/Sprint-Standard.md) |

If documents conflict, the [Project Constitution](../PROJECT_CONSTITUTION.md) wins first. Architecture wins on *what may exist*. On checklist, validation, completion, or reporting, the Master Engineering Prompt wins over process pages.

## Engineering memory

| Document | Role |
|---|---|
| [MASTER_ENGINEERING_PROMPT.md](./MASTER_ENGINEERING_PROMPT.md) | Permanent engineering constitution: pre-flight, rules, validation, completion, reporting, diagnostic and certification operating protocol (§10) |
| [FOUNDATION_RUNBOOK.md](./FOUNDATION_RUNBOOK.md) | How to keep the certified foundation healthy |
| [ENGINEERING_CREED.md](./ENGINEERING_CREED.md) | Culture: how we think, what we refuse, what we vow |
| [ENGINEERING_CONSTITUTION.md](./ENGINEERING_CONSTITUTION.md) | Rulebook: VES lifecycle, modes, definition of done |
| [LESSONS_LEARNED.md](./LESSONS_LEARNED.md) | Living journal; grows after each major sprint |
| [ENGINEERING_HISTORY.md](./ENGINEERING_HISTORY.md) | Master sprint timeline (VS-001–VS-008C ledger) |
| [BRAIN_PROGRAMME.md](./BRAIN_PROGRAMME.md) | Brain programme close-out (VC-001–VC-003). Not the VS history parser |
| [FOUNDATION_CERTIFICATION_v1.1.md](./FOUNDATION_CERTIFICATION_v1.1.md) | Permanent Foundation v1.1 certification record |
| [DECISION_REGISTER.md](./DECISION_REGISTER.md) | Named decisions with problem / outcome (distinct from ADR / FD) |
| [TECHNICAL_DEBT_REGISTER.md](./TECHNICAL_DEBT_REGISTER.md) | Follow-up items from Foundation Certification v1.1 |
| [RELEASE_HISTORY.md](./RELEASE_HISTORY.md) | Declared Foundation releases as engineering history |
| [CYCLE_EVIDENCE.md](./CYCLE_EVIDENCE.md) | Append-only engineering cycle evidence (ECE) for process intelligence |

The Project Constitution is supreme. The Master Engineering Prompt is the default sprint standard. The Creed is culture. The Constitution is lifecycle law. The Decision Register is the dated acceptances of that law. Lessons Learned is what the sprints taught. History, certification, debt, and releases are the memory HQ will query. Do not copy those tables into the Creed, the Constitution, or the Master Engineering Prompt.

## How to maintain these records

1. **Close every sprint here.** When a VS programme finishes, add a row and a summary to Engineering History in the same change set as the work, or immediately after founder approval. Add a lesson to [LESSONS_LEARNED.md](./LESSONS_LEARNED.md) when the sprint taught something that is not already an ERD row.
2. **Do not invent.** Record only facts established in code, Foundation documents, certification reports, or an approved sprint close-out. If a date is unknown, write that it was not recorded.
3. **One new fact, one register.** Architecture locks belong in the Foundation Library ADR. Founder product calls belong in Founder Decisions. Engineering method, recovery, and HQ-facing memory belong here. Cross-link; do not copy a second unmarked truth.
4. **Debt is named, not licensed.** New follow-up items go in this Technical Debt Register and, when they are Foundation-layer debt, in the library register as well.
5. **Certification is layer-specific.** A new certificate gets its own file. Do not treat IDS certification as Runtime certification.
6. **Do not amend a certified foundation inside a feature sprint.** Freeze is recorded in [FOUNDATION_CERTIFICATION_v1.1.md](./FOUNDATION_CERTIFICATION_v1.1.md).

## Engineering HQ

Engineering HQ is not built in VS-008A.

When it is built, it should consume these files directly as the engineering workspace data source:

- Project Constitution → supreme governing document
- Master Engineering Prompt → authoritative engineering standard
- Foundation Runbook → how the certified foundation is kept healthy
- Creed → how builders are expected to think
- Constitution → VES lifecycle and modes
- Lessons learned → what not to repeat
- History → timeline / sprint memory
- Certification → foundation status on the desk
- Decision register → method the organisation already chose
- Technical debt → work the desk still owes
- Release history → what “certified” named
- Cycle evidence → certified-checkpoint process facts for Engineering HQ

Do not create a parallel engineering database that disagrees with this folder. If HQ needs structured fields, parse or project from these documents; do not fork the memory.
