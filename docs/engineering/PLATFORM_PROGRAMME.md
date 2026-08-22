# VentureOS Platform programme

**Purpose.** Engineering close-out for platform boot sprints (workspace, company, desk). Distinct from the VS-001–VS-008C ledger in [ENGINEERING_HISTORY.md](./ENGINEERING_HISTORY.md), which Engineering HQ parses as `## VS-` field tables only.  
**Authority.** Engineering Records. Architecture law remains the [VentureOS Platform Constitution](../architecture/VENTUREOS_PLATFORM_CONSTITUTION.md) and `apps/web/src/FOUNDATION.md`.  
**Last Updated.** 2026-08-22

Do not copy these rows into `ENGINEERING_HISTORY.md` as `## VC-` field tables. That swallows VS-008C in the live catalogue parser.

Do not open VC-013 from this file. Platform Validation is the gate after VC-012. VC-020 remains closed.

---

## VC-012 — Company and workspace boot

Approved 2026-08-22 with founder amendments. Branch `feat/vc-012-company-workspace-boot`.

### Architectural constraints (unchanged)

- Foundation v1.0 remains protected.
- Runtime remains the only orchestrator.
- `RUNTIME_PIPELINE` must not change.
- Workspace Registry and Venture Registry are governance catalogues over existing persistence, not new databases or bounded contexts.
- Definition Registry remains the only product-definition system.
- No Product Registry.
- No Runtime imports into pages or the shell.
- No Brain (VC-020 remains closed).
- No persistence redesign.
- No redesign of the certified Foundation.

### Acceptance criterion 15

A founder can log in, select a workspace, switch between multiple companies within that workspace, and observe the correct Company HQ loading without page inconsistency, stale Runtime state or stale shell state.

### Definition of Done (product-agnostic)

No VentureOS capability may become aware of Qualora, Calviora, Farmora or any other Venture by name. All Venture-specific behaviour must continue to resolve exclusively through the Definition Registry. VentureOS must remain product-agnostic.

### Implementation commits

1. `feat(workspace): add Workspace Registry over existing organisations`
2. `feat(venture): add Venture Registry over existing companies and definition refs`
3. `feat(desk): boot session, workspace, and company before intelligence`
4. `feat(shell): switch company through the desk boot path`
5. `docs: record VC-012 without amending Foundation architecture`

### Platform Validation

Recorded 2026-08-22 on `feat/vc-012-company-workspace-boot` after recovering the Next.js lock and serving `http://localhost:3000`. VC-013 is not opened.

| Check | Evidence |
|---|---|
| Founder login | Login and signup routes return 200. Unauthenticated `/dashboard` redirects to `/login`. `authenticateUser` after `registerUser` passes in `platform-boot.test.ts`. Auth service tests already cover password sign-in. |
| Workspace creation | `createWorkspace` founds the first workspace, then asserts `workspace.create` for the second. Proven in Workspace Registry tests and `platform-boot.test.ts`. |
| Workspace selection | Desk boot resolves the requested workspace. A stale company id from another workspace does not remain active. |
| Company creation | `createVenture` / `persistFoundedCompany` creates North Star and South Star on one workspace and West Star on another. Founding sets the active company cookie. |
| Company switching | `selectVentureAction` persists through Venture Registry + desk boot. Shell keeps the boot company on non-HQ routes. HQ slug selects that company. |
| Runtime boots after every switch | `executeIntelligenceRuntime` runs after each workspace selection in `platform-boot.test.ts`. `RUNTIME_PIPELINE` is unchanged. |
| Company HQ reflects the active company | HQ loads by slug in the active workspace and persists that company. Situation Room projection uses `activeVentureId`. |
| Situation Room reflects the active company | `projectSituationRoom` returns `South Star` or `North Star` from the same VIC when boot names that company. |
| Executive Office reflects the active company | `projectExecutiveFloor` scopes to `activeVentureId`. |
| Theme persistence | `ids-consumption.test.ts` persists climate on the `html` class. Login and signup render `ThemeToggle`. Live login showed “Switch to Executive Dark”. |
| Build, lint, types, tests | `pnpm lint` pass. `pnpm check-types` pass. `pnpm test` pass (web 215 before this close-out file, plus `platform-boot.test.ts`). `pnpm --filter web build` pass. `pnpm --filter web run doctor` pass. |
| No stale Runtime after switch | Cross-workspace company cookie falls back to a company in the selected workspace. Rooms project from the boot company, not leftover chrome state. |

Interactive multi-company HQ clicking in the Cursor browser was not completed in this session: credential entry into the signup password field was skipped. The running desk is up on localhost:3000 for founder walk-through of AC 15.

Do not begin VC-013 from this record.
