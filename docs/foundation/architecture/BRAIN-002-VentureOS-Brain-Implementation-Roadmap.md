# BRAIN-002 — VentureOS Brain Implementation Roadmap

**Sprint.** VC-002  
**Status.** Approved plan. FD-B0 accepted. Not implemented.  
**Date.** 2026-08-22  
**Owner.** Engineering  
**Authority.** Implementation sequence for [BRAIN-001](./BRAIN-001-VentureOS-Brain-Architecture.md). Subordinate to the [Project Constitution](../../PROJECT_CONSTITUTION.md) and the [Platform Constitution](../../architecture/VENTUREOS_PLATFORM_CONSTITUTION.md).  
**Prerequisite.** VC-001 approved. FD-B0 accepted. ADR-009 accepted (VC-003).  
**Decision.** [ADR-009](./ADR-009-VentureOS-Brain.md)  
**Does not.** Implement Brain. Redesign Runtime, VIC, Capability Registry, Venture Definitions, Executive Office, Situation Room, or Company HQ. Add an eighth Runtime stage. Add `brain.*` dispatch capabilities. Open a chat UI or embedding index.

This roadmap evolves the systems Foundation v1.0 already certified. It does not replace them.

---

## 1. Law of the sequence

1. One sprint at a time. Certify before the next begins.
2. Additive change only. Optional fields, new types, new tests. No parallel schema.
3. **Do not add a `brain` field to `VentureIntelligenceCore`.** Operating knowledge projects onto existing VIC slices: decisions, memory, knowledge graph, recommendations, briefing, policy, risk.
4. Runtime **pipeline** (`apps/web/src/core/runtime/pipeline.ts`, `RUNTIME_PIPELINE`) does not gain a stage or a second entry. Engines behind existing stages may grow.
5. `refreshKnowledgeGraph` and `hydrateRecommendations` may evolve. `runExecutiveIntelligenceRuntime` remains the only caller.
6. Pages still must not import the Runtime.
7. Calviora still skips briefing assembly. No costume.
8. Institutional catalogue stays valid after every sprint (`assertKnowledgeCatalogue`).
9. Foundation v1.0 gates still pass: lint, types, web tests, IDS tests, build, doctor, login 200, climates persist.
10. If a sprint needs a Foundation amendment, stop and take a founder decision. Do not hide it.

---

## 2. Implementation order

```
VC-002  this plan (complete as documentation)
   │
   ▼
VC-003  Governance lock (ADR + registers)
   │
   ▼
VC-010  Knowledge Object kernel
   │
   ▼
VC-011  Operating Knowledge Objects (in-memory types)
   │
   ├──────────────► VC-020  Graph vocabulary
   │                    │
   │                    ▼
   │                VC-021  Graph projection (stage 7 engine)
   │
   ▼
VC-030  Memory model (ageing, layers — no new Runtime stage)
   │
   ▼
VC-040  Context assembly
   ▼
VC-041  Evidence weight + confidence
   ▼
VC-042  Conflict detection
   ▼
VC-043  Ground recommendations (stage 5 engine)
   │
   ▼
VC-050  Executive products (assemblers only)
   │
   ▼
VC-060  Learning (founder-event feedback)
   │
   ▼
VC-070  Persist operating objects (TD-009 operating plane)
   │
   ▼
VC-080  Brain desk layout (RM-009) — institutional only
   │
   ▼
VC-090  Performance
   │
   ▼
VC-100  Future AI contract (no model)
```

**Do not start in parallel** except where the table says a sprint is blocked only on an earlier cert. VC-020 may not start before VC-011 certifies. VC-021 may not start before VC-020 certifies. VC-040 may not start before VC-021 and VC-030 certify.

Weekly Review **display** on Situation Room is not in this sequence. It is a founder decision (FD-B3). The assembler in VC-050 is enough to certify the product exists.

---

## 3. Phase map

| Phase | Sprints | Bounded context | Certifies |
|---|---|---|---|
| 0 Governance | VC-003 | Registers only | Brain is named substrate; ADR-001 unharmed |
| 1 Objects | VC-010, VC-011 | Knowledge Object System | Kernel + operating types; institutional catalogue still asserts |
| 2 Graph | VC-020, VC-021 | Knowledge Graph | Extended edges; stage 7 still idempotent |
| 3 Memory | VC-030 | Memory | Ageing helpers; apply-event still idempotent |
| 4 Reasoning | VC-040–VC-043 | Reasoning | Deterministic context → grounded recommendations |
| 5 Products | VC-050 | Executive intelligence products | Assemblers; rooms unchanged |
| 6 Learning | VC-060 | Learning | Feedback via existing founder-decision event |
| 7 Persistence | VC-070 | Persistence ports | Operating KOs stored; repositories still do not reason |
| 8 Desk | VC-080 | Brain desk | RM-009 institutional layout |
| 9 Cost | VC-090 | Graph + catalogue | Walk and assert bounds |
| 10 AI | VC-100 | Explanation contract | Interface only; no LLM |

