import type { UserId, VentureId, WorkspaceId } from "./ids";

export type Permission =
  | "workspace.read"
  | "workspace.update"
  | "workspace.create"
  | "venture.create"
  | "venture.read"
  | "venture.update";

export type Role = "owner" | "admin" | "member";

export type PermissionResource = {
  type: "workspace" | "venture" | "platform";
  id?: WorkspaceId | VentureId;
};

export type PermissionCheck = {
  userId: UserId;
  permission: Permission;
  resource: PermissionResource;
};

export type PermissionService = {
  grant(userId: UserId, role: Role, workspaceId: WorkspaceId): Promise<void>;
  can(check: PermissionCheck): Promise<boolean>;
  roleFor(userId: UserId, workspaceId: WorkspaceId): Promise<Role | null>;
};
