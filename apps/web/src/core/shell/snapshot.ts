import { getSession } from "@/lib/auth/session";
import { bootDesk } from "@/modules/intelligence/boot";
import type { WorkspaceRecord } from "@/modules/workspaces/service";
import type { VentureRecord } from "@/modules/ventures/service";

export type ShellSnapshot = {
  workspaces: WorkspaceRecord[];
  ventures: VentureRecord[];
  activeWorkspaceId: string | null;
  activeVentureId: string | null;
};

export async function getShellSnapshot(): Promise<ShellSnapshot> {
  const session = await getSession();
  if (!session) {
    return {
      workspaces: [],
      ventures: [],
      activeWorkspaceId: null,
      activeVentureId: null,
    };
  }

  const boot = await bootDesk(session.id);
  if (!boot) {
    return {
      workspaces: [],
      ventures: [],
      activeWorkspaceId: null,
      activeVentureId: null,
    };
  }

  return {
    workspaces: boot.workspaces.map((workspace) => ({
      id: workspace.id,
      name: workspace.name,
      slug: workspace.slug,
    })),
    ventures: boot.ventures.map((venture) => ({
      id: venture.id,
      workspaceId: venture.workspaceId,
      name: venture.name,
      slug: venture.slug,
      definitionId: venture.definition.id,
      definitionVersion: venture.definition.version,
    })),
    activeWorkspaceId: boot.workspace.id,
    activeVentureId: boot.activeVenture?.id ?? null,
  };
}
