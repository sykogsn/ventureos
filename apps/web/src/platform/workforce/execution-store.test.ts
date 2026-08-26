import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, it } from "node:test";
import { eq } from "drizzle-orm";
import {
  fingerprintExecution,
  type ExecutionClaimInput,
} from "@/core/workforce/execution";
import { ensureSchema, getDb } from "@/platform/persistence/db";
import { workforceExecutions as executionTable } from "@/platform/persistence/schema";
import { resetPersistenceLifecycle } from "@/platform/persistence/repositories/sqlite";
import {
  createWorkforceExecutionStore,
  EXECUTION_INTERRUPTED,
} from "./execution-store";

let tempDir: string | undefined;

afterEach(async () => {
  await resetPersistenceLifecycle(":memory:");
  if (tempDir) {
    const dir = tempDir;
    tempDir = undefined;
    await removeDir(dir);
  }
});

async function removeDir(dir: string) {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    try {
      await rm(dir, { recursive: true, force: true });
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }
}

async function fileDatabase() {
  tempDir = await mkdtemp(join(tmpdir(), "vos-exec-"));
  const path = join(tempDir, "ventureos.db").replaceAll("\\", "/");
  return `file:${path}`;
}

function claimInput(
  overrides: Partial<ExecutionClaimInput> = {},
): ExecutionClaimInput {
  const base = {
    id: "exec-1",
    idempotencyKey: "key-1",
    workspaceId: "ws-1",
    ventureId: "venture-1",
    agentInstanceId: "instance-1",
    capabilityId: "workforce.execution-probe",
    sourceRequestId: "req-1",
    sourceActionIndex: 0,
    argumentHash: "args-a",
    fingerprintHash: "",
    authorityContextVersion: "ctx-1",
    authorityEvaluatedAt: "2026-08-26T00:00:00.000Z",
    startedAt: "2026-08-26T00:00:00.000Z",
    ...overrides,
  };
  return {
    ...base,
    fingerprintHash:
      overrides.fingerprintHash ??
      fingerprintExecution({
        workspaceId: base.workspaceId,
        ventureId: base.ventureId,
        agentInstanceId: base.agentInstanceId,
        capabilityId: base.capabilityId,
        argumentHash: base.argumentHash,
      }),
  };
}

describe("workforce execution store", () => {
  it("initialises schema generation 7 without destroying existing records", async () => {
    await resetPersistenceLifecycle(":memory:");
    await ensureSchema();
    const store = createWorkforceExecutionStore();
    const first = await store.claim(
      claimInput({
        implementationId: "bind-1",
        implementationVersion: "1.0.0",
      }),
    );
    assert.equal(first.kind, "claimed");
    await store.complete("exec-1", {
      executorId: "workforce.execution-probe",
      ok: true,
      output: { invoked: 1 },
    });

    await ensureSchema();
    const rows = await getDb().select().from(executionTable);
    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.idempotencyKey, "key-1");
    assert.equal(rows[0]?.implementationId, "bind-1");
    assert.equal(rows[0]?.implementationVersion, "1.0.0");
    assert.equal(rows[0]?.status, "succeeded");
  });

  it("claims once under a unique idempotency key", async () => {
    await resetPersistenceLifecycle(":memory:");
    const store = createWorkforceExecutionStore();
    const first = await store.claim(claimInput({ id: "exec-1" }));
    const second = await store.claim(claimInput({ id: "exec-2" }));
    assert.equal(first.kind, "claimed");
    assert.equal(second.kind, "in_progress");
    assert.equal(second.record.id, "exec-1");
  });

  it("returns reused after a successful complete", async () => {
    await resetPersistenceLifecycle(":memory:");
    const store = createWorkforceExecutionStore();
    await store.claim(claimInput());
    await store.complete("exec-1", {
      executorId: "workforce.execution-probe",
      ok: true,
      output: { invoked: 1 },
    });
    const second = await store.claim(claimInput({ id: "exec-2" }));
    assert.equal(second.kind, "reused");
    assert.equal(second.record.status, "succeeded");
  });

  it("returns prior_failure after a failed complete and does not re-claim", async () => {
    await resetPersistenceLifecycle(":memory:");
    const store = createWorkforceExecutionStore();
    await store.claim(claimInput());
    await store.fail("exec-1", "EXECUTION_FAILED", {
      executorId: "workforce.execution-probe",
      ok: false,
      error: "EXECUTION_FAILED",
    });
    const second = await store.claim(claimInput({ id: "exec-2" }));
    assert.equal(second.kind, "prior_failure");
    assert.equal(second.record.errorCategory, "EXECUTION_FAILED");
  });

  it("fails closed when the same key is reused with a different fingerprint", async () => {
    await resetPersistenceLifecycle(":memory:");
    const store = createWorkforceExecutionStore();
    await store.claim(claimInput());
    const mismatch = await store.claim(
      claimInput({
        id: "exec-2",
        capabilityId: "workforce.execution-probe-alt",
        argumentHash: "args-b",
      }),
    );
    assert.equal(mismatch.kind, "mismatch");
  });

  it("marks interrupted running rows failed on a new store instance", async () => {
    const url = await fileDatabase();
    await resetPersistenceLifecycle(url);
    await ensureSchema();
    const first = createWorkforceExecutionStore();
    await first.claim(claimInput());

    await resetPersistenceLifecycle(url);
    await ensureSchema();
    const second = createWorkforceExecutionStore();
    const result = await second.claim(claimInput({ id: "exec-2" }));
    assert.equal(result.kind, "prior_failure");
    assert.equal(result.record.errorCategory, EXECUTION_INTERRUPTED);

    const rows = await getDb()
      .select()
      .from(executionTable)
      .where(eq(executionTable.id, "exec-1"));
    assert.equal(rows[0]?.status, "failed");
  });

  it("serializes concurrent claims so only one owns the side effect", async () => {
    await resetPersistenceLifecycle(":memory:");
    const store = createWorkforceExecutionStore();
    const [a, b] = await Promise.all([
      store.claim(claimInput({ id: "exec-a" })),
      store.claim(claimInput({ id: "exec-b" })),
    ]);
    const kinds = [a.kind, b.kind].sort();
    assert.deepEqual(kinds, ["claimed", "in_progress"]);
  });
});
