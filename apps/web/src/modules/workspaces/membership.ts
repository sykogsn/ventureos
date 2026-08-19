import type { Role } from "@/contracts";

export function membershipAllowsWorkspaceSelection(role: Role | null): boolean {
  return role !== null;
}
