import { ensureSchema } from "@/platform/persistence/db";
import { getPlatform } from "@/platform/kernel";
import { assertProductionStartup } from "@/platform/runtime/production-process-contract";

export async function bootstrapPlatform() {
  assertProductionStartup();
  await ensureSchema();
  getPlatform();
}
