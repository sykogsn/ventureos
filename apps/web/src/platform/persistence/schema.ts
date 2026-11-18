import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  primaryKey,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

export const frigoraEngineerUnavailability = sqliteTable(
  "frigora_engineer_unavailability",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id").notNull(),
    ventureId: text("venture_id").notNull(),
    userId: text("user_id").notNull(),
    unavailableStartAt: text("unavailable_start_at").notNull(),
    unavailableEndAt: text("unavailable_end_at").notNull(),
    createdByUserId: text("created_by_user_id").notNull(),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    check("frigora_unavailability_valid_window", sql`${table.unavailableEndAt} > ${table.unavailableStartAt}`),
    index("frigora_unavailability_engineer_range_idx").on(table.workspaceId, table.ventureId, table.userId, table.unavailableStartAt, table.unavailableEndAt),
    index("frigora_unavailability_venture_date_idx").on(table.workspaceId, table.ventureId, table.unavailableStartAt, table.unavailableEndAt),
  ],
);

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

export const workspaceInvitations = sqliteTable(
  "workspace_invitations",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id").notNull(),
    email: text("email").notNull(),
    role: text("role").notNull(),
    invitedBy: text("invited_by").notNull(),
    tokenHash: text("token_hash").notNull(),
    expiresAt: text("expires_at").notNull(),
    acceptedAt: text("accepted_at"),
    revokedAt: text("revoked_at"),
    createdAt: text("created_at").notNull(),
    activeSlot: text("active_slot"),
  },
  (table) => [
    uniqueIndex("workspace_invitations_token_hash_idx").on(table.tokenHash),
    index("workspace_invitations_workspace_email_idx").on(table.workspaceId, table.email),
    check("workspace_invitations_role_chk", sql`${table.role} IN ('admin', 'member')`),
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
    uniqueIndex("ventures_id_workspace_uidx").on(table.id, table.workspaceId),
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

export const storedObjects = sqliteTable(
  "stored_objects",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id").notNull(),
    ventureId: text("venture_id"),
    storageKey: text("storage_key").notNull(),
    originalFilename: text("original_filename").notNull(),
    mimeType: text("mime_type").notNull(),
    sizeBytes: integer("size_bytes", { mode: "number" }).notNull(),
    sha256: text("sha256").notNull(),
    createdByUserId: text("created_by_user_id").notNull(),
    createdAt: text("created_at").notNull(),
    deletedAt: text("deleted_at"),
  },
  (table) => [
    uniqueIndex("stored_objects_storage_key_idx").on(table.storageKey),
    index("stored_objects_workspace_idx").on(table.workspaceId),
    index("stored_objects_workspace_venture_idx").on(table.workspaceId, table.ventureId),
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
    priority: text("priority").notNull().default("normal"),
    reportedCondition: text("reported_condition"),
    status: text("status").notNull().default("open"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
    assignedUserId: text("assigned_user_id"),
    scheduledStartAt: text("scheduled_start_at"),
    scheduledEndAt: text("scheduled_end_at"),
    assignmentAcceptedAt: text("assignment_accepted_at"),
    assignmentDeclinedAt: text("assignment_declined_at"),
    assignmentDeclineReason: text("assignment_decline_reason"),
    cancellationReason: text("cancellation_reason"),
    sourceRecommendedActionId: text("source_recommended_action_id"),
    authorisingQuotationId: text("authorising_quotation_id"),
    authorisingQuotationVersion: integer("authorising_quotation_version"),
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
    index("frigora_work_orders_venture_scheduled_start_idx").on(
      table.ventureId,
      table.scheduledStartAt,
    ),
    uniqueIndex("frigora_work_orders_source_recommended_action_idx").on(
      table.sourceRecommendedActionId,
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
    labourHourlyChargeCents: integer("labour_hourly_charge_cents"),
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

/** Append-only Frigora dispatch operational history (F34-01). */
export const frigoraDispatchEvents = sqliteTable(
  "frigora_dispatch_events",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id").notNull(),
    ventureId: text("venture_id").notNull(),
    workOrderId: text("work_order_id").notNull(),
    eventType: text("event_type").notNull(),
    actorUserId: text("actor_user_id").notNull(),
    occurredAt: text("occurred_at").notNull(),
    previousAssignedUserId: text("previous_assigned_user_id"),
    nextAssignedUserId: text("next_assigned_user_id"),
    previousScheduledStartAt: text("previous_scheduled_start_at"),
    previousScheduledEndAt: text("previous_scheduled_end_at"),
    nextScheduledStartAt: text("next_scheduled_start_at"),
    nextScheduledEndAt: text("next_scheduled_end_at"),
  },
  (table) => [
    index("frigora_dispatch_events_ws_ven_wo_occurred_idx").on(
      table.workspaceId,
      table.ventureId,
      table.workOrderId,
      table.occurredAt,
    ),
    index("frigora_dispatch_events_ws_ven_occurred_idx").on(
      table.workspaceId,
      table.ventureId,
      table.occurredAt,
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

/** F33-03 authoritative server receipt for idempotent client operations. */
export const frigoraClientOperationReceipts = sqliteTable(
  "frigora_client_operation_receipts",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id").notNull(),
    ventureId: text("venture_id").notNull(),
    actorUserId: text("actor_user_id").notNull(),
    clientOperationId: text("client_operation_id").notNull(),
    operationType: text("operation_type").notNull(),
    workOrderId: text("work_order_id").notNull(),
    visitId: text("visit_id"),
    requestFingerprint: text("request_fingerprint").notNull(),
    acceptedEntityId: text("accepted_entity_id").notNull(),
    acceptedAt: text("accepted_at").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    uniqueIndex("frigora_client_operation_receipts_venture_client_op_idx").on(
      table.ventureId,
      table.clientOperationId,
    ),
    index("frigora_client_operation_receipts_workspace_venture_idx").on(
      table.workspaceId,
      table.ventureId,
    ),
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

export const frigoraVisitOutcomes = sqliteTable(
  "frigora_visit_outcomes",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id").notNull(),
    ventureId: text("venture_id").notNull(),
    visitId: text("visit_id").notNull(),
    workOrderId: text("work_order_id").notNull(),
    assetId: text("asset_id"),
    description: text("description").notNull(),
    outcomeAt: text("outcome_at").notNull(),
    recordedByUserId: text("recorded_by_user_id").notNull(),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("frigora_visit_outcomes_venture_visit_unique_idx").on(
      table.ventureId,
      table.visitId,
    ),
    index("frigora_visit_outcomes_venture_work_order_idx").on(
      table.ventureId,
      table.workOrderId,
    ),
    index("frigora_visit_outcomes_venture_asset_idx").on(table.ventureId, table.assetId),
  ],
);

export const frigoraRecommendedActions = sqliteTable(
  "frigora_recommended_actions",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id").notNull(),
    ventureId: text("venture_id").notNull(),
    visitId: text("visit_id").notNull(),
    workOrderId: text("work_order_id").notNull(),
    assetId: text("asset_id"),
    description: text("description").notNull(),
    recommendedAt: text("recommended_at").notNull(),
    recommendedByUserId: text("recommended_by_user_id").notNull(),
    recordedByUserId: text("recorded_by_user_id").notNull(),
    quotationRequired: integer("quotation_required").notNull().default(0),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    index("frigora_recommended_actions_venture_visit_idx").on(table.ventureId, table.visitId),
    index("frigora_recommended_actions_venture_work_order_idx").on(
      table.ventureId,
      table.workOrderId,
    ),
    index("frigora_recommended_actions_venture_asset_idx").on(table.ventureId, table.assetId),
  ],
);

export const frigoraRefrigerantEvents = sqliteTable(
  "frigora_refrigerant_events",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id").notNull(),
    ventureId: text("venture_id").notNull(),
    visitId: text("visit_id").notNull(),
    workOrderId: text("work_order_id").notNull(),
    assetId: text("asset_id"),
    refrigerantType: text("refrigerant_type").notNull(),
    refrigerantReferenceId: text("refrigerant_reference_id"),
    eventKind: text("event_kind").notNull(),
    quantityKg: real("quantity_kg").notNull(),
    chargePerKgCents: integer("charge_per_kg_cents"),
    reason: text("reason"),
    cylinderReference: text("cylinder_reference"),
    occurredAt: text("occurred_at").notNull(),
    handledByUserId: text("handled_by_user_id").notNull(),
    recordedByUserId: text("recorded_by_user_id").notNull(),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    index("frigora_refrigerant_events_venture_visit_idx").on(table.ventureId, table.visitId),
    index("frigora_refrigerant_events_venture_work_order_idx").on(
      table.ventureId,
      table.workOrderId,
    ),
    index("frigora_refrigerant_events_venture_asset_idx").on(table.ventureId, table.assetId),
  ],
);

export const frigoraPartUsages = sqliteTable(
  "frigora_part_usages",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id").notNull(),
    ventureId: text("venture_id").notNull(),
    visitId: text("visit_id").notNull(),
    workOrderId: text("work_order_id").notNull(),
    assetId: text("asset_id"),
    partDescription: text("part_description").notNull(),
    partReferenceId: text("part_reference_id"),
    quantity: real("quantity").notNull(),
    quantityUnit: text("quantity_unit").notNull(),
    unitChargeCents: integer("unit_charge_cents"),
    notes: text("notes"),
    usedAt: text("used_at").notNull(),
    usedByUserId: text("used_by_user_id").notNull(),
    recordedByUserId: text("recorded_by_user_id").notNull(),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    index("frigora_part_usages_venture_visit_idx").on(table.ventureId, table.visitId),
    index("frigora_part_usages_venture_work_order_idx").on(table.ventureId, table.workOrderId),
    index("frigora_part_usages_venture_asset_idx").on(table.ventureId, table.assetId),
  ],
);

export const frigoraPartReferences = sqliteTable(
  "frigora_part_references",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id").notNull(),
    ventureId: text("venture_id").notNull(),
    displayName: text("display_name").notNull(),
    defaultQuantityUnit: text("default_quantity_unit").notNull(),
    defaultUnitChargeCents: integer("default_unit_charge_cents"),
    status: text("status").notNull(),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    index("frigora_part_references_venture_status_idx").on(table.ventureId, table.status),
    uniqueIndex("frigora_part_references_id_scope_uidx").on(table.id, table.workspaceId, table.ventureId),
  ],
);

export const frigoraRefrigerantReferences = sqliteTable(
  "frigora_refrigerant_references",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id").notNull(),
    ventureId: text("venture_id").notNull(),
    canonicalCode: text("canonical_code").notNull(),
    displayName: text("display_name").notNull(),
    defaultChargePerKgCents: integer("default_charge_per_kg_cents"),
    status: text("status").notNull(),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("frigora_refrigerant_references_venture_code_idx").on(
      table.workspaceId,
      table.ventureId,
      table.canonicalCode,
    ),
    index("frigora_refrigerant_references_venture_status_idx").on(table.ventureId, table.status),
  ],
);

export const frigoraVentureCommercialSettings = sqliteTable(
  "frigora_venture_commercial_settings",
  {
    workspaceId: text("workspace_id").notNull(),
    ventureId: text("venture_id").notNull(),
    labourHourlyChargeCents: integer("labour_hourly_charge_cents"),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.workspaceId, table.ventureId] }),
  ],
);

