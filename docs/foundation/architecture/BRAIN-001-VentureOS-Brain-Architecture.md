# BRAIN-001 — VentureOS Brain Architecture

**Sprint.** VC-001  
**Status.** Approved architecture. Not implemented. Not certified as running Brain.  
**Date.** 2026-08-22  
**Owner.** Architecture  
**Decision.** [ADR-009](./ADR-009-VentureOS-Brain.md)  
**Authority.** Design specification for the VentureOS Brain. Subordinate to the [Project Constitution](../../PROJECT_CONSTITUTION.md) and the [Platform Constitution](../../architecture/VENTUREOS_PLATFORM_CONSTITUTION.md).  
**Does not.** Execute. Amend Runtime, VIC, Capability Registry, Definition Registry, IDS, persistence ownership, Situation Room, Executive Office, or Company HQ. Resume Brain Knowledge Object layout (RM-009).

This document names the Brain as the **operating intelligence substrate** of VentureOS. It does not invent a second orchestrator. It does not turn the Brain desk into a chatbot, a document store, or a search engine.

Technical fact remains in locked sources. Where this design and those sources would conflict in code, the locked source wins until a Foundation amendment is accepted.

| Concern | Source of truth |
|---|---|
| Orchestration | `apps/web/src/core/runtime/README.md` · ADR-001 |
| VIC | `apps/web/src/core/venture/types.ts` · `intelligence.venture-core` |
| Capability catalogue | `apps/web/src/core/capability/catalog.ts` · ADR-002 |
| Definitions | `apps/web/src/core/venture-definition/` · ADR-003 |
| Persistence | `apps/web/src/platform/persistence/README.md` · ADR-005 |
| Institutional catalogue (today) | `apps/web/src/platform/brain/README.md` |
| Operating graph on VIC (today) | `apps/web/src/core/knowledge-graph/` · `intelligence.knowledge-graph` |
| Recommendations and briefing (today) | `apps/web/src/core/recommendation/` · `intelligence.briefing` |
| Executive memory (today) | `apps/web/src/core/executive-memory/` · `intelligence.executive-memory` |

---

## 1. Verdict

The Brain is the single place responsible for organisational memory, semantic understanding, reasoning, recommendations, executive intelligence, knowledge relationships, decision support, and strategic context.

The Brain **provides** that intelligence. The Executive Intelligence Runtime **orchestrates** it. The Venture Intelligence Core **records** the venture-scoped result of a run. The desk **projects** that result.

```
Knowledge Objects ──► Knowledge Graph ──► Memory slices
         │                    │                  │
         └────────────► Reasoning services ◄─────┘
                            │
                            ▼
              Runtime pipeline (unchanged stages)
                            │
                            ▼
                         VIC snapshot
                            │
          ┌─────────────────┼─────────────────┐
          ▼                 ▼                 ▼
   Situation Room    Executive Office    Company HQ
```

Qualora, Calviora, Farmora, and every future Venture **inherit** this Brain. They do not fork it. They do not own a private knowledge product. A product may exclude a **capability** (Calviora excludes `intelligence.briefing`); it may not replace the Brain.

---

## 2. What the Brain is

The Brain is operating intelligence.

It understands typed organisational facts, how they relate, how confident those relations are, what they imply for the founder, and what should be remembered after a decision.

It is **not**:

| Impostor | Why it is forbidden |
|---|---|
| An AI chatbot | Runtime is deterministic. Intelligence recommends. The founder decides. Chat is not orchestration. |
| A document store | Company HQ holds documents as company artefacts. `IntelligentDocument` remains a thin HQ list. The Brain holds **meaning**, not files. |
| A search engine | `platform/brain/query.ts` is a desk finder over the institutional catalogue. Substring search is not semantic understanding. Embeddings are not the Brain. |
| A second Runtime | Pages and Brain services do not call `runExecutiveIntelligenceRuntime`. Engines never depend on the Runtime. ADR-001 stands. |
| A Product Registry | Products remain Venture Definitions. ADR-003 stands. |
| A Qualora knowledge base | Discovery RM-002: Brain stays a platform system. Qualora operations project onto Brain; they do not fork it. |

---

## 3. What already exists (do not redesign)

VC-001 unifies ownership. It does not relocate these systems.

