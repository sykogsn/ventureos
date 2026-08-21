import { sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const users = sqliteTable(
  "users",
  {
    id: text("id").primaryKey(),
    email: text("email").notNull(),
    passwordHash: text("password_hash").notNull(),
    name: text("name").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [uniqueIndex("users_email_idx").on(table.email)],
);

export const authIdentities = sqliteTable(
  "auth_identities",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    provider: text("provider").notNull(),
    providerSubject: text("provider_subject").notNull(),
    secretHash: text("secret_hash"),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    uniqueIndex("auth_identities_provider_subject_idx").on(
      table.provider,
      table.providerSubject,
    ),
  ],
);

export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  expiresAt: text("expires_at").notNull(),
  createdAt: text("created_at").notNull(),
});

export const passwordResetTokens = sqliteTable(
  "password_reset_tokens",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    tokenHash: text("token_hash").notNull(),
    expiresAt: text("expires_at").notNull(),
    usedAt: text("used_at"),
    createdAt: text("created_at").notNull(),
  },
  (table) => [uniqueIndex("password_reset_tokens_hash_idx").on(table.tokenHash)],
);

export const workspaces = sqliteTable(
  "workspaces",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [uniqueIndex("workspaces_slug_idx").on(table.slug)],
);

export const workspaceMembers = sqliteTable(
  "workspace_members",
  {
    workspaceId: text("workspace_id").notNull(),
    userId: text("user_id").notNull(),
    role: text("role").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    uniqueIndex("workspace_members_pk").on(table.workspaceId, table.userId),
  ],
);

export const workspaceCores = sqliteTable("workspace_cores", {
  workspaceId: text("workspace_id").primaryKey(),
  founderJson: text("founder_json").notNull(),
  briefingJson: text("briefing_json").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const ventures = sqliteTable(
  "ventures",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id").notNull(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    stage: text("stage").notNull(),
    href: text("href").notNull(),
    foundedAt: text("founded_at").notNull(),
    category: text("category").notNull(),
    owner: text("owner").notNull(),
    hqSummary: text("hq_summary").notNull(),
    genomeJson: text("genome_json").notNull(),
    missionJson: text("mission_json").notNull(),
    launchDraftJson: text("launch_draft_json").notNull(),
    documentsJson: text("documents_json").notNull(),
    riskJson: text("risk_json").notNull(),
    definitionId: text("definition_id").notNull().default(""),
    definitionVersion: text("definition_version").notNull().default(""),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("ventures_workspace_slug_idx").on(table.workspaceId, table.slug),
  ],
);

export const executiveOffices = sqliteTable(
  "executive_offices",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id").notNull(),
    ventureId: text("venture_id").notNull().default(""),
    documentJson: text("document_json").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("executive_offices_workspace_venture_idx").on(
      table.workspaceId,
      table.ventureId,
    ),
  ],
);

export const recommendations = sqliteTable("recommendations", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull(),
  ventureId: text("venture_id").notNull().default(""),
  documentJson: text("document_json").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const policyStates = sqliteTable("policy_states", {
  workspaceId: text("workspace_id").primaryKey(),
  libraryJson: text("library_json").notNull(),
  findingsJson: text("findings_json").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const policyFindings = sqliteTable("policy_findings", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull(),
  ventureId: text("venture_id").notNull(),
  policyId: text("policy_id").notNull(),
  documentJson: text("document_json").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const executiveMemory = sqliteTable("executive_memory", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull(),
  ventureId: text("venture_id").notNull().default(""),
  documentJson: text("document_json").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const decisions = sqliteTable("decisions", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull(),
  ventureId: text("venture_id").notNull(),
  documentJson: text("document_json").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const operatingHealth = sqliteTable(
  "operating_health",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id").notNull(),
    ventureId: text("venture_id").notNull().default(""),
    documentJson: text("document_json").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("operating_health_workspace_venture_idx").on(
      table.workspaceId,
      table.ventureId,
    ),
  ],
);

export const companyStories = sqliteTable("company_stories", {
  ventureId: text("venture_id").primaryKey(),
  workspaceId: text("workspace_id").notNull(),
  documentJson: text("document_json").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const knowledgeNodes = sqliteTable("knowledge_nodes", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull(),
  ventureId: text("venture_id").notNull().default(""),
  documentJson: text("document_json").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const knowledgeEdges = sqliteTable("knowledge_edges", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull(),
  ventureId: text("venture_id").notNull().default(""),
  documentJson: text("document_json").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const schema = {
  users,
  authIdentities,
  sessions,
  passwordResetTokens,
  workspaces,
  workspaceMembers,
  workspaceCores,
  ventures,
  executiveOffices,
  recommendations,
  policyStates,
  policyFindings,
  executiveMemory,
  decisions,
  operatingHealth,
  companyStories,
  knowledgeNodes,
  knowledgeEdges,
};
