# Git Workflow

**Purpose.** Bind how VentureOS history is written so Foundation knowledge and code share one timeline.

**Audience.** Engineers opening branches and pull requests.

**Dependencies.** [Engineering Standards](./Engineering-Standards.md)

**Related Documents.** [Master Engineering Prompt](../../engineering/MASTER_ENGINEERING_PROMPT.md) · [Engineering Index](../../engineering/README.md) · [Review Process](./Review-Process.md) · [Release Process](./Release-Process.md) · [Legacy Charter](../01-FOUNDATION/Legacy-Charter.md)

**Status.** Approved

**Version.** 1.2.0

**Owner.** Engineering

**Last Updated.** 2026-09-03

---

Branch strategy for every sprint, implementation, review, refactor, and bug fix follows the [Master Engineering Prompt](../../engineering/MASTER_ENGINEERING_PROMPT.md). This page remains the Foundation Library detail.

## Branches

Work on a feature branch. Default integration branch is `main`.

Do not force-push `main`. Do not rewrite shared history.

## Commits

Write commits for the why, not a file list.

Prefer small, reviewable commits. Do not mix a Foundation amendment with an unrelated feature.

Do not commit secrets, local databases, or `.next` artefacts.

## Staging and working-tree provenance

Branch strategy, commits, and certification staging follow the [Master Engineering Prompt](../../engineering/MASTER_ENGINEERING_PROMPT.md), including [§10.8](../../engineering/MASTER_ENGINEERING_PROMPT.md#108-working-tree-provenance-and-git-safety).

Never use `git add .` or `git add -A` for controlled certification or staging. When the founder or the active workflow authorises staging, add exact paths only.

Before staging or certification completion, classify every dirty file:

| Class | Meaning |
|---|---|
| **A** | Active implementation files |
| **B** | Authorised correction files |
| **C** | Known unrelated files |
| **D** | Unexpected or unexplained files |
| **E** | Staged files |

Unexpected or unexplained files block staging until explained. Do not assume every dirty file belongs to the current phase.

Do not commit, push, reset, restore, clean, or delete unless authorised. Do not add unwanted commit trailers, co-author metadata, or tool attribution unless explicitly requested.

## Pull requests

Open a pull request against `main`. The summary names:

- what changed for the founder or the platform
- the test plan
- any Foundation documents updated

Preserve Git history when moving a specification. Prefer `git mv` over copy-and-delete when a document is relocating.

## This library

The Foundation Library lives at `docs/foundation-library/`. Existing specifications remain under `docs/foundation/` and beside the code. Do not delete those trees because a library page now explains them.
