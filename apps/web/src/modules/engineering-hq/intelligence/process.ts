import type { CycleEvidenceRecord } from "../types";
import type {
  EngineeringRecommendation,
  ProcessCount,
  ProcessIntelligence,
  ProcessRatio,
  ProcessTrend,
} from "./types";

const RATE_FLOOR = 5;

function ratioLabel(held: number, known: number, sampleSize: number): string {
  if (known === 0) {
    return `Unknown (n=${sampleSize})`;
  }
  if (sampleSize < RATE_FLOOR) {
    return `${held}/${known} (n=${sampleSize}; rate withheld)`;
  }
  return `${held}/${known} (n=${sampleSize})`;
}

function countLabel(total: number | null, knownCycles: number, sampleSize: number): string {
  if (total === null || knownCycles === 0) {
    return `Unknown (n=${sampleSize})`;
  }
  return `${total} (from ${knownCycles} of n=${sampleSize})`;
}

function sumKnown(
  cycles: CycleEvidenceRecord[],
  read: (cycle: CycleEvidenceRecord) => number | null,
): ProcessCount {
  const known = cycles.filter((cycle) => read(cycle) !== null);
  const total =
    known.length === 0
      ? null
      : known.reduce((sum, cycle) => sum + (read(cycle) ?? 0), 0);
  return {
    total,
    knownCycles: known.length,
    label: countLabel(total, known.length, cycles.length),
  };
}

function ratioOf(
  cycles: CycleEvidenceRecord[],
  read: (cycle: CycleEvidenceRecord) => boolean | null,
): ProcessRatio {
  const known = cycles
    .map((cycle) => read(cycle))
    .filter((value): value is boolean => value !== null);
  const held = known.filter(Boolean).length;
  return {
    held,
    known: known.length,
    sampleSize: cycles.length,
    label: ratioLabel(held, known.length, cycles.length),
  };
}

function firstPass(cycle: CycleEvidenceRecord): boolean | null {
  if (
    cycle.closedAs === null ||
    cycle.certificationFailures === null ||
    cycle.cleanProcessExit === "UNKNOWN"
  ) {
    return null;
  }
  return (
    cycle.closedAs === "certified" &&
    cycle.certificationFailures === 0 &&
    cycle.cleanProcessExit === "YES"
  );
}

function cleanExit(cycle: CycleEvidenceRecord): boolean | null {
  if (cycle.cleanProcessExit === "UNKNOWN") {
    return null;
  }
  return cycle.cleanProcessExit === "YES";
}

function firstCorrection(cycle: CycleEvidenceRecord): boolean | null {
  if (cycle.firstCorrectionHeld === "UNKNOWN") {
    return null;
  }
  return cycle.firstCorrectionHeld === "YES";
}

function leadTimeDays(cycle: CycleEvidenceRecord): number | null {
  if (!cycle.openedAt || !cycle.closedAt) {
    return null;
  }
  const opened = Date.parse(cycle.openedAt);
  const closed = Date.parse(cycle.closedAt);
  if (Number.isNaN(opened) || Number.isNaN(closed) || closed < opened) {
    return null;
  }
  return Math.round((closed - opened) / 86_400_000);
}

