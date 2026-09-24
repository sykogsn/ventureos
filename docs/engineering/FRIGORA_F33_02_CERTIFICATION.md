# Frigora F33-02 Certification — Preloaded / Read-Only Field Workspace

**Document type.** Permanent venture-milestone certification record

**Venture.** Frigora

**Milestone.** F33-02 — Preloaded / Read-Only Field Workspace (F3.3 Offline Field Capability packet)

**Control decision.** VERIFIED — ALL REQUIRED F33-02 RUNNING-PRODUCT EVIDENCE PROVEN

**Certification date.** 2026-09-16

**Approved by.** Frigora Verification & Certification Control

This record certifies the Frigora F33-02 preloaded / read-only field workspace capability. It does **not** certify F33-03 or later F3.3 packets. It does **not** rewrite Foundation Certification Index law. Layer-specific certification remains the law.

**Engineering standard.** [Master Engineering Prompt](./MASTER_ENGINEERING_PROMPT.md). Architecture: [FRIGORA_F3_3_ARCHITECTURE.md](./FRIGORA_F3_3_ARCHITECTURE.md). Index: [Engineering Index](./README.md).

| Term | Meaning in this record |
|---|---|
| **IMPLEMENTED** | Capability exists in the certified repository tree |
| **VERIFIED** | Capability demonstrated by automated tests and Independent / supplemental Running-Product Verification |
| **CERTIFIED** | Control accepts the IMPLEMENTED + VERIFIED evidence set as the permanent F33-02 checkpoint |

---

## 1. Milestone identity

| Field | Value |
|---|---|
| Programme | Frigora Programme 2 — F3.3 Offline Field Capability |
| Packet | F33-02 — Preloaded / Read-Only Field Workspace |
| Parent milestone | F3.3 Offline Field Capability (in progress; not fully admitted) |

## 2. Implementation checkpoint

| Field | Value |
|---|---|
| Implementation checkpoint | `b519130087d86f6197561c54296670807a995a46` |
| Commit subject | `feat(frigora): add preloaded offline field workspace` |

## 3. Branch

`feat/frigora-f33-offline-field-capability`

## 4. BUILD_ID

`z9ENnfzUdDGwWKMv1b2k4`

## 5. Product / schema / offline DB / capture flag

| Field | Value |
|---|---|
| Product | **frigora@0.21.0** (unchanged; 0.22.0 reserved for final F3.3 admission) |
| SCHEMA_GENERATION | **26** (unchanged) |
| FRIGORA_OFFLINE_DB_VERSION | **1** |
| FRIGORA_FIELD_FORMS_OFFLINE_CAPTURE_ENABLED | **false** |
| F33-01 ancestor | `5beabeb1e8c7f955614b16006055326594f4f08f` |
| F3.2 certified ancestor | `d09087f9afb1108e8593dbe7480b0303063a48cb` |

## 6. Certified capability

F33-02 certifies **only**:

**Authenticated online preload → field-safe local IndexedDB snapshot → 12-hour partitioned lease → in-session read-only offline field access**

for:

- My Work;
- Work Order operational context;
- Visit / context.

Certified product law:

- AUTHENTICATED ONLINE PRELOAD of authorised field-safe operational data;
- persistence in client IndexedDB (`frigora-offline` v1 `workspaces` + `leases`);
- partition by `ventureId + actorUserId`;
- 12-hour lease issued/renewed only by successful authenticated preload;
- in-session offline read of preloaded snapshots while lease is active;
- commercial/pricing exclusion from stored field payloads;
- offline field mutation remains blocked;
- Service Worker remains navigation offline-page fallback only.

## 7. Explicit exclusions

F33-02 does **not** certify:

- full cold-start offline application boot;
- offline field mutation / capture;
- automatic server synchronisation;
- background business mutation drain;
- general conflict resolution;
- offline WorkOrder lifecycle mutation;
- offline commercial / T&M mutation;
- F33-03 (or later) functionality;
- product version admission to `frigora@0.22.0`.

Local availability remains distinct from server acceptance.

## 8. Automated engineering evidence

| Gate | Result |
|---|---|
| Focused F33-02 tests | **6/6 PASS** |
| Relevant regression batch (field/PWA/catalogue/T&M/F33-01) | **90/90 PASS** |
| Full web suite | **887/887 PASS** |
| Typecheck | **PASS** |
| Lint | **PASS** |
| Production build | **PASS** |
| pnpm-lock.yaml | **UNCHANGED** |
| New dependencies | **NONE** |

## 9. Independent RPV — RPV-F33-02-01-R1

| Field | Value |
|---|---|
| Report | RPV-F33-02-01-R1 — Independent Authenticated Running-Product Verification Report |
| Public URL | `https://sonny.tail172ee7.ts.net/` |
| Candidate | `b519130087d86f6197561c54296670807a995a46` |
| BUILD_ID | `z9ENnfzUdDGwWKMv1b2k4` |
| Report ending | **C. INCOMPLETE — REQUIRED F33-02 EVIDENCE NOT PROVEN** |

Independently proven (non-exhaustive):

- Frigora customer-facing product identity;
- candidate / BUILD_ID identity;
- Engineer A authentication;
- expected assigned WorkOrders;
- authenticated field workspace preload + success messaging;
- Engineer B online authority separation (no Owner/admin/commercial controls);
- Service Worker navigation-only fallback; no business/API caching; no mutation queue; no background business sync;
- candidate/server fixtures preserved;
- no material product defect observed.

