# IDS-001 — IntelligenceOS Design System Foundation

Constitutional document for the IntelligenceOS Design System (IDS). Subordinate to the [VentureOS Project Constitution](../../PROJECT_CONSTITUTION.md).

This document defines **why** IDS exists. It does not prescribe CSS, component files, or a Theme Engine implementation. Technical contract: `IDS-002-IntelligenceOS-Design-System-Technical-Specification.md`.

IDS is presentation. It is not a Runtime, a Capability, a Venture Definition, a persistence layer, or a product registry.

## Mission

IDS exists so every surface on VentureOS — and every product that runs on VentureOS — reads as one executive operating system.

The founder must recognise judgement, constraint and cadence. The partner and the investor must recognise composure. The operator of Qualora, Calviora or Farmora must recognise the same OS, with a product identity that does not rewrite the architecture.

IDS is the design constitution for that recognition. It is not a marketing kit. It is not a component library inventory. It is the law that presentation must obey so intelligence remains the product.

## Philosophy

VentureOS is executive software. The visual system exists to make intelligence legible, not to decorate it.

1. Calm before spectacle. Paper, ink and a single accent carry more authority than gradient theatre.
2. Hierarchy before density. One primary action. One primary heading. Secondary information recedes.
3. Guidance before vacancy. An empty desk is a decision waiting to be taken, not a missing widget.
4. Identity after architecture. Brand never changes who orchestrates, what a capability is, or how a company is defined.
5. Tokens before one-off colour. If a value is not a token, it is not in the system.

The Executive Intelligence Runtime remains the only orchestrator. The Shared Capability Registry remains governance, not dispatch. The Definition Registry remains the only product-definition system. IDS may clothe those facts. It may not become a second source of truth for them.

## Executive Design Principles

1. **Judgement over dashboard.** Surfaces present operating judgement (briefing, health, decisions, story). They are not scoreboards.
2. **Restraint.** Accent is scarce. Danger is reserved for true failure. Motion is short and purposeful.
3. **Founder as principal.** Language addresses the person who founds and decides. It does not address an anonymous user of a SaaS template.
4. **Continuity of desk.** Situation Room, Company HQ, Executive Office and Settings share spacing, type, chrome and empty-state tone.
5. **Fail visibly in copy, not in chrome.** Missing intelligence is explained. Broken layout is not a brand moment.
6. **One OS, many products.** Foundation tokens are shared. Brand tokens overlay. Product identity never forks the shell into four applications.
7. **Accessible by construction.** Contrast, focus, skip, and reduced motion are constitutional, not a later pass.

## Foundation Tokens

Foundation tokens are the OS grammar. They name roles, not brands.

They include colour roles (background, surface, surface-elevated, border, divider; text primary, secondary, muted, disabled, inverse; brand primary, hover, active; success, warning, danger, info; chart series), space, type scale, radius, shadow, elevation, motion duration and easing, breakpoints, z-index, and icon size.

Foundation tokens must be sufficient to render the shell without a brand overlay. A brand overlay may retint accent, atmosphere and kicker; it may not invent a second spacing scale or a second type ladder.

Foundation tokens do not encode Qualora, Calviora, Farmora, or VentureOS Company. Those names belong to Brand Tokens.

## Brand Tokens

Brand tokens are product identity overlays keyed to Venture Definition ids.

| Brand | Definition id | Role |
|---|---|---|
| VentureOS | `ventureos.company` | Default company and OS chrome |
| Qualora | `qualora` | Quality and evidence operations |
| Calviora | `calviora` | Livestock operating cadence |
| Farmora | `farmora` | Farm operations intelligence |

Brand tokens may specify brand primary, hover, active, on-brand inverse text, atmospheric background shift, and optional kicker colour. They must not specify a private Runtime, a private capability catalogue, or a private navigation model.

Brand is resolved from the Venture Instance definition. Brand is not resolved from the Runtime pipeline, from capability lifecycle, or from persistence schema.

Until a Theme Engine exists, VentureOS brand values are the only live overlay. Other brands remain specified, not applied.

## Colour Philosophy

Colour is atmosphere and signal, not illustration.

- Two climates only: Executive Light (premium white, warm greys, soft borders, subtle surfaces) and Executive Dark (graphite, deep charcoal, premium navy, soft contrast). No additional themes.
- Paper and ink establish the desk. Warm neutrality is the default climate of VentureOS.
- Brand primary marks the primary act (found, confirm, skip-to-content, selected control). It is not a fill for large regions. Hover and active are the only brand states.
- Text primary carries titles and decisions. Secondary recedes. Muted explains. Disabled is inert. Inverse sits on brand fills.
- Success, warning, danger and info are semantic signal. Danger is for error and irreversible risk, not emphasis. Colour is never the only encoding.
- Charts use the eight-series professional palette. They do not invent hues.
- Dark climate inverts paper and ink without changing hierarchy. Brass or equivalent on dark is still brand, not a carnival.

Product brands may shift atmosphere (clinical, pastoral, field) while preserving the same roles. A Qualora screen must still have background, surface, brand primary and danger. It must not replace those roles with unnamed hex values.

## Surfaces

Surfaces are how paper sits on the desk. They are not a second colour system.

Official roles: Surface, Elevated Surface, Panel, Card, Modal, Drawer, Toolbar, Sidebar, Section.

