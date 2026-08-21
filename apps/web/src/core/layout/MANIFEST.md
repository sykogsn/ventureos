# Executive Layout Manifest

**Version.** 2.0 — Platform Layout Foundation  
**Authority.** VentureOS Platform Constitution v1.0, Article 9.  
**Implementation.** `apps/web/src/core/layout/primitives.tsx`  
**Tokens.** `packages/ids/tokens/foundation.css`  
**Reference.** Authentication remains the certified consumer of BrandRail / ExecutiveMeasure.

**Rule.** Tailwind may appear inside `apps/web/src/core/layout/`. Product modules and platform chrome do not compose Tailwind layout utilities. They compose these primitives.

---

## Phase 1 — Migration matrix

| Current primitive | Responsibility | Limitation | Platform equivalent | Consumers |
|---|---|---|---|---|
| `ExecutiveFrame` | Full-height climate canvas | OS shell also needs skip, rail, and main landmarks | `Workspace` (alias retained) | Auth shell, OsShell, root loading |
| `ExecutiveSplit` | Group rail and stage | No inspector split vocabulary | `SplitView` | Auth shell |
| `ExecutiveRail` | Brand column 28/32rem | Not a navigation rail; too wide for wayfinding | `BrandRail` (auth) + `NavigationRail` (workspace) | Auth shell / Sidebar |
| `ExecutiveStage` | Growing column | Did not host toolbar + main | `Stage` | Auth shell, OsShell |
| `ExecutiveBanner` | Compact auth chrome on small viewports | Not the OS toolbar | `Banner` (auth) + `Toolbar` (workspace) | Auth shell / TopNav |
| `ExecutiveMain` | Vertically centres the auth measure | Workspace main must not centre operating pages | `Main align=center` (auth) + `WorkspaceMain` | Auth / OsShell |
| `ExecutiveMeasure` | 28rem reading column | Cannot express 42rem prose or 72rem canvas | `ReadingRegion` sizes + `WorkspaceCanvas` | Auth / PageFrame / empty copy |
| `ExecutiveStack` | tight / form / section | Missing compact chrome gap | `Stack` (+ compact) | Auth, VentureMark, chrome |
| `ExecutiveForm` / `Field` / `Inline` | Form rhythm | Remain authentication/form primitives | Unchanged aliases | Auth screens |
| `ExecutiveCluster` | Wrapped paired actions | Needed start/end and nowrap for chrome | `Cluster` | Auth, page header |
| `ExecutiveFill` / `Fit` | Stretch or shrink a child | Fill is not flex-grow for the toolbar search | `Fill` / `Fit` + `Grow` | Auth / TopNav |
| `ExecutiveDocument` | Auth title block always h1 | Workspace titles use display + breadcrumb | `ExecutiveDocument` (auth) + `HeaderRule` / `Breadcrumb` | Auth / PageHeader |
| `ExecutiveRule` | Centred caption | Still auth-only | `Rule` | Auth |
| *(none)* | Workspace page canvas 72rem | Lived as `max-w-[72rem]` in PageFrame | `WorkspaceCanvas` | PageFrame, ExecutiveLoading |
| *(none)* | Navigation 13.75rem / 15rem | Lived as `w-[13.75rem]` / `w-60` | `NavigationRail` | Sidebar |
| *(none)* | Inspector 17.5rem | Lived as `17.5rem` grid track | `Inspector` | Ready for office/brain; not migrated this sprint |
| *(none)* | Grid 2 / 4 | Lived as `lg:grid-cols-2` / `xl:grid-cols-4` | `Grid` | Ready for rooms; ExecutiveLoading uses it |
| *(none)* | Command overlay | Lived as `pt-[15vh]` / `max-w-xl` | `CommandRegion` | Command palette |
| *(none)* | Page footer | Lived as ad-hoc footer | `StatusRegion` | PageFrame |

---

## Platform concepts

Composition for the operating workspace:

```
Workspace
  SkipLink
  SplitView
    NavigationRail
      NavigationBrand
      NavigationMenu
        NavigationSection
          NavigationItem
    Stage
      Toolbar
      WorkspaceMain
        PageRoot
          WorkspaceCanvas
            HeaderRule
              Breadcrumb
              Cluster
                ReadingRegion
                actions
            Dashboard
              Grid | Flow | SplitView
                ReadingRegion | Inspector
            StatusRegion?
  CommandRegion
```

Authentication (certified reference):

