import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  createPasswordResetToken,
  hashPasswordResetToken,
  isPasswordResetLive,
  passwordResetExpiry,
} from "./password-reset";

describe("password reset tokens", () => {
  it("hashes the raw token", () => {
    const token = createPasswordResetToken();
    assert.equal(token.length > 20, true);
    assert.notEqual(hashPasswordResetToken(token), token);
    assert.equal(hashPasswordResetToken(token), hashPasswordResetToken(token));
  });

  it("expires and rejects used tokens", () => {
    const later = "2026-08-20T13:00:00.000Z";
    assert.equal(
      isPasswordResetLive("2026-08-20T12:00:00.000Z", null, later),
      false,
    );
    assert.equal(
      isPasswordResetLive("2026-08-20T14:00:00.000Z", "2026-08-20T13:00:00.000Z", later),
      false,
    );
    assert.equal(
      isPasswordResetLive("2026-08-20T14:00:00.000Z", null, later),
      true,
    );
  });

  it("issues a one-hour expiry", () => {
    const now = Date.parse("2026-08-20T12:00:00.000Z");
    assert.equal(passwordResetExpiry(now), "2026-08-20T13:00:00.000Z");
  });
});
