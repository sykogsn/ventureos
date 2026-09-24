# Frigora F3.3 Architecture — Offline Field Capability

**Document type.** Architecture record (not a certification artefact)

**Venture.** Frigora

**Milestone.** F3.3 — Offline Field Capability

**Status.** F3.3 — Offline Field Capability is **ADMITTED WITH DECLARED COVERAGE LIMITATIONS**. F33-04 is **CERTIFIED WITH DECLARED COVERAGE LIMITATIONS** and **CLOSED**. F33-05 is **CLOSED — ENGINEERING ACCEPTED**. F33-06 is **CERTIFIED WITH DECLARED COVERAGE LIMITATIONS** and **CLOSED**.

**Date.** 2026-09-16 (architecture lock). Admission publication: 2026-09-22.

**Certified F3.2 base.** `d09087f9afb1108e8593dbe7480b0303063a48cb` (`frigora@0.21.0`, SCHEMA_GENERATION 26 at F3.2)

**Branch.** `feat/frigora-f33-offline-field-capability`

**Functional admission candidate.** `6e124344e7fffff8dc721e4b14dc628442141b71` (`feat(frigora): harden offline conflict and recovery`)

**Admission-publication product version.** `frigora@0.22.0`

**SCHEMA_GENERATION.** 28

**IndexedDB.** `frigora-offline` v1

---

## Objective

True field continuity when connectivity is lost: preload assigned work online, continue authorised append-oriented capture offline on durable local state, survive refresh, then reconnect and **explicitly** submit under server authority.

## Locked Control decisions

1. Product `frigora@0.22.0` is reserved for final F3.3 admission and was not admitted in F33-01/02/03. Control authorised that admission in F33-06-CLOSE-01. The admission-publication product version is `frigora@0.22.0`.
2. Schema: F33-01/F33-02 remain SCHEMA_GENERATION **26**. F33-03 introduces additive sync/idempotency schema **26 → 27**.
3. V1 offline allowlist and online-only boundary as locked in F33-01 Control packet.
4. Visit departure does not complete WorkOrder.
5. Offline lease: **12 hours** from last successful authenticated preload; no fresh auth offline; cookie expiry during lease allows local work but blocks sync until revalidation; lease expiry locks workspace and preserves pending work.
6. Service Worker must not cache authenticated business HTML; business data lives in IndexedDB.
7. Partition by `ventureId + actorUserId` (plus workOrder/visit keys).
8. Logout with pending work: cancel, or logout retaining locked pending work — no casual discard.
9. No app-layer IndexedDB encryption in V1; keep data minimisation and no engineer pricing.
10. Server-synced facts read-only offline; unsynced local facts may edit/delete before sync; post-sync uses normal server rules.
11. Local acceptance ≠ server acceptance; no silent loss; no silent conflict resolution; no duplicate mutation on retry.

## Append-first rule

Prefer append-oriented facts for V1 offline capture. Existing SERVER-SYNCED facts are read-only offline.

## Offline lease policy

Lease issued/renewed only by successful authenticated online preload/revalidation. Offline actions must not self-extend the lease.

## User/venture partitioning

All business-bearing IndexedDB records scoped so one user cannot obtain another user’s cached data.

## Service Worker boundary

Navigation offline-page fallback only (F3.2). No authenticated HTML cache. No business/API CacheStorage. No Service Worker mutation queue or drain.

## Target sync / idempotency architecture

Client mutation envelopes carry stable `clientOperationId`. F33-03 adds server-side idempotency receipt storage (SCHEMA 27) and **explicit** submit replay through existing `FrigoraService` authority checks.

### Reconnect law (authoritative)

Earlier objective wording such as “reconnect and synchronise” does **not** mean automatic submission.

- Reconnect enables explicit submission.
- Reconnect may perform a **read-only** authoritative receipt reconciliation for the signed-in engineer's own non-synced operations, including a receipt accepted before reassignment.
- Reconnect alone performs **zero** business mutation. A read that marks local `SYNCED` is not a new business effect.
- There is **no** automatic/general outbox drain.
- There is **no** background business synchronisation and no recurring polling.
- Submission occurs only when the engineer invokes a visible submit/retry action while online and authenticated, and only after a read-only check reports that no authoritative receipt exists.

