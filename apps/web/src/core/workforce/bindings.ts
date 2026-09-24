import type { CapabilityRegistry } from "@/core/capability/registry";
import { FOUNDER_ONLY_CAPABILITIES } from "./authority";
import type { WorkforceExecutorRegistry } from "./executors";
import { createWorkforceExecutorRegistry } from "./executors";
import type { CapabilityVerifier, WorkforceVerifierRegistry } from "./verifiers";
import { createWorkforceVerifierRegistry } from "./verifiers";
import type { CapabilityExecutor } from "./types";

const USABLE_CAPABILITY_LIFECYCLES = new Set(["internal", "shared", "stable"]);

export type WorkforceBinding = {
  bindingId: string;
  implementationVersion: string;
  capabilityId: string;
  executor: CapabilityExecutor;
  verifier: CapabilityVerifier;
};

export type WorkforceImplementationIdentity = {
  bindingId: string;
  implementationVersion: string;
};

export type WorkforceImplementationRegistry = {
  get(capabilityId: string): WorkforceImplementationIdentity | undefined;
};

export type ComposedWorkforceBindings = {
  executors: WorkforceExecutorRegistry;
  verifiers: WorkforceVerifierRegistry;
  implementations: WorkforceImplementationRegistry;
};

/**
 * Explicit server-side composition. Registration does not grant authority.
 * Duplicate or unknown bindings fail fast at compose time.
 */
export function composeWorkforceBindings(
  bindings: WorkforceBinding[],
  capabilities: CapabilityRegistry,
): ComposedWorkforceBindings {
  const byBindingId = new Set<string>();
  const byCapabilityId = new Set<string>();
  const identities = new Map<string, WorkforceImplementationIdentity>();
  const executors: CapabilityExecutor[] = [];
  const verifiers: CapabilityVerifier[] = [];

  for (const binding of bindings) {
    const bindingId = binding.bindingId.trim();
    const implementationVersion = binding.implementationVersion.trim();
    const capabilityId = binding.capabilityId.trim();
    if (!bindingId || !implementationVersion || !capabilityId) {
      throw new Error("Workforce binding is missing identity fields.");
    }
    if (byBindingId.has(bindingId)) {
      throw new Error(`Duplicate workforce binding: ${bindingId}.`);
    }
    if (byCapabilityId.has(capabilityId)) {
      throw new Error(`Duplicate workforce capability binding: ${capabilityId}.`);
    }
    if ((FOUNDER_ONLY_CAPABILITIES as readonly string[]).includes(capabilityId)) {
      throw new Error(`Workforce binding forbidden: ${capabilityId}.`);
    }
    const capability = capabilities.get(capabilityId);
    if (!capability) {
      throw new Error(`Unknown capability for workforce binding: ${capabilityId}.`);
    }
    if (!USABLE_CAPABILITY_LIFECYCLES.has(capability.lifecycle)) {
      throw new Error(
        `Unusable capability lifecycle for workforce binding: ${capabilityId}.`,
      );
    }
    if (!binding.executor || !binding.verifier) {
      throw new Error(
        `Workforce binding missing executor or verifier: ${capabilityId}.`,
      );
    }
    if (binding.executor.id !== capabilityId) {
      throw new Error(
        `Executor id must match capability id: ${binding.executor.id} !== ${capabilityId}.`,
      );
    }
    if (binding.verifier.id !== capabilityId) {
      throw new Error(
        `Verifier id must match capability id: ${binding.verifier.id} !== ${capabilityId}.`,
      );
    }
    byBindingId.add(bindingId);
    byCapabilityId.add(capabilityId);
    identities.set(capabilityId, { bindingId, implementationVersion });
    executors.push(binding.executor);
    verifiers.push(binding.verifier);
  }

  return {
    executors: createWorkforceExecutorRegistry(executors),
    verifiers: createWorkforceVerifierRegistry(verifiers),
    implementations: {
      get(id) {
        return identities.get(id);
      },
    },
  };
}

export function emptyWorkforceImplementations(): WorkforceImplementationRegistry {
  return {
    get() {
      return undefined;
    },
  };
}
