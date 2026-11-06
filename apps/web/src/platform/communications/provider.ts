/** Provider-neutral inbound email contract. Adapters retrieve content; they do not decide venture scope. */

export type WebhookHeaders = {
  id: string | null;
  timestamp: string | null;
  signature: string | null;
};

export type InboundAttachment = {
  id: string;
  filename: string;
  contentType: string;
  contentDisposition: string | null;
  size: number | null;
};

export type InboundAuthentication = {
  spf: string;
  dkim: string;
  dmarc: string;
};

/** Retrieved message. Attachment bytes and raw download URLs are intentionally absent. */
export type RetrievedInboundEmail = {
  id: string;
  messageId: string;
  from: string;
  to: string[];
  cc: string[];
  receivedFor: string[];
  subject: string;
  text: string | null;
  html: string | null;
  headers: Record<string, string>;
  attachments: InboundAttachment[];
  authentication: InboundAuthentication | null;
};

export type SignedInboundNotice = {
  emailId: string;
  from: string;
  to: string[];
  receivedFor: string[];
  subject: string;
  messageId: string;
};

export type EmailProvider = {
  readonly id: "resend";
  verifyWebhook(input: {
    rawBody: string;
    headers: WebhookHeaders;
    secret: string;
    now?: Date;
  }): unknown;
  retrieveInbound(emailId: string): Promise<RetrievedInboundEmail>;
};

export class ProviderRetrievalError extends Error {
  readonly code = "provider_retrieval_failed";

  constructor(reason: string) {
    super(reason);
    this.name = "ProviderRetrievalError";
  }
}
