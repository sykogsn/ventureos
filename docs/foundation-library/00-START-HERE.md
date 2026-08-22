# Start here

**Purpose.** Give every new contributor a single reading path through VentureOS so the platform can be understood without archaeology.

**Authority.** Foundation Library entry. It does not override locked architecture. It sequences the documents that explain that architecture.

**Audience.** Engineers, designers, product managers, AI agents, and founders joining the desk.

**Dependencies.** None. This is the first document.

**Related Documents.** [VentureOS Project Constitution](../PROJECT_CONSTITUTION.md) · [Master Engineering Prompt](../engineering/MASTER_ENGINEERING_PROMPT.md) · [Engineering Index](../engineering/README.md) · [VentureOS Creed](./01-FOUNDATION/VentureOS-Creed.md) · [Architecture Overview](./02-ARCHITECTURE/Architecture-Overview.md) · [Source Map](./99-APPENDIX/Source-Map.md) · [Glossary](./99-APPENDIX/Glossary.md)

**Status.** Approved

**Version.** 1.1.0

**Owner.** Foundation

**Last Updated.** 2026-08-22

---

If you are about to change the tree, read the [VentureOS Project Constitution](../PROJECT_CONSTITUTION.md) first. It is the supreme governing document of the repository. Then read the [Master Engineering Prompt](../engineering/MASTER_ENGINEERING_PROMPT.md). Every sprint, implementation, review, refactor, and bug fix follows that engineering standard by default. The [Engineering Index](../engineering/README.md) maps the Foundation Runbook and process standards.

VentureOS is the operating system for companies. Situation Room, Company HQ, and the Executive Office share one desk. Qualora, Calviora, and Farmora are products that run on that OS. They are not separate applications.

Foundation v1.1 is locked. This library is how that lock is remembered.

## How to read a library document

Every document in this library states Purpose, Authority, Audience, Dependencies, Related Documents, Status, Version, Owner, and Last Updated. Authority tells you whether the page is law, explanation, or a living register. Implementation sources live beside the code; this library points to them instead of duplicating them.

## Recommended reading order

Follow this sequence. Do not skip the Foundation section.

### 1. Why the OS exists

1. [VentureOS Project Constitution](../PROJECT_CONSTITUTION.md) — supreme governing document of the repository.
2. [VentureOS Creed](./01-FOUNDATION/VentureOS-Creed.md) — what the desk is for.
3. [Product Philosophy](./01-FOUNDATION/Product-Philosophy.md) — one OS, many products.
4. [Twelve Founding Principles](./01-FOUNDATION/Twelve-Founding-Principles.md) — the non-negotiables.
5. [Legacy Charter](./01-FOUNDATION/Legacy-Charter.md) — why this library must outlive a sprint.
6. [Foundation Governance](./01-FOUNDATION/Foundation-Governance.md) — who may change what.

### 2. How the platform is built

7. [Architecture Overview](./02-ARCHITECTURE/Architecture-Overview.md) — ownership map.
8. [Runtime](./02-ARCHITECTURE/Runtime.md) — the only intelligence orchestrator.
9. [Capability Framework](./02-ARCHITECTURE/Capability-Framework.md) — governance, not plugins.
10. [Venture Definitions](./02-ARCHITECTURE/Venture-Definitions.md) — the only product-definition system.
11. [Situation Room](./02-ARCHITECTURE/Situation-Room.md) — daily operating judgement.
12. [Company HQ](./02-ARCHITECTURE/Company-HQ.md) — the company as an artefact.
13. [Executive Office](./02-ARCHITECTURE/Executive-Office.md) — seated judgement.
14. [Executive Environment Framework](./02-ARCHITECTURE/Executive-Environment-Framework.md) — atmosphere specified, not yet painted.

### 3. How the desk must feel

15. [IDS](./03-DESIGN/IDS.md) — presentation constitution.
16. [Visual Constitution](./03-DESIGN/Visual-Constitution.md)
17. [Interaction Constitution](./03-DESIGN/Interaction-Constitution.md)
18. [Writing Constitution](./03-DESIGN/Writing-Constitution.md)
19. [Accessibility](./03-DESIGN/Accessibility.md)

### 4. How work is done

20. [Master Engineering Prompt](../engineering/MASTER_ENGINEERING_PROMPT.md) — authoritative engineering standard. Read before any change.
21. [Engineering Index](../engineering/README.md) — Foundation Runbook, architecture, coding standards, branch strategy, release process, sprint process.
22. [Engineering Standards](./04-ENGINEERING/Engineering-Standards.md)
23. [Sprint Standard](./04-ENGINEERING/Sprint-Standard.md)
24. [Git Workflow](./04-ENGINEERING/Git-Workflow.md)
25. [Review Process](./04-ENGINEERING/Review-Process.md)
26. [Release Process](./04-ENGINEERING/Release-Process.md)

### 5. What has been decided

27. [Architecture Decision Register](./05-GOVERNANCE/Architecture-Decision-Register.md)
28. [Founder Decisions](./05-GOVERNANCE/Founder-Decisions.md)
29. [Roadmap Register](./05-GOVERNANCE/Roadmap-Register.md)
30. [Assumption Register](./05-GOVERNANCE/Assumption-Register.md)
31. [Technical Debt Register](./05-GOVERNANCE/Technical-Debt-Register.md)
32. [Innovation Register](./05-GOVERNANCE/Innovation-Register.md)
33. [Release Register](./05-GOVERNANCE/Release-Register.md)

### 6. Products on the OS

34. [Products](./06-PRODUCTS/README.md)
35. [Qualora](./06-PRODUCTS/Qualora/README.md)
36. [Calviora](./06-PRODUCTS/Calviora/README.md)
37. [Farmora](./06-PRODUCTS/Farmora/README.md)
38. [Future products](./06-PRODUCTS/Future/README.md)

### 7. Appendix

39. [Glossary](./99-APPENDIX/Glossary.md)
40. [Source Map](./99-APPENDIX/Source-Map.md) — existing documents this library reuses.

## Locked boundaries

Do not treat this library as permission to change:

- Executive Intelligence Runtime
- IntelligenceOS Design System tokens or constitution
- Shared Capability Registry behaviour
- Venture Definition Registry behaviour
- Persistence ownership
- Executive Environments implementation (EAS-001 is design-only)
- A second orchestrator. The Brain is substrate ([ADR-009](../../foundation/architecture/ADR-009-VentureOS-Brain.md)); it never runs the pipeline.

Those boundaries are restated in [Foundation Governance](./01-FOUNDATION/Foundation-Governance.md).

## If you have one hour

If you are changing the tree, read the Project Constitution, then the Master Engineering Prompt. Then read the Creed, the Twelve Principles, Architecture Overview, Runtime, IDS, and Qualora. Then open the desk.
