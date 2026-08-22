# RM-002 — Shared Capability Discovery

**Status.** Discovery only. Not approved for implementation.  
**Date.** 2026-08-22  
**Programme.** RM-002 (architectural discovery; not the Qualora visual programme)  
**Owner.** Architecture (recommendations). Founder (decisions).  
**Authority.** Subordinate to the [VentureOS Project Constitution](../PROJECT_CONSTITUTION.md) and the [VentureOS Platform Constitution](../architecture/VENTUREOS_PLATFORM_CONSTITUTION.md).

This programme exists only to help the founder decide what belongs to VentureOS and what belongs to a Venture projection before Qualora development begins.

It does **not** implement application code.  
It does **not** create capabilities.  
It does **not** modify the Runtime.  
It does **not** modify Venture Definitions.  
It does **not** redesign the platform.

Wait for founder approval before any implementation is proposed.

---

## Decision principle

For every concept:

> If Qualora disappeared tomorrow, would another Venture still benefit from this capability?

| Answer | Location |
|---|---|
| **Yes** | Candidate VentureOS shared capability — or an **existing** shared capability / Runtime object that must be consumed, not cloned. |
| **No** | Venture-specific projection: definition purpose, copy, atmosphere, feature presence, or policy-library content. Not a capability. |

Do not invent. Every overlap below is named from the live catalogue (`platformCapabilityCatalog`), Runtime pipeline, or a typed object already on the Venture Intelligence Core.

Live capabilities are listed in [Foundation Capability Register](../foundation/release/02-CAPABILITY-REGISTER.md). Empty classifications (AI, Security, Communication, Infrastructure) are reserved; they are not permission to fill them in this document.

---

## Location vocabulary

These are discovery labels. They are not catalogue amendments.

| Label | Meaning |
|---|---|
| **Existing capability — consume** | Already in the Shared Capability Registry. Do not create a second id. |
| **Existing Runtime / VIC object — not a capability** | Already a typed fact or engine output. Do not register it as a capability. |
| **Platform system — not a capability** | Workspace, persistence, IDS, Brain, layout, Interaction Engine, workflow runner. The Capability Register already forbids a second catalogue for these. |
| **Candidate shared capability** | Another Venture would still benefit. Not in the catalogue. Founder must decide before anyone may add a manifest. |
| **Venture projection** | Dies with the product’s purpose, copy, or atmosphere. Qualora (or Calviora / Farmora) overlay. |

---

## Concepts

### Evidence

**Description.** A named basis for a finding, recommendation, or founder call.  
**Purpose.** So judgement is explainable. The Project Constitution requires evidence before automation.  
**Who would use it.** Every Venture that receives a recommendation or records a decision.  
**Could another Venture use it?** Yes. Farmora field health, Calviora constraint, and a generic VentureOS Company all need a named basis if Qualora disappears.  
**Existing VentureOS overlap.** `PolicyEvidence` and `SupportingEvidence` already exist. Sources today: health, mission, decision, risk, memory, story, office, genome, policy. Not a capability id.  
**Recommended location.** Existing Runtime / VIC object — not a capability. Keep evidence as structured fields on findings and recommendations. A Qualora “evidence pack” (lab file, certificate) is a **projection** onto Document / Record, not a new engine.  
**Risks.** Elevating Evidence to a capability would duplicate policy and recommendation contracts. Treating Qualora artefacts as the only evidence shape would hide Farmora and Calviora.  
**Founder decision required.** Yes. Confirm evidence remains a field on existing objects, or later approve a shared evidence capability. Do not implement either in this programme.

### Finding

**Description.** A concluded judgement against a rule or fact: breach, watch, or compliant.  
**Purpose.** Name what is wrong or watched so a recommendation can be derived.  
**Who would use it.** Policy Engine consumers; Situation Room; Executive Office.  
**Could another Venture use it?** Yes. Policy findings already run for every definition that uses `intelligence.policy-engine` (all current products).  
**Existing VentureOS overlap.** `PolicyFinding` is the output of Runtime stage `policy-evaluation`. Capability: `intelligence.policy-engine`.  
**Recommended location.** Existing capability — consume. A Qualora “quality finding” is a **projection** (copy and policy-library content), not a second finding engine.  
**Risks.** A `qualora.findings` capability would embed venture logic inside the catalogue (forbidden). Generalising Finding beyond policy without a founder decision would silently amend the Runtime pipeline.  
**Founder decision required.** Yes. Keep Finding = policy finding only, or later approve a broader shared Finding type that policy findings implement. Do not add a catalogue id in this programme.

