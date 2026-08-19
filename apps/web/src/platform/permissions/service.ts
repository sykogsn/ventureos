import type {
  Permission,
  PermissionCheck,
  PermissionService,
  Role,
  UserId,
  WorkspaceId,
} from "@/contracts";

const rolePermissions: Record<Role, Permission[]> = {
  owner: [
    "workspace.read",
    "workspace.update",
    "workspace.create",
    "venture.create",
    "venture.read",
    "venture.update",
  ],
  admin: [
    "workspace.read",
    "workspace.update",
    "venture.create",
    "venture.read",
    "venture.update",
  ],
  member: ["workspace.read", "venture.read"],
};

export type MembershipStore = {
  getRole(userId: UserId, workspaceId: WorkspaceId): Promise<Role | null>;
  setRole(userId: UserId, workspaceId: WorkspaceId, role: Role): Promise<void>;
};

export function createPermissionService(
  memberships: MembershipStore,
): PermissionService {
  return {
    async grant(userId, role, workspaceId) {
      await memberships.setRole(userId, workspaceId, role);
    },
    async roleFor(userId, workspaceId) {
      return memberships.getRole(userId, workspaceId);
    },
    async can(check: PermissionCheck) {
      if (check.resource.type === "platform") {
        return false;
      }

      const workspaceId = check.resource.id as WorkspaceId | undefined;
      if (!workspaceId) {
        return false;
      }

      const role = await memberships.getRole(check.userId, workspaceId);
      if (!role) {
        return false;
      }

      return rolePermissions[role].includes(check.permission);
    },
  };
}
