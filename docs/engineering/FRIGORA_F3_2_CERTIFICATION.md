# Frigora F3.2 Certification — Mobile / PWA Delivery

**Document type.** Permanent venture-milestone certification record
**Venture.** Frigora
**Milestone.** F3.2 — Mobile / PWA Delivery
**Control decision.** READY FOR CONTROL CERTIFICATION (engineering checkpoint established)
**Certification date.** 2026-09-16
**Approved by.** Frigora Verification & Certification Control (evidence exception recorded below)
**Independent RPV.** RPV-F32-BRAND-001-R4 (PASSED); RPV-F32-VERSION-001 / RPV-F32-VERSION-001-R1 (see Independent Verification status)

This record certifies the Frigora F3.2 Mobile / PWA Delivery product layer. It does **not** rewrite Foundation Certification Index law. It does **not** certify F3.3 or any later Programme 2 milestone. Layer-specific certification remains the law: this certificate does not stand for Runtime, IDS, Capability Registry, or Definition Registry certification.

**Engineering standard.** [Master Engineering Prompt](./MASTER_ENGINEERING_PROMPT.md). Index: [Engineering Index](./README.md).

**Language.**

| Term | Meaning in this record |
|---|---|
| **IMPLEMENTED** | Capability exists in the certified repository tree |
| **VERIFIED** | Capability demonstrated by automated tests and/or Independent Running-Product Verification |
| **CERTIFIED** | Control accepts the IMPLEMENTED + VERIFIED evidence set as the permanent F3.2 checkpoint |

---

## Checkpoint identity

| Field | Value |
|---|---|
| Branch | `feat/frigora-f32-clean-restart-r1` |
| Pre-certification HEAD (F3.1 certified checkpoint) | `42b30437ff7022ff79786d9a0d2dd8f350cab8e6` |
| Product | **frigora@0.21.0** |
| SCHEMA_GENERATION | **26** (unchanged from F3.1; F3.2 introduces no schema generation bump) |
| Final BUILD_ID | `ESwr_Gsd9HFlB_5e8p_e1` |
| F3.3 | **NOT AUTHORISED / NOT CERTIFIED** |
| Certified Git checkpoint | The permanence commit that contains this artefact (authoritative identity = that commit hash) |

Historical truth preserved:

| Milestone | Product version |
|---|---|
| F3.0 | frigora@0.19.0 |
| F3.1 | frigora@0.20.0 ([F3.1 certification](./FRIGORA_F3_1_CERTIFICATION.md)) |
| F3.2 candidate / this record | frigora@0.21.0 |

---

## Architecture (IMPLEMENTED)

F3.2 admits **online** Mobile / PWA Delivery for Frigora as a customer-facing product identity on VentureOS foundations:

1. Mobile-first Frigora delivery for field and office surfaces
2. Responsive field/office product behaviour
3. Installable Frigora Progressive Web App (manifest, icons, service worker, offline page)
4. Frigora customer-facing product identity across authentication continuation and authenticated journeys
5. Standalone / mobile shell behaviour without VentureOS platform chrome on Frigora customer surfaces
6. Safe-area / mobile viewport handling
7. Auth / session / deep-link behaviour preserving Frigora continuation (`next=/frigora` and related paths)
8. Online / offline connectivity messaging for field surfaces
9. Offline mutation prevention (field writes blocked while disconnected)
10. Field workflow ergonomics on certified My Work / Visit Recorder foundations
11. Evidence / photo handling within F3.2 online packaging (no offline evidence queue)
12. Loading-state identity corrections (root / nested / auth / hard-entry Frigora-aware loading)
13. Runtime product-version observability via public Frigora web-app manifest metadata
14. Associated tests, config, public assets, and product documentation required by F3.2

### Runtime product-version observability

The public Frigora web-app manifest (`/frigora-manifest.webmanifest`) exposes machine-readable product metadata derived from the authoritative Definition Registry:

```json
"frigora_product": {
  "id": "frigora",
  "version": "0.21.0"
}
```

