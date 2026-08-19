import type { VentureId, WorkspaceId } from "@/contracts";
import { getActiveWorkspaceId, getSession } from "@/lib/auth/session";
import { executeIntelligenceRuntime } from "@/modules/intelligence/service";
import { resolveVentureProjectionWorkspace } from "@/modules/intelligence/workspace-scope";
import { getVenture } from "@/modules/ventures/service";
import { listWorkspaces } from "@/modules/workspaces/service";
import type { VentureIntelligenceCore } from "@/core/venture";
import type { SessionUser } from "@/lib/auth/session";
import type { WorkspaceRecord } from "@/modules/workspaces/service";

export async function loadActiveIntelligence(): Promise<{
  session: SessionUser;
  workspace: WorkspaceRecord;
  core: VentureIntelligenceCore;
} | null> {
  const session = await getSession();
  if (!session) {
    return null;
  }

  const workspaces = await listWorkspaces(session.id);
  const cookieId = await getActiveWorkspaceId();
  const workspace =
    workspaces.find((item) => item.id === cookieId) ?? workspaces[0];

  if (!workspace) {
    return null;
  }

  const snapshot = await executeIntelligenceRuntime({
    userId: session.id,
    workspaceId: workspace.id as WorkspaceId,
  });

  if (!snapshot) {
    return null;
  }

  return { session, workspace, core: snapshot.core };
}

export async function loadVentureScopedIntelligence(ventureId: VentureId): Promise<{
  session: SessionUser;
  workspace: WorkspaceRecord;
  core: VentureIntelligenceCore;
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

  const workspaces = await listWorkspaces(session.id);
  const workspace = workspaces.find((item) => item.id === workspaceId);
  if (!workspace) {
    return null;
  }

  const snapshot = await executeIntelligenceRuntime({
    userId: session.id,
    workspaceId: workspaceId as WorkspaceId,
  });

  if (!snapshot) {
    return null;
  }

  return { session, workspace, core: snapshot.core };
}
