import type {
  EmailProvider,
  InboundAttachment,
  InboundAuthentication,
  RetrievedInboundEmail,
} from "./provider";
import { ProviderRetrievalError } from "./provider";
import { verifyResendWebhook } from "./signature";

const RECEIVING_ENDPOINT = "https://api.resend.com/emails/receiving";
const EMAIL_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function createResendEmailProvider(options: {
  apiKey: string;
  fetchImpl?: typeof fetch;
}): EmailProvider {
  const apiKey = options.apiKey.trim();
  if (!apiKey) {
    throw new ProviderRetrievalError("configuration_unavailable");
  }
  const fetchImpl = options.fetchImpl ?? fetch;

  return {
    id: "resend",
    verifyWebhook(input) {
      return verifyResendWebhook(input);
    },
    async retrieveInbound(emailId) {
      if (!EMAIL_ID.test(emailId)) {
        throw new ProviderRetrievalError("invalid_email_id");
      }
      const url = `${RECEIVING_ENDPOINT}/${encodeURIComponent(emailId)}?html_format=cid`;
      let response: Response;
      try {
        response = await fetchImpl(url, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            Accept: "application/json",
          },
        });
      } catch {
        throw new ProviderRetrievalError("network");
      }
      if (!response.ok) throw new ProviderRetrievalError("http");

      let body: unknown;
      try {
        body = await response.json();
      } catch {
        throw new ProviderRetrievalError("body");
      }
      const email = parseRetrievedEmail(body);
      if (!email || email.id !== emailId) {
        throw new ProviderRetrievalError("shape");
      }
      return email;
    },
  };
}

function parseRetrievedEmail(value: unknown): RetrievedInboundEmail | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (typeof record.id !== "string" || !EMAIL_ID.test(record.id)) return null;
  if (typeof record.from !== "string") return null;
  const to = readStringList(record.to);
  const cc = readStringList(record.cc);
  const receivedFor = readStringList(record.received_for);
  if (!to || !cc || !receivedFor) return null;
  if (record.subject !== undefined && typeof record.subject !== "string") return null;
  if (record.text !== undefined && record.text !== null && typeof record.text !== "string") return null;
  if (record.html !== undefined && record.html !== null && typeof record.html !== "string") return null;
  if (record.message_id !== undefined && record.message_id !== null && typeof record.message_id !== "string") {
    return null;
  }
  const attachments = readAttachments(record.attachments);
  if (!attachments) return null;
  return {
    id: record.id,
    messageId: typeof record.message_id === "string" ? record.message_id.slice(0, 500) : "",
    from: record.from,
    to,
    cc,
    receivedFor,
    subject: typeof record.subject === "string" ? record.subject : "",
    text: typeof record.text === "string" ? record.text : null,
    html: typeof record.html === "string" ? record.html : null,
    headers: readHeaders(record.headers),
    attachments,
    authentication: readAuthentication(record.authentication),
  };
}

function readStringList(value: unknown): string[] | null {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 20) return null;
  if (!value.every((item) => typeof item === "string")) return null;
  return value;
}

function readHeaders(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const headers: Record<string, string> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry !== "string") continue;
    if (Object.keys(headers).length >= 40) break;
    headers[key.slice(0, 80)] = entry.slice(0, 2000);
  }
  return headers;
}

function readAttachments(value: unknown): InboundAttachment[] | null {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 20) return null;
  const attachments: InboundAttachment[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object" || Array.isArray(item)) return null;
    const record = item as Record<string, unknown>;
    if (typeof record.id !== "string" || typeof record.filename !== "string") return null;
    if (typeof record.content_type !== "string") return null;
    if (
      record.content_disposition !== undefined &&
      record.content_disposition !== null &&
      typeof record.content_disposition !== "string"
    ) {
      return null;
    }
    if (record.size !== undefined && record.size !== null && typeof record.size !== "number") {
      return null;
    }
    attachments.push({
      id: record.id,
      filename: record.filename,
      contentType: record.content_type,
      contentDisposition:
        typeof record.content_disposition === "string" ? record.content_disposition : null,
      size: typeof record.size === "number" ? record.size : null,
    });
  }
  return attachments;
}

function readAuthentication(value: unknown): InboundAuthentication | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (
    typeof record.spf !== "string" ||
    typeof record.dkim !== "string" ||
    typeof record.dmarc !== "string"
  ) {
    return null;
  }
  return { spf: record.spf, dkim: record.dkim, dmarc: record.dmarc };
}
