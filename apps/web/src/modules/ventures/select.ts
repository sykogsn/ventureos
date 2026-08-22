import type { VentureId } from "@/contracts";
import { assertVentureInWorkspace } from "@/core/venture-registry";
import { getSession, setActiveVentureCookie } from "@/lib/auth/session";
import { bootDesk } from "@/modules/intelligence/boot";

export async function persistActiveVentureSelection(
  ventureId: string,
): Promise<boolean> {
  const session = await getSession();
  if (!session) {
    return false;
  }

  const boot = await bootDesk(session.id);
  if (!boot) {
    return false;
  }

  try {
    assertVentureInWorkspace(boot.ventures, ventureId, boot.workspace.id);
  } catch {
    return false;
  }

  await setActiveVentureCookie(ventureId as VentureId);
  return true;
}
