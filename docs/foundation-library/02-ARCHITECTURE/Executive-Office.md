# Executive Office

**Purpose.** Describe the Executive Office as seated judgement on the desk.

**Authority.** Library explanation of the locked room. Projection code lives in `apps/web/src/modules/executive-office/`.

**Audience.** Product, design, and engineers working on the leadership floor.

**Dependencies.** [Architecture Overview](./Architecture-Overview.md) · [Capability Framework](./Capability-Framework.md) · [VentureOS Creed](../01-FOUNDATION/VentureOS-Creed.md)

**Related Documents.** [Situation Room](./Situation-Room.md) · [Company HQ](./Company-HQ.md) · [Farmora](../06-PRODUCTS/Farmora/README.md) · [Writing Constitution](../03-DESIGN/Writing-Constitution.md)

**Status.** Approved

**Version.** 1.1.0

**Owner.** Product

**Last Updated.** 2026-08-20

---

The Executive Office is where a seated executive holds remit, brief, recommendation, decision, memory, and correspondence.

It is a governance surface (`governance.executive-office`). It is not a chat Runtime. Ask and the command palette are command surfaces. They do not orchestrate intelligence.

## Floor and desk

The leadership floor lists seated desks. An unseated floor is explained: no seated desks are on this floor; Situation Room and Company HQ remain the operating surfaces.

A seated desk shows:

- Today's brief
- Primary action
- Recommendations
- Decision history
- Executive memory
- Upcoming decisions
- Correspondence

Founder decisions require `venture.update` before Runtime `FounderDecisionRecorded`. The Office records; the Runtime applies.

## Feature honesty

Farmora excludes the executive-office feature. Projections hide the floor. Theme must not costume an office the definition removed.

Capability `governance.executive-office` may still appear on a Farmora capability profile for VIC. Feature exclusion, not capability absence, hides the floor. Do not confuse the two.
