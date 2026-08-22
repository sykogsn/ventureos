import type { Role, WorkspaceId } from "@/contracts";

export type WorkspaceRegistryEntry = {
  id: WorkspaceId;
  name: string;
  slug: string;
  role: Role;
};
