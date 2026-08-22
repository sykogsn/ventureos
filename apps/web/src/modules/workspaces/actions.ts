"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  getActiveWorkspaceId,
  getSession,
  setActiveWorkspaceCookie,
} from "@/lib/auth/session";
import { canAccessWorkspace, createWorkspace } from "@/modules/workspaces/service";
import type { WorkspaceId } from "@/contracts";

const schema = z.object({
  name: z.string().trim().min(2).max(80),
});

export type WorkspaceActionState = {
  error?: string;
};

export async function createWorkspaceAction(
  _prev: WorkspaceActionState,
  formData: FormData,
): Promise<WorkspaceActionState> {
  const session = await getSession();
  if (!session) {
    return { error: "You must be signed in." };
  }

  const parsed = schema.safeParse({ name: formData.get("name") });
  if (!parsed.success) {
    return { error: "Enter a workspace name." };
  }

  try {
    const workspace = await createWorkspace({
      userId: session.id,
      name: parsed.data.name,
      scopeWorkspaceId: await getActiveWorkspaceId(),
    });
    await setActiveWorkspaceCookie(workspace.id);
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Could not create workspace.",
    };
  }

  revalidatePath("/", "layout");
  return {};
}

export async function selectWorkspaceAction(workspaceId: string) {
  const session = await getSession();
  if (!session) {
    return;
  }

  const allowed = await canAccessWorkspace(
    session.id,
    workspaceId as WorkspaceId,
  );
  if (!allowed) {
    return;
  }

  await setActiveWorkspaceCookie(workspaceId);
  revalidatePath("/", "layout");
}
