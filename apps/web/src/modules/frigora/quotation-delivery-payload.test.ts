import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { describe, it } from "node:test";
import {
  classifyDeliveryPayload,
  deliveryPayloadAuditId,
  encryptDeliveryPayload,
  parseDeliveryPayloadKeyRing,
  type DeliveryPayloadKeyRing,
} from "./quotation-delivery-payload";
import { mailPayloadFingerprint } from "./mail";

const deliveryId = "delivery-1";
const otherId = "delivery-2";
const plaintext = JSON.stringify({
  from: "Quotes <quotes@quotes.example>",
  to: "ada@fuelco.test",
  subject: "Quotation awaiting your decision",
  text: "Open the link.",
});
const fingerprint = mailPayloadFingerprint(JSON.parse(plaintext));

function ring(extra?: Record<string, Buffer>): DeliveryPayloadKeyRing {
  return {
    currentId: "k1",
    keys: {
      k1: Buffer.alloc(32, 4),
      ...extra,
    },
  };
}

function encoded(value: Buffer) {
  return value.toString("base64url");
}

function envelope(keyId: string, nonce: Buffer, body: Buffer, version = "v1") {
  return `enc:${version}:${keyId}.${encoded(nonce)}.${encoded(body)}`;
}

describe("quotation delivery payload envelope", () => {
  it("round-trips AES-256-GCM and uses a fresh nonce", () => {
    const keys = ring();
    const first = encryptDeliveryPayload({ ring: keys, deliveryId, fingerprint, plaintext });
    const second = encryptDeliveryPayload({ ring: keys, deliveryId, fingerprint, plaintext });
    assert.notEqual(first.split(".")[0], "");
    assert.notEqual(first, second);
    assert.equal(first.split(".")[1] === second.split(".")[1], false);
    const read = classifyDeliveryPayload({ stored: first, deliveryId, fingerprint, ring: keys });
    assert.equal(read.kind, "readable");
    if (read.kind === "readable") assert.equal(read.plaintext, plaintext);
  });

  it("binds the delivery id and fingerprint as additional data", () => {
    const keys = ring();
    const stored = encryptDeliveryPayload({ ring: keys, deliveryId, fingerprint, plaintext });
    assert.equal(classifyDeliveryPayload({ stored, deliveryId: otherId, fingerprint, ring: keys }).kind, "authentication_failed");
    assert.equal(classifyDeliveryPayload({
      stored,
      deliveryId,
      fingerprint: "f".repeat(64),
      ring: keys,
    }).kind, "authentication_failed");
  });

  it("does not look up a key or run GCM for an unavailable id", () => {
    const keys = ring();
    const stored = envelope("missing", randomBytes(12), Buffer.concat([Buffer.from("x"), randomBytes(16)]));
    assert.equal(classifyDeliveryPayload({ stored, deliveryId, fingerprint, ring: keys }).kind, "key_unavailable");
    assert.equal(classifyDeliveryPayload({ stored, deliveryId, fingerprint, ring: null }).kind, "key_unavailable");
  });

  it("distinguishes an unsupported version from a malformed envelope", () => {
    const nonce = randomBytes(12);
    const body = Buffer.concat([Buffer.from("x"), randomBytes(16)]);
    assert.equal(classifyDeliveryPayload({
      stored: "enc:v2:",
      deliveryId,
      fingerprint,
      ring: ring(),
    }).kind, "malformed_envelope");
    assert.equal(classifyDeliveryPayload({
      stored: envelope("k1", nonce, body, "v2"),
      deliveryId,
      fingerprint,
      ring: ring(),
    }).kind, "unsupported_version");
    assert.equal(classifyDeliveryPayload({
      stored: "enc:v2:bad id.xxxx.yyyy",
      deliveryId,
      fingerprint,
      ring: ring(),
    }).kind, "malformed_envelope");
  });

  it("rejects illegal structure before treating the value as a missing key", () => {
    const keys = ring();
    const samples = [
      "not-an-envelope",
      "enc:v1",
      "enc:foo:k1.aa.bb",
      "enc:v1:bad id." + encoded(randomBytes(12)) + "." + encoded(Buffer.concat([Buffer.from("x"), randomBytes(16)])),
      `enc:v1:k1.${encoded(randomBytes(12))}.${encoded(Buffer.concat([Buffer.from("x"), randomBytes(16)]))}.extra`,
      "enc:v1:.nonce.body",
      "enc:v1:k1..body",
      `enc:v1:k1.${encoded(randomBytes(11))}.${encoded(Buffer.concat([Buffer.from("x"), randomBytes(16)]))}`,
      `enc:v1:k1.${encoded(randomBytes(12))}.++++`,
      `enc:v1:k1.${encoded(randomBytes(12))}.=${encoded(Buffer.concat([Buffer.from("x"), randomBytes(16)]))}`,
      `enc:v1:k1.${encoded(randomBytes(12))}.${encoded(randomBytes(16))}`,
      `enc:v1:k1.${encoded(randomBytes(12))}.${encoded(Buffer.concat([Buffer.alloc(0), randomBytes(16)]))}`,
    ];
    for (const stored of samples) {
      assert.equal(classifyDeliveryPayload({ stored, deliveryId, fingerprint, ring: keys }).kind, "malformed_envelope", stored);
    }
  });

  it("rejects non-canonical base64url", () => {
    const body = Buffer.concat([Buffer.from("x"), randomBytes(16)]);
    const canonical = encoded(body);
    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
    const noisy = alphabet
      .split("")
      .map((character) => canonical.slice(0, -1) + character)
      .find((candidate) => candidate !== canonical && Buffer.from(candidate, "base64url").toString("base64url") !== candidate);
    assert.ok(noisy);
    const stored = `enc:v1:k1.${encoded(randomBytes(12))}.${noisy}`;
    assert.equal(classifyDeliveryPayload({ stored, deliveryId, fingerprint, ring: ring() }).kind, "malformed_envelope");
  });

  it("reports an invalid tag as authentication_failed and a decrypted fingerprint miss as fingerprint_mismatch", () => {
    const keys = ring();
    const stored = encryptDeliveryPayload({ ring: keys, deliveryId, fingerprint, plaintext });
    const [head, nonce, body] = stored.split(".");
    assert.ok(head && nonce && body);
    const decoded = Buffer.from(body, "base64url");
    decoded[decoded.length - 1] = decoded[decoded.length - 1] === 0 ? 1 : 0;
    const tampered = `${head}.${nonce}.${decoded.toString("base64url")}`;
    assert.equal(classifyDeliveryPayload({ stored: tampered, deliveryId, fingerprint, ring: keys }).kind, "authentication_failed");
    const otherPlain = JSON.stringify({ from: "A <a@quotes.example>", to: "b@fuelco.test", subject: "Other", text: "Other" });
    const mismatching = encryptDeliveryPayload({ ring: keys, deliveryId, fingerprint, plaintext: otherPlain });
    assert.equal(classifyDeliveryPayload({ stored: mismatching, deliveryId, fingerprint, ring: keys }).kind, "fingerprint_mismatch");
  });

  it("keeps legacy plaintext on the fingerprint path", () => {
    const read = classifyDeliveryPayload({ stored: plaintext, deliveryId, fingerprint, ring: null });
    assert.equal(read.kind, "readable");
    const changed = JSON.stringify({ from: "other", to: "other@fuelco.test", subject: "Changed", text: "Changed" });
    assert.equal(classifyDeliveryPayload({ stored: changed, deliveryId, fingerprint, ring: ring() }).kind, "fingerprint_mismatch");
  });

  it("derives distinct stable audit ids without using the raw key id as a delimiter", () => {
    const unavailable = deliveryPayloadAuditId("unavailable", deliveryId, "k1");
    const restored = deliveryPayloadAuditId("restored", deliveryId, "k1");
    assert.equal(unavailable, deliveryPayloadAuditId("unavailable", deliveryId, "k1"));
    assert.notEqual(unavailable, restored);
    assert.equal(unavailable.includes("k1"), false);
  });

  it("rejects a key ring whose current id or material is invalid", () => {
    const material = Buffer.alloc(32, 9).toString("base64");
    assert.equal(parseDeliveryPayloadKeyRing(JSON.stringify({ current: "k1", keys: { k1: material } })).currentId, "k1");
    assert.throws(() => parseDeliveryPayloadKeyRing(JSON.stringify({ current: "missing", keys: { k1: material } })));
    assert.throws(() => parseDeliveryPayloadKeyRing(JSON.stringify({ current: "k1", keys: { k1: Buffer.alloc(16).toString("base64") } })));
    assert.throws(() => parseDeliveryPayloadKeyRing("{"));
  });

  it("does not authenticate a tag with a substituted key", () => {
    const stored = encryptDeliveryPayload({ ring: ring(), deliveryId, fingerprint, plaintext });
    const substituted: DeliveryPayloadKeyRing = { currentId: "k1", keys: { k1: Buffer.alloc(32, 5) } };
    assert.equal(classifyDeliveryPayload({ stored, deliveryId, fingerprint, ring: substituted }).kind, "authentication_failed");
  });
});
