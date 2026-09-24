# Frigora F3.0 Certification — Structured Parts & Refrigerant Catalogues

**Document type.** Permanent venture-milestone certification record  
**Venture.** Frigora  
**Milestone.** F3.0 — Structured Parts & Refrigerant Catalogues  
**Control decision.** CERTIFIED  
**Certification date.** 2026-09-10  
**Approved by.** Frigora Verification & Certification Control  
**Independent RPV.** RPV-F30-01-R3 — **PASSED** (20/20 authorised checks)

This record certifies the Frigora F3.0 Structured Parts & Refrigerant Catalogues product layer. It does **not** rewrite Foundation Certification Index law. It does **not** certify F3.1 or any later Programme 2 milestone. Layer-specific certification remains the law: this certificate does not stand for Runtime, IDS, Capability Registry, or Definition Registry certification.

**Engineering standard.** [Master Engineering Prompt](./MASTER_ENGINEERING_PROMPT.md). Index: [Engineering Index](./README.md).

**Language.**

| Term | Meaning in this record |
|---|---|
| **IMPLEMENTED** | Capability exists in the certified repository tree |
| **VERIFIED** | Capability demonstrated by automated tests and/or Independent Running-Product Verification |
| **CERTIFIED** | Control accepts the IMPLEMENTED + VERIFIED evidence set as the permanent F3.0 checkpoint |

---

## Checkpoint identity

| Field | Value |
|---|---|
| Branch | `feat/frigora-reconciliation` |
| Pre-certification HEAD (Programme 1 certified checkpoint) | `6e66e9d8c782e1efc4fe685a5f71f45dc6192fd3` |
| Product | **frigora@0.19.0** |
| SCHEMA_GENERATION | **25** (justified: PartReference / RefrigerantReference tables + nullable FK columns on PartUsage / RefrigerantEvent) |
| F3.1 | **NOT AUTHORISED / NOT CERTIFIED** |
| Certified Git checkpoint | The permanence commit that contains this artefact (authoritative identity = that commit hash) |

---

## Implementation scope (IMPLEMENTED)

Venture-scoped structured catalogues for operational recording:

- `FrigoraPartReference` and `FrigoraRefrigerantReference` with `active` \| `retired`
- Owner/admin create, update, and retire under `venture.update`
- Engineer denial of catalogue administration; operational read of **active** references only
- Structured and unlisted/free-text `PartUsage` and `RefrigerantEvent` paths
- Nullable `partReferenceId` / `refrigerantReferenceId` with required text snapshots (`partDescription`, `refrigerantType`)
- Retired references excluded from new structured selections; historical snapshots preserved
- Asset `refrigerantType` remains free text; no mandatory Asset → RefrigerantReference relationship
- Catalogue administration surface at `/ventures/[ventureId]/catalogue`
- Visit Recorder selectors with Other/Unlisted free-text compatibility
- Navigation exposure of Catalogue (shared venture nav)

### Explicit Programme boundary / exclusions

F3.0 does **not** include (and this certification does **not** admit):

- time/material costing
- inventory / stock quantities
- van / warehouse stock
- procurement / supplier purchasing
- cylinder custody workflow (optional free-text `cylinderReference` on events remains Programme 1 fact capture only)
- quotations / customer approvals
- offline / PWA delivery
- employee agents
- F3.1 or later Programme 2 work

Negative-space automated assertions continue to reject inventory/costing/stock fields on usage/event records.

---

## Automated validation evidence (VERIFIED)

| Gate | Command | Result |
|---|---|---|
| Targeted F3.0 catalogue | `pnpm exec tsx --test src/modules/frigora/catalogue.test.ts` (apps/web) | **12 / 12 PASS**, EXIT **0** |
| Affected domain | part-usage, refrigerant-event, asset-history, engineer-job-workflow, work-execution | **98 / 98 PASS**, EXIT **0** |
| Full Frigora suite | `pnpm exec tsx --test src/modules/frigora/**/*.test.ts` | **379 / 379 PASS**, EXIT **0** |
| Persistence / auth / definitions | repository, stored-object, auth suite, venture-definition, bootstrap | **98 / 98 PASS**, EXIT **0** |
| Full web suite | `pnpm test` (apps/web) | **831 / 831 PASS**, EXIT **0** |
| Workspace tests | `pnpm test` (repo root) | **831 / 831 PASS** (web), Tasks **3/3**, EXIT **0** |
| Typecheck | `pnpm check-types` (apps/web) | EXIT **0** |
| Lint | `pnpm lint` (apps/web) | EXIT **0** |
| Production build | `pnpm build` (apps/web) | EXIT **0** (route `/ventures/[ventureId]/catalogue` present) |

