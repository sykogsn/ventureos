# FRIGORA F34-03 — FINAL ASTRA CANDIDATE REPORT

Date: 2026-09-23. Control packet: F34-03-ASTRA-03. Builder verification complete; this is not Independent Verification or release certification.

## Candidate and implementation

Base HEAD remains `b2017673cd549751a7204bb38b8c05b5462b57ab` on `feat/frigora-f34-scheduling-dispatch`. The accepted pre-change baseline was retained, not repeated as discovery. Candidate: exactly **40 files: 33 tracked modified and 7 new**, enumerated below. Pre-existing Astra logs/probes and the F33 handoff remain outside this candidate and untouched. No staging, commit, push, PR, merge, reset, restore, stash or reseed.

Availability is persisted in one scoped Frigora table with explicit interval, actor and CAS columns, end-after-start CHECK and range indexes. Workload is derived from canonical open assigned WorkOrders, clipped to the selected UTC day; it is not persisted capacity. Operations displays explicit unavailable periods, affected work and workload. Absence of a restriction is not represented as confirmed availability.

Conflict evaluation remains inside the existing guarded dispatch write transaction, before dispatch event and WorkOrder writes. Explicit unavailability blocks; half-open WorkOrder overlap produces a typed warning with references and windows. Explicit confirmation recomputes current authoritative conflicts and preserves the original CAS token. Existing scope, permission, status, membership and active-Visit guards remain authoritative. No retry, process-local mutex, sleep-based correctness proof, second dispatch engine or offline dispatch path was introduced.

The Control-authorised lifecycle correction owns a disposable libSQL client per Frigora write transaction. It closes the transaction handle and client on success or failure, including acquisition failure before a handle exists. It never returns that connection to the shared read client. No dependency or shared platform lifecycle redesign was made during recovery.

## Disk recovery

The previous verification failed because C: capacity was exhausted; its truncated log and wrapper exit were not counted as passing evidence. Accumulated generated test databases contributed 2,091,995,648 bytes. Windows memory pressure and a 15,104 MiB allocated page file were observed during this run; the broader source of every disk fluctuation was not attributed to Frigora.

Only generated `vos-ephemeral-<UUID>.db` artifacts directly under `C:/Users/sykog/AppData/Local/Temp` were removed. Provenance is the test memory-database path in `platform/persistence/db.ts`. Each exact path was enumerated before deletion, checked to be outside the repository and directly under TEMP, checked against reparse points, and opened with exclusive file sharing before removal. The initial process inspection found no active test runner; the second cleanup occurred after the focused/workspace tests exited. All target files passed exclusive access. Logs, probe evidence, current verification DB/object store, runtime/tunnel state and repository files were preserved.

| Cleanup | Removed files | Bytes removed | Free bytes before | Free bytes after |
| --- | ---: | ---: | ---: | ---: |
| Initial stale test DB recovery | 2,810 | 2,091,995,648 | 624,021,504 | 2,721,648,640 |
| Completed current test DBs, before build | 1,013 | 817,410,048 | 1,727,725,568 | 2,544,513,024 |
| Total | 3,823 | 2,909,405,696 | — | — |

Final observed free capacity after build/runtime: 2,515,398,656 bytes. Exact cleanup paths and per-file results are retained in TEMP manifests listed below. No other scratch directories or evidence logs were deleted.

## Transaction, contention and rollback proof

The already-passed minimal disposable-client probe was retained without repetition: A held the write lock; B was rejected and disposed; A committed; fresh C committed; an independent reader saw only rows A/C. The clean Frigora tests agree with that result.

| Proof group | Total | Passed | Failed | Skipped | Cancelled |
| --- | ---: | ---: | ---: | ---: | ---: |
| Disposable write-client lifecycle | 3 | 3 | 0 | 0 | 0 |
| F34-03 availability/dispatch/workload | 9 | 9 | 0 | 0 | 0 |
| F34-03 deterministic concurrency (5 contention + 1 dispatch rollback) | 6 | 6 | 0 | 0 | 0 |
| F34-03 availability CRUD rollback | 3 | 3 | 0 | 0 | 0 |
| F34-03 total | 21 | 21 | 0 | 0 | 0 |
| Retained F34-01 dispatch integrity | 30 | 30 | 0 | 0 | 0 |
| Retained F34-02 engineer calendar | 14 | 14 | 0 | 0 | 0 |
| Combined focused run | 65 | 65 | 0 | 0 | 0 |

Focused command: `pnpm --filter web exec tsx --test src/modules/frigora/owned-write.test.ts src/modules/frigora/scheduling-conflicts.test.ts src/modules/frigora/dispatch-integrity.test.ts src/modules/frigora/app/engineer-calendar.test.ts`. Exit **0**; duration 240,582.9869 ms. All groups executed again successfully in the full web run.