### Observation

**Description.** A recorded fact that is not yet a finding.  
**Purpose.** Capture what was seen before it is judged.  
**Who would use it.** Operators who write facts; engines that later evaluate policy.  
**Could another Venture use it?** Yes. Farmora field notes, Calviora herd notes, and a generic company’s operating notes would still need a fact that is not a ruling if Qualora disappears.  
**Existing VentureOS overlap.** No `Observation` type. Closest: genome facts, mission facts, risk signals, memory records, knowledge-graph `note` nodes.  
**Recommended location.** Candidate shared capability **or** remain an unjudged Memory / Knowledge note. Not Qualora-only.  
**Risks.** Overlaps Finding and Evidence. A premature capability becomes a second VIC document.  
**Founder decision required.** Yes. Observation as shared fact type versus projection onto Memory / Knowledge Graph.

### Risk

**Description.** Headline and signals that something may harm the venture.  
**Purpose.** Feed briefing and policy evidence.  
**Who would use it.** Every current definition (`intelligence.risk` is on the shared pack).  
**Could another Venture use it?** Yes. Already shared.  
**Existing VentureOS overlap.** `intelligence.risk` · `RiskIntelligence` · `RiskSignal`.  
**Recommended location.** Existing capability — consume. Qualora “quality risk” is projection language on the same signals.  
**Risks.** A Qualora-only risk engine would duplicate `intelligence.risk`.  
**Founder decision required.** No catalogue change. Founder may later decide whether risk *vocabulary* is product copy only.

### Issue

**Description.** An open item that needs attention. Everyday language; not a live type.  
**Purpose.** Track work that is not yet a decision or a policy finding.  
**Who would use it.** Ambiguous.  
**Could another Venture use it?** Unproven. If “issue” means a defect tracker, Qualora-shaped. If it means “something the founder must face,” Finding and Decision already cover it.  
**Existing VentureOS overlap.** `CapabilityIssue` is registry validation, not product work. `PolicyFinding`, `Decision`, `MissionTask` already name attention.  
**Recommended location.** Venture projection if it means a Qualora ticket. Otherwise do **not** create a capability — project onto Finding or Decision.  
**Risks.** A third attention object beside Finding and Decision.  
**Founder decision required.** Yes. Is Issue distinct from Finding? This document does not assume it is.

### Action

**Description.** What someone should do next.  
**Purpose.** Turn judgement into a verb.  
**Who would use it.** Founder and seated executives on every product.  
**Could another Venture use it?** Yes — as a field, not a capability.  
**Existing VentureOS overlap.** `recommendedAction`, `ExecutiveAction`, `MissionTask`, founder-call actions.  
**Recommended location.** Existing Runtime / VIC object — not a capability. Qualora “corrective action” is projection copy on Recommendation / Mission.  
**Risks.** An Action capability would impersonate Recommendation and Mission.  
**Founder decision required.** No. Do not register Action.

### Recommendation

**Description.** Ranked, evidence-backed next step derived from a finding.  
**Purpose.** Intelligence recommends; the founder decides.  
**Who would use it.** All products that use `intelligence.recommendation-engine` (all current products).  
**Could another Venture use it?** Yes. Already shared.  
**Existing VentureOS overlap.** `intelligence.recommendation-engine`. Runtime stage `recommendation-engine`.  
**Recommended location.** Existing capability — consume.  
**Risks.** A Qualora recommendation engine would be a second orchestrator-adjacent fork.  
**Founder decision required.** No catalogue change.

### Constraint

**Description.** The binding limit on today’s work.  
**Purpose.** So the founder does not context-switch.  
**Who would use it.** Situation Room mission; Calviora’s product purpose is constraint management.  
**Could another Venture use it?** Yes. Calviora and a generic company still have “today’s constraint” if Qualora disappears.  
**Existing VentureOS overlap.** `intelligence.mission` (`TodaysMission`). Policy `founder.constraint-first`.  
**Recommended location.** Existing capability — consume (`intelligence.mission`). Qualora “quality constraint” and Calviora “calving constraint” are **projections** (copy and policy library), not new capabilities.  
**Risks.** A Constraint capability would split Mission.  
**Founder decision required.** Yes. Confirm Constraint remains Mission / Policy content, not a new id.

