# VentureOS Presentation System

**Document.** Shared presentation standard for VentureOS-built ventures  
**Date.** 2026-08-28  
**Status.** ADOPTED PRESENTATION STANDARD  
**Scope.** VentureOS, Frigora, Qualora, Farmora, Calviora and future VentureOS-built ventures  
**Authority boundary.** Presentation and experience only. This document does not alter VentureOS runtime, domain, auth, persistence, API, AI, governance, verification, sync or business-logic ownership.

---

## 1. Decision

VentureOS will maintain one shared **Presentation System** for every VentureOS-built venture.

The system must not make every product look identical.

The governing rule is:

> **Shared quality, interaction and structural standards. Venture-specific visual identity, density, vocabulary and operational emphasis.**

Farmora's new frontend establishes the quality bar, not a visual template to copy literally.

Each venture should feel related in craftsmanship and interaction quality while remaining unmistakably its own product.

---

## 2. Why this exists

Without a shared presentation system, every new venture risks rebuilding the same frontend problems repeatedly: navigation, auth, dashboard hierarchy, cards, states, responsive rules, forms, status language, accessibility, trust cues and presentation primitives.

VentureOS should instead provide a mature presentation foundation from which every venture begins.

This reduces design drift, shortens workshop time, improves accessibility and creates a recognisable level of quality across the VentureOS portfolio without forcing a single brand onto unrelated products.

---

## 3. Ownership model

The permanent delivery split remains:

| Concern | Owner |
| --- | --- |
| Presentation React components | Lovable |
| Tailwind / CSS presentation | Lovable |
| Responsive behaviour | Lovable |
| Visual hierarchy | Lovable |
| Auth page presentation | Lovable |
| Landing pages | Lovable |
| Situation Room / dashboard presentation | Lovable |
| Empty, loading, error and confirmation presentation | Lovable |
| Form presentation and interaction polish | Lovable |
| Visual accessibility | Lovable |
| Runtime and orchestration | Cursor / VentureOS |
| APIs and services | Cursor / VentureOS |
| Business rules | Cursor / VentureOS |
| AI / intelligence | Cursor / VentureOS |
| Authentication implementation and security | Cursor / VentureOS |
| Persistence and migrations | Cursor / VentureOS |
| Sync / offline engine | Cursor / VentureOS unless explicitly workshop-validated first |
| Performance architecture | Cursor / VentureOS |
| Automated backend testing and hardening | Cursor / VentureOS |

Lovable may present an existing state but must not redefine the authoritative backend meaning of that state.

---

## 4. Core presentation principles

Every VentureOS-built venture must follow these principles.

### 4.1 Clarity before decoration

The first screen must answer the user's most important operational question quickly.

A beautiful screen that hides the next action is a failed screen.

### 4.2 Calm software

Avoid unnecessary gradients, glowing cards, excessive motion, floating ornaments, visual noise and generic SaaS theatrics.

Premium means controlled hierarchy, spacing, typography, material depth and confidence.

### 4.3 Situation first

Every operational venture should have a high-value home surface that answers a version of:

- What needs attention?
- What changed?
- What is late, blocked or risky?
- What should I do next?
- What evidence supports this?

The exact vocabulary must match the venture.

### 4.4 Truthful states

Never imply a server acknowledgement, approval, completion, safety outcome, regulatory state or AI conclusion that has not actually occurred.

Examples:

- Farmora: `Saved on this phone · waiting for signal`
- Frigora: `Capture incomplete · 3 items require attention`
- Qualora: distinguish evidence present from assurance conclusion
- VentureOS: distinguish intelligence, recommendation, decision and execution
- Calviora: distinguish planned, assigned, accepted, arrived, completed and verified transport states

### 4.5 Mobile where the work happens

Field and frontline ventures must be designed mobile-first.

Desktop may become denser, but mobile must never be a collapsed desktop afterthought.

### 4.6 Accessibility is part of polish