Source of truth: `platformVentureRegistry.resolve("frigora")` in `apps/web/src/core/venture-definition/catalog.ts`.
PWA install identity fields (`id`/`name`/`start_url`/`display`) remain Frigora install metadata and are not replaced by the product-version object. No duplicate hardcoded version constant was introduced as a second source of truth.

### Customer-facing identity constitution

Frigora continuation and authenticated Frigora surfaces present Frigora brand/product identity. Generic VentureOS platform login remains available for non-Frigora continuation. Identity corrections closed under RPV-F32-BRAND-001-R4.

---

## F3.3 exclusions (NOT part of F3.2)

F3.2 does **not** include and must not be read as admitting:

- offline mutation queue
- disconnected WorkOrder writes
- disconnected Visit writes
- disconnected evidence writes
- durable offline business-data cache
- background business synchronisation
- conflict resolution
- true offline field execution

Those remain **F3.3**.

---

## Engineering evidence (VERIFIED)

After final observability correction (F32-VERSION-OBS-001) and version reconciliation to frigora@0.21.0:

| Gate | Result |
|---|---|
| Focused version / metadata tests | PASS |
| Focused venture-definition tests | PASS |
| Focused F3.2 identity / PWA regression tests | PASS |
| Full web suite | **868 / 868 PASS** |
| Typecheck (`pnpm check-types`) | PASS |
| Lint (`pnpm lint`) | PASS |
| Production build (`pnpm build`) | PASS |
| Final BUILD_ID | `ESwr_Gsd9HFlB_5e8p_e1` |
| pnpm-lock.yaml | unchanged |
| Dependencies | unchanged |
| SCHEMA_GENERATION | 26 |

Observability-only source files for the final version-visibility correction:

- `apps/web/src/modules/frigora/app/pwa/web-app-manifest.ts`
- `apps/web/src/modules/frigora/app/pwa/runtime-version.test.ts`
- `apps/web/src/modules/frigora/app/pwa/pwa-boundary.test.ts`
- `apps/web/package.json`

No WorkOrder, Visit, commercial, authentication, identity, offline-boundary, or other business behaviour was changed by that narrow observability correction beyond exposing registry-derived product metadata on the existing public manifest.

---

## Runtime handoff evidence

| Field | Value |
|---|---|
| Application | `127.0.0.1:3141` |
| Application PID (verification window) | `3736` |
| Final BUILD_ID | `ESwr_Gsd9HFlB_5e8p_e1` |
| Transport for final runtime proof | Tailscale Funnel |
| Public Funnel URL | `https://sonny.tail172ee7.ts.net` |

Local and Funnel runtime probes (engineering / runtime handoff, not Independent Verification):

| Path | Result |
|---|---|
| `/frigora` | 307 → `/login?next=%2Ffrigora` |
| `/login?next=/frigora` | 200 |
| `/frigora-manifest.webmanifest` | 200 |
| `frigora_product.id` | `frigora` |
| `frigora_product.version` | `0.21.0` |
| `/sw.js` | 200 |
| `/offline.html` | 200 |

Same Funnel hostname remained healthy after stability recheck. Same verification DB preserved. Fixtures preserved:

| Fixture | State |
|---|---|
| WO-F32V-MOBILE | OPEN |
| MOBILE Visit `f1bfa4ef-8b1b-4a7a-af16-10fbfb1511a8` | DEPARTED |
| WO-F32V-BOUNDARY | OPEN |
| BOUNDARY Visit `f26e2e37-525d-41f1-9282-920ae1f70e90` | DEPARTED |

Verification identities preserved: `engineer@f32-verify.local`, `owner.dispatch@f32-verify.local`.

---

## Independent Verification status

Evidence classes in this record are deliberately separated:

1. **Engineering / automated-gate evidence** — PASS (see above)
2. **Independently verified product evidence** — RPV-F32-BRAND-001-R4 PASSED; RPV-F32-VERSION-001 functional/identity regression pack PASSED before observability existed
3. **Control evidence exception** — narrow final runtime-version observability proof (see below)

