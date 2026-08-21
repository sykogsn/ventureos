# Company HQ

**Purpose.** Describe Company HQ as the company-as-artefact surface of the desk.

**Authority.** Library explanation of the locked room. Projection code lives in `apps/web/src/modules/ventures/`.

**Audience.** Product, design, and engineers working on a company instance.

**Dependencies.** [Architecture Overview](./Architecture-Overview.md) · [Venture Definitions](./Venture-Definitions.md) · [VentureOS Creed](../01-FOUNDATION/VentureOS-Creed.md)

**Related Documents.** [Situation Room](./Situation-Room.md) · [Executive Office](./Executive-Office.md) · [Products](../06-PRODUCTS/README.md)

**Status.** Approved

**Version.** 1.1.0

**Owner.** Product

**Last Updated.** 2026-08-20

---

Company HQ is the headquarters of one founded company.

The founder opened it by selecting a Product and instantiating a Venture Definition. HQ then shows the company as artefacts: identity, genome, operating health, office (when the feature is enabled), sprint, story, knowledge, and documents.

## Surfaces

Typical artefacts:

- Founder HQ — why this company exists on the desk
- Venture Genome — category, stage, and operating facts
- Operating Health
- Executive Office card — omitted when the instance excludes `executive-office` (Farmora)
- Company Story and knowledge
- Suggested documents and artefact index

HQ does not re-run the Runtime. It projects the instance already founded.

## Portfolio

The Ventures list is the path into HQ. An empty portfolio tells the founder to found a company. It does not apologise for a missing table.

## Feature honesty

If a definition excludes a feature, HQ must not restore it with a disabled pane or a themed placeholder. Farmora has no executive-office floor. The office card is absent, not greyed out.
