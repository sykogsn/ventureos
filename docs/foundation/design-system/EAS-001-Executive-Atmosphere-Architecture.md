# EAS-001 — Executive Atmosphere Architecture

VentureOS Foundation v1.1. Design only. This document does not execute, amend IDS-001, amend IDS-002, or change Runtime, climate tokens, or application CSS.

Prerequisite: VS-008 — the theme engine is correct. Climate switching works. Brand overlay is accent-plus-mix by specification. The product problem is recognition, not wiring.

## 1. Verdict

Replace the Brand Overlay model with an Executive Atmosphere System.

The operating system stays one OS. Workflows, navigation, Runtime, and interaction model do not fork. What changes is the headquarters the founder walks into.

Three layers remain independent:

1. Climate — Executive Light, Executive Dark, System. Unchanged.
2. Executive Atmosphere — VentureOS, Qualora, Calviora, Farmora, future ventures.
3. Accessibility — motion, contrast, reduced motion, high contrast.

Components never switch on a venture id. They consume semantic roles. Atmosphere files retint those roles.

## 2. Why overlay failed as a product

VS-008 measured the live overlay:

- Climate Light ↔ Dark is immediately recognisable.
- Brand overlay retints `--brand-primary`, `--accent`, `--ring`, `--text-inverse`, and a 4–7% mix into `--background`.
- `--surface`, `--surface-elevated`, `--text-primary`, `--border`, and chrome fills do not move.
- Sidebar and toolbar both consume `--ids-foundation-surface-fill` → `--surface`, so the 4–7% desk tint never reaches chrome.
- VentureOS overlay hex equals climate brand-primary, so `data-ids-brand="ventureos"` is a visual no-op.
- Farmora light `#3f5c38` vs VentureOS `#3d5248` is not a headquarters change.

IDS-002 §3 specified that overlay on purpose. Foundation v1.1 expands Layer 2 from “accent overlay” to “executive atmosphere” without touching Layer 1.

## 3. Layer architecture

Apply in this order. Later layers may retint earlier colour roles. They must not rewrite type, space, radius, z-index, or layout.

```
Venture Definition id
        │
        ▼
packages/ids/themes/bind.ts          (map only; no Runtime import)
        │
        ▼
<html>
  class="light|dark"                 Layer 1  next-themes  (LOCKED)
  data-ids-atmosphere="{id}"         Layer 2  binder
  data-ids-motion="system|reduced"   Layer 3  a11y binder
  data-ids-contrast="system|high"    Layer 3  a11y binder
        │
        ▼
Semantic aliases                     --background --surface --sidebar …
        │
        ▼
Shell, modules, charts, empty states (roles only)
```

### Layer 1 — Climate (do not modify)

Owner: existing Theme Provider and `packages/ids/tokens/foundation.css`.

| ID | Name | Activation |
|---|---|---|
| `light` | Executive Light | `html.light` / `:root` |
| `dark` | Executive Dark | `html.dark` |
| `system` | System | next-themes resolves to light or dark |

Climate owns paper/ink **roles**, type ladder, space, control height, radius, elevation numbers, motion durations, breakpoints, z-index, icon sizes, and semantic signal (`success`, `warning`, `danger`, `info`).

Appearance Settings, header toggle, and `theme.*` commands stay climate-only.

v1.1 must not add Midnight, Carbon, Slate, or a third climate.

### Layer 2 — Executive Atmosphere

Owner: new atmosphere token files plus the existing definition→id binder (renamed in implementation, dual-written in migration).

| ID | Headquarters | Feeling | Visual direction |
|---|---|---|---|
| `ventureos` | Technology company HQ | Executive, strategic, calm, premium, modern, minimal | Graphite, forest, stone, glass, executive desk |
| `qualora` | Assurance intelligence centre | Clinical, evidence, assurance, precision, trust, professional | Slate, soft purple, medical white, evidence panels, subtle clinical texture |
| `calviora` | Healthcare operations centre | Healthcare, compassion, safety, operations, professional, warm | Executive teal, soft healthcare neutrals, warm lighting, subtle depth |
| `farmora` | Agricultural intelligence centre | Natural, growth, land, fresh, agriculture, confidence | Earth, natural greens, stone, organic materials, open space |

IDs stay the four product keys already mapped in `brandFromDefinitionId`. Future ventures add a key, a CSS file, and a definition map entry. Unknown ids fail closed to `ventureos`.