Elevation, hairline borders, two radii (control and panel; chrome is square), quiet shadows, and a very subtle glass fill on toolbars are surface concerns. Hover, selected and focus are surface states. Components consume these roles. They do not invent shadows, radius, or translucent fills.

## Typography

Type exists to rank information. Rank is a role, not a raw size.

The Foundation type ladder is ten roles: Display, Heading, Metric, Lead, Subhead, Body, Label, Caption, Kicker, Code.

- Display names the screen. Heading names a framed page. Lead carries the one statement a screen exists to make. Subhead names a card headline. Body explains. Label names a control, a list title, or a quiet link. Caption is supporting metadata. Kicker names the desk. Metric is a measured number. Code is an identifier.
- One sans family for UI. Monospace is reserved for Code — identifiers, versions and technical status — never for briefing prose.
- Tracking on Display, Heading, Lead and Metric is tight. Tracking on Kicker is wide. These are ranks, not decoration.
- Weight lives inside the role. Screens do not apply `font-medium` or `font-semibold` except through an official role or the inline emphasis modifier used inside Body.
- Product brands do not introduce a second display face for the OS chrome. Identity is colour and tone, not a costume of fonts.

## Motion Principles

Motion confirms change. It does not perform.

- Prefer opacity, colour and short translate. Avoid bounce, elastic overshoot and looping brand animation.
- Loading prefers skeleton structure over a spinner, unless a discrete control is awaiting a single request.
- Honour reduced motion: durations collapse; meaning remains.
- Theme change may fade climate. It must not animate intelligence content as if the Runtime were running.

## Accessibility Principles

IDS is unusable if it is not operable.

- Skip to main content is part of the OS chrome, not an optional widget.
- Focus indicators remain visible on interactive elements and on skip targets.
- Contrast of text against paper, and of text-inverse against brand-primary, must meet WCAG 2.2 AA for the roles in use.
- Empty and loading states expose status to assistive technology.
- Keyboard order follows visual order. No interaction exists only on hover.
- Colour is never the only encoding of health, danger or selection.

## Component Philosophy

A component is a reusable presentation of a tokenised role. It is not a place to hide business rules.

- Buttons express one primary act per region.
- Cards group a single judgement or artefact, not an application.
- Navigation is wayfinding. It does not instantiate ventures or call the Runtime.
- Empty states guide the founder. Loading states use VentureOS language.
- Dialogs and popovers interrupt; they do not become a second app.
- The command palette is a command surface. Ask is not a chat Runtime.

Components consume Foundation and Brand tokens. They do not import `runExecutiveIntelligenceRuntime`. They do not resolve capabilities. They do not write repositories.

## Product Identity Strategy

VentureOS is the operating system. Qualora, Calviora and Farmora are products that run on it.

Identity strategy:

1. The shell, Situation Room, HQ, Office, Settings and founding wizard remain one OS.
2. Product identity is a brand overlay plus copy that respects the product’s purpose (quality evidence; calving cadence; field health).
3. Feature presence is owned by Venture Definitions (supported and excluded features). IDS hides nothing the Runtime and projections already hide, and shows nothing they exclude.
4. Farmora without an executive-office feature does not receive a faux office theme. Calviora without morning-briefing does not receive a briefing costume. Theme never restores a feature.

The founder selects a Product. Products resolve to definitions through the Definition Registry. IDS may theme the instance. IDS may not invent a Product Registry.

## Theme Strategy

Theme has two axes.

1. **Climate:** Executive Light and Executive Dark. Climate inverts paper and ink. It does not change brand. Do not add a third climate.
2. **Brand:** VentureOS, Qualora, Calviora, Farmora. Brand retints accent and atmosphere. It does not change climate independently of the founder’s appearance control.

A Theme Engine, when built, applies brand from the active Venture Instance definition id and climate from appearance. Until then, climate may live in the application and brand remains VentureOS.

Theme strategy forbids:

- Per-route palettes that bypass tokens.
- Dark Qualora as a third product.
- Binding theme to workspace id, founder name, or capability lifecycle.

## Constitutional Rules

1. IDS is presentation. It does not execute intelligence.
2. The Executive Intelligence Runtime remains the only orchestrator.
3. Capability ids resolve only through the Shared Capability Registry. IDS does not catalogue capabilities.
4. Venture identity resolves only through the Definition Registry. Brand keys are definition ids.
5. Persistence, membership, sessions and routing behaviour are not design-system concerns.
6. Foundation tokens are shared. Brand tokens overlay. No product ships a private spacing or type system.
7. Components do not contain founder-decision, policy, or instantiation logic.
8. Empty, loading and error language stays executive. Generic “Loading…” and “No items” are unconstitutional.
9. Accessibility of skip, focus, contrast and reduced motion is mandatory.
10. Implementation follows IDS-002. IDS-001 is not a backlog of widgets.
11. No new framework is implied. IDS may be expressed in the existing stack.
12. Changing IDS must not require changing Runtime, Capability Framework, or Venture Definitions.

## Definition of Done

IDS Foundation (this programme: IDS-001) is done when:

1. This constitution and IDS-002 exist under `docs/foundation/design-system/`.
2. The documentation tree under `docs/foundation/` is present and does not replace existing code-adjacent READMEs.
3. Implementers can answer why IDS exists, what it must never become, and which document specifies how.
4. No application behaviour has been changed in order to publish these documents.

IDS is **not** done as a product until a later implementation programme applies IDS-002 without violating these rules. That work is out of scope for IDS-001 Foundation.
