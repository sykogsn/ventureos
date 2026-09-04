# Frigora Programme 1 — Reactive Service Operations

**Purpose.** Record the founder-locked first post-F2.0 Frigora development programme: sequential increments F2.1, F2.2, and F2.3.

**Authority.** Founder product lock. Founder Decision [FD-007](../../05-GOVERNANCE/Founder-Decisions.md). This document does not change the live Venture Definition. It does not certify implementation.

**Audience.** Product and engineers authorised to implement Programme 1.

**Dependencies.** [Frigora product page](./README.md) · [Founder Decisions](../../05-GOVERNANCE/Founder-Decisions.md)

**Related Documents.** [Products](../README.md) · [Venture Definitions](../../02-ARCHITECTURE/Venture-Definitions.md) · [Master Engineering Prompt](../../../engineering/MASTER_ENGINEERING_PROMPT.md)

**Status.** Authorised roadmap lock. **Not implemented.** Live definition remains `frigora@0.16.0` (certified checkpoint F2.0 Visit Evidence).

**Version.** 1.0.0

**Owner.** Founder

**Last Updated.** 2026-09-04

---

## Live product law (unchanged by this lock)

| Field | Value |
|---|---|
| Live definition | `frigora@0.16.0` |
| Certified product checkpoint | F2.0 — Visit Evidence · `6a188eb624c3327ec9bd4bd319d6d6b54ad23232` |
| Product-record reconciliation | `573ab5d4f79bbfa239105bc0944c909e98c0c617` |

F2.1, F2.2, and F2.3 are **authorised roadmap milestones**. They are not admitted in the live definition until each increment is implemented, tested, certified, documented, checkpointed, and the definition is legitimately bumped.

Do not treat this lock as permission to change `catalog.ts` before that work.

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

**Status.** Authorised. Not implemented.

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

**Should establish**

- governed WorkOrder completion
- explicit distinction between Visit completion/departure and WorkOrder completion
- appropriate completion rules based on existing certified truths
- cancellation with appropriate operational reason where justified
- ability to turn an existing recommended action into follow-up work where appropriate
- provenance between the recommendation and the resulting follow-up WorkOrder
- preservation of the existing truth-chain separation

**Must not introduce**

- dispatch scheduling
- dispatch status
- engineer acceptance
- routing
- SLA engine
- PPM
- parts catalogue
- inventory
- cylinder inventory
- quotations
- invoicing
- signatures
- offline capability
- AI agents
- diagnosis inference
- commercial acceptance
- compliance certification

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
