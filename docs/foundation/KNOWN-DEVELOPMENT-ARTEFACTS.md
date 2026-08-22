# Known development artefacts

**Status.** Foundation v1.0 certification companion  
**Date.** 2026-08-22  
**Owner.** Engineering  
**Applies to.** Runtime verification of the running desk during development  
**Certification.** [Foundation v1.0](./certification/FOUNDATION-V1.0.md)  
**Not this document.** Product honesty lives in [Known Limitations](./release/05-KNOWN-LIMITATIONS.md). Named follow-up work lives in the [Technical Debt Register](../engineering/TECHNICAL_DEBT_REGISTER.md).

This register records confirmed **non-application** issues encountered while certifying Foundation v1.0. They appear in `next dev`, Cursor’s embedded browser, or extension-equipped profiles. They are not VentureOS defects. They are not permission to redesign Runtime, IDS, Theme Provider, or `VentureMark`.

---

## Purpose

Stop the desk from treating inspector injection, browser extensions, and Next.js development chrome as Foundation failures.

An engineer or agent who sees a hydration overlay, a collapsed Dev Tools badge, or extra attributes on `<html>` / `<body>` must check this register **before** changing application HTML.

---

## How to classify a finding

1. Read the actual hydration diff or overlay text. Do not trust the first blamed file.
2. If every mismatched attribute or node is named in this register, stop. Do not change VentureOS.
3. Investigate only when the same mismatch reproduces in a **clean Chromium profile**: no Cursor snapshot injection, no extensions, no Grammarly / password-manager DOM mutation.

React’s own hydration warning already names this class: a browser extension (or inspector) that messes with HTML before React loads.

---

## KA-001 — Cursor `data-cursor-ref` hydration mismatch

### Evidence

Foundation v1.0 verification in Cursor’s embedded browser (`next dev` on `http://localhost:3000/login`).

The Next.js overlay reported: a tree hydrated but some attributes of the server-rendered HTML did not match. Next.js attributed the first node to `apps/web/src/core/shell/venture-mark.tsx`. Subsequent nodes were login controls in `apps/web/src/modules/auth/executive-auth-shell.tsx` and `apps/web/src/modules/auth/screens.tsx`.

Every recorded diff was of the form:

```
- data-cursor-ref="e0"
```

(and `e1` … `e21` on later nodes). There was no class, token, copy, or climate mismatch in those diffs.

Repository search of `apps/web` found **no** `data-cursor-ref` in application source. `VentureMark` does not read `window`, `Date`, or `Math.random()`.

A clean Chromium profile driven without Cursor snapshot injection produced empty hydration consoles on login and related routes (`hydrationConsole: []`, `pageErrors: []`).

### Root cause

Cursor’s browser snapshot tooling injects `data-cursor-ref` into the live DOM **before React hydrates**. React compares that mutated client DOM to SSR HTML. `VentureMark` is blamed because it is the first text node in the login tree, not because it emits the attribute.

`suppressHydrationWarning` on `<html>` and `<body>` does not cover descendant attributes. Sprinkling it onto every login node would hide real mismatches.

### Why this is not a VentureOS defect

The application never writes `data-cursor-ref`. The mismatch exists only in the Cursor inspector session that injects it. Clean Chromium does not reproduce it.

### How to recognise it

- Overlay text: attributes of the server-rendered HTML did not match.
- Minus side of the diff is **only** `data-cursor-ref="e…"`.
- First blamed file is often `venture-mark.tsx` even though that file is static.
- The attribute appears in Cursor’s accessibility snapshot / `browser_snapshot` refs.

### When to investigate

**Do not investigate** as a product bug when the entire diff is `data-cursor-ref`.

**Investigate** when a hydration diff in a clean Chromium profile still shows a mismatch **without** `data-cursor-ref` — for example a class, `style`, checked state, or text that exists in source.

---

## KA-002 — Grammarly attributes on `<body>`

### Evidence

During Foundation v1.0 overlay capture, hydration diffs on `<body>` included:

- `data-gr-ext-installed`
- `data-new-gr-c-s-check-loaded`

After `suppressHydrationWarning` was set on `<body>` in `apps/web/src/app/layout.tsx`, those body diffs disappeared from the live `next dev` log. They are Grammarly extension markers, not application markup.

Repository search of `apps/web` found **no** `data-gr-ext` or `data-new-gr` in source.

`<html>` already carried `suppressHydrationWarning` for next-themes climate class (`light` / `dark`) in `apps/web/src/core/theme/theme-provider.tsx`. That class is intended. It is not this artefact.

### Root cause

Grammarly (and similar writing assistants) stamp bookkeeping attributes onto `<body>` after the document is delivered and before or during hydrate. React treats extra client attributes as a mismatch unless the host node is allowed to differ.

### Why this is not a VentureOS defect

VentureOS does not install Grammarly, does not persist Grammarly state, and does not use those attributes for climate, brand, or atmosphere. The body warning flag is a host-node allowance for extension mutation. It is not a product feature.

### How to recognise it

- Diff attributes begin with `data-gr-`, `data-new-gr-`, or similar Grammarly prefixes.
- The mismatch is on `<html>` or `<body>`, not on a VentureOS control that exists in source.
- The profile has Grammarly (or an equivalent writing extension) enabled.

