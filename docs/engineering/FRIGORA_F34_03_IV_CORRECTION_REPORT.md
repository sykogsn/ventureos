# FRIGORA F34-03 — INDEPENDENT DEFECT CORRECTION REPORT

Control-authorised targeted correction to published candidate `d75ab9c17be6fb1147f7a3b7568ad9822c7714e0`. The published commit and its historical implementation report remain unchanged. No certification is claimed. Publication requires Control review of this successor delta.

## Confirmed root cause

Both assignment and reassignment use `assignWorkOrderFormAction` in `apps/web/src/modules/frigora/app/mutation-actions.ts`. The shared `DoubleBookingConfirmation` component already submits the previously warned assignee, original CAS token, and a submit-button field `confirmDoubleBooking=true`. The assignment form adapter forwarded scope, WorkOrder, assignee and CAS, but omitted that field when calling `assignWorkOrderAction`. The authenticated action therefore passed an unconfirmed input to the service, which correctly returned the overlap warning again without committing.

Scheduling used the same confirmation component, but `scheduleWorkOrderFormAction` explicitly parsed and forwarded the flag. That difference explains why scheduling confirmation worked while assignment/reassignment confirmation failed. The service, validation and guarded transaction already supported the typed confirmation contract.

Ownership: Frigora form/action adapter. Confidence: HIGH, confirmed by source and executable reproduction. Before the fix, both new assignment/reassignment regression cases failed with the repeated overlap warning (0/2, exit 1). The correction adds exactly one production line, using the same explicit string-to-boolean parsing as scheduling. Rebuild is required for the server action; no dependency, schema, storage, authority or conflict-engine change is needed.

## Final gate evidence

- Targeted confirmation matrix: 17/17 passed, zero failures/skips/cancellations, exit 0.
- Retained F34/Operations focused run: 87/87 passed, zero failures/skips/cancellations, exit 0.
- Typecheck initially found three callback-narrowing errors in the new test harness; validated button references were bound to constants. Final workspace typecheck passed 4/4 tasks, exit 0.
- Lint: 4/4 tasks successful (3 cached), exit 0, zero warnings.
- Production build: 4/4 tasks successful (2 cached), exit 0.
- Full web regression: 1,069 reported tests, 1,067 passes, 2 file-level failures, 130 suites, zero skips/cancellations/todos, exit 1. Failed files: `assignment.test.ts` (240699.8537 ms) and `scheduling-conflicts.test.ts` (546437.75 ms). Their assertions passed before file-level failures. Reporter detail is only `test failed`; child exit code/signal and root cause are not established. Overall web duration: 2526570.046 ms.
- Workspace: 2/3 tasks successful (IDS 94 and Brain 21 cached passes), web failed, exit 1; Turbo duration 42m15.186s. This is NOT a green or partially accepted regression gate.
- Separate diagnostic invocation of unchanged `assignment.test.ts` with the TAP reporter: 17/17 passed, zero failures/skips/cancellations, exit 0 (285120.2761 ms). This does not explain or supersede the workspace failure. No matching Node crash event was returned by the Application event-log query.
- Builder assignment Confirm, reassignment Confirm, refresh and unavailability checks are withheld until automated gates are green. No runtime fixtures have been changed in this correction cycle; the verifier's reported neutral A/B state has not been independently rechecked here. C is untouched.
- `git diff --check`: PASS, exit 0.

The test harness executes the real confirmation component, form adapters and authenticated actions. Next request/cache services, session lookup and component hook state are controlled test fixtures; permission service, domain logic, owned transactions and SQLite remain real. Tests cover explicit assignment/reassignment confirmation, mutation-free warning/Cancel, scheduling, current conflict recomputation, unavailability, stale CAS, active Visit, status and authority rejection.

No files staged, committed or pushed for this correction.

## Successor boundary

The correction delta from `d75ab9c17be6fb1147f7a3b7568ad9822c7714e0` is five files (three modified, two new):

| File | Change |
| --- | --- |
| `apps/web/src/modules/frigora/app/mutation-actions.ts` | One production line forwards explicit confirmation. |
| `apps/web/src/modules/frigora/scheduling-conflicts.test.ts` | 104 added lines register 17 actual-form/component regression cases. |
| `apps/web/src/modules/frigora/app/dispatch-confirmation.test-support.ts` | New 110-line source execution harness. |
| `docs/engineering/README.md` | One report index entry. |
| `docs/engineering/FRIGORA_F34_03_IV_CORRECTION_REPORT.md` | New correction evidence report. |

