# VentureOS agent instructions

The supreme governing document of this repository is [`docs/PROJECT_CONSTITUTION.md`](docs/PROJECT_CONSTITUTION.md). Obey it. Preserve architecture. Identify root causes. Validate before completion. Never mark work complete without evidence.

Before any sprint, implementation, review, refactor, or bug fix, read that constitution, then:

[`docs/engineering/MASTER_ENGINEERING_PROMPT.md`](docs/engineering/MASTER_ENGINEERING_PROMPT.md)

That document is the authoritative engineering standard. Follow it by default. Unexplained failures, corrections, and certification follow [§10](docs/engineering/MASTER_ENGINEERING_PROMPT.md#10-diagnostic-correction-and-certification-operating-protocol).

Then read the permanent delivery law:

[`docs/engineering/CONTROLLED_DELIVERY_PROTOCOL.md`](docs/engineering/CONTROLLED_DELIVERY_PROTOCOL.md)

## Default AI engineering workflow

VentureOS uses risk-based engineering routing. Control classifies every implementation packet before assigning a writer.

### High-risk / cross-cutting path

```text
CONTROL (GPT-5.6 Sol)
  ↓
ASTRA BUILD (GPT-6 Astra / Codex)
  ↓
CURSOR ADVERSARIAL REVIEW — when warranted by risk, complexity, or Control
  ↓
ASTRA CORRECTION — only if Control accepts a review finding
  ↓
INDEPENDENT VERIFY — for product-facing / high-risk behaviour
  ↓
NARROW RE-VERIFY — only when a proven defect was corrected
  ↓
CONTROL CERTIFY
```

### Routine / bounded path

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

Astra is the default implementation owner for concurrency, transactions, persistence/schema migrations, offline/reconciliation, security/authority, data integrity, cross-system runtime work, major refactors, release-critical fixes, and any concern already escalated by Control.

Cursor is the default implementation owner for bounded low-risk work such as straightforward CRUD, isolated UI/action wiring, mechanical compatibility migrations, simple API plumbing, contained bugs, documentation, and routine implementation where architecture is already settled.

If Cursor needs more than one corrective loop on the same engineering concern, Control automatically escalates that concern to Astra before another implementation attempt.

For frontend/visual work, Lovable remains the preferred implementation owner when Control assigns that scope.

### Permanent one-writer rule

Only one implementation agent may own a candidate at a time. Astra and Cursor must not concurrently edit the same candidate or worktree. The default is that Astra builds and Cursor reviews read-only. Cursor may implement only when Control explicitly hands implementation ownership to Cursor for a named packet or correction. When ownership changes, the previous implementation agent stops.

An implementation agent may work continuously inside its currently authorised packet, including routine repository inspection, scoped implementation, debugging, tests, typecheck, lint, build, and narrow local runtime checks needed by that packet. Do not create needless approval loops for routine safe work.

A named packet grants authority only for that packet. Do not invent or self-authorise a successor revision, recovery phase, verification environment, independent verification phase, certification phase, commit, push, PR, release, deployment, schema change, dependency change, or production mutation unless Control explicitly authorised it.

At a phase boundary, STOP and report COMPLETE, PARTIAL, or BLOCKED with evidence. Control decides the next phase. An implementation agent must not become its own independent verifier. Independent Verification Work must not implement fixes or certify the milestone.

If independent verification finds a defect, correct only the named observation and necessary siblings, then return it for narrow independent re-verification. Do not restart the whole milestone unless evidence proves the candidate is fundamentally unsafe or incoherent.

Do not repeatedly restart, reseed, rebuild, or rediscover a valid baseline merely because an agent lost context or attempted an unauthorised transition. Agent confusion is not repository corruption.

Then open the [Engineering Index](docs/engineering/README.md) for the Foundation Runbook, architecture, coding standards, branch strategy, release process, and sprint process.

Do not continue on an unhealthy foundation. Do not tell the founder a task is complete until it has been verified at the level required by the authorised packet.

Customer-facing product identity is constitutional. Real customer deployments must present the Venture’s own branded login and application identity. Internal, development, and verification surfaces may keep a generic VentureOS shell. Do not assume every customer product should display VentureOS branding. Law: [`docs/PROJECT_CONSTITUTION.md`](docs/PROJECT_CONSTITUTION.md) (Customer-Facing Product Sovereignty), FD-007, ADR-010.

Architecture and ownership: [`docs/foundation-library/00-START-HERE.md`](docs/foundation-library/00-START-HERE.md). Locked specifications remain in `docs/foundation/` and beside the code (`apps/web/src/FOUNDATION.md`).

The Next.js guide under `apps/web/node_modules/next/dist/docs/` applies to this workspace’s Next.js version. `apps/web/AGENTS.md` is generated by `next dev` and is not the repository engineering constitution.
