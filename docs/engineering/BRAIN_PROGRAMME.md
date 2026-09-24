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

## AIF-01 — Independent Verification defect correction

**State:** successor working-tree correction for Control publication review; not
committed, independently re-verified or certified. Published candidate
`7b712530c31f4c295ec922ebfb3240b71be447b3` remains immutable. PR #3 remains draft
and unmerged. The earlier candidate-green evidence above does not certify that
candidate: Independent Verification found a semantic assessment defect.

**RED reproduction:** on that exact candidate, an ACTIVE Learning declaring
VALIDATED_ORGANISATIONAL_PRINCIPLE with empty maturityHistory and validationHistory
was returned as a validated principle by assessKnowledgeAt. The full catalogue
validator rejected the same record. A direct safety assertion failed with exit 1.

**Root cause:** point assessment checked only that history timestamps were not future,
then projected record.maturity. Empty-array every() succeeded, and nonempty history
also bypassed authoritative transition, validation and evidence requirements.

**Usage review:** all 12 pre-existing invocations are in operating.test.ts at candidate
lines 253, 283, 286, 331, 452, 493, 701, 724, 725, 843, 854 and 857. They cover Claim
classification/effective time/retraction, outcomes, legacy results, determinism and
future Learning transitions. index.ts only re-exports the API. No production consumer
uses the unvalidated Learning projection.

**Correction:** assessKnowledgeAt retains its two-argument public signature and calls
the same private Learning-history validator as catalogue validation. Record-local
contradictions are rejected using the existing rules. With no catalogue context,
advanced maturity remains UNASSESSED, even when the record's structure is valid.
Initial OBSERVATION remains assessable. A reversal does not bypass validation of
prior promotions. Future transitions are not projected backwards. Full catalogue
validation retains strict evaluation-time, reference, scope, source-independence,
measured-success and challenge checks. There is no second maturity algorithm.

**Delta:** operating.ts is the only production-code change (+44/-31 lines).
operating.test.ts adds 28 regressions (+269/-0 lines). This section records the
correction and supersedes any interpretation of the original point assessment as
proof of advanced Learning maturity.

All correction gates used pnpm 9.0.0 and exited 0:

| Gate | Result |
|---|---|
| Targeted independent-defect regressions | 28/28 |
| Brain focused tests/catalogue coverage | 108/108 (previously 80) |
| Capability focused tests | 32/32 |
| IDS tests | 92/92 |
| Full workspace tests | 431/431 (Brain 108, IDS 92, web 231; previously 403) |
| Workspace typechecks | PASS |
| Workspace lint | PASS |
| Production build | PASS |
| git diff --check | PASS |

No Runtime/EIR, Definition/Genome, persistence, schema/migration, UI/web graph,
dependency graph, package manifest, lockfile or package-manager configuration change.
The pre-existing breakpoints.css line-ending marker remains; its byte hash is unchanged.
Nothing in this correction authorises a commit, push, merge, re-verification or certification.
