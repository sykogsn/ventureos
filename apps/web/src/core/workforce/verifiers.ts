import { nowIso } from "@/platform/ids";
import { FOUNDER_ONLY_CAPABILITIES } from "./authority";
import { EXECUTION_PROBE_CAPABILITY_ID } from "./executors";
import type { ProbeAuthoritativeStore } from "./executors";
import {
  bindPredicateRecord,
  notVerifiedResult,
  verifiedResult,
} from "./verification";
import type { TrustedObservationRequest } from "./verification";
import type {
  BoundPredicate,
  CapabilityExecutor,
  ExecutionArguments,
  VerificationObservation,
  VerificationObservationStatus,
  VerificationResult,
} from "./types";

export const EXECUTION_PROBE_PREDICATE_ID = "workforce.execution-probe.marker";
export const EXECUTION_PROBE_PREDICATE_VERSION = "1";

export type CapabilityVerifier = {
  id: string;
  bindPredicate(
    args: ExecutionArguments,
  ): { ok: true; predicate: BoundPredicate } | { ok: false };
  observe(request: TrustedObservationRequest): Promise<VerificationObservation>;
  apply(
    predicate: BoundPredicate,
    observation: VerificationObservation,
  ): VerificationResult;
};

export type WorkforceVerifierRegistry = {
  get(id: string): CapabilityVerifier | undefined;
};

export function createWorkforceVerifierRegistry(
  verifiers: CapabilityVerifier[],
): WorkforceVerifierRegistry {
  const byId = new Map<string, CapabilityVerifier>();

  for (const verifier of verifiers) {
    if ((FOUNDER_ONLY_CAPABILITIES as readonly string[]).includes(verifier.id)) {
      throw new Error(`Verifier registration forbidden: ${verifier.id}.`);
    }
    if (byId.has(verifier.id)) {
      throw new Error(`Duplicate verifier: ${verifier.id}.`);
    }
    byId.set(verifier.id, verifier);
  }

  return {
    get(id) {
      return byId.get(id);
    },
  };
}

export type ProbeObserveScript = VerificationObservationStatus;

export type ExecutionProbeVerifier = {
  verifier: CapabilityVerifier;
  observeCount(): number;
};

/**
 * Test-only capability verifier. Shares the probe authoritative store with
 * the test executor. Not a production capability and not registered in
 * production Workforce wiring.
 */
export function createExecutionProbeVerifier(
  store: ProbeAuthoritativeStore,
  options: { observeScript?: ProbeObserveScript[] } = {},
): ExecutionProbeVerifier {
  const script = [...(options.observeScript ?? [])];
  let observes = 0;

  const verifier: CapabilityVerifier = {
    id: EXECUTION_PROBE_CAPABILITY_ID,
    bindPredicate(args) {
      if (typeof args.marker !== "string" && args.marker !== undefined) {
        return { ok: false };
      }
      const expected: ExecutionArguments = {
        marker: typeof args.marker === "string" ? args.marker : "",
      };
      return {
        ok: true,
        predicate: bindPredicateRecord(
          {
            id: EXECUTION_PROBE_PREDICATE_ID,
            version: EXECUTION_PROBE_PREDICATE_VERSION,
            capabilityId: EXECUTION_PROBE_CAPABILITY_ID,
          },
          expected,
        ),
      };
    },
    async observe(request) {
      observes += 1;
      const scripted = script.shift();
      if (scripted) {
        return { status: scripted, observedAt: nowIso() };
      }
      const value = store.read({
        workspaceId: request.workspaceId,
        ventureId: request.ventureId,
        agentInstanceId: request.agentInstanceId,
      });
      if (value === undefined) {
        return { status: "missing", observedAt: nowIso() };
      }
      return {
        status: "observed",
        observedAt: nowIso(),
        values: { marker: value },
      };
    },
    apply(predicate, observation) {
      if (observation.status !== "observed") {
        return notVerifiedResult();
      }
      const expected =
        typeof predicate.expected.marker === "string"
          ? predicate.expected.marker
          : "";
      const actual =
        typeof observation.values?.marker === "string"
          ? observation.values.marker
          : undefined;
      return actual === expected ? verifiedResult() : notVerifiedResult();
    },
  };

  return {
    verifier,
    observeCount() {
      return observes;
    },
  };
}

export function assertNoExecutorPorts(
  verifier: CapabilityVerifier,
): asserts verifier is CapabilityVerifier {
  const record = verifier as CapabilityVerifier & {
    execute?: CapabilityExecutor["execute"];
    invoke?: unknown;
  };
  if (typeof record.execute === "function" || typeof record.invoke === "function") {
    throw new Error("Verifier must not expose ExecutionPort or ModelPort.");
  }
}
