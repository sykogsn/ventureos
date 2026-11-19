import { notFound } from "next/navigation";
import { PageFrame } from "@/core";
import { requireFrigoraOpsContext } from "@/modules/frigora/app/context";
import { WorkspaceAccessPanel } from "@/modules/workspaces/access-panel";
import { loadWorkspaceAccess } from "@/modules/workspaces/access";

export default async function FrigoraTeamAccessPage({
  params,
}: {
  params: Promise<{ ventureId: string }>;
}) {
  const { ventureId } = await params;
  const ctx = await requireFrigoraOpsContext(ventureId);
  const access = await loadWorkspaceAccess({
    actorId: ctx.sessionUserId,
    workspaceId: ctx.workspaceId,
  });

  if (
    !access.authorised ||
    (access.actorRole !== "owner" && access.actorRole !== "admin")
  ) {
    notFound();
  }

  return (
    <PageFrame
      page="Team & Access"
      kicker="Frigora"
      title="Team & Access"
      description={`Manage team invitations and workspace access for ${ctx.venture.name}.`}
    >
      <WorkspaceAccessPanel access={access} />
    </PageFrame>
  );
}
