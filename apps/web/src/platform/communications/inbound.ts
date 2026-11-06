import type { AuditLog } from "@/platform/audit/log";
import type { VentureId, WorkspaceId } from "@/contracts";
import type { CommunicationsConfig } from "./config";
import { assessInboundContent, normalizeMailboxAddress } from "./policy";
import { MAX_WEBHOOK_BODY_BYTES } from "./policy";
import type { EmailProvider, RetrievedInboundEmail, SignedInboundNotice, WebhookHeaders } from "./provider";
import { ProviderRetrievalError } from "./provider";
import { isEventId, MalformedWebhookError, WebhookSignatureError } from "./signature";
import {
  createCommunicationsStore,
  MailboxScopeError,
  type CommunicationMailbox,
  type CommunicationsStore,
} from "./store";

const MAX_RECIPIENTS = 10;

export type InboundWebhookResult = {
  status: number;
  body: {
    status: "accepted" | "duplicate" | "rejected" | "failed";
    code?: string;
    messageId?: string;
  };
};

/**
 * Inbound content is untrusted data. It is persisted and audited.
 * It is not executed, and it is not applied to permissions, workforce, or configuration.
 * Venture scope comes only from the mailbox row that matches a recipient address.
 */
export async function rejectUnreadInboundBody(
  audit: AuditLog,
  reason: "payload_too_large" | "payload_unreadable",
): Promise<InboundWebhookResult> {
  await record(audit, "communications.inbound.rejected", { reason });
  return result(reason === "payload_too_large" ? 413 : 400, "rejected", reason);
}