### Control

**Description.** A standing check that a process must pass (internal control).  
**Purpose.** Prevent recurrence; often used in regulated language.  
**Who would use it.** Unclear until the founder names the domain.  
**Could another Venture use it?** Possibly. Farmora environmental checks, a generic company’s financial controls, Calviora livestock checks — **if** those products ever need standing controls. Not evidenced in live definitions beyond Qualora’s regulated-work purpose.  
**Existing VentureOS overlap.** None as a type. Closest: Policy (`appliesWhen` + `requiredAction`).  
**Recommended location.** Do not assume a capability. Prefer Policy library content until the founder proves another Venture needs Controls as objects. Qualora-only control frameworks stay a **projection**.  
**Risks.** Building a GRC platform inside VentureOS. Reserved Security classification is empty by design (IN-004).  
**Founder decision required.** Yes. Control as Policy content versus a future shared Governance/Security capability.

### Compliance

**Description.** Either a status (compliant) or a programme (being in compliance).  
**Purpose.** Status: tell whether a policy holds. Programme: run a regulated system.  
**Who would use it.** Status: every policy consumer. Programme: Qualora-shaped unless the founder names others.  
**Could another Venture use it?** Status: yes. Programme: not evidenced for Calviora/Farmora/VentureOS Company.  
**Existing VentureOS overlap.** `PolicyFindingStatus` includes `compliant`.  
**Recommended location.** Status: existing VIC object. Programme: Venture projection until another product’s definition names compliance operations.  
**Risks.** Treating Qualora’s regulated programme as a platform capability would force Farmora and Calviora to inherit a QMS they did not ask for.  
**Founder decision required.** Yes. Split status (shared, already exists) from programme (projection unless founder says otherwise).

### Assurance

**Description.** EAS-001 headquarters metaphor for Qualora: assurance intelligence centre.  
**Purpose.** Recognition — clinical, evidence, trust — not an engine.  
**Who would use it.** Qualora identity.  
**Could another Venture use it?** No. If Qualora disappears, “assurance HQ” has no other owner. Farmora is agricultural; Calviora identity is unresolved; VentureOS Company is the default OS.  
**Existing VentureOS overlap.** EAS-001 / IDS atmosphere. Not a capability. IDS must not declare capabilities.  
**Recommended location.** Venture projection (atmosphere + copy).  
**Risks.** Registering Assurance as a capability would put presentation in the Capability Registry.  
**Founder decision required.** No. Do not register Assurance.

### Audit

**Description.** Either an immutable trail of what happened, or a scheduled audit programme.  
**Purpose.** Trail: reconstruct a decision. Programme: inspect a system on a cadence.  
**Who would use it.** Trail: every Venture (and Engineering Records). Programme: Qualora-shaped.  
**Could another Venture use it?** Trail: yes. Programme: not evidenced.  
**Existing VentureOS overlap.** Runtime events (`FounderDecisionRecorded`, `CompanyFounded`, `IntelligenceRefresh`). Persistence snapshots. Executive Memory. Not a capability.  
**Recommended location.** Trail: platform system (Runtime events + persistence) — not a capability. Programme: Venture projection.  
**Risks.** An Audit capability would impersonate Persistence and Runtime history.  
**Founder decision required.** Yes. Confirm no Audit capability; trail stays events + memory.

### Policy

**Description.** A standing rule evaluated against VIC facts.  
**Purpose.** Emit findings during a Runtime run.  
**Who would use it.** All current products (`intelligence.policy-engine` is Runtime-required).  
**Could another Venture use it?** Yes. Already shared. Qualora quality policies would be **library rows**, not a new capability.  
**Existing VentureOS overlap.** `intelligence.policy-engine` · `ExecutivePolicy` · `executivePolicyCatalog`.  
**Recommended location.** Existing capability — consume. Product voice lives in policy content.  
**Risks.** A Qualora policy engine would duplicate a Runtime-required capability.  
**Founder decision required.** No catalogue change. Founder may later approve Qualora-flavoured *policies* as content.

### Procedure