Every design must preserve:

- keyboard access where relevant
- visible focus states
- semantic headings
- labelled navigation
- sufficient contrast
- touch targets suitable for field use
- readable type sizes
- state meaning not communicated by colour alone

### 4.7 One component language per venture

Cards, chips, notices, rows, forms, buttons, empty states, loading states and alerts should look related throughout a venture.

A venture should not feel like several unrelated UI kits stitched together.

---

## 5. Shared structural patterns

These patterns should be reusable across the portfolio.

### 5.1 Public landing pattern

A venture landing page should usually contain:

1. clear venture identity
2. concise value proposition
3. primary user problem
4. current capabilities
5. operational trust / safety / offline explanation where applicable
6. future direction clearly separated from current product
7. primary call to action
8. no invented testimonials, customers, partnerships, statistics or endorsements

The landing page must never overstate prototype or validation-stage capability.

### 5.2 Auth pattern

Auth presentation should provide:

- venture identity
- simple sign-in / create-account hierarchy
- clear validation
- strong loading and error states
- truthful privacy/security reassurance
- mobile-first layout
- no replacement of the venture's existing auth implementation

### 5.3 Situation Room pattern

Every venture may implement a domain-specific Situation Room concept.

The Situation Room is not a single copied dashboard component. It is a presentation grammar:

1. current context
2. priority strip
3. state summaries
4. exceptions / risks
5. recent activity
6. recommended next action
7. quick actions
8. evidence / trust / sync context where relevant

### 5.4 Detail-page pattern

Detail screens should normally establish:

- identity / subject
- current state
- critical exceptions
- recent history
- related actions
- evidence or audit trail where relevant
- clear next action

### 5.5 Form pattern

Shared field behaviour should include:

- consistent labels
- clear required/optional distinction
- inline validation
- preserved user input on recoverable failure
- explicit pending/submission states
- no false success
- field spacing appropriate to touch use

### 5.6 State pattern

Every major route must intentionally design:

- loading
- empty
- error
- offline, if applicable
- unauthorized
- partial / incomplete
- success
- pending / waiting
- conflict, where applicable

---

## 6. Shared presentation primitives

The reusable portfolio vocabulary should include equivalents of:

- `Surface`
- `Section`
- `Region`
- `Card`
- `StatTile`
- `Signal`
- `StatusChip`
- `Notice`
- `AlertBanner`
- `RowShell`
- `DataTable`
- `EvidenceBlock`
- `EmptyState`
- `LoadingState`
- `ErrorState`
- `Field`
- `ActionBar`
- `ContextPanel` / `Inspector`
- `SituationSummary`

These are semantic presentation concepts, not a mandate that every venture must import one universal component implementation.

VentureOS itself should prefer IDS-backed production primitives. Venture apps may use venture-local presentation components where host architecture differs, provided the behaviour and quality standard remain aligned.

---

## 7. Venture identity profiles

### 7.1 Farmora Eswatini

**Experience character:** field-ready highland  
**Primary feeling:** practical, warm, trustworthy, agricultural  
**Density:** low to medium  
**Primary device:** mobile  
**Visual direction:** deep grazing green, warm paper surfaces, subtle agricultural contour texture, ochre accent, generous touch targets  
**Home concept:** `Today on the farm` / Farmora Situation Room  
**Priority language:** animals to check, late jobs, open farm problems, health follow-ups  
**Trust language:** saved locally, waiting for signal, sent to farm records  
**Avoid:** enterprise jargon, dense tables, futuristic Guardian claims presented as live

### 7.2 Frigora

