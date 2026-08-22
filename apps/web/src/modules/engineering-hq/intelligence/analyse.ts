import type { EngineeringCatalogue } from "../types";
import { analyseArchitectureHealth } from "./architecture";
import { analyseDebt } from "./debt";
import { analyseFoundation } from "./foundation";
import { analyseEngineeringHealth } from "./health";
import { intelligenceSources, loadProjectSignals } from "./project";
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
  return {
    health: analyseEngineeringHealth(catalogue, project),
    architecture: analyseArchitectureHealth(catalogue, project),
    recommendations: analyseRecommendations(catalogue, project),
    sprints: analyseSprints(catalogue),
    foundation: analyseFoundation(catalogue),
    timeline: analyseTimeline(catalogue),
    debt: analyseDebt(catalogue),
    quality: analyseQuality(catalogue, project),
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
