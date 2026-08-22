# Foundation v1.0 — Baseline

**Status.** Stable baseline record  
**Date.** 2026-08-22  
**Owner.** Engineering  
**Tag.** `ventureos-foundation-v1.0`  
**Certification.** [Foundation v1.0](./certification/FOUNDATION-V1.0.md)  
**Not this document.** Sprint close-out for Brain lives in [BRAIN_PROGRAMME.md](../engineering/BRAIN_PROGRAMME.md). Do not treat this file as permission to open VC-020.

This report records the repository state at the Foundation v1.0 stability tag. The tag points at the last product commit before this document. This file is documentation only.

---

## Current branch

`fix/foundation-hardening`

Tracks `origin/fix/foundation-hardening`.

## Current commit hash

`65f415c2d6b8df70e2f60aebc8f09dabacd3087d`

Message: `VC-011 — Operating Knowledge Types`

This is the commit named by `ventureos-foundation-v1.0`.

## Latest tag

`ventureos-foundation-v1.0`

| Fact | Value |
|---|---|
| Local peel | `65f415c2d6b8df70e2f60aebc8f09dabacd3087d` |
| Remote | `origin` — `https://github.com/sykogsn/ventureos.git` |
| Remote ref | `refs/tags/ventureos-foundation-v1.0` |
| Remote tag object | `a5de2e16c2ab0adf07723124957de13441ccb711` |
| Verified on GitHub | Yes |

Related earlier tags (not this baseline):

- `v1.0.0` — local annotated tag on `836725a` (`certify: VentureOS Foundation v1.0`)
- `ventureos-foundation-1.0.0` — earlier release tag on `3cbf14d`

## Number of passing tests

**311 passing. 0 failing.**

| Package | Command | Result |
|---|---|---|
| `web` | `pnpm --filter web test` | Pass (198) |
| `@repo/brain` | `pnpm --filter @repo/brain test` | Pass (21) |
| `@repo/ids` | `pnpm --filter @repo/ids test` | Pass (92) |
| Combined | `pnpm exec turbo run test --filter=web --filter=@repo/brain --filter=@repo/ids` | 3 successful, 3 total |

`@repo/ui` has no test script.

## Production build status

**Pass.**

`pnpm --filter web build` completed with exit code 0.

- IDS development guard: generated tokens present; source graph valid
- Next.js 16.3.0 (Turbopack): compiled successfully
- TypeScript: finished
- Static pages: 42/42 generated
- No CSS parse errors
- No middleware deprecation warning

## Working tree status

Clean at the tagged commit. No uncommitted product changes.

This report is the only file added after the tag.

## Repository status

| Item | Value |
|---|---|
| Repository | `C:\Users\sykog\Projects\ventureos` |
| Remote | `origin` → `https://github.com/sykogsn/ventureos.git` |
| Branch | `fix/foundation-hardening` |
| Upstream | `origin/fix/foundation-hardening` |
| Baseline commit | `65f415c2d6b8df70e2f60aebc8f09dabacd3087d` |
| Baseline tag | `ventureos-foundation-v1.0` (pushed and verified) |
| Integration branch | `main` at `e28f56d` — this baseline is not merged into `main` |
| Next sprint | VC-020 is not opened |

This baseline does not certify Runtime as a new architecture, any product as a finished headquarters, or VentureOS Brain as complete. It freezes the Foundation v1.0 product and engineering gate after VC-011.
