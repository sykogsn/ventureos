import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import type { VentureId, WorkspaceId } from "@/contracts";
import type { AgentInstanceId, WorkforceRunId } from "@/contracts/ids";
import { bindPredicateRecord } from "@/core/workforce/verification";
import { EXECUTION_PROBE_CAPABILITY_ID } from "@/core/workforce/executors";
import { EXECUTION_PROBE_PREDICATE_ID } from "@/core/workforce/verifiers";
import { ensureSchema, getDb } from "@/platform/persistence/db";
import { workforceVerifications as verificationTable } from "@/platform/persistence/schema";
import { resetPersistenceLifecycle } from "@/platform/persistence/repositories/sqlite";
import { createWorkforceVerificationStore } from "@/platform/workforce/verification-store";
import { jobs as jobTable } from "@/platform/persistence/schema";

afterEach(async () => {
  await resetPersistenceLifecycle(":memory:");
});

function insertInput() {
  return {
    runId: "run-1" as WorkforceRunId,
    executionId: "exec-1",
    workspaceId: "ws-1" as WorkspaceId,
    ventureId: "venture-1" as VentureId,
    agentInstanceId: "instance-1" as AgentInstanceId,
    capabilityId: EXECUTION_PROBE_CAPABILITY_ID,
    sourceRequestId: "run-1",
    sourceActionIndex: 0,
    predicate: bindPredicateRecord(
      {
        id: EXECUTION_PROBE_PREDICATE_ID,
        version: "1",
        capabilityId: EXECUTION_PROBE_CAPABILITY_ID,
      },
      { marker: "alpha" },
    ),
  };
}

describe("workforce verification store", () => {
    it("initialises schema generation 8 without destroying existing records", async () => {
    await resetPersistenceLifecycle(":memory:");
    await ensureSchema();
    const store = createWorkforceVerificationStore();
    await store.insertPending({
      ...insertInput(),
      implementationId: "bind-1",
      implementationVersion: "1.0.0",
    });
    await ensureSchema();
    const rows = await getDb().select().from(verificationTable);
    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.runId, "run-1");
    assert.equal(rows[0]?.implementationId, "bind-1");
    assert.equal(rows[0]?.implementationVersion, "1.0.0");
    const jobs = await getDb().select().from(jobTable);
    assert.equal(Array.isArray(jobs), true);
  });

  it("inserts once per run and claims observing once", async () => {
    const store = createWorkforceVerificationStore();
    const first = await store.insertPending(insertInput());
    const second = await store.insertPending(insertInput());
    assert.equal(first.id, second.id);
    const claimed = await store.claimObserving(first.id);
    const raced = await store.claimObserving(first.id);
    assert.equal(claimed?.status, "observing");
    assert.equal(claimed?.attemptCount, 1);
    assert.equal(raced, undefined);
  });

  it("does not overwrite a final VERIFIED or NOT_VERIFIED row", async () => {
    const store = createWorkforceVerificationStore();
    const pending = await store.insertPending(insertInput());
    await store.claimObserving(pending.id);
    const verified = await store.complete(
      pending.id,
      "VERIFIED",
      JSON.stringify({ provenance: "system_observation" }),
      "system_observation",
    );
    assert.equal(verified?.status, "verified");
    const overwritten = await store.complete(
      pending.id,
      "NOT_VERIFIED",
      JSON.stringify({ provenance: "system_observation" }),
      "system_observation",
    );
    assert.equal(overwritten, undefined);
    const failed = await store.fail(pending.id, "OBSERVER_UNAVAILABLE");
    assert.equal(failed, undefined);
    const loaded = await store.get(pending.id);
    assert.equal(loaded?.status, "verified");

    const other = await store.insertPending({
      ...insertInput(),
      runId: "run-2" as WorkforceRunId,
      executionId: "exec-2",
    });
    await store.claimObserving(other.id);
    await store.complete(
      other.id,
      "NOT_VERIFIED",
      JSON.stringify({ provenance: "system_observation" }),
      "system_observation",
    );
    const notVerifiedOverwrite = await store.complete(
      other.id,
      "VERIFIED",
      JSON.stringify({ provenance: "system_observation" }),
      "system_observation",
    );
    assert.equal(notVerifiedOverwrite, undefined);
    assert.equal((await store.get(other.id))?.status, "not_verified");
  });
});