Atmosphere may influence: backgrounds, surfaces, cards, sidebar, toolbar, executive header, workspace, borders, elevation **shadows** (not elevation numbers), accent, illustrations, loading, empty states, charts, icons (via `currentColor` and marks), brand graphics.

Atmosphere must not influence: routes, nav trees, Runtime, capabilities, definitions, persistence, control geometry, type roles, spacing scale.

### Layer 3 — Accessibility

Owner: a new accessibility binder and CSS. Independent of venture id and of climate preference.

| Control | Values | Default |
|---|---|---|
| Motion | `system` (honour `prefers-reduced-motion`) \| `reduced` | `system` |
| Contrast | `system` (honour `prefers-contrast`) \| `high` | `system` |

High contrast increases border and text contrast against surfaces. It may flatten atmosphere tints. It must not invent a fourth climate or a second type ladder.

Reduced motion already exists as a media query in `globals.css`. Layer 3 adds a founder override that applies the same collapse without waiting for the OS.

Settings: a new Accessibility group. Not Appearance. Not a venture switcher.

### Independence rules

1. Changing climate never writes `data-ids-atmosphere`.
2. Changing atmosphere never writes `html` climate class or `localStorage.theme`.
3. Changing motion or contrast never writes atmosphere or climate.
4. Workspace with no active venture uses `ventureos` atmosphere.
5. Unauthenticated chrome uses `ventureos` atmosphere.
6. Login copy may say VentureOS. That is OS identity, not atmosphere.

## 4. Token strategy

### 4.1 Keep

- Prefix `ids`. Pattern `--ids-{layer}-{category}-{name}[-{state}]`.
- `--ids-foundation-*` climate source tokens. No hex edits in v1.1 climate files.
- Semantic aliases components already read (`--background`, `--surface`, `--brand-primary`, `--text-primary`, …).
- Tailwind `@theme` maps to those aliases. No per-atmosphere Tailwind palettes.

### 4.2 Add (atmosphere layer)

Source tokens, one file per atmosphere, light and dark:

`--ids-atmosphere-{id}-{role}`

Required roles per atmosphere × climate:

| Role | Maps to alias | Why |
|---|---|---|
| `background` | `--background` | Desk |
| `surface` | `--surface` | Panels |
| `surface-elevated` | `--surface-elevated` | Cards / raised |
| `workspace` | `--workspace` | Main column |
| `sidebar` | `--sidebar` | OS rail |
| `toolbar` | `--toolbar` | Top nav |
| `header` | `--header` | Executive / page header band |
| `border` | `--border` | Hairlines |
| `divider` | `--divider` | Quiet rules |
| `accent` | `--brand-primary`, `--accent`, `--ring` | Primary act |
| `accent-hover` / `accent-active` | matching aliases | States |
| `accent-foreground` | `--text-inverse` | On accent |
| `texture` | `--atmosphere-texture` | Optional fill (SVG/data URL or `none`) |
| `chart-1` … `chart-8` | `--chart-1` … `--chart-8` | Optional series retint |

### 4.3 New semantic aliases (chrome split)

VS-008 root cause for “chrome did not change”: toolbar and sidebar share `--ids-foundation-surface-fill`.

Add aliases and point surface utilities at them:

| Alias | Default (compat) | Consumers |
|---|---|---|
| `--workspace` | `--background` | `OsShell` main, `body` |
| `--sidebar` | `--ids-foundation-surface-fill` | `ids-surface-sidebar` |
| `--toolbar` | `--ids-foundation-surface-fill` | `ids-surface-toolbar` |
| `--header` | `transparent` on `--workspace` | `PageHeader` band |
| `--card` | `--surface-elevated` | `ids-surface-card` |
| `--atmosphere-texture` | `none` | optional overlay on workspace / auth aside |

Until atmosphere CSS paints distinct values, aliases equal today’s fills. That migration is invisible.

### 4.4 Must not retint

| Token family | Owner | Reason |
|---|---|---|
| `--ids-foundation-space-*` | Climate / foundation | One geometry |
| `--ids-foundation-type-*` | Foundation | One ladder |
| `--ids-foundation-radius-*` | Foundation | One chrome language |
| `--ids-foundation-z-*` | Foundation | One stacking |
| `--success` `--warning` `--danger` `--info` | Climate | Signal integrity. Colour is never the only encoding, but the roles stay OS-wide |

Atmosphere may shift chart series. It must not recode danger as accent or success as brand.

### 4.5 Text

