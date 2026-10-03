"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { Role, UserId, WorkspaceId } from "@/contracts";
import { publicAppOrigin } from "@/lib/auth/origin";
import { getSession, setActiveWorkspaceCookie } from "@/lib/auth/session";
import {
  acceptWorkspaceInvitation,
  changeWorkspaceMemberRole,
  inviteWorkspaceMember,
  removeWorkspaceMember,
  revokeWorkspaceInvitation,
  WorkspaceAccessError,
} from "@/modules/workspaces/access";

export type AccessActionState = {
  error?: string;
  notice?: string;
};

const roleSchema = z.enum(["owner", "admin", "member"]);

function failure(error: unknown, fallback: string): AccessActionState {
  if (error instanceof WorkspaceAccessError) {
    return { error: error.message };
  }
  return { error: error instanceof Error ? error.message : fallback };
}

export async function inviteMemberAction(
  _prev: AccessActionState,
  formData: FormData,
): Promise<AccessActionState> {
  const session = await getSession();
  if (!session) return { error: "You must be signed in." };

  const parsed = z
    .object({
      workspaceId: z.string().min(1),
      email: z.string().email(),
      role: roleSchema,
    })
    .safeParse({
      workspaceId: formData.get("workspaceId"),
      email: formData.get("email"),
      role: formData.get("role"),
    });
  if (!parsed.success) {
    return { error: "Enter a valid email and choose an allowed role." };
  }

  try {
    await inviteWorkspaceMember({
      actorId: session.id,
      workspaceId: parsed.data.workspaceId as WorkspaceId,
      email: parsed.data.email,
      role: parsed.data.role,
      origin: await publicAppOrigin(),
    });
  } catch (error) {
    return failure(error, "Could not send the invitation.");
  }

  revalidatePath("/settings");
  return { notice: "Invitation sent." };
}

export async function revokeInvitationAction(
  _prev: AccessActionState,
  formData: FormData,
): Promise<AccessActionState> {
  const session = await getSession();
  if (!session) return { error: "You must be signed in." };

  const parsed = z
    .object({
      workspaceId: z.string().min(1),
      invitationId: z.string().min(1),
    })
    .safeParse({
      workspaceId: formData.get("workspaceId"),
      invitationId: formData.get("invitationId"),
    });
  if (!parsed.success) return { error: "That invitation could not be revoked." };

  try {
    await revokeWorkspaceInvitation({
      actorId: session.id,
      workspaceId: parsed.data.workspaceId as WorkspaceId,
      invitationId: parsed.data.invitationId,
    });
  } catch (error) {
    return failure(error, "Could not revoke the invitation.");
  }

  revalidatePath("/settings");
  return { notice: "Invitation revoked." };
}

export async function changeMemberRoleAction(
  _prev: AccessActionState,
  formData: FormData,
): Promise<AccessActionState> {
  const session = await getSession();
  if (!session) return { error: "You must be signed in." };

  const parsed = z
    .object({
      workspaceId: z.string().min(1),
      userId: z.string().min(1),
      role: roleSchema,
    })
    .safeParse({
      workspaceId: formData.get("workspaceId"),
      userId: formData.get("userId"),
      role: formData.get("role"),
    });
  if (!parsed.success) return { error: "Choose a valid role." };

  try {
    await changeWorkspaceMemberRole({
      actorId: session.id,
      workspaceId: parsed.data.workspaceId as WorkspaceId,
      userId: parsed.data.userId as UserId,
      role: parsed.data.role as Role,
    });
  } catch (error) {
    return failure(error, "Could not change that role.");
  }

  revalidatePath("/settings");
  return { notice: "Role updated." };
}

export async function removeMemberAction(
  _prev: AccessActionState,
  formData: FormData,
): Promise<AccessActionState> {
  const session = await getSession();
  if (!session) return { error: "You must be signed in." };

  const parsed = z
    .object({
      workspaceId: z.string().min(1),
      userId: z.string().min(1),
    })
    .safeParse({
      workspaceId: formData.get("workspaceId"),
      userId: formData.get("userId"),
    });
  if (!parsed.success) return { error: "That member could not be removed." };

  try {
    await removeWorkspaceMember({
      actorId: session.id,
      workspaceId: parsed.data.workspaceId as WorkspaceId,
      userId: parsed.data.userId as UserId,
    });
  } catch (error) {
    return failure(error, "Could not remove that member.");
  }

  revalidatePath("/settings");
  return { notice: "Workspace access removed." };
}

export async function acceptInvitationAction(
  _prev: AccessActionState,
  formData: FormData,
): Promise<AccessActionState> {
  const session = await getSession();
  if (!session) return { error: "Sign in with the invited email before accepting." };

  const token = formData.get("token");
  if (typeof token !== "string" || token.trim().length === 0) {
    return { error: "This invitation is invalid or has expired." };
  }

  try {
    const joined = await acceptWorkspaceInvitation({
      userId: session.id,
      token: token.trim(),
    });
    await setActiveWorkspaceCookie(joined.workspaceId);
  } catch (error) {
    return failure(error, "Could not accept the invitation.");
  }

  revalidatePath("/", "layout");
  redirect("/dashboard");
}
