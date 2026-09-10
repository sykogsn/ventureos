# Frigora F3.1 Certification — Time & Materials Costing

**Document type.** Permanent venture-milestone certification record  
**Venture.** Frigora  
**Milestone.** F3.1 — Time & Materials Costing  
**Control decision.** CERTIFIED  
**Certification date.** 2026-09-10  
**Approved by.** Frigora Verification & Certification Control  
**Independent RPV.** RPV-F31-01-R1 (full) + RPV-F31-OBS-001-R1 (narrow override closure)

This record certifies the Frigora F3.1 Time & Materials customer-charge product layer. It does **not** rewrite Foundation Certification Index law. It does **not** certify F3.2 or any later Programme 2 milestone. Layer-specific certification remains the law: this certificate does not stand for Runtime, IDS, Capability Registry, or Definition Registry certification.

**Engineering standard.** [Master Engineering Prompt](./MASTER_ENGINEERING_PROMPT.md). Index: [Engineering Index](./README.md).

**Language.**

| Term | Meaning in this record |
|---|---|
| **IMPLEMENTED** | Capability exists in the certified repository tree |
| **VERIFIED** | Capability demonstrated by automated tests and/or Independent Running-Product Verification |
| **CERTIFIED** | Control accepts the IMPLEMENTED + VERIFIED evidence set as the permanent F3.1 checkpoint |

---

## Checkpoint identity

| Field | Value |
|---|---|
| Branch | `feat/frigora-reconciliation` |
| Pre-certification HEAD (F3.0 certified checkpoint) | `d6608cd241d6d4f2cca4a8004e49b21d4246f65f` |
| Product | **frigora@0.20.0** |
| SCHEMA_GENERATION | **26** (justified solely by F3.1 commercial persistence: `frigora_venture_commercial_settings`, catalogue default charge columns, and Visit / PartUsage / RefrigerantEvent commercial snapshot columns) |
| F3.2 | **NOT AUTHORISED / NOT CERTIFIED** |
| Certified Git checkpoint | The permanence commit that contains this artefact (authoritative identity = that commit hash) |

---

## Architecture (IMPLEMENTED)

F3.1 admits **customer-charge only** Time & Materials costing derived from operational evidence:

1. Venture-scoped labour hourly customer charge (`frigora_venture_commercial_settings.labour_hourly_charge_cents`)
2. Optional PartReference default unit charge (ZAR cents)
3. Optional RefrigerantReference default charge per kg (ZAR cents)
4. PartUsage `unitChargeCents` historical snapshot
5. RefrigerantEvent `chargePerKgCents` historical snapshot
6. Visit `labourHourlyChargeCents` historical snapshot (stamped on departure when configured)
7. Integer ZAR cents as the only money representation
8. Deterministic calculation authority (`computeWorkOrderTimeMaterials`)
9. Chargeable refrigerant = **added** only; recovered/removed contribute **R0.00** and do not block completeness
10. Commercial completeness `incomplete` \| `complete` independent of WorkOrder status
11. Known subtotal of priced chargeable lines
12. Final T&M total only when completeness is `complete`
13. Traceability from derived lines to Visit / PartUsage / RefrigerantEvent evidence
14. Office completion of unlisted / unpriced chargeable lines under `venture.update`
15. Historical stability: later catalogue/venture default changes do **not** rewrite existing snapshots
16. Intentional Owner override of **already-priced** commercial snapshots (PartUsage, chargeable RefrigerantEvent, departed Visit labour) under `venture.update`
17. Engineer / ordinary member monetary visibility denial (no T&M money UI; commercial APIs forbidden)
18. Work Order Detail T&M presentation for `venture.update` users
19. Catalogue default pricing extension on the existing catalogue surface

### Money representation

- Integer ZAR cents only (R 1.00 = 100).
- Deterministic rounding: `round(quantity × rateCents)` for parts/refrigerant; labour = `round(durationSeconds × hourlyRateCents / 3600)`.

### Completeness model

- Unpriced chargeable evidence → `incomplete`; known subtotal may still accumulate priced lines; final total is unavailable.
- All chargeable lines priced → `complete`; final total equals known subtotal.
- Completeness does **not** close or cancel the WorkOrder.

### Engineer monetary boundary

- Ordinary engineer/member: operational quantity/description capture only; no money rates, no T&M monetary section, no commercial mutation APIs.
- Owner/admin (`venture.update`): configure defaults, complete unpriced lines, intentionally override priced snapshots, read derived T&M summary.