export const frigoraAssetOperationalConditions = sqliteTable(
  "frigora_asset_operational_conditions",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id").notNull(),
    ventureId: text("venture_id").notNull(),
    assetId: text("asset_id").notNull(),
    conditionKind: text("condition_kind").notNull(),
    notes: text("notes"),
    visitId: text("visit_id"),
    workOrderId: text("work_order_id"),
    assertedAt: text("asserted_at").notNull(),
    assertedByUserId: text("asserted_by_user_id").notNull(),
    recordedByUserId: text("recorded_by_user_id").notNull(),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    index("frigora_asset_operational_conditions_venture_asset_idx").on(
      table.ventureId,
      table.assetId,
    ),
    index("frigora_asset_operational_conditions_venture_visit_idx").on(
      table.ventureId,
      table.visitId,
    ),
    index("frigora_asset_operational_conditions_venture_work_order_idx").on(
      table.ventureId,
      table.workOrderId,
    ),
  ],
);

export const frigoraVisitCustomerAcknowledgements = sqliteTable(
  "frigora_visit_customer_acknowledgements",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id").notNull(),
    ventureId: text("venture_id").notNull(),
    visitId: text("visit_id").notNull(),
    workOrderId: text("work_order_id").notNull(),
    acknowledgementText: text("acknowledgement_text").notNull(),
    acknowledgerName: text("acknowledger_name").notNull(),
    acknowledgedAt: text("acknowledged_at").notNull(),
    recordedByUserId: text("recorded_by_user_id").notNull(),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    index("frigora_visit_customer_acknowledgements_venture_visit_idx").on(
      table.ventureId,
      table.visitId,
    ),
    index("frigora_visit_customer_acknowledgements_venture_work_order_idx").on(
      table.ventureId,
      table.workOrderId,
    ),
  ],
);

