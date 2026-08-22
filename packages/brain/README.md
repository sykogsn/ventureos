# @repo/brain

Knowledge Object kernel for the VentureOS Brain (VC-010).

This package is the universal object representation defined in [BRAIN-001](../../docs/foundation/architecture/BRAIN-001-VentureOS-Brain-Architecture.md). Law: [ADR-009](../../docs/foundation/architecture/ADR-009-VentureOS-Brain.md).

It does **not** traverse a graph, reason, persist, remember, assemble executive products, or learn. It does not import Runtime, VIC, or the web app.

```
KnowledgeObject
  = kernel
  + type discriminant
  + type payload
  + plane (institutional | operating)
  + scope[]
```

Institutional types only in this sprint. Operating types are VC-011. The live desk catalogue in `apps/web/src/platform/brain` is unchanged.