export async function processInboundWebhook(input: {
  rawBody: Uint8Array;
  headers: WebhookHeaders;
  now?: Date;
  config: CommunicationsConfig | null;
  provider: EmailProvider | null;
  store?: CommunicationsStore;
  audit: AuditLog;
}): Promise<InboundWebhookResult> {
  const store = input.store ?? createCommunicationsStore();
  const eventId = input.headers.id && isEventId(input.headers.id) ? input.headers.id : "";

  if (input.rawBody.byteLength > MAX_WEBHOOK_BODY_BYTES) {
    return rejectUnreadInboundBody(input.audit, "payload_too_large");
  }

  if (!input.config || !input.provider) {
    await record(input.audit, "communications.inbound.rejected", {
      reason: "configuration_unavailable",
    });
    return result(503, "rejected", "configuration_unavailable");
  }

  let payload: unknown;
  try {
    payload = input.provider.verifyWebhook({
      rawBody: input.rawBody,
      headers: input.headers,
      secret: input.config.webhookSecret,
      now: input.now,
    });
  } catch (error) {
    if (error instanceof MalformedWebhookError) {
      return rejectTerminal(input, store, eventId, null, "malformed_payload", 400);
    }
    if (error instanceof WebhookSignatureError) {
      await record(input.audit, "communications.inbound.rejected", {
        reason: "invalid_signature",
        ...(eventId ? { providerEventId: eventId } : {}),
      });
      return result(401, "rejected", "invalid_signature");
    }
    await record(input.audit, "communications.inbound.failed", { reason: "invalid_signature" });
    return result(401, "rejected", "invalid_signature");
  }

  try {
    if (eventId && (await store.hasProviderEvent(eventId))) {
      await record(input.audit, "communications.inbound.duplicate", {
        reason: "duplicate",
        providerEventId: eventId,
      });
      return { status: 200, body: { status: "duplicate" } };
    }
  } catch (error) {
    return persistenceFailure(input.audit, eventId, error);
  }

  const notice = readNotice(payload);
  if (!notice || !eventId) {
    return rejectTerminal(input, store, eventId, notice?.emailId ?? null, "malformed_payload", 400);
  }

  const addresses = routingAddresses(notice);
  if (!addresses) {
    return rejectTerminal(input, store, eventId, notice.emailId, "invalid_routing", 422);
  }

  let mailboxes: CommunicationMailbox[];
  try {
    mailboxes = await store.findActiveByAddresses(addresses);
  } catch (error) {
    return persistenceFailure(input.audit, eventId, error);
  }

  const matched = new Map(mailboxes.map((mailbox) => [mailbox.address, mailbox]));
  if (matched.size === 0) {
    await record(input.audit, "communications.inbound.rejected", {
      reason: "unknown_mailbox",
      providerEventId: eventId,
    });
    return result(404, "rejected", "unknown_mailbox");
  }

  const scopes = new Set(mailboxes.map((mailbox) => `${mailbox.workspaceId}\n${mailbox.ventureId}`));
  const unmatched = addresses.filter((address) => !matched.has(address));
  if (unmatched.length > 0 || scopes.size !== 1) {
    return rejectTerminal(input, store, eventId, notice.emailId, "invalid_routing", 422);
  }

  const mailbox = matched.get(addresses[0] ?? "");
  if (!mailbox) {
    return rejectTerminal(input, store, eventId, notice.emailId, "invalid_routing", 422);
  }

  let email: RetrievedInboundEmail;
  try {
    email = await input.provider.retrieveInbound(notice.emailId);
  } catch (error) {
    const reason = error instanceof ProviderRetrievalError ? error.code : "provider_retrieval_failed";
    await record(input.audit, "communications.inbound.failed", {
      reason,
      providerEventId: eventId,
      workspaceId: mailbox.workspaceId,
      ventureId: mailbox.ventureId,
      mailboxId: mailbox.id,
    });
    return result(502, "failed", "provider_retrieval_failed");
  }

  if (email.id !== notice.emailId || !retrievedConfirmsMailbox(email, mailbox.address)) {
    await record(input.audit, "communications.inbound.failed", {
      reason: "provider_payload_mismatch",
      providerEventId: eventId,
      workspaceId: mailbox.workspaceId,
      ventureId: mailbox.ventureId,
      mailboxId: mailbox.id,
    });
    return result(502, "failed", "provider_retrieval_failed");
  }

  const assessment = assessInboundContent(email);
  const accepted = assessment.ok;
  try {
    const committed = await store.commitInbound({
      kind: "message",
      providerEventId: eventId,
      providerMessageId: email.id,
      status: accepted ? "accepted" : "rejected",
      reason: accepted ? null : assessment.reason,
      mailboxId: mailbox.id,
      workspaceId: mailbox.workspaceId,
      ventureId: mailbox.ventureId,
      rfcMessageId: email.messageId.slice(0, 500),
      threadKey: threadKey(email),
      fromAddress: accepted ? (normalizeMailboxAddress(email.from) ?? "") : "",
      toJson: JSON.stringify(addresses),
      subject: email.subject.length <= 998 ? email.subject : "",
      textBody: accepted ? email.text : null,
      htmlBody: accepted ? email.html : null,
      attachmentJson: JSON.stringify(assessment.attachments),
      authenticationJson: JSON.stringify(email.authentication),
    });
    if (committed.outcome === "duplicate") {
      await record(input.audit, "communications.inbound.duplicate", scopeMetadata(mailbox, eventId));
      return { status: 200, body: { status: "duplicate" } };
    }
    if (!accepted) {
      await record(input.audit, "communications.inbound.rejected", {
        ...scopeMetadata(mailbox, eventId),
        reason: assessment.reason,
        ...(committed.messageId ? { messageId: committed.messageId } : {}),
      });
      return {
        status: 422,
        body: {
          status: "rejected",
          code: "unsupported_content",
          ...(committed.messageId ? { messageId: committed.messageId } : {}),
        },
      };
    }
    await record(input.audit, "communications.inbound.accepted", {
      ...scopeMetadata(mailbox, eventId),
      reason: "accepted",
      ...(committed.messageId ? { messageId: committed.messageId } : {}),
    });
    return {
      status: 200,
      body: { status: "accepted", ...(committed.messageId ? { messageId: committed.messageId } : {}) },
    };
  } catch (error) {
    if (error instanceof MailboxScopeError) {
      await record(input.audit, "communications.inbound.rejected", {
        reason: "unknown_mailbox",
        providerEventId: eventId,
      });
      return result(404, "rejected", "unknown_mailbox");
    }
    return persistenceFailure(input.audit, eventId, error);
  }
}