The 29 pre-existing untracked historical probe/log/handoff files remain unrelated and untouched. No verification logs, runtime data, databases, build outputs or credentials are part of this correction delta. Logs are under Windows TEMP, prefixed `frigora-f34-03-iv-correction-`.

Package and lockfiles/dependencies are unchanged. Frigora remains `0.22.0`, schema generation 30, IndexedDB `frigora-offline` v1. The capture allowlist remains exactly `recordTechnicalFinding`, `recordFieldCapture`, `recordVisitEvidence`; no offline dispatch was added. The production action, service and owned-transaction authority/CAS/Visit/status/unavailability/recomputation guards are unchanged. The new tests exercise those guards through confirmed form retries.

Focused result breakdown: F34-01 dispatch integrity 30, F34-02 engineer calendar 14, F34-03 conflict/form cases 35 plus owned-write lifecycle 3, Operations/component 5: total 87. The existing concurrency proofs remain in the passing conflict suite.

Evidence files in `%TEMP%`: `frigora-f34-03-iv-correction-red.log`, `-targeted.log`, `-focused.log`, `-types.log`, `-types-final.log`, `-lint.log`, `-build.log`, `-workspace.log`, and `-assignment-diagnostic.log` (the latter suffixes share the same full prefix). The initial typecheck failure was confined to the new test helper's callback narrowing, fixed before the final successful typecheck; no production workaround was introduced.

## Blocker and Control action

The product propagation defect is precisely diagnosed and corrected, but the required full regression process is not healthy. The additional failure is at the test-child/process boundary; attributing it to native libSQL, memory pressure, concurrency or the correction would be speculation. Root-cause confidence for that process failure is LOW. The clean isolated assignment diagnostic and prior clean focused conflict suite show that failures are not consistently reproduced by those narrower runs; they do not clear the full-run failure.

Per `MASTER_ENGINEERING_PROMPT.md` §10.6, “If a certification or verification-only gate fails, hangs, cancels, exits unexpectedly, or produces unexplained working-tree changes: stop.” Read-only diagnostic evidence has been retained, and no persistence/runtime infrastructure repair was attempted. Control action: authorise a bounded diagnostic/recovery cycle for the two process failures, then require a clean full regression and authenticated builder smoke/cleanup before publication review. The necessary repair and rebuild boundary cannot responsibly be specified until the failure cause is established.

Branch remains `feat/frigora-f34-scheduling-dispatch`; HEAD remains `d75ab9c17be6fb1147f7a3b7568ad9822c7714e0`. Nothing staged, committed or pushed. PR #2 remains unmerged; no certification is claimed.

F34-03 CORRECTION BLOCKED — CONTROL ACTION REQUIRED

## FRIGORA F34-03 — PROCESS-FAILURE RECOVERY REPORT

2026-09-23, subsequent Control-authorised bounded diagnostic cycle. This section supersedes the earlier lack of process-exit evidence; it does not change the failed full-regression result or claim recovery.

### Direct failure evidence

The paired existing test invocation reproduces the failure without source modification. All 52 assertions pass, then the scheduling-conflicts child exits with decimal **3221225477 / hex 0xC0000005** (Windows access violation). TAP reports `failureType: testCodeFailure`, `code: ERR_TEST_FAILURE`, `signal: ~`, and adds one failed file-level test. Parent command exits 1. No JavaScript uncaught exception, unhandled rejection, or worker error was emitted by the trace flags.

Comparison D reproduces it again. A read-only Windows debugger attachment to its scheduling child (PID 5820) captures both first-chance and unhandled second-chance access violations:

```text
address=0x7FFE1315661E thread=8132
ACCESS_KIND=0 TARGET=0x1D05D292151
FAULT_MODULE=@libsql/win32-x64-msvc@0.5.29/index.node
OFFSET=0x55661E
PROCESS_EXIT=3221225477
```