Atmosphere may retint `--text-primary` / `--text-secondary` / `--text-muted` only when contrast against the new surfaces still meets WCAG 2.2 AA. Prefer keeping climate ink and changing paper. Qualora medical white and Calviora healthcare neutrals are paper shifts, not a second type colour system.

### 4.6 Selector contract

```css
/* Layer 1 — already shipped, do not edit in this programme */
:root { /* Executive Light foundation */ }
.dark { /* Executive Dark foundation */ }

/* Layer 2 */
html[data-ids-atmosphere="qualora"] { /* aliases from --ids-atmosphere-qualora-* */ }
html.dark[data-ids-atmosphere="qualora"] { /* dark atmosphere */ }

/* Layer 3 */
html[data-ids-contrast="high"] { /* stronger border/text; flatten mix */ }
html[data-ids-motion="reduced"],
html[data-ids-motion="system"] { /* system defers to media query already in globals */ }
```

Migration dual-write: `data-ids-brand` remains until CSS selectors move. Bind writes both attributes with the same id.

### 4.7 File ownership (target, not this sprint)

```
packages/ids/
  tokens/
    foundation.css          LOCKED climate
    surfaces.css            add chrome aliases only in implementation
    index.css               import atmospheres after climate aliases
    atmosphere/
      ventureos.css
      qualora.css
      calviora.css
      farmora.css
    brand/                  deprecated after dual-write window
  themes/
    climate.css             aliases; extend with --sidebar --toolbar --workspace --header
    bind.ts                 map definition id → atmosphere id; apply both attributes
    a11y.ts                 apply data-ids-motion / data-ids-contrast
```

Textures and marks live beside atmosphere CSS, referenced only through `--atmosphere-texture` and accent, never as per-page hex.

## 5. Runtime and binder ownership

| Concern | Owner | Must not |
|---|---|---|
| Definition id | Venture Instance / Definition Registry | Presentation must not invent product ids |
| Atmosphere id | `packages/ids/themes/bind.ts` | Import Runtime, capability registry, or persistence |
| Apply attribute | Shell binder (today `IdsBrandBinder` in `OsShell`) | Run `runExecutiveIntelligenceRuntime` |
| Climate | `ThemeProvider` / next-themes | Read venture id |
| A11y attributes | New `IdsA11yBinder` in root `Providers` | Depend on active venture |
| Unauthenticated | SSR `data-ids-atmosphere="ventureos"` on `<html>` | Guess a product |

Resolution order for atmosphere:

1. Active venture `definitionId` via `brandFromDefinitionId` (rename to `atmosphereFromDefinitionId` after dual-write).
2. Else `ventureos`.

No founder Appearance control for atmosphere. Switching company is switching headquarters. That is the product.

## 6. Component ownership

Components own structure. Atmosphere owns material.

| Surface | File(s) | Consume | Do not |
|---|---|---|---|
| App shell | `os-shell.tsx` | `--workspace` on frame | Branch on atmosphere id |
| Sidebar | `sidebar.tsx` | `ids-surface-sidebar` → `--sidebar` | Product colours |
| Toolbar | `top-nav.tsx` | `ids-surface-toolbar` → `--toolbar` | Product colours |
| Executive header | `page-header.tsx` | `--header`, kicker, display roles | Atmosphere-specific copy forks |
| Workspace / main | `page-frame.tsx` | `--workspace` | Layout forks |
| Cards / panels | `packages/ui` + `ids-surface-card` | `--card` / elevated | Hex |
| Auth HQ | `executive-auth-shell.tsx` | sidebar + workspace tokens | Bind product atmospheres |
| Loading | `executive-loading.tsx` | skeleton + `--surface` | Atmosphere spinners |
| Empty | `empty-copy.tsx` | type roles; optional texture behind | Four empty-state layouts |
| Mark | `venture-mark.tsx` | OS name stays VentureOS in OS chrome | Rename the OS per product |
| Charts | situation-room / dashboard charts | `--chart-1`…`--chart-8` | Hardcoded series |
| Icons | Lucide / `ids-icon-*` | `currentColor` | Per-atmosphere icon sets |
| Settings appearance | `appearance.tsx` | climate only | Atmosphere picker |
| Settings a11y | new (implementation sprint) | motion + contrast | Climate or atmosphere |

Graphics and illustrations: one slot (for example empty-state mark, auth texture). The slot reads `--atmosphere-texture` and accent. Four headquarters, one component.

## 7. CSS ownership

