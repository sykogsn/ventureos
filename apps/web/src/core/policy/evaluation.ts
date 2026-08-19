import type { ExecutiveRoleId } from "../executive-office";
import type { Venture, VentureIntelligenceCore } from "../venture/types";
import { executivePolicyCatalog } from "./catalog";
import {
  actionableFindings,
  createPolicyEngine,
  emptyPolicyEngine,
} from "./model";
import type {
  ExecutivePolicy,
  PolicyEvidence,
  PolicyFinding,
  PolicyLibrary,
} from "./types";

function evidence(
  id: string,
  source: PolicyEvidence["source"],
  label: string,
  detail: string,
): PolicyEvidence {
  return { id, source, label, detail };
}

function collectEvidence(
  core: VentureIntelligenceCore,
  venture: Venture,
  actingRole: ExecutiveRoleId,
): PolicyEvidence[] {
  const desk = core.office.desks.find((item) => item.seat.id === actingRole);
  const items: PolicyEvidence[] = [
    evidence(
      `${venture.identity.id}-health`,
      "health",
      `Operating health ${venture.health.score}`,
      `${venture.health.judgement} Ask: ${venture.health.ask}`,
    ),
    evidence(
      `${venture.identity.id}-mission`,
      "mission",
      venture.mission.today.title,
      `${venture.mission.today.founderAsk} Attention: ${venture.mission.today.attention}.`,
    ),
    evidence(
      `${venture.identity.id}-policy`,
      "policy",
      "Policy in force",
      "This finding is produced by the Executive Policy Engine.",
    ),
  ];

  for (const signal of venture.risk.signals) {
    items.push(
      evidence(
        `${venture.identity.id}-risk-${signal.id}`,
        "risk",
        signal.title,
        `${signal.summary} Mitigation: ${signal.mitigation}`,
      ),
    );
  }

  for (const decision of venture.decisions.items.filter(
    (item) => item.status === "upcoming",
  )) {
    items.push(
      evidence(
        `${venture.identity.id}-decision-${decision.id}`,
        "decision",
        decision.title,
        decision.question,
      ),
    );
  }

  for (const record of core.memory.records.filter(
    (item) => item.ventureId === venture.identity.id,
  )) {
    items.push(
      evidence(record.id, "memory", record.title, `${record.note} ${record.implication}`),
    );
  }

  if (venture.story.featured) {
    items.push(
      evidence(
        `${venture.identity.id}-story`,
        "story",
        venture.story.chapter,
        venture.story.tension,
      ),
    );
  }

  if (desk) {
    items.push(
      evidence(
        `${actingRole}-desk`,
        "office",
        `${desk.seat.role} · ${desk.seat.statusLabel}`,
        desk.brief.focus,
      ),
    );
  }

  return items;
}

function isLaunchThisWeek(venture: Venture) {
  return (
    venture.health.band === "healthy" &&
    venture.mission.today.attention === "this-week" &&
    /launch/i.test(venture.identity.stage)
  );
}

function hasOpenPriceTest(venture: Venture) {
  return venture.decisions.items.some(
    (item) => item.status === "upcoming" && /price|pricing|test/i.test(item.title),
  );
}

function finding(
  policy: ExecutivePolicy,
  venture: Venture,
  core: VentureIntelligenceCore,
  input: Pick<
    PolicyFinding,
    | "id"
    | "status"
    | "finding"
    | "reason"
    | "requiredAction"
    | "title"
    | "actingRole"
    | "expectedImpact"
    | "estimatedEffort"
    | "actionLabel"
    | "actionHref"
    | "briefing"
  > & {
    alliedRoles?: ExecutiveRoleId[];
  },
): PolicyFinding {
  return {
    policyId: policy.id,
    policyTitle: policy.title,
    policyOwner: policy.owner,
    severity: policy.severity,
    ventureId: venture.identity.id,
    company: venture.identity.name,
    companyHref: venture.identity.href,
    alliedRoles: input.alliedRoles ?? policy.alliedRoles,
    evidence: collectEvidence(core, venture, input.actingRole),
    id: input.id,
    status: input.status,
    finding: input.finding,
    reason: input.reason,
    requiredAction: input.requiredAction,
    title: input.title,
    actingRole: input.actingRole,
    expectedImpact: input.expectedImpact,
    estimatedEffort: input.estimatedEffort,
    actionLabel: input.actionLabel,
    actionHref: input.actionHref,
    briefing: input.briefing,
  };
}