export const frigoraVisitEvidence = sqliteTable(
  "frigora_visit_evidence",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id").notNull(),
    ventureId: text("venture_id").notNull(),
    visitId: text("visit_id").notNull(),
    workOrderId: text("work_order_id").notNull(),
    assetId: text("asset_id"),
    storedObjectId: text("stored_object_id").notNull(),
    category: text("category").notNull(),
    description: text("description"),
    capturedAt: text("captured_at").notNull(),
    recordedByUserId: text("recorded_by_user_id").notNull(),
    createdAt: text("created_at").notNull(),
    removedAt: text("removed_at"),
    originalFilename: text("original_filename").notNull(),
    mimeType: text("mime_type").notNull(),
    sizeBytes: integer("size_bytes", { mode: "number" }).notNull(),
  },
  (table) => [
    uniqueIndex("frigora_visit_evidence_venture_stored_object_idx").on(
      table.ventureId,
      table.storedObjectId,
    ),
    index("frigora_visit_evidence_venture_visit_idx").on(table.ventureId, table.visitId),
    index("frigora_visit_evidence_venture_work_order_idx").on(
      table.ventureId,
      table.workOrderId,
    ),
    index("frigora_visit_evidence_venture_asset_idx").on(table.ventureId, table.assetId),
  ],
);

export const frigoraQuotations = sqliteTable(
  "frigora_quotations",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id").notNull(),
    ventureId: text("venture_id").notNull(),
    customerId: text("customer_id").notNull(),
    siteId: text("site_id").notNull(),
    assetId: text("asset_id"),
    originalWorkOrderId: text("original_work_order_id").notNull(),
    recommendedActionId: text("recommended_action_id").notNull(),
    currentVersion: integer("current_version").notNull(),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    check("frigora_quotations_current_version_chk", sql`${table.currentVersion} >= 1`),
    index("frigora_quotations_workspace_venture_idx").on(table.workspaceId, table.ventureId),
    index("frigora_quotations_work_order_idx").on(table.ventureId, table.originalWorkOrderId),
    index("frigora_quotations_asset_idx").on(table.ventureId, table.assetId),
    index("frigora_quotations_recommended_action_idx").on(
      table.ventureId,
      table.recommendedActionId,
    ),
  ],
);

