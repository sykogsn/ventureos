/**
 * M1 records issue preparation. It does not deliver a quotation.
 *
 * The issue transaction commits the version, one held outbox row, its first
 * attempt, and the issue audit together, or rolls them all back. That is one
 * database transaction. It is not exactly-once delivery across a database and
 * a mail provider. M1 does not contact a provider.
 *
 * `accepted_by_provider` is reserved for a later milestone. It would mean the
 * provider accepted a message, not that the customer received it.
 * `outcome_unknown` is never treated as success.
 */

export const QUOTATION_DELIVERY_STATES = [
  "held_pending_customer_access",
  "accepted_by_provider",
  "rejected_by_provider",
  "outcome_unknown",
] as const;

export type QuotationDeliveryState = (typeof QUOTATION_DELIVERY_STATES)[number];

export const QUOTATION_DELIVERY_HELD_STATE = "held_pending_customer_access" as const;

export const QUOTATION_DELIVERY_HELD_REASON =
  "Customer delivery is held pending authorised customer access. No decision grant was created and no email was sent. This record is issue preparation, not provider acceptance and not inbox delivery.";

export const QUOTATION_ISSUE_OFFICE_NOTICE =
  "Issue preparation records a held delivery (held_pending_customer_access). It does not email the customer, create a decision grant, or mean the quotation was received. A missing or invalid tax configuration still blocks issue.";

export const QUOTATION_ISSUE_AUDIT_ACTION = "frigora.quotation.issue_prepared";

export const QUOTATION_ISSUE_ATTEMPT_DETAIL =
  "Issue prepared. Customer delivery is held pending authorised customer access. No email was sent and no decision grant was created.";

export const QUOTATION_DELIVERY_RESTORED_DETAIL =
  "Held delivery record restored because the issued version had no outbox row. No email was sent and no decision grant was created.";

export const QUOTATION_DELIVERY_UNKNOWN_DETAIL =
  "Delivery outcome is unknown because the stored snapshot hash does not match the outbox or the recomputed commercial snapshot. This is not a successful delivery and no email was sent.";

export const QUOTATION_ISSUE_INTERRUPTED =
  "Quotation issue was interrupted. The version is awaiting approval but the held delivery record is missing or does not match. Recover it before retrying. No email was sent.";

export type QuotationDeliveryOutbox = {
  id: string;
  quotationId: string;
  workspaceId: string;
  ventureId: string;
  version: number;
  documentHash: string;
  createdAt: string;
  actorUserId: string;
  state: QuotationDeliveryState;
  holdReason: string;
  providerMessageId: string | null;
};

export type QuotationDeliveryRecoveryAction =
  | "already_held"
  | "restored_held"
  | "marked_outcome_unknown"
  | "already_unknown";

export type QuotationDeliveryRecovery = {
  delivery: QuotationDeliveryOutbox;
  action: QuotationDeliveryRecoveryAction;
  customerDelivery: "not_sent";
  decisionGrantCreated: false;
};

export function isQuotationDeliveryState(value: unknown): value is QuotationDeliveryState {
  return QUOTATION_DELIVERY_STATES.some((state) => state === value);
}

/**
 * Customer access is possession of a bearer grant on a secure link held by a
 * verified designated contact. It is not a customer account login.
 */
export const QUOTATION_CUSTOMER_ACCESS_MODEL =
  "Customer access is a secure link for a verified designated contact. It is not a customer account login.";

export const QUOTATION_CUSTOMER_DELIVERY_STATES = [
  "prepared",
  "sending",
  "accepted_by_provider",
  "rejected_by_provider",
  "outcome_unknown",
  "reconciliation_required",
] as const;

export type QuotationCustomerDeliveryState = (typeof QUOTATION_CUSTOMER_DELIVERY_STATES)[number];

export type QuotationCustomerDeliveryOfficeView = {
  id: string;
  version: number;
  contactId: string;
  state: QuotationCustomerDeliveryState;
  providerMessageId: string | null;
};

export function isQuotationCustomerDeliveryState(value: unknown): value is QuotationCustomerDeliveryState {
  return QUOTATION_CUSTOMER_DELIVERY_STATES.some((state) => state === value);
}

export function quotationOfficeDeliveryCopy(
  delivery: QuotationDeliveryOutbox | null,
  status: string | undefined,
  operations: readonly QuotationCustomerDeliveryOfficeView[] = [],
) {
  const accepted = operations.find((operation) => operation.state === "accepted_by_provider");
  if (accepted) {
    const message = accepted.providerMessageId ?? "not recorded";
    return `Customer access email was accepted by the provider for version ${accepted.version}. Provider message ${message}. Provider acceptance is not inbox delivery. No further send is required.`;
  }
  const reconcile = operations.find((operation) => operation.state === "reconciliation_required");
  if (reconcile) {
    return `Customer delivery for version ${reconcile.version} requires reconciliation. Automatic sending is blocked pending authorised reconciliation. This is not inbox delivery.`;
  }
  const unknown = operations.find((operation) => operation.state === "outcome_unknown");
  if (unknown) {
    return `Customer delivery for version ${unknown.version} has an unknown provider outcome. It was not rejected and it will not be sent as a new email. This is not inbox delivery.`;
  }
  const sending = operations.find((operation) => operation.state === "sending");
  if (sending) {
    return `Customer delivery for version ${sending.version} is sending. The provider send has been claimed and the outcome is not yet confirmed. This is not inbox delivery.`;
  }
  const prepared = operations.find((operation) => operation.state === "prepared");
  if (prepared) {
    return `Customer delivery for version ${prepared.version} is prepared. The decision grant is recorded and the provider send has not yet been confirmed. This is not inbox delivery.`;
  }
  const rejected = operations.find((operation) => operation.state === "rejected_by_provider");
  if (rejected) {
    return `The provider rejected the customer access email for version ${rejected.version}. This is not inbox delivery. A new email was not sent.`;
  }
  if (delivery?.state === "held_pending_customer_access") {
    return `${delivery.state}. ${delivery.holdReason}`;
  }
  if (delivery?.state === "outcome_unknown") {
    return `${delivery.state}. ${delivery.holdReason} An unknown outcome is not delivery.`;
  }
  if (delivery) {
    return `${delivery.state}. Provider acceptance is not inbox delivery.`;
  }
  if (status === "awaiting_customer_approval") {
    return "Delivery record is missing. Issue preparation is incomplete and has not been emailed.";
  }
  return QUOTATION_ISSUE_OFFICE_NOTICE;
}
