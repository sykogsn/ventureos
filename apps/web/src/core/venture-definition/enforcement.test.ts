import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createEmptyIntelligenceCore, createVentureFromFounding, projectExecutiveFloor, projectSituationRoom } from "../venture/model";
import { createCompanyFounded, runExecutiveIntelligenceRuntime } from "../runtime";
import {
  assertCapabilityAllowed,
  assertRuntimeInstanceUsage,
  featureMatrix,
  mayConsumeBriefing,
  renderFeatureMatrix,
  ventureHasFeature,
} from "./enforcement";
import { createVentureManifest } from "./model";
import { createVentureDefinitionRegistry } from "./registry";
import { platformCapabilityRegistry } from "../capability/catalog";
import { platformVentureCatalog } from "./catalog";
import { DEFAULT_VENTURE_DEFINITION_REF } from "./types";
import type { VentureDefinitionRef } from "./types";

const NOW = "2026-08-18T12:00:00.000Z";

function emptyCore() {
  return createEmptyIntelligenceCore({
    id: "founder",
    name: "Sonny",
    title: "Founder",
    posture: "Founding.",
    worldLine: "The first constraint is founding.",
  });
}

function company(definition: VentureDefinitionRef, name: string) {
  return createVentureFromFounding({
    id: name.toLowerCase().replace(/\s+/g, "-"),
    slug: name.toLowerCase().replace(/\s+/g, "-"),
    name,
    foundedAt: NOW,
    owner: "Sonny",
    definition,
    genome: {
      thesis: `${name} thesis.`,
      category: "SaaS",
      stage: "Idea",
      goal: "Ship an MVP",
      posture: "human-led",
      risk: "focused",
      motion: "Sell the weekly cadence.",
      cadence: "Weekly",
    },
    officeEnabled: true,
    seatedRoleIds: ["founder", "cto"],
  });
}

function founded(definition: VentureDefinitionRef, name: string) {
  return runExecutiveIntelligenceRuntime(
    emptyCore(),
    createCompanyFounded({ occurredAt: NOW, venture: company(definition, name) }),
  );
}

describe("Capability and feature enforcement", () => {
  it("rejects capability usage outside the instance profile", () => {
    const venture = company({ id: "calviora", version: "0.1.0" }, "Calviora");
    assert.equal(mayConsumeBriefing(venture), false);
    assert.throws(
      () => assertCapabilityAllowed(venture, "intelligence.briefing"),
      /not allowed to consume capability/,
    );
  });

  it("rejects a founder decision when the feature is not enabled", () => {
    const template = platformVentureCatalog.find((item) => item.id === "ventureos.company");
    assert.ok(template);
    const locked = createVentureManifest({
      ...template,
      id: "locked.company",
      version: "1.0.0",
      supportedFeatures: template.supportedFeatures.filter((item) => item !== "founder-decisions"),
      excludedFeatures: ["founder-decisions"],
    });
    const registry = createVentureDefinitionRegistry(
      [...platformVentureCatalog, locked],
      platformCapabilityRegistry,
    );
    const venture = {
      ...company(DEFAULT_VENTURE_DEFINITION_REF, "Locked Co"),
      definition: { id: "locked.company", version: "1.0.0" as const },
    };
    assert.throws(
      () =>
        assertRuntimeInstanceUsage(
          { ...emptyCore(), ventures: [venture] },
          {
            type: "FounderDecisionRecorded",
            occurredAt: NOW,
            decisionId: "d1",
            ventureId: venture.identity.id,
            ruling: "Proceed.",
          },
          registry,
        ),
      /cannot record a founder decision/,
    );
  });

  it("Runtime rejects an unknown definition ref", () => {
    const venture = {
      ...company(DEFAULT_VENTURE_DEFINITION_REF, "Ghost Co"),
      definition: { id: "missing.venture", version: "0.0.1" },
    };
    assert.throws(
      () =>
        runExecutiveIntelligenceRuntime(
          emptyCore(),
          createCompanyFounded({ occurredAt: NOW, venture }),
        ),
      /unknown definition/,
    );
  });

  it("Runtime still orchestrates a founder decision when the profile allows it", () => {
    const snapshot = founded({ id: "qualora", version: "0.4.0" }, "Qualora One");
    const rec = snapshot.core.recommendations.items[0];
    assert.ok(rec);
    const decided = runExecutiveIntelligenceRuntime(snapshot.core, {
      type: "FounderDecisionRecorded",
      occurredAt: NOW,
      decisionId: rec.id,
      ventureId: rec.ventureId,
      ruling: rec.recommendedAction,
    });
    assert.equal(decided.event.type, "FounderDecisionRecorded");
  });
});

describe("Qualora projections", () => {
  it("keeps briefing, decisions and executive office", () => {
    const snapshot = founded({ id: "qualora", version: "0.4.0" }, "Qualora One");
    const room = projectSituationRoom(snapshot.core);
    const floor = projectExecutiveFloor(snapshot.core);
    const venture = snapshot.core.ventures[0];
    assert.ok(venture);
    assert.equal(ventureHasFeature(venture, "morning-briefing"), true);
    assert.ok(room.briefing.implications.length > 0);
    assert.equal(room.decisions.length, 1);
    assert.ok(floor.executives.length > 0);
  });
});

describe("Calviora projections", () => {
  it("suppresses morning briefing and keeps the office", () => {
    const snapshot = founded({ id: "calviora", version: "0.1.0" }, "Calviora Herd");
    const room = projectSituationRoom(snapshot.core);
    const floor = projectExecutiveFloor(snapshot.core);
    const venture = snapshot.core.ventures[0];
    assert.ok(venture);
    assert.equal(mayConsumeBriefing(venture), false);
    assert.equal(room.briefing.implications.length, 0);
    assert.ok(floor.executives.length > 0);
  });
});

describe("Farmora projections", () => {
  it("keeps briefing and hides the executive office", () => {
    const snapshot = founded({ id: "farmora", version: "0.1.0" }, "Farmora Fields");
    const room = projectSituationRoom(snapshot.core);
    const floor = projectExecutiveFloor(snapshot.core);
    const venture = snapshot.core.ventures[0];
    assert.ok(venture);
    assert.equal(ventureHasFeature(venture, "executive-office"), false);
    assert.ok(room.briefing.implications.length > 0);
    assert.equal(floor.executives.length, 0);
    assert.equal(floor.posture, "Unseated.");
  });
});

describe("Feature matrix", () => {
  it("derives enabled features from venture definitions", () => {
    const rows = featureMatrix();
    const calvioraBriefing = rows.find(
      (row) => row.venture === "calviora" && row.feature === "morning-briefing",
    );
    const farmoraOffice = rows.find(
      (row) => row.venture === "farmora" && row.feature === "executive-office",
    );
    const qualoraBriefing = rows.find(
      (row) => row.venture === "qualora" && row.feature === "morning-briefing",
    );
    assert.equal(calvioraBriefing?.enabled, false);
    assert.equal(calvioraBriefing?.source, "intelligence.briefing");
    assert.equal(farmoraOffice?.enabled, false);
    assert.equal(farmoraOffice?.source, "governance.executive-office");
    assert.equal(qualoraBriefing?.enabled, true);
    assert.match(renderFeatureMatrix(), /calviora/);
  });
});