export const frigoraQuotationVersions = sqliteTable(
  "frigora_quotation_versions",
  {
    quotationId: text("quotation_id").notNull(),
    workspaceId: text("workspace_id").notNull(),
    ventureId: text("venture_id").notNull(),
    versionNumber: integer("version_number").notNull(),
    status: text("status").notNull(),
    description: text("description").notNull(),
    totalMinor: integer("total_minor").notNull(),
    currency: text("currency").notNull(),
    documentHash: text("document_hash").notNull(),
    sentAt: text("sent_at"),
    recipient: text("recipient"),
    dispatchEvidenceRef: text("dispatch_evidence_ref"),
    labourQuantityMilli: integer("labour_quantity_milli", { mode: "number" }),
    labourUnit: text("labour_unit"),
    labourRateMinor: integer("labour_rate_minor", { mode: "number" }),
    labourAmountMinor: integer("labour_amount_minor", { mode: "number" }),
    travelKilometresMilli: integer("travel_kilometres_milli", { mode: "number" }),
    distanceBasis: text("distance_basis"),
    travelRateMinor: integer("travel_rate_minor", { mode: "number" }),
    travelAmountMinor: integer("travel_amount_minor", { mode: "number" }),
    taxTreatment: text("tax_treatment"),
    taxRuleId: text("tax_rule_id"),
    taxRuleVersion: text("tax_rule_version"),
    taxRateNumerator: integer("tax_rate_numerator", { mode: "number" }),
    taxRateDenominator: integer("tax_rate_denominator", { mode: "number" }),
    taxableAmountMinor: integer("taxable_amount_minor", { mode: "number" }),
    taxAmountMinor: integer("tax_amount_minor", { mode: "number" }),
  },
  (table) => [
    primaryKey({ columns: [table.quotationId, table.versionNumber] }),
    check(
      "frigora_quotation_versions_status_chk",
      sql`${table.status} IN ('in_preparation', 'awaiting_customer_approval', 'approved', 'declined')`,
    ),
    check("frigora_quotation_versions_currency_chk", sql`${table.currency} = 'ZAR'`),
    check("frigora_quotation_versions_total_chk", sql`${table.totalMinor} >= 0`),
    index("frigora_quotation_versions_scope_idx").on(
      table.workspaceId,
      table.ventureId,
      table.quotationId,
    ),
  ],
);

export const frigoraQuotationEvents = sqliteTable(
  "frigora_quotation_events",
  {
    id: text("id").primaryKey(),
    quotationId: text("quotation_id").notNull(),
    workspaceId: text("workspace_id").notNull(),
    ventureId: text("venture_id").notNull(),
    versionNumber: integer("version_number").notNull(),
    kind: text("kind").notNull(),
    occurredAt: text("occurred_at").notNull(),
    actorUserId: text("actor_user_id"),
    actorContactId: text("actor_contact_id"),
    evidenceRef: text("evidence_ref"),
  },
  (table) => [
    check(
      "frigora_quotation_events_kind_chk",
      sql`${table.kind} IN ('created', 'sent', 'revision_started', 'approved', 'declined')`,
    ),
    check(
      "frigora_quotation_events_actor_chk",
      sql`(
        (${table.actorUserId} IS NOT NULL AND ${table.actorContactId} IS NULL)
        OR (${table.actorUserId} IS NULL AND ${table.actorContactId} IS NOT NULL)
      )`,
    ),
    index("frigora_quotation_events_scope_idx").on(
      table.workspaceId,
      table.ventureId,
      table.quotationId,
      table.occurredAt,
    ),
  ],
);

export const frigoraQuotationDecisionGrants = sqliteTable(
  "frigora_quotation_decision_grants",
  {
    id: text("id").primaryKey(),
    secretHash: text("secret_hash").notNull(),
    quotationId: text("quotation_id").notNull(),
    workspaceId: text("workspace_id").notNull(),
    ventureId: text("venture_id").notNull(),
    customerId: text("customer_id").notNull(),
    siteId: text("site_id").notNull(),
    versionNumber: integer("version_number").notNull(),
    documentHash: text("document_hash").notNull(),
    expiresAt: text("expires_at").notNull(),
    issuedAt: text("issued_at").notNull(),
    issuedByUserId: text("issued_by_user_id").notNull(),
    consumedAt: text("consumed_at"),
    decisionId: text("decision_id"),
    revokedAt: text("revoked_at"),
    contactId: text("contact_id"),
  },
  (table) => [
    uniqueIndex("frigora_quotation_decision_grants_secret_hash_uidx").on(table.secretHash),
    index("frigora_quotation_decision_grants_target_idx").on(
      table.workspaceId,
      table.ventureId,
      table.quotationId,
      table.versionNumber,
    ),
  ],
);

export const frigoraQuotationDecisions = sqliteTable(
  "frigora_quotation_decisions",
  {
    id: text("id").primaryKey(),
    quotationId: text("quotation_id").notNull(),
    workspaceId: text("workspace_id").notNull(),
    ventureId: text("venture_id").notNull(),
    customerId: text("customer_id").notNull(),
    siteId: text("site_id").notNull(),
    versionNumber: integer("version_number").notNull(),
    documentHash: text("document_hash").notNull(),
    decision: text("decision").notNull(),
    grantId: text("grant_id").notNull(),
    decidedAt: text("decided_at").notNull(),
  },
  (table) => [
    uniqueIndex("frigora_quotation_decisions_version_uidx").on(
      table.quotationId,
      table.versionNumber,
    ),
    uniqueIndex("frigora_quotation_decisions_grant_uidx").on(table.grantId),
    check(
      "frigora_quotation_decisions_kind_chk",
      sql`${table.decision} IN ('approved', 'declined')`,
    ),
    index("frigora_quotation_decisions_scope_idx").on(
      table.workspaceId,
      table.ventureId,
      table.quotationId,
    ),
  ],
);

