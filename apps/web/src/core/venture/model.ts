import { createCompanyStory } from "../company-story";
import {
  createDecisionEngine,
  decisionsForRole,
  resolvedDecisions,
  upcomingDecisions,
} from "../decision-engine";
import type { Decision, DecisionEngine } from "../decision-engine";
import { createDocumentIntelligence } from "../document-intelligence";
import {
  createDefaultLeadershipOffice,
  createOffice,
  createSeat,
  executiveRoleOrder,
  findDesk,
  roleCatalog,
  seatedDesks,
} from "../executive-office";
import type { ExecutiveOffice, ExecutiveRoleId } from "../executive-office";
import {
  briefingMemory,
  createExecutiveMemory,
  deskMemory,
} from "../executive-memory";
import type { ExecutiveMemory } from "../executive-memory";
import { createCompanyIdentity } from "../identity";
import type { FounderIdentity } from "../identity";
import {
  createKnowledgeGraphState,
  knowledgeNotes,
  noteBody,
} from "../knowledge-graph";
import { createMissionEngine } from "../mission-engine";
import {
  createOperatingHealth,
  createPortfolioHealth,
} from "../operating-health";
import {
  createExecutiveBriefing,
  createRecommendationEngine,
  emptyRecommendationEngine,
  recommendationsForRole,
} from "../recommendation/model";
import { assembleMorningIntelligence } from "../recommendation/briefing";
import type { Recommendation, RecommendationEngine } from "../recommendation/types";
import { instantiateVentureDefinition } from "../venture-definition/instantiation";
import { DEFAULT_VENTURE_DEFINITION_REF } from "../venture-definition/types";
import {
  mayConsumeBriefing,
  ventureHasFeature,
} from "../venture-definition/enforcement";
import { emptyPolicyEngine } from "../policy/model";
import { runExecutiveIntelligenceRuntime } from "../runtime/pipeline";
import { createRiskIntelligence } from "../risk-intelligence";
import type { FoundingInput, Venture, VentureIntelligenceCore } from "./types";
import type {
  ExecutiveFloorModel,
  ExecutiveProfileView,
  SituationRoomModel,
} from "./views";

export function createVenture(input: Venture): Venture {
  return input;
}

export function findVenture(
  core: VentureIntelligenceCore,
  id: string,
): Venture | undefined {
  return core.ventures.find(
    (venture) => venture.identity.id === id || venture.identity.slug === id,
  );
}

function mergeDecisions(
  core: VentureIntelligenceCore,
): DecisionEngine {
  return createDecisionEngine([
    ...core.decisions.items,
    ...core.ventures.flatMap((venture) => venture.decisions.items),
  ]);
}

function mergeRecommendations(
  core: VentureIntelligenceCore,
): RecommendationEngine {
  return createRecommendationEngine([
    ...core.recommendations.items,
    ...core.ventures.flatMap((venture) => venture.recommendations.items),
  ]);
}

function mergeMemory(core: VentureIntelligenceCore): ExecutiveMemory {
  return createExecutiveMemory([
    ...core.memory.records,
    ...core.ventures.flatMap((venture) => venture.memory.records),
  ]);
}

function projectBriefing(core: VentureIntelligenceCore) {
  return {
    preparedBy: core.briefing.preparedBy,
    headline: core.briefing.headline,
    narrative: core.briefing.narrative,
    implications: core.briefing.implications.map((item) => ({
      id: item.id,
      company: item.company,
      kind: item.kind,
      point: item.point,
    })),
  };
}

function projectMemory(core: VentureIntelligenceCore) {
  return briefingMemory(mergeMemory(core)).map((item) => ({
    id: item.id,
    recalledFrom: item.recalledFrom,
    title: item.title,
    note: item.note,
    implication: item.implication,
  }));
}

