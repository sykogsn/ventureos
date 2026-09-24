# Frigora F2.3 Certification Ã¢â‚¬â€ Engineer Job Workflow

**Document type.** Permanent venture-milestone certification record
**Venture.** Frigora
**Milestone.** F2.3 Engineer Job Workflow
**Control decision.** CERTIFIED
**Certification date.** 2026-09-09
**Approved by.** Frigora Verification & Certification Control

This record certifies the Frigora F2.3 Engineer Job Workflow product layer. It does **not** rewrite or replace the Foundation Certification Index (`docs/foundation/release/03-CERTIFICATION-INDEX.md`) or Foundation v1.1 (`FOUNDATION_CERTIFICATION_v1.1.md`). Layer-specific certification remains the law: this certificate does not stand for Runtime, IDS, Capability Registry, or Definition Registry certification.

**Engineering standard.** [Master Engineering Prompt](./MASTER_ENGINEERING_PROMPT.md). Index: [Engineering Index](./README.md).

---

## Checkpoint identity

| Field | Value |
|---|---|
| Branch | `feat/frigora-reconciliation` |
| Pre-certification HEAD | `f1c09bb9af3bac4ea4d02b01f622150251ebe426` |
| Product | **frigora@0.18.0** (unchanged; no version bump in this certification) |
| SCHEMA_GENERATION | **24** (unchanged; no schema change) |
| Final validation BUILD_ID | `UJipXEw69YYUFCcAQ9zxS` |

---

## Quality gates

| Gate | Result |
|---|---|
| F2.3 certification matrix | **172 / 172 PASS** |
| Full web suite (`pnpm test`) | **819 / 819 PASS** |
| Fail / cancelled / skipped / todo | **0 / 0 / 0 / 0** |
| `pnpm check-types` | EXIT **0** |
| `pnpm lint` | EXIT **0** |
| `pnpm build` | EXIT **0** |

---

## Closed corrective observations

| ID | State | Summary |
|---|---|---|
| F2.3-RPV-001 | **CLOSED** | Domain-authorized storage singleton kernel; forge-resistant; production bundle singleton verified |
| F2.3-RPV-002 | **CLOSED** | Frigora Visit Evidence protected byte reads; Independent Work verified |
| F2.3-OBS-003 | **CLOSED** | Reassignment dropdown remount key; live spot-check verified |

---

## Independent Work verification (programme items 1Ã¢â‚¬â€œ23)

All items below were independently verified on the disposable F2.3 running-product environment and are recorded as **VERIFIED**:

1. Engineer assignment visibility / My Work isolation
2. WorkOrder access isolation
3. Engineer Visit workflow
4. Visit attendance integrity
5. Visit departure leaves WorkOrder OPEN
6. Visit Evidence capture
7. Evidence persistence and association
8. Evidence retrieval
9. RPV-001 domain-authority storage correction
10. RPV-001 forge resistance
11. Engineer B pre-reassignment protected evidence denial
12. Owner/Dispatch protected evidence allow
13. Engineer A assigned protected evidence allow
14. Owner reassignment A Ã¢â€ â€™ B
15. Stale Engineer A mutation revocation
16. Engineer B post-reassignment authority acquisition
17. Same-session Engineer B protected read 404 Ã¢â€ â€™ 200 transition
18. Historical Engineer A Visit-attendee read-only retention
19. Engineer B authorised evidence create + delete
20. Engineer B Visit departure / WorkOrder OPEN retention
21. Historical Visit/evidence preservation
22. OBS-003 reassignment dropdown synchronisation
23. OBS-003 unchanged immediate re-submit preserves Engineer B

### Concise evidence themes

| Theme | Evidence |
|---|---|
| Assignment isolation | My Work / WO access scoped to assignee; unrelated engineer denied |
| Visit creation and attendance | Assigned engineer attendance integrity; actor spoofing denied |
| Evidence capture/retrieval | Visit Evidence create/persist/retrieve under assignment authority |
| Protected-read matrix | Deny unrelated member; allow Owner/`venture.update`, current assignee, Visit attendee |
| Reassignment | Owner AÃ¢â€ â€™B persists; stale A mutation revoked; B acquires authority |
| Attendee retention | Former assignee who attended retains read-only evidence access |
| Authorised create/delete | Current assignee evidence create/delete under domain authority |
| Departure / WO OPEN | Visit depart leaves WorkOrder OPEN until explicit completion |
| OBS-003 | `key={assignedUserId??"unassigned"}` remount; dropdown tracks B; unchanged resubmit keeps B |

---

## Architecture ownership (preserved)

| Owner | Responsibility |
|---|---|
| VentureOS | Shared runtime/platform, generic StoredObject primitives, auth/permissions, `@repo/storage-authority-kernel` |
| Frigora | WorkOrder/dispatch/Visit/evidence semantics; Frigora protected-read policy module invoked from `storedObjects.open()` |

---

## Certification INCLUDE path list (exact)

