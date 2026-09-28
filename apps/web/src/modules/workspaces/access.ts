import type { Permission, Role, UserId, WorkspaceId } from "@/contracts";
import {
  createEvent,
  createId,
  ensureSchema,
  getPersistence,
  getPlatform,
  nowIso,
} from "@/platform";
import { sendAuthMail } from "@/modules/auth/mail";
import {
  actorMayChangeRole,
  actorMayInviteRole,
  actorMayRemove,
  actorMayRevokeInvitation,
  inviteRoleChoices,
  isMembershipRole,
  type WorkspaceAccessView,
  type WorkspaceInvitationView,
  type WorkspaceMemberView,
} from "@/modules/workspaces/access-policy";
import {
  createInvitationToken,
  hashInvitationToken,
  invitationExpiry,
} from "@/modules/workspaces/invitation-token";

export class WorkspaceAccessError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "WorkspaceAccessError";
    this.code = code;
  }
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function deny() {
  return new WorkspaceAccessError(
    "forbidden",
    "You cannot manage membership in this workspace.",
  );
}

async function assertPermission(
  actorId: UserId,
  workspaceId: WorkspaceId,
  permission: Permission,
) {
  const allowed = await getPlatform().permissions.can({
    userId: actorId,
    permission,
    resource: { type: "workspace", id: workspaceId },
  });
  if (!allowed) {
    throw deny();
  }
}

function invitationFailure(
  status: "invalid" | "expired" | "revoked" | "wrong-email" | "replay" | "already-member",
) {
  if (status === "expired") {
    return new WorkspaceAccessError("expired", "This invitation has expired.");
  }
  if (status === "revoked") {
    return new WorkspaceAccessError("revoked", "This invitation has been revoked.");
  }
  if (status === "wrong-email") {
    return new WorkspaceAccessError(
      "wrong-email",
      "This invitation was sent to a different email.",
    );
  }
  if (status === "replay") {
    return new WorkspaceAccessError("replay", "This invitation has already been used.");
  }
  if (status === "already-member") {
    return new WorkspaceAccessError(
      "already-member",
      "That person is already a member of this workspace.",
    );
  }
  return new WorkspaceAccessError("invalid", "This invitation is invalid or has expired.");
}

export async function inviteWorkspaceMember(input: {
  actorId: UserId;
  workspaceId: WorkspaceId;
  email: string;
  role: Role;
  origin: string;
}) {
  await ensureSchema();
  if (input.role === "owner" || !isMembershipRole(input.role)) {
    throw new WorkspaceAccessError("invite-role", "You cannot invite that role.");
  }
  await assertPermission(input.actorId, input.workspaceId, "workspace.members.invite");

  const store = getPersistence();
  const email = normalizeEmail(input.email);
  const existingUser = await store.users.findByEmail(email);
  if (existingUser) {
    const role = await store.memberships.getRole(existingUser.id, input.workspaceId);
    if (role) {
      throw new WorkspaceAccessError(
        "already-member",
        "That person is already a member of this workspace.",
      );
    }
  }

  const workspace = await store.organisations.findById(input.workspaceId);
  if (!workspace) {
    throw deny();
  }

  const token = createInvitationToken();
  const createdAt = nowIso();
  const expiresAt = invitationExpiry(Date.parse(createdAt));
  const invitationId = createId();
  const inserted = await store.invitations.insert(
    {
      id: invitationId,
      workspaceId: input.workspaceId,
      email,
      role: input.role,
      invitedBy: input.actorId,
      tokenHash: hashInvitationToken(token),
      expiresAt,
      acceptedAt: null,
      revokedAt: null,
      createdAt,
      activeSlot: null,
    },
    {
      nowIso: createdAt,
      actorId: input.actorId,
      allow: (actorRole) => isMembershipRole(actorRole) && actorMayInviteRole(actorRole, input.role),
    },
  );

  if (inserted === "forbidden") {
    throw new WorkspaceAccessError("invite-role", "You cannot invite that role.");
  }
  if (inserted === "duplicate-active") {
    throw new WorkspaceAccessError(
      "invitation-pending",
      "An active invitation already exists for that email.",
    );
  }

  const actor = await store.users.findById(input.actorId);
  const inviteUrl = `${input.origin.replace(/\/$/, "")}/invite?token=${encodeURIComponent(token)}`;
  try {
    await sendAuthMail({
      to: email,
      subject: "Join a VentureOS workspace",
      text: `${actor?.name ?? "A workspace owner"} invited you to join ${workspace.name}.\n\nOpen this link to accept:\n${inviteUrl}\n\nThe link expires in 7 days.\n`,
    });
  } catch (error) {
    await store.invitations.revoke({
      id: invitationId,
      workspaceId: input.workspaceId,
      revokedAt: nowIso(),
      actorId: input.actorId,
      allow: () => true,
    });
    throw error instanceof Error ? error : new Error("Could not send the invitation.");
  }

  await getPlatform().events.publish(
    createEvent(
      "workspace.member.invited",
      { invitationId, email, role: input.role, expiresAt },
      { actorId: input.actorId, workspaceId: input.workspaceId },
    ),
  );

  return { invitationId };
}

