import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { after, beforeEach, describe, it } from "node:test";
import type { Role, UserId, WorkspaceId } from "../../contracts";
import { getPlatform } from "../../platform/kernel";
import { createId } from "../../platform/ids";
import { ensureSchema, getClient } from "../../platform/persistence/db";
import {
  getPersistence,
  resetPersistenceLifecycle,
} from "../../platform/persistence/repositories/sqlite";
import { INITIAL_PUBLIC_ORIGIN } from "../../platform/runtime/production-process-contract";
import { signupAction } from "./actions";
import { takeAuthMailOutbox } from "./mail";
import { loginMessages } from "./messages";
import {
  REGISTRATION_INVITATION_MESSAGE,
  REGISTRATION_POLICY_ENV,
  RegistrationPolicyError,
  googleRegistrationErrorCode,
  resolveRegistrationMode,
} from "./registration-policy";
import {
  authenticateUser,
  completeGoogleSignIn,
  issueSession,
  linkGoogleAfterPassword,
  registerInvitedUser,
  registerUser,
  requestPasswordReset,
  resetPasswordWithToken,
} from "./service";
import { invitationTokenFromNext } from "../workspaces/invitation-token";
import {
  inviteWorkspaceMember,
  removeWorkspaceMember,
  revokeWorkspaceInvitation,
} from "../workspaces/access";
import { canAccessWorkspace, listWorkspaces } from "../workspaces/service";

const NOW = "2026-11-23T12:00:00.000Z";

