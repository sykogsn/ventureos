# Persistence

Repository-driven SQLite storage for VentureOS. The intelligence service remains the only adapter that persists Runtime mutation snapshots. Legacy repositories perform CRUD and JSON mapping. The separate operational-intelligence repository also enforces revision and storage integrity.

## Lifecycle

`getDb()` / `getClient()` stay process-scoped on `globalThis` so the file database is not opened twice.

`getPersistence()` is **module-scoped**. Hot reload rebinds repository closures to the current Drizzle helpers while keeping the same connection. `resetPersistenceLifecycle()` drops the client and the facade (used by tests; default `:memory:`).

## Jobs and audit

`JobOrchestrator`, `AuditLog`, workforce execution records, agent definitions, agent instances, workforce runs, workforce approvals, and workforce verifications persist through the same SQLite connection. They call `getDb()` / `getClient()` per operation so `resetPersistenceLifecycle()` does not leave them bound to a closed client. Venture operational modules may do the same: Frigora Customer, Site, Asset, and WorkOrder rows live in `frigora_*` tables beside VIC, owned by `modules/frigora`, and call `getDb()` / `ensureSchema()` per operation. They are not stored in genome, risk, health, memory, or Brain objects. They are not part of the VIC Persistence facade. Schema generation 18 adds Visit part usages; generation 17 adds Visit refrigerant events; generation 16 adds Visit recommended actions; generation 15 adds Visit outcomes; generation 14 adds Visit corrective actions; generation 13 adds Visit technical findings; generation 12 adds Visit field capture; generation 11 adds Visit attendance; generation 10 adds WorkOrder assignment; generation 9 added WorkOrder; generation 8 added Customer, Site, and Asset. Schema generation 21 adds shared `stored_objects` metadata for VentureOS object storage. Schema generation 22 adds Visit evidence. Schema generation 23 adds WorkOrder `cancellation_reason` and `source_recommended_action_id`. Schema generation 24 additively adds WorkOrder schedule and assignment-response columns plus the venture/scheduled-start index; no dispatch table is introduced. Handlers stay in-process and are not stored. Interrupted `running` jobs are failed with `interrupted-by-restart` on the first `processDue` of a new orchestrator instance; they are not replayed. Interrupted `running` workforce executions are failed with `INTERRUPTED` when a new execution store is constructed; they are not replayed. Interrupted workforce runs in `reasoning` are failed `INTERRUPTED` and are not model-replayed. Runs waiting for approval remain `awaiting_approval`. Runs in `verifying` survive restart and are not completed merely because a Sprint 5 execution row succeeded. If execution already succeeded, recovery moves toward verification and never re-executes. The 15-second `jobs.processDue` tick may then call `orchestrator.recover()`; recovery is bounded and deterministic, performs no model reasoning, and never re-executes a completed or interrupted business action. Verify jobs already queued or running, including future `runAt`, count as active and are not double-enqueued. A live observe nonce is not released while a verify job is active. Schema generation 7 adds optional `implementation_id` / `implementation_version` on execution and verification rows and bounded optional `external_reference` on executions. Job payload JSON and execution `outcome_json` are parsed fail-closed. Audit is append-only and must not store VIC snapshots, model prompts, or evidence packs. Workforce execution rows store argument hashes, not model prose. Verification evidence is bounded JSON on the verification row (8 KiB ceiling) and is not copied into audit metadata or the redacted inspector.

Agent definition content is immutable after insert; only `lifecycle` may change (kill switch). Agent instance `definition_id` / `definition_version` are pinned at insert; only `status` may change.

`ventures.lifecycle` is the instance operating lifecycle used by Workforce authority (`concept|incubating|operating|scaling|sunset`). It is not marketing `stage` and not the Venture Definition Framework catalogue lifecycle.

## Policy rows

`policy_states` is the canonical workspace policy snapshot (`library_json` + `findings_json`).

