# Venture Definition Framework

Authoritative metadata for every product running on VentureOS.

This framework does not execute. The Executive Intelligence Runtime remains the orchestrator. Capability ids resolve through the Shared Capability Registry.

## Venture Definition Standard

See `VENTURE_DEFINITION_STANDARD`.

A definition describes identity, purpose, version, lifecycle, maturity, runtime requirements, capability profile, governance profile, venture dependencies, and features. It is not a VIC company record.

A Venture Definition is also the authority through which customer-facing product identity must resolve. A definition may carry, or later resolve, the product-identity metadata needed for customer-facing presentation. The implementation shape of that metadata belongs to a later dedicated product-identity programme. Do not invent fields here. Do not create a Product Registry. Do not hard-code a private product stack when definition-driven identity can supply the product.

Law: Project Constitution (Customer-Facing Product Sovereignty) · FD-007 · ADR-010.

## Instantiation

Founding creates a Venture Instance: a VIC company plus `definition: { id, version }`.

The launch wizard presents Products. Each Product resolves to a Venture Definition through the Definition Registry. The founder never sees capability, runtime, or governance profiles.

`instantiateVentureDefinition` fails fast if the definition is missing, the version does not match, or capability, runtime or governance profiles are invalid. Unknown products fail before instantiation.

The default Product is VentureOS Company (`ventureos.company@1.0.0`).

Rows stored before definition columns existed may have empty `definition_id` / `definition_version`. Repository mapping applies `DEFAULT_VENTURE_DEFINITION_REF` (`ventureos.company@1.0.0`) so those companies remain valid instances. New founding always writes an explicit ref.

## Venture Manifest Specification

See `VENTURE_MANIFEST_SPECIFICATION`.

## Venture Dependency Guide

See `VENTURE_DEPENDENCY_GUIDE`.

## Feature Matrix

`renderFeatureMatrix()` lists every definition × feature with enabled/source. Calviora disables morning-briefing (`intelligence.briefing`). Farmora disables executive-office (`governance.executive-office`).

The Runtime skips briefing assembly for instances that cannot consume `intelligence.briefing`. Projections hide excluded Situation Room, HQ and Executive Office surfaces.

| Id                  | Version | Name              | Lifecycle  | Notes                                                                                                                                                                                                                                                                           |
| ------------------- | ------- | ----------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ventureos.company` | 1.0.0   | VentureOS Company | operating  | Default instance for founder-created companies                                                                                                                                                                                                                                  |
| `qualora`           | 0.3.0   | Qualora           | incubating | Full intelligence pack including briefing                                                                                                                                                                                                                                       |
| `calviora`          | 0.1.0   | Calviora          | concept    | Excludes briefing capability and morning-briefing feature                                                                                                                                                                                                                       |
| `farmora`           | 0.1.0   | Farmora           | concept    | Excludes executive-office feature; still uses office capability for VIC                                                                                                                                                                                                         |
| `frigora`           | 0.22.0  | Frigora           | concept    | Full intelligence pack including briefing. Customer, Site, Asset, WorkOrder identity, current assignment, Visit attendance and facts, Visit evidence, F2.1–F2.3 (Programme 1 certified at `frigora@0.18.0`), F3.0 structured parts/refrigerant catalogues, F3.1 Time & Materials customer charge (ZAR cents snapshots), F3.2 Mobile / PWA Delivery, and F3.3 Offline Field Capability (ADMITTED / COMPLETE with declared coverage limitations) admitted beside VIC; inventory, procurement, invoice, quote, VAT, and payroll remain excluded; F3.4 remains PLANNED / NEXT |
