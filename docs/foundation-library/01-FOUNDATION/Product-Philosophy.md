# Product Philosophy

**Purpose.** Define how VentureOS relates to the products that run on it, and how a founder meets a product without meeting a second architecture.

**Authority.** Product law for Foundation v1.1. Subordinate to the [VentureOS Project Constitution](../../PROJECT_CONSTITUTION.md). Compatible with the Definition Registry. It does not create a Product Registry.

**Audience.** Product, design, and engineering.

**Dependencies.** [VentureOS Creed](./VentureOS-Creed.md)

**Related Documents.** [VentureOS Project Constitution](../../PROJECT_CONSTITUTION.md) · [Twelve Founding Principles](./Twelve-Founding-Principles.md) · [Venture Definitions](../02-ARCHITECTURE/Venture-Definitions.md) · [Products](../06-PRODUCTS/README.md) · [IDS](../03-DESIGN/IDS.md)

**Status.** Approved

**Version.** 1.1.0

**Owner.** Product

**Last Updated.** 2026-08-20

---

VentureOS is the operating system. Qualora, Calviora, and Farmora are products that run on it. A generic founded company uses the VentureOS Company definition.

The founder selects a Product in the launch wizard. Products resolve to Venture Definitions through the Definition Registry. The founder never sees capability, runtime, or governance profiles.

There is no Product Registry. Inventing one would be a second source of truth.

## One OS

The shell, Situation Room, Company HQ, Executive Office, Settings, and founding wizard remain one OS.

Feature presence is owned by Venture Definitions (supported and excluded features). Presentation hides nothing the Runtime and projections already hide, and shows nothing they exclude.

Farmora without an executive-office feature does not receive a faux office. Calviora without morning-briefing does not receive a briefing costume. Theme never restores a feature.

## Product identity

Identity is a brand overlay plus copy that respects the product’s purpose. It is not a private Runtime, a private capability catalogue, or a private navigation model.

Until Executive Atmosphere is implemented, live chrome uses the VentureOS overlay. Qualora, Calviora, and Farmora atmospheres are specified; they are not yet the headquarters the founder walks into. See [Executive Environment Framework](../02-ARCHITECTURE/Executive-Environment-Framework.md).

## Instantiation

Founding creates a Venture Instance: a Venture Intelligence Core company plus `definition: { id, version }`.

The default Product is VentureOS Company (`ventureos.company@1.0.0`). Unknown products fail before instantiation.

## What a product may change

A product may:

- declare which shared capabilities it uses or excludes (except Runtime-required capabilities)
- declare which desk features it supports or excludes
- speak in copy that fits its purpose
- receive an atmosphere keyed to its definition id

A product may not:

- ship a second orchestrator
- embed venture-specific logic inside a shared capability
- fork spacing, type, or navigation
- invent a capability the registry does not catalogue