| Existing system | Brain role after VC-001 |
|---|---|
| `platform/brain` Knowledge Objects | **Institutional plane** of the Knowledge Object model (Constitution, Standard, Playbook, …). |
| `modules/brain` | **Brain desk** — presentation of the institutional plane. Shell. Not the reasoning engine. |
| `core/knowledge-graph` on each Venture | **Operating graph projection** onto VIC. Refreshed in the existing `knowledge-graph` stage. |
| `core/recommendation` + `briefing.ts` | **Reasoning and executive-intelligence products**. Still hydrated in the `recommendation-engine` stage. |
| `core/recommendation/confidence.ts` | **Confidence scoring**. Extend; do not replace. |
| `core/executive-memory` | **Executive and venture memory** as VIC slices. Still applied in `apply-event`. Memory is not a new Runtime stage. |
| `core/decision-engine` | **Decision queue projection** on VIC. Founder rulings still enter only through Runtime events. |
| `core/document-intelligence` | HQ document index. Not the Knowledge Object record. |
| `intelligence.*` capabilities | Governance metadata. The registry still does not dispatch. |

No eighth Runtime stage. A `brain-reason` stage would require a Foundation amendment. Brain services are **engines** imported by existing stages, the same way `hydrateRecommendations` and `refreshKnowledgeGraph` already are.

---

## 4. Subsystem diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         FOUNDER / DESK                          │
│   Situation Room     Executive Office     Company HQ     Brain  │
│   (project VIC)      (project VIC)        (artefacts)    (KO    │
│                                                           desk) │
└────────────▲────────────────▲────────────────▲────────────▲─────┘
             │                │                │            │
             │         presentation only — no orchestration │
             └────────────────┴────────────────┴────────────┘
                              │
                              │ intelligence service persists
                              │ mutation snapshots (ADR-005)
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│            EXECUTIVE INTELLIGENCE RUNTIME (locked)              │
│  1 resolve-capabilities                                         │
│  2 enforce-instance-profiles                                    │
│  3 apply-event          ── uses Memory writes, decisions, story │
│  4 policy-evaluation                                            │
│  5 recommendation-engine ── calls Reasoning + Briefing products │
│  6 operating-health                                             │
│  7 knowledge-graph      ── projects Graph onto the venture      │
│                                                                 │
│  Entry: runExecutiveIntelligenceRuntime only                    │
└────────────▲──────────────────────────────────────────▲─────────┘
             │ consumes                                 │ consumes
             │                                          │
┌────────────┴──────────────────────────────────────────┴─────────┐
│                    VENTUREOS BRAIN (this spec)                  │
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────────────┐  │
│  │ Knowledge    │  │ Knowledge    │  │ Memory                │  │
│  │ Object       │◄─┤ Graph        │  │ working · session     │  │
│  │ System       │  │ (edges +     │  │ venture · executive   │  │
│  │ institutional│  │  walks)      │  │ long-term · ageing    │  │
│  │ + operating  │  └──────┬───────┘  └──────────┬────────────┘  │
│  └──────┬───────┘         │                     │               │
│         └─────────────────┼─────────────────────┘               │
│                           ▼                                     │
│              ┌─────────────────────────┐                        │
│              │ Reasoning services      │                        │
│              │ context · evidence      │                        │
│              │ confidence · conflict   │                        │
│              │ recommend · explain     │                        │
│              └────────────┬────────────┘                        │
│                           │                                     │
│              ┌────────────▼────────────┐                        │
│              │ Learning                │                        │
│              │ feedback · correction   │                        │
│              │ confidence adj. · explain│                       │
│              └─────────────────────────┘                        │
└─────────────────────────────────────────────────────────────────┘
             │
             │ objects persist through platform persistence
             │ (repositories CRUD; they do not reason)
             ▼
┌─────────────────────────────────────────────────────────────────┐
│ Platform identity · Workspace Engine · Definition Registry      │
│ Capability Registry · IDS                                       │
│ (Brain does not own these. Brain does not import Runtime.)      │
└─────────────────────────────────────────────────────────────────┘
```

VIC (`VentureIntelligenceCore`) sits **after** a Runtime run: founder, office, briefing, health, memory, decisions, recommendations, policy, ventures. Brain does not become a second core.

---

## 5. Bounded contexts

| Context | Responsibility | Lives with (today) | Does not |
|---|---|---|---|
| **Knowledge Object System** | Typed organisational facts. Institutional and operating planes. Versioning and history. | `platform/brain` (institutional only today) | Store files. Authenticate. Instantiate products. |
| **Knowledge Graph** | Typed edges. Walks. Conflict and support topology. VIC projection. | `core/knowledge-graph` | Be a general-purpose graph database (`intelligence.knowledge-graph` limitation stands). |
| **Memory** | Working, session, venture, executive, long-term, ageing. | `core/executive-memory` + KO `history` | Invent narrative. Own sessions (platform identity owns sessions). |
| **Reasoning** | Context assembly, weighting, confidence, conflict, recommendation, explanation. | `core/recommendation`, `confidence.ts`, `ReasonQuery` | Orchestrate. Chat. Call the Runtime. |
| **Executive intelligence products** | Morning Brief, Executive Brief, queues, risk summary, weekly review, alerts. | `assembleMorningIntelligence`, `assembleExecutiveBriefing` | New rooms. Costume excluded capabilities. |
| **Learning** | Feedback, correction, confidence adjustment, human approval, explanation. | Founder-decision events; KO history | Silent auto-rewrite of approved knowledge. |
| **Brain desk** | Founder-facing institutional catalogue. | `modules/brain` | Operating HQ. Situation Room. Search-as-intelligence. |

### Context map (inheritance)

```
Platform Brain (shared)
    │
    ├── Institutional plane  →  all Ventures read (scope Platform)
    └── Operating plane      →  scoped to workspace + venture
            │
            ├── Qualora     (inherits; projects quality operations onto KOs)
            ├── Calviora    (inherits; briefing product skipped by definition)
            ├── Farmora     (inherits; office feature may be excluded)
            └── future Venture
