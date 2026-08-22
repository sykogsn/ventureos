import type { EngineeringCatalogue, HealthTone } from "../types";
import type { ProjectSignals, QualityIntelligence, QualitySignal } from "./types";

function recordedGate(
  catalogue: EngineeringCatalogue,
  pattern: RegExp,
): { tone: HealthTone; detail: string } {
  const gate = catalogue.certification.gates.find((item) => pattern.test(item.gate));
  if (!gate) {
    return {
      tone: "unknown",
      detail: "Unknown. This gate is not in FOUNDATION_CERTIFICATION_v1.1.md.",
    };
  }
  return {
    tone: gate.tone,
    detail: `${gate.result} Recorded ${catalogue.certification.date}.`,
  };
}

export function analyseQuality(
  catalogue: EngineeringCatalogue,
  project: ProjectSignals,
): QualityIntelligence {
  const liveUnknown = {
    tone: "unknown" as const,
    detail:
      "Unknown. Live CI/CD is not connected. Intelligence will not paint this green without a live result.",
  };

  const signals: QualitySignal[] = [
    {
      id: "build",
      label: "Build",
      live: liveUnknown,
      recorded: recordedGate(catalogue, /pnpm build/),
    },
    {
      id: "typescript",
      label: "TypeScript",
      live: liveUnknown,
      recorded: recordedGate(catalogue, /pnpm check-types/),
    },
    {
      id: "lint",
      label: "Lint",
      live: liveUnknown,
      recorded: recordedGate(catalogue, /pnpm lint/),
    },
    {
      id: "tests",
      label: "Tests",
      live: project.rootTestScript
        ? {
            tone: "unknown",
            detail: `Root test script exists (${project.rootTestScript}). Live run is Unknown until CI is connected.`,
          }
        : {
            tone: "watch",
            detail:
              "Repository package.json has no test script. That is measurable now (ERT-001). It is not a live test pass.",
          },
      recorded: recordedGate(catalogue, /pnpm test/),
    },
    {
      id: "runtime",
      label: "Runtime",
      live: liveUnknown,
      recorded: (() => {
        const runtime = catalogue.certification.architecture.find((item) =>
          /Runtime/i.test(item.concern),
        );
        if (!runtime) {
          return {
            tone: "unknown" as const,
            detail: "Unknown. Runtime is not in the certification architecture table.",
          };
        }
        return {
          tone: /locked/i.test(runtime.status) ? ("healthy" as const) : ("watch" as const),
          detail: `${runtime.status} Recorded ${catalogue.certification.date}.`,
        };
      })(),
    },
  ];

  const recordedTones = signals.map((item) => item.recorded.tone);
  let overallTone: HealthTone = "unknown";
  let overallLabel = "Unknown";
  if (recordedTones.includes("risk")) {
    overallTone = "risk";
    overallLabel = "Recorded snapshot: attention";
  } else if (recordedTones.includes("watch") || recordedTones.includes("unknown")) {
    overallTone = "watch";
    overallLabel = "Recorded snapshot: watch";
  } else if (recordedTones.length > 0 && recordedTones.every((tone) => tone === "healthy")) {
    overallTone = "healthy";
    overallLabel = "Recorded snapshot: healthy";
  }

  return {
    overall: {
      tone: overallTone,
      label: overallLabel,
      evidence:
        "Overall quality uses the certification snapshot plus measurable package.json. Live build, lint, TypeScript, and Runtime are Unknown. Green is never shown for a live signal without a live result.",
    },
    signals,
  };
}
