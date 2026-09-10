# Product Philosophy

**Purpose.** Define how VentureOS relates to the products that run on it, and how a founder meets a product without meeting a second architecture.

**Authority.** Product law for Foundation v1.1. Subordinate to the [VentureOS Project Constitution](../../PROJECT_CONSTITUTION.md). Compatible with the Definition Registry. It does not create a Product Registry.

**Audience.** Product, design, and engineering.

**Dependencies.** [VentureOS Creed](./VentureOS-Creed.md)

**Related Documents.** [VentureOS Project Constitution](../../PROJECT_CONSTITUTION.md) · [Twelve Founding Principles](./Twelve-Founding-Principles.md) · [Venture Definitions](../02-ARCHITECTURE/Venture-Definitions.md) · [Products](../06-PRODUCTS/README.md) · [IDS](../03-DESIGN/IDS.md) · [FD-007](../05-GOVERNANCE/Founder-Decisions.md) · [ADR-010](../05-GOVERNANCE/Architecture-Decision-Register.md#adr-010--product-branded-customer-surfaces)

**Status.** Approved

**Version.** 1.2.0

**Owner.** Product

**Last Updated.** 2026-09-10

---

VentureOS is the operating system. Marketed Ventures are distinct customer-facing software products that run on it. A generic founded company uses the VentureOS Company definition.

The founder selects a Product in the launch wizard. Products resolve to Venture Definitions through the Definition Registry. The founder never sees capability, runtime, or governance profiles.

There is no Product Registry. Inventing one would be a second source of truth.

## Distinct products, shared platform

Products are commercially and experientially distinct.

A marketed Venture may have:

- its own brand
- its own domain, subdomain, or hostname
- its own customer sign-in
- its own customer-facing application identity and UX
- its own service proposition
- its own support and account-recovery communication identity where applicable

It shares VentureOS architecture: Platform Identity, sessions, workspace and tenancy, permissions, the Executive Intelligence Runtime, the Capability Framework, the Venture Definition Framework, persistence, IDS foundations, and shared security.

This law covers every marketed Venture, including those not yet listed in the live product index.

Distinct customer-facing products are not separate platform stacks. There is no private product authentication system, second Runtime, second Workspace Engine, or product-local platform fork.

## One OS

The shell, Situation Room, Company HQ, Executive Office, Settings, and founding wizard remain one OS.

Feature presence is owned by Venture Definitions (supported and excluded features). Presentation hides nothing the Runtime and projections already hide, and shows nothing they exclude.

Farmora without an executive-office feature does not receive a faux office. Calviora without morning-briefing does not receive a briefing costume. Theme never restores a feature.

Shared desk architecture does not require VentureOS branding on customer deployments. VentureOS remains customer-invisible by default. VentureOS branding remains legitimate for founder, Company, internal, engineering, development, and verification surfaces.

## Product identity

Identity is definition-driven product presentation: brand, copy, sign-in, and application chrome that respect the product’s purpose. It is not a private Runtime, a private capability catalogue, a private navigation model, or a private authentication implementation.

Until a dedicated product-identity programme ships customer-facing deployments, live chrome may use the VentureOS overlay. That current verification and development state is not the production customer law. Qualora, Calviora, and Farmora atmospheres are specified; they are not yet the headquarters the founder walks into. See [Executive Environment Framework](../02-ARCHITECTURE/Executive-Environment-Framework.md).

## Instantiation

Founding creates a Venture Instance: a Venture Intelligence Core company plus `definition: { id, version }`.

The default Product is VentureOS Company (`ventureos.company@1.0.0`). Unknown products fail before instantiation.

## What a product may change

A product may:

- declare which shared capabilities it uses or excludes (except Runtime-required capabilities)
- declare which desk features it supports or excludes
- speak in copy that fits its purpose
- receive an atmosphere keyed to its definition id
- present its own customer-facing product identity, including branded sign-in and application chrome, through definition-driven identity

A product may not:

- ship a second orchestrator
- embed venture-specific logic inside a shared capability
- fork spacing, type, or navigation
- invent a capability the registry does not catalogue
- fork Platform Identity, sessions, tenancy, or permissions
