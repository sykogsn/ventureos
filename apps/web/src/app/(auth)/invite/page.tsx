import type { Metadata } from "next";
import { getSession } from "@/lib/auth/session";
import { previewWorkspaceInvitation } from "@/modules/workspaces/access";
import { InviteScreen } from "@/modules/workspaces/invite-screen";

export const metadata: Metadata = {
  title: "Workspace invitation",
};

export default async function InvitePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string | string[] }>;
}) {
  const params = await searchParams;
  const token = typeof params.token === "string" ? params.token : "";
  const [session, preview] = await Promise.all([
    getSession(),
    token ? previewWorkspaceInvitation(token) : Promise.resolve(null),
  ]);

  return <InviteScreen token={token} session={session} preview={preview} />;
}