**Description.** An ordered way of working (SOP / playbook).  
**Purpose.** Tell an operator how to execute, not what the Runtime should conclude.  
**Who would use it.** Unclear. Brain already has type `Playbook`. Documents have `kind`.  
**Could another Venture use it?** Possibly — Farmora field SOP, Calviora calving SOP, generic company playbook — but those can be documents.  
**Existing VentureOS overlap.** Brain `Playbook`. `IntelligentDocument.kind`. No Procedure type. Platform `createWorkflowEngine` is a step runner, not a procedure library.  
**Recommended location.** Venture projection onto Document / Brain until the founder proves Procedure is not a document. Not a capability by default.  
**Risks.** Procedure + Workflow + Runtime becomes three orchestrators.  
**Founder decision required.** Yes. Procedure versus Document versus Brain Playbook.

### Document

**Description.** A titled artefact the company keeps (suggested, draft, live).  
**Purpose.** Company-as-artefact; not a second document system.  
**Who would use it.** Company HQ on every product. Reserved `/documents` route is empty by design.  
**Could another Venture use it?** Yes.  
**Existing VentureOS overlap.** `IntelligentDocument` / `DocumentIntelligence` in core — **not** in the Capability Registry. Brain Knowledge Objects. Capability Register: Brain is a platform system.  
**Recommended location.** Existing VIC / HQ projection — not a new capability. Do not promote the reserved Documents route into a Qualora DMS. Founder may later decide whether document-intelligence becomes a catalogue id.  
**Risks.** A Document capability plus Brain plus reserved CRM/Finance rooms becomes a second product suite.  
**Founder decision required.** Yes. Leave as HQ artefacts, or later catalogue document-intelligence. Not Qualora-owned.

### Record

**Description.** A durable fact that must not be invented twice.  
**Purpose.** Memory and persistence.  
**Who would use it.** Every Venture.  
**Could another Venture use it?** Yes.  
**Existing VentureOS overlap.** `MemoryRecord` (`intelligence.executive-memory`). Persistence snapshots. Runtime events.  
**Recommended location.** Existing capability / platform system — consume. Qualora “quality record” is projection language.  
**Risks.** A Record capability would duplicate Memory and Persistence.  
**Founder decision required.** No. Do not register Record.

### Task

**Description.** A unit of work on a sprint.  
**Purpose.** Name Sprint 1 work without becoming a project-management product.  
**Who would use it.** Mission Engine consumers.  
**Could another Venture use it?** Yes — as `MissionTask`.  
**Existing VentureOS overlap.** `MissionTask` on `intelligence.mission`.  
**Recommended location.** Existing Runtime / VIC object — not a capability.  
**Risks.** A Task capability would become a tracker and violate judgement-over-dashboard.  
**Founder decision required.** No.

### Workflow

**Description.** A registered sequence of steps with a run status.  
**Purpose.** Execute an ordered procedure in software.  
**Who would use it.** Platform utilities (`createWorkflowEngine` in `apps/web/src/platform/workflows/`).  
**Could another Venture use it?** The runner is generic. Using it as Qualora’s quality workflow product would still benefit other Ventures *if* it stays a platform utility.  
**Existing VentureOS overlap.** Platform workflow engine. **Not** a capability. **Not** the Runtime. Capability Register forbids a second orchestrator.  
**Recommended location.** Platform system — not a capability. Must never become a second intelligence orchestrator. Qualora “quality workflow” is a **projection** (which policies and missions apply), not ownership of the runner.  
**Risks.** Highest architecture risk in this list. Workflow-as-capability is how a second Runtime appears.  
**Founder decision required.** Yes. Confirm the workflow runner stays a non-capability platform utility and is not opened as Qualora work.

### Decision

**Description.** A question the founder must rule, or has ruled.  
**Purpose.** Seated judgement; `FounderDecisionRecorded` is the only path into VIC.  
**Who would use it.** All products that use `intelligence.decision-engine` and `governance.founder-decision`.  
**Could another Venture use it?** Yes. Already shared.  
**Existing VentureOS overlap.** Both capabilities. Runtime event `FounderDecisionRecorded`.  
**Recommended location.** Existing capabilities — consume.  
**Risks.** A Qualora decision engine would bypass the Runtime.  
**Founder decision required.** No catalogue change.

### Knowledge

