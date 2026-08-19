import type { UserId, WorkspaceId } from "@/contracts";
import { getPlatform } from "@/platform/kernel";

export const FOUNDER_DECISION_PERMISSION = "venture.update" as const;

export async function canRecordFounderDecision(
  userId: UserId,
  workspaceId: WorkspaceId,
): Promise<boolean> {
  return getPlatform().permissions.can({
    userId,
    permission: FOUNDER_DECISION_PERMISSION,
    resource: { type: "workspace", id: workspaceId },
  });
}