## Anti-loop packet sequence

| Packet | Focus | State |
|---|---|---|
| F33-01 | Offline foundation + durable local store (this record) | Delivered |
| F33-02 | Preloaded/read-only field workspace | Certified |
| F33-03 | Local mutation outbox + idempotent **explicit** server acceptance (schema 27; technical finding first) | Delivered |
| F33-04 | Field capture/evidence integration | CERTIFIED WITH DECLARED COVERAGE LIMITATIONS — CLOSED |
| F33-05 | Conflict/authority handling + UX hardening | CLOSED — ENGINEERING ACCEPTED |
| F33-06 | End-to-end verification + certification | CERTIFIED WITH DECLARED COVERAGE LIMITATIONS — CLOSED |

## Independent Verification policy

Independent running-product verification occurs **once** against the complete F3.3 candidate at **F33-06**. Intermediate packets use automated engineering verification only unless Control authorises a narrow lab.

## F33-01 foundation delivered

Client IndexedDB database `frigora-offline` v1 with stores: `workspaces`, `outbox`, `evidence_blobs`, `receipts`, `leases`. Mutation envelopes, sync-state machine, lease helpers, commercial-field guard, pending-data/logout primitives, and queue-aware status helpers. Field forms remain online-only (`FRIGORA_FIELD_FORMS_OFFLINE_CAPTURE_ENABLED = false`) preserving F3.2 honesty.

## F33-02 preloaded read-only workspace

Authenticated online preload builds field-safe snapshots from existing Frigora read loaders, commits them into IndexedDB, and issues/renews the 12-hour lease. In-session offline field surfaces may read those snapshots while the lease is active. Outbox/mutation capture remains disabled except as later packets authorise. Cold disconnected navigation still falls back to `/offline.html` without caching authenticated HTML.

## F33-03 local technical-finding acceptance

F33-03 enables **only** `recordTechnicalFinding` for local offline capture under an active lease, with durable partitioned outbox envelopes and **explicit** online submission. Server acceptance is idempotent on `(ventureId, clientOperationId)` with canonical request fingerprint enforcement and SCHEMA 27 receipts. The global offline capture flag remains **false**; other field mutations stay blocked offline. Product remains `frigora@0.21.0`; offline DB version remains **1**.

## F33-04 field capture and visit evidence

F33-04 extends the same local-capture + explicit-submit law to `recordFieldCapture` and `recordVisitEvidence`. The offline capture allowlist is exactly three operations: `recordTechnicalFinding`, `recordFieldCapture`, `recordVisitEvidence`. Evidence persists durable blob bytes + outbox metadata linked by `clientOperationId`; reconnect alone still does not submit; removal/linking remain online-only. Control's F33-04-ASTRA-COR-01 authorises SCHEMA generation **28** for shared StoredObject reservations; product remains `frigora@0.21.0`; offline DB version remains **1**; global `FRIGORA_FIELD_FORMS_OFFLINE_CAPTURE_ENABLED` remains **false**.

### COR-01 durable evidence correction

The optional Platform StoredObjects `idempotency: { key, requestFingerprint }` contract reserves one immutable object identity in SQLite before byte publication. `stored_object_reservations` uses a unique key derived from workspace, venture, actor, issued domain authority and caller key. Its fingerprint binds the caller's canonical request fingerprint, actual SHA-256, actual length, filename and content type. Identical requests reuse the reserved identity; changed requests conflict before byte writes. SQLite uniqueness, not a process-local lock, arbitrates. Frigora receipts still record completed business acceptance and are not provisional reservations or a parallel upload authority.

The local adapter flushes a uniquely named temporary file and atomically links complete bytes to the reserved object path without replacement. Existing bytes must match. A crash before metadata insertion leaves a retryable reservation; failure before Frigora receipt completion reuses the same stored identity. Frigora does not compensate by deleting an object that a concurrent identical request may have accepted. Failures remain visible. Independent processes require the same database and object root. Reservations have no automatic expiry or background drain.

