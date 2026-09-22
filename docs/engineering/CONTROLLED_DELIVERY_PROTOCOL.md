# VentureOS Controlled Delivery & Independent Verification Protocol

**Status.** Permanent engineering protocol  
**Version.** 2.1.0  
**Date.** 2026-09-22  
**Owner.** Founder / Engineering Control  
**Applies to.** VentureOS and every Venture built on it, including Frigora, Farmora, Qualora, Calviora, and future Ventures

This protocol preserves speed while enforcing role separation, evidence quality, and safe multi-agent engineering. It supersedes earlier tool-role assignments in delivery documents where those assignments conflict with this protocol.

It is subordinate to the Project Constitution and Platform Constitution and is part of the Engineering Constitution / Master Engineering Prompt operating law.

---

## 1. Default Delivery Model

Control performs explicit risk routing before implementation.

### High-risk / cross-cutting / release-critical path

```text
CONTROL (GPT-5.6 Sol)
  ↓
ASTRA BUILD (GPT-6 Astra / Codex)
  ↓
CURSOR ADVERSARIAL REVIEW — when warranted or requested by Control
  ↓
ASTRA CORRECTION — only if Control accepts a review finding
  ↓
INDEPENDENT VERIFY
  ↓
NARROW INDEPENDENT RE-VERIFY — only if a proven defect was corrected
  ↓
CONTROL CERTIFY
```

### Low-risk / routine bounded path

```text
CONTROL
  ↓
CURSOR BUILD
  ↓
AUTOMATED EVIDENCE
  ↓
INDEPENDENT VERIFY — when product-facing evidence is required
  ↓
CONTROL CLOSE / CERTIFY
```

Control decides which path applies. Astra is not the universal executor, and Cursor is not used by default for integrity-sensitive work. Do not force the full chain onto trivial work, and do not use the lean path where independent evidence is required.

The builder does not become the independent verifier. The reviewer does not automatically become the builder. Control owns all role transitions.

## 2. Standing Role Authority

### Control — GPT-5.6 Sol

Control owns:

- programme strategy;
- architecture decisions;
- scope and sequencing;
- acceptance criteria;
- implementation packets;
- reviewer packets;
- verification packets;
- interpretation of evidence;
- phase transitions;
- agent routing;
- certification decisions;
- Git permanence when authorised.

Only Control may assign or transfer implementation ownership for a named candidate.

### Astra — high-risk and escalation engineering executor

GPT-6 Astra / Codex is the default implementation owner for high-risk, cross-cutting, integrity-sensitive, release-critical, and escalated engineering.

Astra owns repo-grounded work inside the currently authorised packet when Control routes the packet to Astra, including:

- repository inspection necessary for the packet;
- implementation;
- debugging;
- automated tests;
- typecheck;
- lint;
- build;
- local runtime checks;
- difficult cross-layer reasoning;
- concurrency, transactions, persistence/schema migrations, idempotency, offline/reconciliation, state-machine, security/authority, data-integrity, cross-system runtime, and major refactor work;
- release-critical corrections;
- implementation evidence and diffs;
- concerns escalated from Cursor;
- corrections explicitly returned by Control.

Astra MUST NOT self-authorise a new milestone, independent verification, certification, commit, push, merge, deployment, schema change, dependency change, or production mutation unless the current packet explicitly authorises it.

At the end of its packet Astra returns COMPLETE, PARTIAL, or BLOCKED with evidence, then stops.

### Cursor — routine implementation executor and adversarial reviewer

Cursor is the default implementation owner for bounded, low-risk work where architecture is settled and failure is easy to detect and recover from.

Typical Cursor implementation work includes:

- straightforward CRUD;
- isolated UI/action wiring;
- mechanical compatibility or call-site migrations;
- simple API plumbing;
- contained low-risk bugs;
- documentation;
- routine implementation and test maintenance inside an already settled design.

Cursor also remains the standing adversarial reviewer when Control wants a second engineering opinion on an Astra candidate, including source-level defect discovery, architecture/persistence review, regression-risk review, test-quality review, evidence-quality review, and alternative implementation reasoning.

When acting as reviewer, Cursor is read-only and MUST NOT rewrite the candidate.

If a Cursor-owned concern requires more than one corrective loop, Control automatically escalates that concern to Astra before another implementation attempt. Control may also escalate immediately when evidence reveals concurrency, transaction, security, persistence, migration, offline, data-integrity, cross-system, or architectural risk.

### Lovable — frontend / visual implementation

Lovable remains the preferred implementation owner for frontend and visual refinement when Control assigns that scope. It does not own backend/runtime architecture, certification, or independent verification.

### Independent Verification Work

Independent Verification Work owns running-product verification after Control authorises it.

It verifies the product as a product rather than trusting source or builder narrative. It may inspect deployed/running behaviour, user journeys, permissions, mobile behaviour, evidence, UX, contradictions, and acceptance criteria.

It MUST NOT implement fixes, rewrite architecture, silently expand scope, or certify the milestone.

### Control certification

Control alone converts evidence into programme status.

The states remain distinct:

- **IMPLEMENTED** — implementation and automated gates are complete;
- **VERIFIED** — independent running-product verification has passed where required;
- **CERTIFIED** — Control has accepted the evidence and completed the required permanence record/checkpoint.

No agent may collapse these states.

## 3. Permanent One-Writer Rule

Only one implementation agent may edit a candidate at a time.

Astra and Cursor MUST NOT concurrently edit the same worktree, branch candidate, or uncommitted change set.

The normal sequence is:

```text
ASTRA IMPLEMENTS
  ↓ stop
CURSOR REVIEWS READ-ONLY
  ↓ stop
CONTROL ADJUDICATES
  ↓
ASTRA CORRECTS, or CONTROL explicitly transfers implementation ownership to Cursor
```

