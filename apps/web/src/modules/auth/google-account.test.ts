import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { decideGoogleSignIn } from "./google-account";

describe("decideGoogleSignIn", () => {
  it("rejects an unverified Google email", () => {
    assert.deepEqual(
      decideGoogleSignIn({
        emailVerified: false,
        googleSubjectOwnerId: null,
        emailOwner: null,
      }),
      { action: "reject", reason: "unverified-email" },
    );
  });

  it("signs in when the Google subject is already linked", () => {
    assert.deepEqual(
      decideGoogleSignIn({
        emailVerified: true,
        googleSubjectOwnerId: "user-1",
        emailOwner: { id: "user-1", hasPasswordIdentity: true },
      }),
      { action: "sign-in", userId: "user-1" },
    );
  });

  it("creates a desk when the email is new", () => {
    assert.deepEqual(
      decideGoogleSignIn({
        emailVerified: true,
        googleSubjectOwnerId: null,
        emailOwner: null,
      }),
      { action: "create" },
    );
  });

  it("requires a password sign-in before linking an existing password account", () => {
    assert.deepEqual(
      decideGoogleSignIn({
        emailVerified: true,
        googleSubjectOwnerId: null,
        emailOwner: { id: "user-2", hasPasswordIdentity: true },
      }),
      { action: "link-after-password", userId: "user-2" },
    );
  });

  it("rejects an email already used by a Google-only desk", () => {
    assert.deepEqual(
      decideGoogleSignIn({
        emailVerified: true,
        googleSubjectOwnerId: null,
        emailOwner: { id: "user-3", hasPasswordIdentity: false },
      }),
      { action: "reject", reason: "email-in-use" },
    );
  });
});
