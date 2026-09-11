import type { VentureId, WorkspaceId } from "@/contracts";
import { loadVentureIntelligence } from "@/modules/intelligence/service";
import { bootDesk } from "@/modules/intelligence/boot";
import { getVenture } from "@/modules/ventures/service";
import { getActiveWorkspaceId, getSession } from "@/lib/auth/session";
import { resolveVentureProjectionWorkspace } from "@/modules/intelligence/workspace-scope";
import { listWorkspaceCatalogue } from "@/modules/workspaces/service";
import type { VentureIntelligenceCore } from "@/core/venture";
import type { SessionUser } from "@/lib/auth/session";
import type { WorkspaceRecord } from "@/modules/workspaces/service";
import type { VentureRegistryEntry } from "@/core/venture-registry";

export async function loadActiveIntelligence(): Promise<{
  session: SessionUser;
  workspace: WorkspaceRecord;
  core: VentureIntelligenceCore;
  activeVenture: VentureRegistryEntry | null;
} | null> {
  const session = await getSession();
  if (!session) {
    return null;
  }

  const boot = await bootDesk(session.id);
  if (!boot) {
    return null;
  }

  const core = await loadVentureIntelligence(session.id, boot.workspace.id);
  if (!core) {
    return null;
  }

  return {
    session,
    workspace: {
      id: boot.workspace.id,
      name: boot.workspace.name,
      slug: boot.workspace.slug,
    },
    core,
    activeVenture: boot.activeVenture,
  };
}

export async function loadVentureScopedIntelligence(ventureId: VentureId): Promise<{
  session: SessionUser;
  workspace: WorkspaceRecord;
  core: VentureIntelligenceCore;
  activeVenture: VentureRegistryEntry | null;
} | null> {
  const session = await getSession();
  if (!session) {
    return null;
  }

  const venture = await getVenture(session.id, ventureId);
  const workspaceId = resolveVentureProjectionWorkspace({
    ventureWorkspaceId: venture?.workspaceId ?? null,
    cookieWorkspaceId: await getActiveWorkspaceId(),
  });

  if (!venture || !workspaceId) {
    return null;
  }

  const workspaces = await listWorkspaceCatalogue(session.id);
  const workspace = workspaces.find((item) => item.id === workspaceId);
  if (!workspace) {
    return null;
  }

  const core = await loadVentureIntelligence(
    session.id,
    workspaceId as WorkspaceId,
  );
  if (!core) {
    return null;
  }

  return {
    session,
    workspace: {
      id: workspace.id,
      name: workspace.name,
      slug: workspace.slug,
    },
    core,
    activeVenture: {
      id: venture.id,
      workspaceId: venture.workspaceId,
      name: venture.name,
      slug: venture.slug,
      definition: {
        id: venture.definitionId,
        version: venture.definitionVersion,
      },
    },
  };
}
