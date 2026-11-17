import { ensureSchema, getClient, getDatabaseUrl, resetDatabaseLifecycle } from "./db";
import { initialisePersistentDevelopmentDatabase, recordDatabaseInstance } from "./persistent-dev-database";

const mode = process.argv[2];
const databaseUrl = process.env.DATABASE_URL;

if (mode === "build-default") {
  delete process.env.DATABASE_URL;
  try {
    getDatabaseUrl();
    process.stdout.write("opened");
  } catch (error) {
    const code = error instanceof Error && "code" in error && typeof error.code === "string" ? error.code : "unknown";
    process.stdout.write(code);
  }
} else if (!databaseUrl) {
  throw new Error("DATABASE_URL is required");
} else if (mode === "init") {
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
  process.stdout.write("initialised");
} else if (mode === "read") {
  const email = process.argv[3];
  if (!email) throw new Error("The child process requires the fixture email argument.");
  await ensureSchema();
  const users = await getClient().execute({ sql: "SELECT id FROM users WHERE email = ?", args: [email] });
  const userId = String(users.rows[0]?.id ?? "");
  const members = userId
    ? await getClient().execute({ sql: "SELECT role FROM workspace_members WHERE user_id = ?", args: [userId] })
    : { rows: [] };
  const ventures = userId
    ? await getClient().execute({
        sql: `SELECT ventures.definition_id AS definition_id
              FROM ventures
              JOIN workspace_members ON workspace_members.workspace_id = ventures.workspace_id
              WHERE workspace_members.user_id = ?`,
        args: [userId],
      })
    : { rows: [] };
  process.stdout.write(JSON.stringify({
    users: users.rows.length,
    role: String(members.rows[0]?.role ?? ""),
    definitionId: String(ventures.rows[0]?.definition_id ?? ""),
  }));
} else {
  throw new Error("The child process requires init, read, or build-default.");
}