```
Workspace (ExecutiveFrame)
  SplitView (ExecutiveSplit)
    BrandRail (ExecutiveRail)
    Stage (ExecutiveStage)
      Banner (ExecutiveBanner)
      Main align=center (ExecutiveMain)
        ExecutiveMeasure
          Stack
            ExecutiveDocument
            Form
```

---

## Primitives

Every primitive below is layout only. None may import Runtime, capabilities, definitions, persistence, or workspace membership services.

### Workspace

- **Purpose.** Root climate canvas for a VentureOS session.
- **Responsibilities.** Fill viewport height. Apply climate. Host skip, rail, stage, command.
- **Allowed children.** SkipLink, NavigationRail, SplitView, Stage, CommandRegion.
- **Forbidden children.** Runtime output as the root. Product grids.
- **Responsive behaviour.** Row at all breakpoints.
- **Accessibility.** Does not own `main`. SkipLink is a sibling.
- **Token dependencies.** `--ids-foundation-color-background`.
- **Example.** `Workspace > SkipLink + NavigationRail + Stage`.
- **Migration notes.** Alias of `ExecutiveFrame`. Auth gains `text-foreground` inheritance only.

### NavigationRail

- **Purpose.** Primary wayfinding column.
- **Responsibilities.** Sidebar width. Overlay when open on small viewports.
- **Allowed children.** NavigationBrand, NavigationMenu.
- **Forbidden children.** WorkspaceCanvas, intelligence cards.
- **Responsive behaviour.** Hidden below large unless `open`.
- **Accessibility.** `id=primary-navigation`. Overlay labelled “Close navigation”.
- **Token dependencies.** `--ids-foundation-layout-sidebar-sm`, `--ids-foundation-layout-sidebar-md`.
- **Example.** `NavigationRail open onDismiss`.
- **Migration notes.** Replaces shell `aside`. Not BrandRail.

### NavigationBrand / NavigationMenu / NavigationSection / NavigationItem

- **Purpose.** Chrome inside the rail.
- **Responsibilities.** Brand row at toolbar height; scrollable sections; wayfinding links.
- **Allowed children.** Mark, type, icons. Item children are label contents.
- **Forbidden children.** Canvas, command overlay.
- **Responsive behaviour.** Inherit the rail.
- **Accessibility.** Primary `nav`. Item sets `aria-current`.
- **Token dependencies.** `--ids-foundation-layout-toolbar`, space-1/2/3/6.
- **Example.** `NavigationItem href current onNavigate`.
- **Migration notes.** Next.js `Link` is wayfinding, not intelligence.

### WorkspaceCanvas

- **Purpose.** Bounded operating canvas.
- **Responsibilities.** `measure.xl` column, screen inset, section gap.
- **Allowed children.** HeaderRule, Dashboard, Flow, Grid, StatusRegion.
- **Forbidden children.** NavigationRail, CommandRegion.
- **Responsive behaviour.** Full width until 72rem. `vos-screen` padding grows at large.
- **Accessibility.** Inside WorkspaceMain. No second `main`.
- **Token dependencies.** `--ids-foundation-layout-measure-xl`.
- **Example.** `WorkspaceCanvas > HeaderRule + Dashboard`.
- **Migration notes.** Replaces `max-w-[72rem]`.

### Dashboard

- **Purpose.** Operating body of a workspace page.
- **Responsibilities.** Vertical sequence of judgements.
- **Allowed children.** Grid, Flow, Stack, ReadingRegion, Inspector, SplitView.
- **Forbidden children.** Toolbar, CommandRegion.
- **Responsive behaviour.** Column.
- **Accessibility.** No landmark.
- **Token dependencies.** `--ids-foundation-space-8`.
- **Example.** `Dashboard > Grid variant=executive`.
- **Migration notes.** PageFrame children wrapper.

### Document / ExecutiveDocument

- **Purpose.** Title block.
- **Responsibilities.** Kicker, heading, description. Workspace pages may use HeaderRule + `ids-display` instead so Situation Room rank does not change.
- **Allowed children.** None (props).
- **Forbidden children.** Forms, grids.
- **Responsive behaviour.** Stack.
- **Accessibility.** One `h1`.
- **Token dependencies.** `--ids-foundation-space-2`.
- **Example.** `ExecutiveDocument` on authentication.
- **Migration notes.** Auth reference unchanged. Do not restyle PageHeader titles through Document.

### ReadingRegion

