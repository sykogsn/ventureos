import assert from "node:assert/strict";
import { after, describe, it, mock } from "node:test";
import { getPlatform, runPlatformMaintenance } from "@/platform/kernel";
import { resetPersistenceLifecycle } from "@/platform/persistence/repositories";
import { createScheduler, runGuardedSteps } from "./scheduler";

after(async () => {
  await resetPersistenceLifecycle(":memory:");
  mock.timers.reset();
});

function captureSchedulerErrors() {
  const errors: unknown[][] = [];
  const original = console.error;
  console.error = (...args: unknown[]) => {
    if (args[0] === "[scheduler] task failed") errors.push(args);
    else original(...args);
  };
  return {
    errors,
    restore() {
      console.error = original;
    },
  };
}

describe("scheduler lifecycle", () => {
  it("waits for the in-flight task during shutdown and does not run it again", async () => {
    mock.timers.enable({ apis: ["setInterval"] });
    try {
      const scheduler = createScheduler();
      let release: (value?: void | PromiseLike<void>) => void = () => undefined;
      const gate = new Promise<void>((resolve) => {
        release = resolve;
      });
      let starts = 0;
      scheduler.every("hold", 1_000, async () => {
        starts += 1;
        await gate;
      });

      mock.timers.tick(1_000);
      assert.equal(starts, 1);

      let stopped = false;
      const stopping = scheduler.stopAll().then(() => {
        stopped = true;
      });
      assert.equal(stopped, false);

      release();
      await stopping;
      assert.equal(stopped, true);

      mock.timers.tick(1_000);
      assert.equal(starts, 1);
    } finally {
      mock.timers.reset();
    }
  });

  it("reports a rejected scheduled task and leaves the returned shutdown settled", async () => {
    mock.timers.enable({ apis: ["setInterval"] });
    const captured = captureSchedulerErrors();
    try {
      const scheduler = createScheduler();
      scheduler.every("boom", 1_000, async () => {
        throw new Error("scheduled-boom");
      });
      mock.timers.tick(1_000);
      await scheduler.stopAll();
      assert.equal(captured.errors.length, 1);
      assert.deepEqual(captured.errors[0]?.slice(0, 2), ["[scheduler] task failed", "boom"]);
      assert.equal(captured.errors[0]?.[2], "scheduled-boom");
    } finally {
      captured.restore();
      mock.timers.reset();
    }
  });

  it("runs the next guarded step after an earlier step rejects", async () => {
    const captured = captureSchedulerErrors();
    try {
      let recovered = false;
      await runGuardedSteps([
        {
          name: "jobs.processDue",
          run: async () => {
            throw new Error("due down");
          },
        },
        {
          name: "workforce.recover",
          run: async () => {
            recovered = true;
          },
        },
      ]);
      assert.equal(recovered, true);
      assert.equal(captured.errors.length, 1);
      assert.equal(captured.errors[0]?.[1], "jobs.processDue");
      assert.equal(captured.errors[0]?.[2], "due down");
    } finally {
      captured.restore();
    }
  });
});

describe("platform maintenance and persistence reset", () => {
  it("reports both maintenance failures and still finishes the later step", async () => {
    const captured = captureSchedulerErrors();
    try {
      let recovered = false;
      await runPlatformMaintenance({
        processDue: async () => {
          throw new Error("due down");
        },
        recover: async () => {
          recovered = true;
          throw new Error("recover down");
        },
      });
      assert.equal(recovered, true);
      assert.deepEqual(
        captured.errors.map((entry) => [entry[1], entry[2]]),
        [
          ["jobs.processDue", "due down"],
          ["workforce.recover", "recover down"],
        ],
      );
    } finally {
      captured.restore();
    }
  });

  it("drains scheduled work before persistence reset and does not restart the scheduler", async () => {
    mock.timers.enable({ apis: ["setInterval"] });
    try {
      const platform = getPlatform();
      let release: (value?: void | PromiseLike<void>) => void = () => undefined;
      const gate = new Promise<void>((resolve) => {
        release = resolve;
      });
      const order: string[] = [];
      platform.scheduler.every("hold", 1_000, async () => {
        order.push("start");
        await gate;
        order.push("finish");
      });

      mock.timers.tick(1_000);
      assert.deepEqual(order, ["start"]);

      let resetDone = false;
      const resetting = resetPersistenceLifecycle(":memory:").then(() => {
        resetDone = true;
        order.push("reset");
      });
      assert.equal(resetDone, false);
      assert.deepEqual(order, ["start"]);

      release();
      await resetting;
      assert.deepEqual(order, ["start", "finish", "reset"]);

      getPlatform();
      mock.timers.tick(1_000);
      assert.deepEqual(order, ["start", "finish", "reset"]);
    } finally {
      await resetPersistenceLifecycle(":memory:");
      mock.timers.reset();
    }
  });
});
