# Sprint Standard

**Purpose.** Bind how a VentureOS sprint is written, constrained, and closed.

**Authority.** Engineering and product operating standard. Used by VS and DOC programmes.

**Audience.** Sprint authors, reviewers, and agents executing a programme.

**Dependencies.** [Foundation Governance](../01-FOUNDATION/Foundation-Governance.md) · [Engineering Standards](./Engineering-Standards.md)

**Related Documents.** [Review Process](./Review-Process.md) · [Release Process](./Release-Process.md) · [Architecture Decision Register](../05-GOVERNANCE/Architecture-Decision-Register.md)

**Status.** Approved

**Version.** 1.1.0

**Owner.** Engineering

**Last Updated.** 2026-08-20

---

A sprint is a named programme with a locked context, an objective, constraints, validation, and a single recommendation.

## Required shape

1. **Context** — what is locked and must not be touched.
2. **Objective** — one job.
3. **Scope** — features or documents in, everything else out.
4. **Constraints** — especially Runtime, IDS, Executive Environments, unrelated refactoring.
5. **Validation** — how we will know.
6. **Deliverables** — files, flow, remaining issues, recommendation.

Close with exactly one recommendation:

- **A** — complete for the stated objective.
- **B** — further work required, with the gap named.

Do not hide a Foundation amendment inside a feature sprint.

## Execution rules

- Do not modify Runtime, IDS, or Executive Environments unless the sprint is that programme.
- Do not redesign a locked surface as a side quest.
- Do not dump documentation. Teach, link, and name owners.
- Update the Foundation Library when the sprint changes a fact this library teaches.
- Record new decisions in the correct register.

## Example constraints (copy when they apply)

```
Do not modify the Runtime.
Do not modify IDS.
Do not modify Executive Environments.
No unrelated refactoring.
```

## Close-out

List files changed, remaining issues, and the A/B recommendation. Remaining issues that are architectural belong in the [Assumption Register](../05-GOVERNANCE/Assumption-Register.md) or [Technical Debt Register](../05-GOVERNANCE/Technical-Debt-Register.md).