**Description.** What the OS remembers as graph or as institutional catalogue.  
**Purpose.** Graph: venture nodes and edges on VIC. Brain: platform teaching objects.  
**Who would use it.** Graph: Runtime pipeline. Brain: Engineering / Foundation readers.  
**Could another Venture use it?** Graph: yes (`intelligence.knowledge-graph`). Brain: yes as platform, not as Qualora.  
**Existing VentureOS overlap.** `intelligence.knowledge-graph`. Brain (platform system, not a capability).  
**Recommended location.** Graph: existing capability — consume. Brain: platform system. Qualora “quality knowledge base” is a projection onto those two.  
**Risks.** A Qualora knowledge product would fork Brain or the graph.  
**Founder decision required.** Yes. Confirm Brain stays platform knowledge, not Qualora operations.

### Event

**Description.** Something that happened to the intelligence document.  
**Purpose.** Mutate VIC only through the Runtime.  
**Who would use it.** Runtime.  
**Could another Venture use it?** Yes — as Runtime mutations.  
**Existing VentureOS overlap.** `RuntimeEvent`: `FounderDecisionRecorded`, `CompanyFounded`, `IntelligenceRefresh`.  
**Recommended location.** Existing Runtime object — not a capability.  
**Risks.** Registering Event as a capability would put the orchestrator in the catalogue twice (`intelligence.runtime` already exists).  
**Founder decision required.** No. Do not register Event.

### Timeline

**Description.** Ordered view of events, decisions, and memory.  
**Purpose.** Show cadence without a metrics wall.  
**Who would use it.** Any founder reading history.  
**Could another Venture use it?** Yes — as a **view** of existing objects.  
**Existing VentureOS overlap.** Decision history, executive memory, company story, Runtime events. No Timeline type.  
**Recommended location.** Venture **or** shared **projection** (UI / Situation Room region) of Event + Decision + Memory. Not a capability.  
**Risks.** A Timeline capability invents a second history store.  
**Founder decision required.** Yes. Confirm Timeline is a projection, not a catalogue id.

### Investigation

**Description.** A structured enquiry into a finding or incident.  
**Purpose.** Gather evidence until a decision can be taken.  
**Who would use it.** Not evidenced outside Qualora’s regulated-work purpose.  
**Could another Venture use it?** Unproven. Farmora or a generic company *might* investigate an incident; live definitions do not say so.  
**Existing VentureOS overlap.** Finding + Evidence + Decision + Memory already compose an enquiry if the founder uses them that way.  
**Recommended location.** Venture projection until another definition names investigation. Do not assume a shared capability.  
**Risks.** Investigation-as-capability is a case-management product and a likely OS fork.  
**Founder decision required.** Yes. Do not treat Investigation as shared without another Venture’s written need.

### Incident

**Description.** A discrete harm or near-harm in operations.  
**Purpose.** Separate a moment of failure from a standing policy finding.  
**Who would use it.** Not in the live catalogue. Farmora field harm and Calviora livestock harm are plausible; not recorded.  
**Could another Venture use it?** Possible, not proven.  
**Existing VentureOS overlap.** `intelligence.risk` signals. Policy findings. No Incident type.  
**Recommended location.** Do not create. Prefer Risk + Finding until the founder names Incident as a shared object. Qualora “quality incident” stays a projection.  
**Risks.** Incident + Investigation + Control is a GRC suite.  
**Founder decision required.** Yes.

### Exception

**Description.** A ruled waiver of a policy for a time or instance.  
**Purpose.** Record that the founder allowed a breach to stand.  
**Who would use it.** Any Venture with policies — if the founder wants waivers as first-class facts.  
**Could another Venture use it?** Yes, if Exception is “founder waived this policy.” That is a Decision about a Finding.  
**Existing VentureOS overlap.** `FounderDecisionRecorded` + `PolicyFinding`. No Exception type.  
**Recommended location.** Existing capabilities — project Exception as a Decision ruling on a Finding. Candidate shared type only if the founder refuses that projection.  
**Risks.** A parallel waiver ledger beside founder decisions.  
**Founder decision required.** Yes. Exception as Decision versus a new object.

### Objective

