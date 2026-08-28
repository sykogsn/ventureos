export type FrigoraErrorCode =
  | "forbidden"
  | "not_found"
  | "not_frigora"
  | "archived_parent"
  | "duplicate"
  | "invalid_input"
  | "invalid_status"
  | "invalid_kind"
  | "cross_venture";

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