---

## 4. Standing dependencies (every implementation sprint)

| Depends on | Why |
|---|---|
| BRAIN-001 accepted | Shape of objects, graph, memory, reasoning |
| Foundation v1.0 healthy | Pre-flight: lint, types, tests, build, doctor, running desk |
| ADR-001 | One orchestrator |
| Previous sprint certified | Sequence law |

**Never depends on:** a new Runtime stage, a Product Registry, Qualora-private knowledge, embeddings, chat.

---

## 5. Standing regression pack (every implementation sprint)

Run before calling a sprint complete. A documentation sprint runs the register-accuracy check instead of the app pack.

| Gate | Prove |
|---|---|
| Lint / types | `pnpm --filter web lint` · `pnpm --filter web check-types` |
| Web tests | `pnpm --filter web test` (count must not drop; new tests added at the layer of the change) |
| IDS tests | `pnpm --filter @repo/ids test` if CSS/tokens untouched — still run when any web theme file is in the diff |
| Runtime contract | `runtime.test.ts` — founding and founder-decision replay stay idempotent |
| Brain catalogue | `knowledge-object.test.ts` — `assertKnowledgeCatalogue` on the live institutional set |
| Capability registry | No new dispatch id; existing `intelligence.*` tests pass |
| Calviora | Briefing assembly still skipped when `intelligence.briefing` is excluded |
| Pipeline | `RUNTIME_PIPELINE` still seven named stages |
| Desk | Login HTTP 200; no CSS parse; climates persist (`theme`) |
| Rooms | Situation Room, Office, HQ routes still project VIC; they do not import Runtime |
| Artefacts | Cursor `data-cursor-ref` / Grammarly / Dev Tools badge are not defects ([KNOWN-DEVELOPMENT-ARTEFACTS](../KNOWN-DEVELOPMENT-ARTEFACTS.md)) |

---

## 6. Rollback strategy (standing)

| Kind of change | Rollback |
|---|---|
| Types / engines / tests | Revert the sprint commit. Previous catalogue and VIC snapshots remain valid because fields are additive. |
| Additive optional fields on Recommendation / Memory / Graph | Older snapshots omit the field; readers default. Do not require a backfill to boot. |
| Persistence (VC-070 only) | Keep a down-migration or refuse the sprint until `RM-012` generation bump and a load path that ignores an empty object table. Repositories stay CRUD. |
| Brain desk (VC-080) | Revert module files. Institutional catalogue and query stay. |
| Any pipeline or VIC-shape change | **Not permitted.** If it appears in a diff, the sprint fails certification and is reverted. |

Do not ship a sprint that cannot revert without a data rewrite.

---

## 7. Sprints

### VC-003 — Governance lock

**Objective.** Record that Brain is the approved intelligence substrate and that Runtime remains the only orchestrator.

**Bounded context.** Registers and constitutions (documentation). No application code.

**Dependencies.** VC-001 approved. This plan (VC-002) accepted.

**Files expected.**

- `docs/foundation-library/05-GOVERNANCE/Architecture-Decision-Register.md` — ADR-009
- `docs/foundation/architecture/BRAIN-001-VentureOS-Brain-Architecture.md` — status → Approved
- `docs/foundation-library/05-GOVERNANCE/Roadmap-Register.md` — Brain implementation sequence pointer; RM-009 remains desk-only
- `docs/foundation/release/06-ROADMAP.md` — same pointer
- `docs/engineering/ENGINEERING_HISTORY.md` — VC-001 / VC-002 rows
- Optional teaching line in `docs/foundation-library/02-ARCHITECTURE/Architecture-Overview.md` (Brain is substrate, not a layer that impersonates Runtime)

**Must not change.** Any file under `apps/` or `packages/`.

**Migration.** None.

**Acceptance.**

- ADR-009 states: Brain provides intelligence; Runtime orchestrates; no eighth stage; no `brain.*` dispatch.
- BRAIN-001 marked approved.
- Roadmap names VC-010 as the first code sprint.

**Regression.** Document accuracy only. No silent Platform Constitution rewrite.

**Architectural risk.** **Low.** Risk is a constitution edit that redefines Runtime. Refuse that.

---

### VC-010 — Knowledge Object kernel

**Objective.** Evolve the existing Knowledge Object kernel with `plane` and typed relationships. Institutional objects keep working.

**Bounded context.** Knowledge Object System (institutional plane).

