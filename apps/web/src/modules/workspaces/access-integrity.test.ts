import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { after, beforeEach, describe, it } from "node:test";
import type { Role, UserId, WorkspaceId } from "../../contracts";
import { getPlatform } from "../../platform/kernel";
import { createId } from "../../platform/ids";
import { ensureSchema, getClient } from "../../platform/persistence/db";
import {
  getPersistence,
  resetPersistenceLifecycle,
} from "../../platform/persistence/repositories/sqlite";
import {
  setPlatformWriteAttemptHook,
  setPlatformWriteBarrier,
} from "../../platform/persistence/write-transaction";
import { takeAuthMailOutbox } from "../auth/mail";
import { completeGoogleSignIn } from "../auth/service";
import {
  WorkspaceAccessError,
  acceptWorkspaceInvitation,
  changeWorkspaceMemberRole,
  inviteWorkspaceMember,
  revokeWorkspaceInvitation,
} from "./access";
import { invitationTokenFromNext } from "./invitation-token";
import { listWorkspaces } from "./service";

const NOW = "2026-09-27T12:00:00.000Z";

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

function isBusy(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes("SQLITE_BUSY") || message.includes("database is locked");
}

async function raceWrites<T>(first: () => Promise<T>, second: () => Promise<T>) {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let entered!: () => void;
  const enteredPromise = new Promise<void>((resolve) => {
    entered = resolve;
  });
  let attempts = 0;
  setPlatformWriteBarrier(async () => {
    entered();
    await gate;
  });
  setPlatformWriteAttemptHook(() => {
    attempts += 1;
  });
  const leading = first().then(
    (value) => ({ status: "fulfilled" as const, value }),
    (reason: unknown) => ({ status: "rejected" as const, reason }),
  );
  try {
    await enteredPromise;
    const trailing = second().then(
      (value) => ({ status: "fulfilled" as const, value }),
      (reason: unknown) => ({ status: "rejected" as const, reason }),
    );
    for (let turn = 0; turn < 30 && attempts < 2; turn += 1) {
      await new Promise((resolve) => setImmediate(resolve));
    }
    release();
    return await Promise.all([leading, trailing]);
  } finally {
    release();
    setPlatformWriteBarrier(null);
    setPlatformWriteAttemptHook(null);
  }
}

