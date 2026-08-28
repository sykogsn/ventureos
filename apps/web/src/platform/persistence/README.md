# Persistence

Repository-driven SQLite storage for VentureOS. The intelligence service remains the only adapter that persists Runtime mutation snapshots. Repositories perform CRUD and JSON mapping only.

## Lifecycle

`getDb()` / `getClient()` stay process-scoped on `globalThis` so the file database is not opened twice.

`getPersistence()` is **module-scoped**. Hot reload rebinds repository closures to the current Drizzle helpers while keeping the same connection. `resetPersistenceLifecycle()` drops the client and the facade (used by tests; default `:memory:`).

## Jobs and audit

`JobOrchestrator`, `AuditLog`, workforce execution records, agent definitions, agent instances, workforce runs, workforce approvals, and workforce verifications persist through the same SQLite connection. They call `getDb()` / `getClient()` per operation so `resetPersistenceLifecycle()` does not leave them bound to a closed client. Venture operational modules may do the same: Frigora Customer, Site, Asset, and WorkOrder rows live in `frigora_*` tables beside VIC, owned by `modules/frigora`, and call `getDb()` / `ensureSchema()` per operation. They are not stored in genome, risk, health, memory, or Brain objects. They are not part of the VIC Persistence facade. Schema generation 15 adds Visit outcomes; generation 14 adds Visit corrective actions; generation 13 adds Visit technical findings; generation 12 adds Visit field capture; generation 11 adds Visit attendance; generation 10 adds WorkOrder assignment; generation 9 added WorkOrder; generation 8 added Customer, Site, and Asset. Handlers stay in-process and are not stored. Interrupted `running` jobs are failed with `interrupted-by-restart` on the first `processDue` of a new orchestrator instance; they are not replayed. Interrupted `running` workforce executions are failed with `INTERRUPTED` when a new execution store is constructed; they are not replayed. Interrupted workforce runs in `reasoning` are failed `INTERRUPTED` and are not model-replayed. Runs waiting for approval remain `awaiting_approval`. Runs in `verifying` survive restart and are not completed merely because a Sprint 5 execution row succeeded. If execution already succeeded, recovery moves toward verification and never re-executes. The 15-second `jobs.processDue` tick may then call `orchestrator.recover()`; recovery is bounded and deterministic, performs no model reasoning, and never re-executes a completed or interrupted business action. Verify jobs already queued or running, including future `runAt`, count as active and are not double-enqueued. A live observe nonce is not released while a verify job is active. Schema generation 7 adds optional `implementation_id` / `implementation_version` on execution and verification rows and bounded optional `external_reference` on executions. Job payload JSON and execution `outcome_json` are parsed fail-closed. Audit is append-only and must not store VIC snapshots, model prompts, or evidence packs. Workforce execution rows store argument hashes, not model prose. Verification evidence is bounded JSON on the verification row (8 KiB ceiling) and is not copied into audit metadata or the redacted inspector.

Agent definition content is immutable after insert; only `lifecycle` may change (kill switch). Agent instance `definition_id` / `definition_version` are pinned at insert; only `status` may change.

`ventures.lifecycle` is the instance operating lifecycle used by Workforce authority (`concept|incubating|operating|scaling|sunset`). It is not marketing `stage` and not the Venture Definition Framework catalogue lifecycle.

## Policy rows

`policy_states` is the canonical workspace policy snapshot (`library_json` + `findings_json`).

`policy_findings` is a denormalized row copy written by `replaceFindings` for existing databases. `loadState` reads `policy_states` first. If that snapshot has no findings, it recovers from `policy_findings` (pre-H2 rows).

## Recommendations

Mutation persist replaces the workspace recommendation set (`replaceForWorkspace`). Vanished scopes are deleted. `replaceForScope` remains for a single venture id.

## Venture definition refs

Empty `definition_id` / `definition_version` map to `DEFAULT_VENTURE_DEFINITION_REF` so pre-definition rows load as VentureOS Company. See `core/venture-definition/README.md`.

