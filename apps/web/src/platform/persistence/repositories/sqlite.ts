import { storedObjectDurability, SQLITE_DURABILITY_BUSY_TIMEOUT_MS } from "@/platform/persistence/durability-client";
import { createHash, randomUUID } from "node:crypto";
import type { Transaction } from "@libsql/client";
import type {
  IntelligenceCatalogue,
  IntelligenceCurrent,
  IntelligenceRevision,
  IntelligenceRepository,
  IntelligenceCommit,
  IntelligenceWrite,
} from "./ports";
import { and, asc, eq, isNull, lt } from "drizzle-orm";
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
import { getDatabaseUrl, getDb, resetDatabaseLifecycle } from "@/platform/persistence/db";
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
    async listByWorkspace(workspaceId) {
      const rows = await getDb()
        .select()
        .from(workspaceMembers)
        .where(eq(workspaceMembers.workspaceId, workspaceId))
        .orderBy(asc(workspaceMembers.createdAt), asc(workspaceMembers.userId));
      return rows.map((row) => ({
        workspaceId: row.workspaceId as WorkspaceId,
        userId: row.userId as UserId,
        role: row.role,
        createdAt: row.createdAt,
      }));
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
    intelligence: createIntelligenceRepository(),
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

// Storage integrity only. Semantic validation and live authority belong to the service.
const currentColumns = {
  id: "id",
  workspaceId: "workspace_id",
  originatingVentureId: "originating_venture_id",
  objectType: "object_type",
  currentRevision: "current_revision",
  currentRevisionId: "current_revision_id",
  documentJson: "document_json",
  documentHash: "document_hash",
  createdAt: "created_at",
  updatedAt: "updated_at",
} as const;
const revisionColumns = {
  revisionId: "revision_id",
  mutationId: "mutation_id",
  objectId: "object_id",
  workspaceId: "workspace_id",
  originatingVentureId: "originating_venture_id",
  objectType: "object_type",
  revision: "revision",
  mutationKind: "mutation_kind",
  documentJson: "document_json",
  documentHash: "document_hash",
  previousRevisionId: "previous_revision_id",
  previousRevisionHash: "previous_revision_hash",
  revisionHash: "revision_hash",
  recorderActorId: "recorder_actor_id",
  requiredPermission: "required_permission",
  semanticAuthorityRef: "semantic_authority_ref",
  reason: "reason",
  evaluationTime: "evaluation_time",
  catalogueVersion: "catalogue_version",
  createdAt: "created_at",
} as const;
function selectColumns(columns: Record<string, string>) {
  return Object.entries(columns)
    .map(([alias, column]) => column + " AS " + alias)
    .join(", ");
}
function digest(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}
function revisionDigest(r: Omit<IntelligenceRevision, "revisionHash">): string {
  // Versioned positional serialization; no implicit object-property ordering.
  return digest(
    JSON.stringify([
      "AIF-02-revision-v1",
      r.revisionId,
      r.previousRevisionId,
      r.previousRevisionHash,
      r.mutationId,
      r.objectId,
      r.workspaceId,
      r.originatingVentureId,
      r.objectType,
      r.revision,
      r.mutationKind,
      r.documentHash,
      r.recorderActorId,
      r.requiredPermission,
      r.semanticAuthorityRef,
      r.reason,
      r.evaluationTime,
      r.catalogueVersion,
      r.createdAt,
    ]),
  );
}
function integrity(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error("Intelligence integrity: " + message);
}
function integer(value: number, minimum: number) {
  return Number.isSafeInteger(value) && value >= minimum;
}
function verifyStoredCatalogue(
  workspaceId: string,
  catalogue: IntelligenceCatalogue,
) {
  integrity(integer(catalogue.version, 0), "invalid catalogue version");
  const objects = new Map(catalogue.objects.map((row) => [row.id, row]));
  const groups = new Map<string, IntelligenceRevision[]>();
  const mutations = new Map<number, { id: string; time: string }>();
  for (const r of catalogue.revisions) {
    integrity(
      r.workspaceId === workspaceId && objects.has(r.objectId),
      "orphan or foreign revision",
    );
    integrity(
      digest(r.documentJson) === r.documentHash,
      "revision document hash mismatch",
    );
    integrity(revisionDigest(r) === r.revisionHash, "revision hash mismatch");
    integrity(
      integer(r.catalogueVersion, 1) && r.catalogueVersion <= catalogue.version,
      "revision catalogue version",
    );
    integrity(
      r.createdAt === r.evaluationTime &&
        r.requiredPermission === "venture.update",
      "revision metadata",
    );
    const mutation = mutations.get(r.catalogueVersion);
    integrity(
      !mutation ||
        (mutation.id === r.mutationId && mutation.time === r.evaluationTime),
      "mutation/version disagreement",
    );
    mutations.set(r.catalogueVersion, {
      id: r.mutationId,
      time: r.evaluationTime,
    });
    const group = groups.get(r.objectId) ?? [];
    group.push(r);
    groups.set(r.objectId, group);
  }
  integrity(
    mutations.size === catalogue.version,
    "missing catalogue mutation history",
  );
  for (const row of catalogue.objects) {
    integrity(row.workspaceId === workspaceId, "foreign current row");
    integrity(
      digest(row.documentJson) === row.documentHash,
      "current document hash mismatch",
    );
    const revisions = groups.get(row.id) ?? [];
    integrity(
      integer(row.currentRevision, 1) &&
        revisions.length === row.currentRevision,
      "broken revision sequence",
    );
    for (let i = 0; i < revisions.length; i++) {
      const r = revisions[i]!,
        previous = revisions[i - 1];
      integrity(r.revision === i + 1, "broken revision sequence");
      integrity(
        r.previousRevisionId === (previous?.revisionId ?? null) &&
          r.previousRevisionHash === (previous?.revisionHash ?? null),
        "broken previous revision/hash",
      );
      integrity(
        r.objectType === row.objectType &&
          r.originatingVentureId === row.originatingVentureId,
        "row/revision ownership mismatch",
      );
      integrity(
        !previous ||
          (r.catalogueVersion > previous.catalogueVersion &&
            r.evaluationTime >= previous.evaluationTime),
        "revision chronology",
      );
    }
    const latest = revisions.at(-1)!;
    integrity(
      latest.revisionId === row.currentRevisionId &&
        latest.documentJson === row.documentJson &&
        latest.documentHash === row.documentHash &&
        latest.createdAt === row.updatedAt &&
        revisions[0]!.createdAt === row.createdAt,
      "current/latest revision mismatch",
    );
  }
}
async function readIntelligence(
  tx: Pick<Transaction, "execute">,
  workspaceId: string,
): Promise<IntelligenceCatalogue> {
  const head = await tx.execute({
    sql: "SELECT version FROM intelligence_catalogues WHERE workspace_id = ?",
    args: [workspaceId],
  });
  const current = await tx.execute({
    sql:
      "SELECT " +
      selectColumns(currentColumns) +
      " FROM intelligence_objects WHERE workspace_id = ? ORDER BY id",
    args: [workspaceId],
  });
  const history = await tx.execute({
    sql:
      "SELECT " +
      selectColumns(revisionColumns) +
      " FROM intelligence_revisions WHERE workspace_id = ? ORDER BY object_id, revision",
    args: [workspaceId],
  });
  const result: IntelligenceCatalogue = {
    version: Number(head.rows[0]?.version ?? 0),
    objects: current.rows as unknown as IntelligenceCurrent[],
    revisions: history.rows as unknown as IntelligenceRevision[],
  };
  verifyStoredCatalogue(workspaceId, result);
  return result;
}
async function insertRevision(
  tx: Pick<Transaction, "execute">,
  row: IntelligenceRevision,
) {
  const keys = Object.keys(revisionColumns) as (keyof IntelligenceRevision)[];
  await tx.execute({
    sql:
      "INSERT INTO intelligence_revisions (" +
      keys.map((k) => revisionColumns[k]).join(",") +
      ") VALUES (" +
      keys.map(() => "?").join(",") +
      ")",
    args: keys.map((k) => row[k]),
  });
}
function storageIdentity(write: IntelligenceWrite, workspaceId: string) {
  const record = JSON.parse(write.documentJson);
  integrity(
    record?.id === write.objectId &&
      record?.type === write.objectType &&
      record?.operatingScope?.workspaceId === workspaceId &&
      record?.operatingScope?.originatingVentureId ===
        write.originatingVentureId,
    "document/row identity mismatch",
  );
  return record;
}
async function commitIntelligence(
  input: IntelligenceCommit,
  writes: IntelligenceWrite[],
): Promise<IntelligenceCatalogue> {
  if (!integer(input.expectedCatalogueVersion, 0))
    throw new Error("Catalogue version conflict");
  if (
    !input.reason.trim() ||
    !input.recorderActorId.trim() ||
    input.requiredPermission !== "venture.update" ||
    new Date(input.evaluationTime).toISOString() !== input.evaluationTime
  )
    throw new Error("Invalid mutation metadata");
  const tx = await openIntelligenceTransaction("write");
  try {
    const before = await readIntelligence(tx, input.workspaceId);
    if (before.version !== input.expectedCatalogueVersion)
      throw new Error("Catalogue version conflict");
    const version = before.version + 1;
    integrity(integer(version, 1), "catalogue version overflow");
    const mutationId = randomUUID();
    for (const write of writes) {
      const record = storageIdentity(write, input.workspaceId);
      const current = before.objects.find((row) => row.id === write.objectId);
      const creating = write.mutationKind === "CREATE";
      if (
        !integer(write.expectedObjectRevision, 0) ||
        (current?.currentRevision ?? 0) !== write.expectedObjectRevision
      ) {
        throw new Error("Object revision conflict");
      }
      if (
        creating
          ? Boolean(current) || write.expectedObjectRevision !== 0
          : !current
      )
        throw new Error("Object revision conflict");
      if (current) {
        integrity(
          current.objectType === write.objectType &&
            current.originatingVentureId === write.originatingVentureId,
          "immutable object ownership",
        );
        const old = JSON.parse(current.documentJson);
        if (
          (old.type === "Claim" || old.type === "Learning") &&
          (old.validity === "RETRACTED" || old.validity === "SUPERSEDED")
        )
          throw new Error("Terminal validity cannot be mutated");
      }
      if (
        write.mutationKind === "RETRACT" ||
        write.mutationKind === "SUPERSEDE"
      ) {
        integrity(
          (record.type === "Claim" || record.type === "Learning") &&
            record.validity ===
              (write.mutationKind === "RETRACT" ? "RETRACTED" : "SUPERSEDED"),
          "unsupported validity mutation",
        );
      }
      const previous = before.revisions
        .filter((r) => r.objectId === write.objectId)
        .at(-1);
      const revision: IntelligenceRevision = {
        revisionId: randomUUID(),
        mutationId,
        objectId: write.objectId,
        workspaceId: input.workspaceId,
        originatingVentureId: write.originatingVentureId,
        objectType: write.objectType,
        revision: (current?.currentRevision ?? 0) + 1,
        mutationKind: write.mutationKind,
        documentJson: write.documentJson,
        documentHash: digest(write.documentJson),
        previousRevisionId: previous?.revisionId ?? null,
        previousRevisionHash: previous?.revisionHash ?? null,
        revisionHash: "",
        recorderActorId: input.recorderActorId,
        requiredPermission: input.requiredPermission,
        semanticAuthorityRef: input.semanticAuthorityRef ?? null,
        reason: input.reason,
        evaluationTime: input.evaluationTime,
        catalogueVersion: version,
        createdAt: input.evaluationTime,
      };
      revision.revisionHash = revisionDigest(revision);
      await insertRevision(tx, revision);
      if (creating) {
        await tx.execute({
          sql: "INSERT INTO intelligence_objects (id, workspace_id, originating_venture_id, object_type, current_revision, current_revision_id, document_json, document_hash, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)",
          args: [
            write.objectId,
            input.workspaceId,
            write.originatingVentureId,
            write.objectType,
            revision.revision,
            revision.revisionId,
            revision.documentJson,
            revision.documentHash,
            input.evaluationTime,
            input.evaluationTime,
          ],
        });
      } else {
        const result = await tx.execute({
          sql: "UPDATE intelligence_objects SET current_revision = ?, current_revision_id = ?, document_json = ?, document_hash = ?, updated_at = ? WHERE id = ? AND workspace_id = ? AND current_revision = ?",
          args: [
            revision.revision,
            revision.revisionId,
            revision.documentJson,
            revision.documentHash,
            input.evaluationTime,
            write.objectId,
            input.workspaceId,
            write.expectedObjectRevision,
          ],
        });
        if (result.rowsAffected !== 1)
          throw new Error("Object revision conflict");
      }
    }
    if (before.version === 0) {
      await tx.execute({
        sql: "INSERT INTO intelligence_catalogues (workspace_id, version, updated_at) VALUES (?,?,?)",
        args: [input.workspaceId, version, input.evaluationTime],
      });
    } else {
      const result = await tx.execute({
        sql: "UPDATE intelligence_catalogues SET version = ?, updated_at = ? WHERE workspace_id = ? AND version = ?",
        args: [
          version,
          input.evaluationTime,
          input.workspaceId,
          before.version,
        ],
      });
      if (result.rowsAffected !== 1)
        throw new Error("Catalogue version conflict");
    }
    const result = await readIntelligence(tx, input.workspaceId);
    await tx.commit();
    return result;
  } finally {
    // close() rolls back any open transaction, including database failures.
    await tx.close();
  }
}
function createIntelligenceRepository(): IntelligenceRepository {
  return {
    async loadCatalogue(workspaceId) {
      const tx = await openIntelligenceTransaction("read");
      try {
        return await readIntelligence(tx, workspaceId);
      } finally {
        await tx.close();
      }
    },
    async findCurrent(workspaceId, objectId) {
      return (
        (await this.loadCatalogue(workspaceId)).objects.find(
          (row) => row.id === objectId,
        ) ?? null
      );
    },
    async listCurrent(workspaceId) {
      return (await this.loadCatalogue(workspaceId)).objects;
    },
    async listCurrentForVenture(workspaceId, ventureId) {
      return (await this.listCurrent(workspaceId)).filter(
        (row) => row.originatingVentureId === ventureId,
      );
    },
    async traceObject(workspaceId, objectId) {
      return (await this.loadCatalogue(workspaceId)).revisions.filter(
        (row) => row.objectId === objectId,
      );
    },
    async commitMutation(input) {
      if (!["CREATE", "AMEND", "RETRACT"].includes(input.write.mutationKind))
        throw new Error("Use atomic supersession");
      return commitIntelligence(input, [input.write]);
    },
    async commitSupersession(input) {
      const old = storageIdentity(input.predecessor, input.workspaceId);
      const next = storageIdentity(input.successor, input.workspaceId);
      integrity(
        input.predecessor.mutationKind === "SUPERSEDE" &&
          input.successor.mutationKind === "CREATE" &&
          old.supersededById === next.id &&
          old.id !== next.id &&
          old.type === next.type &&
          (old.type === "Claim" || old.type === "Learning"),
        "invalid supersession pair",
      );
      return commitIntelligence(input, [input.successor, input.predecessor]);
    },
  };
}

/** AIF-02 owns a short-lived SQLite connection so transaction handles are closed deterministically. */
async function openIntelligenceTransaction(mode: "read" | "write") {
  const url = getDatabaseUrl();
  if (!url.startsWith("file:") || url.includes(":memory:")) {
    throw new Error(
      "Operational intelligence requires a file-backed SQLite database",
    );
  }
  const client = storedObjectDurability.openClient(SQLITE_DURABILITY_BUSY_TIMEOUT_MS);
  let active = false;
  try {
    await client.execute(mode === "write" ? "BEGIN IMMEDIATE" : "BEGIN");
    active = true;
  } catch (error) {
    storedObjectDurability.disposeClient(client);
    throw error;
  }
  return {
    execute: client.execute.bind(client),
    async commit() {
      await client.execute("COMMIT");
      active = false;
    },
    async close() {
      try {
        if (active) await client.execute("ROLLBACK");
      } finally {
        active = false;
        storedObjectDurability.disposeClient(client);
      }
    },
  };
}