describe("registration policy", () => {
  after(() => {
    delete process.env[REGISTRATION_POLICY_ENV];
    getPlatform().scheduler.stopAll();
  });

  beforeEach(async () => {
    delete process.env[REGISTRATION_POLICY_ENV];
    await resetPersistenceLifecycle(":memory:");
    await ensureSchema();
    takeAuthMailOutbox();
  });

  it("fails closed for the Frigora production contract", () => {
    assert.equal(
      resolveRegistrationMode({ NODE_ENV: "production", AUTH_URL: INITIAL_PUBLIC_ORIGIN }),
      "invitation-only",
    );
    assert.equal(
      resolveRegistrationMode({
        NODE_ENV: "production",
        AUTH_URL: INITIAL_PUBLIC_ORIGIN,
        [REGISTRATION_POLICY_ENV]: "open",
      }),
      "invitation-only",
    );
    assert.equal(resolveRegistrationMode({ NODE_ENV: "production" }), "invitation-only");
    assert.equal(
      resolveRegistrationMode({
        NODE_ENV: "production",
        AUTH_URL: "not a url",
        [REGISTRATION_POLICY_ENV]: "open",
      }),
      "invitation-only",
    );
    assert.equal(
      resolveRegistrationMode({
        NODE_ENV: "production",
        AUTH_URL: "https://attacker.example",
        HOST: "localhost",
        "X-Forwarded-Host": "localhost",
        [REGISTRATION_POLICY_ENV]: "open",
      }),
      "invitation-only",
    );
  });

  it("keeps open registration only for an explicitly open non-production process", () => {
    assert.equal(resolveRegistrationMode({ NODE_ENV: "test" }), "open");
    assert.equal(
      resolveRegistrationMode({
        NODE_ENV: "development",
        AUTH_URL: INITIAL_PUBLIC_ORIGIN,
        HOST: "frigora.ventureoperatingsystem.co.za",
        [REGISTRATION_POLICY_ENV]: "open",
      }),
      "open",
    );
    assert.equal(
      resolveRegistrationMode({ NODE_ENV: "test", [REGISTRATION_POLICY_ENV]: "invitation-only" }),
      "invitation-only",
    );
    assert.equal(
      resolveRegistrationMode({ NODE_ENV: "test", [REGISTRATION_POLICY_ENV]: "yes" }),
      "invitation-only",
    );
  });

  it("maps a rejected Google registration to a non-sensitive message", () => {
    const code = googleRegistrationErrorCode(new RegistrationPolicyError());
    assert.equal(code, "google_invitation");
    assert.equal(loginMessages.google_invitation, REGISTRATION_INVITATION_MESSAGE);
    assert.equal(googleRegistrationErrorCode(new Error("Google did not verify that email.")), null);
  });

  it("denies password signup without an invitation and leaves no records", async () => {
    const before = await counts();
    await withPolicy("invitation-only", async () => {
      await assert.rejects(
        () =>
          registerUser({
            email: "open-password@ventureos.test",
            password: "password-1",
            name: "Open Password",
          }),
        invitationRequired,
      );
    });
    await assertAbsent("open-password@ventureos.test");
    assert.deepEqual(await counts(), before);
  });

  it("denies a direct service call that asks not to create a workspace", async () => {
    await withPolicy("invitation-only", async () => {
      await assert.rejects(
        () =>
          registerUser({
            email: "direct-service@ventureos.test",
            password: "password-1",
            name: "Direct",
            createPersonalWorkspace: false,
          }),
        invitationRequired,
      );
    });
    await assertAbsent("direct-service@ventureos.test");
    assert.equal(await counts().then((rows) => rows.sessions), 0);
  });

  it("denies the signup action without trusting host, workspace, or return path fields", async () => {
    await withPolicy("invitation-only", async () => {
      const form = new FormData();
      form.set("email", "action-signup@ventureos.test");
      form.set("password", "password-1");
      form.set("name", "Action");
      form.set("next", "/dashboard");
      form.set("host", "localhost");
      form.set("workspaceId", "workspace-chosen-by-caller");
      form.set("invitationToken", "   ");
      const result = await signupAction({ error: undefined }, form);
      assert.equal(result.error, REGISTRATION_INVITATION_MESSAGE);
    });
    await assertAbsent("action-signup@ventureos.test");
    assert.equal((await counts()).sessions, 0);
  });

  it("keeps the existing signup validation in front of account creation", async () => {
    await withPolicy("invitation-only", async () => {
      const form = new FormData();
      form.set("email", "short@ventureos.test");
      form.set("password", "short");
      form.set("name", "Short");
      const result = await signupAction({ error: undefined }, form);
      assert.equal(
        result.error,
        "Enter a name, valid email, and a password of at least 8 characters.",
      );
    });
    await assertAbsent("short@ventureos.test");
  });

  it("denies Google first-time registration without an invitation and leaves no records", async () => {
    const before = await counts();
    const next = invitationTokenFromNext("/dashboard?token=ignored");
    assert.equal(next, null);
    await withPolicy("invitation-only", async () => {
      await assert.rejects(
        () =>
          completeGoogleSignIn(
            {
              subject: "google-new-1",
              email: "new-google@gmail.com",
              emailVerified: true,
              name: "New Google",
            },
            { invitationToken: next ?? "   " },
          ),
        invitationRequired,
      );
    });
    await assertAbsent("new-google@gmail.com", "google-new-1");
    assert.deepEqual(await counts(), before);
  });

  it("does not treat a continuation URL as an invitation", async () => {
    assert.equal(invitationTokenFromNext("https://attacker.example/invite?token=stolen"), null);
    assert.equal(invitationTokenFromNext("/invite/extra?token=stolen"), null);
    assert.equal(invitationTokenFromNext("/login?next=/invite?token=stolen"), null);
    const ownerId = await seedUser("owner-url@ventureos.test", "Owner");
    const workspaceId = await seedWorkspace("Customer", ownerId);
    const token = await invite(ownerId, workspaceId, "url-google@gmail.com", "member");
    const hidden = invitationTokenFromNext(`/dashboard?token=${token}`);
    assert.equal(hidden, null);
    const before = await counts();
    await withPolicy("invitation-only", async () => {
      await assert.rejects(
        () =>
          completeGoogleSignIn({
            subject: "google-url-1",
            email: "url-google@gmail.com",
            emailVerified: true,
            name: "Url",
          }),
        invitationRequired,
      );
    });
    await assertAbsent("url-google@gmail.com", "google-url-1");
    assert.deepEqual(await counts(), before);
  });

  it("registers a password account from a valid invitation and does not add a personal workspace", async () => {
    const ownerId = await seedUser("owner-password-invite@ventureos.test", "Owner");
    const workspaceId = await seedWorkspace("Customer", ownerId);
    const token = await invite(ownerId, workspaceId, "invited-password@ventureos.test", "member");
    const before = await counts();
    const joined = await withPolicy("invitation-only", () =>
      registerInvitedUser({
        email: "Invited-Password@ventureos.test",
        password: "password-1",
        name: "Invited Password",
        token,
      }),
    );
    assert.equal(joined.workspaceId, workspaceId);
    assert.equal(joined.user.email, "invited-password@ventureos.test");
    const after = await counts();
    assert.equal(after.users, before.users + 1);
    assert.equal(after.identities, before.identities + 1);
    assert.equal(after.workspaces, before.workspaces);
    assert.equal(after.sessions, before.sessions);
    assert.equal(await getPersistence().memberships.getRole(joined.user.id, workspaceId), "member");
    assert.equal((await listWorkspaces(joined.user.id)).length, 1);
    const sessionId = await issueSession(joined.user);
    assert.equal((await getPersistence().sessions.findById(sessionId))?.userId, joined.user.id);
    const signedIn = await authenticateUser({
      email: joined.user.email,
      password: "password-1",
    });
    assert.equal(signedIn.id, joined.user.id);
  });

  it("registers a Google account from a matching invitation", async () => {
    const ownerId = await seedUser("owner-google-invite@ventureos.test", "Owner");
    const workspaceId = await seedWorkspace("Customer", ownerId);
    const token = await invite(ownerId, workspaceId, "invited-google@gmail.com", "admin");
    const before = await counts();
    const result = await withPolicy("invitation-only", () =>
      completeGoogleSignIn(
        {
          subject: "google-invited-1",
          email: "invited-google@gmail.com",
          emailVerified: true,
          name: "Invited Google",
        },
        { invitationToken: invitationTokenFromNext(`/invite?token=${encodeURIComponent(token)}`) ?? "" },
      ),
    );
    assert.equal(result.status, "signed-in");
    if (result.status !== "signed-in") return;
    assert.equal(result.workspaceId, workspaceId);
    const identity = await getPersistence().identities.findByProvider("google", "google-invited-1");
    assert.equal(identity?.userId, result.user.id);
    const after = await counts();
    assert.equal(after.users, before.users + 1);
    assert.equal(after.workspaces, before.workspaces);
    assert.equal(after.sessions, before.sessions);
    assert.equal(await getPersistence().memberships.getRole(result.user.id, workspaceId), "admin");
    const repeat = await withPolicy("invitation-only", () =>
      completeGoogleSignIn(
        {
          subject: "google-invited-1",
          email: "invited-google@gmail.com",
          emailVerified: true,
          name: "Invited Google",
        },
        { invitationToken: token },
      ),
    );
    assert.equal(repeat.status, "signed-in");
    if (repeat.status === "signed-in") assert.equal(repeat.user.id, result.user.id);
    await withPolicy("invitation-only", async () => {
      await assert.rejects(
        () =>
          completeGoogleSignIn(
            {
              subject: "google-invited-2",
              email: "invited-google@gmail.com",
              emailVerified: true,
              name: "Invited Google",
            },
            { invitationToken: token },
          ),
        /already on a desk/,
      );
    });
    assert.equal(await getPersistence().identities.findByProvider("google", "google-invited-2"), null);
    assert.equal((await counts()).users, after.users);
  });

  it("denies an invitation sent to a different email", async () => {
    const ownerId = await seedUser("owner-mismatch@ventureos.test", "Owner");
    const workspaceId = await seedWorkspace("Customer", ownerId);
    const token = await invite(ownerId, workspaceId, "match@ventureos.test", "member");
    await withPolicy("invitation-only", async () => {
      await assert.rejects(
        () =>
          registerInvitedUser({
            email: "other@ventureos.test",
            password: "password-1",
            name: "Other",
            token,
          }),
        /different email/,
      );
      await assert.rejects(
        () =>
          completeGoogleSignIn(
            {
              subject: "google-mismatch-1",
              email: "other-google@gmail.com",
              emailVerified: true,
              name: "Other Google",
            },
            { invitationToken: token },
          ),
        /different email/,
      );
    });
    await assertAbsent("other@ventureos.test");
    await assertAbsent("other-google@gmail.com", "google-mismatch-1");
    const invitation = await getPersistence().invitations.findByTokenHash(await hash(token));
    assert.equal(invitation?.acceptedAt, null);
  });

  it("denies an expired, revoked, spent, or unknown invitation", async () => {
    const ownerId = await seedUser("owner-closed@ventureos.test", "Owner");
    const workspaceId = await seedWorkspace("Customer", ownerId);
    const expired = await invite(ownerId, workspaceId, "expired@ventureos.test", "member");
    await getClient().execute({
      sql: "UPDATE workspace_invitations SET expires_at = ? WHERE token_hash = ?",
      args: ["2020-01-01T00:00:00.000Z", await hash(expired)],
    });
    const revoked = await invite(ownerId, workspaceId, "revoked@ventureos.test", "member");
    const revokedRow = await getPersistence().invitations.findByTokenHash(await hash(revoked));
    assert.ok(revokedRow);
    await revokeWorkspaceInvitation({
      actorId: ownerId,
      workspaceId,
      invitationId: revokedRow.id,
    });
    const spent = await invite(ownerId, workspaceId, "spent@ventureos.test", "member");
    await withPolicy("invitation-only", async () => {
      await registerInvitedUser({
        email: "spent@ventureos.test",
        password: "password-1",
        name: "Spent",
        token: spent,
      });
      await assert.rejects(
        () =>
          registerInvitedUser({
            email: "expired@ventureos.test",
            password: "password-1",
            name: "Expired",
            token: expired,
          }),
        /expired/,
      );
      await assert.rejects(
        () =>
          registerInvitedUser({
            email: "revoked@ventureos.test",
            password: "password-1",
            name: "Revoked",
            token: revoked,
          }),
        /revoked/,
      );
      await assert.rejects(
        () =>
          registerInvitedUser({
            email: "spent@ventureos.test",
            password: "password-1",
            name: "Spent",
            token: spent,
          }),
        /already been used/,
      );
      await assert.rejects(
        () =>
          registerInvitedUser({
            email: "unknown@ventureos.test",
            password: "password-1",
            name: "Unknown",
            token: "not-a-real-invitation",
          }),
        /invalid or has expired/,
      );
      const pendingLink = await completeGoogleSignIn(
        {
          subject: "google-spent-1",
          email: "spent@ventureos.test",
          emailVerified: true,
          name: "Spent",
        },
        { invitationToken: spent },
      );
      assert.equal(pendingLink.status, "link-after-password");
    });
    await assertAbsent("expired@ventureos.test");
    await assertAbsent("revoked@ventureos.test");
    await assertAbsent("unknown@ventureos.test");
    const spentUser = await getPersistence().users.findByEmail("spent@ventureos.test");
    assert.ok(spentUser);
    assert.equal(await getPersistence().identities.findByProvider("google", "google-spent-1"), null);
    assert.equal((await listWorkspaces(spentUser.id)).length, 1);
  });

  it("lets an existing password user sign in and reset under the restricted policy", async () => {
    const user = await registerUser({
      email: "owner-login@ventureos.test",
      password: "current-password",
      name: "Owner Login",
    });
    const sessionId = await issueSession(user);
    await withPolicy("invitation-only", async () => {
      const signedIn = await authenticateUser({
        email: "owner-login@ventureos.test",
        password: "current-password",
      });
      assert.equal(signedIn.id, user.id);
      assert.equal((await getPersistence().sessions.findById(sessionId))?.userId, user.id);
      await requestPasswordReset({
        email: user.email,
        origin: "http://localhost:3000",
      });
      const token = takeAuthMailOutbox()[0]?.text.match(/token=([^&\s]+)/)?.[1];
      assert.ok(token);
      await resetPasswordWithToken({ token, password: "replacement-password" });
      const replaced = await authenticateUser({
        email: user.email,
        password: "replacement-password",
      });
      assert.equal(replaced.id, user.id);
    });
  });

  it("lets an existing Google user sign in and still links a password account", async () => {
    const created = await completeGoogleSignIn({
      subject: "google-existing-1",
      email: "existing-google@gmail.com",
      emailVerified: true,
      name: "Existing Google",
    });
    assert.equal(created.status, "signed-in");
    const passwordUser = await registerUser({
      email: "link-existing@ventureos.test",
      password: "password-1",
      name: "Link Existing",
    });
    await withPolicy("invitation-only", async () => {
      const again = await completeGoogleSignIn({
        subject: "google-existing-1",
        email: "existing-google@gmail.com",
        emailVerified: true,
        name: "Existing Google",
      });
      assert.equal(again.status, "signed-in");
      if (created.status === "signed-in" && again.status === "signed-in") {
        assert.equal(again.user.id, created.user.id);
      }
      const pending = await completeGoogleSignIn({
        subject: "google-link-1",
        email: "link-existing@ventureos.test",
        emailVerified: true,
        name: "Link Existing",
      });
      assert.equal(pending.status, "link-after-password");
      await linkGoogleAfterPassword({
        userId: passwordUser.id,
        email: passwordUser.email,
        subject: "google-link-1",
      });
      const linked = await getPersistence().identities.findByProvider("google", "google-link-1");
      assert.equal(linked?.userId, passwordUser.id);
      assert.equal((await listWorkspaces(passwordUser.id)).length, 1);
    });
  });

  it("keeps an authorised open deployment able to register", async () => {
    const user = await withPolicy("open", () =>
      registerUser({
        email: "open-deployment@ventureos.test",
        password: "password-1",
        name: "Open Deployment",
      }),
    );
    assert.equal((await listWorkspaces(user.id)).length, 1);
    const google = await withPolicy(undefined, () =>
      completeGoogleSignIn({
        subject: "google-open-1",
        email: "open-google@gmail.com",
        emailVerified: true,
        name: "Open Google",
      }),
    );
    assert.equal(google.status, "signed-in");
  });

  it("rejects an invalid policy value instead of opening registration", async () => {
    await withPolicy("true", async () => {
      await assert.rejects(
        () =>
          registerUser({
            email: "invalid-policy@ventureos.test",
            password: "password-1",
            name: "Invalid Policy",
          }),
        invitationRequired,
      );
    });
    await assertAbsent("invalid-policy@ventureos.test");
  });

  it("keeps workspace membership boundaries intact", async () => {
    const ownerId = await seedUser("owner-boundary@ventureos.test", "Owner");
    const adminId = await seedUser("admin-boundary@ventureos.test", "Admin");
    const memberId = await seedUser("member-boundary@ventureos.test", "Member");
    const workspaceId = await seedWorkspace("Customer", ownerId);
    const otherId = await seedWorkspace("Other", ownerId);
    await addMember(workspaceId, adminId, "admin");
    await addMember(workspaceId, memberId, "member");
    await withPolicy("invitation-only", async () => {
      assert.equal(await canAccessWorkspace(ownerId, workspaceId), true);
      assert.equal(await canAccessWorkspace(adminId, workspaceId), true);
      assert.equal(await canAccessWorkspace(memberId, workspaceId), true);
      assert.equal(await canAccessWorkspace(memberId, otherId), false);
      assert.equal(await canAccessWorkspace(adminId, otherId), false);
      await removeWorkspaceMember({ actorId: ownerId, workspaceId, userId: memberId });
      assert.equal(await canAccessWorkspace(memberId, workspaceId), false);
      assert.equal(
        (await listWorkspaces(memberId)).some((workspace) => workspace.id === workspaceId),
        false,
      );
    });
  });
});