export async function revokeWorkspaceInvitation(input: {
  actorId: UserId;
  workspaceId: WorkspaceId;
  invitationId: string;
}) {
  await ensureSchema();
  await assertPermission(input.actorId, input.workspaceId, "workspace.members.invite");
  const result = await getPersistence().invitations.revoke({
    id: input.invitationId,
    workspaceId: input.workspaceId,
    revokedAt: nowIso(),
    actorId: input.actorId,
    allow: (actorRole, invitationRole) =>
      isMembershipRole(actorRole) &&
      isMembershipRole(invitationRole) &&
      actorMayRevokeInvitation(actorRole, invitationRole),
  });

  if (result === "forbidden") throw deny();
  if (result === "missing") {
    throw new WorkspaceAccessError(
      "invitation-missing",
      "That invitation is not in this workspace.",
    );
  }
  if (result === "closed") {
    throw new WorkspaceAccessError("invitation-closed", "That invitation is no longer pending.");
  }

  const invitation = await getPersistence().invitations.findById(input.invitationId);
  await getPlatform().events.publish(
    createEvent(
      "workspace.invitation.revoked",
      { invitationId: input.invitationId, email: invitation?.email ?? "" },
      { actorId: input.actorId, workspaceId: input.workspaceId },
    ),
  );
}

export async function changeWorkspaceMemberRole(input: {
  actorId: UserId;
  workspaceId: WorkspaceId;
  userId: UserId;
  role: Role;
}) {
  await ensureSchema();
  await assertPermission(input.actorId, input.workspaceId, "workspace.members.manage");
  const result = await getPersistence().memberships.updateRole({
    actorId: input.actorId,
    workspaceId: input.workspaceId,
    userId: input.userId,
    role: input.role,
    allow: (actorRole) => isMembershipRole(actorRole) && actorMayChangeRole(actorRole),
  });

  if (result.status === "forbidden") throw deny();
  if (result.status === "missing") {
    throw new WorkspaceAccessError("missing", "That member is not in this workspace.");
  }
  if (result.status === "last-owner") {
    throw new WorkspaceAccessError(
      "last-owner",
      "A workspace must keep at least one owner.",
    );
  }
  if (result.status !== "updated") return;

  await getPlatform().events.publish(
    createEvent(
      "workspace.member.role_changed",
      { userId: input.userId, previousRole: result.previousRole, role: input.role },
      { actorId: input.actorId, workspaceId: input.workspaceId },
    ),
  );
}

export async function removeWorkspaceMember(input: {
  actorId: UserId;
  workspaceId: WorkspaceId;
  userId: UserId;
}) {
  await ensureSchema();
  await assertPermission(input.actorId, input.workspaceId, "workspace.members.manage");
  const result = await getPersistence().memberships.removeMember({
    actorId: input.actorId,
    workspaceId: input.workspaceId,
    userId: input.userId,
    allow: (actorRole, targetRole) =>
      isMembershipRole(actorRole) &&
      isMembershipRole(targetRole) &&
      actorMayRemove(actorRole, targetRole),
  });

  if (result.status === "forbidden") throw deny();
  if (result.status === "missing") {
    throw new WorkspaceAccessError("missing", "That member is not in this workspace.");
  }
  if (result.status === "last-owner") {
    throw new WorkspaceAccessError(
      "last-owner",
      "A workspace must keep at least one owner.",
    );
  }
  if (result.status !== "removed") return;

  await getPlatform().events.publish(
    createEvent(
      "workspace.member.removed",
      { userId: input.userId, removedRole: result.removedRole },
      { actorId: input.actorId, workspaceId: input.workspaceId },
    ),
  );
}

