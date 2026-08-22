import type { EngineeringCatalogue, HealthTone } from "../types";
import type { EngineeringHealthReport, ProjectSignals, ScoredCriterion } from "./types";

function gate(
  catalogue: EngineeringCatalogue,
  pattern: RegExp,
): { result: string; tone: HealthTone } | null {
  const match = catalogue.certification.gates.find((item) => pattern.test(item.gate));
  return match ? { result: match.result, tone: match.tone } : null;
}

function architecture(
  catalogue: EngineeringCatalogue,
  pattern: RegExp,
): string | null {
  return (
    catalogue.certification.architecture.find((item) => pattern.test(item.concern))
      ?.status ?? null
  );
}

function toneFromScore(score: number | null): HealthTone {
  if (score === null) {
    return "unknown";
  }
  if (score >= 80) {
    return "healthy";
  }
  if (score >= 50) {
    return "watch";
  }
  return "risk";
}

export function analyseEngineeringHealth(
  catalogue: EngineeringCatalogue,
  project: ProjectSignals,
): EngineeringHealthReport {
  const lint = gate(catalogue, /pnpm lint/);
  const types = gate(catalogue, /pnpm check-types/);
  const build = gate(catalogue, /pnpm build/);
  const tests = gate(catalogue, /pnpm test/);
  const runtime = architecture(catalogue, /Runtime/);
  const certified = /certified/i.test(catalogue.certification.status);
  const openDebt = catalogue.debt.filter((item) => /open/i.test(item.status));
  const high = openDebt.filter((item) => /high/i.test(item.priority)).length;
  const medium = openDebt.filter((item) => /medium/i.test(item.priority)).length;
  const outstanding = catalogue.certification.outstanding.length;

  const debtPoints = (): number => {
    if (high > 0) {
      return 0;
    }
    if (medium > 0) {
      return 0.5;
    }
    if (openDebt.length > 0) {
      return 0.75;
    }
    return 1;
  };

  const outstandingPoints = (): number => {
    if (outstanding === 0) {
      return 1;
    }
    if (outstanding <= 2) {
      return 0.75;
    }
    if (outstanding <= 5) {
      return 0.5;
    }
    return 0.25;
  };

  const testPoints = (): number | null => {
    if (!tests) {
      return null;
    }
    if (/no script/i.test(tests.result) && /turbo run test/i.test(tests.result)) {
      return 0.5;
    }
    if (tests.tone === "healthy") {
      return 1;
    }
    if (tests.tone === "watch") {
      return 0.5;
    }
    if (tests.tone === "unknown") {
      return null;
    }
    return 0;
  };

  const criteria: ScoredCriterion[] = [
    {
      id: "certification",
      label: "Foundation Certification",
      points: certified ? 1 : catalogue.certification.status === "Unknown" ? null : 0,
      max: 1,
      evidence: `${catalogue.certification.status}. ${catalogue.certification.date}.`,
    },
    {
      id: "lint",
      label: "Lint",
      points: lint ? (lint.tone === "healthy" ? 1 : lint.tone === "watch" ? 0.5 : lint.tone === "unknown" ? null : 0) : null,
      max: 1,
      evidence: lint
        ? `${lint.result} Recorded in FOUNDATION_CERTIFICATION_v1.1.md. Live lint is Unknown until CI is connected.`
        : "Unknown. No lint gate in the certification record.",
    },
    {
      id: "typescript",
      label: "TypeScript",
      points: types
        ? types.tone === "healthy"
          ? 1
          : types.tone === "watch"
            ? 0.5
            : types.tone === "unknown"
              ? null
              : 0
        : null,
      max: 1,
      evidence: types
        ? `${types.result} Recorded in FOUNDATION_CERTIFICATION_v1.1.md. Live check-types is Unknown until CI is connected.`
        : "Unknown. No TypeScript gate in the certification record.",
    },
    {
      id: "build",
      label: "Build",
      points: build
        ? build.tone === "healthy"
          ? 1
          : build.tone === "watch"
            ? 0.5
            : build.tone === "unknown"
              ? null
              : 0
        : null,
      max: 1,
      evidence: build
        ? `${build.result} Recorded in FOUNDATION_CERTIFICATION_v1.1.md. Live build is Unknown until CI is connected.`
        : "Unknown. No build gate in the certification record.",
    },
    {
      id: "tests",
      label: "Tests",
      points: testPoints(),
      max: 1,
      evidence: tests
        ? `${tests.result} Root package.json test script: ${project.rootTestScript ?? "absent"}.`
        : "Unknown. No test gate in the certification record.",
    },
    {
      id: "runtime",
      label: "Runtime",
      points: runtime ? (/locked/i.test(runtime) ? 1 : 0.5) : null,
      max: 1,
      evidence: runtime
        ? `${runtime} From the certification architecture table.`
        : "Unknown. Runtime is not named in the certification architecture table.",
    },
    {
      id: "debt",
      label: "Open technical debt",
      points: debtPoints(),
      max: 1,
      evidence: `${openDebt.length} open of ${catalogue.debt.length} named items. High ${high}, medium ${medium}. TECHNICAL_DEBT_REGISTER.md.`,
    },
    {
      id: "outstanding",
      label: "Outstanding foundation issues",
      points: outstandingPoints(),
      max: 1,
      evidence:
        outstanding === 0
          ? "No remaining follow-up list in the certification record."
          : `${outstanding} items in Remaining Follow-up Items. Same list as the debt register.`,
    },
  ];

  const counted = criteria.filter((item) => item.points !== null);
  const score =
    counted.length === 0
      ? null
      : Math.round(
          (counted.reduce((sum, item) => sum + (item.points ?? 0), 0) /
            counted.reduce((sum, item) => sum + item.max, 0)) *
            100,
        );

  return {
    score,
    label: score === null ? "Unknown" : String(score),
    tone: toneFromScore(score),
    method:
      "Equal-weight mean of criteria that have evidence. Pass = 1, watch = 0.5, fail = 0. Unknown criteria are excluded, not guessed. Live CI is not connected, so build, lint, and TypeScript use the certification snapshot and are labelled as recorded, not live green.",
    criteria,
  };
}
