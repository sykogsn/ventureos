import type { ReactNode } from "react";
import { VentureWorkspaceNav } from "./workspace-nav";
import { Flow, Stage } from "@/core/layout";

export function VentureWorkspace({
  ventureId,
  slug,
  definitionId,
  canManageTeam = false,
  canAccessOffice = false,
  children,
}: {
  ventureId: string;
  slug: string;
  definitionId: string;
  canManageTeam?: boolean;
  canAccessOffice?: boolean;
  children: ReactNode;
}) {
  return (
    <Stage>
      <VentureWorkspaceNav
        ventureId={ventureId}
        slug={slug}
        definitionId={definitionId}
        canManageTeam={canManageTeam}
        canAccessOffice={canAccessOffice}
      />
      <Flow>{children}</Flow>
    </Stage>
  );
}
