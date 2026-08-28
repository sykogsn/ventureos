import type { Metadata } from "next";
import type { WorkspaceId } from "@/contracts";
import { getShellSnapshot } from "@/core/shell/snapshot";
import { WORKFORCE_APPROVAL_PERMISSION } from "@/core/workforce/approval";
import { getSession } from "@/lib/auth/session";
import { resolveWorkforceDeskState } from "@/modules/workforce/desk";
import { WorkforceDeskScreen } from "@/modules/workforce/desk-screen";
import { getPlatform } from "@/platform/kernel";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Workforce",
};

export default async function WorkforcePage() {
  const session = await getSession();
  const snapshot = await getShellSnapshot();
  const workspaceId = snapshot.activeWorkspaceId;

  const canOperate =
    session && workspaceId
      ? await getPlatform().permissions.can({
          userId: session.id,
          permission: WORKFORCE_APPROVAL_PERMISSION,
          resource: { type: "workspace", id: workspaceId as WorkspaceId },
        })
      : false;

  const state = resolveWorkforceDeskState({
    hasWorkspace: Boolean(workspaceId),
    canOperate,
    companyCount: snapshot.ventures.length,
  });

  return <WorkforceDeskScreen state={state} />;
}