**Description.** What this sprint is for.  
**Purpose.** Protect Sprint 1 while health is forming.  
**Who would use it.** Mission Engine.  
**Could another Venture use it?** Yes.  
**Existing VentureOS overlap.** `Sprint.objective` on `intelligence.mission`.  
**Recommended location.** Existing VIC object — not a capability.  
**Risks.** An Objective capability would split Mission.  
**Founder decision required.** No.

### Metric

**Description.** A numeric scoreboard.  
**Purpose.** Often requested; constitutionally dangerous.  
**Who would use it.** Anyone who wants a dashboard.  
**Could another Venture use it?** Other Ventures would *want* numbers. The Creed and Twelve Founding Principles forbid judgement becoming a scoreboard.  
**Existing VentureOS overlap.** `intelligence.operating-health` uses bands (healthy / watch / risk), not metrics.  
**Recommended location.** **Do not create a Metric capability.** Consume Operating Health. Qualora “quality metrics” are unconstitutional if they become a traffic-light overlay (Qualora README already forbids a Qualora-only traffic light).  
**Risks.** Metric-as-capability violates judgement over dashboard and Qualora’s own overlay rule.  
**Founder decision required.** Yes. Confirm Metric is refused as a capability.

---

## Additional concepts (from the live OS)

### Operating Health

Already `intelligence.operating-health`. Shared. Consume. Farmora “field-level health” is projection language on the same bands.

### Executive Briefing

Already `intelligence.briefing`. Shared; Calviora excludes it. Consume or exclude via definition — do not clone for Qualora.

### Executive Memory

Already `intelligence.executive-memory`. Shared. Consume. Qualora “do not take this quality call twice” is projection.

### Company Story

Already `intelligence.company-story`. Shared. Consume.

### Venture Genome

Already `data.venture-genome`. Shared. Consume. Product category/stage facts are not Qualora-only.

### Quality (as a domain)

**Could another Venture use it?** No, if it means “quality management for regulated work.” That is Qualora’s purpose.  
**Recommended location.** Venture projection (definition purpose, copy, atmosphere, policy library).  
**Founder decision required.** Yes. Confirm Quality is not a capability id.

### Correspondence

`CorrespondenceNote` on the Executive Office. Feature-gated with `executive-office` (Farmora excludes the floor). Not a capability. Projection of `governance.executive-office`.

---

## Summary table