function invitationRequired(error: unknown) {
  return error instanceof RegistrationPolicyError && error.message === REGISTRATION_INVITATION_MESSAGE;
}

async function withPolicy<T>(value: string | undefined, run: () => Promise<T>) {
  const previous = process.env[REGISTRATION_POLICY_ENV];
  if (value === undefined) delete process.env[REGISTRATION_POLICY_ENV];
  else process.env[REGISTRATION_POLICY_ENV] = value;
  try {
    return await run();
  } finally {
    if (previous === undefined) delete process.env[REGISTRATION_POLICY_ENV];
    else process.env[REGISTRATION_POLICY_ENV] = previous;
  }
}

async function counts() {
  return {
    users: await count("users"),
    identities: await count("auth_identities"),
    workspaces: await count("workspaces"),
    sessions: await count("sessions"),
  };
}

async function count(table: "users" | "auth_identities" | "workspaces" | "sessions") {
  const result = await getClient().execute(`SELECT COUNT(*) AS total FROM ${table}`);
  return Number(result.rows[0]?.total ?? 0);
}

async function assertAbsent(email: string, subject?: string) {
  assert.equal(await getPersistence().users.findByEmail(email), null);
  assert.equal(await getPersistence().identities.findByProvider("password", email), null);
  if (subject) {
    assert.equal(await getPersistence().identities.findByProvider("google", subject), null);
  }
}

