import { and, eq, isNull, lt } from "drizzle-orm";
import type { UserId, VentureId, WorkspaceId } from "@/contracts";
import type { CompanyStory } from "@/core/company-story";
import type { Decision } from "@/core/decision-engine";
import type { DocumentIntelligence } from "@/core/document-intelligence";
import type { ExecutiveOffice } from "@/core/executive-office";
import type { MemoryRecord } from "@/core/executive-memory";
import type { KnowledgeEdge, KnowledgeNode } from "@/core/knowledge-graph";
import type { MissionEngine } from "@/core/mission-engine";
import type { PolicyFinding, PolicyLibrary } from "@/core/policy";
import type { Recommendation } from "@/core/recommendation";
import type { RiskIntelligence } from "@/core/risk-intelligence";
import type { VentureGenome } from "@/core/venture-genome";
import { DEFAULT_VENTURE_DEFINITION_REF } from "@/core/venture-definition/types";
import { isVentureLifecycle } from "@/core/venture-definition/lifecycle";
import { getDb, resetDatabaseLifecycle } from "@/platform/persistence/db";
import { fromJson, toJson } from "@/platform/persistence/json";
import {
  authIdentities,
  companyStories,
  decisions,
  executiveMemory,
  executiveOffices,
  knowledgeEdges,
  knowledgeNodes,
  operatingHealth,
  passwordResetTokens,
  policyFindings,
  policyStates,
  recommendations,
  sessions,
  users,
  ventures,
  workspaceCores,
  workspaceMembers,
  workspaces,
} from "@/platform/persistence/schema";
import type {
  AuthIdentityRow,
  AuthProvider,
  CompanyStoryRepository,
  DecisionRepository,
  ExecutiveMemoryRepository,
  ExecutiveOfficeRepository,
  IdentityRepository,
  KnowledgeRepository,
  MembershipRepository,
  MembershipRow,
  OperatingHealthRepository,
  OrganisationRepository,
  OrganisationRow,
  PasswordResetTokenRepository,
  PasswordResetTokenRow,
  Persistence,
  PersistedVenture,
  PolicyRepository,
  RecommendationRepository,
  SessionRepository,
  SessionRow,
  UserRepository,
  UserRow,
  VentureRepository,
  WorkspaceCoreRepository,
  WorkspaceCoreRow,
} from "./ports";

function mapUser(row: typeof users.$inferSelect): UserRow {
  return {
    id: row.id as UserId,
    email: row.email,
    name: row.name,
    passwordHash: row.passwordHash,
    createdAt: row.createdAt,
  };
}

