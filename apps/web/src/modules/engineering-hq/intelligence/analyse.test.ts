import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { loadEngineeringCatalogue } from "../records/catalogue";
import { analyseEngineering } from "./analyse";
import { analyseMonthlyProcess, analyseProcess } from "./process";
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

  it("projects ECE-001 as a process baseline without inventing a trend", () => {
    const intelligence = analyseEngineering(loadEngineeringCatalogue(), project);
    assert.equal(intelligence.process.sampleSize, 1);
    assert.equal(intelligence.process.posture, "baseline");
    assert.equal(intelligence.process.leadTime.trend, "unknown");
    assert.match(intelligence.process.leadTime.label, /Unknown/);
    assert.match(intelligence.process.certificationFirstPass.label, /Unknown/);
    assert.doesNotMatch(intelligence.process.certificationFirstPass.label, /%/);
    assert.equal(intelligence.process.certificationFirstPass.known, 0);
    assert.equal(intelligence.process.firstCorrectionHeld.held, 1);
    assert.equal(intelligence.process.firstCorrectionHeld.known, 1);
    assert.match(intelligence.process.firstCorrectionHeld.label, /rate withheld/);
    assert.equal(intelligence.process.cleanExit.held, 1);
    assert.equal(intelligence.process.correctionAttempts.total, null);
    assert.equal(intelligence.process.failedCorrections.total, null);
    assert.match(intelligence.process.correctionAttempts.label, /Unknown/);
    assert.match(intelligence.process.failedCorrections.label, /Unknown/);
    assert.ok(intelligence.process.failureClasses.includes("filetest-lifecycle"));
    assert.ok(intelligence.process.linkedImprovements.some((item) => item.id === "ERD-008"));
    assert.ok(intelligence.process.linkedImprovements.some((item) => item.id === "LL-008"));
    const baseline = intelligence.recommendations.find((item) => item.id === "process-baseline");
    assert.ok(baseline);
    assert.match(baseline?.why ?? "", /n<5/);
    assert.match(baseline?.source ?? "", /ECE-001/);
    assert.equal(intelligence.process.nextRecommendation?.id, "process-baseline");
  });

  it("withholds monthly rates when a window has fewer than five cycles", () => {
    const monthly = analyseMonthlyProcess(
      [
        {
          id: "ECE-010",
          title: "Prior",
          scope: "foundation",
          ownershipClass: "B",
          workItem: "Prior",
          checkpointSha: null,
          erdRef: null,
          llRef: null,
          openedAt: "2026-08-01",
          closedAt: "2026-08-02",
          closedAs: "certified",
          diagnosticCycles: null,
          correctionAttempts: 1,
          failedCorrections: 0,
          targetedTestRuns: null,
          relatedDomainTestRuns: null,
          fullSuiteRuns: 1,
          certificationFailures: 0,
          regressionsFound: null,
          manualFounderInterventions: 0,
          manualTerminalInterventions: 0,
          tests: 10,
          pass: 10,
          fail: 0,
          cancelled: 0,
          skipped: 0,
          exitCode: 0,
          cleanProcessExit: "YES",
          failureClass: null,
          firstCorrectionHeld: "YES",
          notes: "",
        },
      ],
      new Date("2026-09-04T00:00:00.000Z"),
    );
    assert.equal(monthly.current.sampleSize, 0);
    assert.equal(monthly.previous.sampleSize, 1);
    assert.equal(monthly.current.posture, "unknown");
    assert.equal(monthly.previous.posture, "baseline");
    assert.match(monthly.previous.certificationFirstPass.label, /rate withheld/);
    const july = analyseProcess(
      [
        {
          id: "ECE-010",
          title: "Prior",
          scope: "foundation",
          ownershipClass: "B",
          workItem: "Prior",
          checkpointSha: null,
          erdRef: null,
          llRef: null,
          openedAt: "2026-07-01",
          closedAt: "2026-07-02",
          closedAs: "certified",
          diagnosticCycles: null,
          correctionAttempts: 1,
          failedCorrections: 0,
          targetedTestRuns: null,
          relatedDomainTestRuns: null,
          fullSuiteRuns: 1,
          certificationFailures: 0,
          regressionsFound: null,
          manualFounderInterventions: 0,
          manualTerminalInterventions: 0,
          tests: 10,
          pass: 10,
          fail: 0,
          cancelled: 0,
          skipped: 0,
          exitCode: 0,
          cleanProcessExit: "YES",
          failureClass: null,
          firstCorrectionHeld: "YES",
          notes: "",
        },
      ],
      { nextRecommendation: null, windowLabel: "2026-07" },
    );
    assert.equal(july.posture, "baseline");
    assert.match(july.certificationFirstPass.label, /rate withheld/);
    assert.equal(july.leadTime.trend, "unknown");
  });
});
