import type { UserId, WorkspaceId, VentureId } from "@/contracts";
import type { CompanyStory } from "@/core/company-story";
import type { Decision } from "@/core/decision-engine";
import type { DocumentIntelligence } from "@/core/document-intelligence";
import type { ExecutiveOffice } from "@/core/executive-office";
import type { MemoryRecord } from "@/core/executive-memory";
import type { FounderIdentity } from "@/core/identity";
import type { KnowledgeEdge, KnowledgeNode } from "@/core/knowledge-graph";
import type { MissionEngine } from "@/core/mission-engine";
import type { OperatingHealth, PortfolioHealth } from "@/core/operating-health";
import type { PolicyFinding, PolicyLibrary } from "@/core/policy";
import type { ExecutiveBriefing, Recommendation } from "@/core/recommendation";
import type { RiskIntelligence } from "@/core/risk-intelligence";
import type { VentureGenome } from "@/core/venture-genome";

export type AuthProvider = "password" | "google" | "github" | "apple";

export type UserRow = {
  id: UserId;
  email: string;
  name: string;
  passwordHash: string;
  createdAt: string;
};

export type AuthIdentityRow = {
  id: string;
  userId: UserId;
  provider: AuthProvider;
  providerSubject: string;
  secretHash: string | null;
  createdAt: string;
};

export type SessionRow = {
  id: string;
  userId: UserId;
  expiresAt: string;
  createdAt: string;
};

export type PasswordResetTokenRow = {
  id: string;
  userId: UserId;
  tokenHash: string;
  expiresAt: string;
  usedAt: string | null;
  createdAt: string;
};

export type OrganisationRow = {
  id: WorkspaceId;
  name: string;
  slug: string;
  createdAt: string;
};

export type MembershipRow = {
  workspaceId: WorkspaceId;
  userId: UserId;
  role: string;
  createdAt: string;
};

export type PersistedVenture = {
  id: VentureId;
  workspaceId: WorkspaceId;
  name: string;
  slug: string;
  stage: string;
  href: string;
  foundedAt: string;
  category: string;
  owner: string;
  hqSummary: string;
  genome: VentureGenome;
  mission: MissionEngine;
  launchDraft: unknown;
  documents: DocumentIntelligence;
  risk: RiskIntelligence;
  definitionId: string;
  definitionVersion: string;
  createdAt: string;
  updatedAt: string;
};

export type WorkspaceCoreRow = {
  workspaceId: WorkspaceId;
  founder: FounderIdentity;
  briefing: ExecutiveBriefing;
  updatedAt: string;
};

export type UserRepository = {
  findById(id: UserId): Promise<UserRow | null>;
  findByEmail(email: string): Promise<UserRow | null>;
  insert(row: UserRow): Promise<void>;
  updatePasswordHash(id: UserId, passwordHash: string): Promise<void>;
};

export type IdentityRepository = {
  findByProvider(provider: AuthProvider, subject: string): Promise<AuthIdentityRow | null>;
  listForUser(userId: UserId): Promise<AuthIdentityRow[]>;
  insert(row: AuthIdentityRow): Promise<void>;
  updateSecretHash(id: string, secretHash: string): Promise<void>;
};

export type SessionRepository = {
  insert(row: SessionRow): Promise<void>;
  findById(id: string): Promise<SessionRow | null>;
  deleteById(id: string): Promise<void>;
  deleteByUserId(userId: UserId): Promise<void>;
  deleteExpired(nowIso: string): Promise<void>;
};

export type PasswordResetTokenRepository = {
  insert(row: PasswordResetTokenRow): Promise<void>;
  findByTokenHash(tokenHash: string): Promise<PasswordResetTokenRow | null>;
  markUsed(id: string, usedAt: string): Promise<void>;
  deleteExpired(nowIso: string): Promise<void>;
  deleteUnusedForUser(userId: UserId): Promise<void>;
};

export type OrganisationRepository = {
  insert(row: OrganisationRow): Promise<void>;
  findById(id: WorkspaceId): Promise<OrganisationRow | null>;
  findBySlug(slug: string): Promise<OrganisationRow | null>;
  listForUser(userId: UserId): Promise<OrganisationRow[]>;
};

export type MembershipRepository = {
  insert(row: MembershipRow): Promise<void>;
  getRole(userId: UserId, workspaceId: WorkspaceId): Promise<string | null>;
  setRole(row: MembershipRow): Promise<void>;
};

