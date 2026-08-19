import type { WorkspaceId } from "@/contracts";
import {
  getActiveWorkspaceId,
  getSession,
} from "@/lib/auth/session";
import { listWorkspaces } from "@/modules/workspaces/service";
import { listVentures } from "@/modules/ventures/service";
import type { WorkspaceRecord } from "@/modules/workspaces/service";
import type { VentureRecord } from "@/modules/ventures/service";

export type ShellSnapshot = {
  workspaces: WorkspaceRecord[];
  ventures: VentureRecord[];
  activeWorkspaceId: string | null;
};

export async function getShellSnapshot(): Promise<ShellSnapshot> {
  const session = await getSession();
  if (!session) {
    return { workspaces: [], ventures: [], activeWorkspaceId: null };
  }

  const workspaces = await listWorkspaces(session.id);
  const cookieId = await getActiveWorkspaceId();
  const active =
    workspaces.find((workspace) => workspace.id === cookieId) ?? workspaces[0];
  const activeWorkspaceId = active?.id ?? null;
  const ventures = activeWorkspaceId
    ? await listVentures(session.id, activeWorkspaceId as WorkspaceId)
    : [];

  return {
    workspaces,
    ventures,
    activeWorkspaceId,
  };
}
