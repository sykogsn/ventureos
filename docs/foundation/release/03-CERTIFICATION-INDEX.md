# Foundation Certification Index

**Release.** VentureOS Foundation v1.0  
**Date.** 2026-08-21  
**Law.** Certification is layer-specific. One certificate shall not stand for another. IDS certification is not Runtime certification. Layout certification is not Capability certification.

This index is the release map of what is certified, what is locked, and what is only specified.

---

## Certified or locked

| Concern | Status | Evidence | This does not certify |
|---|---|---|---|
| Executive Intelligence Runtime | Locked | `apps/web/src/core/runtime/README.md` · Runtime tests · ADR-001 | Desk appearance |
| Capability Framework | Locked | `apps/web/src/core/capability/README.md` · Capability tests · ADR-002 | A product being ready |
| Venture Definitions | Locked | `apps/web/src/core/venture-definition/README.md` · Definition tests · ADR-003 | Atmosphere painted |
| Persistence ownership | Locked | `apps/web/src/platform/persistence/README.md` · Repository tests · ADR-005 | Intelligence quality |
| Platform identity | Implemented on the desk | Auth module and tests · ADR-006 | Production OAuth/email credentials |
| IntelligenceOS (IDS) | Consumption complete as presentation | IDS-001 · IDS-002 · `packages/ids/` · [VS-008](../certification/VS-008-EXECUTIVE-DESIGN-SYSTEM.md) · ADR-004, ADR-007, ADR-008 | Runtime or capabilities |
| Climate (Light / Dark / System) | Live and persisted | Theme provider · Appearance Settings · VS-008 | A third climate (Midnight / Slate) |
| Platform Constitution | Approved | `docs/architecture/VENTUREOS_PLATFORM_CONSTITUTION.md` | Implementation facts when they disagree with named sources |
| Executive Layout v1 | Certified reference | Authentication (`BrandRail`, `ExecutiveMeasure`) | OS-wide layout |
| Executive Layout v2 | Certified as platform layout foundation | [EXECUTIVE-LAYOUT-V2.md](../certification/EXECUTIVE-LAYOUT-V2.md) | Migration of every product room |
| Twelve Founding Principles | Constitutional | Foundation Library | A sprint ticket |
| Architecture decisions ADR-001–008 | Accepted | Architecture Decision Register | Future amendments |

## Specified, not certified as implemented

| Concern | Status | Evidence |
|---|---|---|
| Executive Atmosphere | Design only | EAS-001 |
| Accessibility Layer 3 (motion / contrast founder overrides) | Specified | Innovation Register IN-002 |
| Chrome split for atmosphere | Specified | EAS-001 · IN-003 |

## Certified with named warnings

| Concern | Warnings |
|---|---|
| Executive Layout v2 | 46 product-room files still compose Tailwind layout. Inspector and Grid are unused by Situation Room, Office, Brain, and HQ. Command dialog uses measure.md (32rem). |
| Executive Design System (VS-008) | Authenticated rooms inherit OsShell but were not session-walked in the certification browser. Dev hydration overlay on VentureMark. Midnight and Slate are not climates. |

## Not certified

- Brain as persistence or as a second Runtime.
- Brain Knowledge Object programme as complete (layout work was paused).
- Calviora headquarters identity (FD-006 open).
- Empty `src/api/*` barrels as an application layer.
- Any product (Qualora, Calviora, Farmora) as a finished marketed headquarters.

## Gate

Foundation v1.0 is certified **ready for product development** on the locked layers above.

Product programmes must still pass the architectural review process. They must not treat this index as permission to amend Runtime, IDS token hex, the Capability Registry, or the Definition Registry.
