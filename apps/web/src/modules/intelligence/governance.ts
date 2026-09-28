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

export const INTELLIGENCE_READ_PERMISSION = "venture.read" as const;
export const INTELLIGENCE_WRITE_PERMISSION = "venture.update" as const;

export async function canAccessOperationalIntelligence(
  userId: UserId,
  workspaceId: WorkspaceId,
  mode: "read" | "write",
): Promise<boolean> {
  return getPlatform().permissions.can({
    userId,
    permission:
      mode === "read"
        ? INTELLIGENCE_READ_PERMISSION
        : INTELLIGENCE_WRITE_PERMISSION,
    resource: { type: "workspace", id: workspaceId },
  });
}
