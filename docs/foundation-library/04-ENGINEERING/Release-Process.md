# Release Process

**Purpose.** Bind how a Foundation-compatible release is declared.

**Audience.** Engineers cutting a release and recording it.

**Dependencies.** [Review Process](./Review-Process.md) · [Foundation Governance](../01-FOUNDATION/Foundation-Governance.md)

**Related Documents.** [Release Register](../05-GOVERNANCE/Release-Register.md) · [Git Workflow](./Git-Workflow.md)

**Status.** Approved

**Version.** 1.1.0

**Owner.** Engineering

**Last Updated.** 2026-08-20

---

## Before release

- `pnpm lint`
- `pnpm check-types`
- `pnpm --filter web test`
- Confirm Runtime, IDS, and definition locks unless the release is a named Foundation amendment
- Confirm this library matches the code for any fact the release teaches

## Declare

Record the release in the [Release Register](../05-GOVERNANCE/Release-Register.md) with version, date, scope, and whether Foundation remains locked.

Foundation v1.0 Baseline and Foundation v1.1 (desk, IDS climate, auth experience, this library) are the declared lineage. Do not invent a version number that the register does not hold.

## After release

If a specification was superseded, say so explicitly. Do not delete it until the [Legacy Charter](../01-FOUNDATION/Legacy-Charter.md) conditions are met.
