# Source Map

**Purpose.** Show which existing repository documents this library reuses, so there is one reading system and no silent fork.

**Authority.** Appendix. Existing files listed here were not deleted. They remain specifications or code-adjacent truth.

**Audience.** Anyone updating Foundation writing.

**Dependencies.** [Legacy Charter](../01-FOUNDATION/Legacy-Charter.md) · [Foundation Governance](../01-FOUNDATION/Foundation-Governance.md)

**Related Documents.** [Start Here](../00-START-HERE.md) · [IDS](../03-DESIGN/IDS.md) · [Runtime](../02-ARCHITECTURE/Runtime.md)

**Status.** Approved

**Version.** 1.1.0

**Owner.** Foundation

**Last Updated.** 2026-08-20

---

DOC-001 did not move locked specifications. Git history on IDS-001, IDS-002, EAS-001, and code-adjacent READMEs stays with those files. The library explains them and links to them.

## Reused (still canonical for their domain)

| Existing document | Library home |
|---|---|
| `apps/web/src/FOUNDATION.md` | [Architecture Overview](../02-ARCHITECTURE/Architecture-Overview.md), [Foundation Governance](../01-FOUNDATION/Foundation-Governance.md) |
| `apps/web/src/core/runtime/README.md` | [Runtime](../02-ARCHITECTURE/Runtime.md) |
| `apps/web/src/core/capability/README.md` | [Capability Framework](../02-ARCHITECTURE/Capability-Framework.md) |
| `apps/web/src/core/venture-definition/README.md` | [Venture Definitions](../02-ARCHITECTURE/Venture-Definitions.md) |
| `apps/web/src/platform/persistence/README.md` | [Architecture Overview](../02-ARCHITECTURE/Architecture-Overview.md) |
| `packages/ids/README.md` | [IDS](../03-DESIGN/IDS.md) |
| `docs/foundation/design-system/IDS-001-…md` | [IDS](../03-DESIGN/IDS.md), [Visual Constitution](../03-DESIGN/Visual-Constitution.md) |
| `docs/foundation/design-system/IDS-002-…md` | [IDS](../03-DESIGN/IDS.md) |
| `docs/foundation/design-system/EAS-001-…md` | [Executive Environment Framework](../02-ARCHITECTURE/Executive-Environment-Framework.md) |
| `docs/foundation/README.md` and domain READMEs | Pointers into this library; specs remain in place |
| Definition catalogue in `catalog.ts` | [Products](../06-PRODUCTS/README.md) |

## Newly authored in this library

Creed, Product Philosophy, Twelve Founding Principles, Legacy Charter, room explanations, design constitutions, engineering operating standards, and all governance registers.

## Conflict policy

If this library and a listed specification disagree on a technical fact, correct the library — unless a Foundation amendment has superseded the specification and the [Release Register](../05-GOVERNANCE/Release-Register.md) says so.

Known open conflict: Calviora identity (catalogue vs EAS-001). Recorded in [A-001](../05-GOVERNANCE/Assumption-Register.md). Not resolved by this library.
