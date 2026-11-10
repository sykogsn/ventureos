# MGCO-P1-FOUNDER-CERTIFICATION-01

**Document type.** Permanent founder certification record
**Project.** VentureOS
**Capability.** MGCO — Marketing, Growth & Commercial Operations
**Package.** Package 1 — Communications Foundation
**Record identifier.** MGCO-P1-FOUNDER-CERTIFICATION-01
**Repository record created.** 2026-11-10

This record documents the founder's approval of Package 1. It does not authorise production deployment, a change to application behaviour, an expansion of scope, or remediation. It does not certify any other VentureOS layer.

**Engineering index.** [Engineering Index](./README.md). Layer rule: a certificate stands only for its own layer.

## Authority and decision

| Field | Value |
|---|---|
| Founder decision | **APPROVED WITH DOCUMENTED LIMITATIONS** |
| Approval status | **APPROVE PACKAGE 1 CERTIFICATION WITH DOCUMENTED LIMITATIONS** |
| Certification status | **CERTIFIED WITH DOCUMENTED LIMITATIONS** |
| Authority | Founder |
| PR | [#11](https://github.com/sykogsn/ventureos/pull/11), merged to `main` |
| Certified baseline | `649d27340dddcf8feb53ab823310d74208316f0d` |
| Baseline commit subject | `Merge pull request #11 from sykogsn/feat/mgco-email-foundation` |
| Assessment reference | MGCO-P1-FORMAL-CERTIFICATION-ASSESSMENT-01 |
| Repository record date | 2026-11-10 |

The founder gave this approval in the MGCO-P1-FCR-01 instruction. No separate approval clock time was supplied. This record does not invent one. The date above is the date this repository record was created.

The assessment MGCO-P1-FORMAL-CERTIFICATION-ASSESSMENT-01 reviewed this same baseline and recommended that the evidence was ready for a founder decision. That assessment was not committed as its own file. This record is the permanent repository copy of the decision, the evidence summary, and the accepted limitations.

## What this certification is

Package 1 is certified only for the Communications Foundation behaviour present at the baseline commit:

1. Inbound email reception.
2. Webhook authenticity verification.
3. Venture-specific mailbox routing.
4. Conversation and message persistence.
5. Provider-event persistence.
6. Duplicate event protection.
7. Reuse of the existing audit infrastructure, subject to LIM-05.

Certification is not production deployment authorisation. The production restrictions below are not complete.

## Certified scope

| Capability | Status in this record |
|---|---|
| Provider-shaped inbound boundary, with a Resend adapter | Certified, subject to LIM-08 |
| Raw-byte webhook signature verification | Certified, subject to LIM-06 |
| Venture and workspace mailbox routing | Certified, subject to LIM-04 and LIM-09 |
| Conversation, message, and provider-event persistence | Certified |
| Duplicate provider-event protection | Certified |
| Existing audit infrastructure | Certified, subject to LIM-05 |
| Bounded webhook and provider-response handling in the application | Certified. The deployment proxy limit is not certified; see production restrictions |
| Mailbox registration validation and collision protection in the store | Certified, subject to LIM-04 and LIM-09 |
| Rejection of explicit authentication and processing failures | Certified, subject to LIM-01 |
| Metadata-based attachment classification | Certified, subject to LIM-02 |
| Raw HTML storage | Certified as storage only, subject to LIM-03 |

## Explicit exclusions

These capabilities are not implemented by this certification and are not certified:

- Autonomous customer replies.
- Outbound email.
- Marketing campaigns.
- Customer-facing communications UI.
- Telephone and messaging integrations.
- Production workforce execution.
- Automated follow-up execution.
- Pricing, negotiation, or commercial decision-making.

## Evidence summary

Evidence recorded against baseline `649d27340dddcf8feb53ab823310d74208316f0d`. No new test run, deployment check, or remediation was performed for this record.

| Evidence | Result |
|---|---|
| PR #11 | Merged into `main` |
| Focused communications tests | 37 passed, 0 failed |
| TypeScript check (`pnpm --filter web check-types`) | Passed |
| Targeted lint (`pnpm --filter web lint`) | Passed |
| Full web suite at the certified baseline | 1,266 tests; 1,246 passed; 20 failed. The full suite did not pass |
| Same full-suite command at pre-merge parent `fee02603d70acccf7f4961e509282735c1f920b8` | 1,229 tests; 1,209 passed; 20 failed |
| Failure comparison | The same 20 failures were present before the merge: three Frigora offline allowlist failures and seventeen scheduling test-harness import-mapping failures |

The full web suite is not green. See LIM-07.

## Accepted limitations

The founder accepted the following limitations as part of this certification. They remain in force at the certified baseline.

### LIM-01 — Email authentication policy

Explicit authentication failures and processing failures are rejected. Missing, neutral, and soft-fail authentication outcomes may be retained.

### LIM-02 — Attachment handling

Attachment acceptance is metadata-based. Attachment bytes are not downloaded or scanned.

### LIM-03 — HTML handling

HTML is stored without sanitisation. Any future rendering implementation must sanitise it before display.

### LIM-04 — Legacy mailbox collisions

Legacy mailbox normalisation collisions fail closed and require manual operational repair.

### LIM-05 — Audit persistence

The existing audit infrastructure may fail to persist an audit record without preventing message persistence. This is a material traceability limitation and must remain visible for future remediation.

### LIM-06 — Signature timestamp tolerance

Webhook signature verification uses a five-minute timestamp tolerance.

### LIM-07 — Full test suite

The full web test suite has 20 failures. These were independently reproduced at the exact pre-merge parent commit. The full suite is therefore not green, although the failures were not introduced by PR #11.

### LIM-08 — Provider implementation

The provider boundary is structurally separated, but the current implementation is Resend-specific. Additional providers require engineering changes.

### LIM-09 — Mailbox registration

No user-facing mailbox registration API is included in Package 1.

## Production restrictions

Certification does not authorise production exposure or production deployment. None of the following has been evidenced as done. They remain mandatory before production exposure:

1. Enforce the 1,000,000-byte webhook request limit at the deployment proxy or infrastructure layer.
2. Verify the deployed endpoint and configuration.
3. Establish operational handling for mailbox collisions.
4. Define appropriate operational handling and monitoring for audit persistence failures.

## Status

| Item | Status |
|---|---|
| Package 1 Communications Foundation at `649d27340dddcf8feb53ab823310d74208316f0d` | **CERTIFIED WITH DOCUMENTED LIMITATIONS** |
| Production deployment | **NOT AUTHORISED** |
| Excluded capabilities listed above | **NOT CERTIFIED** |
| Production restrictions 1–4 | **NOT COMPLETE** |
| LIM-01 through LIM-09 | **ACCEPTED AND STILL IN FORCE** |
