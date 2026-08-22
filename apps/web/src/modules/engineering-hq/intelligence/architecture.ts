import type { EngineeringCatalogue, HealthTone } from "../types";
import type { ArchitectureHealthReport, ProjectSignals } from "./types";

export function analyseArchitectureHealth(
  catalogue: EngineeringCatalogue,
  project: ProjectSignals,
): ArchitectureHealthReport {
  const evidence: string[] = [];
  const certified = /certified/i.test(catalogue.certification.status);
  const runtime = catalogue.certification.architecture.find((item) =>
    /Runtime/i.test(item.concern),
  );
  const openHigh = catalogue.debt.filter(
    (item) => /open/i.test(item.status) && /high/i.test(item.priority),
  );
  const openMedium = catalogue.debt.filter(
    (item) => /open/i.test(item.status) && /medium/i.test(item.priority),
  );
  const hqDecision = catalogue.decisions.find((item) => item.id === "ERD-005");
  const hqNotOnLedger = /not started/i.test(catalogue.upcomingNote);
  const lessons = catalogue.lessons.length;

  if (catalogue.certification.status === "Unknown") {
    return {
      verdict: "Unknown",
      tone: "unknown",
      evidence: ["Foundation certification status is not in the record."],
    };
  }

  evidence.push(
    `Certification: ${catalogue.certification.status} (${catalogue.certification.date}).`,
  );
  if (runtime) {
    evidence.push(`Runtime: ${runtime.status}`);
  }
  evidence.push(
    `Open debt: ${openHigh.length} high, ${openMedium.length} medium. TECHNICAL_DEBT_REGISTER.md.`,
  );
  evidence.push(`${lessons} lessons in LESSONS_LEARNED.md.`);
  if (hqDecision) {
    evidence.push(`ERD-005 outcome: ${hqDecision.outcome} Status: ${hqDecision.status}.`);
  }
  if (hqNotOnLedger) {
    evidence.push(
      "ENGINEERING_HISTORY.md close-out: Engineering HQ is not started.",
    );
  }
  if (project.engineeringHqModulePresent) {
    evidence.push(
      "apps/web/src/modules/engineering-hq is present on disk. The ledger has not recorded that programme.",
    );
  }

  let verdict: ArchitectureHealthReport["verdict"] = "Healthy";
  let tone: HealthTone = "healthy";

  if (!certified || openHigh.length > 0 || (runtime && /unlocked|broken/i.test(runtime.status))) {
    verdict = "Critical";
    tone = "risk";
  } else if (
    openMedium.length > 0 ||
    (hqNotOnLedger && project.engineeringHqModulePresent)
  ) {
    verdict = "Needs Attention";
    tone = "watch";
  }

  return { verdict, tone, evidence };
}