The exact native module is `node_modules/.pnpm/@libsql+win32-x64-msvc@0.5.29/node_modules/@libsql/win32-x64-msvc/index.node`. Access kind 0 is an invalid memory read. The observer passed the exception through normally, did not mask failure, and ended after child exit. Windows event/crash-record queries did not supply a useful dump or fault record. The observer stdout is preserved in `%TEMP%/frigora-f34-03-recovery-native-observer.log`.

**Established mechanism and ownership:** unhandled native read access violation in the installed libSQL addon after passing test assertions, causing a non-zero child exit. Confidence HIGH for that fault location and mechanism. This is a native dependency/resource-lifecycle boundary, not a failing domain assertion or an established JavaScript test-helper leak. The precise invalid object's lifetime, native call stack and cause are NOT established. It would be speculation to call this a proven upstream bug, resource exhaustion, test-only defect, or safe environmental transient. Confidence LOW for the underlying lifetime diagnosis and a proposed code fix. The original full-run assignment failure did not record its child exit code, so this cycle does not retrospectively assert it had the same native cause.

### Exact reproduction and comparisons

From the repository root with the authorised pnpm 9 shim on PATH (Node v24.19.0, pnpm 9.0.0):

```powershell
pnpm --filter web exec tsx --trace-uncaught --trace-warnings --test --test-reporter=tap src/modules/frigora/assignment.test.ts src/modules/frigora/scheduling-conflicts.test.ts
```

This is C. A uses only the first file; B uses only the second. D uses both plus `src/modules/frigora/owned-write.test.ts`, `src/modules/frigora/dispatch-integrity.test.ts`, and `src/modules/frigora/app/engineer-calendar.test.ts`. All four used the same existing runner and trace/TAP options, sequentially, without source changes or new test harness. Combined stdout/stderr was redirected to `%TEMP%/frigora-f34-03-recovery-A.log` through `-D.log`. The observer was attached only during D; C reproduced without it.

| Comparison | Files | Pass / failed file entries | Parent exit | Runner duration ms | Entire command ms |
| --- | ---: | --- | ---: | ---: | ---: |
| A assignment | 1 | 17 / 0 | 0 | 134360.2455 | 141047 |
| B scheduling-conflicts | 1 | 35 / 0 | 0 | 287552.4527 | 305200 |
| C paired | 2 | 52 / 1 | 1 | 299278.1562 | 301560 |
| D related | 5 | 99 / 1 | 1 | 423660.5289 | 425755 |

C reports 53 tests / 5 suites; D reports 100 tests / 10 suites. Both have zero skips/cancellations/todos; the extra test is the failed file entry, not a failed assertion. Scheduling child duration: C 299199.9474 ms, D 419229.8989 ms. In each TAP stream the confirmation suite's final successful assertion and successful suite entry precede the file-level failure. Exact wall-clock distance between the last assertion and fault was not separately instrumented.

### Resource inspection

- `dispatch-confirmation.test-support.ts` reads source synchronously, transpiles it, and uses local mock objects. It owns no client, server, timer, stream, listener, child process or persistent spy requiring disposal. Awaited form actions return the domain work's promise.
- `assignment.test.ts` uses the process-scoped persistence client and existing reset/beforeEach/file-after lifecycle. `scheduling-conflicts.test.ts` uses the same lifecycle plus independent readers closed in `finally` and awaited owned-write operations. Its writer barriers release in `finally` and await the writer on the observed successful assertion paths.
- `owned-write.ts` closes transaction then client in nested `finally`; acquisition failures close the client. The installed `@libsql/client@0.17.4` detaches its native database from the client at transaction creation. Its transaction `close()` performs rollback if needed; it does not explicitly call the native database close. This is relevant ownership evidence, NOT proof that it caused this access violation. No private handle manipulation or speculative GC/close workaround was applied.
- TEMP databases use UUID names and are not deleted by these tests. No shared filename collision or disk-exhaustion evidence was found. The native connection/finalizer boundary needs further evidence; deterministic JS wrapper cleanup alone does not establish native lifetime correctness.

### Gates and stop boundary

No test-only correction was justified by the evidence, and no production/dependency correction is authorised by this packet. The exact underlying cause remains unresolved beyond the proven native fault. A full rerun was not needed to reproduce the failure: C and D already do so. Repeating the expensive full suite would not make this failed process healthy.

