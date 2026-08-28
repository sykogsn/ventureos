import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { platformCapabilityRegistry } from "../capability/catalog";
import { RUNTIME_REQUIRED_CAPABILITIES } from "../capability/types";
import { createCapabilityRegistry } from "../capability/registry";
import { createCapabilityManifest } from "../capability/model";
import { CAPABILITY_CONTRACTS } from "../capability/contracts";
import { platformVentureCatalog, platformVentureRegistry } from "./catalog";
import {
  VENTURE_DEFINITION_STANDARD,
  VENTURE_DEPENDENCY_GUIDE,
  VENTURE_MANIFEST_SPECIFICATION,
  ventureCatalogue,
} from "./documentation";
import { canTransitionVentureLifecycle } from "./lifecycle";
import { parseVentureManifest } from "./manifest";
import { createVentureManifest } from "./model";
import { createVentureDefinitionRegistry } from "./registry";
import { validateVentureManifest } from "./validation";
import type { VentureDefinitionManifest } from "./types";
import { VENTURE_RUNTIME_ORCHESTRATOR } from "./types";

function base(overrides: Partial<VentureDefinitionManifest> = {}): VentureDefinitionManifest {
  return createVentureManifest({
    id: "test-venture",
    name: "Test Venture",
    purpose: "Validate the definition framework.",
    description: "A fixture used only in tests.",
    owner: "founder",
    version: "1.0.0",
    lifecycle: "concept",
    maturity: "experimental",
    runtimeProfile: {
      orchestrator: VENTURE_RUNTIME_ORCHESTRATOR,
      requiredCapabilities: [...RUNTIME_REQUIRED_CAPABILITIES],
    },
    capabilityProfile: {
      uses: [
        ...RUNTIME_REQUIRED_CAPABILITIES,
        "governance.executive-office",
        "governance.founder-decision",
      ],
      excludes: [],
    },
    governanceProfile: {
      owner: "founder",
      policyCapabilityId: "intelligence.policy-engine",
      decisionCapabilityId: "governance.founder-decision",
      officeCapabilityId: "governance.executive-office",
    },
    dependencies: [],
    supportedFeatures: ["situation-room"],
    excludedFeatures: ["morning-briefing"],
    ...overrides,
  });
}

describe("Venture definition registry", () => {
  it("resolves Qualora, Calviora and Farmora", () => {
    assert.equal(platformVentureRegistry.resolve("qualora").name, "Qualora");
    assert.equal(platformVentureRegistry.resolve("calviora").lifecycle, "concept");
    assert.equal(platformVentureRegistry.resolve("farmora").owner, "founder");
    assert.equal(platformVentureRegistry.resolve("frigora").name, "Frigora");
    assert.equal(platformVentureRegistry.resolve("frigora").lifecycle, "concept");
    assert.equal(platformVentureRegistry.resolve("frigora").maturity, "experimental");
    assert.equal(platformVentureRegistry.resolve("frigora").version, "0.9.0");
    assert.match(
      platformVentureRegistry.resolve("frigora").description,
      /Customer, Site, Asset, WorkOrder/,
    );
    assert.ok(
      RUNTIME_REQUIRED_CAPABILITIES.every((id) =>
        platformVentureRegistry.resolve("frigora").capabilityProfile.uses.includes(id),
      ),
    );
    assert.ok(
      platformVentureRegistry
        .resolve("frigora")
        .capabilityProfile.uses.includes("intelligence.briefing"),
    );
    assert.deepEqual(platformVentureRegistry.resolve("frigora").capabilityProfile.excludes, []);
    assert.deepEqual(platformVentureRegistry.resolve("frigora").excludedFeatures, []);
    assert.equal(platformVentureRegistry.list().length, 5);
  });

  it("filters by lifecycle", () => {
    assert.equal(platformVentureRegistry.byLifecycle("incubating")[0]?.id, "qualora");
    assert.deepEqual(
      platformVentureRegistry.byLifecycle("concept").map((item) => item.id).sort(),
      ["calviora", "farmora", "frigora"],
    );
  });

  it("fails lookup of an unknown venture", () => {
    assert.throws(() => platformVentureRegistry.resolve("unknown"), /Unknown venture definition/);
  });
});

