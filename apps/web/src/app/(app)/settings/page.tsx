import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getShellSnapshot } from "@/core/shell/snapshot";
import { getSession } from "@/lib/auth/session";
import { SettingsScreen } from "@/modules/settings";

export const metadata: Metadata = {
  title: "Settings",
};

export default async function SettingsPage() {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  const snapshot = await getShellSnapshot();
  const workspace =
    snapshot.workspaces.find((item) => item.id === snapshot.activeWorkspaceId) ??
    snapshot.workspaces[0] ??
    null;

  return <SettingsScreen session={session} workspace={workspace} />;
}