The 17-case matrix passed as assertions within B/C/D; B exited 0. Prior standalone matrix 17/17 exit 0 and focused F34/Operations 87/87 exit 0 remain historical evidence, not newly rerun green gates. D adds current related evidence (99 assertions passed) but is a FAILED process. Prior full web remains 1067 passes plus 2 failed files / 1069 reported tests, exit 1; workspace remains 2/3 tasks successful, exit 1 (IDS 94 and Brain 21 cached passes). Prior final typecheck, lint and build each passed 4/4 tasks, exit 0; not rerun because no executable source changed during recovery and diagnosis stopped. Current `git diff --check` passes, exit 0.

Builder assignment Confirm, reassignment Confirm, persistence-refresh and unavailability smoke remain NOT RUN: automated process gates are not green. No runtime data was changed; A/B remain at the verifier-reported neutral state without a fresh UI check, C untouched. No cleanup was necessary in this cycle.

### Required Control decision and preserved boundary

The current packet authorises test-only fixes after a proven test-only cause; it says to stop before editing another production file. No such test-only cause has been established. Proposed next boundary: native shutdown/finalizer diagnosis of libSQL's transaction/client ownership, with native stack/symbol evidence before deciding whether the remedy belongs to the dependency, Frigora `owned-write.ts`, or shared `platform/persistence/db.ts`. Do not change any of those on this evidence alone. Dependency replacement, version changes, private-native-handle access, forcing GC or suppressing process failure are not proposed fixes. Rebuild and regression scope depend on the diagnosed remedy; any production/dependency change would require a fresh production build and all stated gates before builder smoke.

Recovery modified only this existing correction report. The final successor boundary remains five files, three modified/two new, enumerated above; executable code and test delta are unchanged. Production delta remains exactly one line in `mutation-actions.ts`. Dependencies/lockfile, Frigora 0.22.0, schema 30, `frigora-offline` v1 and the three-operation offline capture allowlist remain unchanged; no offline dispatch. All recovery logs are in TEMP. The 29 unrelated historical untracked files are preserved.

Branch/HEAD remain `feat/frigora-f34-scheduling-dispatch` / `d75ab9c17be6fb1147f7a3b7568ad9822c7714e0`. Index empty. Nothing staged, committed, pushed, amended, rebased or merged; published SHA and PR #2 untouched by this cycle. No certification.

F34-03 CORRECTION BLOCKED — CONTROL ACTION REQUIRED

## FRIGORA F34-03 — NATIVE LIFECYCLE DIAGNOSTIC REPORT

2026-09-23. Subsequent Control-authorised read/reproduce/trace cycle. No executable repository file changed. No external research, installation, dependency change, configuration change or builder smoke performed.

### Proven binary identity

The live debugger module inventory identifies this exact loaded file (not an inference from its basename):

```text
C:\Users\sykog\Projects\ventureos-frigora-f32-clean-restart-r1\node_modules\.pnpm\@libsql+win32-x64-msvc@0.5.29\node_modules\@libsql\win32-x64-msvc\index.node
```

- Package: `@libsql/win32-x64-msvc`, version **0.5.29**, package main `index.node`.
- SHA-256: `5D1DE6B0E9B3F2B71D79F4C0F833CD345F7DBB0AA921A89A8EBF0A07571DDC9D`; file size 8,875,520 bytes.
- PE machine **0x8664 (AMD64)**. Package metadata declares Windows/x64, Rust target `x86_64-pc-windows-msvc` and Neon binary binding. FileVersion/ProductVersion/CompanyName/FileDescription fields are empty.
- Runtime: **Node v24.19.0**, `win32`, `x64`, Node module ABI **137**, N-API **10**. **pnpm 9.0.0** via existing authorised TEMP shim.
- Installed and locked chain: `apps/web → @libsql/client@0.17.4 → libsql@0.5.29 → optional @libsql/win32-x64-msvc@0.5.29`. The web dependency range is `^0.17.4`; client declares libsql `^0.5.28`, resolved to 0.5.29. Lockfile native tarball integrity: `sha512-4/0CvEdhi6+KjMxMaVbFM2n2Z44escBRoEYpR+gZg64DdetzGnYm8mcNLcoySaDJZNaBd6wz5DNdgRmcI4hXcg==` (distinct from the measured binary SHA-256).
- Installed README advertises Node and Windows support. These installed package manifests contain no Node `engines` range establishing compatibility with this exact Node release. No matching private symbols were available; the native image has no `RSDS` CodeView marker. No upstream sources were fetched.

