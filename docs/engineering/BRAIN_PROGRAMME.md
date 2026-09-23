# VentureOS Brain programme

**Purpose.** Engineering close-out for the Brain programme. Distinct from the VS-001–VS-008C ledger in [ENGINEERING_HISTORY.md](./ENGINEERING_HISTORY.md), which Engineering HQ parses as `## VS-` field tables only.  
**Authority.** Engineering Records. Architecture law is [ADR-009](../foundation/architecture/ADR-009-VentureOS-Brain.md).  
**Last Updated.** 2026-08-22

Do not copy these rows into `ENGINEERING_HISTORY.md` as `## VC-` field tables. That swallows VS-008C in the live catalogue parser.

---

## VC-001 — VentureOS Brain Architecture

Approved 2026-08-22. Design only. [BRAIN-001](../foundation/architecture/BRAIN-001-VentureOS-Brain-Architecture.md).

## VC-002 — VentureOS Brain Implementation Planning

Approved 2026-08-22. FD-B0 accepted. [BRAIN-002](../foundation/architecture/BRAIN-002-VentureOS-Brain-Implementation-Roadmap.md). First code sprint is VC-010.

## VC-003 — Brain Governance (ADR-009)

Complete 2026-08-22. ADR-009 accepted. Brain Rule 001 registered. Foundation v1.0 remains frozen. No `apps/` change. VC-010 not opened.

Evidence: [ADR-009](../foundation/architecture/ADR-009-VentureOS-Brain.md).

## VC-010 — Knowledge Object kernel

Complete 2026-08-22. Universal kernel in `@repo/brain` (`packages/brain`). Institutional types, plane, typed relationships. No graph walk, reasoning, persistence, memory, products, or learning. No `apps/` change. VC-011 not opened.

## VC-011 — Operating Knowledge Types

Complete 2026-08-22. Operating payloads registered on the kernel. Decision unchanged. No graph, reasoning, persistence, Runtime, VIC, or UI. No `apps/` change. VC-020 not opened.

## AIF-01 — Compounding Intelligence contract candidate

**Date:** 2026-09-23. **State:** implementation candidate; not independently verified
or certified. Base: `c72e2f514ba3875f449f60e159884dce7eb4da3b`.
Branch: `feat/ventureos-aif-01-intelligence-foundation`.

Control authorised Brain contracts, pure validators, fixtures/tests and standalone
Capability provenance contracts. Corrected scope excludes Definition/Genome and all
runtime/web integration. Evidence internal linkage uses existing relationships only.
Capability candidate assessment depends on source independence, not a Venture-count rule.

Control also authorised the existing Engineering HQ decision-count assertion change
from seven to nine to match committed ERD-008 and ERD-009. The corrected baseline
passed 326 tests (Brain 21, IDS 92, web 213), typechecks, lint, build and diff checks using
pnpm 9.0.0. Package manifests and lockfile stayed unchanged.

Contract semantics and limitations are recorded once in the AIF-01 section of
[BRAIN-001](../foundation/architecture/BRAIN-001-VentureOS-Brain-Architecture.md).
Final candidate gate evidence is recorded below after regression.

**Deferred governance discrepancy:** Platform Constitution describes workspace.create
on owner/admin maps while the inspected permission implementation grants it to owner
only. AIF-01 neither changes nor relies on that distinction.

No persistence, schema migration, dependency addition, Runtime change, web graph adapter,
operational sharing enforcement, autonomous behaviour, promotion execution or Git
permanence is authorised by this candidate.

### AIF-01 candidate automated evidence

Using Corepack pnpm 9.0.0 in the isolated AIF-01 worktree:

| Gate | Result | Exit |
|---|---|---|
| Brain focused tests and catalogue coverage | 80/80 passed, 4 suites | 0 |
| Capability focused tests | 32/32 passed, 6 suites | 0 |
| Workspace tests | 403/403 passed: Brain 80, IDS 92, web 231 | 0 |
| Workspace typechecks (including Brain and web) | Passed | 0 |
| Workspace lint | Passed | 0 |
| Workspace build | Passed; 43/43 static pages generated | 0 |
| Git diff whitespace check | Passed | 0 |

Architecture/static guards are included in the passing Brain and workspace suites.
The initial development test annotation/unused-import issues were corrected before
these final gates. All existing catalogue-completeness checks remain enabled.

Package manifests, pnpm-lock.yaml and package-manager configuration have no diff.
The generated IDS breakpoints file has a Windows line-ending-only working-tree
marker and no substantive Git content diff. Thirteen authorised files have substantive
changes; no new source files were created. No Git permanence was performed.

This is builder evidence for Control review only. No independent verification,
certification, running compounding-loop claim or successor milestone is implied.
