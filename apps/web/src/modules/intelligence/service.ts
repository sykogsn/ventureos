import type { UserId, VentureId, WorkspaceId } from "@/contracts";
import { createCompanyStory } from "@/core/company-story";
import { createDecisionEngine } from "@/core/decision-engine";
import { createDocumentIntelligence } from "@/core/document-intelligence";
import {
  createDefaultLeadershipOffice,
  createOffice,
} from "@/core/executive-office";
import { createExecutiveMemory } from "@/core/executive-memory";
import { createFounderIdentity } from "@/core/identity";
import { createKnowledgeGraphState } from "@/core/knowledge-graph";
import { createMissionEngine } from "@/core/mission-engine";
import {
  createOperatingHealth,
  createPortfolioHealth,
  type OperatingHealth,
  type PortfolioHealth,
} from "@/core/operating-health";
import { emptyPolicyEngine, type PolicyEngine } from "@/core/policy";
import {
  createExecutiveBriefing,
} from "@/core/recommendation/model";
import { createRiskIntelligence } from "@/core/risk-intelligence";
import {
  createEmptyIntelligenceCore,
  createVenture,
  findVenture,
  type Venture,
  type VentureIntelligenceCore,
} from "@/core/venture";
import {
  COMPANY_FOUNDED,
  createCompanyFounded,
  createFounderDecisionRecorded,
  isRuntimeMutation,
  runExecutiveIntelligenceRuntime,
  type IntelligenceSnapshot,
  type RuntimeEvent,
} from "@/core/runtime";
import { foundCompany } from "@/modules/ventures/launch/artefacts";
import { canRecordFounderDecision } from "@/modules/intelligence/governance";
import {
  emptyLaunchDraft,
  type FoundedCompany,
  type LaunchDraft,
} from "@/modules/ventures/launch/types";
import { createEvent, createId, ensureSchema, getPersistence, nowIso } from "@/platform";
import { getPlatform } from "@/platform/kernel";
import type { PersistedVenture } from "@/platform/persistence/repositories/ports";

function fallbackHealth(): OperatingHealth {
  return createOperatingHealth({
    score: 72,
    label: "Forming",
    band: "watch",
    posture: "Forming",
    summary: "Baseline health is set at founding.",
    judgement: "Too early to score trajectory.",
    ask: "Run Sprint 1.",
    briefWatch: false,
  });
}

function fallbackStory(name: string, thesis: string): ReturnType<typeof createCompanyStory> {
  return createCompanyStory({
    origin: `${name} was founded.`,
    thesis,
    promise: thesis,
    chapter: "Founding",
    excerpt: thesis,
    tension: "Sprint 1 is the next sentence.",
    featured: false,
  });
}

function isLaunchDraft(value: unknown): value is LaunchDraft {
  if (!value || typeof value !== "object") {
    return false;
  }
  return "name" in value;
}

function uniqueById<T extends { id: string }>(items: T[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.id)) {
      return false;
    }
    seen.add(item.id);
    return true;
  });
}

export async function assertWorkspaceAccess(userId: UserId, workspaceId: WorkspaceId) {
  const platform = getPlatform();
  return platform.permissions.can({
    userId,
    permission: "venture.read",
    resource: { type: "workspace", id: workspaceId },
  });
}

export async function seedWorkspaceIntelligence(input: {
  userId: UserId;
  workspaceId: WorkspaceId;
  founderName: string;
}) {
  await ensureSchema();
  const store = getPersistence();
  const now = nowIso();
  const founder = createFounderIdentity({
    id: input.userId,
    name: input.founderName,
    title: "Founder",
    posture: "Founding.",
    worldLine: "The first constraint is the company you have not founded yet.",
  });
  const empty = createEmptyIntelligenceCore(founder);

  await store.cores.upsert({
    workspaceId: input.workspaceId,
    founder: empty.founder,
    briefing: empty.briefing,
    updatedAt: now,
  });
  await store.offices.upsert({
    id: createId(),
    workspaceId: input.workspaceId,
    ventureId: "",
    office: empty.office,
    updatedAt: now,
  });
  await store.health.upsert({
    id: createId(),
    workspaceId: input.workspaceId,
    ventureId: "",
    health: empty.health,
    updatedAt: now,
  });
}

