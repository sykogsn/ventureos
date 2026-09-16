# Frigora

**Purpose.** Describe Frigora as a refrigeration venture on VentureOS.

**Authority.** Product page. Live definition: `frigora@0.21.0` in the Definition Registry. Programme 1 certification checkpoint: `6e66e9d8c782e1efc4fe685a5f71f45dc6192fd3` ([Programme 1 certification](../../../engineering/FRIGORA_PROGRAMME_1_CERTIFICATION.md)). F2.3 checkpoint: `9d2c15788f8177562bc9abb4dd2426a11979ef8d` ([F2.3 certification](../../../engineering/FRIGORA_F2_3_CERTIFICATION.md)). F3.1 certified history remains `frigora@0.20.0` ([F3.1 certification](../../../engineering/FRIGORA_F3_1_CERTIFICATION.md)).

**Audience.** Product, design, and engineers working on Frigora instances.

**Dependencies.** [Products](../README.md) · [Venture Definitions](../../02-ARCHITECTURE/Venture-Definitions.md)

**Related Documents.** [Product Philosophy](../../01-FOUNDATION/Product-Philosophy.md) · [Situation Room](../../02-ARCHITECTURE/Situation-Room.md) · [IDS](../../03-DESIGN/IDS.md) · [Future products](../Future/README.md) · [Programme 1](./Programme-1.md) · [Founder Decisions](../../05-GOVERNANCE/Founder-Decisions.md) (FD-007–FD-010) · [Programme 1 certification candidate](../../../engineering/FRIGORA_PROGRAMME_1_CERTIFICATION.md)

**Status.** Concept (definition); atmosphere not painted. F2.0 Visit Evidence remains certified history. Programme 1 (F2.1–F2.3) remains certified at checkpoint `6e66e9d8c782e1efc4fe685a5f71f45dc6192fd3` on the `frigora@0.18.0` baseline. F3.1 remains certified at `frigora@0.20.0`. Live definition is `frigora@0.21.0`, which admits F3.0 structured parts and refrigerant catalogues, F3.1 Time & Materials customer charge (ZAR cents snapshots), and F3.2 Mobile / PWA Delivery (installable online Frigora product identity) without inventory, procurement, invoice, quote, VAT, payroll, or F3.3 offline mutation/sync.

**Version.** 0.21.0

**Owner.** Founder (definition owner)

**Last Updated.** 2026-09-15

---

Frigora is a VentureOS venture. This definition admits Customer, Site, Asset, WorkOrder identity and F2.1 execution, current WorkOrder assignment, Visit attendance identity, Visit field capture, Visit technical findings, Visit corrective actions, Visit outcomes, Visit recommended actions, Visit refrigerant events, Visit part usages, Asset history projection, Asset operational condition assertions, Visit customer acknowledgements, Visit evidence, F2.2 Service Desk & Dispatch, F2.3 Engineer Job Workflow, F3.0 structured parts and refrigerant catalogues, F3.1 Time & Materials customer charge (ZAR cents snapshots on labour, parts, and added refrigerant), and F3.2 Mobile / PWA Delivery as durable or derived operational views beside VIC. Asset history projection is a read-only, asset-rooted composition of certified operational truths — not a separate persisted store. Asset operational condition is a human-asserted, append-only fact about present operational capability and is not inferred from other Frigora truths. Visit customer acknowledgement is a human-recorded, text-only, visit-rooted fact that a named customer or site representative acknowledged information about a Visit; it is not Visit evidence, signature, satisfaction, commercial acceptance, or AssetHistory. Visit evidence (F2.0) is stored visit-attached photo/file evidence recorded against a Visit; it is not verification, compliance certification, commercial acceptance, customer signature, CSAM capability, offline field mutation capability, or generic document management. It is not projected into AssetHistory. F2.1 Work Execution governs WorkOrder completion, cancellation, reopen, and explicit Recommended Action conversion to follow-up work without conflating Visit departure with WorkOrder completion. F2.2 admits persisted service windows, coordination through the existing assignment model, exact-assignee acceptance or decline, derived dispatch readiness and attention, and the Service Desk/day board. It does not create a second lifecycle, automatic Visit creation, assignee/attendee binding, or operational priority vocabulary. F2.3 admits the engineer job workflow on certified My Work / Visit Recorder foundations, current-assignee operational authority, Visit attendance integrity, Visit Evidence capture under assignment, protected evidence read policy, and stale-assignee revocation after reassignment. F3.0 admits venture-scoped PartReference and RefrigerantReference catalogues with optional nullable links from PartUsage and RefrigerantEvent while retaining historical free-text snapshots; unlisted recording remains required; Asset.refrigerantType remains free text. F3.1 admits Owner-configured venture labour hourly charge, catalogue default unit/R-per-kg charges, historical commercial snapshots, office completion of unpriced chargeable lines, and derived WorkOrder T&M completeness; recovered/removed refrigerant contributes R0.00 and does not block completeness. F3.2 admits installable online Frigora PWA and mobile field packaging with Frigora customer-facing product identity and online-only connectivity messaging. Full diagnosis workflow, root cause, full repair workflow, inventory, stock, warehouse, van stock, cylinder inventory, SKU master-data beyond PartReference, purchasing, procurement, invoice, quote, VAT, payroll, margin, PPM, FACT → PATTERN → SIGNAL, employee agents, offline mutation queue / business-data sync / conflict resolution / durable offline business cache (F3.3), customer signature, and CSAM are not part of this definition version.