Durability-path SQL uses a **dedicated short-lived client**, not the process singleton, and never retries native `SQLITE_BUSY` on the same poisoned handle. Each BUSY attempt disposes that client and opens a **new clean native client**. Native timeout is **250ms** per dedicated-client attempt. The absolute contention budget is **5 seconds**. SQLite uniqueness remains the StoredObject identity arbitration authority. Reservation uses dedicated reservation `INSERT`/`SELECT`. Reserved metadata uses a dedicated reserved-object `INSERT`. Reserved-object lookup `SQLITE_BUSY` recovers on a fresh dedicated connection and does not allocate another identity. `stored_object.created` keeps the same event ID and values across retry; success requires an independent fresh-client read-back of that row. `SQLITE_LOCKED` remains non-retry / fail-closed. Permanent, unknown, and deadline-exhausted failures remain fail-closed. WAL is not enabled. Dependencies and package versions are unchanged. SCHEMA generation remains **28**. IndexedDB remains **v1**. The upstream libSQL failed-statement lifecycle defect is **isolated, not fixed**. There is no singleton reconnect recovery.

IndexedDB v1 conditionally inserts the evidence blob and outbox envelope in one transaction. Reused operation IDs must match partition, target and canonical content. Submit validates venture, actor, operation, allowed lifecycle, SHA-256, positive safe-integer length matching actual bytes, filename and content type. Evidence acceptance reconciles receipt, outbox state and blob lifecycle atomically.

All three forms await guarded local capture and reconcile each explicit submit in its invocation, not a render effect. Response loss remains visible and explicitly retryable with the same operation ID; interrupted `SYNCING` permits manual retry. Reconnect effects read local state only. No service-worker mutation drain is introduced.

Engineering evidence (authoritative focused result, not product admission): the StoredObject suite passed **24/24 GREEN**, including crash/restart with four independent callers reusing one identity and four independently visible `stored_object.created` audits; the isolated durability matrix passed 26/26. **F33-04 is CERTIFIED WITH DECLARED COVERAGE LIMITATIONS and CLOSED** at `f0d3004e2e236591ec16542c2dc1319557310086`. These engineering results are not F33-06 certification and do not complete F3.3.

## F33-05 conflict, authority, and recovery

F33-05 hardens recovery for the existing three offline operations. It does not extend the allowlist. Product remains `frigora@0.21.0`. SCHEMA_GENERATION remains **28**. IndexedDB remains `frigora-offline` **v1**.

A dedicated read-only acceptance lookup reports `NOT_FOUND`, `ACCEPTED`, or `MISMATCH`. It does not call the submit methods, does not upload evidence bytes, and does not require the engineer to still be the current WorkOrder assignee. The receipt actor, operation, target, and server-recomputed fingerprint must match. A mismatch returns no foreign receipt data.

Explicit retry looks up first. `ACCEPTED` reconciles local state only. `NOT_FOUND` continues to the existing explicit submit. `MISMATCH` becomes `CONFLICT` and does not submit. Authentication failure becomes `BLOCKED`. Transport failure on an explicit attempt becomes `RETRYABLE_FAILURE`. Authority loss and visit/work-order rejection stay `CONFLICT`, with the reason persisted on the existing outbox envelope. Reconnect and pending refresh may run the same read. They do not submit. Interrupted `SYNCING` is not treated as acceptance and is not auto-resubmitted. F33-05 does not add a discard action.

**Closure.** F33-05 is **CLOSED — ENGINEERING ACCEPTED**. That closure records engineering acceptance of the recovery design above. It does not by itself publish the product version. Product admission is the publication below.

## F33-06 end-to-end verification

F33-06 is **CERTIFIED WITH DECLARED COVERAGE LIMITATIONS** and **CLOSED**.

