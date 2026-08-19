# IntelligenceOS Design System (IDS)

Presentation tokens and theme binding for VentureOS.

Constitution: `docs/foundation/design-system/IDS-001-IntelligenceOS-Design-System-Foundation.md`  
Specification: `docs/foundation/design-system/IDS-002-IntelligenceOS-Design-System-Technical-Specification.md`

This package does not execute intelligence. It does not import Runtime, the Capability Registry, or the Definition Registry.

- `tokens/` — foundation and brand custom properties (hex lives here only)
- `themes/climate.css` — semantic aliases (`--background`, `--accent`, …)
- `themes/bind.ts` — maps a Venture Instance `definition.id` to `data-ids-brand`

Typography roles live in `tokens/foundation.css` as `--ids-foundation-type-*`. Screens consume `ids-display`, `ids-heading`, `ids-metric`, `ids-lead`, `ids-subhead`, `ids-body`, `ids-label`, `ids-caption`, `ids-kicker`, and `ids-code`. Raw Tailwind type utilities are not part of IDS.
