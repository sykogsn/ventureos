import type { InboundAttachment, RetrievedInboundEmail } from "./provider";

export const MAX_WEBHOOK_BODY_BYTES = 1_000_000;
export const MAX_BODY_CHARS = 200_000;
export const MAX_SUBJECT_CHARS = 998;
export const MAX_ATTACHMENTS = 5;
export const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;
export const MAX_ATTACHMENT_TOTAL_BYTES = 10 * 1024 * 1024;

const ALLOWED_TYPES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  "text/plain",
]);

const EXTENSION_TYPES: Record<string, string> = {
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  txt: "text/plain",
};

const BLOCKED_EXTENSIONS = new Set([
  "exe",
  "dll",
  "js",
  "mjs",
  "cjs",
  "html",
  "htm",
  "svg",
  "zip",
  "bat",
  "cmd",
  "ps1",
  "sh",
  "jar",
  "msi",
  "com",
  "scr",
  "vbs",
  "docm",
  "xlsm",
]);

export type StoredAttachment = {
  id: string;
  filename: string;
  contentType: string;
  size: number | null;
  contentDisposition: string | null;
  accepted: boolean;
};

export type ContentAssessment =
  | { ok: true; attachments: StoredAttachment[] }
  | {
      ok: false;
      reason:
        | "authentication_failed"
        | "message_too_large"
        | "invalid_sender"
        | "attachment_too_large"
        | "attachment_unsupported"
        | "attachment_unverified"
        | "too_many_attachments";
      attachments: StoredAttachment[];
    };

/** Classifies untrusted content. It never reads attachment bytes and never executes them. */
export function assessInboundContent(email: RetrievedInboundEmail): ContentAssessment {
  if (authenticationFailed(email.authentication)) {
    return { ok: false, reason: "authentication_failed", attachments: [] };
  }
  if (
    email.subject.length > MAX_SUBJECT_CHARS ||
    (email.text?.length ?? 0) > MAX_BODY_CHARS ||
    (email.html?.length ?? 0) > MAX_BODY_CHARS
  ) {
    return { ok: false, reason: "message_too_large", attachments: [] };
  }
  if (!normalizeMailboxAddress(email.from)) {
    return { ok: false, reason: "invalid_sender", attachments: [] };
  }
  if (email.attachments.length > MAX_ATTACHMENTS) {
    return {
      ok: false,
      reason: "too_many_attachments",
      attachments: email.attachments.map((item) => describeAttachment(item, false)),
    };
  }

  const stored = email.attachments.map((item) => describeAttachment(item, attachmentAccepted(item)));
  const rejected = stored.find((item) => !item.accepted);
  if (rejected) {
    const source = email.attachments.find((item) => item.id === rejected.id);
    const reason = source ? attachmentRejection(source) : null;
    return {
      ok: false,
      reason: reason ?? "attachment_unsupported",
      attachments: stored,
    };
  }

  const total = stored.reduce((sum, item) => sum + (item.size ?? 0), 0);
  if (total > MAX_ATTACHMENT_TOTAL_BYTES) {
    return {
      ok: false,
      reason: "attachment_too_large",
      attachments: stored.map((item) => ({ ...item, accepted: false })),
    };
  }

  return { ok: true, attachments: stored };
}

export function normalizeMailboxAddress(value: string): string | null {
  const trimmed = value.trim().toLowerCase();
  const wrapped = trimmed.match(/<([^<>]+)>$/);
  const address = (wrapped?.[1] ?? trimmed).trim();
  if (address.length > 320) return null;
  if (!/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/.test(address)) return null;
  return address;
}

function authenticationFailed(
  authentication: RetrievedInboundEmail["authentication"],
): boolean {
  if (!authentication) return false;
  return [authentication.spf, authentication.dkim, authentication.dmarc].some(
    (value) => value === "fail" || value === "processing_failed",
  );
}

function attachmentAccepted(attachment: InboundAttachment): boolean {
  return attachmentRejection(attachment) === null;
}

function attachmentRejection(
  attachment: InboundAttachment,
): "attachment_too_large" | "attachment_unsupported" | "attachment_unverified" | null {
  if (!/^[A-Za-z0-9_-]{1,80}$/.test(attachment.id)) return "attachment_unsupported";
  const filename = displayFilename(attachment.filename);
  if (!filename) return "attachment_unsupported";
  const segments = filename.toLowerCase().split(".");
  if (segments.length < 2) return "attachment_unsupported";
  if (segments.slice(1).some((segment) => BLOCKED_EXTENSIONS.has(segment))) {
    return "attachment_unsupported";
  }
  const extension = segments.at(-1) ?? "";
  const expected = EXTENSION_TYPES[extension];
  const contentType = baseContentType(attachment.contentType);
  if (!expected || expected !== contentType || !ALLOWED_TYPES.has(contentType)) {
    return "attachment_unsupported";
  }
  if (attachment.size === null || !Number.isInteger(attachment.size) || attachment.size < 0) {
    return "attachment_unverified";
  }
  if (attachment.size > MAX_ATTACHMENT_BYTES) return "attachment_too_large";
  return null;
}

function describeAttachment(attachment: InboundAttachment, accepted: boolean): StoredAttachment {
  return {
    id: /^[A-Za-z0-9_-]{1,80}$/.test(attachment.id) ? attachment.id : "rejected",
    filename: displayFilename(attachment.filename),
    contentType: baseContentType(attachment.contentType).slice(0, 120),
    size: typeof attachment.size === "number" && Number.isInteger(attachment.size) ? attachment.size : null,
    contentDisposition: disposition(attachment.contentDisposition),
    accepted,
  };
}

function displayFilename(filename: string): string {
  const base = filename.replaceAll("\\", "/").split("/").pop() ?? "";
  let cleaned = "";
  for (const character of base) {
    const code = character.charCodeAt(0);
    if (code >= 32 && code !== 127) cleaned += character;
  }
  return cleaned.replaceAll("..", "").slice(0, 200);
}

function baseContentType(value: string): string {
  return value.split(";", 1)[0]?.trim().toLowerCase() ?? "";
}

function disposition(value: string | null): string | null {
  if (value === "inline" || value === "attachment") return value;
  return null;
}
