# VentureOS

Web application for VentureOS — the operating system for companies.

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

## Ownership

See `src/FOUNDATION.md` for Runtime, persistence, capability, and definition boundaries.

Presentation uses IntelligenceOS Design System utilities from `@repo/ids`. Do not introduce a second visual language.
