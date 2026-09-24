import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { afterEach, describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import type { WorkforceRunId } from "@/contracts/ids";
import { EXECUTION_PROBE_CAPABILITY_ID } from "@/core/workforce/executors";
import { EXECUTION_PROBE_PREDICATE_ID } from "@/core/workforce/verifiers";
import { createId } from "@/platform/ids";
import { ensureSchema, getDb } from "@/platform/persistence/db";
import { resetPersistenceLifecycle } from "@/platform/persistence/repositories/sqlite";
import {
  workforceExecutions as executionTable,
  workforceRuns as runTable,
  workforceVerifications as verificationTable,
} from "@/platform/persistence/schema";
import { inspectWorkforceRun } from "@/platform/workforce/inspect";

const here = dirname(fileURLToPath(import.meta.url));
const inspectPath = join(here, "inspect.ts");

afterEach(async () => {
  await resetPersistenceLifecycle(":memory:");
});

describe("workforce run inspector", () => {
  it("returns redacted run, execution, and verification identity without evidence JSON", async () => {
    await resetPersistenceLifecycle(":memory:");
    await ensureSchema();
    const runId = createId<WorkforceRunId>();
    const executionId = createId();
    const verificationId = createId();
    const now = "2026-08-26T00:00:00.000Z";
    await getDb().insert(runTable).values({
      id: runId,
      jobId: null,
      workspaceId: "ws-1",
      ventureId: "venture-1",
      agentInstanceId: "instance-1",
      definitionId: "definition-1",
      definitionVersion: "1",
      objective: "inspect",
      phase: "completed",
      completionKind: "executed",
      failureCategory: null,
      sourceRequestId: runId,
      selectedCapabilityId: EXECUTION_PROBE_CAPABILITY_ID,
      selectedActionIndex: 0,
      selectedActionJson: null,
      argumentHash: null,
      fingerprintHash: null,
      executionId,
      approvalId: null,
      verificationOutcome: "VERIFIED",
      modelCallCount: 1,
      requestedByUserId: "user-1",
      createdAt: now,
      updatedAt: now,
      completedAt: now,
    });
    await getDb().insert(executionTable).values({
      id: executionId,
      idempotencyKey: createId(),
      workspaceId: "ws-1",
      ventureId: "venture-1",
      agentInstanceId: "instance-1",
      capabilityId: EXECUTION_PROBE_CAPABILITY_ID,
      sourceRequestId: runId,
      sourceActionIndex: 0,
      argumentHash: "args",
      fingerprintHash: "fp",
      status: "succeeded",
      authorityContextVersion: "ctx",
      authorityEvaluatedAt: now,
      outcomeJson: JSON.stringify({ executorId: EXECUTION_PROBE_CAPABILITY_ID, ok: true }),
      errorCategory: null,
      implementationId: "test.workforce.execution-probe",
      implementationVersion: "1.0.0",
      externalReference: "ext-1",
      startedAt: now,
      completedAt: now,
    });
    await getDb().insert(verificationTable).values({
      id: verificationId,
      runId,
      executionId,
      workspaceId: "ws-1",
      ventureId: "venture-1",
      agentInstanceId: "instance-1",
      capabilityId: EXECUTION_PROBE_CAPABILITY_ID,
      sourceRequestId: runId,
      sourceActionIndex: 0,
      predicateId: EXECUTION_PROBE_PREDICATE_ID,
      predicateVersion: "1",
      predicateFingerprint: "fp",
      expectedJson: JSON.stringify({ marker: "alpha" }),
      status: "verified",
      failureCategory: null,
      attemptCount: 1,
      observationJson: null,
      evidenceJson: JSON.stringify({
        provenance: "system_observation",
        secretShouldNotLeak: true,
        observedKeys: ["marker"],
      }),
      provenance: "system_observation",
      claimNonce: null,
      implementationId: "test.workforce.execution-probe",
      implementationVersion: "1.0.0",
      createdAt: now,
      updatedAt: now,
      completedAt: now,
    });

    const inspection = await inspectWorkforceRun(runId);
    assert.ok(inspection);
    assert.equal(inspection?.run.phase, "completed");
    assert.equal(inspection?.run.verificationOutcome, "VERIFIED");
    assert.equal(inspection?.execution?.implementationId, "test.workforce.execution-probe");
    assert.equal(inspection?.execution?.implementationVersion, "1.0.0");
    assert.equal(inspection?.execution?.externalReference, "ext-1");
    assert.equal(
      inspection?.verification?.implementationId,
      "test.workforce.execution-probe",
    );
    const serialized = JSON.stringify(inspection);
    assert.equal(serialized.includes("evidence"), false);
    assert.equal(serialized.includes("secretShouldNotLeak"), false);
    assert.equal(serialized.includes("observedKeys"), false);
  });

  it("does not expose evidence JSON and remains venture-agnostic", async () => {
    const source = await readFile(inspectPath, "utf8");
    assert.doesNotMatch(source, /evidenceJson/);
    assert.doesNotMatch(source, /Qualora|Calviora|Farmora/);
    assert.equal(await inspectWorkforceRun("missing" as WorkforceRunId), undefined);
  });
});
