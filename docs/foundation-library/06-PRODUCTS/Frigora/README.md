# Frigora

**Purpose.** Describe Frigora as a refrigeration venture on VentureOS.

**Authority.** Product page. Live definition: `frigora@0.5.0` in the Definition Registry.

**Audience.** Product, design, and engineers working on Frigora instances.

**Dependencies.** [Products](../README.md) · [Venture Definitions](../../02-ARCHITECTURE/Venture-Definitions.md)

**Related Documents.** [Product Philosophy](../../01-FOUNDATION/Product-Philosophy.md) · [Situation Room](../../02-ARCHITECTURE/Situation-Room.md) · [IDS](../../03-DESIGN/IDS.md) · [Future products](../Future/README.md)

**Status.** Concept (definition); atmosphere not painted; operational product not built beyond Customer, Site, Asset, WorkOrder identity, current WorkOrder assignment, and Visit attendance identity

**Version.** 0.5.0

**Owner.** Founder (definition owner)

**Last Updated.** 2026-08-28

---

Frigora is a VentureOS venture. This definition admits Customer, Site, Asset, WorkOrder identity, current WorkOrder assignment, and Visit attendance identity as durable operational records beside VIC. Work execution, dispatch, PPM, refrigerant events, evidence, commercial operations, FACT → PATTERN → SIGNAL, employee agents, and field workflows are not part of this definition version.

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

RefrigerationSystem and Component remain deferred. Assets may exist at a site without a system grouping.

## Identity

IDS key: `frigora`. Brand and atmosphere selectors exist so the instance is recognised. Visual values inherit the VentureOS overlay until a dedicated visual programme. Do not treat this page as permission to paint a refrigeration headquarters.

## Honesty

Frigora receives the full executive desk. Theme must not invent a private Runtime or a private navigation model. The VentureOS Situation Room remains the founder/executive brief. Frigora operational presentation must not replace `/dashboard`.

## Deferred

The following are not part of this definition version and must not be read as built:

- refrigeration systems, asset components
- work execution, dispatch, engineer field workflows
- faults, readings, diagnoses, repairs, parts
- refrigerant events, cylinders
- PPM requirements, obligations, planned visits, work execution
- commercial operations
- evidence packages, operational memory
- FACT → PATTERN → SIGNAL
- employee agents, workforce bindings, executors, verifiers
- REST APIs, external integrations
- Lovable L0.1–L0.9 screen implementation
