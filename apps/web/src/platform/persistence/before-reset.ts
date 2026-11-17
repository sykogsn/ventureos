type BeforePersistenceReset = () => void | Promise<void>;

const hooks: BeforePersistenceReset[] = [];

/** Registers work that must finish before a persistence reset closes the client. */
export function onBeforePersistenceReset(hook: BeforePersistenceReset): void {
  hooks.push(hook);
}

export async function runBeforePersistenceReset(): Promise<void> {
  for (const hook of hooks) {
    await hook();
  }
}
