# Foundation Release Notes

**Release.** VentureOS Foundation v1.0  
**Date.** 2026-08-21  
**Kind.** Product-development gate. Not a Runtime amendment.  
**Authority.** `apps/web/src/FOUNDATION.md` · [VentureOS Platform Constitution](../../architecture/VENTUREOS_PLATFORM_CONSTITUTION.md) v1.0

This pack declares the locked operating-system foundation **ready for product development**.

It does not add features. It does not change Runtime, Capability Registry, Definition Registry, persistence ownership, or IDS token hex.

---

## What Foundation v1.0 is

VentureOS is the operating system for companies. The founder founds, operates, and decides from one desk. Situation Room, Company HQ, and the Executive Office are three rooms of that headquarters.

Qualora, Calviora, and Farmora are products that run on the OS. They are not separate applications.

## Lineage

| Record | What it named |
|---|---|
| `FOUNDATION.md` | Architectural lock: Foundation v1.0 |
| Foundation Library 1.0.0 | Runtime, Capability Framework, Venture Definitions, persistence, IDS-001 / IDS-002 |
| Foundation Library 1.1.0 | Desk language, live climate, authentication experience, the reading library. Runtime unchanged. |
| Constitution v1.0 | Highest governing specification for future architectural decisions |
| This pack | Product-development declaration of that locked foundation |

Library increment 1.1.0 is **included** in this release. It is not future work. Future work is [Roadmap v1.1 onward](./06-ROADMAP.md).

## In this release

**Locked architecture**

- Executive Intelligence Runtime is the only intelligence orchestrator (`runExecutiveIntelligenceRuntime`).
- Shared Capability Registry catalogues and validates. It does not dispatch.
- Definition Registry is the only product-definition system. There is no Product Registry.
- Persistence does CRUD and mapping. The intelligence service writes Runtime snapshots.
- Platform identity, sessions, workspaces, and membership do not import Runtime.

**Desk**

- Situation Room, Company HQ, Executive Office.
- Founder is the principal of copy and primary action.
- Two climates only: Executive Light and Executive Dark. Brand is overlay. Atmosphere is specified, not painted.

**Platform presentation**

- IntelligenceOS (IDS) clothes the OS. It does not execute.
- Executive Layout v2 is the certified platform layout foundation. Authentication remains the Layout v1 reference.
- Workspace chrome (OsShell, navigation, canvas, toolbar, command region) consumes layout primitives.

**Platform identity**

- Password authentication, Google OAuth (environment-dependent), password reset, Remember me.
- Authentication is a desk, not a marketing page.

**Products on the OS**

| Product | Definition | Lifecycle |
|---|---|---|
| VentureOS Company | `ventureos.company@1.0.0` | operating (default instance) |
| Qualora | `qualora@0.3.0` | incubating |
| Calviora | `calviora@0.1.0` | concept (excludes morning-briefing) |
| Farmora | `farmora@0.1.0` | concept (excludes executive-office feature) |

## Not in this release

- Executive Atmosphere as headquarters recognition (EAS-001 remains design-only).
- Migration of Situation Room, Executive Office, Brain, HQ, Settings, and Launch internals onto layout primitives.
- Production Google OAuth credentials and transactional email.
- Calviora headquarters identity ratification.
- A second orchestrator, a Product Registry, or a third climate.

## What product development may do

A product may declare which shared capabilities and desk features it uses or excludes (except Runtime-required capabilities), speak in copy that fits its purpose, and receive a brand overlay keyed to its definition id.

## What product development may not do

A product may not ship a second orchestrator, embed venture-specific logic in a shared capability, fork spacing, type, or navigation, invent a capability the registry does not catalogue, or restore an excluded feature with theme.

See the Constitution, Articles 10–11 and 19.

## Companion artefacts

1. [Capability Register](./02-CAPABILITY-REGISTER.md)
2. [Certification Index](./03-CERTIFICATION-INDEX.md)
3. [Technical Debt Register](./04-TECHNICAL-DEBT-REGISTER.md)
4. [Known Limitations](./05-KNOWN-LIMITATIONS.md)
5. [Roadmap (v1.1 onward)](./06-ROADMAP.md)