**Dependencies.** VC-003 certified.

**Files expected.**

- `apps/web/src/platform/brain/types.ts`
- `apps/web/src/platform/brain/knowledge-object.ts`
- `apps/web/src/platform/brain/knowledge-object.test.ts`
- `apps/web/src/platform/brain/catalogue.ts` — default `plane: "institutional"` on existing records
- `apps/web/src/platform/brain/README.md`
- `apps/web/src/platform/brain/query.ts` / `query.test.ts` only if filters need plane

**Must not change.** Runtime, VIC types, graph kinds, recommendation engine, `modules/brain` layout, persistence schema.

**Migration.**

- Add `plane: "institutional" | "operating"` to the kernel. Default institutional for every current catalogue row.
- Extend `KnowledgeRelationship` from `{ objectId }` to `{ objectId; kind?: KnowledgeEdgeKind }` (or a Brain-owned relation literal that maps 1:1 to graph kinds). Absent `kind` means untyped incident (today’s behaviour).
- `assertKnowledgeCatalogue` still fails on missing types and broken ids. Optionally fail on unknown `kind`.
- Do not add operating types in this sprint.

**Acceptance.**

- Existing institutional objects assert.
- Every catalogue row has `plane: "institutional"`.
- Relationship without `kind` still resolves.
- Brain desk still lists the same objects (no layout work).
- No VIC field added.

**Regression.** Standing pack. Catalogue tests cover every current `KNOWLEDGE_TYPES` member.

**Architectural risk.** **Low.** Risk is inventing a second object table. Keep one kernel.

---

### VC-011 — Operating Knowledge Objects

**Objective.** Add operating type discriminants and payloads as in-memory types and fixtures. No persistence. No product UI.

**Bounded context.** Knowledge Object System (operating plane).

**Dependencies.** VC-010 certified.

**Files expected.**

- `apps/web/src/platform/brain/types.ts` — operating types + payloads
- `apps/web/src/platform/brain/knowledge-object.ts` — type guards
- `apps/web/src/platform/brain/knowledge-object.test.ts`
- `apps/web/src/platform/brain/catalogue.ts` or a sibling `operating-fixtures.ts` — fixtures only, not mixed into governance cards
- `apps/web/src/platform/brain/README.md`
- Tests that Company / Decision / Risk ids can correlate with venture / decision / risk identities **without** writing VIC

**Must not change.** `core/venture/types.ts` shape. `IntelligentDocument`. Definition Registry. Capability catalogue. Rooms. Persistence.

**Migration.**

- Extend `KNOWLEDGE_TYPES` (or a parallel `OPERATING_KNOWLEDGE_TYPES` union into `KnowledgeObject`). Prefer **one** `KnowledgeObject` union, two type lists.
- Decision remains one discriminant. Operating vs governance is `plane` + `scopes` + existing `impact`.
- Procedure is a Knowledge Object. Do not add a Procedure capability (blocked on FD-B1).
- Customer / Contract / Provider are types only. No CRM routes (A-B6).
- Fixtures must not replace the institutional catalogue.

**Acceptance.**

- Guards distinguish institutional vs operating.
- `assertKnowledgeCatalogue` on institutional set still passes.
- Operating fixtures assert among themselves (ids, relationships).
- No screen lists operating objects yet.
- Document KO is not a file store; HQ `IntelligentDocument` unchanged.

**Regression.** Standing pack. Governance cards still resolve.

**Architectural risk.** **Medium.** Three Decision systems, or Qualora-shaped types. One Decision type. Shared types only.

---

### VC-020 — Knowledge Graph vocabulary

**Objective.** Extend `KnowledgeEdgeKind` to the BRAIN-001 set. Validate unknown kinds fail closed. No projection behaviour change yet.

**Bounded context.** Knowledge Graph (types).

**Dependencies.** VC-011 certified (operating ids exist to talk about).

**Files expected.**

- `apps/web/src/core/knowledge-graph/types.ts`
- `apps/web/src/core/knowledge-graph/model.ts` — helpers only if needed
- `apps/web/src/core/knowledge-graph/index.ts`
- New `apps/web/src/core/knowledge-graph/*.test.ts` (or extend existing if present)
- `apps/web/src/platform/brain/types.ts` — relationship `kind` aligns to the same literals
- Capability `intelligence.knowledge-graph` **limitations text only** if the README/catalog limitation sentence needs “extended kinds, still not a graph database”

**Must not change.** `pipeline.ts`. `refreshKnowledgeGraph` behaviour (that is VC-021). Rooms.

**Migration.**

