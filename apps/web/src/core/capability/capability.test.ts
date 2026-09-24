import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createEmptyIntelligenceCore } from "../venture/model";
import { runExecutiveIntelligenceRuntime } from "../runtime";
import { CAPABILITY_CONTRACTS } from "./contracts";
import {
  CAPABILITY_DESIGN_STANDARD,
  capabilityCatalogue,
  capabilityDependencyMap,
} from "./documentation";
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

function stub(
  partial: Partial<CapabilityManifest> & Pick<CapabilityManifest, "id">,
): CapabilityManifest {
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
    const intelligence =
      platformCapabilityRegistry.byClassification("Intelligence");
    assert.ok(
      intelligence.some((item) => item.id === "intelligence.venture-core"),
    );
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
    assert.throws(
      () => createCapabilityRegistry([one, { ...one }]),
      /Duplicate capability id/,
    );
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
          stub({
            id: "platform.bad-contract",
            provides: ["contract.not-real"],
          }),
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
    assert.throws(
      () => assertLifecycleTransition("stable", "experimental"),
      /Invalid capability lifecycle/,
    );
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
    assert.throws(
      () => assertRuntimeCapabilities(registry),
      /Unknown capability/,
    );
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
    assert.match(
      CAPABILITY_DESIGN_STANDARD,
      /Executive Intelligence Runtime remains the only orchestrator/,
    );
    assert.equal(
      platformCapabilityCatalog.length,
      platformCapabilityRegistry.list().length,
    );
  });
});

import { assessCapabilityReuse, validateManifest } from "./manifest";
import type {
  CapabilityProvenance,
  CapabilityProvenanceContext,
} from "./types";

const evaluationTime = "2026-09-03T12:00:00Z";
function reuseFixture() {
  const provenance: CapabilityProvenance = {
    origin: {
      workspaceId: "ws",
      ventureId: "venture-a",
      sourceRef: "implementation-origin",
    },
    implementationRefs: [{ id: "implementation-a", version: "1.0.0" }],
    dependencyRefs: [{ capabilityId: "dependency-a", version: "1.0.0" }],
    validationContexts: [
      {
        id: "context-a",
        workspaceId: "ws",
        ventureId: "venture-a",
        at: "2026-09-01T12:00:00Z",
        implementationVersion: "1.0.0",
        evidenceIds: ["evidence-a", "evidence-b"],
        result: "SUPPORTED",
      },
    ],
    performanceEvidenceIds: ["evidence-a"],
    learningIds: ["learning-a"],
    reuseEvidenceIds: ["evidence-a", "evidence-b"],
    reuseAssessment: {
      classification: "REUSABLE_CAPABILITY_CANDIDATE",
      rationale: "Independent validation supports considering reuse.",
      proposedBy: "reviewer",
      at: "2026-09-02T12:00:00Z",
    },
  };
  const capability = stub({
    id: "candidate-a",
    dependencies: ["dependency-a"],
    provenance,
  });
  const context: CapabilityProvenanceContext = {
    capabilities: [{ id: "dependency-a", version: "1.0.0" }],
    references: [
      {
        id: "evidence-a",
        kind: "Evidence",
        workspaceId: "ws",
        ventureId: "venture-a",
      },
      {
        id: "evidence-b",
        kind: "Evidence",
        workspaceId: "ws",
        ventureId: "venture-a",
      },
      {
        id: "learning-a",
        kind: "Learning",
        workspaceId: "ws",
        ventureId: "venture-a",
      },
    ],
    evidenceOrigins: [
      { evidenceId: "evidence-a", originKeys: ["source-a"] },
      { evidenceId: "evidence-b", originKeys: ["source-b"] },
    ],
  };
  return { capability, context, provenance };
}

