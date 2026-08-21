# Future products

**Purpose.** Bind how a new product joins VentureOS without forking the OS.

**Authority.** Product admission rules. Compatible with the Definition Registry and IDS fail-closed mapping.

**Audience.** Founders and product managers proposing a new venture on the desk.

**Dependencies.** [Product Philosophy](../../01-FOUNDATION/Product-Philosophy.md) · [Venture Definitions](../../02-ARCHITECTURE/Venture-Definitions.md) · [Capability Framework](../../02-ARCHITECTURE/Capability-Framework.md)

**Related Documents.** [Products](../README.md) · [Executive Environment Framework](../../02-ARCHITECTURE/Executive-Environment-Framework.md) · [Sprint Standard](../../04-ENGINEERING/Sprint-Standard.md)

**Status.** Approved

**Version.** 1.1.0

**Owner.** Product

**Last Updated.** 2026-08-20

---

A future product is a Venture Definition, not a new application.

## Admission

1. Add a manifest to the Definition Registry: identity, purpose, version, lifecycle, runtime profile, capability profile, governance profile, features.
2. Resolve every capability id through the Shared Capability Registry. Do not embed product logic in a shared capability.
3. Keep the Executive Intelligence Runtime as orchestrator.
4. Map the definition id in IDS bind (unknown ids fail closed to VentureOS).
5. Add a product page under `06-PRODUCTS/` and a row to the [Products](../README.md) index.
6. If atmosphere is required, add a key and a token file in a visual programme — not in a Runtime sprint.

## Refusals

- A second shell, nav tree, or orchestrator
- A Product Registry beside the Definition Registry
- A private type scale or spacing system
- Restoring excluded features with theme
- Painting before the product headquarters is named (the Calviora lesson)

Reserved capability classifications (AI, Security, Communication, Infrastructure) exist for future use. Empty is not an invitation to invent dispatch.