### Historical snapshot stability vs intentional override

- **Stability** means defaults do not silently rewrite historical snapshots.
- **Override** means an authorised Owner may deliberately replace a chosen historical commercial snapshot; only that snapshot and derived totals change; operational identity/quantity/timestamps and catalogue defaults remain unchanged.

---

## Explicit Programme boundary / exclusions

F3.1 does **not** include (and this certification does **not** admit):

- internal cost ledger / payroll / per-engineer labour rates
- margin / markup
- VAT / invoicing / quotations / customer approvals / payments / accounting
- inventory / warehouse stock / van stock / stock movements
- procurement / suppliers / purchase orders / goods received
- cylinder custody / cylinder inventory
- offline / PWA
- employee agents
- F3.2 or later Programme 2 work

Negative-space automated assertions continue to reject inventory / invoice / quote / VAT fields on the T&M summary contract.

---

## Automated validation evidence (VERIFIED)

Recorded at certification gate F31-CG-01 (apps/web unless noted):

| Gate | Command | Result |
|---|---|---|
| Targeted F3.1 T&M | `pnpm exec node --import tsx --test src/modules/frigora/time-materials.test.ts` | **17 / 17 PASS**, EXIT **0** |
| Affected domain | time-materials, catalogue, part-usage, refrigerant-event, visit, work-order, work-execution, office/field/engineer workflows, membership, persistence repositories | **212 / 212 PASS**, EXIT **0** |
| Full Frigora suite | `pnpm exec node --import tsx --test src/modules/frigora/**/*.test.ts` | **396 / 396 PASS**, EXIT **0** |
| Persistence / auth / definitions | repository, stored-object, domain-authority, auth, venture-definition, bootstrap | **93 / 93 PASS**, EXIT **0** |
| Full web suite | `pnpm test` (apps/web) | **848 / 848 PASS**, EXIT **0** |
| Workspace tests | `pnpm test` (repo root) | Tasks **3 / 3** successful, EXIT **0** |
| Typecheck | `pnpm --filter web check-types` | EXIT **0** |
| Lint | `pnpm --filter web lint` | EXIT **0** |
| Production build | `pnpm --filter web build` | EXIT **0** |

Fail / cancelled / skipped / todo across recorded gates: **0 / 0 / 0 / 0**.

---

## Independent RPV correlation (VERIFIED)

### Full running-product verification — RPV-F31-01-R1

Independent Work packet **RPV-F31-01-R1** verified Owner/Engineer separation, Engineer no-money visibility, venture labour rate, catalogue defaults, Visit labour snapshotting, structured/unlisted part and added-refrigerant pricing, recovered = R0 non-blocking, incomplete vs complete, known subtotal vs final total, historical default-change stability, cross-WorkOrder isolation, deterministic ZAR calculations, evidence traceability, F3.0 operational regression, WorkOrder remains OPEN after Visit departure, and Programme boundary negative space.

**One material requirement FAILED in that run:**

### Defect history — RPV-F31-COMM-OVERRIDE-001

| Stage | Status |
|---|---|
| Initial RPV result (RPV-F31-01-R1) | **FAILED** — Owner UX exposed Save charge only for **unpriced** lines; already-priced PartUsage snapshot (R125.50) had no normal override control despite service support |
| Root cause | Presentation gated commercial forms on `summary.unpriced` only; service/actions already replaced non-null snapshots under `venture.update` |
| Corrected (F31-OBS-001) | Work Order Detail T&M section exposes explicit **Save override** for priced PartUsage, chargeable RefrigerantEvent, and departed Visit labour snapshots |
| Narrow re-verification | **RPV-F31-OBS-001-R1** |
| Closure verdict | **A. RPV-F31-COMM-OVERRIDE-001 CLOSED — NARROW RE-VERIFICATION PASSED** |

Verified correction (WO-F31V-A under RPV-F31-OBS-001-R1):

