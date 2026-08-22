import type { PermissionService, UserId, WorkspaceId } from "@/contracts";
import type { WorkspaceRegistryEntry } from "./types";
import { resolveWorkspace } from "./registry";

export function canFoundFirstWorkspace(existingCount: number): boolean {
  return existingCount === 0;
}

export async function assertCanCreateWorkspace(input: {
  userId: UserId;
  workspaces: WorkspaceRegistryEntry[];
  scopeWorkspaceId: string | null;
  permissions: PermissionService;
}): Promise<void> {
  if (canFoundFirstWorkspace(input.workspaces.length)) {
    return;
  }

  const scope = resolveWorkspace(input.workspaces, input.scopeWorkspaceId);
  if (!scope) {
    throw new Error("You cannot create a workspace.");
  }

  const allowed = await input.permissions.can({
    userId: input.userId,
    permission: "workspace.create",
    resource: { type: "workspace", id: scope.id as WorkspaceId },
  });

  if (!allowed) {
    throw new Error("You cannot create a workspace.");
  }
}
