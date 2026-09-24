import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, it } from "node:test";
import type { VentureId, WorkspaceId } from "@/contracts";
import type { AgentDefinitionId, AgentInstanceId } from "@/contracts/ids";
import { ensureSchema, getDb } from "@/platform/persistence/db";
import { agentInstances } from "@/platform/persistence/schema";
import { resetPersistenceLifecycle } from "@/platform/persistence/repositories/sqlite";
import { createWorkforceInstanceRepository } from "./instance-repository";
import type { AgentInstance } from "@/core/workforce/types";

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
  tempDir = await mkdtemp(join(tmpdir(), "vos-inst-"));
  const path = join(tempDir, "ventureos.db").replaceAll("\\", "/");
  return `file:${path}`;
}

function instance(overrides: Partial<AgentInstance> = {}): AgentInstance {
  return {
    id: "instance-1" as AgentInstanceId,
    definitionId: "definition-1" as AgentDefinitionId,
    definitionVersion: "1",
    workspaceId: "ws-1" as WorkspaceId,
    ventureId: "venture-1" as VentureId,
    status: "active",
    ...overrides,
  };
}

describe("durable AgentInstance repository", () => {
  it("survives persistence restart", async () => {
    const url = await fileDatabase();
    await resetPersistenceLifecycle(url);
    await ensureSchema();
    const first = createWorkforceInstanceRepository();
    await first.insert(instance());

    await resetPersistenceLifecycle(url);
    await ensureSchema();
    const loaded = await createWorkforceInstanceRepository().get(
      "instance-1" as AgentInstanceId,
    );
    assert.equal(loaded?.definitionVersion, "1");
    assert.equal(loaded?.status, "active");
  });

  it("uses status as the kill switch without changing the pinned version", async () => {
    await resetPersistenceLifecycle(":memory:");
    await ensureSchema();
    const repo = createWorkforceInstanceRepository();
    await repo.insert(instance());
    await repo.setStatus("instance-1" as AgentInstanceId, "disabled");
    const loaded = await repo.get("instance-1" as AgentInstanceId);
    assert.equal(loaded?.status, "disabled");
    assert.equal(loaded?.definitionId, "definition-1");
    assert.equal(loaded?.definitionVersion, "1");

    await ensureSchema();
    const rows = await getDb().select().from(agentInstances);
    assert.equal(rows[0]?.definitionVersion, "1");
  });
});
