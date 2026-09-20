import type { FrigoraOfflineOperationType } from "./types";

/**
 * F33-04: global FRIGORA_FIELD_FORMS_OFFLINE_CAPTURE_ENABLED remains false.
 * Only these operation types may perform local offline capture.
 */
export const FRIGORA_OFFLINE_CAPTURE_OPERATION_ALLOWLIST = [
  "recordTechnicalFinding",
  "recordFieldCapture",
  "recordVisitEvidence",
] as const satisfies readonly FrigoraOfflineOperationType[];

export type FrigoraOfflineCaptureAllowedOperation =
  (typeof FRIGORA_OFFLINE_CAPTURE_OPERATION_ALLOWLIST)[number];

export function isFrigoraOfflineCaptureOperationAllowed(
  operationType: string,
): operationType is FrigoraOfflineCaptureAllowedOperation {
  return (FRIGORA_OFFLINE_CAPTURE_OPERATION_ALLOWLIST as readonly string[]).includes(
    operationType,
  );
}
