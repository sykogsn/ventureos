# IntelligenceOS Design System (IDS)

Presentation tokens and theme binding for VentureOS.

Constitution: `docs/foundation/design-system/IDS-001-IntelligenceOS-Design-System-Foundation.md`  
Specification: `docs/foundation/design-system/IDS-002-IntelligenceOS-Design-System-Technical-Specification.md`

This package does not execute intelligence. It does not import Runtime, the Capability Registry, or the Definition Registry.

- `tokens/` — foundation, surface, and brand custom properties (colour hex lives in foundation colour tokens only)
- `themes/climate.css` — semantic aliases (`--background`, `--text-primary`, `--brand-primary`, `--surface-hover`, …)
- `themes/bind.ts` — maps a Venture Instance `definition.id` to `data-ids-brand`

Colour roles live in `tokens/foundation.css` as `--ids-foundation-color-*`. Climates are Executive Light (`:root`) and Executive Dark (`.dark`) only. Screens consume aliases; they do not hard-code hex.

Surface roles live in `tokens/surfaces.css` as `--ids-foundation-surface-*`. Screens consume `ids-surface`, `ids-surface-elevated`, `ids-surface-panel`, `ids-surface-card`, `ids-surface-modal`, `ids-surface-drawer`, `ids-surface-toolbar`, `ids-surface-sidebar`, and `ids-surface-section`.

Typography roles live in `tokens/foundation.css` as `--ids-foundation-type-*`. Screens consume `ids-display`, `ids-heading`, `ids-metric`, `ids-lead`, `ids-subhead`, `ids-body`, `ids-label`, `ids-caption`, `ids-kicker`, and `ids-code`. Raw Tailwind type utilities are not part of IDS.