| Fact | Before | After |
|---|---|---|
| WorkOrder | OPEN | OPEN |
| Visit | DEPARTED | DEPARTED (unchanged id/status/timestamps) |
| PartUsage unit snapshot | R125.50 / each | R130.00 / each |
| Quantity | 2 | 2 (unchanged) |
| Parts subtotal | R251.00 | R260.00 |
| WorkOrder T&M total | R410.83 | R419.83 |
| Exact total increase | — | **R9.00** |
| Catalogue PartReference default | R150.00 / each | R150.00 / each (unchanged) |
| Operational PartUsage identity / description / reference | — | unchanged |
| WorkOrders A / B / C | OPEN | OPEN (none completed, cancelled, reassigned, or unassigned) |
| Engineer commercial boundary | denied | Engineer remained unable to see T&M monetary summary, historical charge values, unit-charge edit field, monetary override control, or Save override |

**RPV-F31-COMM-OVERRIDE-001 status: CLOSED.**  
The historical failure is retained in this record as **FAILED → CORRECTED → NARROWLY RE-VERIFIED → CLOSED**. It is not erased.

### Acceptance matrix

| # | Acceptance behaviour | Implementation | Automated | Independent RPV | Status |
|---|---|---|---|---|---|
| 1 | Venture labour hourly customer charge | commercial settings + catalogue UI | time-materials | RPV-F31-01-R1 | **VERIFIED** |
| 2 | PartReference default unit charge | catalogue + schema | catalogue + T&M | RPV-F31-01-R1 | **VERIFIED** |
| 3 | RefrigerantReference default charge/kg | catalogue + schema | catalogue + T&M | RPV-F31-01-R1 | **VERIFIED** |
| 4 | PartUsage unit-charge snapshot | service stamp on record | T&M | RPV-F31-01-R1 | **VERIFIED** |
| 5 | RefrigerantEvent charge/kg snapshot (added) | service stamp on record | T&M | RPV-F31-01-R1 | **VERIFIED** |
| 6 | Visit labour-rate snapshot on departure | service departure | T&M | RPV-F31-01-R1 | **VERIFIED** |
| 7 | Integer ZAR cents + deterministic calc | `time-materials.ts` | T&M helpers | RPV-F31-01-R1 | **VERIFIED** |
| 8 | Incomplete when pricing missing | completeness model | T&M | RPV-F31-01-R1 | **VERIFIED** |
| 9 | Complete + final total when all priced | completeness model | T&M | RPV-F31-01-R1 | **VERIFIED** |
| 10 | Known subtotal distinct from final total | summary contract | T&M | RPV-F31-01-R1 | **VERIFIED** |
| 11 | Added-only refrigerant charging; recovered R0 | calc rules | T&M | RPV-F31-01-R1 | **VERIFIED** |
| 12 | Historical default-change stability | snapshot immutability vs defaults | T&M | RPV-F31-01-R1 | **VERIFIED** |
| 13 | Unlisted commercial completion | `setPartUsageUnitCharge` / sibling setters | T&M | RPV-F31-01-R1 | **VERIFIED** |
| 14 | `venture.update` commercial authority | permission gates | T&M deny/allow | RPV-F31-01-R1 | **VERIFIED** |
| 15 | Engineer monetary visibility denial | no T&M section for members | T&M + workflow | RPV-F31-01-R1 | **VERIFIED** |
| 16 | Priced PartUsage snapshot override | T&M UI + service | T&M override tests | RPV-F31-OBS-001-R1 | **VERIFIED** (closed after OBS-001) |
| 17 | Priced RefrigerantEvent / Visit labour override | same UI/service pattern | T&M sibling override | Architecture + automated (full RPV covered override class via PartUsage closure) | **VERIFIED** |
| 18 | Cross-WorkOrder isolation | scoped projection | RPV | RPV-F31-01-R1 | **VERIFIED** |
| 19 | Evidence traceability | T&M lines → evidence ids | T&M + UI | RPV-F31-01-R1 | **VERIFIED** |
| 20 | WorkOrder remains OPEN after Visit departure | lifecycle unchanged | work-execution + RPV | RPV-F31-01-R1 | **VERIFIED** |
| 21 | Programme boundary negative space | exclusions + asserts | T&M boundary test | RPV-F31-01-R1 | **VERIFIED** |
| 22 | F3.0 operational regression integrity | catalogues + structured paths | catalogue + RPV | RPV-F31-01-R1 | **VERIFIED** |

---

## Residual risks / exclusions

- F3.2 and later Programme 2 milestones remain unauthorised.
- Disposable RPV environment credentials, tunnels, databases, screenshots, and local `*out*.txt` / cert logs are **excluded** from permanence.
- Working-tree CRLF noise on `packages/ids/tokens/generated/breakpoints.css` is **excluded**.
- Pre-existing unrelated dirty/local artefacts remain unstaged and uncleared.

