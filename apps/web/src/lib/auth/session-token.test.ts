import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { SignJWT } from "jose";
import type { UserId } from "../../contracts";
import {
  authSecretKey,
  isPersistedSessionLive,
  resolveSessionUser,
} from "./session-token";

const NOW = "2026-08-19T12:00:00.000Z";
const LATER = "2026-09-01T12:00:00.000Z";
const PAST = "2026-01-01T12:00:00.000Z";

const user = {
  id: "user-1" as UserId,
  email: "sonny@ventureos.test",
  name: "Sonny",
};

async function token(sessionId?: string) {
  const jwt = new SignJWT({
    email: user.email,
    name: user.name,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime("14d");

  if (sessionId) {
    jwt.setJti(sessionId);
  }

  return jwt.sign(authSecretKey());
}

describe("session validation", () => {
  it("rejects a JWT when the persisted session is missing", async () => {
    const resolved = await resolveSessionUser(
      await token("sess-1"),
      async () => null,
      NOW,
    );
    assert.equal(resolved, null);
  });

  it("rejects a JWT when the persisted session is expired", async () => {
    const resolved = await resolveSessionUser(
      await token("sess-1"),
      async () => ({
        id: "sess-1",
        userId: user.id,
        expiresAt: PAST,
      }),
      NOW,
    );
    assert.equal(resolved, null);
    assert.equal(
      isPersistedSessionLive(
        { id: "sess-1", userId: user.id, expiresAt: PAST },
        NOW,
      ),
      false,
    );
  });

  it("rejects a JWT without a session id", async () => {
    const resolved = await resolveSessionUser(
      await token(),
      async () => ({
        id: "sess-1",
        userId: user.id,
        expiresAt: LATER,
      }),
      NOW,
    );
    assert.equal(resolved, null);
  });

  it("accepts a JWT with a live persisted session for the same user", async () => {
    const resolved = await resolveSessionUser(
      await token("sess-1"),
      async () => ({
        id: "sess-1",
        userId: user.id,
        expiresAt: LATER,
      }),
      NOW,
    );
    assert.equal(resolved?.id, user.id);
    assert.equal(resolved?.sessionId, "sess-1");
  });
});
