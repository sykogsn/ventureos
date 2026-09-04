# Frigora Programme 1 — Reactive Service Operations

**Purpose.** Record the founder-locked first post-F2.0 Frigora development programme: sequential increments F2.1, F2.2, and F2.3.

**Authority.** Founder product lock. Founder Decisions [FD-007](../../05-GOVERNANCE/Founder-Decisions.md) (programme) and [FD-008](../../05-GOVERNANCE/Founder-Decisions.md) (F2.1 scope). This document does not change the live Venture Definition. It does not certify implementation.

**Audience.** Product and engineers authorised to implement Programme 1.

**Dependencies.** [Frigora product page](./README.md) · [Founder Decisions](../../05-GOVERNANCE/Founder-Decisions.md)

**Related Documents.** [Products](../README.md) · [Venture Definitions](../../02-ARCHITECTURE/Venture-Definitions.md) · [Master Engineering Prompt](../../../engineering/MASTER_ENGINEERING_PROMPT.md)

**Status.** Authorised roadmap lock. F2.1 is **scope-locked for implementation** (FD-008) and **not implemented**. F2.2 and F2.3 remain authorised only, not opened. Live definition remains `frigora@0.16.0` (certified checkpoint F2.0 Visit Evidence).

**Version.** 1.1.0

**Owner.** Founder

**Last Updated.** 2026-09-04

---

## Live product law (unchanged by this lock)

| Field | Value |
|---|---|
| Live definition | `frigora@0.16.0` |
| Certified product checkpoint | F2.0 — Visit Evidence · `6a188eb624c3327ec9bd4bd319d6d6b54ad23232` |
| Product-record reconciliation | `573ab5d4f79bbfa239105bc0944c909e98c0c617` |
| Programme 1 roadmap lock | `7aa46b5e200e9d03b224ca9a0eb7daf0491083a4` |

F2.1, F2.2, and F2.3 are **authorised roadmap milestones**. They are not admitted in the live definition until each increment is implemented, tested, certified, documented, checkpointed, and the definition is legitimately bumped.

Do not treat this lock as permission to change `catalog.ts` before that work. FD-008 authorises the F2.1 implementation **boundary**; it does not certify F2.1 and does not bump `frigora@0.16.0`.

## Programme purpose

Programme 1 must move Frigora from a certified collection of operational facts into the smallest genuinely usable end-to-end refrigeration **reactive-service** operating workflow.

A refrigeration service company must be able to progress operational work through:

customer/site/asset → work order → governed work execution → scheduling / dispatch → engineer acceptance → site attendance → existing certified visit facts → findings / corrective actions → parts / refrigerant → evidence → outcome → governed completion

Frigora remains a VentureOS-built Venture. This programme must not create a second application, runtime, or generic field-service platform.

## Locked sequence

```
F2.0 Visit Evidence (certified, live)
  → F2.1 Work Execution
    → F2.2 Service Desk & Dispatch
      → F2.3 Engineer Job Workflow
        → Programme 1 certification gate
```

Exactly three sequential product increments. **Do not add F2.4.** Do not assign F-numbers to later capabilities.

F2.2 begins only after F2.1 is implemented and certified. F2.3 begins only after F2.2 is implemented and certified.

## Programme 1 completion gate

Programme 1 is complete only when F2.1, F2.2, and F2.3 have each been implemented, tested, certified, documented, checkpointed, and reconciled with the live Frigora definition.

At that gate, a refrigeration service company can receive work, schedule and dispatch it, send an engineer, execute the visit using the existing certified refrigeration truths, capture evidence, record the result, and properly complete the job.

## F2.1 — Work Execution

**Status.** Authorised. **Scope-locked for implementation (FD-008).** Not implemented. Not certified. Does not open F2.2 or F2.3.

**Product purpose.** Create a governed WorkOrder execution/completion lifecycle on top of the existing certified WorkOrder, Visit, and operational truth model.

Frigora must distinguish clearly between:

- engineer attendance
- visit departure
- work performed
- work remaining
- follow-up required
- WorkOrder completion
- WorkOrder cancellation

A Visit ending must **not** automatically mean the WorkOrder is complete. WorkOrder completion must become an operationally meaningful state rather than an identity-level close action.

### Completion state

WorkOrder status `closed` remains the F2.1 completed state. F2.1 changes the **governance and meaning** of `closed`. It does not replace the existing status vocabulary.

Do **not** introduce `completed`, `completedAt`, a second completion status, or a generic state-machine platform.

### Completion invariants

An open WorkOrder may be explicitly completed only when:

