import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { FrigoraError } from "./errors";
import { mailPayloadFingerprint } from "./mail";

/** Server-only configuration. Production must supply this through managed secret storage.

The encryption service depends on this key-provider boundary, not on a cloud vendor.
Local development and tests use FRIGORA_DELIVERY_PAYLOAD_KEYS:
{ "current": "<id>", "keys": { "<id>": "<standard-base64 32-byte key>" } }.
Unset configuration lets the office application boot. A delivery operation fails closed
until a valid ring is present. Production hosting is not selected here, so there is no
cloud adapter: missing or invalid production configuration must keep delivery fail-closed.
Do not persist key material in SQLite or Git, and do not log it.

Once any enc:v1 envelope exists, the previous plaintext-only build must not run against
that database. A restored pre-encryption database backup brings plaintext payloads back.
Rollback is a forward build that can read enc:v1, not the old code.
*/
export const FRIGORA_DELIVERY_PAYLOAD_KEYS = "FRIGORA_DELIVERY_PAYLOAD_KEYS";

const AAD_PREFIX = "frigora-quotation-customer-delivery";
const KEY_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;
const VERSION_PREFIX = /^enc:v(\d+):([\s\S]*)$/;

export type DeliveryPayloadKeyRing = {
  currentId: string;
  keys: Readonly<Record<string, Buffer>>;
};

export type DeliveryPayloadFailureMarker =
  | "malformed_envelope"
  | "authentication_failed"
  | "fingerprint_mismatch";

export type DeliveryPayloadClassification =
  | { kind: "empty" }
  | { kind: "readable"; plaintext: string; encoding: "legacy" | "encrypted"; keyId: string | null }
  | { kind: "key_unavailable"; keyId: string }
  | { kind: "unsupported_version" }
  | { kind: "malformed_envelope" }
  | { kind: "authentication_failed"; keyId: string }
  | { kind: "fingerprint_mismatch" };

export function deliveryPayloadAuditId(
  event: "unavailable" | "restored" | "reverified",
  deliveryId: string,
  keyId: string,
) {
  return createHash("sha256")
    .update(`frigora-quotation-delivery-payload-audit/v1\0${event}\0${deliveryId}\0${keyId}`, "utf8")
    .digest("hex");
}

export function parseDeliveryPayloadKeyRing(raw: string): DeliveryPayloadKeyRing {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new FrigoraError("customer_delivery_unavailable", "Delivery payload keys are not valid. The provider was not called.");
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new FrigoraError("customer_delivery_unavailable", "Delivery payload keys are not valid. The provider was not called.");
  }
  const record = parsed as { current?: unknown; keys?: unknown };
  if (typeof record.current !== "string" || !KEY_ID_PATTERN.test(record.current)) {
    throw new FrigoraError("customer_delivery_unavailable", "Delivery payload keys are not valid. The provider was not called.");
  }
  if (!record.keys || typeof record.keys !== "object" || Array.isArray(record.keys)) {
    throw new FrigoraError("customer_delivery_unavailable", "Delivery payload keys are not valid. The provider was not called.");
  }
  const keys: Record<string, Buffer> = {};
  for (const [id, material] of Object.entries(record.keys)) {
    if (!KEY_ID_PATTERN.test(id) || typeof material !== "string") {
      throw new FrigoraError("customer_delivery_unavailable", "Delivery payload keys are not valid. The provider was not called.");
    }
    const decoded = decodeStandardBase64(material);
    if (!decoded || decoded.length !== 32) {
      throw new FrigoraError("customer_delivery_unavailable", "Delivery payload keys are not valid. The provider was not called.");
    }
    keys[id] = decoded;
  }
  if (!keys[record.current]) {
    throw new FrigoraError("customer_delivery_unavailable", "Delivery payload keys are not valid. The provider was not called.");
  }
  return { currentId: record.current, keys };
}

/** Unset configuration is absent. A present but invalid value fails closed. */
export function deliveryPayloadKeyRingFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): DeliveryPayloadKeyRing | null {
  const raw = env[FRIGORA_DELIVERY_PAYLOAD_KEYS];
  if (raw == null || raw.trim() === "") return null;
  return parseDeliveryPayloadKeyRing(raw);
}

export function requireDeliveryPayloadKeyRing(
  env: NodeJS.ProcessEnv = process.env,
): DeliveryPayloadKeyRing {
  const ring = deliveryPayloadKeyRingFromEnv(env);
  if (!ring) {
    throw new FrigoraError(
      "customer_delivery_unavailable",
      "Delivery payload keys are not configured. The provider was not called.",
    );
  }
  return ring;
}