## Profile

- Purpose: refrigeration operations for companies that run on VentureOS.
- Lifecycle: concept. Maturity: experimental.
- Orchestrator: Executive Intelligence Runtime.
- Features: situation-room, company-hq, executive-office, founder-decisions, morning-briefing, portfolio.
- Adds `intelligence.briefing` to the shared capability pack.
- Excludes nothing.

## Operational foundation

Admitted in this version, persisted beside VIC for Frigora instances:

- Customer
- Site
- Asset
- WorkOrder (identity, reference, kind, reported condition, and `open` / `closed` / `cancelled` lifecycle)
- F2.1 Work Execution (governed completion, reasoned cancellation, reopen, and explicit recommendation-to-follow-up conversion)
- Current WorkOrder assignment (workspace member responsibility only)
- F2.2 Service Desk & Dispatch (persisted UTC service windows, existing assignment coordination, exact-assignee response, derived board/attention state, and repository-backed controls; no persisted dispatch lifecycle)
- F2.3 Engineer Job Workflow (My Work → assigned job → Visit arrive/depart → certified operational facts and F2.0 evidence under current-assignee authority; protected evidence reads; reassignment revokes former assignee mutations while preserving historical attendance)
- F3.0 structured parts and refrigerant catalogues (venture-scoped PartReference / RefrigerantReference; optional nullable links on PartUsage / RefrigerantEvent; historical snapshots retained; unlisted recording required; catalogue admin requires venture.update; no inventory)
- F3.1 Time & Materials customer charge (ZAR cents snapshots for labour, parts, and added refrigerant; Owner commercial authority; incomplete when chargeable facts lack rates; WorkOrder stays operationally open independently of T&M completeness; no inventory, procurement, invoice, quote, VAT, or payroll)
- Visit (attendance identity: who attended, arrival, departure, minimal lifecycle)
- Visit field capture (raw measurement and condition facts recorded against a Visit)
- Visit technical findings (human-recorded symptom, suspected fault, and confirmed fault assertions against a Visit)
- Visit corrective actions (human-recorded work actually performed during a Visit attendance episode)
- Visit outcomes (human-recorded resulting operational state at the end of a Visit attendance episode)
- Visit recommended actions (human-recorded forward operational intent associated with a Visit attendance episode; advisory only, not execution)
- Visit refrigerant events (human-recorded refrigerant handling that actually occurred during a Visit attendance episode; append-only facts, not leak inference)
- Visit part usages (human-recorded part or material that was actually used during a Visit attendance episode; append-only facts, not inventory)
- Asset operational condition assertions (human-asserted present ability of an Asset to perform its intended function; append-only; current condition is derived)
- Visit customer acknowledgements (human-recorded text-only acknowledgement by a named customer or site representative about a Visit; append-only; not Visit evidence or commercial acceptance)
- Visit evidence (F2.0) (stored visit-attached photo/file evidence recorded against a Visit; append-only until removed; not verification, compliance certification, commercial acceptance, customer signature, CSAM, offline field capability, or generic document management)

Derived read model (not persisted):

- Asset history projection (chronological, asset-rooted composition of certified asset-related truths above; read-only; provenance-preserving; does not include Visit customer acknowledgement because that fact has no asset root; does not include Visit evidence)

RefrigerationSystem and Component remain deferred. Assets may exist at a site without a system grouping.

## Identity

IDS key: `frigora`. Brand and atmosphere selectors exist so the instance is recognised. Visual values inherit the VentureOS overlay until a dedicated visual programme. Do not treat this page as permission to paint a refrigeration headquarters.

## Honesty

Frigora receives the full executive desk. Theme must not invent a private Runtime or a private navigation model. The VentureOS Situation Room remains the founder/executive brief. Frigora operational presentation must not replace `/dashboard`.

## Active Programme 1

