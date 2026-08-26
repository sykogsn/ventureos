import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { asc, eq } from "drizzle-orm";
import type { Job } from "./orchestrator";
import {
  createJobOrchestrator,
  INTERRUPTED_BY_RESTART,
  INVALID_JOB_PAYLOAD,
} from "./orchestrator";
import { ensureSchema, getDb } from "@/platform/persistence/db";
import { jobs as jobTable } from "@/platform/persistence/schema";
import {
  getPersistence,
  resetPersistenceLifecycle,
} from "@/platform/persistence/repositories/sqlite";
import type { UserId } from "@/contracts";

const kernelPath = join(
  dirname(fileURLToPath(import.meta.url)),
  "../kernel.ts",
);

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
  tempDir = await mkdtemp(join(tmpdir(), "vos-jobs-"));
  const path = join(tempDir, "ventureos.db").replaceAll("\\", "/");
  return `file:${path}`;
}

describe("durable JobOrchestrator", () => {
  it("persists a queued job through persistence lifecycle recreation", async () => {
    const url = await fileDatabase();
    await resetPersistenceLifecycle(url);
    await ensureSchema();
    const first = createJobOrchestrator();
    const enqueued = await first.enqueue("work", { n: 1 });

    await resetPersistenceLifecycle(url);
    await ensureSchema();
    const rows = await getDb().select().from(jobTable);
    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.id, enqueued.id);
    assert.equal(rows[0]?.status, "queued");
    assert.equal(rows[0]?.payloadJson, JSON.stringify({ n: 1 }));
  });

  it("executes a persisted queued job after recreation once the handler is registered", async () => {
    const url = await fileDatabase();
    await resetPersistenceLifecycle(url);
    await ensureSchema();
    const first = createJobOrchestrator();
    await first.enqueue("work", { n: 2 });

    await resetPersistenceLifecycle(url);
    await ensureSchema();
    const second = createJobOrchestrator();
    const seen: unknown[] = [];
    second.register("work", async (job: Job) => {
      seen.push(job.payload);
    });

    const processed = await second.processDue();
    assert.equal(processed, 1);
    assert.deepEqual(seen, [{ n: 2 }]);
    const rows = await getDb().select().from(jobTable);
    assert.equal(rows[0]?.status, "completed");
  });

  it("fails interrupted running jobs and does not execute them again", async () => {
    const url = await fileDatabase();
    await resetPersistenceLifecycle(url);
    await ensureSchema();
    const first = createJobOrchestrator();
    const job = await first.enqueue("work", { n: 3 });
    await getDb()
      .update(jobTable)
      .set({ status: "running", attempts: 1 })
      .where(eq(jobTable.id, job.id));

    await resetPersistenceLifecycle(url);
    await ensureSchema();
    const second = createJobOrchestrator();
    let ran = 0;
    second.register("work", async () => {
      ran += 1;
    });

    await second.processDue();
    assert.equal(ran, 0);
    const rows = await getDb().select().from(jobTable);
    assert.equal(rows[0]?.status, "failed");
    assert.equal(rows[0]?.lastError, INTERRUPTED_BY_RESTART);
  });

  it("does not let overlapping processDue execute one queued job twice", async () => {
    await resetPersistenceLifecycle(":memory:");
    await ensureSchema();
    const jobs = createJobOrchestrator();
    let runs = 0;
    let release!: () => void;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    let started!: () => void;
    const began = new Promise<void>((resolve) => {
      started = resolve;
    });

    jobs.register("slow", async () => {
      runs += 1;
      started();
      await held;
    });
    await jobs.enqueue("slow", { n: 4 });

    const first = jobs.processDue();
    await began;
    const second = jobs.processDue();
    release();
    const processed = await Promise.all([first, second]);

    assert.equal(runs, 1);
    assert.equal(processed[0] + processed[1], 1);
  });

  it("fails malformed payload_json without invoking the handler", async () => {
    await resetPersistenceLifecycle(":memory:");
    await ensureSchema();
    const jobs = createJobOrchestrator();
    let ran = 0;
    jobs.register("work", async () => {
      ran += 1;
    });
    const job = await jobs.enqueue("work", { n: 5 });
    await getDb()
      .update(jobTable)
      .set({ payloadJson: "{not-json" })
      .where(eq(jobTable.id, job.id));

    const processed = await jobs.processDue();
    assert.equal(processed, 1);
    assert.equal(ran, 0);
    const rows = await getDb().select().from(jobTable);
    assert.equal(rows[0]?.status, "failed");
    assert.equal(rows[0]?.lastError, INVALID_JOB_PAYLOAD);
  });

  it("continues processing later due jobs after one failure", async () => {
    await resetPersistenceLifecycle(":memory:");
    await ensureSchema();
    const jobs = createJobOrchestrator();
    const seen: string[] = [];
    jobs.register("fail", async () => {
      throw new Error("boom");
    });
    jobs.register("ok", async (job) => {
      seen.push(job.name);
    });
    await jobs.enqueue("fail");
    await jobs.enqueue("ok");

    const processed = await jobs.processDue();
    assert.equal(processed, 2);
    assert.deepEqual(seen, ["ok"]);
    const rows = await getDb()
      .select()
      .from(jobTable)
      .orderBy(asc(jobTable.name));
    assert.equal(rows.find((row) => row.name === "fail")?.status, "failed");
    assert.equal(rows.find((row) => row.name === "ok")?.status, "completed");
  });

  it("initialises generation 3 without destroying existing records", async () => {
    await resetPersistenceLifecycle(":memory:");
    await ensureSchema();
    const store = getPersistence();
    await store.users.insert({
      id: "user-1" as UserId,
      email: "founder@ventureos.test",
      name: "Founder",
      passwordHash: "hash",
      createdAt: "2026-08-26T00:00:00.000Z",
    });

    await ensureSchema();
    const user = await store.users.findById("user-1" as UserId);
    assert.equal(user?.email, "founder@ventureos.test");

    const jobs = createJobOrchestrator();
    await jobs.enqueue("noop", null);
    const rows = await getDb().select().from(jobTable);
    assert.equal(rows.length, 1);
  });

  it("does not register a workforce.run handler", async () => {
    const source = await readFile(kernelPath, "utf8");
    assert.match(source, /jobs\.register\("noop"/);
    assert.doesNotMatch(source, /workforce\.run/);
  });
});
