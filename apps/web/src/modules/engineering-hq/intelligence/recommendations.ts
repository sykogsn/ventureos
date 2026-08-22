import type { EngineeringCatalogue } from "../types";
import type { EngineeringRecommendation, ProjectSignals } from "./types";

export function analyseRecommendations(
  catalogue: EngineeringCatalogue,
  project: ProjectSignals,
): EngineeringRecommendation[] {
  const items: EngineeringRecommendation[] = [];
  const hqNotOnLedger = /not started/i.test(catalogue.upcomingNote);
  const medium = catalogue.debt.filter(
    (item) => /open/i.test(item.status) && /medium/i.test(item.priority),
  );
  const low = catalogue.debt.filter(
    (item) => /open/i.test(item.status) && /low/i.test(item.priority),
  );
  const nextVisual = /RM-002/i.test(catalogue.upcomingNote);

  if (hqNotOnLedger && project.engineeringHqModulePresent) {
    items.push({
      id: "record-hq",
      title: "Record Engineering HQ on the sprint ledger",
      why: "ENGINEERING_HISTORY.md still says Engineering HQ is not started, while apps/web/src/modules/engineering-hq exists. ERD-003 forbids a second unmarked truth. The ledger must catch up before the next programme is named.",
      source: "ENGINEERING_HISTORY.md · project tree",
    });
  } else if (hqNotOnLedger) {
    items.push({
      id: "begin-hq",
      title: "Begin Engineering HQ when the founder opens it",
      why: "The history close-out names Engineering HQ as the next workspace and records that it is not started. No in-progress VS id is on the ledger.",
      source: "ENGINEERING_HISTORY.md",
    });
  }

  if (medium.length > 0) {
    items.push({
      id: "resolve-medium-debt",
      title: `Resolve medium technical debt (${medium.map((item) => item.id).join(", ")})`,
      why: `${medium
        .map((item) => `${item.id}: ${item.impact}`)
        .join(" ")} Open medium items keep architecture health on watch even though Foundation is certified.`,
      source: "TECHNICAL_DEBT_REGISTER.md",
    });
  }

  if (low.some((item) => item.id === "ERT-001") && !project.rootTestScript) {
    items.push({
      id: "root-test-script",
      title: "Add a root test script or keep using turbo run test",
      why: "ERT-001 and the certification test gate record that `pnpm test` has no root script. Checklists that call `pnpm test` look like a failed gate. Do not treat turbo results as a root script.",
      source: "TECHNICAL_DEBT_REGISTER.md · package.json",
    });
  }

  if (nextVisual) {
    items.push({
      id: "hold-visual-programmes",
      title: "Do not open Qualora, Calviora, or Farmora visual programmes yet",
      why: "ENGINEERING_HISTORY.md says those programmes remain on RM-002–RM-004 and were not opened by this history. ERD-007 binds Qualora to founder-opened work after certification.",
      source: "ENGINEERING_HISTORY.md · DECISION_REGISTER.md ERD-007",
    });
  }

  if (catalogue.certification.recommendation !== "Unknown") {
    items.push({
      id: "honor-certification-recommendation",
      title: "Keep the certification recommendation",
      why: catalogue.certification.recommendation,
      source: "FOUNDATION_CERTIFICATION_v1.1.md",
    });
  }

  return items;
}