export function projectSituationRoom(
  core: VentureIntelligenceCore,
): SituationRoomModel {
  const morning = assembleMorningIntelligence(core);
  const activeVenture =
    core.ventures.find((venture) => venture.identity.id === morning.action?.ventureId) ??
    core.ventures.find((venture) => venture.mission.today.active) ??
    core.ventures[0];

  if (!activeVenture) {
    return {
      header: {
        founderName: core.founder.name,
        posture: core.founder.posture,
        worldLine: core.founder.worldLine,
      },
      mission: {
        company: core.founder.name,
        companyHref: "/ventures/launch",
        title: core.briefing.headline,
        ask: core.briefing.narrative,
        whyNow: core.founder.posture,
        ifDeferred: core.health.verdict,
        timeNeeded: core.health.posture,
        actionLabel: core.briefing.headline,
        actionHref: "/ventures/launch",
      },
      briefing: projectBriefing(core),
      health: {
        score: core.health.score,
        posture: core.health.posture,
        band: core.health.band,
        verdict: core.health.verdict,
        watches: [],
      },
      decisions: [],
      portfolio: [],
      stories: [],
      memory: projectMemory(core),
    };
  }

  const recEngine = mergeRecommendations(core);
  const missionRec = morning.action;
  const judgement =
    morning.judgement &&
    (!morning.judgement.ventureId ||
      ventureHasFeature(
        core.ventures.find((item) => item.identity.id === morning.judgement?.ventureId) ??
          activeVenture,
        "founder-decisions",
      ))
      ? morning.judgement
      : undefined;
  const briefingVentures = core.ventures.filter(mayConsumeBriefing);
  const storiesSource = [
    activeVenture,
    ...core.ventures.filter((venture) => venture.story.featured),
  ].filter(
    (venture, index, items) =>
      items.findIndex((item) => item.identity.id === venture.identity.id) === index,
  );
  const briefing = projectBriefing(core);
  if (briefingVentures.length === 0) {
    briefing.implications = [];
  } else {
    briefing.implications = briefing.implications.filter((item) =>
      briefingVentures.some((venture) => venture.identity.name === item.company),
    );
  }

  return {
    header: {
      founderName: core.founder.name,
      posture: core.founder.posture,
      worldLine: core.founder.worldLine,
    },
    mission: {
      company: missionRec?.company ?? activeVenture.identity.name,
      companyHref: missionRec?.companyHref ?? activeVenture.identity.href,
      title: missionRec?.title ?? activeVenture.mission.today.title,
      ask: missionRec?.recommendedAction ?? activeVenture.mission.today.ask,
      whyNow: missionRec?.reason ?? activeVenture.mission.today.whyNow,
      ifDeferred: missionRec?.expectedImpact ?? activeVenture.mission.today.ifDeferred,
      timeNeeded: missionRec?.estimatedEffort ?? activeVenture.mission.today.timeNeeded,
      actionLabel: missionRec?.actionLabel ?? activeVenture.mission.today.actionLabel,
      actionHref: missionRec?.actionHref ?? activeVenture.mission.today.actionHref,
      originatingPolicyTitle: missionRec?.originatingPolicyTitle,
      policyOwner: missionRec?.policyOwner,
      policySeverity: missionRec?.policySeverity,
      finding: missionRec?.finding,
      ventureId: missionRec?.ventureId ?? activeVenture.identity.id,
      decisionId: missionRec?.id,
      ruling: missionRec?.recommendedAction,
    },
    briefing,
    health: {
      score: core.health.score,
      posture: core.health.posture,
      band: core.health.band,
      verdict: core.health.verdict,
      watches: core.ventures
        .filter((venture) => venture.health.briefWatch)
        .map((venture) => ({
          id: venture.identity.id,
          company: venture.identity.name,
          companyHref: venture.identity.href,
          band: venture.health.band,
          judgement: venture.health.judgement,
          ask:
            recEngine.items.find(
              (item) =>
                item.ventureId === venture.identity.id && item.briefing,
            )?.recommendedAction ?? venture.health.ask,
        })),
    },
    decisions: judgement
      ? [
          {
            id: judgement.id,
            question: judgement.title,
            company: judgement.company,
            companyHref: judgement.companyHref,
            recommendation: judgement.recommendedAction,
            costOfInaction: judgement.expectedImpact,
            decideBy: judgement.estimatedEffort,
            actionLabel: judgement.actionLabel,
            actionHref: judgement.actionHref,
            originatingPolicyTitle: judgement.originatingPolicyTitle,
            policyOwner: judgement.policyOwner,
            policySeverity: judgement.policySeverity,
            finding: judgement.finding,
            ventureId: judgement.ventureId,
            ruling: judgement.recommendedAction,
          },
        ]
      : [],
    portfolio: core.ventures
      .filter((venture) => ventureHasFeature(venture, "portfolio"))
      .map((venture) => ({
      id: venture.identity.id,
      name: venture.identity.name,
      href: venture.identity.href,
      stage: venture.identity.stage,
      band: venture.health.band,
      founderAsk:
        recEngine.items.find(
          (item) =>
            item.ventureId === venture.identity.id &&
            item.ownerExecutive === "founder",
        )?.recommendedAction ?? venture.mission.today.founderAsk,
      attention: venture.mission.today.attention,
    })),
    stories: storiesSource.map((venture) => ({
      id: `${venture.identity.id}-story`,
      company: venture.identity.name,
      companyHref: venture.identity.href,
      chapter: venture.story.chapter,
      excerpt: venture.story.excerpt,
      tension: venture.story.tension,
    })),
    memory: projectMemory(core),
  };
}

