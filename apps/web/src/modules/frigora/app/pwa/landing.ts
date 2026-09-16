import { frigoraAssignedWorkPath } from "@/modules/frigora/app/pwa/paths";

export type FrigoraPwaVenture = {
  id: string;
  name: string;
  definitionId: string;
};

export function listFrigoraPwaVentures(
  ventures: readonly FrigoraPwaVenture[],
): FrigoraPwaVenture[] {
  return ventures.filter((venture) => venture.definitionId === "frigora");
}

export function resolveFrigoraPwaStart(
  ventures: readonly FrigoraPwaVenture[],
): string | null {
  const rows = listFrigoraPwaVentures(ventures);
  if (rows.length !== 1 || !rows[0]) {
    return null;
  }
  return frigoraAssignedWorkPath(rows[0].id);
}
