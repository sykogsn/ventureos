import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  createEmptyIntelligenceCore,
  createVentureFromFounding,
  projectSituationRoom,
} from "./model";
import {
  createCompanyFounded,
  runExecutiveIntelligenceRuntime,
} from "../runtime";
import { selectHighestPriorityAction } from "../recommendation/briefing";

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

describe("Situation Room morning projection", () => {
  it("maps empty VIC briefing into Today's Mission", () => {
    const snapshot = runExecutiveIntelligenceRuntime(emptyCore());
    const room = projectSituationRoom(snapshot.core);
    assert.equal(room.mission.title, snapshot.core.briefing.headline);
    assert.equal(room.mission.ask, snapshot.core.briefing.narrative);
    assert.equal(room.decisions.length, 0);
    assert.equal(room.briefing.implications.length, 0);
  });

  it("identifies the highest-priority action and exactly one founder judgement", () => {
    const snapshot = runExecutiveIntelligenceRuntime(
      emptyCore(),
      createCompanyFounded({ occurredAt: NOW, venture: northStar() }),
    );
    const room = projectSituationRoom(snapshot.core);
    const action = selectHighestPriorityAction(snapshot.core.recommendations.items);
    assert.ok(action);
    assert.equal(room.mission.decisionId, action.id);
    assert.equal(room.mission.ask, action.recommendedAction);
    assert.equal(room.decisions.length, 1);
    assert.equal(room.decisions[0]?.ventureId, action.ventureId);
    assert.equal(room.briefing.implications.length, 3);
    assert.equal(room.stories.length, 1);
  });

  it("projects the selected company when desk boot names it", () => {
    const first = runExecutiveIntelligenceRuntime(
      emptyCore(),
      createCompanyFounded({ occurredAt: NOW, venture: northStar() }),
    );
    const secondVenture = createVentureFromFounding({
      id: "south-star",
      slug: "south-star",
      name: "South Star",
      foundedAt: NOW,
      owner: "Sonny",
      genome: {
        thesis: "South Star is the second company on this desk.",
        category: "SaaS",
        stage: "Idea",
        goal: "Ship an MVP",
        posture: "human-led",
        risk: "focused",
        motion: "Operate the second company.",
        cadence: "Weekly",
      },
      officeEnabled: true,
      seatedRoleIds: ["founder"],
    });
    const snapshot = runExecutiveIntelligenceRuntime(
      first.core,
      createCompanyFounded({ occurredAt: NOW, venture: secondVenture }),
    );
    const room = projectSituationRoom(snapshot.core, {
      activeVentureId: "south-star",
    });
    assert.equal(room.mission.company, "South Star");
  });
});
