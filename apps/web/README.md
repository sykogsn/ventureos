# VentureOS

Web application for VentureOS — the operating system for companies.

The supreme governing document is [`docs/PROJECT_CONSTITUTION.md`](../../docs/PROJECT_CONSTITUTION.md). Read it, then [`docs/engineering/MASTER_ENGINEERING_PROMPT.md`](../../docs/engineering/MASTER_ENGINEERING_PROMPT.md), before changing this application. The [Engineering Index](../../docs/engineering/README.md) maps the Foundation Runbook and process standards.

## Develop

From the repository root:

```sh
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000). Unauthenticated sessions are sent to sign in.

## Authentication

Password sign-in is always available. Optional Google sign-in and reset email need:

```
AUTH_URL=http://localhost:3000
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
MAIL_FROM=VentureOS <noreply@example.com>
RESEND_API_KEY=
```

Redirect URI: `{AUTH_URL}/auth/google/callback`. Without `RESEND_API_KEY`, reset links are written to the server log. Without Google credentials, Continue with Google explains that it is not configured.

Optional Workforce model adapter (server-side only; not used by the UI):

```
VOS_OPENAI_API_KEY=
VOS_OPENAI_MODEL=
```

`VOS_OPENAI_MODEL` is optional. The adapter default is `gpt-4o-mini`. Do not prefix these names with `NEXT_PUBLIC_`.

## Ownership

See `src/FOUNDATION.md` for Runtime, persistence, capability, and definition boundaries.

Presentation uses IntelligenceOS Design System utilities from `@repo/ids`. Do not introduce a second visual language.
