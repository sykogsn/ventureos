import { createHash, randomBytes } from "node:crypto";
import type { PermissionService } from "@/contracts";
import { createId, nowIso } from "@/platform/ids";
import { getClient } from "@/platform/persistence/db";
import { getPersistence } from "@/platform/persistence/repositories";
import { FrigoraError } from "./errors";
import { FrigoraMailDeliveryError } from "./mail";
import {
  priceQuotationCommercial,
  QuotationCommercialError,
  quotationOfferHash,
} from "./quotation-commercial";
import {
  QUOTATION_ISSUE_INTERRUPTED,
  type QuotationDeliveryOutbox,
  type QuotationDeliveryRecovery,
} from "./quotation-delivery";
import {
  correctQuotationDraft,
  createQuotationDraft,
  reviseQuotation,
  sendQuotation,
  FrigoraQuoteTransitionError,
} from "./quotation-workflow";
import {
  assertQuotationIssueHasNoLines,
  countQuotationLines,
  readQuotationLineSnapshots,
  offerLineFromSnapshot,
  prepareQuotationLineSnapshots,
  type QuotationLineDraft,
} from "./quotation-lines";
import { assertTaxAllowsQuotationCorrection, assertTaxAllowsQuotationSend } from "./tax-configuration-commands";
import type { FrigoraStore } from "./store";
import type {
  CorrectFrigoraQuotationInput,
  CreateFrigoraQuotationInput,
  FrigoraAssetId,
  FrigoraCustomerContactId,
  FrigoraCustomerId,
  FrigoraPersistedQuotation,
  FrigoraPersistedQuoteEvent,
  FrigoraPersistedQuoteVersion,
  FrigoraQuotationDecisionGrantId,
  FrigoraQuotationDecisionGrantRecord,
  FrigoraQuotationDecisionId,
  FrigoraQuotationEventId,
  FrigoraQuotationId,
  FrigoraRecommendedActionId,
  FrigoraScope,
  FrigoraSiteId,
  IssueFrigoraQuotationDecisionGrantInput,
  QuotationDecisionGrantDelivery,
  ReviseFrigoraQuotationInput,
  SendFrigoraQuotationInput,
  SubmitFrigoraQuotationDecisionInput,
} from "./types";
import {
  correctFrigoraQuotationSchema,
  createFrigoraQuotationSchema,
  issueFrigoraQuotationDecisionGrantSchema,
  parseWithFrigora,
  reviseFrigoraQuotationSchema,
  sendFrigoraQuotationSchema,
  submitFrigoraQuotationDecisionSchema,
} from "./validation";

export const QUOTATION_DECISION_GRANT_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export function quotationDecisionGrantSecretHash(secret: string) {
  return createHash("sha256").update(secret, "utf8").digest("hex");
}

function asTransition(error: unknown): never {
  if (error instanceof FrigoraQuoteTransitionError || error instanceof QuotationCommercialError) {
    throw new FrigoraError("invalid_input", error.message);
  }
  throw error;
}

const QUOTATION_REFRESH = "This quotation changed since you opened it. Refresh before trying again.";

async function withQuotationDatabaseConflict<T>(body: () => Promise<T>): Promise<T> {
  try {
    return await body();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/SQLITE_BUSY|database is locked|database is busy/i.test(message)) {
      throw new FrigoraError("quotation_conflict", QUOTATION_REFRESH);
    }
    throw error;
  }
}

function pricedCommercial(input: Parameters<typeof priceQuotationCommercial>[0]) {
  try {
    return priceQuotationCommercial(input);
  } catch (error) {
    asTransition(error);
  }
}

function requireLoaded(
  quotation: FrigoraPersistedQuotation | null,
): FrigoraPersistedQuotation {
  if (!quotation) {
    throw new FrigoraError("not_found", "Quotation was not found.");
  }
  return quotation;
}

function domainQuote(quotation: FrigoraPersistedQuotation) {
  const current = quotation.versions.find((version) => version.version === quotation.currentVersion);
  if (!current) {
    throw new FrigoraError("invalid_status", "Quotation current version is inconsistent.");
  }
  return {
    id: quotation.id,
    scope: { workspaceId: quotation.workspaceId, ventureId: quotation.ventureId },
    originalWorkOrderId: quotation.originalWorkOrderId,
    recommendedActionId: quotation.recommendedActionId,
    assetId: quotation.assetId,
    versions: [
      {
        version: current.version,
        status: current.status,
        description: current.description,
        commercial: current.commercial,
        totalMinor: current.totalMinor,
        currency: current.currency,
        documentHash: current.documentHash,
        sentAt: current.sentAt,
        recipient: current.recipient,
        dispatchEvidenceRef: current.dispatchEvidenceRef,
        decision: null,
      },
    ],
    events: quotation.events.map((event: FrigoraPersistedQuoteEvent) => ({
      eventId: event.id,
      kind: event.kind,
      version: event.version,
      occurredAt: event.occurredAt,
      actorUserId: event.actorUserId ?? event.actorContactId ?? "bearer-contact",
      evidenceRef: event.evidenceRef,
    })),
  };
}

