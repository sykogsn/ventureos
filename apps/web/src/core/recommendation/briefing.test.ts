import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createEmptyIntelligenceCore, createVentureFromFounding } from "../venture/model";
import {
  createCompanyFounded,
  createFounderDecisionRecorded,
  runExecutiveIntelligenceRuntime,
} from "../runtime";
import { assembleMorningIntelligence } from "./briefing";

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

describe("Executive briefing assembly", () => {
  it("preserves empty-core briefing from founder and health facts", () => {
    const snapshot = runExecutiveIntelligenceRuntime(emptyCore());
    assert.equal(snapshot.core.briefing.headline, emptyCore().briefing.headline);
    assert.equal(snapshot.core.briefing.implications.length, 0);
  });

  it("assembles one coherent briefing with opportunity, risk, and outcome", () => {
    const snapshot = runExecutiveIntelligenceRuntime(
      emptyCore(),
      createCompanyFounded({ occurredAt: NOW, venture: northStar() }),
    );
    const briefing = snapshot.core.briefing;
    const morning = assembleMorningIntelligence(snapshot.core);
    const kinds = briefing.implications.map((item) => item.kind);

    assert.ok(briefing.headline);
    assert.ok(briefing.narrative);
    assert.notEqual(briefing.headline, briefing.narrative);
    assert.deepEqual(kinds, ["opportunity", "risk", "outcome"]);
    assert.match(briefing.implications[0]?.point ?? "", /weekly cadence/i);
    assert.match(briefing.implications[1]?.point ?? "", /Sprint 1|baseline|forming/i);
    assert.match(briefing.implications[2]?.point ?? "", /founded/i);
    assert.equal(briefing.headline, morning.judgement?.recommendedAction ?? morning.action?.recommendedAction);
    assert.match(briefing.narrative, /Sprint 1|Forming|baseline/i);
  });

  it("uses the recorded call as the outcome after FounderDecisionRecorded", () => {
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
    const outcome = decided.core.briefing.implications.find((item) => item.kind === "outcome");
    assert.ok(outcome);
    assert.ok(
      outcome.point.includes(rec.recommendedAction) ||
        outcome.point.includes(rec.expectedImpact) ||
        outcome.point.includes(rec.title),
    );
  });
});
