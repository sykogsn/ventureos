import type { CapabilityRegistry } from "../capability/registry";
import { RUNTIME_REQUIRED_CAPABILITIES } from "../capability/types";
import { isVentureFeature } from "./features";
import { isVentureLifecycle } from "./lifecycle";
import { createVentureDefinition } from "./model";
import type { VentureDefinition, VentureDefinitionManifest } from "./types";
import { VENTURE_RUNTIME_ORCHESTRATOR } from "./types";

function unique(values: string[], label: string, ventureId: string) {
  const seen = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) {
      throw new Error(`Venture ${ventureId} has a duplicate ${label}: ${value}.`);
    }
    seen.add(value);
  }
}

function requireCapability(
  registry: CapabilityRegistry,
  id: string,
  ventureId: string,
  role: string,
) {
  const capability = registry.get(id);
  if (!capability) {
    throw new Error(
      `Venture ${ventureId} ${role} references missing capability ${id}.`,
    );
  }
  if (capability.lifecycle === "deprecated" || capability.lifecycle === "experimental") {
    throw new Error(
      `Venture ${ventureId} ${role} uses unusable capability ${id} (${capability.lifecycle}).`,
    );
  }
  return capability;
}

export function validateVentureManifest(
  input: VentureDefinitionManifest,
  capabilities: CapabilityRegistry,
): VentureDefinition {
  if (!input.id.trim()) {
    throw new Error("Venture definition id is required.");
  }
  if (!input.name.trim()) {
    throw new Error(`Venture ${input.id} is missing a name.`);
  }
  if (!input.purpose.trim()) {
    throw new Error(`Venture ${input.id} is missing a purpose.`);
  }
  if (!input.description.trim()) {
    throw new Error(`Venture ${input.id} is missing a description.`);
  }
    if (!input.owner.trim()) {
    throw new Error(`Venture ${input.id} is missing an owner.`);
  }
  if (!/^\d+\.\d+\.\d+$/.test(input.version)) {
    throw new Error(`Venture ${input.id} has an invalid version.`);
  }
  if (!isVentureLifecycle(input.lifecycle)) {
    throw new Error(`Venture ${input.id} has an invalid lifecycle.`);
  }

  const runtime = input.runtimeProfile;
  if (runtime.orchestrator !== VENTURE_RUNTIME_ORCHESTRATOR) {
    throw new Error(
      `Venture ${input.id} has an invalid runtime profile. Orchestrator must be ${VENTURE_RUNTIME_ORCHESTRATOR}.`,
    );
  }
  unique(runtime.requiredCapabilities, "runtime capability", input.id);
  for (const id of RUNTIME_REQUIRED_CAPABILITIES) {
    if (!runtime.requiredCapabilities.includes(id)) {
      throw new Error(
        `Venture ${input.id} has an invalid runtime profile. Missing required capability ${id}.`,
      );
    }
  }
  for (const id of runtime.requiredCapabilities) {
    requireCapability(capabilities, id, input.id, "runtime profile");
  }

  unique(input.capabilityProfile.uses, "capability use", input.id);
  unique(input.capabilityProfile.excludes, "capability exclusion", input.id);
  const uses = new Set(input.capabilityProfile.uses);
  for (const id of input.capabilityProfile.uses) {
    requireCapability(capabilities, id, input.id, "capability profile");
  }
  for (const id of input.capabilityProfile.excludes) {
    requireCapability(capabilities, id, input.id, "capability exclusion");
    if (uses.has(id)) {
      throw new Error(
        `Venture ${input.id} both uses and excludes capability ${id}.`,
      );
    }
    if ((RUNTIME_REQUIRED_CAPABILITIES as readonly string[]).includes(id)) {
      throw new Error(
        `Venture ${input.id} cannot exclude Runtime-required capability ${id}.`,
      );
    }
  }
  for (const id of runtime.requiredCapabilities) {
    if (!uses.has(id)) {
      throw new Error(
        `Venture ${input.id} capability profile does not include runtime requirement ${id}.`,
      );
    }
  }

  const governance = input.governanceProfile;
  if (!governance.owner.trim()) {
    throw new Error(`Venture ${input.id} has an invalid governance profile. Owner is required.`);
  }
  const policy = requireCapability(
    capabilities,
    governance.policyCapabilityId,
    input.id,
    "governance profile",
  );
  const decision = requireCapability(
    capabilities,
    governance.decisionCapabilityId,
    input.id,
    "governance profile",
  );
  const office = requireCapability(
    capabilities,
    governance.officeCapabilityId,
    input.id,
    "governance profile",
  );
  if (policy.classification !== "Governance") {
    throw new Error(
      `Venture ${input.id} has an invalid governance profile. ${policy.id} is not governance.`,
    );
  }
  if (decision.classification !== "Governance") {
    throw new Error(
      `Venture ${input.id} has an invalid governance profile. ${decision.id} is not governance.`,
    );
  }
  if (office.classification !== "Governance") {
    throw new Error(
      `Venture ${input.id} has an invalid governance profile. ${office.id} is not governance.`,
    );
  }
  if (!uses.has(policy.id) || !uses.has(decision.id) || !uses.has(office.id)) {
    throw new Error(
      `Venture ${input.id} governance capabilities must appear in the capability profile.`,
    );
  }

  unique(input.supportedFeatures, "supported feature", input.id);
  unique(input.excludedFeatures, "excluded feature", input.id);
  const supported = new Set(input.supportedFeatures);
  for (const feature of input.supportedFeatures) {
    if (!isVentureFeature(feature)) {
      throw new Error(`Venture ${input.id} has an unknown supported feature: ${feature}.`);
    }
  }
  for (const feature of input.excludedFeatures) {
    if (!isVentureFeature(feature)) {
      throw new Error(`Venture ${input.id} has an unknown excluded feature: ${feature}.`);
    }
    if (supported.has(feature)) {
      throw new Error(`Venture ${input.id} both supports and excludes feature ${feature}.`);
    }
  }

  return createVentureDefinition(input);
}

