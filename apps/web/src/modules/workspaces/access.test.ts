import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { after, beforeEach, describe, it } from "node:test";
import type { Role, UserId, WorkspaceId } from "../../contracts";
import type { DomainEvent } from "../../contracts";
import { getPlatform } from "../../platform/kernel";
import { createId } from "../../platform/ids";
import { ensureSchema, getClient } from "../../platform/persistence/db";
import {
  getPersistence,
  resetPersistenceLifecycle,
} from "../../platform/persistence/repositories/sqlite";
import { takeAuthMailOutbox } from "../auth/mail";
import { completeGoogleSignIn, registerInvitedUser, registerUser } from "../auth/service";
import { canAccessWorkspace, listWorkspaces } from "./service";
import { WorkspaceAccessError, acceptWorkspaceInvitation, changeWorkspaceMemberRole, inviteWorkspaceMember, removeWorkspaceMember, revokeWorkspaceInvitation } from "./access";

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

async function addMember(workspaceId: WorkspaceId, userId: UserId, role: Role) {
  await getPersistence().memberships.insert({
    workspaceId,
    userId,
    role,
    createdAt: NOW,
  });
}

function collect(type: string) {
  const events: DomainEvent[] = [];
  const stop = getPlatform().events.subscribe(type, (event) => {
    events.push(event);
  });
  return { events, stop };
}

