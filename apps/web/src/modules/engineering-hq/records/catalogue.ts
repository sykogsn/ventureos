import { readFileSync } from "node:fs";
import type { EngineeringCatalogue } from "../types";
import { parseCertification } from "./parse-certification";
import { parseDecisionRegister } from "./parse-decisions";
import { parseDebtRegister } from "./parse-debt";
import { parseEngineeringHistory } from "./parse-history";
import { parseLessonsLearned } from "./parse-lessons";
import { parseReleaseHistory } from "./parse-releases";
import { recordFiles } from "./paths";

function read(path: string) {
  return readFileSync(path, "utf8");
}

export function loadEngineeringCatalogue(): EngineeringCatalogue {
  const history = parseEngineeringHistory(read(recordFiles.history));

  return {
    sprints: history.sprints,
    upcomingNote: history.upcomingNote,
    decisions: parseDecisionRegister(read(recordFiles.decisions)),
    debt: parseDebtRegister(read(recordFiles.debt)),
    lessons: parseLessonsLearned(read(recordFiles.lessons)),
    releases: parseReleaseHistory(read(recordFiles.releases)),
    certification: parseCertification(read(recordFiles.certification)),
    constitution: [
      {
        id: "engineering-constitution",
        title: "Engineering Constitution",
        source: "docs/engineering/ENGINEERING_CONSTITUTION.md",
        markdown: read(recordFiles.engineeringConstitution),
      },
      {
        id: "engineering-creed",
        title: "Engineering Creed",
        source: "docs/engineering/ENGINEERING_CREED.md",
        markdown: read(recordFiles.engineeringCreed),
      },
      {
        id: "ventureos-constitution",
        title: "VentureOS Constitution",
        source: "docs/architecture/VENTUREOS_PLATFORM_CONSTITUTION.md",
        markdown: read(recordFiles.ventureosConstitution),
      },
      {
        id: "ventureos-creed",
        title: "VentureOS Creed",
        source: "docs/foundation-library/01-FOUNDATION/VentureOS-Creed.md",
        markdown: read(recordFiles.ventureosCreed),
      },
    ],
  };
}