describe("workspace access integrity", () => {
  after(() => {
    setPlatformWriteBarrier(null);
    setPlatformWriteAttemptHook(null);
    getPlatform().scheduler.stopAll();
  });

  beforeEach(async () => {
    getPlatform().scheduler.stopAll();
    setPlatformWriteBarrier(null);
    setPlatformWriteAttemptHook(null);
    await resetPersistenceLifecycle(":memory:");
    await ensureSchema();
    takeAuthMailOutbox();
  });

  it("reads an invitation token only from the invite path", () => {
    assert.equal(invitationTokenFromNext("/invite?token=abc"), "abc");
    assert.equal(invitationTokenFromNext("/dashboard?token=abc"), null);
    assert.equal(invitationTokenFromNext("/invite"), null);
  });

  it("still creates a personal workspace for ordinary Google signup", async () => {
    const result = await completeGoogleSignIn({
      subject: "google-ordinary",
      email: "ordinary@gmail.com",
      emailVerified: true,
      name: "Ordinary",
    });
    assert.equal(result.status, "signed-in");
    if (result.status !== "signed-in") return;
    const workspaces = await listWorkspaces(result.user.id);
    assert.equal(workspaces.length, 1);
    assert.equal(result.workspaceId, undefined);
    assert.equal(
      await getPersistence().memberships.getRole(result.user.id, workspaces[0]!.id),
      "owner",
    );
  });

  it("does not create a personal workspace for invited Google signup", async () => {
    const ownerId = await seedUser("owner-google@ventureos.test", "Owner");
    const workspaceId = await seedWorkspace("Customer", ownerId);
    const token = await invite(ownerId, workspaceId, "Invited.Google@gmail.com", "member");
    const result = await completeGoogleSignIn(
      {
        subject: "google-invited",
        email: "invited.google@gmail.com",
        emailVerified: true,
        name: "Invited",
      },
      { invitationToken: token },
    );
    assert.equal(result.status, "signed-in");
    if (result.status !== "signed-in") return;
    const workspaces = await listWorkspaces(result.user.id);
    assert.equal(workspaces.length, 1);
    assert.equal(workspaces[0]?.id, workspaceId);
    assert.equal(result.workspaceId, workspaceId);
    assert.equal(await getPersistence().memberships.getRole(result.user.id, workspaceId), "member");
    const organisations = await getPersistence().organisations.listForUser(result.user.id);
    assert.equal(organisations.length, 1);
  });

  it("does not grant membership for an invalid, revoked, expired, or wrong-email invitation", async () => {
    const ownerId = await seedUser("owner-google-reject@ventureos.test", "Owner");
    const workspaceId = await seedWorkspace("Customer", ownerId);
    const cases: Array<{ email: string; subject: string; token: string }> = [];

    cases.push({
      email: "missing-invite@gmail.com",
      subject: "google-missing",
      token: "not-a-real-invitation",
    });

    const revokedToken = await invite(ownerId, workspaceId, "revoked-google@gmail.com", "member");
    const revoked = await getPersistence().invitations.findByTokenHash(
      createHash("sha256").update(revokedToken).digest("hex"),
    );
    assert.ok(revoked);
    await revokeWorkspaceInvitation({
      actorId: ownerId,
      workspaceId,
      invitationId: revoked.id,
    });
    cases.push({
      email: "revoked-google@gmail.com",
      subject: "google-revoked",
      token: revokedToken,
    });

    const expiredToken = await invite(ownerId, workspaceId, "expired-google@gmail.com", "member");
    await getClient().execute({
      sql: `UPDATE workspace_invitations SET expires_at = ? WHERE token_hash = ?`,
      args: ["2020-01-01T00:00:00.000Z", createHash("sha256").update(expiredToken).digest("hex")],
    });
    cases.push({
      email: "expired-google@gmail.com",
      subject: "google-expired",
      token: expiredToken,
    });

    const wrongToken = await invite(ownerId, workspaceId, "intended@gmail.com", "admin");
    cases.push({
      email: "other-person@gmail.com",
      subject: "google-wrong-email",
      token: wrongToken,
    });

    for (const item of cases) {
      await assert.rejects(() =>
        completeGoogleSignIn(
          {
            subject: item.subject,
            email: item.email,
            emailVerified: true,
            name: "Rejected",
          },
          { invitationToken: item.token },
        ),
      );
      assert.equal(await getPersistence().users.findByEmail(item.email), null);
    }

    const members = await getPersistence().memberships.listByWorkspace(workspaceId);
    assert.deepEqual(
      members.map((member) => member.userId),
      [ownerId],
    );
    const pending = await getPersistence().invitations.findByTokenHash(
      createHash("sha256").update(wrongToken).digest("hex"),
    );
    assert.equal(pending?.acceptedAt, null);
    assert.equal(pending?.revokedAt, null);
  });

  it("lets an expired invitation release its active slot", async () => {
    const ownerId = await seedUser("owner-expire-slot@ventureos.test", "Owner");
    const workspaceId = await seedWorkspace("Customer", ownerId);
    const expiredToken = await invite(ownerId, workspaceId, "again@ventureos.test", "member");
    const expiredHash = createHash("sha256").update(expiredToken).digest("hex");
    await getClient().execute({
      sql: `UPDATE workspace_invitations SET expires_at = ? WHERE token_hash = ?`,
      args: ["2020-01-01T00:00:00.000Z", expiredHash],
    });
    const replacement = await invite(ownerId, workspaceId, "again@ventureos.test", "admin");
    const expired = await getPersistence().invitations.findByTokenHash(expiredHash);
    const active = await getPersistence().invitations.findByTokenHash(
      createHash("sha256").update(replacement).digest("hex"),
    );
    assert.equal(expired?.revokedAt, null);
    assert.equal(expired?.activeSlot, null);
    assert.ok(active?.activeSlot);
    assert.notEqual(active?.id, expired?.id);
    const inviteeId = await seedUser("again@ventureos.test", "Again");
    await assert.rejects(
      () => acceptWorkspaceInvitation({ userId: inviteeId, token: expiredToken }),
      (error: unknown) => error instanceof WorkspaceAccessError && error.code === "expired",
    );
    assert.equal(await getPersistence().memberships.getRole(inviteeId, workspaceId), null);
  });

  it("rejects a second live invitation row for the same active slot", async () => {
    const ownerId = await seedUser("owner-slot@ventureos.test", "Owner");
    const workspaceId = await seedWorkspace("Customer", ownerId);
    const email = "slot@ventureos.test";
    const slot = `${workspaceId}\n${email}`;
    const insertSlot = (id: string) =>
      getClient().execute({
        sql: `INSERT INTO workspace_invitations (
                id, workspace_id, email, role, invited_by, token_hash, expires_at, accepted_at, revoked_at, created_at, active_slot
              ) VALUES (?, ?, ?, 'member', ?, ?, ?, NULL, NULL, ?, ?)`,
        args: [
          id,
          workspaceId,
          email,
          ownerId,
          randomBytes(16).toString("hex"),
          "2026-10-04T12:00:00.000Z",
          NOW,
          slot,
        ],
      });
    await insertSlot(createId());
    await assert.rejects(() => insertSlot(createId()), (error: unknown) => isBusy(error) || /UNIQUE/.test(error instanceof Error ? error.message : String(error)));
    const rows = await getPersistence().invitations.listByWorkspace(workspaceId);
    assert.equal(rows.filter((row) => row.activeSlot === slot).length, 1);
  });

  it("allows only one active invitation when two invites race", async () => {
    const ownerId = await seedUser("owner-race-invite@ventureos.test", "Owner");
    const workspaceId = await seedWorkspace("Customer", ownerId);
    const email = "race-invite@ventureos.test";
    const results = await raceWrites(
      () =>
        inviteWorkspaceMember({
          actorId: ownerId,
          workspaceId,
          email,
          role: "member",
          origin: "http://localhost:3000",
        }),
      () =>
        inviteWorkspaceMember({
          actorId: ownerId,
          workspaceId,
          email: " Race-Invite@ventureos.test ",
          role: "admin",
          origin: "http://localhost:3000",
        }),
    );
    const active = (await getPersistence().invitations.listByWorkspace(workspaceId)).filter(
      (row) => row.activeSlot && !row.acceptedAt && !row.revokedAt,
    );
    assert.equal(active.length, 1);
    assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
    const loser = results.find((result) => result.status === "rejected");
    assert.ok(loser && loser.status === "rejected");
    const pending =
      loser.reason instanceof WorkspaceAccessError && loser.reason.code === "invitation-pending";
    assert.equal(pending || isBusy(loser.reason), true);
  });

  it("lets only one acceptance create a membership", async () => {
    const ownerId = await seedUser("owner-race-accept@ventureos.test", "Owner");
    const inviteeId = await seedUser("race-accept@ventureos.test", "Invitee");
    const workspaceId = await seedWorkspace("Customer", ownerId);
    const token = await invite(ownerId, workspaceId, "race-accept@ventureos.test", "member");
    const results = await raceWrites(
      () => acceptWorkspaceInvitation({ userId: inviteeId, token }),
      () => acceptWorkspaceInvitation({ userId: inviteeId, token }),
    );
    const members = (await getPersistence().memberships.listByWorkspace(workspaceId)).filter(
      (member) => member.userId === inviteeId,
    );
    assert.equal(members.length, 1);
    assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
    const loser = results.find((result) => result.status === "rejected");
    assert.ok(loser && loser.status === "rejected");
    const replay = loser.reason instanceof WorkspaceAccessError && loser.reason.code === "replay";
    assert.equal(replay || isBusy(loser.reason), true);
  });

  it("cannot leave a workspace with zero owners", async () => {
    const ownerA = await seedUser("owner-a@ventureos.test", "Owner A");
    const ownerB = await seedUser("owner-b@ventureos.test", "Owner B");
    const workspaceId = await seedWorkspace("Customer", ownerA);
    await getPersistence().memberships.insert({
      workspaceId,
      userId: ownerB,
      role: "owner",
      createdAt: NOW,
    });
    const results = await raceWrites(
      () =>
        changeWorkspaceMemberRole({
          actorId: ownerA,
          workspaceId,
          userId: ownerA,
          role: "admin",
        }),
      () =>
        changeWorkspaceMemberRole({
          actorId: ownerB,
          workspaceId,
          userId: ownerB,
          role: "admin",
        }),
    );
    const owners = await getPersistence().memberships.countOwners(workspaceId);
    assert.ok(owners >= 1);
    assert.ok(results.filter((result) => result.status === "fulfilled").length <= 1);
    assert.equal(owners, 1);
  });

  it("rejects an invitation when membership appears before the insert transaction", async () => {
    const ownerId = await seedUser("owner-invite-race@ventureos.test", "Owner");
    const inviteeId = await seedUser("race-member@ventureos.test", "Race");
    const workspaceId = await seedWorkspace("Customer", ownerId);
    const store = getPersistence();
    const insert = store.invitations.insert.bind(store.invitations);
    store.invitations.insert = async (row, options) => {
      await store.memberships.insert({
        workspaceId,
        userId: inviteeId,
        role: "member",
        createdAt: NOW,
      });
      return insert(row, options);
    };
    try {
      await assert.rejects(
        () =>
          inviteWorkspaceMember({
            actorId: ownerId,
            workspaceId,
            email: "race-member@ventureos.test",
            role: "member",
            origin: "http://localhost:3000",
          }),
        (error: unknown) =>
          error instanceof WorkspaceAccessError && error.code === "already-member",
      );
    } finally {
      store.invitations.insert = insert;
    }
    const invitations = await store.invitations.listByWorkspace(workspaceId);
    assert.equal(
      invitations.filter(
        (invitation) =>
          invitation.email === "race-member@ventureos.test" &&
          invitation.acceptedAt === null &&
          invitation.revokedAt === null,
      ).length,
      0,
    );
    assert.equal(await store.memberships.getRole(inviteeId, workspaceId), "member");
  });
});