Identity evidence: `%TEMP%/frigora-f34-03-native-identity.json` and module inventory in `%TEMP%/frigora-f34-03-native-stack-final.log`.

### Captured exception, registers and stack

The final coordinated reproduction used the existing pnpm/tsx tests unchanged, with a PowerShell diagnostic observer calling installed Windows debugging APIs (`DebugActiveProcess`, `GetThreadContext`, `ReadProcessMemory`, DbgHelp `StackWalk64`). No debugger was installed and no new verification harness/test was introduced. Observer source and all logs live in TEMP. Exceptions were continued as unhandled; the failed process was not suppressed.

At **2026-09-23 16:34:24 UTC**, PID **9656**, thread **20928**, the observer captured first- and second-chance **0xC0000005**. Native child exit **3221225477**; parent test exit **1**. The second chance is an unhandled read fault:

```text
index.node base  0x7FFE12C00000 (image size 0x883000)
node.exe base    0x7FF7EA5D0000
RIP              0x7FFE1315661E = index.node+0x55661E
RAX = RCX        0x1B9D7267320
Read target      0x1B9D7267391 = RAX+0x71
RSP              0x63F73FDD50
RBP              0x0
Instruction      0F B6 40 71 = movzx eax, byte ptr [rax+0x71]
```

All integer registers, 32 raw stack slots, instruction bytes and loaded module bases are retained in the log. DbgHelp unwound 23 frames successfully; raw module offsets, in fault-to-caller order:

```text
index.node + 55661E, 604AB6, 50B198, 2E1062,
             220A22, 8EF72, 68F8C, 86124
node.exe   + 1F6C281, 1F87904, 1F71A94, 1FDB353,
             1FDA28B, 1FD9556, B9940E, BA3EA0,
             202E37F, 1EA3AA6, 1F77939, 2031552, 22414F4
KERNEL32.DLL + 2CD87
ntdll.dll    + ACAEC
```

The corresponding absolute addresses are in the log. For example the first four are `0x7FFE1315661E`, `0x7FFE13204AB6`, `0x7FFE1310B198`, `0x7FFE12EE1062`. DbgHelp found nearby exported names such as `update_hook_cb` and `napi_register_module_v1`, often with very large displacements. These are **not reliable internal function identifications** and do not prove an update-hook or registration failure. The raw offsets are authoritative; internal native symbols and object identity remain unknown. The stack passes from Node/libuv frames into the addon after passing assertions, but it does not by itself prove a particular finalizer or double-free.

### Bounded minimisation and concurrency differential

Common command prefix from repository root:

```powershell
pnpm --filter web exec tsx --trace-uncaught --trace-warnings --test --test-reporter=tap
```

Files: `src/modules/frigora/assignment.test.ts src/modules/frigora/scheduling-conflicts.test.ts`.

| This cycle's invocation | Assertions | File failures | Parent exit | Runner duration ms |
| --- | ---: | ---: | ---: | ---: |
| Full pair, normal concurrency, first stack attempt | 52 pass | 0 | 0 | 311056.4559 |
| Full pair, normal concurrency, second attempt | 52 pass | 1 | 1 | 222308.4197 |
| Full pair, `--test-concurrency=1` | 52 pass | 0 | 0 | 333581.2994 |
| Full pair, final coordinated stack capture | 52 pass | 1 | 1 | 296513.9801 |

The failed child is scheduling-conflicts in both failures, with exit 3221225477 and no signal. The first observer saw a clean exit. The second observer reached the run after its child exited and captured no stack; this is recorded as a missed observation, not negative crash evidence. The final coordinated launch removed that attachment timing gap and captured the fault above. Each failed run reports 53 tests: 52 passing assertions plus one failed file entry. No skips/cancellations/todos or JavaScript exception/rejection diagnostics.

Reduced selection used the same files and prefix, adding:

```text
--test-name-pattern=assigns an open WorkOrder|schedule: competing dispatch writers
```

This selects **three** tests: ordinary assignment, ordinary reassignment (its name contains `assigns an open WorkOrder`), and the scheduling competing-writer proof. It exercises fresh writes, failed competing acquisition and subsequent warning, while not executing the new confirmation form cases.