No blocking residual risk remains within the authorised F3.1 + RPV-F31-01-R1 + RPV-F31-OBS-001-R1 scope after override closure.

---

## Certification INCLUDE path list (exact)

```
apps/web/package.json
apps/web/src/app/(app)/ventures/[ventureId]/catalogue/page.tsx
apps/web/src/app/(app)/ventures/[ventureId]/work/[workOrderId]/page.tsx
apps/web/src/core/venture-definition/README.md
apps/web/src/core/venture-definition/catalog.ts
apps/web/src/core/venture-definition/venture-definition.test.ts
apps/web/src/modules/frigora/actions.ts
apps/web/src/modules/frigora/app/catalogue-mutation-actions.ts
apps/web/src/modules/frigora/app/commercial-mutation-actions.ts
apps/web/src/modules/frigora/app/engineer-job-workflow.test.ts
apps/web/src/modules/frigora/app/field-visit-recorder.test.ts
apps/web/src/modules/frigora/app/office-work-spine.test.ts
apps/web/src/modules/frigora/app/operational-visibility.test.ts
apps/web/src/modules/frigora/app/screens/catalogue-screen.tsx
apps/web/src/modules/frigora/app/screens/time-materials-section.tsx
apps/web/src/modules/frigora/app/screens/work-screens.tsx
apps/web/src/modules/frigora/app/service-desk-dispatch.test.ts
apps/web/src/modules/frigora/app/views.ts
apps/web/src/modules/frigora/asset-history.test.ts
apps/web/src/modules/frigora/asset-operational-condition.test.ts
apps/web/src/modules/frigora/assignment.test.ts
apps/web/src/modules/frigora/catalogue.test.ts
apps/web/src/modules/frigora/corrective-action.test.ts
apps/web/src/modules/frigora/field-capture.test.ts
apps/web/src/modules/frigora/part-usage.test.ts
apps/web/src/modules/frigora/queries.ts
apps/web/src/modules/frigora/recommended-action.test.ts
apps/web/src/modules/frigora/refrigerant-event.test.ts
apps/web/src/modules/frigora/service.ts
apps/web/src/modules/frigora/store.ts
apps/web/src/modules/frigora/technical-finding.test.ts
apps/web/src/modules/frigora/time-materials.ts
apps/web/src/modules/frigora/time-materials.test.ts
apps/web/src/modules/frigora/types.ts
apps/web/src/modules/frigora/validation.ts
apps/web/src/modules/frigora/visit-customer-acknowledgement.test.ts
apps/web/src/modules/frigora/visit-evidence.test.ts
apps/web/src/modules/frigora/visit-outcome.test.ts
apps/web/src/modules/frigora/visit.test.ts
apps/web/src/modules/frigora/work-execution.test.ts
apps/web/src/modules/frigora/work-order.test.ts
apps/web/src/modules/ventures/launch/bootstrap.test.ts
apps/web/src/platform/persistence/db.ts
apps/web/src/platform/persistence/schema.ts
apps/web/src/platform/storage/stored-object.test.ts
docs/engineering/FRIGORA_F3_1_CERTIFICATION.md
docs/foundation-library/02-ARCHITECTURE/Venture-Definitions.md
docs/foundation-library/06-PRODUCTS/Frigora/README.md
docs/foundation-library/06-PRODUCTS/README.md
```

---

## Permanence method

Repository convention (F2.3 / Programme 1 / F3.0): the permanence commit that introduces this artefact **is** the certified Git checkpoint. The artefact records pre-certification HEAD and states that the commit containing this file is authoritative. No post-commit amend or circular hash embed is required.

Preferred commit message:

`cert(frigora): F3.1 time and materials costing`

---

## Certification declaration

Frigora milestone **F3.1 — Time & Materials Costing** is **IMPLEMENTED**, independently **VERIFIED** (RPV-F31-01-R1 + RPV-F31-OBS-001-R1 closure of RPV-F31-COMM-OVERRIDE-001), automated-gate **VERIFIED**, and hereby **CERTIFIED** at product **frigora@0.20.0** / **SCHEMA_GENERATION 26** on branch `feat/frigora-reconciliation`, advancing from F3.0 checkpoint `d6608cd241d6d4f2cca4a8004e49b21d4246f65f`.

**F3.2 is not authorised by this record.**
