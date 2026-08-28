# IDS-002 — IntelligenceOS Design System Technical Specification

Implementation specification for the IntelligenceOS Design System (IDS).

This document defines **how** IDS is implemented. Constitutional law: `IDS-001-IntelligenceOS-Design-System-Foundation.md`.

This specification does not execute. Applying it is a later programme. It must not alter Runtime, Capability Framework, Venture Definitions, persistence, routing, or business logic.

Values below are the contract. Where VentureOS already uses a value in presentation, the contract matches that value so implementation can migrate without redesign. Qualora, Calviora and Farmora brand overlays are specified and not applied until a Theme Engine exists.

## 1. Design token naming convention

Prefix: `ids`.

Pattern: `--ids-{layer}-{category}-{name}[-{state}]`

| Segment | Allowed values | Example |
|---|---|---|
| layer | `foundation`, `brand` | `--ids-foundation-color-background` |
| category | `color`, `space`, `font`, `size`, `leading`, `tracking`, `radius`, `shadow`, `elevation`, `motion`, `z`, `breakpoint`, `icon` | `--ids-foundation-space-4` |
| name | kebab-case role | `accent`, `panel`, `duration-fast` |
| state | optional | `hover`, `disabled` |

Brand tokens nest the definition key:

`--ids-brand-{product}-{role}`

Product keys: `ventureos`, `qualora`, `calviora`, `farmora`, `frigora`.

Maps to Venture Definition ids:

| Token product key | Definition id |
|---|---|
| `ventureos` | `ventureos.company` |
| `qualora` | `qualora` |
| `calviora` | `calviora` |
| `farmora` | `farmora` |
| `frigora` | `frigora` |

CSS custom properties are the source for runtime theme. Tailwind `@theme` maps consume foundation aliases (`--color-background` → `var(--ids-foundation-color-background)`). Components never hard-code hex.

Semantic aliases (stable for components):

| Alias | Resolves to |
|---|---|
| `--background` | foundation background after climate + brand atmosphere |
| `--surface` | foundation surface |
| `--surface-elevated` | foundation surface-elevated |
| `--surface-muted` | alias of `--surface-elevated` |
| `--border` | foundation border |
| `--divider` | foundation divider |
| `--text-primary` | foundation text-primary |
| `--text-secondary` | foundation text-secondary |
| `--text-muted` | foundation text-muted |
| `--text-disabled` | foundation text-disabled |
| `--text-inverse` | foundation text-inverse (on brand fills) |
| `--foreground` | alias of `--text-primary` |
| `--muted` | alias of `--text-muted` |
| `--brand-primary` | active brand primary |
| `--brand-primary-hover` | active brand primary-hover |
| `--brand-primary-active` | active brand primary-active |
| `--accent` | alias of `--brand-primary` |
| `--accent-hover` | alias of `--brand-primary-hover` |
| `--accent-active` | alias of `--brand-primary-active` |
| `--accent-foreground` | alias of `--text-inverse` |
| `--ring` | active brand ring (defaults to brand-primary) |
| `--success` | foundation success |
| `--warning` | foundation warning |
| `--danger` | foundation danger |
| `--info` | foundation info |
| `--chart-1` … `--chart-8` | foundation chart series |

## 2. Foundation tokens

### 2.1 Colours (roles)

Climate is Executive Light (`:root`) or Executive Dark (`.dark`). Two climates only. Roles do not change.

Hex lives in `packages/ids/tokens/foundation.css`. Components consume semantic aliases, never hex.

**Neutral**

| Token | Executive Light | Executive Dark |
|---|---|---|
| `--ids-foundation-color-background` | `#f7f6f3` | `#12141a` |
| `--ids-foundation-color-surface` | `#fffefb` | `#191c24` |
| `--ids-foundation-color-surface-elevated` | `#efede8` | `#242833` |
| `--ids-foundation-color-border` | `#e3e0d9` | `#2f3440` |
| `--ids-foundation-color-divider` | `#ece9e3` | `#272b36` |

**Text**

| Token | Executive Light | Executive Dark |
|---|---|---|
| `--ids-foundation-color-text-primary` | `#1a1916` | `#eceae4` |
| `--ids-foundation-color-text-secondary` | `#4e4b46` | `#b4b0a7` |
| `--ids-foundation-color-text-muted` | `#6f6b64` | `#8e8a82` |
| `--ids-foundation-color-text-disabled` | `#a39e96` | `#5c5a56` |
| `--ids-foundation-color-text-inverse` | `#f8f6f1` | `#16181e` |