| Reduced runner mode | Repetitions | Assertions each | Exits | Durations ms |
| --- | ---: | ---: | --- | --- |
| Default file concurrency | 2 | 3 pass | 0, 0 | 27960.7414; 23519.2694 |
| `--test-concurrency=1` | 2 | 3 pass | 0, 0 | 28716.2404; 41958.0382 |
| `--test-isolation=none --test-concurrency=1` | 2 | 3 pass | 0, 0 | 31321.5867; 35536.4144 |

The smaller selection does not reproduce within this bounded sample. The **smallest demonstrated failing invocation remains the full two-file pair**, intermittently; no reliably failing minimal test ordering was established. A clean serial full run is evidence of a differential, not proof that parallelism is necessary or serialisation fixes the bug. Separate file processes have separate heaps and UUID TEMP databases; direct sharing of native objects across those processes is not established. Scheduling under concurrency could affect timing/resource pressure, but that is still a hypothesis. No permanent runner configuration was changed.

Logs: `%TEMP%/frigora-f34-03-native-pair-stack.log`, `-pair-normal2.log`, `-pair-serial.log`, `-pair-capture-final.log`, `-native-stack-final.log` (full actual filename `frigora-f34-03-native-stack-final.log`), and `frigora-f34-03-native-min-{normal,serial,single}-{1,2}.log`.

### Source-derived ownership sequence

This is a code-derived sequence, not an instrumented identity trace of the invalid native pointer:

1. Test `beforeEach`/seed resets the repository and process singleton. `resetDatabaseLifecycle` clears cached handles and closes the previous singleton. An in-memory configuration resolves to a fresh UUID TEMP file. Schema operations use the singleton read/general client.
2. Each guarded dispatch write calls Frigora `withFrigoraWriteTransaction`, whose factory creates a fresh client at the current database URL.
3. Installed `Sqlite3Client.transaction()` acquires its native database, executes `BEGIN`, then sets the client's `#db` to null and hands the detached database to `Sqlite3Transaction`.
4. On success, Frigora awaits the body and commit, then calls transaction `close()` and client `close()` in nested `finally`. Installed transaction commit executes `COMMIT`; `close()` checks `inTransaction` and rolls back only if active. The detached native connection is not explicitly closed by that method, and the original client's `#db` is null.
5. On body/commit failure, Frigora awaits rollback when the transaction is not closed, then runs the same final close sequence.
6. If `BEGIN` fails (competing writer), no transaction is returned and detachment has not happened. The fresh client is closed in `finally`; no rollback is attempted on a nonexistent transaction. A later attempt uses a fresh client.
7. Independent durability readers own their client and close it in `finally`, after awaited reads. Held test writers are released in `finally` and awaited on the observed successful assertion paths.
8. The file-level `after` hook awaits the singleton reset/close. Native statements are created internally by `executeStmt`; the JS binding's `Statement` wraps a native statement. Installed JS does not expose native reference-counting/finalizer ownership. Detached connection and statement destruction ordering is therefore the principal unresolved native boundary.
9. The test file finishes its successful assertions and the child subsequently reports a native failure. No source instrumentation mapped the invalid address to a specific connection/statement or measured its allocation/free history. A post-assertion crash is not proof that the `after` hook itself crashed.

Local `@libsql/core@0.17.4/lib-esm/api.d.ts` documents commit followed by transaction close in `finally`, and states that close after commit/rollback is a no-op. Frigora follows that public sequence. **No application use-after-close, unsupported double-close, or close racing unfinished work was demonstrated.** Conversely, absence of a demonstrated violation is not proof that every native lifetime is correct. The detached-resource/finalizer boundary remains suspicious but unproven.

### Classification, uncertainty and next Control decision

**Supported classification: NATIVE RUNTIME / RESOURCE-LIFECYCLE INTEGRITY BLOCKER — ROOT CAUSE UNRESOLVED.** High confidence in binary identity, invalid-read mechanism, native stack offsets and intermittent reproduction. Insufficient evidence to choose product defect, test-only defect, native dependency defect, Node compatibility defect or environment defect.

