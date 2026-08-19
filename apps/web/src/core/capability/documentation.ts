import type { CapabilityRegistry } from "./registry";
import { platformCapabilityRegistry } from "./catalog";
import { CAPABILITY_CLASSIFICATIONS } from "./taxonomy";
import { CAPABILITY_LIFECYCLE } from "./lifecycle";

export function capabilityCatalogue(
  registry: CapabilityRegistry = platformCapabilityRegistry,
): string {
  const lines = ["# Capability Catalogue", ""];
  for (const classification of CAPABILITY_CLASSIFICATIONS) {
    const items = registry.byClassification(classification);
    if (items.length === 0) {
      continue;
    }
    lines.push(`## ${classification}`, "");
    for (const item of items) {
      lines.push(
        `### ${item.name} (\`${item.id}\`)`,
        "",
        item.purpose,
        "",
        `- Owner: ${item.owner}`,
        `- Version: ${item.version}`,
        `- Maturity: ${item.maturity}`,
        `- Lifecycle: ${item.lifecycle}`,
        `- Dependencies: ${item.dependencies.join(", ") || "none"}`,
        `- Provides: ${item.provides.join(", ") || "none"}`,
        `- Requires: ${item.requires.join(", ") || "none"}`,
        "",
      );
    }
  }
  return lines.join("\n");
}

export function capabilityDependencyMap(
  registry: CapabilityRegistry = platformCapabilityRegistry,
): string {
  const graph = registry.graph();
  const lines = [
    "# Capability Dependency Map",
    "",
    "Edges point from a capability to a capability it depends on.",
    "",
    "Load order (dependencies first):",
    "",
    ...graph.order.map((id, index) => `${index + 1}. \`${id}\``),
    "",
    "Graph:",
    "",
    ...graph.edges.map((edge) => `- \`${edge.from}\` → \`${edge.to}\``),
    "",
  ];
  return lines.join("\n");
}

export const CAPABILITY_DESIGN_STANDARD = [
  "# Capability Design Standard",
  "",
  "A capability is a reusable organisational building block. It is not a route, a page, a plugin, or a second runtime.",
  "",
  "## Rules",
  "",
  "1. Single responsibility. One purpose, one owner, one version.",
  "2. No venture-specific logic (Qualora, Calviora, Farmora consume; they do not live inside the capability).",
  "3. Independently testable. Registry tests must not require UI.",
  "4. Documented in the catalogue with purpose, guarantees and limitations.",
  "5. Versioned with major.minor.patch.",
  "6. Resolved only through the Capability Registry. Ventures never import a shared implementation as a private shortcut when a capability id exists.",
  "7. The Executive Intelligence Runtime remains the only orchestrator. Capabilities do not call each other as a pipeline.",
  "8. Lifecycle moves Experimental → Internal → Shared → Stable, or any non-deprecated stage → Deprecated. No other transitions.",
  `9. Classification must be one of: ${CAPABILITY_CLASSIFICATIONS.join(", ")}.`,
  `10. Lifecycle must be one of: ${CAPABILITY_LIFECYCLE.join(", ")}.`,
  "",
  "## Adding a capability",
  "",
  "Declare a manifest in the platform catalogue. Provide contracts from `CAPABILITY_CONTRACTS`. Declare dependencies by capability id. Registry creation fails fast on duplicates, missing dependencies, unknown contracts, or cycles.",
  "",
].join("\n");
