# Review Process

**Purpose.** Bind how a change is reviewed so locked architecture cannot pass by accident.

**Audience.** Reviewers and authors.

**Dependencies.** [Sprint Standard](./Sprint-Standard.md) · [Foundation Governance](../01-FOUNDATION/Foundation-Governance.md)

**Related Documents.** [Git Workflow](./Git-Workflow.md) · [Engineering Standards](./Engineering-Standards.md) · [Architecture Decision Register](../05-GOVERNANCE/Architecture-Decision-Register.md)

**Status.** Approved

**Version.** 1.1.0

**Owner.** Engineering

**Last Updated.** 2026-08-20

---

## Checks every review must make

1. **Layer.** Did presentation import Runtime? Did a repository orchestrate? Did IDS grow a business rule?
2. **Lock.** Did the diff touch Runtime, IDS, definitions, or Executive Environments without that being the sprint?
3. **Product honesty.** Did a theme or empty state restore an excluded feature?
4. **Copy.** Does language address the founder? Are empty and error states executive?
5. **Accessibility.** Skip, focus, keyboard, contrast, reduced motion.
6. **Knowledge.** If a Foundation fact changed, was this library updated?

## Evidence

Prefer tests at the correct layer, plus a short live path for auth and desk surfaces. Cursor-browser hydration artefacts are not product bugs.

## Outcome

Approve, request changes, or reject as a Foundation amendment smuggled into a feature. Record architectural outcomes in the [Architecture Decision Register](../05-GOVERNANCE/Architecture-Decision-Register.md).