| Layer | Writes | Reads |
|---|---|---|
| `foundation.css` | Climate source hex and type/space | Nothing from atmosphere |
| `surfaces.css` | Fill/border/shadow **roles** | Foundation colour roles |
| `climate.css` | Semantic aliases | Foundation + atmosphere source |
| `atmosphere/*.css` | `--ids-atmosphere-*` and alias overrides on `html[data-ids-atmosphere]` | Foundation colour as mix bases where needed |
| `globals.css` utilities | `ids-surface-*`, `vos-btn-primary`, type roles | Aliases only |
| App TSX | class names | No hex, no atmosphere selectors |

`vos-btn-primary` already uses `var(--brand-primary)`. It will pick up atmosphere accent with no component edit once Layer 2 paints accent.

Auth left rail uses `ids-surface-sidebar`. After chrome split, Qualora can sit on medical-white rail while the desk uses a cooler workspace, without a layout change.

## 8. Compatibility with IDS

This document does not amend IDS-001 or IDS-002. Implementation of atmosphere painting requires a later IDS programme to ratify expanded Layer 2 scope.

| IDS rule | v1.1 stance |
|---|---|
| IDS-001 §6 One OS, many products | Hold. Atmosphere is not four applications |
| IDS-001 Brand tokens “accent, atmosphere, kicker” | Expand atmosphere to chrome + surfaces; still no private Runtime |
| IDS-001 two climates only | Hold. Layer 1 locked |
| IDS-001 accessible by construction | Layer 3 makes reduced motion and high contrast first-class |
| IDS-001 identity after architecture | Hold. Binder still reads definition id only |
| IDS-002 overlay mix 4–7% | Supersede for Layer 2 once ratified; climate files untouched |
| IDS-002 Appearance = climate only | Hold |
| IDS-001 / IDS-002 Calviora = livestock, earth/hay | **Conflict.** VS-009 specifies healthcare teal operations centre. Do not paint Calviora until product and IDS agree |
| Tokens before one-off colour | Hold. No hex in components |
| Motion is short; honour reduced motion | Hold. Layer 3 override |

Qualora (clinical slate → slate + medical white + soft purple) and Farmora (chlorophyll/soil → earth, greens, stone) are expansions of current IDS product roles.

VentureOS as graphite/forest/glass HQ is an expansion of current climate-as-OS. Climate stays the two polarities; VentureOS atmosphere must finally differ from “climate with no overlay”.

## 9. Migration strategy

Zero-downtime. Each phase ships without requiring the next.

### Phase 0 — Architecture (this sprint)

This document and the accompanying canvas. No CSS, token, Runtime, or IDS edits.

### Phase 1 — Chrome aliases (invisible)

Add `--workspace`, `--sidebar`, `--toolbar`, `--header`, `--card` equal to today’s values. Point `ids-surface-sidebar` / `ids-surface-toolbar` / body / card utilities at them. Dual-write `data-ids-atmosphere` beside `data-ids-brand`. No hex change. Proof: VS-008 screenshots still match.

### Phase 2 — Atmosphere token files (still compatible)

Move current brand overlay rules to `tokens/atmosphere/*.css` with the same accent-plus-mix values. Selectors accept both `data-ids-brand` and `data-ids-atmosphere`. Proof: still not a headquarters change; engine path proven again only as a regression check, not a VS-008 rerun.

### Phase 3 — Paint VentureOS HQ

First atmosphere that must be instantly recognisable as technology HQ under both climates. Graphite / forest / stone / glass on workspace, sidebar, toolbar, cards, accent. Climate Light/Dark still invert paper and ink.

### Phase 4 — Paint Qualora, then Farmora

Qualora: medical white / slate / soft purple evidence panels. Farmora: earth / green / stone / open workspace. Proof: same Situation Room route; founder names the company without reading the mark.

### Phase 5 — Calviora, after identity ratification

Do not implement healthcare teal while IDS-001 still names livestock/hay. Either:

- A. Ratify Calviora as healthcare operations (amend IDS in a dedicated programme), then paint teal, or
- B. Keep livestock/hay and reject VS-009 Calviora direction.

This architecture records both; it does not choose by painting.

### Phase 6 — Accessibility layer

`IdsA11yBinder`, Settings Accessibility, `data-ids-motion`, `data-ids-contrast`. Map high contrast to stronger `--border` / `--text-primary` and reduced atmosphere mix. Collapse motion using the same rules as the existing media query.

### Phase 7 — Deprecate overlay vocabulary