Disposable DB, Dev Tunnels, verification proxy, credentials, AUTH_SECRET, `.next` output, screenshots, and local cert/test log artefacts are **excluded** from this certification commit.

```
apps/web/next.config.js
apps/web/package.json
apps/web/src/app/(app)/ventures/[ventureId]/operations/page.tsx
apps/web/src/app/(app)/ventures/[ventureId]/work/[workOrderId]/page.tsx
apps/web/src/app/(app)/ventures/[ventureId]/work/page.tsx
apps/web/src/contracts/index.ts
apps/web/src/contracts/stored-objects.ts
apps/web/src/modules/frigora/app/engineer-job-workflow.test.ts
apps/web/src/modules/frigora/app/field-visit-recorder.test.ts
apps/web/src/modules/frigora/app/forms/dispatch-controls.tsx
apps/web/src/modules/frigora/app/screens/my-work-screen.tsx
apps/web/src/modules/frigora/app/screens/visit-entry-screen.tsx
apps/web/src/modules/frigora/app/screens/visit-recorder-screen.tsx
apps/web/src/modules/frigora/app/screens/work-screens.tsx
apps/web/src/modules/frigora/app/service-desk-dispatch.test.ts
apps/web/src/modules/frigora/app/views.ts
apps/web/src/modules/frigora/assignment.test.ts
apps/web/src/modules/frigora/service.ts
apps/web/src/modules/frigora/visit-evidence.test.ts
apps/web/src/platform/storage/domain-authority.test.ts
apps/web/src/platform/storage/domain-authority.ts
apps/web/src/platform/storage/frigora-evidence-protected-read.test.ts
apps/web/src/platform/storage/frigora-evidence-protected-read.ts
apps/web/src/platform/storage/service.ts
apps/web/src/platform/storage/stored-object.test.ts
apps/web/scripts/_adversarial-domain-authority-forge.mts
apps/web/scripts/verify-domain-authority-production-bundle.mts
apps/web/scripts/verify-f23-rpv001-running-product.mts
apps/web/scripts/verify-f23-rpv002-protected-read.mts
packages/storage-authority-kernel/index.cjs
packages/storage-authority-kernel/index.d.ts
packages/storage-authority-kernel/package.json
packages/storage-authority-kernel/proof-singleton.cjs
pnpm-lock.yaml
docs/engineering/FRIGORA_F2_3_CERTIFICATION.md
```

---

## SHA-256 file hashes (INCLUDE implementation/test set)

Computed 2026-09-09 against the validated pre-certification working tree (matched readiness-gate hashes). Paths use forward slashes.