```

Cross-venture reasoning is allowed **only** inside one workspace, through the graph, for objects the founder is entitled to see. A Venture does not read another Venture’s operating plane by importing a second Brain.

---

## 6. Knowledge Objects

Everything the Brain knows is a Knowledge Object. Surfaces, VIC slices, and graph nodes are **projections** of objects, not parallel records.

### 6.1 Kernel (already required on institutional objects)

Retain the locked layout fields. Operating types use the same kernel.

| Field | Role |
|---|---|
| `id` | Stable identity. Relationships resolve by id (`assertKnowledgeCatalogue` already fails on broken ids). |
| `type` | Discriminant. Not a second schema. |
| `title` `summary` `purpose` `why` | Judgement, not file metadata. |
| `evidence` | Named bases. A recommendation without named evidence is unfinished (Project Constitution). |
| `relationships` | Ids of other objects. Typed edges live on the graph; the object keeps the incident list. |
| `history` | Version narrative. |
| `owner` | Accountable person or role. Not a plugin. |
| `status` | `Approved` · `Living` · `Specified` · `Concept` (extend later only with amendment). |
| `reviewDate` `lastReview` `version` | Ageing and versioning. |
| `aiContext` | Explanation seed for reasoning. Not a prompt that executes. |
| `scopes` | `Platform` · `Qualora` · `Calviora` · `Farmora` (already `BrainVentureScope`). |

Decision objects already add `impact`, `alternatives`, `issuedAt`. That pattern is the rule: **kernel + type payload**. Do not invent a second object table per type.

### 6.2 Planes

| Plane | What it is | Examples |
|---|---|---|
| **Institutional** | Platform teaching and governance knowledge. Today’s catalogue. | Constitution, Architecture, Standard, Policy, Playbook, Roadmap, Blueprint, Research, Decision (governance). |
| **Operating** | Facts of companies the founder operates. | Company, Person, Procedure, Evidence, Meeting, Decision (operating), Risk, Task, Goal, Project, Incident, Provider, Inspection, Customer, Contract, Document. |

One type family. Two planes. Same graph. Institutional objects are inherited by every Venture. Operating objects are venture- and workspace-scoped.

### 6.3 Type catalogue (operating)

Each type is a discriminant plus a payload. Payloads are facts the Brain can reason over. They are not screens.

| Type | Payload (architecture) | Projects onto |
|---|---|---|
| **Company** | Legal/operating name, definition ref, workspace, stage, genome pointers. | `Venture.identity` + `VentureGenome`. Does not instantiate; founding remains Runtime. |
| **Person** | Role, remit, relation to Company. | Executive seating / membership **facts**, not auth identity. |
| **Policy** | Institutional or operating policy text, owner, severity class. | Policy engine findings consume; they do not store the policy body twice. |
| **Procedure** | Steps as knowledge, not a workflow runner. | Until founder decides otherwise (RM-002), Procedure is a KO, not a capability. Platform `createWorkflowEngine` remains a step runner, not a procedure library. |
| **Evidence** | Source, captured-at, object supported, weight class. | `SupportingEvidence` on recommendations. |
| **Meeting** | When, attendees (Person ids), decisions spawned. | Story / memory, not a calendar product. |
| **Decision** | Question, alternatives, owner role, status, ruling. | `DecisionEngine` items on VIC. **One type.** Governance vs operating is `scopes` + `impact`, not a second type. |
| **Risk** | Headline, signal, mitigation, owner. | `RiskIntelligence`. |
| **Task** | Outcome owed, owner, blocker ids. | Mission / recommendation action. Not a generic kanban product. |
| **Goal** | Objective, horizon, supporting tasks. | Mission sprint objective. |
| **Project** | Outcome, company, goal ids. | Company HQ artefact, not a second PM OS. |
| **Incident** | What broke, evidence, follow-up decisions. | Risk + story. |
| **Provider** | Who supplies, contracts, inspections. | Operating graph; Qualora/Calviora/Farmora project domain meaning. |
| **Inspection** | Subject, outcome, evidence, next due. | Evidence + risk. |
| **Customer** | Relationship facts. Not a CRM suite. | Operating graph. Reserved CRM rooms stay excluded. |
| **Contract** | Parties, term, obligations, evidence. | Provider / Customer edges. |
| **Document** | Kind, status, summary, evidence-of. | `IntelligentDocument` is the HQ index row. The KO is the meaning. |

Institutional types remain as locked in `KNOWLEDGE_TYPES`. Do not collapse Constitution into Company.

### 6.4 Identity and correlation

- A Company KO `id` correlates with `Venture.identity.id` after founding. Brain does not assign product ids; Product Bootstrap and the Definition Registry do.
- A Person KO is not a session user. Platform identity remains the auth record (ADR-006). The Brain may **point at** an identity id as a property; it does not import Runtime or own cookies.
- Founder decisions enter VIC only through `FounderDecisionRecorded` after `venture.update`. Creating a Decision KO that bypasses that event is unconstitutional.

### 6.5 Representation invariant

```
KnowledgeObject
  = kernel
  + type discriminant
  + type payload
  + plane (institutional | operating)
  + scope[]