**Brand** (VentureOS default; other brands replace these via overlay)

| Token | Executive Light | Executive Dark |
|---|---|---|
| `--ids-foundation-color-brand-primary` | `#3d5248` | `#c4b08a` |
| `--ids-foundation-color-brand-primary-hover` | `#33453c` | `#d0bf9e` |
| `--ids-foundation-color-brand-primary-active` | `#2b3a34` | `#b39d76` |

**Semantic**

| Token | Executive Light | Executive Dark |
|---|---|---|
| `--ids-foundation-color-success` | `#3f6a56` | `#7d9e8c` |
| `--ids-foundation-color-warning` | `#8a6b3c` | `#c4a574` |
| `--ids-foundation-color-danger` | `#9a4540` | `#c98b84` |
| `--ids-foundation-color-info` | `#4a5c6e` | `#8a9bb0` |

**Charts**

| Token | Executive Light | Executive Dark |
|---|---|---|
| `--ids-foundation-color-chart-1` | `#3d5270` | `#7a90b0` |
| `--ids-foundation-color-chart-2` | `#4a6b5c` | `#7da08c` |
| `--ids-foundation-color-chart-3` | `#9a7f52` | `#c4b08a` |
| `--ids-foundation-color-chart-4` | `#6a6570` | `#9a96a0` |
| `--ids-foundation-color-chart-5` | `#7a4e52` | `#c08a8c` |
| `--ids-foundation-color-chart-6` | `#5b6e7a` | `#8aa0b0` |
| `--ids-foundation-color-chart-7` | `#8c7354` | `#c4a888` |
| `--ids-foundation-color-chart-8` | `#3f4550` | `#a8adb8` |

**Overlay**

| Token | Executive Light | Executive Dark |
|---|---|---|
| `--ids-foundation-color-overlay` | `rgb(26 25 22 / 0.40)` | `rgb(8 10 14 / 0.58)` |

Compatibility aliases (`foreground`, `surface-muted`, `muted`, `accent`, `accent-hover`, `accent-foreground`, `ring`) resolve to the official roles above. They remain valid. New screens should use the official names.

Focus outline: `2px solid color-mix(in srgb, var(--ring) 55%, transparent)`, offset `2px`.

Selection: `color-mix(in srgb, var(--brand-primary) 18%, transparent)`.

### 2.2 Spacing

Base unit: `4px`. Use the scale; do not invent `13px` gaps.

| Token | rem | px |
|---|---|---|
| `--ids-foundation-space-0` | 0 | 0 |
| `--ids-foundation-space-1` | 0.25 | 4 |
| `--ids-foundation-space-2` | 0.5 | 8 |
| `--ids-foundation-space-3` | 0.75 | 12 |
| `--ids-foundation-space-4` | 1 | 16 |
| `--ids-foundation-space-5` | 1.25 | 20 |
| `--ids-foundation-space-6` | 1.5 | 24 |
| `--ids-foundation-space-8` | 2 | 32 |
| `--ids-foundation-space-10` | 2.5 | 40 |
| `--ids-foundation-space-12` | 3 | 48 |
| `--ids-foundation-space-16` | 4 | 64 |

Canonical page: header padding `space-4` / `space-5` vertical, content `space-4` / `space-6` with `sm` bump to `space-6` / `space-10`. Section stack: `space-8`. Card grid gap: `space-4`. Card inner: `space-6`. Control gap: `space-2`.

Screen padding is applied through a single utility (`vos-screen`) so every full-bleed screen and every framed page body share one rhythm. Half-step values (`0.5`, `1.5`, `2.5`, `3.5`) are not part of the scale.

Control heights are sizes, not spacing. They have their own tokens so a control is never sized from the spacing scale:

| Token | rem | px | Use |
|---|---|---|---|
| `--ids-foundation-control-height-sm` | 2 | 32 | chrome controls, switchers, icon buttons |
| `--ids-foundation-control-height-md` | 2.25 | 36 | primary and secondary buttons |
| `--ids-foundation-control-height-lg` | 2.5 | 40 | text inputs |

### 2.3 Typography

Family:

| Token | Value |
|---|---|
| `--ids-foundation-font-sans` | Geist Sans, ui-sans-serif, system-ui, sans-serif |
| `--ids-foundation-font-mono` | Geist Mono, ui-monospace, monospace |

