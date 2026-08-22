# VentureOS Project Constitution

**Status.** Supreme governing document of the VentureOS repository  
**Version.** 1.0.0  
**Date.** 2026-08-22  
**Owner.** Founder  
**Applies to.** Every developer, AI agent, contributor, and future employee

This document is the highest authority within the repository.

If two documents conflict, the higher document in the Governance Hierarchy wins.

It does not invent a second architecture. Locked implementation sources remain the technical fact for Runtime, Capability Registry, Definition Registry, persistence, and IDS token values. If those sources disagree with this Constitution, they must be amended with founder approval. They may not silently override this document.

Canonical Creed file: [VentureOS Creed](./foundation-library/01-FOUNDATION/VentureOS-Creed.md). Architecture: [VentureOS Platform Constitution](./architecture/VENTUREOS_PLATFORM_CONSTITUTION.md). Engineering: [Master Engineering Prompt](./engineering/MASTER_ENGINEERING_PROMPT.md). Index: [Engineering Index](./engineering/README.md).

---

## Purpose

This document defines the permanent principles that govern every decision made within VentureOS.

This document is the highest authority within the repository.

Every developer, AI agent, contributor, and future employee must follow it.

It binds mission, creed, principles, authority, change control, and the long-term duty of the platform. Lower constitutions, standards, sprints, and implementation exist to serve these principles. They may not redefine them.

---

# Mission

VentureOS exists to become the Executive Operating System for building, operating, and scaling ventures through evidence-based intelligence, structured execution, and trustworthy AI.

The founder founds, operates, and decides from one desk. Situation Room, Company HQ, and the Executive Office are three rooms of the same headquarters. Qualora, Calviora, Farmora, and every future Venture run on that OS. They do not become a second operating system.

---

# The VentureOS Creed

This Creed is the permanent philosophical foundation of the platform. It is restated here in full. The teaching copy remains [VentureOS Creed](./foundation-library/01-FOUNDATION/VentureOS-Creed.md).

---

VentureOS is the operating system for companies.

It is executive software. The founder founds, operates, and decides from one desk. Situation Room, Company HQ, and the Executive Office are not three products. They are three rooms of the same headquarters.

## What the desk is for

The desk exists so judgement is legible.

- The Situation Room holds the daily brief: mission, health, the call that cannot wait, the portfolio, the story, the memory.
- Company HQ holds the company as an artefact: genome, health, office, documents, story.
- The Executive Office holds seated judgement: remit, recommendation, decision, correspondence.

The founder is the principal. Language addresses the person who founds and decides. It does not address an anonymous user of a SaaS template.

## What the desk is not

VentureOS is not a dashboard farm. Surfaces present operating judgement. They are not scoreboards.

VentureOS is not a plugin host. The Executive Intelligence Runtime is the only orchestrator. Capabilities do not dispatch. Pages do not run intelligence.

VentureOS is not a marketing kit. IntelligenceOS (IDS) clothes the OS. It does not become the OS.

VentureOS is not four applications. Qualora, Calviora, and Farmora run on the OS. They do not fork the shell, the Runtime, or the navigation model.

## Recognition

The founder must recognise judgement, constraint, and cadence. The partner and the investor must recognise composure. The operator of a product on this OS must recognise the same desk, with a product identity that does not rewrite the architecture.

Calm before spectacle. Hierarchy before density. Guidance before vacancy. Identity after architecture.

## The vow

We will keep one orchestrator, one capability registry, one definition registry, and one design constitution.

We will fail visibly in copy, not in chrome.

We will not restore a hidden feature with a costume.

We will leave the desk more decided than we found it.

---

# Core Principles

These principles are permanent. A change to any of them is a constitutional amendment, not a ticket.

- **The Executive Intelligence Runtime is the sole orchestrator.** `runExecutiveIntelligenceRuntime` is the only intelligence orchestrator. Pages and the shell are presentational.
- **VentureOS is platform-first.** Architecture is shared. Identity arrives after architecture. One OS, many products.
- **Products inherit from Venture Definitions.** The Definition Registry is the only product-definition system. There is no Product Registry. A definition is metadata. It does not execute.
- **Capabilities are metadata.** The Shared Capability Registry catalogues and validates. Capabilities govern; they do not dispatch, execute engines, or load modules.
- **Runtime behaviour is deterministic.** The same Venture Intelligence Core and the same evidence produce the same orchestration. Runtime is not a chat. It is not improvisation.
- **AI augments judgement.** Intelligence recommends. The founder decides. Automation does not replace evidence or authority.
- **Evidence before automation.** A recommendation without a named basis is unfinished work.
- **Root cause before implementation.** Diagnose with evidence before changing the tree. Never patch symptoms.
- **Simplicity over cleverness.** Prefer the change that still holds when the desk, the Ventures, and the team grow.
- **Every recommendation must be explainable.** If we cannot say why a change or a recommendation exists, it does not belong on the desk or in the tree.
- **Every decision should reduce future complexity.** Leave the platform more decided, more explainable, and simpler to operate than we found it.

