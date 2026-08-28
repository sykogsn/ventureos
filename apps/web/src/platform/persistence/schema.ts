import {
  index,
  integer,
  primaryKey,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

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
    lifecycle: text("lifecycle").notNull().default("operating"),
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

export const jobs = sqliteTable(
  "jobs",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    payloadJson: text("payload_json").notNull(),
    status: text("status").notNull(),
    runAt: text("run_at").notNull(),
    attempts: integer("attempts", { mode: "number" }).notNull(),
    lastError: text("last_error"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [index("jobs_status_run_at_idx").on(table.status, table.runAt)],
);

export const auditEvents = sqliteTable(
  "audit_events",
  {
    id: text("id").primaryKey(),
    action: text("action").notNull(),
    occurredAt: text("occurred_at").notNull(),
    actorUserId: text("actor_user_id"),
    actorKind: text("actor_kind"),
    actorAgentInstanceId: text("actor_agent_instance_id"),
    actorComponent: text("actor_component"),
    workspaceId: text("workspace_id").notNull().default(""),
    ventureId: text("venture_id").notNull().default(""),
    metadataJson: text("metadata_json").notNull(),
  },
  (table) => [
    index("audit_events_occurred_at_idx").on(table.occurredAt),
    index("audit_events_workspace_idx").on(table.workspaceId),
  ],
);

export const workforceExecutions = sqliteTable(
  "workforce_executions",
  {
    id: text("id").primaryKey(),
    idempotencyKey: text("idempotency_key").notNull(),
    workspaceId: text("workspace_id").notNull(),
    ventureId: text("venture_id").notNull(),
    agentInstanceId: text("agent_instance_id").notNull(),
    capabilityId: text("capability_id").notNull(),
    sourceRequestId: text("source_request_id").notNull(),
    sourceActionIndex: integer("source_action_index", { mode: "number" }).notNull(),
    argumentHash: text("argument_hash").notNull(),
    fingerprintHash: text("fingerprint_hash").notNull(),
    status: text("status").notNull(),
    authorityContextVersion: text("authority_context_version").notNull(),
    authorityEvaluatedAt: text("authority_evaluated_at").notNull(),
    outcomeJson: text("outcome_json"),
    errorCategory: text("error_category"),
    implementationId: text("implementation_id"),
    implementationVersion: text("implementation_version"),
    externalReference: text("external_reference"),
    startedAt: text("started_at").notNull(),
    completedAt: text("completed_at"),
  },
  (table) => [
    uniqueIndex("workforce_executions_idempotency_idx").on(table.idempotencyKey),
    index("workforce_executions_workspace_venture_idx").on(
      table.workspaceId,
      table.ventureId,
    ),
    index("workforce_executions_status_idx").on(table.status),
  ],
);

export const agentDefinitions = sqliteTable(
  "agent_definitions",
  {
    id: text("id").notNull(),
    version: text("version").notNull(),
    role: text("role").notNull(),
    responsibilitiesJson: text("responsibilities_json").notNull(),
    capabilityAllowJson: text("capability_allow_json").notNull(),
    capabilityDenyJson: text("capability_deny_json").notNull(),
    autonomyCeiling: text("autonomy_ceiling").notNull(),
    approvalBoundary: text("approval_boundary").notNull(),
    memoryPolicy: text("memory_policy").notNull(),
    escalationPolicy: text("escalation_policy").notNull(),
    evaluationProfile: text("evaluation_profile").notNull(),
    lifecycle: text("lifecycle").notNull(),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [primaryKey({ columns: [table.id, table.version] })],
);

export const agentInstances = sqliteTable(
  "agent_instances",
  {
    id: text("id").primaryKey(),
    definitionId: text("definition_id").notNull(),
    definitionVersion: text("definition_version").notNull(),
    workspaceId: text("workspace_id").notNull(),
    ventureId: text("venture_id").notNull(),
    status: text("status").notNull(),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    index("agent_instances_workspace_venture_idx").on(
      table.workspaceId,
      table.ventureId,
    ),
  ],
);

export const workforceRuns = sqliteTable(
  "workforce_runs",
  {
    id: text("id").primaryKey(),
    jobId: text("job_id"),
    workspaceId: text("workspace_id").notNull(),
    ventureId: text("venture_id").notNull(),
    agentInstanceId: text("agent_instance_id").notNull(),
    definitionId: text("definition_id").notNull(),
    definitionVersion: text("definition_version").notNull(),
    objective: text("objective").notNull(),
    phase: text("phase").notNull(),
    completionKind: text("completion_kind"),
    failureCategory: text("failure_category"),
    sourceRequestId: text("source_request_id").notNull(),
    selectedCapabilityId: text("selected_capability_id"),
    selectedActionIndex: integer("selected_action_index", { mode: "number" }),
    selectedActionJson: text("selected_action_json"),
    argumentHash: text("argument_hash"),
    fingerprintHash: text("fingerprint_hash"),
    executionId: text("execution_id"),
    approvalId: text("approval_id"),
    verificationOutcome: text("verification_outcome"),
    modelCallCount: integer("model_call_count", { mode: "number" }).notNull(),
    requestedByUserId: text("requested_by_user_id").notNull(),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
    completedAt: text("completed_at"),
  },
  (table) => [
    index("workforce_runs_phase_idx").on(table.phase),
    index("workforce_runs_workspace_idx").on(table.workspaceId),
  ],
);

export const workforceApprovals = sqliteTable(
  "workforce_approvals",
  {
    id: text("id").primaryKey(),
    runId: text("run_id").notNull(),
    workspaceId: text("workspace_id").notNull(),
    ventureId: text("venture_id").notNull(),
    agentInstanceId: text("agent_instance_id").notNull(),
    capabilityId: text("capability_id").notNull(),
    sourceRequestId: text("source_request_id").notNull(),
    sourceActionIndex: integer("source_action_index", { mode: "number" }).notNull(),
    argumentHash: text("argument_hash").notNull(),
    fingerprintHash: text("fingerprint_hash").notNull(),
    status: text("status").notNull(),
    requestedAt: text("requested_at").notNull(),
    expiresAt: text("expires_at").notNull(),
    decidedAt: text("decided_at"),
    decidedByUserId: text("decided_by_user_id"),
  },
  (table) => [
    uniqueIndex("workforce_approvals_run_idx").on(table.runId),
    index("workforce_approvals_status_workspace_idx").on(
      table.status,
      table.workspaceId,
    ),
  ],
);

export const workforceVerifications = sqliteTable(
  "workforce_verifications",
  {
    id: text("id").primaryKey(),
    runId: text("run_id").notNull(),
    executionId: text("execution_id").notNull(),
    workspaceId: text("workspace_id").notNull(),
    ventureId: text("venture_id").notNull(),
    agentInstanceId: text("agent_instance_id").notNull(),
    capabilityId: text("capability_id").notNull(),
    sourceRequestId: text("source_request_id").notNull(),
    sourceActionIndex: integer("source_action_index", { mode: "number" }).notNull(),
    predicateId: text("predicate_id").notNull(),
    predicateVersion: text("predicate_version").notNull(),
    predicateFingerprint: text("predicate_fingerprint").notNull(),
    expectedJson: text("expected_json").notNull(),
    status: text("status").notNull(),
    failureCategory: text("failure_category"),
    attemptCount: integer("attempt_count", { mode: "number" }).notNull(),
    observationJson: text("observation_json"),
    evidenceJson: text("evidence_json"),
    provenance: text("provenance"),
    claimNonce: text("claim_nonce"),
    implementationId: text("implementation_id"),
    implementationVersion: text("implementation_version"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
    completedAt: text("completed_at"),
  },
  (table) => [
    uniqueIndex("workforce_verifications_run_idx").on(table.runId),
    index("workforce_verifications_status_idx").on(table.status),
  ],
);

export const frigoraCustomers = sqliteTable(
  "frigora_customers",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id").notNull(),
    ventureId: text("venture_id").notNull(),
    code: text("code").notNull(),
    displayName: text("display_name").notNull(),
    legalName: text("legal_name"),
    status: text("status").notNull().default("active"),
    notes: text("notes"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("frigora_customers_venture_code_idx").on(table.ventureId, table.code),
    index("frigora_customers_workspace_venture_idx").on(
      table.workspaceId,
      table.ventureId,
    ),
    index("frigora_customers_venture_status_idx").on(table.ventureId, table.status),
  ],
);

export const frigoraSites = sqliteTable(
  "frigora_sites",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id").notNull(),
    ventureId: text("venture_id").notNull(),
    customerId: text("customer_id").notNull(),
    code: text("code").notNull(),
    name: text("name").notNull(),
    addressLine1: text("address_line1"),
    addressLine2: text("address_line2"),
    city: text("city"),
    region: text("region"),
    postalCode: text("postal_code"),
    country: text("country"),
    status: text("status").notNull().default("active"),
    notes: text("notes"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("frigora_sites_customer_code_idx").on(table.customerId, table.code),
    index("frigora_sites_workspace_venture_idx").on(table.workspaceId, table.ventureId),
    index("frigora_sites_customer_idx").on(table.customerId),
    index("frigora_sites_venture_status_idx").on(table.ventureId, table.status),
  ],
);

export const frigoraAssets = sqliteTable(
  "frigora_assets",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id").notNull(),
    ventureId: text("venture_id").notNull(),
    siteId: text("site_id").notNull(),
    tag: text("tag").notNull(),
    name: text("name"),
    assetKind: text("asset_kind"),
    manufacturer: text("manufacturer"),
    model: text("model"),
    serialNumber: text("serial_number"),
    status: text("status").notNull().default("active"),
    designTargetCelsius: real("design_target_celsius"),
    refrigerantType: text("refrigerant_type"),
    locationOnSite: text("location_on_site"),
    installedOn: text("installed_on"),
    commissionedOn: text("commissioned_on"),
    notes: text("notes"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("frigora_assets_site_tag_idx").on(table.siteId, table.tag),
    index("frigora_assets_workspace_venture_idx").on(table.workspaceId, table.ventureId),
    index("frigora_assets_site_idx").on(table.siteId),
    index("frigora_assets_venture_status_idx").on(table.ventureId, table.status),
  ],
);

export const frigoraWorkOrders = sqliteTable(
  "frigora_work_orders",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id").notNull(),
    ventureId: text("venture_id").notNull(),
    customerId: text("customer_id").notNull(),
    siteId: text("site_id").notNull(),
    primaryAssetId: text("primary_asset_id"),
    workReference: text("work_reference").notNull(),
    workKind: text("work_kind").notNull(),
    reportedCondition: text("reported_condition"),
    status: text("status").notNull().default("open"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
    assignedUserId: text("assigned_user_id"),
  },
  (table) => [
    uniqueIndex("frigora_work_orders_venture_reference_idx").on(
      table.ventureId,
      table.workReference,
    ),
    index("frigora_work_orders_workspace_venture_idx").on(table.workspaceId, table.ventureId),
    index("frigora_work_orders_venture_status_idx").on(table.ventureId, table.status),
    index("frigora_work_orders_customer_idx").on(table.customerId),
    index("frigora_work_orders_site_idx").on(table.siteId),
    index("frigora_work_orders_primary_asset_idx").on(table.primaryAssetId),
    index("frigora_work_orders_venture_assignee_idx").on(
      table.ventureId,
      table.assignedUserId,
    ),
  ],
);

export const frigoraVisits = sqliteTable(
  "frigora_visits",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id").notNull(),
    ventureId: text("venture_id").notNull(),
    workOrderId: text("work_order_id").notNull(),
    attendingUserId: text("attending_user_id").notNull(),
    arrivedAt: text("arrived_at").notNull(),
    departedAt: text("departed_at"),
    status: text("status").notNull().default("open"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    index("frigora_visits_workspace_venture_idx").on(table.workspaceId, table.ventureId),
    index("frigora_visits_venture_work_order_idx").on(table.ventureId, table.workOrderId),
    index("frigora_visits_venture_attending_user_idx").on(
      table.ventureId,
      table.attendingUserId,
    ),
  ],
);

export const frigoraFieldCaptures = sqliteTable(
  "frigora_field_captures",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id").notNull(),
    ventureId: text("venture_id").notNull(),
    visitId: text("visit_id").notNull(),
    workOrderId: text("work_order_id").notNull(),
    assetId: text("asset_id"),
    captureKind: text("capture_kind").notNull(),
    captureCode: text("capture_code").notNull(),
    valueNumeric: real("value_numeric"),
    valueUnit: text("value_unit"),
    description: text("description"),
    observedAt: text("observed_at").notNull(),
    capturedByUserId: text("captured_by_user_id").notNull(),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    index("frigora_field_captures_venture_visit_idx").on(table.ventureId, table.visitId),
    index("frigora_field_captures_venture_work_order_idx").on(
      table.ventureId,
      table.workOrderId,
    ),
    index("frigora_field_captures_venture_asset_idx").on(table.ventureId, table.assetId),
  ],
);

export const frigoraTechnicalFindings = sqliteTable(
  "frigora_technical_findings",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id").notNull(),
    ventureId: text("venture_id").notNull(),
    visitId: text("visit_id").notNull(),
    workOrderId: text("work_order_id").notNull(),
    assetId: text("asset_id"),
    findingKind: text("finding_kind").notNull(),
    description: text("description").notNull(),
    sourceFieldCaptureIds: text("source_field_capture_ids"),
    assertedAt: text("asserted_at").notNull(),
    recordedByUserId: text("recorded_by_user_id").notNull(),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    index("frigora_technical_findings_venture_visit_idx").on(table.ventureId, table.visitId),
    index("frigora_technical_findings_venture_work_order_idx").on(
      table.ventureId,
      table.workOrderId,
    ),
    index("frigora_technical_findings_venture_asset_idx").on(table.ventureId, table.assetId),
  ],
);

export const frigoraCorrectiveActions = sqliteTable(
  "frigora_corrective_actions",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id").notNull(),
    ventureId: text("venture_id").notNull(),
    visitId: text("visit_id").notNull(),
    workOrderId: text("work_order_id").notNull(),
    assetId: text("asset_id"),
    description: text("description").notNull(),
    sourceTechnicalFindingIds: text("source_technical_finding_ids"),
    performedAt: text("performed_at").notNull(),
    performedByUserId: text("performed_by_user_id").notNull(),
    recordedByUserId: text("recorded_by_user_id").notNull(),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    index("frigora_corrective_actions_venture_visit_idx").on(table.ventureId, table.visitId),
    index("frigora_corrective_actions_venture_work_order_idx").on(
      table.ventureId,
      table.workOrderId,
    ),
    index("frigora_corrective_actions_venture_asset_idx").on(table.ventureId, table.assetId),
  ],
);

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
  jobs,
  auditEvents,
  workforceExecutions,
  agentDefinitions,
  agentInstances,
  workforceRuns,
  workforceApprovals,
  workforceVerifications,
  frigoraCustomers,
  frigoraSites,
  frigoraAssets,
  frigoraWorkOrders,
  frigoraVisits,
  frigoraFieldCaptures,
  frigoraTechnicalFindings,
  frigoraCorrectiveActions,
};
