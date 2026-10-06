import { isFrigoraFieldPath } from "./paths";
import { FRIGORA_F33_OFFLINE_RUNTIME_ENABLED } from "@/modules/frigora/app/offline/runtime-gate";
import {
  FRIGORA_FIELD_FORMS_OFFLINE_CAPTURE_ENABLED,
  type FrigoraOfflineQueueStatus,
} from "@/modules/frigora/app/offline";
import { isFrigoraOfflineCaptureOperationAllowed } from "@/modules/frigora/app/offline/capture-gate";

/**
 * Field form mutations remain blocked offline unless an operation-specific
 * F33-03 allowlist entry applies. Global capture flag stays false.
 */
export function shouldBlockFrigoraFieldMutation(
  online: boolean,
  pathname: string,
  options?: { operationType?: string },
): boolean {
  if (online) {
    return false;
  }
  if (!isFrigoraFieldPath(pathname)) {
    return false;
  }
  if (!FRIGORA_F33_OFFLINE_RUNTIME_ENABLED) {
    return true;
  }
  if (
    options?.operationType &&
    isFrigoraOfflineCaptureOperationAllowed(options.operationType)
  ) {
    return false;
  }
  if (!FRIGORA_FIELD_FORMS_OFFLINE_CAPTURE_ENABLED) {
    return true;
  }
  return false;
}

/**
 * Queue-aware status helper for later UX.
 * Must not claim "saved_on_device" unless durable pending ops actually exist.
 */
export function resolveConnectivityStatusLabel(input: {
  online: boolean;
  queue?: Pick<
    FrigoraOfflineQueueStatus,
    | "pendingCount"
    | "syncingCount"
    | "blockedCount"
    | "conflictCount"
    | "retryableFailureCount"
    | "syncedCount"
    | "label"
  >;
}): FrigoraOfflineQueueStatus["label"] {
  if (!FRIGORA_F33_OFFLINE_RUNTIME_ENABLED) {
    return input.online ? "online_idle" : "offline";
  }
  if (!input.online) {
    const pending = input.queue?.pendingCount ?? 0;
    const blocked = (input.queue?.blockedCount ?? 0) + (input.queue?.conflictCount ?? 0);
    const retryable = input.queue?.retryableFailureCount ?? 0;
    if (pending + blocked + retryable > 0) {
      return "saved_on_device";
    }
    return "offline";
  }
  if (!input.queue) {
    return "online_idle";
  }
  return input.queue.label === "offline" ? "online_idle" : input.queue.label;
}
