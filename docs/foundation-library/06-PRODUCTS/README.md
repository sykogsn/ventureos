# Products

**Purpose.** Index the products that run on VentureOS and the default company definition.

**Authority.** Product index. Live manifests: `apps/web/src/core/venture-definition/catalog.ts`.

**Audience.** Product, design, and founders choosing a Product.

**Dependencies.** [Product Philosophy](../01-FOUNDATION/Product-Philosophy.md) · [Venture Definitions](../02-ARCHITECTURE/Venture-Definitions.md)

**Related Documents.** [VentureOS Project Constitution](../../PROJECT_CONSTITUTION.md) · [Qualora](./Qualora/README.md) · [Calviora](./Calviora/README.md) · [Farmora](./Farmora/README.md) · [Future](./Future/README.md) · [IDS](../03-DESIGN/IDS.md) · [FD-007](../05-GOVERNANCE/Founder-Decisions.md) · [ADR-010](../05-GOVERNANCE/Architecture-Decision-Register.md#adr-010--product-branded-customer-surfaces)

**Status.** Approved

**Version.** 1.2.0

**Owner.** Product

**Last Updated.** 2026-09-10

---

Every marketed VentureOS-built Venture is a distinct customer-facing software product. The customer buys and uses that Venture — not a generic VentureOS interface that merely contains it.

This law is general. It covers every marketed Venture, including Ventures not yet listed in the live definition index below.

A marketed Venture may have its own brand, domain, sign-in, customer UX, and service proposition while sharing VentureOS architecture. Product identity resolves through the Venture Definition. There is no Product Registry.

The founder selects a Product. The Definition Registry resolves it. The Runtime orchestrates. Platform Identity authenticates. IDS may theme the instance later; it may not invent a Product Registry.

| Product | Definition id | Lifecycle | Distinctive exclusion |
|---|---|---|---|
| VentureOS Company | `ventureos.company` | operating | None (full desk) |
| Qualora | `qualora` | incubating | None |
| Calviora | `calviora` | concept | Morning briefing |
| Farmora | `farmora` | concept | Executive Office feature |

This table is the current live-definition snapshot. It is not an exhaustive list of marketed Ventures and does not limit FD-007.

VentureOS Company is the default instance for founder-created companies. It is the OS’s generic company, not a marketed customer product in the launch sense. Generic VentureOS branding remains legitimate on Company, founder, internal, engineering, development, and verification surfaces.

Live catalogued Ventures are independent products on the same platform. They share capabilities. They do not depend on each other. Unintended cross-product identity leakage in a customer deployment is a product identity defect.