1. at least one Visit exists;
2. no Visit for that WorkOrder is currently `open`;
3. at least one Visit has status `departed`;
4. at least one departed Visit has a Visit Outcome;
5. an authorised human explicitly invokes WorkOrder completion.

Visit departure **must not** automatically complete the WorkOrder.

The following **must not** be mandatory for completion: Visit Evidence, customer acknowledgement, corrective action, part usage, refrigerant event, asset operational condition, absence of recommended actions.

Do **not** infer repair success, cooling restored, root cause, leak resolution, customer acceptance, compliance, or commercial acceptance. Visit Outcome remains free-text certified truth. Do **not** introduce outcome kinds or statuses in F2.1.

### Delayed fact entry

Preserve the certified ability to record permitted factual records against a **departed** Visit after its parent WorkOrder has been completed. Completion does **not** freeze historical Visit truth. Existing per-fact lifecycle restrictions remain authoritative. Do **not** broaden Visit Evidence beyond certified F2.0 lifecycle merely to support delayed entry.

### Cancellation

Cancellation requires WorkOrder status `open`, a non-empty trimmed free-text `cancellationReason`, and no currently open Visit. Cancellation does **not** require a Visit. The reason must be persisted. Do **not** introduce a cancellation taxonomy. Cancelled WorkOrders remain non-reopenable. Existing Visits and factual records remain preserved.

F1.1's office mutation restriction that prevents WorkOrder cancellation from the office WorkOrder experience is **lifted for F2.1**. Do **not** add cancellation to the engineer Visit Recorder in F2.1.

### Recommendation → follow-up

A Visit Recommended Action remains **advisory**. It must not itself become executable work.

An explicit authorised human action may convert a recommendation to a follow-up WorkOrder. Provenance: nullable `sourceRecommendedActionId` on the resulting WorkOrder. One recommendation may create at most one follow-up WorkOrder. Conversion must not mutate or delete the source recommendation.

The follow-up WorkOrder uses the same customer/site; primary asset from the recommendation asset where present, otherwise the source WorkOrder primary asset; `workKind` is `reactive`; `reportedCondition` derives from the recommendation description; starts **unassigned**. Conversion does **not** dispatch, schedule, create PPM, or infer diagnosis.

### Reopen

Preserve `closed → open` to correct a mistaken completion. Cancelled WorkOrders remain non-reopenable. After reopen, F2.1 completion invariants apply again before completion.

### Domain contract

Preserve statuses `open` | `closed` | `cancelled`. Add only:

- `cancellationReason: string | null`
- `sourceRecommendedActionId: FrigoraRecommendedActionId | null`

Service: governed `closeWorkOrder`; governed `cancelWorkOrder` with reason; explicit `convertRecommendedActionToFollowUpWorkOrder`.

Do **not** add: `workRemaining` / `followUpRequired` booleans; completion status duplication; dispatch state; scheduling; engineer acceptance; SLA; PPM; inventory; costing; signatures; offline; AI.

Derive operational meaning from existing certified truths wherever safe.

### Persistence intent (not applied by this lock)

Implementation should bump `SCHEMA_GENERATION` 22 → 23 using existing `ensureSchema` / `addColumn` conventions (same pattern as `assigned_user_id` on `frigora_work_orders`):

- `cancellation_reason TEXT`
- `source_recommended_action_id TEXT`
- uniqueness for non-null recommendation provenance (SQLite unique index; multiple nulls remain allowed)

This scope lock does **not** apply that schema change.

### Minimum UI intent

Limited to the existing office WorkOrder experience: present `closed` as completed work; explicit Complete Work Order with honest gate errors; Cancel with required reason and displayed persisted reason; Recommended Actions with Convert to Follow-up and link to the resulting WorkOrder; preserve Reopen.

Do **not** build a dispatch board, schedule controls, accept/decline, route planning, engineer job-card redesign, PWA, or offline. F2.3 owns the broader engineer job workflow. Do **not** add complete/cancel to the Visit Recorder in F2.1.

### Permissions

Preserve `venture.update` for F2.1 writes and `venture.read` for reads unless implementation evidence proves a necessary minimum change. Do **not** create engineer-acceptance permissions or a Frigora-specific parallel identity architecture.

### Test contract

Implementation must prove at minimum:

**Completion.** Cannot complete with no Visit; while any Visit is open; with cancelled Visits only; with departed Visit but no outcome. Can complete with at least one departed Visit carrying an outcome and no open Visits. Departure does not auto-complete. Evidence, acknowledgement, and corrective action are not required. Recommended action does not block completion. Explicit human completion remains required. Stored status remains `closed`. No `completed` / `completedAt`.