Five Frigora contention scenarios passed: schedule/schedule, scheduled assignment, scheduled reassignment, schedule-before-availability and availability-before-schedule. Tests pause after actual SQLite lock acquisition with explicit barriers. The losing acquisition leaves a durable snapshot unchanged; the winner commits; fresh writes then succeed or return the appropriate authoritative conflict. Availability creation succeeds after a rejected competing acquisition. Dispatch succeeds after a rejected acquisition once the conflicting unavailability is legitimately removed.

Create/update/delete commit-failure tests leave zero partial availability mutation and close their clients. Confirmed dispatch UPDATE failure leaves no WorkOrder mutation or dispatch event; retained F34-01 IGNORE/ABORT rollback and shared-client interleaving checks also pass. Warning followed by changed conflicts is reevaluated on confirmation. Newly added unavailability, stale CAS, active Visit, closed state and invalid intervals cannot be bypassed by confirmation. Corrected Visit fixtures and scheduled-reassignment coverage executed successfully.

No remaining product defect or transaction uncertainty was observed within this local libSQL proof matrix. The earlier shared-client failure is historical diagnostic evidence, not a current candidate failure.

## Regressions and final gates

All commands used the authorised Windows TEMP PATH shim for **pnpm 9.0.0**. Logs stayed outside the repository.

| Gate | Result | Exit |
| --- | --- | ---: |
| Workspace `pnpm test` | Web **1,050/1,050**, 129 suites; zero failed/skipped/cancelled/todo | 0 |
| IDS / Brain | **94 / 21 passed**, replayed from cache | 0 |
| Turbo tests | **3/3 successful**, 2 cached; 39m50.64s | 0 |
| `pnpm check-types` | **4/4 successful**, 3 cached; fresh web typegen and tsc | 0 |
| `pnpm lint` | **4/4 successful**, 3 cached; fresh web ESLint, zero warnings allowed | 0 |
| `pnpm build` | **4/4 successful**, 2 cached; current web production build | 0 |
| `git -c core.safecrlf=false diff --check` | Passed, including final report | 0 |

Broader coverage includes assignment, dispatch, Service Desk/Operations, operational visibility, engineer workflow, Visit, F3.3 offline boundaries/recovery, persistence/schema and StoredObject durability. Web test duration: 2,386,330.3648 ms.

Build completed with two filesystem-tracing warnings in unchanged `platform/storage/domain-authority.ts` and `platform/storage/local-adapter.ts`. They did not fail the gate and were not changed in this scope.

## Authenticated builder runtime

The stale port-3142 process (PID 21476) was replaced only after tests and gates passed. The current candidate production build is **d0mt0tOvY23Jixrmqrwig**, running as PID **22784** at `http://127.0.0.1:3142/frigora`. Existing F33-06 configuration was reused:

- Database: `C:/Users/sykog/AppData/Local/frigora-f33-06-verification/ventureos.db`.
- Object store: `C:/Users/sykog/AppData/Local/frigora-f33-06-verification/objects`.
- Existing authentication configuration and designated Owner/Dispatch identity; no credentials changed and no reseed.

Observed in the supported browser UI:

1. Application started; Owner/Dispatch authenticated as `owner.dispatch@f33-06-verify.local`.
2. Operations loaded; the Add unavailable period form exposes engineer and UTC interval fields.
3. Workload was visible for Engineer A, Engineer B and Owner/Dispatch, initially zero scheduled jobs/minutes on the selected day.
4. Through normal product controls, existing **WO-F34IV-02-A** was assigned to Engineer B and scheduled for **2026-09-23 14:00–15:00 UTC**. Calendar and workload changed to **1 job / 60 minutes / 0 active visits** for Engineer B.
5. Existing **WO-F34IV-02-B** was assigned to Engineer B. Submitting **14:30–15:30 UTC** produced the visible double-booking warning, the conflicting WO-F34IV-02-A reference/window, frozen submitted booking, and explicit **Confirm double-booking / Cancel** controls. Confirmation was not submitted; B remains assigned and unscheduled.
6. Runtime stderr remained empty; no schema-30 crash/error was observed. The warning tab is retained for review.

These are disclosed product-workflow mutations in the existing test dataset, not hidden DB construction. The F33-06 admission WorkOrder/active Visit was not changed. This is **BUILDER runtime health only**, not Independent Verification. Engineer A/B authentication was not repeated; the required minimum Owner/Dispatch check passed.

## Locked invariants and boundary

