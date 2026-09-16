export {
  FRIGORA_OFFLINE_DB_NAME,
  FRIGORA_OFFLINE_DB_VERSION,
  FRIGORA_OFFLINE_LEASE_MS,
  FRIGORA_OFFLINE_OBJECT_STORES,
  FRIGORA_OFFLINE_FORBIDDEN_COMMERCIAL_KEYS,
  FRIGORA_FIELD_FORMS_OFFLINE_CAPTURE_ENABLED,
  FRIGORA_LOGOUT_PENDING_POLICY,
  createClientOperationId,
} from "./types";
export type {
  FrigoraClientOperationId,
  FrigoraOfflineEvidenceBlob,
  FrigoraOfflineFieldSafePayload,
  FrigoraOfflineLease,
  FrigoraOfflineMutationEnvelope,
  FrigoraOfflineOperationType,
  FrigoraOfflinePartition,
  FrigoraOfflineQueueStatus,
  FrigoraOfflineReceiptRecord,
  FrigoraOfflineSyncState,
  FrigoraOfflineWorkspaceSnapshot,
  LogoutPendingPolicy,
} from "./types";

export {
  assertTransitionOfflineSyncState,
  canTransitionOfflineSyncState,
  isPendingSyncAttention,
  isUnsyncedOfflineState,
  transitionWithReceiptGuard,
} from "./sync-state";

export {
  assertPartitionMatch,
  belongsToPartition,
  offlinePartitionKey,
  offlineWorkspaceKey,
} from "./partition";

export {
  assertOfflineLeaseActive,
  createOfflineLease,
  isOfflineLeaseActive,
  offlineLeaseRemainingMs,
  refuseOfflineLeaseSelfExtension,
} from "./lease";

export {
  assertFieldSafeOfflinePayload,
  assertFieldSafeWorkspaceSnapshot,
} from "./commercial-guard";

export {
  mapPartReferenceFieldSafe,
  mapRefrigerantReferenceFieldSafe,
  mapToFieldSafeOfflinePayload,
  stripForbiddenCommercialFields,
} from "./field-safe-mapper";

export {
  buildDraftFromMyWorkRow,
  buildFieldWorkspacePreloadPackage,
} from "./preload-build";
export type {
  FieldSafeWorkspaceDraft,
  FieldWorkspacePreloadPackage,
} from "./preload-build";

export {
  listAvailableOfflineWorkspaces,
  readOfflineWorkspaceSnapshot,
} from "./offline-read";
export type {
  OfflineWorkspaceReadResult,
  OfflineWorkspaceReadStatus,
} from "./offline-read";

export {
  countPendingUnsyncedOperations,
  hasPendingUnsyncedWork,
  summarizeOfflineQueueStatus,
} from "./status";

export {
  createMemoryOfflineBackend,
  openDefaultOfflineBackend,
  openIndexedDbOfflineBackend,
  resetMemoryOfflineDatabasesForTests,
} from "./backend";
export type { FrigoraOfflineBackend } from "./backend";

export {
  createEvidenceBlobRecord,
  openFrigoraIndexedDbOfflineStore,
  openFrigoraOfflineStore,
} from "./store";
export type { FrigoraOfflineStore } from "./store";