async function invite(
  actorId: UserId,
  workspaceId: WorkspaceId,
  email: string,
  role: Role,
) {
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

async function membershipCount(workspaceId: WorkspaceId, userId: UserId) {
  const rows = await getPersistence().memberships.listByWorkspace(workspaceId);
  return rows.filter((row) => row.userId === userId).length;
}

describe("workspace membership access", () => {
  after(() => {
    getPlatform().scheduler.stopAll();
  });

  beforeEach(async () => {
    await resetPersistenceLifecycle(":memory:");
    await ensureSchema();
    takeAuthMailOutbox();
  });

  it("lets an owner invite a member", async () => {
    const ownerId = await seedUser("owner-member@ventureos.test", "Owner");
    const workspaceId = await seedWorkspace("North", ownerId);
    const invited = collect("workspace.member.invited");
    try {
      const token = await invite(ownerId, workspaceId, "member@ventureos.test", "member");
      assert.ok(token);
      assert.equal(invited.events.length, 1);
      assert.equal(invited.events[0]?.actorId, ownerId);
      assert.equal(invited.events[0]?.workspaceId, workspaceId);
      assert.equal(JSON.stringify(invited.events[0]?.payload).includes(token), false);
      await assert.rejects(
        () => invite(ownerId, workspaceId, "member@ventureos.test", "member"),
        (error: unknown) => error instanceof WorkspaceAccessError && error.code === "invitation-pending",
      );
    } finally {
      invited.stop();
    }
  });

  it("lets an owner invite an admin", async () => {
    const ownerId = await seedUser("owner-admin@ventureos.test", "Owner");
    const workspaceId = await seedWorkspace("North", ownerId);
    const token = await invite(ownerId, workspaceId, "admin@ventureos.test", "admin");
    const row = await getPersistence().invitations.findByTokenHash(
      createHash("sha256").update(token).digest("hex"),
    );
    assert.equal(row?.role, "admin");
    assert.equal(row?.email, "admin@ventureos.test");
  });

  it("does not let a member invite", async () => {
    const ownerId = await seedUser("owner-block@ventureos.test", "Owner");
    const memberId = await seedUser("member-block@ventureos.test", "Member");
    const workspaceId = await seedWorkspace("North", ownerId);
    await addMember(workspaceId, memberId, "member");
    await assert.rejects(
      () => invite(memberId, workspaceId, "new@ventureos.test", "member"),
      (error: unknown) => error instanceof WorkspaceAccessError && error.code === "forbidden",
    );
  });

  it("lets an admin invite and remove a member, but not an admin invitation", async () => {
    const ownerId = await seedUser("owner-admin-ops@ventureos.test", "Owner");
    const adminId = await seedUser("admin-ops@ventureos.test", "Admin");
    const memberId = await seedUser("member-ops@ventureos.test", "Member");
    const workspaceId = await seedWorkspace("North", ownerId);
    await addMember(workspaceId, adminId, "admin");
    await addMember(workspaceId, memberId, "member");

    const memberToken = await invite(adminId, workspaceId, "staff@ventureos.test", "member");
    assert.ok(memberToken);
    await assert.rejects(
      () => invite(adminId, workspaceId, "second-admin@ventureos.test", "admin"),
      (error: unknown) => error instanceof WorkspaceAccessError && error.code === "invite-role",
    );

    const adminToken = await invite(ownerId, workspaceId, "lead@ventureos.test", "admin");
    const adminInvitation = await getPersistence().invitations.findByTokenHash(
      createHash("sha256").update(adminToken).digest("hex"),
    );
    assert.ok(adminInvitation);
    await assert.rejects(
      () =>
        revokeWorkspaceInvitation({
          actorId: adminId,
          workspaceId,
          invitationId: adminInvitation.id,
        }),
      (error: unknown) => error instanceof WorkspaceAccessError && error.code === "forbidden",
    );

    await removeWorkspaceMember({ actorId: adminId, workspaceId, userId: memberId });
    assert.equal(await getPersistence().memberships.getRole(memberId, workspaceId), null);
  });

  it("does not let an admin create or promote an owner", async () => {
    const ownerId = await seedUser("owner-guard@ventureos.test", "Owner");
    const adminId = await seedUser("admin-guard@ventureos.test", "Admin");
    const memberId = await seedUser("member-guard@ventureos.test", "Member");
    const workspaceId = await seedWorkspace("North", ownerId);
    await addMember(workspaceId, adminId, "admin");
    await addMember(workspaceId, memberId, "member");

    await assert.rejects(
      () => invite(adminId, workspaceId, "future-owner@ventureos.test", "owner"),
      (error: unknown) => error instanceof WorkspaceAccessError && error.code === "invite-role",
    );
    await assert.rejects(
      () =>
        changeWorkspaceMemberRole({
          actorId: adminId,
          workspaceId,
          userId: memberId,
          role: "owner",
        }),
      (error: unknown) => error instanceof WorkspaceAccessError && error.code === "forbidden",
    );
    await assert.rejects(
      () =>
        changeWorkspaceMemberRole({
          actorId: adminId,
          workspaceId,
          userId: memberId,
          role: "admin",
        }),
      (error: unknown) => error instanceof WorkspaceAccessError && error.code === "forbidden",
    );
    await assert.rejects(
      () =>
        removeWorkspaceMember({
          actorId: adminId,
          workspaceId,
          userId: ownerId,
        }),
      (error: unknown) => error instanceof WorkspaceAccessError && error.code === "forbidden",
    );
    assert.equal(await getPersistence().memberships.getRole(ownerId, workspaceId), "owner");
    assert.equal(await getPersistence().memberships.getRole(memberId, workspaceId), "member");
  });

  it("rejects cross-workspace invitation management", async () => {
    const ownerA = await seedUser("owner-a@ventureos.test", "Owner A");
    const ownerB = await seedUser("owner-b@ventureos.test", "Owner B");
    const workspaceA = await seedWorkspace("Alpha", ownerA);
    const workspaceB = await seedWorkspace("Beta", ownerB);
    const token = await invite(ownerA, workspaceA, "guest@ventureos.test", "member");
    const invitation = await getPersistence().invitations.findByTokenHash(
      createHash("sha256").update(token).digest("hex"),
    );
    assert.ok(invitation);

    await assert.rejects(
      () => invite(ownerB, workspaceA, "other@ventureos.test", "member"),
      (error: unknown) => error instanceof WorkspaceAccessError && error.code === "forbidden",
    );
    await assert.rejects(
      () =>
        revokeWorkspaceInvitation({
          actorId: ownerB,
          workspaceId: workspaceB,
          invitationId: invitation.id,
        }),
      (error: unknown) =>
        error instanceof WorkspaceAccessError && error.code === "invitation-missing",
    );
    assert.equal(
      (await getPersistence().invitations.findById(invitation.id))?.revokedAt,
      null,
    );
  });

  it("accepts a valid invitation for an existing user", async () => {
    const ownerId = await seedUser("owner-existing@ventureos.test", "Owner");
    const workspaceId = await seedWorkspace("Customer", ownerId);
    const existing = await registerUser({
      email: "existing@ventureos.test",
      password: "desk-password",
      name: "Existing",
    });
    const before = await listWorkspaces(existing.id);
    const token = await invite(ownerId, workspaceId, existing.email, "member");
    const joined = collect("workspace.member.joined");
    try {
      const accepted = await acceptWorkspaceInvitation({ userId: existing.id, token });
      assert.equal(accepted.workspaceId, workspaceId);
      assert.equal(accepted.role, "member");
      assert.equal(accepted.createdMembership, true);
      const after = await listWorkspaces(existing.id);
      assert.equal(after.some((workspace) => workspace.id === workspaceId), true);
      assert.equal(after.length, before.length + 1);
      assert.equal(joined.events.length, 1);
      assert.equal(joined.events[0]?.actorId, existing.id);
      assert.equal(JSON.stringify(joined.events[0]).includes(token), false);
    } finally {
      joined.stop();
    }
  });

  it("accepts a valid invitation while creating a new account", async () => {
    const ownerId = await seedUser("owner-new@ventureos.test", "Owner");
    const workspaceId = await seedWorkspace("Customer", ownerId);
    const token = await invite(ownerId, workspaceId, "newcomer@ventureos.test", "member");
    const joined = await registerInvitedUser({
      email: "newcomer@ventureos.test",
      password: "desk-password",
      name: "Newcomer",
    token,
    });
    const workspaces = await listWorkspaces(joined.user.id);
    assert.equal(workspaces.length, 1);
    assert.equal(workspaces[0]?.id, workspaceId);
    assert.equal(workspaces[0]?.name, "Customer");
    assert.equal(
      await getPersistence().memberships.getRole(joined.user.id, workspaceId),
      "member",
    );
  });

  it("rejects acceptance from a different email", async () => {
    const ownerId = await seedUser("owner-wrong@ventureos.test", "Owner");
    const workspaceId = await seedWorkspace("Customer", ownerId);
    const otherId = await seedUser("other@ventureos.test", "Other");
    const token = await invite(ownerId, workspaceId, "invited@ventureos.test", "member");
    await assert.rejects(
      () => acceptWorkspaceInvitation({ userId: otherId, token }),
      (error: unknown) => error instanceof WorkspaceAccessError && error.code === "wrong-email",
    );
    assert.equal(await membershipCount(workspaceId, otherId), 0);
    const row = await getPersistence().invitations.findByTokenHash(
      createHash("sha256").update(token).digest("hex"),
    );
    assert.equal(row?.acceptedAt, null);
  });

  it("rejects an expired invitation", async () => {
    const ownerId = await seedUser("owner-expired@ventureos.test", "Owner");
    const inviteeId = await seedUser("expired@ventureos.test", "Expired");
    const workspaceId = await seedWorkspace("Customer", ownerId);
    const token = await invite(ownerId, workspaceId, "expired@ventureos.test", "member");
    const hash = createHash("sha256").update(token).digest("hex");
    await getClient().execute({
      sql: `UPDATE workspace_invitations SET expires_at = ? WHERE token_hash = ?`,
      args: ["2000-01-01T00:00:00.000Z", hash],
    });
    await assert.rejects(
      () => acceptWorkspaceInvitation({ userId: inviteeId, token }),
      (error: unknown) => error instanceof WorkspaceAccessError && error.code === "expired",
    );
    assert.equal(await membershipCount(workspaceId, inviteeId), 0);
  });

  it("rejects a revoked invitation", async () => {
    const ownerId = await seedUser("owner-revoked@ventureos.test", "Owner");
    const inviteeId = await seedUser("revoked@ventureos.test", "Revoked");
    const workspaceId = await seedWorkspace("Customer", ownerId);
    const token = await invite(ownerId, workspaceId, "revoked@ventureos.test", "member");
    const invitation = await getPersistence().invitations.findByTokenHash(
      createHash("sha256").update(token).digest("hex"),
    );
    assert.ok(invitation);
    const revoked = collect("workspace.invitation.revoked");
    try {
      await revokeWorkspaceInvitation({
        actorId: ownerId,
        workspaceId,
        invitationId: invitation.id,
      });
      assert.equal(revoked.events.length, 1);
      assert.equal(JSON.stringify(revoked.events[0]).includes(token), false);
    } finally {
      revoked.stop();
    }
    await assert.rejects(
      () => acceptWorkspaceInvitation({ userId: inviteeId, token }),
      (error: unknown) => error instanceof WorkspaceAccessError && error.code === "revoked",
    );
  });

  it("rejects invitation replay", async () => {
    const ownerId = await seedUser("owner-replay@ventureos.test", "Owner");
    const inviteeId = await seedUser("replay@ventureos.test", "Replay");
    const workspaceId = await seedWorkspace("Customer", ownerId);
    const token = await invite(ownerId, workspaceId, "replay@ventureos.test", "member");
    await acceptWorkspaceInvitation({ userId: inviteeId, token });
    await assert.rejects(
      () => acceptWorkspaceInvitation({ userId: inviteeId, token }),
      (error: unknown) => error instanceof WorkspaceAccessError && error.code === "replay",
    );
    assert.equal(await membershipCount(workspaceId, inviteeId), 1);
  });

  it("fails closed when an existing member accepts an invitation", async () => {
    const ownerId = await seedUser("owner-dup@ventureos.test", "Owner");
    const inviteeId = await seedUser("dup@ventureos.test", "Dup");
    const workspaceId = await seedWorkspace("Customer", ownerId);
    await addMember(workspaceId, inviteeId, "member");
    const token = await invite(ownerId, workspaceId, "someone-else@ventureos.test", "member");
    await getClient().execute({
      sql: `UPDATE workspace_invitations SET email = ?, role = ? WHERE token_hash = ?`,
      args: ["dup@ventureos.test", "admin", createHash("sha256").update(token).digest("hex")],
    });
    await assert.rejects(
      () => acceptWorkspaceInvitation({ userId: inviteeId, token }),
      (error: unknown) => error instanceof WorkspaceAccessError && error.code === "already-member",
    );
    const invitation = await getPersistence().invitations.findByTokenHash(
      createHash("sha256").update(token).digest("hex"),
    );
    assert.equal(invitation?.acceptedAt, null);
    assert.equal(invitation?.revokedAt, null);
    assert.equal(await getPersistence().memberships.getRole(inviteeId, workspaceId), "member");
    assert.equal(await membershipCount(workspaceId, inviteeId), 1);
  });

  it("persists a role change", async () => {
    const ownerId = await seedUser("owner-role@ventureos.test", "Owner");
    const memberId = await seedUser("role@ventureos.test", "Member");
    const workspaceId = await seedWorkspace("Customer", ownerId);
    await addMember(workspaceId, memberId, "member");
    const changed = collect("workspace.member.role_changed");
    try {
      await changeWorkspaceMemberRole({
        actorId: ownerId,
        workspaceId,
        userId: memberId,
        role: "admin",
      });
      assert.equal(await getPersistence().memberships.getRole(memberId, workspaceId), "admin");
      assert.equal(changed.events.length, 1);
      assert.equal(changed.events[0]?.workspaceId, workspaceId);
      assert.equal(changed.events[0]?.actorId, ownerId);
      assert.equal(
        (changed.events[0]?.payload as { previousRole?: string; role?: string }).previousRole,
        "member",
      );
      assert.equal((changed.events[0]?.payload as { role?: string }).role, "admin");
    } finally {
      changed.stop();
    }
  });

  it("does not let a member change roles", async () => {
    const ownerId = await seedUser("owner-norole@ventureos.test", "Owner");
    const memberId = await seedUser("norole@ventureos.test", "Member");
    const otherId = await seedUser("other-role@ventureos.test", "Other");
    const workspaceId = await seedWorkspace("Customer", ownerId);
    await addMember(workspaceId, memberId, "member");
    await addMember(workspaceId, otherId, "member");
    await assert.rejects(
      () =>
        changeWorkspaceMemberRole({
          actorId: memberId,
          workspaceId,
          userId: otherId,
          role: "admin",
        }),
      (error: unknown) => error instanceof WorkspaceAccessError && error.code === "forbidden",
    );
    assert.equal(await getPersistence().memberships.getRole(otherId, workspaceId), "member");
  });

  it("persists access removal", async () => {
    const ownerId = await seedUser("owner-remove@ventureos.test", "Owner");
    const memberId = await seedUser("remove@ventureos.test", "Member");
    const workspaceId = await seedWorkspace("Customer", ownerId);
    await addMember(workspaceId, memberId, "member");
    const removed = collect("workspace.member.removed");
    try {
      await removeWorkspaceMember({
        actorId: ownerId,
        workspaceId,
        userId: memberId,
      });
      assert.equal(await getPersistence().memberships.getRole(memberId, workspaceId), null);
      assert.equal(removed.events.length, 1);
      assert.equal(removed.events[0]?.actorId, ownerId);
      assert.equal(
        (removed.events[0]?.payload as { removedRole?: string }).removedRole,
        "member",
      );
      assert.equal(JSON.stringify(removed.events[0]).includes("token"), false);
    } finally {
      removed.stop();
    }
  });

  it("stops a removed user from switching into the workspace", async () => {
    const ownerId = await seedUser("owner-switch@ventureos.test", "Owner");
    const memberId = await seedUser("switch@ventureos.test", "Member");
    const workspaceId = await seedWorkspace("Customer", ownerId);
    await addMember(workspaceId, memberId, "member");
    assert.equal(await canAccessWorkspace(memberId, workspaceId), true);
    await removeWorkspaceMember({ actorId: ownerId, workspaceId, userId: memberId });
    assert.equal(await canAccessWorkspace(memberId, workspaceId), false);
    const visible = await listWorkspaces(memberId);
    assert.equal(visible.some((workspace) => workspace.id === workspaceId), false);
  });

  it("does not remove the last owner", async () => {
    const ownerId = await seedUser("owner-last@ventureos.test", "Owner");
    const workspaceId = await seedWorkspace("Customer", ownerId);
    await assert.rejects(
      () => removeWorkspaceMember({ actorId: ownerId, workspaceId, userId: ownerId }),
      (error: unknown) => error instanceof WorkspaceAccessError && error.code === "last-owner",
    );
    assert.equal(await getPersistence().memberships.countOwners(workspaceId), 1);
    assert.equal(await getPersistence().memberships.getRole(ownerId, workspaceId), "owner");
  });

  it("does not demote the last owner", async () => {
    const ownerId = await seedUser("owner-demote@ventureos.test", "Owner");
    const workspaceId = await seedWorkspace("Customer", ownerId);
    await assert.rejects(
      () =>
        changeWorkspaceMemberRole({
          actorId: ownerId,
          workspaceId,
          userId: ownerId,
          role: "admin",
        }),
      (error: unknown) => error instanceof WorkspaceAccessError && error.code === "last-owner",
    );
    assert.equal(await getPersistence().memberships.getRole(ownerId, workspaceId), "owner");
  });

  it("allows a safe owner transition when another owner remains", async () => {
    const ownerA = await seedUser("owner-a-transition@ventureos.test", "Owner A");
    const ownerB = await seedUser("owner-b-transition@ventureos.test", "Owner B");
    const workspaceId = await seedWorkspace("Shared", ownerA);
    await addMember(workspaceId, ownerB, "owner");
    await changeWorkspaceMemberRole({
      actorId: ownerA,
      workspaceId,
      userId: ownerA,
      role: "admin",
    });
    assert.equal(await getPersistence().memberships.getRole(ownerA, workspaceId), "admin");
    assert.equal(await getPersistence().memberships.getRole(ownerB, workspaceId), "owner");
    assert.equal(await getPersistence().memberships.countOwners(workspaceId), 1);
    await assert.rejects(
      () =>
        changeWorkspaceMemberRole({
          actorId: ownerB,
          workspaceId,
          userId: ownerB,
          role: "member",
        }),
      (error: unknown) => error instanceof WorkspaceAccessError && error.code === "last-owner",
    );
  });

  it("does not persist the raw invitation token", async () => {
    const ownerId = await seedUser("owner-token@ventureos.test", "Owner");
    const workspaceId = await seedWorkspace("Customer", ownerId);
    const token = await invite(ownerId, workspaceId, "token@ventureos.test", "member");
    const hash = createHash("sha256").update(token).digest("hex");
    const dumped = await getClient().execute("SELECT * FROM workspace_invitations");
    const serialized = JSON.stringify(dumped.rows);
    assert.equal(serialized.includes(token), false);
    const row = await getPersistence().invitations.findByTokenHash(hash);
    assert.ok(row);
    assert.equal(row.tokenHash, hash);
    assert.notEqual(row.tokenHash, token);
    assert.equal(JSON.stringify(row).includes(token), false);
  });

  it("still creates a personal workspace for signup without an invitation", async () => {
    const user = await registerUser({
      email: "plain@ventureos.test",
      password: "desk-password",
      name: "Ada",
    });
    const workspaces = await listWorkspaces(user.id);
    assert.equal(workspaces.length, 1);
    assert.equal(workspaces[0]?.name, "Ada's workspace");
    assert.equal(
      await getPersistence().memberships.getRole(user.id, workspaces[0]!.id),
      "owner",
    );
  });

  it("keeps Google and password account behaviour", async () => {
    await registerUser({
      email: "link@ventureos.test",
      password: "desk-password",
      name: "Link",
    });
    const linked = await completeGoogleSignIn({
      subject: "google-iam-link",
      email: "link@ventureos.test",
      emailVerified: true,
      name: "Link",
    });
    assert.equal(linked.status, "link-after-password");

    const created = await completeGoogleSignIn({
      subject: "google-iam-new",
      email: "maya-iam@gmail.com",
      emailVerified: true,
      name: "Maya Chen",
    });
    assert.equal(created.status, "signed-in");
    if (created.status !== "signed-in") return;
    const workspaces = await listWorkspaces(created.user.id);
    assert.equal(workspaces.length, 1);
    assert.equal(
      await getPersistence().memberships.getRole(created.user.id, workspaces[0]!.id),
      "owner",
    );
  });

  it("keeps workspace isolation intact", async () => {
    const ownerA = await seedUser("iso-a@ventureos.test", "Owner A");
    const ownerB = await seedUser("iso-b@ventureos.test", "Owner B");
    const workspaceA = await seedWorkspace("Alpha", ownerA);
    const workspaceB = await seedWorkspace("Beta", ownerB);
    const listed = await listWorkspaces(ownerA);
    assert.equal(listed.some((workspace) => workspace.id === workspaceB), false);
    assert.equal(await canAccessWorkspace(ownerA, workspaceB), false);
    assert.equal(
      await getPlatform().permissions.can({
        userId: ownerA,
        permission: "workspace.read",
        resource: { type: "workspace", id: workspaceB },
      }),
      false,
    );
    assert.equal(
      await getPlatform().permissions.can({
        userId: ownerA,
        permission: "workspace.members.invite",
        resource: { type: "workspace", id: workspaceA },
      }),
      true,
    );
    await assert.rejects(
      () => invite(ownerA, workspaceB, "outsider@ventureos.test", "member"),
      (error: unknown) => error instanceof WorkspaceAccessError && error.code === "forbidden",
    );
  });
});
