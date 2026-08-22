import type { VentureId, WorkspaceId } from "@/contracts";
import type { VentureDefinitionRef } from "@/core/venture-definition";

export type VentureRegistryEntry = {
  id: VentureId;
  workspaceId: WorkspaceId;
  name: string;
  slug: string;
  definition: VentureDefinitionRef;
};