### When to investigate

**Do not investigate** as IDS or layout failure when the only extra attributes are Grammarly’s.

**Investigate** if `<body>` hydration diffs include VentureOS-owned attributes (`class`, `data-ids-*`, inline styles) that disagree with `layout.tsx` or climate bind.

Do not remove `suppressHydrationWarning` from `<body>` to “prove” Grammarly is gone. That re-opens a false overlay in extension-equipped browsers without fixing any application HTML.

---

## KA-003 — Next.js Dev Tools badge

### Evidence

During Foundation v1.0 theme verification, CDP checks on a clean load recorded `issueOverlay: false` and no “issues” copy in `document.body`. A collapsed Next.js Dev Tools control still appeared in `next dev`.

That control is Next.js 16 development chrome. It is not the red issues overlay. Opening it can list KA-001 / KA-002 findings that exist only in the inspector session.

Production `next build` does not ship this badge. The certified gate was **zero issue overlays on a clean load**, not the absence of the Dev Tools entry point.

### Root cause

`next dev` mounts a development toolbar so the engineer can inspect routes, errors, and settings. A collapsed badge is the idle state of that toolbar.

### Why this is not a VentureOS defect

The badge is framework development UI. It is not rendered by Situation Room, login, IDS, or any product room. Its presence does not mean the application compiled with errors.

### How to recognise it

- Small Next.js / “N” control, typically bottom-left or bottom-right in `next dev`.
- Accessible name often includes “Next.js Dev Tools” or “issues”.
- It is absent from `next start` / production.
- Body copy does not contain an issues overlay until the control is opened **and** a real or inspector-injected issue exists.

### When to investigate

**Do not investigate** the collapsed badge itself. Do not restyle, hide, or polyfill it in VentureOS.

**Investigate** when opening Dev Tools shows a compile error, CSS parse failure, missing module, proxy/middleware crash, or a hydration diff that is **not** KA-001 / KA-002 / KA-004.

---

## KA-004 — Browser extension hydration differences

### Evidence

KA-002 is the confirmed Grammarly instance of this class. The same hydrate comparison fails for any extension that inserts nodes or attributes between SSR HTML and React’s client pass.

React’s warning text for this class is explicit: a browser extension that messes with the HTML before React loaded. Cursor `data-cursor-ref` (KA-001) is inspector injection of the same shape, recorded separately because it dominated the certification overlay.

Clean Chromium (fresh user-data directory, extensions disabled, no Cursor refs) did not reproduce these diffs.

### Root cause

The browser is not a sealed runtime. Password managers, translators, dark-mode extensions, ad blockers, accessibility overlays, and grammar tools mutate the DOM. React 19 hydration is a strict tree compare. Extra client-only attributes look like application bugs if the engineer stops at the blamed component file.

### Why this is not a VentureOS defect

Extension markup is not in the repository and is not part of IDS, Runtime, or auth HTML. A mismatch that vanishes in a clean profile is an environment artefact.

Host-node `suppressHydrationWarning` on `<html>` and `<body>` is the bounded allowance for climate class and extension stamps on those two nodes. It is not a licence to suppress warnings on every descendant.

### How to recognise it

- Hydration minus-side attributes or nodes that **do not exist in source** (search the repo first).
- Reproduces only with a named extension enabled.
- Disappears in a clean Chromium profile.
- Common prefixes / signatures: `data-gr-*` (Grammarly), password-manager `data-lp*`, translator `class` insertions, reader-mode wrappers.

### When to investigate

**Do not investigate** as a Foundation defect when the extra DOM is absent from source and absent in a clean profile.

**Investigate** when:

- The mismatch reproduces with extensions disabled.
- The mismatched attribute is one VentureOS owns (`class` climate, `data-ids-brand`, `data-ids-atmosphere`, form `value` / `checked`, copy).
- The first blamed file actually emits the differing value (confirm in source; do not trust overlay attribution alone).

---

## What this register does not excuse

These remain **application or process** concerns. They are not artefacts:

| Finding | Classification |
|---|---|
| CSS parse / `@custom-media` / `Can't resolve` generated tokens | Application or stale `next dev`. Recover; do not file here. |
| Login HTTP 500 | Application. |
| `middleware` file deprecation | Framework migration. Closed in v1.0 as `apps/web/src/proxy.ts` (ERT-005). |
| Missing Light/Dark control on `/login` | Product gap (ERT-002). Not a hydration artefact. |
| `pnpm test` missing at repo root | Tooling debt (ERT-001). |
| next-themes `light` / `dark` on `<html>` | Intended climate class. Not an overlay by itself. |

Earlier ticket **ERT-003** blamed `VentureMark` / next-themes `html` class. The v1.0 overlay diffs showed **KA-001**, not a climate-class mismatch. Do not reopen Theme Provider or `VentureMark` to close ERT-003 unless a clean Chromium profile produces a non-artefact diff.

---

## Standing rule

Do not change VentureOS markup, sprinkle `suppressHydrationWarning` onto product controls, or redesign IDS / Runtime to silence an overlay whose entire diff is named in this register.

Verify suspected hydration defects in a clean Chromium profile. Record new confirmed artefacts here with evidence. Do not leave them only in a conversation.