Weights (used only inside roles):

| Token | Value |
|---|---|
| `--ids-foundation-weight-regular` | 400 |
| `--ids-foundation-weight-medium` | 500 |
| `--ids-foundation-weight-semibold` | 600 |

#### Hierarchy

Largest ceremonial identity down to metadata. A screen uses at most one Display and at most one Lead.

1. Display — names the room (`Situation Room`, `Welcome to VentureOS`, company name on HQ).
2. Metric — a single measured number (operating health score).
3. Heading — names a framed page (`Settings`, `Ventures`, deferred operating titles).
4. Lead — the one statement a screen or card exists to make (today’s mission title, auth title, founding dialog).
5. Subhead — a card’s headline (executive name, briefing headline).
6. Body — paragraph copy.
7. Label — control, navigation, list title, form label, quiet link, empty-state title.
8. Caption — supporting metadata (dates, owners, policy titles).
9. Kicker — uppercase desk label (section names, loading copy, chrome status).
10. Code — identifier, runtime status token, definition id.

#### Role definitions

Each role owns family, weight, size, line height and letter spacing. Colour is not a type rank: Body and Label take `text-foreground`, `text-muted` or `text-danger` as needed. Caption and Kicker default to muted. Display, Heading, Lead, Subhead and Metric default to foreground.

| Role | Utility | Family | Weight | Size | Line height | Tracking | Purpose |
|---|---|---|---|---|---|---|---|
| Display | `ids-display` | sans | 600 | 1.625rem / sm 1.875rem | 1.2 | -0.03em | Screen identity |
| Metric | `ids-metric` | sans | 600 | 1.875rem | 1.1 | -0.03em | A measured number; tabular-nums |
| Heading | `ids-heading` | sans | 600 | 1.25rem / sm 1.5rem | 1.2 | -0.03em | Framed page title |
| Lead | `ids-lead` | sans | 600 | 1.25rem | 1.35 | -0.03em | The statement the screen exists to make |
| Subhead | `ids-subhead` | sans | 600 | 1.0625rem | 1.4 | -0.01em | Card headline |
| Body | `ids-body` | sans | 400 | 0.9375rem | 1.625 | 0 | Paragraph copy |
| Label | `ids-label` | sans | 500 | 0.875rem | 1.4 | -0.01em | Controls, nav, list titles, form labels |
| Caption | `ids-caption` | sans | 400 | 0.75rem | 1.4 | 0 | Metadata; muted by default |
| Kicker | `ids-kicker` | sans | 500 | 0.6875rem | 1.2 | 0.14em | Uppercase desk label; muted by default |
| Code | `ids-code` | mono | 400 | 0.8125rem | 1.5 | 0 | Identifiers and technical status |

Tokens follow `--ids-foundation-type-{role}-{family|weight|size|leading|tracking}`. Display and Heading also have `-size-sm` for the `sm` breakpoint.

Inline emphasis inside Body uses `ids-emphasis` (weight medium). It is not a role. It marks a short label inside a sentence (`Finding.`, `Ruling.`).

#### Examples

```
<p className="ids-kicker">Daily briefing · {founderName}</p>
<h1 className="ids-display">Situation Room</h1>
<p className="ids-body text-muted">{worldLine}</p>

<p className="ids-caption">{dateLabel}</p>
<h2 className="ids-lead">{mission.title}</h2>
<p className="ids-body text-foreground">{mission.ask}</p>

<label className="ids-label flex flex-col gap-1">Email</label>
<p className="ids-body text-danger">{error}</p>
<p className="ids-body text-foreground">Runtime status: <span className="ids-code">{status}</span></p>
```

#### Usage rules

- Every visible string uses one of the ten roles. Buttons, fields, rows, pills, chips and kbd consume Label or Kicker tokens inside their component utilities; screens do not restyle them with raw type.
- Do not use `text-xs`, `text-sm`, `text-base`, `text-lg`, `text-xl`, `text-2xl`, `text-3xl`, or `text-[…]`.
- Do not use `font-medium`, `font-semibold`, or `font-bold` on screens. Weight belongs to the role.
- Do not use `tracking-tight`, `tracking-wide`, `leading-relaxed`, or `leading-snug` to fake a role.
- Colour utilities (`text-muted`, `text-foreground`, `text-danger`, `text-accent-foreground`) remain legal. They are not type ranks.
- Kicker is uppercase by construction. Body never uses uppercase for paragraph copy.
- Code never carries briefing prose.
- `ids-copy`, `vos-title`, `vos-page`, `vos-lead`, `vos-subhead`, `vos-body`, `vos-caption`, `vos-section`, `vos-kicker` and `vos-metric` are compatibility aliases of the official roles. New work uses `ids-*` only.

