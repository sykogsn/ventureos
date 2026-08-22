# Foundation v1.0 — Certification

**Date.** 2026-08-22  
**Tag.** `v1.0.0`  
**Branch at certification.** `fix/foundation-hardening`  
**Status.** Certified for product development on the locked layers. This is presentation and engineering-gate certification. It is not a second Runtime.

---

## Gate

The running application on localhost:

- Serves login HTTP 200 with IDS tokens and ThemeProvider boot
- Shows **zero Next.js issue overlays** on a clean load
- Compiles without the `middleware` deprecation warning
- Production `next build` succeeds with no CSS parse errors
- Executive Light, Executive Dark, and System persist in `localStorage` key `theme` and survive refresh

Closed in this certification:

- IDS consumption through climate aliases (VS-008)
- Next.js session gate as `apps/web/src/proxy.ts` (TD-006 / ERT-005 / RM-011)
- `<body suppressHydrationWarning>` so browser extensions cannot raise a false hydration overlay

Inspector and extension overlays that are **not** application HTML are recorded in [`docs/foundation/KNOWN-DEVELOPMENT-ARTEFACTS.md`](../KNOWN-DEVELOPMENT-ARTEFACTS.md) (Cursor `data-cursor-ref`, Grammarly attributes, Next.js Dev Tools badge, other extension hydration diffs).

After this gate, [ADR-009](../architecture/ADR-009-VentureOS-Brain.md) registers the VentureOS Brain as the intelligence substrate. That decision does not unfreeze this certification, change Runtime, or certify Brain as implemented. Architecture: [BRAIN-001](../architecture/BRAIN-001-VentureOS-Brain-Architecture.md). Plan: [BRAIN-002](../architecture/BRAIN-002-VentureOS-Brain-Implementation-Roadmap.md). Review: [Review Process](../../foundation-library/04-ENGINEERING/Review-Process.md).

---

## Evidence

| Check | Result |
|---|---|
| `pnpm --filter web lint` | Pass |
| `pnpm --filter web check-types` | Pass |
| `pnpm --filter web test` | Pass (198) |
| `pnpm --filter @repo/ids test` | Pass (92) |
| `pnpm --filter web build` | Pass. No middleware warning. |
| `pnpm run doctor` | Pass |
| Login Light `#f7f6f3` / Dark `#12141a` | Pass, persisted |
| System follows `prefers-color-scheme` | Pass |

---

## This does not certify

- Runtime as a new architecture
- Any product (Qualora, Calviora, Farmora) as a finished headquarters
- Accessibility Layer 3 founder overrides
- Production OAuth / email credentials
- VentureOS Brain as implemented (ADR-009 is governance; VC-010 is the first code sprint)