async function rejectTerminal(
  input: { audit: AuditLog },
  store: CommunicationsStore,
  eventId: string,
  providerMessageId: string | null,
  reason: "malformed_payload" | "invalid_routing",
  status: number,
): Promise<InboundWebhookResult> {
  if (!eventId) {
    await record(input.audit, "communications.inbound.rejected", { reason });
    return result(status, "rejected", reason);
  }
  try {
    const committed = await store.commitInbound({
      kind: "event",
      providerEventId: eventId,
      providerMessageId,
      reason,
      workspaceId: "",
      ventureId: "",
      mailboxId: null,
    });
    if (committed.outcome === "duplicate") {
      await record(input.audit, "communications.inbound.duplicate", {
        reason: "duplicate",
        providerEventId: eventId,
      });
      return { status: 200, body: { status: "duplicate" } };
    }
  } catch (error) {
    return persistenceFailure(input.audit, eventId, error);
  }
  await record(input.audit, "communications.inbound.rejected", {
    reason,
    providerEventId: eventId,
  });
  return result(status, "rejected", reason);
}

async function persistenceFailure(audit: AuditLog, eventId: string, error: unknown) {
  console.error(
    "[communications] persist failed",
    eventId,
    error instanceof Error ? error.name : "error",
  );
  await record(audit, "communications.inbound.failed", {
    reason: "persistence_failed",
    ...(eventId ? { providerEventId: eventId } : {}),
  });
  return result(500, "failed", "persistence_failed");
}

function readNotice(payload: unknown): SignedInboundNotice | null {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
  const record = payload as Record<string, unknown>;
  if (record.type !== "email.received") return null;
  if (!record.data || typeof record.data !== "object" || Array.isArray(record.data)) return null;
  const data = record.data as Record<string, unknown>;
  if (
    typeof data.email_id !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(data.email_id)
  ) {
    return null;
  }
  const to = readStrings(data.to);
  const receivedFor = readStrings(data.received_for);
  if (!to || !receivedFor) return null;
  if (data.from !== undefined && typeof data.from !== "string") return null;
  if (data.subject !== undefined && typeof data.subject !== "string") return null;
  if (data.message_id !== undefined && data.message_id !== null && typeof data.message_id !== "string") {
    return null;
  }
  return {
    emailId: data.email_id,
    from: typeof data.from === "string" ? data.from : "",
    to,
    receivedFor,
    subject: typeof data.subject === "string" ? data.subject : "",
    messageId: typeof data.message_id === "string" ? data.message_id : "",
  };
}

function readStrings(value: unknown): string[] | null {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > MAX_RECIPIENTS) return null;
  if (!value.every((item) => typeof item === "string")) return null;
  return value;
}

function routingAddresses(notice: SignedInboundNotice): string[] | null {
  const source = notice.receivedFor.length > 0 ? notice.receivedFor : notice.to;
  if (source.length === 0 || source.length > MAX_RECIPIENTS) return null;
  const addresses: string[] = [];
  for (const value of source) {
    const address = normalizeMailboxAddress(value);
    if (!address) return null;
    if (!addresses.includes(address)) addresses.push(address);
  }
  return addresses;
}

function retrievedConfirmsMailbox(email: RetrievedInboundEmail, address: string): boolean {
  const source = email.receivedFor.length > 0 ? email.receivedFor : email.to;
  return source.some((value) => normalizeMailboxAddress(value) === address);
}

function threadKey(email: RetrievedInboundEmail): string {
  const references = header(email.headers, "references").split(/\s+/).find(Boolean) ?? "";
  const reply = header(email.headers, "in-reply-to");
  const key = references || reply || email.messageId || email.id;
  return key.trim().toLowerCase().slice(0, 500);
}

function header(headers: Record<string, string>, name: string): string {
  const found = Object.entries(headers).find(([key]) => key.toLowerCase() === name);
  return found?.[1]?.trim() ?? "";
}

function scopeMetadata(mailbox: CommunicationMailbox, eventId: string) {
  return {
    providerEventId: eventId,
    mailboxId: mailbox.id,
    workspaceId: mailbox.workspaceId,
    ventureId: mailbox.ventureId,
  };
}

async function record(audit: AuditLog, action: string, metadata: Record<string, string>) {
  await audit.record({
    action,
    actor: {
      kind: "system",
      component: "communications.inbound",
      ...(metadata.workspaceId
        ? { workspaceId: metadata.workspaceId as WorkspaceId }
        : {}),
    },
    metadata: {
      ...metadata,
      ...(metadata.ventureId ? { ventureId: metadata.ventureId as VentureId } : {}),
    },
  });
}

function result(
  status: number,
  outcome: InboundWebhookResult["body"]["status"],
  code: string,
): InboundWebhookResult {
  return { status, body: { status: outcome, code } };
}
