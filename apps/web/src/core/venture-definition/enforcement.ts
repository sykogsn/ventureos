import { platformVentureRegistry } from "./catalog";
import type { VentureDefinitionRegistry } from "./registry";
import { VENTURE_FEATURES, type VentureFeature } from "./features";
import type { VentureDefinition, VentureDefinitionRef } from "./types";
import { DEFAULT_VENTURE_DEFINITION_REF } from "./types";
import { VENTURE_RUNTIME_ORCHESTRATOR } from "./types";
import type { RuntimeEvent } from "../runtime/types";
import type { Venture, VentureIntelligenceCore } from "../venture/types";

export const FEATURE_CAPABILITY_SOURCE: Record<VentureFeature, string> = {
  "situation-room": "intelligence.mission",
  "company-hq": "intelligence.venture-core",
  "executive-office": "governance.executive-office",
  "founder-decisions": "governance.founder-decision",
  "morning-briefing": "intelligence.briefing",
  portfolio: "intelligence.operating-health",
};

export const BRIEFING_CAPABILITY = "intelligence.briefing";
export const FOUNDER_DECISION_CAPABILITY = "governance.founder-decision";

export function resolveVentureDefinition(
  ref: VentureDefinitionRef | undefined,
  registry: VentureDefinitionRegistry = platformVentureRegistry,
): VentureDefinition | undefined {
  if (!ref) {
    return registry.get(DEFAULT_VENTURE_DEFINITION_REF.id);
  }
  return registry.get(ref.id);
}

export function definitionAllowsCapability(
  definition: VentureDefinition,
  capabilityId: string,
): boolean {
  if (definition.capabilityProfile.excludes.includes(capabilityId)) {
    return false;
  }
  return definition.capabilityProfile.uses.includes(capabilityId);
}

export function definitionHasFeature(
  definition: VentureDefinition,
  feature: VentureFeature,
): boolean {
  if (definition.excludedFeatures.includes(feature)) {
    return false;
  }
  return definition.supportedFeatures.includes(feature);
}

export function ventureDefinition(
  venture: Venture,
  registry: VentureDefinitionRegistry = platformVentureRegistry,
): VentureDefinition | undefined {
  return resolveVentureDefinition(venture.definition, registry);
}

export function ventureAllowsCapability(
  venture: Venture,
  capabilityId: string,
  registry: VentureDefinitionRegistry = platformVentureRegistry,
): boolean {
  const definition = ventureDefinition(venture, registry);
  if (!definition) {
    return !venture.definition;
  }
  return definitionAllowsCapability(definition, capabilityId);
}

export function ventureHasFeature(
  venture: Venture,
  feature: VentureFeature,
  registry: VentureDefinitionRegistry = platformVentureRegistry,
): boolean {
  const definition = ventureDefinition(venture, registry);
  if (!definition) {
    return !venture.definition;
  }
  return definitionHasFeature(definition, feature);
}

export function assertCapabilityAllowed(
  venture: Venture,
  capabilityId: string,
  registry: VentureDefinitionRegistry = platformVentureRegistry,
): void {
  if (!ventureAllowsCapability(venture, capabilityId, registry)) {
    throw new Error(
      `Venture ${venture.identity.id} is not allowed to consume capability ${capabilityId}.`,
    );
  }
}

export function mayConsumeBriefing(venture: Venture): boolean {
  return (
    ventureAllowsCapability(venture, BRIEFING_CAPABILITY) &&
    ventureHasFeature(venture, "morning-briefing")
  );
}

export function assertRuntimeInstanceUsage(
  core: VentureIntelligenceCore,
  event: RuntimeEvent,
  registry: VentureDefinitionRegistry = platformVentureRegistry,
): void {
  const subjects: Venture[] =
    event.type === "CompanyFounded"
      ? [event.venture]
      : event.type === "FounderDecisionRecorded"
        ? core.ventures.filter(
            (venture) =>
              venture.identity.id === event.ventureId ||
              venture.identity.slug === event.ventureId,
          )
        : core.ventures;

  for (const venture of subjects) {
    const definition = ventureDefinition(venture, registry);
    if (!definition) {
      if (venture.definition) {
        throw new Error(
          `Venture ${venture.identity.id} references unknown definition ${venture.definition.id}.`,
        );
      }
      continue;
    }

    if (definition.runtimeProfile.orchestrator !== VENTURE_RUNTIME_ORCHESTRATOR) {
      throw new Error(
        `Venture ${venture.identity.id} has an invalid runtime profile.`,
      );
    }

    for (const capabilityId of definition.runtimeProfile.requiredCapabilities) {
      assertCapabilityAllowed(venture, capabilityId, registry);
    }

    if (event.type === "FounderDecisionRecorded") {
      if (!definitionHasFeature(definition, "founder-decisions")) {
        throw new Error(
          `Venture ${venture.identity.id} cannot record a founder decision.`,
        );
      }
      assertCapabilityAllowed(venture, FOUNDER_DECISION_CAPABILITY, registry);
      assertCapabilityAllowed(
        venture,
        definition.governanceProfile.decisionCapabilityId,
        registry,
      );
    }
  }
}

export type FeatureMatrixRow = {
  venture: string;
  feature: VentureFeature;
  enabled: boolean;
  source: string;
};

export function featureMatrix(
  registry: VentureDefinitionRegistry = platformVentureRegistry,
): FeatureMatrixRow[] {
  return registry.list().flatMap((definition) =>
    VENTURE_FEATURES.map((feature) => ({
      venture: definition.id,
      feature,
      enabled: definitionHasFeature(definition, feature),
      source: FEATURE_CAPABILITY_SOURCE[feature],
    })),
  );
}

export function renderFeatureMatrix(
  registry: VentureDefinitionRegistry = platformVentureRegistry,
): string {
  const lines = [
    "# Feature Matrix",
    "",
    "| Venture | Feature | Enabled | Source |",
    "|---|---|---|---|",
    ...featureMatrix(registry).map(
      (row) =>
        `| \`${row.venture}\` | ${row.feature} | ${row.enabled ? "yes" : "no"} | \`${row.source}\` |`,
    ),
    "",
  ];
  return lines.join("\n");
}
