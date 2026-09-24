# Frigora Programme 1 Certification — Reactive Service Operations

**Document type.** Permanent programme certification record  
**Venture.** Frigora  
**Programme.** Programme 1  
**Control decision.** CERTIFIED  
**Certification date.** 2026-09-09  
**Approved by.** Frigora Verification & Certification Control  

This record certifies Frigora Programme 1 (F2.1 Work Execution, F2.2 Service Desk & Dispatch, F2.3 Engineer Job Workflow). It does **not** rewrite or replace the Foundation Certification Index (`docs/foundation/release/03-CERTIFICATION-INDEX.md`) or Foundation v1.1. Layer-specific and milestone certificates remain the law for their scopes.

**Engineering standard.** [Master Engineering Prompt](./MASTER_ENGINEERING_PROMPT.md). Index: [Engineering Index](./README.md).

---

## Identity

| Field | Value |
|---|---|
| VENTURE | Frigora |
| PROGRAMME | Programme 1 |
| SCOPE | F2.1 Work Execution · F2.2 Service Desk & Dispatch · F2.3 Engineer Job Workflow |
| DATE | 2026-09-09 |
| BRANCH | `feat/frigora-reconciliation` |
| PRE-PERMANENCE HEAD | `9d2c15788f8177562bc9abb4dd2426a11979ef8d` |
| PRODUCT | **frigora@0.18.0** (unchanged; Control lock — no version bump) |
| SCHEMA_GENERATION | **24** (unchanged; Control lock — no schema change) |
| Final validation BUILD_ID | `V5LNCmAHhS6zhSFkTqZY_` |
| Status | **CERTIFIED** |
| PERMANENT CERTIFICATION CHECKPOINT | The Git commit containing this certification artefact |

---

## Milestone evidence

| Milestone | Status | Permanent checkpoint | Artefact / record |
|---|---|---|---|
| F2.1 Work Execution | CERTIFIED / admitted | `3d27699de63923c1cfc5a08bddab8ea8b356c422` | ECE-002 / FD-009 |
| F2.2 Service Desk & Dispatch | CERTIFIED / admitted | `bee64990c10a28cc5df4c9b88c99c636cd37c38b` | ECE-003 / FD-010 |
| F2.3 Engineer Job Workflow | CERTIFIED / admitted | `9d2c15788f8177562bc9abb4dd2426a11979ef8d` | [FRIGORA_F2_3_CERTIFICATION.md](./FRIGORA_F2_3_CERTIFICATION.md) |

F2.3 is admitted into the live `frigora@0.18.0` definition by this Programme 1 gate product-law reconciliation without a version bump (Control decision).

---

## Programme 1 capability matrix

| Capability | Primary owner | Integration |
|---|---|---|
| Work Execution | F2.1 | Explicit close/cancel/reopen/follow-up; departure ≠ complete |
| Service Desk / Dispatch | F2.2 | UTC board, windows, assign/reassign, accept/decline |
| Engineer Job Workflow | F2.3 | My Work → job → Visit → facts/evidence → depart |
| Assignment lifecycle | F2.2 (+ F2.3 authority) | Existing WorkOrder assignment model |
| WorkOrder lifecycle | F2.1 | `open` / `closed` / `cancelled` governance |
| Visit lifecycle | Pre-F2.1 + F2.3 | Arrive/depart; engineer operational path |
| Evidence lifecycle | F2.0 + F2.3 | Capture under assignment; protected store/open/delete |
| Owner/Dispatch authority | F2.1 / F2.2 | `venture.update` complete/cancel/dispatch |
| Engineer authority | F2.3 | Current assignee operational access |
| Stale-session revocation | F2.3 | Reassignment revokes former assignee mutations |
| Protected evidence R/W/D | F2.3 (RPV-001 / RPV-002) | Domain authority + protected read policy |
| Historical attendance | F2.3 | Attendee read retained after reassignment |
| Persistence / isolation | Platform + Frigora | Workspace/venture tenancy preserved |
| Operational visibility | F2.2 + earlier | Derived board/attention; Service Desk |

---

## End-to-end operational spine

