import type { ReactNode } from "react";
import { VentureWorkspaceNav } from "./workspace-nav";
import { Flow, Stage } from "@/core/layout";

export function VentureWorkspace({
  ventureId,
  slug,
  definitionId,
  children,
}: {
  ventureId: string;
  slug: string;
  definitionId: string;
  children: ReactNode;
}) {
  return (
    <Stage>
      <VentureWorkspaceNav
        ventureId={ventureId}
        slug={slug}
        definitionId={definitionId}
      />
      <Flow>{children}</Flow>
    </Stage>
  );
}