function median(values: number[]): number | null {
  if (values.length === 0) {
    return null;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const even = sorted.length % 2 === 0;
  const left = sorted[mid - 1];
  const right = sorted[mid];
  if (even && left !== undefined && right !== undefined) {
    return (left + right) / 2;
  }
  return right ?? left ?? null;
}

function monthKey(isoDate: string): string | null {
  const match = /^(\d{4})-(\d{2})/.exec(isoDate);
  if (!match?.[1] || !match[2]) {
    return null;
  }
  return `${match[1]}-${match[2]}`;
}

function previousMonthKey(key: string): string {
  const [yearText, monthText] = key.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  if (month === 1) {
    return `${year - 1}-12`;
  }
  return `${year}-${String(month - 1).padStart(2, "0")}`;
}

export function cyclesClosedInMonth(
  cycles: CycleEvidenceRecord[],
  yearMonth: string,
): CycleEvidenceRecord[] {
  return cycles.filter((cycle) => cycle.closedAt && monthKey(cycle.closedAt) === yearMonth);
}

export function monthlyComparisonKeys(now = new Date()): {
  current: string;
  previous: string;
} {
  const current = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  return { current, previous: previousMonthKey(current) };
}

function leadTimeSummary(cycles: CycleEvidenceRecord[]): {
  label: string;
  trend: ProcessTrend;
} {
  const days = cycles
    .map(leadTimeDays)
    .filter((value): value is number => value !== null);
  if (days.length === 0) {
    return {
      label: `Unknown (n=${cycles.length})`,
      trend: "unknown",
    };
  }
  const value = median(days);
  return {
    label: `${value} day median from ${days.length} of n=${cycles.length}`,
    trend: "unknown",
  };
}

function linkedImprovements(cycles: CycleEvidenceRecord[]) {
  const items: { id: string; kind: "ERD" | "LL"; source: string }[] = [];
  for (const cycle of cycles) {
    if (cycle.erdRef) {
      items.push({
        id: cycle.erdRef,
        kind: "ERD",
        source: `CYCLE_EVIDENCE.md · ${cycle.id}`,
      });
    }
    if (cycle.llRef) {
      items.push({
        id: cycle.llRef,
        kind: "LL",
        source: `CYCLE_EVIDENCE.md · ${cycle.id}`,
      });
    }
  }
  return items;
}

function failureClasses(cycles: CycleEvidenceRecord[]): string[] {
  const seen = new Set<string>();
  for (const cycle of cycles) {
    if (cycle.failureClass) {
      seen.add(cycle.failureClass);
    }
  }
  return [...seen];
}

export function analyseProcess(
  cycles: CycleEvidenceRecord[],
  options: { nextRecommendation: EngineeringRecommendation | null; windowLabel?: string } = {
    nextRecommendation: null,
  },
): ProcessIntelligence {
  const sampleSize = cycles.length;
  const posture = sampleSize === 0 ? "unknown" : sampleSize < RATE_FLOOR ? "baseline" : "review";
  const leadTime = leadTimeSummary(cycles);

  return {
    sampleSize,
    posture,
    windowLabel: options.windowLabel ?? "recorded cycles",
    leadTime: {
      ...leadTime,
      trend: sampleSize < 2 ? "unknown" : leadTime.trend,
    },
    firstCorrectionHeld: ratioOf(cycles, firstCorrection),
    certificationFirstPass: ratioOf(cycles, firstPass),
    cleanExit: ratioOf(cycles, cleanExit),
    founderInterventions: sumKnown(cycles, (cycle) => cycle.manualFounderInterventions),
    terminalInterventions: sumKnown(cycles, (cycle) => cycle.manualTerminalInterventions),
    correctionAttempts: sumKnown(cycles, (cycle) => cycle.correctionAttempts),
    failedCorrections: sumKnown(cycles, (cycle) => cycle.failedCorrections),
    failureClasses: failureClasses(cycles),
    linkedImprovements: linkedImprovements(cycles),
    nextRecommendation: options.nextRecommendation,
    evidence:
      sampleSize < RATE_FLOOR
        ? [
            `n=${sampleSize}. Rates and trends are withheld until at least ${RATE_FLOOR} cycles are recorded.`,
            sampleSize === 1
              ? "ECE-001 is a baseline, not proof that engineering process has improved."
              : "Insufficient sample for month-to-month comparison.",
          ]
        : [`n=${sampleSize}.`],
  };
}

export function analyseMonthlyProcess(
  cycles: CycleEvidenceRecord[],
  now = new Date(),
): { current: ProcessIntelligence; previous: ProcessIntelligence } {
  const keys = monthlyComparisonKeys(now);
  const currentCycles = cyclesClosedInMonth(cycles, keys.current);
  const previousCycles = cyclesClosedInMonth(cycles, keys.previous);
  return {
    current: analyseProcess(currentCycles, { nextRecommendation: null, windowLabel: keys.current }),
    previous: analyseProcess(previousCycles, {
      nextRecommendation: null,
      windowLabel: keys.previous,
    }),
  };
}