```

Graph node `kind` is a **projection of `type`**, not a parallel taxonomy. Today’s node kinds (`founder`, `venture`, `decision`, `risk`, `document`, …) must map onto object types. New kinds require this architecture to be amended, not a silent enum in a screen.

---

## 7. Knowledge Graph

### 7.1 Role

The graph is how objects connect. It is not the object store. Nodes are identities + kind + label + properties. Edges are typed, directed, and stable by id (refresh is already idempotent for founder-owns-venture).

VIC `Venture.knowledge` is a **scoped projection** produced in stage `knowledge-graph`. The Brain graph is the full index (institutional + operating). The projection includes the venture node, its operating neighbourhood, and institutional objects that `supports` / `constrains` that neighbourhood.

`intelligence.knowledge-graph` remains: “Venture nodes and ownership edges on the intelligence document.” Not a general-purpose graph database.

### 7.2 Edge types

Existing kinds stay. VC-001 **extends** the vocabulary. It does not fork a second edge enum.

| Kind | Direction (from → to) | Meaning | Today |
|---|---|---|---|
| `owns` | founder/person → company/object | Accountability. | Exists (`owns`). |
| `owned_by` | object → person/company | Inverse of owns. Prefer storing one direction; derive the inverse. | Sprint name; map to `owns` inverse. |
| `member_of` | person → company/workspace | Affiliation. | Exists. |
| `contains` | company/project → child | Composition. | Exists. |
| `seated_in` | executive → office | Seating. | Exists. |
| `created_by` | object → person | Provenance. | New. |
| `informs` | object → decision/briefing | Context without proof. | Exists. |
| `evidence_for` | evidence/document → claim/decision/risk | Named basis. | New (sprint `evidence for`). |
| `supports` | object → object | Consistent with. | New. |
| `contradicts` | object → object | Conflict. Triggers conflict detection. | New. |
| `depends_on` | task/project/procedure → object | Prerequisite. | New. |
| `blocked_by` | object → object | Cannot proceed. | New. |
| `related_to` | object → object | Weak link. Use sparingly. | Exists (`related_to`). |
| `derived_from` | object → object | Produced from. | Exists. |
| `replaces` / `supersedes` | newer → older | Succession. Ageing treats the older as historical. | New (one kind: `supersedes`; `replaces` is an alias). |
| `mitigates` | action/policy → risk | Treatment. | Exists. |

Do not add `etc.` as a kind. Unknown kinds fail closed.

### 7.3 Walks

`ReasonQuery` (`fromId`, optional `relation`, optional `depth`) already describes bounded walks. Reasoning uses walks, not full-graph scans.

Rules:

- Default depth is small (neighbourhood of the focus venture and the open decision).
- `contradicts` and `supersedes` are always followed when assembling evidence for a recommendation.
- Cross-document reasoning is a walk across Document / Evidence / Policy / Decision objects.
- Cross-venture reasoning is a walk that may leave a venture node only through `member_of` / `owns` inside the **same workspace**. It never crosses workspace tenancy.

---

## 8. Reasoning Engine

Architecture, not implementation. The engine is a **pure function of assembled context**. Same objects, same graph, same VIC facts, same event → same recommendations and briefing (Runtime determinism).

It is not a model that improvises. Language models, if ever used, may **draft explanation copy from already-selected facts**. They may not select evidence, set confidence, or issue recommendations. That remains the engine.

### 8.1 Context assembly

Order:

1. **Focus.** Event and current venture (existing `focusVenture`: primary recommendation’s venture, else today’s active mission, else first venture).
2. **VIC slice.** Identity, genome, mission, health, policy findings, open decisions, risk headline, story, office seating.
3. **Working memory.** Facts produced earlier in this Runtime run (policy findings before recommendations — existing pipeline order).
4. **Graph neighbourhood.** Walk from the venture node and from each open decision / primary risk.
5. **Institutional constraints.** Platform KOs linked by `supports` / `contradicts` / `supersedes` (Creed, Runtime constitution, policies).
6. **Memory slice.** Executive and venture records flagged `briefing` or relevant by edge.
7. **Definition constraints.** Instance profiles and excluded capabilities (Calviora: do not assemble briefing).

Context is a structured bundle with object ids. It is not a prompt window.

### 8.2 Evidence weighting

Each `SupportingEvidence` already names `source` (`health` | `mission` | `decision` | `risk` | `memory` | `story` | `office` | `genome` | `policy`). Brain adds object-id linkage and a weight class:

| Class | Meaning |
|---|---|
| **Primary** | Direct `evidence_for` the claim. Policy finding. Open founder decision. |
| **Supporting** | `supports` / `informs` / memory / story. |
| **Historical** | `supersedes` target; aged past `reviewDate`; resolved decision. |
| **Contested** | Object also sits on a `contradicts` edge. |

Weighting prefers primary over supporting, current over historical, uncontested over contested. Count of evidence already feeds `scoreConfidence` (`evidenceCount`). Brain must not invent evidence to raise a score.

### 8.3 Confidence

Keep the existing 0–100 score and labels High ≥ 80 / Moderate ≥ 60 / Low.

Existing inputs: evidence count, health band, consensus alignment, memory support, open decision, policy severity.

Brain extends the same function, still pure:

- Contested evidence **lowers** score.
- Aged evidence (`reviewDate` overdue, status `Living` without review) **lowers** score.
- `supersedes` without the new object Approved **lowers** score.
- Human rejection of a prior sibling recommendation (learning) **lowers** score; approval **does not** auto-raise past the evidence.

Low confidence is visible. It does not hide the recommendation. Fail visibly.

### 8.4 Conflict detection

A conflict exists when:

- Two objects in the assembled context are joined by `contradicts`.
- Two policies or findings prescribe incompatible actions for the same venture.
- A living object `supports` a claim that a newer Approved object `supersedes`.
- Executive consensus is `split` or `weak` on the primary recommendation (already modelled).

Conflicts are **first-class outputs** of reasoning: cited object ids, edge ids, and a sentence of implication. They are not swallowed. They may raise priority (the founder must see the contradiction) while lowering confidence.

### 8.5 Recommendation generation

Still `hydrateRecommendations` inside stage `recommendation-engine`. Still derived from policy findings, not page copy (`intelligence.recommendation-engine` guarantee).

Brain’s job is to **ground** each recommendation:

- `reason` cites object ids.
- `supportingEvidence` includes graph-backed bases.
- `originatingPolicyId` remains.
- `recommendedAction` remains a founder action, not an automated mutation.

Recommendations do not write Knowledge Objects. Accepting or rejecting is a Runtime event (learning).

### 8.6 Decision reasoning

Open `Decision` KOs / `DecisionEngine` items are the decision queue. Reasoning attaches:

- The recommendation that answers `question`.
- Cost of inaction (already on `Decision`).
- Alternatives (already on institutional Decision KOs; operating decisions reuse that payload).
- Evidence and conflicts.

The Brain does not resolve the decision. `FounderDecisionRecorded` does.

### 8.7 Cross-document reasoning

Walk Document → Evidence → Policy/Decision/Risk. The engine may conclude that two documents `contradict` or that a procedure `depends_on` a policy that was `supersedes`d. That conclusion is a conflict or a recommendation, not a search hit.

### 8.8 Cross-venture reasoning

Allowed inside one workspace when the founder operates multiple companies. The engine may compare risks, shared providers, or a platform policy that `supports` all ventures.

Forbidden:

- Reading another workspace’s operating plane.
- Qualora logic inside a Farmora object type.
- A product-specific reasoner that bypasses the shared engine.

Calviora still skips **briefing assembly**. Cross-venture reasoning may still produce recommendations on the VIC; Situation Room must not costume a briefing.

---

## 9. Memory Architecture

Memory is not a Runtime stage. Writes occur in `apply-event` and on Knowledge Object history. Reads occur during context assembly.

| Layer | Span | Store | Forgets when |
|---|---|---|---|
| **Working** | One Runtime run | In-process context bundle | The run ends. Never persisted as working memory. |
| **Session** | Founder session | Platform session (identity). Brain may keep an ephemeral focus list (last venture, last decision) keyed by session, not by KO. | Session ends. Brain does not persist auth. |
| **Venture** | Company lifetime | `Venture.memory` on VIC + operating KOs scoped to that company. | Object `supersedes` or status leaves Approved/Living. |
| **Executive** | Role + desk | `MemoryRecord` with `ownerRoleId`, `desk`, `briefing` flags (already). | Explicit correction; not silent drop. |
| **Long-term** | Platform + company | Institutional KOs + Approved operating KOs + version history. | Never silently. Ageing reduces **weight**, not existence. |

### 9.1 Retention and ageing

- `reviewDate` overdue → evidence class Historical unless re-reviewed.
- `supersedes` → superseded object remains as history; walks treat it as non-primary.
- Status `Concept` / `Specified` never outranks `Approved` in weighting.
- Knowledge retention is constitutional: the desk must remember founder calls (`intelligence.executive-memory`). Ageing is about **confidence**, not amnesia.

### 9.2 Versioning

Already on the kernel (`version`, `history[]`). Every correction appends history. Reasoning cites a version. Replay of Runtime events remains idempotent; memory records stay idempotent by identity.

---

## 10. Executive Intelligence

These are **products of reasoning**, assembled by existing briefing functions, projected by existing rooms. They are not Brain routes and not new shells.

| Product | Assembly | Surface today | Notes |
|---|---|---|---|
| **Morning Brief** | `assembleMorningIntelligence` — action, judgement, opportunity, risk, outcome. | Situation Room | Skip when instance cannot consume `intelligence.briefing`. |
| **Executive Brief** | `assembleExecutiveBriefing` — headline, narrative, implications. | Situation Room / Office | Same skip rule. |
| **Decision Queue** | Open `Decision` items, ranked by `decideBy` and priority. | Situation Room Critical Decisions; Office upcoming. | |
| **Priority Queue** | `sortRecommendations` / primary flag. | Office recommendations; Situation Room today’s mission. | |
| **Risk Summary** | Primary risk + policy findings + `contradicts` neighbourhood. | Operating health + briefing risk implication. | |
| **Weekly Review** | Cadence projection: resolved decisions, aged objects, recurring risks, learning deltas. | Not a new room. A briefing variant with a week horizon. | Not implemented. Do not invent a fourth desk. |
| **Recommendations** | Recommendation engine. | Office + Situation Room. | |
| **Strategic Alerts** | Critical/high items with conflict, ageing, or blocked_by edges. | Fail visibly on the existing primary action / health judgement. | Not a notification product. |

Brain produces the payload. Runtime runs assembly. Rooms display. Company HQ does not become a brief. The Brain desk does not become the Situation Room.

---

## 11. Learning

Intelligence that cannot learn from the founder will repeat itself. Learning is a **closed loop through Runtime events**, not a background trainer.

```
Recommendation / Decision (explained)
        │
        ▼