export const frigoraQuotationDeliveryOutbox = sqliteTable(
  "frigora_quotation_delivery_outbox",
  {
    id: text("id").primaryKey(),
    quotationId: text("quotation_id").notNull(),
    workspaceId: text("workspace_id").notNull(),
    ventureId: text("venture_id").notNull(),
    versionNumber: integer("version_number").notNull(),
    documentHash: text("document_hash").notNull(),
    createdAt: text("created_at").notNull(),
    actorUserId: text("actor_user_id").notNull(),
    state: text("state").notNull(),
    holdReason: text("hold_reason").notNull(),
    providerMessageId: text("provider_message_id"),
  },
  (table) => [
    uniqueIndex("frigora_quotation_delivery_outbox_version_uidx").on(
      table.quotationId,
      table.versionNumber,
    ),
    check(
      "frigora_quotation_delivery_outbox_state_chk",
      sql`${table.state} IN ('held_pending_customer_access', 'accepted_by_provider', 'rejected_by_provider', 'outcome_unknown')`,
    ),
    index("frigora_quotation_delivery_outbox_scope_idx").on(
      table.workspaceId,
      table.ventureId,
      table.quotationId,
    ),
  ],
);

export const frigoraQuotationDeliveryAttempts = sqliteTable(
  "frigora_quotation_delivery_attempts",
  {
    id: text("id").primaryKey(),
    outboxId: text("outbox_id").notNull(),
    occurredAt: text("occurred_at").notNull(),
    actorUserId: text("actor_user_id").notNull(),
    outcome: text("outcome").notNull(),
    detail: text("detail").notNull(),
  },
  (table) => [
    check(
      "frigora_quotation_delivery_attempts_outcome_chk",
      sql`${table.outcome} IN ('held_pending_customer_access', 'accepted_by_provider', 'rejected_by_provider', 'outcome_unknown')`,
    ),
    index("frigora_quotation_delivery_attempts_outbox_idx").on(table.outboxId, table.occurredAt),
  ],
);

export const frigoraQuotationCustomerDeliveries = sqliteTable(
  "frigora_quotation_customer_deliveries",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id").notNull(),
    ventureId: text("venture_id").notNull(),
    quotationId: text("quotation_id").notNull(),
    versionNumber: integer("version_number").notNull(),
    customerId: text("customer_id").notNull(),
    siteId: text("site_id").notNull(),
    contactId: text("contact_id").notNull(),
    grantId: text("grant_id").notNull(),
    documentHash: text("document_hash").notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    payloadFingerprint: text("payload_fingerprint").notNull(),
    payloadText: text("payload_text"),
    payloadReadFailure: text("payload_read_failure"),
    state: text("state").notNull(),
    providerMessageId: text("provider_message_id"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
    idempotencyStartedAt: text("idempotency_started_at"),
    actorUserId: text("actor_user_id").notNull(),
    claimOwner: text("claim_owner"),
    claimLeaseExpiresAt: text("claim_lease_expires_at"),
    providerRequestExpiresAt: text("provider_request_expires_at"),
  },
  (table) => [
    uniqueIndex("frigora_quotation_customer_deliveries_target_uidx").on(
      table.quotationId,
      table.versionNumber,
      table.contactId,
    ),
    uniqueIndex("frigora_quotation_customer_deliveries_key_uidx").on(table.idempotencyKey),
    check(
      "frigora_quotation_customer_deliveries_state_chk",
      sql`${table.state} IN ('prepared', 'sending', 'accepted_by_provider', 'rejected_by_provider', 'outcome_unknown', 'reconciliation_required')`,
    ),
  ],
);

export const frigoraCustomerContacts = sqliteTable(
  "frigora_customer_contacts",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id").notNull(),
    ventureId: text("venture_id").notNull(),
    customerId: text("customer_id").notNull(),
    siteId: text("site_id").notNull(),
    displayName: text("display_name").notNull(),
    email: text("email").notNull(),
    emailVerifiedAt: text("email_verified_at"),
    status: text("status").notNull(),
    createdByUserId: text("created_by_user_id").notNull(),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("frigora_customer_contacts_site_email_uidx").on(
      table.ventureId,
      table.siteId,
      table.email,
    ),
    check("frigora_customer_contacts_status_chk", sql`${table.status} IN ('active', 'revoked')`),
    index("frigora_customer_contacts_scope_idx").on(
      table.workspaceId,
      table.ventureId,
      table.customerId,
    ),
  ],
);

export const frigoraQuotationContactDesignations = sqliteTable(
  "frigora_quotation_contact_designations",
  {
    contactId: text("contact_id").primaryKey(),
    workspaceId: text("workspace_id").notNull(),
    ventureId: text("venture_id").notNull(),
    customerId: text("customer_id").notNull(),
    siteId: text("site_id").notNull(),
    basis: text("basis").notNull(),
    designatedByUserId: text("designated_by_user_id").notNull(),
    designatedAt: text("designated_at").notNull(),
    revokedAt: text("revoked_at"),
    revokedByUserId: text("revoked_by_user_id"),
  },
);