#### Migration notes (VS-004.2)

| Former class | Official role |
|---|---|
| `vos-title` | `ids-display` |
| `vos-page` | `ids-heading` |
| `vos-lead` | `ids-lead` |
| `vos-subhead` | `ids-subhead` |
| `vos-body`, `ids-copy` | `ids-body` (+ `text-muted` or `text-foreground`) |
| `vos-section` | `ids-label` |
| `text-sm font-medium`, `text-sm font-medium tracking-tight` | `ids-label` |
| `text-sm leading-relaxed text-muted` | `ids-body text-muted` |
| `text-sm leading-relaxed text-foreground` | `ids-body text-foreground` |
| `text-sm text-muted` (dates, meta) | `ids-caption` |
| `text-sm text-danger` | `ids-body text-danger` |
| `vos-caption` | `ids-caption` |
| `vos-kicker` | `ids-kicker` |
| `vos-metric` | `ids-metric` |
| `font-medium` inside a sentence | `ids-emphasis` |
| Runtime / definition identifiers | `ids-code` |

Former `vos-section` (0.8125rem / 600) is retired. Card section titles use Label. That is a rank unification, not a layout change.

### 2.4 Shadows

Quiet, executive shadows. No Material elevation theatre.

| Token | Executive Light | Executive Dark |
|---|---|---|
| `--ids-foundation-shadow-xs` | `0 1px 1px rgb(26 25 22 / 0.04)` | `0 1px 1px rgb(0 0 0 / 0.28)` |
| `--ids-foundation-shadow-panel` | `0 1px 1px rgb(26 25 22 / 0.04), 0 6px 18px rgb(26 25 22 / 0.04)` | `0 1px 1px rgb(0 0 0 / 0.20), 0 8px 20px rgb(0 0 0 / 0.16)` |
| `--ids-foundation-shadow-overlay` | `0 10px 28px rgb(26 25 22 / 0.08)` | `0 12px 32px rgb(0 0 0 / 0.28)` |

Controls: `shadow-xs`. Panels and cards: `shadow-panel` (`--ids-foundation-surface-shadow-raised`). Dialogs, drawers, command palette: `shadow-overlay` (`--ids-foundation-surface-shadow-modal`).

### 2.4a Executive Surface System

Surfaces consume colour tokens. They do not invent hex.

**Roles**

| Role | Utility | Fill | Border | Radius | Shadow | Elevation |
|---|---|---|---|---|---|---|
| Surface | `ids-surface` | `--ids-foundation-surface-fill` | none | chrome (`0`) | none | base |
| Elevated Surface | `ids-surface-elevated` | `--ids-foundation-surface-fill-elevated` | subtle (`divider`) | panel | none | base |
| Panel | `ids-surface-panel`, `vos-panel` | fill | default | panel | raised | raised |
| Card | `ids-surface-card` | fill | default | panel | raised | raised |
| Modal | `ids-surface-modal`, `vos-dialog` | fill | default | panel | modal | modal |
| Drawer | `ids-surface-drawer` | fill | inline-start | chrome (`0`) | overlay | modal |
| Toolbar | `ids-surface-toolbar` | fill, glass when supported | bottom hairline | chrome (`0`) | none | raised |
| Sidebar | `ids-surface-sidebar` | fill | inline-end hairline | chrome (`0`) | none | raised |
| Section | `ids-surface-section` | transparent | none | chrome (`0`) | none | base |

**States**

| State | Token | Utility |
|---|---|---|
| Hover | `--ids-foundation-surface-hover` | `ids-surface-hover`, `bg-surface-hover` |
| Selected | `--ids-foundation-surface-selected` + `--ids-foundation-surface-border-selected` | `ids-surface-selected`, `bg-surface-selected` |
| Focus | `--ids-foundation-surface-focus` + `--ids-foundation-surface-border-focus` + `--ids-foundation-surface-focus-ring` | `ids-surface-focus` |

**Glass**

