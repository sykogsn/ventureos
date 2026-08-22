import type { ReactNode } from "react";
import { VentureWorkspaceNav } from "./workspace-nav";
import { Flow, Stage } from "@/core/layout";

export function VentureWorkspace({
  ventureId,
  slug,
  children,
}: {
  ventureId: string;
  slug: string;
  children: ReactNode;
}) {
  return (
    <Stage>
      <VentureWorkspaceNav ventureId={ventureId} slug={slug} />
      <Flow>{children}</Flow>
    </Stage>
  );
}