// An invitation does not change the role of someone who is already a member.
// Acceptance fails closed and leaves the invitation unconsumed.
export async function acceptWorkspaceInvitation(input: { userId: UserId; token: string }) {
  await ensureSchema();
  const accepted = await getPersistence().invitations.accept({
    tokenHash: hashInvitationToken(input.token),
    userId: input.userId,
    nowIso: nowIso(),
  });
  if (accepted.status !== "joined") {
    throw invitationFailure(accepted.status);
  }
  if (!isMembershipRole(accepted.role)) {
    throw invitationFailure("invalid");
  }

  if (accepted.createdMembership) {
    await getPlatform().events.publish(
      createEvent(
        "workspace.member.joined",
        {
          invitationId: accepted.invitationId,
          userId: accepted.userId,
          role: accepted.role,
        },
        { actorId: input.userId, workspaceId: accepted.workspaceId },
      ),
    );
  }

  return {
    workspaceId: accepted.workspaceId,
    role: accepted.role,
    createdMembership: accepted.createdMembership,
  };
}

export type InvitationPreview = {
  email: string;
  role: Role;
  workspaceName: string;
  state: "pending" | "expired" | "revoked" | "accepted";
};

export async function previewWorkspaceInvitation(token: string): Promise<InvitationPreview | null> {
  await ensureSchema();
  const row = await getPersistence().invitations.findByTokenHash(hashInvitationToken(token));
  if (!row || !isMembershipRole(row.role)) return null;
  const workspace = await getPersistence().organisations.findById(row.workspaceId);
  const now = nowIso();
  const state = row.revokedAt
    ? "revoked"
    : row.acceptedAt
      ? "accepted"
      : row.expiresAt <= now
        ? "expired"
        : "pending";
  return {
    email: row.email,
    role: row.role,
    workspaceName: workspace?.name ?? "Workspace",
    state,
  };
}

export async function loadWorkspaceAccess(input: {
  actorId: UserId;
  workspaceId: WorkspaceId;
}): Promise<WorkspaceAccessView> {
  await ensureSchema();
  const platform = getPlatform();
  const actorRole = await platform.permissions.roleFor(input.actorId, input.workspaceId);
  const canRead = await platform.permissions.can({
    userId: input.actorId,
    permission: "workspace.members.read",
    resource: { type: "workspace", id: input.workspaceId },
  });

  if (!canRead || !actorRole) {
    return {
      workspaceId: input.workspaceId,
      authorised: false,
      actorRole,
      notice: "You can use this workspace. Membership changes are limited to owners and admins.",
      inviteRoles: inviteRoleChoices(actorRole),
      members: [],
      invitations: [],
    };
  }

  const store = getPersistence();
  const memberships = await store.memberships.listByWorkspace(input.workspaceId);
  const ownerCount = memberships.filter((member) => member.role === "owner").length;
  const members: WorkspaceMemberView[] = [];
  for (const membership of memberships) {
    if (!isMembershipRole(membership.role)) continue;
    const user = await store.users.findById(membership.userId);
    const lastOwner = membership.role === "owner" && ownerCount <= 1;
    const canChangeRole = actorMayChangeRole(actorRole) && !lastOwner;
    const canRemove = actorMayRemove(actorRole, membership.role) && !lastOwner;
    members.push({
      userId: membership.userId,
      name: user?.name ?? "Unknown member",
      email: user?.email ?? "",
      role: membership.role,
      state: "Active",
      canChangeRole,
      canRemove,
      selectableRoles: canChangeRole ? ["owner", "admin", "member"] : [membership.role],
      restriction: memberRestriction(actorRole, membership.role, lastOwner),
    });
  }

  const now = nowIso();
  const invitations: WorkspaceInvitationView[] = [];
  for (const invitation of await store.invitations.listByWorkspace(input.workspaceId)) {
    if (invitation.acceptedAt || invitation.revokedAt || !isMembershipRole(invitation.role)) {
      continue;
    }
    const expired = invitation.expiresAt <= now;
    const canRevoke = actorMayRevokeInvitation(actorRole, invitation.role);
    invitations.push({
      id: invitation.id,
      email: invitation.email,
      role: invitation.role,
      expiresAt: invitation.expiresAt,
      state: expired ? "Expired" : "Pending",
      canRevoke,
      restriction: canRevoke
        ? null
        : invitation.role === "admin"
          ? "Only an owner can revoke an admin invitation."
          : "You cannot revoke this invitation.",
    });
  }

  return {
    workspaceId: input.workspaceId,
    authorised: true,
    actorRole,
    notice: null,
    inviteRoles: inviteRoleChoices(actorRole),
    members,
    invitations,
  };
}

function memberRestriction(actor: Role, target: Role, lastOwner: boolean) {
  if (lastOwner) return "A workspace must keep at least one owner.";
  if (actor === "owner") return null;
  if (target === "owner") return "Only an owner can change or remove an owner.";
  if (target === "admin") return "Only an owner can change or remove an admin.";
  return "Only an owner can change roles. You can remove a member.";
}
