import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Recommendation } from "@/core/recommendation/types";
import type { SituationRoomModel } from "@/core/venture/views";
import type { VentureId } from "@/core/shared";
import { adaptExecutiveWorkspace } from "./adapt";

function recommendation(
  overrides: Partial<Recommendation> & Pick<Recommendation, "id" | "title">,
): Recommendation {
  return {
    ventureId: "north-star" as VentureId,
    company: "North Star",
    companyHref: "/ventures/hq/north-star",
    summary: "A certified summary.",
    recommendedAction: "Record the call.",
    reason: "The constraint is live.",
    supportingEvidence: [
      {
        id: "ev-1",
        source: "policy",
        label: "Policy finding",
        detail: "The finding as recorded.",
      },
    ],
    confidence: 82,
    confidenceLabel: "High",
    executiveConsensus: { alignment: 90, label: "unanimous", votes: [] },
    ownerExecutive: "founder",
    priority: "high",
    expectedImpact: "Delay compounds.",
    estimatedEffort: "This week",
    actionLabel: "Record the call",
    actionHref: "/dashboard",
    isPrimary: false,
    briefing: true,
    originatingPolicyId: "policy-1",
    originatingPolicyTitle: "Founding policy",
    policyOwner: "founder",
    policySeverity: "high",
    findingId: "find-1",
    finding: "The recorded finding.",
    ...overrides,
  };
}

function room(overrides: Partial<SituationRoomModel> = {}): SituationRoomModel {
  return {
    header: {
      founderName: "Sonny",
      posture: "Founding.",
      worldLine: "The first constraint is founding.",
    },
    mission: {
      company: "North Star",
      companyHref: "/ventures/hq/north-star",
      title: "Mission",
      ask: "Ask",
      whyNow: "Now",
      ifDeferred: "Deferred",
      timeNeeded: "Soon",
      actionLabel: "Act",
      actionHref: "/dashboard",
    },
    briefing: {
      preparedBy: "Runtime",
      headline: "Record the founding call.",
      narrative: "The desk is live.",
      implications: [{ id: "imp-1", company: "North Star", point: "Cadence is the motion." }],
    },
    health: {
      score: 42,
      band: "watch",
      posture: "Watch",
      verdict: "Watch the constraint.",
      watches: [],
    },
    decisions: [],
    portfolio: [],
    stories: [],
    memory: [],
    ...overrides,
  };
}

describe("adaptExecutiveWorkspace", () => {
  it("leaves primary empty when no founder judgement exists", () => {
    const model = adaptExecutiveWorkspace({ room: room(), recommendations: [] });
    assert.equal(model.primary, null);
    assert.deepEqual(model.attention, []);
    assert.equal(model.brief.headline, "Record the founding call.");
    assert.equal(model.brief.narrative, "The desk is live.");
    assert.deepEqual(model.brief.implications, ["Cadence is the motion."]);
  });

  it("maps decisions[0] as the only primary judgement", () => {
    const rec = recommendation({ id: "call-1", title: "Seat the constraint", isPrimary: true });
    const model = adaptExecutiveWorkspace({
      room: room({
        decisions: [
          {
            id: "call-1",
            question: "Seat the constraint?",
            company: "North Star",
            companyHref: "/ventures/hq/north-star",
            recommendation: "Record the call.",
            costOfInaction: "Delay compounds.",
            decideBy: "This week",
            actionLabel: "Record the call",
            actionHref: "/dashboard",
            originatingPolicyTitle: "Founding policy",
            policySeverity: "critical",
            finding: "The recorded finding.",
            ventureId: "north-star",
            ruling: "Record the call.",
          },
        ],
      }),
      recommendations: [rec],
    });

    assert.equal(model.primary?.id, "call-1");
    assert.equal(model.primary?.issue, "Seat the constraint?");
    assert.equal(model.primary?.significance, "The recorded finding.");
    assert.equal(model.primary?.severity, "critical");
    assert.equal(model.primary?.confidence, "high");
    assert.equal(model.primary?.evidence[0]?.label, "Policy finding");
    assert.equal(model.attention.length, 0);
    assert.equal("detected" in (model.primary ?? {}), false);
    assert.equal("contradiction" in (model.primary ?? {}), false);
    assert.equal("indicators" in (model.primary ?? {}), false);
  });

  it("presents other recommendations as secondary attention, not founder judgements", () => {
    const primary = recommendation({ id: "call-1", title: "Primary call", isPrimary: true });
    const secondary = recommendation({
      id: "rec-2",
      title: "Review the office seating",
      recommendedAction: "Review seating.",
      isPrimary: false,
      confidenceLabel: "Moderate",
      priority: "medium",
    });
    const incomplete = recommendation({
      id: "rec-3",
      title: "",
      recommendedAction: "",
    });

    const model = adaptExecutiveWorkspace({
      room: room({
        decisions: [
          {
            id: "call-1",
            question: "Seat the constraint?",
            company: "North Star",
            companyHref: "/ventures/hq/north-star",
            recommendation: "Record the call.",
            costOfInaction: "Delay compounds.",
            decideBy: "This week",
            actionLabel: "Record the call",
            actionHref: "/dashboard",
          },
        ],
      }),
      recommendations: [primary, secondary, incomplete],
    });

    assert.equal(model.primary?.id, "call-1");
    assert.equal(model.attention.length, 1);
    assert.equal(model.attention[0]?.id, "rec-2");
    assert.equal(model.attention[0]?.issue, "Review the office seating");
    assert.equal(model.attention[0]?.confidence, "moderate");
    assert.equal(model.attention[0]?.severity, "medium");
  });

  it("maps health watches without inventing thresholds or exposure", () => {
    const model = adaptExecutiveWorkspace({
      room: room({
        health: {
          score: 20,
          band: "risk",
          posture: "Risk",
          verdict: "A company needs attention.",
          watches: [
            {
              id: "north-star",
              company: "North Star",
              companyHref: "/ventures/hq/north-star",
              band: "risk",
              judgement: "Health is constrained.",
              ask: "Review the company desk.",
            },
          ],
        },
      }),
      recommendations: [],
    });

    assert.equal(model.watches.length, 1);
    assert.equal(model.watches[0]?.company, "North Star");
    assert.equal(model.watches[0]?.band, "critical");
    assert.equal("threshold" in (model.watches[0] ?? {}), false);
  });
});