**Experience character:** technical operations control  
**Primary feeling:** precise, industrial, dependable, field-engineering competent  
**Density:** medium to high on desktop, controlled on mobile  
**Primary devices:** technician mobile + service-desk desktop  
**Visual direction:** cool neutrals, restrained technical accent, crisp hierarchy, evidence-forward cards, compact operational tables  
**Home concept:** Service Situation Room / Operations Control  
**Priority language:** breakdowns, SLA risk, technician status, incomplete capture, repeat failure, blocked commercial value, PPM due  
**Trust language:** captured, verified, awaiting evidence, incomplete, customer signed, production completion owned by VentureOS  
**Key screens:** Situation Room, Work Order, Dispatch, Field Job, Customer/Site/Asset, PPM, Refrigerant, Evidence, Commercial  
**Avoid:** consumer-style rounded softness, decorative farm warmth, fake predictive maintenance claims

### 7.3 Qualora

**Experience character:** calm assurance intelligence  
**Primary feeling:** clinical, evidence-led, composed, credible  
**Density:** medium  
**Primary devices:** desktop first, tablet capable  
**Visual direction:** quiet neutrals, restrained assurance/status colours, document-and-evidence emphasis, low visual noise  
**Home concept:** Assurance Situation Room  
**Priority language:** assurance gaps, evidence weakness, regulatory change, unresolved risk, confidence, required action  
**Trust language:** evidence present, evidence insufficient, inferred, confirmed, unresolved, confidence stated explicitly  
**Key screens:** Assurance Situation Room, Provider Assurance, Evidence, Regulatory Knowledge, Risk, Executive Intelligence  
**Avoid:** turning Qualora into a care-management app, generic CRM styling, overconfident AI language

### 7.4 VentureOS

**Experience character:** executive operating system  
**Primary feeling:** precise, calm, powerful, judgement-first  
**Density:** high but controlled  
**Primary device:** desktop, responsive to tablet  
**Visual direction:** Executive Light/Dark, IDS-backed surfaces, hairline borders, tonal neutrals, restrained venture atmosphere, denser tables, strong inspector/context patterns  
**Home concept:** Situation Room / Executive Workspace  
**Priority language:** significance, decisions, blockers, evidence, uncertainty, recent changes, next action  
**Trust language:** observed, inferred, recommended, approved, executing, verified  
**Key screens:** Situation Room, Executive Office, Venture HQ, Knowledge, Reports, Inspector  
**Avoid:** replacing IDS, importing second design systems, fake executive metrics, decorative dashboard theatre

### 7.5 Calviora

**Experience character:** healthcare operations trust  
**Primary feeling:** safe, reassuring, professional, responsive  
**Density:** medium  
**Primary devices:** dispatch desktop + operational mobile  
**Visual direction:** healthcare-trust palette, clean surfaces, strong status clarity, calm emergency handling, accessible large controls where frontline staff use them  
**Home concept:** Transport Operations Situation Room / Daily Operations  
**Priority language:** journeys due, unassigned journeys, pickup risk, delays, patient needs, vehicle/crew readiness, incident attention  
**Trust language:** requested, accepted, assigned, en route, arrived, patient aboard, completed, verified  
**Avoid:** ambulance-emergency visual drama where not clinically warranted, false clinical claims, generic logistics dashboard feel

---

## 8. Future-venture binding contract

Every new VentureOS-built venture should define a **Presentation Profile** before its first frontend workshop.

Minimum profile fields:

```text
venture_name
experience_character
primary_feeling
primary_users
primary_device
information_density
visual_direction
home_surface_name
five_priority_questions
status_vocabulary
trust_vocabulary
critical_actions
critical_evidence
public_landing_required
public_claim_boundaries
mobile_requirement
accessibility_constraints
future_capabilities_not_to_present_as_live
```

No future venture should begin from a blank visual specification if the shared Presentation System already defines the applicable pattern.

---

## 9. Situation Room adaptation matrix

| Venture | Situation Room answers |
| --- | --- |
| Farmora | What needs attention on the farm today? |
| Frigora | What service work, SLA, technical or commercial issue needs intervention now? |
| Qualora | Where is assurance weak, incomplete or changing? |
| VentureOS | What changed, what matters, and what decision is required? |
| Calviora | Which patient journeys or operational conditions need intervention now? |