export type VentureRepository = {
  insert(row: PersistedVenture): Promise<void>;
  update(row: PersistedVenture): Promise<void>;
  findById(id: VentureId): Promise<PersistedVenture | null>;
  findBySlug(workspaceId: WorkspaceId, slug: string): Promise<PersistedVenture | null>;
  listByWorkspace(workspaceId: WorkspaceId): Promise<PersistedVenture[]>;
  slugTaken(workspaceId: WorkspaceId, slug: string): Promise<boolean>;
};

export type ExecutiveOfficeRepository = {
  upsert(input: {
    id: string;
    workspaceId: WorkspaceId;
    ventureId: string;
    office: ExecutiveOffice;
    updatedAt: string;
  }): Promise<void>;
  find(workspaceId: WorkspaceId, ventureId: string): Promise<ExecutiveOffice | null>;
};

export type RecommendationRepository = {
  replaceForScope(
    workspaceId: WorkspaceId,
    ventureId: string,
    items: Recommendation[],
    updatedAt: string,
  ): Promise<void>;
  replaceForWorkspace(
    workspaceId: WorkspaceId,
    items: Recommendation[],
    updatedAt: string,
  ): Promise<void>;
  listForWorkspace(workspaceId: WorkspaceId): Promise<Recommendation[]>;
};

export type PolicyRepository = {
  upsertState(input: {
    workspaceId: WorkspaceId;
    library: PolicyLibrary;
    findings: PolicyFinding[];
    updatedAt: string;
  }): Promise<void>;
  replaceFindings(
    workspaceId: WorkspaceId,
    findings: PolicyFinding[],
    updatedAt: string,
  ): Promise<void>;
  loadState(workspaceId: WorkspaceId): Promise<{
    library: PolicyLibrary;
    findings: PolicyFinding[];
  } | null>;
};

export type ExecutiveMemoryRepository = {
  replaceForWorkspace(
    workspaceId: WorkspaceId,
    records: MemoryRecord[],
    updatedAt: string,
  ): Promise<void>;
  listForWorkspace(workspaceId: WorkspaceId): Promise<MemoryRecord[]>;
};

export type DecisionRepository = {
  replaceForWorkspace(
    workspaceId: WorkspaceId,
    items: Decision[],
    updatedAt: string,
  ): Promise<void>;
  listForWorkspace(workspaceId: WorkspaceId): Promise<Decision[]>;
};

export type OperatingHealthRepository = {
  upsert(input: {
    id: string;
    workspaceId: WorkspaceId;
    ventureId: string;
    health: OperatingHealth | PortfolioHealth;
    updatedAt: string;
  }): Promise<void>;
  find(workspaceId: WorkspaceId, ventureId: string): Promise<unknown | null>;
};

export type CompanyStoryRepository = {
  upsert(input: {
    ventureId: VentureId;
    workspaceId: WorkspaceId;
    story: CompanyStory;
    updatedAt: string;
  }): Promise<void>;
  find(ventureId: VentureId): Promise<CompanyStory | null>;
};

export type KnowledgeRepository = {
  replaceForVenture(
    workspaceId: WorkspaceId,
    ventureId: string,
    nodes: KnowledgeNode[],
    edges: KnowledgeEdge[],
    updatedAt: string,
  ): Promise<void>;
  loadForVenture(
    workspaceId: WorkspaceId,
    ventureId: string,
  ): Promise<{ nodes: KnowledgeNode[]; edges: KnowledgeEdge[] }>;
};

export type WorkspaceCoreRepository = {
  upsert(row: WorkspaceCoreRow): Promise<void>;
  find(workspaceId: WorkspaceId): Promise<WorkspaceCoreRow | null>;
};

export type Persistence = {
  users: UserRepository;
  identities: IdentityRepository;
  sessions: SessionRepository;
  passwordResetTokens: PasswordResetTokenRepository;
  organisations: OrganisationRepository;
  memberships: MembershipRepository;
  ventures: VentureRepository;
  offices: ExecutiveOfficeRepository;
  recommendations: RecommendationRepository;
  policies: PolicyRepository;
  memory: ExecutiveMemoryRepository;
  decisions: DecisionRepository;
  health: OperatingHealthRepository;
  stories: CompanyStoryRepository;
  knowledge: KnowledgeRepository;
  cores: WorkspaceCoreRepository;
};