export type QuotationLineWrite = {
  permissions: PermissionService;
  drafts: QuotationLineDraft[];
};

export async function createPersistedQuotation(
  store: FrigoraStore,
  scope: FrigoraScope,
  input: CreateFrigoraQuotationInput,
  lineWrite?: QuotationLineWrite,
): Promise<FrigoraPersistedQuotation> {
  const parsed = parseWithFrigora(createFrigoraQuotationSchema, input);
  const recommendation = await store.findRecommendedAction(
    scope.workspaceId,
    scope.ventureId,
    parsed.recommendedActionId as FrigoraRecommendedActionId,
  );
  if (!recommendation) {
    throw new FrigoraError("not_found", "Recommended action was not found.");
  }
  const workOrder = await store.findWorkOrder(
    scope.workspaceId,
    scope.ventureId,
    recommendation.workOrderId,
  );
  if (!workOrder) {
    throw new FrigoraError("not_found", "Work order was not found.");
  }
  const site = await store.findSite(scope.workspaceId, scope.ventureId, workOrder.siteId);
  if (!site || site.customerId !== workOrder.customerId) {
    throw new FrigoraError("invalid_input", "Work order site is outside the authorised scope.");
  }
  if (recommendation.assetId) {
    const asset = await store.findAsset(scope.workspaceId, scope.ventureId, recommendation.assetId);
    if (!asset || asset.siteId !== workOrder.siteId) {
      throw new FrigoraError("invalid_input", "Recommended asset is outside the work-order site.");
    }
  }
  const occurredAt = nowIso();
  const commercial = pricedCommercial(parsed.commercial);
  await assertTaxAllowsQuotationCorrection(store, scope, commercial, occurredAt);
  const draftId = createId<FrigoraQuotationId>();
  const lines = lineWrite
    ? await prepareQuotationLineSnapshots({
        permissions: lineWrite.permissions,
        scope,
        quotationId: draftId,
        versionNumber: 1,
        drafts: lineWrite.drafts,
        actorUserId: scope.userId,
        createdAt: occurredAt,
      })
    : undefined;
  const documentHash = quotationOfferHash({
    version: 1,
    description: parsed.description,
    ...commercial,
    lines: (lines ?? []).map(offerLineFromSnapshot),
  });
  let draft;
  try {
    draft = createQuotationDraft({
      id: draftId,
      scope: { workspaceId: scope.workspaceId, ventureId: scope.ventureId },
      originalWorkOrderId: workOrder.id,
      recommendedActionId: recommendation.id,
      assetId: recommendation.assetId,
      description: parsed.description,
      commercial: parsed.commercial,
      documentHash,
      actorUserId: scope.userId,
      eventId: createId<FrigoraQuotationEventId>(),
      occurredAt,
    });
  } catch (error) {
    asTransition(error);
  }
  const version = draft.versions[0];
  const event = draft.events[0];
  if (!version || !event || version.documentHash !== documentHash) {
    throw new FrigoraError("invalid_input", "Quotation draft was not created.");
  }
  await store.commitQuotationCreate({
    id: draft.id as FrigoraQuotationId,
    workspaceId: scope.workspaceId,
    ventureId: scope.ventureId,
    customerId: workOrder.customerId,
    siteId: workOrder.siteId,
    assetId: (recommendation.assetId as FrigoraAssetId | null) ?? null,
    originalWorkOrderId: workOrder.id,
    recommendedActionId: recommendation.id,
    createdAt: occurredAt,
    description: version.description,
    commercial: version.commercial,
    totalMinor: version.totalMinor,
    documentHash,
    eventId: event.eventId as FrigoraQuotationEventId,
    actorUserId: scope.userId,
    ...(lineWrite ? { lines } : {}),
  });
  return requireLoaded(
    await store.findPersistedQuotation(
      scope.workspaceId,
      scope.ventureId,
      draft.id as FrigoraQuotationId,
    ),
  );
}

