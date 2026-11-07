import { createHmac, timingSafeEqual } from "node:crypto";
import type { WebhookHeaders } from "./provider";

const TOLERANCE_SECONDS = 5 * 60;
const MAX_EVENT_ID_LENGTH = 128;

export class WebhookSignatureError extends Error {
  readonly code = "invalid_signature";

  constructor() {
    super("invalid_signature");
    this.name = "WebhookSignatureError";
  }
}

export class MalformedWebhookError extends Error {
  readonly code = "malformed_payload";

  constructor() {
    super("malformed_payload");
    this.name = "MalformedWebhookError";
  }
}

/**
 * Svix verification used by Resend: HMAC-SHA256 over id, timestamp, and the
 * original request bytes. The prefix is ASCII. The body is not decoded first.
 */
export function verifyResendWebhook(input: {
  rawBody: Uint8Array;
  headers: WebhookHeaders;
  secret: string;
  now?: Date;
}): unknown {
  const secret = input.secret.trim();
  const id = input.headers.id?.trim() ?? "";
  const timestamp = input.headers.timestamp?.trim() ?? "";
  const signature = input.headers.signature?.trim() ?? "";
  if (!secret || !isEventId(id) || !/^[0-9]{1,20}$/.test(timestamp) || !signature) {
    throw new WebhookSignatureError();
  }

  const nowSeconds = Math.floor((input.now ?? new Date()).getTime() / 1000);
  const stamped = Number(timestamp);
  if (!Number.isFinite(stamped) || Math.abs(nowSeconds - stamped) > TOLERANCE_SECONDS) {
    throw new WebhookSignatureError();
  }

  const key = decodeSecret(secret);
  if (!key) throw new WebhookSignatureError();

  const expected = createHmac("sha256", key)
    .update(`${id}.${timestamp}.`, "utf8")
    .update(input.rawBody)
    .digest();
  const presented = signature
    .split(" ")
    .map((part) => (part.startsWith("v1,") ? part.slice(3) : ""))
    .filter((part) => part.length > 0);
  const matches = presented.some((candidate) => signaturesMatch(candidate, expected));
  if (!matches) throw new WebhookSignatureError();

  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(input.rawBody);
  } catch {
    throw new MalformedWebhookError();
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new MalformedWebhookError();
  }
}

export function isEventId(value: string): boolean {
  return /^[A-Za-z0-9_-]{1,128}$/.test(value) && value.length <= MAX_EVENT_ID_LENGTH;
}

function decodeSecret(secret: string): Buffer | null {
  const encoded = secret.startsWith("whsec_") ? secret.slice("whsec_".length) : secret;
  if (!encoded) return null;
  const bytes = Buffer.from(encoded, "base64");
  if (bytes.length < 16) return null;
  return bytes;
}

function signaturesMatch(candidate: string, expected: Buffer): boolean {
  const received = Buffer.from(candidate, "base64");
  if (received.length !== expected.length) return false;
  return timingSafeEqual(received, expected);
}