Fail / cancelled / skipped / todo across recorded gates: **0 / 0 / 0 / 0**.

---

## Independent RPV correlation (VERIFIED)

Independent Work packet **RPV-F30-01-R3** — Control FINAL VERDICT: **A. F3.0 INDEPENDENT RUNNING-PRODUCT VERIFICATION PASSED**.

| # | Acceptance behaviour | Implementation | Automated | RPV-F30-01-R3 | Status |
|---|---|---|---|---|---|
| 1 | Owner PartReference create | types/service/actions/catalogue UI | catalogue.test | Owner create | **VERIFIED** |
| 2 | Owner PartReference update | service/actions/catalogue UI | catalogue.test | Owner update | **VERIFIED** |
| 3 | Owner RefrigerantReference create | types/service/actions/catalogue UI | catalogue.test | Owner create | **VERIFIED** |
| 4 | Owner RefrigerantReference update | service/actions/catalogue UI | catalogue.test | Owner update | **VERIFIED** |
| 5 | Engineer catalogue-administration denial | `venture.update` gate | catalogue.test | Engineer denial | **VERIFIED** |
| 6 | Engineer operational catalogue reference access | active-list queries / Visit Recorder | catalogue.test | Engineer operational access | **VERIFIED** |
| 7 | Structured PartUsage | partReferenceId + snapshot | catalogue + part-usage | Structured usage | **VERIFIED** |
| 8 | Unlisted/free-text PartUsage | null reference + free text | catalogue + part-usage | Unlisted usage | **VERIFIED** |
| 9 | Structured RefrigerantEvent | refrigerantReferenceId + snapshot | catalogue + refrigerant-event | Structured event | **VERIFIED** |
| 10 | Unlisted/free-text RefrigerantEvent | null reference + free text | catalogue + refrigerant-event | Unlisted event | **VERIFIED** |
| 11 | PartReference retirement | status → retired | catalogue.test | Retirement | **VERIFIED** |
| 12 | RefrigerantReference retirement | status → retired | catalogue.test | Retirement | **VERIFIED** |
| 13 | Retired refs excluded from new structured selections | active-only filters | catalogue.test | Selection filter | **VERIFIED** |
| 14 | PartUsage historical snapshot preservation | immutable snapshot columns | catalogue.test | Snapshot retain | **VERIFIED** |
| 15 | RefrigerantEvent historical snapshot preservation | immutable snapshot columns | catalogue.test | Snapshot retain | **VERIFIED** |
| 16 | Free-text historical compatibility | NULL-reference readable rows | catalogue.test | Historical free-text | **VERIFIED** |
| 17 | Asset.refrigerantType remains free text | Asset model unchanged | catalogue / asset tests | Asset free text | **VERIFIED** |
| 18 | No mandatory Asset → RefrigerantReference | no FK / required relation | schema + tests + RPV | Negative space | **VERIFIED** |
| 19 | F3.0 Programme boundary preservation | exclusions + negative asserts | catalogue boundary tests | Boundary | **VERIFIED** |
| 20 | Visit departure leaves WorkOrder OPEN | Visit/WO lifecycle | engineer/work-execution + RPV | Visit DEPARTED; WO-F30V-1 OPEN | **VERIFIED** |

Final RPV operational state recorded by Control: Visit **DEPARTED**; WorkOrder **WO-F30V-1 = OPEN**. Blocked checks: **NONE**. Blocking product defects: **NONE**.

Independent verification is claimed **only** for the twenty authorised RPV behaviours above.

---

## Authority / permissions evidence

- Catalogue administration mutations require `venture.update` (Owner/Dispatch class).
- Engineers without `venture.update` cannot create/update/retire references (automated + RPV).
- Engineers with operational field authority can read **active** references for structured recording (automated + RPV).

---

## Structured / unlisted compatibility

