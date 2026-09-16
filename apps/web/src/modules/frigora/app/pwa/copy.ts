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
  "Frigora is online-only. Field records are not stored on this device while you are disconnected. Do not continue operational work until you are back online.";

export const FRIGORA_CONNECTIVITY_RESTORED_TITLE = "Connection restored";
export const FRIGORA_CONNECTIVITY_RESTORED_BODY =
  "Continue in online mode. Earlier disconnected attempts were not queued and were not saved.";

export const FRIGORA_OFFLINE_PAGE_TITLE = "Frigora is offline";
export const FRIGORA_OFFLINE_PAGE_BODY =
  "This install cannot complete field work without a connection. Nothing is queued on this device for later sync. Reconnect, then continue the live job.";

export const FRIGORA_EVIDENCE_ONLINE_NOTE =
  "Photos and files upload while you are connected. A disconnected attempt is not kept for later sync.";