| Concept | Shared Capability | Venture Projection | Reasoning | Founder Decision |
|---|---|---|---|---|
| Evidence | No new id. Fields already on findings/recommendations. | Qualora evidence *artefacts* (files, certificates) | Other Ventures still need a named basis if Qualora disappears. Artefact shape is product. | Yes — field vs later shared evidence capability |
| Finding | Consume `intelligence.policy-engine` | Qualora “quality finding” copy / policies | Policy findings already run for every current product | Yes — policy-only vs broader Finding |
| Observation | Candidate (or Memory / Knowledge note) | — | Unjudged fact would still help Farmora / Calviora / generic company | Yes |
| Risk | Consume `intelligence.risk` | Qualora “quality risk” language | Already on the shared pack | No catalogue change |
| Issue | Do not create | If it means a Qualora ticket | Unproven as distinct from Finding / Decision | Yes — is Issue distinct? |
| Action | No. Fields on Recommendation / Mission / Office | Qualora “corrective action” copy | Other Ventures already have actions as fields | No |
| Recommendation | Consume `intelligence.recommendation-engine` | — | Runtime-required / shared for all current products | No catalogue change |
| Constraint | Consume `intelligence.mission` | Qualora quality constraint; Calviora calving constraint | Today’s constraint already is Mission; Calviora purpose proves reuse | Yes — confirm no Constraint id |
| Control | Not assumed | Qualora control framework until proven otherwise | Another Venture’s need is not in live definitions | Yes |
| Compliance | Status already on PolicyFinding | Compliance *programme* | Status is shared; programme is Qualora-shaped | Yes — status vs programme |
| Assurance | No | Qualora atmosphere / copy | Dies with Qualora HQ metaphor | No |
| Audit | No. Trail = events + persistence | Audit *programme* | Trail helps every Venture; programme is Qualora-shaped | Yes — confirm no Audit capability |
| Policy | Consume `intelligence.policy-engine` | Qualora policy *content* | Runtime-required | No catalogue change |
| Procedure | Not assumed | Until proven ≠ Document / Brain Playbook | Other Ventures can store SOPs as documents | Yes — Procedure vs Document vs Playbook |
| Document | Not a catalogue id today | Do not make Qualora a DMS | `IntelligentDocument` + Brain already serve other Ventures | Yes — leave as HQ artefacts vs later catalogue |
| Record | Consume Memory + persistence | Qualora “quality record” language | Shared memory already exists | No |
| Task | No. `MissionTask` | — | Already on Mission | No |
| Workflow | No. Platform runner, not a capability | Qualora quality workflow *content* | Runner is generic; as a capability it becomes a second Runtime | Yes — keep non-capability |
| Decision | Consume decision-engine + founder-decision | — | Already shared | No catalogue change |
| Knowledge | Consume `intelligence.knowledge-graph` | Qualora knowledge *base* | Brain stays platform system | Yes — Brain ≠ Qualora ops |
| Event | No. Runtime mutations | — | `intelligence.runtime` already orchestrates events | No |
| Timeline | No. View of Event + Decision + Memory | Optional room projection | Other Ventures would benefit from the *view*, not a new store | Yes — confirm projection |
| Investigation | Do not assume shared | Default: Qualora-shaped | Other Ventures’ need is not written | Yes |
| Incident | Do not assume shared | Qualora “quality incident” until proven | Possible for Farmora / Calviora; not in definitions | Yes |
| Exception | Project onto Decision + Finding | — | A waiver is a founder ruling; other Ventures have policies | Yes — Decision vs new object |
| Objective | No. `Sprint.objective` | — | Already on Mission | No |
| Metric | **Refuse** as a capability | Qualora numbers must not become a traffic light | Constitutional: judgement over dashboard; Qualora README forbids a private traffic light | Yes — confirm refuse |
| Operating Health | Consume `intelligence.operating-health` | Farmora “field health” language | Already shared | No |
| Briefing | Consume `intelligence.briefing` | Calviora excludes; Qualora includes | Shared; variation is definition feature | No |
| Memory | Consume `intelligence.executive-memory` | Qualora wording | Already shared | No |
| Story | Consume `intelligence.company-story` | — | Already shared | No |
| Genome | Consume `data.venture-genome` | — | Already shared | No |
| Quality (domain) | No | Qualora purpose | If Qualora disappears, QMS has no other owner | Yes — confirm not a capability |
| Correspondence | No. Office note | Hidden when `executive-office` excluded | Farmora already proves feature variation | No |

---

## 1. Executive Summary

Qualora does not need a private capability catalogue.

Most of the words that sound like “Qualora product” are already VentureOS: policy, finding, evidence fields, recommendation, decision, mission/constraint, risk, memory, health, briefing, genome, story, knowledge graph.

What is Qualora-specific is **purpose and presentation**: quality and evidence operations for regulated work, assurance atmosphere, and copy. Those are Venture projections.

What is **not proven** as shared — Observation, Control, Investigation, Incident, Procedure-as-capability, Compliance programme, Audit programme — must not be added to the registry because Qualora wants them. The test is another Venture’s written need after Qualora is imagined gone.

The dangerous ideas are Workflow-as-capability, Metric-as-capability, and any Qualora-owned Finding/Evidence engine. Those would fork the Runtime or violate the Creed.

This document creates no capabilities. It waits.

---

## 2. Shared Capability Candidates

These are **candidates** only. None are added to the registry by this programme.

| Candidate | Why another Venture still benefits | Safer existing home |
|---|---|---|
| Observation (unjudged fact) | Farmora / Calviora / generic notes | Memory record or knowledge-graph `note` |
| Broader Finding (if founder rejects policy-only) | Any Venture that judges facts that are not executive policies | `intelligence.policy-engine` today |
| Shared evidence object (if founder rejects fields-only) | Every recommendation already carries evidence | `PolicyEvidence` / `SupportingEvidence` |
| Exception as a named waiver type (if Decision is not enough) | Any policy-bearing Venture | `FounderDecisionRecorded` on a finding |

Do not treat Control, Investigation, Incident, Procedure, Compliance programme, or Audit programme as candidates until another definition writes that need.

---

## 3. Venture-only concepts

