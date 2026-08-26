import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { platformCapabilityCatalog } from "@/core/capability/catalog";
import { createCapabilityManifest } from "@/core/capability/model";
import { createCapabilityRegistry } from "@/core/capability/registry";
import { CAPABILITY_CONTRACTS } from "@/core/capability/contracts";
import { FOUNDER_ONLY_CAPABILITIES } from "./authority";
import {
  composeWorkforceBindings,
  emptyWorkforceImplementations,
  type WorkforceBinding,
} from "./bindings";
import {
  createExecutionProbeExecutor,
  createProbeAuthoritativeStore,
  EXECUTION_PROBE_CAPABILITY_ID,
} from "./executors";
import { createExecutionProbeVerifier } from "./verifiers";
import type { CapabilityExecutor } from "./types";
import type { CapabilityVerifier } from "./verifiers";

const here = dirname(fileURLToPath(import.meta.url));
const bindingsPath = join(here, "bindings.ts");
const productionPath = join(here, "../../modules/workforce/production-bindings.ts");
const servicePath = join(here, "../../modules/workforce/service.ts");

function dummyExecutor(id: string): CapabilityExecutor {
  return {
    id,
    parseArguments: () => ({ ok: true, value: {} }),
    async execute() {
      return { executorId: id, ok: true };
    },
  };
}

function dummyVerifier(id: string): CapabilityVerifier {
  return {
    id,
    bindPredicate: () => ({ ok: false }),
    async observe() {
      return { status: "missing", observedAt: "2026-08-26T00:00:00.000Z" };
    },
    apply: () => ({ outcome: "NOT_VERIFIED" }),
  };
}

function probeCapability() {
  return createCapabilityManifest({
    id: EXECUTION_PROBE_CAPABILITY_ID,
    name: "Workforce Execution Probe",
    classification: "Platform",
    purpose: "Test-only controlled side-effect probe.",
    owner: "platform",
    version: "0.1.0",
    maturity: "experimental",
    lifecycle: "internal",
    dependencies: [],
    provides: [CAPABILITY_CONTRACTS.capabilityRegistry],
    requires: [],
    guarantees: ["Probe invocations are counted in-process."],
    limitations: ["Not part of the production catalogue."],
  });
}

function experimentalCapability() {
  return createCapabilityManifest({
    id: "workforce.experimental-probe",
    name: "Experimental Probe",
    classification: "Platform",
    purpose: "Unusable lifecycle fixture.",
    owner: "platform",
    version: "0.1.0",
    maturity: "experimental",
    lifecycle: "experimental",
    dependencies: [],
    provides: [CAPABILITY_CONTRACTS.capabilityRegistry],
    requires: [],
    guarantees: [],
    limitations: [],
  });
}

function testCapabilities() {
  return createCapabilityRegistry([
    ...platformCapabilityCatalog,
    probeCapability(),
    experimentalCapability(),
  ]);
}

function probeBinding(
  overrides: Partial<WorkforceBinding> = {},
): WorkforceBinding {
  const store = createProbeAuthoritativeStore();
  return {
    bindingId: "test.workforce.execution-probe",
    implementationVersion: "1.0.0",
    capabilityId: EXECUTION_PROBE_CAPABILITY_ID,
    executor: createExecutionProbeExecutor(store).executor,
    verifier: createExecutionProbeVerifier(store).verifier,
    ...overrides,
  };
}

