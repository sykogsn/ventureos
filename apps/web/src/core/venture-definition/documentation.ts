import { RUNTIME_REQUIRED_CAPABILITIES } from "../capability/types";
import { VENTURE_FEATURES } from "./features";
import { VENTURE_LIFECYCLE } from "./lifecycle";
import type { VentureDefinitionRegistry } from "./registry";
import { platformVentureRegistry } from "./catalog";
import { VENTURE_RUNTIME_ORCHESTRATOR } from "./types";

export function ventureCatalogue(
  registry: VentureDefinitionRegistry = platformVentureRegistry,
): string {
  const lines = ["# Venture Catalogue", ""];
  for (const item of registry.list()) {
    lines.push(
      `## ${item.name} (\`${item.id}\`)`,
      "",
      item.purpose,
      "",
      item.description,
      "",
      `- Owner: ${item.owner}`,
      `- Lifecycle: ${item.lifecycle}`,
      `- Maturity: ${item.maturity}`,
      `- Version: ${item.version}`,
      `- Orchestrator: ${item.runtimeProfile.orchestrator}`,
      `- Capabilities: ${item.capabilityProfile.uses.join(", ")}`,
      `- Excludes: ${item.capabilityProfile.excludes.join(", ") || "none"}`,
      `- Dependencies: ${item.dependencies.join(", ") || "none"}`,
      `- Supported features: ${item.supportedFeatures.join(", ") || "none"}`,
      `- Excluded features: ${item.excludedFeatures.join(", ") || "none"}`,
      "",
    );
  }
  return lines.join("\n");
}

export const VENTURE_DEFINITION_STANDARD = [
  "# Venture Definition Standard",
  "",
  "A Venture Definition is the authoritative metadata for a product running on VentureOS (Qualora, Calviora, Farmora, or a generic VentureOS company).",
  "",
  "It is not a company record in the Venture Intelligence Core. It is not a Runtime. It does not execute.",
  "A founded company is a Venture Instance: VIC plus `definition: { id, version }`.",
  "The founder selects a Product. Products resolve to definitions through the Definition Registry.",
  "",
  "## Rules",
  "",
  "1. One id, one owner, one lifecycle, one maturity.",
  "2. The orchestrator is always the Executive Intelligence Runtime (`intelligence.runtime`).",
  "3. Capability ids resolve through the Shared Capability Registry. Missing or unusable capabilities fail fast.",
  "4. Runtime-required capabilities cannot be excluded.",
  "5. Governance names policy, decision and office capabilities; all three must be Governance-classified and listed in `uses`.",
  "6. Supported and excluded features are disjoint and drawn from the feature taxonomy.",
  "7. Venture dependencies are other venture definition ids. Cycles fail fast.",
  `8. Lifecycle is one of: ${VENTURE_LIFECYCLE.join(", ")}. Forward adjacent, or any live stage to sunset.`,
  `9. Features are one of: ${VENTURE_FEATURES.join(", ")}.`,
  "",
].join("\n");

export const VENTURE_MANIFEST_SPECIFICATION = [
  "# Venture Manifest Specification",
  "",
  "Required fields: id, name, purpose, description, owner, version, lifecycle, maturity,",
  "runtimeProfile, capabilityProfile, governanceProfile, dependencies,",
  "supportedFeatures, excludedFeatures.",
  "",
  "## runtimeProfile",
  "",
  `- orchestrator: \`${VENTURE_RUNTIME_ORCHESTRATOR}\``,
  `- requiredCapabilities: must include ${RUNTIME_REQUIRED_CAPABILITIES.join(", ")}`,
  "",
  "## capabilityProfile",
  "",
  "- uses: capability ids this venture may consume",
  "- excludes: capability ids this venture must not consume",
  "- uses must include every runtime required capability",
  "",
  "## governanceProfile",
  "",
  "- owner",
  "- policyCapabilityId",
  "- decisionCapabilityId",
  "- officeCapabilityId",
  "",
].join("\n");

export const VENTURE_DEPENDENCY_GUIDE = [
  "# Venture Dependency Guide",
  "",
  "Two dependency kinds exist:",
  "",
  "1. Capability dependencies — declared on the capability graph. A venture does not restate the engine graph; it lists which capabilities it uses.",
  "2. Venture dependencies — `dependencies[]` on the venture definition. Use these when one product cannot exist without another product definition.",
  "",
  "Qualora, Calviora and Farmora are independent products on the same platform. They share capabilities; they do not depend on each other.",
  "",
  "Never point a venture definition at a Runtime import. Resolve capabilities through the Capability Registry.",
  "",
  "See `renderFeatureMatrix()` for which features each definition enables.",
  "",
  "The founder selects a Product at founding. Products resolve to these definitions. They are not a second registry.",
  "",
].join("\n");