- Add kinds: `created_by`, `evidence_for`, `supports`, `contradicts`, `depends_on`, `blocked_by`, `supersedes`.
- `owned_by` is **not** stored; it is the inverse of `owns`.
- `replaces` is an alias of `supersedes` — one stored kind.
- Existing edges (`owns`, `member_of`, `contains`, `seated_in`, `informs`, `mitigates`, `related_to`, `derived_from`) unchanged.
- Unknown kind fails in a validator used by tests; Runtime still only writes known kinds.

**Acceptance.**

- Type union matches BRAIN-001.
- Existing graph mocks compile.
- Validator rejects `"etc"` / unknown strings.
- Stage 7 output for a founding event is byte-stable with today (still founder `owns` venture).

**Regression.** `runtime.test.ts` founding idempotence. Persistence ports that import `KnowledgeEdge` still typecheck.

**Architectural risk.** **Low.** Risk is a second graph type. One `KnowledgeGraph` on the venture.

---

### VC-021 — Knowledge Graph projection

**Objective.** Evolve `refreshKnowledgeGraph` so the VIC graph is a neighbourhood projection (venture + operating neighbours + institutional constraints), still idempotent, still stage 7.

**Bounded context.** Knowledge Graph (engine behind stage 7).

**Dependencies.** VC-020 certified.

**Files expected.**

- `apps/web/src/core/runtime/effects.ts` — `refreshKnowledgeGraph` only
- `apps/web/src/core/runtime/runtime.test.ts`
- `apps/web/src/core/knowledge-graph/model.ts`
- Possibly `apps/web/src/core/runtime/README.md` — document projection growth, **not** a new stage

**Must not change.** `pipeline.ts` order or length. `runExecutiveIntelligenceRuntime` signature. Situation Room.

**Migration.**

- Keep current founder→venture `owns` edge and venture node.
- Add nodes/edges only when corresponding Knowledge Objects or VIC slices exist (decisions, risks already on the venture).
- Projection is derived. Do not persist a second graph beside VIC.
- Depth stays small (venture + open decisions + primary risk + `contradicts`/`supersedes` if present).
- Replay of the same founding event must not duplicate nodes or edges (existing id scheme).

**Acceptance.**

- Founding still adds exactly one venture node and one `owns` edge when none exist.
- Replay does not grow the graph.
- If an operating Decision fixture correlates to a VIC decision, a `decision` node may appear — still idempotent.
- Pipeline remains seven stages.

**Regression.** Standing pack + Runtime contract comments in `contract.ts`.

**Architectural risk.** **Medium.** This file sits in `runtime/effects.ts`. Risk is sneaking orchestration into the graph refresh. The function remains a pure projection.

---

### VC-030 — Memory evolution

**Objective.** Name memory layers and ageing in the existing executive-memory model. Writes still happen in `apply-event`.

**Bounded context.** Memory.

**Dependencies.** VC-010 certified. May run after VC-011; must certify before VC-040.

**Files expected.**

- `apps/web/src/core/executive-memory/types.ts`
- `apps/web/src/core/executive-memory/model.ts`
- `apps/web/src/core/executive-memory/mock.ts` if fixtures need flags
- New `apps/web/src/core/executive-memory/*.test.ts`
- `apps/web/src/platform/brain` ageing helpers for KO `reviewDate` / `supersedes` (shared, pure)
- `apps/web/src/core/runtime/effects.ts` — **only** if a memory record needs an additive optional field; founding/decision memory ids stay stable

**Must not change.** Pipeline (memory is not a stage). Platform session/auth. New session store in Brain.

**Migration.**

- Document layers in types: working = run context (not persisted); session = platform session (not Brain); venture/executive = existing `MemoryRecord`; long-term = KO history.
- Additive optional fields only (e.g. `aged?: boolean`, `objectId?: string`). Existing records remain valid.
- Ageing function: overdue `reviewDate` or `supersedes` target → Historical weight class. Does not delete records.
- Working memory is a TypeScript type for VC-040, not a VIC field.

**Acceptance.**

- Founding and founder-decision memory records still idempotent by id.
- Ageing is unit-tested and does not drop records.
- No Brain session table.

**Regression.** `runtime.test.ts` memory assertions (`mem-founded-*`, `mem-${rec.id}`).

**Architectural risk.** **Low.** Risk is Brain owning auth sessions. Forbidden.

---

### VC-040 — Context assembly

**Objective.** Pure `assembleContext(event, core)` that returns a structured bundle of VIC facts + object ids + graph neighbourhood. Not called from pages. Not a pipeline stage.

**Bounded context.** Reasoning.

**Dependencies.** VC-021 and VC-030 certified.

**Files expected.**

- New `apps/web/src/core/brain-reason/context.ts` (or `apps/web/src/core/recommendation/context.ts` if we refuse a new folder — prefer `core/brain-reason/` as engines, not Runtime)
- `apps/web/src/core/brain-reason/context.test.ts`
- `apps/web/src/core/brain-reason/index.ts`

