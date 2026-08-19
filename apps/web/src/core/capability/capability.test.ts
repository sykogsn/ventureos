import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createEmptyIntelligenceCore } from "../venture/model";
import { runExecutiveIntelligenceRuntime } from "../runtime";
import { CAPABILITY_CONTRACTS } from "./contracts";
import { CAPABILITY_DESIGN_STANDARD, capabilityCatalogue, capabilityDependencyMap } from "./documentation";
import { assertLifecycleTransition, canTransitionLifecycle } from "./lifecycle";
import { createCapabilityManifest } from "./model";
import {
  assertRuntimeCapabilities,
  createCapabilityRegistry,
} from "./registry";
import {
  platformCapabilityCatalog,
  platformCapabilityRegistry,
} from "./catalog";
import { RUNTIME_REQUIRED_CAPABILITIES } from "./types";
import type { CapabilityManifest } from "./types";

const C = CAPABILITY_CONTRACTS;

function stub(partial: Partial<CapabilityManifest> & Pick<CapabilityManifest, "id">): CapabilityManifest {
  return createCapabilityManifest({
    name: partial.name ?? partial.id,
    classification: partial.classification ?? "Platform",
    purpose: partial.purpose ?? "Test capability.",
    owner: partial.owner ?? "platform",
    version: partial.version ?? "1.0.0",
    maturity: partial.maturity ?? "ga",
    lifecycle: partial.lifecycle ?? "stable",
    dependencies: partial.dependencies ?? [],
    provides: partial.provides ?? [C.capabilityRegistry],
    requires: partial.requires ?? [],
    guarantees: partial.guarantees ?? ["Deterministic."],
    limitations: partial.limitations ?? ["Test only."],
    ...partial,
    id: partial.id,
  });
}

describe("Capability registry", () => {
  it("looks up catalogued capabilities by id", () => {
    const runtime = platformCapabilityRegistry.resolve("intelligence.runtime");
    assert.equal(runtime.name, "Executive Intelligence Runtime");
    assert.equal(runtime.classification, "Intelligence");
    assert.equal(runtime.lifecycle, "stable");
    assert.ok(runtime.dependencies.includes("intelligence.policy-engine"));
  });

  it("lists capabilities by classification", () => {
    const intelligence = platformCapabilityRegistry.byClassification("Intelligence");
    assert.ok(intelligence.some((item) => item.id === "intelligence.venture-core"));
    assert.equal(platformCapabilityRegistry.byClassification("AI").length, 0);
  });

  it("fails lookup of an unknown capability", () => {
    assert.throws(
      () => platformCapabilityRegistry.resolve("intelligence.unknown"),
      /Unknown capability/,
    );
  });

  it("builds a deterministic dependency order", () => {
    const order = platformCapabilityRegistry.graph().order;
    const vic = order.indexOf("intelligence.venture-core");
    const policy = order.indexOf("intelligence.policy-engine");
    const recs = order.indexOf("intelligence.recommendation-engine");
    const runtime = order.indexOf("intelligence.runtime");
    assert.ok(vic < policy);
    assert.ok(policy < recs);
    assert.ok(recs < runtime);
  });
});

describe("Capability validation", () => {
  it("rejects duplicate ids", () => {
    const one = stub({ id: "platform.dup" });
    assert.throws(() => createCapabilityRegistry([one, { ...one }]), /Duplicate capability id/);
  });

  it("rejects missing dependencies", () => {
    assert.throws(
      () =>
        createCapabilityRegistry([
          stub({
            id: "intelligence.orphan",
            dependencies: ["intelligence.missing"],
          }),
        ]),
      /missing capability/,
    );
  });

  it("rejects circular dependencies", () => {
    assert.throws(
      () =>
        createCapabilityRegistry([
          stub({ id: "a.one", dependencies: ["a.two"] }),
          stub({ id: "a.two", dependencies: ["a.one"] }),
        ]),
      /Circular capability dependency/,
    );
  });

  it("rejects unknown contracts", () => {
    assert.throws(
      () =>
        createCapabilityRegistry([
          stub({ id: "platform.bad-contract", provides: ["contract.not-real"] }),
        ]),
      /unknown contract/,
    );
  });
});

describe("Capability lifecycle", () => {
  it("allows adjacent forward transitions and deprecation", () => {
    assert.equal(canTransitionLifecycle("experimental", "internal"), true);
    assert.equal(canTransitionLifecycle("internal", "shared"), true);
    assert.equal(canTransitionLifecycle("shared", "stable"), true);
    assert.equal(canTransitionLifecycle("stable", "deprecated"), true);
    assert.equal(canTransitionLifecycle("experimental", "deprecated"), true);
  });

  it("rejects invalid lifecycle transitions", () => {
    assert.equal(canTransitionLifecycle("stable", "shared"), false);
    assert.equal(canTransitionLifecycle("experimental", "shared"), false);
    assert.equal(canTransitionLifecycle("deprecated", "stable"), false);
    assert.throws(() => assertLifecycleTransition("stable", "experimental"), /Invalid capability lifecycle/);
  });
});

describe("Runtime integration", () => {
  it("resolves every Runtime-required capability from the platform registry", () => {
    assertRuntimeCapabilities(platformCapabilityRegistry);
    for (const id of RUNTIME_REQUIRED_CAPABILITIES) {
      const capability = platformCapabilityRegistry.resolve(id);
      assert.notEqual(capability.lifecycle, "deprecated");
      assert.notEqual(capability.lifecycle, "experimental");
    }
  });

  it("fails when a Runtime-required capability is missing", () => {
    const registry = createCapabilityRegistry([stub({ id: "platform.only" })]);
    assert.throws(() => assertRuntimeCapabilities(registry), /Unknown capability/);
  });

  it("lets the Executive Intelligence Runtime run after capability resolution", () => {
    assertRuntimeCapabilities(platformCapabilityRegistry);
    const snapshot = runExecutiveIntelligenceRuntime(
      createEmptyIntelligenceCore({
        id: "founder",
        name: "Sonny",
        title: "Founder",
        posture: "Founding.",
        worldLine: "The first constraint is founding.",
      }),
    );
    assert.equal(snapshot.event.type, "IntelligenceRefresh");
    assert.equal(snapshot.core.ventures.length, 0);
  });
});

describe("Capability documentation", () => {
  it("renders catalogue and dependency map from the registry", () => {
    const catalogue = capabilityCatalogue();
    const map = capabilityDependencyMap();
    assert.match(catalogue, /Venture Intelligence Core/);
    assert.match(map, /intelligence\.runtime/);
    assert.match(CAPABILITY_DESIGN_STANDARD, /Executive Intelligence Runtime remains the only orchestrator/);
    assert.equal(platformCapabilityCatalog.length, platformCapabilityRegistry.list().length);
  });
});
