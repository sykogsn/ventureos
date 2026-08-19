import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createEmptyIntelligenceCore, createVentureFromFounding } from "../venture/model";
import {
  createCompanyFounded,
  createFounderDecisionRecorded,
  createIntelligenceRefresh,
  runExecutiveIntelligenceRuntime,
  RUNTIME_PIPELINE,
} from "./index";

const NOW = "2026-08-17T12:00:00.000Z";

function emptyCore() {
  return createEmptyIntelligenceCore({
    id: "founder",
    name: "Sonny",
    title: "Founder",
    posture: "Founding.",
    worldLine: "The first constraint is founding.",
  });
}

function northStar() {
  return createVentureFromFounding({
    id: "north-star",
    slug: "north-star",
    name: "North Star",
    foundedAt: NOW,
    owner: "Sonny",
    genome: {
      thesis: "North Star sells a weekly operating cadence as a SaaS company.",
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

describe("Executive Intelligence Runtime", () => {
  it("documents the implemented call graph in RUNTIME_PIPELINE", () => {
    assert.deepEqual(RUNTIME_PIPELINE, [
      "resolve-capabilities",
      "enforce-instance-profiles",
      "apply-event",
      "policy-evaluation",
      "recommendation-engine",
      "operating-health",
      "knowledge-graph",
    ]);
  });

  it("applies CompanyFounded through the full pipeline", () => {
    const first = runExecutiveIntelligenceRuntime(
      emptyCore(),
      createCompanyFounded({ occurredAt: NOW, venture: northStar() }),
    );

    assert.equal(first.event.type, "CompanyFounded");
    assert.equal(first.core.ventures.length, 1);
    const venture = first.core.ventures[0];
    assert.ok(venture);
    assert.equal(venture.identity.id, "north-star");
    assert.ok(
      venture.memory.records.some((item) => item.id === "mem-founded-north-star"),
    );
    assert.ok(venture.knowledge.nodes.some((node) => node.id === "north-star"));
    assert.ok(
      venture.knowledge.edges.some((edge) => edge.kind === "owns" && edge.toId === "north-star"),
    );
    assert.ok(Array.isArray(first.findings));
    assert.ok(first.findings.length > 0);
    assert.ok(first.core.recommendations.items.length > 0);
    assert.equal(venture.health.band, "watch");
    assert.ok(first.core.policy.findings.length > 0);
  });

  it("is idempotent for CompanyFounded", () => {
    const event = createCompanyFounded({ occurredAt: NOW, venture: northStar() });
    const first = runExecutiveIntelligenceRuntime(emptyCore(), event);
    const second = runExecutiveIntelligenceRuntime(first.core, event);

    assert.equal(second.core.ventures.length, 1);
    assert.equal(
      second.core.ventures[0]?.memory.records.filter((item) =>
        item.id.startsWith("mem-founded-"),
      ).length,
      1,
    );
  });

  it("records a founder decision, updates memory, health, and story", () => {
    const founded = runExecutiveIntelligenceRuntime(
      emptyCore(),
      createCompanyFounded({ occurredAt: NOW, venture: northStar() }),
    );
    const rec = founded.core.recommendations.items[0];
    assert.ok(rec);

    const decided = runExecutiveIntelligenceRuntime(
      founded.core,
      createFounderDecisionRecorded({
        occurredAt: NOW,
        decisionId: rec.id,
        ventureId: rec.ventureId,
        ruling: rec.recommendedAction,
      }),
    );

    const venture = decided.core.ventures[0];
    assert.ok(venture);
    assert.ok(venture.decisions.items.some((item) => item.status === "resolved"));
    assert.ok(venture.memory.records.some((item) => item.id === `mem-${rec.id}`));
    assert.equal(venture.health.score, 78);
    assert.match(venture.story.tension, /founder recorded a call/i);
    assert.equal(decided.event.type, "FounderDecisionRecorded");
  });

  it("is idempotent for FounderDecisionRecorded", () => {
    const founded = runExecutiveIntelligenceRuntime(
      emptyCore(),
      createCompanyFounded({ occurredAt: NOW, venture: northStar() }),
    );
    const rec = founded.core.recommendations.items[0];
    assert.ok(rec);
    const event = createFounderDecisionRecorded({
      occurredAt: NOW,
      decisionId: rec.id,
      ventureId: rec.ventureId,
      ruling: rec.recommendedAction,
    });
    const first = runExecutiveIntelligenceRuntime(founded.core, event);
    const second = runExecutiveIntelligenceRuntime(first.core, event);
    const firstVenture = first.core.ventures[0];
    const secondVenture = second.core.ventures[0];
    assert.ok(firstVenture && secondVenture);
    assert.equal(secondVenture.health.score, firstVenture.health.score);
    assert.equal(
      secondVenture.memory.records.filter((item) => item.id === `mem-${rec.id}`).length,
      1,
    );
  });

  it("keeps IntelligenceRefresh deterministic", () => {
    const founded = runExecutiveIntelligenceRuntime(
      emptyCore(),
      createCompanyFounded({ occurredAt: NOW, venture: northStar() }),
    );
    const refresh = createIntelligenceRefresh(NOW);
    const a = runExecutiveIntelligenceRuntime(founded.core, refresh);
    const b = runExecutiveIntelligenceRuntime(founded.core, refresh);
    assert.deepEqual(a.findings, b.findings);
    assert.deepEqual(
      a.core.recommendations.items.map((item) => item.id),
      b.core.recommendations.items.map((item) => item.id),
    );
    assert.equal(a.core.health.score, b.core.health.score);
  });
});
