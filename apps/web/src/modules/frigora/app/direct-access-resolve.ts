import type { Role, UserId } from "@/contracts";
import { isFrigoraVenture } from "@/modules/frigora/app/context";
import {
  type AuthorisedFrigoraAccess,
  isSafeFrigoraResourceId,
} from "@/modules/frigora/app/direct-access";
import { listVentures } from "@/modules/ventures/service";
import { listWorkspaces } from "@/modules/workspaces/service";
import { getPlatform } from "@/platform/kernel";

const ASSIGNABLE_ROLES = new Set<Role>(["owner", "admin", "member"]);

function isAssignableRole(role: Role | null): role is Role {
  return role !== null && ASSIGNABLE_ROLES.has(role);
}

/**
 * Frigora companies the user can read, across every workspace they belong to.
 * Membership is the source of truth. The active-workspace cookie and list order are not.
 */
export async function listAuthorisedFrigoraVentures(
  userId: UserId,
): Promise<AuthorisedFrigoraAccess[]> {
  const workspaces = await listWorkspaces(userId);
  const found: AuthorisedFrigoraAccess[] = [];

  for (const workspace of workspaces) {
    if (!isSafeFrigoraResourceId(workspace.id)) continue;
    const role = await getPlatform().permissions.roleFor(userId, workspace.id);
    if (!isAssignableRole(role)) continue;
    const ventures = await listVentures(userId, workspace.id);
    for (const venture of ventures) {
      if (!isFrigoraVenture(venture.definitionId)) continue;
      if (!isSafeFrigoraResourceId(venture.id)) continue;
      if (venture.workspaceId !== workspace.id) continue;
      found.push({
        id: venture.id,
        name: venture.name,
        workspaceId: workspace.id,
        workspaceName: workspace.name,
        role,
      });
    }
  }

  found.sort((left, right) => {
    const byWorkspace = left.workspaceName.localeCompare(right.workspaceName);
    if (byWorkspace !== 0) return byWorkspace;
    const byName = left.name.localeCompare(right.name);
    if (byName !== 0) return byName;
    return left.id.localeCompare(right.id);
  });

  return found;
}
