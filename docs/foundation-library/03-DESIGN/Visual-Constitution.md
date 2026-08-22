# Visual Constitution

**Purpose.** Bind visual rank, climate, surface, and colour so screens cannot invent a second grammar.

**Authority.** Library constitution derived from IDS-001 and IDS-002. Subordinate to the [VentureOS Project Constitution](../../PROJECT_CONSTITUTION.md). Token values live in `packages/ids/tokens/`.

**Audience.** Designers and engineers implementing screens.

**Dependencies.** [IDS](./IDS.md)

**Related Documents.** [VentureOS Project Constitution](../../PROJECT_CONSTITUTION.md) · [Interaction Constitution](./Interaction-Constitution.md) · [Accessibility](./Accessibility.md) · [Executive Environment Framework](../02-ARCHITECTURE/Executive-Environment-Framework.md)

**Status.** Approved

**Version.** 1.1.0

**Owner.** Design

**Last Updated.** 2026-08-20

---

## Climate

Two climates only: Executive Light and Executive Dark. No Midnight, Carbon, Slate, or third climate.

Climate inverts paper and ink. It does not change brand. Appearance Settings, header toggle, and `theme.*` commands stay climate-only.

## Colour

Colour is atmosphere and signal, not illustration.

- Paper and ink establish the desk. Warm neutrality is the default climate of VentureOS.
- Brand primary marks the primary act. It is not a fill for large regions.
- Success, warning, danger, and info are semantic signal. Danger is for error and irreversible risk, not emphasis.
- Colour is never the only encoding.
- Charts use the eight-series professional palette.

Until atmosphere ships, live overlay is VentureOS accent. Product atmospheres are specified in EAS-001, not applied as headquarters.

## Surfaces

Official roles: Surface, Elevated Surface, Panel, Card, Modal, Drawer, Toolbar, Sidebar, Section.

Elevation, hairline borders, two radii (control and panel; chrome is square), quiet shadows, and a very subtle glass fill on toolbars are surface concerns. Components do not invent shadows, radius, or translucent fills.

## Type

Ten roles: Display, Heading, Metric, Lead, Subhead, Body, Label, Caption, Kicker, Code.

- Display names the screen. Heading names a framed page. Lead carries the one statement a screen exists to make.
- One sans family for UI. Monospace is reserved for Code.
- Weight lives inside the role. Screens do not apply `font-medium` or `font-semibold` except through an official role.
- Product brands do not introduce a second display face for OS chrome.

## Motion

Motion confirms change. It does not perform.

Prefer opacity, colour, and short translate. Avoid bounce, elastic overshoot, and looping brand animation. Loading prefers skeleton structure over a spinner unless a discrete control is awaiting a single request. Honour reduced motion.

Theme change may fade climate. It must not animate intelligence content as if the Runtime were running.