`policy_findings` is a denormalized row copy written by `replaceFindings` for existing databases. `loadState` reads `policy_states` first. If that snapshot has no findings, it recovers from `policy_findings` (pre-H2 rows).

## Recommendations

Mutation persist replaces the workspace recommendation set (`replaceForWorkspace`). Vanished scopes are deleted. `replaceForScope` remains for a single venture id.

## Venture definition refs

Empty `definition_id` / `definition_version` map to `DEFAULT_VENTURE_DEFINITION_REF` so pre-definition rows load as VentureOS Company. See `core/venture-definition/README.md`.


## AIF-02 operational intelligence candidate

Status: IMPLEMENTED CANDIDATE / AWAITING VERIFICATION. This is not certification.

Schema generation 31 (from current-main generation 30) adds only intelligence_catalogues, intelligence_objects and
intelligence_revisions. It does not migrate legacy knowledge_nodes/knowledge_edges,
dual-write Runtime snapshots, or replace the existing intelligence adapter.

The operational-intelligence service accepts an existing signed session credential,
resolves its persisted session and user, and checks live venture.read (get/query/trace)
or venture.update (capture/amend/retract/supersede). OperatingScope never grants access.
Each operation captures one application timestamp. Mutations load the complete workspace
catalogue, verify storage integrity and row/payload scope, propose changes in memory,
and call the public Brain assertIntelligenceCatalogue before opening the write transaction.
Reads validate the complete catalogue before applying filters.

A workspace is the hard boundary. Every record requires operatingScope with matching
workspaceId and originatingVentureId; applicability and sharing cannot cross workspaces.
Within-workspace sharing retains canonical authorityRef validation. User-supplied actor
identities or evaluation times are not mutation inputs.

Each write transaction rechecks catalogue version and expected object revision. It writes
the immutable revision, current projection and catalogue head atomically. Supersession
creates the successor and retires the predecessor in one transaction at one catalogue
version/mutation ID. Any error rolls back all writes. There is no revision delete API.
Object IDs are globally unique; workspace filters apply to every read. Claim/Learning
terminal states cannot be reactivated. Other types have no invented retraction semantics.

Documents use SHA-256 over exact stored UTF-8 JSON bytes. Revision hashes use the
versioned positional AIF-02-revision-v1 serialization in sqlite.ts, including the prior
revision ID/hash, document hash, actor, reason, permission, time and catalogue version.
Reads check the complete chain, contiguous revisions and agreement with the current row.
This detects corruption; it is not a signed external ledger and cannot detect a privileged
attacker consistently rewriting all data or rolling the entire database back.

Learning maturityHistory and validationHistory retain exact prefixes. Evidence source,
capturedAt, supportsObjectId, provenance and derived_from edges cannot be rewritten.
The canonical Brain validator remains the sole semantic authority. Stored, structurally
validated, approved and true remain distinct. Returned catalogueValidation and
recordAssessment are separate; advanced Learning may remain UNASSESSED. No database flag
confers truth, independent evidence, successful Decision outcome or organisational principle.

Tests use isolated file databases to exercise transaction durability across client resets.
Each AIF-02 transaction owns a short-lived file-backed SQLite connection, explicitly commits or rolls back, then closes the native handle. Native SQLite statement handles can nevertheless retain Windows file locks until GC; tests tolerate only EPERM when removing their isolated temporary directories. Such fixtures may remain for OS cleanup. Transaction and assertion failures are never suppressed. Configured :memory: and file::memory: URLs use the platform getDatabaseUrl() ephemeral-file resolution. Dedicated connections reuse storedObjectDurability.openClient/disposeClient and SQLITE_DURABILITY_BUSY_TIMEOUT_MS (250 ms); the existing durability helper and corrected ephemeral lifecycle are preserved. Remote URLs remain unsupported. The reviewed transaction boundary and stale-version behavior are unchanged; no new retry policy is introduced.
The service is server-side infrastructure with no new routes or UI. Future callers must
use this authority boundary; raw repository access is trusted infrastructure, not a public API.