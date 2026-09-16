export const FRIGORA_PWA_NAME = "Frigora";
export const FRIGORA_PWA_SHORT_NAME = "Frigora";
export const FRIGORA_DOCUMENT_TITLE_TEMPLATE = "%s · Frigora";
export const FRIGORA_PWA_DESCRIPTION =
  "Field work for refrigeration engineers. Installable online Frigora.";
export const FRIGORA_AUTH_MARK = "F";
export const FRIGORA_AUTH_SIGN_IN_TITLE = "Sign in to Frigora";
export const FRIGORA_AUTH_ORIENTATION_RETURNING =
  "Frigora will return you to assigned field work after you sign in.";
export const FRIGORA_AUTH_EXPERIENCE = {
  eyebrow: "Frigora",
  title: "Continue into Frigora",
  cadence: ["Arrive.", "Record.", "Finish."] as const,
  message: "Sign in to continue assigned field work. This uses your existing organisation sign-in.",
} as const;

/** Frigora continuation login trust copy — no VentureOS product name. */
export const FRIGORA_AUTH_TRUST_NOTES = [
  "Frigora access is granted by your organisation.",
  "Sign-in activity is recorded for your organisation's security record.",
] as const;

export const FRIGORA_AUTH_LOADING_MESSAGE = "Opening Frigora...";


export const FRIGORA_CONNECTIVITY_OFFLINE_TITLE = "No connection";
export const FRIGORA_CONNECTIVITY_OFFLINE_BODY =
  "Offline changes are not available in this release. If a workspace was preloaded on this device, you may view that information until the lease expires. Reconnect to refresh.";

export const FRIGORA_CONNECTIVITY_RESTORED_TITLE = "Connection restored";
export const FRIGORA_CONNECTIVITY_RESTORED_BODY =
  "Continue in online mode. Reconnect refreshes live server data. Offline field changes are not available in this release.";

export const FRIGORA_OFFLINE_PAGE_TITLE = "Frigora is offline";
export const FRIGORA_OFFLINE_PAGE_BODY =
  "This install cannot open a new field session without a connection. Preloaded workspaces are available only from an already-open Frigora field session. Reconnect, then continue.";

export const FRIGORA_EVIDENCE_ONLINE_NOTE =
  "Photos and files upload while you are connected. A disconnected attempt is not kept for later sync.";

/** F33-02 preload / read-only honesty copy. */
export const FRIGORA_PRELOAD_STATUS_COPY = {
  workspaceAvailable: "Workspace available on this device",
  viewingPreloaded: "Viewing preloaded information",
  reconnectToRefresh: "Reconnect to refresh",
  offlineChangesUnavailable: "Offline changes are not available in this release",
  leaseExpired: "Preloaded workspace lease expired — reconnect to refresh",
  leaseMissing: "No preloaded workspace on this device",
  preloadAction: "Preload my field workspace",
  preloadSuccess: "Field workspace saved on this device for offline viewing",
  preloadFailed: "Could not preload field workspace",
} as const;

/** Queue-aware status copy for later packets — unused by F33-02 field forms. */
export const FRIGORA_OFFLINE_STATUS_COPY = {
  offline: "No connection",
  saved_on_device: "Saved on this device",
  waiting_to_sync: "changes waiting to sync",
  syncing: "Syncing",
  all_synced: "All changes synced",
  sync_failed: "Sync failed",
  sync_blocked: "Sync blocked — review required",
} as const;
