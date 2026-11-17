export type ScheduledTask = {
  id: string;
  intervalMs: number;
  run: () => void | Promise<void>;
};

export type Scheduler = {
  every(id: string, intervalMs: number, run: ScheduledTask["run"]): void;
  stop(id: string): void;
  stopAll(): Promise<void>;
};

export function reportScheduledFailure(name: string, error: unknown): void {
  const detail = error instanceof Error ? error.message : "unknown error";
  console.error("[scheduler] task failed", name, detail);
}

/** Runs each step even when an earlier step rejects. Rejections are reported and do not escape. */
export async function runGuardedSteps(
  steps: ReadonlyArray<{ name: string; run: () => Promise<void> }>,
): Promise<void> {
  for (const step of steps) {
    try {
      await step.run();
    } catch (error) {
      reportScheduledFailure(step.name, error);
    }
  }
}

export function createScheduler(): Scheduler {
  const timers = new Map<string, ReturnType<typeof setInterval>>();
  const inflight = new Set<Promise<void>>();

  return {
    every(id, intervalMs, run) {
      this.stop(id);
      const timer = setInterval(() => {
        let current: Promise<void>;
        try {
          current = Promise.resolve(run());
        } catch (error) {
          reportScheduledFailure(id, error);
          current = Promise.resolve();
        }
        const settled = current.then(
          () => undefined,
          (error: unknown) => {
            reportScheduledFailure(id, error);
          },
        );
        inflight.add(settled);
        void settled.finally(() => {
          inflight.delete(settled);
        });
      }, intervalMs);
      timers.set(id, timer);
    },
    stop(id) {
      const timer = timers.get(id);
      if (timer) {
        clearInterval(timer);
        timers.delete(id);
      }
    },
    stopAll() {
      for (const id of [...timers.keys()]) {
        this.stop(id);
      }
      return Promise.all([...inflight]).then(() => undefined);
    },
  };
}