`--ids-foundation-surface-glass-fill` is `color-mix` of surface at 92% (88% in dark). `--ids-foundation-surface-glass-blur` is `12px`. Applied to toolbars where `backdrop-filter` is supported. Utility: `ids-surface-glass`. No large gradients.

**Contrast**

Canvas is `--ids-foundation-color-background`. Raised chrome and cards are `--ids-foundation-surface-fill`. Nested wells are `--ids-foundation-surface-fill-elevated`. Colour hex lives in the colour system; surfaces only compose those roles.

Compatibility: `--surface-muted` remains an alias of elevated fill. `--shadow-panel` and `--shadow-overlay` remain valid.

### 2.5 Radius

| Token | Value | Use |
|---|---|---|
| `--ids-foundation-radius-control` | 0.5rem | inputs, buttons, chips, switcher |
| `--ids-foundation-radius-panel` | 0.625rem | cards, panels, dialogs |

Do not mix a third radius on OS chrome.

### 2.6 Motion

| Token | Value |
|---|---|
| `--ids-foundation-motion-duration-fast` | 120ms |
| `--ids-foundation-motion-duration-base` | 180ms |
| `--ids-foundation-motion-duration-slow` | 280ms |
| `--ids-foundation-motion-ease-standard` | `cubic-bezier(0.2, 0.8, 0.2, 1)` |
| `--ids-foundation-motion-ease-exit` | `cubic-bezier(0.4, 0, 1, 1)` |

Allowed properties: `color`, `background-color`, `border-color`, `box-shadow`, `opacity`, `transform` (translate/scale ≤ 1.02).

`prefers-reduced-motion: reduce`: durations `0.01ms`; no looping pulse on skeletons (static placeholders).

### 2.7 Elevation

Logical stack. Pair with z-index.

| Level | Token | Surfaces |
|---|---|---|
| 0 | `--ids-foundation-elevation-base` | page background |
| 1 | `--ids-foundation-elevation-raised` | cards, sidebar, top bar |
| 2 | `--ids-foundation-elevation-overlay` | popovers, menus |
| 3 | `--ids-foundation-elevation-modal` | dialogs, command palette |
| 4 | `--ids-foundation-elevation-urgent` | skip link when focused, toasts |

### 2.8 Breakpoints

| Token | Width | Intent |
|---|---|---|
| `--ids-foundation-breakpoint-sm` | 640px | page title and padding bump; stacked grids become columns |
| `--ids-foundation-breakpoint-md` | 768px | sidebar + content comfortable |
| `--ids-foundation-breakpoint-lg` | 1024px | Situation Room multi-column |
| `--ids-foundation-breakpoint-xl` | 1280px | max executive canvas |

Content max widths: body measures `42rem`; settings and lists `36rem` (`max-w-xl`); welcome `32rem` (`max-w-lg`).

### 2.9 Z-index

| Token | Value | Surface |
|---|---|---|
| `--ids-foundation-z-base` | 0 | main |
| `--ids-foundation-z-sidebar` | 20 | sidebar |
| `--ids-foundation-z-topbar` | 30 | top bar |
| `--ids-foundation-z-popover` | 50 | popovers |
| `--ids-foundation-z-dialog` | 60 | dialogs, palette |
| `--ids-foundation-z-skip` | 80 | skip to main content |
| `--ids-foundation-z-toast` | 90 | notifications |

Never invent `z-[123]`. Map existing skip link `z-[80]` to `--ids-foundation-z-skip`.

### 2.10 Icon sizing

Stroke icons (Lucide or equivalent). Square, currentColor.

| Token | Size | Use |
|---|---|---|
| `--ids-foundation-icon-sm` | 16px (`h-4 w-4`) | switcher chevrons, inline control |
| `--ids-foundation-icon-md` | 20px (`h-5 w-5`) | top-bar actions |
| `--ids-foundation-icon-lg` | 24px (`h-6 w-6`) | empty-state illustration (rare; prefer type) |

Default in chrome: `sm`. Do not mix sizes inside one control.

## 3. Brand tokens

Each brand supplies accent, hover, foreground, ring, and optional atmosphere (background mix). Climate still uses foundation paper/ink unless atmosphere is defined as a mix, not a replacement scale.

### 3.1 VentureOS (`ventureos.company`)

Purpose: default company on the OS. Forest on paper (light); brass on charcoal (dark).

