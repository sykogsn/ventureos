export type StoredObjectErrorCode =
  | "VALIDATION"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "STORAGE"
  | "DELETE_BYTES_FAILED";

export class StoredObjectError extends Error {
  readonly code: StoredObjectErrorCode;

  constructor(code: StoredObjectErrorCode, message: string) {
    super(message);
    this.name = "StoredObjectError";
    this.code = code;
  }
}
