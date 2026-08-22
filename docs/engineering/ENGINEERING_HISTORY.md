# Engineering History

**Purpose.** Master timeline of VentureOS engineering sprints.  
**Authority.** Engineering Records. Does not rewrite Foundation Library sprint IDs used in older specification files.  
**Engineering standard.** [Master Engineering Prompt](./MASTER_ENGINEERING_PROMPT.md) · [Engineering Index](./README.md)  
**Last Updated.** 2026-08-22

## Governance Foundation

| Field | Record |
|---|---|
| Programmes | VS-008A, VS-008B, VS-008C |
| Git commit | `ccb585cd54b068280e67401e47dfdbbf7aee0365` |
| Completion date | 2026-08-21 |
| Status | ✅ Governance Foundation Complete |

Pushed to `origin/main`. No GitHub Release. No tag.

## Identifier note

This timeline is the founder-named programme sequence for Engineering HQ (VS-001 through VS-008C).

Existing specification files already used some of the same IDs for other programmes. Those files are not rewritten here:

- `docs/foundation/certification/VS-006-EXECUTIVE-ATMOSPHERE.md` — Executive Atmosphere Completion (dated 2026-08-21)
- `docs/foundation/design-system/EAS-001-Executive-Atmosphere-Architecture.md` — refers to a theme-engine investigation as VS-008 and a Calviora identity question as VS-009
- `docs/foundation/design-system/IDS-002-IntelligenceOS-Design-System-Technical-Specification.md` — migration notes labelled VS-004.2

Engineering HQ must treat this history file as the sprint ledger, and those documents as named evidence, not as a second competing ledger.

Completion dates below are recorded only where a dated artefact exists. Earlier programmes were established by locked architecture and the Foundation Library; their calendar close dates were not separately recorded.

---

## VS-001 — Foundation

| Field | Record |
|---|---|
| Sprint ID | VS-001 |
| Title | Foundation |
| Objective | Establish VentureOS as a locked operating-system foundation: ownership, boundaries, and the desk. |
| Status | Complete (architecture locked) |
| Completion Date | Not separately recorded. Foundation Library v1.1 last updated 2026-08-20. Foundation v1.0 product-development pack dated 2026-08-21. |
| Summary | Foundation v1.0 / v1.1 lock: one orchestrator, capability governance, definition registry, persistence ownership, platform identity, IDS as presentation. Recorded in `apps/web/src/FOUNDATION.md`, `docs/foundation-library/`, and `docs/foundation/release/`. |

## VS-002 — Runtime

| Field | Record |
|---|---|
| Sprint ID | VS-002 |
| Title | Runtime |
| Objective | Make the Executive Intelligence Runtime the only intelligence orchestrator. |
| Status | Complete (locked) |
| Completion Date | Not separately recorded. Certified/locked in the Foundation Certification Index (2026-08-21). |
| Summary | `runExecutiveIntelligenceRuntime` is the only orchestration entry. Pipeline: resolve capabilities, enforce instance profiles, apply event, policy, recommendations, operating health, knowledge graph. Persist is not a Runtime stage. ADR-001. Evidence: `apps/web/src/core/runtime/`. |

## VS-003 — Venture Definitions

| Field | Record |
|---|---|
| Sprint ID | VS-003 |
| Title | Venture Definitions |
| Objective | Make the Definition Registry the only product-definition system. |
| Status | Complete (locked) |
| Completion Date | Not separately recorded. Certified/locked in the Foundation Certification Index (2026-08-21). |
| Summary | Products resolve through the Definition Registry. There is no Product Registry. Instantiation fails fast. Default instance is `ventureos.company@1.0.0`. ADR-003. Evidence: `apps/web/src/core/venture-definition/`. |

## VS-004 — Product Bootstrap

| Field | Record |
|---|---|
| Sprint ID | VS-004 |
| Title | Product Bootstrap |
| Objective | Map founder-facing Products onto Venture Definitions at launch. |
| Status | Complete |
| Completion Date | Not separately recorded. Launch bootstrap tests use a fixture timestamp of 2026-08-18. |
| Summary | The launch wizard presents Products. Each Product resolves to a definition. Unknown products fail before instantiation. Qualora, Calviora, and Farmora run on the OS; they are not separate apps. Evidence: `apps/web/src/modules/ventures/launch/` and `FOUNDATION.md` Product Bootstrap note. |