describe("Venture manifest validation", () => {
  it("accepts a valid manifest", () => {
    const definition = validateVentureManifest(base(), platformCapabilityRegistry);
    assert.equal(definition.id, "test-venture");
    assert.equal(definition.runtimeProfile.orchestrator, VENTURE_RUNTIME_ORCHESTRATOR);
  });

  it("rejects a duplicate id", () => {
    const one = base({ id: "dup" });
    assert.throws(
      () => createVentureDefinitionRegistry([one, { ...one }], platformCapabilityRegistry),
      /Duplicate venture definition id/,
    );
  });

  it("rejects a missing capability reference", () => {
    assert.throws(
      () =>
        validateVentureManifest(
          base({
            capabilityProfile: {
              uses: [...RUNTIME_REQUIRED_CAPABILITIES, "intelligence.not-real"],
              excludes: [],
            },
          }),
          platformCapabilityRegistry,
        ),
      /missing capability/,
    );
  });

  it("rejects an invalid lifecycle", () => {
    assert.throws(
      () =>
        validateVentureManifest(
          base({ lifecycle: "production" as VentureDefinitionManifest["lifecycle"] }),
          platformCapabilityRegistry,
        ),
      /invalid lifecycle/,
    );
  });

  it("rejects an invalid runtime profile", () => {
    assert.throws(
      () =>
        validateVentureManifest(
          base({
            runtimeProfile: {
              orchestrator: "intelligence.policy-engine",
              requiredCapabilities: [...RUNTIME_REQUIRED_CAPABILITIES],
            },
          }),
          platformCapabilityRegistry,
        ),
      /invalid runtime profile/,
    );
  });

  it("rejects an invalid governance profile", () => {
    assert.throws(
      () =>
        validateVentureManifest(
          base({
            governanceProfile: {
              owner: "founder",
              policyCapabilityId: "intelligence.operating-health",
              decisionCapabilityId: "governance.founder-decision",
              officeCapabilityId: "governance.executive-office",
            },
          }),
          platformCapabilityRegistry,
        ),
      /invalid governance profile/,
    );
  });

  it("rejects a missing venture dependency", () => {
    assert.throws(
      () =>
        createVentureDefinitionRegistry(
          [base({ id: "child", dependencies: ["parent"] })],
          platformCapabilityRegistry,
        ),
      /missing venture/,
    );
  });

  it("rejects a circular venture dependency", () => {
    assert.throws(
      () =>
        createVentureDefinitionRegistry(
          [
            base({ id: "one", dependencies: ["two"] }),
            base({ id: "two", name: "Two", dependencies: ["one"] }),
          ],
          platformCapabilityRegistry,
        ),
      /Circular venture definition dependency/,
    );
  });

  it("parses a manifest object through parseVentureManifest", () => {
    const parsed = parseVentureManifest(base(), platformCapabilityRegistry);
    assert.equal(parsed.name, "Test Venture");
  });
});

describe("Venture definition lifecycle", () => {
  it("allows adjacent forward moves and sunset", () => {
    assert.equal(canTransitionVentureLifecycle("concept", "incubating"), true);
    assert.equal(canTransitionVentureLifecycle("operating", "sunset"), true);
    assert.equal(canTransitionVentureLifecycle("scaling", "concept"), false);
  });
});

describe("Venture definition documentation", () => {
  it("renders catalogue and standards", () => {
    assert.match(ventureCatalogue(), /Qualora/);
    assert.match(VENTURE_DEFINITION_STANDARD, /does not execute/i);
    assert.match(VENTURE_MANIFEST_SPECIFICATION, /runtimeProfile/);
    assert.match(VENTURE_DEPENDENCY_GUIDE, /Capability Registry/);
    assert.equal(platformVentureCatalog.length, 5);
  });
});

describe("Venture definition isolation", () => {
  it("does not execute capabilities when validating", () => {
    const empty = createCapabilityRegistry([
      createCapabilityManifest({
        id: "platform.only",
        name: "Only",
        classification: "Platform",
        purpose: "Empty registry for isolation.",
        owner: "platform",
        version: "1.0.0",
        maturity: "ga",
        lifecycle: "stable",
        dependencies: [],
        provides: [CAPABILITY_CONTRACTS.capabilityRegistry],
        requires: [],
        guarantees: ["None."],
        limitations: ["Test."],
      }),
    ]);
    assert.throws(() => validateVentureManifest(base(), empty), /missing capability/);
  });
});