async function assembleVenture(
  workspaceId: WorkspaceId,
  row: PersistedVenture,
): Promise<Venture> {
  const store = getPersistence();
  const office = await store.offices.find(workspaceId, row.id);
  const story = await store.stories.find(row.id);
  const health = (await store.health.find(workspaceId, row.id)) as OperatingHealth | null;
  const knowledge = await store.knowledge.loadForVenture(workspaceId, row.id);
  const policy = await store.policies.loadState(workspaceId);
  const recs = (await store.recommendations.listForWorkspace(workspaceId)).filter(
    (item) => item.ventureId === row.id,
  );
  const memory = (await store.memory.listForWorkspace(workspaceId)).filter(
    (item) => item.ventureId === row.id,
  );
  const decisions = (await store.decisions.listForWorkspace(workspaceId)).filter(
    (item) => item.ventureId === row.id,
  );

  const venturePolicy: PolicyEngine = policy
    ? {
        library: policy.library,
        findings: policy.findings.filter((item) => item.ventureId === row.id),
      }
    : emptyPolicyEngine();

  return createVenture({
    identity: {
      id: row.id,
      slug: row.slug,
      name: row.name,
      href: row.href || `/ventures/hq/${row.slug}`,
      foundedAt: row.foundedAt || row.createdAt,
      category: row.category,
      stage: row.stage,
      owner: row.owner,
      hqSummary: row.hqSummary,
    },
    definition: {
      id: row.definitionId,
      version: row.definitionVersion,
    },
    genome: row.genome,
    story: story ?? fallbackStory(row.name, row.genome.thesis),
    executiveOffice:
      office ??
      createOffice({
        enabled: false,
        posture: "Empty.",
        worldLine: "This company has not opened an Executive Office.",
        desks: [],
      }),
    decisions: createDecisionEngine(decisions),
    memory: createExecutiveMemory(memory),
    knowledge: createKnowledgeGraphState(knowledge),
    mission: createMissionEngine(row.mission),
    health: health ?? fallbackHealth(),
    documents: createDocumentIntelligence(row.documents.documents),
    risk: createRiskIntelligence(row.risk),
    recommendations: { items: recs },
    policy: venturePolicy,
  });
}

export async function loadIntelligenceFacts(
  userId: UserId,
  workspaceId: WorkspaceId,
): Promise<VentureIntelligenceCore | null> {
  await ensureSchema();
  const allowed = await assertWorkspaceAccess(userId, workspaceId);
  if (!allowed) {
    return null;
  }

  const store = getPersistence();
  let coreRow = await store.cores.find(workspaceId);
  if (!coreRow) {
    await seedWorkspaceIntelligence({
      userId,
      workspaceId,
      founderName: "Founder",
    });
    coreRow = await store.cores.find(workspaceId);
  }
  const office = await store.offices.find(workspaceId, "");
  const rows = await store.ventures.listByWorkspace(workspaceId);
  const ventures = await Promise.all(rows.map((row) => assembleVenture(workspaceId, row)));
  const memory = await store.memory.listForWorkspace(workspaceId);
  const decisions = await store.decisions.listForWorkspace(workspaceId);
  const recommendations = await store.recommendations.listForWorkspace(workspaceId);
  const policy = await store.policies.loadState(workspaceId);
  const portfolio = (await store.health.find(workspaceId, "")) as PortfolioHealth | null;

  const founder = coreRow?.founder ??
    createFounderIdentity({
      id: userId,
      name: "Founder",
      title: "Founder",
      posture: "Founding.",
      worldLine: "The first constraint is founding.",
    });

  const assembled: VentureIntelligenceCore = {
    founder,
    office: office ?? createDefaultLeadershipOffice(),
    briefing:
      coreRow?.briefing ??
      createExecutiveBriefing({
        preparedBy: "Prepared by VentureOS AI",
        headline: "",
        narrative: "",
        implications: [],
      }),
    health:
      portfolio ??
      createPortfolioHealth({
        score: 0,
        band: "watch",
        posture: "Empty",
        verdict: "No companies are in this workspace yet.",
      }),
    memory: createExecutiveMemory(memory.filter((item) => !item.ventureId)),
    decisions: createDecisionEngine(decisions),
    recommendations: {
      items: uniqueById(recommendations),
    },
    policy: policy ?? emptyPolicyEngine(),
    ventures,
  };

  return assembled;
}

