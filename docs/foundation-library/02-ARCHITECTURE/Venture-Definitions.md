# Venture Definitions

**Purpose.** Explain the Definition Registry as the only product-definition system, and how founding produces a Venture Instance.

**Authority.** Library explanation. Implementation source of truth: `apps/web/src/core/venture-definition/README.md`.

**Audience.** Engineers and product managers adding or changing a product on the OS.

**Dependencies.** [Architecture Overview](./Architecture-Overview.md) · [Capability Framework](./Capability-Framework.md) · [Product Philosophy](../01-FOUNDATION/Product-Philosophy.md)

**Related Documents.** [Runtime](./Runtime.md) · [Products](../06-PRODUCTS/README.md) · [IDS](../03-DESIGN/IDS.md)

**Status.** Approved (locked)

**Version.** 1.1.0

**Owner.** Definition Registry

**Last Updated.** 2026-08-20

---

A Venture Definition is the authoritative metadata for a product running on VentureOS. It is not a VIC company record. It is not a Runtime. It does not execute.

A founded company is a Venture Instance: VIC plus `definition: { id, version }`.

The founder selects a Product. Products resolve to definitions through the Definition Registry. There is no Product Registry.

## Rules

1. One id, one owner, one lifecycle, one maturity.
2. The orchestrator is always the Executive Intelligence Runtime (`intelligence.runtime`).
3. Capability ids resolve through the Shared Capability Registry. Missing or unusable capabilities fail fast.
4. Runtime-required capabilities cannot be excluded.
5. Governance names policy, decision, and office capabilities; all three must be Governance-classified and listed in `uses`.
6. Supported and excluded features are disjoint.
7. Venture dependencies are other definition ids. Cycles fail fast.
8. IDS brand keys are definition ids. Brand does not alter capability, runtime, or governance profiles.

## Instantiation

`instantiateVentureDefinition` fails fast if the definition is missing, the version does not match, or profiles are invalid. Unknown products fail before instantiation.

The launch wizard never shows capability, runtime, or governance profiles.

Rows stored before definition columns existed may have empty `definition_id` / `definition_version`. Repository mapping applies `DEFAULT_VENTURE_DEFINITION_REF` (`ventureos.company@1.0.0`).

## Live definitions

| Id | Version | Name | Lifecycle | Notes |
|---|---|---|---|---|
| `ventureos.company` | 1.0.0 | VentureOS Company | operating | Default instance for founder-created companies |
| `qualora` | 0.3.0 | Qualora | incubating | Full intelligence pack including briefing |
| `calviora` | 0.1.0 | Calviora | concept | Excludes `intelligence.briefing` / morning-briefing |
| `farmora` | 0.1.0 | Farmora | concept | Excludes executive-office feature; still uses office capability for VIC |
| `frigora` | 0.2.0 | Frigora | concept | Full intelligence pack including briefing. Customer, Site, and Asset operational records admitted beside VIC |

The Runtime skips briefing assembly when the instance cannot consume `intelligence.briefing`. Projections hide excluded Situation Room, HQ, and Executive Office surfaces.

Product pages: [Qualora](../06-PRODUCTS/Qualora/README.md), [Calviora](../06-PRODUCTS/Calviora/README.md), [Farmora](../06-PRODUCTS/Farmora/README.md), [Frigora](../06-PRODUCTS/Frigora/README.md).
