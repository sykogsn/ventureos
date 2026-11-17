import { getClient } from "@/platform/persistence/db";
import { assessReadiness } from "@/platform/runtime/production-process-contract";

const ready = assessReadiness();
const count = await getClient().execute("SELECT COUNT(*) AS n FROM users");
process.stdout.write(`${ready.httpStatus} ${JSON.stringify(ready.body)} ${JSON.stringify(count.rows[0])}`);
