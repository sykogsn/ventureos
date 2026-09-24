# F34-01 dispatch integrity

Control-authorised scope: WorkOrder assignment and scheduling concurrency, immutable dispatch history, and active-Visit protection. WorkOrder remains planning truth; Visit remains actual attendance. Product stays `frigora@0.22.0`, schema generation 29, and IndexedDB `frigora-offline` v1. No offline dispatch mutation is added.

## Owned transaction

`applyGuardedDispatchMutation` uses the installed `@libsql/client` 0.17.4 API `client.transaction("write")`. The local SQLite implementation begins `BEGIN IMMEDIATE`, detaches that connection from the client, and returns a transaction handle. Later shared-client operations use another connection and cannot roll back the dispatch transaction. SQLite arbitrates concurrent writers; a competing writer can receive `SQLITE_BUSY`.

All guard reads, dispatch event insertion, WorkOrder update, and failure classification use that handle. Commit follows successful statement/row-count checks. Exceptions roll back an open transaction, and `finally` closes the handle. No compensation, sleeps, process-local mutex, or ignored commit errors are used.

The guard checks ID, workspace, venture, exact unnormalised `expectedUpdatedAt`, current assignee, current schedule endpoints, open WorkOrder status, and absence of a scoped open Visit. Nullable dispatch fields use SQL `IS`. Both event INSERT and WorkOrder UPDATE repeat the same pre-state guard.

`next: null, event: null` is the internal true-no-op validation path. It acquires the owned write transaction and validates the guard, then commits without any UPDATE or INSERT. Metadata cleanup uses an UPDATE with `event: null`. Material transitions insert one of the six locked dispatch event types. Open-Visit rejection copy is exactly: “Dispatch is locked while a visit is in progress.”

## Evidence and limits

The F34-01 focused suite passed 30/30 tests on 2026-09-22, with exit 0 and no skips or cancellations. It includes the retained R2 shared-client interference regression, independent-connection commit/rollback observations, forced UPDATE rejection and zero-row UPDATE, overlapping service requests, same-millisecond read-to-write interference, Visit ordering, all four true-no-op paths, metadata cleanup, six event types, and the real database CHECK.

The R2 regression previously observed a persisted assignment with zero events after dispatch returned a COMMIT error. With the owned handle, the competing batch receives `SQLITE_BUSY`, dispatch succeeds, and an independent connection observes the assignment plus exactly one event.

The same-millisecond guard proves protection against dispatch state changing between the service read and persistence decision. It does not add a client-side version contract beyond the locked timestamp input.

Full regression, build, and running-application certification are tracked separately in the takeover report. This document is not an engineering-green certificate. Historical Astra diagnostic artifacts are excluded from F34-01 evidence. No staging, commit, or push is authorised.

## Authorised compatibility corrections

The continuation migrated 82 individually mapped legacy dispatch calls in 16 test files. Each call uses its current fixture token, a returned authoritative WorkOrder, or a fresh authorised read after intervening mutations. Assertion callbacks remain responsible for exercising the original permission/status failure. Existing assertions were retained.

Control separately authorised correcting 20 current-catalog expectations from `0.21.0` to the locked `0.22.0` baseline; persisted older-version fixtures were preserved. All 20 selected catalog tests passed with exit 0. Control also authorised one stale offline component-wiring assertion: it now verifies the existing `runExplicitOfflineSubmission` lookup/submit callbacks, while retaining the no-effect-reconciliation and awaited-capture checks. That suite passed 9/9 with exit 0. No offline production code changed.

The web test script now includes `dispatch-integrity.test.ts`. Typecheck (`next typegen` and `tsc --noEmit`) and lint (`eslint --max-warnings 0`) passed. The production build passed its IDS guard, compilation, TypeScript, and route generation; it reported two filesystem-tracing warnings in unchanged storage files. IDS generation/checks and 94 IDS tests passed.

The built application was started with a disposable verification database before the final no-reseed continuation. No user/venture fixtures were seeded into it. HTTP checks returned 200 for the Frigora login page and manifest; the latter reports `frigora@0.22.0`. This is startup/public-route evidence, not authenticated browser dispatch certification.