| Role | Light | Dark |
|---|---|---|
| accent | `#3d5248` | `#c4b08a` |
| accent-hover | `#33453c` | `#d0bf9e` |
| accent-foreground | `#f7f5f0` | `#1b1b19` |
| ring | accent | accent |
| atmosphere | none (foundation background) | none |

This is the live brand until the Theme Engine binds others.

### 3.2 Qualora (`qualora`)

Purpose: quality and evidence for regulated work. Clinical slate; restrained; documentary.

| Role | Light | Dark |
|---|---|---|
| accent | `#3d4f66` | `#9eb4c9` |
| accent-hover | `#334257` | `#b3c5d6` |
| accent-foreground | `#f5f7fa` | `#15181c` |
| ring | accent | accent |
| atmosphere | mix 4% accent into background | mix 6% accent into background |

Do not introduce warning-orange as a second accent. Findings use foundation danger and muted, not a Qualora-only traffic light.

### 3.3 Calviora (`calviora`)

Purpose: livestock cadence and calving-season constraint. Warm earth; dusk; hay.

| Role | Light | Dark |
|---|---|---|
| accent | `#6b4f32` | `#c4a574` |
| accent-hover | `#5a4129` | `#d2b68a` |
| accent-foreground | `#f8f4ee` | `#1a1714` |
| ring | accent | accent |
| atmosphere | mix 5% accent into background | mix 7% accent into background |

Calviora excludes `intelligence.briefing` / morning-briefing. Theme must not add a briefing banner as compensation.

### 3.4 Farmora (`farmora`)

Purpose: farm operations; genome, mission, field health. Chlorophyll and soil.

| Role | Light | Dark |
|---|---|---|
| accent | `#3f5c38` | `#a3c48a` |
| accent-hover | `#334a2e` | `#b5d19d` |
| accent-foreground | `#f4f7f1` | `#141812` |
| ring | accent | accent |
| atmosphere | mix 5% accent into background | mix 7% accent into background |

Farmora excludes executive-office feature. Theme must not costume an office floor that projections hide.

## 4. Component standards

Measurements use foundation tokens. Behaviour is presentation only.

### 4.1 Buttons

| Variant | Height | Padding | Radius | Fill |
|---|---|---|---|---|
| primary | `control-height-md` | `space-4` | control | accent / accent-foreground; hover accent-hover |
| secondary | `control-height-md` | `space-4` | control | surface, border, foreground; hover surface-muted |
| control (switcher) | `control-height-sm` | `space-2` | control | surface, border |
| accent control (chrome) | `control-height-sm` | `space-2` | control | accent / accent-foreground; hover accent-hover |

Disabled: opacity 50%, no pointer. One primary per region. Sign-out uses primary metrics (destructive meaning is the label, not a third colour, until a later `danger` variant is certified).

Class contract: `vos-btn-primary` ≡ primary, `vos-btn-secondary` ≡ secondary, `vos-control` ≡ control, `vos-btn-accent-control` ≡ accent control. Package `Button` `variant="primary" | "secondary"` must match. A screen never rebuilds a button from raw utilities.

### 4.2 Inputs

Height `control-height-lg`, full width in forms, radius control, border, surface, `space-3` inline padding, Label type, shadow-xs. Placeholder muted. Focus: border ring, ring 2px at 25% accent.

Class contract: `vos-field`. Labels: `ids-label`, gap-1 column. Errors: `ids-body text-danger`, below the field.

### 4.3 Cards

Radius panel, border, surface, shadow-panel, padding `space-6` for executive sections, `space-4` for compact lists. Gap `space-5` between kicker block and body.

Class contract: `ids-surface-card` (alias `vos-panel` for panels). Package `Card` must match panel shadow and radius. `SectionCard` owns padding and gap; a screen must not pass its own `p-*` or `gap-*` override, because per-card overrides are how a set of cards stops looking like one product.

### 4.4 Tables

Not a dense data grid. Rows: border-t, `py-4`, first row no top border. Text: name medium sm; meta caption muted. Horizontal overflow: scroll, not squeezed type. Header row: kicker or section, not all-caps spreadsheet chrome.

### 4.5 Navigation

Workspace tabs and sidebar items: Label, muted at rest, foreground when current. Current state: colour and weight, not colour alone (aria-current). Do not change href contract from Foundation navigation (canonical company home remains Company HQ).

### 4.6 Sidebar

Full-height, `ids-surface-sidebar`, elevation raised. Width compact; labels use Label. Active item: `bg-surface-selected`. Hover: `bg-surface-hover`. Icons `icon-sm`. No Runtime calls.

