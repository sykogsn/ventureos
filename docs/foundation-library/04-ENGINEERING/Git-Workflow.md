# Git Workflow

**Purpose.** Bind how VentureOS history is written so Foundation knowledge and code share one timeline.

**Audience.** Engineers opening branches and pull requests.

**Dependencies.** [Engineering Standards](./Engineering-Standards.md)

**Related Documents.** [Master Engineering Prompt](../../engineering/MASTER_ENGINEERING_PROMPT.md) · [Engineering Index](../../engineering/README.md) · [Review Process](./Review-Process.md) · [Release Process](./Release-Process.md) · [Legacy Charter](../01-FOUNDATION/Legacy-Charter.md)

**Status.** Approved

**Version.** 1.1.0

**Owner.** Engineering

**Last Updated.** 2026-08-22

---

Branch strategy for every sprint, implementation, review, refactor, and bug fix follows the [Master Engineering Prompt](../../engineering/MASTER_ENGINEERING_PROMPT.md). This page remains the Foundation Library detail.

## Branches

Work on a feature branch. Default integration branch is `main`.

Do not force-push `main`. Do not rewrite shared history.

## Commits

Write commits for the why, not a file list.

Prefer small, reviewable commits. Do not mix a Foundation amendment with an unrelated feature.

Do not commit secrets, local databases, or `.next` artefacts.

## Pull requests

Open a pull request against `main`. The summary names:

- what changed for the founder or the platform
- the test plan
- any Foundation documents updated

Preserve Git history when moving a specification. Prefer `git mv` over copy-and-delete when a document is relocating.

## This library

The Foundation Library lives at `docs/foundation-library/`. Existing specifications remain under `docs/foundation/` and beside the code. Do not delete those trees because a library page now explains them.