Founder Decision [FD-007](../../05-GOVERNANCE/Founder-Decisions.md) locks [Programme 1 — Reactive Service Operations](./Programme-1.md). Founder Decision [FD-008](../../05-GOVERNANCE/Founder-Decisions.md) scope-locked F2.1. Founder Decision [FD-009](../../05-GOVERNANCE/Founder-Decisions.md) admits certified F2.1. Founder Decision [FD-010](../../05-GOVERNANCE/Founder-Decisions.md) admits certified F2.2 checkpoint `bee64990c10a28cc5df4c9b88c99c636cd37c38b` into the live `frigora@0.19.0` baseline. F2.3 is certified at `9d2c15788f8177562bc9abb4dd2426a11979ef8d` and admitted into the same `frigora@0.19.0` baseline by this Programme 1 gate product-law reconciliation (Control: no version bump). Programme 1 milestones are complete; Programme 1 is READY FOR CONTROL CERTIFICATION PERMANENCE.

| Milestone                      | Product purpose                                             | Status                                                                  |
| ------------------------------ | ----------------------------------------------------------- | ----------------------------------------------------------------------- |
| F2.0 Visit Evidence            | Stored visit-attached photo/file evidence                   | Certified history                                                       |
| F2.1 Work Execution            | Governed WorkOrder completion distinct from Visit departure | CERTIFIED / admitted at `3d27699de63923c1cfc5a08bddab8ea8b356c422`     |
| F2.2 Service Desk & Dispatch   | Scheduling, assignment, acceptance, day board               | CERTIFIED / admitted at `bee64990c10a28cc5df4c9b88c99c636cd37c38b`     |
| F2.3 Engineer Job Workflow     | End-to-end engineer job card on certified truths            | CERTIFIED / admitted at `9d2c15788f8177562bc9abb4dd2426a11979ef8d`     |
| Programme 1 Certification Gate | End-to-end reactive-service programme certification         | READY FOR CONTROL CERTIFICATION PERMANENCE                              |

Do not add F2.4. Capabilities after F2.3 are provisional and unnumbered. See the Programme 1 document for boundaries, exclusions, the certification gate, and architectural guardrails.

## Truth chain (operational)

At visit-episode maturity, authoritative records separate:

1. **Reported intake** — `WorkOrder.reportedCondition`
2. **Observed/measured fact** — Visit field capture
3. **Human technical interpretation** — Visit technical finding
4. **Work actually performed** — Visit corrective action
5. **Part or material actually used** — Visit part usage
6. **Refrigerant handling actually occurred** — Visit refrigerant event
7. **Resulting operational state** — Visit outcome
8. **Forward operational intent** — Visit recommended action
9. **Asserted asset operational condition** — Asset operational condition (asset-rooted; not inferred)
10. **Customer/site acknowledgement** — Visit customer acknowledgement (visit-rooted text fact; not AssetHistory)
11. **Stored visit-attached photo/file evidence** — Visit evidence (F2.0) (not verification of the records above; not AssetHistory)

Asset history projection surfaces asset-rooted certified facts as typed, chronological entries without collapsing truth layers or inventing inference. Visit customer acknowledgement and Visit evidence are not projected into AssetHistory.

**Asset.status** remains identity/lifecycle (`active` / `decommissioned`) and is not operational condition.

**Refrigerant semantic law:** refrigerant added ≠ refrigerant leaked. A refrigerant event records handling (for example 2 kg R404A added). It does not infer leak quantity, leak rate, or refrigerant loss.

Corrective action, part usage, refrigerant event, visit outcome, recommended action, asset operational condition, and visit customer acknowledgement answer independent questions. None is inferred from the others.

## Deferred

The following are not part of this definition version (`frigora@0.21.0`) and must not be read as built. F2.1, F2.2, F2.3, F3.0 catalogues, F3.1 Time & Materials customer charge, and F3.2 Mobile / PWA Delivery are admitted. Inventory, procurement, invoice, quote, VAT, payroll, and F3.3 offline mutation/sync capabilities remain excluded.

- refrigeration systems, asset components
- engineer field workflows beyond certified F2.3 / F3.2 packaging (customer signature, CSAM)
- full diagnosis workflow, root cause, repairs
- SKU registry beyond F3.0 PartReference, inventory, stock balances, warehouse, van stock
- cylinder inventory, stock ledger (cylinderReference free text on events remains)
- purchasing, suppliers, purchase orders, procurement, invoice lines, quotations, VAT, payroll
- PPM requirements, obligations, planned visits
- generic document management, evidence packages as a document store, operational memory
- FACT → PATTERN → SIGNAL
- employee agents, workforce bindings, executors, verifiers
- REST APIs, external integrations
- Lovable L0.1–L0.9 screen implementation
- F3.3 offline mutation queue, business-data synchronisation, conflict resolution, durable offline business cache, customer signature
