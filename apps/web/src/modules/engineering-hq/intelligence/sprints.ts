import type { EngineeringCatalogue } from "../types";
import type { SprintIntelligence } from "./types";

export function analyseSprints(catalogue: EngineeringCatalogue): SprintIntelligence {
  const completed = catalogue.sprints.filter((item) => item.bucket === "completed");
  const current = catalogue.sprints.filter((item) => item.bucket === "current");
  const upcoming = catalogue.sprints.filter((item) => item.bucket === "upcoming");
  const latest = completed.at(-1);
  const next = upcoming[0];
  const evidence: string[] = [];

  if (current.length === 0) {
    evidence.push(
      "ENGINEERING_HISTORY.md has no in-progress VS programme. Intelligence will not invent a current sprint id.",
    );
  } else {
    evidence.push(
      `In-progress on the ledger: ${current.map((item) => item.id).join(", ")}.`,
    );
  }

  evidence.push(`${completed.length} completed programmes parsed from ENGINEERING_HISTORY.md.`);
  if (latest) {
    evidence.push(`Latest completed: ${latest.id} — ${latest.status}.`);
  }
  if (next) {
    evidence.push(`Next named: ${next.title}. ${next.status}.`);
  }
  evidence.push(
    "Current VES phase is Unknown because no in-progress sprint records a mode.",
  );

  return {
    currentId: current[0]?.id ?? "Unknown",
    currentTitle: current[0]?.title ?? "Unknown",
    completedCount: completed.length,
    currentPhase: "Unknown",
    latestMilestone: latest
      ? `${latest.id} — ${latest.title} (${latest.status})`
      : "Unknown",
    nextPlanned: next ? `${next.title} (${next.status})` : "Unknown",
    evidence,
  };
}
