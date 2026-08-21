import type { ReactNode } from "react";
import { PageFrame } from "@/core";
import { EmptyCopy } from "@/core/shell/empty-copy";
import type { SessionUser } from "@/lib/auth/session";
import { logoutAction } from "@/modules/auth/actions";
import { SettingsAppearance } from "./appearance";
import type { WorkspaceRecord } from "@/modules/workspaces/service";
import { getAiRuntime } from "@/ai/runtime";
import { aiRuntimeStatusLabel } from "@/ai/status-label";

function SettingsSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="flex max-w-xl flex-col gap-2 border-b border-border pb-6 last:border-b-0 last:pb-0">
      <h2 className="ids-kicker">{title}</h2>
      {children}
    </section>
  );
}

export function SettingsScreen({
  session,
  workspace,
}: {
  session: SessionUser;
  workspace: WorkspaceRecord | null;
}) {
  const runtime = getAiRuntime();

  return (
    <PageFrame
      page="Settings"
      kicker="Desk"
      title="Settings"
      description="Account, workspace, appearance and intelligence for this desk."
    >
      <SettingsSection title="Account">
        <p className="ids-body text-foreground">{session.name}</p>
        <p className="ids-caption">{session.email}</p>
        <form action={logoutAction} className="pt-2">
          <button type="submit" className="vos-btn-primary">
            Sign out
          </button>
        </form>
      </SettingsSection>

      <SettingsSection title="Workspace">
        {workspace ? (
          <p className="ids-body text-foreground">{workspace.name}</p>
        ) : (
          <EmptyCopy title="No workspace is selected">
            Create one from the switcher in the header to continue.
          </EmptyCopy>
        )}
        <EmptyCopy>
          Switch or create a workspace from the header. Membership is enforced before a switch.
        </EmptyCopy>
      </SettingsSection>

      <SettingsSection title="Appearance">
        <EmptyCopy>Theme applies to this browser. The same controls are in the header.</EmptyCopy>
        <SettingsAppearance />
      </SettingsSection>

      <SettingsSection title="Notifications">
        <EmptyCopy title="No inbox in Foundation">
          Founder calls and policy findings appear in the Situation Room, not a separate mailbox.
        </EmptyCopy>
      </SettingsSection>

      <SettingsSection title="Intelligence">
        <p className="ids-body text-foreground">
          Runtime status:{" "}
          <span className="ids-code">{aiRuntimeStatusLabel(runtime.status)}</span>
        </p>
        <EmptyCopy>
          Executive Intelligence Runtime is not a chat. Live intelligence is the Situation Room,
          Company HQ, and Executive Office.
        </EmptyCopy>
      </SettingsSection>
    </PageFrame>
  );
}