- Test support has no demonstrated invalid resource ownership. Its added allocation/load pattern could change timing; contribution is not proven or excluded by the reduced clean cases.
- Dependency behaviour is demonstrably crashing on the observed path, but the exact responsible native lifecycle condition and whether valid application usage triggers an upstream defect remain unresolved.
- Environment contribution is not proven. Metadata supports the OS/architecture; there is no comparative platform/Node run and no evidence justifying an upgrade/downgrade.
- No correction boundary is justified yet. Do not remove closes, force GC, suppress failures, add retries/sleeps/mutexes or serialise production writes.

The next necessary evidence is matching native source/symbol attribution for offsets `55661E → 604AB6 → 50B198 → 2E1062 → 220A22 → 8EF72 → 68F8C → 86124`, then a concrete native connection/statement allocation-destruction sequence. Installed package contents do not provide that implementation or matching private symbols. **Control must authorise read-only upstream research for libsql-js 0.5.29 and libsql-client 0.17.4, and matching build/symbol provenance, before further investigation.** Per this packet's Phase 6, external research was not performed. This is not a request to change dependencies or production code.

Only this existing correction report changed in the repository during diagnosis. The five-file successor delta remains three modified/two new; production correction remains one logical line. Dependencies/lockfile, schema 30, Frigora 0.22.0, IndexedDB v1 and offline allowlist unchanged. TEMP holds diagnostic scripts/logs only; no new repository artifact. Prior 29 unrelated files preserved. Current diff check passes. Index empty; HEAD remains `d75ab9c17be6fb1147f7a3b7568ad9822c7714e0` on `feat/frigora-f34-scheduling-dispatch`. Nothing staged, committed or pushed; historical published SHA and PR #2 not modified or merged. Builder smoke withheld; runtime fixtures untouched.

F34-03 NATIVE ROOT CAUSE UNRESOLVED — CONTROL ACTION REQUIRED

## Alternative serial verification — Control-authorised final cycle

Control closed native diagnosis and classified the limitation as **WINDOWS / LIBSQL NATIVE TEST-PROCESS CONCURRENCY LIMITATION**. This is Control's accepted verification classification, not a claim that the precise upstream allocation/free defect has been proven. Package `@libsql/win32-x64-msvc@0.5.29` produced intermittent parallel test-child access violations `0xC0000005`, as recorded above. No Frigora violation of the documented lifecycle was demonstrated. The one-line production correction is unchanged.

### Full serial web gate: PASS

The exact existing web script's complete file list was used without changing the script, configuration or tests:

```powershell
$env:PATH = (Join-Path $env:TEMP 'frigora-f34-pnpm9') + ';' + $env:PATH
$suite = (Get-Content apps/web/package.json -Raw | ConvertFrom-Json).scripts.test
if (-not $suite.StartsWith('tsx --test ')) { throw 'Unexpected web test script shape' }
$testFiles = @(($suite.Substring(11)) -split '\s+')
pnpm --filter web exec tsx --test --test-concurrency=1 --test-reporter=tap @testFiles
```

All **94 registered files**, **1,067/1,067 tests**, **130 suites**, zero failures/skips/cancellations/todos, **process exit 0**. Runner duration **5192167.0267 ms**. `%TEMP%/frigora-f34-03-alternative-web-serial.log` contains the fully expanded exact command, complete stdout/stderr and final exit. Nothing was skipped or suppressed. This is a successful serial process, not an assertion-only pass.

### Workspace/static gates: PASS

| Gate | Command | Result |
| --- | --- | --- |
| IDS and Brain | `pnpm exec turbo run test --filter=!web` | IDS 94, Brain 21; 2/2 tasks, 2 cached; exit 0 |
| Workspace test coverage | Full serial web above plus IDS/Brain | All three workspace test packages covered; 1182 total passes, each process exit 0. The original parallel web invocation is not relabelled green. |
| Typecheck | `pnpm check-types` | 4/4 successful, 4 cached; exit 0 |
| Lint | `pnpm lint` | 4/4 successful, 4 cached, zero warnings; exit 0 |
| Production build | `pnpm build` | 4/4 successful, 3 cached; exit 0; build ID `e44GxAjAjT9vnxcCC8V5L` |
| Diff check | `git diff --check` | PASS, exit 0 |

Gate logs are `%TEMP%/frigora-f34-03-alternative-{workspace-other,types,lint,build}.log`. The web execution was fresh; cached gate results are explicitly identified above. No dependency/lockfile/schema/offline change was made.