F33-04 supplied live running-product evidence for a genuine offline same hydrated Visit, offline local field capture, offline evidence persistence, explicit server acceptance, evidence StoredObject/SHA linkage, interruption/retry continuity, and the reconnect mutation boundary with associated lifecycle evidence.

F33-05 supplied candidate-matched engineering coverage for receipt-driven reconciliation, stale PENDING/SYNCING recovery, auth BLOCKED, authority/business CONFLICT, partition isolation, evidence recovery, reconnect read-only reconciliation, and zero background drain.

F33-06 Independent Work supplied live candidate-era evidence for Engineer A authentication, Engineer B authentication, Owner/Dispatch authentication, authoritative WorkOrder/Visit access, a clean visible baseline, successful preload, Engineer B protected-resource denial, authentication return, WorkOrder/Visit lifecycle retention, and no visible unintended mutation.

F33-06 Independent Work could not directly exercise genuine offline networking because its cloud browser exposed no supported offline network control. That is a declared coverage limitation, not a product defect.

## F3.3 admission

F3.3 — Offline Field Capability is **ADMITTED WITH DECLARED COVERAGE LIMITATIONS**.

Functional admission candidate: `6e124344e7fffff8dc721e4b14dc628442141b71`.

Admission-publication product version: `frigora@0.22.0`.

SCHEMA_GENERATION remains **28**. IndexedDB remains `frigora-offline` **v1**. No persistence migration is part of this admission.

Offline allowlist remains exactly:

- `recordTechnicalFinding`
- `recordFieldCapture`
- `recordVisitEvidence`

Reconnect law: read-only reconciliation is allowed. Reconnect performs zero automatic business mutation.

Service Worker: no business mutation queue.

## Declared coverage limitations

These limitations are coverage limits. They are not product defects, and they are not claims that the missing live exercise was independently performed.

1. **Final-candidate genuine offline replay.** Not repeated through F33-06 Independent Work because the cloud browser could not emulate genuine offline networking. Coverage is retained from F33-04 live evidence plus F33-05 candidate-matched regression coverage.

2. **Reassignment / authority-loss live flow.** Not directly exercised end-to-end through F33-06 supported UI because dispatch is locked while a visit is in progress. That supported product rule is not a defect. Engineer B protected-resource denial was independently observed. Authority-loss/conflict recovery remains engineering-covered.

3. **Server-accepted / client-not-reconciled window.** Not safely manufactured through supported Independent Work UI. Covered by F33-05 engineering tests and the read-only reconciliation design.

4. **Concurrent same-`clientOperationId` overlapping submission.** Continuing live-coverage limitation. It was not independently exercised. Existing server idempotency/concurrency engineering evidence remains.

5. **Changed content with reused `clientOperationId`.** `NOT_DIRECTLY_VERIFIABLE` through legitimate UI. Requests were not forged and IndexedDB was not corrupted merely for coverage.

6. **Hidden receipt / StoredObject counts.** Not independently visible in the F33-06 Work browser. Prior running-product/server evidence and engineering coverage remain.

## F3.3 customer capability statement

Admitted F3.3 provides:

- authenticated field workspace preload;
- already-loaded/preloaded offline field continuity;
- offline technical finding capture;
- offline field capture;
- offline Visit evidence capture;
- durable local pending state;
- explicit server submission;
- idempotent acceptance;
- evidence integrity / StoredObject linkage;
- safe retry;
- read-only acceptance reconciliation;
- authority/conflict recovery UX;
- partition protection;
- honest local-vs-server acceptance state.

Admitted F3.3 does not provide:

- arbitrary disconnected cold-start login;
- background auto-sync;
- automatic reconnect submission;
- offline Visit arrival/departure;
- offline PartUsage;
- offline refrigerant commercial workflow;
- offline evidence remove/link;
- F3.4 scheduling functionality;
- Employee Agent functionality.

## Roadmap state

| Item | State |
|---|---|
| F3.3 — Offline Field Capability | ADMITTED / COMPLETE |
| F33-06 | CLOSED |
| F3.4 | PLANNED / NEXT |

F3.4 is not implemented and is not certified. FA-02 is not implemented.