- Product remains **frigora@0.22.0**; schema generation **30**.
- IndexedDB remains **frigora-offline v1**.
- Offline capture allowlist is exactly **recordTechnicalFinding**, **recordFieldCapture**, **recordVisitEvidence**; no offline dispatch mutation path.
- Dependencies and lockfile unchanged. `apps/web/package.json` changes only test registration.
- Shared architecture, authority, identity, offline ownership and Git boundaries preserved.
- Exact candidate remains **33 tracked modified + 7 new = 40**; no unexpected candidate files. Pre-existing historical untracked evidence remains untouched.

### Modified tracked files (33)

- apps/web/package.json
- apps/web/src/modules/frigora/actions.ts
- apps/web/src/modules/frigora/app/engineer-calendar.test.ts
- apps/web/src/modules/frigora/app/engineer-calendar.ts
- apps/web/src/modules/frigora/app/field-visit-recorder.test.ts
- apps/web/src/modules/frigora/app/forms/dispatch-controls.tsx
- apps/web/src/modules/frigora/app/mutation-actions.ts
- apps/web/src/modules/frigora/app/office-work-spine.test.ts
- apps/web/src/modules/frigora/app/offline/offline-f33-05-recovery.test.ts
- apps/web/src/modules/frigora/app/offline/offline-field-capture-evidence.test.ts
- apps/web/src/modules/frigora/app/offline/offline-technical-finding.test.ts
- apps/web/src/modules/frigora/app/operational-visibility.test.ts
- apps/web/src/modules/frigora/app/pwa/pwa-boundary.test.ts
- apps/web/src/modules/frigora/app/screens/engineer-calendar-panel.tsx
- apps/web/src/modules/frigora/app/views.ts
- apps/web/src/modules/frigora/asset-history.test.ts
- apps/web/src/modules/frigora/asset-operational-condition.test.ts
- apps/web/src/modules/frigora/catalogue.test.ts
- apps/web/src/modules/frigora/dispatch-integrity.test.ts
- apps/web/src/modules/frigora/errors.ts
- apps/web/src/modules/frigora/queries.ts
- apps/web/src/modules/frigora/service.ts
- apps/web/src/modules/frigora/store.ts
- apps/web/src/modules/frigora/time-materials.test.ts
- apps/web/src/modules/frigora/types.ts
- apps/web/src/modules/frigora/validation.ts
- apps/web/src/modules/frigora/visit-customer-acknowledgement.test.ts
- apps/web/src/modules/frigora/visit-evidence.test.ts
- apps/web/src/modules/frigora/work-execution.test.ts
- apps/web/src/platform/persistence/db.ts
- apps/web/src/platform/persistence/schema.ts
- apps/web/src/platform/storage/stored-object.test.ts
- docs/engineering/README.md

### New candidate files (7)

- apps/web/src/modules/frigora/app/forms/unavailability-form.tsx
- apps/web/src/modules/frigora/availability-store.ts
- apps/web/src/modules/frigora/availability.ts
- apps/web/src/modules/frigora/owned-write.test.ts
- apps/web/src/modules/frigora/owned-write.ts
- apps/web/src/modules/frigora/scheduling-conflicts.test.ts
- docs/engineering/FRIGORA_F34_03_ASTRA_IMPLEMENTATION_REPORT.md

## Evidence outside the repository

All filenames below are under `C:/Users/sykog/AppData/Local/Temp/`:

- `frigora-f34-03-cleanup-targets.json` and `frigora-f34-03-cleanup-result.json`: exact initial cleanup paths and outcome.
- `frigora-f34-03-post-tests-cleanup-targets.json` and `frigora-f34-03-post-tests-cleanup-result.json`: exact second cleanup paths and outcome.
- `frigora-f34-03-disposable-probe.log`: retained minimal passing probe.
- `frigora-f34-03-recovery-focused.log`: completed 65-test focused proof.
- `frigora-f34-03-recovery-regressions.log`: completed workspace regressions.
- `frigora-f34-03-recovery-types.log`, `frigora-f34-03-recovery-lint.log`, `frigora-f34-03-recovery-build.log`: completed final gates.
- `frigora-f34-03-recovery-runtime.json`, `frigora-f34-03-recovery-runtime.out.log`, `frigora-f34-03-recovery-runtime.err.log`: current runtime identity and logs.
- `frigora-f34-03-recovery-boundary.json`: exact candidate path manifest.

Earlier baseline, diagnostic, failed/truncated and correction logs are retained as historical evidence and are not substituted for the clean results above.

## Readiness

No remaining observed product defect or unresolved transaction blocker. Required focused proof, broader regressions, gates and authenticated builder health are green. The candidate is ready for Control review and remains uncommitted. Independent Verification and release approval are not claimed.

F34-03 ASTRA GREEN — READY FOR CONTROL REVIEW