### RPV-F32-BRAND-001-R4

**PASSED — CUSTOMER-FACING IDENTITY DEFECT CLOSED**

### RPV-F32-VERSION-001

Against pre-observability build `djDqrAqVfe2WXa6XMPSjY`, Independent Verification confirmed (among other items): BUILD_ID; anonymous Frigora continuation; Engineer Frigora shell; Owner/Dispatch Frigora shell; hard-entry neutral loading; MOBILE/BOUNDARY WorkOrder OPEN and Visits DEPARTED; commercial Labour R600.00 / Parts R125.50 / Refrigerant R0.00 / Final T&M R725.50 COMPLETE; generic VentureOS `/login` preserved; Frigora manifest / service worker / offline page; F3.2/F3.3 boundary; no functional or identity regression.

That run was blocked **only** because product version was not yet machine-observable on a served runtime artefact.

### RPV-F32-VERSION-001-R1

**BLOCKED BY INDEPENDENT VERIFICATION TOOL POLICY**

Exact symptom: `net::ERR_BLOCKED_BY_CLIENT` in the managed Independent Verification Chromium environment, before any Frigora application HTTP response was received through the final Tailscale Funnel hostname.

This blocker is classified as Independent Verification tool / browser policy — **not** a Frigora product defect, runtime defect, version contradiction, identity regression, PWA regression, or data-integrity defect.

**RPV-F32-VERSION-001-R1 MUST NOT be represented as PASSED.**

---

## Control evidence exception

Control explicitly accepts a **narrow evidence exception** for the final runtime-version observability requirement that Independent Verification could not complete due to managed-browser policy (`net::ERR_BLOCKED_BY_CLIENT`).

Justification: complete engineering gates PASS; prior Independent Verification (RPV-F32-BRAND-001-R4 and RPV-F32-VERSION-001 functional/identity pack) established no product regression; F32-VERSION-OBS-001 introduced registry-derived `frigora_product` on the public manifest; runtime handoff proved `frigora_product.version = 0.21.0` on BUILD_ID `ESwr_Gsd9HFlB_5e8p_e1` via local and Tailscale Funnel probes; fixtures and commercial state remained intact; no contradictory Independent evidence was observed.

The exception does **not** convert RPV-F32-VERSION-001-R1 into a pass. It records that no Frigora product defect was established by that tool-policy blocker.

---

## Permanence method

Repository convention (F2.3 / Programme 1 / F3.0 / F3.1): the permanence commit that introduces this artefact **is** the certified Git checkpoint. The artefact records pre-certification HEAD and states that the commit containing this file is authoritative. No post-commit amend or circular hash embed is required.

Preferred commit message:

`cert(frigora): F3.2 mobile and PWA delivery`

---

## Certification declaration

Frigora milestone **F3.2 — Mobile / PWA Delivery** is **IMPLEMENTED**, automated-gate **VERIFIED**, partially Independently **VERIFIED** (RPV-F32-BRAND-001-R4 PASSED; RPV-F32-VERSION-001 functional/identity pack confirmed before observability; RPV-F32-VERSION-001-R1 **BLOCKED BY INDEPENDENT VERIFICATION TOOL POLICY** and **MUST NOT be represented as passed**), and is hereby submitted as the permanent F3.2 engineering certification checkpoint at product **frigora@0.21.0** / **SCHEMA_GENERATION 26** / BUILD_ID **ESwr_Gsd9HFlB_5e8p_e1** on branch `feat/frigora-f32-clean-restart-r1`, advancing from F3.1 checkpoint `42b30437ff7022ff79786d9a0d2dd8f350cab8e6`, subject to Control’s recorded evidence exception for the narrow final runtime-version observability Independent proof.

**F3.3 is not authorised by this record.**

**Cursor / engineering does not declare F3.2 certified on behalf of Control.** Final Control certification acceptance remains Control’s decision.