export const frigoraContactVerificationChallenges = sqliteTable(
  "frigora_contact_verification_challenges",
  {
    id: text("id").primaryKey(),
    contactId: text("contact_id").notNull(),
    workspaceId: text("workspace_id").notNull(),
    ventureId: text("venture_id").notNull(),
    customerId: text("customer_id").notNull(),
    siteId: text("site_id").notNull(),
    secretHash: text("secret_hash").notNull(),
    expiresAt: text("expires_at").notNull(),
    createdAt: text("created_at").notNull(),
    consumedAt: text("consumed_at"),
    revokedAt: text("revoked_at"),
  },
  (table) => [
    uniqueIndex("frigora_contact_verification_challenges_hash_uidx").on(table.secretHash),
    index("frigora_contact_verification_challenges_contact_idx").on(table.contactId),
  ],
);

export const frigoraContactSupervisedVerifications = sqliteTable(
  "frigora_contact_supervised_verifications",
  {
    id: text("id").primaryKey(),
    contactId: text("contact_id").notNull(),
    workspaceId: text("workspace_id").notNull(),
    ventureId: text("venture_id").notNull(),
    method: text("method").notNull(),
    verifiedByUserId: text("verified_by_user_id").notNull(),
    verifiedAt: text("verified_at").notNull(),
    evidenceNote: text("evidence_note").notNull(),
    revokedAt: text("revoked_at"),
    revokedByUserId: text("revoked_by_user_id"),
  },
  (table) => [
    index("frigora_contact_supervised_verifications_contact_idx").on(
      table.workspaceId,
      table.ventureId,
      table.contactId,
    ),
  ],
);

export const frigoraVentureMailIdentities = sqliteTable(
  "frigora_venture_mail_identities",
  {
    workspaceId: text("workspace_id").notNull(),
    ventureId: text("venture_id").notNull(),
    fromName: text("from_name").notNull(),
    fromEmail: text("from_email").notNull(),
    updatedByUserId: text("updated_by_user_id").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [primaryKey({ columns: [table.workspaceId, table.ventureId] })],
);

export const intelligenceCatalogues = sqliteTable("intelligence_catalogues", {
  workspaceId: text("workspace_id").primaryKey(),
  version: integer("version").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const intelligenceObjects = sqliteTable(
  "intelligence_objects",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id").notNull(),
    originatingVentureId: text("originating_venture_id").notNull(),
    objectType: text("object_type").notNull(),
    currentRevision: integer("current_revision").notNull(),
    currentRevisionId: text("current_revision_id").notNull(),
    documentJson: text("document_json").notNull(),
    documentHash: text("document_hash").notNull(),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    index("intelligence_objects_workspace_idx").on(table.workspaceId),
    index("intelligence_objects_venture_idx").on(
      table.workspaceId,
      table.originatingVentureId,
    ),
    index("intelligence_objects_type_idx").on(
      table.workspaceId,
      table.objectType,
    ),
  ],
);

export const intelligenceRevisions = sqliteTable(
  "intelligence_revisions",
  {
    revisionId: text("revision_id").primaryKey(),
    mutationId: text("mutation_id").notNull(),
    objectId: text("object_id").notNull(),
    workspaceId: text("workspace_id").notNull(),
    originatingVentureId: text("originating_venture_id").notNull(),
    objectType: text("object_type").notNull(),
    revision: integer("revision").notNull(),
    mutationKind: text("mutation_kind").notNull(),
    documentJson: text("document_json").notNull(),
    documentHash: text("document_hash").notNull(),
    previousRevisionId: text("previous_revision_id"),
    previousRevisionHash: text("previous_revision_hash"),
    revisionHash: text("revision_hash").notNull(),
    recorderActorId: text("recorder_actor_id").notNull(),
    requiredPermission: text("required_permission").notNull(),
    semanticAuthorityRef: text("semantic_authority_ref"),
    reason: text("reason").notNull(),
    evaluationTime: text("evaluation_time").notNull(),
    catalogueVersion: integer("catalogue_version").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    uniqueIndex("intelligence_revisions_object_revision_idx").on(
      table.objectId,
      table.revision,
    ),
    index("intelligence_revisions_workspace_idx").on(
      table.workspaceId,
      table.objectId,
    ),
  ],
);

export const frigoraStockLocations = sqliteTable(
  "frigora_stock_locations",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id").notNull(),
    ventureId: text("venture_id").notNull(),
    name: text("name").notNull(),
    kind: text("kind").notNull(),
    status: text("status").notNull(),
    custodianUserId: text("custodian_user_id"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("frigora_stock_locations_scope_uidx").on(table.id, table.workspaceId, table.ventureId),
    index("frigora_stock_locations_scope_idx").on(table.workspaceId, table.ventureId, table.status),
  ],
);

export const frigoraStockItems = sqliteTable(
  "frigora_stock_items",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id").notNull(),
    ventureId: text("venture_id").notNull(),
    partReferenceId: text("part_reference_id"),
    description: text("description").notNull(),
    descriptionNormalised: text("description_normalised").notNull(),
    unit: text("unit").notNull(),
    unitCustomLabel: text("unit_custom_label"),
    unitCustomLabelNormalised: text("unit_custom_label_normalised").notNull(),
    status: text("status").notNull(),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("frigora_stock_items_scope_uidx").on(table.id, table.workspaceId, table.ventureId),
  ],
);

export const frigoraStockMovements = sqliteTable(
  "frigora_stock_movements",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id").notNull(),
    ventureId: text("venture_id").notNull(),
    stockItemId: text("stock_item_id").notNull(),
    locationId: text("location_id").notNull(),
    kind: text("kind").notNull(),
    movementLeg: text("movement_leg").notNull(),
    quantityMilli: integer("quantity_milli").notNull(),
    unitSnapshot: text("unit_snapshot").notNull(),
    unitCustomLabelSnapshot: text("unit_custom_label_snapshot"),
    descriptionSnapshot: text("description_snapshot").notNull(),
    occurredAt: text("occurred_at").notNull(),
    recordedAt: text("recorded_at").notNull(),
    actorUserId: text("actor_user_id").notNull(),
    reason: text("reason"),
    clientOperationId: text("client_operation_id").notNull(),
    receiptReference: text("receipt_reference"),
    supplierReference: text("supplier_reference"),
    supportingDocumentReference: text("supporting_document_reference"),
    enteredUnitCostMinor: integer("entered_unit_cost_minor"),
    currency: text("currency"),
    costSourceMovementId: text("cost_source_movement_id"),
    pairGroupId: text("pair_group_id"),
    correctsMovementId: text("corrects_movement_id"),
    defectReportId: text("defect_report_id"),
  },
  (table) => [
    uniqueIndex("frigora_stock_movements_scope_uidx").on(table.id, table.workspaceId, table.ventureId),
    uniqueIndex("frigora_stock_movements_operation_leg_uidx").on(
      table.ventureId,
      table.clientOperationId,
      table.movementLeg,
    ),
    index("frigora_stock_movements_location_idx").on(
      table.workspaceId,
      table.ventureId,
      table.stockItemId,
      table.locationId,
      table.recordedAt,
    ),
  ],
);