- **Purpose.** Reading measure.
- **Responsibilities.** Cap width to sm/md/lg/xl.
- **Allowed children.** Type, Stack, lists.
- **Forbidden children.** NavigationRail, analytics Grid.
- **Responsive behaviour.** Width cap only.
- **Accessibility.** Line length, not a landmark.
- **Token dependencies.** `--ids-foundation-layout-measure-*`.
- **Example.** `ReadingRegion size=md` for empty copy.
- **Migration notes.** Replaces `max-w-[42rem]` and `max-w-lg`.

### Inspector

- **Purpose.** Supporting column.
- **Responsibilities.** `sidebar.lg` from large. Optional sticky.
- **Allowed children.** Stack, Panel, type.
- **Forbidden children.** NavigationRail, WorkspaceCanvas.
- **Responsive behaviour.** Full width below large.
- **Accessibility.** `aside`. Sticky does not trap focus.
- **Token dependencies.** `--ids-foundation-layout-sidebar-lg`.
- **Example.** `SplitView > Flow + Inspector sticky`.
- **Migration notes.** Ready for Executive Office / Brain. Rooms are not migrated in this sprint.

### Panel

- **Purpose.** Fixed supporting width.
- **Responsibilities.** panel.sm/md/lg. No surface chrome.
- **Allowed children.** Stack, lists.
- **Forbidden children.** Workspace.
- **Responsive behaviour.** `max-w-full`.
- **Accessibility.** Not a dialog.
- **Token dependencies.** `--ids-foundation-layout-panel-*`.
- **Example.** `Panel size=md`.
- **Migration notes.** Replaces `w-72` / `w-80`.

### Toolbar

- **Purpose.** Workspace chrome above main.
- **Responsibilities.** Toolbar height. Horizontal acts.
- **Allowed children.** Reveal, Grow, Trailing, controls.
- **Forbidden children.** WorkspaceCanvas, Grid.
- **Responsive behaviour.** Padding/gap increase at small. Children use Reveal.
- **Accessibility.** `role=banner`.
- **Token dependencies.** `--ids-foundation-layout-toolbar`.
- **Example.** `Toolbar > Grow + Trailing`.
- **Migration notes.** TopNav.

### StatusRegion

- **Purpose.** Page footer.
- **Responsibilities.** Hairline. `mt-auto`.
- **Allowed children.** Type, Cluster.
- **Forbidden children.** NavigationRail.
- **Responsive behaviour.** Full canvas.
- **Accessibility.** `footer`.
- **Token dependencies.** `--ids-foundation-space-6`.
- **Example.** PageFrame footer.
- **Migration notes.** PageFrame.

### CommandRegion

- **Purpose.** Command overlay.
- **Responsibilities.** Overlay, dismiss, measure.md dialog.
- **Allowed children.** Field, Stack, EmptyCopy, lists.
- **Forbidden children.** NavigationRail, Runtime.
- **Responsive behaviour.** Offset from `layout-command-offset`.
- **Accessibility.** `role=dialog` `aria-modal`. Ask is not a chat Runtime.
- **Token dependencies.** `--ids-foundation-layout-command-offset`, `--ids-foundation-layout-measure-md`.
- **Example.** Command palette.
- **Migration notes.** Dialog width moves from 36rem (`max-w-xl`) to measure.md (32rem).

### Grid

- **Purpose.** Peer regions.
- **Responsibilities.** `executive` two columns from large. `analytics` two from medium, four from extra-large.
- **Allowed children.** Cards, Stack.
- **Forbidden children.** NavigationRail, SkipLink.
- **Responsive behaviour.** Single column first.
- **Accessibility.** DOM order is reading order.
- **Token dependencies.** `--ids-foundation-layout-grid-executive`, `--ids-foundation-layout-grid-analytics`.
- **Example.** `Grid variant=analytics`.
- **Migration notes.** Ready for Situation Room, Brain, HQ.

### Flow / Stack / Cluster / SplitView

- **Purpose.** Sequence, rhythm, horizontal group, peer grouping.
- **Responsibilities.** As named. SplitView has no box.
- **Allowed children.** Layout regions and type.
- **Forbidden children.** A second orchestrator, a Product Registry.
- **Responsive behaviour.** Stack/Flow column. Cluster wraps unless `wrap=false`.
- **Accessibility.** No landmarks.
- **Token dependencies.** Space-2/3/6/8.
- **Example.** Auth form uses Stack + Cluster.
- **Migration notes.** Executive* aliases retained.

### SkipLink / Stage / WorkspaceMain / PageRoot

