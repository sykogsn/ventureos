import { after } from "node:test";
import { resetPersistenceLifecycle } from "@/platform/persistence/repositories";

/** Test-only: close the process-scoped libSQL client after the file so FileTest children exit 0. */
export function closeFrigoraPersistenceAfterFile() {
  after(async () => {
    await resetPersistenceLifecycle(":memory:");
  });
}
