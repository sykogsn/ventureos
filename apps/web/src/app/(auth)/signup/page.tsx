import type { Metadata } from "next";
import { SignupScreen } from "@/modules/auth";
import { previewWorkspaceInvitation } from "@/modules/workspaces/access";
import { roleLabel } from "@/modules/workspaces/access-policy";

export const metadata: Metadata = {
  title: "Create account",
};

function tokenFromNext(next: string) {
  const query = next.split("?")[1];
  if (!query) return "";
  return new URLSearchParams(query).get("token") ?? "";
}

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string | string[]; next?: string | string[] }>;
}) {
  const params = await searchParams;
  const next = typeof params.next === "string" ? params.next : "";
  const explicitToken = typeof params.token === "string" ? params.token : "";
  const token = explicitToken || tokenFromNext(next);
  const preview = token ? await previewWorkspaceInvitation(token) : null;
  const pending = preview?.state === "pending";

  return (
    <SignupScreen
      invitationToken={token}
      invitationEmail={pending ? preview.email : ""}
      workspaceName={pending ? preview.workspaceName : ""}
      invitationRole={pending ? roleLabel(preview.role) : ""}
    />
  );
}