export function hydrateVentureIntelligence(
  core: VentureIntelligenceCore,
): VentureIntelligenceCore {
  return runExecutiveIntelligenceRuntime(core).core;
}

export function createEmptyIntelligenceCore(
  founder: FounderIdentity,
): VentureIntelligenceCore {
  return {
    founder,
    office: createDefaultLeadershipOffice(),
    briefing: createExecutiveBriefing({
      preparedBy: "Prepared by VentureOS AI",
      headline: "Found a company to open the Situation Room.",
      narrative: "There is no portfolio yet. The first constraint is founding.",
      implications: [],
    }),
    health: createPortfolioHealth({
      score: 0,
      band: "watch",
      posture: "Empty",
      verdict: "No companies are in this workspace yet.",
    }),
    memory: createExecutiveMemory([]),
    decisions: createDecisionEngine([]),
    recommendations: emptyRecommendationEngine(),
    policy: emptyPolicyEngine(),
    ventures: [],
  };
}

function emptyRecommendation(roleId: ExecutiveRoleId): Recommendation {
  return {
    id: `${roleId}-empty`,
    ventureId: "workspace",
    company: "VentureOS",
    companyHref: "/agents",
    title: "No recommendation is queued",
    summary: "This desk has nothing that requires a founder call today.",
    recommendedAction: "No recommendation is queued.",
    reason: "This desk has nothing that requires a founder call today.",
    supportingEvidence: [],
    confidence: 0,
    confidenceLabel: "Low",
    executiveConsensus: { alignment: 0, label: "weak", votes: [] },
    ownerExecutive: roleId,
    priority: "low",
    expectedImpact: "None.",
    estimatedEffort: "None",
    actionLabel: "Return to the floor",
    actionHref: "/agents",
    isPrimary: true,
    briefing: false,
    originatingPolicyId: "none",
    originatingPolicyTitle: "No policy in force",
    policyOwner: roleId,
    policySeverity: "low",
    findingId: `${roleId}-empty-finding`,
    finding: "This desk has nothing that requires a founder call today.",
  };
}

