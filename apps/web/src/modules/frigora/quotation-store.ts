import { timingSafeEqual } from "node:crypto";
import { and, asc, eq } from "drizzle-orm";
import type { Transaction } from "@libsql/client";
import type { VentureId, WorkspaceId, UserId } from "@/contracts";
import { createId } from "@/platform/ids";
import { ensureFrigoraCommercialLinesSchema, ensureSchema, getClient, getDb } from "@/platform/persistence/db";
import {
  frigoraQuotationDecisions,
  frigoraQuotationEvents,
  frigoraQuotationVersions,
  frigoraQuotations,
} from "@/platform/persistence/schema";
import type { FrigoraQuotationCommercialSnapshot } from "./quotation-commercial";
import { assertPersistedOfferDocument } from "./quotation-commands";
import {
  QUOTATION_DELIVERY_HELD_REASON,
  QUOTATION_DELIVERY_RESTORED_DETAIL,
  QUOTATION_DELIVERY_UNKNOWN_DETAIL,
  QUOTATION_ISSUE_ATTEMPT_DETAIL,
  QUOTATION_ISSUE_AUDIT_ACTION,
  isQuotationDeliveryState,
  type QuotationDeliveryOutbox,
  type QuotationDeliveryRecovery,
  type QuotationDeliveryState,
} from "./quotation-delivery";
import { FrigoraError } from "./errors";
import { withFrigoraWriteTransaction, type FrigoraWriteClientFactory } from "./owned-write";
import {
  assertSendableVersionHasNoLines,
  COMMERCIAL_LINE_ISSUE_BLOCKED,
  copyQuotationLinesToRevision,
  insertQuotationLineSnapshots,
  replaceDraftQuotationLines,
  type QuotationLineInsert,
} from "./quotation-lines";
import type {
  FrigoraAssetId,
  FrigoraCustomerContactId,
  FrigoraCustomerId,
  FrigoraPersistedQuotation,
  FrigoraPersistedQuoteDecision,
  FrigoraPersistedQuoteEvent,
  FrigoraPersistedQuoteEventKind,
  FrigoraPersistedQuoteStatus,
  FrigoraPersistedQuoteVersion,
  FrigoraQuotationDecisionGrantId,
  FrigoraQuotationDecisionId,
  FrigoraQuotationEventId,
  FrigoraQuotationId,
  FrigoraRecommendedActionId,
  FrigoraSiteId,
  FrigoraWorkOrderId,
} from "./types";

export type QuotationCreateCommit = {
  id: FrigoraQuotationId;
  workspaceId: WorkspaceId;
  ventureId: VentureId;
  customerId: FrigoraCustomerId;
  siteId: FrigoraSiteId;
  assetId: FrigoraAssetId | null;
  originalWorkOrderId: FrigoraWorkOrderId;
  recommendedActionId: FrigoraRecommendedActionId;
  createdAt: string;
  description: string;
  commercial: FrigoraQuotationCommercialSnapshot;
  totalMinor: number;
  documentHash: string;
  eventId: FrigoraQuotationEventId;
  actorUserId: UserId;
  lines?: QuotationLineInsert[];
};

export type QuotationSendCommit = {
  quotationId: FrigoraQuotationId;
  workspaceId: WorkspaceId;
  ventureId: VentureId;
  expectedCurrentVersion: number;
  description: string;
  commercial: FrigoraQuotationCommercialSnapshot;
  totalMinor: number;
  documentHash: string;
  sentAt: string;
  recipient: string;
  dispatchEvidenceRef: string;
  eventId: FrigoraQuotationEventId;
  actorUserId: UserId;
  updatedAt: string;
  outboxId: string;
  attemptId: string;
  auditId: string;
};

export type QuotationDeliveryRecoveryCommit = {
  quotationId: FrigoraQuotationId;
  workspaceId: WorkspaceId;
  ventureId: VentureId;
  version: number;
  actorUserId: UserId;
  occurredAt: string;
  recomputedHash: string;
  outboxId: string;
  attemptId: string;
  auditId: string;
};

export type QuotationCorrectCommit = {
  quotationId: FrigoraQuotationId;
  workspaceId: WorkspaceId;
  ventureId: VentureId;
  expectedCurrentVersion: number;
  description: string;
  commercial: FrigoraQuotationCommercialSnapshot;
  totalMinor: number;
  documentHash: string;
  updatedAt: string;
  lines?: QuotationLineInsert[];
};

export type QuotationReviseCommit = {
  quotationId: FrigoraQuotationId;
  workspaceId: WorkspaceId;
  ventureId: VentureId;
  expectedCurrentVersion: number;
  nextVersion: number;
  description: string;
  commercial: FrigoraQuotationCommercialSnapshot;
  totalMinor: number;
  documentHash: string;
  occurredAt: string;
  eventId: FrigoraQuotationEventId;
  actorUserId: UserId;
};

export type QuotationDecisionGrantCommit = {
  id: FrigoraQuotationDecisionGrantId;
  secretHash: string;
  quotationId: FrigoraQuotationId;
  workspaceId: WorkspaceId;
  ventureId: VentureId;
  customerId: FrigoraCustomerId;
  siteId: FrigoraSiteId;
  version: number;
  documentHash: string;
  expiresAt: string;
  issuedAt: string;
  issuedByUserId: UserId;
  contactId: string | null;
  /** Absent keeps the quotation-only insert. test_link and mailbox re-check contact authority in that insert. */
  eligibility?: "test_link" | "mailbox";
};

const TEST_LINK_ELIGIBILITY_MESSAGE =
  "A test link needs exactly one active designated contact with mailbox verification or a current supervised verification.";

export function decisionGrantInsert(input: QuotationDecisionGrantCommit): { sql: string; args: Array<string | number | null> } {
  if (input.eligibility === "test_link") {
    return {
      sql: `
        WITH eligible AS (
          SELECT c.id, c.workspace_id, c.venture_id, c.customer_id, c.site_id
          FROM frigora_customer_contacts c
          INNER JOIN frigora_quotation_contact_designations d
            ON d.contact_id = c.id
           AND d.workspace_id = c.workspace_id
           AND d.venture_id = c.venture_id
           AND d.revoked_at IS NULL
          WHERE c.workspace_id = ?
            AND c.venture_id = ?
            AND c.customer_id = ?
            AND c.site_id = ?
            AND c.status = 'active'
            AND (
              c.email_verified_at IS NOT NULL
              OR EXISTS (
                SELECT 1
                FROM frigora_contact_supervised_verifications s
                WHERE s.contact_id = c.id
                  AND s.workspace_id = c.workspace_id
                  AND s.venture_id = c.venture_id
                  AND s.revoked_at IS NULL
              )
            )
        )
        INSERT INTO frigora_quotation_decision_grants (
          id, secret_hash, quotation_id, workspace_id, venture_id, customer_id, site_id,
          version_number, document_hash, expires_at, issued_at, issued_by_user_id,
          consumed_at, decision_id, revoked_at, contact_id
        )
        SELECT ?, ?, q.id, q.workspace_id, q.venture_id, q.customer_id, q.site_id,
               q.current_version, v.document_hash, ?, ?, ?, NULL, NULL, NULL, eligible.id
        FROM frigora_quotations q
        JOIN frigora_quotation_versions v
          ON v.quotation_id = q.id
         AND v.workspace_id = q.workspace_id
         AND v.venture_id = q.venture_id
         AND v.version_number = q.current_version
        JOIN eligible
          ON eligible.workspace_id = q.workspace_id
         AND eligible.venture_id = q.venture_id
         AND eligible.customer_id = q.customer_id
         AND eligible.site_id = q.site_id
        WHERE q.id = ?
          AND q.workspace_id = ?
          AND q.venture_id = ?
          AND q.current_version = ?
          AND q.customer_id = ?
          AND q.site_id = ?
          AND v.status = 'awaiting_customer_approval'
          AND v.document_hash = ?
          AND (SELECT COUNT(*) FROM eligible) = 1
      `,
      args: [
        input.workspaceId,
        input.ventureId,
        input.customerId,
        input.siteId,
        input.id,
        input.secretHash,
        input.expiresAt,
        input.issuedAt,
        input.issuedByUserId,
        input.quotationId,
        input.workspaceId,
        input.ventureId,
        input.version,
        input.customerId,
        input.siteId,
        input.documentHash,
      ],
    };
  }
  if (input.eligibility === "mailbox") {
    return {
      sql: `
        INSERT INTO frigora_quotation_decision_grants (
          id, secret_hash, quotation_id, workspace_id, venture_id, customer_id, site_id,
          version_number, document_hash, expires_at, issued_at, issued_by_user_id,
          consumed_at, decision_id, revoked_at, contact_id
        )
        SELECT ?, ?, q.id, q.workspace_id, q.venture_id, q.customer_id, q.site_id,
               q.current_version, v.document_hash, ?, ?, ?, NULL, NULL, NULL, c.id
        FROM frigora_quotations q
        JOIN frigora_quotation_versions v
          ON v.quotation_id = q.id
         AND v.workspace_id = q.workspace_id
         AND v.venture_id = q.venture_id
         AND v.version_number = q.current_version
        JOIN frigora_customer_contacts c
          ON c.id = ?
         AND c.workspace_id = q.workspace_id
         AND c.venture_id = q.venture_id
         AND c.customer_id = q.customer_id
         AND c.site_id = q.site_id
         AND c.status = 'active'
         AND c.email_verified_at IS NOT NULL
        JOIN frigora_quotation_contact_designations d
          ON d.contact_id = c.id
         AND d.workspace_id = c.workspace_id
         AND d.venture_id = c.venture_id
         AND d.revoked_at IS NULL
        WHERE q.id = ?
          AND q.workspace_id = ?
          AND q.venture_id = ?
          AND q.current_version = ?
          AND q.customer_id = ?
          AND q.site_id = ?
          AND v.status = 'awaiting_customer_approval'
          AND v.document_hash = ?
      `,
      args: [
        input.id,
        input.secretHash,
        input.expiresAt,
        input.issuedAt,
        input.issuedByUserId,
        input.contactId,
        input.quotationId,
        input.workspaceId,
        input.ventureId,
        input.version,
        input.customerId,
        input.siteId,
        input.documentHash,
      ],
    };
  }
  return {
    sql: `
      INSERT INTO frigora_quotation_decision_grants (
        id, secret_hash, quotation_id, workspace_id, venture_id, customer_id, site_id,
        version_number, document_hash, expires_at, issued_at, issued_by_user_id,
        consumed_at, decision_id, revoked_at, contact_id
      )
      SELECT ?, ?, q.id, q.workspace_id, q.venture_id, q.customer_id, q.site_id,
             q.current_version, v.document_hash, ?, ?, ?, NULL, NULL, NULL, ?
      FROM frigora_quotations q
      JOIN frigora_quotation_versions v
        ON v.quotation_id = q.id
       AND v.workspace_id = q.workspace_id
       AND v.venture_id = q.venture_id
       AND v.version_number = q.current_version
      WHERE q.id = ?
        AND q.workspace_id = ?
        AND q.venture_id = ?
        AND q.current_version = ?
        AND q.customer_id = ?
        AND q.site_id = ?
        AND v.status = 'awaiting_customer_approval'
        AND v.document_hash = ?
    `,
    args: [
      input.id,
      input.secretHash,
      input.expiresAt,
      input.issuedAt,
      input.issuedByUserId,
      input.contactId,
      input.quotationId,
      input.workspaceId,
      input.ventureId,
      input.version,
      input.customerId,
      input.siteId,
      input.documentHash,
    ],
  };
}