**Must not change.** `pipeline.ts`. Pages. Capability registry (no new id).

**Migration.**

- New engine module. Runtime does not import it yet (VC-043 will).
- Focus rule matches `focusVenture` (primary recommendation venture → today’s mission → first venture).
- Includes definition exclusion: `briefingExcluded` boolean from instance profile.
- No LLM. No embeddings.

**Acceptance.**

- Same core + same event → same context (deep equality).
- Calviora-like fixture sets `briefingExcluded: true`.
- Context cites object ids, not prompt text.
- `rg runExecutiveIntelligenceRuntime apps/web/src/core/brain-reason` is empty.

**Regression.** Standing pack. New folder has zero Runtime imports.

**Architectural risk.** **Medium.** A `brain-reason` folder can be mistaken for an orchestrator. It is an engine. README one-liner required.

---

### VC-041 — Evidence weighting and confidence

**Objective.** Extend `scoreConfidence` with contested, aged, and supersession inputs. Define evidence classes.

**Bounded context.** Reasoning (confidence).

**Dependencies.** VC-040 certified.

**Files expected.**

- `apps/web/src/core/recommendation/confidence.ts`
- `apps/web/src/core/recommendation/types.ts` — optional `objectId` / `weightClass` on `SupportingEvidence`
- Tests beside confidence (new or extend)
- `apps/web/src/core/brain-reason/weight.ts` if class assignment is separate

**Must not change.** Consensus algorithm unless a test proves it must read the new inputs. Pipeline.

**Migration.**

- Existing `scoreConfidence` callers pass defaults (`contested: false`, `aged: false`) so current scores stay within the same bands for old fixtures unless a test documents a deliberate shift.
- Prefer **documenting** any band shift in the sprint close-out. Do not silently retune constants to “look better.”
- Labels remain High ≥ 80 / Moderate ≥ 60 / Low.

**Acceptance.**

- Contested or aged evidence lowers score vs the same inputs without those flags.
- Invented evidence is impossible: function does not create evidence, only scores it.
- Old recommendation fixtures still typecheck (optional fields).

**Regression.** `briefing.test.ts` and recommendation ranking tests.

**Architectural risk.** **Low.** Risk is confidence theatre. No score without evidence count.

---

### VC-042 — Conflict detection

**Objective.** `detectConflicts(context)` returns cited `contradicts`, supersession, and split-consensus conflicts.

**Bounded context.** Reasoning (conflict).

**Dependencies.** VC-040 certified. VC-020 kinds available.

**Files expected.**

- `apps/web/src/core/brain-reason/conflict.ts`
- `apps/web/src/core/brain-reason/conflict.test.ts`
- Optional additive type on recommendation payload used in VC-043 (`conflicts?: …`)

**Must not change.** Rooms. Policy engine ownership (policy findings remain stage 4 output; conflicts **read** them).

**Migration.**

- Pure function over context + graph edges.
- Empty array when no conflicts (fail visible by absence, not by throwing).
- Split/weak consensus reuses existing `ExecutiveConsensus.label`.

**Acceptance.**

- Fixture with `contradicts` returns those object ids and edge ids.
- No conflict → `[]`.
- Deterministic order (sorted ids).

**Regression.** Standing pack.

**Architectural risk.** **Low.**

---

### VC-043 — Ground recommendations

**Objective.** `hydrateRecommendations` cites Knowledge Object ids and conflicts. Still stage 5. Still derived from policy findings.

**Bounded context.** Reasoning + existing recommendation engine.

**Dependencies.** VC-041 and VC-042 certified.

**Files expected.**

- `apps/web/src/core/recommendation/model.ts`
- `apps/web/src/core/recommendation/types.ts`
- `apps/web/src/core/recommendation/rules.ts` if findings map there
- `apps/web/src/core/runtime/pipeline.ts` — **import only if** `hydrateRecommendations` signature is unchanged; prefer unchanged signature (`core` in, `core` out)
- `apps/web/src/core/brain-reason` used from `model.ts`
- Tests: `recommendation` + `runtime.test.ts`

**Must not change.** Pipeline length. Pages composing recommendation copy. Capability `intelligence.recommendation-engine` guarantees (update limitations only if we add “cites object ids”).

**Migration.**

- Additive fields: evidence `objectId`, `reason` may include ids, optional `conflicts`.
- Findings remain the source of recommendations.
- Calviora: recommendations may exist; briefing assembly still skipped later in the same stage as today.

**Acceptance.**

- A recommendation without named evidence fails a unit test (constitution).
- Runtime founding + refresh still deterministic.
- Screens that display `reason` keep working (string field remains).