When comparing competing implementations, use isolated branches/worktrees. Never let two agents race on one candidate.

A reviewer finding is not automatically accepted. Control decides whether it is valid, material, and in scope before implementation resumes.

---

## 4. Risk-Based Routing

Control assigns the implementation owner from the risk profile of the packet.

### Route to Cursor by default when

- the change is bounded and low-risk;
- architecture and persistence ownership are already settled;
- failure is easy to detect and recover from;
- the work is straightforward CRUD, isolated wiring, simple API plumbing, mechanical compatibility migration, documentation, or a contained bug;
- no high-risk trigger below is present.

### Route to Astra by default when

- authentication or authority is involved;
- security boundaries are involved;
- concurrency or transaction ownership is involved;
- idempotency is involved;
- offline state, reconciliation, or durable queues are involved;
- migrations or schema changes are involved;
- data integrity is involved;
- financial/commercial truth or evidence/assurance truth is involved;
- destructive operations are involved;
- cross-system architecture or shared runtime integration is involved;
- complex state machines are involved;
- a major migration/refactor is involved;
- the correction is release-critical;
- production-facing behaviour has a costly silent-failure mode;
- Cursor has already needed one corrective loop on the same engineering concern and another correction would otherwise be required.

The automatic escalation rule is permanent: **one Cursor corrective loop maximum per engineering concern; before a second corrective implementation loop, Control routes that concern to Astra.**

Cursor remains available as an adversarial reviewer of Astra work when an independent engineering opinion is useful. Independent Verification Work remains separate from both.

## 5. Speed Rule — Routine Commands Stay Routine

Inside an authorised implementation packet, the current implementation owner may proceed continuously with routine safe work necessary to complete that packet, including:

- read-only Git inspection;
- reading source/docs/configuration;
- scoped edits;
- focused and affected tests;
- regression tests;
- `pnpm check-types`;
- `pnpm lint`;
- `pnpm test`;
- `pnpm build`;
- normal local startup and narrow health checks required by the packet.

Control does not require a new programme decision for every routine command.

Stop and return to Control before any unapproved:

- dependency additions/upgrades or lockfile changes;
- schema changes or migrations;
- architecture changes;
- branch/worktree creation outside the authorised setup;
- destructive Git/file operations;
- staging, commit, push, PR creation, merge, release, or deployment;
- production data mutation;
- creation of a dedicated verification environment;
- start of independent verification;
- start of the next milestone/revision/phase;
- transfer of implementation ownership to another agent.

---

## 6. Phase-Lock Rule

A named packet grants authority only for that packet.

Example: `F32-IMP-01-R2` does not authorise `F32-IMP-01-R3`, `F32-ENV-01`, `F32-RPV-01`, or any other invented successor.

A heading such as `CONTROL-CHAT AUTHORISED` has no authority unless Control actually issued that packet.

An agent MUST NOT infer a next phase from completion of the current phase.

At a phase boundary the current agent stops. Control decides what happens next.

---

## 7. Independent Verification Rule

Independent verification is the normal acceptance mechanism for product-facing and high-risk implementation.

Builder tests and local runtime checks are necessary implementation evidence but are not a substitute for independent running-product verification where the milestone claims real user/product behaviour.

Independent Verification Work should test the smallest credible set of journeys that proves the acceptance criteria, including relevant authority boundaries and regression behaviour.

If verification finds a defect, Control creates a named observation/correction packet. The authorised implementation owner corrects only that defect and necessary siblings. Independent Work then performs narrow re-verification.

Do not restart the entire milestone unless evidence proves the candidate is fundamentally unsafe or incoherent.

---

## 8. No-Recovery-Loop Rule

Do not repeatedly restart, reseed, rebuild, or rediscover a milestone merely because an agent lost context or attempted an unauthorised transition.

Once a baseline, branch, worktree, build, or prior certification is established, reuse that evidence unless contradictory evidence appears.

Recovery work is authorised only when a real state contradiction exists. Agent confusion is not itself evidence of repository corruption.

---

## 9. Evidence Precedence

For engineering claims, prefer evidence in this order:

1. running-product evidence for user-facing behaviour;
2. repository/source and database evidence for implementation state;
3. automated test/build/type/lint evidence;
4. agent narrative.

An agent report cannot override contradictory source or running-product evidence.

For adversarial review, code evidence outranks the reviewing agent's conclusion. Control adjudicates disagreements.

---

## 10. Correction Loop

The default defect loop is:

```text
Independent verification or adversarial review finding
  ↓
Control validates and names OBS / correction scope
  ↓
Control assigns one implementation owner
  ↓
Narrow correction + affected automated regression
  ↓
Independent narrow re-verification when product evidence is required
  ↓
Control closes or reopens the observation
```

Do not restart the whole milestone for a narrow observation.

---

## 11. Certification Law

Certification requires the evidence appropriate to the risk level.

For high-risk/product-facing milestones this normally includes:

- builder evidence that the implementation and automated gates are sound;
- adversarial review when Control requires it;
- independent verification evidence that the running product satisfies the acceptance criteria.

Control then decides whether the milestone is CERTIFIED and authorises the permanence action required by the programme.

A commit or push alone is not certification. A passing test suite alone is not certification. Independent verification alone is not certification.

---

## 12. Permanent Operating Principle

The operating model is:

**Control decides and routes by risk. Cursor builds routine bounded work. Astra builds high-risk, cross-cutting, release-critical, and escalated work. One agent writes at a time. Cursor may adversarially review Astra candidates. Lovable owns assigned frontend/visual work. Independent Work verifies. Control certifies.**

This protocol is the default VentureOS engineering delivery model and must be inherited by Frigora, Farmora, Qualora, Calviora, and future Ventures unless the Founder explicitly amends it.