```
3dd20f052bb88c71f2c0a86e563017582aeda507c1f5d7a4e253a134a89b7416  apps/web/next.config.js
6a6a41f3543cc5aac0419369043d04d949fe1ff4d60bd0ca657dfa96984a6d7b  apps/web/package.json
d60df266f9adb3a4ced241116e6bb6a8ad07bc2fb450db1ac84a51ca3ea6e5b4  apps/web/src/app/(app)/ventures/[ventureId]/operations/page.tsx
01e1fd69a22e7919dad95105f8d77df97e6773cde9bc682633dc3afacb7051ce  apps/web/src/app/(app)/ventures/[ventureId]/work/[workOrderId]/page.tsx
9f96788d3450ea4775a1beff37a0748865ff9f3fe499f6ea708b5be3f65ac22f  apps/web/src/app/(app)/ventures/[ventureId]/work/page.tsx
b95858c3c325bbf45577585604c04bb8f90759cd29192053172476e5a02de730  apps/web/src/contracts/index.ts
e8947400827619a760d6bd881529f8b0e6252b6849f8ef23c18e28dee021709e  apps/web/src/contracts/stored-objects.ts
0ab308259efbe1867e8c4dff349fe6712af2b3df87a7b879e36fca5f0f813308  apps/web/src/modules/frigora/app/field-visit-recorder.test.ts
02508fe4b8a82005df3aaac1518a497fa2a7f74fdb6f5be2beaca46faf6234ea  apps/web/src/modules/frigora/app/forms/dispatch-controls.tsx
3e657e364a8596ca97793168273465e6f38bfd7be8d2124ddd06faa15eb0ec18  apps/web/src/modules/frigora/app/screens/my-work-screen.tsx
4fa78763ad7692f6216c2bed8bdd01e54fbbc2900d222f4591b1c401e701c47a  apps/web/src/modules/frigora/app/screens/visit-entry-screen.tsx
20a5cf186ad07f515ff318f18dc2f1f00aaa779cb19b3d3b8b443f04924f0487  apps/web/src/modules/frigora/app/screens/visit-recorder-screen.tsx
d0daefa660611fb3c133bcb8f58dfbbdc8f66f3dff5798006cc930499fae7e2e  apps/web/src/modules/frigora/app/screens/work-screens.tsx
a779208f93c02a0c4d6e629cbd0bdc7fa3a98ed69d811bfdd73324b86638101b  apps/web/src/modules/frigora/app/service-desk-dispatch.test.ts
46507b334bbd3af52141f4cb06a827b5f2c79fa22b23523866355bb062f20437  apps/web/src/modules/frigora/app/views.ts
3b4d5307f7392c40caeec0f6dae3896a9d1e8728d24ba851ec7e3c8e6cfb8c1c  apps/web/src/modules/frigora/assignment.test.ts
e65cf601a0653ab1eaec1fdeaadf6fa0628188584194a15c1c81c6728c93af4c  apps/web/src/modules/frigora/service.ts
97621cd47bfb568c5754dbcbcb5327da277195201dfc030d1106f9f4f55e72cb  apps/web/src/modules/frigora/visit-evidence.test.ts
9fff7f10a8ec2cb349c5478ac4ea6987fe40b6c6d48d8f108c5d56ca2d748a76  apps/web/src/platform/storage/service.ts
283f4d59d4147c07d115a17afe91bf93d84c0a66ce45909043732eb7e383c53a  apps/web/src/platform/storage/stored-object.test.ts
bf579b0c91499f7ebfd3bb425551c52eaba106ab86fab5c8c51be50203381ee7  pnpm-lock.yaml
f9cdb1cd2d0e69a3d016c500513d3b314ac3007baccd2b0f00badc84cd7bb258  apps/web/scripts/_adversarial-domain-authority-forge.mts
51d2a4e2b998731d3207767493f43cf31a7ade83e73d8ce5a1f2e2bcb98422cc  apps/web/scripts/verify-domain-authority-production-bundle.mts
d0dd11cc58bcc48e30c0b6ba8389e892a6a52435c0052d62cd5bdee4a0fcd5fc  apps/web/scripts/verify-f23-rpv001-running-product.mts
67b58e6705cb7ace7d1a7508328488cc876e6ae702623e93cc9b352963c97881  apps/web/scripts/verify-f23-rpv002-protected-read.mts
2d335e680f5e413c404f3e636d0f0c19648ec4c03550c62c46accae4683f7b21  apps/web/src/modules/frigora/app/engineer-job-workflow.test.ts
a2250542934b5cc20ebd55e3ddc388f927a32c9724b3ad92e601ff99fdbdf675  apps/web/src/platform/storage/domain-authority.test.ts
a1f1c244ee4aa582ea7bd2ad1bf2bf319acd5bcf9005be8fe558b34b0ac12247  apps/web/src/platform/storage/domain-authority.ts
b2d621f223748ca4c671916d6b86b7db9ece29288298c2e3f6ebfd9b860b0845  apps/web/src/platform/storage/frigora-evidence-protected-read.test.ts
aead0d832d08e2ebceb64c8beda115be1ede3554b9a38b12447416f47a811bb7  apps/web/src/platform/storage/frigora-evidence-protected-read.ts
05004e77b5eba9300e6a8a79c55427b73471cc9e61db95a1001a577209fc8856  packages/storage-authority-kernel/index.cjs
85a0880f43c1218d8b8dee02ef3c2c9a7506a5ef6ee09ff5b832834c6fcb9c11  packages/storage-authority-kernel/index.d.ts
fb0e2b7f5d386e9aa5b8177bf15fa4ed8b8f73814324ccce706de4844d78197e  packages/storage-authority-kernel/package.json
95868609a79672b1739ec731cb8b4b959fa48b2b364e35dd58716ee902b48689  packages/storage-authority-kernel/proof-singleton.cjs
```

**Aggregate INCLUDE manifest SHA-256** (SHA-256 of the UTF-8 bytes of the 34 hash lines above, each terminated by `\n`, in the order listed):

`2288af13db04f4bfb3680fec2c529be4ff1e4b4266ad4937ae2f1269d702627c`

---

## Remaining non-blocking debt

1. Turbopack filesystem-tracing warnings on `domain-authority.ts` / `local-adapter.ts` (build EXIT 0).
2. No jsdom DOM remount unit test for OBS-003 (covered by keyed remount contract + Independent Work).
3. Working-tree CRLF noise on `packages/ids/tokens/generated/breakpoints.css` Ã¢â‚¬â€ **excluded** from certification.
4. Local cert/test log files under the repo and AppData disposable verification environment Ã¢â‚¬â€ **excluded**.

---

## Explicit exclusions statement

This certification commit excludes: disposable verification databases and StoredObject files; Dev Tunnel and probe-proxy artefacts; credentials and AUTH_SECRET; `.next` build output; screenshots; and all local `*out*.txt` / `cert-*.log` artefacts listed in the Control exclusion set. Schema remains **24**. Product remains **frigora@0.18.0**.

---

## Permanence

| Field | Value |
|---|---|
| Certification artefact path | `docs/engineering/FRIGORA_F2_3_CERTIFICATION.md` |
| Control status after permanence commit | F2.3 CERTIFIED (venture-milestone) |
| Programme 1 Certification Gate | Not progressed by this record; awaits separate Control acceptance |

The committed object identity of this artefact is recorded by the permanence git commit.