- Structured path: select active catalogue reference; snapshot text stored on the usage/event.
- Unlisted path: Other/Unlisted free-text required when no reference id; historical NULL-reference rows remain readable.
- Both paths coexist without migrating Programme 1 free-text facts.

---

## Retirement / filtering / historical snapshots

- Retirement sets status `retired`; retired identities remain historically addressable via stored snapshots.
- New structured selectors enumerate **active** only.
- Rename/retire after recording does not rewrite historical `partDescription` / `refrigerantType` snapshots.

---

## Asset free-text negative space

- `Asset.refrigerantType` remains free-text operational fact.
- No mandatory Asset → RefrigerantReference relationship is introduced by F3.0.

---

## Visit / WorkOrder lifecycle evidence

Visit departure continues to leave WorkOrder **OPEN** until explicit office completion (preserved Programme 1 / F2.x behaviour; confirmed under RPV-F30-01-R3).

---

## Known non-blocking observations

| ID | Classification | Summary |
|---|---|---|
| F3.0-RPV-OBS-001 | **Accepted current presentation behaviour** (future UX refinement/debt allowed) | Engineer navigation displayed a Catalogue link, but no catalogue administration surface or mutation controls were available (authority-correct). **No UI change in this certification packet.** |
| F3.0-RPV-OBS-002 | Non-blocking presentation note | Other / Unlisted free-text fields appeared and functioned normally when selected after structured submissions. |

Neither observation blocked F3.0 verification or certification.

---

## Residual risks / exclusions

- F3.1 and later Programme 2 milestones remain unauthorised.
- Disposable RPV environment credentials, tunnels, databases, screenshots, and local `*out*.txt` / cert logs are **excluded** from permanence.
- Working-tree CRLF noise on `packages/ids/tokens/generated/breakpoints.css` is **excluded**.
- Pre-existing unrelated dirty/local artefacts remain unstaged and uncleared.

No blocking residual risk was identified within the authorised F3.0 + RPV-F30-01-R3 scope.

---

## Certification INCLUDE path list (exact)

```
apps/web/package.json
apps/web/src/app/(app)/ventures/[ventureId]/catalogue/page.tsx
apps/web/src/core/venture-definition/README.md
apps/web/src/core/venture-definition/catalog.ts
apps/web/src/core/venture-definition/venture-definition.test.ts
apps/web/src/modules/frigora/actions.ts
apps/web/src/modules/frigora/app/catalogue-mutation-actions.ts
apps/web/src/modules/frigora/app/engineer-job-workflow.test.ts
apps/web/src/modules/frigora/app/field-mutation-actions.ts
apps/web/src/modules/frigora/app/field-visit-recorder.test.ts
apps/web/src/modules/frigora/app/forms/record-part-usage-form.tsx
apps/web/src/modules/frigora/app/forms/record-refrigerant-event-form.tsx
apps/web/src/modules/frigora/app/nav.ts
apps/web/src/modules/frigora/app/office-work-spine.test.ts
apps/web/src/modules/frigora/app/operational-visibility.test.ts
apps/web/src/modules/frigora/app/screens/catalogue-screen.tsx
apps/web/src/modules/frigora/app/screens/visit-recorder-screen.tsx
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
docs/engineering/FRIGORA_F3_0_CERTIFICATION.md
docs/foundation-library/02-ARCHITECTURE/Venture-Definitions.md
docs/foundation-library/06-PRODUCTS/Frigora/README.md
docs/foundation-library/06-PRODUCTS/README.md
```

---

## Permanence method

Repository convention (F2.3 / Programme 1): the permanence commit that introduces this artefact **is** the certified Git checkpoint. The artefact records pre-certification HEAD and states that the commit containing this file is authoritative. No post-commit amend or circular hash embed is required.

---

## Certification declaration

Frigora milestone **F3.0 — Structured Parts & Refrigerant Catalogues** is **IMPLEMENTED**, independently **VERIFIED** (RPV-F30-01-R3), automated-gate **VERIFIED**, and hereby **CERTIFIED** at product **frigora@0.19.0** / **SCHEMA_GENERATION 25** on branch `feat/frigora-reconciliation`, advancing from Programme 1 checkpoint `6e66e9d8c782e1efc4fe685a5f71f45dc6192fd3`.

**F3.1 is not authorised by this record.**
