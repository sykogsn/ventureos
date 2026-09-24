import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, it } from "node:test";
import type { AgentDefinitionId } from "@/contracts/ids";
import { ensureSchema } from "@/platform/persistence/db";
import { resetPersistenceLifecycle } from "@/platform/persistence/repositories/sqlite";
import { createWorkforceDefinitionRepository } from "./definition-repository";
import type { AgentDefinition } from "@/core/workforce/types";

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
  tempDir = await mkdtemp(join(tmpdir(), "vos-def-"));
  const path = join(tempDir, "ventureos.db").replaceAll("\\", "/");
  return `file:${path}`;
}

function definition(overrides: Partial<AgentDefinition> = {}): AgentDefinition {
  return {
    id: "definition-1" as AgentDefinitionId,
    version: "1",
    role: "Research Analyst",
    responsibilities: ["Prepare cited findings."],
    capabilityAllowList: ["workforce.execution-probe"],
    capabilityDenyList: ["governance.founder-decision"],
    autonomyCeiling: "execute",
    approvalBoundary: "",
    memoryPolicy: "run-scoped",
    escalationPolicy: "fail-run",
    evaluationProfile: "verifiedCompletion",
    lifecycle: "ACTIVE",
    ...overrides,
  };
}

describe("durable AgentDefinition repository", () => {
  it("survives persistence restart", async () => {
    const url = await fileDatabase();
    await resetPersistenceLifecycle(url);
    await ensureSchema();
    const first = createWorkforceDefinitionRepository();
    await first.publish(definition());

    await resetPersistenceLifecycle(url);
    await ensureSchema();
    const second = createWorkforceDefinitionRepository();
    const loaded = await second.get("definition-1" as AgentDefinitionId, "1");
    assert.equal(loaded?.role, "Research Analyst");
    assert.equal(loaded?.lifecycle, "ACTIVE");
  });

  it("rejects content mutation of a published version", async () => {
    await resetPersistenceLifecycle(":memory:");
    await ensureSchema();
    const repo = createWorkforceDefinitionRepository();
    await repo.publish(definition());
    await assert.rejects(
      () => repo.publish(definition({ role: "Changed" })),
      /immutable/,
    );
    const loaded = await repo.get("definition-1" as AgentDefinitionId, "1");
    assert.equal(loaded?.role, "Research Analyst");
  });

  it("allows identical republish and lifecycle-only updates", async () => {
    await resetPersistenceLifecycle(":memory:");
    await ensureSchema();
    const repo = createWorkforceDefinitionRepository();
    await repo.publish(definition());
    await repo.publish(definition());
    await repo.setLifecycle("definition-1" as AgentDefinitionId, "1", "DISABLED");
    const loaded = await repo.get("definition-1" as AgentDefinitionId, "1");
    assert.equal(loaded?.lifecycle, "DISABLED");
    assert.equal(loaded?.role, "Research Analyst");
  });

  it("keeps version 1 pinned when version 2 is published", async () => {
    await resetPersistenceLifecycle(":memory:");
    await ensureSchema();
    const repo = createWorkforceDefinitionRepository();
    await repo.publish(definition({ version: "1", role: "v1" }));
    await repo.publish(definition({ version: "2", role: "v2" }));
    const v1 = await repo.get("definition-1" as AgentDefinitionId, "1");
    const v2 = await repo.get("definition-1" as AgentDefinitionId, "2");
    assert.equal(v1?.role, "v1");
    assert.equal(v2?.role, "v2");
    assert.equal(await repo.has("definition-1" as AgentDefinitionId), true);
  });
});
