# Architecture

Cross-cutting maps for Foundation v1.0.

Library: [`docs/foundation-library/02-ARCHITECTURE/Architecture-Overview.md`](../../foundation-library/02-ARCHITECTURE/Architecture-Overview.md).

Start with `apps/web/src/FOUNDATION.md` and `apps/web/src/platform/persistence/README.md`.

This folder is reserved for architecture notes that span Runtime, persistence, platform identity, and presentation. Presentation notes must not change Runtime ownership.

## Foundation architecture index

| Record | Role |
|---|---|
| [`apps/web/src/FOUNDATION.md`](../../../apps/web/src/FOUNDATION.md) | Ownership and boundaries in code |
| [Architecture Overview](../../foundation-library/02-ARCHITECTURE/Architecture-Overview.md) | Layer map |
| [Architecture Decision Register](../../foundation-library/05-GOVERNANCE/Architecture-Decision-Register.md) | ADR-001–009 |
| [Foundation v1.0](../certification/FOUNDATION-V1.0.md) | Frozen product-development gate. Tag `v1.0.0` |
| [ADR-009 — VentureOS Brain](./ADR-009-VentureOS-Brain.md) | Brain is the intelligence substrate. Runtime remains the sole orchestrator. Brain Rule 001 |
| [BRAIN-001](./BRAIN-001-VentureOS-Brain-Architecture.md) | Approved Brain architecture (VC-001) |
| [BRAIN-002](./BRAIN-002-VentureOS-Brain-Implementation-Roadmap.md) | Approved implementation sequence (VC-002, FD-B0). First code sprint is VC-010 |
| [Known development artefacts](../KNOWN-DEVELOPMENT-ARTEFACTS.md) | Non-application issues from Foundation v1.0 verification |
| [Review Process](../../foundation-library/04-ENGINEERING/Review-Process.md) | Review programme. Brain Rule 001 is a required check |
| EAS-001 | Executive Atmosphere (design only; climate and Runtime unchanged) |

Foundation v1.1 Executive Atmosphere (design only): `docs/foundation/design-system/EAS-001-Executive-Atmosphere-Architecture.md`.
