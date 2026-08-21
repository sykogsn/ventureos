# VentureOS Engineering Records

**Purpose.** This folder is the engineering memory of VentureOS. It is the permanent record of sprints, certifications, decisions, debt, and releases that Engineering HQ will later read as data.

**Status.** Governance Foundation complete (VS-008A–C)  
**Owner.** Engineering  
**Last Updated.** 2026-08-21

These records do not replace the Foundation Library, code-adjacent READMEs, or Runtime/IDS/Definition implementation sources. They index completed engineering work so the desk can remember it.

How work is allowed to proceed is defined here in the [Engineering Constitution](./ENGINEERING_CONSTITUTION.md). How engineers are expected to think is defined here in the [Engineering Creed](./ENGINEERING_CREED.md). What the platform *is* remains the [VentureOS Platform Constitution](../architecture/VENTUREOS_PLATFORM_CONSTITUTION.md) and the [VentureOS Creed](../foundation-library/01-FOUNDATION/VentureOS-Creed.md).

The Engineering Constitution defines the rules. The Engineering Creed defines the culture.

Locked architecture and teaching documents remain at:

- `docs/foundation-library/` — how Foundation is read and governed
- `docs/foundation/` — specifications and the v1.0 release pack
- `apps/web/src/FOUNDATION.md` — ownership and boundaries in code
- `packages/ids/` — IntelligenceOS tokens and bind

## What lives here

| Document | Role |
|---|---|
| [ENGINEERING_CREED.md](./ENGINEERING_CREED.md) | Culture: how we think, what we refuse, what we vow |
| [ENGINEERING_CONSTITUTION.md](./ENGINEERING_CONSTITUTION.md) | Rulebook: principles, VES lifecycle, modes, definition of done |
| [LESSONS_LEARNED.md](./LESSONS_LEARNED.md) | Living journal; grows after each major sprint |
| [ENGINEERING_HISTORY.md](./ENGINEERING_HISTORY.md) | Master sprint timeline |
| [FOUNDATION_CERTIFICATION_v1.1.md](./FOUNDATION_CERTIFICATION_v1.1.md) | Permanent Foundation v1.1 certification record |
| [DECISION_REGISTER.md](./DECISION_REGISTER.md) | Named decisions with problem / outcome (distinct from ADR / FD) |
| [TECHNICAL_DEBT_REGISTER.md](./TECHNICAL_DEBT_REGISTER.md) | Follow-up items from Foundation Certification v1.1 |
| [RELEASE_HISTORY.md](./RELEASE_HISTORY.md) | Declared Foundation releases as engineering history |

The Creed is culture. The Constitution is standing law. The Decision Register is the dated acceptances of that law. Lessons Learned is what the sprints taught. History, certification, debt, and releases are the memory HQ will query. Do not copy those tables into the Creed or the Constitution.

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

- Creed → how builders are expected to think
- Constitution → how work is allowed to proceed
- Lessons learned → what not to repeat
- History → timeline / sprint memory
- Certification → foundation status on the desk
- Decision register → method the organisation already chose
- Technical debt → work the desk still owes
- Release history → what “certified” named

Do not create a parallel engineering database that disagrees with this folder. If HQ needs structured fields, parse or project from these documents; do not fork the memory.
