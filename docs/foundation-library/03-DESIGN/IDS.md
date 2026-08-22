# IntelligenceOS Design System (IDS)

**Purpose.** Introduce IDS as the presentation constitution for VentureOS, and point to the locked specifications.

**Authority.** Library entry. Constitutional law: [IDS-001](../../foundation/design-system/IDS-001-IntelligenceOS-Design-System-Foundation.md). Technical contract: [IDS-002](../../foundation/design-system/IDS-002-IntelligenceOS-Design-System-Technical-Specification.md). Package: `packages/ids/`.

**Audience.** Designers and engineers touching presentation.

**Dependencies.** [Twelve Founding Principles](../01-FOUNDATION/Twelve-Founding-Principles.md) · [Architecture Overview](../02-ARCHITECTURE/Architecture-Overview.md)

**Related Documents.** [VentureOS Project Constitution](../../PROJECT_CONSTITUTION.md) · [Visual Constitution](./Visual-Constitution.md) · [Interaction Constitution](./Interaction-Constitution.md) · [Writing Constitution](./Writing-Constitution.md) · [Accessibility](./Accessibility.md) · [Executive Environment Framework](../02-ARCHITECTURE/Executive-Environment-Framework.md)

**Status.** Approved (constitution locked; atmosphere not implemented)

**Version.** 1.1.0

**Owner.** Design

**Last Updated.** 2026-08-20

---

IDS exists so every surface on VentureOS — and every product that runs on VentureOS — reads as one executive operating system.

It is not a Runtime, a Capability, a Venture Definition, a persistence layer, or a product registry. This package does not execute intelligence. It does not import Runtime, the Capability Registry, or the Definition Registry.

## Philosophy

1. Calm before spectacle. Paper, ink, and a single accent carry more authority than gradient theatre.
2. Hierarchy before density. One primary action. One primary heading. Secondary information recedes.
3. Guidance before vacancy. An empty desk is a decision waiting to be taken, not a missing widget.
4. Identity after architecture. Brand never changes who orchestrates, what a capability is, or how a company is defined.
5. Tokens before one-off colour. If a value is not a token, it is not in the system.

## What implementers consume

- `packages/ids/tokens/` — foundation, surface, and brand custom properties (colour hex lives in foundation colour tokens only)
- `packages/ids/themes/climate.css` — semantic aliases
- `packages/ids/themes/bind.ts` — maps a Venture Instance `definition.id` to `data-ids-brand`

Screens consume aliases and official type/surface roles. They do not hard-code hex. Raw Tailwind type utilities are not part of IDS.

## Constitutional rules (summary)

1. IDS is presentation. It does not execute intelligence.
2. Foundation tokens are shared. Brand tokens overlay. No product ships a private spacing or type system.
3. Components do not contain founder-decision, policy, or instantiation logic.
4. Empty, loading, and error language stays executive.
5. Accessibility of skip, focus, contrast, and reduced motion is mandatory.
6. Implementation follows IDS-002. IDS-001 is not a backlog of widgets.
7. Changing IDS must not require changing Runtime, Capability Framework, or Venture Definitions.

Read [Visual Constitution](./Visual-Constitution.md) next. Do not copy token tables into feature sprints; change them only in a dedicated IDS programme.
