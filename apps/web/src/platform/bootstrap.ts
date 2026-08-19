import { ensureSchema } from "@/platform/persistence/db";
import { getPlatform } from "@/platform/kernel";

export async function bootstrapPlatform() {
  await ensureSchema();
  getPlatform();
}
