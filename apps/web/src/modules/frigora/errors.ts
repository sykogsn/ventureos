export type FrigoraErrorCode =
  | "forbidden"
  | "not_found"
  | "not_frigora"
  | "archived_parent"
  | "duplicate"
  | "idempotency_conflict"
  | "dispatch_conflict"
  | "invalid_input"
  | "invalid_status"
  | "invalid_kind"
  | "cross_venture"
  | "evidence_bytes_delete_failed";

/** Stable UI copy when a dispatch CAS fails. */
export const FRIGORA_DISPATCH_CONFLICT_MESSAGE =
  "This work order changed since you opened it. Refresh before trying again.";

export class FrigoraError extends Error {
  readonly code: FrigoraErrorCode;

  constructor(code: FrigoraErrorCode, message: string) {
    super(message);
    this.name = "FrigoraError";
    this.code = code;
  }
}

export function isFrigoraError(error: unknown): error is FrigoraError {
  return error instanceof FrigoraError;
}