export async function executeIntelligenceRuntime(input: {
  userId: UserId;
  workspaceId: WorkspaceId;
  event?: RuntimeEvent;
}): Promise<IntelligenceSnapshot | null> {
  const facts = await loadIntelligenceFacts(input.userId, input.workspaceId);
  if (!facts) {
    return null;
  }

  const snapshot = runExecutiveIntelligenceRuntime(facts, input.event);
  if (input.event && isRuntimeMutation(input.event)) {
    await persistVentureIntelligence(input.workspaceId, snapshot.core);
    await getPlatform().events.publish(
      createEvent(
        snapshot.event.type,
        snapshot.event.type === COMPANY_FOUNDED
          ? { ventureId: snapshot.event.venture.identity.id }
          : snapshot.event,
        {
          actorId: input.userId,
          workspaceId: input.workspaceId,
          ventureId:
            snapshot.event.type === COMPANY_FOUNDED
              ? (snapshot.event.venture.identity.id as VentureId)
              : snapshot.event.type === "FounderDecisionRecorded"
                ? (snapshot.event.ventureId as VentureId)
                : undefined,
        },
      ),
    );
  }

  return snapshot;
}

export async function loadVentureIntelligence(
  userId: UserId,
  workspaceId: WorkspaceId,
): Promise<VentureIntelligenceCore | null> {
  const snapshot = await executeIntelligenceRuntime({ userId, workspaceId });
  return snapshot?.core ?? null;
}

export async function recordFounderDecision(input: {
  userId: UserId;
  workspaceId: WorkspaceId;
  decisionId: string;
  ventureId: string;
  ruling: string;
  result?: string;
}): Promise<IntelligenceSnapshot> {
  const allowed = await canRecordFounderDecision(input.userId, input.workspaceId);
  if (!allowed) {
    throw new Error("Not allowed to record a founder decision in this workspace.");
  }

  const snapshot = await executeIntelligenceRuntime({
    userId: input.userId,
    workspaceId: input.workspaceId,
    event: createFounderDecisionRecorded({
      occurredAt: nowIso(),
      decisionId: input.decisionId,
      ventureId: input.ventureId,
      ruling: input.ruling,
      result: input.result,
    }),
  });

  if (!snapshot) {
    throw new Error("Could not load Venture Intelligence Core.");
  }

  return snapshot;
}

export async function persistVentureIntelligence(
  workspaceId: WorkspaceId,
  core: VentureIntelligenceCore,
) {
  await ensureSchema();
  const store = getPersistence();
  const now = nowIso();

  await store.cores.upsert({
    workspaceId,
    founder: core.founder,
    briefing: core.briefing,
    updatedAt: now,
  });
  await store.offices.upsert({
    id: createId(),
    workspaceId,
    ventureId: "",
    office: core.office,
    updatedAt: now,
  });
  await store.health.upsert({
    id: createId(),
    workspaceId,
    ventureId: "",
    health: core.health,
    updatedAt: now,
  });
  await store.memory.replaceForWorkspace(workspaceId, [
    ...core.memory.records,
    ...core.ventures.flatMap((venture) => venture.memory.records),
  ], now);
  await store.decisions.replaceForWorkspace(
    workspaceId,
    uniqueById([
      ...core.decisions.items,
      ...core.ventures.flatMap((venture) => venture.decisions.items),
    ]),
    now,
  );
  await store.policies.upsertState({
    workspaceId,
    library: core.policy.library,
    findings: core.policy.findings,
    updatedAt: now,
  });
  await store.policies.replaceFindings(workspaceId, core.policy.findings, now);

  const recs = uniqueById([
    ...core.recommendations.items,
    ...core.ventures.flatMap((venture) => venture.recommendations.items),
  ]);
  await store.recommendations.replaceForWorkspace(workspaceId, recs, now);

  for (const venture of core.ventures) {
    const existing = await store.ventures.findById(venture.identity.id as VentureId);
    const persisted: PersistedVenture = {
      id: venture.identity.id as VentureId,
      workspaceId,
      name: venture.identity.name,
      slug: venture.identity.slug,
      stage: venture.identity.stage,
      href: venture.identity.href,
      foundedAt: venture.identity.foundedAt,
      category: venture.identity.category,
      owner: venture.identity.owner,
      hqSummary: venture.identity.hqSummary,
      genome: venture.genome,
      mission: venture.mission,
      launchDraft: existing?.launchDraft ?? emptyLaunchDraft,
      documents: venture.documents,
      risk: venture.risk,
      definitionId: venture.definition?.id ?? existing?.definitionId ?? "",
      definitionVersion: venture.definition?.version ?? existing?.definitionVersion ?? "",
      lifecycle: existing?.lifecycle ?? "operating",
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };

    if (existing) {
      await store.ventures.update({
        ...persisted,
        launchDraft: existing.launchDraft,
      });
    } else {
      await store.ventures.insert(persisted);
    }

    await store.offices.upsert({
      id: createId(),
      workspaceId,
      ventureId: venture.identity.id,
      office: venture.executiveOffice,
      updatedAt: now,
    });
    await store.stories.upsert({
      ventureId: venture.identity.id as VentureId,
      workspaceId,
      story: venture.story,
      updatedAt: now,
    });
    await store.health.upsert({
      id: createId(),
      workspaceId,
      ventureId: venture.identity.id,
      health: venture.health,
      updatedAt: now,
    });
    await store.knowledge.replaceForVenture(
      workspaceId,
      venture.identity.id,
      venture.knowledge.nodes,
      venture.knowledge.edges,
      now,
    );
  }
}