function hash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

async function seedUser(email: string, name: string) {
  const id = createId<UserId>();
  await getPersistence().users.insert({
    id,
    email,
    name,
    passwordHash: "not-used",
    createdAt: NOW,
  });
  return id;
}

async function seedWorkspace(name: string, ownerId: UserId) {
  const id = createId<WorkspaceId>();
  await getPersistence().organisations.insert({
    id,
    name,
    slug: id,
    createdAt: NOW,
  });
  await getPersistence().memberships.insert({
    workspaceId: id,
    userId: ownerId,
    role: "owner",
    createdAt: NOW,
  });
  return id;
}

async function addMember(workspaceId: WorkspaceId, userId: UserId, role: Role) {
  await getPersistence().memberships.insert({
    workspaceId,
    userId,
    role,
    createdAt: NOW,
  });
}

async function invite(actorId: UserId, workspaceId: WorkspaceId, email: string, role: Role) {
  takeAuthMailOutbox();
  await inviteWorkspaceMember({
    actorId,
    workspaceId,
    email,
    role,
    origin: "http://localhost:3000",
  });
  const mail = takeAuthMailOutbox()[0];
  assert.ok(mail);
  const encoded = mail.text.match(/token=([^&\s]+)/)?.[1];
  assert.ok(encoded);
  return decodeURIComponent(encoded);
}
