import type { Role, UserId, WorkspaceId } from "@/contracts";

export const MEMBERSHIP_ROLES: readonly Role[] = ["owner", "admin", "member"];

export function isMembershipRole(value: string): value is Role {
  return value === "owner" || value === "admin" || value === "member";
}

export function roleLabel(role: Role) {
  if (role === "owner") return "Owner";
  if (role === "admin") return "Admin";
  return "Member";
}

export function actorMayInviteRole(actor: Role, target: Role) {
  if (target === "owner") return false;
  if (actor === "owner") return target === "admin" || target === "member";
  if (actor === "admin") return target === "member";
  return false;
}

export function actorMayChangeRole(actor: Role) {
  return actor === "owner";
}

export function actorMayRemove(actor: Role, target: Role) {
  if (actor === "owner") return true;
  if (actor === "admin") return target === "member";
  return false;
}

export function actorMayRevokeInvitation(actor: Role, invitationRole: Role) {
  if (invitationRole === "owner") return false;
  if (actor === "owner") return invitationRole === "admin" || invitationRole === "member";
  if (actor === "admin") return invitationRole === "member";
  return false;
}

export type InviteRoleChoice = {
  role: Role;
  enabled: boolean;
  reason: string | null;
};

export function inviteRoleChoices(actor: Role | null): InviteRoleChoice[] {
  return MEMBERSHIP_ROLES.map((role) => {
    if (!actor || !actorMayInviteRole(actor, role)) {
      return {
        role,
        enabled: false,
        reason:
          role === "owner"
            ? "Invitations cannot grant the owner role."
            : actor === "admin" && role === "admin"
              ? "Only an owner can invite an admin."
              : "You cannot invite that role.",
      };
    }
    return { role, enabled: true, reason: null };
  });
}

export type WorkspaceMemberView = {
  userId: UserId;
  name: string;
  email: string;
  role: Role;
  state: "Active";
  canChangeRole: boolean;
  canRemove: boolean;
  selectableRoles: Role[];
  restriction: string | null;
};

export type WorkspaceInvitationView = {
  id: string;
  email: string;
  role: Role;
  expiresAt: string;
  state: "Pending" | "Expired";
  canRevoke: boolean;
  restriction: string | null;
};

export type WorkspaceAccessView = {
  workspaceId: WorkspaceId;
  authorised: boolean;
  actorRole: Role | null;
  notice: string | null;
  inviteRoles: InviteRoleChoice[];
  members: WorkspaceMemberView[];
  invitations: WorkspaceInvitationView[];
};
