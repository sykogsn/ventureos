# Frigora F3.3 Architecture — Offline Field Capability

**Document type.** Architecture record (not a certification artefact)

**Venture.** Frigora

**Milestone.** F3.3 — Offline Field Capability

**Status.** Locked Control decisions + F33-01 foundation + F33-02 certified + F33-03 local technical-finding acceptance

**Date.** 2026-09-16

**Certified F3.2 base.** `d09087f9afb1108e8593dbe7480b0303063a48cb` (`frigora@0.21.0`, SCHEMA_GENERATION 26 at F3.2)

**Branch.** `feat/frigora-f33-offline-field-capability`

**Target product (not yet admitted).** `frigora@0.22.0`

---

## Objective

True field continuity when connectivity is lost: preload assigned work online, continue authorised append-oriented capture offline on durable local state, survive refresh, then reconnect and **explicitly** submit under server authority.

## Locked Control decisions

1. Target product `frigora@0.22.0` — admit only when Control authorises final F3.3 product admission (not in F33-01/02/03).
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
- Reconnect alone performs **zero** business mutation.
- There is **no** automatic/general outbox drain in F33-03.
- There is **no** background business synchronisation.
- Submission occurs only when the engineer invokes a visible submit/retry action while online and authenticated.

## Anti-loop packet sequence

| Packet | Focus |
|---|---|
| F33-01 | Offline foundation + durable local store (this record) |
| F33-02 | Preloaded/read-only field workspace |
| F33-03 | Local mutation outbox + idempotent **explicit** server acceptance (schema 27; technical finding first) |
| F33-04 | Field capture/evidence integration |
| F33-05 | Conflict/authority handling + UX hardening |
| F33-06 | End-to-end verification + certification |

## Independent Verification policy

Independent running-product verification occurs **once** against the complete F3.3 candidate at **F33-06**. Intermediate packets use automated engineering verification only unless Control authorises a narrow lab.

## F33-01 foundation delivered

Client IndexedDB database `frigora-offline` v1 with stores: `workspaces`, `outbox`, `evidence_blobs`, `receipts`, `leases`. Mutation envelopes, sync-state machine, lease helpers, commercial-field guard, pending-data/logout primitives, and queue-aware status helpers. Field forms remain online-only (`FRIGORA_FIELD_FORMS_OFFLINE_CAPTURE_ENABLED = false`) preserving F3.2 honesty.

## F33-02 preloaded read-only workspace

Authenticated online preload builds field-safe snapshots from existing Frigora read loaders, commits them into IndexedDB, and issues/renews the 12-hour lease. In-session offline field surfaces may read those snapshots while the lease is active. Outbox/mutation capture remains disabled except as later packets authorise. Cold disconnected navigation still falls back to `/offline.html` without caching authenticated HTML.

## F33-03 local technical-finding acceptance

F33-03 enables **only** `recordTechnicalFinding` for local offline capture under an active lease, with durable partitioned outbox envelopes and **explicit** online submission. Server acceptance is idempotent on `(ventureId, clientOperationId)` with canonical request fingerprint enforcement and SCHEMA 27 receipts. The global offline capture flag remains **false**; other field mutations stay blocked offline. Product remains `frigora@0.21.0`; offline DB version remains **1**.