export const frigoraStockBalances = sqliteTable(
  "frigora_stock_balances",
  {
    workspaceId: text("workspace_id").notNull(),
    ventureId: text("venture_id").notNull(),
    stockItemId: text("stock_item_id").notNull(),
    locationId: text("location_id").notNull(),
    availableMilli: integer("available_milli").notNull(),
    quarantinedMilli: integer("quarantined_milli").notNull(),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.workspaceId, table.ventureId, table.stockItemId, table.locationId] }),
  ],
);

export const frigoraStockOperationReceipts = sqliteTable(
  "frigora_stock_operation_receipts",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id").notNull(),
    ventureId: text("venture_id").notNull(),
    actorUserId: text("actor_user_id").notNull(),
    clientOperationId: text("client_operation_id").notNull(),
    operationType: text("operation_type").notNull(),
    requestFingerprint: text("request_fingerprint").notNull(),
    resultJson: text("result_json").notNull(),
    acceptedAt: text("accepted_at").notNull(),
  },
  (table) => [
    uniqueIndex("frigora_stock_operation_receipts_operation_uidx").on(table.ventureId, table.clientOperationId),
  ],
);

export const frigoraStockPricePolicies = sqliteTable(
  "frigora_stock_price_policies",
  {
    stockItemId: text("stock_item_id").notNull(),
    versionNumber: integer("version_number").notNull(),
    workspaceId: text("workspace_id").notNull(),
    ventureId: text("venture_id").notNull(),
    method: text("method").notNull(),
    markupNumerator: integer("markup_numerator"),
    markupDenominator: integer("markup_denominator"),
    fixedMinorPerUnit: integer("fixed_minor_per_unit"),
    clearsOverrideNumber: integer("clears_override_number"),
    actorUserId: text("actor_user_id").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [primaryKey({ columns: [table.stockItemId, table.versionNumber] })],
);

export const frigoraStockPriceOverrides = sqliteTable(
  "frigora_stock_price_overrides",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id").notNull(),
    ventureId: text("venture_id").notNull(),
    stockItemId: text("stock_item_id").notNull(),
    overrideNumber: integer("override_number").notNull(),
    sellingPriceMinor: integer("selling_price_minor").notNull(),
    reason: text("reason").notNull(),
    actorUserId: text("actor_user_id").notNull(),
    occurredAt: text("occurred_at").notNull(),
  },
  (table) => [uniqueIndex("frigora_stock_price_overrides_number_uidx").on(table.stockItemId, table.overrideNumber)],
);

export const frigoraStockDefectReports = sqliteTable(
  "frigora_stock_defect_reports",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id").notNull(),
    ventureId: text("venture_id").notNull(),
    clientOperationId: text("client_operation_id").notNull(),
    kind: text("kind").notNull(),
    stockItemId: text("stock_item_id"),
    locationId: text("location_id"),
    descriptionSnapshot: text("description_snapshot"),
    unitSnapshot: text("unit_snapshot"),
    unitCustomLabelSnapshot: text("unit_custom_label_snapshot"),
    customerLabel: text("customer_label"),
    siteLabel: text("site_label"),
    workOrderId: text("work_order_id"),
    quantityMilli: integer("quantity_milli").notNull(),
    reporterUserId: text("reporter_user_id").notNull(),
    reason: text("reason").notNull(),
    evidenceReference: text("evidence_reference"),
    inspectedMilli: integer("inspected_milli").notNull(),
    releasedMilli: integer("released_milli").notNull(),
    supplierReturnedMilli: integer("supplier_returned_milli").notNull(),
    writtenOffMilli: integer("written_off_milli").notNull(),
    reversedMilli: integer("reversed_milli").notNull(),
    status: text("status").notNull(),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("frigora_stock_defect_reports_scope_uidx").on(table.id, table.workspaceId, table.ventureId),
    uniqueIndex("frigora_stock_defect_reports_operation_uidx").on(table.ventureId, table.clientOperationId),
  ],
);