## 10. Managed-browser limitation

The RPV-F33-02-01-R1 incomplete ending was caused **solely** by managed-browser tool limits:

- no network offline/online simulation;
- no readable IndexedDB inspection;
- no browser-local lease inspection/manipulation.

This was **not** a product failure.

## 11. Supplemental RPV — RPV-F33-02-02-R1

| Field | Value |
|---|---|
| Report | RPV-F33-02-02-R1 — Supplemental Local Browser-Lab Verification Report |
| Mechanism | existing `puppeteer-core@24.43.1` + system Chrome + persistent profile + CDP `page.setOfflineMode` |
| Candidate | `b519130087d86f6197561c54296670807a995a46` |
| BUILD_ID | `z9ENnfzUdDGwWKMv1b2k4` |
| Evidence directory | `C:\Users\sykog\AppData\Local\frigora-f32-verification\logs\rpv-f33-02-02-r1\` |
| Verdict | **A. SUPPLEMENTAL VERIFICATION PASSED — ALL REQUIRED F33-02 EVIDENCE PROVEN** |

## 12. Complete requirement closure matrix

| Requirement | Result | Evidence source |
|---|---|---|
| RPV-F33-02-IDB-01 | **PASS** | RPV-F33-02-02-R1 |
| RPV-F33-02-COMM-01 | **PASS** | RPV-F33-02-02-R1 |
| RPV-F33-02-LEASE-01 | **PASS** | RPV-F33-02-02-R1 |
| RPV-F33-02-OFFLINE-MYWORK-01 | **PASS** | RPV-F33-02-02-R1 |
| RPV-F33-02-OFFLINE-WO-01 | **PASS** | RPV-F33-02-02-R1 |
| RPV-F33-02-OFFLINE-VISIT-01 | **PASS** | RPV-F33-02-02-R1 |
| RPV-F33-02-MUTATION-BLOCK-01 | **PASS** | RPV-F33-02-02-R1 |
| RPV-F33-02-LEASE-NORENEW-01 | **PASS** | RPV-F33-02-02-R1 |
| RPV-F33-02-LEASE-EXPIRE-01 | **PASS** | RPV-F33-02-02-R1 |
| RPV-F33-02-ISOLATION-01 | **PASS** | RPV-F33-02-02-R1 |
| RPV-F33-02-RECONNECT-01 | **PASS** | RPV-F33-02-02-R1 |

Combined Control conclusion: **all required F33-02 running-product evidence proven** (RPV-01 identity/preload/SW + RPV-02 browser-local/offline matrix).

## 13. Final fixture / server state

| Fixture | State |
|---|---|
| WO-F32V-MOBILE (`d226af8f-3887-4ebc-9409-b4c14511e1cd`) | **OPEN**; assigned to Engineer A |
| WO-F32V-BOUNDARY (`76de97b5-c108-4a20-88d0-bcc3d4e80622`) | **OPEN**; assigned to Engineer A |
| Visit `f26e2e37-525d-41f1-9282-920ae1f70e90` | **DEPARTED** |
| Evidence / commercial / catalogue | **not mutated** by F33-02 verification |
| Candidate source | **clean** at certification |

## 14. Security / partition / commercial evidence

- Partition by `ventureId + actorUserId` enforced in durable store helpers and proven in IndexedDB.
- Engineer A snapshots remain physically retained after identity switch; Engineer B cannot obtain them through product access (online or offline).
- Recursive stored-payload commercial scan: `forbiddenHits = []` (no inappropriate pricing / T&M / charge fields).

## 15. Lease evidence

- Lease created on successful authenticated preload.
- Exact **12-hour** duration proven (example: issued `2026-09-16T04:49:16.344Z` → expires `2026-09-16T16:49:16.344Z`).
- Offline reads do **not** renew lease (before/after expiry identical).
- Expired browser-local lease is not treated as valid/current; no automatic self-renewal.

## 16. Offline-read evidence

- My Work: preloaded assigned jobs readable offline with honesty messaging.
- Work Order: operational context readable offline; no commercial UI leakage.
- Visit/context: authorised DEPARTED Visit readable offline.

## 17. Mutation-block evidence

- `FRIGORA_FIELD_FORMS_OFFLINE_CAPTURE_ENABLED` remains **false**.
- Offline field mutation remained blocked (`data-frigora-offline` / reconnect honesty).

## 18. Service Worker boundary

- Navigation fallback to `/offline.html` only.
- No authenticated business HTML cache.
- No business/API CacheStorage.
- No mutation queue / background business synchronisation in the Service Worker.

## 19. Known non-material observations

- RPV-F33-02-01-R1 incomplete ending due to managed-browser tooling limits only (not product defect).
- Supplemental lab: Sign-out used session-cookie clear with IndexedDB retained where field chrome lacked an exposed Sign-out control; isolation still proven.
- F33-02 offline access remains scoped to already-loaded / in-session field shell (cold offline navigation may still hit `/offline.html`).

## 20. Material defect statement

**NONE.**

## 21. Certification conclusion

Control accepts F33-02 — Preloaded / Read-Only Field Workspace as **CERTIFIED** at implementation checkpoint `b519130087d86f6197561c54296670807a995a46` with BUILD_ID `z9ENnfzUdDGwWKMv1b2k4`, product `frigora@0.21.0`, SCHEMA_GENERATION `26`, offline DB version `1`, and offline capture flag `false`.

F33-03 is **not** authorised by this record.