## VS-005 — Git & GitHub Foundation

| Field | Record |
|---|---|
| Sprint ID | VS-005 |
| Title | Git & GitHub Foundation |
| Objective | Bind how VentureOS history is written so Foundation knowledge and code share one timeline. |
| Status | Complete (workflow documented) |
| Completion Date | Git Workflow document last updated 2026-08-20. |
| Summary | Feature branches, no force-push of `main`, commits for why, pull requests name founder/platform change and Foundation documents. Recorded in `docs/foundation-library/04-ENGINEERING/Git-Workflow.md`. |

## VS-006 — VentureOS Engineering Method

| Field | Record |
|---|---|
| Sprint ID | VS-006 |
| Title | VentureOS Engineering Method |
| Objective | Bind how a sprint is written, constrained, and closed. |
| Status | Complete (standards approved) |
| Completion Date | Sprint Standard and Engineering Standards last updated 2026-08-20. |
| Summary | Named programme with locked context, one objective, constraints, validation, and a single A/B recommendation. Do not hide a Foundation amendment inside a feature sprint. Recorded in `docs/foundation-library/04-ENGINEERING/Sprint-Standard.md` and `Engineering-Standards.md`. |

## VS-007 — Foundation Recovery & Certification

| Field | Record |
|---|---|
| Sprint ID | VS-007 |
| Title | Foundation Recovery & Certification |
| Objective | Identify why the running development application did not consistently show the Executive Design System and Theme, permanently harden the development environment, and certify Foundation v1.1. |
| Status | ✅ FOUNDATION CERTIFIED |
| Completion Date | 2026-08-21 |
| Summary | Root cause was a stale `next dev` process serving a failed CSS graph (`Can't resolve './generated/breakpoints.css'`), not a disconnected Theme Provider or IDS architecture. Hardened generate-before-dev, lock detection, Turbopack stamp invalidation, and login runtime validation. Quality gates passed. Login 200. Executive Light `#f7f6f3` and Executive Dark `#12141a` proven on the running desk. Permanent record: [FOUNDATION_CERTIFICATION_v1.1.md](./FOUNDATION_CERTIFICATION_v1.1.md). |

## VS-008A — Engineering Records Foundation

| Field | Record |
|---|---|
| Sprint ID | VS-008A |
| Title | Engineering Records Foundation |
| Objective | Create the permanent Engineering Records structure and seed it with work completed so far. Do not build Engineering HQ. |
| Status | ✅ Governance Foundation Complete |
| Completion Date | 2026-08-21 |
| Summary | Added `docs/engineering/` as engineering memory and the future data source for Engineering HQ. No application code change. No GitHub Release. No tag. |

## VS-008B — Engineering Governance Foundation

| Field | Record |
|---|---|
| Sprint ID | VS-008B |
| Title | Engineering Governance Foundation |
| Objective | Add the Engineering Constitution and Lessons Learned journal to Engineering Records. Do not build Engineering HQ. |
| Status | ✅ Governance Foundation Complete |
| Completion Date | 2026-08-21 |
| Summary | `ENGINEERING_CONSTITUTION.md` is the engineering rulebook (VES lifecycle, modes, definition of done). `LESSONS_LEARNED.md` records Foundation recovery lessons. README indexes both. No application code change. |

## VS-008C — VentureOS Engineering Creed

| Field | Record |
|---|---|
| Sprint ID | VS-008C |
| Title | VentureOS Engineering Creed |
| Objective | Write the cultural creed for everyone who builds VentureOS and every Venture on it. |
| Status | ✅ Governance Foundation Complete |
| Completion Date | 2026-08-21 |
| Summary | `ENGINEERING_CREED.md` states how engineers think and what they refuse. It does not duplicate the VentureOS Creed or the Engineering Constitution. |

---

## Not on this ledger yet

Engineering HQ (the product workspace) is not started. Qualora, Calviora, and Farmora visual programmes remain on the Foundation Library roadmap (RM-002–RM-004) and are not opened by this history.

The VentureOS Brain programme (VC-001, VC-002, VC-003) is recorded in [BRAIN_PROGRAMME.md](./BRAIN_PROGRAMME.md). The history parser on this page remains the VS-001–VS-008C ledger. VC-010 is not opened.
