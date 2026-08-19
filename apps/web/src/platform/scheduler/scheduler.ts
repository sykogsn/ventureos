export type ScheduledTask = {
  id: string;
  intervalMs: number;
  run: () => void | Promise<void>;
};

export type Scheduler = {
  every(id: string, intervalMs: number, run: ScheduledTask["run"]): void;
  stop(id: string): void;
  stopAll(): void;
};

export function createScheduler(): Scheduler {
  const timers = new Map<string, ReturnType<typeof setInterval>>();

  return {
    every(id, intervalMs, run) {
      this.stop(id);
      const timer = setInterval(() => {
        void run();
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
      for (const id of timers.keys()) {
        this.stop(id);
      }
    },
  };
}