export const frigoraStockDefectEventSequences = sqliteTable(
  "frigora_stock_defect_event_sequences",
  {
    ventureId: text("venture_id").primaryKey(),
    workspaceId: text("workspace_id").notNull(),
    nextSequence: integer("next_sequence").notNull(),
  },
  (table) => [
    uniqueIndex("frigora_stock_defect_event_sequences_scope_uidx").on(table.ventureId, table.workspaceId),
  ],
);

export const frigoraStockDefectEvents = sqliteTable(
  "frigora_stock_defect_events",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id").notNull(),
    ventureId: text("venture_id").notNull(),
    reportId: text("report_id").notNull(),
    clientOperationId: text("client_operation_id").notNull(),
    eventSequence: integer("event_sequence").notNull(),
    eventType: text("event_type").notNull(),
    quantityMilli: integer("quantity_milli").notNull(),
    actorUserId: text("actor_user_id").notNull(),
    occurredAt: text("occurred_at").notNull(),
    recordedAt: text("recorded_at").notNull(),
    reason: text("reason"),
    evidenceReference: text("evidence_reference"),
    movementId: text("movement_id"),
    pairGroupId: text("pair_group_id"),
    correctsPairGroupId: text("corrects_pair_group_id"),
    correctsEventId: text("corrects_event_id"),
    supplierReference: text("supplier_reference"),
    replacementReference: text("replacement_reference"),
    supplierCreditReference: text("supplier_credit_reference"),
  },
  (table) => [
    uniqueIndex("frigora_stock_defect_events_sequence_uidx").on(table.ventureId, table.eventSequence),
    uniqueIndex("frigora_stock_defect_events_operation_uidx").on(table.ventureId, table.clientOperationId),
    uniqueIndex("frigora_stock_defect_events_report_uidx").on(
      table.id,
      table.reportId,
      table.workspaceId,
      table.ventureId,
    ),
  ],
);

/** Selling catalogue. Not created by ensureSchema. Purchase cost is a separate table. */
export const frigoraCommercialItems = sqliteTable(
  "frigora_commercial_items",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id").notNull(),
    ventureId: text("venture_id").notNull(),
    sku: text("sku").notNull(),
    skuNormalised: text("sku_normalised").notNull(),
    description: text("description").notNull(),
    category: text("category").notNull(),
    manufacturer: text("manufacturer").notNull(),
    model: text("model").notNull(),
    unit: text("unit").notNull(),
    sellingPriceMinor: integer("selling_price_minor").notNull(),
    currency: text("currency").notNull(),
    taxTreatment: text("tax_treatment").notNull(),
    supplierReference: text("supplier_reference").notNull(),
    status: text("status").notNull(),
    createdAt: text("created_at").notNull(),
    createdByUserId: text("created_by_user_id").notNull(),
    updatedAt: text("updated_at").notNull(),
    updatedByUserId: text("updated_by_user_id").notNull(),
  },
  (table) => [
    uniqueIndex("frigora_commercial_items_sku_uidx").on(
      table.workspaceId,
      table.ventureId,
      table.skuNormalised,
    ),
  ],
);

/** Purchase cost. Ordinary catalogue reads must not select this table. */
export const frigoraCommercialItemCosts = sqliteTable("frigora_commercial_item_costs", {
  itemId: text("item_id").primaryKey(),
  workspaceId: text("workspace_id").notNull(),
  ventureId: text("venture_id").notNull(),
  purchaseCostMinor: integer("purchase_cost_minor").notNull(),
  currency: text("currency").notNull(),
  updatedAt: text("updated_at").notNull(),
  updatedByUserId: text("updated_by_user_id").notNull(),
});

export const schema = {
  intelligenceCatalogues,
  intelligenceObjects,
  intelligenceRevisions,
  users,
  authIdentities,
  sessions,
  passwordResetTokens,
  workspaces,
  workspaceMembers,
  workspaceInvitations,
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
  storedObjects,
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
  frigoraClientOperationReceipts,
  frigoraCorrectiveActions,
  frigoraVisitOutcomes,
  frigoraRecommendedActions,
  frigoraRefrigerantEvents,
  frigoraPartUsages,
  frigoraPartReferences,
  frigoraRefrigerantReferences,
  frigoraVentureCommercialSettings,
  frigoraAssetOperationalConditions,
  frigoraVisitCustomerAcknowledgements,
  frigoraVisitEvidence,
  frigoraStockLocations,
  frigoraStockItems,
  frigoraStockMovements,
  frigoraStockBalances,
  frigoraStockOperationReceipts,
  frigoraStockPricePolicies,
  frigoraStockPriceOverrides,
  frigoraStockDefectReports,
  frigoraStockDefectEventSequences,
  frigoraStockDefectEvents,
  frigoraCommercialItems,
  frigoraCommercialItemCosts,
};

/** Durable optional upload identity; not a Venture acceptance receipt. */
export const storedObjectReservations = sqliteTable("stored_object_reservations", {
  scopeKey: text("scope_key").primaryKey(),
  requestFingerprint: text("request_fingerprint").notNull(),
  objectRowJson: text("object_row_json").notNull(),
});
