import { isFrigoraError } from "@/modules/frigora/errors";
import { StoredObjectError } from "@/platform/storage/errors";

export type ExplicitSubmitFailureCode =
  | "authority"
  | "idempotency_conflict"
  | "rejected"
  | "retryable"
  | "partition";

export function classifyExplicitSubmitFailure(error: unknown): {
  code: ExplicitSubmitFailureCode;
  error: string;
} {
  if (error instanceof StoredObjectError && error.code === "IDEMPOTENCY_CONFLICT") {
    return { code: "idempotency_conflict", error: error.message };
  }
  if (isFrigoraError(error)) {
    if (error.code === "forbidden") {
      return { code: "authority", error: error.message };
    }
    if (error.code === "idempotency_conflict") {
      return { code: "idempotency_conflict", error: error.message };
    }
    return { code: "rejected", error: error.message };
  }
  return {
    code: "retryable",
    error: error instanceof Error ? error.message : "Submission failed.",
  };
}