export function encryptDeliveryPayload(input: {
  ring: DeliveryPayloadKeyRing;
  deliveryId: string;
  fingerprint: string;
  plaintext: string;
}) {
  const key = input.ring.keys[input.ring.currentId];
  if (!key || key.length !== 32) {
    throw new FrigoraError("customer_delivery_unavailable", "Delivery payload keys are not valid. The provider was not called.");
  }
  const nonce = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, nonce);
  cipher.setAAD(deliveryPayloadAad(input.deliveryId, input.fingerprint));
  const ciphertext = Buffer.concat([cipher.update(input.plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  if (ciphertext.length < 1 || tag.length !== 16) {
    throw new FrigoraError("customer_delivery_unavailable", "Delivery payload could not be protected. The provider was not called.");
  }
  return `enc:v1:${input.ring.currentId}.${encodeBase64Url(nonce)}.${encodeBase64Url(Buffer.concat([ciphertext, tag]))}`;
}

export function classifyDeliveryPayload(input: {
  stored: string | null;
  deliveryId: string;
  fingerprint: string;
  ring: DeliveryPayloadKeyRing | null;
}): DeliveryPayloadClassification {
  if (input.stored == null || input.stored.length === 0) return { kind: "empty" };
  if (input.stored.startsWith("{")) {
    return classifyLegacy(input.stored, input.fingerprint);
  }
  const structure = parseEnvelope(input.stored);
  if (structure.kind === "malformed_envelope" || structure.kind === "unsupported_version") return structure;
  if (!input.ring || !input.ring.keys[structure.keyId]) {
    return { kind: "key_unavailable", keyId: structure.keyId };
  }
  const key = input.ring.keys[structure.keyId];
  if (!key || key.length !== 32) return { kind: "authentication_failed", keyId: structure.keyId };
  try {
    const decipher = createDecipheriv("aes-256-gcm", key, structure.nonce);
    decipher.setAAD(deliveryPayloadAad(input.deliveryId, input.fingerprint));
    decipher.setAuthTag(structure.tag);
    const plaintext = Buffer.concat([decipher.update(structure.ciphertext), decipher.final()]).toString("utf8");
    if (!plaintextFingerprintMatches(plaintext, input.fingerprint)) return { kind: "fingerprint_mismatch" };
    return { kind: "readable", plaintext, encoding: "encrypted", keyId: structure.keyId };
  } catch {
    return { kind: "authentication_failed", keyId: structure.keyId };
  }
}

export function installQuotationDeliveryPayloadTestKeys(env: NodeJS.ProcessEnv = process.env) {
  env.FRIGORA_DELIVERY_PAYLOAD_KEYS = JSON.stringify({
    current: "test-key",
    keys: { "test-key": Buffer.alloc(32, 11).toString("base64") },
  });
}

export function plaintextFromStoredDeliveryPayload(
  stored: string,
  deliveryId: string,
  fingerprint: string,
  env: NodeJS.ProcessEnv = process.env,
) {
  const classified = classifyDeliveryPayload({
    stored,
    deliveryId,
    fingerprint,
    ring: deliveryPayloadKeyRingFromEnv(env),
  });
  if (classified.kind !== "readable") {
    throw new FrigoraError("customer_delivery_unavailable", "Stored delivery payload cannot be read.");
  }
  return classified.plaintext;
}

function classifyLegacy(stored: string, fingerprint: string): DeliveryPayloadClassification {
  if (!plaintextFingerprintMatches(stored, fingerprint)) return { kind: "fingerprint_mismatch" };
  return { kind: "readable", plaintext: stored, encoding: "legacy", keyId: null };
}

function plaintextFingerprintMatches(plaintext: string, fingerprint: string) {
  try {
    const parsed = JSON.parse(plaintext) as { from?: unknown; to?: unknown; subject?: unknown; text?: unknown };
    if (typeof parsed.from !== "string" || typeof parsed.to !== "string" || typeof parsed.subject !== "string" || typeof parsed.text !== "string") {
      return false;
    }
    return mailPayloadFingerprint({
      from: parsed.from,
      to: parsed.to,
      subject: parsed.subject,
      text: parsed.text,
    }) === fingerprint;
  } catch {
    return false;
  }
}

type ParsedV1 = {
  kind: "v1";
  keyId: string;
  nonce: Buffer;
  ciphertext: Buffer;
  tag: Buffer;
};

function parseEnvelope(stored: string): ParsedV1 | { kind: "malformed_envelope" } | { kind: "unsupported_version" } {
  if (!stored.startsWith("enc:")) return { kind: "malformed_envelope" };
  const versionMatch = VERSION_PREFIX.exec(stored);
  if (!versionMatch) return { kind: "malformed_envelope" };
  const version = versionMatch[1];
  const rest = versionMatch[2] ?? "";
  const fields = rest.split(".");
  if (fields.length !== 3 || fields.some((field) => field.length === 0)) return { kind: "malformed_envelope" };
  const [keyId, nonceText, bodyText] = fields;
  if (!keyId || !nonceText || !bodyText || !KEY_ID_PATTERN.test(keyId)) return { kind: "malformed_envelope" };
  const nonce = decodeCanonicalBase64Url(nonceText);
  const body = decodeCanonicalBase64Url(bodyText);
  if (!nonce || nonce.length !== 12 || !body || body.length < 17) return { kind: "malformed_envelope" };
  if (version !== "1") return { kind: "unsupported_version" };
  return {
    kind: "v1",
    keyId,
    nonce,
    ciphertext: body.subarray(0, body.length - 16),
    tag: body.subarray(body.length - 16),
  };
}

function deliveryPayloadAad(deliveryId: string, fingerprint: string) {
  return Buffer.from(`${AAD_PREFIX}\0${deliveryId}\0${fingerprint}`, "utf8");
}

function encodeBase64Url(value: Buffer) {
  return value.toString("base64url");
}

function decodeCanonicalBase64Url(value: string) {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) return null;
  const decoded = Buffer.from(value, "base64url");
  if (decoded.length === 0 || decoded.toString("base64url") !== value) return null;
  return decoded;
}

function decodeStandardBase64(value: string) {
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(value) || value.length % 4 !== 0) return null;
  const decoded = Buffer.from(value, "base64");
  if (decoded.toString("base64") !== value) return null;
  return decoded;
}
