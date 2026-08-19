import type { ExecutiveRoleId } from "../executive-office";
import type { Decision, DecisionEngine } from "./types";

export function createDecisionEngine(items: Decision[]): DecisionEngine {
  return { items };
}

export function resolveDecision(
  decision: Decision,
  input: { ruling: string; result?: string; resolvedOn: string },
): Decision {
  return {
    ...decision,
    status: "resolved",
    ruling: input.ruling,
    result: input.result ?? decision.costOfInaction,
    resolvedOn: input.resolvedOn,
  };
}

export function upcomingDecisions(engine: DecisionEngine) {
  return engine.items.filter((item) => item.status === "upcoming");
}

export function resolvedDecisions(engine: DecisionEngine) {
  return engine.items.filter((item) => item.status === "resolved");
}

export function briefingDecisions(engine: DecisionEngine) {
  return engine.items.filter((item) => item.briefing && item.status === "upcoming");
}

export function decisionsForRole(
  engine: DecisionEngine,
  roleId: ExecutiveRoleId,
) {
  return engine.items.filter((item) => item.ownerRoleId === roleId);
}
