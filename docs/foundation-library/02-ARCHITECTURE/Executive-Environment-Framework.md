# Executive Environment Framework

**Purpose.** Explain Executive Atmosphere as the Foundation v1.1 design for product headquarters recognition, without treating the specification as implemented code.

**Authority.** Library explanation. Design source: `docs/foundation/design-system/EAS-001-Executive-Atmosphere-Architecture.md`. EAS-001 does not amend IDS-001 or IDS-002, and does not change Runtime.

**Audience.** Design and engineering planning atmosphere work.

**Dependencies.** [Architecture Overview](./Architecture-Overview.md) · [IDS](../03-DESIGN/IDS.md) · [Product Philosophy](../01-FOUNDATION/Product-Philosophy.md)

**Related Documents.** [Visual Constitution](../03-DESIGN/Visual-Constitution.md) · [Accessibility](../03-DESIGN/Accessibility.md) · [Assumption Register](../05-GOVERNANCE/Assumption-Register.md) · [Innovation Register](../05-GOVERNANCE/Innovation-Register.md)

**Status.** Specified, not implemented

**Version.** 1.1.0

**Owner.** Design

**Last Updated.** 2026-08-20

---

Foundation v1.1 expands Layer 2 from “accent overlay” to “executive atmosphere.” The OS stays one OS. Workflows, navigation, Runtime, and interaction model do not fork.

This page is not permission to paint atmospheres in the application. Implementation is a later visual programme.

## Three independent layers

1. **Climate** — Executive Light, Executive Dark, System. Live. Do not add a third climate.
2. **Executive Atmosphere** — VentureOS, Qualora, Calviora, Farmora, future ventures. Specified. Not yet a headquarters change in the running app.
3. **Accessibility** — motion and contrast overrides, independent of venture id and climate.

Components never switch on a venture id. They consume semantic roles. Atmosphere files retint those roles.

## Why overlay was not enough

Climate Light ↔ Dark is immediately recognisable. Brand overlay retints accent and a slight mix into background. Sidebar, toolbar, and most paper do not move. VentureOS overlay hex equals climate brand-primary, so the default brand is a visual no-op. Product overlays are not a headquarters change.

## Atmosphere ids

| ID | Headquarters (EAS-001) | Notes |
|---|---|---|
| `ventureos` | Technology company HQ | Graphite, forest, stone, glass |
| `qualora` | Assurance intelligence centre | Clinical, evidence, medical white |
| `calviora` | Named healthcare operations in EAS-001 | **Conflicts** with the live definition (livestock cadence). See [Assumption Register](../05-GOVERNANCE/Assumption-Register.md) A-001 |
| `farmora` | Agricultural intelligence centre | Earth, greens, stone |

Unknown ids fail closed to `ventureos`. Workspace with no active venture, and unauthenticated chrome, use `ventureos`.

## Independence rules

1. Changing climate never writes atmosphere.
2. Changing atmosphere never writes climate.
3. Changing motion or contrast never writes atmosphere or climate.
4. Atmosphere must not influence routes, nav trees, Runtime, capabilities, definitions, persistence, control geometry, type roles, or spacing scale.

## Calviora hold

Do not paint Calviora until product and IDS name the same headquarters. The live Venture Definition is livestock operating cadence. EAS-001 proposes a healthcare operations centre. That conflict is unresolved. See [Calviora](../06-PRODUCTS/Calviora/README.md).
