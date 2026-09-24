import { createId } from "@/platform/ids";

/** Client-side IndexedDB schema version for Frigora offline foundation (F33-01). */
export const FRIGORA_OFFLINE_DB_NAME = "frigora-offline";
export const FRIGORA_OFFLINE_DB_VERSION = 1;

/** Locked offline lease duration from last successful authenticated preload. */
export const FRIGORA_OFFLINE_LEASE_MS = 12 * 60 * 60 * 1000;

export const FRIGORA_OFFLINE_OBJECT_STORES = [
  "workspaces",
  "outbox",
  "evidence_blobs",
  "receipts",
  "leases",
] as const;

export type FrigoraOfflineObjectStoreName =
  (typeof FRIGORA_OFFLINE_OBJECT_STORES)[number];

export type FrigoraOfflineSyncState =
  | "LOCAL_DRAFT"
  | "PENDING"
  | "SYNCING"
  | "SYNCED"
  | "BLOCKED"
  | "CONFLICT"
  | "RETRYABLE_FAILURE";

export type FrigoraOfflineOperationType =
  | "recordTechnicalFinding"
  | "recordCorrectiveAction"
  | "recordRecommendedAction"
  | "recordFieldCapture"
  | "recordPartUsage"
  | "recordRefrigerantEvent"
  | "recordVisitOutcome"
  | "recordVisitCustomerAcknowledgement"
  | "recordVisitEvidence"
  | "recordVisitArrival"
  | "recordVisitDeparture";

export type FrigoraClientOperationId = string & {
  readonly __brand: "FrigoraClientOperationId";
};

export function createClientOperationId(): FrigoraClientOperationId {
  return createId<FrigoraClientOperationId>();
}

export type FrigoraOfflinePartition = {
  ventureId: string;
  actorUserId: string;
};

export type FrigoraOfflineServerReceipt = {
  accepted: boolean;
  recordedAt: string;
  serverErrorCode?: string;
  serverMessage?: string;
};

export type FrigoraOfflineMutationEnvelope = {
  clientOperationId: FrigoraClientOperationId;
  ventureId: string;
  workspaceId?: string;
  actorUserId: string;
  workOrderId: string;
  visitId?: string;
  operationType: FrigoraOfflineOperationType;
  payload: Record<string, unknown>;
  createdAtLocal: string;
  baseSnapshotId?: string;
  basePrecondition?: Record<string, unknown>;
  syncState: FrigoraOfflineSyncState;
  attemptCount: number;
  lastAttemptAt?: string;
  serverReceipt?: FrigoraOfflineServerReceipt;
};

/**
 * Field-safe workspace snapshot contract.
 * MUST NOT include commercial/pricing fields (engineer denial).
 */
export type FrigoraOfflineWorkspaceSnapshot = {
  snapshotId: string;
  ventureId: string;
  actorUserId: string;
  workOrderId: string;
  visitId?: string;
  asOf: string;
  generation: number;
  leaseId: string;
  /** Operational field payload only — no charge rates or T&M money. */
  payload: FrigoraOfflineFieldSafePayload;
};

export type FrigoraOfflineFieldSafePayload = {
  workOrder?: Record<string, unknown>;
  visit?: Record<string, unknown>;
  customer?: Record<string, unknown>;
  site?: Record<string, unknown>;
  asset?: Record<string, unknown>;
  history?: unknown[];
  partReferences?: Array<Record<string, unknown>>;
  refrigerantReferences?: Array<Record<string, unknown>>;
};

export const FRIGORA_OFFLINE_FORBIDDEN_COMMERCIAL_KEYS = [
  "unitChargeCents",
  "chargePerKgCents",
  "labourHourlyChargeCents",
  "timeMaterials",
  "knownSubtotalCents",
  "finalTotalCents",
  "defaultUnitChargeCents",
  "defaultChargePerKgCents",
] as const;

export type FrigoraOfflineLease = {
  leaseId: string;
  ventureId: string;
  actorUserId: string;
  issuedAt: string;
  expiresAt: string;
  /** Authenticated preload time that issued the lease — never extended by offline actions. */
  authenticatedPreloadAt: string;
};

export type FrigoraOfflineEvidenceBlobLifecycle =
  | "LOCAL_ONLY"
  | "LINKED_TO_PENDING"
  | "AWAITING_SERVER_ACCEPTANCE"
  | "SERVER_ACCEPTED"
  | "LOCAL_DELETED";

export type FrigoraOfflineEvidenceBlob = {
  blobId: string;
  clientOperationId: FrigoraClientOperationId;
  ventureId: string;
  actorUserId: string;
  contentType: string;
  fileName?: string;
  byteLength: number;
  createdAtLocal: string;
  lifecycle: FrigoraOfflineEvidenceBlobLifecycle;
  /** Binary payload retained until confirmed server acceptance or local unsynced delete. */
  bytes: ArrayBuffer;
};

export type FrigoraOfflineReceiptRecord = {
  receiptId: string;
  clientOperationId: FrigoraClientOperationId;
  ventureId: string;
  actorUserId: string;
  recordedAt: string;
  kind: "accepted" | "rejected" | "conflict" | "retryable";
  detail?: string;
};

export type FrigoraOfflineQueueStatus = {
  online: boolean;
  pendingCount: number;
  syncingCount: number;
  blockedCount: number;
  conflictCount: number;
  retryableFailureCount: number;
  syncedCount: number;
  label:
    | "offline"
    | "saved_on_device"
    | "waiting_to_sync"
    | "syncing"
    | "all_synced"
    | "sync_failed"
    | "sync_blocked"
    | "online_idle";
};

export type LogoutPendingPolicy = {
  cancelLogout: true;
  logoutRetainingPendingWork: true;
  allowCasualDestructiveDiscard: false;
};

export const FRIGORA_LOGOUT_PENDING_POLICY: LogoutPendingPolicy = {
  cancelLogout: true,
  logoutRetainingPendingWork: true,
  allowCasualDestructiveDiscard: false,
};

/** F33-01: field form mutations are still online-only until later packets. */
export const FRIGORA_FIELD_FORMS_OFFLINE_CAPTURE_ENABLED = false;