Owner/Dispatch manages work → WorkOrder assigned → Engineer sees My Work → opens assigned job → starts Visit → records operational evidence/facts → finishes Visit → WorkOrder remains OPEN → Owner may reassign → former assignee authority revoked → new assignee authority acquired → historical evidence/attendance remain correct.

Cross-milestone contract recheck on this gate: **coherent** (no runtime contradiction). Visit departure leaves WorkOrder OPEN; attendee ≠ assignee; Owner vs Engineer permissions preserved.

Independent Work: F2.3 programme items 1–23 independently verified (see F2.3 certificate). Control waived an additional composite Programme 1 Independent Work smoke for this gate.

---

## Final test results

### Programme 1 composed matrix

Command (from `apps/web`):

`pnpm exec tsx --test` over work-execution, dispatch, service-desk-dispatch, assignment, visit, visit-evidence, field-visit-recorder, operational-visibility, office-work-spine, engineer-job-workflow, frigora-evidence-protected-read, domain-authority, stored-object, membership, session/auth, repository/persistence test files.

| Metric | Value |
|---|---|
| Exit | **0** |
| Tests | **195** |
| Pass | **195** |
| Fail | **0** |
| Cancelled | **0** |
| Skipped | **0** |

### Full quality gates (final reconciled tree)

| Gate | Result |
|---|---|
| `pnpm test` | EXIT **0** — web **819/819**; ids **94/94**; brain **21/21**; fail/cancelled/skipped **0** |
| `pnpm check-types` | EXIT **0** |
| `pnpm lint` | EXIT **0** |
| `pnpm build` | EXIT **0** |
| BUILD_ID | `V5LNCmAHhS6zhSFkTqZY_` |

---

## Security results

### RPV-001 adversarial forge harness

`pnpm exec tsx scripts/_adversarial-domain-authority-forge.mts`

| Field | Value |
|---|---|
| Exit | **0** |
| Verdict | **A. CURRENT DESIGN IS FORGE-RESISTANT** |

### Production-bundle singleton verifier (post final build)

`pnpm exec tsx scripts/verify-domain-authority-production-bundle.mts`

| Field | Value |
|---|---|
| Exit | **0** |
| `inlinedWeakSetKernels` | **0** |
| `kernelSingletonIdentity` | **true** |

### RPV-002 protected-read policy (repository reconfirmed)

| Actor | Evidence byte open |
|---|---|
| Owner / Admin / Dispatch (`venture.update`) | ALLOW |
| Current assignee | ALLOW |
| Actual Visit attendee | ALLOW |
| Unrelated member | DENY |
| Inappropriate former assignee (never attended) | DENY |
| Cross-workspace / unauthenticated | DENY (platform + tenancy) |

Ordinary non-protected StoredObject behaviour remains unchanged (covered by `stored-object` / protected-read tests).

---

## Defect closure ledger

| ID | State |
|---|---|
| F2.3-RPV-001 | **CLOSED** |
| F2.3-RPV-002 | **CLOSED** |
| F2.3-OBS-003 | **CLOSED** |

No Programme 1 blocking defects identified on this gate.

---

## Remaining non-blocking debt

1. No platform-wide timezone convention (F2.2 UTC day board remains valid; ECE-003).
2. No jsdom DOM remount unit test for OBS-003 (keyed remount + Independent Work).
3. Turbopack filesystem-tracing warnings on `domain-authority.ts` / `local-adapter.ts` (build EXIT 0).
4. Local excluded logs / `breakpoints.css` CRLF noise — **excluded** from permanence.

---

## Product-law reconciliation

Stale statements implying F2.3 was unimplemented / unadmitted / future work, or that Programme 1 remained incomplete because of F2.3, were reconciled on this gate without changing product version or schema:

- Live catalog description (`apps/web/src/core/venture-definition/catalog.ts`) — F2.3 admitted at `frigora@0.18.0`
- Definition READMEs / Venture-Definitions mirror
- Frigora product page and Programme-1 roadmap
- Products index

Required resulting truth after reconciliation and permanence:

