import { notFound } from "next/navigation";
import type { VentureId, WorkspaceId } from "@/contracts";
import { getActiveWorkspaceId, getSession } from "@/lib/auth/session";
import { getVenture, type VentureRecord } from "@/modules/ventures/service";
import { getPlatform } from "@/platform/kernel";

export type FrigoraOpsContext = {
  sessionUserId: string;
  workspaceId: WorkspaceId;
  ventureId: VentureId;
  venture: VentureRecord;
  canWrite: boolean;
};

export function isFrigoraVenture(definitionId: string): boolean {
  return definitionId === "frigora";
}

export function ventureMatchesActiveWorkspace(
  venture: Pick<VentureRecord, "workspaceId">,
  activeWorkspaceId: string | null,
): boolean {
  return Boolean(activeWorkspaceId && venture.workspaceId === activeWorkspaceId);
}

export async function requireFrigoraOpsContext(
  ventureIdParam: string,
): Promise<FrigoraOpsContext> {
  const session = await getSession();
  if (!session) {
    notFound();
  }

  const venture = await getVenture(session.id, ventureIdParam as VentureId);
  if (!venture || !isFrigoraVenture(venture.definitionId)) {
    notFound();
  }

  const activeWorkspaceId = await getActiveWorkspaceId();
  if (!ventureMatchesActiveWorkspace(venture, activeWorkspaceId)) {
    notFound();
  }

  const canWrite = await getPlatform().permissions.can({
    userId: session.id,
    permission: "venture.update",
    resource: { type: "workspace", id: venture.workspaceId },
  });

  return {
    sessionUserId: session.id,
    workspaceId: venture.workspaceId,
    ventureId: venture.id,
    venture,
    canWrite,
  };
}

export function frigoraScope(ctx: Pick<FrigoraOpsContext, "workspaceId" | "ventureId">) {
  return {
    workspaceId: ctx.workspaceId,
    ventureId: ctx.ventureId,
  };
}
