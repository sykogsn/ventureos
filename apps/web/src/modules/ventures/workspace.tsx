import type { ReactNode } from "react";
import { VentureWorkspaceNav } from "./workspace-nav";

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
    <div className="flex min-h-full flex-1 flex-col">
      <VentureWorkspaceNav ventureId={ventureId} slug={slug} />
      <div className="flex min-h-0 flex-1 flex-col">{children}</div>
    </div>
  );
}
