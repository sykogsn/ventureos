import { spawn } from "node:child_process";
import { join } from "node:path";
import {
  assertPersistentDevelopmentDatabaseReady,
  describePersistentDevelopmentDatabase,
} from "../src/platform/persistence/persistent-dev-database";
import { webRootFrom } from "./ids-dev-guard";

process.env.VENTUREOS_PERSISTENT_DEV = "1";
try {
  assertPersistentDevelopmentDatabaseReady();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
}

const identity = describePersistentDevelopmentDatabase();
console.log(
  `VentureOS development environment: ${identity.environment}, schema generation ${identity.schemaGeneration}, identity check passed.`,
);

const nextBin = join(webRootFrom(), "node_modules/next/dist/bin/next");
const child = spawn(process.execPath, [nextBin, "start"], {
  cwd: webRootFrom(),
  stdio: "inherit",
  env: { ...process.env, VENTUREOS_PERSISTENT_DEV: "1" },
  windowsHide: true,
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});
