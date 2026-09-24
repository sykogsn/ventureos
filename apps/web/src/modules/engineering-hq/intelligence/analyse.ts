import type { EngineeringCatalogue } from "../types";
import { analyseArchitectureHealth } from "./architecture";
import { analyseDebt } from "./debt";
import { analyseFoundation } from "./foundation";
import { analyseEngineeringHealth } from "./health";
import { intelligenceSources, loadProjectSignals } from "./project";
import { analyseProcess } from "./process";
import { analyseQuality } from "./quality";
import { analyseRecommendations } from "./recommendations";
import { analyseSprints } from "./sprints";
import { analyseTimeline } from "./timeline";
import type { EngineeringIntelligence, ProjectSignals } from "./types";
import { loadEngineeringCatalogue } from "../records/catalogue";

export function analyseEngineering(
  catalogue: EngineeringCatalogue,
  project: ProjectSignals,
): EngineeringIntelligence {
  const recommendations = analyseRecommendations(catalogue, project);
  const processRecommendation =
    recommendations.find((item) => item.id === "process-baseline") ?? recommendations[0] ?? null;

  return {
    health: analyseEngineeringHealth(catalogue, project),
    architecture: analyseArchitectureHealth(catalogue, project),
    recommendations,
    sprints: analyseSprints(catalogue),
    foundation: analyseFoundation(catalogue),
    timeline: analyseTimeline(catalogue),
    debt: analyseDebt(catalogue),
    quality: analyseQuality(catalogue, project),
    process: analyseProcess(catalogue.cycles, { nextRecommendation: processRecommendation }),
    sources: intelligenceSources(project),
  };
}

export function loadEngineeringIntelligence() {
  const catalogue = loadEngineeringCatalogue();
  const project = loadProjectSignals();
  return {
    catalogue,
    project,
    intelligence: analyseEngineering(catalogue, project),
  };
}