function mapVenture(row: typeof ventures.$inferSelect): PersistedVenture {
  return {
    id: row.id as VentureId,
    workspaceId: row.workspaceId as WorkspaceId,
    name: row.name,
    slug: row.slug,
    stage: row.stage,
    href: row.href,
    foundedAt: row.foundedAt,
    category: row.category,
    owner: row.owner,
    hqSummary: row.hqSummary,
    genome: fromJson<VentureGenome>(row.genomeJson, {
      thesis: "",
      category: row.category,
      stage: row.stage,
      goal: "",
      posture: "human-led",
      risk: "focused",
      motion: "",
      cadence: "",
    }),
    mission: fromJson<MissionEngine>(row.missionJson, {
      today: {
        title: "",
        ask: "",
        whyNow: "",
        ifDeferred: "",
        timeNeeded: "",
        actionLabel: "",
        actionHref: row.href,
        attention: "hold",
        founderAsk: "",
        active: false,
      },
      sprint: { name: "", objective: "", tasks: [] },
    }),
    launchDraft: fromJson(row.launchDraftJson, {}),
    documents: fromJson<DocumentIntelligence>(row.documentsJson, { documents: [] }),
    risk: fromJson<RiskIntelligence>(row.riskJson, { headline: "", signals: [] }),
    definitionId: row.definitionId || DEFAULT_VENTURE_DEFINITION_REF.id,
    definitionVersion: row.definitionVersion || DEFAULT_VENTURE_DEFINITION_REF.version,
    lifecycle: isVentureLifecycle(row.lifecycle) ? row.lifecycle : "operating",
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function createUserRepository(): UserRepository {
  return {
    async findById(id) {
      const [row] = await getDb().select().from(users).where(eq(users.id, id)).limit(1);
      return row ? mapUser(row) : null;
    },
    async findByEmail(email) {
      const [row] = await getDb()
        .select()
        .from(users)
        .where(eq(users.email, email))
        .limit(1);
      return row ? mapUser(row) : null;
    },
    async insert(row) {
      await getDb().insert(users).values(row);
    },
    async updatePasswordHash(id, passwordHash) {
      await getDb().update(users).set({ passwordHash }).where(eq(users.id, id));
    },
  };
}

function createIdentityRepository(): IdentityRepository {
  return {
    async findByProvider(provider, subject) {
      const [row] = await getDb()
        .select()
        .from(authIdentities)
        .where(
          and(
            eq(authIdentities.provider, provider),
            eq(authIdentities.providerSubject, subject),
          ),
        )
        .limit(1);
      if (!row) {
        return null;
      }
      return {
        id: row.id,
        userId: row.userId as UserId,
        provider: row.provider as AuthProvider,
        providerSubject: row.providerSubject,
        secretHash: row.secretHash,
        createdAt: row.createdAt,
      };
    },
    async listForUser(userId) {
      const rows = await getDb()
        .select()
        .from(authIdentities)
        .where(eq(authIdentities.userId, userId));
      return rows.map((row) => ({
        id: row.id,
        userId: row.userId as UserId,
        provider: row.provider as AuthProvider,
        providerSubject: row.providerSubject,
        secretHash: row.secretHash,
        createdAt: row.createdAt,
      }));
    },
    async insert(row: AuthIdentityRow) {
      await getDb().insert(authIdentities).values(row);
    },
    async updateSecretHash(id, secretHash) {
      await getDb()
        .update(authIdentities)
        .set({ secretHash })
        .where(eq(authIdentities.id, id));
    },
  };
}

function createSessionRepository(): SessionRepository {
  return {
    async insert(row: SessionRow) {
      await getDb().insert(sessions).values(row);
    },
    async findById(id) {
      const [row] = await getDb()
        .select()
        .from(sessions)
        .where(eq(sessions.id, id))
        .limit(1);
      if (!row) {
        return null;
      }
      return {
        id: row.id,
        userId: row.userId as UserId,
        expiresAt: row.expiresAt,
        createdAt: row.createdAt,
      };
    },
    async deleteById(id) {
      await getDb().delete(sessions).where(eq(sessions.id, id));
    },
    async deleteByUserId(userId) {
      await getDb().delete(sessions).where(eq(sessions.userId, userId));
    },
    async deleteExpired(nowIso) {
      await getDb().delete(sessions).where(lt(sessions.expiresAt, nowIso));
    },
  };
}

function mapResetToken(row: typeof passwordResetTokens.$inferSelect): PasswordResetTokenRow {
  return {
    id: row.id,
    userId: row.userId as UserId,
    tokenHash: row.tokenHash,
    expiresAt: row.expiresAt,
    usedAt: row.usedAt,
    createdAt: row.createdAt,
  };
}

function createPasswordResetTokenRepository(): PasswordResetTokenRepository {
  return {
    async insert(row) {
      await getDb().insert(passwordResetTokens).values(row);
    },
    async findByTokenHash(tokenHash) {
      const [row] = await getDb()
        .select()
        .from(passwordResetTokens)
        .where(eq(passwordResetTokens.tokenHash, tokenHash))
        .limit(1);
      return row ? mapResetToken(row) : null;
    },
    async markUsed(id, usedAt) {
      await getDb()
        .update(passwordResetTokens)
        .set({ usedAt })
        .where(eq(passwordResetTokens.id, id));
    },
    async deleteExpired(nowIso) {
      await getDb()
        .delete(passwordResetTokens)
        .where(lt(passwordResetTokens.expiresAt, nowIso));
    },
    async deleteUnusedForUser(userId) {
      await getDb()
        .delete(passwordResetTokens)
        .where(and(eq(passwordResetTokens.userId, userId), isNull(passwordResetTokens.usedAt)));
    },
  };
}

function createOrganisationRepository(): OrganisationRepository {
  return {
    async insert(row: OrganisationRow) {
      await getDb().insert(workspaces).values(row);
    },
    async findById(id) {
      const [row] = await getDb()
        .select()
        .from(workspaces)
        .where(eq(workspaces.id, id))
        .limit(1);
      return row
        ? {
            id: row.id as WorkspaceId,
            name: row.name,
            slug: row.slug,
            createdAt: row.createdAt,
          }
        : null;
    },
    async findBySlug(slug) {
      const [row] = await getDb()
        .select()
        .from(workspaces)
        .where(eq(workspaces.slug, slug))
        .limit(1);
      return row
        ? {
            id: row.id as WorkspaceId,
            name: row.name,
            slug: row.slug,
            createdAt: row.createdAt,
          }
        : null;
    },
    async listForUser(userId) {
      const rows = await getDb()
        .select({
          id: workspaces.id,
          name: workspaces.name,
          slug: workspaces.slug,
          createdAt: workspaces.createdAt,
        })
        .from(workspaceMembers)
        .innerJoin(workspaces, eq(workspaceMembers.workspaceId, workspaces.id))
        .where(eq(workspaceMembers.userId, userId));
      return rows.map((row) => ({
        id: row.id as WorkspaceId,
        name: row.name,
        slug: row.slug,
        createdAt: row.createdAt,
      }));
    },
  };
}

function createMembershipRepository(): MembershipRepository {
  return {
    async insert(row: MembershipRow) {
      await getDb().insert(workspaceMembers).values(row);
    },
    async getRole(userId, workspaceId) {
      const [row] = await getDb()
        .select()
        .from(workspaceMembers)
        .where(
          and(
            eq(workspaceMembers.userId, userId),
            eq(workspaceMembers.workspaceId, workspaceId),
          ),
        )
        .limit(1);
      return row?.role ?? null;
    },
    async setRole(row: MembershipRow) {
      const db = getDb();
      const existing = await this.getRole(row.userId, row.workspaceId);
      if (existing) {
        await db
          .update(workspaceMembers)
          .set({ role: row.role })
          .where(
            and(
              eq(workspaceMembers.userId, row.userId),
              eq(workspaceMembers.workspaceId, row.workspaceId),
            ),
          );
        return;
      }
      await db.insert(workspaceMembers).values(row);
    },
  };
}

function createVentureRepository(): VentureRepository {
  return {
    async insert(row) {
      await getDb().insert(ventures).values({
        id: row.id,
        workspaceId: row.workspaceId,
        name: row.name,
        slug: row.slug,
        stage: row.stage,
        href: row.href,
        foundedAt: row.foundedAt,
        category: row.category,
        owner: row.owner,
        hqSummary: row.hqSummary,
        genomeJson: toJson(row.genome),
        missionJson: toJson(row.mission),
        launchDraftJson: toJson(row.launchDraft),
        documentsJson: toJson(row.documents),
        riskJson: toJson(row.risk),
        definitionId: row.definitionId,
        definitionVersion: row.definitionVersion,
        lifecycle: row.lifecycle,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      });
    },
    async update(row) {
      await getDb()
        .update(ventures)
        .set({
          name: row.name,
          slug: row.slug,
          stage: row.stage,
          href: row.href,
          foundedAt: row.foundedAt,
          category: row.category,
          owner: row.owner,
          hqSummary: row.hqSummary,
          genomeJson: toJson(row.genome),
          missionJson: toJson(row.mission),
          launchDraftJson: toJson(row.launchDraft),
          documentsJson: toJson(row.documents),
          riskJson: toJson(row.risk),
          definitionId: row.definitionId,
          definitionVersion: row.definitionVersion,
          lifecycle: row.lifecycle,
          updatedAt: row.updatedAt,
        })
        .where(eq(ventures.id, row.id));
    },
    async findById(id) {
      const [row] = await getDb()
        .select()
        .from(ventures)
        .where(eq(ventures.id, id))
        .limit(1);
      return row ? mapVenture(row) : null;
    },
    async findBySlug(workspaceId, slug) {
      const [row] = await getDb()
        .select()
        .from(ventures)
        .where(and(eq(ventures.workspaceId, workspaceId), eq(ventures.slug, slug)))
        .limit(1);
      return row ? mapVenture(row) : null;
    },
    async listByWorkspace(workspaceId) {
      const rows = await getDb()
        .select()
        .from(ventures)
        .where(eq(ventures.workspaceId, workspaceId));
      return rows.map(mapVenture);
    },
    async slugTaken(workspaceId, slug) {
      const [row] = await getDb()
        .select({ id: ventures.id })
        .from(ventures)
        .where(and(eq(ventures.workspaceId, workspaceId), eq(ventures.slug, slug)))
        .limit(1);
      return Boolean(row);
    },
  };
}

function createOfficeRepository(): ExecutiveOfficeRepository {
  return {
    async upsert(input) {
      const db = getDb();
      const existing = await db
        .select({ id: executiveOffices.id })
        .from(executiveOffices)
        .where(
          and(
            eq(executiveOffices.workspaceId, input.workspaceId),
            eq(executiveOffices.ventureId, input.ventureId),
          ),
        )
        .limit(1);

      if (existing[0]) {
        await db
          .update(executiveOffices)
          .set({
            documentJson: toJson(input.office),
            updatedAt: input.updatedAt,
          })
          .where(eq(executiveOffices.id, existing[0].id));
        return;
      }

      await db.insert(executiveOffices).values({
        id: input.id,
        workspaceId: input.workspaceId,
        ventureId: input.ventureId,
        documentJson: toJson(input.office),
        updatedAt: input.updatedAt,
      });
    },
    async find(workspaceId, ventureId) {
      const [row] = await getDb()
        .select()
        .from(executiveOffices)
        .where(
          and(
            eq(executiveOffices.workspaceId, workspaceId),
            eq(executiveOffices.ventureId, ventureId),
          ),
        )
        .limit(1);
      return row ? fromJson<ExecutiveOffice>(row.documentJson, {
        enabled: false,
        posture: "",
        worldLine: "",
        desks: [],
      }) : null;
    },
  };
}

function createRecommendationRepository(): RecommendationRepository {
  return {
    async replaceForScope(workspaceId, ventureId, items, updatedAt) {
      const db = getDb();
      await db
        .delete(recommendations)
        .where(
          and(
            eq(recommendations.workspaceId, workspaceId),
            eq(recommendations.ventureId, ventureId),
          ),
        );
      if (items.length === 0) {
        return;
      }
      await db.insert(recommendations).values(
        items.map((item) => ({
          id: item.id,
          workspaceId,
          ventureId,
          documentJson: toJson(item),
          updatedAt,
        })),
      );
    },
    async replaceForWorkspace(workspaceId, items, updatedAt) {
      const db = getDb();
      await db.delete(recommendations).where(eq(recommendations.workspaceId, workspaceId));
      if (items.length === 0) {
        return;
      }
      await db.insert(recommendations).values(
        items.map((item) => ({
          id: item.id,
          workspaceId,
          ventureId: item.ventureId,
          documentJson: toJson(item),
          updatedAt,
        })),
      );
    },
    async listForWorkspace(workspaceId) {
      const rows = await getDb()
        .select()
        .from(recommendations)
        .where(eq(recommendations.workspaceId, workspaceId));
      return rows.map((row) => fromJson<Recommendation>(row.documentJson, {
        id: row.id,
        ventureId: row.ventureId as VentureId,
        company: "",
        companyHref: "",
        title: "",
        summary: "",
        recommendedAction: "",
        reason: "",
        supportingEvidence: [],
        confidence: 0,
        confidenceLabel: "Low",
        executiveConsensus: { alignment: 0, label: "weak", votes: [] },
        ownerExecutive: "founder",
        priority: "low",
        expectedImpact: "",
        estimatedEffort: "",
        actionLabel: "",
        actionHref: "",
        isPrimary: false,
        briefing: false,
        originatingPolicyId: "none",
        originatingPolicyTitle: "",
        policyOwner: "founder",
        policySeverity: "low",
        findingId: "",
        finding: "",
      }));
    },
  };
}

function createPolicyRepository(): PolicyRepository {
  return {
    async upsertState(input) {
      const db = getDb();
      const existing = await db
        .select({ workspaceId: policyStates.workspaceId })
        .from(policyStates)
        .where(eq(policyStates.workspaceId, input.workspaceId))
        .limit(1);

      const values = {
        libraryJson: toJson(input.library),
        findingsJson: toJson(input.findings),
        updatedAt: input.updatedAt,
      };

      if (existing[0]) {
        await db
          .update(policyStates)
          .set(values)
          .where(eq(policyStates.workspaceId, input.workspaceId));
        return;
      }

      await db.insert(policyStates).values({
        workspaceId: input.workspaceId,
        ...values,
      });
    },
    async replaceFindings(workspaceId, findings, updatedAt) {
      const db = getDb();
      await db.delete(policyFindings).where(eq(policyFindings.workspaceId, workspaceId));
      if (findings.length === 0) {
        return;
      }
      await db.insert(policyFindings).values(
        findings.map((item) => ({
          id: item.id,
          workspaceId,
          ventureId: item.ventureId,
          policyId: item.policyId,
          documentJson: toJson(item),
          updatedAt,
        })),
      );
    },
    async loadState(workspaceId) {
      const [row] = await getDb()
        .select()
        .from(policyStates)
        .where(eq(policyStates.workspaceId, workspaceId))
        .limit(1);
      if (!row) {
        return null;
      }
      const snapshotFindings = fromJson<PolicyFinding[]>(row.findingsJson, []);
      if (snapshotFindings.length > 0) {
        return {
          library: fromJson<PolicyLibrary>(row.libraryJson, []),
          findings: snapshotFindings,
        };
      }

      const findingRows = await getDb()
        .select()
        .from(policyFindings)
        .where(eq(policyFindings.workspaceId, workspaceId));
      const findings =
        findingRows.length > 0
          ? findingRows.map((item) => fromJson<PolicyFinding>(item.documentJson, {
              id: item.id,
              policyId: item.policyId,
              policyTitle: "",
              policyOwner: "founder",
              severity: "low",
              status: "watch",
              ventureId: item.ventureId as VentureId,
              company: "",
              companyHref: "",
              finding: "",
              reason: "",
              requiredAction: "",
              title: "",
              actingRole: "founder",
              alliedRoles: [],
              briefing: false,
              expectedImpact: "",
              estimatedEffort: "",
              actionLabel: "",
              actionHref: "",
              evidence: [],
            }))
          : [];
      return {
        library: fromJson<PolicyLibrary>(row.libraryJson, []),
        findings,
      };
    },
  };
}

function createMemoryRepository(): ExecutiveMemoryRepository {
  return {
    async replaceForWorkspace(workspaceId, records, updatedAt) {
      const db = getDb();
      await db.delete(executiveMemory).where(eq(executiveMemory.workspaceId, workspaceId));
      if (records.length === 0) {
        return;
      }
      await db.insert(executiveMemory).values(
        records.map((item) => ({
          id: item.id,
          workspaceId,
          ventureId: item.ventureId ?? "",
          documentJson: toJson(item),
          updatedAt,
        })),
      );
    },
    async listForWorkspace(workspaceId) {
      const rows = await getDb()
        .select()
        .from(executiveMemory)
        .where(eq(executiveMemory.workspaceId, workspaceId));
      return rows.map((row) => fromJson<MemoryRecord>(row.documentJson, {
        id: row.id,
        ownerRoleId: "founder",
        recalledFrom: "",
        title: "",
        note: "",
        implication: "",
        briefing: false,
        desk: false,
      }));
    },
  };
}

function createDecisionRepository(): DecisionRepository {
  return {
    async replaceForWorkspace(workspaceId, items, updatedAt) {
      const db = getDb();
      await db.delete(decisions).where(eq(decisions.workspaceId, workspaceId));
      if (items.length === 0) {
        return;
      }
      await db.insert(decisions).values(
        items.map((item) => ({
          id: item.id,
          workspaceId,
          ventureId: item.ventureId,
          documentJson: toJson(item),
          updatedAt,
        })),
      );
    },
    async listForWorkspace(workspaceId) {
      const rows = await getDb()
        .select()
        .from(decisions)
        .where(eq(decisions.workspaceId, workspaceId));
      return rows.map((row) => fromJson<Decision>(row.documentJson, {
        id: row.id,
        ventureId: row.ventureId as VentureId,
        company: "",
        companyHref: "",
        ownerRoleId: "founder",
        question: "",
        title: "",
        recommendation: "",
        costOfInaction: "",
        decideBy: "",
        actionLabel: "",
        actionHref: "",
        status: "upcoming",
        briefing: false,
      }));
    },
  };
}

function createHealthRepository(): OperatingHealthRepository {
  return {
    async upsert(input) {
      const db = getDb();
      const existing = await db
        .select({ id: operatingHealth.id })
        .from(operatingHealth)
        .where(
          and(
            eq(operatingHealth.workspaceId, input.workspaceId),
            eq(operatingHealth.ventureId, input.ventureId),
          ),
        )
        .limit(1);

      if (existing[0]) {
        await db
          .update(operatingHealth)
          .set({
            documentJson: toJson(input.health),
            updatedAt: input.updatedAt,
          })
          .where(eq(operatingHealth.id, existing[0].id));
        return;
      }

      await db.insert(operatingHealth).values({
        id: input.id,
        workspaceId: input.workspaceId,
        ventureId: input.ventureId,
        documentJson: toJson(input.health),
        updatedAt: input.updatedAt,
      });
    },
    async find(workspaceId, ventureId) {
      const [row] = await getDb()
        .select()
        .from(operatingHealth)
        .where(
          and(
            eq(operatingHealth.workspaceId, workspaceId),
            eq(operatingHealth.ventureId, ventureId),
          ),
        )
        .limit(1);
      return row ? fromJson(row.documentJson, null) : null;
    },
  };
}

function createStoryRepository(): CompanyStoryRepository {
  return {
    async upsert(input) {
      const db = getDb();
      const existing = await db
        .select({ ventureId: companyStories.ventureId })
        .from(companyStories)
        .where(eq(companyStories.ventureId, input.ventureId))
        .limit(1);

      if (existing[0]) {
        await db
          .update(companyStories)
          .set({
            documentJson: toJson(input.story),
            updatedAt: input.updatedAt,
          })
          .where(eq(companyStories.ventureId, input.ventureId));
        return;
      }

      await db.insert(companyStories).values({
        ventureId: input.ventureId,
        workspaceId: input.workspaceId,
        documentJson: toJson(input.story),
        updatedAt: input.updatedAt,
      });
    },
    async find(ventureId) {
      const [row] = await getDb()
        .select()
        .from(companyStories)
        .where(eq(companyStories.ventureId, ventureId))
        .limit(1);
      return row ? fromJson<CompanyStory>(row.documentJson, {
        origin: "",
        thesis: "",
        promise: "",
        chapter: "",
        excerpt: "",
        tension: "",
        featured: false,
      }) : null;
    },
  };
}

function createKnowledgeRepository(): KnowledgeRepository {
  return {
    async replaceForVenture(workspaceId, ventureId, nodes, edges, updatedAt) {
      const db = getDb();
      await db
        .delete(knowledgeNodes)
        .where(
          and(
            eq(knowledgeNodes.workspaceId, workspaceId),
            eq(knowledgeNodes.ventureId, ventureId),
          ),
        );
      await db
        .delete(knowledgeEdges)
        .where(
          and(
            eq(knowledgeEdges.workspaceId, workspaceId),
            eq(knowledgeEdges.ventureId, ventureId),
          ),
        );
      if (nodes.length > 0) {
        await db.insert(knowledgeNodes).values(
          nodes.map((node) => ({
            id: `${ventureId}:${node.id}`,
            workspaceId,
            ventureId,
            documentJson: toJson(node),
            updatedAt,
          })),
        );
      }
      if (edges.length > 0) {
        await db.insert(knowledgeEdges).values(
          edges.map((edge) => ({
            id: `${ventureId}:${edge.id}`,
            workspaceId,
            ventureId,
            documentJson: toJson(edge),
            updatedAt,
          })),
        );
      }
    },
    async loadForVenture(workspaceId, ventureId) {
      const db = getDb();
      const nodes = await db
        .select()
        .from(knowledgeNodes)
        .where(
          and(
            eq(knowledgeNodes.workspaceId, workspaceId),
            eq(knowledgeNodes.ventureId, ventureId),
          ),
        );
      const edges = await db
        .select()
        .from(knowledgeEdges)
        .where(
          and(
            eq(knowledgeEdges.workspaceId, workspaceId),
            eq(knowledgeEdges.ventureId, ventureId),
          ),
        );
      return {
        nodes: nodes.map((row) => fromJson<KnowledgeNode>(row.documentJson, {
          id: row.id,
          kind: "note",
          label: "",
          properties: {},
        })),
        edges: edges.map((row) => fromJson<KnowledgeEdge>(row.documentJson, {
          id: row.id,
          kind: "related_to",
          fromId: "",
          toId: "",
        })),
      };
    },
  };
}

function createCoreRepository(): WorkspaceCoreRepository {
  return {
    async upsert(row: WorkspaceCoreRow) {
      const db = getDb();
      const existing = await db
        .select({ workspaceId: workspaceCores.workspaceId })
        .from(workspaceCores)
        .where(eq(workspaceCores.workspaceId, row.workspaceId))
        .limit(1);

      const values = {
        founderJson: toJson(row.founder),
        briefingJson: toJson(row.briefing),
        updatedAt: row.updatedAt,
      };

      if (existing[0]) {
        await db
          .update(workspaceCores)
          .set(values)
          .where(eq(workspaceCores.workspaceId, row.workspaceId));
        return;
      }

      await db.insert(workspaceCores).values({
        workspaceId: row.workspaceId,
        ...values,
      });
    },
    async find(workspaceId) {
      const [row] = await getDb()
        .select()
        .from(workspaceCores)
        .where(eq(workspaceCores.workspaceId, workspaceId))
        .limit(1);
      if (!row) {
        return null;
      }
      return {
        workspaceId: row.workspaceId as WorkspaceId,
        founder: fromJson(row.founderJson, {
          id: "founder",
          name: "Founder",
          title: "Founder",
          posture: "",
          worldLine: "",
        }),
        briefing: fromJson(row.briefingJson, {
          preparedBy: "Prepared by VentureOS AI",
          headline: "",
          narrative: "",
          implications: [],
        }),
        updatedAt: row.updatedAt,
      };
    },
  };
}

export function createSqlitePersistence(): Persistence {
  return {
    users: createUserRepository(),
    identities: createIdentityRepository(),
    sessions: createSessionRepository(),
    passwordResetTokens: createPasswordResetTokenRepository(),
    organisations: createOrganisationRepository(),
    memberships: createMembershipRepository(),
    ventures: createVentureRepository(),
    offices: createOfficeRepository(),
    recommendations: createRecommendationRepository(),
    policies: createPolicyRepository(),
    memory: createMemoryRepository(),
    decisions: createDecisionRepository(),
    health: createHealthRepository(),
    stories: createStoryRepository(),
    knowledge: createKnowledgeRepository(),
    cores: createCoreRepository(),
  };
}

let persistence: Persistence | undefined;

export function getPersistence(): Persistence {
  if (!persistence) {
    persistence = createSqlitePersistence();
  }
  return persistence;
}

export async function resetPersistenceLifecycle(databaseUrl = ":memory:") {
  persistence = undefined;
  await resetDatabaseLifecycle(databaseUrl);
}