export function projectExecutiveProfile(
  core: VentureIntelligenceCore,
  roleId: ExecutiveRoleId,
): ExecutiveProfileView | undefined {
  const desk = findDesk(core.office, roleId);
  if (!desk) {
    return undefined;
  }

  const recs = recommendationsForRole(mergeRecommendations(core), roleId);
  const primary = recs[0] ?? emptyRecommendation(roleId);

  const engine = mergeDecisions(core);
  const history = resolvedDecisions({
    items: decisionsForRole(engine, roleId),
  }).map((item) => ({
    id: item.id,
    date: item.resolvedOn ?? item.decideBy,
    title: item.title,
    ruling: item.ruling ?? item.recommendation,
    result: item.result ?? item.costOfInaction,
  }));

  const upcoming = upcomingDecisions({
    items: decisionsForRole(engine, roleId),
  }).map((item) => ({
    id: item.id,
    question: item.question,
    company: item.company,
    due: item.decideBy,
  }));

  return {
    id: desk.seat.id,
    role: desk.seat.role,
    name: desk.seat.name,
    remit: desk.seat.remit,
    status: desk.seat.status,
    statusLabel: desk.seat.statusLabel,
    brief: desk.brief,
    primaryRecommendation: primary,
    primaryAction: {
      label: primary.actionLabel,
      href: primary.actionHref,
    },
    recommendations: recs.length > 0 ? recs : [primary],
    decisions: history,
    memory: deskMemory(mergeMemory(core), roleId).map((item) => ({
      id: item.id,
      recalledFrom: item.recalledFrom,
      title: item.title,
      note: item.note,
      implication: item.implication,
    })),
    upcoming,
    correspondence: desk.correspondence,
  };
}

export function projectExecutiveFloor(
  core: VentureIntelligenceCore,
): ExecutiveFloorModel {
  const officeEnabled = core.ventures.some((venture) =>
    ventureHasFeature(venture, "executive-office"),
  );
  return {
    posture: core.office.posture,
    worldLine: core.office.worldLine,
    executives: officeEnabled
      ? core.office.desks
          .map((desk) => projectExecutiveProfile(core, desk.seat.id))
          .filter((profile): profile is ExecutiveProfileView => Boolean(profile))
      : [],
  };
}

export function findExecutiveProfile(
  core: VentureIntelligenceCore,
  roleId: string,
) {
  if (!executiveRoleOrder.includes(roleId as ExecutiveRoleId)) {
    return undefined;
  }

  return projectExecutiveProfile(core, roleId as ExecutiveRoleId);
}

function foundingDesks(
  seatedRoleIds: ExecutiveRoleId[],
  enabled: boolean,
): ExecutiveOffice {
  const seated = new Set<ExecutiveRoleId>(enabled ? seatedRoleIds : []);

  return createOffice({
    enabled,
    posture: enabled
      ? "Executive Office seated at founding."
      : "Executive Office closed at founding.",
    worldLine: enabled
      ? "These seats will brief the founder daily."
      : "Seats stay empty until the office is opened.",
    desks: executiveRoleOrder.map((id) => ({
      seat: createSeat(
        id,
        seated.has(id),
        seated.has(id) ? "clear" : "clear",
        seated.has(id) ? "Seated" : "Empty",
      ),
      brief: {
        headline: `${roleCatalog[id].role} desk`,
        body: roleCatalog[id].remit,
        focus: "Founding week.",
      },
      primaryAction: { label: "Open the floor", href: "/agents" },
      correspondence: [],
    })),
  });
}

