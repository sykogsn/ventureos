/**
 * FRIGORA-QUOTE-01: pure quotation lifecycle contract.
 *
 * Quotation state is NOT FrigoraWorkOrderStatus. A completed diagnostic visit
 * remains completed while a repair quotation awaits a customer decision.
 *
 * This module intentionally does not persist, send, approve on a customer's
 * behalf, or create/dispatch repair work orders. Those operations require
 * separate server-authorised, durable, audited integration.
 */
export const FRIGORA_QUOTE_STATUSES = [
  "in_preparation",
  "awaiting_customer_approval",
  "approved",
  "declined",
] as const;

export type FrigoraQuoteStatus = (typeof FRIGORA_QUOTE_STATUSES)[number];
export type FrigoraQuoteDecisionKind = "approved" | "declined";

export type FrigoraQuoteScope = Readonly<{
  workspaceId: string;
  ventureId: string;
}>;

export type FrigoraQuoteDecision = Readonly<{
  kind: FrigoraQuoteDecisionKind;
  version: number;
  documentHash: string;
  decidedAt: string;
  customerDecisionMaker: string;
  authorityEvidenceRef: string;
  recordedByUserId: string;
}>;

export type FrigoraQuoteVersion = Readonly<{
  version: number;
  status: FrigoraQuoteStatus;
  description: string;
  totalMinor: number;
  currency: "ZAR";
  documentHash: string;
  sentAt: string | null;
  recipient: string | null;
  dispatchEvidenceRef: string | null;
  decision: FrigoraQuoteDecision | null;
}>;

export type FrigoraQuoteEvent = Readonly<{
  eventId: string;
  kind: "created" | "sent" | "approved" | "declined" | "revision_started";
  version: number;
  occurredAt: string;
  actorUserId: string;
  evidenceRef: string | null;
}>;

export type FrigoraQuotation = Readonly<{
  id: string;
  scope: FrigoraQuoteScope;
  originalWorkOrderId: string;
  recommendedActionId: string;
  assetId: string | null;
  versions: readonly FrigoraQuoteVersion[];
  events: readonly FrigoraQuoteEvent[];
}>;

export class FrigoraQuoteTransitionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FrigoraQuoteTransitionError";
  }
}

function required(value: string, field: string): string {
  const trimmed = value.trim();
  if (!trimmed) throw new FrigoraQuoteTransitionError(`${field} is required.`);
  return trimmed;
}

function validTotal(value: number): number {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new FrigoraQuoteTransitionError("Quotation total must be non-negative integer ZAR cents.");
  }
  return value;
}

function current(quote: FrigoraQuotation): FrigoraQuoteVersion {
  const version = quote.versions.at(-1);
  if (!version) throw new FrigoraQuoteTransitionError("Quotation has no version.");
  return version;
}

function record(
  quote: FrigoraQuotation,
  version: FrigoraQuoteVersion,
  event: FrigoraQuoteEvent,
  isNewVersion = false,
): FrigoraQuotation {
  if (quote.events.some((existing) => existing.eventId === event.eventId)) {
    throw new FrigoraQuoteTransitionError("Duplicate quotation event identifier.");
  }
  const versions = isNewVersion
    ? [...quote.versions, version]
    : [...quote.versions.slice(0, -1), version];
  return { ...quote, versions, events: [...quote.events, event] };
}

export function quotationStatus(quote: FrigoraQuotation): FrigoraQuoteStatus {
  return current(quote).status;
}

export function currentQuotationVersion(quote: FrigoraQuotation): FrigoraQuoteVersion {
  return current(quote);
}

export function createQuotationDraft(input: {
  id: string;
  scope: FrigoraQuoteScope;
  originalWorkOrderId: string;
  recommendedActionId: string;
  assetId?: string | null;
  description: string;
  totalMinor: number;
  documentHash: string;
  actorUserId: string;
  eventId: string;
  occurredAt: string;
}): FrigoraQuotation {
  const version: FrigoraQuoteVersion = {
    version: 1,
    status: "in_preparation",
    description: required(input.description, "Description"),
    totalMinor: validTotal(input.totalMinor),
    currency: "ZAR",
    documentHash: required(input.documentHash, "Document hash"),
    sentAt: null,
    recipient: null,
    dispatchEvidenceRef: null,
    decision: null,
  };
  return {
    id: required(input.id, "Quotation id"),
    scope: {
      workspaceId: required(input.scope.workspaceId, "Workspace id"),
      ventureId: required(input.scope.ventureId, "Venture id"),
    },
    originalWorkOrderId: required(input.originalWorkOrderId, "Original work order id"),
    recommendedActionId: required(input.recommendedActionId, "Recommended action id"),
    assetId: input.assetId ?? null,
    versions: [version],
    events: [{
      eventId: required(input.eventId, "Event id"),
      kind: "created",
      version: 1,
      occurredAt: required(input.occurredAt, "Event timestamp"),
      actorUserId: required(input.actorUserId, "Actor id"),
      evidenceRef: null,
    }],
  };
}

