# VentureOS Controlled Delivery & Independent Verification Protocol

**Status.** Permanent engineering protocol  
**Version.** 1.0.0  
**Date.** 2026-09-12  
**Owner.** Founder / Engineering Control  
**Applies to.** VentureOS and every Venture built on it, including Frigora, Farmora, Qualora, Calviora, and future Ventures

This protocol exists to preserve the speed of the original VentureOS build workflow while preventing AI agents from self-promoting into unauthorised phases, repeatedly re-auditing settled evidence, or verifying their own implementation as if that were independent evidence.

It is subordinate to the Project Constitution and Platform Constitution and is part of the Engineering Constitution / Master Engineering Prompt operating law.

---

## 1. Default Delivery Pipeline

The default VentureOS delivery pipeline is:

```text
CONTROL
  ↓
CURSOR BUILD
  ↓
INDEPENDENT VERIFY
  ↓
CURSOR FIX — only if verification finds a defect
  ↓
NARROW INDEPENDENT RE-VERIFY
  ↓
CONTROL CERTIFY
```

This is the default unless the Founder / Control explicitly authorises a different sequence for a named programme.

The pipeline is deliberately asymmetric: the builder does not become the independent verifier, and the verifier does not become the builder.

---

## 2. Role Authority

### Control

Control owns:

- programme strategy;
- architecture decisions;
- scope and sequencing;
- acceptance criteria;
- implementation packets;
- verification packets;
- interpretation of evidence;
- phase transitions;
- certification decisions;
- Git permanence when certification requires it.

Only Control may authorise movement from one named programme step to another.

### Cursor / implementation agent

Cursor owns repo-grounded implementation work inside the currently authorised packet:

- repository inspection necessary for the packet;
- implementation;
- debugging;
- automated tests;
- typecheck;
- lint;
- build;
- narrow local runtime checks;
- diffs and implementation evidence;
- correction of defects explicitly returned by Control.

Cursor MUST NOT:

- invent a new milestone, revision, recovery phase, verification phase, or environment phase;
- self-authorise a transition from implementation to verification;
- treat its own runtime checks as independent verification;
- start certification;
- stage, commit, push, deploy, reset shared history, or mutate production unless the current packet explicitly authorises it;
- reopen a certified earlier milestone without new evidence and Control authority.

At the end of its authorised packet, Cursor returns one of: COMPLETE, PARTIAL, or BLOCKED, with evidence, then stops.

### Independent Verification Work

Independent Verification Work owns running-product verification after Control authorises it.

It verifies the product as a product rather than as source code. It may inspect deployed/running behaviour, user journeys, permissions, mobile behaviour, evidence, UX, contradictions, and acceptance criteria.

It MUST NOT implement fixes, rewrite architecture, silently expand scope, or certify the milestone.

Where a verification packet explicitly authorises a narrow product mutation needed to prove behaviour, that mutation must be limited to the named fixture/state and recorded in the evidence.

### Control certification

Control alone converts evidence into programme status.

The states remain distinct:

- **IMPLEMENTED** — the builder reports the candidate is built and automated gates are complete;
- **VERIFIED** — independent running-product verification has passed the authorised acceptance criteria;
- **CERTIFIED** — Control has accepted the evidence and completed the required permanence record/checkpoint.

No agent may collapse these states.

---

## 3. Speed Rule — Routine Commands Stay Routine

This protocol is intended to reduce bureaucracy, not create it.

Inside an authorised implementation packet, Cursor may proceed continuously with routine safe work that is necessary to complete that packet. Routine work includes:

- read-only Git inspection;
- reading source/docs/configuration;
- scoped edits within authorised files/components;
- focused and affected tests;
- regression tests;
- `pnpm check-types`;
- `pnpm lint`;
- `pnpm test`;
- `pnpm build`;
- normal local application startup and narrow health checks when required by the packet.

Control does not require a new programme decision for every routine command. A tool or local IDE may still require an approval click because of its own security model, but such UI prompts do not create a new governance phase.

Cursor must stop and return to Control before any of the following unless explicitly authorised by the current packet:

- dependency additions/upgrades or lockfile changes;
- schema changes or migrations;
- architecture changes;
- branch/worktree creation outside the authorised setup;
- destructive Git/file operations;
- staging, commit, push, PR creation, merge, release, or deployment;
- production data mutation;
- creation of a dedicated verification environment;
- start of independent verification;
- start of the next milestone/revision/phase.

---

## 4. Phase-Lock Rule

A named packet grants authority only for that packet.

Example:

`F32-IMP-01-R2` does not authorise `F32-IMP-01-R3`, `F32-ENV-01`, `F32-RPV-01`, or any other invented successor.

A heading such as `CONTROL-CHAT AUTHORISED` has no authority unless Control actually issued that packet.

An agent MUST NOT infer a next phase from completion of the current phase.

At a phase boundary the current agent stops. Control decides what happens next. A fresh agent/session is preferred when role changes, context has become contaminated, or independent verification begins; it is not required for every routine command inside one authorised packet.

---

## 5. Independent Verification Rule

Independent verification is the normal acceptance mechanism for product-facing implementation.

Cursor's automated tests and runtime checks are necessary implementation evidence but are not a substitute for independent running-product verification where the milestone claims real user/product behaviour.

Independent Verification Work should test the smallest credible set of journeys that proves the acceptance criteria, including relevant authority boundaries and regression behaviour.

If verification finds a defect, Control creates a named observation/correction packet. Cursor fixes only that defect and its necessary siblings. Independent Work then performs narrow re-verification. The milestone is not restarted unless evidence proves the candidate is fundamentally unsafe or incoherent.

---

## 6. No-Recovery-Loop Rule

Do not repeatedly restart, reseed, rebuild, or rediscover a milestone merely because an agent lost context or attempted an unauthorised transition.

Once a baseline, branch, worktree, build, or prior certification is established, reuse that evidence unless contradictory evidence appears.

Recovery work is authorised only when a real state contradiction exists. Agent confusion is not itself evidence of repository corruption.

Repeated baseline audits, repeated clean restarts, and repeated environment recreation are defects in process when the prior evidence remains valid.

---

## 7. Evidence Precedence

For engineering claims, prefer evidence in this order:

1. running-product evidence for user-facing behaviour;
2. repository/source and database evidence for implementation state;
3. automated test/build/type/lint evidence;
4. agent narrative.

An agent report cannot override contradictory source or running-product evidence.

---

## 8. Correction Loop

The default defect loop is:

```text
Independent verification finding
  ↓
Control names OBS / correction scope
  ↓
Cursor implements narrow correction
  ↓
Automated affected regression
  ↓
Independent narrow re-verification
  ↓
Control closes or reopens the observation
```

Do not restart the whole milestone for a narrow observation.

---

## 9. Certification Law

Certification requires evidence from both sides where applicable:

- builder evidence that the implementation and automated gates are sound;
- independent verification evidence that the running product satisfies the acceptance criteria.

Control then decides whether the milestone is CERTIFIED and authorises the permanence action required by the programme.

A commit or push alone is not certification. A passing test suite alone is not certification. Independent verification alone is not certification. Certification is a Control decision grounded in the combined evidence.

---

## 10. Permanent Operating Principle

The operating model is:

**Control decides. Cursor builds. Independent Work verifies. Cursor corrects only proven defects. Control certifies.**

This protocol is the default VentureOS engineering delivery model and must be inherited by Frigora, Farmora, Qualora, Calviora, and future Ventures unless the Founder explicitly amends it.