export async function rejectUnguardedGrantInsert(
  transaction: Transaction,
  input: QuotationDecisionGrantCommit,
): Promise<never> {
  const current = await transaction.execute({
    sql: `
      SELECT 1 AS ok
      FROM frigora_quotations q
      JOIN frigora_quotation_versions v
        ON v.quotation_id = q.id
       AND v.workspace_id = q.workspace_id
       AND v.venture_id = q.venture_id
       AND v.version_number = q.current_version
      WHERE q.id = ?
        AND q.workspace_id = ?
        AND q.venture_id = ?
        AND q.current_version = ?
        AND q.customer_id = ?
        AND q.site_id = ?
        AND v.status = 'awaiting_customer_approval'
        AND v.document_hash = ?
    `,
    args: [
      input.quotationId,
      input.workspaceId,
      input.ventureId,
      input.version,
      input.customerId,
      input.siteId,
      input.documentHash,
    ],
  });
  if (current.rows.length === 0 || !input.eligibility) {
    throw new FrigoraError(
      "invalid_status",
      "A decision grant can only be issued for the current sent quotation version.",
    );
  }
  if (input.eligibility === "test_link") {
    throw new FrigoraError("decision_rejected", TEST_LINK_ELIGIBILITY_MESSAGE);
  }
  const contact = await transaction.execute({
    sql: `
      SELECT c.status AS status,
             c.email_verified_at AS email_verified_at,
             d.contact_id AS designation_contact_id,
             d.revoked_at AS designation_revoked_at
      FROM frigora_customer_contacts c
      LEFT JOIN frigora_quotation_contact_designations d
        ON d.contact_id = c.id
       AND d.workspace_id = c.workspace_id
       AND d.venture_id = c.venture_id
      WHERE c.id = ?
        AND c.workspace_id = ?
        AND c.venture_id = ?
        AND c.customer_id = ?
        AND c.site_id = ?
    `,
    args: [input.contactId, input.workspaceId, input.ventureId, input.customerId, input.siteId],
  });
  const row = contact.rows[0];
  if (!row || String(row.status) !== "active") {
    throw new FrigoraError("decision_rejected", "Customer contact is not authorised for this quotation.");
  }
  if (row.email_verified_at == null) {
    throw new FrigoraError("decision_rejected", "Customer contact email is not verified.");
  }
  if (row.designation_contact_id == null || row.designation_revoked_at != null) {
    throw new FrigoraError(
      "decision_rejected",
      "Customer contact is not designated to decide this quotation.",
    );
  }
  throw new FrigoraError("decision_rejected", "Customer contact is not authorised for this quotation.");
}

export type QuotationDecisionCommit = {
  decisionId: FrigoraQuotationDecisionId;
  eventId: FrigoraQuotationEventId;
  grantId: FrigoraQuotationDecisionGrantId;
  secretHash: string;
  quotationId: FrigoraQuotationId;
  workspaceId: WorkspaceId;
  ventureId: VentureId;
  customerId: FrigoraCustomerId;
  siteId: FrigoraSiteId;
  decision: "approved" | "declined";
  now: string;
  /**
   * Office session that presented a grant in the existing harness.
   * Null when the decision is attributed to the grant's designated contact.
   */
  actorUserId: UserId | null;
  actorContactId: string | null;
  selectionLines?: Array<{ lineId: string; inclusion: "mandatory" | "selected_optional" }>;
  authorisedTotalMinor?: number;
  selectedOptionalLineIds?: string[];
};

const COMMERCIAL_COLUMNS = `
  labour_quantity_milli, labour_unit, labour_rate_minor, labour_amount_minor,
  travel_kilometres_milli, distance_basis, travel_rate_minor, travel_amount_minor,
  tax_treatment, tax_rule_id, tax_rule_version, tax_rate_numerator, tax_rate_denominator,
  taxable_amount_minor, tax_amount_minor
`;

function commercialArgs(commercial: FrigoraQuotationCommercialSnapshot) {
  return [
    commercial.labourQuantityMilli,
    commercial.labourUnit,
    commercial.labourRateMinor,
    commercial.labourAmountMinor,
    commercial.travelKilometresMilli,
    commercial.distanceBasis,
    commercial.travelRateMinor,
    commercial.travelAmountMinor,
    commercial.taxTreatment,
    commercial.taxRuleId,
    commercial.taxRuleVersion,
    commercial.taxRateNumerator,
    commercial.taxRateDenominator,
    commercial.taxableAmountMinor,
    commercial.taxAmountMinor,
  ];
}

const QUOTE_STATUSES = new Set<FrigoraPersistedQuoteStatus>([
  "in_preparation",
  "awaiting_customer_approval",
  "approved",
  "declined",
]);

const PERSISTABLE_EVENTS = new Set<FrigoraPersistedQuoteEventKind>([
  "created",
  "sent",
  "revision_started",
  "approved",
  "declined",
]);

function assertPersistableStatus(status: string): FrigoraPersistedQuoteStatus {
  if (!QUOTE_STATUSES.has(status as FrigoraPersistedQuoteStatus)) {
    throw new FrigoraError("invalid_status", "Unknown quotation status.");
  }
  return status as FrigoraPersistedQuoteStatus;
}

function assertPersistableEvent(kind: string): FrigoraPersistedQuoteEventKind {
  if (!PERSISTABLE_EVENTS.has(kind as FrigoraPersistedQuoteEventKind)) {
    throw new FrigoraError("invalid_status", "Quotation event kind cannot be persisted.");
  }
  return kind as FrigoraPersistedQuoteEventKind;
}

