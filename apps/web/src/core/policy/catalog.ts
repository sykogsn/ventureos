import { createPolicy } from "./model";
import type { PolicyLibrary } from "./types";

export const executivePolicyCatalog: PolicyLibrary = [
  createPolicy({
    id: "founder.constraint-first",
    title: "The active constraint is the only founder work",
    statement:
      "If a company holds today’s active mission, the founder decides it before any other company receives attention.",
    owner: "founder",
    severity: "critical",
    appliesWhen: "A venture’s mission is marked active.",
    requiredAction: "Make the founder call the mission names. Do not context-switch.",
    alliedRoles: ["founder", "cfo", "coo", "sales"],
    briefing: true,
  }),
  createPolicy({
    id: "founder.launch-non-interference",
    title: "Do not sit in a healthy launch",
    statement:
      "When a company is launch-stage, healthy, and on this week’s calendar, the founder confirms the line and leaves the room.",
    owner: "founder",
    severity: "high",
    appliesWhen: "Healthy operating band, launch stage, attention this week.",
    requiredAction: "Do not join launch ops. Positioning is the remaining risk.",
    alliedRoles: ["founder", "cpo", "cmo", "cto"],
    briefing: true,
  }),
  createPolicy({
    id: "founder.protect-forming-sprint",
    title: "Protect Sprint 1 while health is forming",
    statement:
      "A newly formed company does not yet have a trajectory. Sprint 1 is the policy until evidence exists.",
    owner: "founder",
    severity: "high",
    appliesWhen: "Operating health is labelled Forming.",
    requiredAction: "Run Sprint 1. Do not invent extra work.",
    alliedRoles: ["founder"],
    briefing: false,
  }),
  createPolicy({
    id: "cto.legal-not-engineering",
    title: "Legal ambiguity is not an engineering defect",
    statement:
      "High-severity intake or clause risk is judged by counsel and the founder. The model is not retrained to look busy.",
    owner: "cto",
    severity: "high",
    appliesWhen: "A high-severity risk signal exists and health is in the risk band.",
    requiredAction: "Do not retrain. Surface the ambiguity for review.",
    alliedRoles: ["cto", "counsel", "founder"],
    briefing: true,
  }),
  createPolicy({
    id: "cto.launch-freeze",
    title: "Freeze a launch-ready stack",
    statement:
      "If the company is healthy and launching, production does not change until the public date.",
    owner: "cto",
    severity: "medium",
    appliesWhen: "Healthy launch-stage company with this-week attention.",
    requiredAction: "Hold the freeze. Copy is not an infra ticket.",
    alliedRoles: ["cto", "cpo"],
    briefing: false,
  }),
  createPolicy({
    id: "cto.defer-exploratory-infra",
    title: "Exploratory companies do not take the critical path",
    statement:
      "Thesis-stage work stays in notes. Prototype environments wait until the constraint companies are clear.",
    owner: "cto",
    severity: "low",
    appliesWhen: "Attention is hold and genome risk is exploratory.",
    requiredAction: "Defer environment and prototype work.",
    alliedRoles: ["cto", "cpo", "founder"],
    briefing: false,
  }),
  createPolicy({
    id: "coo.same-day-execution",
    title: "Execute the same afternoon as the founder call",
    statement:
      "An approved commercial test does not wait for a kickoff. Ops runs the day the founder signs.",
    owner: "coo",
    severity: "high",
    appliesWhen: "An upcoming pricing or commercial test decision is open.",
    requiredAction: "Lock the operating window to the founder decision.",
    alliedRoles: ["coo", "founder", "cfo"],
    briefing: false,
  }),
  createPolicy({
    id: "coo.hold-compounding",
    title: "Compounding companies do not consume the founder calendar",
    statement:
      "If a company is healthy and on hold, no mid-week review is scheduled. Ownership stays where it was delegated.",
    owner: "coo",
    severity: "medium",
    appliesWhen: "Attention is hold and operating band is healthy.",
    requiredAction: "Leave the company off the founder desk.",
    alliedRoles: ["founder", "coo", "counsel", "sales"],
    briefing: false,
  }),
  createPolicy({
    id: "cfo.price-before-capital",
    title: "Price is learned before capital is reopened",
    statement:
      "An open commercial test is approved inside the agreed loss band. If memory closed the raise, the raise stays closed.",
    owner: "cfo",
    severity: "critical",
    appliesWhen: "An upcoming pricing or test decision is open.",
    requiredAction: "Approve or park the test. Do not reopen a raise.",
    alliedRoles: ["cfo", "founder", "sales"],
    briefing: false,
  }),
  createPolicy({
    id: "cfo.no-sale-without-price",
    title: "Do not sell around an unmade price",
    statement:
      "Outbound on the old offer pollutes the experiment. The book stays dark until the test is live.",
    owner: "cfo",
    severity: "high",
    appliesWhen: "An upcoming pricing or test decision is open.",
    requiredAction: "Pause outbound until the founder call exists.",
    alliedRoles: ["sales", "cfo", "founder"],
    briefing: false,
  }),
  createPolicy({
    id: "cmo.lock-the-line",
    title: "The market repeats a sentence, not a manifesto",
    statement:
      "A healthy launch ships one line. Product and marketing lock it without turning launch day into copy.",
    owner: "cmo",
    severity: "high",
    appliesWhen: "Healthy launch-stage company with this-week attention.",
    requiredAction: "Lock the short line. Kill the long manifesto.",
    alliedRoles: ["cmo", "cpo", "founder"],
    briefing: false,
  }),
  createPolicy({
    id: "counsel.ambiguity-in-slices",
    title: "Ambiguity is reviewed in slices, not escalated",
    statement:
      "Open legal briefing decisions and high-severity clause risk go to founder review in a bounded window. Outside counsel is delay dressed as care.",
    owner: "counsel",
    severity: "critical",
    appliesWhen: "An upcoming briefing decision is owned by counsel, or health is in the risk band with high-severity risk.",
    requiredAction: "Founder reviews the slice. Do not open a firm.",
    alliedRoles: ["counsel", "founder", "cto"],
    briefing: true,
  }),
];
