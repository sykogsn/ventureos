import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { FOUNDER_ONLY_CAPABILITIES } from "./authority";
import {
  createExecutionProbeExecutor,
  createProbeAuthoritativeStore,
  EXECUTION_PROBE_CAPABILITY_ID,
} from "./executors";
import {
  createExecutionProbeVerifier,
  createWorkforceVerifierRegistry,
  EXECUTION_PROBE_PREDICATE_ID,
} from "./verifiers";
import type { CapabilityVerifier } from "./verifiers";

const scope = {
  workspaceId: "ws-1",
  ventureId: "venture-1",
  agentInstanceId: "instance-1",
};

describe("workforce verifier registry", () => {
  it("rejects founder-only and duplicate verifier ids", () => {
    const rogue: CapabilityVerifier = {
      id: FOUNDER_ONLY_CAPABILITIES[0],
      bindPredicate: () => ({ ok: false }),
      async observe() {
        return { status: "missing", observedAt: "2026-08-26T00:00:00.000Z" };
      },
      apply: () => ({ outcome: "NOT_VERIFIED" }),
    };
    assert.throws(
      () => createWorkforceVerifierRegistry([rogue]),
      /Verifier registration forbidden/,
    );
    const store = createProbeAuthoritativeStore();
    const probe = createExecutionProbeVerifier(store);
    assert.throws(
      () => createWorkforceVerifierRegistry([probe.verifier, probe.verifier]),
      /Duplicate verifier/,
    );
  });

  it("does not look up verifiers by catalogue strings", () => {
    const store = createProbeAuthoritativeStore();
    const probe = createExecutionProbeVerifier(store);
    const registry = createWorkforceVerifierRegistry([probe.verifier]);
    assert.equal(registry.get(EXECUTION_PROBE_CAPABILITY_ID)?.id, EXECUTION_PROBE_CAPABILITY_ID);
    assert.equal(registry.get("intelligence.knowledge-graph"), undefined);
  });

  it("binds a capability-owned predicate the model cannot supply", () => {
    const store = createProbeAuthoritativeStore();
    const probe = createExecutionProbeVerifier(store);
    const bound = probe.verifier.bindPredicate({ marker: "alpha" });
    assert.equal(bound.ok, true);
    if (!bound.ok) {
      return;
    }
    assert.equal(bound.predicate.id, EXECUTION_PROBE_PREDICATE_ID);
    assert.equal(bound.predicate.capabilityId, EXECUTION_PROBE_CAPABILITY_ID);
    assert.equal(bound.predicate.expected.marker, "alpha");
  });

  it("never treats executor success as VERIFIED", async () => {
    const store = createProbeAuthoritativeStore();
    const executor = createExecutionProbeExecutor(store);
    const probe = createExecutionProbeVerifier(store);
    const outcome = await executor.executor.execute({
      executionId: "exec-1",
      actor: {
        kind: "agent",
        agentInstanceId: "instance-1" as never,
        workspaceId: "ws-1" as never,
        ventureId: "venture-1" as never,
      },
      agentInstanceId: "instance-1" as never,
      workspaceId: "ws-1" as never,
      ventureId: "venture-1" as never,
      capabilityId: EXECUTION_PROBE_CAPABILITY_ID,
      arguments: { marker: "alpha" },
      externalIdempotencyKey: "core-derived-key",
      sourceRequestId: "run-1",
    });
    assert.equal(outcome.ok, true);
    assert.equal("outcome" in outcome, false);

    const bound = probe.verifier.bindPredicate({ marker: "alpha" });
    assert.equal(bound.ok, true);
    if (!bound.ok) {
      return;
    }
    store.clear(scope);
    const observation = await probe.verifier.observe({
      runId: "run-1",
      executionId: "exec-1",
      ...scope,
      capabilityId: EXECUTION_PROBE_CAPABILITY_ID,
      predicateFingerprint: bound.predicate.fingerprint,
      sourceRequestId: "run-1",
      sourceActionIndex: 0,
    });
    assert.equal(observation.status, "missing");
    assert.equal(probe.verifier.apply(bound.predicate, observation).outcome, "NOT_VERIFIED");
  });

  it("verifies matching authoritative state and rejects mismatch without retry logic", async () => {
    const store = createProbeAuthoritativeStore();
    store.write(scope, "alpha");
    const probe = createExecutionProbeVerifier(store);
    const bound = probe.verifier.bindPredicate({ marker: "alpha" });
    assert.equal(bound.ok, true);
    if (!bound.ok) {
      return;
    }
    const request = {
      runId: "run-1",
      executionId: "exec-1",
      ...scope,
      capabilityId: EXECUTION_PROBE_CAPABILITY_ID,
      predicateFingerprint: bound.predicate.fingerprint,
      sourceRequestId: "run-1",
      sourceActionIndex: 0,
    };
    const matched = await probe.verifier.observe(request);
    assert.equal(matched.status, "observed");
    assert.equal(probe.verifier.apply(bound.predicate, matched).outcome, "VERIFIED");

    store.write(scope, "beta");
    const mismatched = await probe.verifier.observe(request);
    assert.equal(probe.verifier.apply(bound.predicate, mismatched).outcome, "NOT_VERIFIED");
  });
});