### 4.7 Top bar

Height sufficient for `h-8` controls. `ids-surface-toolbar` (hairline border, optional glass). Contains workspace switcher, company switcher, appearance, command affordance. Controls: `vos-control`. Skip link is a sibling of the shell, not inside the bar.

### 4.8 Dialogs

Elevation modal, z-dialog, overlay foundation overlay colour. Surface: `ids-surface-modal` (alias `vos-dialog`). Title: page or section. One primary action. Escape and focus trap required. Do not use dialogs to persist VIC.

### 4.9 Popovers

Elevation overlay, z-popover, `ids-surface-modal`, padding space-2, width as needed (`w-72` for workspace). Close on outside click and Escape. Empty copy inside uses Empty State standard. Selectable entries use the row contract (`vos-row`), never bespoke padding.

### 4.10 Empty states

Component: title (optional, `ids-label text-foreground`) + body (`ids-body text-muted`) + optional action (primary button). Max width `max-w-lg`, gap-2.

Tone: guide the founder. Forbidden: “No items”, “N/A”, “Nothing here”.

### 4.11 Loading states

Prefer skeleton: kicker with executive message; pulse bars on surface-muted; one panel skeleton. `role="status"` `aria-live="polite"` `aria-busy="true"` plus visually hidden text.

Canonical messages:

- Preparing Executive Intelligence...
- Loading Company Context...
- Synchronising Executive Workspace...

Spinners only on a single control awaiting a discrete submit (auth). Auth pending copy is executive (“Opening VentureOS…”, not “Please wait…”).

`prefers-reduced-motion`: static bars, no pulse.

### 4.12 Notifications

Foundation v1.0 has no OS inbox. If a toast is added later: elevation urgent, z-toast, surface, border, shadow-panel, caption + body, timeout ≥ 4s, focusable dismiss. Policy findings remain Situation Room content, not toasts by default.

### 4.13 Forms

Column, gap-3. Auth titles use Lead (`ids-lead`). Submit is primary Button. Helper text is Body muted. No Runtime in form components; actions stay in platform modules.

### 4.14 Command palette

z-dialog, overlay, panel max-w-xl, input h-12 border-b Label type, list max-h-80. Groups labelled with Kicker. Rows use `vos-row`; active row: surface-muted. Empty: centred Body muted, guiding copy. Ask mode is a command surface until intelligence runtime is connected; it is not a chat Runtime.

### 4.15 Rows, list items, pills and chips

| Element | Contract | Metrics |
|---|---|---|
| Menu or command row | `vos-row` | control radius, `space-2` padding, control size, hover surface-muted |
| Navigable list item | `vos-list-item` | panel radius, border, surface, `space-3` padding, shadow-xs, hover surface-muted |
| Status pill | `ids-pill` + one `ids-status-*` | control radius, `space-2` / `space-1` padding, kicker size, uppercase |
| Static chip | `ids-chip` | control radius, surface-muted, caption size, foreground |
| Keyboard hint | `vos-kbd` | control radius, border, surface, kicker size, muted |

Status colour is carried by `ids-status-healthy | watch | risk | quiet` only. A screen never names a raw palette colour for status.

### 4.16 Interaction and hover

Every element that changes appearance on hover, focus or selection carries the shared transition contract `ids-transition`: colour, background, border, shadow and opacity over `motion-duration-fast` on `motion-ease-standard`. Hover without a transition reads as a jump, and a bespoke duration reads as a different product.

Quiet text links use `vos-link` (muted at rest, foreground on hover). Emphatic inline links keep foreground with `underline-offset-4` and add `ids-transition`. Hover never moves layout: no scale, no translate, no shadow growth on cards.

## 5. Accessibility standards

| Rule | Requirement |
|---|---|
| Skip | Control “Skip to main content” → `#main-content`; visible on focus; z-skip; accent fill |
| Main | `id="main-content"` `tabIndex={-1}`; focus-visible outline same as links |
| Focus | 2px ring-mix outline on `a`, `button`, `[tabindex="-1"]`; inputs use field ring |
| Contrast | WCAG 2.2 AA for text and UI components on both climates and all four brands |
| Keyboard | All actions reachable; popover/dialog Escape; no hover-only commands |
| Status | Empty/loading announced; pending buttons disabled and labelled |
| Colour | Health pills and danger accompanied by text |
| Motion | Honour reduced-motion tokens |