function mapVersion(row: typeof frigoraQuotationVersions.$inferSelect): FrigoraPersistedQuoteVersion {
  if (row.currency !== "ZAR") {
    throw new FrigoraError("invalid_input", "Persisted quotation currency must be ZAR.");
  }
  if (
    row.labourQuantityMilli == null ||
    row.labourUnit == null ||
    row.labourRateMinor == null ||
    row.labourAmountMinor == null ||
    row.travelKilometresMilli == null ||
    (row.distanceBasis !== "one_way" && row.distanceBasis !== "return") ||
    row.travelRateMinor == null ||
    row.travelAmountMinor == null ||
    (row.taxTreatment !== "not_registered" && row.taxTreatment !== "configured_rule") ||
    row.taxableAmountMinor == null ||
    row.taxAmountMinor == null
  ) {
    throw new FrigoraError("invalid_status", "Quotation version has no commercial basis.");
  }
  return {
    quotationId: row.quotationId as FrigoraQuotationId,
    workspaceId: row.workspaceId as WorkspaceId,
    ventureId: row.ventureId as VentureId,
    version: row.versionNumber,
    status: assertPersistableStatus(row.status),
    description: row.description,
    commercial: {
      labourQuantityMilli: row.labourQuantityMilli,
      labourUnit: row.labourUnit,
      labourRateMinor: row.labourRateMinor,
      labourAmountMinor: row.labourAmountMinor,
      travelKilometresMilli: row.travelKilometresMilli,
      distanceBasis: row.distanceBasis,
      travelRateMinor: row.travelRateMinor,
      travelAmountMinor: row.travelAmountMinor,
      taxTreatment: row.taxTreatment,
      taxRuleId: row.taxRuleId ?? null,
      taxRuleVersion: row.taxRuleVersion ?? null,
      taxRateNumerator: row.taxRateNumerator ?? null,
      taxRateDenominator: row.taxRateDenominator ?? null,
      taxableAmountMinor: row.taxableAmountMinor,
      taxAmountMinor: row.taxAmountMinor,
      totalMinor: row.totalMinor,
      currency: "ZAR",
    },
    totalMinor: row.totalMinor,
    currency: "ZAR",
    documentHash: row.documentHash,
    sentAt: row.sentAt ?? null,
    recipient: row.recipient ?? null,
    dispatchEvidenceRef: row.dispatchEvidenceRef ?? null,
  };
}

function mapDecision(row: typeof frigoraQuotationDecisions.$inferSelect): FrigoraPersistedQuoteDecision {
  if (row.decision !== "approved" && row.decision !== "declined") {
    throw new FrigoraError("invalid_status", "Unknown quotation decision.");
  }
  return {
    id: row.id as FrigoraQuotationDecisionId,
    quotationId: row.quotationId as FrigoraQuotationId,
    workspaceId: row.workspaceId as WorkspaceId,
    ventureId: row.ventureId as VentureId,
    customerId: row.customerId as FrigoraCustomerId,
    siteId: row.siteId as FrigoraSiteId,
    version: row.versionNumber,
    documentHash: row.documentHash,
    decision: row.decision,
    grantId: row.grantId as FrigoraQuotationDecisionGrantId,
    decidedAt: row.decidedAt,
  };
}

function mapEvent(row: typeof frigoraQuotationEvents.$inferSelect): FrigoraPersistedQuoteEvent {
  return {
    id: row.id as FrigoraQuotationEventId,
    quotationId: row.quotationId as FrigoraQuotationId,
    workspaceId: row.workspaceId as WorkspaceId,
    ventureId: row.ventureId as VentureId,
    version: row.versionNumber,
    kind: assertPersistableEvent(row.kind),
    occurredAt: row.occurredAt,
    actorUserId: (row.actorUserId as UserId | null) ?? null,
    actorContactId: (row.actorContactId as FrigoraCustomerContactId | null) ?? null,
    evidenceRef: row.evidenceRef ?? null,
  };
}

function assertCurrentVersion(quotation: FrigoraPersistedQuotation) {
  const latest = quotation.versions.at(-1);
  const current = quotation.versions.find((version) => version.version === quotation.currentVersion);
  if (!latest || !current || latest.version !== quotation.currentVersion) {
    throw new FrigoraError("invalid_status", "Quotation current version is inconsistent.");
  }
}

async function loadAggregate(
  workspaceId: WorkspaceId,
  ventureId: VentureId,
  quotationId: FrigoraQuotationId,
): Promise<FrigoraPersistedQuotation | null> {
  await ensureSchema();
  const headers = await getDb()
    .select()
    .from(frigoraQuotations)
    .where(
      and(
        eq(frigoraQuotations.id, quotationId),
        eq(frigoraQuotations.workspaceId, workspaceId),
        eq(frigoraQuotations.ventureId, ventureId),
      ),
    )
    .limit(1);
  const header = headers[0];
  if (!header) {
    return null;
  }
  const versions = await getDb()
    .select()
    .from(frigoraQuotationVersions)
    .where(
      and(
        eq(frigoraQuotationVersions.quotationId, quotationId),
        eq(frigoraQuotationVersions.workspaceId, workspaceId),
        eq(frigoraQuotationVersions.ventureId, ventureId),
      ),
    )
    .orderBy(asc(frigoraQuotationVersions.versionNumber));
  const events = await getDb()
    .select()
    .from(frigoraQuotationEvents)
    .where(
      and(
        eq(frigoraQuotationEvents.quotationId, quotationId),
        eq(frigoraQuotationEvents.workspaceId, workspaceId),
        eq(frigoraQuotationEvents.ventureId, ventureId),
      ),
    )
    .orderBy(asc(frigoraQuotationEvents.occurredAt), asc(frigoraQuotationEvents.id));
  const decisions = await getDb()
    .select()
    .from(frigoraQuotationDecisions)
    .where(
      and(
        eq(frigoraQuotationDecisions.quotationId, quotationId),
        eq(frigoraQuotationDecisions.workspaceId, workspaceId),
        eq(frigoraQuotationDecisions.ventureId, ventureId),
      ),
    )
    .orderBy(asc(frigoraQuotationDecisions.versionNumber));
  const quotation: FrigoraPersistedQuotation = {
    id: header.id as FrigoraQuotationId,
    workspaceId: header.workspaceId as WorkspaceId,
    ventureId: header.ventureId as VentureId,
    customerId: header.customerId as FrigoraCustomerId,
    siteId: header.siteId as FrigoraSiteId,
    assetId: (header.assetId as FrigoraAssetId | null) ?? null,
    originalWorkOrderId: header.originalWorkOrderId as FrigoraWorkOrderId,
    recommendedActionId: header.recommendedActionId as FrigoraRecommendedActionId,
    currentVersion: header.currentVersion,
    createdAt: header.createdAt,
    updatedAt: header.updatedAt,
    versions: versions.map(mapVersion),
    events: events.map(mapEvent),
    decisions: decisions.map(mapDecision),
  };
  assertCurrentVersion(quotation);
  return quotation;
}