These principles restated the Twelve Founding Principles and the Engineering Creed. They do not create a second unmarked copy of those documents. The teaching copies remain in the Foundation Library and Engineering Records.

---

# Governance Hierarchy

Authority order. Higher wins.

```
Project Constitution
    ↓
Architecture Constitution
    ↓
Engineering Constitution
    ↓
Product Standards
    ↓
Foundation Library
    ↓
Sprint Documentation
    ↓
Implementation
```

| Rank | Document | Governs |
|---|---|---|
| 1 | This Project Constitution | Mission, creed, principles, authority, change control |
| 2 | [VentureOS Platform Constitution](./architecture/VENTUREOS_PLATFORM_CONSTITUTION.md) | What may exist: Runtime, Capability Framework, Venture Definitions, persistence, IDS as presentation |
| 3 | [Engineering Constitution](./engineering/ENGINEERING_CONSTITUTION.md) and [Master Engineering Prompt](./engineering/MASTER_ENGINEERING_PROMPT.md) | How work proceeds: lifecycle, pre-flight, validation, completion |
| 4 | Product standards — [Product Philosophy](./foundation-library/01-FOUNDATION/Product-Philosophy.md), [Products](./foundation-library/06-PRODUCTS/README.md) | How Qualora, Calviora, Farmora, and future Ventures inherit the OS |
| 5 | [Foundation Library](./foundation-library/00-START-HERE.md) | How Foundation is read, taught, and remembered |
| 6 | Sprint documentation — [Sprint Standard](./foundation-library/04-ENGINEERING/Sprint-Standard.md), [Engineering History](./engineering/ENGINEERING_HISTORY.md) | How a named programme is written and closed |
| 7 | Implementation | Code, tokens, and running application |

If two documents conflict, the higher document wins.

Named implementation sources (`apps/web/src/FOUNDATION.md`, Runtime, Capability, Definition, persistence, and IDS specifications) remain the technical fact for code behaviour. If implementation and a higher constitution disagree, stop. Do not invent a third truth. Amend with founder approval.

---

# Architecture Authority

Architecture may change only with explicit founder approval.

Changes requiring founder approval include:

- Runtime
- Capability Framework
- Venture Definitions
- Kernel — the locked platform core already named in `apps/web/src/FOUNDATION.md`: Runtime, Capability Framework, Venture Definitions, persistence ownership, and platform identity. There is no second kernel.
- Platform Boundaries
- Constitutional Documents — this Project Constitution, the Platform Constitution, the Engineering Constitution, the Master Engineering Prompt, the Creed, and IDS constitutional law

Engineering may implement an approved architectural change. Engineering may not redefine architecture inside a feature sprint.

---

# Engineering Authority

Every sprint, implementation, review, refactor, and bug fix must follow the [Master Engineering Prompt](./engineering/MASTER_ENGINEERING_PROMPT.md).

The [Engineering Constitution](./engineering/ENGINEERING_CONSTITUTION.md) remains the VES lifecycle and mode law. The [Engineering Index](./engineering/README.md) maps the Foundation Runbook and process standards.

Engineering may define implementation.

Engineering may not redefine architecture.

Engineering may not bypass validation. Engineering may not tell the founder a task is complete until it has been verified in the running application.

---

# Product Authority

Products inherit platform capabilities. They do not create parallel implementations.

- Qualora
- Calviora
- Farmora
- Every future Venture on this OS

A product is a Venture Definition. It receives identity after architecture. It may exclude features. It may not fork the shell, the Runtime, the Capability Registry, the Definition Registry, persistence, or the navigation model. Brand overlay does not restore an excluded feature.

---

# AI Authority

All AI systems operating within the repository must:

- obey the constitutions
- preserve architecture
- identify root causes
- validate before completion
- never introduce unnecessary complexity
- never mark work complete without evidence

An agent is a contributor. It is not a second source of authority. It follows this Project Constitution, then the Architecture Constitution, then the Engineering Constitution and Master Engineering Prompt.

---

# Change Control

VentureOS evolves by named, approved change. It does not evolve by accumulation.

Every permanent architectural decision must be:

- documented
- justified
- approved
- traceable

Record architecture in the [Architecture Decision Register](./foundation-library/05-GOVERNANCE/Architecture-Decision-Register.md). Record founder product calls in [Founder Decisions](./foundation-library/05-GOVERNANCE/Founder-Decisions.md). Record engineering method in the [Decision Register](./engineering/DECISION_REGISTER.md). Close sprints in [Engineering History](./engineering/ENGINEERING_HISTORY.md).

Supersession is explicit. Deleting a locked rule without a dated replacement is unconstitutional.

---

# Long-Term Vision

VentureOS is the permanent foundation upon which all future ventures are built.

The OS outlives a sprint, a product costume, and a single author. Qualora, Calviora, Farmora, and ventures not yet named inherit one desk, one Runtime, one capability catalogue, one definition system, and one design constitution.

The Foundation Library and Engineering Records exist so that knowledge belongs to the company, not to conversations.

---

# Final Principle

The platform must remain understandable.

As VentureOS grows, every improvement should make the platform simpler to operate rather than more complicated.

Complexity must never become the product.
