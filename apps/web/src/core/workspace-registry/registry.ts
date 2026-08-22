import type { WorkspaceId } from "@/contracts";
import type { WorkspaceRegistryEntry } from "./types";

export function resolveWorkspace(
  workspaces: WorkspaceRegistryEntry[],
  requestedId: string | null,
): WorkspaceRegistryEntry | null {
  if (requestedId) {
    const allowed = workspaces.find((workspace) => workspace.id === requestedId);
    if (allowed) {
      return allowed;
    }
  }

  return workspaces[0] ?? null;
}

export function assertWorkspaceKnown(
  workspaces: WorkspaceRegistryEntry[],
  workspaceId: string,
): WorkspaceRegistryEntry {
  const found = workspaces.find((workspace) => workspace.id === workspaceId);
  if (!found) {
    throw new Error("Unknown workspace.");
  }

  return found;
}

export function isKnownWorkspace(
  workspaces: WorkspaceRegistryEntry[],
  workspaceId: WorkspaceId,
): boolean {
  return workspaces.some((workspace) => workspace.id === workspaceId);
}