describe("workforce binding composer", () => {
  it("composes a matching executor, verifier, and implementation identity", () => {
    const composed = composeWorkforceBindings([probeBinding()], testCapabilities());
    assert.equal(
      composed.executors.get(EXECUTION_PROBE_CAPABILITY_ID)?.id,
      EXECUTION_PROBE_CAPABILITY_ID,
    );
    assert.equal(
      composed.verifiers.get(EXECUTION_PROBE_CAPABILITY_ID)?.id,
      EXECUTION_PROBE_CAPABILITY_ID,
    );
    assert.deepEqual(composed.implementations.get(EXECUTION_PROBE_CAPABILITY_ID), {
      bindingId: "test.workforce.execution-probe",
      implementationVersion: "1.0.0",
    });
  });

  it("composes an empty list without granting authority", () => {
    const composed = composeWorkforceBindings([], testCapabilities());
    assert.equal(composed.executors.get(EXECUTION_PROBE_CAPABILITY_ID), undefined);
    assert.equal(composed.verifiers.get("platform.identity"), undefined);
    assert.equal(composed.implementations.get("platform.identity"), undefined);
    assert.equal(emptyWorkforceImplementations().get("platform.identity"), undefined);
  });

  it("rejects duplicate binding ids", () => {
    assert.throws(
      () =>
        composeWorkforceBindings(
          [
            probeBinding(),
            probeBinding({
              capabilityId: "platform.identity",
              executor: dummyExecutor("platform.identity"),
              verifier: dummyVerifier("platform.identity"),
            }),
          ],
          testCapabilities(),
        ),
      /Duplicate workforce binding/,
    );
  });

  it("rejects duplicate capability bindings", () => {
    assert.throws(
      () =>
        composeWorkforceBindings(
          [
            probeBinding(),
            probeBinding({ bindingId: "test.workforce.execution-probe.alt" }),
          ],
          testCapabilities(),
        ),
      /Duplicate workforce capability binding/,
    );
  });

  it("rejects unknown capabilities", () => {
    assert.throws(
      () =>
        composeWorkforceBindings(
          [
            probeBinding({
              capabilityId: "does.not.exist",
              executor: dummyExecutor("does.not.exist"),
              verifier: dummyVerifier("does.not.exist"),
            }),
          ],
          testCapabilities(),
        ),
      /Unknown capability/,
    );
  });

  it("rejects founder-only capabilities", () => {
    const id = FOUNDER_ONLY_CAPABILITIES[0];
    assert.throws(
      () =>
        composeWorkforceBindings(
          [
            {
              bindingId: "test.founder",
              implementationVersion: "1",
              capabilityId: id,
              executor: dummyExecutor(id),
              verifier: dummyVerifier(id),
            },
          ],
          testCapabilities(),
        ),
      /Workforce binding forbidden/,
    );
  });

  it("rejects unusable capability lifecycles", () => {
    assert.throws(
      () =>
        composeWorkforceBindings(
          [
            {
              bindingId: "test.experimental",
              implementationVersion: "1",
              capabilityId: "workforce.experimental-probe",
              executor: dummyExecutor("workforce.experimental-probe"),
              verifier: dummyVerifier("workforce.experimental-probe"),
            },
          ],
          testCapabilities(),
        ),
      /Unusable capability lifecycle/,
    );
  });

  it("rejects executor and verifier id mismatches", () => {
    assert.throws(
      () =>
        composeWorkforceBindings(
          [probeBinding({ executor: dummyExecutor("platform.identity") })],
          testCapabilities(),
        ),
      /Executor id must match capability id/,
    );
    assert.throws(
      () =>
        composeWorkforceBindings(
          [probeBinding({ verifier: dummyVerifier("platform.identity") })],
          testCapabilities(),
        ),
      /Verifier id must match capability id/,
    );
  });

  it("keeps production bindings to the authorised Qualora binding and separate from test probes", async () => {
    const production = await readFile(productionPath, "utf8");
    const service = await readFile(servicePath, "utf8");
    const bindings = await readFile(bindingsPath, "utf8");
    assert.match(production, /QUALORA_EVIDENCE_ASSESSMENT_BINDING/);
    assert.match(
      production,
      /export const PRODUCTION_WORKFORCE_BINDINGS: WorkforceBinding\[\] = \[\s*QUALORA_EVIDENCE_ASSESSMENT_BINDING,\s*\];/,
    );
    assert.doesNotMatch(production, /execution-probe/);
    assert.doesNotMatch(production, /Calviora|Farmora/);
    assert.match(service, /composeWorkforceBindings\(\s*PRODUCTION_WORKFORCE_BINDINGS/);
    assert.doesNotMatch(service, /execution-probe/);
    assert.doesNotMatch(service, /Qualora|Calviora|Farmora/);
    assert.doesNotMatch(
      bindings,
      /Qualora|Calviora|Farmora|patient|livestock|NHS|healthcare/i,
    );
    assert.match(bindings, /Registration does not grant authority/);
  });
});