export function sendQuotation(
  quote: FrigoraQuotation,
  input: {
    eventId: string;
    occurredAt: string;
    actorUserId: string;
    recipient: string;
    dispatchEvidenceRef: string;
  },
): FrigoraQuotation {
  const v = current(quote);
  if (v.status !== "in_preparation") {
    throw new FrigoraQuoteTransitionError("Only a quotation in preparation may be sent.");
  }
  const evidence = required(input.dispatchEvidenceRef, "Dispatch evidence reference");
  return record(quote, {
    ...v,
    status: "awaiting_customer_approval",
    sentAt: required(input.occurredAt, "Sent timestamp"),
    recipient: required(input.recipient, "Recipient"),
    dispatchEvidenceRef: evidence,
  }, {
    eventId: required(input.eventId, "Event id"),
    kind: "sent",
    version: v.version,
    occurredAt: input.occurredAt,
    actorUserId: required(input.actorUserId, "Actor id"),
    evidenceRef: evidence,
  });
}

/** Caller must independently authenticate/authorise the customer decision maker. */
export function decideQuotation(
  quote: FrigoraQuotation,
  input: {
    eventId: string;
    occurredAt: string;
    actorUserId: string;
    decision: FrigoraQuoteDecisionKind;
    version: number;
    documentHash: string;
    customerDecisionMaker: string;
    authorityEvidenceRef: string;
    customerAuthorityVerified: true;
  },
): FrigoraQuotation {
  const v = current(quote);
  if (v.status !== "awaiting_customer_approval") {
    throw new FrigoraQuoteTransitionError("Only a sent quotation can receive a customer decision.");
  }
  if (input.version !== v.version || input.documentHash !== v.documentHash) {
    throw new FrigoraQuoteTransitionError("Customer decision does not match the sent quotation version.");
  }
  if (input.customerAuthorityVerified !== true) {
    throw new FrigoraQuoteTransitionError("Customer authority must be verified.");
  }
  if (input.decision !== "approved" && input.decision !== "declined") {
    throw new FrigoraQuoteTransitionError("Unknown customer decision.");
  }
  const evidence = required(input.authorityEvidenceRef, "Decision evidence reference");
  const decision: FrigoraQuoteDecision = {
    kind: input.decision,
    version: v.version,
    documentHash: v.documentHash,
    decidedAt: required(input.occurredAt, "Decision timestamp"),
    customerDecisionMaker: required(input.customerDecisionMaker, "Customer decision maker"),
    authorityEvidenceRef: evidence,
    recordedByUserId: required(input.actorUserId, "Actor id"),
  };
  return record(quote, { ...v, status: input.decision, decision }, {
    eventId: required(input.eventId, "Event id"),
    kind: input.decision,
    version: v.version,
    occurredAt: input.occurredAt,
    actorUserId: input.actorUserId,
    evidenceRef: evidence,
  });
}

/**
 * Revision creates a NEW version. A prior accepted/declined document and
 * customer decision stay in the historical versions; their authority does not
 * silently transfer to the new version.
 */
export function reviseQuotation(
  quote: FrigoraQuotation,
  input: {
    eventId: string;
    occurredAt: string;
    actorUserId: string;
    description: string;
    totalMinor: number;
    documentHash: string;
  },
): FrigoraQuotation {
  const v = current(quote);
  if (v.status === "in_preparation") {
    throw new FrigoraQuoteTransitionError("Edit the current draft instead of creating a new revision.");
  }
  const next: FrigoraQuoteVersion = {
    version: v.version + 1,
    status: "in_preparation",
    description: required(input.description, "Description"),
    totalMinor: validTotal(input.totalMinor),
    currency: "ZAR",
    documentHash: required(input.documentHash, "Document hash"),
    sentAt: null,
    recipient: null,
    dispatchEvidenceRef: null,
    decision: null,
  };
  return record(quote, next, {
    eventId: required(input.eventId, "Event id"),
    kind: "revision_started",
    version: next.version,
    occurredAt: required(input.occurredAt, "Revision timestamp"),
    actorUserId: required(input.actorUserId, "Actor id"),
    evidenceRef: null,
  }, true);
}

/** Only the latest, exactly approved version can authorise a NEW repair. */
export function canAuthoriseNewQuotedRepair(quote: FrigoraQuotation): boolean {
  const v = current(quote);
  return v.status === "approved"
    && v.decision?.kind === "approved"
    && v.decision.version === v.version
    && v.decision.documentHash === v.documentHash
    && Boolean(v.decision.authorityEvidenceRef);
}

export function quoteMatchesScope(quote: FrigoraQuotation, scope: FrigoraQuoteScope): boolean {
  return quote.scope.workspaceId === scope.workspaceId && quote.scope.ventureId === scope.ventureId;
}
