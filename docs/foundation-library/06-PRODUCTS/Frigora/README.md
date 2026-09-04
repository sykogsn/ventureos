# Frigora

**Purpose.** Describe Frigora as a refrigeration venture on VentureOS.

**Authority.** Product page. Live definition: `frigora@0.16.0` in the Definition Registry. Certified product checkpoint: F2.0 Visit Evidence.

**Audience.** Product, design, and engineers working on Frigora instances.

**Dependencies.** [Products](../README.md) · [Venture Definitions](../../02-ARCHITECTURE/Venture-Definitions.md)

**Related Documents.** [Product Philosophy](../../01-FOUNDATION/Product-Philosophy.md) · [Situation Room](../../02-ARCHITECTURE/Situation-Room.md) · [IDS](../../03-DESIGN/IDS.md) · [Future products](../Future/README.md)

**Status.** Concept (definition); atmosphere not painted; operational product not built beyond Customer, Site, Asset, WorkOrder identity, current WorkOrder assignment, Visit attendance identity, Visit field capture, Visit technical findings, Visit corrective actions, Visit outcomes, Visit recommended actions, Visit refrigerant events, Visit part usages, Asset history projection, Asset operational condition assertions, Visit customer acknowledgements, and Visit evidence

**Version.** 0.16.0

**Owner.** Founder (definition owner)

**Last Updated.** 2026-09-04

---

Frigora is a VentureOS venture. This definition admits Customer, Site, Asset, WorkOrder identity, current WorkOrder assignment, Visit attendance identity, Visit field capture, Visit technical findings, Visit corrective actions, Visit outcomes, Visit recommended actions, Visit refrigerant events, Visit part usages, Asset history projection, Asset operational condition assertions, Visit customer acknowledgements, and Visit evidence as durable or derived operational views beside VIC. Asset history projection is a read-only, asset-rooted composition of certified operational truths — not a separate persisted store. Asset operational condition is a human-asserted, append-only fact about present operational capability and is not inferred from other Frigora truths. Visit customer acknowledgement is a human-recorded, text-only, visit-rooted fact that a named customer or site representative acknowledged information about a Visit; it is not Visit evidence, signature, satisfaction, commercial acceptance, or AssetHistory. Visit evidence (F2.0) is stored visit-attached photo/file evidence recorded against a Visit; it is not verification, compliance certification, commercial acceptance, customer signature, CSAM capability, offline field capability, or generic document management. It is not projected into AssetHistory. Work execution, dispatch, full diagnosis workflow, root cause, full repair workflow, parts catalogue, inventory, cylinder inventory, PPM, commercial operations, FACT → PATTERN → SIGNAL, employee agents, and field workflows are not part of this definition version.

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
- WorkOrder (identity only: reference, kind, reported condition, lifecycle state)
- Current WorkOrder assignment (workspace member responsibility only)
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

The following are not part of this definition version and must not be read as built:

- refrigeration systems, asset components
- work execution, dispatch, engineer field workflows
- full diagnosis workflow, root cause, repairs
- parts catalogue, SKU registry, inventory, stock balances, warehouse, van stock
- cylinder inventory, stock ledger, refrigerant catalogue
- purchasing, suppliers, purchase orders, pricing, unit costing, invoice lines
- PPM requirements, obligations, planned visits, work execution
- commercial operations
- generic document management, evidence packages as a document store, operational memory
- FACT → PATTERN → SIGNAL
- employee agents, workforce bindings, executors, verifiers
- REST APIs, external integrations
- Lovable L0.1–L0.9 screen implementation
