import type { UserId } from "@/contracts";
import {
  resolveWorkspace,
  type WorkspaceRegistryEntry,
} from "@/core/workspace-registry";
import {
  resolveActiveVenture,
  type VentureRegistryEntry,
} from "@/core/venture-registry";
import { listWorkspaceCatalogue } from "@/modules/workspaces/service";
import { listVentureCatalogue } from "@/modules/ventures/service";
import {
  getActiveVentureId,
  getActiveWorkspaceId,
} from "@/lib/auth/session";

export type DeskBoot = {
  userId: UserId;
  workspaces: WorkspaceRegistryEntry[];
  workspace: WorkspaceRegistryEntry;
  ventures: VentureRegistryEntry[];
  activeVenture: VentureRegistryEntry | null;
};

export function assembleDeskBoot(input: {
  userId: UserId;
  workspaces: WorkspaceRegistryEntry[];
  ventures: VentureRegistryEntry[];
  requestedWorkspaceId: string | null;
  requestedVentureId: string | null;
}): DeskBoot | null {
  const workspace = resolveWorkspace(input.workspaces, input.requestedWorkspaceId);
  if (!workspace) {
    return null;
  }

  const ventures = input.ventures.filter(
    (venture) => venture.workspaceId === workspace.id,
  );

  return {
    userId: input.userId,
    workspaces: input.workspaces,
    workspace,
    ventures,
    activeVenture: resolveActiveVenture(ventures, input.requestedVentureId),
  };
}

export async function bootDesk(userId: UserId): Promise<DeskBoot | null> {
  const workspaces = await listWorkspaceCatalogue(userId);
  const requestedWorkspaceId = await getActiveWorkspaceId();
  const workspace = resolveWorkspace(workspaces, requestedWorkspaceId);
  if (!workspace) {
    return null;
  }

  const ventures = await listVentureCatalogue(userId, workspace.id);
  return assembleDeskBoot({
    userId,
    workspaces,
    ventures,
    requestedWorkspaceId,
    requestedVentureId: await getActiveVentureId(),
  });
}