Founder rules (FounderDecisionRecorded)  or  KO correction (history+)
        │
        ▼
Memory record + confidence prior for sibling cases
        │
        ▼
Next Runtime run assembles context including that prior
```

| Loop | Mechanism |
|---|---|
| **Feedback** | Accept, reject, or defer is a founder decision (or equivalent event). Stance is stored as memory + edges (`supports` / `contradicts` the recommendation’s evidence). |
| **Knowledge correction** | Edit the Knowledge Object. Append `history`. Optionally `supersedes` the previous version. Status and review dates update. |
| **Confidence adjustment** | Next `scoreConfidence` sees memory support, rejection priors, and contested flags. No unsupervised weight drift. |
| **Human approval** | The founder is the principal. Automation does not approve knowledge into `Approved`. Institutional objects already use status. |
| **Explanation layer** | Every recommendation already has `reason` and `supportingEvidence`. Brain requires those to cite object ids and edge kinds. `aiContext` on objects is the teaching note for explanation, not an executable prompt. If copy cannot name the basis, the recommendation does not ship. |

Learning must not rewrite Creed, Runtime constitution, or Approved institutional objects without the same governance those objects already require.

---

## 12. Responsibilities and dependencies

### 12.1 Responsibilities

| Actor | Does |
|---|---|
| Brain (objects, graph, memory, reasoning, learning) | Represent facts, relate them, remember, reason, explain. |
| Runtime | The only orchestrator. Apply events. Call engines. Return VIC. |
| Capability Registry | Catalogue `intelligence.*`. Validate. Do not dispatch Brain. |
| Definition Registry | Which capabilities a Venture may consume (e.g. briefing). |
| Persistence | CRUD for snapshots and, when implemented, KO rows. No reasoning. |
| Intelligence service | Persist Runtime mutation snapshots only. |
| Platform identity / Workspace Engine | Session, tenancy, membership. |
| Situation Room / Office / HQ | Project VIC. |
| Brain desk | Project institutional KOs. |
| IDS | Clothe the desk. |

### 12.2 Dependency direction

```
modules/* (desk)
    → VIC snapshots / brain query  (read)
         ╳  must not import runExecutiveIntelligenceRuntime

Runtime
    → Brain engines (recommendation, graph refresh, memory apply)
         ╳  Brain engines must not import Runtime

Brain engines
    → Knowledge Object kernel, graph types, memory types
    → may read persistence ports
         ╳  must not import IDS, shell, definitions-as-executors

Capability Registry
    → manifests only
         ╳  must not call Brain

Definitions
    → metadata (exclude briefing, exclude office, …)
         ╳  must not execute Brain
```

### 12.3 Interfaces (contracts, not code)

| Interface | Consumer | Provider | Guarantee |
|---|---|---|---|
| `assembleContext(event, core)` | recommendation / briefing engines | Brain reasoning | Deterministic bundle of object ids + VIC facts. |
| `detectConflicts(context)` | recommendation engine | Graph + reasoning | Cited `contradicts` / supersession / split consensus. |
| `scoreConfidence(inputs)` | recommendation engine | existing confidence module | 0–100 + label. |
| `hydrateRecommendations(core)` | Runtime stage 5 | existing engine, Brain-grounded | Findings → recommendations. |
| `assembleMorningIntelligence(core)` | stage 5 (briefing) | existing briefing | Skip if capability excluded. |
| `refreshKnowledgeGraph(core)` | Runtime stage 7 | existing effect, later full projection | Idempotent founder-owns-venture; later neighbourhood. |
| `recordMemory(event)` | `apply-event` | executive-memory | Idempotent by identity. |
| `getKnowledgeObject(id)` | Brain desk; reasoning | object system | Fail if missing (catalogue assert). |
| `explain(recommendationId)` | Office / Situation Room | reasoning | Object ids + edge kinds + reason sentence. |

No HTTP facade required. Empty `src/api/*` barrels stay unused. Do not invent a Brain API layer to impersonate Runtime.

---

## 13. Invariants

1. `runExecutiveIntelligenceRuntime` is the only intelligence orchestrator.
2. Brain engines never depend on the Runtime. The Runtime may import Brain engines.
3. Pages, navigation, and the Brain desk never run the pipeline.
4. VIC remains the venture-scoped document of record after a run.
5. Capabilities govern; they do not dispatch Brain.
6. Definitions do not execute. Excluded briefing stays excluded.
7. One Knowledge Object kernel. No parallel schema per product.
8. One Decision type. Governance vs operating is scope and impact.
9. One graph vocabulary. VIC graph is a projection.
10. Recommendations require named evidence.
11. Same core + same event → same Brain outputs (deterministic).
12. Founder decisions enter VIC only through Runtime events.
13. Persistence does not reason. IDS does not reason.
14. Qualora, Calviora, and Farmora inherit Brain; they do not fork it.
15. Cross-venture walks never cross workspace tenancy.
16. No eighth Runtime stage without a Foundation amendment (ADR).
17. Brain is not a chatbot, document manager, or search engine.
18. Fail visibly: conflict, low confidence, and missing evidence are shown, not costumed.

---

## 14. Boundaries (must never)

| Must never | Remains |
|---|---|
| Replace the Runtime | ADR-001 · `runExecutiveIntelligenceRuntime` |
| Replace VIC | `intelligence.venture-core` · `VentureIntelligenceCore` |
| Replace the Capability Registry | ADR-002 |
| Replace Venture Definitions | ADR-003 · no Product Registry |
| Replace the Executive Office | Seated judgement surface. Consumes recommendations; does not reason. |
| Replace the Situation Room | Daily brief surface. Consumes briefing; does not assemble it in the page. |
| Replace Company HQ | Company as artefact. Documents stay HQ index + KO meaning. |
| Become persistence | TD-009: catalogue is in-memory today. Promoting storage is persistence work, not Brain becoming the database. |
| Become IDS | Presentation constitution unchanged. |
| Resume KO layout inside this architecture | RM-009 remains a named later sprint. |

---

## 15. Risks

| Risk | Why it matters | Mitigation |
|---|---|---|
| Brain is implemented as a second orchestrator | Breaks ADR-001. | Engines only; no new pipeline stage; desks remain read-only. |
| Qualora ships a private knowledge base | Forks the OS (RM-002). | Operating types are shared; product meaning is projection. |
| Three Decision systems | Catalogue Decision vs VIC Decision vs graph `decision` node. | One KO type; VIC and graph are projections. |
| Procedure becomes a capability by default | Duplicate of Document / Playbook (RM-002). | Procedure is a KO until founder decides otherwise. |
| Embeddings / chat added as “semantics” | Brain becomes a search engine or chatbot. | Semantics are types + edges + deterministic walks. |
| Eighth Runtime stage slipped in | Constitutional amendment smuggled into a feature. | Invariant 16. |
| KO layout resumed as this sprint | Mixes presentation programme with intelligence architecture. | RM-009 stays paused. |
| Persistence of operating KOs treated as Brain | Repositories start to reason. | ADR-005: intelligence service persists Runtime snapshots; object CRUD is mapping only. |
| Calviora briefing costumed via Brain desk | Hidden feature restore. | Briefing skip remains a Runtime/definition rule. |
| Cross-venture leak | Tenancy break. | Workspace-scoped walks. |
| Confidence theatre | Scores without evidence. | Constitution: unexplained recommendations do not ship. |

---

## 16. Assumptions

| ID | Assumption |
|---|---|
| A-B1 | Founder accepts Brain as platform intelligence substrate, not as a product and not as Runtime. |
| A-B2 | Institutional catalogue types remain valid and are the institutional plane. |
| A-B3 | Existing recommendation, briefing, memory, and graph engines are the first implementations of Brain services (evolved, not replaced). |
| A-B4 | SQLite remains sufficient for Foundation persistence when operating KOs leave in-memory (A-003). That is a persistence programme, not this architecture. |
| A-B5 | Procedure ≠ workflow runner unless a later founder decision says so. |
| A-B6 | Customer / Contract / Provider types do not authorise a CRM or finance suite. |
| A-B7 | Weekly Review is a briefing cadence, not a fourth room. |
| A-B8 | Language models, if introduced later, draft explanation only after the engine has selected facts. |
| A-B9 | Founder accepted this architecture (VC-001) and ADR-009 (VC-003). Acceptance is governance, not implementation certification. |

---

## 17. Future expansion

In order. None of these are VC-001 implementation.

1. **Founder acceptance** of this architecture. Then ADR (Brain is substrate; Runtime remains orchestrator).
2. **Object kernel extension** — plane, typed edges on relationships, operating type payloads — without changing Runtime entry.
3. **Graph vocabulary extension** — `contradicts`, `evidence_for`, `supersedes`, `depends_on`, `blocked_by` — still projected by stage 7.
4. **Ground recommendations** in object ids (explanation layer) inside existing `hydrateRecommendations`.
5. **Conflict detection** as structured output on the recommendation / briefing payload.
6. **Persistence of operating KOs** (closes TD-009 for operating plane). Institutional catalogue may remain authored until a later programme. Not a second database.
7. **Weekly Review** projection on Situation Room / Office — still `intelligence.briefing` family; still skipped for Calviora.
8. **RM-009** Knowledge Object layout — presentation only, after the kernel is stable.
9. **Product projections** (Qualora inspections, Farmora providers) as payloads on shared types — never as a forked Brain.
10. **Optional explanation drafter** (copy only) — constitutional constraints above.

Out of order on purpose: chat UI, vector search as Brain, Brain API gateway, eighth Runtime stage, Product Registry, Midnight climate, restoring excluded features.

---

## 18. What VC-001 does not do

- Implement code.
- Redesign Runtime, VIC, registries, rooms, or IDS.
- Certify Brain as persistence or as a second Runtime.
- Close TD-009 or RM-009.
- Add capabilities to the registry (no `brain.*` dispatch id). If a capability is ever needed, it is governance metadata for a Brain engine already imported by Runtime — never a plugin.

---

## 19. Close-out (documentation sprint)

**Objective.** Design the VentureOS Brain. Complete as architecture. Not implemented.

**Protected.** Runtime pipeline, VIC, Capability Registry, Definition Registry, Situation Room, Executive Office, Company HQ, IDS, persistence ownership.

**Named change (design only).** Brain is the intelligence substrate: Knowledge Objects (two planes), graph, memory layers, reasoning services, executive-intelligence products, learning loops — consumed by existing Runtime stages.

**Remaining risk.** Implementation that quietly adds an orchestrator, a Qualora knowledge product, or a chat. This document exists so that sprint is refused.
