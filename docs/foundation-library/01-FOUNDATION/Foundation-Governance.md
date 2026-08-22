# Foundation Governance

**Purpose.** State who owns Foundation artefacts, what is locked, and how an amendment is made.

**Authority.** Governance for Foundation v1.1. Compatible with `apps/web/src/FOUNDATION.md`.

**Audience.** Reviewers, sprint leads, and anyone proposing architecture or IDS change.

**Dependencies.** [Twelve Founding Principles](./Twelve-Founding-Principles.md) · [Legacy Charter](./Legacy-Charter.md)

**Related Documents.** [Master Engineering Prompt](../../engineering/MASTER_ENGINEERING_PROMPT.md) · [Engineering Index](../../engineering/README.md) · [Architecture Decision Register](../05-GOVERNANCE/Architecture-Decision-Register.md) · [Review Process](../04-ENGINEERING/Review-Process.md) · [Release Process](../04-ENGINEERING/Release-Process.md) · [Source Map](../99-APPENDIX/Source-Map.md)

**Status.** Approved

**Version.** 1.1.0

**Owner.** Foundation

**Last Updated.** 2026-08-22

---

The supreme governing document is the [VentureOS Project Constitution](../../PROJECT_CONSTITUTION.md). How work proceeds on this locked foundation is the [Master Engineering Prompt](../../engineering/MASTER_ENGINEERING_PROMPT.md). How the foundation is kept healthy is the [Foundation Runbook](../../engineering/FOUNDATION_RUNBOOK.md). Architecture may change only with explicit founder approval.

## Ownership

| Concern | Owner in code | Library document |
|---|---|---|
| Runtime orchestration | `apps/web/src/core/runtime/` | [Runtime](../02-ARCHITECTURE/Runtime.md) |
| Capability catalogue | `apps/web/src/core/capability/` | [Capability Framework](../02-ARCHITECTURE/Capability-Framework.md) |
| Venture definitions | `apps/web/src/core/venture-definition/` | [Venture Definitions](../02-ARCHITECTURE/Venture-Definitions.md) |
| Persistence | `apps/web/src/platform/persistence/` | [Architecture Overview](../02-ARCHITECTURE/Architecture-Overview.md) |
| Presentation tokens | `packages/ids/` | [IDS](../03-DESIGN/IDS.md) |
| Identity and sessions | `apps/web/src/lib/auth/`, `modules/auth/` | [Engineering Standards](../04-ENGINEERING/Engineering-Standards.md) |
| Desk surfaces | `modules/situation-room`, `ventures`, `executive-office` | [Situation Room](../02-ARCHITECTURE/Situation-Room.md), [Company HQ](../02-ARCHITECTURE/Company-HQ.md), [Executive Office](../02-ARCHITECTURE/Executive-Office.md) |

Pages and the shell are presentational. Capability resolution is governance, not plugin dispatch.

## What is locked

Foundation v1.1 is locked. Locked means:

- Do not modify Runtime behaviour unless a Foundation amendment names that change.
- Do not modify IDS constitution or tokens unless a dedicated IDS programme names that change.
- Do not implement Executive Atmosphere as an architecture fork. [EAS-001](../../foundation/design-system/EAS-001-Executive-Atmosphere-Architecture.md) is design-only until a visual programme ships it.
- Do not introduce a Product Registry, a second orchestrator, or a second type/spacing system.

## How an amendment is made

1. Record the proposal in the [Architecture Decision Register](../05-GOVERNANCE/Architecture-Decision-Register.md) or [Founder Decisions](../05-GOVERNANCE/Founder-Decisions.md).
2. Name the documents and code-adjacent READMEs that must change together.
3. Run the [Review Process](../04-ENGINEERING/Review-Process.md). Architecture, IDS, and definition changes cannot hide inside a feature sprint.
4. Record the outcome in the [Release Register](../05-GOVERNANCE/Release-Register.md).
5. Update this library in the same change set so the knowledge system does not lag the code.

## Programme constraints

Sprints that are not Foundation amendments must not:

- change Runtime, IDS, or Executive Environments
- redesign locked surfaces as a side effect
- leave a second copy of the truth in a README that this library does not link

## Certification

Certification records live under `docs/foundation/certification/`. IDS certification is a presentation concern. It is not Runtime or Capability certification.
