import { ensureSchema, getClient, resetDatabaseLifecycle } from "../src/platform/persistence/db";
import { initialisePersistentDevelopmentDatabase, recordDatabaseInstance } from "../src/platform/persistence/persistent-dev-database";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("Persistent development database check failed: persistent_database_url_missing");
  process.exit(1);
}

try {
  await resetDatabaseLifecycle(databaseUrl);
  await initialisePersistentDevelopmentDatabase(
    () => ensureSchema(),
    async (applicationId, userVersion) => {
      await getClient().execute(`PRAGMA application_id = ${applicationId}`);
      await getClient().execute(`PRAGMA user_version = ${userVersion}`);
    },
    (instanceId) => recordDatabaseInstance((statement) => getClient().execute(statement), instanceId),
    () => resetDatabaseLifecycle(databaseUrl),
  );
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
}

console.log("Persistent development database initialised. Schema generation 40. Identity check passed.");