export async function correctPersistedQuotation(
  store: FrigoraStore,
  scope: FrigoraScope,
  quotationId: FrigoraQuotationId,
  input: CorrectFrigoraQuotationInput,
  lineWrite?: QuotationLineWrite,
): Promise<FrigoraPersistedQuotation> {
  return withQuotationDatabaseConflict(async () => {
  const parsed = parseWithFrigora(correctFrigoraQuotationSchema, input);
  const existing = requireLoaded(
    await store.findPersistedQuotation(scope.workspaceId, scope.ventureId, quotationId),
  );
  if (existing.currentVersion !== parsed.expectedCurrentVersion) {
    throw new FrigoraError(
      "quotation_conflict",
      "This quotation changed since you opened it. Refresh before trying again.",
    );
  }
  const commercial = pricedCommercial(parsed.commercial);
  await assertTaxAllowsQuotationCorrection(store, scope, commercial, nowIso());
  const updatedAtForLines = nowIso();
  const lines = lineWrite
    ? await prepareQuotationLineSnapshots({
        permissions: lineWrite.permissions,
        scope,
        quotationId,
        versionNumber: existing.currentVersion,
        drafts: lineWrite.drafts,
        actorUserId: scope.userId,
        createdAt: updatedAtForLines,
      })
    : await readQuotationLineSnapshots(
        { workspaceId: scope.workspaceId, ventureId: scope.ventureId },
        quotationId,
        existing.currentVersion,
      );
  const documentHash = quotationOfferHash({
    version: existing.currentVersion,
    description: parsed.description,
    ...commercial,
    lines: lines.map(offerLineFromSnapshot),
  });
  try {
    const corrected = correctQuotationDraft(domainQuote(existing), {
      description: parsed.description,
      commercial: parsed.commercial,
      documentHash,
      lines: lines.map(offerLineFromSnapshot),
    });
    const version = corrected.versions.at(-1);
    if (!version || version.documentHash !== documentHash || version.status !== "in_preparation") {
      throw new FrigoraError("invalid_input", "Quotation draft was not corrected.");
    }
  } catch (error) {
    asTransition(error);
  }
  const updatedAt = updatedAtForLines;
  await store.commitQuotationCorrect({
    quotationId,
    workspaceId: scope.workspaceId,
    ventureId: scope.ventureId,
    expectedCurrentVersion: existing.currentVersion,
    description: parsed.description,
    commercial,
    totalMinor: commercial.totalMinor,
    documentHash,
    updatedAt,
    ...(lineWrite ? { lines } : {}),
  });
  return requireLoaded(
    await store.findPersistedQuotation(scope.workspaceId, scope.ventureId, quotationId),
  );
  });
}

export type QuotationIssueResult = {
  quotation: FrigoraPersistedQuotation;
  delivery: QuotationDeliveryOutbox;
  idempotentReplay: boolean;
  customerDelivery: "not_sent";
  emailed: false;
  decisionGrantCreated: false;
};

function assertCommercialSnapshotIntact(version: FrigoraPersistedQuoteVersion) {
  let priced;
  try {
    priced = priceQuotationCommercial({
      labourQuantityMilli: version.commercial.labourQuantityMilli,
      labourUnit: version.commercial.labourUnit,
      labourRateMinor: version.commercial.labourRateMinor,
      travelKilometresMilli: version.commercial.travelKilometresMilli,
      distanceBasis: version.commercial.distanceBasis,
      travelRateMinor: version.commercial.travelRateMinor,
      taxTreatment: version.commercial.taxTreatment,
      taxRuleId: version.commercial.taxRuleId,
      taxRuleVersion: version.commercial.taxRuleVersion,
      taxRateNumerator: version.commercial.taxRateNumerator,
      taxRateDenominator: version.commercial.taxRateDenominator,
      enteredTaxAmountMinor: version.commercial.taxAmountMinor,
    });
  } catch (error) {
    if (error instanceof QuotationCommercialError) {
      throw new FrigoraError("invalid_input", "The commercial snapshot does not match its document hash.");
    }
    throw error;
  }
  if (
    priced.totalMinor !== version.totalMinor
    || priced.taxAmountMinor !== version.commercial.taxAmountMinor
    || priced.labourAmountMinor !== version.commercial.labourAmountMinor
    || priced.travelAmountMinor !== version.commercial.travelAmountMinor
  ) {
    throw new FrigoraError("invalid_input", "The commercial snapshot does not match its document hash.");
  }
  return priced;
}

async function assertOfferDocument(
  scope: Pick<FrigoraScope, "workspaceId" | "ventureId">,
  quotationId: FrigoraQuotationId,
  version: FrigoraPersistedQuoteVersion,
) {
  const priced = assertCommercialSnapshotIntact(version);
  const lines = await readQuotationLineSnapshots(scope, quotationId, version.version);
  const hash = quotationOfferHash({
    version: version.version,
    description: version.description,
    ...priced,
    lines: lines.map(offerLineFromSnapshot),
  });
  if (hash !== version.documentHash) {
    throw new FrigoraError("invalid_input", "The commercial snapshot does not match its document hash.");
  }
}