## 6. Motion standards

| Event | Duration | Notes |
|---|---|---|
| Colour / hover | fast | buttons, controls |
| Focus ring | none (instant) | |
| Popover in | base + standard ease | opacity + 4px translate |
| Dialog in | slow | opacity only if reduced-motion |
| Skeleton | pulse 1.5s | disabled when reduced-motion |
| Skip reveal | base | translate only |

No page-transition libraries. No Runtime-triggered animation.

## 7. Responsive standards

- Below `sm`: single column; titles at mobile size; horizontal padding `space-4`.
- `sm+`: title and padding bump; portfolio grids may become 3-column template.
- Sidebar may collapse by a later programme; until then, do not ship a second navigation model.
- Touch targets: controls at least 32px height; primary actions 36px.
- Do not hide founder primary actions (Found Company) behind overflow menus at mobile.

## 8. Theme architecture

Layers, applied in order:

1. Foundation climate (`:root` Executive Light, `.dark` Executive Dark) sets paper, ink, brand, semantic and chart colours, plus shadows.
2. Brand overlay (`data-ids-brand="ventureos|qualora|calviora|farmora"`) sets brand primary, hover, active, inverse, ring, optional atmosphere mix.
3. Semantic aliases (`--background`, `--text-primary`, `--brand-primary`, …) are what components read.

Appearance control sets climate only (light | dark | system). Brand is not a founder appearance setting; it follows the active Venture Instance definition id when the Theme Engine exists.

Until the engine exists:

- Climate: current `next-themes` / `.dark` behaviour may remain.
- Brand: VentureOS values assigned to `--accent*`.
- Do not switch brand in application code in this specification’s publication sprint.

Theme files must not import Runtime, capability registry, or definition registry into CSS. A thin binder (later) may read `definition.id` from already-loaded presentation props and set `data-ids-brand`. That binder must not call `runExecutiveIntelligenceRuntime`.

## 9. Folder structure (target)

Documentation (this programme):

```
docs/foundation/design-system/
  IDS-001-IntelligenceOS-Design-System-Foundation.md
  IDS-002-IntelligenceOS-Design-System-Technical-Specification.md
```

Implementation (future programme — do not create in IDS-001):

```
packages/ids/
  README.md
  tokens/
    foundation.css
    brand/
      ventureos.css
      qualora.css
      calviora.css
      farmora.css
  themes/
    climate.css
    bind.ts
  components/
    (migrate from packages/ui and apps/web presentation utilities)
```

Existing `packages/ui` (`Button`, `Card`) remains valid until migration. `apps/web/src/app/globals.css` remains the live token host until tokens move. Migration must be additive: aliases keep `--background` working.

Do not place IDS under `core/runtime`, `core/capability`, or `core/venture-definition`.

## 10. Future Theme Engine integration

When implemented, the Theme Engine:

1. Reads the active Venture Instance `definition.id` from presentation state already provided by the intelligence adapter (no new Runtime stage).
2. Maps id → `data-ids-brand`.
3. Unknown or empty definition id → `ventureos` (same default as `DEFAULT_VENTURE_DEFINITION_REF`).
4. Applies atmosphere mix in CSS only.
5. Recomputes nothing in VIC, policy, recommendations, or health.
6. Does not restore excluded features (Calviora briefing, Farmora office).
7. Workspace switch without a company keeps VentureOS brand.
8. Fails closed to VentureOS if a brand stylesheet is missing.

The engine is presentation infrastructure. It is not `intelligence.runtime`. It is not a capability. It is not a venture definition.

## 11. Implementation constraints

1. No new CSS-in-JS framework, no new component library, no new animation library.
2. No change to routing, persistence, or orchestration in order to “support” tokens.
3. Fail fast in review if a PR introduces hex outside token files.
4. Copy remains executive (IDS-001). Technical names (VIC, EIR, EPE) stay in intelligence surfaces, not on buttons.
5. Certification of IDS is separate from Runtime certification.

## 12. Definition of done (implementation programme)

A later implementation programme is done when:

- Foundation and brand tokens exist as named custom properties.
- Components consume aliases only.
- Accessibility and motion standards are met on light and dark.
- Theme Engine, if shipped, binds definition ids without Runtime changes.
- Qualora, Calviora and Farmora overlays can be demonstrated without forking the shell.

This file’s publication does not start that programme.
