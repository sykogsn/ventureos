import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { loadEngineeringCatalogue } from "../records/catalogue";
import { analyseEngineering } from "./analyse";
import { filterTimeline } from "./timeline";
import type { ProjectSignals } from "./types";

const project: ProjectSignals = {
  rootTestScript: null,
  engineeringHqModulePresent: true,
};

describe("Engineering Intelligence", () => {
  it("derives health from records without inventing a live green score", () => {
    const intelligence = analyseEngineering(loadEngineeringCatalogue(), project);
    assert.notEqual(intelligence.health.score, null);
    assert.ok((intelligence.health.score ?? 0) <= 100);
    assert.match(intelligence.health.method, /Unknown criteria are excluded/);
    assert.equal(
      intelligence.health.criteria.find((item) => item.id === "certification")?.points,
      1,
    );
    assert.equal(
      intelligence.quality.signals.find((item) => item.id === "build")?.live.tone,
      "unknown",
    );
  });

  it("classifies architecture from certification, debt, decisions, and lessons", () => {
    const intelligence = analyseEngineering(loadEngineeringCatalogue(), project);
    assert.equal(intelligence.architecture.verdict, "Needs Attention");
    assert.ok(
      intelligence.architecture.evidence.some((line) => /CERTIFIED|certified/i.test(line)),
    );
    assert.ok(intelligence.architecture.evidence.some((line) => /medium/i.test(line)));
  });

  it("recommends with a why and does not hardcode a current VS id", () => {
    const intelligence = analyseEngineering(loadEngineeringCatalogue(), project);
    assert.ok(intelligence.recommendations.length > 0);
    for (const item of intelligence.recommendations) {
      assert.ok(item.why.length > 0);
    }
    assert.equal(intelligence.sprints.currentId, "Unknown");
    assert.equal(intelligence.sprints.currentPhase, "Unknown");
    assert.equal(intelligence.sprints.completedCount, 10);
    assert.match(intelligence.sprints.nextPlanned, /Engineering HQ/);
    assert.equal(intelligence.debt.total, 5);
    assert.equal(intelligence.debt.medium, 2);
    assert.equal(intelligence.debt.low, 3);
    assert.equal(intelligence.debt.high, 0);
    assert.match(intelligence.debt.trend, /Unknown/);
    assert.equal(intelligence.foundation.version, "v1.1");
    assert.ok(intelligence.foundation.outstanding.length >= 5);
  });

  it("builds a searchable timeline from history only", () => {
    const intelligence = analyseEngineering(loadEngineeringCatalogue(), project);
    assert.ok(intelligence.timeline.some((item) => item.id === "VS-007"));
    const filtered = filterTimeline(intelligence.timeline, "certified");
    assert.ok(filtered.some((item) => item.id === "VS-007"));
    assert.ok(!intelligence.timeline.some((item) => item.id === "VS-009"));
  });
});