**Regression.** Standing pack. Office / Situation Room recommendation projection files **unchanged** unless a type import requires it (type-only). Prefer no module edits.

**Architectural risk.** **High** if `pipeline.ts` grows a stage. **Medium** otherwise (desk copy shift). Certify with Runtime tests first.

---

### VC-050 — Executive intelligence products (assemblers)

**Objective.** Expose Morning Brief, Executive Brief, Decision Queue, Priority Queue, Risk Summary, Weekly Review, and Strategic Alerts as **pure assemblers** over VIC + context. Do not redesign rooms.

**Bounded context.** Executive intelligence products.

**Dependencies.** VC-043 certified.

**Files expected.**

- `apps/web/src/core/recommendation/briefing.ts` — ground existing brief with citations when context exists
- `apps/web/src/core/recommendation/briefing.test.ts`
- New `apps/web/src/core/brain-reason/products.ts` (+ tests): queues, risk summary, weekly review, alerts
- `apps/web/src/core/recommendation/ranking.ts` — reuse, do not replace

**Must not change.** `modules/situation-room/**`, `modules/executive-office/**`, `modules/ventures/**` HQ screens. Definition Registry. Briefing skip rule.

**Migration.**

- Morning / Executive Brief already exist — add optional citation ids on implications if needed.
- Queues are selectors over `DecisionEngine` and `RecommendationEngine` (already on VIC).
- Weekly Review is a function with a week horizon. Not a route.
- Strategic Alerts = critical/high + conflict or `blocked_by` or aged evidence.
- Calviora fixture: briefing assemblers return empty/skip; queues may still return decisions.

**Acceptance.**

- Each product has a unit test.
- `assembleMorningIntelligence` / `assembleExecutiveBriefing` remain the Situation Room sources.
- No new Next.js route.
- No fourth desk.

**Regression.** Briefing tests. Calviora skip. Room modules not in the diff.

**Architectural risk.** **Medium** if someone “just adds a Situation Room section.” Refuse. Display is FD-B3, a later named sprint.

---

### VC-060 — Learning

**Objective.** When a founder decision is recorded, store feedback that the next `assembleContext` / `scoreConfidence` can read. Human approval only.

**Bounded context.** Learning.

**Dependencies.** VC-043 certified. VC-030 ageing/memory fields available.

**Files expected.**

- `apps/web/src/core/runtime/effects.ts` — `FounderDecisionRecorded` branch only (additive memory / optional object link)
- `apps/web/src/core/executive-memory/types.ts` / `model.ts`
- `apps/web/src/core/brain-reason/learning.ts` + tests
- `apps/web/src/core/runtime/runtime.test.ts`
- `apps/web/src/core/recommendation/confidence.ts` — rejection prior input

**Must not change.** New event types that bypass Runtime. Auto-`Approved` on institutional objects. Pipeline stages.

**Migration.**

- Reuse `FounderDecisionRecorded`. Add optional fields on the memory record (`objectId`, stance).
- Next run: context includes that prior; confidence lowers on rejected sibling, does not auto-raise past evidence.
- Institutional KO correction remains catalogue/history (authoring), not this sprint’s writer.

**Acceptance.**

- Replay of the same founder decision does not duplicate memory.
- Unit test: rejection prior lowers confidence; approval does not exceed evidence-only score.
- Creed / constitution objects are not rewritten.

**Regression.** Runtime founder-decision test. Standing pack.

**Architectural risk.** **Medium.** Learning that writes objects from the Runtime would mix persistence with orchestration. Memory records only.

---

### VC-070 — Persist operating Knowledge Objects

**Objective.** Store operating-plane objects through persistence ports. Repositories CRUD only. Institutional catalogue may remain in-memory authored. Closes TD-009 for the **operating** plane only.

**Bounded context.** Persistence + Knowledge Object System.

**Dependencies.** VC-011 certified. Prefer after VC-060 so learning does not depend on a half-migrated table. Must precede any desk that lists operating objects (none planned on the Brain desk).

**Files expected.**

- `apps/web/src/platform/persistence/schema.ts`
- `apps/web/src/platform/persistence/repositories/ports.ts`
- `apps/web/src/platform/persistence/repositories/sqlite.ts`
- `apps/web/src/platform/persistence/repositories/repository.test.ts`
- `apps/web/src/platform/persistence/README.md`
- RM-012 generation bump as required by schema policy
- `apps/web/src/platform/brain` load/save adapters (not engines)

**Must not change.** Intelligence service as the only adapter for **Runtime VIC snapshots** (ADR-005). Repositories must not call reasoning. Runtime pipeline.

**Migration.**

