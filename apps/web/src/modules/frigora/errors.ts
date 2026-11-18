export type FrigoraErrorCode =
  | "forbidden"
  | "not_found"
  | "not_frigora"
  | "archived_parent"
  | "duplicate"
  | "idempotency_conflict"
  | "dispatch_conflict"
  | "double_booking"
  | "engineer_unavailable"
  | "availability_conflict"
  | "invalid_input"
  | "invalid_status"
  | "invalid_kind"
  | "quotation_conflict"
  | "tax_configuration_blocked"
  | "customer_approval_required"
  | "decision_rejected"
  | "customer_delivery_unavailable"
  | "mail_not_configured"
  | "delivery_failed"
  | "delivery_unknown"
  | "cross_venture"
  | "evidence_bytes_delete_failed";

/** Stable UI copy when a dispatch CAS fails. */
export const FRIGORA_DISPATCH_CONFLICT_MESSAGE =
  "This work order changed since you opened it. Refresh before trying again.";

/** Stable copy when a quotation-required repair has no current customer approval. */
export const FRIGORA_CUSTOMER_APPROVAL_REQUIRED_MESSAGE =
  "Customer approval of the current quotation is required before this repair can be converted.";

export class FrigoraError extends Error {
  readonly code: FrigoraErrorCode;
  readonly conflicts?: SchedulingConflict[];

  constructor(code: FrigoraErrorCode, message: string, conflicts?: SchedulingConflict[]) {
    super(message);
    this.name = "FrigoraError";
    this.code = code;
    this.conflicts = conflicts;
  }
}

export type SchedulingConflict = {
  id: string;
  workReference: string;
  scheduledStartAt: string;
  scheduledEndAt: string;
};

export function isFrigoraError(error: unknown): error is FrigoraError {
  return error instanceof FrigoraError;
}
