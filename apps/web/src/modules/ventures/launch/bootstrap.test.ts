import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CAPABILITY_CONTRACTS } from "../../../core/capability/contracts";
import { platformCapabilityRegistry } from "../../../core/capability/catalog";
import { createCapabilityManifest } from "../../../core/capability/model";
import { createCapabilityRegistry } from "../../../core/capability/registry";
import {
  createCompanyFounded,
  runExecutiveIntelligenceRuntime,
} from "../../../core/runtime";
import { createEmptyIntelligenceCore, projectExecutiveFloor, projectSituationRoom } from "../../../core/venture/model";
import { platformVentureCatalog, platformVentureRegistry } from "../../../core/venture-definition/catalog";
import { createVentureDefinitionRegistry } from "../../../core/venture-definition/registry";
import { mayConsumeBriefing, ventureHasFeature } from "../../../core/venture-definition/enforcement";
import { foundCompany } from "./artefacts";
import {
  bootstrapProduct,
  listLaunchProducts,
  resolveLaunchProduct,
  type LaunchProductId,
} from "./products";
import { emptyLaunchDraft } from "./types";

const NOW = "2026-08-18T12:00:00.000Z";

function draft(productId: LaunchProductId, name: string) {
  return {
    ...emptyLaunchDraft,
    productId,
    name,
    categoryId: "saas" as const,
    stageId: "idea" as const,
    goalId: "mvp" as const,
    aiEnabled: true,
    executiveIds: ["product" as const],
  };
}

function emptyCore() {
  return createEmptyIntelligenceCore({
    id: "founder",
    name: "Sonny",
    title: "Founder",
    posture: "Founding.",
    worldLine: "The first constraint is founding.",
  });
}

function bootstrap(productId: LaunchProductId, name: string) {
  const company = foundCompany(draft(productId, name));
  const snapshot = runExecutiveIntelligenceRuntime(
    emptyCore(),
    createCompanyFounded({
      occurredAt: NOW,
      venture: {
        ...company.venture,
        identity: { ...company.venture.identity, foundedAt: NOW },
      },
    }),
  );
  return { company, snapshot };
}

describe("Product bootstrap", () => {
  it("lists founder-facing products from the Definition Registry", () => {
    const products = listLaunchProducts();
    assert.deepEqual(
      products.map((item) => item.id),
      ["ventureos.company", "qualora", "calviora", "farmora", "frigora"],
    );
    assert.equal(products[0]?.label, "VentureOS Company");
    assert.doesNotMatch(products.map((item) => item.description).join(" "), /capability profile|runtime profile/i);
  });

  it("bootstraps a VentureOS company", () => {
    const { company, snapshot } = bootstrap("ventureos.company", "North Star");
    const venture = snapshot.core.ventures[0];
    assert.ok(venture);
    assert.deepEqual(company.venture.definition, { id: "ventureos.company", version: "1.0.0" });
    assert.equal(company.draft.definitionId, "ventureos.company");
    assert.equal(company.draft.definitionVersion, "1.0.0");
    assert.equal(ventureHasFeature(venture, "executive-office"), true);
    assert.equal(mayConsumeBriefing(venture), true);
    assert.ok(projectSituationRoom(snapshot.core).briefing.implications.length > 0);
    assert.ok(projectExecutiveFloor(snapshot.core).executives.length > 0);
  });

  it("bootstraps Qualora", () => {
    const { company, snapshot } = bootstrap("qualora", "Qualora One");
    const venture = snapshot.core.ventures[0];
    assert.ok(venture);
    assert.deepEqual(company.venture.definition, { id: "qualora", version: "0.3.0" });
    assert.equal(mayConsumeBriefing(venture), true);
    assert.ok(projectSituationRoom(snapshot.core).briefing.implications.length > 0);
    assert.ok(projectExecutiveFloor(snapshot.core).executives.length > 0);
  });

  it("bootstraps Calviora", () => {
    const { snapshot } = bootstrap("calviora", "Calviora Herd");
    const venture = snapshot.core.ventures[0];
    assert.ok(venture);
    assert.deepEqual(venture.definition, { id: "calviora", version: "0.1.0" });
    assert.equal(mayConsumeBriefing(venture), false);
    assert.equal(projectSituationRoom(snapshot.core).briefing.implications.length, 0);
    assert.ok(projectExecutiveFloor(snapshot.core).executives.length > 0);
  });

  it("bootstraps Farmora", () => {
    const { snapshot } = bootstrap("farmora", "Farmora Fields");
    const venture = snapshot.core.ventures[0];
    assert.ok(venture);
    assert.deepEqual(venture.definition, { id: "farmora", version: "0.1.0" });
    assert.equal(ventureHasFeature(venture, "executive-office"), false);
    assert.ok(projectSituationRoom(snapshot.core).briefing.implications.length > 0);
    assert.equal(projectExecutiveFloor(snapshot.core).executives.length, 0);
  });

  it("bootstraps Frigora", () => {
    const { company, snapshot } = bootstrap("frigora", "Frigora One");
    const venture = snapshot.core.ventures[0];
    assert.ok(venture);
    assert.deepEqual(company.venture.definition, { id: "frigora", version: "0.2.0" });
    assert.equal(company.draft.definitionId, "frigora");
    assert.equal(company.draft.definitionVersion, "0.2.0");
    assert.equal(mayConsumeBriefing(venture), true);
    assert.equal(ventureHasFeature(venture, "executive-office"), true);
    assert.ok(projectSituationRoom(snapshot.core).briefing.implications.length > 0);
    assert.ok(projectExecutiveFloor(snapshot.core).executives.length > 0);
  });

  it("fails on an unknown product", () => {
    assert.throws(() => resolveLaunchProduct("widgets"), /Unknown product/);
    assert.throws(() => foundCompany(draft("widgets" as LaunchProductId, "Ghost")), /Unknown product/);
  });

  it("fails on an unknown definition", () => {
    const registry = createVentureDefinitionRegistry(
      platformVentureCatalog.filter((item) => item.id !== "farmora"),
      platformCapabilityRegistry,
    );
    assert.throws(() => resolveLaunchProduct("farmora", registry), /Unknown definition/);
  });

  it("fails when the capability profile cannot resolve", () => {
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
      () => bootstrapProduct("qualora", platformVentureRegistry, empty),
      /missing capability/,
    );
  });
});