describe("AIF-01 Capability provenance and reuse", () => {
  it("leaves absent provenance unassessed even on a stable capability", () => {
    const result = assessCapabilityReuse(
      stub({ id: "legacy", lifecycle: "stable" }),
      { capabilities: [], references: [], evidenceOrigins: [] },
      evaluationTime,
    );
    assert.equal(result.classification, "UNASSESSED");
    assert.equal(result.candidate, false);
    assert.equal(result.promotionEligible, false);
  });
  it("keeps DOMAIN_SPECIFIC separate from candidate", () => {
    const { capability, context, provenance } = reuseFixture();
    provenance.reuseAssessment.classification = "DOMAIN_SPECIFIC";
    assert.equal(
      assessCapabilityReuse(capability, context, evaluationTime).candidate,
      false,
    );
  });
  it("accepts sufficient independent evidence within one Venture and one context", () => {
    const { capability, context } = reuseFixture();
    const result = assessCapabilityReuse(capability, context, evaluationTime);
    assert.equal(result.candidate, true);
    assert.equal(result.promotionEligible, false);
    assert.equal(capability.lifecycle, "stable");
  });
  it("rejects two copied records from one source as independent support", () => {
    const { capability, context } = reuseFixture();
    context.evidenceOrigins[1]!.originKeys = ["source-a"];
    assert.equal(
      assessCapabilityReuse(capability, context, evaluationTime).candidate,
      false,
    );
  });
  it("accepts represented cross-Venture validation without making it mandatory", () => {
    const { capability, context, provenance } = reuseFixture();
    provenance.validationContexts[0]!.evidenceIds = ["evidence-a"];
    provenance.validationContexts.push({
      ...provenance.validationContexts[0]!,
      id: "context-b",
      ventureId: "venture-b",
      evidenceIds: ["evidence-b"],
    });
    context.references[1]!.ventureId = "venture-b";
    assert.equal(
      assessCapabilityReuse(capability, context, evaluationTime).candidate,
      true,
    );
  });
  it("rejects unresolved challenges", () => {
    const { capability, context, provenance } = reuseFixture();
    provenance.validationContexts[0]!.result = "CHALLENGED";
    assert.equal(
      assessCapabilityReuse(capability, context, evaluationTime).candidate,
      false,
    );
  });
  it("rejects unresolved implementation versions", () => {
    const { capability, context, provenance } = reuseFixture();
    provenance.validationContexts[0]!.implementationVersion = "2.0.0";
    assert.throws(
      () => assessCapabilityReuse(capability, context, evaluationTime),
      /implementation version/,
    );
  });
  it("does not use validation of an old version for the assessed version", () => {
    const { capability, context, provenance } = reuseFixture();
    provenance.implementationRefs.push({
      id: "implementation-a",
      version: "2.0.0",
    });
    capability.version = "2.0.0";
    assert.equal(
      assessCapabilityReuse(capability, context, evaluationTime).candidate,
      false,
    );
  });
  it("rejects dependency provenance mismatch and missing dependency declaration", () => {
    const { capability, context, provenance } = reuseFixture();
    provenance.dependencyRefs[0]!.version = "9.0.0";
    assert.throws(
      () => assessCapabilityReuse(capability, context, evaluationTime),
      /dependency version/,
    );
    provenance.dependencyRefs = [];
    assert.throws(
      () => assessCapabilityReuse(capability, context, evaluationTime),
      /dependency provenance/,
    );
  });
  it("rejects missing or wrong-type Evidence/Learning references", () => {
    for (const id of ["evidence-a", "learning-a"]) {
      const { capability, context } = reuseFixture();
      context.references = context.references.filter((r) => r.id !== id);
      assert.throws(
        () => assessCapabilityReuse(capability, context, evaluationTime),
        /reference/,
      );
    }
    const { capability, context } = reuseFixture();
    context.references[0]!.kind = "Learning";
    assert.throws(
      () => assessCapabilityReuse(capability, context, evaluationTime),
      /wrong-type/,
    );
  });
  it("requires performance and reuse evidence", () => {
    const { capability, context, provenance } = reuseFixture();
    provenance.performanceEvidenceIds = [];
    assert.equal(
      assessCapabilityReuse(capability, context, evaluationTime).candidate,
      false,
    );
  });
  it("requires source-origin resolution and rejects duplicate resolutions", () => {
    const { capability, context } = reuseFixture();
    context.evidenceOrigins = [];
    assert.throws(
      () => assessCapabilityReuse(capability, context, evaluationTime),
      /origins/,
    );
    const other = reuseFixture();
    other.context.evidenceOrigins.push(other.context.evidenceOrigins[0]!);
    assert.throws(
      () =>
        assessCapabilityReuse(other.capability, other.context, evaluationTime),
      /origins/,
    );
  });
  it("requires authority separately and allows structural eligibility with explicit authority", () => {
    const { capability, context, provenance } = reuseFixture();
    assert.equal(
      assessCapabilityReuse(capability, context, evaluationTime)
        .promotionEligible,
      false,
    );
    provenance.promotionAuthority = {
      reference: "control-decision",
      actor: "Control",
      at: evaluationTime,
      evidenceIds: ["evidence-a", "evidence-b"],
    };
    const before = structuredClone(capability);
    assert.equal(
      assessCapabilityReuse(capability, context, evaluationTime)
        .promotionEligible,
      true,
    );
    assert.deepEqual(capability, before);
  });
  it("rejects empty authority evidence and invalid authority timing", () => {
    const { capability, context, provenance } = reuseFixture();
    provenance.promotionAuthority = {
      reference: "control-decision",
      actor: "Control",
      at: evaluationTime,
      evidenceIds: [],
    };
    assert.throws(
      () => assessCapabilityReuse(capability, context, evaluationTime),
      /requires evidence/,
    );
    provenance.promotionAuthority.evidenceIds = ["evidence-a"];
    provenance.promotionAuthority.at = "2027-01-01T00:00:00Z";
    assert.throws(
      () => assessCapabilityReuse(capability, context, evaluationTime),
      /authority time/,
    );
  });
  it("rejects authority evidence outside the reuse assessment", () => {
    const { capability, context, provenance } = reuseFixture();
    provenance.reuseEvidenceIds = ["evidence-a"];
    provenance.promotionAuthority = {
      reference: "control-decision",
      actor: "Control",
      at: evaluationTime,
      evidenceIds: ["evidence-b"],
    };
    assert.throws(
      () => assessCapabilityReuse(capability, context, evaluationTime),
      /outside reuse/,
    );
  });
  it("rejects cross-workspace and mismatched validation scopes", () => {
    const { capability, context } = reuseFixture();
    context.references[0]!.workspaceId = "other";
    assert.throws(
      () => assessCapabilityReuse(capability, context, evaluationTime),
      /cross-workspace/,
    );
    const other = reuseFixture();
    other.context.references[0]!.ventureId = "unlisted";
    assert.throws(
      () =>
        assessCapabilityReuse(other.capability, other.context, evaluationTime),
      /scope/,
    );
  });
  it("checks optional provenance shape through the existing manifest validator", () => {
    const { capability, provenance } = reuseFixture();
    validateManifest(capability);
    provenance.reuseAssessment.classification = "SHARED" as never;
    assert.throws(() => validateManifest(capability), /classification/);
  });
  it("is deterministic for identical inputs and explicit time", () => {
    const { capability, context } = reuseFixture();
    assert.deepEqual(
      assessCapabilityReuse(capability, context, evaluationTime),
      assessCapabilityReuse(
        structuredClone(capability),
        structuredClone(context),
        evaluationTime,
      ),
    );
    assert.throws(
      () => assessCapabilityReuse(capability, context, "2026-09-03"),
      /UTC/,
    );
  });
});