**Cancellation.** Reason required; whitespace-only rejected; no Visit required; rejected while a Visit is open; allowed once no Visit is open; reason persisted; cancelled cannot reopen; historical Visits/facts preserved.

**Follow-up.** Recommendation remains advisory; explicit conversion creates follow-up WorkOrder; provenance persisted; source recommendation unchanged; resulting work is reactive; customer/site preserved; asset inheritance correct; recommendation description becomes reported condition; follow-up starts unassigned; second conversion of the same recommendation rejected; no dispatch/schedule/PPM side effects.

**Regression.** Preserve certified Visit/fact truth semantics unless directly changed by the authorised F2.1 completion gate.

### Must not introduce

- dispatch scheduling, dispatch status, engineer acceptance, routing, SLA engine
- PPM, parts catalogue, inventory, cylinder inventory
- quotations, invoicing, signatures, offline capability, AI agents
- diagnosis inference, commercial acceptance, compliance certification

## F2.2 — Service Desk & Dispatch

**Status.** Authorised. Not implemented. Depends on certified F2.1.

**Product purpose.** Turn the existing assignment and operational visibility foundations into a genuine service-desk dispatch workflow.

**Should establish**

- scheduling of operational work
- scheduled date/time or service window
- operational priority where justified
- engineer assignment using the existing workspace/member model
- engineer acceptance/decline where appropriate
- service-desk visibility of unassigned work, scheduled work, accepted work, active visits, completed work, and work requiring attention
- a coherent dispatch/day-board experience

**Architectural rule.** Existing assignment semantics must be preserved where possible. Do not create a parallel engineer identity or second assignment architecture merely for dispatch.

**Must not introduce**

- route optimisation
- GPS tracking
- skills optimisation
- subcontractor marketplace
- complex SLA engine
- PPM generation
- offline sync
- inventory
- commercial operations
- AI dispatch agents

## F2.3 — Engineer Job Workflow

**Status.** Authorised. Not implemented. Depends on certified F2.2.

**Product purpose.** Transform the existing My Work / Visit Recorder foundations into the first genuine end-to-end Frigora engineer job workflow.

The engineer workflow should coherently support:

accept work → view job/site/asset context → arrive → perform visit → record existing certified operational facts → record findings → record corrective actions → record parts used → record refrigerant handled → attach F2.0 evidence → record outcome → record recommended actions where required → depart → complete work when completion rules permit

The workflow must use the certified Frigora domain model rather than creating duplicate field-specific truths.

**Should establish**

- a coherent engineer job card/workflow
- relationship between dispatched engineer and attendance
- clear operational progression through the job
- appropriate completion gating using F2.1
- existing F2.0 evidence inside the workflow
- existing refrigerant, parts, findings, corrective action, outcome, and recommendation truths
- field-first presentation suitable for later PWA delivery

**Must not introduce**

- offline capability
- PWA as a separate application
- native mobile application
- customer signature
- CSAM capability
- mandatory parts catalogue
- inventory
- automatic diagnosis
- compliance certification
- AI engineer agents

## Post-Programme-1 direction — provisional / not authorised

The following direction was discovered during roadmap analysis. **None of these are authorised milestones.** Do not assign them F-numbers. Do not implement them as part of this lock. Their order may be reconsidered from evidence produced during Programme 1.

- Time-and-materials costing
- Mobile/PWA packaging
- Offline field capability
- Refrigerant catalogue
- Parts catalogue
- PPM
- RefrigerationSystem / Component modelling
- Cylinder / warehouse / van stock
- Quotations / customer approval
- Structured conclusion / root cause
- FACT → PATTERN → SIGNAL
- VentureOS employee-agent bindings

## Architectural guardrails

- Frigora remains a VentureOS-built Venture. VentureOS remains the platform/runtime.
- Frigora owns refrigeration-specific domain logic.
- Do not create a second application, runtime, or backend.
- Do not create a generic FSM platform inside VentureOS.
- Do not move Frigora-specific concepts into VIC.
- Do not create duplicate field-specific domain truths.
- Preserve the certified Visit truth chain.
- Preserve F2.0 Visit Evidence semantics: not verification, not compliance certification, not commercial acceptance, not customer signature, not generic document management.
- Customer acknowledgement remains distinct from evidence and commercial approval.
- Do not infer root cause, leak, repair success, or commercial acceptance from existing facts.
- Do not introduce offline architecture before the engineer job loop is stable.
- Do not introduce employee agents before meaningful operational actions exist.
