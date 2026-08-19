import type { Role } from "@/contracts";
import { nowIso } from "@/platform/ids";
import { getPersistence } from "@/platform/persistence/repositories";
import type { MembershipStore } from "@/platform/permissions/service";

export function createDbMembershipStore(): MembershipStore {
  return {
    async getRole(userId, workspaceId) {
      const role = await getPersistence().memberships.getRole(userId, workspaceId);
      return (role as Role | null) ?? null;
    },
    async setRole(userId, workspaceId, role) {
      await getPersistence().memberships.setRole({
        userId,
        workspaceId,
        role,
        createdAt: nowIso(),
      });
    },
  };
}
