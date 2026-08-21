# Start here

**Purpose.** Give every new contributor a single reading path through VentureOS so the platform can be understood without archaeology.

**Authority.** Foundation Library entry. It does not override locked architecture. It sequences the documents that explain that architecture.

**Audience.** Engineers, designers, product managers, AI agents, and founders joining the desk.

**Dependencies.** None. This is the first document.

**Related Documents.** [VentureOS Creed](./01-FOUNDATION/VentureOS-Creed.md) · [Architecture Overview](./02-ARCHITECTURE/Architecture-Overview.md) · [Source Map](./99-APPENDIX/Source-Map.md) · [Glossary](./99-APPENDIX/Glossary.md)

**Status.** Approved

**Version.** 1.1.0

**Owner.** Foundation

**Last Updated.** 2026-08-20

---

VentureOS is the operating system for companies. Situation Room, Company HQ, and the Executive Office share one desk. Qualora, Calviora, and Farmora are products that run on that OS. They are not separate applications.

Foundation v1.1 is locked. This library is how that lock is remembered.

## How to read a library document

Every document in this library states Purpose, Authority, Audience, Dependencies, Related Documents, Status, Version, Owner, and Last Updated. Authority tells you whether the page is law, explanation, or a living register. Implementation sources live beside the code; this library points to them instead of duplicating them.

## Recommended reading order

Follow this sequence. Do not skip the Foundation section.

### 1. Why the OS exists

1. [VentureOS Creed](./01-FOUNDATION/VentureOS-Creed.md) — what the desk is for.
2. [Product Philosophy](./01-FOUNDATION/Product-Philosophy.md) — one OS, many products.
3. [Twelve Founding Principles](./01-FOUNDATION/Twelve-Founding-Principles.md) — the non-negotiables.
4. [Legacy Charter](./01-FOUNDATION/Legacy-Charter.md) — why this library must outlive a sprint.
5. [Foundation Governance](./01-FOUNDATION/Foundation-Governance.md) — who may change what.

### 2. How the platform is built

6. [Architecture Overview](./02-ARCHITECTURE/Architecture-Overview.md) — ownership map.
7. [Runtime](./02-ARCHITECTURE/Runtime.md) — the only intelligence orchestrator.
8. [Capability Framework](./02-ARCHITECTURE/Capability-Framework.md) — governance, not plugins.
9. [Venture Definitions](./02-ARCHITECTURE/Venture-Definitions.md) — the only product-definition system.
10. [Situation Room](./02-ARCHITECTURE/Situation-Room.md) — daily operating judgement.
11. [Company HQ](./02-ARCHITECTURE/Company-HQ.md) — the company as an artefact.
12. [Executive Office](./02-ARCHITECTURE/Executive-Office.md) — seated judgement.
13. [Executive Environment Framework](./02-ARCHITECTURE/Executive-Environment-Framework.md) — atmosphere specified, not yet painted.

### 3. How the desk must feel

14. [IDS](./03-DESIGN/IDS.md) — presentation constitution.
15. [Visual Constitution](./03-DESIGN/Visual-Constitution.md)
16. [Interaction Constitution](./03-DESIGN/Interaction-Constitution.md)
17. [Writing Constitution](./03-DESIGN/Writing-Constitution.md)
18. [Accessibility](./03-DESIGN/Accessibility.md)

### 4. How work is done

19. [Engineering Standards](./04-ENGINEERING/Engineering-Standards.md)
20. [Sprint Standard](./04-ENGINEERING/Sprint-Standard.md)
21. [Git Workflow](./04-ENGINEERING/Git-Workflow.md)
22. [Review Process](./04-ENGINEERING/Review-Process.md)
23. [Release Process](./04-ENGINEERING/Release-Process.md)

### 5. What has been decided

24. [Architecture Decision Register](./05-GOVERNANCE/Architecture-Decision-Register.md)
25. [Founder Decisions](./05-GOVERNANCE/Founder-Decisions.md)
26. [Roadmap Register](./05-GOVERNANCE/Roadmap-Register.md)
27. [Assumption Register](./05-GOVERNANCE/Assumption-Register.md)
28. [Technical Debt Register](./05-GOVERNANCE/Technical-Debt-Register.md)
29. [Innovation Register](./05-GOVERNANCE/Innovation-Register.md)
30. [Release Register](./05-GOVERNANCE/Release-Register.md)

### 6. Products on the OS

31. [Products](./06-PRODUCTS/README.md)
32. [Qualora](./06-PRODUCTS/Qualora/README.md)
33. [Calviora](./06-PRODUCTS/Calviora/README.md)
34. [Farmora](./06-PRODUCTS/Farmora/README.md)
35. [Future products](./06-PRODUCTS/Future/README.md)

### 7. Appendix

36. [Glossary](./99-APPENDIX/Glossary.md)
37. [Source Map](./99-APPENDIX/Source-Map.md) — existing documents this library reuses.

## Locked boundaries

Do not treat this library as permission to change:

- Executive Intelligence Runtime
- IntelligenceOS Design System tokens or constitution
- Shared Capability Registry behaviour
- Venture Definition Registry behaviour
- Persistence ownership
- Executive Environments implementation (EAS-001 is design-only)

Those boundaries are restated in [Foundation Governance](./01-FOUNDATION/Foundation-Governance.md).

## If you have one hour

Read the Creed, the Twelve Principles, Architecture Overview, Runtime, IDS, and Qualora. Then open the desk.