const OFFER_INTEGRITY_REJECTION = "The commercial snapshot does not match its document hash.";

function offerIntegrityRejection(): never {
  throw new FrigoraError("invalid_input", OFFER_INTEGRITY_REJECTION);
}

function storedText(row: Record<string, unknown>, key: string): string | null {
  const value = row[key];
  if (value == null) return null;
  const text = String(value);
  return text.length === 0 ? null : text;
}

function storedInteger(row: Record<string, unknown>, key: string): number | null {
  const value = row[key];
  if (value == null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function versionForOfferCheck(row: Record<string, unknown>): FrigoraPersistedQuoteVersion {
  const labourQuantityMilli = storedInteger(row, "labour_quantity_milli");
  const labourUnit = storedText(row, "labour_unit");
  const labourRateMinor = storedInteger(row, "labour_rate_minor");
  const labourAmountMinor = storedInteger(row, "labour_amount_minor");
  const travelKilometresMilli = storedInteger(row, "travel_kilometres_milli");
  const distanceBasis = storedText(row, "distance_basis");
  const travelRateMinor = storedInteger(row, "travel_rate_minor");
  const travelAmountMinor = storedInteger(row, "travel_amount_minor");
  const taxTreatment = storedText(row, "tax_treatment");
  const taxableAmountMinor = storedInteger(row, "taxable_amount_minor");
  const taxAmountMinor = storedInteger(row, "tax_amount_minor");
  const totalMinor = storedInteger(row, "total_minor");
  const description = storedText(row, "description");
  const documentHash = storedText(row, "document_hash");
  const version = storedInteger(row, "version_number");
  const status = storedText(row, "status");
  if (
    labourQuantityMilli == null
    || labourUnit == null
    || labourRateMinor == null
    || labourAmountMinor == null
    || travelKilometresMilli == null
    || (distanceBasis !== "one_way" && distanceBasis !== "return")
    || travelRateMinor == null
    || travelAmountMinor == null
    || (taxTreatment !== "not_registered" && taxTreatment !== "configured_rule")
    || taxableAmountMinor == null
    || taxAmountMinor == null
    || totalMinor == null
    || description == null
    || documentHash == null
    || version == null
    || (status !== "in_preparation" && status !== "awaiting_customer_approval" && status !== "approved" && status !== "declined")
    || storedText(row, "currency") !== "ZAR"
  ) {
    offerIntegrityRejection();
  }
  return {
    quotationId: String(row.quotation_id) as FrigoraQuotationId,
    workspaceId: String(row.workspace_id) as FrigoraPersistedQuoteVersion["workspaceId"],
    ventureId: String(row.venture_id) as FrigoraPersistedQuoteVersion["ventureId"],
    version,
    status,
    description,
    commercial: {
      labourQuantityMilli,
      labourUnit,
      labourRateMinor,
      labourAmountMinor,
      travelKilometresMilli,
      distanceBasis,
      travelRateMinor,
      travelAmountMinor,
      taxTreatment,
      taxRuleId: storedText(row, "tax_rule_id"),
      taxRuleVersion: storedText(row, "tax_rule_version"),
      taxRateNumerator: storedInteger(row, "tax_rate_numerator"),
      taxRateDenominator: storedInteger(row, "tax_rate_denominator"),
      taxableAmountMinor,
      taxAmountMinor,
      totalMinor,
      currency: "ZAR",
    },
    totalMinor,
    currency: "ZAR",
    documentHash,
    sentAt: storedText(row, "sent_at"),
    recipient: storedText(row, "recipient"),
    dispatchEvidenceRef: storedText(row, "dispatch_evidence_ref"),
  };
}

/**
 * Re-reads the stored version and its lines, then recomputes the offer hash.
 * Grant inserts call this before persistence. Mailbox delivery also calls it
 * before a secret or customer message is created.
 */
export async function assertPersistedOfferDocument(
  scope: Pick<FrigoraScope, "workspaceId" | "ventureId">,
  quotationId: FrigoraQuotationId,
  versionNumber: number,
): Promise<void> {
  const found = await getClient().execute({
    sql: `
      SELECT quotation_id, workspace_id, venture_id, version_number, status, description,
             total_minor, currency, document_hash, sent_at, recipient, dispatch_evidence_ref,
             labour_quantity_milli, labour_unit, labour_rate_minor, labour_amount_minor,
             travel_kilometres_milli, distance_basis, travel_rate_minor, travel_amount_minor,
             tax_treatment, tax_rule_id, tax_rule_version, tax_rate_numerator, tax_rate_denominator,
             taxable_amount_minor, tax_amount_minor
      FROM frigora_quotation_versions
      WHERE quotation_id = ?
        AND version_number = ?
        AND workspace_id = ?
        AND venture_id = ?
    `,
    args: [quotationId, versionNumber, scope.workspaceId, scope.ventureId],
  });
  const row = found.rows[0] as unknown as Record<string, unknown> | undefined;
  if (!row) offerIntegrityRejection();
  await assertOfferDocument(scope, quotationId, versionForOfferCheck(row));
}

async function recomputedDocumentHash(
  scope: Pick<FrigoraScope, "workspaceId" | "ventureId">,
  quotationId: FrigoraQuotationId,
  version: FrigoraPersistedQuoteVersion,
): Promise<string> {
  try {
    const priced = assertCommercialSnapshotIntact(version);
    const lines = await readQuotationLineSnapshots(scope, quotationId, version.version);
    return quotationOfferHash({
      version: version.version,
      description: version.description,
      ...priced,
      lines: lines.map(offerLineFromSnapshot),
    });
  } catch {
    return "";
  }
}

async function heldIssueReplay(
  store: FrigoraStore,
  scope: FrigoraScope,
  quotationId: FrigoraQuotationId,
  expectedCurrentVersion: number,
): Promise<QuotationIssueResult | null> {
  const existing = await store.findPersistedQuotation(scope.workspaceId, scope.ventureId, quotationId);
  if (!existing || existing.currentVersion !== expectedCurrentVersion) {
    return null;
  }
  const current = existing.versions.find((version) => version.version === existing.currentVersion);
  if (!current || current.status !== "awaiting_customer_approval") {
    return null;
  }
  const delivery = await store.findQuotationDeliveryOutbox(
    scope.workspaceId,
    scope.ventureId,
    quotationId,
    current.version,
  );
  if (!delivery || delivery.state !== "held_pending_customer_access" || delivery.documentHash !== current.documentHash) {
    return null;
  }
  await assertOfferDocument(
    { workspaceId: scope.workspaceId, ventureId: scope.ventureId },
    quotationId,
    current,
  );
  await assertQuotationIssueHasNoLines(
    { workspaceId: scope.workspaceId, ventureId: scope.ventureId },
    quotationId,
    current.version,
  );
  return {
    quotation: existing,
    delivery,
    idempotentReplay: true,
    customerDelivery: "not_sent",
    emailed: false,
    decisionGrantCreated: false,
  };
}

export async function issuePersistedQuotation(
  store: FrigoraStore,
  scope: FrigoraScope,
  quotationId: FrigoraQuotationId,
  input: SendFrigoraQuotationInput,
): Promise<QuotationIssueResult> {
  return withQuotationDatabaseConflict(async () => {
  const parsed = parseWithFrigora(sendFrigoraQuotationSchema, input);
  const existing = requireLoaded(
    await store.findPersistedQuotation(scope.workspaceId, scope.ventureId, quotationId),
  );
  if (existing.currentVersion !== parsed.expectedCurrentVersion) {
    throw new FrigoraError(
      "quotation_conflict",
      "This quotation changed since you opened it. Refresh before trying again.",
    );
  }
  const current = existing.versions.find((version) => version.version === existing.currentVersion);
  if (!current) {
    throw new FrigoraError("invalid_status", "Quotation current version is inconsistent.");
  }
  await assertQuotationIssueHasNoLines(
    { workspaceId: scope.workspaceId, ventureId: scope.ventureId },
    quotationId,
    existing.currentVersion,
  );
  await assertOfferDocument(
    { workspaceId: scope.workspaceId, ventureId: scope.ventureId },
    quotationId,
    current,
  );
  const replay = await heldIssueReplay(store, scope, quotationId, parsed.expectedCurrentVersion);
  if (replay) {
    return replay;
  }
  if (current.status !== "in_preparation") {
    throw new FrigoraError("invalid_status", QUOTATION_ISSUE_INTERRUPTED);
  }
  const occurredAt = nowIso();
  await assertTaxAllowsQuotationSend(store, scope, current, occurredAt);
  const eventId = createId<FrigoraQuotationEventId>();
  const outboxId = createId<string>();
  const attemptId = createId<string>();
  const auditId = createId<string>();
  try {
    sendQuotation(domainQuote(existing), {
      eventId,
      occurredAt,
      actorUserId: scope.userId,
      recipient: parsed.recipient,
      dispatchEvidenceRef: eventId,
    });
  } catch (error) {
    if (error instanceof FrigoraQuoteTransitionError) {
      throw new FrigoraError("invalid_status", error.message);
    }
    throw error;
  }
  try {
    await store.commitQuotationSend({
      quotationId,
      workspaceId: scope.workspaceId,
      ventureId: scope.ventureId,
      expectedCurrentVersion: existing.currentVersion,
      description: current.description,
      commercial: current.commercial,
      totalMinor: current.totalMinor,
      documentHash: current.documentHash,
      sentAt: occurredAt,
      recipient: parsed.recipient,
      dispatchEvidenceRef: eventId,
      eventId,
      actorUserId: scope.userId,
      updatedAt: occurredAt,
      outboxId,
      attemptId,
      auditId,
    });
  } catch (error) {
    if (error instanceof FrigoraError && error.code === "quotation_conflict") {
      const concurrent = await heldIssueReplay(store, scope, quotationId, parsed.expectedCurrentVersion);
      if (concurrent) {
        return concurrent;
      }
    }
    throw error;
  }
  const quotation = requireLoaded(
    await store.findPersistedQuotation(scope.workspaceId, scope.ventureId, quotationId),
  );
  const delivery = await store.findQuotationDeliveryOutbox(
    scope.workspaceId,
    scope.ventureId,
    quotationId,
    quotation.currentVersion,
  );
  if (
    !delivery
    || delivery.state !== "held_pending_customer_access"
    || delivery.documentHash !== current.documentHash
    || delivery.id !== outboxId
  ) {
    throw new FrigoraError("invalid_status", "Quotation issue preparation was not recorded.");
  }
  return {
    quotation,
    delivery,
    idempotentReplay: false,
    customerDelivery: "not_sent",
    emailed: false,
    decisionGrantCreated: false,
  };
  });
}

export async function sendPersistedQuotation(
  store: FrigoraStore,
  scope: FrigoraScope,
  quotationId: FrigoraQuotationId,
  input: SendFrigoraQuotationInput,
): Promise<FrigoraPersistedQuotation> {
  const issued = await issuePersistedQuotation(store, scope, quotationId, input);
  return issued.quotation;
}

export async function recoverPersistedQuotationDelivery(
  store: FrigoraStore,
  scope: FrigoraScope,
  quotationId: FrigoraQuotationId,
): Promise<QuotationDeliveryRecovery> {
  const existing = requireLoaded(
    await store.findPersistedQuotation(scope.workspaceId, scope.ventureId, quotationId),
  );
  const current = existing.versions.find((version) => version.version === existing.currentVersion);
  if (!current) {
    throw new FrigoraError("invalid_status", "Quotation current version is inconsistent.");
  }
  return store.commitQuotationDeliveryRecovery({
    quotationId,
    workspaceId: scope.workspaceId,
    ventureId: scope.ventureId,
    version: current.version,
    actorUserId: scope.userId,
    occurredAt: nowIso(),
    recomputedHash: await recomputedDocumentHash(scope, quotationId, current),
    outboxId: createId<string>(),
    attemptId: createId<string>(),
    auditId: createId<string>(),
  });
}

export async function revisePersistedQuotation(
  store: FrigoraStore,
  scope: FrigoraScope,
  quotationId: FrigoraQuotationId,
  input: ReviseFrigoraQuotationInput,
): Promise<FrigoraPersistedQuotation> {
  return withQuotationDatabaseConflict(async () => {
  const parsed = parseWithFrigora(reviseFrigoraQuotationSchema, input);
  const existing = requireLoaded(
    await store.findPersistedQuotation(scope.workspaceId, scope.ventureId, quotationId),
  );
  if (existing.currentVersion !== parsed.expectedCurrentVersion) {
    throw new FrigoraError(
      "quotation_conflict",
      "This quotation changed since you opened it. Refresh before trying again.",
    );
  }
  const occurredAt = nowIso();
  const nextVersion = existing.currentVersion + 1;
  const current = existing.versions.find((version) => version.version === existing.currentVersion);
  const lineCount = await countQuotationLines(
    { workspaceId: scope.workspaceId, ventureId: scope.ventureId },
    quotationId,
    existing.currentVersion,
  );
  const commercial = pricedCommercial(parsed.commercial);
  const currentLines = await readQuotationLineSnapshots(
    { workspaceId: scope.workspaceId, ventureId: scope.ventureId },
    quotationId,
    existing.currentVersion,
  );
  const documentHash = quotationOfferHash({
    version: nextVersion,
    description: parsed.description,
    ...commercial,
    lines: currentLines.map(offerLineFromSnapshot),
  });
  let revised;
  try {
    revised = reviseQuotation(domainQuote(existing), {
      eventId: createId<FrigoraQuotationEventId>(),
      occurredAt,
      actorUserId: scope.userId,
      description: parsed.description,
      commercial: parsed.commercial,
      documentHash,
      revisePreparedDraft: current?.status === "in_preparation" && lineCount > 0,
    });
  } catch (error) {
    if (error instanceof FrigoraQuoteTransitionError) {
      throw new FrigoraError("invalid_status", error.message);
    }
    throw error;
  }
  const created = revised.versions.at(-1);
  const event = revised.events.at(-1);
  if (!created || !event || created.version !== nextVersion || created.documentHash !== documentHash) {
    throw new FrigoraError("invalid_input", "Quotation revision was not created.");
  }
  await assertTaxAllowsQuotationCorrection(store, scope, created.commercial, occurredAt);
  await store.commitQuotationRevision({
    quotationId,
    workspaceId: scope.workspaceId,
    ventureId: scope.ventureId,
    expectedCurrentVersion: existing.currentVersion,
    nextVersion,
    description: created.description,
    commercial: created.commercial,
    totalMinor: created.totalMinor,
    documentHash,
    occurredAt,
    eventId: event.eventId as FrigoraQuotationEventId,
    actorUserId: scope.userId,
  });
  return requireLoaded(
    await store.findPersistedQuotation(scope.workspaceId, scope.ventureId, quotationId),
  );
  });
}

async function requireFrigoraVenture(scope: FrigoraScope) {
  const venture = await getPersistence().ventures.findById(scope.ventureId);
  if (!venture || venture.workspaceId !== scope.workspaceId) {
    throw new FrigoraError("not_found", "Venture was not found.");
  }
  if (venture.definitionId !== "frigora") {
    throw new FrigoraError("not_frigora", "Venture is not Frigora.");
  }
}

function providerFailure(error: unknown): {
  code: "delivery_failed" | "delivery_unknown" | "customer_delivery_unavailable";
  outcome: "rejected" | "unknown" | "unavailable";
} {
  if (error instanceof FrigoraMailDeliveryError) {
    return error.outcome === "unknown"
      ? { code: "delivery_unknown", outcome: "unknown" }
      : { code: "delivery_failed", outcome: "rejected" };
  }
  return { code: "customer_delivery_unavailable", outcome: "unavailable" };
}

function deliveryFailureMessage(input: {
  outcome: "rejected" | "unknown" | "unavailable";
  grantRevoked: boolean;
  failureRecorded: boolean;
}) {
  const provider = input.outcome === "rejected"
    ? "The mail provider rejected the message."
    : input.outcome === "unknown"
      ? "The mail provider did not confirm acceptance."
      : "The decision link could not be handed to a delivery boundary.";
  const grant = input.grantRevoked
    ? "The decision grant is revoked."
    : "The decision grant could not be revoked and may still be active.";
  const record = input.failureRecorded
    ? "The failure record was saved."
    : "The failure record was not saved.";
  const again = input.outcome === "unknown" ? " It was not sent again." : "";
  return `${provider} ${grant} ${record} This is not inbox delivery.${again}`;
}

async function observedDeliveryFailure(grantId: string) {
  const grant = await getClient().execute({
    sql: "SELECT revoked_at FROM frigora_quotation_decision_grants WHERE id = ?",
    args: [grantId],
  });
  const audits = await getClient().execute({
    sql: `
      SELECT id FROM audit_events
      WHERE action = 'frigora.quotation.decision_grant_delivery_failed'
        AND metadata_json LIKE ?
    `,
    args: [`%${grantId}%`],
  });
  return {
    grantRevoked: Boolean(grant.rows[0]?.revoked_at),
    failureRecorded: audits.rows.length > 0,
  };
}

export async function issuePersistedQuotationDecisionGrant(
  store: FrigoraStore,
  scope: FrigoraScope,
  quotationId: FrigoraQuotationId,
  input: IssueFrigoraQuotationDecisionGrantInput,
  delivery: QuotationDecisionGrantDelivery,
  now: () => string = nowIso,
  contactId: FrigoraCustomerContactId | null = null,
  options?: {
    eligibility?: "test_link" | "mailbox";
    beforeGuardedWrite?: () => Promise<void>;
  },
): Promise<FrigoraQuotationDecisionGrantRecord> {
  if (!delivery || typeof delivery.deliver !== "function") {
    throw new FrigoraError(
      "customer_delivery_unavailable",
      "Customer decision delivery is not available.",
    );
  }
  const parsed = parseWithFrigora(issueFrigoraQuotationDecisionGrantSchema, input);
  await requireFrigoraVenture(scope);
  const existing = requireLoaded(
    await store.findPersistedQuotation(scope.workspaceId, scope.ventureId, quotationId),
  );
  if (existing.currentVersion !== parsed.expectedCurrentVersion) {
    throw new FrigoraError(
      "quotation_conflict",
      "This quotation changed since you opened it. Refresh before trying again.",
    );
  }
  const current = existing.versions.find((version) => version.version === existing.currentVersion);
  if (!current || current.status !== "awaiting_customer_approval") {
    throw new FrigoraError(
      "invalid_status",
      "A decision grant can only be issued for the current sent quotation version.",
    );
  }
  const issuedAt = now();
  const issuedAtMs = Date.parse(issuedAt);
  if (Number.isNaN(issuedAtMs)) {
    throw new FrigoraError("invalid_input", "Decision time is invalid.");
  }
  const expiresAt = new Date(issuedAtMs + QUOTATION_DECISION_GRANT_TTL_MS).toISOString();
  const secret = randomBytes(32).toString("base64url");
  const grantId = createId<FrigoraQuotationDecisionGrantId>();
  if (options?.beforeGuardedWrite && !options.eligibility) {
    throw new FrigoraError("invalid_input", "A guarded decision grant needs an eligibility channel.");
  }
  if (options?.eligibility === "mailbox" && !contactId) {
    throw new FrigoraError("invalid_input", "A mailbox decision grant needs a customer contact.");
  }
  if (options?.beforeGuardedWrite) {
    await options.beforeGuardedWrite();
  }
  await assertOfferDocument(scope, quotationId, current);
  await store.commitQuotationDecisionGrant({
    id: grantId,
    secretHash: quotationDecisionGrantSecretHash(secret),
    quotationId,
    workspaceId: scope.workspaceId,
    ventureId: scope.ventureId,
    customerId: existing.customerId,
    siteId: existing.siteId,
    version: current.version,
    documentHash: current.documentHash,
    expiresAt,
    issuedAt,
    issuedByUserId: scope.userId,
    contactId,
    eligibility: options?.eligibility,
  });
  try {
    await delivery.deliver({
      grantId,
      secret,
      quotationId,
      version: current.version,
      expiresAt,
    });
  } catch (error) {
    const failure = providerFailure(error);
    let grantRevoked = false;
    let failureRecorded = false;
    try {
      await store.revokeQuotationDecisionGrant({
        id: grantId,
        workspaceId: scope.workspaceId,
        ventureId: scope.ventureId,
        revokedAt: issuedAt,
        deliveryFailure: {
          outcome: failure.outcome,
          actorUserId: scope.userId,
        },
      });
      grantRevoked = true;
      failureRecorded = true;
    } catch {
      const observed = await observedDeliveryFailure(grantId);
      grantRevoked = observed.grantRevoked;
      failureRecorded = observed.failureRecorded;
    }
    throw new FrigoraError(
      failure.code,
      deliveryFailureMessage({
        outcome: failure.outcome,
        grantRevoked,
        failureRecorded,
      }),
    );
  }
  return {
    id: grantId,
    quotationId,
    workspaceId: scope.workspaceId,
    ventureId: scope.ventureId,
    customerId: existing.customerId,
    siteId: existing.siteId,
    version: current.version,
    documentHash: current.documentHash,
    expiresAt,
    issuedAt,
    issuedByUserId: scope.userId,
    consumedAt: null,
    decisionId: null,
  };
}

export async function submitPersistedQuotationDecision(
  store: FrigoraStore,
  scope: FrigoraScope,
  quotationId: FrigoraQuotationId,
  input: SubmitFrigoraQuotationDecisionInput,
  now: () => string = nowIso,
): Promise<FrigoraPersistedQuotation> {
  const parsed = parseWithFrigora(submitFrigoraQuotationDecisionSchema, input);
  await requireFrigoraVenture(scope);
  const decidedAt = now();
  if (Number.isNaN(Date.parse(decidedAt))) {
    throw new FrigoraError("invalid_input", "Decision time is invalid.");
  }
  await store.commitQuotationDecision({
    decisionId: createId<FrigoraQuotationDecisionId>(),
    eventId: createId<FrigoraQuotationEventId>(),
    grantId: parsed.grantId as FrigoraQuotationDecisionGrantId,
    secretHash: quotationDecisionGrantSecretHash(parsed.secret),
    quotationId,
    workspaceId: scope.workspaceId,
    ventureId: scope.ventureId,
    customerId: parsed.customerId as FrigoraCustomerId,
    siteId: parsed.siteId as FrigoraSiteId,
    decision: parsed.decision,
    now: decidedAt,
    actorUserId: scope.userId,
    actorContactId: null,
  });
  return requireLoaded(
    await store.findPersistedQuotation(scope.workspaceId, scope.ventureId, quotationId),
  );
}
