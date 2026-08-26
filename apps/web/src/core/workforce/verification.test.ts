import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  bindPredicateRecord,
  canRetryVerification,
  encodeVerificationEvidence,
  evidenceFromObservation,
  fingerprintBoundPredicate,
  isInfrastructureObservationFailure,
  isRetryableObservation,
  observationContainsForbiddenData,
  VERIFICATION_EVIDENCE_CEILING_BYTES,
  VERIFICATION_MAX_ATTEMPTS,
  VERIFICATION_MAX_RETRIES,
  VERIFICATION_RETRY_DELAY_MS,
} from "./verification";
import {
  VERIFICATION_FAILURES,
  VERIFICATION_OBSERVATION_STATUSES,
  VERIFICATION_RESULTS,
  VERIFICATION_STATUSES,
} from "./types";

describe("workforce verification contracts", () => {
  it("keeps VERIFIED and NOT_VERIFIED as the only domain outcomes", () => {
    assert.deepEqual([...VERIFICATION_RESULTS], ["VERIFIED", "NOT_VERIFIED"]);
    assert.equal(
      (VERIFICATION_RESULTS as readonly string[]).includes("UNCERTAIN"),
      false,
    );
  });

  it("fingerprints capability, predicate identity, version, and expected", () => {
    const first = fingerprintBoundPredicate({
      capabilityId: "workforce.execution-probe",
      predicateId: "workforce.execution-probe.marker",
      version: "1",
      expected: { marker: "alpha" },
    });
    const same = fingerprintBoundPredicate({
      capabilityId: "workforce.execution-probe",
      predicateId: "workforce.execution-probe.marker",
      version: "1",
      expected: { marker: "alpha" },
    });
    const differentExpected = fingerprintBoundPredicate({
      capabilityId: "workforce.execution-probe",
      predicateId: "workforce.execution-probe.marker",
      version: "1",
      expected: { marker: "beta" },
    });
    const differentVersion = fingerprintBoundPredicate({
      capabilityId: "workforce.execution-probe",
      predicateId: "workforce.execution-probe.marker",
      version: "2",
      expected: { marker: "alpha" },
    });
    assert.equal(first, same);
    assert.notEqual(first, differentExpected);
    assert.notEqual(first, differentVersion);
    assert.equal(first.length, 64);
  });

  it("does not let BoundPredicate callers omit the computed fingerprint", () => {
    const bound = bindPredicateRecord(
      {
        id: "workforce.execution-probe.marker",
        version: "1",
        capabilityId: "workforce.execution-probe",
      },
      { marker: "alpha" },
    );
    assert.equal(bound.fingerprint.length, 64);
    assert.equal(bound.expected.marker, "alpha");
  });

  it("retries missing, unavailable, and timeout once, then stops", () => {
    assert.equal(VERIFICATION_MAX_ATTEMPTS, 2);
    assert.equal(VERIFICATION_MAX_RETRIES, 1);
    assert.equal(VERIFICATION_RETRY_DELAY_MS, 15_000);
    assert.equal(isRetryableObservation("missing"), true);
    assert.equal(isRetryableObservation("unavailable"), true);
    assert.equal(isRetryableObservation("timeout"), true);
    assert.equal(isRetryableObservation("observed"), false);
    assert.equal(isRetryableObservation("invalid"), false);
    assert.equal(isInfrastructureObservationFailure("unavailable"), true);
    assert.equal(isInfrastructureObservationFailure("timeout"), true);
    assert.equal(isInfrastructureObservationFailure("missing"), false);
    assert.equal(canRetryVerification(1), true);
    assert.equal(canRetryVerification(2), false);
  });

  it("fail-closes evidence above 8 KiB and rejects credential keys", () => {
    assert.equal(VERIFICATION_EVIDENCE_CEILING_BYTES, 8 * 1024);
    const huge = encodeVerificationEvidence({
      provenance: "system_observation",
      observationStatus: "observed",
      predicateId: "p",
      predicateFingerprint: "f",
      capabilityId: "c",
      executionId: "e",
      observedKeys: ["marker"],
      matched: true,
    });
    assert.equal(huge.ok, true);
    const overflow = encodeVerificationEvidence({
      provenance: "system_observation",
      observationStatus: "observed",
      predicateId: "p".repeat(9000),
      predicateFingerprint: "f",
      capabilityId: "c",
      executionId: "e",
      observedKeys: ["marker"],
    });
    assert.equal(overflow.ok, false);
    if (!overflow.ok) {
      assert.equal(overflow.failure, "EVIDENCE_TOO_LARGE");
    }
    assert.equal(
      observationContainsForbiddenData({
        status: "observed",
        observedAt: "2026-08-26T00:00:00.000Z",
        values: { token: "secret" },
      }),
      true,
    );
    const evidence = evidenceFromObservation({
      observation: {
        status: "observed",
        observedAt: "2026-08-26T00:00:00.000Z",
        values: { marker: "alpha" },
      },
      predicate: bindPredicateRecord(
        {
          id: "workforce.execution-probe.marker",
          version: "1",
          capabilityId: "workforce.execution-probe",
        },
        { marker: "alpha" },
      ),
      executionId: "exec-1",
      matched: true,
    });
    assert.equal(evidence.provenance, "system_observation");
    assert.deepEqual(evidence.observedKeys, ["marker"]);
    assert.equal("token" in evidence, false);
  });

  it("keeps process-failure codes distinct from NOT_VERIFIED", () => {
    assert.equal(
      (VERIFICATION_FAILURES as readonly string[]).includes("NOT_VERIFIED"),
      false,
    );
    assert.deepEqual([...VERIFICATION_STATUSES], [
      "pending",
      "observing",
      "verified",
      "not_verified",
      "failed",
    ]);
    assert.deepEqual([...VERIFICATION_OBSERVATION_STATUSES], [
      "observed",
      "missing",
      "unavailable",
      "timeout",
      "invalid",
    ]);
  });
});
