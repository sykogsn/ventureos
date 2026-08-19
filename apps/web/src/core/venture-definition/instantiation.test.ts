import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CAPABILITY_CONTRACTS } from "../capability/contracts";
import { platformCapabilityRegistry } from "../capability/catalog";
import { createCapabilityManifest } from "../capability/model";
import { createCapabilityRegistry } from "../capability/registry";
import { createVentureFromFounding } from "../venture/model";
import { foundCompany } from "../../modules/ventures/launch/artefacts";
import { emptyLaunchDraft } from "../../modules/ventures/launch/types";
import { platformVentureRegistry } from "./catalog";
import { instantiateVentureDefinition } from "./instantiation";
import { DEFAULT_VENTURE_DEFINITION_REF } from "./types";
import { validateVentureManifest } from "./validation";

function northStarInput() {
  return {
    id: "north-star",
    slug: "north-star",
    name: "North Star",
    foundedAt: "2026-08-18T00:00:00.000Z",
    owner: "Sonny",
    genome: {
      thesis: "North Star sells a weekly operating cadence as a SaaS company.",
      category: "SaaS",
      stage: "Idea",
      goal: "Ship an MVP",
      posture: "human-led" as const,
      risk: "focused" as const,
      motion: "Sell the weekly cadence.",
      cadence: "Weekly",
    },
    officeEnabled: true,
    seatedRoleIds: ["founder" as const],
  };
}

describe("Venture instantiation", () => {
  it("attaches the default definition when founding a company", () => {
    const venture = createVentureFromFounding(northStarInput());
    assert.deepEqual(venture.definition, DEFAULT_VENTURE_DEFINITION_REF);
    const company = foundCompany({
      ...emptyLaunchDraft,
      name: "North Star",
      productId: "ventureos.company",
      categoryId: "saas",
      stageId: "idea",
      goalId: "mvp",
      aiEnabled: false,
      executiveIds: [],
    });
    assert.deepEqual(company.venture.definition, DEFAULT_VENTURE_DEFINITION_REF);
  });

  it("attaches a named definition from the founding draft", () => {
    const company = foundCompany({
      ...emptyLaunchDraft,
      name: "Qualora One",
      categoryId: "saas",
      stageId: "idea",
      goalId: "mvp",
      aiEnabled: false,
      executiveIds: [],
      productId: "qualora",
      definitionId: "qualora",
      definitionVersion: "0.3.0",
    });
    assert.deepEqual(company.venture.definition, { id: "qualora", version: "0.3.0" });
  });

  it("rejects an unknown definition", () => {
    assert.throws(
      () => instantiateVentureDefinition({ id: "not-a-venture", version: "1.0.0" }),
      /Venture definition does not exist/,
    );
  });

  it("rejects a version that does not exist", () => {
    assert.throws(
      () => instantiateVentureDefinition({ id: "qualora", version: "9.9.9" }),
      /version does not exist/,
    );
    assert.throws(
      () => instantiateVentureDefinition({ id: "qualora", version: "not-semver" }),
      /version does not exist/,
    );
  });

  it("rejects instantiation when the capability profile cannot resolve", () => {
    const empty = createCapabilityRegistry([
      createCapabilityManifest({
        id: "platform.only",
        name: "Only",
        classification: "Platform",
        purpose: "Empty registry.",
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
    assert.throws(
      () =>
        instantiateVentureDefinition(
          { id: "qualora", version: "0.3.0" },
          platformVentureRegistry,
          empty,
        ),
      /missing capability/,
    );
  });

  it("rejects a definition with an invalid runtime profile", () => {
    const definition = platformVentureRegistry.resolve("qualora");
    assert.throws(
      () =>
        validateVentureManifest(
          {
            ...definition,
            runtimeProfile: {
              orchestrator: "intelligence.policy-engine",
              requiredCapabilities: definition.runtimeProfile.requiredCapabilities,
            },
          },
          platformCapabilityRegistry,
        ),
      /invalid runtime profile/,
    );
  });

  it("rejects a definition with an invalid governance profile", () => {
    const definition = platformVentureRegistry.resolve("qualora");
    assert.throws(
      () =>
        validateVentureManifest(
          {
            ...definition,
            governanceProfile: {
              ...definition.governanceProfile,
              policyCapabilityId: "intelligence.operating-health",
            },
          },
          platformCapabilityRegistry,
        ),
      /invalid governance profile/,
    );
  });
});
