# Foundation Known Limitations

**Release.** VentureOS Foundation v1.0  
**Date.** 2026-08-21  
**Authority.** Honest limits of this release. A limitation is not an invitation to fork architecture.

Product development must plan around these limits. It must not paper over them with costumes.

---

## Intelligence

- The Runtime is deterministic for the same core and event. It is not an open-ended chat model.
- Ask and the command palette are command surfaces. They are not a chat Runtime.
- Briefing assembly is skipped when an instance cannot consume `intelligence.briefing` (Calviora).
- Farmora excludes the executive-office **feature**. The office capability remains on the VIC. The floor is absent, not greyed out.

## Persistence and tenancy

- SQLite is sufficient for Foundation. That is not a claim about eventual scale (A-003).
- One founder voice is the primary operator of copy. Membership roles exist; they do not rewrite the principal (A-002).
- Workspace creation grants the creator `owner` after session check; `workspace.create` is not separately asserted.

## Identity

- Google OAuth and transactional email require production credentials. In development, mail may log rather than send (A-004, RM-006).
- Remember me is cookie policy. The server session row may outlive a session cookie (TD-003).

## Presentation

- Two climates only. No Midnight, Carbon, or third climate.
- Live brand overlay is VentureOS until Executive Atmosphere is implemented.
- Qualora, Calviora, and Farmora atmospheres are specified. They are not the headquarters the founder walks into.
- Unknown brand ids fail closed to VentureOS.
- Executive Layout v2 is the platform layout foundation. Situation Room, Executive Office, Brain, HQ, Settings, and Launch internals still compose Tailwind layout (TD-008).
- Authentication is the certified Layout v1 reference and remains so.

## Products

- Calviora identity is in conflict: live definition is livestock / calving cadence; EAS-001 describes a healthcare operations centre. Do not paint until FD-006 (A-001).
- Qualora is incubating. Calviora and Farmora are concept. They are not finished marketed products.
- There is no Product Registry. Unknown products fail before instantiation.

## Platform knowledge

- Brain is an institutional knowledge desk over an in-memory catalogue. It is not persistence and not a second Runtime.
- Brain Knowledge Object layout work is paused. Do not resume it inside a product sprint.

## Extension points

- Empty `src/api/*` barrels are unused HTTP facades. They are not a current product surface.

## Accessibility

- Skip, focus, contrast, keyboard order, and reduced motion are constitutional.
- Founder overrides for motion and contrast (Layer 3 Settings) are specified, not shipped (IN-002).