- New table (or JSON document column) for operating KOs, workspace-scoped.
- Load: empty table → empty operating set; institutional catalogue unchanged.
- Intelligence service does **not** become the object author. Runtime snapshots stay VIC.
- Down-path: app boots if the table is empty.

**Acceptance.**

- Repository round-trip test.
- Repositories contain no `assembleContext` / `scoreConfidence` imports.
- Institutional `assertKnowledgeCatalogue` still uses the authored catalogue.
- TD-009 updated: operating plane persisted; institutional in-memory named remaining.

**Regression.** Persistence repository tests. VIC snapshot persist still only through intelligence service.

**Architectural risk.** **High** if objects are treated as a second VIC. **Medium** if scoped correctly. Workspace isolation tests required.

---

### VC-080 — Brain desk (RM-009)

**Objective.** Resume Knowledge Object **layout** for the institutional plane only. Presentation. Not persistence. Not a second Runtime.

**Bounded context.** Brain desk (shell).

**Dependencies.** VC-010 certified (stable kernel). Must not start before VC-043 if the layout shows AI Context as “the reasoner” — it must remain a field. Prefer after VC-050 so the desk is not mistaken for Situation Room.

**Files expected.**

- `apps/web/src/modules/brain/components/knowledge-object-layout.tsx`
- `apps/web/src/modules/brain/knowledge-object-screen.tsx`
- Related Brain module components/screens as needed for the locked KO sections
- Tests if any module tests exist; otherwise add layout-contract tests at the lowest layer that does not import Runtime

**Must not change.** Situation Room, Office, HQ. Runtime. Operating-object browsers. Search-as-intelligence (`query.ts` stays substring).

**Migration.**

- Implement the paused section layout against the kernel (title through AI Context).
- Relationships may show `kind` when present.
- No chat. No embedding search. No operating CRM lists.

**Acceptance.**

- Institutional object screen shows required sections.
- `rg runExecutiveIntelligenceRuntime apps/web/src/modules/brain` is empty.
- RM-009 marked complete for institutional layout; operating UI still out.

**Regression.** Standing pack. Brain query tests. IDS consumption if classes change.

**Architectural risk.** **Medium.** Risk is the desk becoming the OS. Keep it a catalogue.

---

### VC-090 — Performance

**Objective.** Bound graph walks, catalogue assert cost, and stage 7 projection so a larger operating set cannot freeze the desk.

**Bounded context.** Graph + object system (cost).

**Dependencies.** VC-021 and VC-043 certified. VC-070 if operating set is persisted (measure real load).

**Files expected.**

- `apps/web/src/core/brain-reason/context.ts` — documented max depth
- `apps/web/src/core/knowledge-graph` walk helper
- `apps/web/src/core/runtime/effects.ts` — projection still O(neighbourhood), not O(all objects)
- Tests with a large fixture (hundreds, not millions)

**Must not change.** Architecture to “add a cache product.” No Redis. No vector index.

**Migration.**

- Enforce BRAIN-001 small default depth.
- `related_to` walks do not recurse unbounded.
- Catalogue assert remains fail-fast, not a full-text index.

**Acceptance.**

- Walk above max depth is truncated and tested.
- Founding Runtime run on a large fixture stays deterministic and finishes in the test runner.
- No new infrastructure dependency.

**Regression.** Standing pack.

**Architectural risk.** **Low** if only bounds. **High** if someone adds search infrastructure.

---

### VC-100 — Future AI integration (contract only)

**Objective.** Specify the explanation-drafter interface: input is already-selected facts; output is copy; never evidence selection, confidence, or recommendation.

**Bounded context.** Learning / explanation (future).

**Dependencies.** VC-043 certified (grounded recommendations exist).

**Files expected.**

- `docs/foundation/architecture/BRAIN-003-Explanation-Drafter.md` (or a section appended later)
- Optional TypeScript interface in `apps/web/src/core/brain-reason/explain.ts` with a **deterministic stub** that joins existing `reason` + evidence labels
- Tests: stub does not add object ids that were not in the input

**Must not change.** Add an LLM SDK. Chat route. Capability classification “AI” as dispatch. Runtime.

**Migration.** None to production behaviour. Stub may be used by tests only, or as a pass-through of existing `reason`.

**Acceptance.**

- Interface forbids `core` mutation.
- Stub cannot invent evidence (test).
- No network call.
- Founder decision FD-B4 required before any model is wired.

**Regression.** Standing pack. `package.json` has no new model client.

**Architectural risk.** **High** if a model is wired in this sprint. The sprint **fails** if a provider is added. **Low** if contract-only.

---

## 8. Certification checkpoints

A checkpoint is a named halt. The next phase does not start.

