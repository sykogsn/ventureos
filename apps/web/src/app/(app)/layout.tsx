import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { OsShell } from "@/core/shell/os-shell";
import { getShellSnapshot } from "@/core/shell/snapshot";
import { getSession } from "@/lib/auth/session";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  const snapshot = await getShellSnapshot();

  return (
    <OsShell
      user={{ name: session.name, email: session.email }}
      workspaces={snapshot.workspaces}
      ventures={snapshot.ventures}
      activeWorkspaceId={snapshot.activeWorkspaceId}
      activeVentureId={snapshot.activeVentureId}
    >
      {children}
    </OsShell>
  );
}
