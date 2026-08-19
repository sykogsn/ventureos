# VentureOS Foundation documentation

Permanent register for Foundation v1.0. This tree does not replace source-of-truth documents that live beside the code. It is the home for constitutional and specification writing that must outlive a sprint.

## Ownership

| Folder | Owns | Source of truth in code |
|---|---|---|
| `constitution/` | Platform boundaries and locked architecture | `apps/web/src/FOUNDATION.md` |
| `runtime/` | Executive Intelligence Runtime | `apps/web/src/core/runtime/README.md` |
| `capabilities/` | Shared Capability Framework | `apps/web/src/core/capability/README.md` |
| `venture-definitions/` | Venture Definition Framework | `apps/web/src/core/venture-definition/README.md` |
| `design-system/` | IntelligenceOS Design System (IDS) | IDS-001 and IDS-002 in this folder |
| `architecture/` | Cross-cutting platform maps | `apps/web/src/FOUNDATION.md`, `apps/web/src/platform/persistence/README.md` |
| `certification/` | Certification records and freeze conditions | Programme certification artefacts |

The Executive Intelligence Runtime remains the only orchestrator. The Capability Registry remains governance, not dispatch. The Definition Registry remains the only product-definition system. IDS is presentation. It does not execute, persist, or instantiate.