function errorText(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function duplicateEvent(error: unknown): boolean {
  const message = errorText(error);
  return /frigora_quotation_events/i.test(message) && /UNIQUE/i.test(message);
}

function lockedDatabase(error: unknown) {
  return /SQLITE_BUSY|database is locked|database is busy/i.test(errorText(error));
}

function versionConflict(error: unknown) {
  return /frigora_quotation_versions/i.test(errorText(error)) && /UNIQUE/i.test(errorText(error));
}

function duplicateDecision(error: unknown) {
  return /frigora_quotation_decisions/i.test(errorText(error)) && /UNIQUE/i.test(errorText(error));
}

function duplicateOutbox(error: unknown) {
  return /frigora_quotation_delivery_outbox/i.test(errorText(error)) && /UNIQUE/i.test(errorText(error));
}

function deliveryState(value: unknown): QuotationDeliveryState {
  if (!isQuotationDeliveryState(value)) {
    throw new FrigoraError("invalid_status", "Unknown quotation delivery state.");
  }
  return value;
}

function mapDeliveryOutbox(row: Record<string, unknown>): QuotationDeliveryOutbox {
  return {
    id: String(row.id),
    quotationId: String(row.quotation_id),
    workspaceId: String(row.workspace_id),
    ventureId: String(row.venture_id),
    version: Number(row.version_number),
    documentHash: String(row.document_hash),
    createdAt: String(row.created_at),
    actorUserId: String(row.actor_user_id),
    state: deliveryState(row.state),
    holdReason: String(row.hold_reason),
    providerMessageId: row.provider_message_id == null ? null : String(row.provider_message_id),
  };
}

async function readDeliveryOutbox(
  transaction: Transaction,
  workspaceId: WorkspaceId,
  ventureId: VentureId,
  quotationId: FrigoraQuotationId,
  version: number,
): Promise<QuotationDeliveryOutbox | null> {
  const result = await transaction.execute({
    sql: `
      SELECT id, quotation_id, workspace_id, venture_id, version_number, document_hash,
             created_at, actor_user_id, state, hold_reason, provider_message_id
      FROM frigora_quotation_delivery_outbox
      WHERE workspace_id = ?
        AND venture_id = ?
        AND quotation_id = ?
        AND version_number = ?
    `,
    args: [workspaceId, ventureId, quotationId, version],
  });
  const row = result.rows[0];
  return row ? mapDeliveryOutbox(row as Record<string, unknown>) : null;
}

async function insertDeliveryAttempt(
  transaction: Transaction,
  input: {
    attemptId: string;
    outboxId: string;
    occurredAt: string;
    actorUserId: UserId;
    outcome: QuotationDeliveryState;
    detail: string;
  },
) {
  const attempt = await transaction.execute({
    sql: `
      INSERT INTO frigora_quotation_delivery_attempts (
        id, outbox_id, occurred_at, actor_user_id, outcome, detail
      ) VALUES (?, ?, ?, ?, ?, ?)
    `,
    args: [
      input.attemptId,
      input.outboxId,
      input.occurredAt,
      input.actorUserId,
      input.outcome,
      input.detail,
    ],
  });
  if (attempt.rowsAffected !== 1) {
    throw new FrigoraError("invalid_status", "Quotation delivery attempt was not recorded.");
  }
}

async function insertIssueAudit(
  transaction: Transaction,
  input: {
    auditId: string;
    occurredAt: string;
    actorUserId: UserId;
    workspaceId: WorkspaceId;
    ventureId: VentureId;
    quotationId: FrigoraQuotationId;
    version: number;
    documentHash: string;
    outboxId: string;
    state: QuotationDeliveryState;
  },
) {
  const audit = await transaction.execute({
    sql: `
      INSERT INTO audit_events (
        id, action, occurred_at, actor_user_id, actor_kind,
        actor_agent_instance_id, actor_component, workspace_id, venture_id, metadata_json
      ) VALUES (?, ?, ?, ?, 'human', NULL, NULL, ?, ?, ?)
    `,
    args: [
      input.auditId,
      QUOTATION_ISSUE_AUDIT_ACTION,
      input.occurredAt,
      input.actorUserId,
      input.workspaceId,
      input.ventureId,
      JSON.stringify({
        quotationId: input.quotationId,
        version: String(input.version),
        documentHash: input.documentHash,
        outboxId: input.outboxId,
        deliveryState: input.state,
        customerDelivery: "not_sent",
      }),
    ],
  });
  if (audit.rowsAffected !== 1) {
    throw new FrigoraError("invalid_status", "Quotation issue audit was not recorded.");
  }
}

function sameSecretHash(stored: string, presented: string) {
  const expected = Buffer.from(stored, "hex");
  const actual = Buffer.from(presented, "hex");
  return expected.length > 0 && expected.length === actual.length && timingSafeEqual(expected, actual);
}

function cell(row: Record<string, unknown>, key: string) {
  return row[key] == null ? "" : String(row[key]);
}

const QUOTATION_CONFLICT = "This quotation changed since you opened it. Refresh before trying again.";

async function insertEvent(
  transaction: Transaction,
  event: {
    id: string;
    quotationId: string;
    workspaceId: string;
    ventureId: string;
    version: number;
    kind: FrigoraPersistedQuoteEventKind;
    occurredAt: string;
    actorUserId: string | null;
    actorContactId: string | null;
    evidenceRef: string | null;
  },
) {
  assertPersistableEvent(event.kind);
  if ((event.actorUserId == null) === (event.actorContactId == null)) {
    throw new FrigoraError("invalid_input", "Quotation event actor is not valid.");
  }
  try {
    const inserted = await transaction.execute({
      sql: `
        INSERT INTO frigora_quotation_events (
          id, quotation_id, workspace_id, venture_id, version_number, kind,
          occurred_at, actor_user_id, actor_contact_id, evidence_ref
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      args: [
        event.id,
        event.quotationId,
        event.workspaceId,
        event.ventureId,
        event.version,
        event.kind,
        event.occurredAt,
        event.actorUserId,
        event.actorContactId,
        event.evidenceRef,
      ],
    });
    if (inserted.rowsAffected !== 1) {
      throw new FrigoraError("duplicate", "Duplicate quotation event identifier.");
    }
  } catch (error) {
    if (error instanceof FrigoraError) {
      throw error;
    }
    if (duplicateEvent(error)) {
      throw new FrigoraError("duplicate", "Duplicate quotation event identifier.");
    }
    throw error;
  }
}

export function createQuotationPersistence(createWriteClient?: FrigoraWriteClientFactory) {
  return {
    async findPersistedQuotation(
      workspaceId: WorkspaceId,
      ventureId: VentureId,
      quotationId: FrigoraQuotationId,
    ) {
      return loadAggregate(workspaceId, ventureId, quotationId);
    },
    async listPersistedQuotationsByWorkOrder(
      workspaceId: WorkspaceId,
      ventureId: VentureId,
      workOrderId: FrigoraWorkOrderId,
    ) {
      await ensureSchema();
      const headers = await getDb()
        .select({ id: frigoraQuotations.id })
        .from(frigoraQuotations)
        .where(
          and(
            eq(frigoraQuotations.workspaceId, workspaceId),
            eq(frigoraQuotations.ventureId, ventureId),
            eq(frigoraQuotations.originalWorkOrderId, workOrderId),
          ),
        )
        .orderBy(asc(frigoraQuotations.createdAt), asc(frigoraQuotations.id));
      const quotations: FrigoraPersistedQuotation[] = [];
      for (const header of headers) {
        const quotation = await loadAggregate(
          workspaceId,
          ventureId,
          header.id as FrigoraQuotationId,
        );
        if (quotation) {
          quotations.push(quotation);
        }
      }
      return quotations;
    },
    async listPersistedQuotationsByAsset(
      workspaceId: WorkspaceId,
      ventureId: VentureId,
      assetId: FrigoraAssetId,
    ) {
      await ensureSchema();
      const headers = await getDb()
        .select({ id: frigoraQuotations.id })
        .from(frigoraQuotations)
        .where(
          and(
            eq(frigoraQuotations.workspaceId, workspaceId),
            eq(frigoraQuotations.ventureId, ventureId),
            eq(frigoraQuotations.assetId, assetId),
          ),
        )
        .orderBy(asc(frigoraQuotations.createdAt), asc(frigoraQuotations.id));
      const quotations: FrigoraPersistedQuotation[] = [];
      for (const header of headers) {
        const quotation = await loadAggregate(
          workspaceId,
          ventureId,
          header.id as FrigoraQuotationId,
        );
        if (quotation) {
          quotations.push(quotation);
        }
      }
      return quotations;
    },
    async listPersistedQuotations(workspaceId: WorkspaceId, ventureId: VentureId) {
      await ensureSchema();
      const headers = await getDb()
        .select({ id: frigoraQuotations.id })
        .from(frigoraQuotations)
        .where(
          and(
            eq(frigoraQuotations.workspaceId, workspaceId),
            eq(frigoraQuotations.ventureId, ventureId),
          ),
        )
        .orderBy(asc(frigoraQuotations.createdAt), asc(frigoraQuotations.id));
      const quotations: FrigoraPersistedQuotation[] = [];
      for (const header of headers) {
        const quotation = await loadAggregate(
          workspaceId,
          ventureId,
          header.id as FrigoraQuotationId,
        );
        if (quotation) {
          quotations.push(quotation);
        }
      }
      return quotations;
    },
    async commitQuotationCreate(input: QuotationCreateCommit) {
      if (input.lines) {
        await ensureFrigoraCommercialLinesSchema();
      } else {
        await ensureSchema();
      }
      assertPersistableStatus("in_preparation");
      await withFrigoraWriteTransaction(async (transaction) => {
          const inserted = await transaction.execute({
            sql: `
              INSERT INTO frigora_quotations (
                id, workspace_id, venture_id, customer_id, site_id, asset_id,
                original_work_order_id, recommended_action_id, current_version,
                created_at, updated_at
              )
              SELECT ?, ?, ?, w.customer_id, w.site_id, r.asset_id, w.id, r.id, 1, ?, ?
              FROM frigora_recommended_actions r
              JOIN frigora_work_orders w
                ON w.id = r.work_order_id
               AND w.workspace_id = r.workspace_id
               AND w.venture_id = r.venture_id
              WHERE r.id = ?
                AND r.workspace_id = ?
                AND r.venture_id = ?
                AND w.id = ?
                AND w.customer_id = ?
                AND w.site_id = ?
                AND r.asset_id IS ?
            `,
            args: [
              input.id,
              input.workspaceId,
              input.ventureId,
              input.createdAt,
              input.createdAt,
              input.recommendedActionId,
              input.workspaceId,
              input.ventureId,
              input.originalWorkOrderId,
              input.customerId,
              input.siteId,
              input.assetId,
            ],
          });
          if (inserted.rowsAffected !== 1) {
            throw new FrigoraError(
              "invalid_input",
              "Recommended action is not in the authorised work-order scope.",
            );
          }
          const version = await transaction.execute({
            sql: `
              INSERT INTO frigora_quotation_versions (
                quotation_id, workspace_id, venture_id, version_number, status, description,
                total_minor, currency, document_hash, sent_at, recipient, dispatch_evidence_ref,
                ${COMMERCIAL_COLUMNS}
              ) VALUES (?, ?, ?, 1, 'in_preparation', ?, ?, 'ZAR', ?, NULL, NULL, NULL,
                ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `,
            args: [
              input.id,
              input.workspaceId,
              input.ventureId,
              input.description,
              input.totalMinor,
              input.documentHash,
              ...commercialArgs(input.commercial),
            ],
          });
          if (version.rowsAffected !== 1) {
            throw new FrigoraError("invalid_input", "Quotation version was not stored.");
          }
          if (input.lines) {
            await insertQuotationLineSnapshots(transaction, input.lines);
          }
          await insertEvent(transaction, {
            id: input.eventId,
            quotationId: input.id,
            workspaceId: input.workspaceId,
            ventureId: input.ventureId,
            version: 1,
            kind: "created",
            occurredAt: input.createdAt,
            actorUserId: input.actorUserId,
            actorContactId: null,
            evidenceRef: null,
          });
        }, createWriteClient);
    },
    async commitQuotationCorrect(input: QuotationCorrectCommit) {
      if (input.lines) {
        await ensureFrigoraCommercialLinesSchema();
      } else {
        await ensureSchema();
      }
      assertPersistableStatus("in_preparation");
      try {
        await withFrigoraWriteTransaction(async (transaction) => {
          const updated = await transaction.execute({
            sql: `
              UPDATE frigora_quotation_versions
              SET description = ?,
                  total_minor = ?,
                  document_hash = ?,
                  labour_quantity_milli = ?,
                  labour_unit = ?,
                  labour_rate_minor = ?,
                  labour_amount_minor = ?,
                  travel_kilometres_milli = ?,
                  distance_basis = ?,
                  travel_rate_minor = ?,
                  travel_amount_minor = ?,
                  tax_treatment = ?,
                  tax_rule_id = ?,
                  tax_rule_version = ?,
                  tax_rate_numerator = ?,
                  tax_rate_denominator = ?,
                  taxable_amount_minor = ?,
                  tax_amount_minor = ?
              WHERE quotation_id = ?
                AND workspace_id = ?
                AND venture_id = ?
                AND version_number = ?
                AND status = 'in_preparation'
            `,
            args: [
              input.description,
              input.totalMinor,
              input.documentHash,
              ...commercialArgs(input.commercial),
              input.quotationId,
              input.workspaceId,
              input.ventureId,
              input.expectedCurrentVersion,
            ],
          });
          if (updated.rowsAffected !== 1) {
            throw new FrigoraError(
              "quotation_conflict",
              "Quotation draft could not be corrected from its current version.",
            );
          }
          const header = await transaction.execute({
            sql: `
              UPDATE frigora_quotations
              SET updated_at = ?
              WHERE id = ?
                AND workspace_id = ?
                AND venture_id = ?
                AND current_version = ?
            `,
            args: [
              input.updatedAt,
              input.quotationId,
              input.workspaceId,
              input.ventureId,
              input.expectedCurrentVersion,
            ],
          });
          if (header.rowsAffected !== 1) {
            throw new FrigoraError("quotation_conflict", QUOTATION_CONFLICT);
          }
          if (input.lines) {
            await replaceDraftQuotationLines(
              transaction,
              { workspaceId: input.workspaceId, ventureId: input.ventureId },
              input.quotationId,
              input.expectedCurrentVersion,
              input.lines,
            );
          }
        }, createWriteClient);
      } catch (error) {
        if (error instanceof FrigoraError) {
          throw error;
        }
        if (lockedDatabase(error)) {
          throw new FrigoraError("quotation_conflict", QUOTATION_CONFLICT);
        }
        if (/immutable/i.test(errorText(error))) {
          throw new FrigoraError(
            "invalid_status",
            "Only a draft in preparation can be corrected.",
          );
        }
        throw error;
      }
    },
    async commitQuotationSend(input: QuotationSendCommit) {
      await ensureSchema();
      assertPersistableStatus("awaiting_customer_approval");
      try {
        await withFrigoraWriteTransaction(async (transaction) => {
          await assertSendableVersionHasNoLines(
            transaction,
            { workspaceId: input.workspaceId, ventureId: input.ventureId },
            input.quotationId,
            input.expectedCurrentVersion,
          );
          await insertEvent(transaction, {
            id: input.eventId,
            quotationId: input.quotationId,
            workspaceId: input.workspaceId,
            ventureId: input.ventureId,
            version: input.expectedCurrentVersion,
            kind: "sent",
            occurredAt: input.sentAt,
            actorUserId: input.actorUserId,
            actorContactId: null,
            evidenceRef: input.dispatchEvidenceRef,
          });
          const updated = await transaction.execute({
            sql: `
              UPDATE frigora_quotation_versions
              SET status = 'awaiting_customer_approval',
                  sent_at = ?,
                  recipient = ?,
                  dispatch_evidence_ref = ?
              WHERE quotation_id = ?
                AND workspace_id = ?
                AND venture_id = ?
                AND version_number = ?
                AND status = 'in_preparation'
                AND description = ?
                AND total_minor = ?
                AND document_hash = ?
                AND currency = 'ZAR'
                AND EXISTS (
                  SELECT 1 FROM frigora_quotation_events
                  WHERE id = ?
                    AND quotation_id = frigora_quotation_versions.quotation_id
                    AND kind = 'sent'
                    AND evidence_ref = ?
                )
            `,
            args: [
              input.sentAt,
              input.recipient,
              input.dispatchEvidenceRef,
              input.quotationId,
              input.workspaceId,
              input.ventureId,
              input.expectedCurrentVersion,
              input.description,
              input.totalMinor,
              input.documentHash,
              input.eventId,
              input.dispatchEvidenceRef,
            ],
          });
          if (updated.rowsAffected !== 1) {
            throw new FrigoraError(
              "quotation_conflict",
              "Quotation could not be sent from its current version.",
            );
          }
          const header = await transaction.execute({
            sql: `
              UPDATE frigora_quotations
              SET updated_at = ?
              WHERE id = ?
                AND workspace_id = ?
                AND venture_id = ?
                AND current_version = ?
            `,
            args: [
              input.updatedAt,
              input.quotationId,
              input.workspaceId,
              input.ventureId,
              input.expectedCurrentVersion,
            ],
          });
          if (header.rowsAffected !== 1) {
            throw new FrigoraError("quotation_conflict", QUOTATION_CONFLICT);
          }
          const outbox = await transaction.execute({
            sql: `
              INSERT INTO frigora_quotation_delivery_outbox (
                id, quotation_id, workspace_id, venture_id, version_number, document_hash,
                created_at, actor_user_id, state, hold_reason, provider_message_id
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'held_pending_customer_access', ?, NULL)
            `,
            args: [
              input.outboxId,
              input.quotationId,
              input.workspaceId,
              input.ventureId,
              input.expectedCurrentVersion,
              input.documentHash,
              input.sentAt,
              input.actorUserId,
              QUOTATION_DELIVERY_HELD_REASON,
            ],
          });
          if (outbox.rowsAffected !== 1) {
            throw new FrigoraError("invalid_status", "Quotation delivery outbox was not recorded.");
          }
          await insertDeliveryAttempt(transaction, {
            attemptId: input.attemptId,
            outboxId: input.outboxId,
            occurredAt: input.sentAt,
            actorUserId: input.actorUserId,
            outcome: "held_pending_customer_access",
            detail: QUOTATION_ISSUE_ATTEMPT_DETAIL,
          });
          await insertIssueAudit(transaction, {
            auditId: input.auditId,
            occurredAt: input.sentAt,
            actorUserId: input.actorUserId,
            workspaceId: input.workspaceId,
            ventureId: input.ventureId,
            quotationId: input.quotationId,
            version: input.expectedCurrentVersion,
            documentHash: input.documentHash,
            outboxId: input.outboxId,
            state: "held_pending_customer_access",
          });
        }, createWriteClient);
      } catch (error) {
        if (error instanceof FrigoraError) {
          throw error;
        }
        if (/line-bearing quotation cannot be issued|discount-eligible quotation lines cannot be issued|configured-rule lines require a configured tax snapshot|line-bearing quotation versions require a commercial snapshot/i.test(errorText(error))) {
          throw new FrigoraError("invalid_status", COMMERCIAL_LINE_ISSUE_BLOCKED);
        }
        if (lockedDatabase(error) || duplicateOutbox(error)) {
          throw new FrigoraError("quotation_conflict", QUOTATION_CONFLICT);
        }
        throw error;
      }
    },
    async commitQuotationRevision(input: QuotationReviseCommit) {
      await ensureSchema();
      assertPersistableStatus("in_preparation");
      try {
        await withFrigoraWriteTransaction(async (transaction) => {
          const version = await transaction.execute({
            sql: `
              INSERT INTO frigora_quotation_versions (
                quotation_id, workspace_id, venture_id, version_number, status, description,
                total_minor, currency, document_hash, sent_at, recipient, dispatch_evidence_ref,
                ${COMMERCIAL_COLUMNS}
              )
              SELECT ?, ?, ?, ?, 'in_preparation', ?, ?, 'ZAR', ?, NULL, NULL, NULL,
                ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
              FROM frigora_quotations
              WHERE id = ?
                AND workspace_id = ?
                AND venture_id = ?
                AND current_version = ?
            `,
            args: [
              input.quotationId,
              input.workspaceId,
              input.ventureId,
              input.nextVersion,
              input.description,
              input.totalMinor,
              input.documentHash,
              ...commercialArgs(input.commercial),
              input.quotationId,
              input.workspaceId,
              input.ventureId,
              input.expectedCurrentVersion,
            ],
          });
          if (version.rowsAffected !== 1) {
            throw new FrigoraError("quotation_conflict", QUOTATION_CONFLICT);
          }
          await copyQuotationLinesToRevision(
            transaction,
            { workspaceId: input.workspaceId, ventureId: input.ventureId },
            input.quotationId,
            input.expectedCurrentVersion,
            input.nextVersion,
            input.actorUserId,
            input.occurredAt,
          );
          await insertEvent(transaction, {
            id: input.eventId,
            quotationId: input.quotationId,
            workspaceId: input.workspaceId,
            ventureId: input.ventureId,
            version: input.nextVersion,
            kind: "revision_started",
            occurredAt: input.occurredAt,
            actorUserId: input.actorUserId,
            actorContactId: null,
            evidenceRef: null,
          });
          const header = await transaction.execute({
            sql: `
              UPDATE frigora_quotations
              SET current_version = ?, updated_at = ?
              WHERE id = ?
                AND workspace_id = ?
                AND venture_id = ?
                AND current_version = ?
            `,
            args: [
              input.nextVersion,
              input.occurredAt,
              input.quotationId,
              input.workspaceId,
              input.ventureId,
              input.expectedCurrentVersion,
            ],
          });
          if (header.rowsAffected !== 1) {
            throw new FrigoraError("quotation_conflict", QUOTATION_CONFLICT);
          }
        }, createWriteClient);
      } catch (error) {
        if (error instanceof FrigoraError) {
          throw error;
        }
        if (lockedDatabase(error) || versionConflict(error)) {
          throw new FrigoraError("quotation_conflict", QUOTATION_CONFLICT);
        }
        throw error;
      }
    },
    async commitQuotationDecisionGrant(input: QuotationDecisionGrantCommit) {
      await ensureSchema();
      await assertPersistedOfferDocument(
        { workspaceId: input.workspaceId, ventureId: input.ventureId },
        input.quotationId,
        input.version,
      );
      try {
        await withFrigoraWriteTransaction(async (transaction) => {
          const inserted = await transaction.execute(decisionGrantInsert(input));
          if (inserted.rowsAffected !== 1) {
            await rejectUnguardedGrantInsert(transaction, input);
          }
          const stored = await transaction.execute({
            sql: `SELECT contact_id FROM frigora_quotation_decision_grants WHERE id = ?`,
            args: [input.id],
          });
          const storedContact = stored.rows[0]?.contact_id;
          await transaction.execute({
            sql: `
              INSERT INTO audit_events (
                id, action, occurred_at, actor_user_id, actor_kind,
                actor_agent_instance_id, actor_component, workspace_id, venture_id, metadata_json
              ) VALUES (?, 'frigora.quotation.customer_access_prepared', ?, ?, 'human', NULL, NULL, ?, ?, ?)
            `,
            args: [
              createId(),
              input.issuedAt,
              input.issuedByUserId,
              input.workspaceId,
              input.ventureId,
              JSON.stringify({
                grantId: input.id,
                quotationId: input.quotationId,
                version: String(input.version),
                contactId: storedContact == null ? "" : String(storedContact),
                expiresAt: input.expiresAt,
              }),
            ],
          });
        }, createWriteClient);
      } catch (error) {
        if (error instanceof FrigoraError) {
          throw error;
        }
        if (lockedDatabase(error)) {
          throw new FrigoraError("quotation_conflict", QUOTATION_CONFLICT);
        }
        throw error;
      }
    },
    async revokeQuotationDecisionGrant(input: {
      id: FrigoraQuotationDecisionGrantId;
      workspaceId: WorkspaceId;
      ventureId: VentureId;
      revokedAt: string;
      deliveryFailure?: {
        outcome: "rejected" | "unknown" | "unavailable";
        actorUserId: UserId;
      };
    }) {
      await ensureSchema();
      await withFrigoraWriteTransaction(async (transaction) => {
        const updated = await transaction.execute({
          sql: `
            UPDATE frigora_quotation_decision_grants
            SET revoked_at = ?
            WHERE id = ?
              AND workspace_id = ?
              AND venture_id = ?
              AND consumed_at IS NULL
              AND revoked_at IS NULL
          `,
          args: [input.revokedAt, input.id, input.workspaceId, input.ventureId],
        });
        if (updated.rowsAffected === 1) {
          await transaction.execute({
            sql: `
              INSERT INTO audit_events (
                id, action, occurred_at, actor_user_id, actor_kind,
                actor_agent_instance_id, actor_component, workspace_id, venture_id, metadata_json
              ) VALUES (?, 'frigora.quotation.customer_access_revoked', ?, NULL, NULL, NULL, NULL, ?, ?, ?)
            `,
            args: [
              createId(),
              input.revokedAt,
              input.workspaceId,
              input.ventureId,
              JSON.stringify({ grantId: input.id }),
            ],
          });
        } else if (!input.deliveryFailure) {
          throw new FrigoraError("decision_rejected", "Decision grant could not be revoked.");
        } else {
          const existing = await transaction.execute({
            sql: `
              SELECT revoked_at
              FROM frigora_quotation_decision_grants
              WHERE id = ? AND workspace_id = ? AND venture_id = ?
            `,
            args: [input.id, input.workspaceId, input.ventureId],
          });
          if (!existing.rows[0]?.revoked_at) {
            throw new FrigoraError("decision_rejected", "Decision grant could not be revoked.");
          }
        }
        if (input.deliveryFailure) {
          const grant = await transaction.execute({
            sql: `
              SELECT quotation_id
              FROM frigora_quotation_decision_grants
              WHERE id = ? AND workspace_id = ? AND venture_id = ?
            `,
            args: [input.id, input.workspaceId, input.ventureId],
          });
          await transaction.execute({
            sql: `
              INSERT INTO audit_events (
                id, action, occurred_at, actor_user_id, actor_kind,
                actor_agent_instance_id, actor_component, workspace_id, venture_id, metadata_json
              ) VALUES (?, 'frigora.quotation.decision_grant_delivery_failed', ?, ?, 'human', NULL, NULL, ?, ?, ?)
            `,
            args: [
              createId(),
              input.revokedAt,
              input.deliveryFailure.actorUserId,
              input.workspaceId,
              input.ventureId,
              JSON.stringify({
                grantId: input.id,
                quotationId: String(grant.rows[0]?.quotation_id ?? ""),
                outcome: input.deliveryFailure.outcome,
              }),
            ],
          });
        }
      }, createWriteClient);
    },
    async listQuotationDecisionGrants(
      workspaceId: WorkspaceId,
      ventureId: VentureId,
      quotationId: FrigoraQuotationId,
      now: string,
    ) {
      await ensureSchema();
      const result = await getClient().execute({
        sql: `
          SELECT g.id, g.version_number, g.document_hash, g.issued_at, g.expires_at, g.consumed_at, g.revoked_at,
                 d.decision
          FROM frigora_quotation_decision_grants g
          LEFT JOIN frigora_quotation_decisions d
            ON d.grant_id = g.id
           AND d.workspace_id = g.workspace_id
           AND d.venture_id = g.venture_id
          WHERE g.workspace_id = ?
            AND g.venture_id = ?
            AND g.quotation_id = ?
          ORDER BY g.issued_at, g.id
        `,
        args: [workspaceId, ventureId, quotationId],
      });
      const nowMs = Date.parse(now);
      return result.rows.map((row) => {
        const record = row as Record<string, unknown>;
        const rawDecision = record.decision;
        let decision: "approved" | "declined" | null = null;
        if (rawDecision === "approved") decision = "approved";
        else if (rawDecision === "declined") decision = "declined";
        const expiresAt = String(record.expires_at);
        let state: "active" | "expired" | "revoked" | "consumed" = "active";
        if (record.revoked_at) state = "revoked";
        else if (record.consumed_at || decision) state = "consumed";
        else if (Number.isNaN(nowMs) || Date.parse(expiresAt) <= nowMs) state = "expired";
        return {
          id: String(record.id),
          version: Number(record.version_number),
          documentHash: String(record.document_hash),
          issuedAt: String(record.issued_at),
          expiresAt,
          state,
          decision,
        };
      });
    },
    async commitQuotationDecision(input: QuotationDecisionCommit) {
      await ensureSchema();
      if (input.decision !== "approved" && input.decision !== "declined") {
        throw new FrigoraError("decision_rejected", "Decision grant is not valid.");
      }
      if ((input.actorUserId == null) === (input.actorContactId == null)) {
        throw new FrigoraError("invalid_input", "Quotation decision actor is not valid.");
      }
      try {
        await withFrigoraWriteTransaction(async (transaction) => {
          const grantResult = await transaction.execute({
            sql: `
              SELECT secret_hash, quotation_id, workspace_id, venture_id, customer_id, site_id,
                     version_number, document_hash, expires_at, consumed_at, revoked_at, contact_id
              FROM frigora_quotation_decision_grants
              WHERE id = ?
            `,
            args: [input.grantId],
          });
          const grant = grantResult.rows[0] as Record<string, unknown> | undefined;
          if (!grant || !sameSecretHash(cell(grant, "secret_hash"), input.secretHash)) {
            throw new FrigoraError("decision_rejected", "Decision grant is not valid.");
          }
          const matchesScope = cell(grant, "quotation_id") === input.quotationId
            && cell(grant, "workspace_id") === input.workspaceId
            && cell(grant, "venture_id") === input.ventureId
            && cell(grant, "customer_id") === input.customerId
            && cell(grant, "site_id") === input.siteId;
          if (!matchesScope) {
            throw new FrigoraError("decision_rejected", "Decision grant does not match this quotation.");
          }
          if (input.actorContactId != null && cell(grant, "contact_id") !== input.actorContactId) {
            throw new FrigoraError("decision_rejected", "Decision grant is not valid.");
          }
          if (cell(grant, "revoked_at")) {
            throw new FrigoraError("decision_rejected", "Decision grant has been revoked.");
          }
          if (cell(grant, "consumed_at")) {
            throw new FrigoraError("decision_rejected", "Decision grant has already been used.");
          }
          const expiresAt = Date.parse(cell(grant, "expires_at"));
          const now = Date.parse(input.now);
          if (Number.isNaN(expiresAt) || Number.isNaN(now) || expiresAt <= now) {
            throw new FrigoraError("decision_rejected", "Decision grant has expired.");
          }
          const headerResult = await transaction.execute({
            sql: `
              SELECT current_version, customer_id, site_id
              FROM frigora_quotations
              WHERE id = ? AND workspace_id = ? AND venture_id = ?
            `,
            args: [input.quotationId, input.workspaceId, input.ventureId],
          });
          const header = headerResult.rows[0] as Record<string, unknown> | undefined;
          if (!header) {
            throw new FrigoraError("not_found", "Quotation was not found.");
          }
          if (Number(header.current_version) !== Number(grant.version_number)) {
            throw new FrigoraError(
              "quotation_conflict",
              "This quotation changed since the decision grant was issued.",
            );
          }
          if (cell(header, "customer_id") !== input.customerId || cell(header, "site_id") !== input.siteId) {
            throw new FrigoraError("decision_rejected", "Decision grant does not match this quotation.");
          }
          const versionResult = await transaction.execute({
            sql: `
              SELECT status, document_hash
              FROM frigora_quotation_versions
              WHERE quotation_id = ?
                AND version_number = ?
                AND workspace_id = ?
                AND venture_id = ?
            `,
            args: [input.quotationId, Number(grant.version_number), input.workspaceId, input.ventureId],
          });
          const version = versionResult.rows[0] as Record<string, unknown> | undefined;
          if (!version || cell(version, "status") !== "awaiting_customer_approval") {
            throw new FrigoraError("invalid_status", "Quotation is no longer awaiting a customer decision.");
          }
          if (cell(version, "document_hash") !== cell(grant, "document_hash")) {
            throw new FrigoraError("decision_rejected", "Decision grant does not match the quotation document.");
          }
          const existing = await transaction.execute({
            sql: `
              SELECT id FROM frigora_quotation_decisions
              WHERE quotation_id = ? AND version_number = ?
            `,
            args: [input.quotationId, Number(grant.version_number)],
          });
          if (existing.rows.length > 0) {
            throw new FrigoraError("duplicate", "A decision has already been recorded for this quotation version.");
          }
          const inserted = await transaction.execute({
            sql: `
              INSERT INTO frigora_quotation_decisions (
                id, quotation_id, workspace_id, venture_id, customer_id, site_id,
                version_number, document_hash, decision, grant_id, decided_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `,
            args: [
              input.decisionId,
              input.quotationId,
              input.workspaceId,
              input.ventureId,
              input.customerId,
              input.siteId,
              Number(grant.version_number),
              cell(grant, "document_hash"),
              input.decision,
              input.grantId,
              input.now,
            ],
          });
          if (inserted.rowsAffected !== 1) {
            throw new FrigoraError("duplicate", "A decision has already been recorded for this quotation version.");
          }
          if (input.decision === "declined" && (input.selectionLines?.length ?? 0) > 0) {
            throw new FrigoraError("invalid_input", "A declined quotation cannot record selected lines.");
          }
          for (const selection of input.selectionLines ?? []) {
            const written = await transaction.execute({
              sql: `
                INSERT INTO frigora_quotation_decision_lines (decision_id, line_id, inclusion)
                VALUES (?, ?, ?)
              `,
              args: [input.decisionId, selection.lineId, selection.inclusion],
            });
            if (written.rowsAffected !== 1) {
              throw new FrigoraError("invalid_input", "The selected quotation line was not recorded.");
            }
          }
          const updated = await transaction.execute({
            sql: `
              UPDATE frigora_quotation_versions
              SET status = ?
              WHERE quotation_id = ?
                AND workspace_id = ?
                AND venture_id = ?
                AND version_number = ?
                AND status = 'awaiting_customer_approval'
                AND document_hash = ?
            `,
            args: [
              input.decision,
              input.quotationId,
              input.workspaceId,
              input.ventureId,
              Number(grant.version_number),
              cell(grant, "document_hash"),
            ],
          });
          if (updated.rowsAffected !== 1) {
            throw new FrigoraError("quotation_conflict", QUOTATION_CONFLICT);
          }
          await insertEvent(transaction, {
            id: input.eventId,
            quotationId: input.quotationId,
            workspaceId: input.workspaceId,
            ventureId: input.ventureId,
            version: Number(grant.version_number),
            kind: input.decision,
            occurredAt: input.now,
            actorUserId: input.actorUserId,
            actorContactId: input.actorContactId,
            evidenceRef: input.decisionId,
          });
          const consumed = await transaction.execute({
            sql: `
              UPDATE frigora_quotation_decision_grants
              SET consumed_at = ?, decision_id = ?
              WHERE id = ?
                AND secret_hash = ?
                AND consumed_at IS NULL
                AND revoked_at IS NULL
                AND quotation_id = ?
                AND workspace_id = ?
                AND venture_id = ?
                AND version_number = ?
            `,
            args: [
              input.now,
              input.decisionId,
              input.grantId,
              input.secretHash,
              input.quotationId,
              input.workspaceId,
              input.ventureId,
              Number(grant.version_number),
            ],
          });
          if (consumed.rowsAffected !== 1) {
            throw new FrigoraError("decision_rejected", "Decision grant has already been used.");
          }
          const headerUpdate = await transaction.execute({
            sql: `
              UPDATE frigora_quotations
              SET updated_at = ?
              WHERE id = ?
                AND workspace_id = ?
                AND venture_id = ?
                AND current_version = ?
            `,
            args: [
              input.now,
              input.quotationId,
              input.workspaceId,
              input.ventureId,
              Number(grant.version_number),
            ],
          });
          if (headerUpdate.rowsAffected !== 1) {
            throw new FrigoraError("quotation_conflict", QUOTATION_CONFLICT);
          }
          await transaction.execute({
            sql: `
              INSERT INTO audit_events (
                id, action, occurred_at, actor_user_id, actor_kind,
                actor_agent_instance_id, actor_component, workspace_id, venture_id, metadata_json
              ) VALUES (?, 'frigora.quotation.customer_decision_recorded', ?, ?, NULL, NULL, NULL, ?, ?, ?)
            `,
            args: [
              createId(),
              input.now,
              input.actorUserId,
              input.workspaceId,
              input.ventureId,
              JSON.stringify({
                grantId: input.grantId,
                contactId: input.actorContactId ?? "",
                quotationId: input.quotationId,
                version: String(grant.version_number),
                decision: input.decision,
                decidedAt: input.now,
                authorisedTotalMinor: input.authorisedTotalMinor ?? null,
                selectedOptionalLineIds: input.selectedOptionalLineIds ?? [],
              }),
            ],
          });
        }, createWriteClient);
      } catch (error) {
        if (error instanceof FrigoraError) {
          throw error;
        }
        if (duplicateDecision(error)) {
          throw new FrigoraError("duplicate", "A decision has already been recorded for this quotation version.");
        }
        if (lockedDatabase(error)) {
          throw new FrigoraError("quotation_conflict", QUOTATION_CONFLICT);
        }
        throw error;
      }
    },
    async findQuotationDeliveryOutbox(
      workspaceId: WorkspaceId,
      ventureId: VentureId,
      quotationId: FrigoraQuotationId,
      version: number,
    ): Promise<QuotationDeliveryOutbox | null> {
      await ensureSchema();
      const result = await getClient().execute({
        sql: `
          SELECT id, quotation_id, workspace_id, venture_id, version_number, document_hash,
                 created_at, actor_user_id, state, hold_reason, provider_message_id
          FROM frigora_quotation_delivery_outbox
          WHERE workspace_id = ?
            AND venture_id = ?
            AND quotation_id = ?
            AND version_number = ?
        `,
        args: [workspaceId, ventureId, quotationId, version],
      });
      const row = result.rows[0];
      return row ? mapDeliveryOutbox(row as Record<string, unknown>) : null;
    },
    async commitQuotationDeliveryRecovery(
      input: QuotationDeliveryRecoveryCommit,
    ): Promise<QuotationDeliveryRecovery> {
      await ensureSchema();
      try {
        return await withFrigoraWriteTransaction(async (transaction) => {
          const version = await transaction.execute({
            sql: `
              SELECT status, document_hash
              FROM frigora_quotation_versions
              WHERE quotation_id = ?
                AND workspace_id = ?
                AND venture_id = ?
                AND version_number = ?
            `,
            args: [input.quotationId, input.workspaceId, input.ventureId, input.version],
          });
          const versionRow = version.rows[0] as { status?: unknown; document_hash?: unknown } | undefined;
          if (!versionRow) {
            throw new FrigoraError("not_found", "Quotation version was not found.");
          }
          if (versionRow.status !== "awaiting_customer_approval") {
            throw new FrigoraError(
              "invalid_status",
              "Only an issued quotation version can be recovered. No email was sent.",
            );
          }
          const storedHash = String(versionRow.document_hash);
          const grants = await transaction.execute({
            sql: `
              SELECT COUNT(*) AS grant_count
              FROM frigora_quotation_decision_grants
              WHERE quotation_id = ?
                AND workspace_id = ?
                AND venture_id = ?
                AND version_number = ?
            `,
            args: [input.quotationId, input.workspaceId, input.ventureId, input.version],
          });
          const grantCount = Number(
            (grants.rows[0] as { grant_count?: unknown } | undefined)?.grant_count ?? 0,
          );
          if (grantCount > 0) {
            throw new FrigoraError(
              "invalid_status",
              "A decision grant already exists. Recovery will not send email or create a grant.",
            );
          }
          const existing = await readDeliveryOutbox(
            transaction,
            input.workspaceId,
            input.ventureId,
            input.quotationId,
            input.version,
          );
          if (
            existing
            && existing.state !== "held_pending_customer_access"
            && existing.state !== "outcome_unknown"
          ) {
            throw new FrigoraError(
              "invalid_status",
              "Delivery has left the held state. Recovery will not send email or treat that state as inbox delivery.",
            );
          }
          const snapshotMatches = input.recomputedHash === storedHash;
          const outboxMatches = existing?.documentHash === storedHash;
          if (existing?.state === "outcome_unknown") {
            return {
              delivery: existing,
              action: "already_unknown" as const,
              customerDelivery: "not_sent" as const,
              decisionGrantCreated: false as const,
            };
          }
          if (existing?.state === "held_pending_customer_access" && outboxMatches && snapshotMatches) {
            return {
              delivery: existing,
              action: "already_held" as const,
              customerDelivery: "not_sent" as const,
              decisionGrantCreated: false as const,
            };
          }
          if (existing && (!outboxMatches || !snapshotMatches)) {
            const updated = await transaction.execute({
              sql: `
                UPDATE frigora_quotation_delivery_outbox
                SET state = 'outcome_unknown'
                WHERE id = ?
                  AND state = 'held_pending_customer_access'
              `,
              args: [existing.id],
            });
            if (updated.rowsAffected !== 1) {
              throw new FrigoraError("invalid_status", "Quotation delivery outcome could not be recorded.");
            }
            await insertDeliveryAttempt(transaction, {
              attemptId: input.attemptId,
              outboxId: existing.id,
              occurredAt: input.occurredAt,
              actorUserId: input.actorUserId,
              outcome: "outcome_unknown",
              detail: QUOTATION_DELIVERY_UNKNOWN_DETAIL,
            });
            await insertIssueAudit(transaction, {
              auditId: input.auditId,
              occurredAt: input.occurredAt,
              actorUserId: input.actorUserId,
              workspaceId: input.workspaceId,
              ventureId: input.ventureId,
              quotationId: input.quotationId,
              version: input.version,
              documentHash: existing.documentHash,
              outboxId: existing.id,
              state: "outcome_unknown",
            });
            const delivery = await readDeliveryOutbox(
              transaction,
              input.workspaceId,
              input.ventureId,
              input.quotationId,
              input.version,
            );
            if (!delivery || delivery.state !== "outcome_unknown") {
              throw new FrigoraError("invalid_status", "Quotation delivery outcome was not recorded.");
            }
            return {
              delivery,
              action: "marked_outcome_unknown" as const,
              customerDelivery: "not_sent" as const,
              decisionGrantCreated: false as const,
            };
          }
          if (!snapshotMatches) {
            const inserted = await transaction.execute({
              sql: `
                INSERT INTO frigora_quotation_delivery_outbox (
                  id, quotation_id, workspace_id, venture_id, version_number, document_hash,
                  created_at, actor_user_id, state, hold_reason, provider_message_id
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'outcome_unknown', ?, NULL)
              `,
              args: [
                input.outboxId,
                input.quotationId,
                input.workspaceId,
                input.ventureId,
                input.version,
                storedHash,
                input.occurredAt,
                input.actorUserId,
                QUOTATION_DELIVERY_UNKNOWN_DETAIL,
              ],
            });
            if (inserted.rowsAffected !== 1) {
              throw new FrigoraError("invalid_status", "Quotation delivery outcome was not recorded.");
            }
            await insertDeliveryAttempt(transaction, {
              attemptId: input.attemptId,
              outboxId: input.outboxId,
              occurredAt: input.occurredAt,
              actorUserId: input.actorUserId,
              outcome: "outcome_unknown",
              detail: QUOTATION_DELIVERY_UNKNOWN_DETAIL,
            });
            await insertIssueAudit(transaction, {
              auditId: input.auditId,
              occurredAt: input.occurredAt,
              actorUserId: input.actorUserId,
              workspaceId: input.workspaceId,
              ventureId: input.ventureId,
              quotationId: input.quotationId,
              version: input.version,
              documentHash: storedHash,
              outboxId: input.outboxId,
              state: "outcome_unknown",
            });
          } else {
            const inserted = await transaction.execute({
              sql: `
                INSERT INTO frigora_quotation_delivery_outbox (
                  id, quotation_id, workspace_id, venture_id, version_number, document_hash,
                  created_at, actor_user_id, state, hold_reason, provider_message_id
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'held_pending_customer_access', ?, NULL)
              `,
              args: [
                input.outboxId,
                input.quotationId,
                input.workspaceId,
                input.ventureId,
                input.version,
                storedHash,
                input.occurredAt,
                input.actorUserId,
                QUOTATION_DELIVERY_HELD_REASON,
              ],
            });
            if (inserted.rowsAffected !== 1) {
              throw new FrigoraError("invalid_status", "Quotation delivery outbox was not recorded.");
            }
            await insertDeliveryAttempt(transaction, {
              attemptId: input.attemptId,
              outboxId: input.outboxId,
              occurredAt: input.occurredAt,
              actorUserId: input.actorUserId,
              outcome: "held_pending_customer_access",
              detail: QUOTATION_DELIVERY_RESTORED_DETAIL,
            });
            await insertIssueAudit(transaction, {
              auditId: input.auditId,
              occurredAt: input.occurredAt,
              actorUserId: input.actorUserId,
              workspaceId: input.workspaceId,
              ventureId: input.ventureId,
              quotationId: input.quotationId,
              version: input.version,
              documentHash: storedHash,
              outboxId: input.outboxId,
              state: "held_pending_customer_access",
            });
          }
          const delivery = await readDeliveryOutbox(
            transaction,
            input.workspaceId,
            input.ventureId,
            input.quotationId,
            input.version,
          );
          if (!delivery) {
            throw new FrigoraError("invalid_status", "Quotation delivery outbox was not recorded.");
          }
          return {
            delivery,
            action: delivery.state === "held_pending_customer_access"
              ? "restored_held" as const
              : "marked_outcome_unknown" as const,
            customerDelivery: "not_sent" as const,
            decisionGrantCreated: false as const,
          };
        }, createWriteClient);
      } catch (error) {
        if (error instanceof FrigoraError) {
          throw error;
        }
        if (lockedDatabase(error)) {
          throw new FrigoraError("quotation_conflict", QUOTATION_CONFLICT);
        }
        throw error;
      }
    },
  };
}