export function validateVentureSet(
  manifests: VentureDefinitionManifest[],
  capabilities: CapabilityRegistry,
): VentureDefinition[] {
  const definitions = manifests.map((item) => validateVentureManifest(item, capabilities));
  const seen = new Set<string>();

  for (const definition of definitions) {
    if (seen.has(definition.id)) {
      throw new Error(`Duplicate venture definition id: ${definition.id}.`);
    }
    seen.add(definition.id);
  }

  for (const definition of definitions) {
    for (const dependency of definition.dependencies) {
      if (!seen.has(dependency)) {
        throw new Error(
          `Venture ${definition.id} depends on missing venture ${dependency}.`,
        );
      }
      if (dependency === definition.id) {
        throw new Error(`Venture ${definition.id} cannot depend on itself.`);
      }
    }
  }

  const inbound = new Map(definitions.map((item) => [item.id, 0]));
  const outbound = new Map(definitions.map((item) => [item.id, [] as string[]]));
  for (const definition of definitions) {
    for (const dependency of definition.dependencies) {
      outbound.get(dependency)?.push(definition.id);
      inbound.set(definition.id, (inbound.get(definition.id) ?? 0) + 1);
    }
  }
  const queue = definitions.map((item) => item.id).filter((id) => inbound.get(id) === 0);
  const order: string[] = [];
  while (queue.length > 0) {
    const id = queue.shift() as string;
    order.push(id);
    for (const next of outbound.get(id) ?? []) {
      const remaining = (inbound.get(next) ?? 0) - 1;
      inbound.set(next, remaining);
      if (remaining === 0) {
        queue.push(next);
      }
    }
  }
  if (order.length !== definitions.length) {
    throw new Error("Circular venture definition dependency.");
  }

  return definitions;
}
