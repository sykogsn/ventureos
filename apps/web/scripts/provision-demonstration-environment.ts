import { provisionDemonstrationEnvironment } from "../src/platform/runtime/demonstration-provision";

try {
  const result = await provisionDemonstrationEnvironment();
  console.log(`demonstration_database_provisioned ${result.objectAccess} ${result.accounts}`);
} catch (error) {
  const code = error instanceof Error && "code" in error && typeof error.code === "string"
    ? error.code
    : "demonstration_provision_failed";
  console.error(code);
  process.exit(1);
}