type Evaluator = (
  core: VentureIntelligenceCore,
  policy: ExecutivePolicy,
) => PolicyFinding[];

const evaluators: Record<string, Evaluator> = {
  "founder.constraint-first": (core, policy) =>
    core.ventures
      .filter((venture) => venture.mission.today.active)
      .map((venture) =>
        finding(policy, venture, core, {
          id: `find-${policy.id}-${venture.identity.id}`,
          status: "breach",
          actingRole: "founder",
          briefing: true,
          title: venture.mission.today.title,
          finding: `${venture.identity.name} holds the active mission. ${venture.health.judgement}`,
          reason: [
            venture.mission.today.whyNow,
            ...core.memory.records
              .filter(
                (record) =>
                  record.ventureId === venture.identity.id && record.briefing,
              )
              .map((record) => record.implication),
          ].join(" "),
          requiredAction: venture.mission.today.ask,
          expectedImpact: venture.mission.today.ifDeferred,
          estimatedEffort: venture.mission.today.timeNeeded,
          actionLabel: venture.mission.today.actionLabel,
          actionHref: venture.mission.today.actionHref,
        }),
      ),

  "founder.launch-non-interference": (core, policy) =>
    core.ventures.filter(isLaunchThisWeek).map((venture) =>
      finding(policy, venture, core, {
        id: `find-${policy.id}-${venture.identity.id}-founder`,
        status: "watch",
        actingRole: "founder",
        briefing: true,
        title: `Do not sit in ${venture.identity.name} ops`,
        finding: venture.health.judgement,
        reason: `${venture.story.tension} ${venture.risk.headline}`,
        requiredAction: venture.mission.today.founderAsk,
        expectedImpact: venture.mission.today.ifDeferred,
        estimatedEffort: venture.mission.today.timeNeeded,
        actionLabel: venture.mission.today.actionLabel,
        actionHref: venture.mission.today.actionHref,
      }),
    ),

  "founder.protect-forming-sprint": (core, policy) =>
    core.ventures
      .filter((venture) => venture.health.label === "Forming")
      .map((venture) =>
        finding(policy, venture, core, {
          id: `find-${policy.id}-${venture.identity.id}`,
          status: "watch",
          actingRole: "founder",
          briefing: false,
          title: `Protect ${venture.mission.sprint.name}`,
          finding: venture.health.summary,
          reason: `${venture.genome.cadence} ${venture.risk.headline}`,
          requiredAction: venture.health.ask,
          expectedImpact: venture.mission.today.ifDeferred,
          estimatedEffort: venture.mission.today.timeNeeded,
          actionLabel: venture.mission.today.actionLabel,
          actionHref: venture.mission.today.actionHref,
        }),
      ),

  "cto.legal-not-engineering": (core, policy) =>
    core.ventures.flatMap((venture) =>
      venture.risk.signals
        .filter(
          (signal) =>
            signal.severity === "high" && venture.health.band === "risk",
        )
        .map((signal) => {
          const open = venture.decisions.items.find(
            (item) => item.status === "upcoming" && item.ownerRoleId === "counsel",
          );
          return finding(policy, venture, core, {
            id: `find-${policy.id}-${venture.identity.id}-${signal.id}`,
            status: "breach",
            actingRole: "cto",
            briefing: false,
            title: `Do not retrain ${venture.identity.name} to clear ${signal.title}`,
            finding: signal.summary,
            reason: `${venture.risk.headline} Legal ambiguity is not a model defect.`,
            requiredAction: "Do not retrain the intake agent. Hold the fence.",
            expectedImpact:
              open?.costOfInaction ?? venture.mission.today.ifDeferred,
            estimatedEffort: open?.decideBy ?? venture.mission.today.timeNeeded,
            actionLabel: "Hold the model",
            actionHref: "/agents/cto",
          });
        }),
    ),

  "cto.launch-freeze": (core, policy) =>
    core.ventures.filter(isLaunchThisWeek).map((venture) =>
      finding(policy, venture, core, {
        id: `find-${policy.id}-${venture.identity.id}`,
        status: "watch",
        actingRole: "cto",
        briefing: false,
        title: `Keep ${venture.identity.name} frozen`,
        finding: venture.health.summary,
        reason: venture.risk.headline,
        requiredAction: "Keep the launch stack frozen until the public date.",
        expectedImpact: "A late infra change creates a launch you cannot explain.",
        estimatedEffort: "Until Wednesday",
        actionLabel: "Hold the freeze",
        actionHref: "/agents/cto",
      }),
    ),

  "cto.defer-exploratory-infra": (core, policy) =>
    core.ventures
      .filter(
        (venture) =>
          venture.mission.today.attention === "hold" &&
          venture.genome.risk === "exploratory",
      )
      .flatMap((venture) => [
        finding(policy, venture, core, {
          id: `find-${policy.id}-${venture.identity.id}-cto`,
          status: "watch",
          actingRole: "cto",
          briefing: false,
          title: `Defer ${venture.identity.name} environment work`,
          finding: venture.risk.headline,
          reason: "It is not on the critical path of the companies that need this week.",
          requiredAction: `Defer prototype work for ${venture.identity.name}.`,
          expectedImpact: "It will steal attention from the launch constraint.",
          estimatedEffort: "None",
          actionLabel: "Hold environment work",
          actionHref: "/agents/cto",
        }),
        finding(policy, venture, core, {
          id: `find-${policy.id}-${venture.identity.id}-cpo`,
          status: "watch",
          actingRole: "cpo",
          briefing: false,
          title: `Keep ${venture.identity.name} in notes`,
          finding: venture.health.judgement,
          reason: `${venture.story.tension} ${venture.risk.headline}`,
          requiredAction: venture.mission.today.founderAsk,
          expectedImpact: venture.mission.today.ifDeferred,
          estimatedEffort: "None",
          actionLabel: venture.mission.today.actionLabel,
          actionHref: venture.identity.href,
        }),
      ]),

  "coo.same-day-execution": (core, policy) =>
    core.ventures.filter(hasOpenPriceTest).map((venture) =>
      finding(policy, venture, core, {
        id: `find-${policy.id}-${venture.identity.id}`,
        status: "watch",
        actingRole: "coo",
        briefing: false,
        title: `Run ${venture.identity.name} ops the same afternoon as the call`,
        finding:
          core.office.desks.find((desk) => desk.seat.id === "coo")?.brief.headline ??
          "The week is runnable.",
        reason: "Waiting for a kickoff recreates the delay the test is meant to kill.",
        requiredAction: `Run ${venture.identity.name} ops the same afternoon as the founder call.`,
        expectedImpact: venture.mission.today.ifDeferred,
        estimatedEffort: venture.mission.today.timeNeeded,
        actionLabel: "Lock today’s windows",
        actionHref: "/agents/coo",
      }),
    ),

  "coo.hold-compounding": (core, policy) =>
    core.ventures
      .filter(
        (venture) =>
          venture.mission.today.attention === "hold" &&
          venture.health.band === "healthy",
      )
      .map((venture) =>
        finding(policy, venture, core, {
          id: `find-${policy.id}-${venture.identity.id}`,
          status: "watch",
          actingRole: "coo",
          briefing: false,
          title: `Leave ${venture.identity.name} off the desk`,
          finding: venture.health.judgement,
          reason: venture.mission.today.whyNow,
          requiredAction: venture.mission.today.founderAsk,
          expectedImpact: venture.mission.today.ifDeferred,
          estimatedEffort: "None",
          actionLabel: venture.mission.today.actionLabel,
          actionHref: venture.mission.today.actionHref,
        }),
      ),

  "cfo.price-before-capital": (core, policy) =>
    core.ventures.filter(hasOpenPriceTest).map((venture) => {
      const raiseClosed = core.memory.records.some(
        (record) =>
          record.ventureId === venture.identity.id && /raise/i.test(record.title),
      );
      return finding(policy, venture, core, {
        id: `find-${policy.id}-${venture.identity.id}`,
        status: "breach",
        actingRole: "cfo",
        briefing: false,
        title: `Cap the ${venture.identity.name} test inside the agreed band`,
        finding: venture.health.summary,
        reason: raiseClosed
          ? "Memory says capital is not the constraint. Delay spends calendar, not risk."
          : "The open commercial decision is the learning engine.",
        requiredAction: raiseClosed
          ? `Approve the ${venture.identity.name} test. Keep the raise closed.`
          : `Approve the ${venture.identity.name} commercial test.`,
        expectedImpact: venture.mission.today.ifDeferred,
        estimatedEffort: venture.mission.today.timeNeeded,
        actionLabel: "Read the cash band",
        actionHref: "/agents/cfo",
      });
    }),

  "cfo.no-sale-without-price": (core, policy) =>
    core.ventures.filter(hasOpenPriceTest).map((venture) => {
      const salesPaused = [...core.decisions.items, ...venture.decisions.items].some(
        (item) =>
          item.ventureId === venture.identity.id &&
          item.ownerRoleId === "sales" &&
          item.status === "resolved" &&
          /pause|paused|outbound/i.test(`${item.title} ${item.ruling}`),
      );
      return finding(policy, venture, core, {
        id: `find-${policy.id}-${venture.identity.id}`,
        status: "watch",
        actingRole: "sales",
        briefing: false,
        title: salesPaused
          ? `Keep ${venture.identity.name} outbound dark until price is live`
          : `Do not sell around an unmade price`,
        finding: venture.mission.today.founderAsk,
        reason: "Selling the old offer pollutes the only experiment that matters.",
        requiredAction: `Pause ${venture.identity.name} outbound until the test is approved.`,
        expectedImpact: "A dirty book cannot be unread.",
        estimatedEffort: "Until the test is live",
        actionLabel: "Hold the book",
        actionHref: "/agents/sales",
      });
    }),

  "cmo.lock-the-line": (core, policy) =>
    core.ventures.filter(isLaunchThisWeek).flatMap((venture) => {
      const cpo = venture.decisions.items.find(
        (item) => item.ownerRoleId === "cpo" && item.status === "upcoming",
      );
      const cmo = venture.decisions.items.find(
        (item) => item.ownerRoleId === "cmo" && item.status === "upcoming",
      );
      return [
        finding(policy, venture, core, {
          id: `find-${policy.id}-${venture.identity.id}-cmo`,
          status: "watch",
          actingRole: "cmo",
          briefing: false,
          title: cmo?.question ?? `Ship the short line for ${venture.identity.name}`,
          finding: venture.story.chapter,
          reason: venture.story.excerpt,
          requiredAction:
            cmo?.recommendation ?? "Ship the short line. Kill the manifesto.",
          expectedImpact: cmo?.costOfInaction ?? venture.mission.today.ifDeferred,
          estimatedEffort: cmo?.decideBy ?? "Tomorrow morning",
          actionLabel: cmo?.actionLabel ?? "Choose the line",
          actionHref: cmo?.actionHref ?? "/agents/cmo",
        }),
        finding(policy, venture, core, {
          id: `find-${policy.id}-${venture.identity.id}-cpo`,
          status: "watch",
          actingRole: "cpo",
          briefing: false,
          title: cpo?.title ?? `Lock ${venture.identity.name} positioning`,
          finding: venture.story.excerpt,
          reason: venture.story.tension,
          requiredAction: cpo?.recommendation ?? venture.mission.today.ask,
          expectedImpact: cpo?.costOfInaction ?? venture.mission.today.ifDeferred,
          estimatedEffort: cpo?.decideBy ?? venture.mission.today.timeNeeded,
          actionLabel: cpo?.actionLabel ?? "Lock positioning",
          actionHref: cpo?.actionHref ?? "/agents/cpo",
        }),
      ];
    }),

  "counsel.ambiguity-in-slices": (core, policy) => {
    const findings: PolicyFinding[] = [];

    for (const venture of core.ventures) {
      if (venture.mission.today.active) {
        continue;
      }

      const openBriefings = [
        ...core.decisions.items,
        ...venture.decisions.items,
      ].filter(
        (item) =>
          item.ventureId === venture.identity.id &&
          item.status === "upcoming" &&
          item.briefing &&
          item.ownerRoleId === "counsel",
      );

      for (const decision of openBriefings) {
        findings.push(
          finding(policy, venture, core, {
            id: `find-${policy.id}-${decision.id}`,
            status: venture.health.band === "risk" ? "breach" : "watch",
            actingRole: "counsel",
            briefing: true,
            title: decision.question,
            finding: venture.health.ask,
            reason: `${venture.health.judgement} ${decision.costOfInaction}`,
            requiredAction: decision.recommendation,
            expectedImpact: decision.costOfInaction,
            estimatedEffort: decision.decideBy,
            actionLabel: decision.actionLabel,
            actionHref: decision.actionHref,
          }),
        );
      }

      if (openBriefings.length > 0) {
        continue;
      }

      for (const signal of venture.risk.signals.filter(
        (item) => item.severity === "high" && venture.health.band === "risk",
      )) {
        const open = venture.decisions.items.find(
          (item) => item.status === "upcoming" && item.ownerRoleId === "counsel",
        );
        findings.push(
          finding(policy, venture, core, {
            id: `find-${policy.id}-${venture.identity.id}-${signal.id}`,
            status: "breach",
            actingRole: "counsel",
            briefing: venture.health.briefWatch,
            title: signal.title,
            finding: signal.summary,
            reason: `${venture.risk.headline} ${open?.costOfInaction ?? venture.health.ask}`,
            requiredAction: signal.mitigation,
            expectedImpact: open?.costOfInaction ?? venture.mission.today.ifDeferred,
            estimatedEffort: open?.decideBy ?? venture.mission.today.timeNeeded,
            actionLabel: open?.actionLabel ?? "Open the clause pack",
            actionHref: open?.actionHref ?? "/agents/counsel",
          }),
        );
      }
    }

    return findings;
  },
};

