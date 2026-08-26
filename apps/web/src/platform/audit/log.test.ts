import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, it } from "node:test";
import type { UserId, VentureId, WorkspaceId } from "@/contracts";
import { createAuditLog } from "./log";
import { ensureSchema } from "@/platform/persistence/db";
import { resetPersistenceLifecycle } from "@/platform/persistence/repositories/sqlite";

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
  tempDir = await mkdtemp(join(tmpdir(), "vos-audit-"));
  const path = join(tempDir, "ventureos.db").replaceAll("\\", "/");
  return `file:${path}`;
}

describe("durable AuditLog", () => {
  it("persists an audit record through persistence lifecycle recreation", async () => {
    const url = await fileDatabase();
    await resetPersistenceLifecycle(url);
    await ensureSchema();
    const first = createAuditLog();
    const recorded = await first.record({
      action: "event.FounderDecisionRecorded",
      actor: { userId: "user-1" as UserId },
      metadata: { workspaceId: "ws-1", ventureId: "ven-1" },
    });

    await resetPersistenceLifecycle(url);
    await ensureSchema();
    const second = createAuditLog();
    const listed = await second.list();
    assert.equal(listed.length, 1);
    assert.equal(listed[0]?.id, recorded.id);
    assert.equal(listed[0]?.action, "event.FounderDecisionRecorded");
    assert.equal(listed[0]?.actor?.userId, "user-1");
  });

  it("lists records in deterministic chronological order", async () => {
    await resetPersistenceLifecycle(":memory:");
    await ensureSchema();
    const audit = createAuditLog();
    const first = await audit.record({ action: "event.first" });
    await new Promise((resolve) => setTimeout(resolve, 5));
    const second = await audit.record({ action: "event.second" });

    const listed = await audit.list();
    assert.deepEqual(
      listed.map((item) => item.id),
      [first.id, second.id],
    );
    assert.deepEqual(
      listed.map((item) => item.action),
      ["event.first", "event.second"],
    );
  });

  it("preserves workspace and Venture scope through recreation", async () => {
    const url = await fileDatabase();
    await resetPersistenceLifecycle(url);
    await ensureSchema();
    const first = createAuditLog();
    await first.record({
      action: "event.test",
      actor: {
        userId: "user-1" as UserId,
        workspaceId: "ws-1" as WorkspaceId,
        ventureId: "ven-1" as VentureId,
      },
      metadata: {
        workspaceId: "ws-1",
        ventureId: "ven-1",
      },
    });

    await resetPersistenceLifecycle(url);
    await ensureSchema();
    const listed = await createAuditLog().list();
    assert.equal(listed[0]?.metadata?.workspaceId, "ws-1");
    assert.equal(listed[0]?.metadata?.ventureId, "ven-1");
    assert.equal(listed[0]?.actor?.workspaceId, "ws-1");
    assert.equal(listed[0]?.actor?.ventureId, "ven-1");
  });
});