| After | Checkpoint | Founder sees |
|---|---|---|
| VC-003 | **C0 — Law** | ADR-009. Brain named. Runtime untouched. |
| VC-011 | **C1 — Objects** | Institutional catalogue identical in meaning; operating types exist in tests only. |
| VC-021 | **C2 — Graph** | Founding graph still one `owns` edge; new kinds exist; pipeline still 7. |
| VC-030 | **C3 — Memory** | Replay still idempotent; ageing does not delete. |
| VC-043 | **C4 — Reasoning** | Recommendations cite objects. Login and rooms unchanged. Foundation v1.0 desk still behaves. |
| VC-050 | **C5 — Products** | Assemblers tested. No new room. |
| VC-060 | **C6 — Learning** | Founder decision writes a prior; no auto-approve. |
| VC-070 | **C7 — Persist** | Operating objects round-trip; VIC persist path unchanged. |
| VC-080 | **C8 — Desk** | Institutional KO layout. Not Situation Room. |
| VC-090 | **C9 — Cost** | Walks bounded. |
| VC-100 | **C10 — AI contract** | Stub only. No model. |

Each checkpoint uses the standing regression pack plus that sprint’s acceptance tests. Do not certify with conversation evidence alone.

---

## 9. Architectural risks (programme)

| Risk | Phase | Severity | Refuse by |
|---|---|---|---|
| Eighth Runtime stage | Any | Constitutional | Diff of `pipeline.ts` / `RUNTIME_PIPELINE` |
| `brain` field on VIC | 1–6 | Constitutional | Diff of `venture/types.ts` core shape |
| `brain.*` capability that dispatches | Any | Constitutional | Capability catalogue |
| Qualora-private knowledge product | 1, 8 | High | Shared types only |
| Three Decision systems | 1–2 | High | One discriminant |
| Embeddings / chat as Brain | 8–10 | Constitutional | VC-100 fail rule |
| Situation Room redesign for Weekly Review | 5 | High | VC-050 forbids room diffs |
| Repositories that reason | 7 | Constitutional | Import guard |
| Brain owns sessions | 3 | Constitutional | No session table |
| KO layout mixed into kernel sprint | 1 | Medium | VC-010 forbids `modules/brain` |
| Confidence without evidence | 4 | High | Unit test |
| Cross-workspace graph walk | 2, 7 | High | Workspace scope tests |

---

## 10. Founder decisions required

| ID | Decision | Blocks | Default if delayed |
|---|---|---|---|
| **FD-B0** | Accept this roadmap (VC-002) as the implementation sequence | All code sprints | Do not start VC-010 |
| **ADR-009** | Record Brain as substrate (VC-003) | VC-010 | Do not start kernel |
| **FD-B1** | Procedure remains a Knowledge Object (not a capability, not the workflow runner) | VC-011 Procedure payload | Ship Procedure as KO only (A-B5) |
| **FD-B2** | Operating-plane persistence timing (now = VC-070 after learning) | VC-070 | Keep operating fixtures in-memory; TD-009 stays open |
| **FD-B3** | Whether Weekly Review / Alerts **display** on Situation Room or Office (existing slots only, no new room) | A future `VC-051` display sprint **not in this plan** | Assemblers exist; rooms unchanged |
| **FD-B4** | Whether any language model may draft explanation copy | Wiring after VC-100 | Stub / existing `reason` only |
| **FD-B5** | Whether institutional catalogue ever leaves authored in-memory | Post-VC-070 | Institutional stays authored (TD-009 remainder) |

Already decided by constitutions (do not reopen):

- No second orchestrator
- No Product Registry
- No third climate
- Founder decides; intelligence recommends
- Calviora briefing exclusion
- Brain is not Qualora operations (RM-002 discovery)

---

## 11. What this plan does not schedule

- Redesign or restyle Situation Room, Executive Office, Company HQ (RM-008 remains a **layout** programme, not Brain)
- Qualora / Calviora / Farmora visual programmes (RM-001–004)
- Product-specific inspection/provider UIs (BRAIN-001 expansion item 9 — after C8)
- Chat, vector search, Brain HTTP API, eighth pipeline stage
- Closing institutional TD-009 unless FD-B5 says so
- Commits (VC-002 produces this document only)

---

## 12. Close-out (VC-002)

**Objective.** Implementation roadmap for the approved Brain. Complete as planning.

**Protected.** Runtime pipeline, VIC shape, registries, three rooms, IDS.

**Named next step.** Founder accepts FD-B0. Then VC-003 (ADR-009) only.

**Remaining risk.** Starting VC-010 before C0, or implementing two sprints at once.

C0 is VC-003 (ADR-009). VC-010 landed the kernel in `packages/brain` without changing `apps/`. VC-011 is not opened.
