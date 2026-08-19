"use client";

import { useEffect, type ReactNode } from "react";
import { useParams } from "next/navigation";
import { ShellProvider, useShell } from "@/core/context/shell-context";
import { CommandPalette } from "@/core/shell/command-palette";
import { Sidebar } from "@/core/shell/sidebar";
import { TopNav } from "@/core/shell/top-nav";
import { IdsBrandBinder } from "@/core/theme/ids-brand-binder";
import type { WorkspaceRecord } from "@/modules/workspaces/service";
import type { VentureRecord } from "@/modules/ventures/service";
import "@/extensions";

function VentureRouteSync() {
  const params = useParams<{ ventureId?: string }>();
  const { setActiveVentureId } = useShell();

  useEffect(() => {
    setActiveVentureId(params.ventureId ?? null);
  }, [params.ventureId, setActiveVentureId]);

  return null;
}

function ShellFrame({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-full bg-background text-foreground">
      <a
        href="#main-content"
        className="ids-label fixed left-4 top-4 z-skip -translate-y-[180%] rounded-md bg-accent px-3 py-2 text-accent-foreground shadow-panel focus:translate-y-0 focus:outline-none focus-visible:translate-y-0"
      >
        Skip to main content
      </a>
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopNav />
        <main
          id="main-content"
          tabIndex={-1}
          className="flex min-h-0 flex-1 flex-col overflow-y-auto"
        >
          {children}
        </main>
      </div>
      <CommandPalette />
    </div>
  );
}

export function OsShell({
  children,
  workspaces,
  ventures,
  activeWorkspaceId,
}: {
  children: ReactNode;
  workspaces: WorkspaceRecord[];
  ventures: VentureRecord[];
  activeWorkspaceId: string | null;
}) {
  return (
    <ShellProvider
      workspaces={workspaces}
      ventures={ventures}
      initialWorkspaceId={activeWorkspaceId}
    >
      <VentureRouteSync />
      <IdsBrandBinder />
      <ShellFrame>{children}</ShellFrame>
    </ShellProvider>
  );
}
