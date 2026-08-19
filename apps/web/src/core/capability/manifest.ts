import { isCapabilityContract } from "./contracts";
import { isCapabilityLifecycle } from "./lifecycle";
import { createCapability } from "./model";
import { isCapabilityClassification } from "./taxonomy";
import type { Capability, CapabilityManifest } from "./types";

const SEMVER = /^\d+\.\d+\.\d+$/;

export function validateManifest(input: CapabilityManifest): Capability {
  if (!input.id.trim()) {
    throw new Error("Capability id is required.");
  }
  if (!input.name.trim()) {
    throw new Error(`Capability ${input.id} is missing a name.`);
  }
  if (!input.purpose.trim()) {
    throw new Error(`Capability ${input.id} is missing a purpose.`);
  }
  if (!input.owner.trim()) {
    throw new Error(`Capability ${input.id} is missing an owner.`);
  }
  if (!SEMVER.test(input.version)) {
    throw new Error(`Capability ${input.id} has an invalid version.`);
  }
  if (!isCapabilityClassification(input.classification)) {
    throw new Error(`Capability ${input.id} has an invalid classification.`);
  }
  if (!isCapabilityLifecycle(input.lifecycle)) {
    throw new Error(`Capability ${input.id} has an invalid lifecycle status.`);
  }
  for (const token of [...input.provides, ...input.requires]) {
    if (!isCapabilityContract(token)) {
      throw new Error(`Capability ${input.id} references an unknown contract: ${token}.`);
    }
  }
  return createCapability(input);
}