export function createVentureFromFounding(input: FoundingInput): Venture {
  const instance = instantiateVentureDefinition(
    input.definition ?? DEFAULT_VENTURE_DEFINITION_REF,
  );
  const genome = input.genome;
  const foundedAt = input.foundedAt ?? new Date().toISOString();
  const name = input.name;
  const lead =
    roleCatalog[input.seatedRoleIds[0] ?? "founder"]?.role ?? "Founder";

  const built = createVenture({
    identity: createCompanyIdentity({
      id: input.id ?? input.slug,
      slug: input.slug,
      name,
      href: input.href ?? `/ventures/hq/${input.slug}`,
      foundedAt,
      category: genome.category,
      stage: genome.stage,
      owner: input.owner ?? "Founder",
      hqSummary: `${name} is open. This is the command surface for the company.`,
    }),
    definition: instance.ref,
    genome,
    story: createCompanyStory({
      origin: `${name} was founded to pursue ${genome.goal.toLowerCase()} as a ${genome.category.toLowerCase()} company.`,
      thesis: genome.thesis,
      promise: genome.motion,
      chapter: "Founding",
      excerpt: genome.thesis,
      tension: "Sprint 1 is the next sentence.",
      featured: false,
    }),
    executiveOffice: foundingDesks(input.seatedRoleIds, input.officeEnabled),
    decisions: createDecisionEngine([]),
    memory: createExecutiveMemory([]),
    knowledge: createKnowledgeGraphState({
      nodes: [
        {
          id: "n1",
          kind: "note",
          label: "Venture Genome",
          properties: { body: `${genome.thesis} Motion: ${genome.motion}` },
        },
        {
          id: "n2",
          kind: "note",
          label: "Operating cadence",
          properties: { body: genome.cadence },
        },
        {
          id: "n3",
          kind: "note",
          label: "Risk posture",
          properties: {
            body: `This company is currently ${genome.risk}. Protect focus until Sprint 1 produces a signal.`,
          },
        },
      ],
      edges: [],
    }),
    mission: createMissionEngine({
      today: {
        title: `Install Sprint 1 for ${name}`,
        ask: `Move ${genome.goal.toLowerCase()} from intent to a visible milestone.`,
        whyNow: "The company has just been founded.",
        ifDeferred: "The first week will pass without a constraint.",
        timeNeeded: "This week",
        actionLabel: "Open Company HQ",
        actionHref: `/ventures/hq/${input.slug}`,
        attention: "today",
        founderAsk: "Protect Sprint 1.",
        active: false,
      },
      sprint: {
        name: "Sprint 1",
        objective: `Move ${genome.goal.toLowerCase()} from intent to a visible milestone.`,
        tasks: [
          {
            id: "t1",
            title: `Write the week-one constraint for ${name}`,
            owner: "Founder",
          },
          {
            id: "t2",
            title: `Define the first proof of ${genome.goal.toLowerCase()}`,
            owner: lead,
          },
          {
            id: "t3",
            title: "Schedule the operating cadence",
            owner: lead,
          },
        ],
      },
    }),
    health: createOperatingHealth({
      score: 72,
      label: "Forming",
      band: "watch",
      posture: "Forming",
      summary:
        "Baseline health is set at founding. It will move once Sprint 1 produces evidence.",
      judgement: "Too early to score trajectory.",
      ask: "Run Sprint 1.",
      briefWatch: false,
    }),
    documents: createDocumentIntelligence([
      {
        id: "d1",
        title: `${name} one-pager`,
        kind: "Narrative",
        status: "suggested",
        summary: "The sentence the market can repeat.",
      },
      {
        id: "d2",
        title: "Sprint 1 brief",
        kind: "Operating",
        status: "suggested",
        summary: "Constraint, proof, cadence.",
      },
      {
        id: "d3",
        title: "Founder decision log",
        kind: "Governance",
        status: "suggested",
        summary: "Calls already made.",
      },
      {
        id: "d4",
        title: "Executive Office charter",
        kind: "Team",
        status: "suggested",
        summary: "Who sits, what they own.",
      },
    ]),
    risk: createRiskIntelligence({
      headline: `This company is currently ${genome.risk}.`,
      signals: [
        {
          id: "r1",
          title: "No Sprint 1 evidence yet",
          severity: "moderate",
          band: "watch",
          summary: "Health is a baseline, not a trajectory.",
          mitigation: "Protect the first proof.",
        },
      ],
    }),
    recommendations: emptyRecommendationEngine(),
    policy: emptyPolicyEngine(),
  });

  return built;
}

export function knowledgeNoteViews(venture: Venture) {
  return knowledgeNotes(venture.knowledge).map((node) => ({
    id: node.id,
    title: node.label,
    body: noteBody(node),
  }));
}

export function seatedOfficeViews(office: ExecutiveOffice) {
  return seatedDesks(office).map((desk) => ({
    id: desk.seat.id,
    label: desk.seat.role,
    description: desk.seat.remit,
  }));
}

export function collectRecommendations(
  core: VentureIntelligenceCore,
  roleId: ExecutiveRoleId,
): Recommendation[] {
  return recommendationsForRole(mergeRecommendations(core), roleId);
}

export function collectDecisions(
  core: VentureIntelligenceCore,
  roleId: ExecutiveRoleId,
): Decision[] {
  return decisionsForRole(mergeDecisions(core), roleId);
}
