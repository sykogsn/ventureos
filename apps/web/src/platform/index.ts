export { getPlatform } from "./kernel";
export type { Platform } from "./kernel";
export { bootstrapPlatform } from "./bootstrap";
export { createEvent } from "./events/create-event";
export { createId, nowIso, slugify } from "./ids";
export { getDb, ensureSchema, resetDatabaseLifecycle } from "./persistence/db";
export { getPersistence, resetPersistenceLifecycle } from "./persistence/repositories";
