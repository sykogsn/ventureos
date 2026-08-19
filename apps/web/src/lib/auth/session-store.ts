import { ensureSchema, getPersistence } from "@/platform";

export async function lookupPersistedSession(sessionId: string) {
  await ensureSchema();
  return getPersistence().sessions.findById(sessionId);
}
