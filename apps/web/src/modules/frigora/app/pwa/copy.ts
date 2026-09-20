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
  "Most field changes still require a connection. Technical findings, field captures, and evidence may be saved on this device when a preloaded workspace lease is active. Reconnect enables explicit submission — reconnect alone does not submit.";

export const FRIGORA_CONNECTIVITY_RESTORED_TITLE = "Connection restored";
export const FRIGORA_CONNECTIVITY_RESTORED_BODY =
  "Continue in online mode. Pending technical findings, field captures, and evidence on this device stay local until you explicitly submit them. Reconnect alone does not change server records.";

export const FRIGORA_OFFLINE_PAGE_TITLE = "Frigora is offline";
export const FRIGORA_OFFLINE_PAGE_BODY =
  "This install cannot open a new field session without a connection. Preloaded workspaces are available only from an already-open Frigora field session. Reconnect, then continue.";

export const FRIGORA_EVIDENCE_ONLINE_NOTE =
  "When connected, photos and files upload immediately. When disconnected, authorised evidence may be saved on this device for explicit later submit. Removal and linking still require a connection.";

/** F33-02 preload / read-only honesty copy. */
export const FRIGORA_PRELOAD_STATUS_COPY = {
  workspaceAvailable: "Workspace available on this device",
  viewingPreloaded: "Viewing preloaded information",
  reconnectToRefresh: "Reconnect to refresh",
  offlineChangesUnavailable:
    "Most offline field changes remain unavailable; technical findings, field captures, and evidence may be saved locally when leased",
  leaseExpired: "Preloaded workspace lease expired — reconnect to refresh",
  leaseMissing: "No preloaded workspace on this device",
  preloadAction: "Preload my field workspace",
  preloadSuccess: "Field workspace saved on this device for offline viewing",
  preloadFailed: "Could not preload field workspace",
} as const;

/** F33-03 technical-finding local/server honesty. */
export const FRIGORA_TECHNICAL_FINDING_STATUS_COPY = {
  offlineCaptureHint:
    "Saved findings stay on this device until you reconnect and explicitly submit them.",
  savedOnDevice: "Saved on this device",
  notYetSubmitted: "Not yet submitted",
  readyToSubmit: "Ready to submit",
  submitting: "Submitting",
  acceptedByServer: "Accepted by server",
  blocked: "Submission blocked — sign in again, then retry",
  conflict: "Server did not accept this finding",
  retryable: "Submission failed — you can retry",
} as const;

/** F33-04 field-capture local/server honesty. */
export const FRIGORA_FIELD_CAPTURE_STATUS_COPY = {
  offlineCaptureHint:
    "Saved captures stay on this device until you reconnect and explicitly submit them.",
  savedOnDevice: "Saved on this device",
  notYetSubmitted: "Not yet submitted",
  readyToSubmit: "Ready to submit",
  submitting: "Submitting",
  acceptedByServer: "Accepted by server",
  blocked: "Submission blocked — sign in again, then retry",
  conflict: "Server did not accept this capture",
  retryable: "Submission failed — you can retry",
} as const;

/** F33-04 visit-evidence local/server honesty. */
export const FRIGORA_VISIT_EVIDENCE_STATUS_COPY = {
  offlineCaptureHint:
    "Saved evidence stays on this device until you reconnect and explicitly submit it.",
  savedOnDevice: "Saved on this device",
  notYetSubmitted: "Not yet submitted",
  readyToSubmit: "Ready to submit",
  submitting: "Submitting",
  acceptedByServer: "Accepted by server",
  blocked: "Submission blocked — sign in again, then retry",
  conflict: "Server did not accept this evidence",
  retryable: "Submission failed — you can retry",
} as const;

/** Queue-aware status copy. */
export const FRIGORA_OFFLINE_STATUS_COPY = {
  offline: "No connection",
  saved_on_device: "Saved on this device",
  waiting_to_sync: "changes waiting to sync",
  syncing: "Syncing",
  all_synced: "All changes synced",
  sync_failed: "Sync failed",
  sync_blocked: "Sync blocked — review required",
} as const;
