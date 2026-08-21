import assert from "node:assert/strict";
import { after, beforeEach, describe, it } from "node:test";
import { getPlatform } from "../../platform/kernel";
import { ensureSchema } from "../../platform/persistence/db";
import {
  getPersistence,
  resetPersistenceLifecycle,
} from "../../platform/persistence/repositories/sqlite";
import { takeAuthMailOutbox } from "./mail";
import {
  authenticateUser,
  completeGoogleSignIn,
  linkGoogleAfterPassword,
  registerUser,
  requestPasswordReset,
  resetPasswordWithToken,
} from "./service";

describe("password reset and Google linking", () => {
  after(() => {
    getPlatform().scheduler.stopAll();
  });

  beforeEach(async () => {
    await resetPersistenceLifecycle(":memory:");
    await ensureSchema();
    takeAuthMailOutbox();
  });

  it("emails a reset link and accepts a new password", async () => {
    const user = await registerUser({
      email: "reset@ventureos.test",
      password: "old-password",
      name: "Reset",
    });

    await requestPasswordReset({
      email: user.email,
      origin: "http://localhost:3000",
    });
    const [mail] = takeAuthMailOutbox();
    assert.ok(mail);
    const token = mail.text.match(/token=([^&\s]+)/)?.[1];
    assert.ok(token);

    await resetPasswordWithToken({ token, password: "new-password" });
    const signedIn = await authenticateUser({
      email: user.email,
      password: "new-password",
    });
    assert.equal(signedIn.id, user.id);

    await assert.rejects(
      () => authenticateUser({ email: user.email, password: "old-password" }),
      /Invalid email or password/,
    );
  });

  it("does not reveal whether an email exists", async () => {
    await requestPasswordReset({
      email: "missing@ventureos.test",
      origin: "http://localhost:3000",
    });
    assert.equal(takeAuthMailOutbox().length, 0);
  });

  it("rejects a spent reset token", async () => {
    await registerUser({
      email: "once@ventureos.test",
      password: "old-password",
      name: "Once",
    });
    await requestPasswordReset({
      email: "once@ventureos.test",
      origin: "http://localhost:3000",
    });
    const token = takeAuthMailOutbox()[0]?.text.match(/token=([^&\s]+)/)?.[1];
    assert.ok(token);
    await resetPasswordWithToken({ token, password: "new-password" });
    await assert.rejects(
      () => resetPasswordWithToken({ token, password: "newer-password" }),
      /invalid or has expired/,
    );
  });

  it("creates a desk for a new verified Google profile", async () => {
    const result = await completeGoogleSignIn({
      subject: "google-sub-1",
      email: "maya@gmail.com",
      emailVerified: true,
      name: "Maya Chen",
    });
    assert.equal(result.status, "signed-in");
    if (result.status !== "signed-in") {
      return;
    }
    const identities = await getPersistence().identities.listForUser(result.user.id);
    assert.equal(identities.some((item) => item.provider === "google"), true);
  });

  it("asks a password account to sign in before linking Google", async () => {
    await registerUser({
      email: "link@ventureos.test",
      password: "desk-password",
      name: "Link",
    });
    const result = await completeGoogleSignIn({
      subject: "google-sub-2",
      email: "link@ventureos.test",
      emailVerified: true,
      name: "Link",
    });
    assert.equal(result.status, "link-after-password");
  });

  it("signs in an already linked Google subject", async () => {
    const created = await completeGoogleSignIn({
      subject: "google-sub-3",
      email: "repeat@gmail.com",
      emailVerified: true,
      name: "Repeat",
    });
    assert.equal(created.status, "signed-in");
    const again = await completeGoogleSignIn({
      subject: "google-sub-3",
      email: "repeat@gmail.com",
      emailVerified: true,
      name: "Repeat",
    });
    assert.equal(again.status, "signed-in");
    if (created.status === "signed-in" && again.status === "signed-in") {
      assert.equal(again.user.id, created.user.id);
    }
  });

  it("rejects an unverified Google email", async () => {
    await assert.rejects(
      () =>
        completeGoogleSignIn({
          subject: "google-sub-4",
          email: "unverified@gmail.com",
          emailVerified: false,
          name: "Nope",
        }),
      /did not verify/,
    );
  });

  it("links Google after a matching password sign-in", async () => {
    const user = await registerUser({
      email: "connect@ventureos.test",
      password: "desk-password",
      name: "Connect",
    });
    await linkGoogleAfterPassword({
      userId: user.id,
      email: user.email,
      subject: "google-sub-5",
    });
    const identities = await getPersistence().identities.listForUser(user.id);
    assert.equal(
      identities.some((item) => item.provider === "google" && item.providerSubject === "google-sub-5"),
      true,
    );
  });
});