async function uniqueVentureSlug(workspaceId: WorkspaceId, base: string) {
  const store = getPersistence();
  let slug = base;
  let n = 0;
  while (await store.ventures.slugTaken(workspaceId, slug)) {
    n += 1;
    slug = `${base}-${n}`;
  }
  return slug;
}

export async function persistFoundedCompany(input: {
  userId: UserId;
  workspaceId: WorkspaceId;
  draft: LaunchDraft;
}): Promise<FoundedCompany> {
  await ensureSchema();
  const allowed = await getPlatform().permissions.can({
    userId: input.userId,
    permission: "venture.create",
    resource: { type: "workspace", id: input.workspaceId },
  });
  if (!allowed) {
    throw new Error("Not allowed to found a company in this workspace.");
  }

  const company = foundCompany(input.draft);
  const slug = await uniqueVentureSlug(input.workspaceId, company.slug);
  const id = createId<VentureId>();
  const venture: Venture = {
    ...company.venture,
    identity: {
      ...company.venture.identity,
      id,
      slug,
      href: `/ventures/hq/${slug}`,
    },
  };

  const snapshot = await executeIntelligenceRuntime({
    userId: input.userId,
    workspaceId: input.workspaceId,
    event: createCompanyFounded({
      occurredAt: venture.identity.foundedAt,
      venture,
    }),
  });

  if (!snapshot) {
    throw new Error("Could not load Venture Intelligence Core.");
  }

  const store = getPersistence();
  const saved = await store.ventures.findById(id);
  if (saved) {
    await store.ventures.update({
      ...saved,
      launchDraft: company.draft,
      slug,
      href: `/ventures/hq/${slug}`,
    });
  }

  const persistedVenture =
    snapshot.core.ventures.find((item) => item.identity.id === id) ?? venture;
  return {
    slug,
    foundedAt: persistedVenture.identity.foundedAt,
    draft: company.draft,
    venture: persistedVenture,
  };
}

export async function getFoundedCompanyBySlug(input: {
  userId: UserId;
  workspaceId: WorkspaceId;
  slug: string;
}): Promise<FoundedCompany | null> {
  const core = await loadVentureIntelligence(input.userId, input.workspaceId);
  if (!core) {
    return null;
  }

  const venture = findVenture(core, input.slug);
  if (!venture) {
    return null;
  }

  const stored = await getPersistence().ventures.findBySlug(input.workspaceId, venture.identity.slug);
  return {
    slug: venture.identity.slug,
    foundedAt: venture.identity.foundedAt,
    draft: stored && isLaunchDraft(stored.launchDraft) ? stored.launchDraft : emptyLaunchDraft,
    venture,
  };
}
