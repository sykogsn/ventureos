# Persistence

Repository-driven SQLite storage for VentureOS. The intelligence service remains the only adapter that persists Runtime mutation snapshots. Repositories perform CRUD and JSON mapping only.

## Lifecycle

`getDb()` / `getClient()` stay process-scoped on `globalThis` so the file database is not opened twice.

`getPersistence()` is **module-scoped**. Hot reload rebinds repository closures to the current Drizzle helpers while keeping the same connection. `resetPersistenceLifecycle()` drops the client and the facade (used by tests; default `:memory:`).

## Policy rows

`policy_states` is the canonical workspace policy snapshot (`library_json` + `findings_json`).

`policy_findings` is a denormalized row copy written by `replaceFindings` for existing databases. `loadState` reads `policy_states` first. If that snapshot has no findings, it recovers from `policy_findings` (pre-H2 rows).

## Recommendations

Mutation persist replaces the workspace recommendation set (`replaceForWorkspace`). Vanished scopes are deleted. `replaceForScope` remains for a single venture id.

## Venture definition refs

Empty `definition_id` / `definition_version` map to `DEFAULT_VENTURE_DEFINITION_REF` so pre-definition rows load as VentureOS Company. See `core/venture-definition/README.md`.

