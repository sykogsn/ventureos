import { createId, nowIso } from "@/platform/ids";
import {
  FRIGORA_OFFLINE_LEASE_MS,
  type FrigoraOfflineLease,
  type FrigoraOfflinePartition,
} from "./types";

export function createOfflineLease(
  partition: FrigoraOfflinePartition,
  options?: { nowMs?: number; authenticatedPreloadAt?: string },
): FrigoraOfflineLease {
  const nowMs = options?.nowMs ?? Date.now();
  const issuedAt = new Date(nowMs).toISOString();
  const authenticatedPreloadAt = options?.authenticatedPreloadAt ?? issuedAt;
  return {
    leaseId: createId(),
    ventureId: partition.ventureId,
    actorUserId: partition.actorUserId,
    issuedAt,
    expiresAt: new Date(nowMs + FRIGORA_OFFLINE_LEASE_MS).toISOString(),
    authenticatedPreloadAt,
  };
}

export function isOfflineLeaseActive(
  lease: FrigoraOfflineLease,
  nowMs: number = Date.now(),
): boolean {
  return Date.parse(lease.expiresAt) > nowMs;
}

export function assertOfflineLeaseActive(
  lease: FrigoraOfflineLease,
  nowMs: number = Date.now(),
): void {
  if (!isOfflineLeaseActive(lease, nowMs)) {
    throw new Error("Offline lease expired");
  }
}

/**
 * Offline actions must never extend lease expiry.
 * Returns the same lease object (immutable policy).
 */
export function refuseOfflineLeaseSelfExtension(
  lease: FrigoraOfflineLease,
): FrigoraOfflineLease {
  return lease;
}

export function offlineLeaseRemainingMs(
  lease: FrigoraOfflineLease,
  nowMs: number = Date.now(),
): number {
  return Math.max(0, Date.parse(lease.expiresAt) - nowMs);
}

export function stampNowIso(): string {
  return nowIso();
}
