import type { FrigoraOfflineSyncState } from "./types";

const LEGAL_TRANSITIONS: Record<FrigoraOfflineSyncState, readonly FrigoraOfflineSyncState[]> = {
  LOCAL_DRAFT: ["PENDING", "LOCAL_DRAFT"],
  PENDING: ["SYNCING", "LOCAL_DRAFT"],
  SYNCING: ["SYNCED", "BLOCKED", "CONFLICT", "RETRYABLE_FAILURE", "PENDING"],
  SYNCED: [],
  BLOCKED: ["PENDING"],
  CONFLICT: ["PENDING"],
  RETRYABLE_FAILURE: ["PENDING", "SYNCING"],
};

export function canTransitionOfflineSyncState(
  from: FrigoraOfflineSyncState,
  to: FrigoraOfflineSyncState,
): boolean {
  return LEGAL_TRANSITIONS[from].includes(to);
}

export function assertTransitionOfflineSyncState(
  from: FrigoraOfflineSyncState,
  to: FrigoraOfflineSyncState,
): void {
  if (!canTransitionOfflineSyncState(from, to)) {
    throw new Error(`Illegal offline sync transition: ${from} → ${to}`);
  }
}

/**
 * F33-01: never mark SYNCED without an explicit server receipt flag.
 * Callers must pass serverAccepted=true only when a real receipt exists.
 */
export function transitionWithReceiptGuard(
  from: FrigoraOfflineSyncState,
  to: FrigoraOfflineSyncState,
  options?: { serverAccepted?: boolean },
): FrigoraOfflineSyncState {
  assertTransitionOfflineSyncState(from, to);
  if (to === "SYNCED" && options?.serverAccepted !== true) {
    throw new Error("SYNCED requires serverAccepted receipt evidence");
  }
  return to;
}

export function isUnsyncedOfflineState(state: FrigoraOfflineSyncState): boolean {
  return state !== "SYNCED";
}

export function isPendingSyncAttention(state: FrigoraOfflineSyncState): boolean {
  return (
    state === "PENDING" ||
    state === "SYNCING" ||
    state === "LOCAL_DRAFT" ||
    state === "BLOCKED" ||
    state === "CONFLICT" ||
    state === "RETRYABLE_FAILURE"
  );
}
