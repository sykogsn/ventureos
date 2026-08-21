# VentureOS Foundation documentation

Reading system: [`docs/foundation-library/00-START-HERE.md`](../foundation-library/00-START-HERE.md).

This tree remains the specification register for Foundation v1.0/v1.1. It does not replace source-of-truth documents that live beside the code. It is the home for constitutional and specification writing that must outlive a sprint. Do not delete these files because the library now explains them.

## Ownership

| Folder | Owns | Source of truth in code |
|---|---|---|
| `constitution/` | Platform boundaries and locked architecture | `apps/web/src/FOUNDATION.md` |
| `runtime/` | Executive Intelligence Runtime | `apps/web/src/core/runtime/README.md` |
| `capabilities/` | Shared Capability Framework | `apps/web/src/core/capability/README.md` |
| `venture-definitions/` | Venture Definition Framework | `apps/web/src/core/venture-definition/README.md` |
| `design-system/` | IntelligenceOS Design System (IDS) | IDS-001 and IDS-002 in this folder. Foundation v1.1 atmosphere architecture: `EAS-001-Executive-Atmosphere-Architecture.md` (does not amend IDS) |
| `architecture/` | Cross-cutting platform maps | `apps/web/src/FOUNDATION.md`, `apps/web/src/platform/persistence/README.md` |
| `certification/` | Certification records and freeze conditions | Programme certification artefacts. Index: `docs/foundation/release/03-CERTIFICATION-INDEX.md` |
| `release/` | Foundation v1.0 product-development release pack | Release notes, capability register, certification index, debt, limitations, roadmap |

The Executive Intelligence Runtime remains the only orchestrator. The Capability Registry remains governance, not dispatch. The Definition Registry remains the only product-definition system. IDS is presentation. It does not execute, persist, or instantiate.