- F2.1 = CERTIFIED / admitted  
- F2.2 = CERTIFIED / admitted  
- F2.3 = CERTIFIED / admitted  
- Programme 1 milestones = completed  
- Programme 1 itself = **CERTIFIED**  

No F2.4. No post-Programme-1 capability promotion.

---

## Permanence INCLUDE set

```
apps/web/src/core/venture-definition/catalog.ts
apps/web/src/core/venture-definition/README.md
apps/web/src/core/venture-definition/venture-definition.test.ts
docs/foundation-library/02-ARCHITECTURE/Venture-Definitions.md
docs/foundation-library/06-PRODUCTS/README.md
docs/foundation-library/06-PRODUCTS/Frigora/README.md
docs/foundation-library/06-PRODUCTS/Frigora/Programme-1.md
docs/engineering/FRIGORA_PROGRAMME_1_CERTIFICATION.md
```

## Proposed permanence EXCLUDE set

```
packages/ids/tokens/generated/breakpoints.css
apps/web/cert-test-output.txt
cert-build-rpv.log
cert-test-output.txt
full-build-out.txt
full-test-out.txt
p1-build-out.txt
p1-bundle-final-out.txt
p1-bundle-out.txt
p1-forge-out.txt
p1-full-test-out.txt
p1-lint-out.txt
p1-matrix-out.txt
p1-types-out.txt
rpv-f2-targeted-out.txt
rpv-full-suite-out.txt
rpv-security-out.txt
rpv002-build-out.txt
rpv002-engineer-job-out.txt
rpv002-full-suite-out.txt
rpv002-stored-object-out.txt
rpv002-visit-evidence-out.txt
apps/web/.next/**
disposable AppData verification roots
tunnel/proxy artefacts
credentials / AUTH_SECRET
screenshots
```

---

## SHA-256 file hashes (INCLUDE set)

Computed 2026-09-09 after final validation against the reconciled working tree. Paths use forward slashes.

Non-candidate INCLUDE paths (stable):

```
8f656aaa362755dae9f767825cf873e59cdddf965d92c93ffd419984514a6112  apps/web/src/core/venture-definition/catalog.ts
72466746aae6e06210a4da194b95ea9bb0a0ded6d46eccb270f9a0294aa5a16b  apps/web/src/core/venture-definition/README.md
a0a466802f0aab0192143d86a1db014e8ffdee97da411b13cf8e1f30975dcbad  apps/web/src/core/venture-definition/venture-definition.test.ts
e8dde07cca70b816fcd546c103faddfb257d5f8b340b0bbca7a7add5029958db  docs/foundation-library/02-ARCHITECTURE/Venture-Definitions.md
4804a792fab363a4d7def104734bbcd775a12f200d79a22adad966fead37e193  docs/foundation-library/06-PRODUCTS/README.md
0cdbb78fff8be3f0f2de127cb4cde209e2e12366d450268cc834792e6b1c4eaf  docs/foundation-library/06-PRODUCTS/Frigora/README.md
a5c30dfc31db1d1ddffb57bf33c20a8b7a7c82fe125b33792d7cc8f0403f7635  docs/foundation-library/06-PRODUCTS/Frigora/Programme-1.md
```

**Aggregate of the 7 non-candidate INCLUDE paths** (SHA-256 of UTF-8 bytes of those 7 hash lines, each terminated by `\n`, in the order listed):

`5299143b7fe120a7b182ef13bc7a7fa8de7e8cf30840aeecd362bcf203869ed0`

**Certification artefact and full 8-path aggregate SHA-256** are recorded in the Control permanence execution report after this status edit (self-hash of this file is not re-embedded here to avoid a circular hash loop). Recompute at any later amendment.

---

## Permanence

| Field | Value |
|---|---|
| Certification artefact path | `docs/engineering/FRIGORA_PROGRAMME_1_CERTIFICATION.md` |
| Control status | **CERTIFIED** |
| PERMANENT CERTIFICATION CHECKPOINT | The Git commit containing this certification artefact |

The commit hash returned by the Control permanence execution is the authoritative Frigora Programme 1 certification checkpoint.
