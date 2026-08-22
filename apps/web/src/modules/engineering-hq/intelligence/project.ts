import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { ProjectSignals, SignalSource } from "./types";

function readRootPackage(): { name?: string; scripts?: Record<string, string> } {
  const fromWeb = join(process.cwd(), "../../package.json");
  const fromRepo = join(process.cwd(), "package.json");
  const candidates = [fromWeb, fromRepo];

  for (const path of candidates) {
    if (!existsSync(/* turbopackIgnore: true */ path)) {
      continue;
    }
    const pkg = JSON.parse(readFileSync(/* turbopackIgnore: true */ path, "utf8")) as {
      name?: string;
      scripts?: Record<string, string>;
    };
    if (pkg.name === "ventureos") {
      return pkg;
    }
  }
  return {};
}

export function loadProjectSignals(): ProjectSignals {
  const pkg = readRootPackage();
  const hqFromWeb = join(process.cwd(), "src/modules/engineering-hq/index.ts");
  const hqFromRepo = join(
    process.cwd(),
    "apps/web/src/modules/engineering-hq/index.ts",
  );

  return {
    rootTestScript: pkg.scripts?.test ?? null,
    engineeringHqModulePresent:
      existsSync(/* turbopackIgnore: true */ hqFromWeb) ||
      existsSync(/* turbopackIgnore: true */ hqFromRepo),
  };
}

export function intelligenceSources(project: ProjectSignals): SignalSource[] {
  return [
    {
      id: "records",
      kind: "records",
      available: true,
      note: "docs/engineering/ is the only engineering ledger.",
    },
    {
      id: "git",
      kind: "git",
      available: false,
      note: "Git overlay is not connected. Status is Unknown.",
    },
    {
      id: "github",
      kind: "github",
      available: false,
      note: "GitHub overlay is not connected. Status is Unknown.",
    },
    {
      id: "ci",
      kind: "ci",
      available: false,
      note: project.rootTestScript
        ? `CI/CD overlay is not connected. Root test script exists (${project.rootTestScript}); live results are Unknown.`
        : "CI/CD overlay is not connected. Root package.json has no test script (measurable project data).",
    },
    {
      id: "coverage",
      kind: "coverage",
      available: false,
      note: "Coverage overlay is not connected. Status is Unknown.",
    },
    {
      id: "performance",
      kind: "performance",
      available: false,
      note: "Performance overlay is not connected. Status is Unknown.",
    },
    {
      id: "security",
      kind: "security",
      available: false,
      note: "Security overlay is not connected. Status is Unknown.",
    },
    {
      id: "agent",
      kind: "agent",
      available: false,
      note: "AI Engineering Agents are not connected. Status is Unknown.",
    },
  ];
}