export function evaluatePolicies(
  core: VentureIntelligenceCore,
  library: PolicyLibrary = executivePolicyCatalog,
): PolicyFinding[] {
  const findings = library.flatMap((policy) => {
    const evaluate = evaluators[policy.id];
    return evaluate ? evaluate(core, policy) : [];
  });

  const seen = new Set<string>();
  return findings.filter((item) => {
    if (seen.has(item.id)) {
      return false;
    }
    seen.add(item.id);
    return true;
  });
}

export function evaluateActionablePolicies(
  core: VentureIntelligenceCore,
  library: PolicyLibrary = executivePolicyCatalog,
) {
  return actionableFindings(evaluatePolicies(core, library));
}

export function hydratePolicyEngine(
  core: VentureIntelligenceCore,
  library: PolicyLibrary = executivePolicyCatalog,
): VentureIntelligenceCore {
  const findings = evaluatePolicies(
    {
      ...core,
      policy: createPolicyEngine({ library, findings: [] }),
      ventures: core.ventures.map((venture) => ({
        ...venture,
        policy: emptyPolicyEngine(),
      })),
    },
    library,
  );

  return {
    ...core,
    policy: createPolicyEngine({ library, findings }),
    ventures: core.ventures.map((venture) => ({
      ...venture,
      policy: createPolicyEngine({
        library,
        findings: findings.filter(
          (item) => item.ventureId === venture.identity.id,
        ),
      }),
    })),
  };
}
