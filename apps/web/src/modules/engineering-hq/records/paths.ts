import { existsSync } from "node:fs";
import { join } from "node:path";

const candidateRoots = [
  join(process.cwd(), "docs"),
  join(process.cwd(), "../../docs"),
];

function resolveDocsRoot() {
  const root = candidateRoots.find((dir) =>
    existsSync(join(dir, "engineering/ENGINEERING_HISTORY.md")),
  );
  if (!root) {
    throw new Error(
      "Engineering Records were not found. Engineering HQ will not invent a second store.",
    );
  }
  return root;
}

const docsRoot = resolveDocsRoot();

export const engineeringRecordsRoot = join(docsRoot, "engineering");

export const recordFiles = {
  history: join(engineeringRecordsRoot, "ENGINEERING_HISTORY.md"),
  decisions: join(engineeringRecordsRoot, "DECISION_REGISTER.md"),
  debt: join(engineeringRecordsRoot, "TECHNICAL_DEBT_REGISTER.md"),
  lessons: join(engineeringRecordsRoot, "LESSONS_LEARNED.md"),
  releases: join(engineeringRecordsRoot, "RELEASE_HISTORY.md"),
  certification: join(engineeringRecordsRoot, "FOUNDATION_CERTIFICATION_v1.1.md"),
  engineeringConstitution: join(
    engineeringRecordsRoot,
    "ENGINEERING_CONSTITUTION.md",
  ),
  engineeringCreed: join(engineeringRecordsRoot, "ENGINEERING_CREED.md"),
  ventureosConstitution: join(
    docsRoot,
    "architecture/VENTUREOS_PLATFORM_CONSTITUTION.md",
  ),
  ventureosCreed: join(
    docsRoot,
    "foundation-library/01-FOUNDATION/VentureOS-Creed.md",
  ),
} as const;
