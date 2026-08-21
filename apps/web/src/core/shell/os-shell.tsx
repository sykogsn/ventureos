"use client";

import { useEffect, type ReactNode } from "react";
import { useParams } from "next/navigation";
import { ShellProvider, useShell } from "@/core/context/shell-context";
import { CommandPalette } from "@/core/shell/command-palette";
import { Sidebar } from "@/core/shell/sidebar";
import { TopNav } from "@/core/shell/top-nav";
import { IdsBrandBinder } from "@/core/theme/ids-brand-binder";
import {
  SkipLink,
  SplitView,
  Stage,
  Workspace,
  WorkspaceMain,
} from "@/core/layout";
import type { WorkspaceRecord } from "@/modules/workspaces/service";
import type { VentureRecord } from "@/modules/ventures/service";
import type { ShellUser } from "@/core/context/shell-context";
import "@/extensions";

function VentureRouteSync() {
  const params = useParams<{ ventureId?: string; slug?: string }>();
  const { setActiveVentureId, ventures } = useShell();

  useEffect(() => {
    if (params.ventureId) {
      setActiveVentureId(params.ventureId);
      return;
    }

    if (params.slug) {
      const match = ventures.find((item) => item.slug === params.slug);
      setActiveVentureId(match?.id ?? null);
      return;
    }

    setActiveVentureId(null);
  }, [params.ventureId, params.slug, setActiveVentureId, ventures]);

  return null;
}

function ShellFrame({ children }: { children: ReactNode }) {
  return (
    <Workspace>
      <SkipLink />
      <SplitView>
        <Sidebar />
        <Stage>
          <TopNav />
          <WorkspaceMain>{children}</WorkspaceMain>
        </Stage>
      </SplitView>
      <CommandPalette />
    </Workspace>
  );
}

export function OsShell({
  children,
  user,
  workspaces,
  ventures,
  activeWorkspaceId,
}: {
  children: ReactNode;
  user: ShellUser;
  workspaces: WorkspaceRecord[];
  ventures: VentureRecord[];
  activeWorkspaceId: string | null;
}) {
  return (
    <ShellProvider
      user={user}
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
