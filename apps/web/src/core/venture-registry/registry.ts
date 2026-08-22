import type { VentureId, WorkspaceId } from "@/contracts";
import {
  DEFAULT_VENTURE_DEFINITION_REF,
  type VentureDefinitionRef,
} from "@/core/venture-definition";
import type { VentureRegistryEntry } from "./types";

export function definitionRefFromStored(
  definitionId: string,
  definitionVersion: string,
): VentureDefinitionRef {
  return {
    id: definitionId || DEFAULT_VENTURE_DEFINITION_REF.id,
    version: definitionVersion || DEFAULT_VENTURE_DEFINITION_REF.version,
  };
}

export function resolveActiveVenture(
  ventures: VentureRegistryEntry[],
  requestedId: string | null,
): VentureRegistryEntry | null {
  if (requestedId) {
    const allowed = ventures.find((venture) => venture.id === requestedId);
    if (allowed) {
      return allowed;
    }
  }

  return ventures[0] ?? null;
}

export function assertVentureInWorkspace(
  ventures: VentureRegistryEntry[],
  ventureId: string,
  workspaceId: WorkspaceId,
): VentureRegistryEntry {
  const found = ventures.find((venture) => venture.id === ventureId);
  if (!found || found.workspaceId !== workspaceId) {
    throw new Error("Unknown company.");
  }

  return found;
}

export function venturesInWorkspace(
  ventures: VentureRegistryEntry[],
  workspaceId: WorkspaceId,
): VentureRegistryEntry[] {
  return ventures.filter((venture) => venture.workspaceId === workspaceId);
}

export function toVentureRegistryEntry(input: {
  id: VentureId;
  workspaceId: WorkspaceId;
  name: string;
  slug: string;
  definitionId: string;
  definitionVersion: string;
}): VentureRegistryEntry {
  return {
    id: input.id,
    workspaceId: input.workspaceId,
    name: input.name,
    slug: input.slug,
    definition: definitionRefFromStored(input.definitionId, input.definitionVersion),
  };
}