Remove `data-ids-brand` after one release of dual-write. Rename binder and `IDS_BRANDS` to atmosphere names. Delete `tokens/brand/` once atmosphere files are the only writers.

## 10. Implementation roadmap (later sprints)

Not this sprint. Order:

1. Chrome alias PR (Phase 1).
2. File move + dual-write (Phase 2).
3. VentureOS atmosphere visual programme (Phase 3) — design tokens first, then CSS only in `atmosphere/ventureos.css`.
4. Qualora visual programme (Phase 4).
5. Farmora visual programme (Phase 4).
6. IDS Calviora decision, then Calviora visual programme (Phase 5).
7. Accessibility (Phase 6).
8. Asset pass: textures, marks, empty-state illustrations via `--atmosphere-texture` (may overlap 3–5).
9. Deprecate brand attribute (Phase 7).

Each visual programme: token table (light + dark), WCAG check, same-screen screenshots on Situation Room, no layout diffs, no Runtime diffs.

## 11. Affected components (inventory)

No edits now. Implementation later touches these consumers of surface/accent — not their structure.

**Shell:** `os-shell.tsx`, `sidebar.tsx`, `top-nav.tsx`, `page-frame.tsx`, `page-header.tsx`, `command-palette.tsx`, `notification-center.tsx`, `profile-menu.tsx`, `theme-toggle.tsx` (climate only), `executive-loading.tsx`, `empty-copy.tsx`, `deferred-operating-screen.tsx`, `venture-mark.tsx`, `workspace-switcher.tsx`, `venture-switcher.tsx`.

**Theme:** `theme-provider.tsx` (untouched), `ids-brand-binder.tsx` (dual-write / rename), `providers.tsx` (a11y binder), `layout.tsx` (SSR default attribute).

**Auth:** `executive-auth-shell.tsx`, login/signup screens.

**Modules:** situation-room, executive-office, ventures launch/HQ, settings appearance (+ new a11y screen), dashboard section cards.

**Packages:** `packages/ids` tokens and bind, `packages/ui` Button/Card (already alias-based).

**CSS:** `apps/web/src/app/globals.css` utilities only as needed to read new aliases.

**Out of scope:** Runtime pipeline, capability registry, definition registry (except remaining the source of `definitionId`), persistence, routing trees, command ids other than optional `a11y.*`.

## 12. Risk assessment

| Risk | Severity | Mitigation |
|---|---|---|
| Atmosphere recodes semantic danger/success | High | Climate keeps those roles |
| Contrast fails AA on new papers | High | Contrast gate per atmosphere × climate before merge |
| High contrast erases headquarters identity | Medium | Flatten mix; keep accent; do not greyscale |
| Calviora livestock vs healthcare | High | Phase 5 blocked on IDS/product ratification |
| Chrome aliases regress glass toolbar | Medium | Keep `backdrop-filter` path; only change fill token |
| Dual attributes hydrate mismatch | Medium | SSR both; binder writes both in one `setAttribute` pair |
| Textures become decoration / motion | Medium | Static SVG or CSS noise; honour reduced motion; no looping brand animation |
| Charts change meaning of health | Medium | Series retint only; health still uses semantic roles |
| Founder expects Atmosphere in Appearance | Low | Document: company switcher is the HQ door |
| Future venture without CSS file | Low | Fail closed to `ventureos` |
| Accidental climate hex edit | High | Climate files locked in review; atmosphere files only |

## 13. Recommended rollout

1. Ship Phases 1–2 as engineering (no visual brief). Safe on production.
2. Ship VentureOS HQ next. If the default OS still looks like “overlay climate”, the programme has not started.
3. Ship Qualora and Farmora as separate visual PRs on the same Situation Room fixture.
4. Hold Calviora until IDS and product name the same headquarters.
5. Ship Layer 3 after at least two atmospheres exist, so high contrast can be tested against real tints.
6. Remove `data-ids-brand` only after support has one release of dual-write.

Acceptance for “instantly recognise which Venture”:

- Same authenticated screen, same climate, switch company.
- Sidebar, toolbar, workspace, cards, and primary act change together.
- An executive names the headquarters without reading the logo.
- Navigation, layout, and workflows are pixel-structure identical (spacing, type roles, tree).

## 14. What this sprint does not do

- No Theme Provider repair.
- No climate token edits.
- No Runtime, routing, or workflow changes.
- No IDS-001 / IDS-002 amendment.
- No atmosphere painting.

Next implementation sprint starts at Phase 1 (chrome aliases + dual-write), not at a redesign of `ThemeProvider`.