The name shown to users can differ. `Situation Room` may remain an internal product-design term where plain-language wording is better for the actual user.

---

## 10. Design-system relationship with IDS

For VentureOS production surfaces, IDS remains authoritative.

The Presentation System sits **above** IDS and defines usage patterns, not a competing token system.

Rules:

- do not copy Farmora colour values into VentureOS
- do not replace IDS tokens with venture-specific hard-coded values
- use `IdsBrandBinder` and approved brand / atmosphere mechanisms for venture expression where VentureOS hosts the surface
- shared semantics should map to IDS where appropriate
- workshop visual experimentation may use local tokens, but production integration must reconcile them to the host architecture

---

## 11. Quality gates for every frontend workshop

A frontend workshop is not complete until it verifies:

1. mobile and desktop target sizes appropriate to the venture
2. production build / typecheck clean in that environment
3. no new console errors
4. primary routes render
5. auth behaviour not weakened
6. backend contracts not silently changed
7. loading / empty / error states reviewed
8. truthful pending / sync / approval language
9. no cross-venture contamination
10. no unsupported customer, regulator, government or performance claims
11. no publication/deployment without explicit founder approval
12. presentation changes reviewed as a diff before acceptance

---

## 12. Cross-venture contamination rule

Reusable presentation principles are encouraged.

Reusable product language is not.

Before completion, every workshop must scan for names, entities, fixtures and domain terms from other ventures.

Examples:

- Farmora must not contain Frigora work-order entities
- Frigora must not inherit Qualora assurance terminology
- Qualora must not use Farmora livestock language
- Calviora must not inherit refrigeration SLA fixtures
- VentureOS must not contain venture-specific fixtures as platform truth

Shared code is acceptable only where the host architecture supports it cleanly.

---

## 13. Recommended frontend workshop sequence

For a new or refreshed venture:

### Phase 0 — Presentation profile

Define venture-specific presentation identity and claims boundary.

### Phase 1 — Foundation

- design tokens / IDS binding
- shell
- public landing
- auth
- Situation Room / home
- shared primitives

### Phase 2 — Core journeys

Apply the system to every V1 operational route and form.

### Phase 3 — States and trust

Polish loading, empty, error, pending, offline, conflict, approval and verification states.

### Phase 4 — Responsive and accessibility certification

Test mobile / tablet / desktop targets, keyboard behaviour, contrast and touch usability.

### Phase 5 — Frontend certification

Run route regression, build/typecheck, cross-project scan and diff review. Freeze presentation contracts before backend integration or handoff.

---

## 14. Current adoption status

| Venture | Status |
| --- | --- |
| Farmora | Presentation quality bar established; Phase 1 complete, Phase 2 pending |
| VentureOS | Existing Executive presentation foundation compatible; formally adopts this system as portfolio-level guidance |
| Frigora | Existing L0 workshop remains valid; future polish should bind to the Frigora profile above rather than copy Farmora styling |
| Qualora | Adopt for next frontend workshop / visual refinement |
| Calviora | Adopt when product frontend work begins |
| Future ventures | Presentation Profile required before frontend workshop |

---

## 15. Non-goals

This system does not:

- force all ventures to use the same colours
- force all ventures to use the same typography
- force mobile-first design where the work is genuinely desktop-first
- replace IDS
- replace venture-specific domain UX
- create a universal backend
- change auth or security implementation
- turn Situation Room into a mandatory route name
- justify unsupported AI, automation or intelligence claims
- permit scope expansion during visual polish

---

## 16. Portfolio standard

The standard for every VentureOS-built product is now:

> **It should feel like the best possible version of that venture, not like a reskin of another VentureOS product.**

Farmora demonstrated the level of visual craft, clarity and field-awareness expected. Frigora, Qualora, VentureOS, Calviora and future ventures should reach the same level of polish while expressing their own operational world.