- **Purpose.** Accessibility skip; growing column; main landmark; page section.
- **Responsibilities.** Skip targets `#main-content`. WorkspaceMain is the only OS `main`. PageRoot may set `data-venture-id`.
- **Allowed children.** As in the composition tree.
- **Forbidden children.** Two `main` landmarks.
- **Responsive behaviour.** Stage fills the row.
- **Accessibility.** Skip is first. Main is `tabIndex=-1`.
- **Token dependencies.** `--ids-foundation-layout-skip-shift`.
- **Example.** OsShell.
- **Migration notes.** Moved out of OsShell class strings.

### BrandRail / Banner / Main / ExecutiveMeasure / Form / Field / Inline / Fill / Fit / Rule

- **Purpose.** Authentication reference primitives.
- **Responsibilities.** Unchanged from Layout v1.
- **Allowed children.** As v1.
- **Forbidden children.** Workspace navigation. Intelligence cards.
- **Responsive behaviour.** BrandRail hidden below large. Banner visible below large. Main centres.
- **Accessibility.** Auth `main` is the auth landmark (auth route has no OsShell).
- **Token dependencies.** `--ids-foundation-layout-rail`, `--ids-foundation-layout-measure-sm`.
- **Example.** `ExecutiveAuthShell`.
- **Migration notes.** Certified reference. Do not restyle.

### Reveal / Grow / Trailing / SwitcherBound / HeaderRule / Breadcrumb

- **Purpose.** Chrome helpers for toolbar and page header.
- **Responsibilities.** Breakpoint presence; search grow; trailing cluster; switcher measure; header rule; breadcrumb list.
- **Allowed children.** Controls, type.
- **Forbidden children.** Grids, rails.
- **Responsive behaviour.** Reveal maps show/hide at sm/md/lg.
- **Accessibility.** Breadcrumb has `nav aria-label=Breadcrumb`.
- **Token dependencies.** Switcher sm/md. Space-2/5/8.
- **Example.** TopNav, PageHeader.
- **Migration notes.** Not product-room primitives.

---

## Tokens

| Token | Role | Value |
|---|---|---|
| `--ids-foundation-layout-measure-sm` | Auth document / brand rail | 28rem |
| `--ids-foundation-layout-measure-md` | Empty copy / command dialog / brand rail wide | 32rem |
| `--ids-foundation-layout-measure-lg` | Prose | 42rem |
| `--ids-foundation-layout-measure-xl` | Workspace canvas | 72rem |
| `--ids-foundation-layout-sidebar-sm` | Compact nav | 13.75rem |
| `--ids-foundation-layout-sidebar-md` | Nav from large | 15rem |
| `--ids-foundation-layout-sidebar-lg` | Inspector | 17.5rem |
| `--ids-foundation-layout-panel-sm` | Compact overlay | 16rem |
| `--ids-foundation-layout-panel-md` | Menu overlay | 18rem |
| `--ids-foundation-layout-panel-lg` | Notification overlay | 20rem |
| `--ids-foundation-layout-grid-executive` | Two columns | `repeat(2, minmax(0, 1fr))` |
| `--ids-foundation-layout-grid-analytics` | Four columns | `repeat(4, minmax(0, 1fr))` |
| `--ids-foundation-layout-toolbar` | Chrome height | 3.5rem |
| `--ids-foundation-layout-command-offset` | Palette inset | 15vh |
| `--ids-foundation-layout-skip-shift` | Skip hide | 180% |
| `--ids-foundation-layout-switcher-sm` | Workspace switcher | 11rem |
| `--ids-foundation-layout-switcher-md` | Venture switcher | 12rem |
| `--ids-foundation-layout-rail` | Alias of measure.sm | |
| `--ids-foundation-layout-rail-wide` | Alias of measure.md | |
| `--ids-foundation-layout-measure` | Alias of measure.sm | |

Hex colour tokens are not layout tokens and are not changed.

---

## Validation

`apps/web/src/core/layout/product-layout.test.ts`

1. Product modules (`modules/auth`, `app/(auth)`) do not compose Tailwind layout utilities.
2. Layout primitives contain no business logic.
3. Foundation tokens listed above exist.
4. Platform chrome consumes Workspace Layout primitives and does not compose Tailwind layout utilities.
5. Remaining product rooms are inventoried; they are not a licence to add more layout atoms.

---

## Out of scope this sprint

Situation Room, Executive Office, Brain, Company HQ, Settings, and Launch internals still compose Tailwind. The primitives exist so those rooms can migrate later. This sprint does not restyle them.