### Authenticated builder health verification: PASS

The isolated Owner/Dispatch runtime on port 3142 was restarted against verified production build `e44GxAjAjT9vnxcCC8V5L`, retaining its existing database, object store and authentication settings. Launcher and runtime logs remain in Windows TEMP. This is builder health verification, not Independent Verification or certification.

- Assignment: A was assigned to Engineer B at 2026-09-23 14:00–15:00 UTC. B was scheduled 14:30–15:30 UTC while unassigned. Assigning B to Engineer B displayed the overlap warning naming A; Confirm succeeded. A full refresh preserved B's Engineer B assignment and window.
- Reassignment: B was moved to Engineer A, then reassigned to Engineer B. The overlap warning appeared; Confirm succeeded. A full refresh again preserved Engineer B and the same window.
- Unavailability: B was moved back to Engineer A and another reassignment warning to Engineer B was held pending. Through a second normal product UI tab, an explicit Engineer B restriction at 14:00–15:00 UTC was created (ID `49ecac30-3244-4ba3-8b7e-a978a60b91ce`). Pressing the pending Confirm returned `The engineer is unavailable for the selected window.` The confirmation controls disappeared; B remained assigned to Engineer A. Confirmation therefore did not override the newly established restriction.
- CAS, active Visit and authority preservation are demonstrated by the passing actual-component/form regression matrix and full serial suite, including guarded confirmed retries; these are automated assertions, not additional manual role/Visit mutations. Production guard code is unchanged.

### Final fixture cleanup: PASS

The temporary unavailable period was removed through Manage unavailable period / Remove unavailable period; the restriction disappeared. Both work orders were cleared and unassigned using normal dispatch controls. The browser timed out during A's final Unassign interaction; recovery through the second UI tab and a full refresh confirmed that the mutation had completed, so it was not repeated.

Final refreshed Operations state on 2026-09-24:

| Fixture | ID | Final state |
| --- | --- | --- |
| WO-F34IV-02-A | `c52d9ce5-b99b-4eb2-adc1-de7f1739e366` | OPEN, unassigned, unscheduled, no Visit recorded |
| WO-F34IV-02-B | `1b024426-2ff8-4f4a-91da-c29779629f09` | OPEN, unassigned, unscheduled, no Visit recorded |

C remained untouched. No WorkOrder was deleted; customer/site/reactive facts were not edited. No direct database/storage manipulation was used. Cleanup changed runtime test data only.

### Final successor boundary and publication status

Exactly the reviewed five successor files remain: `apps/web/src/modules/frigora/app/mutation-actions.ts`, `apps/web/src/modules/frigora/scheduling-conflicts.test.ts`, `apps/web/src/modules/frigora/app/dispatch-confirmation.test-support.ts`, `docs/engineering/README.md`, and this report. Split: three modified tracked files and two new files. Production behaviour delta remains the single explicit `confirmDoubleBooking` forwarding line. The 29 unrelated pre-existing untracked files remain preserved; the complete working tree is therefore not clean.

Dependencies, package files and lockfile unchanged. Frigora 0.22.0, schema generation 30, `frigora-offline` IndexedDB v1 and the exact capture allowlist (`recordTechnicalFinding`, `recordFieldCapture`, `recordVisitEvidence`) are unchanged; no offline dispatch. No new runtime/test artifacts, database, credentials or build output belong to the successor delta. Final `git diff --check` passes, exit 0. Nothing staged, committed or pushed; no merge, rebase, amend or force-push. Branch remains `feat/frigora-f34-scheduling-dispatch`, HEAD remains `d75ab9c17be6fb1147f7a3b7568ad9822c7714e0`; published predecessor and PR #2 untouched and no merge performed.

The earlier parallel failures remain recorded; the complete serial alternative is green. **WINDOWS / LIBSQL NATIVE TEST-PROCESS CONCURRENCY LIMITATION** remains declared: exact upstream allocation/free root cause is unproven and no Frigora lifecycle violation was demonstrated. No further native investigation was performed after Control closed that phase.

F34-03 CORRECTION GREEN WITH DECLARED NATIVE VERIFICATION LIMITATION — READY FOR CONTROL PUBLICATION REVIEW