| Concept | Why it dies with Qualora (or stays product-owned) |
|---|---|
| Assurance | EAS-001 Qualora headquarters metaphor |
| Quality (domain / QMS) | Qualora definition purpose |
| Quality finding / quality risk / quality record / corrective action | Copy on shared objects |
| Evidence *artefacts* of regulated work | Product shape of Document / Record |
| Compliance *programme* | Not named on Calviora, Farmora, or VentureOS Company |
| Audit *programme* | Same |
| Investigation (default) | Not named on other live definitions |
| Qualora visual atmosphere | RM-002 visual programme; IDS; not a capability |

Calviora “calving constraint” and Farmora “field health” are the same kind of thing: product language on Mission and Health.

---

## 4. Concepts requiring founder decisions

1. Evidence — remain fields, or later a shared evidence capability?  
2. Finding — remain policy findings, or a broader shared Finding type?  
3. Observation — new shared fact, or Memory / Knowledge note?  
4. Issue — distinct from Finding, or refuse?  
5. Constraint — confirm it stays Mission / Policy.  
6. Control — Policy content vs future capability vs Qualora-only.  
7. Compliance — status (exists) vs programme (projection).  
8. Audit — confirm trail is events + persistence; no capability.  
9. Procedure — Document vs Brain Playbook vs capability.  
10. Document — remain HQ artefacts, or later catalogue document-intelligence?  
11. Workflow — confirm platform runner stays non-capability and non-Runtime.  
12. Knowledge — confirm Brain is not Qualora operations.  
13. Timeline — confirm projection, not a store.  
14. Investigation — shared only if another Venture’s need is written.  
15. Incident — same.  
16. Exception — Decision ruling vs new object.  
17. Metric — confirm refuse as a capability.  
18. Quality — confirm not a capability id.

No implementation follows these questions until the founder answers.

---

## 5. Architecture risks

1. **Second orchestrator.** Workflow or Investigation as a capability that “runs” quality. The Runtime is the only orchestrator.  
2. **Second catalogue.** Qualora-owned findings, evidence, or records. Capabilities must stay venture-free.  
3. **GRC fork.** Control + Compliance programme + Audit programme + Incident + Investigation as a suite. That is a new product pretending to be the OS.  
4. **Dashboard fork.** Metric capability. Violates judgement over dashboard and Qualora’s no-traffic-light rule.  
5. **Presentation in the registry.** Assurance or atmosphere as a capability. IDS does not declare capabilities.  
6. **Silent Runtime amendment.** Broadening Finding or Evidence in code without a Foundation amendment and founder approval.  
7. **Reserved rooms.** Turning Documents / CRM / Finance into Qualora capabilities. Those routes are empty OS rooms, not product law.

---

## 6. Recommendations

These are recommendations for **decisions**, not for implementation.

1. Treat Qualora as a consumer of the existing shared pack. Do not design a Qualora capability list.  
2. Put Qualora product meaning in definition purpose, Writing Constitution copy, policy library content, and (when the founder opens the visual programme) atmosphere.  
3. Refuse Metric, Assurance, Event, Action, Task, Objective, Record, and Recommendation as new ids.  
4. Keep Workflow as a platform utility. Never register it as a capability in order to “build Qualora.”  
5. Do not fill AI, Security, Communication, or Infrastructure in this programme (IN-004: empty by design).  
6. Do not propose catalogue diffs, Runtime diffs, or definition diffs until the founder answers section 4.

---

## 7. Suggested implementation order

**Do not implement.** This order is what *would* be coherent **after** founder approval of the decisions above. It is not a licence to start.

1. Founder answers section 4 (especially Finding, Evidence, Metric, Workflow, Quality).  
2. If the founder confirms “consume existing capabilities,” Qualora work that follows is projection: copy, atmosphere (RM-002 visual, separately opened), policy *content*.  
3. If the founder approves a **new** shared capability, that is a named Foundation amendment: catalogue + contracts + tests + no venture-specific logic — then Qualora `uses` it. Not this document.  
4. Venture-only concepts never enter the Capability Registry.  
5. Calviora and Farmora remain closed (FD-006 / RM-003–004) and are used here only as the disappearance test.

---

## Success criteria (this programme)

- No application code changed.  
- No Runtime changed.  
- No Capability Framework changed.  
- No Venture Definition changed.  
- The founder has a decision list before Qualora development begins.

**Stop.** Wait for founder approval before proposing implementation.
